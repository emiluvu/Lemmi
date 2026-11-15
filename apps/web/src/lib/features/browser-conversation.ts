import type { ServerEvent, SessionSnapshot } from '@lemmi/contracts';

interface Transport {
  session: SessionSnapshot | null;
  send(type: string, payload?: unknown, independent?: boolean): boolean;
}
interface Audio {
  prepare(): Promise<boolean>;
  speak(): Promise<void>;
  cancelInput(): void;
  readonly hasOutput: boolean;
}
// A transient listening choice, not session/capture authority. Every turn still
// uses the existing input.speak command and waits for a fresh server grant.
export class BrowserConversation {
  private epoch = 0;
  private enabled = false;
  private stage:
    | 'idle'
    | 'starting'
    | 'opening'
    | 'opening_playback'
    | 'opening_completed'
    | 'unmuting'
    | 'capture'
    | 'reply'
    | 'completed' = 'idle';
  private openingText = false;
  private output: { sessionId: string; turnId: string; streamId: string } | null = null;
  private anchor: SessionSnapshot | null = null;
  private completed: SessionSnapshot | null = null;
  private captureGeneration: number | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  constructor(
    private readonly connection: Transport,
    private readonly audio: Audio,
    private readonly deviceId: string,
    private readonly changed: (enabled: boolean) => void,
    private readonly error: (message: string) => void,
  ) {}
  stop() {
    this.suspend();
    this.audio.cancelInput();
  }
  // Audio errors already own their cleanup; a manual endpointing warning can
  // leave the current single turn available without enabling another turn.
  suspend() {
    this.epoch++;
    this.enabled = false;
    this.stage = 'idle';
    this.openingText = false;
    this.output = null;
    this.anchor = this.completed = null;
    this.captureGeneration = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.changed(false);
  }
  private sameContext(a: SessionSnapshot, b: SessionSnapshot) {
    return [
      'id',
      'leaseId',
      'profileRevision',
      'privacyRevision',
      'policyRevision',
      'activeEndpointId',
    ].every((key) => a[key as keyof SessionSnapshot] === b[key as keyof SessionSnapshot]);
  }
  async start() {
    this.stop();
    const epoch = this.epoch;
    const before = this.connection.session;
    if (before && before.phase !== 'ended' && before.activeEndpointId !== this.deviceId) {
      this.error('Use this browser before starting its microphone.');
      return;
    }
    if (before && !['ready', 'waiting', 'paused', 'ended'].includes(before.phase)) return;
    if (!(await this.audio.prepare()) || epoch !== this.epoch) return;
    // A permission/sound promise cannot transfer intent into changed authority.
    if (before && this.connection.session && !this.sameContext(before, this.connection.session))
      return;
    this.enabled = true;
    this.changed(true);
    this.stage = !before || ['paused', 'ended'].includes(before.phase) ? 'opening' : 'starting';
    this.anchor = before && before.phase !== 'ended' ? { ...before } : null;
    this.timer = setTimeout(() => {
      this.stop();
      this.error('Listening did not start. Try Start listening again.');
    }, 25000);
    if (!before || before.phase === 'ended') {
      if (!this.connection.send('input.start', {}, true)) this.failed();
    } else if (before.phase === 'paused') {
      if (!this.connection.send('input.resume')) this.failed();
    } else this.advance();
  }
  private failed() {
    this.stop();
    this.error('Connection unavailable. Reconnect, then start listening.');
  }
  receive(event: ServerEvent) {
    if (!this.enabled) return;
    if (event.type === 'error') {
      this.stop();
      return;
    }
    if (event.type === 'response.cancel') {
      // A completed or superseded output can be canceled after a new listening
      // turn starts. Only the output this intent is awaiting may retire it.
      if (
        this.output &&
        event.session_id === this.output.sessionId &&
        event.turn_id === this.output.turnId &&
        event.payload.streamId === this.output.streamId
      )
        this.stop();
      return;
    }
    if (event.type === 'response.start' && ['opening', 'reply'].includes(this.stage)) {
      const current = this.connection.session;
      if (!current || event.session_id !== current.id || event.generation !== current.generation)
        return;
      this.anchor ??= { ...current };
      this.output = {
        sessionId: current.id,
        turnId: event.payload.turnId,
        streamId: event.payload.streamId,
      };
      if (this.stage === 'opening') this.stage = 'opening_playback';
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
      return;
    }
    if (event.type === 'response.text' && this.stage === 'opening') {
      const current = this.connection.session;
      if (!current || event.session_id !== current.id || event.generation !== current.generation)
        return;
      this.openingText = true;
      this.advance();
      return;
    }
    if (event.type !== 'state.changed') return;
    const session = event.payload.session;
    if (
      !session ||
      session.activeEndpointId !== this.deviceId ||
      (this.anchor && !this.sameContext(this.anchor, session)) ||
      ['ended', 'unavailable'].includes(session.phase) ||
      (session.phase === 'paused' &&
        !(
          this.stage === 'opening' &&
          this.anchor?.phase === 'paused' &&
          this.anchor.generation === session.generation
        ))
    ) {
      this.stop();
      return;
    }
    if (this.stage === 'opening') this.anchor ??= { ...session };
    if (
      !['starting', 'unmuting', 'opening', 'opening_playback', 'opening_completed'].includes(
        this.stage,
      ) &&
      session.micMuted
    ) {
      this.stop();
      return;
    }
    if (this.stage === 'capture' && session.generation !== this.captureGeneration) {
      this.stop();
      return;
    }
    this.advance();
  }
  submitted(token: SessionSnapshot) {
    if (this.enabled && this.anchor && this.sameContext(this.anchor, token)) {
      this.stage = 'reply';
      this.completed = null;
    }
  }
  playbackCompleted(token: SessionSnapshot) {
    if (
      !this.enabled ||
      !['reply', 'opening_playback'].includes(this.stage) ||
      !this.anchor ||
      !this.sameContext(this.anchor, token)
    )
      return;
    this.completed = token;
    this.output = null;
    this.stage = this.stage === 'opening_playback' ? 'opening_completed' : 'completed';
    this.advance();
  }
  private advance() {
    const session = this.connection.session;
    if (
      !this.enabled ||
      !session ||
      session.activeEndpointId !== this.deviceId ||
      !['ready', 'waiting'].includes(session.phase) ||
      this.audio.hasOutput
    )
      return;
    if (this.stage === 'opening') {
      // A text fallback ends this listening attempt without microphone access.
      if (this.openingText) this.suspend();
      return;
    }
    if (this.stage === 'opening_completed') {
      if (
        !this.completed ||
        !this.sameContext(this.completed, session) ||
        this.completed.generation !== session.generation
      ) {
        this.stop();
        return;
      }
      if (session.communicationSupport.preset === 'quiet') {
        this.suspend();
        return;
      }
      this.stage = 'starting';
    }
    if (this.stage === 'starting' || this.stage === 'unmuting') {
      this.anchor ??= { ...session };
      if (!this.sameContext(this.anchor, session)) {
        this.stop();
        return;
      }
      if (session.micMuted) {
        if (this.stage !== 'unmuting') {
          this.stage = 'unmuting';
          if (!this.connection.send('input.mute', { muted: false })) this.failed();
        }
        return;
      }
    } else if (this.stage === 'completed') {
      if (session.communicationSupport.preset === 'quiet') {
        this.suspend();
        return;
      }
      if (
        !this.completed ||
        !this.sameContext(this.completed, session) ||
        this.completed.generation !== session.generation ||
        session.micMuted
      ) {
        this.stop();
        return;
      }
    } else return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stage = 'capture';
    this.captureGeneration = session.generation;
    this.completed = null;
    const epoch = this.epoch;
    void this.audio.speak().catch(() => {
      if (epoch === this.epoch) this.failed();
    });
  }
}
