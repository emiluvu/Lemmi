import type { DeviceEvent, ErrorCode } from '@lemmi/contracts';

export type TransportCloseReason =
  | 'Device access ended'
  | 'Persistent checkpoint capacity'
  | 'Persistent data unavailable'
  | 'Control backpressure'
  | 'Device access revoked'
  | 'Device access expired or revoked'
  | 'Control rate limit'
  | 'Capture rate limit'
  | 'Invalid capture frame'
  | 'Hello required'
  | 'Endpoint assignment mismatch'
  | 'Heartbeat timeout';

export type TransportDiagnostic = {
  event: 'open' | 'sample' | 'capture_granted' | 'capture_end' | 'close';
  connectionId: string;
  receivedMessages: number;
  receivedBytes: number;
  captureNumber: number;
  acceptedCaptureFrames: number;
  rejectedEvents: number;
  lastErrorCode: ErrorCode | null;
  lastEventType: DeviceEvent['type'] | null;
  maxCaptureGapMs: number;
  lastCaptureAgeMs: number | null;
  maxHandlerMs: number;
  sampleGapMs: number;
  closeCode: number | null;
  localCloseReason: TransportCloseReason | null;
};

// One constant-size accumulator for an explicitly selected endpoint. Never accept
// payloads, headers, peer close text, profile data or media here. The observer is
// optional and cannot interrupt control handling, even if its sink throws.
export class TransportDiagnostics {
  private receivedMessages = 0;
  private receivedBytes = 0;
  private captureNumber = 0;
  private acceptedCaptureFrames = 0;
  private rejectedEvents = 0;
  private lastErrorCode: ErrorCode | null = null;
  private lastEventType: DeviceEvent['type'] | null = null;
  private maxCaptureGapMs = 0;
  private lastCaptureAt: number | null = null;
  private maxHandlerMs = 0;
  private lastSampleAt: number;
  private captureStream: string | null = null;
  localCloseReason: TransportCloseReason | null = null;

  constructor(
    private connectionId: string,
    private sink: (observation: TransportDiagnostic) => void,
    private now: () => number = () => performance.now(),
  ) {
    this.lastSampleAt = now();
  }

  received(bytes: number) {
    this.receivedMessages++;
    this.receivedBytes += bytes;
  }

  handled(began: number) {
    this.maxHandlerMs = Math.max(this.maxHandlerMs, this.now() - began);
  }

  validated(type: DeviceEvent['type']) {
    this.lastEventType = type;
  }

  rejected(code: ErrorCode) {
    this.rejectedEvents++;
    this.lastErrorCode = code;
  }

  granted(streamId: string) {
    if (this.captureStream === streamId) return;
    this.captureStream = streamId;
    this.captureNumber++;
    this.acceptedCaptureFrames = 0;
    this.maxCaptureGapMs = 0;
    this.lastCaptureAt = null;
    this.report('capture_granted');
  }

  acceptedFrame() {
    const at = this.now();
    if (this.lastCaptureAt !== null)
      this.maxCaptureGapMs = Math.max(this.maxCaptureGapMs, at - this.lastCaptureAt);
    this.lastCaptureAt = at;
    this.acceptedCaptureFrames++;
  }

  report(event: TransportDiagnostic['event'], closeCode: number | null = null) {
    const at = this.now();
    const sampleGapMs = at - this.lastSampleAt;
    if (event === 'sample') {
      if (sampleGapMs < 1000) return;
      this.lastSampleAt = at;
    }
    try {
      this.sink({
        event,
        connectionId: this.connectionId,
        receivedMessages: this.receivedMessages,
        receivedBytes: this.receivedBytes,
        captureNumber: this.captureNumber,
        acceptedCaptureFrames: this.acceptedCaptureFrames,
        rejectedEvents: this.rejectedEvents,
        lastErrorCode: this.lastErrorCode,
        lastEventType: this.lastEventType,
        maxCaptureGapMs: this.maxCaptureGapMs,
        lastCaptureAgeMs: this.lastCaptureAt === null ? null : at - this.lastCaptureAt,
        maxHandlerMs: this.maxHandlerMs,
        sampleGapMs,
        closeCode,
        localCloseReason: this.localCloseReason,
      });
    } catch {
      // Diagnostic failure must never bypass Stop/mute or change media handling.
    }
  }
}
