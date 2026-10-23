import { readFileSync } from 'node:fs';
import { validateBriefing } from '../src/schema/briefing';
import type { SpeechAdapter, SpeechRequest, Voice } from '../src/player/speech';
export const sample = () => JSON.parse(readFileSync(new URL('../examples/pr-review.json', import.meta.url), 'utf8'));
export const validSample = () => validateBriefing(sample());
export const localVoice: Voice = { voiceURI: 'local-test', name: 'Local Test', lang: 'en-US', localService: true };
export class MockSpeech implements SpeechAdapter {
  supported = true; requests: SpeechRequest[] = []; cancels = 0; pauses = 0; resumes = 0;
  voices() { return [localVoice]; }
  onVoicesChanged() { return () => {}; }
  speak(request: SpeechRequest) { this.requests.push(request); request.start(); }
  cancel() { this.cancels++; }
  pause() { this.pauses++; }
  resume() { this.resumes++; }
  get last() { return this.requests.at(-1)!; }
}
