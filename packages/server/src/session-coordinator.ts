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
  EligibilitySnapshotSchema,
  type EligibilitySnapshot,
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
  nextTeachingTopic,
  teachingTopics,
  teachingTextIntent,
  teachingInstructions,
  teachingReplyWithinTopic,
  TEACHING_ACTIVE_LIMIT_MS,
} from '@lemmi/activities';
import { createHash } from 'node:crypto';
import { companionInput } from './adapters/companion-prompt';
import { fixedInputReply, routeParticipantText } from './adapters/input-routing';
import type { ChatAdapter, ChatMessage } from './adapters/types';
import { SpeechTurns, type SpeechAdapters } from './speech-turns';
import { elapsedEpochClock } from './elapsed-clock';
// One session authority; teaching reuses conversation/speech without durable dialogue retention.
export class SessionCoordinator {
  constructor(
    private readonly mode: 'mock' | 'live' = 'mock',
    private readonly chatAdapter?: ChatAdapter,
    speech?: SpeechAdapters,
    now: () => number = Date.now,
    private readonly onFixedReply: () => void = () => {},
  ) {
    this.now = now === Date.now ? elapsedEpochClock() : now;
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
      );
  }
  private readonly now: () => number;
  private teachingRun: { elapsed: number; since: number | null; seen: string[] } | null = null;
  private teachingHidden = new Set<string>();
  private teachingPreferred = new Set<string>();
  private teachingEligibility: EligibilitySnapshot | null = null;

  private eligibleForTeaching(): EligibilitySnapshot {
    const s = this.session!;
    const base = this.teachingEligibility ?? {
      profileId: s.profileId,
      sessionId: s.id,
      policyRevision: s.policyRevision,
      // Narrow baseline only: approved caregiver interests, no learned policy promises.
      permittedEntityIds: this.profile.interests,
      sessionHiddenIds: [],
      available: !this.profile.rememberingEnabled && s.policyRevision === 0,
    };
    return {
      ...base,
      available:
        base.available &&
        base.profileId === s.profileId &&
        base.sessionId === s.id &&
        base.policyRevision === s.policyRevision,
      sessionHiddenIds: [...new Set([...base.sessionHiddenIds, ...this.teachingHidden])],
    };
  }
  // Coordinator-only integration hook; never accepts a client/model-selected policy.
  applyTeachingEligibility(raw: unknown) {
    const parsed = EligibilitySnapshotSchema.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid teaching eligibility');
    const policy = parsed.data,
      s = this.session;
    if (!s || s.phase === 'ended' || policy.profileId !== s.profileId || policy.sessionId !== s.id)
      return fail('FORBIDDEN', 'Eligibility does not belong to the active session');
    if (
      policy.policyRevision < s.policyRevision ||
      (policy.policyRevision === s.policyRevision &&
        (this.teachingEligibility !== null || s.teaching !== null))
    )
      return fail('REVISION_CONFLICT', 'Use a current initial or advancing eligibility revision');
    this.interrupt({ type: 'system.pause', reason: 'config_change' });
    this.teachingEligibility = policy;
    this.session = { ...this.session!, policyRevision: policy.policyRevision };
    this.refreshTeachingPrompt();
    return ok(this.snapshot()!);
  }
  private freezeTeaching() {
    if (this.teachingRun?.since != null) {
      this.teachingRun.elapsed += Math.max(0, this.now() - this.teachingRun.since);
      this.teachingRun.since = null;
    }
  }
  private finishTeaching() {
    this.cancelChat();
    this.teachingRun = null;
    if (this.session)
      this.session = {
        ...this.session,
        generation: this.session.generation + 1,
        conversationMode: 'open',
        teaching: null,
        phase: 'ready',
        captureGrant: null,
      };
  }
  sweepTeaching(): boolean {
    const run = this.teachingRun;
    if (!run) return false;
    const elapsed = run.elapsed + (run.since === null ? 0 : Math.max(0, this.now() - run.since));
    if (elapsed < TEACHING_ACTIVE_LIMIT_MS) return false;
    this.finishTeaching();
    return true;
  }
  private refreshTeachingPrompt() {
    const s = this.session,
      t = s?.teaching;
    if (!s || !t) return;
    const eligible = this.eligibleForTeaching();
    const topic = teachingTopics.find(
      (item) =>
        item.entityId === t.entityId &&
        eligible.available &&
        eligible.permittedEntityIds.includes(item.entityId) &&
        !eligible.sessionHiddenIds.includes(item.entityId),
    );
    this.session = {
      ...s,
      teaching: {
        ...t,
        entityId: topic?.entityId ?? null,
        topicLabel: topic?.label ?? null,
        prompt: topic?.invitations[s.communicationSupport.preset] ?? null,
        presentationId: crypto.randomUUID(),
        revision: t.revision + 1,
        policyRevision: s.policyRevision,
        phase: s.phase === 'paused' ? 'paused' : topic ? 'ready' : 'unavailable',
      },
    };
  }
  private chooseTeachingTopic() {
    const s = this.session!,
      run = this.teachingRun!;
    const topic = nextTeachingTopic(this.eligibleForTeaching(), run.seen, [
      ...this.teachingPreferred,
    ]);
    if (topic) run.seen.push(topic.entityId);
    this.session = {
      ...s,
      generation: s.generation + 1,
      phase: 'ready',
      captureGrant: null,
      conversationMode: 'teach_lemmi',
      teaching: {
        mode: 'teach_lemmi',
        entityId: topic?.entityId ?? null,
        assetId: null,
        topicLabel: topic?.label ?? null,
        prompt: topic?.invitations[s.communicationSupport.preset] ?? null,
        presentationId: crypto.randomUUID(),
        revision: (s.teaching?.revision ?? -1) + 1,
        policyRevision: s.policyRevision,
        phase: topic ? 'ready' : 'unavailable',
      },
    };
    // No eligible topic is waiting for an explicit choice, not active conversation time.
    if (!topic) this.freezeTeaching();
    else if (run.since === null) run.since = this.now();
  }
  private readonly speech?: SpeechTurns;
  async speakTeachingPrompt(raw: unknown, rates: number[]) {
    this.sweepTeaching();
    const prompt = this.session?.teaching?.prompt;
    if (!prompt) return fail('UNAVAILABLE', 'No current teaching prompt');
    return (
      this.speech?.speakApproved(raw, rates, prompt) ??
      fail('UNAVAILABLE', 'Speech adapters are disabled')
    );
  }
  speechConfigured() {
    return !!this.speech;
  }
  requestCapture(raw: unknown, rates: number[]) {
    this.sweepTeaching();
    if (this.session?.teaching && !this.session.teaching.entityId)
      return fail('UNAVAILABLE', 'Choose another activity or finish; no eligible teaching topic');
    if (this.activity && this.activity.phase !== 'ended')
      return fail('REVISION_CONFLICT', 'Leave the activity before speaking');
    if (this.pendingChat) return fail('REVISION_CONFLICT', 'A text turn is pending');
    const result =
      this.speech?.start(raw, rates) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
    if (result.ok) this.lastChat = null;
    return result;
  }
  acceptCaptureChunk(raw: unknown) {
    this.sweepTeaching();
    return this.speech?.chunk(raw) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
  }
  async finishCapture(raw: unknown): Promise<Result<ConversationTextResult>> {
    this.sweepTeaching();
    return this.speech?.end(raw) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
  }
  playbackReceipt(raw: unknown) {
    this.sweepTeaching();
    return this.speech?.receipt(raw) ?? fail('UNAVAILABLE', 'Speech adapters are disabled');
  }
  speechOutputInfo() {
    this.sweepTeaching();
    return this.speech?.outputInfo() ?? null;
  }
  drainSpeechOutput() {
    this.sweepTeaching();
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
  private privacyRevision = 0;
  private policyRevision = 0;
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
    this.teachingEligibility = null;
    this.privacyRevision = _privacy;
    this.policyRevision = _policy;
    this.journal.profileId = profile.id;
    this.approvedFacts = approvedFacts.map((fact) => fact.value);
    if (this.session?.phase === 'paused')
      this.session = {
        ...this.session,
        profileRevision: profile.revision,
        privacyRevision: profile.privacyRevision,
        policyRevision: profile.policyRevision,
      };
    if (this.session?.teaching) this.refreshTeachingPrompt();
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
    if (!this.session) return null;
    const snapshot = structuredClone(this.session);
    if (snapshot.teaching && snapshot.teaching.entityId)
      snapshot.teaching.phase =
        snapshot.phase === 'paused'
          ? 'paused'
          : snapshot.phase === 'listening'
            ? 'listening'
            : snapshot.phase === 'processing'
              ? 'processing'
              : 'ready';
    return snapshot;
  }
  bindEndpoint(deviceId: string) {
    if (this.session) this.session = { ...this.session, activeEndpointId: deviceId };
  }
  isCurrentTextReply(turnId: string): boolean {
    this.sweepTeaching();
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
    this.sweepTeaching();
    const parsed = ConversationTextCommandSchema.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid participant text command');
    const input = parsed.data;
    const session = this.session;
    if (this.mode !== 'live' && session?.conversationMode !== 'teach_lemmi')
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
    if (route === 'topic_refusal' && session.teaching?.entityId)
      this.teachingHidden.add(session.teaching.entityId);
    if (
      this.speech?.busy() &&
      !this.speech.owns(speechOwner) &&
      !['urgent', 'unwell', 'topic_refusal'].includes(route)
    )
      return fail('REVISION_CONFLICT', 'Finish or interrupt the current speech turn first');
    if (fixed) {
      if (route === 'incomplete_need' && this.pendingChat)
        return fail('REVISION_CONFLICT', 'A conversation turn is pending');
      if (this.chatIds.size < 256) this.chatIds.set(input.commandId, fingerprint);
      this.cancelChat(false, speechOwner);
      let replyTurnId = input.commandId;
      if (route === 'unwell' || route === 'urgent' || route === 'topic_refusal') {
        const pause = () =>
          this.interrupt({
            type: 'system.pause',
            reason: route === 'topic_refusal' ? 'participant' : 'help',
          });
        if (speechOwner) {
          const fixedTurn = this.speech?.replaceForFixedReply(speechOwner, pause);
          if (!fixedTurn) return fail('REVISION_CONFLICT', 'Speech turn canceled');
          replyTurnId = fixedTurn;
        } else pause();
      } else this.session = { ...session, phase: 'waiting', captureGrant: null };
      if (route === 'topic_refusal') this.refreshTeachingPrompt();
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
    const teachingIntent = session.teaching
      ? teachingTextIntent(input.text, session.teaching.entityId ?? undefined)
      : 'explanation';
    if (teachingIntent !== 'explanation') {
      const action = `teaching.${teachingIntent}` as
        | 'teaching.next'
        | 'teaching.not_sure'
        | 'teaching.prefer'
        | 'teaching.avoid';
      let changed: Result<unknown> = fail('REVISION_CONFLICT', 'Teaching transition was canceled');
      const apply = () => {
        changed = this.handle('session.command', {
          sessionId: session.id,
          expectedGeneration: session.generation,
          commandId: input.commandId,
          action: { type: action },
        });
        return changed.ok;
      };
      const replyTurnId = speechOwner
        ? this.speech?.replaceForTeachingReply(speechOwner, apply)
        : apply()
          ? input.commandId
          : null;
      if (!replyTurnId)
        return changed.ok
          ? fail('REVISION_CONFLICT', 'Teaching speech turn was canceled')
          : changed;
      const result = ok<ConversationTextResult>({
        kind: 'reply',
        reply: {
          turnId: replyTurnId,
          language: input.language,
          source: 'fixed',
          text:
            teachingIntent === 'prefer'
              ? 'You can keep sharing if you like. Preferences are only used in this session.'
              : (this.session?.teaching?.prompt ??
                'No eligible topics remain. You can choose another activity or finish.'),
        },
        session: this.snapshot()!,
      });
      this.lastChat = { commandId: input.commandId, result };
      if (speechOwner) this.onFixedReply();
      return result;
    }
    if (
      this.pendingChat ||
      !['ready', 'waiting'].includes(session.phase) ||
      (this.activity && this.activity.phase !== 'ended')
    )
      return fail('REVISION_CONFLICT', 'Finish or interrupt the current turn/activity first');
    if (this.chatIds.size >= 256)
      return fail('UNAVAILABLE', 'Text turn capacity reached; start a new session');
    this.chatIds.set(input.commandId, fingerprint);
    this.lastChat = null;
    if (!this.chatAdapter)
      return fail('UNAVAILABLE', 'Configure the server LLM key/model before chatting');
    const teachingTopic = session.teaching
      ? teachingTopics.find((t) => t.entityId === session.teaching?.entityId)
      : null;
    if (session.teaching && (!teachingTopic || input.language !== 'en'))
      return fail('UNAVAILABLE', 'No eligible reviewed teaching topic in this language');
    const prepared = companionInput({
      text: input.text,
      language: input.language,
      preset: session.communicationSupport.preset,
      preferredName: this.profile.preferredName,
      history: this.dialogue,
      approvedFacts: session.teaching ? [] : this.approvedFacts,
    });
    if (!prepared.ok) return prepared;
    if (teachingTopic)
      prepared.data.system +=
        '\n' + teachingInstructions(teachingTopic, session.communicationSupport.preset);
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
    const current = () => {
      this.sweepTeaching();
      return (
        this.pendingChat === pending &&
        this.session?.id === session.id &&
        this.session.phase === 'processing' &&
        this.session.generation === session.generation &&
        this.session.leaseId === session.leaseId &&
        this.session.profileRevision === session.profileRevision &&
        this.session.privacyRevision === session.privacyRevision &&
        this.session.policyRevision === session.policyRevision
      );
    };
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
        else if (
          teachingTopic &&
          !teachingReplyWithinTopic(response.data.text, teachingTopic.entityId)
        )
          result = fail(
            'UNAVAILABLE',
            'Response left the reviewed teaching topic; choose another topic or finish',
          );
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
              source: this.mode === 'mock' ? 'scripted' : 'model',
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
        applyActivitySystemInput(this.activity, input, musicPack, this.context),
      );
      this.activity = transition.nextState;
      for (const event of transition.events) this.event(event);
    }
  }
  private interrupt(input: Extract<ActivitySystemInput, { type: 'system.pause' | 'system.end' }>) {
    this.freezeTeaching();
    this.cancelChat();
    if (!this.session || this.session.phase === 'ended') return;
    this.session = {
      ...this.session,
      generation: this.session.generation + 1,
      phase: input.type === 'system.end' ? 'ended' : 'paused',
      captureGrant: null,
    };
    this.system(input);
    if (input.type === 'system.end') {
      this.teachingRun = null;
      this.teachingHidden.clear();
      this.teachingPreferred.clear();
      this.session = { ...this.session, conversationMode: 'open', teaching: null };
    }
  }
  disconnect() {
    this.interrupt({ type: 'system.pause', reason: 'disconnect' });
  }
  revokeDeviceAccess() {
    this.interrupt({ type: 'system.end', reason: 'revoked' });
  }
  handle(operation: string, raw: unknown): Result<unknown> {
    this.sweepTeaching();
    if (!Object.hasOwn(operations, operation))
      return fail('NOT_FOUND', 'Unknown service operation');
    const op = operation as Operation;
    const parsed = operations[op].input.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid command shape');
    const input = parsed.data;
    if (op === 'conversation.submit')
      return fail('UNAVAILABLE', 'Use the asynchronous conversation submission path');
    if (
      this.mode === 'live' &&
      !['session.start', 'session.get', 'session.command', 'help.create'].includes(op)
    )
      return fail('UNAVAILABLE', 'Only authenticated device controls are implemented');
    // Parsed keys/values only; never accept a client-selected scope or preview profile as live.
    if ('profileId' in input && input.profileId !== this.profile.id)
      return fail('FORBIDDEN', 'Only Alex is functional; examples are preview-only');
    if ('profile' in input && input.profile.id !== this.profile.id)
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
        if (changedContext) {
          this.teachingEligibility = null;
          this.refreshTeachingPrompt();
        }
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
        this.speech?.reset();
        this.chatIds.clear();
        this.teachingRun = null;
        this.teachingHidden.clear();
        this.teachingPreferred.clear();
        this.teachingEligibility = null;
        this.session = SessionSnapshotSchema.parse({
          id: this.mode === 'live' ? `session-${crypto.randomUUID()}` : `session-${++this.count}`,
          profileId: this.profile.id,
          generation: 0,
          profileRevision: this.profile.revision,
          privacyRevision: this.privacyRevision,
          policyRevision: this.policyRevision,
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
        this.context.eligibility = {
          ...this.context.eligibility,
          profileId: this.profile.id,
          policyRevision: this.policyRevision,
          ...(this.mode === 'live' ? { permittedEntityIds: [], available: false } : {}),
        };
        this.context.presentationPolicy = structuredClone(this.session.communicationSupport);
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
            this.cancelChat();
            this.system({ type: 'system.resume' });
            this.session = {
              ...this.session,
              generation: this.session.generation + 1,
              phase: 'ready',
              captureGrant: null,
              profileRevision: this.profile.revision,
            };
            if (this.teachingRun && this.session.teaching?.entityId)
              this.teachingRun.since = this.now();
            this.refreshTeachingPrompt();
            break;
          case 'teaching.start':
            if (
              this.session.phase === 'paused' ||
              this.session.conversationMode === 'teach_lemmi' ||
              (this.activity && this.activity.phase !== 'ended')
            )
              return fail('REVISION_CONFLICT', 'Resume or leave the current activity first');
            this.cancelChat();
            this.teachingRun = { elapsed: 0, since: this.now(), seen: [] };
            this.chooseTeachingTopic();
            break;
          case 'teaching.next':
          case 'teaching.not_sure':
          case 'teaching.avoid':
          case 'teaching.prefer':
            if (!this.teachingRun || !this.session.teaching || this.session.phase === 'paused')
              return fail('REVISION_CONFLICT', 'Use a current active teaching presentation');
            const entity = this.session.teaching.entityId;
            if (action.type !== 'teaching.next' && !entity)
              return fail('UNAVAILABLE', 'No teaching topic is presented');
            this.cancelChat();
            if (action.type === 'teaching.prefer') {
              this.teachingPreferred.add(entity!);
              this.session = {
                ...this.session,
                generation: this.session.generation + 1,
                phase: 'ready',
                captureGrant: null,
              };
              this.refreshTeachingPrompt();
            } else {
              if (action.type !== 'teaching.next') this.teachingHidden.add(entity!);
              this.chooseTeachingTopic();
            }
            break;
          case 'teaching.finish':
            if (!this.teachingRun) return fail('REVISION_CONFLICT', 'Teaching is not active');
            this.finishTeaching();
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
              leaseId:
                this.mode === 'live' ? `lease-${crypto.randomUUID()}` : `lease-${++this.count}`,
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
        if (this.session.teaching)
          return fail('REVISION_CONFLICT', 'Finish teaching before starting another activity');
        if (this.session.phase === 'paused' || this.session.phase === 'ended')
          return fail('REVISION_CONFLICT', 'Session must be ready');
        if (input.activityId !== 'music_playlist' || input.packId !== musicPack.id)
          return fail('UNAVAILABLE', 'Activity pending Lukas implementation');
        if (this.activity && this.activity.phase !== 'ended')
          return fail('REVISION_CONFLICT', 'Leave the current activity first');
        this.context = contextFor(this.session.id);
        this.activity = createActivity(
          { instanceId: `activity-${++this.count}` },
          musicPack,
          this.context,
        );
        this.event({ type: 'activity_started' });
        return ok(projectActivity(this.activity, musicPack, this.context));
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
            reduceActivity(this.activity, validated.data.action, musicPack, this.context),
          );
          this.activity = transition.nextState;
          for (const event of transition.events) this.event(event);
          // Deliberately DO NOT execute effects: no approved music bytes or live endpoint yet.
        }
        return ok(projectActivity(this.activity, musicPack, this.context));
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
