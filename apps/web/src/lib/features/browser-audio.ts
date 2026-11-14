import type { ServerEvent, SessionSnapshot, SpeechOutputStart } from '@lemmi/contracts';
import type { ParticipantConnection } from '@lemmi/contracts';

// Transient browser PCM only. Every capture begins with a user gesture and a server grant.
export class BrowserAudio {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private input: MediaStreamAudioSourceNode | null = null;
  private grant: SessionSnapshot['captureGrant'] = null;
  private samples: number[] = [];
  private position = 0;
  private chunks = 0;
  private deadline: ReturnType<typeof setTimeout> | null = null;
  private epoch = 0;
  private output: {
    meta: SpeechOutputStart;
    received: number;
    played: number;
    ended: boolean;
    started: boolean;
    next: number;
    nodes: Set<AudioBufferSourceNode>;
  } | null = null;
  constructor(
    private readonly connection: ParticipantConnection,
    private readonly state: (listening: boolean) => void,
    private readonly error: (message: string) => void,
  ) {}
  async speak() {
    this.cancelInput();
    const epoch = this.epoch;
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
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
      if (!this.connection.send('input.speak', { language: 'en' }))
        throw new Error('Connection unavailable');
      this.deadline = setTimeout(() => {
        this.cancelInput();
        this.connection.send('input.pause');
        this.error('Listening did not start. Try again.');
      }, 5000);
    } catch {
      if (epoch === this.epoch) {
        this.cancelInput();
        this.error('Microphone unavailable. Check browser permission and try again.');
      }
    }
  }
  private begin(grant: NonNullable<SessionSnapshot['captureGrant']>) {
    if (!this.stream || !this.context) return;
    if (this.deadline) clearTimeout(this.deadline);
    this.stream.getAudioTracks().forEach((track) => {
      track.enabled = true;
    });
    this.grant = grant;
    this.chunks = 0;
    this.samples = [];
    this.position = 0;
    this.input = this.context.createMediaStreamSource(this.stream);
    this.processor = this.context.createScriptProcessor(2048, 1, 1);
    this.input.connect(this.processor);
    this.processor.connect(this.context.destination);
    this.processor.onaudioprocess = (event) => {
      if (!this.grant || !this.context) return;
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
        if (this.chunks >= 1000) {
          this.finish();
          return;
        }
      }
      const consumed = Math.floor(this.position);
      this.samples.splice(0, consumed);
      this.position -= consumed;
    };
    this.state(true);
    this.deadline = setTimeout(() => this.finish(), 19500);
  }
  finish() {
    const grant = this.grant;
    const count = this.chunks;
    this.cancelInput();
    if (grant && count)
      this.connection.send(
        'audio.end',
        { leaseId: grant.leaseId, streamId: grant.streamId, chunkCount: count },
        false,
        grant.turnId,
      );
    else if (grant) this.connection.send('input.pause');
  }
  cancelInput() {
    this.epoch++;
    if (this.deadline) clearTimeout(this.deadline);
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
    this.chunks = 0;
    this.state(false);
  }
  cancel() {
    this.cancelInput();
    const output = this.output;
    this.output = null;
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
    }
  }
  receive(event: ServerEvent, deviceId: string) {
    if (event.type === 'state.changed') {
      const session = event.payload.session;
      if (
        !session ||
        session.activeEndpointId !== deviceId ||
        session.phase === 'paused' ||
        session.phase === 'ended'
      ) {
        this.cancel();
        return;
      }
      if (session.captureGrant && !session.micMuted && session.phase === 'listening') {
        if (!this.grant && this.stream) this.begin(session.captureGrant);
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
        session.activeEndpointId !== deviceId
      )
        return;
      this.cancel();
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
        this.error('Enable browser sound with Speak now, then retry.');
        return;
      }
      this.output = {
        meta: event.payload,
        received: 0,
        played: 0,
        ended: false,
        started: false,
        next: this.context.currentTime + 0.03,
        nodes: new Set(),
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
      if (output.nodes.size >= 4) {
        this.receipt('failed', output.played);
        this.cancel();
        this.error('Browser playback fell behind. Try again.');
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
        this.error('Invalid playback data. Try again.');
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
      output.next = playAt + buffer.duration;
      source.onended = () => {
        if (this.output !== output) return;
        output.nodes.delete(source);
        source.disconnect();
        buffer.getChannelData(0).fill(0);
        if (!output.started) {
          output.started = true;
          this.receipt('started', 0);
        }
        output.played++;
        if (output.played % 4 === 0) this.receipt('progress', output.played);
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
