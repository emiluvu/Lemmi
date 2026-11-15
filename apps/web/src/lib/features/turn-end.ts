// Decisions use received audio duration, never wall time or a transcript. A short
// noise burst cannot start a turn; any later voice activity resets the pause.
export class TurnEnd {
  private recent: boolean[] = [];
  private heard = false;
  private quietMs = 0;
  private elapsedMs = 0;
  constructor(readonly silenceMs = 1500) {
    if (!Number.isInteger(silenceMs) || silenceMs < 1000 || silenceMs > 8000)
      throw new Error('End silence must be 1000–8000 ms');
  }
  get heardSpeech() {
    return this.heard;
  }
  push(voice: boolean): 'continue' | 'finished' | 'no_speech' {
    this.elapsedMs += 20;
    this.recent.push(voice);
    if (this.recent.length > 10) this.recent.shift();
    if (!this.heard && this.recent.filter(Boolean).length >= 5) this.heard = true;
    if (this.heard) {
      this.quietMs = voice ? 0 : this.quietMs + 20;
      if (this.quietMs >= this.silenceMs) return 'finished';
    } else if (this.elapsedMs >= 30000) return 'no_speech';
    return 'continue';
  }
}
