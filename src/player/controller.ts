import type { Briefing } from '../schema/briefing';
import type { SpeechAdapter, Voice } from './speech';
import { timeline, totalDuration, skipTarget, nearest } from './timeline';
import { playbackRates } from './rates';
export { playbackRates } from './rates';
export type Status = 'idle' | 'playing' | 'paused' | 'completed' | 'error';
export class PlaybackController {
  index = 0; rate = 1; status: Status = 'idle'; message = ''; voice?: Voice;
  entries; private generation = 0; private active = false; private deferredEnd = false;
  private startedAt = 0; private offset = 0; private clockRunning = false;
  onChange = () => {};
  constructor(readonly data: Briefing, readonly speech: SpeechAdapter, private now = () => performance.now()) { this.entries = timeline(data); }
  get entry() { return this.entries[this.index]; }
  get duration() { return totalDuration(this.entries); }
  get position() {
    if (this.status === 'completed') return this.duration;
    return this.entry.start + Math.min(this.entry.duration, this.offset + (this.clockRunning ? (this.now() - this.startedAt) / 1000 : 0));
  }
  private invalidate() {
    this.generation++; this.active = false; this.deferredEnd = false; this.clockRunning = false;
    this.speech.cancel();
  }
  private fail(message: string) { this.invalidate(); this.status = 'error'; this.message = message; this.onChange(); }
  play() {
    if (this.status === 'playing') return;
    if (!this.speech.supported) { this.fail('Narration is unavailable in this browser. Explore chapters and read the transcript.'); return; }
    if (!this.voice) { this.fail('Choose a voice to listen. Local voices are preferred; remote voices require your explicit selection.'); return; }
    if (this.status === 'completed') { this.index = 0; this.offset = 0; }
    this.message = '';
    if (this.status === 'paused' && this.deferredEnd) { this.deferredEnd = false; this.status = 'playing'; this.advance(); return; }
    if (this.status === 'paused' && this.active) {
      this.status = 'playing'; this.startedAt = this.now(); this.clockRunning = true;
      this.speech.resume(); this.onChange(); return;
    }
    this.status = 'playing'; this.speak();
  }
  pause() {
    if (this.status !== 'playing') return;
    this.offset = this.position - this.entry.start; this.clockRunning = false;
    this.status = 'paused'; this.speech.pause(); this.onChange();
  }
  toggle() { this.status === 'playing' ? this.pause() : this.play(); }
  private advance() {
    this.active = false;
    if (this.index === this.entries.length - 1) { this.invalidate(); this.status = 'completed'; this.onChange(); return; }
    this.index++; this.offset = 0; this.speak();
  }
  private speak() {
    this.invalidate(); this.offset = 0;
    const token = this.generation; this.active = true;
    const valid = () => token === this.generation;
    try {
      this.speech.speak({ text: this.entry.beat.speech, language: this.data.language, rate: this.rate, voice: this.voice!,
        start: () => { if (!valid()) return; this.startedAt = this.now(); this.clockRunning = this.status === 'playing'; this.onChange(); },
        end: () => { if (!valid()) return; this.generation++; this.clockRunning = false; this.active = false;
          if (this.status === 'paused') { this.deferredEnd = true; return; }
          if (this.status === 'playing') this.advance(); },
        error: message => { if (valid()) this.fail(message); },
      });
    } catch (error) { if (valid()) this.fail(`Narration failed: ${String(error)}. The transcript remains available.`); }
    this.onChange();
  }
  seek(index: number) {
    const playing = this.status === 'playing'; this.invalidate();
    this.index = Math.max(0, Math.min(this.entries.length - 1, index)); this.offset = 0;
    this.status = playing ? 'playing' : 'paused'; this.message = '';
    if (playing) this.speak(); else this.onChange();
  }
  seekTime(seconds: number) { this.seek(nearest(this.entries, seconds)); }
  skip(direction: -1 | 1, seconds = 5) { this.seek(skipTarget(this.entries, this.index, this.position, direction, seconds)); }
  chapter(direction: -1 | 1) {
    const scene = Math.max(0, Math.min(this.data.scenes.length - 1, this.entry.sceneIndex + direction));
    this.seek(this.entries.findIndex(e => e.sceneIndex === scene));
  }
  setRate(rate: number) {
    if (!playbackRates.includes(rate) || rate === this.rate) return;
    this.rate = rate; this.entries = timeline(this.data, rate);
    if (this.status === 'idle') { this.onChange(); return; }
    this.seek(this.index);
  }
  setVoice(voice?: Voice) {
    this.voice = voice;
    if (this.status === 'idle') { this.onChange(); return; }
    if (!voice && this.status === 'playing') { this.fail('The selected voice is unavailable. Choose a voice or continue reading.'); return; }
    this.seek(this.index);
  }
  dispose() { this.invalidate(); this.status = 'paused'; }
}
