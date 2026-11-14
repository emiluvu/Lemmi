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
  ApplyCommunicationSupportSchema,
  type SupportSelection,
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
  type ApprovedPack,
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
import { permittedModelReply } from './adapters/reply-policy';
import type { ChatAdapter, ChatMessage } from './adapters/types';
import { SpeechTurns, type SpeechAdapters } from './speech-turns';
// One in-memory authority. Live mode currently exposes controls only, with no media/retention.
export class SessionCoordinator {
  constructor(
    private readonly mode: 'mock' | 'live' = 'mock',
    private readonly chatAdapter?: ChatAdapter,
    speech?: SpeechAdapters,
    now: () => number = Date.now,
    private readonly onFixedReply: () => void = () => {},
    private readonly photoStory?: { pack: ApprovedPack; availableAssetIds: string[] },
  ) {
    if (mode === 'live' && chatAdapter && speech)
      this.speech = new SpeechTurns(
        speech,
        () => this.snapshot(),
        (phase, captureGrant) => {
          if (this.session) this.session = { ...this.session, phase, captureGrant };
        },
        (raw, owner) => this.submitTextInternal(raw, owner),
        now,
        (turnId) => {
          if (this.pendingChat?.commandId === turnId) {
            this.pendingChat.controller.abort();
            this.pendingChat = null;
          }
          if (
            this.lastChat?.commandId === turnId ||
            (this.lastChat?.result.ok &&
              this.lastChat.result.data.kind === 'reply' &&
              this.lastChat.result.data.reply.turnId === turnId)
          ) {
            this.lastChat = null;
            this.dialogue = [];
          }
        },
        !!photoStory,
      );
  }
  private readonly speech?: SpeechTurns;
  speechConfigured() {
    return !!this.speech;
  }
  requestCapture(raw: unknown, rates: number[]) {
    if (this.configurationChanges.size)
      return fail('REVISION_CONFLICT', 'Configuration save is pending');
    if (this.activity && this.activity.phase !== 'ended' && !this.photoTalking())
      return fail('REVISION_CONFLICT', 'Leave the activity before speaking');
    if (this.pendingChat) return fail('REVISION_CONFLICT', 'A text turn is pending');
    const result =
      this.speech?.start(raw, rates) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
    if (result.ok) this.lastChat = null;
    return result;
  }
  acceptCaptureChunk(raw: unknown) {
    return this.speech?.chunk(raw) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
  }
  async finishCapture(raw: unknown): Promise<Result<ConversationTextResult>> {
    const result = await (this.speech?.end(raw) ??
      fail('UNAVAILABLE', 'Speech adapters are disabled'));
    return this.photoTextFallback(result, (raw as { turnId?: string })?.turnId);
  }
  async speakText(raw: unknown) {
    const result = await (this.speech?.speak(raw, [16000, 22050, 24000, 44100, 48000]) ??
      this.submitText(raw));
    return this.photoTextFallback(result, (raw as { commandId?: string })?.commandId);
  }
  private photoTextFallback(
    result: Result<ConversationTextResult>,
    turnId?: string,
  ): Result<ConversationTextResult> {
    const last = this.lastChat?.result;
    if (
      this.photoStory &&
      !result.ok &&
      result.error.code === 'UNAVAILABLE' &&
      last?.ok &&
      last.data.kind === 'reply' &&
      last.data.reply.turnId === turnId &&
      this.session?.phase === 'waiting' &&
      last.data.session.generation === this.session.generation &&
      last.data.session.profileRevision === this.session.profileRevision &&
      last.data.session.privacyRevision === this.session.privacyRevision &&
      last.data.session.policyRevision === this.session.policyRevision
    )
      return ok({ ...last.data, session: this.snapshot()! });
    return result;
  }
  private photoTalking() {
    return (
      this.activity?.activityId === 'photo_album' &&
      this.activity.phase === 'active' &&
      this.activity.viewingMode === 'talk'
    );
  }
  private pack() {
    return this.activity?.activityId === 'photo_album' && this.photoStory
      ? this.photoStory.pack
      : musicPack;
  }
  playbackReceipt(raw: unknown) {
    return this.speech?.receipt(raw) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
  }
  speechOutputInfo() {
    return this.speech?.outputInfo() ?? null;
  }
  drainSpeechOutput() {
    return this.speech?.drain() ?? null;
  }
  sweepSpeech() {
    return this.speech?.sweep() ?? false;
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
  private supportSelections: SupportSelection[] = [];
  private supportReceipts = new Map<string, { fingerprint: string; generation: number }>();
  private configurationChanges = new Set<object>();
  holdConfiguration() {
    const token = {};
    this.configurationChanges.add(token);
    return () => this.configurationChanges.delete(token);
  }
  beginProfileUpdate(patch: Record<string, unknown>) {
    if (!Object.keys(patch).some((key) => key !== 'communicationSupport')) return () => {};
    this.pauseForProfileUpdate(patch);
    return this.holdConfiguration();
  }
  applyCommunicationSupport(
    raw: unknown,
    profile: Pick<
      import('@lemmi/contracts').ProfileDetail,
      'id' | 'revision' | 'communicationSupport'
    >,
    actorSubject: string,
  ): Result<SessionSnapshot> {
    const parsed = ApplyCommunicationSupportSchema.safeParse(raw);
    if (!parsed.success || !actorSubject || actorSubject.length > 200)
      return fail('VALIDATION_ERROR', 'Invalid communication support apply request');
    const input = parsed.data,
      session = this.session;
    if (input.profileId !== DEMO_PROFILE_ID || profile.id !== input.profileId)
      return fail('FORBIDDEN', 'Profile is not assigned');
    if (profile.revision !== input.expectedProfileRevision)
      return fail('REVISION_CONFLICT', 'Reload the saved profile before applying support');
    if (!session || session.id !== input.sessionId || session.phase === 'ended')
      return fail('REVISION_CONFLICT', 'Use the current active session');
    const fingerprint = createHash('sha256')
      .update(JSON.stringify({ input, actorSubject }))
      .digest('hex');
    const receipt = this.supportReceipts.get(input.commandId);
    if (receipt)
      return receipt.fingerprint === fingerprint &&
        session.generation === receipt.generation &&
        session.phase === 'paused'
        ? ok(this.snapshot()!)
        : fail('REVISION_CONFLICT', 'Support apply receipt is stale or changed');
    if (session.generation !== input.expectedGeneration || this.supportSelections.length >= 50)
      return fail('REVISION_CONFLICT', 'Reload the session; support apply is stale or at capacity');
    this.interrupt({ type: 'system.pause', reason: 'config_change' });
    this.session = {
      ...this.session!,
      communicationSupport: structuredClone(profile.communicationSupport),
      profileRevision: profile.revision,
    };
    if (this.context)
      this.context = {
        ...this.context,
        presentationPolicy: structuredClone(profile.communicationSupport),
      };
    this.recordSupportSelection(actorSubject);
    this.supportReceipts.set(input.commandId, { fingerprint, generation: this.session.generation });
    return ok(this.snapshot()!);
  }
  private recordSupportSelection(actorSubject: string | null = null) {
    const session = this.session!;
    this.supportSelections.push({
      id: crypto.randomUUID(),
      generation: session.generation,
      profileRevision: session.profileRevision,
      support: structuredClone(session.communicationSupport),
      source: actorSubject ? 'caregiver_apply' : 'profile_default',
      actorSubject,
      selectedAt: new Date().toISOString(),
    });
  }
  private activityContext(sessionId: string): ActivityContext {
    return {
      ...contextFor(sessionId),
      presentationPolicy: structuredClone(this.session!.communicationSupport),
    };
  }
  // PostgreSQL remains behind this one authority; it never restores a running session.
  pauseForProfileUpdate(patch: Record<string, unknown>) {
    if (Object.keys(patch).some((key) => key !== 'communicationSupport'))
      this.interrupt({ type: 'system.pause', reason: 'config_change' });
  }
  acceptPersistentProfile(
    profile: import('@lemmi/contracts').ProfileDetail,
    syncPausedRevision = true,
  ) {
    const {
      approvedFacts,
      privacyRevision: _privacy,
      policyRevision: _policy,
      ...caregiver
    } = profile;
    this.profile = structuredClone(caregiver);
    this.approvedFacts = approvedFacts.map((fact) => fact.value);
    if (syncPausedRevision && this.session?.phase === 'paused')
      this.session = { ...this.session, profileRevision: profile.revision };
  }
  persistenceSnapshot() {
    const session = this.snapshot();
    const events =
      this.journal.sessions.find((record) => record.sessionId === session?.id)?.events ?? [];
    return session
      ? {
          session,
          events: structuredClone(events),
          supportSelections: structuredClone(this.supportSelections),
        }
      : null;
  }
  private session: SessionSnapshot | null = null;
  private activity: ActivityState | null = null;
  private context: ActivityContext | null = null;
  private journal: Journal = { profileId: DEMO_PROFILE_ID, mode: 'mock', sessions: [] };
  private help: HelpSnapshot | null = null;
  private cache = new Map<string, { body: string; result: Result<unknown> }>();
  private count = 0;
  snapshot() {
    return this.session ? structuredClone(this.session) : null;
  }
  isCurrentTextReply(turnId: string): boolean {
    // A result can have resolved before an interrupt, with its socket callback still queued.
    // Clear-on-interrupt receipt ownership closes that race even when mute keeps generation.
    return (
      this.speech?.replyCurrent(turnId) ||
      (this.lastChat?.commandId === turnId &&
        this.lastChat.result.ok &&
        this.lastChat.result.data.kind === 'reply' &&
        this.lastChat.result.data.reply.turnId === turnId)
    );
  }
  private cancelChat(inputOnly = false, preserveSpeech?: object) {
    this.pendingChat?.controller.abort();
    this.pendingChat = null;
    this.dialogue = [];
    this.lastChat = null;
    this.speech?.interrupt(inputOnly, preserveSpeech);
  }
  // Async text uses its own bounded transient receipt path: the generic command cache must
  // never retain raw participant utterances/results after Stop, pause, mute or disconnect.
  async submitText(raw: unknown): Promise<Result<ConversationTextResult>> {
    return this.submitTextInternal(raw);
  }
  private async submitTextInternal(
    raw: unknown,
    speechOwner?: object,
  ): Promise<Result<ConversationTextResult>> {
    const parsed = ConversationTextCommandSchema.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid participant text command');
    const input = parsed.data;
    const session = this.session;
    if (this.mode !== 'live')
      return fail('UNAVAILABLE', 'Live text conversation is unavailable in mock mode');
    if (this.configurationChanges.size)
      return fail('REVISION_CONFLICT', 'Configuration save is pending');
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
    const repeated =
      input.purpose === 'photo_repeat' &&
      this.photoTalking() &&
      this.lastChat?.result.ok &&
      this.lastChat.result.data.kind === 'reply'
        ? this.lastChat.result.data.reply.text
        : null;
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
    const photoRoute = this.photoTalking()
      ? input.text
          .normalize('NFKC')
          .trim()
          .toLowerCase()
          .replace(/[.!?]+$/, '')
          .replace(/[’]/g, "'")
      : '';
    if (/^(?:skip(?: (?:this )?photo)?|next photo|another photo)$/.test(photoRoute)) {
      this.cancelChat(false, speechOwner);
      if (!this.activity || !this.context) return fail('REVISION_CONFLICT', 'Photo unavailable');
      const transition = reduceActivity(
        this.activity,
        { type: 'photo.skip' },
        this.pack(),
        this.context,
      );
      this.activity = transition.nextState;
      transition.events.forEach((event) => this.event(event));
      this.session = { ...this.session!, phase: 'waiting', captureGrant: null };
      const talk = reduceActivity(this.activity, { type: 'photo.talk' }, this.pack(), this.context);
      this.activity = talk.nextState;
      talk.events.forEach((event) => this.event(event));
      input.purpose = 'photo_opening';
    }
    const fixed = fixedInputReply(route, input.language);
    const interrupts = [
      'urgent',
      'unwell',
      'topic_refusal',
      'privacy_refusal',
      'frightening',
      'navigation',
    ].includes(route);
    if (this.speech?.busy() && !this.speech.owns(speechOwner) && !interrupts)
      return fail('REVISION_CONFLICT', 'Finish or interrupt the current speech turn first');
    if (fixed) {
      if (!interrupts && this.pendingChat)
        return fail('REVISION_CONFLICT', 'A conversation turn is pending');
      if (this.chatIds.size < 256) this.chatIds.set(input.commandId, fingerprint);
      this.cancelChat(false, speechOwner);
      let replyTurnId = input.commandId;
      if (interrupts) {
        const pause = () =>
          this.interrupt({
            type: 'system.pause',
            reason: ['topic_refusal', 'privacy_refusal'].includes(route) ? 'participant' : 'help',
          });
        if (speechOwner) {
          const fixedTurn = this.speech?.replaceForFixedReply(speechOwner, pause);
          if (!fixedTurn) return fail('REVISION_CONFLICT', 'Speech turn canceled');
          replyTurnId = fixedTurn;
        } else pause();
      } else this.session = { ...session, phase: 'waiting', captureGrant: null };
      const result = ok<ConversationTextResult>({
        kind: 'reply',
        reply: { turnId: replyTurnId, text: fixed, language: input.language, source: 'fixed' },
        session: this.snapshot()!,
      });
      this.lastChat = { commandId: input.commandId, result };
      // Publish the new paused generation before awaiting its fixed TTS.
      if (speechOwner && replyTurnId !== input.commandId) this.onFixedReply();
      return structuredClone(result);
    }
    if (
      this.pendingChat ||
      !['ready', 'waiting'].includes(session.phase) ||
      (this.activity && this.activity.phase !== 'ended' && !this.photoTalking())
    )
      return fail('REVISION_CONFLICT', 'Finish or interrupt the current turn/activity first');
    if (this.chatIds.size >= 256)
      return fail('UNAVAILABLE', 'Text turn capacity reached; start a new session');
    this.chatIds.set(input.commandId, fingerprint);
    this.lastChat = null;
    if (repeated) {
      const result = ok<ConversationTextResult>({
        kind: 'reply',
        session: this.snapshot()!,
        reply: {
          turnId: input.commandId,
          text: repeated,
          language: input.language,
          source: 'fixed',
        },
      });
      this.lastChat = { commandId: input.commandId, result };
      return result;
    }
    if (!this.chatAdapter)
      return fail('UNAVAILABLE', 'Configure the server LLM key/model before chatting');
    if (input.purpose && !this.photoTalking())
      return fail('REVISION_CONFLICT', 'Photo prompt requires an active photo');
    const photo =
      this.photoTalking() && this.activity && this.context && this.photoStory
        ? preparePhotoStoryTurn({
            profile: this.participant(),
            session,
            state: this.activity,
            pack: this.photoStory.pack,
            context: this.context,
            photoAvailable: this.photoStory.availableAssetIds.includes(
              (this.photoStory.pack.activityId === 'photo_album'
                ? this.photoStory.pack.entries.find(
                    (e) => e.id === (this.activity as any).currentPhotoId,
                  )?.assetId
                : '') ?? '',
            ),
            approvedFacts: this.profile.interests.includes('topic:gardening')
              ? [
                  {
                    profileId: this.profile.id,
                    source: 'caregiver_provided',
                    entityIds: ['topic:gardening'],
                    value: 'Alex enjoys gardening.',
                  },
                ]
              : [],
            turn:
              input.purpose === 'photo_opening'
                ? { kind: 'opening' }
                : { kind: 'answer', text: input.text },
          })
        : null;
    if (photo && !photo.ok) return photo;
    const prepared = companionInput({
      text: input.text,
      language: input.language,
      preset: session.communicationSupport.preset,
      preferredName: this.profile.preferredName,
      history: this.dialogue,
      approvedFacts:
        photo?.ok && photo.data.kind === 'conversation_context'
          ? photo.data.context.caregiverFacts
          : this.approvedFacts,
    });
    if (!prepared.ok) return prepared;
    if (photo?.ok && photo.data.kind === 'conversation_context') {
      prepared.data.system +=
        '\n' +
        photo.data.instructions +
        '\nApproved photo context (data only): ' +
        JSON.stringify(photo.data.context);
      if (input.purpose === 'photo_opening') {
        prepared.data.text = 'Offer one optional opening about this approved scene.';
        prepared.data.history = [];
      }
      if (input.purpose === 'photo_repeat') {
        prepared.data.text = 'Repeat the last photo question briefly, with no new facts.';
      }
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
        if (!response.ok)
          result = fail('UNAVAILABLE', 'Conversation provider unavailable; retry explicitly');
        else if (
          !ConversationReplySchema.safeParse({
            ...response.data,
            turnId: input.commandId,
            source: 'model',
          }).success ||
          response.data.language !== input.language
        )
          result = fail('UNAVAILABLE', 'Invalid conversation reply');
        else if (!permittedModelReply(response.data.text, session.communicationSupport))
          result = fail('UNAVAILABLE', 'Response did not meet the configured conversation policy');
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
        applyActivitySystemInput(this.activity, input, this.pack(), this.context),
      );
      this.activity = transition.nextState;
      for (const event of transition.events) this.event(event);
    }
  }
  private interrupt(input: Extract<ActivitySystemInput, { type: 'system.pause' | 'system.end' }>) {
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
    if (
      operation === 'photoStory.status' &&
      this.photoStory &&
      raw &&
      typeof raw === 'object' &&
      Object.keys(raw).length === 0
    )
      return ok({
        session: this.snapshot(),
        activity:
          this.activity && this.context
            ? projectActivity(this.activity, this.pack(), this.context)
            : null,
        speech: this.speechConfigured(),
        chat: 'unavailable',
      });
    if (!Object.hasOwn(operations, operation))
      return fail('NOT_FOUND', 'Unknown service operation');
    const op = operation as Operation;
    const parsed = operations[op].input.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid command shape');
    const input = parsed.data;
    if (
      this.configurationChanges.size &&
      (op === 'session.start' ||
        (op === 'session.command' &&
          SessionCommandSchema.safeParse(input).data?.action.type === 'resume'))
    )
      return fail('REVISION_CONFLICT', 'Configuration save is pending; interaction stays paused');
    if (
      this.mode === 'live' &&
      ![
        'session.start',
        'session.get',
        'session.command',
        'help.create',
        ...(this.photoStory
          ? [
              'profile.load',
              'profile.loadCaregiver',
              'profile.save',
              'activities.list',
              'activities.start',
              'activities.view',
              'activities.submit',
              'journal.load',
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
    const key =
      'commandId' in input && op !== 'profile.applySupport' ? `${op}:${input.commandId}` : null;
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
      case 'profile.applySupport':
        return this.applyCommunicationSupport(input, this.profile, 'fixture-caregiver');
      case 'profile.support':
        return ok({
          profileId: DEMO_PROFILE_ID,
          profileRevision: this.profile.revision,
          saved: this.profile.communicationSupport,
          session: this.session?.phase === 'ended' ? null : this.snapshot(),
        });
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
        this.speech?.reset();
        this.chatIds.clear();
        this.supportSelections = [];
        this.supportReceipts.clear();
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
        this.context = this.activityContext(this.session.id);
        this.journal.sessions.push({ sessionId: this.session.id, events: [], summary: null });
        this.recordSupportSelection();
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
            this.cancelChat();
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
            if (action.muted || this.session.captureGrant !== null) {
              const pending = this.pendingChat !== null || this.speech?.inputPending();
              this.cancelChat(true);
              if (pending && this.session.phase !== 'paused')
                this.session = { ...this.session, phase: 'waiting' };
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
          default:
            return fail('UNAVAILABLE', 'Speech/teaching is not implemented; capture stays off');
        }
        return ok(this.session);
      }
      case 'activities.list':
        return ok(
          ['music_playlist', 'twenty_questions', 'photo_album', 'object_matching'].map(
            (activityId) => ({
              activityId,
              packId: activityId === 'music_playlist' ? 'music-demo' : `pending-${activityId}`,
              packVersion: 1,
              implemented: activityId === 'music_playlist',
            }),
          ),
        );
      case 'activities.start':
        if (!this.session || this.session.id !== input.sessionId)
          return fail('NOT_FOUND', 'Session not found');
        if (this.session.phase === 'paused' || this.session.phase === 'ended')
          return fail('REVISION_CONFLICT', 'Session must be ready');
        if (
          (input.activityId !== 'music_playlist' || input.packId !== musicPack.id) &&
          (!this.photoStory ||
            input.activityId !== 'photo_album' ||
            input.packId !== this.photoStory.pack.id)
        )
          return fail('UNAVAILABLE', 'Activity pending Lukas implementation');
        if (this.activity && this.activity.phase !== 'ended')
          return fail('REVISION_CONFLICT', 'Leave the current activity first');
        this.context = this.activityContext(this.session.id);
        this.activity = createActivity(
          { instanceId: `activity-${++this.count}` },
          input.activityId === 'photo_album' ? this.photoStory!.pack : musicPack,
          this.context,
        );
        this.event({ type: 'activity_started' });
        if (this.activity.activityId === 'photo_album' && this.activity.currentPhotoId)
          this.event({ type: 'photo_selected', itemId: this.activity.currentPhotoId });
        return ok(projectActivity(this.activity, this.pack(), this.context));
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
          const transition = ActivityTransitionSchema.parse(
            reduceActivity(this.activity, validated.data.action, this.pack(), this.context),
          );
          this.activity = transition.nextState;
          if (this.activity.activityId === 'photo_album') {
            this.cancelChat();
            if (!['paused', 'ended'].includes(this.session.phase))
              this.session = { ...this.session, phase: 'waiting', captureGrant: null };
          }
          for (const event of transition.events) this.event(event);
          // Deliberately DO NOT execute effects: no approved music bytes or live endpoint yet.
        }
        return ok(projectActivity(this.activity, this.pack(), this.context));
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
