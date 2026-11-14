import {
  DeviceEventSchema,
  ServerEventSchema,
  type SessionSnapshot,
  type SpeechOutputStart,
} from '@lemmi/contracts';
import { PcmFramer, pcmBase64, decodePcm } from './voice-pcm';
import { SpeechEndpoint } from './voice-endpoint';

export type VoiceState = {
  connected: boolean;
  ready: boolean;
  audio: boolean;
  teaching: boolean;
  listening: boolean;
  playing: boolean;
  pending: boolean;
  session: SessionSnapshot | null;
  reply: string;
  message: string;
};
type Output = {
  meta: SpeechOutputStart;
  received: number;
  consumed: number;
  ended: boolean;
  nextAt: number;
};
// A transport/player only. The backend owns all session, teaching and timing rules.
export class VoiceClient {
  private ws: WebSocket | null = null;
  private state: VoiceState = {
    connected: false,
    ready: false,
    audio: false,
    teaching: false,
    listening: false,
    playing: false,
    pending: false,
    session: null,
    reply: '',
    message: '',
  };
  private sequence = 0;
  private serverSequence = -1;
  private lastSeen = 0;
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private mic: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private sink: GainNode | null = null;
  private framer: PcmFramer | null = null;
  private endpoint: SpeechEndpoint | null = null;
  private silenceWaitMs = 2000;
  private workletLoaded = false;
  private capture: SessionSnapshot['captureGrant'] = null;
  private capturePermission = 0;
  private chunkCount = 0;
  private listenTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private output: Output | null = null;
  private nodes = new Set<AudioBufferSourceNode>();
  private blocked = false;
  private disposed = false;
  private awaitingGrant = false;
  private requestTimer: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly changed: (state: VoiceState) => void) {}
  setSilenceWait(ms: number) {
    if (![1200, 2000, 4000].includes(ms)) throw new Error('Unsupported listening pause');
    this.silenceWaitMs = ms;
  }
  private update(patch: Partial<VoiceState>) {
    this.state = { ...this.state, ...patch };
    this.changed({ ...this.state });
  }
  private send(type: string, payload: unknown = {}, turnId: string | null = null) {
    if (this.ws?.readyState !== WebSocket.OPEN) throw new Error('Backend connection is closed');
    if (this.ws.bufferedAmount > 16384) {
      this.fail('Connection is too slow. Audio stopped; reconnect explicitly.');
      return;
    }
    const s = this.state.session;
    this.ws.send(
      JSON.stringify(
        DeviceEventSchema.parse({
          protocol_version: 1,
          event_id: crypto.randomUUID(),
          session_id: type === 'input.start' ? null : (s?.id ?? null),
          generation: type === 'input.start' ? 0 : (s?.generation ?? 0),
          turn_id: turnId,
          sequence: this.sequence++,
          type,
          payload,
        }),
      ),
    );
  }
  async connect() {
    if (this.ws || this.disposed) return;
    try {
      this.context = new AudioContext();
      await this.context.resume();
      if (this.context.state !== 'running')
        throw new Error('Speaker playback needs a browser interaction');
      this.blocked = false;
      this.sequence = 0;
      this.serverSequence = -1;
      this.update({ message: 'Connecting to the live backend…', reply: '' });
      this.ws = new WebSocket(
        `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/voice-stream`,
      );
      this.ws.onopen = () => {
        this.lastSeen = performance.now();
        this.update({ connected: true, message: 'Checking backend voice and teaching support…' });
        this.send('device.hello', {
          firmwareVersion: 'browser-voice-demo/0.1',
          cameraSupported: false,
          pettingSupported: false,
          audio: { encoding: 'pcm_s16le', sampleRate: 16000, channels: 1, frameMs: 20 },
          playback: {
            encoding: 'pcm_s16le',
            channels: 1,
            sampleRates: [16000, 22050, 24000, 44100, 48000],
          },
        });
        this.heartbeat = setInterval(() => {
          if (performance.now() - this.lastSeen > 6000)
            this.fail('Connection lost. Microphone and speaker stopped. Reconnect explicitly.');
          else if (this.ws?.readyState === WebSocket.OPEN) this.send('heartbeat');
        }, 2000);
      };
      this.ws.onmessage = (event) => {
        try {
          this.receive(String(event.data));
        } catch {
          this.fail('Invalid audio or backend message. Audio stopped.');
        }
      };
      this.ws.onerror = () =>
        this.fail(
          'Could not connect. Check private configuration, pairing and backend deployment.',
        );
      this.ws.onclose = (event) => {
        const reasons: Record<string, string> = {
          'Heartbeat timeout': 'The backend heartbeat timed out.',
          'Control rate limit': 'The backend control rate limit was reached.',
          'Control backpressure': 'The backend connection was too slow.',
          'Device access expired or revoked': 'The device pairing expired or was revoked.',
          'Device access revoked': 'The device pairing was revoked.',
          'Device access ended': 'The device pairing ended.',
        };
        this.fail(
          `${reasons[event.reason] ?? `Connection closed (${event.code}).`} Audio stopped. Reconnect explicitly.`,
        );
      };
    } catch {
      this.fail(
        'Voice connection could not start. Check browser audio support and private connection settings.',
      );
    }
  }
  private receive(raw: string) {
    if (raw.length > 32768) throw new Error('Oversized message');
    const e = ServerEventSchema.parse(JSON.parse(raw));
    if (e.sequence <= this.serverSequence) throw new Error('Stale server sequence');
    this.serverSequence = e.sequence;
    this.lastSeen = performance.now();
    if (e.type === 'device.ready') {
      const audio = e.payload.audio !== false;
      this.update({
        ready: true,
        audio,
        teaching: e.payload.teaching === true,
        message: !audio
          ? 'Backend speech is disabled. Ask Anay to enable STT/TTS.'
          : e.payload.teaching !== true
            ? 'Teach Lemmi is not deployed on this backend yet.'
            : 'Connected. Start a session when ready.',
      });
    } else if (e.type === 'state.changed') {
      const before = this.state.session,
        next = e.payload.session;
      const changed =
        !before ||
        !next ||
        [
          'id',
          'generation',
          'leaseId',
          'profileRevision',
          'privacyRevision',
          'policyRevision',
        ].some(
          (key) => before[key as keyof SessionSnapshot] !== next[key as keyof SessionSnapshot],
        );
      if (changed || !next || ['paused', 'ended'].includes(next.phase)) {
        this.stopCapture();
        this.stopOutput();
        this.update({ reply: '', pending: false });
      }
      this.update({ session: next });
      if (next?.captureGrant && !this.blocked && this.awaitingGrant) {
        if (!this.capture || this.capture.turnId !== next.captureGrant.turnId) {
          this.awaitingGrant = false;
          this.capture = next.captureGrant;
          this.chunkCount = 0;
          this.listenTimer = setTimeout(() => this.done(), 19500);
          void this.openMicrophone(this.capturePermission);
        }
      } else if (!next?.captureGrant && this.capture) this.stopCapture();
      if (next?.phase === 'ended') {
        this.blocked = true;
        this.update({ message: 'Session ended. Microphone and speaker off.' });
      } else if (next?.phase === 'paused')
        this.update({ message: 'Paused. Resume returns to ready; speaking stays off.' });
      else if (before?.teaching && !next?.teaching && next?.phase === 'ready')
        this.update({ message: 'Teaching finished. Microphone and speaker off.' });
    } else if (e.type === 'response.text') {
      if (
        this.current(e.session_id, e.generation) &&
        (!this.blocked || e.payload.source === 'fixed')
      )
        this.update({ reply: e.payload.text, pending: false });
    } else if (e.type === 'response.start') {
      if (!this.current(e.session_id, e.generation) || this.blocked) return;
      this.stopCapture();
      this.stopOutput();
      if (!this.context || this.context.state !== 'running') {
        this.sendReceipt(e.payload, 'failed', 0);
        this.update({ message: 'Speaker unavailable. Press Pause, then Resume before retrying.' });
        return;
      }
      this.output = {
        meta: e.payload,
        received: 0,
        consumed: 0,
        ended: false,
        nextAt: this.context.currentTime + 0.08,
      };
      this.update({ pending: false, message: 'Preparing speaker playback…' });
    } else if (e.type === 'audio.chunk') {
      const out = this.output,
        ctx = this.context;
      if (!out || !ctx || this.blocked || !this.current(e.session_id, e.generation)) return;
      const p = e.payload,
        m = out.meta;
      if (
        p.streamId !== m.streamId ||
        p.leaseId !== m.leaseId ||
        e.turn_id !== m.turnId ||
        p.chunkIndex !== out.received ||
        out.received - out.consumed >= 4
      )
        throw new Error('Out of order output');
      const bytes = Math.min(m.chunkBytes, m.byteLength - p.chunkIndex * m.chunkBytes);
      const samples = decodePcm(p.data, bytes),
        buffer = ctx.createBuffer(1, samples.length, m.sampleRate);
      buffer.copyToChannel(samples, 0);
      samples.fill(0);
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(ctx.destination);
      this.nodes.add(node);
      const at = Math.max(out.nextAt, ctx.currentTime + 0.005);
      out.nextAt = at + buffer.duration;
      out.received++;
      node.onended = () => {
        this.nodes.delete(node);
        node.disconnect();
        buffer.getChannelData(0).fill(0);
        if (this.output !== out || this.blocked) return;
        out.consumed++;
        this.update({ playing: true, message: 'Lemmi is speaking. Microphone off.' });
        if (out.consumed === 1) this.sendReceipt(m, 'started', 0);
        if (out.ended && out.consumed === m.chunkCount) this.completeOutput(out);
        // Two consumed frames per progress receipt keeps this client below the
        // deployed gateway's 30-control/sec budget while maintaining four-frame credit.
        else if (out.consumed % 2 === 0) this.sendReceipt(m, 'progress', out.consumed);
      };
      node.start(at);
    } else if (e.type === 'audio.end') {
      const out = this.output;
      if (
        out &&
        this.current(e.session_id, e.generation) &&
        e.payload.streamId === out.meta.streamId &&
        e.payload.chunkCount === out.meta.chunkCount
      ) {
        out.ended = true;
        if (out.consumed === out.meta.chunkCount) this.completeOutput(out);
      }
    } else if (e.type === 'response.cancel') {
      this.stopOutput();
    } else if (e.type === 'error') {
      this.stopCapture();
      this.stopOutput();
      this.update({
        pending: false,
        message: `${e.payload.code}: ${e.payload.message}. Retry explicitly; no audio was resent.`,
      });
    }
  }
  private current(id: string | null, generation: number) {
    return (
      !!this.state.session &&
      this.state.session.id === id &&
      this.state.session.generation === generation &&
      this.state.session.phase !== 'ended'
    );
  }
  private sendReceipt(m: SpeechOutputStart, status: string, playedChunks: number) {
    this.send(
      'audio.receipt',
      { leaseId: m.leaseId, streamId: m.streamId, status, playedChunks },
      m.turnId,
    );
  }
  private completeOutput(out: Output) {
    this.sendReceipt(out.meta, 'completed', out.consumed);
    this.output = null;
    this.update({ playing: false, message: 'Ready. Choose Speak now for one microphone turn.' });
  }
  private stopOutput() {
    this.output = null;
    for (const node of this.nodes) {
      node.onended = null;
      try {
        node.stop();
      } catch {}
      node.buffer?.getChannelData(0).fill(0);
      node.disconnect();
    }
    this.nodes.clear();
    this.update({ playing: false });
  }
  private stopCapture() {
    this.capturePermission++;
    this.awaitingGrant = false;
    if (this.requestTimer) clearTimeout(this.requestTimer);
    this.requestTimer = null;
    this.capture = null;
    if (this.listenTimer) clearTimeout(this.listenTimer);
    this.listenTimer = null;
    this.mic?.disconnect();
    if (this.mic) this.mic.port.onmessage = null;
    this.mic = null;
    this.source?.disconnect();
    this.source = null;
    this.sink?.disconnect();
    this.sink = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.framer?.clear();
    this.framer = null;
    this.endpoint = null;
    this.update({ listening: false });
  }
  async speak() {
    if (
      !this.context ||
      !this.state.session ||
      this.state.pending ||
      this.output ||
      this.state.listening
    )
      return;
    this.stopCapture();
    const permission = this.capturePermission;
    this.blocked = false;
    this.update({ pending: true, message: 'Preparing an explicit microphone turn…' });
    try {
      await this.context.resume();
      if (!this.workletLoaded) {
        await this.context.audioWorklet.addModule('/voice-capture.js');
        this.workletLoaded = true;
      }
      if (permission !== this.capturePermission || !this.ws) return;
      this.awaitingGrant = true;
      this.send('input.speak', { language: 'en' });
      this.requestTimer = setTimeout(() => {
        if (this.awaitingGrant) {
          this.command('pause');
          this.update({ message: 'Listening permission timed out. Paused; retry explicitly.' });
        }
      }, 5000);
    } catch {
      this.stopCapture();
      this.update({
        pending: false,
        message: 'Microphone support unavailable. Use the text fallback.',
      });
    }
  }
  private async openMicrophone(permission: number) {
    try {
      if (this.requestTimer) clearTimeout(this.requestTimer);
      this.requestTimer = null;
      this.update({
        message: 'Backend listening permission received. Waiting for microphone permission…',
      });
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      if (
        permission !== this.capturePermission ||
        this.disposed ||
        !this.ws ||
        !this.context ||
        !this.capture
      ) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      this.framer = new PcmFramer(this.context.sampleRate);
      this.endpoint = new SpeechEndpoint(this.context.sampleRate, this.silenceWaitMs);
      if (permission !== this.capturePermission || !this.stream) return;
      this.source = this.context.createMediaStreamSource(stream);
      this.mic = new AudioWorkletNode(this.context, 'lemmi-capture');
      this.sink = this.context.createGain();
      this.sink.gain.value = 0;
      this.source.connect(this.mic);
      this.mic.connect(this.sink);
      this.sink.connect(this.context.destination);
      this.mic.port.onmessage = (event: MessageEvent<Float32Array>) => {
        const data = event.data,
          grant = this.capture;
        if (grant && this.framer && !this.blocked) {
          const current = this.state.session;
          if (
            !current ||
            current.phase !== 'listening' ||
            current.micMuted ||
            current.generation !== grant.generation
          ) {
            data.fill(0);
            this.stopCapture();
            return;
          }
          const finished = this.endpoint?.push(data) ?? false;
          for (const bytes of this.framer.push(data)) {
            if (this.chunkCount >= 975) {
              bytes.fill(0);
              this.done();
              break;
            }
            this.send(
              'audio.chunk',
              {
                leaseId: grant.leaseId,
                streamId: grant.streamId,
                chunkIndex: this.chunkCount++,
                encoding: 'pcm_s16le',
                data: pcmBase64(bytes),
              },
              grant.turnId,
            );
            bytes.fill(0);
          }
          if (finished && this.capture) {
            data.fill(0);
            this.done();
            return;
          }
        }
        data.fill(0);
      };
      this.update({
        listening: true,
        pending: false,
        message:
          'Listening — microphone active. A short pause after speech sends your reply; Done speaking sends it immediately.',
      });
    } catch {
      this.stopCapture();
      this.command('pause');
      this.update({
        pending: false,
        message:
          'Microphone unavailable or permission denied. Paused; use the text fallback or retry explicitly.',
      });
    }
  }
  done() {
    const grant = this.capture,
      count = this.chunkCount;
    this.stopCapture();
    if (!grant || !count) {
      this.command('pause');
      this.update({ message: 'No audio captured. Paused; no preference inferred.' });
      return;
    }
    this.send(
      'audio.end',
      { leaseId: grant.leaseId, streamId: grant.streamId, chunkCount: count },
      grant.turnId,
    );
    this.update({ pending: true, message: 'Microphone off. Preparing a reply…' });
  }
  command(type: string) {
    const micOnly = type === 'mute' || type === 'unmute';
    if (type === 'mute' && (this.state.pending || this.state.listening) && !this.output)
      this.blocked = true;
    this.stopCapture();
    if (!micOnly) this.stopOutput();
    if (['stop', 'pause', 'teaching.finish'].includes(type)) this.blocked = true;
    else if (!micOnly) this.blocked = false;
    this.update({ ...(micOnly ? {} : { reply: '' }), pending: false });
    try {
      this.send(
        `input.${type === 'unmute' ? 'mute' : type}`,
        micOnly ? { muted: type === 'mute' } : {},
      );
    } catch {
      this.fail('Control could not reach the backend. Audio stopped locally.');
    }
  }
  text(text: string) {
    if (!text.trim()) return;
    this.update({ pending: true });
    try {
      this.send('input.text', { text, language: 'en' });
    } catch {
      this.fail('Text could not be sent.');
    }
  }
  private fail(message: string) {
    this.blocked = true;
    this.stopCapture();
    this.stopOutput();
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close();
    }
    void this.context?.close().catch(() => {});
    this.context = null;
    this.workletLoaded = false;
    this.update({
      connected: false,
      ready: false,
      audio: false,
      teaching: false,
      pending: false,
      session: null,
      reply: '',
      message,
    });
  }
  close() {
    this.disposed = true;
    this.fail('Voice disconnected. Microphone and speaker off.');
  }
}
