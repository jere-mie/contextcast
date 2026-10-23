export interface Voice { voiceURI: string; name: string; lang: string; localService?: boolean }
export interface SpeechRequest {
  text: string; language: string; rate: number; voice: Voice;
  start(): void; end(): void; error(message: string): void;
}
export interface SpeechAdapter {
  supported: boolean; voices(): Voice[]; onVoicesChanged(callback: () => void): () => void;
  speak(request: SpeechRequest): void; cancel(): void; pause(): void; resume(): void;
}
export class BrowserSpeech implements SpeechAdapter {
  private current?: SpeechSynthesisUtterance;
  readonly supported = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined';
  voices() { return this.supported ? window.speechSynthesis.getVoices() : []; }
  onVoicesChanged(callback: () => void) {
    if (!this.supported) return () => {};
    window.speechSynthesis.addEventListener('voiceschanged', callback);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', callback);
  }
  speak(request: SpeechRequest) {
    const u = new SpeechSynthesisUtterance(request.text);
    u.voice = this.voices().find(v => v.voiceURI === request.voice.voiceURI) ?? null;
    if (!u.voice) { request.error('The selected voice disappeared. Choose an available voice.'); return; }
    u.lang = request.language; u.rate = request.rate;
    u.onstart = request.start; u.onend = request.end;
    u.onerror = e => request.error(`Browser narration stopped (${e.error}). You can retry Play or continue reading.`);
    this.current = u;
    // Some engines retain the global paused flag after cancel/seek.
    window.speechSynthesis.resume(); window.speechSynthesis.speak(u);
  }
  cancel() { if (this.supported) window.speechSynthesis.cancel(); this.current = undefined; }
  pause() { if (this.supported) window.speechSynthesis.pause(); }
  resume() { if (this.supported) window.speechSynthesis.resume(); }
}
