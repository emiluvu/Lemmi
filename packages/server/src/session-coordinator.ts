import {
  operations,
  ok,
  fail,
  ParticipantProfileSchema,
  SessionSnapshotSchema,
  SessionCommandSchema,
  ActivityTransitionSchema,
  validateActivityCommandContext,
  ConversationTextCommandSchema,
  ConversationReplySchema,
  PhotoStoryCommandSchema,
  type PhotoStoryResult,
  type ApprovedPack,
  type ConversationTextResult,
  type ActivityEvent,
  type ActivitySystemInput,
  type Operation,
  type OperationOutput,
  type Result,
  type SessionSnapshot,
  type ActivityState,
  type ActivityContext,
  type Journal,
  type HelpSnapshot,
} from '@lemmi/contracts';
import {
  caregiverProfile,
  previewProfiles,
  preferences,
  disabledCheckIn,
  musicPack,
  contextFor,
  DEMO_PROFILE_ID,
} from '@lemmi/contracts/fixtures';
import {
  createActivity,
  reduceActivity,
  projectActivity,
  applyActivitySystemInput,
  preparePhotoStoryTurn,
} from '@lemmi/activities';
import { createHash } from 'node:crypto';
import { companionInput } from './adapters/companion-prompt';
import { fixedInputReply, routeParticipantText } from './adapters/input-routing';
import type { ChatAdapter, ChatMessage, SttAdapter, TtsAdapter } from './adapters/types';
// One in-memory authority. Live mode currently exposes controls only, with no media/retention.
export class SessionCoordinator {
  constructor(
    private readonly mode: 'mock' | 'live' = 'mock',
    private readonly chatAdapter?: ChatAdapter,
    private readonly photoOptions?: {
      pack: ApprovedPack;
      speech: { stt: SttAdapter; tts: TtsAdapter };
      chatMode: 'reviewed_demo' | 'openrouter' | 'unavailable';
      sttEnabled: boolean;
      ttsEnabled: boolean;
    },
  ) {}
  private activityPack: ApprovedPack = musicPack;
  private pendingMedia: { kind: 'stt' | 'tts'; controller: AbortController } | null = null;
  private captureDeadline = 0;
  private mediaIds = new Set<string>();
  photoStoryStatus() {
    return {
      session: this.photoOptions ? this.snapshot() : null,
      activity:
        this.photoOptions && this.activity && this.context
          ? projectActivity(this.activity, this.activityPack, this.context)
          : null,
      enabled: !!this.photoOptions,
      chat: this.photoOptions?.chatMode ?? 'unavailable',
      stt: this.photoOptions?.sttEnabled ?? false,
      tts: this.photoOptions?.ttsEnabled ?? false,
      analysis: 'caption_only' as const,
    };
  }
  private cancelPhotoMedia() {
    this.pendingMedia?.controller.abort();
    this.pendingMedia = null;
    this.captureDeadline = 0;
  }
  async photoStory(raw: unknown): Promise<Result<PhotoStoryResult>> {
    const parsed = PhotoStoryCommandSchema.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid Photo Story command');
    const command = parsed.data;
    const session = this.session;
    const activity = this.activity;
    if (
      !this.photoOptions ||
      !session ||
      !activity ||
      activity.activityId !== 'photo_album' ||
      command.sessionId !== session.id ||
      command.instanceId !== activity.instanceId
    )
      return fail('NOT_FOUND', 'Photo Story session not found');
    if (
      command.expectedGeneration !== session.generation ||
      command.expectedRevision !== activity.revision ||
      ['paused', 'ended'].includes(session.phase) ||
      activity.phase !== 'active' ||
      activity.viewingMode !== 'talk'
    )
      return fail('REVISION_CONFLICT', 'Reload current Photo Story state');
    if (this.mediaIds.has(command.commandId))
      return fail('REVISION_CONFLICT', 'Photo Story command already consumed');
    if (this.mediaIds.size >= 512) return fail('UNAVAILABLE', 'Start a fresh demo session');
    if (this.pendingMedia || this.pendingChat)
      return fail('REVISION_CONFLICT', 'A turn is already pending');
    this.mediaIds.add(command.commandId);
    const input = command.input;
    const empty = (notice: string | null = null): Result<PhotoStoryResult> =>
      ok({ session: this.snapshot()!, reply: null, audio: null, notice });
    if (input.type === 'playback_end') {
      if (!this.isCurrentTextReply(input.turnId) || session.phase !== 'speaking')
        return fail('REVISION_CONFLICT', 'Playback is no longer current');
      this.session = { ...session, phase: 'waiting', captureGrant: null };
      return empty();
    }
    if (input.type === 'repeat' || input.type === 'synthesize') {
      const receipt = this.lastChat?.result;
      if (
        !receipt?.ok ||
        receipt.data.kind !== 'reply' ||
        (input.type === 'synthesize' && receipt.data.reply.turnId !== input.turnId) ||
        !['ready', 'waiting'].includes(session.phase)
      )
        return fail('REVISION_CONFLICT', 'No current reply to repeat');
      const reply = receipt.data.reply;
      const pending = { kind: 'tts' as const, controller: new AbortController() };
      this.pendingMedia = pending;
      this.session = { ...session, phase: 'speaking', captureGrant: null };
      try {
        const audio = await this.photoOptions.speech.tts.synthesize(
          { text: reply.text, language: reply.language },
          pending.controller.signal,
        );
        if (
          this.pendingMedia !== pending ||
          !this.isCurrentTextReply(reply.turnId) ||
          pending.controller.signal.aborted
        )
          return fail('REVISION_CONFLICT', 'Discarded obsolete speech');
        if (!audio.ok) {
          this.session = { ...this.session!, phase: 'waiting' };
          return audio;
        }
        return ok({
          session: this.snapshot()!,
          reply,
          notice: null,
          audio: {
            pcmBase64: Buffer.from(audio.data.pcm).toString('base64'),
            sampleRate: audio.data.sampleRate,
            encoding: 'pcm_s16le',
            channels: 1,
            turnId: reply.turnId,
          },
        });
      } catch {
        if (this.pendingMedia === pending) this.session = { ...this.session!, phase: 'waiting' };
        return fail('UNAVAILABLE', 'Speech synthesis unavailable');
      } finally {
        if (this.pendingMedia === pending) this.pendingMedia = null;
      }
    }
    let text: string;
    if (input.type === 'audio') {
      const grant = session.captureGrant;
      if (
        session.phase !== 'listening' ||
        session.micMuted ||
        !grant ||
        grant.turnId !== input.captureTurnId ||
        Date.now() > this.captureDeadline
      )
        return fail('REVISION_CONFLICT', 'Current listening grant required');
      const bytes = Buffer.from(input.pcmBase64, 'base64');
      if (
        !bytes.length ||
        bytes.length > 640000 ||
        bytes.length % 2 ||
        bytes.toString('base64') !== input.pcmBase64
      )
        return fail('VALIDATION_ERROR', 'Expected bounded 16 kHz PCM');
      const pending = { kind: 'stt' as const, controller: new AbortController() };
      this.pendingMedia = pending;
      this.session = { ...session, phase: 'processing', captureGrant: null };
      try {
        const transcript = await this.photoOptions.speech.stt.transcribe(
          { pcm: bytes, language: 'en' },
          pending.controller.signal,
        );
        if (
          this.pendingMedia !== pending ||
          pending.controller.signal.aborted ||
          this.session.generation !== session.generation
        )
          return fail('REVISION_CONFLICT', 'Discarded obsolete recognition');
        this.session = { ...this.session, phase: 'waiting', captureGrant: null };
        if (!transcript.ok) return transcript;
        text = transcript.data.text.trim();
        if (!text) return empty('I did not catch that. You can try again, type, or just look.');
      } catch {
        if (this.pendingMedia === pending)
          this.session = { ...this.session!, phase: 'waiting', captureGrant: null };
        return fail('UNAVAILABLE', 'Speech recognition unavailable');
      } finally {
        bytes.fill(0);
        if (this.pendingMedia === pending) this.pendingMedia = null;
      }
    } else {
      if (!['ready', 'waiting'].includes(session.phase))
        return fail('REVISION_CONFLICT', 'Finish listening or playback first');
      text = input.type === 'opening' ? 'Begin the approved Photo Story conversation.' : input.text;
    }
    const result = await this.submitText({
      commandId: `photo-${command.commandId}`,
      sessionId: session.id,
      expectedGeneration: session.generation,
      text,
      language: 'en',
    });
    return result.ok
      ? ok({
          session: result.data.session,
          reply: result.data.kind === 'reply' ? result.data.reply : null,
          audio: null,
          notice: null,
        })
      : result;
  }
  private dialogue: ChatMessage[] = [];
  private chatIds = new Map<string, string>();
  private lastChat: { commandId: string; result: Result<ConversationTextResult> } | null = null;
  private pendingChat: {
    commandId: string;
    controller: AbortController;
    promise: Promise<Result<ConversationTextResult>>;
  } | null = null;
  private profile = structuredClone(caregiverProfile);
  private approvedFacts: string[] = [];
  // PostgreSQL remains behind this one authority; it never restores a running session.
  pauseForProfileUpdate(patch: Record<string, unknown>) {
    if (Object.keys(patch).some((key) => key !== 'communicationSupport'))
      this.interrupt({ type: 'system.pause', reason: 'config_change' });
  }
  acceptPersistentProfile(profile: import('@lemmi/contracts').ProfileDetail) {
    const {
      approvedFacts,
      privacyRevision: _privacy,
      policyRevision: _policy,
      ...caregiver
    } = profile;
    this.profile = structuredClone(caregiver);
    this.approvedFacts = approvedFacts.map((fact) => fact.value);
    if (this.session?.phase === 'paused')
      this.session = { ...this.session, profileRevision: profile.revision };
  }
  persistenceSnapshot() {
    const session = this.snapshot();
    const events =
      this.journal.sessions.find((record) => record.sessionId === session?.id)?.events ?? [];
    return session ? { session, events: structuredClone(events) } : null;
  }
  private session: SessionSnapshot | null = null;
  private activity: ActivityState | null = null;
  private context: ActivityContext | null = null;
  private journal: Journal = { profileId: DEMO_PROFILE_ID, mode: 'mock', sessions: [] };
  private help: HelpSnapshot | null = null;
  private cache = new Map<string, { body: string; result: Result<unknown> }>();
  private count = 0;
  snapshot() {
    if (
      this.session?.phase === 'listening' &&
      this.captureDeadline &&
      Date.now() > this.captureDeadline
    ) {
      this.captureDeadline = 0;
      this.session = { ...this.session, phase: 'waiting', captureGrant: null };
    }
    return this.session ? structuredClone(this.session) : null;
  }
  isCurrentTextReply(turnId: string): boolean {
    // A result can have resolved before an interrupt, with its socket callback still queued.
    // Clear-on-interrupt receipt ownership closes that race even when mute keeps generation.
    return (
      this.lastChat?.commandId === turnId &&
      this.lastChat.result.ok &&
      this.lastChat.result.data.kind === 'reply'
    );
  }
  private cancelChat() {
    if (this.pendingMedia?.kind === 'stt') this.cancelPhotoMedia();
    this.pendingChat?.controller.abort();
    this.pendingChat = null;
    this.dialogue = [];
    this.lastChat = null;
  }
  // Async text uses its own bounded transient receipt path: the generic command cache must
  // never retain raw participant utterances/results after Stop, pause, mute or disconnect.
  async submitText(raw: unknown): Promise<Result<ConversationTextResult>> {
    const parsed = ConversationTextCommandSchema.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid participant text command');
    const input = parsed.data;
    const session = this.session;
    if (this.mode !== 'live')
      return fail('UNAVAILABLE', 'Live text conversation is unavailable in mock mode');
    if (!session || session.id !== input.sessionId) return fail('NOT_FOUND', 'Session not found');
    if (
      session.generation !== input.expectedGeneration ||
      session.phase === 'paused' ||
      session.phase === 'ended'
    )
      return fail('REVISION_CONFLICT', 'Use the current active session snapshot');
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    const previous = this.chatIds.get(input.commandId);
    if (previous) {
      if (previous !== fingerprint)
        return fail('REVISION_CONFLICT', 'Text command ID reused with different input');
      if (this.pendingChat?.commandId === input.commandId) return this.pendingChat.promise;
      if (this.lastChat?.commandId === input.commandId)
        return structuredClone(this.lastChat.result);
      return fail(
        'REVISION_CONFLICT',
        'Text turn is no longer replayable; no provider retry was made',
      );
    }
    const route = routeParticipantText(input.text);
    // Explicit help/Stop/refusal bypass generation, dialogue retention and ordinary turn limits.
    if (route === 'stop' || route === 'pause') {
      const result = this.handle('session.command', {
        commandId: input.commandId,
        sessionId: session.id,
        expectedGeneration: session.generation,
        action: { type: route },
      });
      return result.ok ? ok({ kind: 'control', action: route, session: this.snapshot()! }) : result;
    }
    if (route === 'help')
      return this.handle('help.create', {
        profileId: session.profileId,
        commandId: input.commandId,
        mode: 'real',
      }) as Result<ConversationTextResult>;
    const fixed = fixedInputReply(route, input.language);
    if (fixed) {
      if (route === 'incomplete_need' && this.pendingChat)
        return fail('REVISION_CONFLICT', 'A conversation turn is pending');
      if (this.chatIds.size < 256) this.chatIds.set(input.commandId, fingerprint);
      this.cancelChat();
      if (route === 'unwell' || route === 'urgent' || route === 'topic_refusal')
        this.interrupt({
          type: 'system.pause',
          reason: route === 'topic_refusal' ? 'participant' : 'help',
        });
      else this.session = { ...session, phase: 'waiting', captureGrant: null };
      const result = ok<ConversationTextResult>({
        kind: 'reply',
        reply: { turnId: input.commandId, text: fixed, language: input.language, source: 'fixed' },
        session: this.snapshot()!,
      });
      this.lastChat = { commandId: input.commandId, result };
      return structuredClone(result);
    }
    if (
      this.pendingChat ||
      !['ready', 'waiting'].includes(session.phase) ||
      (this.activity &&
        this.activity.phase !== 'ended' &&
        !(
          this.photoOptions &&
          this.activity.activityId === 'photo_album' &&
          this.activity.viewingMode === 'talk'
        ))
    )
      return fail('REVISION_CONFLICT', 'Finish or interrupt the current turn/activity first');
    if (this.chatIds.size >= 256)
      return fail('UNAVAILABLE', 'Text turn capacity reached; start a new session');
    this.chatIds.set(input.commandId, fingerprint);
    this.lastChat = null;
    if (!this.chatAdapter)
      return fail('UNAVAILABLE', 'Configure the server LLM key/model before chatting');
    const prepared = companionInput({
      text: input.text,
      language: input.language,
      preset: session.communicationSupport.preset,
      preferredName: this.profile.preferredName,
      history: this.dialogue,
      approvedFacts:
        this.photoOptions && this.activity?.activityId === 'photo_album' ? [] : this.approvedFacts,
    });
    if (!prepared.ok) return prepared;
    if (this.photoOptions && this.activity?.activityId === 'photo_album' && this.context) {
      const photo = preparePhotoStoryTurn({
        profile: this.participant(),
        session,
        state: this.activity,
        pack: this.activityPack,
        context: this.context,
        photoAvailable: true,
        approvedFacts: [],
        turn: { kind: 'answer', text: input.text },
      });
      if (!photo.ok) return photo;
      if (photo.data.kind !== 'conversation_context')
        return fail('UNAVAILABLE', 'Photo context unavailable');
      prepared.data.system +=
        '\n' +
        photo.data.instructions +
        '\nApproved photo data: ' +
        JSON.stringify(photo.data.context);
      if (prepared.data.system.length > 5000)
        return fail('UNAVAILABLE', 'Approved context exceeds model limits');
    }
    this.session = { ...session, phase: 'processing', captureGrant: null };
    const pending = {
      commandId: input.commandId,
      controller: new AbortController(),
      promise: Promise.resolve(fail('UNAVAILABLE', 'Turn not started')) as Promise<
        Result<ConversationTextResult>
      >,
    };
    this.pendingChat = pending;
    const signal = AbortSignal.any([pending.controller.signal, AbortSignal.timeout(20000)]);
    const current = () =>
      this.pendingChat === pending &&
      this.session?.id === session.id &&
      this.session.phase === 'processing' &&
      this.session.generation === session.generation &&
      this.session.leaseId === session.leaseId &&
      this.session.profileRevision === session.profileRevision &&
      this.session.privacyRevision === session.privacyRevision &&
      this.session.policyRevision === session.policyRevision;
    pending.promise = (async () => {
      let result: Result<ConversationTextResult>;
      try {
        const response = await new Promise<Awaited<ReturnType<ChatAdapter['complete']>>>(
          (resolve, reject) => {
            const aborted = () => reject(new Error('Turn canceled'));
            signal.addEventListener('abort', aborted, { once: true });
            Promise.resolve()
              .then(() => {
                signal.throwIfAborted();
                return this.chatAdapter!.complete(prepared.data, signal);
              })
              .then(resolve, reject)
              .finally(() => signal.removeEventListener('abort', aborted));
          },
        );
        if (!current() || signal.aborted)
          return fail('REVISION_CONFLICT', 'Discarded an obsolete conversation result');
        this.session = { ...this.session!, phase: 'waiting', captureGrant: null };
        if (!response.ok) result = response;
        else if (
          !ConversationReplySchema.safeParse({
            ...response.data,
            turnId: input.commandId,
            source: 'model',
          }).success ||
          response.data.language !== input.language
        )
          result = fail('UNAVAILABLE', 'Invalid conversation reply');
        else if (
          (response.data.text.match(/\?/g)?.length ?? 0) >
          (session.communicationSupport.preset === 'quiet' ? 0 : 1)
        )
          result = fail('UNAVAILABLE', 'Response did not meet the configured question limit');
        else {
          this.dialogue = [
            ...this.dialogue,
            { role: 'user', content: input.text },
            { role: 'assistant', content: response.data.text },
          ].slice(-6) as ChatMessage[];
          result = ok({
            kind: 'reply',
            reply: {
              turnId: input.commandId,
              text: response.data.text,
              language: input.language,
              source: 'model',
            },
            session: this.snapshot()!,
          });
        }
      } catch {
        if (!current()) return fail('REVISION_CONFLICT', 'Conversation turn was canceled');
        this.session = { ...this.session!, phase: 'waiting', captureGrant: null };
        result = fail('UNAVAILABLE', 'Conversation service unavailable or timed out');
      }
      if (this.pendingChat === pending) {
        this.pendingChat = null;
        this.lastChat = { commandId: input.commandId, result };
      }
      return structuredClone(result);
    })();
    return pending.promise;
  }
  private participant() {
    return ParticipantProfileSchema.parse({
      id: this.profile.id,
      preferredName: this.profile.preferredName,
      avatarId: this.profile.avatarId,
      revision: this.profile.revision,
      communicationSupport: this.profile.communicationSupport,
    });
  }
  private event(event: ActivityEvent | { type: 'session_stopped' }) {
    const record = this.journal.sessions.find((r) => r.sessionId === this.session?.id);
    if (record && record.events.length < 100)
      record.events.push({ ...event, source: 'measured_event' });
  }
  private system(input: Parameters<typeof applyActivitySystemInput>[1]) {
    if (this.activity && this.context) {
      const transition = ActivityTransitionSchema.parse(
        applyActivitySystemInput(this.activity, input, this.activityPack, this.context),
      );
      this.activity = transition.nextState;
      for (const event of transition.events) this.event(event);
    }
  }
  private interrupt(input: Extract<ActivitySystemInput, { type: 'system.pause' | 'system.end' }>) {
    this.cancelPhotoMedia();
    this.cancelChat();
    if (!this.session || this.session.phase === 'ended') return;
    this.session = {
      ...this.session,
      generation: this.session.generation + 1,
      phase: input.type === 'system.end' ? 'ended' : 'paused',
      captureGrant: null,
    };
    this.system(input);
  }
  disconnect() {
    this.interrupt({ type: 'system.pause', reason: 'disconnect' });
  }
  revokeDeviceAccess() {
    this.interrupt({ type: 'system.end', reason: 'revoked' });
  }
  handle(operation: string, raw: unknown): Result<unknown> {
    if (!Object.hasOwn(operations, operation))
      return fail('NOT_FOUND', 'Unknown service operation');
    const op = operation as Operation;
    const parsed = operations[op].input.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid command shape');
    const input = parsed.data;
    if (
      this.mode === 'live' &&
      ![
        'session.start',
        'session.get',
        'session.command',
        'help.create',
        ...(this.photoOptions
          ? [
              'profile.load',
              'activities.list',
              'activities.start',
              'activities.view',
              'activities.submit',
            ]
          : []),
      ].includes(op)
    )
      return fail('UNAVAILABLE', 'Only authenticated device controls are implemented');
    // Parsed keys/values only; never accept a client-selected scope or preview profile as live.
    if ('profileId' in input && input.profileId !== DEMO_PROFILE_ID)
      return fail('FORBIDDEN', 'Only Alex is functional; examples are preview-only');
    if ('profile' in input && input.profile.id !== DEMO_PROFILE_ID)
      return fail('FORBIDDEN', 'Profile is not assigned');
    const body = JSON.stringify(input);
    const key = 'commandId' in input ? `${op}:${input.commandId}` : null;
    if (key) {
      const previous = this.cache.get(key);
      if (previous)
        return previous.body === body
          ? structuredClone(previous.result)
          : fail('REVISION_CONFLICT', 'Command ID reused with different input');
      const action =
        op === 'session.command' ? SessionCommandSchema.safeParse(input).data?.action : undefined;
      const safetyControl =
        this.mode === 'live' &&
        (op === 'help.create' ||
          action?.type === 'stop' ||
          action?.type === 'pause' ||
          (action?.type === 'mute' && action.muted));
      if (this.cache.size >= 256 && !safetyControl)
        return fail('UNAVAILABLE', 'Command capacity reached; restart gateway');
    }
    let result: Result<unknown>;
    try {
      result = this.dispatch(op, input);
    } catch {
      result = fail('VALIDATION_ERROR', 'Command is not valid in the current state');
    }
    if (result.ok && !operations[op].output.safeParse(result.data).success)
      throw new Error(`Invalid mock response for ${op}`);
    if (key && this.cache.size < 256)
      this.cache.set(key, { body, result: structuredClone(result) });
    return structuredClone(result);
  }
  private dispatch(op: Operation, input: any): Result<unknown> {
    switch (op) {
      case 'profile.load':
        return ok(this.participant());
      case 'profile.loadCaregiver':
        return ok(this.profile);
      case 'profile.previews':
        return ok(previewProfiles);
      case 'profile.save':
        if (input.expectedRevision !== this.profile.revision)
          return fail('REVISION_CONFLICT', 'Reload current profile');
        if (input.profile.rememberingEnabled || input.profile.excerptSavingEnabled)
          return fail('UNAVAILABLE', 'Memory and excerpt retention are disabled in this starter');
        const changedContext = [
          'preferredName',
          'avatarId',
          'interests',
          'sensitiveTopicGuidance',
        ].some(
          (key) =>
            JSON.stringify(input.profile[key]) !==
            JSON.stringify(this.profile[key as keyof typeof this.profile]),
        );
        if (changedContext) this.interrupt({ type: 'system.pause', reason: 'config_change' });
        this.profile = { ...input.profile, revision: this.profile.revision + 1 };
        return ok(this.profile);
      case 'overview.load':
        return ok({
          profile: this.participant(),
          previews: previewProfiles,
          mode: 'mock',
          readiness: 'not_configured',
        });
      case 'session.start':
        if (this.session && this.session.phase !== 'ended')
          return fail('REVISION_CONFLICT', 'One mock session is already open');
        if (this.journal.sessions.length >= 100)
          return fail('UNAVAILABLE', 'Mock session capacity reached; restart gateway');
        this.cancelChat();
        this.chatIds.clear();
        this.mediaIds.clear();
        this.cancelPhotoMedia();
        this.session = SessionSnapshotSchema.parse({
          id: this.mode === 'live' ? `session-${crypto.randomUUID()}` : `session-${++this.count}`,
          profileId: DEMO_PROFILE_ID,
          generation: 0,
          profileRevision: this.profile.revision,
          privacyRevision: 0,
          policyRevision: 0,
          phase: 'ready',
          endpoint: input.endpoint,
          leaseId: this.mode === 'live' ? `lease-${crypto.randomUUID()}` : `lease-${this.count}`,
          micMuted: true,
          captureGrant: null,
          communicationSupport: this.profile.communicationSupport,
          conversationMode: 'open',
          teaching: null,
          mode: this.mode,
        });
        this.activity = null;
        this.context = contextFor(this.session.id);
        this.journal.sessions.push({ sessionId: this.session.id, events: [], summary: null });
        return ok(this.session);
      case 'session.get':
        return this.session?.id === input.sessionId
          ? ok(this.session)
          : fail('NOT_FOUND', 'Session not found');
      case 'session.command': {
        if (!this.session || input.sessionId !== this.session.id)
          return fail('NOT_FOUND', 'Session not found');
        if (input.expectedGeneration !== this.session.generation)
          return fail('REVISION_CONFLICT', 'Reload current session');
        if (this.session.phase === 'ended') return fail('REVISION_CONFLICT', 'Session has ended');
        const action = input.action;
        switch (action.type) {
          case 'pause':
            this.interrupt({ type: 'system.pause', reason: 'participant' });
            break;
          case 'stop':
            this.interrupt({ type: 'system.end', reason: 'stop' });
            this.event({ type: 'session_stopped' });
            break;
          case 'resume':
            if (this.session.phase !== 'paused')
              return fail('REVISION_CONFLICT', 'Session is not paused');
            this.system({ type: 'system.resume' });
            this.session = {
              ...this.session,
              generation: this.session.generation + 1,
              phase: 'ready',
              captureGrant: null,
              profileRevision: this.profile.revision,
            };
            break;
          case 'mute':
            if (action.muted) {
              const pending =
                this.pendingChat !== null ||
                this.pendingMedia?.kind === 'stt' ||
                this.session.phase === 'listening';
              this.cancelChat();
              if (pending) this.session = { ...this.session, phase: 'waiting' };
            }
            this.session = {
              ...this.session,
              micMuted: action.muted,
              captureGrant: null,
            };
            break;
          case 'handoff':
            this.interrupt({ type: 'system.pause', reason: 'handoff' });
            this.session = {
              ...this.session,
              endpoint: action.endpoint,
              leaseId: `lease-${++this.count}`,
            };
            break;
          case 'speak':
            if (
              !this.photoOptions ||
              this.activity?.activityId !== 'photo_album' ||
              this.activity.viewingMode !== 'talk' ||
              this.activity.phase !== 'active' ||
              this.session.micMuted ||
              !['ready', 'waiting'].includes(this.session.phase) ||
              this.pendingChat ||
              this.pendingMedia
            )
              return fail('UNAVAILABLE', 'Explicit unmuted Photo Story listening is unavailable');
            this.session = {
              ...this.session,
              phase: 'listening',
              captureGrant: {
                turnId: input.commandId,
                generation: this.session.generation,
                leaseId: this.session.leaseId,
              },
            };
            this.captureDeadline = Date.now() + 25000;
            break;
          case 'turn_end':
            if (
              !this.photoOptions ||
              !['listening', 'processing', 'speaking'].includes(this.session.phase)
            )
              return fail('REVISION_CONFLICT', 'No media turn to cancel');
            this.cancelPhotoMedia();
            this.cancelChat();
            this.session = { ...this.session, phase: 'waiting', captureGrant: null };
            break;
          default:
            return fail('UNAVAILABLE', 'Speech/teaching is not implemented; capture stays off');
        }
        return ok(this.session);
      }
      case 'activities.list':
        return ok([
          ...(this.photoOptions
            ? [
                {
                  activityId: 'photo_album',
                  packId: this.photoOptions.pack.id,
                  packVersion: 1,
                  implemented: true,
                },
              ]
            : []),
          ...['music_playlist', 'twenty_questions', 'photo_album', 'object_matching'].map(
            (activityId) => ({
              activityId,
              packId: activityId === 'music_playlist' ? 'music-demo' : `pending-${activityId}`,
              packVersion: 1,
              implemented: activityId === 'music_playlist',
            }),
          ),
        ]);
      case 'activities.start':
        if (!this.session || this.session.id !== input.sessionId)
          return fail('NOT_FOUND', 'Session not found');
        if (this.session.phase === 'paused' || this.session.phase === 'ended')
          return fail('REVISION_CONFLICT', 'Session must be ready');
        const selectedPack =
          input.activityId === 'photo_album' && this.photoOptions?.pack.id === input.packId
            ? this.photoOptions!.pack
            : input.activityId === 'music_playlist' && input.packId === musicPack.id
              ? musicPack
              : null;
        if (!selectedPack) return fail('UNAVAILABLE', 'Activity pending Lukas implementation');
        if (this.activity && this.activity.phase !== 'ended')
          return fail('REVISION_CONFLICT', 'Leave the current activity first');
        this.context = contextFor(this.session.id);
        this.context.presentationPolicy = this.session.communicationSupport;
        this.context.eligibility.policyRevision = this.session.policyRevision;
        this.activityPack = selectedPack;
        this.activity = createActivity(
          { instanceId: `activity-${++this.count}` },
          this.activityPack,
          this.context,
        );
        this.event({ type: 'activity_started' });
        return ok(projectActivity(this.activity, this.activityPack, this.context));
      case 'activities.view':
      case 'activities.submit':
        if (
          !this.session ||
          this.session.id !== input.sessionId ||
          !this.activity ||
          this.activity.instanceId !== input.instanceId ||
          !this.context
        )
          return fail('NOT_FOUND', 'Activity not found');
        if (op === 'activities.submit') {
          if (input.expectedRevision !== this.activity.revision)
            return fail('REVISION_CONFLICT', 'Reload current activity');
          if (this.session.phase === 'paused' || this.session.phase === 'ended')
            return fail('REVISION_CONFLICT', 'Session cannot advance');
          const validated = validateActivityCommandContext(input, this.activity, this.context);
          if (!validated.ok) return validated;
          if (this.photoOptions && this.activity.activityId === 'photo_album') {
            this.cancelPhotoMedia();
            this.cancelChat();
            this.session = { ...this.session, phase: 'ready', captureGrant: null };
          }
          const transition = ActivityTransitionSchema.parse(
            reduceActivity(this.activity, validated.data.action, this.activityPack, this.context),
          );
          this.activity = transition.nextState;
          for (const event of transition.events) this.event(event);
          // Deliberately DO NOT execute effects: no approved music bytes or live endpoint yet.
        }
        return ok(projectActivity(this.activity, this.activityPack, this.context));
      case 'help.create':
        if (this.mode === 'live') {
          this.interrupt({ type: 'system.pause', reason: 'help' });
          return fail(
            'UNAVAILABLE',
            'Caregiver contact is not configured; no request was created or sent',
          );
        }
        if (input.mode !== 'simulation')
          return fail('UNAVAILABLE', 'Real notifications are not configured');
        this.interrupt({ type: 'system.pause', reason: 'help' });
        if (!this.help || ['canceled', 'resolved', 'expired'].includes(this.help.status))
          this.help = {
            id: `help-${++this.count}`,
            profileId: DEMO_PROFILE_ID,
            status: 'created',
            mode: 'simulation',
            reason: 'manual',
            message: 'Demo help — no real message will be sent',
          };
        return ok(this.help);
      case 'help.status':
      case 'help.acknowledge':
      case 'help.cancel':
        if (!this.help || this.help.id !== input.requestId)
          return fail('NOT_FOUND', 'Request not found');
        if (op === 'help.acknowledge')
          this.help = {
            ...this.help,
            status: 'acknowledged',
            message: 'Simulated acknowledgment — no real message was sent',
          };
        if (op === 'help.cancel')
          this.help = {
            ...this.help,
            status: 'canceled',
            message: 'Simulation canceled — no real message was sent',
          };
        return ok(this.help);
      case 'preferences.load':
        return ok(preferences);
      case 'journal.load':
        return ok(this.journal);
      case 'checkIn.status':
        return ok(disabledCheckIn);
      default:
        return fail(
          'UNAVAILABLE',
          'This adapter is an explicit unimplemented seam; no action was applied',
        );
    }
  }
}
