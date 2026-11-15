import type { ServerEvent, SessionSnapshot, SpeechOutputStart } from '@lemmi/contracts';
import type { ParticipantConnection } from '@lemmi/contracts';
import { TurnEnd } from './turn-end';
import { loadVoiceDetector, type VoiceDetector } from './webrtc-vad';

export type BrowserSpeechTiming = {
  stage: 'capture' | 'turn_end_to_scheduled_playback' | 'playback_gap';
  durationMs: number;
  reason?: 'manual' | 'silence' | 'limit';
};
export interface BrowserAudioOptions {
  automatic?: boolean;
  silenceMs?: number;
  loadDetector?: () => Promise<VoiceDetector>;
  now?: () => number;
  onTiming?: (timing: BrowserSpeechTiming) => void;
}

// Transient browser PCM only. Every capture begins with a user gesture and a server grant.
export class BrowserAudio {
  private language: 'en' | 'de' = 'en';
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private grant: SessionSnapshot['captureGrant'] = null;
  private captureToken: SessionSnapshot | null = null;
  private samples: number[] = [];
  private position = 0;
  private chunks = 0;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private initialSilence: ReturnType<typeof setTimeout> | null = null;
  private epoch = 0;
  private detector: VoiceDetector | null = null;
  private turnEnd: TurnEnd | null = null;
  private captureBegan = 0;
  private submitted: { turnId: string; at: number } | null = null;
  // Paused playback requires an application-owned fixed text reply at the exact
  // current authority snapshot. Pause alone never grants permission for audio.
  private fixedReply: { token: SessionSnapshot; turnId: string } | null = null;
  private playbackTimer: ReturnType<typeof setInterval> | null = null;
  private speaking = false;
  private syncPlayback() {
    const now = this.context?.currentTime ?? -1;
    const speaking =
      this.context?.state === 'running' &&
      !!this.output &&
      [...this.output.spans.values()].some(([start, end]) => now >= start && now < end);
    if (speaking !== this.speaking) {
      this.speaking = speaking;
      this.playbackState(speaking);
    }
  }
  private outputWindow = 4;
  private output: {
    meta: SpeechOutputStart;
    token: SessionSnapshot;
    received: number;
    played: number;
    ended: boolean;
    started: boolean;
    next: number;
    nodes: Set<AudioBufferSourceNode>;
    spans: Map<AudioBufferSourceNode, [number, number]>;
    submittedAt?: number;
  } | null = null;
  constructor(
    private readonly connection: ParticipantConnection,
    private readonly state: (listening: boolean) => void,
    private readonly error: (message: string) => void,
    private readonly playbackState: (speaking: boolean) => void = () => {},
    private readonly options: BrowserAudioOptions = {},
  ) {}
  private now() {
    return this.options.now?.() ?? performance.now();
  }
  private timing(timing: BrowserSpeechTiming) {
    // Diagnostics are optional, content-free, and cannot interrupt controls.
    try {
      this.options.onTiming?.(timing);
    } catch {}
  }
  async speak() {
    this.cancelInput();
    const epoch = this.epoch;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
      if (this.options.automatic !== false) {
        let expired = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const loading = (this.options.loadDetector ?? loadVoiceDetector)().then((detector) => {
            if (expired || epoch !== this.epoch) {
              detector.destroy();
              return null;
            }
            return detector;
          });
          const detector = await Promise.race([
            loading,
            new Promise<null>((resolve) => {
              timer = setTimeout(() => {
                expired = true;
                resolve(null);
              }, 3000);
            }),
          ]);
          if (epoch !== this.epoch) {
            detector?.destroy();
            return;
          }
          this.detector = detector;
          if (!detector) throw new Error('Detector timed out');
          this.turnEnd = new TurnEnd(this.options.silenceMs);
        } catch {
          if (epoch !== this.epoch) return;
          this.detector?.destroy();
          this.detector = null;
          this.error(
            this.language === 'de'
              ? 'Automatisches Beenden ist nicht verfügbar. Wähle „Fertig gesprochen“, wenn du bereit bist.'
              : 'Automatic turn ending is unavailable. Tap Finish speaking when ready.',
          );
        } finally {
          if (timer) clearTimeout(timer);
        }
      }
      if (epoch !== this.epoch) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true },
        video: false,
      });
      if (epoch !== this.epoch) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      this.stream = stream;
      if (!this.connection.send('input.speak', { language: this.language }))
        throw new Error('Connection unavailable');
      this.deadline = setTimeout(() => {
        this.cancelInput();
        this.connection.send('input.pause');
        this.error(
          this.language === 'de'
            ? 'Das Zuhören konnte nicht starten. Bitte versuche es erneut.'
            : 'Listening did not start. Try again.',
        );
      }, 5000);
    } catch {
      if (epoch === this.epoch) {
        this.cancelInput();
        this.error(
          this.language === 'de'
            ? 'Das Mikrofon ist nicht verfügbar. Bitte prüfe die Browserberechtigung und versuche es erneut.'
            : 'Microphone unavailable. Check browser permission and try again.',
        );
      }
    }
  }
  private begin(grant: NonNullable<SessionSnapshot['captureGrant']>, session: SessionSnapshot) {
    if (!this.stream || !this.context) return;
    if (this.deadline) clearTimeout(this.deadline);
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    this.grant = grant;
    this.captureToken = { ...session };
    this.chunks = 0;
    this.samples = [];
    this.position = 0;
    this.captureBegan = this.now();
    this.input = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(2048, 1, 1);
    this.input.connect(this.processor);
    this.processor.connect(this.context.destination);
    this.processor.onaudioprocess = (event) => {
      if (this.grant !== grant || !this.context) return;
      const input = event.inputBuffer.getChannelData(0);
      this.samples.push(...input);
      const ratio = this.context.sampleRate / 16000;
      while (this.position + ratio * 320 < this.samples.length) {
        const pcm = new Uint8Array(640);
        const view = new DataView(pcm.buffer);
        for (let i = 0; i < 320; i++) {
          const low = Math.floor(this.position);
          const fraction = this.position - low;
          const value =
            (this.samples[low] ?? 0) * (1 - fraction) + (this.samples[low + 1] ?? 0) * fraction;
          view.setInt16(i * 2, Math.round(Math.max(-1, Math.min(1, value)) * 32767), true);
          this.position += ratio;
        }
        const data = btoa(String.fromCharCode(...pcm));
        let decision: 'continue' | 'finished' | 'no_speech' = 'continue';
        try {
          if (this.detector && this.turnEnd)
            decision = this.turnEnd.push(this.detector.process(pcm));
        } catch {
          this.detector?.destroy();
          this.detector = null;
          this.turnEnd = null;
          this.error(
            this.language === 'de'
              ? 'Automatisches Beenden wurde unterbrochen. Wähle „Fertig gesprochen“, wenn du bereit bist.'
              : 'Automatic turn ending stopped. Tap Finish speaking when ready.',
          );
        }
        pcm.fill(0);
        if (
          !this.connection.send(
            'audio.chunk',
            {
              leaseId: grant.leaseId,
              streamId: grant.streamId,
              chunkIndex: this.chunks++,
              encoding: 'pcm_s16le',
              data,
            },
            false,
            grant.turnId,
          )
        ) {
          this.cancelInput();
          return;
        }
        if (decision === 'no_speech') {
          this.noSpeech();
          return;
        }
        if (decision === 'finished' || this.chunks >= 975) {
          this.finish(decision === 'finished' ? 'silence' : 'limit');
          return;
        }
      }
      const consumed = Math.floor(this.position);
      this.samples.fill(0, 0, consumed);
      this.samples.splice(0, consumed);
      this.position -= consumed;
    };
    this.state(true);
    if (this.turnEnd)
      this.initialSilence = setTimeout(() => {
        if (this.grant === grant && this.turnEnd && !this.turnEnd.heardSpeech) this.noSpeech();
      }, 15000);
    this.deadline = setTimeout(() => {
      if (this.turnEnd && !this.turnEnd.heardSpeech) this.noSpeech();
      else this.finish('limit');
    }, 19500);
  }
  private noSpeech() {
    this.cancelInput();
    // Reuse the existing explicit pause path: no empty recognition/model request.
    this.connection.send('input.pause');
    this.error(
      this.language === 'de'
        ? 'Keine Sprache erkannt. Das Zuhören ist pausiert. Wähle „Weiter“, wenn du bereit bist.'
        : 'No speech detected. Listening is paused. Resume when you are ready.',
    );
  }
  finish(reason: 'manual' | 'silence' | 'limit' = 'manual') {
    const grant = this.grant;
    const count = this.chunks;
    const durationMs = Math.max(0, Math.round(this.now() - this.captureBegan));
    this.cancelInput();
    if (grant && count) {
      const sent = this.connection.send(
        'audio.end',
        { leaseId: grant.leaseId, streamId: grant.streamId, chunkCount: count },
        false,
        grant.turnId,
      );
      if (sent) {
        this.submitted = { turnId: grant.turnId, at: this.now() };
        this.timing({ stage: 'capture', durationMs, reason });
      } else
        this.error(
          this.language === 'de'
            ? 'Die Verbindung ist nicht verfügbar. Deine Sprache wurde nicht gesendet.'
            : 'Connection unavailable. Your speech was not submitted.',
        );
    } else if (grant) this.connection.send('input.pause');
  }
  cancelInput() {
    this.epoch++;
    this.submitted = null;
    this.detector?.destroy();
    this.detector = null;
    this.turnEnd = null;
    if (this.deadline) clearTimeout(this.deadline);
    if (this.initialSilence) clearTimeout(this.initialSilence);
    this.initialSilence = null;
    this.deadline = null;
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
    }
    this.input?.disconnect();
    this.input = null;
    this.processor = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.samples.fill(0);
    this.samples = [];
    this.position = 0;
    this.grant = null;
    this.captureToken = null;
    this.chunks = 0;
    this.state(false);
  }
  cancel() {
    this.fixedReply = null;
    this.cancelInput();
    const output = this.output;
    this.output = null;
    if (this.playbackTimer) clearInterval(this.playbackTimer);
    this.playbackTimer = null;
    this.syncPlayback();
    if (output)
      for (const node of output.nodes) {
        node.onended = null;
        try {
          node.stop();
        } catch {}
        node.buffer?.getChannelData(0).fill(0);
        node.disconnect();
      }
  }
  private receipt(status: 'started' | 'progress' | 'completed' | 'failed', played: number) {
    const output = this.output;
    if (!output) return;
    this.connection.send(
      'audio.receipt',
      {
        leaseId: output.meta.leaseId,
        streamId: output.meta.streamId,
        status,
        playedChunks: played,
      },
      false,
      output.meta.turnId,
    );
  }
  private completed() {
    const output = this.output;
    if (output?.ended && output.played === output.meta.chunkCount) {
      this.receipt('completed', output.played);
      this.output = null;
      this.fixedReply = null;
      if (this.playbackTimer) clearInterval(this.playbackTimer);
      this.playbackTimer = null;
      this.syncPlayback();
    }
  }
  private sameAuthority(token: SessionSnapshot, session: SessionSnapshot) {
    return [
      'id',
      'generation',
      'leaseId',
      'profileRevision',
      'privacyRevision',
      'policyRevision',
      'activeEndpointId',
    ].every((key) => token[key as keyof SessionSnapshot] === session[key as keyof SessionSnapshot]);
  }
  receive(event: ServerEvent, deviceId: string) {
    if (event.type === 'device.ready') {
      this.language = event.payload.language ?? 'en';
      this.outputWindow =
        event.payload.audio !== false ? event.payload.audio.outputWindowChunks : 4;
    }
    const current = this.connection.session;
    if (
      event.type === 'response.text' &&
      event.payload.source === 'fixed' &&
      current &&
      current.phase === 'paused' &&
      current.activeEndpointId === deviceId &&
      event.session_id === current.id &&
      event.generation === current.generation &&
      event.turn_id === event.payload.turnId
    ) {
      this.fixedReply = { token: { ...current }, turnId: event.payload.turnId };
    }
    if (event.type === 'state.changed') {
      const session = event.payload.session;
      const permittedFixed =
        session &&
        this.fixedReply &&
        this.sameAuthority(this.fixedReply.token, session) &&
        (!this.output || this.output.meta.turnId === this.fixedReply.turnId);
      if (
        !session ||
        session.activeEndpointId !== deviceId ||
        session.phase === 'ended' ||
        (session.phase === 'paused' && !permittedFixed) ||
        (this.output && !this.sameAuthority(this.output.token, session))
      ) {
        this.cancel();
        return;
      }
      if (session.phase !== 'paused') this.fixedReply = null;
      if (
        this.captureToken &&
        (!this.sameAuthority(this.captureToken, session) ||
          session.captureGrant?.turnId !== this.grant?.turnId ||
          session.captureGrant?.streamId !== this.grant?.streamId)
      )
        this.cancelInput();
      if (session.captureGrant && !session.micMuted && session.phase === 'listening') {
        if (!this.grant && this.stream) this.begin(session.captureGrant, session);
      } else if (this.grant) this.cancelInput();
      if (
        this.output &&
        (session.leaseId !== this.output.meta.leaseId ||
          (event.turn_id && event.turn_id !== this.output.meta.turnId))
      )
        this.cancel();
    }
    if (event.type === 'response.cancel') this.cancel();
    if (event.type === 'response.start') {
      const session = this.connection.session;
      if (
        !session ||
        event.session_id !== session.id ||
        event.generation !== session.generation ||
        event.payload.leaseId !== session.leaseId ||
        event.turn_id !== event.payload.turnId ||
        session.activeEndpointId !== deviceId ||
        (session.phase === 'paused' &&
          (!this.fixedReply ||
            !this.sameAuthority(this.fixedReply.token, session) ||
            this.fixedReply.turnId !== event.payload.turnId)) ||
        ['ended', 'unavailable'].includes(session.phase)
      )
        return;
      const fixedReply = this.fixedReply;
      const submitted = this.submitted;
      this.cancel();
      this.fixedReply = fixedReply;
      if (!this.context || this.context.state !== 'running') {
        this.connection.send(
          'audio.receipt',
          {
            leaseId: event.payload.leaseId,
            streamId: event.payload.streamId,
            status: 'failed',
            playedChunks: 0,
          },
          false,
          event.payload.turnId,
        );
        this.error(
          this.language === 'de'
            ? 'Aktiviere den Browserton mit „Sprechen“ und versuche es erneut.'
            : 'Enable browser sound with Speak now, then retry.',
        );
        return;
      }
      this.output = {
        meta: event.payload,
        token: { ...session },
        received: 0,
        played: 0,
        ended: false,
        started: false,
        next: this.context.currentTime + 0.08,
        nodes: new Set(),
        spans: new Map(),
        submittedAt: submitted?.turnId === event.payload.turnId ? submitted.at : undefined,
      };
    }
    if (event.type === 'audio.chunk' || event.type === 'audio.end') {
      const session = this.connection.session;
      if (
        !session ||
        event.session_id !== session.id ||
        event.generation !== session.generation ||
        event.turn_id !== this.output?.meta.turnId ||
        event.payload.leaseId !== session.leaseId ||
        session.activeEndpointId !== deviceId
      )
        return;
    }
    if (event.type === 'audio.chunk') {
      const output = this.output;
      const context = this.context;
      if (
        !output ||
        !context ||
        output.meta.streamId !== event.payload.streamId ||
        event.payload.chunkIndex !== output.received
      )
        return;
      if (output.nodes.size >= this.outputWindow) {
        this.receipt('failed', output.played);
        this.cancel();
        this.error(
          this.language === 'de'
            ? 'Die Wiedergabe wurde unterbrochen. Bitte versuche es erneut.'
            : 'Browser playback fell behind. Try again.',
        );
        return;
      }
      const raw = atob(event.payload.data);
      const expected = Math.min(
        output.meta.chunkBytes,
        output.meta.byteLength - output.received * output.meta.chunkBytes,
      );
      if (output.received >= output.meta.chunkCount || raw.length !== expected) {
        this.receipt('failed', output.played);
        this.cancel();
        this.error(
          this.language === 'de'
            ? 'Die Wiedergabe ist nicht verfügbar. Bitte versuche es erneut.'
            : 'Invalid playback data. Try again.',
        );
        return;
      }
      const pcm = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) pcm[i] = raw.charCodeAt(i);
      const buffer = context.createBuffer(1, pcm.length / 2, output.meta.sampleRate);
      const channel = buffer.getChannelData(0);
      const view = new DataView(pcm.buffer);
      for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
      pcm.fill(0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      output.nodes.add(source);
      output.received++;
      const playAt = Math.max(output.next, context.currentTime);
      if (output.received === 1 && output.submittedAt !== undefined)
        this.timing({
          stage: 'turn_end_to_scheduled_playback',
          durationMs: Math.max(
            0,
            Math.round(this.now() - output.submittedAt + (playAt - context.currentTime) * 1000),
          ),
        });
      if (output.received > 1 && context.currentTime > output.next)
        this.timing({
          stage: 'playback_gap',
          durationMs: Math.round((context.currentTime - output.next) * 1000),
        });
      output.next = playAt + buffer.duration;
      output.spans.set(source, [playAt, output.next]);
      this.playbackTimer ??= setInterval(() => this.syncPlayback(), 30);
      source.onended = () => {
        if (this.output !== output) return;
        output.nodes.delete(source);
        output.spans.delete(source);
        this.syncPlayback();
        source.disconnect();
        buffer.getChannelData(0).fill(0);
        if (!output.started) {
          output.started = true;
          this.receipt('started', 0);
        }
        output.played++;
        if (output.played % 2 === 0) this.receipt('progress', output.played);
        this.completed();
      };
      source.start(playAt);
    }
    if (event.type === 'audio.end' && this.output?.meta.streamId === event.payload.streamId) {
      if (
        event.payload.chunkCount !== this.output.meta.chunkCount ||
        this.output.received !== this.output.meta.chunkCount
      ) {
        this.receipt('failed', this.output.played);
        this.cancel();
        return;
      }
      this.output.ended = true;
      this.completed();
    }
  }
  close() {
    this.cancel();
    void this.context?.close();
    this.context = null;
  }
}
