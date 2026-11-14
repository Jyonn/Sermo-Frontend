// PCM capture adapted from Drop. Fractional phase survives render boundaries.
class LiveVoiceProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.step = sampleRate / 16000;
    this.position = 0; this.next = 0; this.previous = 0; this.frames = 0;
    this.chunk = new ArrayBuffer(3200); this.length = 0; this.ended = false;
    this.port.onmessage = ({data}) => { if (data === 'stop') this.stop(); };
  }
  flush() {
    if (!this.length) return;
    const chunk = this.chunk.slice(0, this.length * 2);
    this.port.postMessage(chunk, [chunk]); this.length = 0;
  }
  stop() {
    if (this.ended) return;
    this.ended = true; this.flush(); this.port.postMessage('stopped');
  }
  process(inputs) {
    if (this.ended) return false;
    const channels = inputs[0];
    if (!channels?.length) return true;
    const view = new DataView(this.chunk);
    for (let i = 0; i < channels[0].length; i++) {
      let sample = 0;
      for (const channel of channels) sample += channel[i];
      sample /= channels.length;
      while (this.next <= this.position) {
        const fraction = this.position ? this.next - (this.position - 1) : 1;
        const value = Math.max(-1, Math.min(1, this.previous + (sample - this.previous) * fraction));
        view.setInt16(this.length++ * 2, Math.round(value * (value < 0 ? 32768 : 32767)), true);
        this.next += this.step; this.frames++;
        if (this.length === 1600) this.flush();
        if (this.frames >= 60 * 16000) { this.stop(); return false; }
      }
      this.previous = sample; this.position++;
    }
    return true;
  }
}
registerProcessor('frienden-live-voice', LiveVoiceProcessor);
