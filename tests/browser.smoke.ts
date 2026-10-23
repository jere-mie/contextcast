import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Browser, type Page } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { compile } from '../scripts/build-briefing';
import { sample } from './helpers';
let browser: Browser;
let temp: string;
before(async () => { browser = await chromium.launch({ channel: process.env.CONTEXTCAST_BROWSER ?? 'chrome', headless: true }); temp = await mkdtemp(join(tmpdir(), 'contextcast-browser-')); });
after(async () => { await browser?.close(); if (temp) await rm(temp, { recursive: true, force: true }); });
const file = (name = 'example-pr-review.html') => pathToFileURL(resolve('dist', name)).href;
async function mockedPage(options: { remote?: boolean; missing?: boolean; storageFailure?: boolean; delayed?: boolean } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  // A raw script avoids TypeScript/esbuild helper references in Playwright's serialized function.
  await context.addInitScript({ content: `(() => {
    const { remote, missing, storageFailure, delayed } = ${JSON.stringify(options)};
    const w = window;
    if (storageFailure) { Storage.prototype.getItem = () => { throw new Error('denied'); }; Storage.prototype.setItem = () => { throw new Error('denied'); }; }
    if (missing) { Object.defineProperty(window, 'speechSynthesis', { value: undefined }); return; }
    const voices = [{ voiceURI: 'test', name: 'Test Voice', lang: 'en-US', localService: !remote }];
    const events = new EventTarget();
    w.mockSpeech = { requests: [], current: null, cancels: 0, pauses: 0, resumes: 0, ready: !delayed };
    w.mockSpeech.finish = () => w.mockSpeech.current?.onend?.();
    w.mockSpeech.voicesReady = () => { w.mockSpeech.ready = true; events.dispatchEvent(new Event('voiceschanged')); };
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class {
      rate = 1; lang = '';
      constructor(text) { this.text = text; }
    } });
    Object.defineProperty(window, 'speechSynthesis', { value: {
      getVoices: () => w.mockSpeech.ready ? voices : [],
      addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
      speak: (u) => { w.mockSpeech.requests.push(u); w.mockSpeech.current = u; u.onstart?.(); },
      cancel: () => { w.mockSpeech.cancels++; w.mockSpeech.current = null; },
      pause: () => { w.mockSpeech.pauses++; }, resume: () => { w.mockSpeech.resumes++; },
    } });
  })();` });
  return { context, page: await context.newPage() };
}
test('real browser opens file offline, every scene renders, flowchart and sequence render', async () => {
  const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 900 } });
  const page = await context.newPage(); const errors: string[] = [], requests: string[] = [];
  page.on('pageerror', e => errors.push(e.message)); page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.goto(file()); await page.locator('.idea').first().waitFor();
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: `test-results/pr-review-${process.env.CONTEXTCAST_BROWSER ?? 'chrome'}.png`, fullPage: true, animations: 'disabled' });
  assert.equal(await page.locator('.chapter').count(), 8); assert.equal(await page.locator('.transcript-beat').count(), 48);
  for (let i = 0; i < 8; i++) {
    await page.locator('.chapter').nth(i).click();
    assert.equal(await page.locator('.chapter[aria-current=step]').count(), 1);
    if (i === 2) await page.locator('.diagram-host svg').waitFor();
    assert.equal(await page.locator('#stage-content .scene').count(), 1);
  }
  await page.locator('#sources-toggle').click(); await page.locator('#sources-dialog[open]').waitFor(); assert.equal(await page.locator('.source-excerpt').count(), 4);
  await page.locator('#sources-close').click();
  await page.setViewportSize({ width: 1280, height: 720 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight), false);
  const controls = await page.locator('.transport').boundingBox(); assert.ok(controls && controls.y + controls.height <= 720);
  await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.goto(file('example-architecture.html')); await page.locator('.chapter').nth(1).click(); await page.locator('.diagram-host svg').waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(requests, []);
  console.log('Native speech support:', await page.evaluate(() => ({ supported: !!window.speechSynthesis, voices: window.speechSynthesis?.getVoices().length, userAgent: navigator.userAgent })));
  await context.close();
});
test('native local-voice attempt completes or exposes a recoverable browser error', async () => {
  const d = sample(); d.scenes = [d.scenes[0]]; d.scenes[0].beats = [{ id: 'native-one', speech: 'This is a ContextCast voice check.', sourceIds: [] }];
  const path = join(temp, 'native-speech.html'); await writeFile(path, await compile(d));
  const context = await browser.newContext(); const page = await context.newPage(); await page.goto(pathToFileURL(path).href);
  await page.waitForFunction(() => !document.querySelector<HTMLButtonElement>('#play')!.disabled);
  await page.locator('#play').click();
  await page.waitForFunction(() => document.querySelector('#playback-status')?.textContent === 'Briefing complete' || !document.querySelector<HTMLElement>('#message')?.hidden, undefined, { timeout: 25000 });
  const status = await page.locator('#playback-status').textContent(); const message = await page.locator('#message').textContent();
  console.log('Native local-voice playback result:', { status, message });
  if (status !== 'Briefing complete') { assert.match(message ?? '', /Browser narration stopped|Narration failed/); await page.locator('.transcript-beat').click(); assert.equal(await page.locator('.scene').count(), 1); }
  await context.close();
});
test('mock speech: async voices, no autoplay, pause/seek/rate/stale events, completion and replay', async () => {
  const { page, context } = await mockedPage({ delayed: true, storageFailure: true }); await page.goto(file());
  assert.equal(await page.evaluate(() => (window as any).mockSpeech.requests.length), 0);
  await page.evaluate(() => (window as any).mockSpeech.voicesReady());
  await page.locator('#play').click(); assert.equal(await page.locator('#play').textContent(), 'Pause');
  await page.evaluate(() => { (window as any).oldUtterance = (window as any).mockSpeech.current; });
  await page.locator('.chapter').nth(5).click();
  await page.evaluate(() => { (window as any).oldUtterance.onend?.(); (window as any).oldUtterance.onerror?.({ error: 'canceled' }); });
  assert.equal(await page.locator('.chapter[aria-current=step] .chapter-name').textContent(), 'The risk worth resolving');
  await page.locator('#play').click(); await page.locator('#back').click(); assert.equal(await page.locator('#play').textContent(), 'Play');
  await page.locator('#speed').selectOption('1.5'); await page.locator('#play').click(); assert.equal(await page.evaluate(() => (window as any).mockSpeech.current.rate), 1.5);
  await page.locator('.transcript-beat').last().click(); await page.evaluate(() => (window as any).mockSpeech.finish());
  assert.equal(await page.locator('#play').textContent(), 'Replay'); await page.locator('#play').click();
  assert.equal(await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'), 'overview-1');
  await page.locator('#play').click(); await page.locator('#play').blur(); await page.keyboard.press('k'); assert.equal(await page.locator('#play').textContent(), 'Pause');
  await page.keyboard.press('t'); assert.equal(await page.locator('#transcript-panel').isVisible(), false);
  await context.close();
});
test('remote-only voices require affirmative selection; no automatic consent on reopening', async () => {
  const { page, context } = await mockedPage({ remote: true }); await page.goto(file());
  assert.equal(await page.locator('#voice').inputValue(), ''); assert.equal(await page.locator('#play').isDisabled(), true); assert.equal(await page.evaluate(() => (window as any).mockSpeech.requests.length), 0);
  await page.locator('#settings-toggle').click(); page.once('dialog', d => d.dismiss()); await page.locator('#voice').selectOption('test'); assert.equal(await page.locator('#voice').inputValue(), '');
  page.once('dialog', d => d.accept()); await page.locator('#voice').selectOption('test'); await page.locator('#settings-close').click(); await page.locator('#play').click();
  assert.equal(await page.evaluate(() => (window as any).mockSpeech.requests.length), 1);
  await page.reload(); await page.locator('.scene').waitFor(); assert.equal(await page.locator('#voice').inputValue(), ''); await context.close();
});
test('missing speech leaves all chapters and transcript operable', async () => {
  const { page, context } = await mockedPage({ missing: true }); await page.goto(file()); await page.locator('.chapter').nth(4).click();
  assert.equal(await page.locator('#play').isDisabled(), true); assert.match(await page.locator('#voice-note').textContent() ?? '', /unavailable/);
  assert.equal(await page.locator('.code-line').count(), 12); await page.locator('.transcript-beat').first().click();
  assert.equal(await page.locator('.layout-title').count(), 1); await context.close();
});
test('malicious text stays inert, Mermaid errors fall back, reveals reconstruct after backward seek', async () => {
  const d = sample(); const payload = '</script><img src="https://example.com/x" onerror="window.pwned=1">';
  d.title = payload; d.scenes[4].visual.code = payload;
  d.scenes[0].visual.items[0].title = payload;
  d.scenes[0].beats[1].cue = { type: 'reveal', target: 'intent-card' };
  d.scenes[2].visual.definition = 'flowchart LR\n this is not valid [ [';
  const path = join(temp, 'hostile.html'); await writeFile(path, await compile(d));
  const { page, context } = await mockedPage(); await page.goto(pathToFileURL(path).href);
  assert.equal(await page.locator('[data-target=intent-card]').isVisible(), false);
  await page.locator('.transcript-beat').nth(1).click(); assert.equal(await page.locator('[data-target=intent-card]').isVisible(), true);
  await page.locator('.transcript-beat').first().click(); assert.equal(await page.locator('[data-target=intent-card]').isVisible(), false);
  await page.locator('.chapter').nth(4).click(); assert.equal(await page.locator('code').textContent(), payload);
  await page.locator('.chapter').nth(2).click(); await page.locator('.diagram-error').waitFor();
  assert.equal(await page.evaluate(() => (window as any).pwned), undefined); assert.equal(await page.locator('img').count(), 0);
  await context.close();
});
test('YouTube-style shortcuts work after clicking controls, preserve pause, clamp speed, and respect native inputs', async () => {
  const { page, context } = await mockedPage(); await page.goto(file());
  await page.locator('#play').click();
  await page.keyboard.press('k'); assert.equal(await page.locator('#play').textContent(), 'Play');
  await page.keyboard.press('Shift+Period'); assert.equal(await page.locator('#speed').inputValue(), '1.25');
  assert.equal(await page.locator('#play').textContent(), 'Play');
  assert.equal(await page.evaluate(() => (window as any).mockSpeech.requests.length), 1);
  await page.keyboard.press('k'); assert.equal(await page.evaluate(() => (window as any).mockSpeech.current.rate), 1.25);
  await page.keyboard.press('Shift+Period'); await page.keyboard.press('Shift+Period');
  assert.equal(await page.evaluate(() => (window as any).mockSpeech.current.rate), 1.75);
  await page.keyboard.press('Shift+Period');
  assert.equal(await page.locator('#speed').inputValue(), '2');
  await page.locator('#speed').selectOption('10'); await page.locator('#play').focus();
  assert.equal(await page.evaluate(() => (window as any).mockSpeech.current.rate), 10);
  const requests = await page.evaluate(() => (window as any).mockSpeech.requests.length);
  await page.keyboard.press('Shift+Period'); assert.equal(await page.locator('#speed').inputValue(), '10');
  assert.equal(await page.evaluate(() => (window as any).mockSpeech.requests.length), requests);
  for (let i = 0; i < 42; i++) await page.keyboard.press('Shift+Comma');
  assert.equal(await page.locator('#speed').inputValue(), '0.25');
  await page.keyboard.press('Control+Shift+Period'); assert.equal(await page.locator('#speed').inputValue(), '0.25');
  await page.keyboard.press('k');
  await page.keyboard.press('End'); assert.equal(await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'), 'conclusion-6');
  await page.keyboard.press('0'); assert.equal(await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'), 'overview-1');
  await page.keyboard.press('l'); const forward = await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'); assert.notEqual(forward, 'overview-1');
  await page.keyboard.press('j'); assert.equal(await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'), 'overview-1');
  await page.keyboard.press('5'); assert.notEqual(await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'), 'overview-1');
  await page.keyboard.press('Home'); await page.keyboard.press('Shift+ArrowRight'); assert.equal(await page.locator('#scene-position').textContent(), '2 / 8');
  await page.keyboard.press('Shift+ArrowLeft'); assert.equal(await page.locator('#scene-position').textContent(), '1 / 8');
  await page.keyboard.press('Shift+Slash'); assert.equal(await page.locator('#shortcuts-dialog').isVisible(), true);
  await page.keyboard.press('Shift+Period'); assert.equal(await page.locator('#speed').inputValue(), '0.25');
  await page.keyboard.press('Escape');
  await page.locator('#progress').focus(); const before = await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat');
  await page.keyboard.press('k'); await page.keyboard.press('Shift+Period');
  assert.equal(await page.locator('#play').textContent(), 'Play'); assert.equal(await page.locator('#speed').inputValue(), '0.25');
  assert.equal(await page.locator('.transcript-beat[aria-current=true]').getAttribute('data-beat'), before);
  await page.locator('#play').focus(); await page.keyboard.press('Space'); assert.equal(await page.locator('#play').textContent(), 'Pause');
  await page.keyboard.press('k');
  await page.keyboard.press('f'); await page.waitForFunction(() => !!document.fullscreenElement);
  await page.keyboard.press('f'); await page.waitForFunction(() => !document.fullscreenElement);
  await page.reload(); await page.locator('.scene').waitFor(); assert.equal(await page.locator('#speed').inputValue(), '0.25');
  await context.close();
});
