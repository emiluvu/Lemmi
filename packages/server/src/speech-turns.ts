import {
  fail,
  ok,
  SpeechStartCommandSchema,
  ConversationTextCommandSchema,
  SpeechInputChunkSchema,
  SpeechInputEndSchema,
  SpeechReceiptSchema,
  SpeechOutputStartSchema,
  SPEECH_CAPTURE_MS,
  SPEECH_FRAME_BYTES,
  SPEECH_OUTPUT_WINDOW,
  SPEECH_EXTENDED_OUTPUT_WINDOW,
  type SpeechOutputWindow,
  type SessionSnapshot,
  type ConversationTextResult,
  type Result,
  type SpeechOutputStart,
  type SpeechOutputChunk,
} from '@lemmi/contracts';
import type { SttAdapter, TtsAdapter, SpeechAudio } from './adapters/types';
import { elapsedEpochClock } from './elapsed-clock';

export interface SpeechAdapters {
  stt: SttAdapter;
  tts: TtsAdapter;
  onTiming?: (timing: SpeechTiming) => void;
}
export interface SpeechTiming {
  stage: 'stt' | 'reply' | 'tts' | 'turn_end_to_playback_receipt';
  durationMs: number;
}
type ReplyResult = Extract<ConversationTextResult, { kind: 'reply' }>;
type Owner = {
  fixedFor?: string;
  teachingFor?: string;
  approvedPrompt?: boolean;
  token: SessionSnapshot;
  turnId: string;
  streamId: string;
  language: 'en' | 'de';
  commandId: string;
  rates: number[];
  outputWindow: SpeechOutputWindow;
  began: number;
  submittedAt?: number;
  deadline: number;
  phase: 'capture' | 'processing' | 'queued' | 'playing';
  controller: AbortController;
  input: Uint8Array | null;
  inputBytes: number;
  nextChunk: number;
  promise?: Promise<Result<ConversationTextResult>>;
  output?: SpeechAudio;
  metadata?: SpeechOutputStart;
  sent: number;
  played: number;
  announced: boolean;
  ended: boolean;
};
// Bound adapters that ignore cancellation and discard their late owned PCM.
function boundedWork<T>(signal: AbortSignal, work: () => Promise<T>, discard?: (value: T) => void) {
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new Error('Canceled'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve()
      .then(() => {
        signal.throwIfAborted();
        return work();
      })
      .then((value) => {
        if (signal.aborted) {
          discard?.(value);
          reject(new Error('Canceled'));
        } else resolve(value);
      }, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
}
// This is a bounded media-work helper owned by SessionCoordinator, not a second session store.
export class SpeechTurns {
  #owner: Owner | null = null;
  #commands = new Set<string>();
  private readonly now: () => number;
  constructor(
    private readonly adapters: SpeechAdapters,
    private readonly snapshot: () => SessionSnapshot | null,
    private readonly transition: (
      phase: SessionSnapshot['phase'],
      grant: SessionSnapshot['captureGrant'],
    ) => void,
    private readonly chat: (raw: unknown, owner: object) => Promise<Result<ConversationTextResult>>,
    now: () => number = Date.now,
    private readonly cancelText: (turnId: string) => void = () => {},
    private readonly retainApprovedTextOnTtsFailure = false,
  ) {
    this.now = now === Date.now ? elapsedEpochClock() : now;
  }
  owns(owner?: object): boolean {
    return !!owner && this.#owner === owner;
  }
  busy(): boolean {
    return this.#owner !== null;
  }
  private timing(stage: SpeechTiming['stage'], began: number) {
    // No identifiers, text, audio, or paths. Observability cannot break controls.
    try {
      this.adapters.onTiming?.({ stage, durationMs: Math.max(0, Math.round(this.now() - began)) });
    } catch {}
  }
  inputPending(): boolean {
    return (
      !!this.#owner &&
      !this.#owner.approvedPrompt &&
      ['capture', 'processing'].includes(this.#owner.phase)
    );
  }
  replyCurrent(turnId: string): boolean {
    const v = this.#owner;
    return !!v && v.turnId === turnId && !!this.outputInfo();
  }
  private current(v: Owner): boolean {
    const s = this.snapshot();
    return (
      this.#owner === v &&
      !v.controller.signal.aborted &&
      !!s &&
      (v.fixedFor ? s.phase === 'paused' : !['paused', 'ended', 'unavailable'].includes(s.phase)) &&
      ['id', 'generation', 'leaseId', 'profileRevision', 'privacyRevision', 'policyRevision'].every(
        (k) => s[k as keyof SessionSnapshot] === v.token[k as keyof SessionSnapshot],
      )
    );
  }
  private matches(
    v: Owner,
    input: {
      sessionId: string;
      expectedGeneration: number;
      turnId: string;
      leaseId: string;
      streamId: string;
    },
  ): boolean {
    return (
      this.current(v) &&
      input.sessionId === v.token.id &&
      input.expectedGeneration === v.token.generation &&
      input.turnId === v.turnId &&
      input.leaseId === v.token.leaseId &&
      input.streamId === v.streamId
    );
  }
  private clear(wait = false, cancelGeneration = true) {
    const v = this.#owner;
    if (!v) return;
    const wasCurrent = this.current(v);
    this.#owner = null;
    v.controller.abort();
    if (cancelGeneration) this.cancelText(v.turnId);
    v.input?.fill(0);
    v.input = null;
    v.output?.pcm.fill(0);
    v.output = undefined;
    if (wait && wasCurrent && !v.fixedFor) this.transition('waiting', null);
  }
  interrupt(inputOnly = false, preserve?: object) {
    if (this.owns(preserve)) return;
    if (
      inputOnly &&
      this.#owner &&
      (this.#owner.approvedPrompt || ['queued', 'playing'].includes(this.#owner.phase))
    )
      return;
    this.clear();
  }
  // Only the coordinator's synchronous concern/refusal route can replace a current input.
  // The pause must cancel the old owner first; this creates fresh output authority afterward.
  replaceForFixedReply(owner: object, pause: () => void): string | null {
    const previous = this.#owner;
    if (
      !previous ||
      previous !== owner ||
      previous.phase !== 'processing' ||
      this.now() >= previous.deadline ||
      !this.current(previous)
    )
      return null;
    pause();
    const token = this.snapshot();
    if (this.#owner || !previous.controller.signal.aborted || token?.phase !== 'paused')
      return null;
    const next: Owner = {
      ...previous,
      fixedFor: previous.turnId,
      token,
      turnId: crypto.randomUUID(),
      streamId: crypto.randomUUID(),
      controller: new AbortController(),
      began: this.now(),
      deadline: previous.deadline,
      input: null,
      inputBytes: 0,
      nextChunk: 0,
      promise: undefined,
    };
    this.#owner = next;
    return next.turnId;
  }
  // A teaching control invalidates the old generation. Only the coordinator may
  // mint this fresh output turn after its validated transition; capture stays off.
  replaceForTeachingReply(
    owner: object,
    transition: () => boolean,
    mode: 'teach_lemmi' | 'open' = 'teach_lemmi',
  ): string | null {
    const previous = this.#owner;
    if (
      !previous ||
      previous !== owner ||
      previous.phase !== 'processing' ||
      this.now() >= previous.deadline ||
      !this.current(previous)
    )
      return null;
    if (!transition()) return null;
    const token = this.snapshot();
    if (
      this.#owner ||
      !previous.controller.signal.aborted ||
      !token ||
      token.phase !== 'ready' ||
      token.conversationMode !== mode ||
      token.id !== previous.token.id ||
      token.generation <= previous.token.generation
    )
      return null;
    const next: Owner = {
      ...previous,
      teachingFor: previous.turnId,
      token,
      turnId: crypto.randomUUID(),
      streamId: crypto.randomUUID(),
      controller: new AbortController(),
      began: this.now(),
      deadline: previous.deadline,
      input: null,
      inputBytes: 0,
      nextChunk: 0,
      promise: undefined,
      output: undefined,
      metadata: undefined,
      sent: 0,
      played: 0,
      announced: false,
      ended: false,
    };
    this.#owner = next;
    return next.turnId;
  }
  reset() {
    this.clear();
    this.#commands.clear();
  }
  sweep(): boolean {
    const v = this.#owner;
    if (!v || v.phase === 'processing') return false;
    if (!this.current(v) || this.now() >= v.deadline) {
      this.clear(true);
      return true;
    }
    return false;
  }
  start(
    raw: unknown,
    rates: number[],
    outputWindow: SpeechOutputWindow = SPEECH_OUTPUT_WINDOW,
  ): Result<SessionSnapshot> {
    const parsed = SpeechStartCommandSchema.safeParse(raw);
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid capture request');
    const input = parsed.data,
      s = this.snapshot(),
      existing = this.#owner;
    if (existing && this.now() >= existing.deadline) this.clear(true);
    if (
      existing?.commandId === input.commandId &&
      existing.language === input.language &&
      input.sessionId === existing.token.id &&
      input.expectedGeneration === existing.token.generation &&
      existing.phase === 'capture' &&
      this.current(existing)
    )
      return ok(s!);
    if (
      !s ||
      s.id !== input.sessionId ||
      s.generation !== input.expectedGeneration ||
      !['ready', 'waiting'].includes(s.phase) ||
      s.micMuted ||
      this.busy()
    )
      return fail('REVISION_CONFLICT', 'Speak requires a current ready, unmuted endpoint');
    if (this.#commands.has(input.commandId))
      return fail('REVISION_CONFLICT', 'Capture request is no longer replayable');
    if (this.#commands.size >= 256)
      return fail('UNAVAILABLE', 'Capture turn capacity reached; start a new session');
    if (!rates.length) return fail('UNAVAILABLE', 'Negotiate playback before capture');
    this.#commands.add(input.commandId);
    const v: Owner = {
      token: s,
      turnId: crypto.randomUUID(),
      streamId: crypto.randomUUID(),
      language: input.language,
      commandId: input.commandId,
      rates: [...rates],
      outputWindow:
        outputWindow === SPEECH_EXTENDED_OUTPUT_WINDOW
          ? SPEECH_EXTENDED_OUTPUT_WINDOW
          : SPEECH_OUTPUT_WINDOW,
      began: this.now(),
      deadline: this.now() + SPEECH_CAPTURE_MS,
      phase: 'capture',
      controller: new AbortController(),
      input: new Uint8Array(640_000),
      inputBytes: 0,
      nextChunk: 0,
      sent: 0,
      played: 0,
      announced: false,
      ended: false,
    };
    this.#owner = v;
    this.transition('listening', {
      turnId: v.turnId,
      streamId: v.streamId,
      language: v.language,
      generation: s.generation,
      leaseId: s.leaseId,
      expiresAt: new Date(v.deadline).toISOString(),
    });
    return ok(this.snapshot()!);
  }
  // Application-owned reviewed output uses the same bounded queue/receipts as replies.
  // It never opens capture, including when the endpoint microphone is unmuted.
  async speakApproved(
    raw: unknown,
    rates: number[],
    text: string,
    outputWindow: SpeechOutputWindow = SPEECH_OUTPUT_WINDOW,
  ): Promise<Result<ConversationTextResult>> {
    const parsed = SpeechStartCommandSchema.safeParse(raw),
      s = this.snapshot();
    if (!parsed.success || !text || text.length > 600)
      return fail('VALIDATION_ERROR', 'Invalid approved prompt request');
    const input = parsed.data;
    if (
      !s ||
      s.id !== input.sessionId ||
      s.generation !== input.expectedGeneration ||
      !['ready', 'waiting'].includes(s.phase) ||
      this.busy()
    )
      return fail('REVISION_CONFLICT', 'Prompt requires a current ready endpoint');
    if (!rates.length) return fail('UNAVAILABLE', 'Negotiate playback before reading a prompt');
    if (this.#commands.has(input.commandId))
      return fail('REVISION_CONFLICT', 'Prompt request already consumed');
    if (this.#commands.size >= 256) return fail('UNAVAILABLE', 'Speech turn capacity reached');
    this.#commands.add(input.commandId);
    const v: Owner = {
      approvedPrompt: true,
      token: s,
      turnId: crypto.randomUUID(),
      streamId: crypto.randomUUID(),
      language: input.language,
      commandId: input.commandId,
      rates: [...rates],
      outputWindow:
        outputWindow === SPEECH_EXTENDED_OUTPUT_WINDOW
          ? SPEECH_EXTENDED_OUTPUT_WINDOW
          : SPEECH_OUTPUT_WINDOW,
      began: this.now(),
      deadline: this.now() + 20_000,
      phase: 'processing',
      controller: new AbortController(),
      input: null,
      inputBytes: 0,
      nextChunk: 0,
      sent: 0,
      played: 0,
      announced: false,
      ended: false,
    };
    this.#owner = v;
    this.transition('processing', null);
    return this.synthesize(v, {
      kind: 'reply',
      reply: {
        turnId: v.turnId,
        text,
        language: v.language,
        source: 'fixed',
      },
      session: this.snapshot()!,
    });
  }
  // Typed openings/repeats use the same output owner, validation and receipts as STT replies.
  async speak(
    raw: unknown,
    rates: number[],
    outputWindow: SpeechOutputWindow = SPEECH_OUTPUT_WINDOW,
  ): Promise<Result<ConversationTextResult>> {
    const parsed = ConversationTextCommandSchema.safeParse(raw),
      s = this.snapshot();
    if (
      !parsed.success ||
      !s ||
      parsed.data.sessionId !== s.id ||
      parsed.data.expectedGeneration !== s.generation ||
      !['ready', 'waiting'].includes(s.phase) ||
      this.busy() ||
      !rates.length
    )
      return fail('REVISION_CONFLICT', 'Use a current ready endpoint for speech');
    const input = parsed.data;
    if (this.#commands.has(input.commandId) || this.#commands.size >= 256)
      return fail('REVISION_CONFLICT', 'Speech command is stale or at capacity');
    this.#commands.add(input.commandId);
    const v: Owner = {
      token: s,
      commandId: input.commandId,
      turnId: input.commandId,
      streamId: crypto.randomUUID(),
      language: input.language,
      rates: [...rates],
      outputWindow:
        outputWindow === SPEECH_EXTENDED_OUTPUT_WINDOW
          ? SPEECH_EXTENDED_OUTPUT_WINDOW
          : SPEECH_OUTPUT_WINDOW,
      began: this.now(),
      deadline: this.now() + 60000,
      phase: 'processing',
      controller: new AbortController(),
      input: null,
      inputBytes: 0,
      nextChunk: 0,
      sent: 0,
      played: 0,
      announced: false,
      ended: false,
    };
    this.#owner = v;
    try {
      const response = await this.chat(input, v);
      if (!response.ok || response.data.kind !== 'reply') {
        if (this.#owner === v) this.clear(true);
        return response;
      }
      if (!this.current(v)) return fail('REVISION_CONFLICT', 'Speech turn canceled');
      return await this.synthesize(v, response.data);
    } finally {
      if (this.#owner === v && v.phase === 'processing') this.clear(true);
    }
  }
  chunk(raw: unknown): Result<{ acceptedChunks: number }> {
    const parsed = SpeechInputChunkSchema.safeParse(raw),
      v = this.#owner;
    if (!parsed.success) {
      if (v?.phase === 'capture') this.clear(true);
      return fail('VALIDATION_ERROR', 'Invalid PCM frame');
    }
    const input = parsed.data;
    if (!v || v.phase !== 'capture' || !this.matches(v, input))
      return fail('REVISION_CONFLICT', 'No matching current capture grant');
    if (
      this.now() >= v.deadline ||
      input.chunkIndex !== v.nextChunk ||
      v.inputBytes + SPEECH_FRAME_BYTES > 640_000 ||
      v.nextChunk >= Math.floor((this.now() - v.began) / 20) + 50
    ) {
      this.clear(true);
      return fail('VALIDATION_ERROR', 'Capture expired, overflowed or lost frame order');
    }
    const bytes = Buffer.from(input.data, 'base64');
    try {
      if (bytes.length !== SPEECH_FRAME_BYTES || bytes.toString('base64') !== input.data) {
        this.clear(true);
        return fail('VALIDATION_ERROR', 'Expected canonical 640-byte PCM');
      }
      v.input!.set(bytes, v.inputBytes);
      v.inputBytes += bytes.length;
      v.nextChunk++;
      return ok({ acceptedChunks: v.nextChunk });
    } finally {
      bytes.fill(0);
    }
  }
  async end(raw: unknown): Promise<Result<ConversationTextResult>> {
    const parsed = SpeechInputEndSchema.safeParse(raw),
      v = this.#owner;
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid capture end');
    if (!v || !this.matches(v, parsed.data))
      return fail('REVISION_CONFLICT', 'No matching current capture grant');
    if (v.phase === 'processing' && v.promise && parsed.data.chunkCount === v.nextChunk)
      return v.promise;
    if (v.phase !== 'capture') return fail('REVISION_CONFLICT', 'Capture already finished');
    if (this.now() >= v.deadline || parsed.data.chunkCount !== v.nextChunk || !v.inputBytes) {
      this.clear(true);
      return fail('VALIDATION_ERROR', 'Empty, incomplete or expired capture');
    }
    v.phase = 'processing';
    v.submittedAt = this.now();
    v.deadline = this.now() + 20_000;
    this.transition('processing', null);
    v.promise = this.run(v);
    return v.promise;
  }
  private async run(v: Owner): Promise<Result<ConversationTextResult>> {
    const signal = AbortSignal.any([v.controller.signal, AbortSignal.timeout(20_000)]);
    const cancelChat = () => this.cancelText(v.turnId);
    signal.addEventListener('abort', cancelChat, { once: true });
    try {
      const pcm = v.input!.subarray(0, v.inputBytes);
      const sttBegan = this.now();
      let transcript;
      try {
        transcript = await boundedWork(signal, () =>
          this.adapters.stt.transcribe({ pcm, language: v.language }, signal),
        );
      } finally {
        v.input?.fill(0);
        v.input = null;
      }
      if (!this.current(v) || signal.aborted)
        return fail('REVISION_CONFLICT', 'Speech turn canceled');
      this.timing('stt', sttBegan);
      if (
        !transcript.ok ||
        transcript.data.language !== v.language ||
        !transcript.data.text.trim() ||
        transcript.data.text.length > 1000
      ) {
        this.clear(true);
        return fail('UNAVAILABLE', 'Speech was not recognized; retry explicitly');
      }
      this.transition('waiting', null);
      const replyBegan = this.now();
      const response = await this.chat(
        {
          sessionId: v.token.id,
          expectedGeneration: v.token.generation,
          commandId: v.turnId,
          text: transcript.data.text,
          language: v.language,
        },
        v,
      );
      if (!response.ok || response.data.kind !== 'reply') {
        if (this.#owner === v) this.clear(true);
        return response;
      }
      if (!this.current(v)) {
        const fixed = this.#owner;
        if (
          (fixed?.fixedFor === v.turnId || fixed?.teachingFor === v.turnId) &&
          response.data.reply.source === 'fixed' &&
          response.data.reply.turnId === fixed.turnId &&
          response.data.session.generation === fixed.token.generation &&
          this.current(fixed)
        ) {
          this.timing('reply', replyBegan);
          return await this.synthesize(fixed, response.data);
        }
        return fail('REVISION_CONFLICT', 'Speech turn canceled');
      }
      this.timing('reply', replyBegan);
      return await this.synthesize(v, response.data, signal);
    } catch {
      const current = this.current(v);
      if (this.#owner === v) this.clear(true);
      return fail(
        current ? 'UNAVAILABLE' : 'REVISION_CONFLICT',
        'Speech turn canceled or unavailable',
      );
    } finally {
      signal.removeEventListener('abort', cancelChat);
      v.input?.fill(0);
      v.input = null;
      if (this.#owner === v && v.phase === 'processing') this.clear(true);
    }
  }
  private async synthesize(
    v: Owner,
    response: ReplyResult,
    parentSignal?: AbortSignal,
  ): Promise<Result<ConversationTextResult>> {
    const signal = AbortSignal.any([
      v.controller.signal,
      parentSignal ?? AbortSignal.timeout(Math.max(0, Math.ceil(v.deadline - this.now()))),
    ]);
    try {
      if (!this.current(v)) return fail('REVISION_CONFLICT', 'Speech turn canceled');
      if (!v.fixedFor) this.transition('processing', null);
      const reply = response.reply;
      const ttsBegan = this.now();
      const spoken = await boundedWork(
        signal,
        () =>
          this.adapters.tts.synthesize(
            {
              text: reply.text,
              language: reply.language,
            },
            signal,
          ),
        (late) => {
          if (late.ok) late.data.pcm.fill(0);
        },
      );
      if (!this.current(v) || signal.aborted) {
        if (spoken.ok) spoken.data.pcm.fill(0);
        return fail('REVISION_CONFLICT', 'Speech turn canceled');
      }
      if (!spoken.ok) {
        this.clear(true, !this.retainApprovedTextOnTtsFailure);
        return fail('UNAVAILABLE', 'Speech synthesis unavailable');
      }
      this.timing('tts', ttsBegan);
      const audio = spoken.data;
      v.output = audio;
      const chunkBytes = Math.floor(audio.sampleRate / 50) * 2;
      const metadata = SpeechOutputStartSchema.safeParse({
        turnId: v.turnId,
        leaseId: v.token.leaseId,
        streamId: crypto.randomUUID(),
        encoding: audio.encoding,
        channels: audio.channels,
        sampleRate: audio.sampleRate,
        chunkBytes,
        chunkCount: Math.ceil(audio.pcm.length / chunkBytes),
        byteLength: audio.pcm.length,
      });
      if (
        !metadata.success ||
        !(audio.pcm instanceof Uint8Array) ||
        audio.pcm.length % 2 ||
        !v.rates.includes(audio.sampleRate) ||
        audio.language !== v.language ||
        audio.pcm.length > audio.sampleRate * 2 * 30
      ) {
        this.clear(true);
        return fail('UNAVAILABLE', 'Unsupported or oversized playback format');
      }
      v.metadata = metadata.data;
      v.phase = 'queued';
      v.deadline = this.now() + 5000;
      return ok({ ...response, session: this.snapshot()! });
    } catch {
      const current = this.current(v);
      if (this.#owner === v) this.clear(true);
      return fail(
        current ? 'UNAVAILABLE' : 'REVISION_CONFLICT',
        'Speech turn canceled or unavailable',
      );
    } finally {
      if (this.#owner === v && v.phase === 'processing') this.clear(true);
    }
  }
  outputInfo(): SpeechOutputStart | null {
    const v = this.#owner;
    return v &&
      ['queued', 'playing'].includes(v.phase) &&
      this.now() < v.deadline &&
      this.current(v) &&
      v.metadata
      ? { ...v.metadata }
      : null;
  }
  drain(): {
    metadata: SpeechOutputStart;
    start: boolean;
    chunks: SpeechOutputChunk[];
    end: boolean;
  } | null {
    const v = this.#owner,
      metadata = this.outputInfo();
    if (!v || !metadata || !v.output) return null;
    const start = !v.announced;
    v.announced = true;
    const chunks: SpeechOutputChunk[] = [];
    while (v.sent < metadata.chunkCount && v.sent < v.played + v.outputWindow) {
      const chunkIndex = v.sent++;
      const bytes = v.output.pcm.subarray(
        chunkIndex * metadata.chunkBytes,
        Math.min((chunkIndex + 1) * metadata.chunkBytes, metadata.byteLength),
      );
      chunks.push({
        leaseId: metadata.leaseId,
        streamId: metadata.streamId,
        chunkIndex,
        encoding: 'pcm_s16le',
        data: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64'),
      });
    }
    const end = !v.ended && v.sent === metadata.chunkCount;
    if (end) v.ended = true;
    return { metadata, start, chunks, end };
  }
  receipt(raw: unknown): Result<SessionSnapshot> {
    const parsed = SpeechReceiptSchema.safeParse(raw),
      v = this.#owner;
    if (!parsed.success) return fail('VALIDATION_ERROR', 'Invalid playback receipt');
    const input = parsed.data,
      metadata = this.outputInfo();
    if (
      !v ||
      !metadata ||
      !this.matches(v, { ...input, streamId: v.streamId }) ||
      input.streamId !== metadata.streamId ||
      !v.announced ||
      input.playedChunks < v.played ||
      input.playedChunks > v.sent
    )
      return fail('REVISION_CONFLICT', 'Receipt does not match current delivered output');
    if (input.status === 'failed') {
      this.clear(true);
      return ok(this.snapshot()!);
    }
    if (input.status === 'started') {
      if (v.phase !== 'queued' || input.playedChunks !== 0)
        return fail('REVISION_CONFLICT', 'Invalid playback start');
      v.phase = 'playing';
      if (v.submittedAt !== undefined) this.timing('turn_end_to_playback_receipt', v.submittedAt);
      v.deadline = this.now() + (metadata.byteLength / (metadata.sampleRate * 2)) * 1000 + 5000;
      if (!v.fixedFor) this.transition('speaking', null);
    } else {
      if (v.phase !== 'playing') return fail('REVISION_CONFLICT', 'Playback has not started');
      if (input.status === 'completed') {
        if (!v.ended || input.playedChunks !== metadata.chunkCount)
          return fail('REVISION_CONFLICT', 'Completion precedes delivered playback');
        this.clear(true, false);
        return ok(this.snapshot()!);
      }
      v.played = input.playedChunks;
    }
    return ok(this.snapshot()!);
  }
}
