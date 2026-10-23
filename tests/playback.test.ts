import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackController, playbackRates } from '../src/player/controller';
import { MockSpeech, validSample, localVoice } from './helpers';
const setup = () => { const speech = new MockSpeech(); let now = 0; const p = new PlaybackController(validSample(), speech, () => now); p.setVoice(localVoice); return { p, speech, setTime: (t: number) => { now = t; } }; };
test('supports every quarter-step rate from 0.25 to 10 and rejects unsupported rates', () => {
  const { p, speech } = setup();
  assert.equal(playbackRates.length, 40);
  p.play();
  for (const rate of playbackRates) {
    p.setRate(rate); assert.equal(p.rate, rate); assert.equal(speech.last.rate, rate);
    assert.equal(p.status, 'playing');
  }
  const count = speech.requests.length;
  for (const rate of [0, -1, 0.1, 10.25, Infinity, NaN]) p.setRate(rate);
  assert.equal(p.rate, 10); assert.equal(speech.requests.length, count);
  p.pause(); p.setRate(0.25); assert.equal(p.status, 'paused');
  assert.equal(speech.requests.length, count); p.play(); assert.equal(speech.last.rate, 0.25);
});
test('never autoplays and repeated play cannot overlap; real end advances once', () => {
  const { p, speech } = setup(); assert.equal(speech.requests.length, 0); p.play(); p.play();
  assert.equal(speech.requests.length, 1); const old = speech.last; old.end(); old.end(); old.error('stale');
  assert.equal(p.index, 1); assert.equal(speech.requests.length, 2); assert.equal(p.status, 'playing');
});
test('ignores stale start, end, and error after seek, chapter, rate, and voice changes', () => {
  const { p, speech } = setup(); p.play();
  const operations = [() => p.seek(9), () => p.chapter(1), () => p.setRate(1.5), () => p.setVoice({ ...localVoice, voiceURI: 'another' })];
  for (const op of operations) {
    const old = speech.last; op(); const i = p.index, count = speech.requests.length;
    old.start(); old.end(); old.error('cancelled'); assert.equal(p.index, i); assert.equal(speech.requests.length, count); assert.equal(p.status, 'playing');
  }
});
test('pause freezes progress; resume retains the same utterance', () => {
  const { p, speech, setTime } = setup(); p.play(); setTime(2000); p.pause(); const position = p.position;
  setTime(7000); assert.equal(p.position, position); assert.equal(speech.pauses, 1);
  p.play(); assert.equal(speech.resumes, 1); assert.equal(speech.requests.length, 1);
  setTime(8000); assert.equal(p.position, position + 1);
});
test('late end while paused cannot advance until explicit resume', () => {
  const { p, speech } = setup(); p.play(); p.pause(); speech.last.end(); assert.equal(p.index, 0);
  assert.equal(p.status, 'paused'); p.play(); assert.equal(p.index, 1); assert.equal(speech.requests.length, 2);
});
test('paused seeking stays paused; rate and voice restart only on Play', () => {
  const { p, speech } = setup(); p.play(); p.pause(); p.seek(10); p.setRate(2); p.setVoice(localVoice);
  assert.equal(p.status, 'paused'); assert.equal(speech.requests.length, 1); p.play();
  assert.equal(speech.last.rate, 2); assert.equal(speech.last.text, p.entries[10].beat.speech);
});
test('complete stops and replay starts at the first beat', () => {
  const { p, speech } = setup(); p.seek(p.entries.length - 1); p.play(); const last = speech.last; last.end(); last.end();
  assert.equal(p.status, 'completed'); assert.equal(p.position, p.duration); const count = speech.requests.length;
  assert.equal(count, 1); p.play(); assert.equal(p.index, 0); assert.equal(speech.requests.length, 2);
});
test('speech errors and missing support preserve navigation and allow retry', () => {
  const { p, speech } = setup(); p.play(); speech.last.error('device unavailable'); assert.equal(p.status, 'error');
  p.seek(8); assert.equal(p.status, 'paused'); p.play(); assert.equal(p.index, 8);
  speech.supported = false; p.pause(); p.play(); assert.equal(p.status, 'error'); assert.match(p.message, /unavailable/);
  p.chapter(1); assert.equal(p.status, 'paused');
});
test('no selected voice cannot speak, including remote-only startup', () => {
  const p = new PlaybackController(validSample(), new MockSpeech()); p.play(); assert.equal(p.status, 'error'); assert.match(p.message, /explicit selection/);
});
test('removing a selected voice cancels current speech and blocks subsequent narration', () => {
  const { p, speech } = setup(); p.play(); const old = speech.last; p.setVoice(undefined); old.end();
  assert.equal(p.index, 0); assert.equal(p.status, 'error'); assert.equal(speech.requests.length, 1);
});
test('fifteen-minute scale does not queue the whole briefing', () => {
  const d = validSample(); d.scenes = [d.scenes[0]]; d.scenes[0].beats = Array.from({ length: 150 }, (_, i) => ({ id: `long-${i}`, speech: 'This is a sufficiently long narration beat to demonstrate sequential playback without queuing every utterance at once for the whole presentation.', sourceIds: [] }));
  const s = new MockSpeech(); const p = new PlaybackController(d, s); p.setVoice(localVoice); p.play();
  assert.ok(p.duration > 900); assert.equal(s.requests.length, 1);
  for (let i = 0; i < 150; i++) s.last.end(); assert.equal(p.status, 'completed'); assert.equal(s.requests.length, 150);
});
