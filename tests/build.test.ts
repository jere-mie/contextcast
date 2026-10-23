import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, buildBriefing, safeJSON } from '../scripts/build-briefing';
import { sample } from './helpers';
test('build emits exactly one HTML with bundled content and no external asset tags', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contextcast-build-'));
  try {
    await buildBriefing('examples/pr-review.json', join(dir, 'review.html'));
    assert.deepEqual(await readdir(dir), ['review.html']); const html = await readFile(join(dir, 'review.html'), 'utf8');
    assert.match(html, /application\/json/); assert.match(html, /SpeechSynthesisUtterance/); assert.match(html, /Conceptual flow/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<audio\b|<video\b/);
    assert.match(html, /connect-src 'none'/); assert.match(html, /script-src 'sha256-/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('escaping prevents content closing the script or injecting a title tag', async () => {
  const d = sample(); d.title = '</title><script>window.pwned=1</script>'; d.scenes[4].visual.code = '</script><img src=x onerror="window.pwned=2">';
  const html = await compile(d); assert.ok(!html.includes('<script>window.pwned'));
  const json = html.match(/<script id="briefing-data" type="application\/json">([\s\S]*?)<\/script>/)![1];
  assert.deepEqual(JSON.parse(json).scenes[4].visual.code, d.scenes[4].visual.code);
  assert.ok(!json.includes('<')); assert.deepEqual(JSON.parse(safeJSON(d)), d);
});
test('invalid input and non-HTML paths fail before writing', async () => {
  await assert.rejects(compile({ schemaVersion: '7' }), /Unsupported/);
  await assert.rejects(buildBriefing('examples/pr-review.json', 'wrong.mp3'), /\.html/);
});
