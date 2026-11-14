import {
  operations,
  ok,
  fail,
  ParticipantProfileSchema,
  SessionSnapshotSchema,
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
} from '@lemmi/activities';
// In-memory mock authority ONLY. No real credentials, providers, speech, media or persistence.
export class MockCoordinator {
  private profile = structuredClone(caregiverProfile);
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
  private participant() {
    return ParticipantProfileSchema.parse({
      id: this.profile.id,
      preferredName: this.profile.preferredName,
      avatarId: this.profile.avatarId,
      revision: this.profile.revision,
      communicationSupport: this.profile.communicationSupport,
    });
  }
  private event(type: Journal['sessions'][number]['events'][number]['type'], itemId?: string) {
    const record = this.journal.sessions.find((r) => r.sessionId === this.session?.id);
    if (record && record.events.length < 100)
      record.events.push({ type, source: 'measured_event', ...(itemId ? { itemId } : {}) });
  }
  private system(input: Parameters<typeof applyActivitySystemInput>[1]) {
    if (this.activity && this.context)
      this.activity = applyActivitySystemInput(
        this.activity,
        input,
        musicPack,
        this.context,
      ).nextState;
  }
  private interrupt(phase: 'paused' | 'ended') {
    if (!this.session || this.session.phase === 'ended') return;
    this.session = {
      ...this.session,
      generation: this.session.generation + 1,
      phase,
      captureGrant: null,
    };
    this.system(
      phase === 'ended'
        ? { type: 'system.end', reason: 'stop' }
        : { type: 'system.pause', reason: 'participant' },
    );
  }
  disconnect() {
    this.interrupt('paused');
  }
  handle(operation: string, raw: unknown): Result<unknown> {
    if (!Object.hasOwn(operations, operation))
      return fail('NOT_FOUND', 'Unknown service operation');
    const op = operation as Operation;
    const parsed = operations[op].input.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid command shape');
    const input = parsed.data;
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
      if (this.cache.size >= 256)
        return fail('UNAVAILABLE', 'Mock command capacity reached; restart gateway');
    }
    let result: Result<unknown>;
    try {
      result = this.dispatch(op, input);
    } catch {
      result = fail('VALIDATION_ERROR', 'Command is not valid in the current state');
    }
    if (result.ok && !operations[op].output.safeParse(result.data).success)
      throw new Error(`Invalid mock response for ${op}`);
    if (key) this.cache.set(key, { body, result: structuredClone(result) });
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
        if (changedContext) this.interrupt('paused');
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
        this.session = SessionSnapshotSchema.parse({
          id: `session-${++this.count}`,
          profileId: DEMO_PROFILE_ID,
          generation: 0,
          profileRevision: this.profile.revision,
          privacyRevision: 0,
          policyRevision: 0,
          phase: 'ready',
          endpoint: input.endpoint,
          leaseId: `lease-${this.count}`,
          micMuted: true,
          captureGrant: null,
          communicationSupport: this.profile.communicationSupport,
          conversationMode: 'open',
          teaching: null,
          mode: 'mock',
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
            this.interrupt('paused');
            break;
          case 'stop':
            this.interrupt('ended');
            this.event('session_stopped');
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
            this.session = {
              ...this.session,
              generation: this.session.generation + 1,
              micMuted: action.muted,
              captureGrant: null,
            };
            break;
          case 'handoff':
            this.interrupt('paused');
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
        this.event('activity_started');
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
          const transition = reduceActivity(this.activity, input.action, musicPack, this.context);
          this.activity = transition.nextState;
          for (const event of transition.events) this.event(event.type, event.itemId);
          // Deliberately DO NOT execute effects: no approved music bytes or live endpoint yet.
        }
        return ok(projectActivity(this.activity, musicPack, this.context));
      case 'help.create':
        if (input.mode !== 'simulation')
          return fail('UNAVAILABLE', 'Real notifications are not configured');
        this.interrupt('paused');
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
