// Local amplitude endpointing only: no recognition, preference inference or retention.
// Initial silence never counts as a finished answer. Manual Done and the server's
// capture bound remain available when background noise prevents a reliable endpoint.
export class SpeechEndpoint {
  private elapsed = 0;
  private voiced = 0;
  private quiet = 0;
  private noise = 0.003;
  private heardSpeech = false;
  private finished = false;
  constructor(
    private readonly sampleRate: number,
    private readonly quietMs = 2000,
  ) {
    if (
      !Number.isFinite(sampleRate) ||
      sampleRate < 16000 ||
      sampleRate > 192000 ||
      ![1200, 2000, 4000].includes(quietMs)
    )
      throw new Error('Invalid speech endpoint settings');
  }
  push(samples: Float32Array): boolean {
    if (this.finished || !samples.length) return this.finished;
    const duration = (samples.length / this.sampleRate) * 1000;
    let power = 0;
    for (const sample of samples) power += sample * sample;
    const rms = Math.sqrt(power / samples.length);
    this.elapsed += duration;
    const threshold = Math.max(0.012, Math.min(0.035, this.noise * 3));
    if (rms >= threshold) {
      this.voiced += duration;
      this.quiet = 0;
      // Reject isolated clicks; a short sustained utterance is enough to arm endpointing.
      if (this.voiced >= 160) this.heardSpeech = true;
    } else {
      this.quiet += duration;
      if (!this.heardSpeech && this.quiet > 100) this.voiced = 0;
      if (!this.heardSpeech) this.noise = Math.min(0.012, this.noise * 0.98 + rms * 0.02);
    }
    this.finished = this.heardSpeech && this.elapsed >= 600 && this.quiet >= this.quietMs;
    return this.finished;
  }
}
