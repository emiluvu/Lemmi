// No buffer, file, network, playback or transcription in the capture worklet.
class LemmiCapture extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      const frame = new Float32Array(channel);
      this.port.postMessage(frame, [frame.buffer]);
    }
    return true;
  }
}
registerProcessor('lemmi-capture', LemmiCapture);
