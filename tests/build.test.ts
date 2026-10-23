import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, cp } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compile, buildBriefing, safeJSON } from '../scripts/build-briefing';
import { sample } from './helpers';
test('build emits a small, readable HTML with lazy pinned CDN diagrams and no embedded vendor code', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contextcast-build-'));
  try {
    await buildBriefing('examples/pr-review.json', join(dir, 'review.html'));
    assert.deepEqual(await readdir(dir), ['review.html']); const html = await readFile(join(dir, 'review.html'), 'utf8');
    assert.match(html, /application\/json/); assert.match(html, /SpeechSynthesisUtterance/); assert.match(html, /Conceptual flow/);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|<audio\b|<video\b/);
    assert.match(html, /connect-src 'none'/); assert.match(html, /https:\/\/cdn\.jsdelivr\.net\/npm\/mermaid@12\.2\.0\/dist\/mermaid\.min\.js/);
    assert.ok(Buffer.byteLength(html) < 100 * 1024, 'PR artifact must stay under 100 KiB');
    const json = html.match(/<script id="briefing-data" type="application\/json">([\s\S]*?)<\/script>/)![1];
    assert.ok(json.includes('\n  "schemaVersion"'), 'Content must be formatted for direct editing');
    assert.ok(html.includes('class PlaybackController') || html.includes('var PlaybackController = class'), 'Player must remain readable');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('portable skill builds the same content and player outside the repository, without npm dependencies', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'contextcast-portable-'));
  try {
    await cp('.agents/skills/contextcast', join(dir, 'skill'), { recursive: true });
    const output = join(dir, 'review.html');
    await promisify(execFile)(process.execPath, [join(dir, 'skill/scripts/build.mjs'), join(dir, 'skill/assets/pr-review.json'), output], { cwd: dir });
    const portable = await readFile(output, 'utf8'); const development = await compile(sample());
    const block = /(<script id="briefing-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
    assert.deepEqual(JSON.parse(portable.match(block)![2]), JSON.parse(development.match(block)![2]));
    assert.equal(portable.replace(block, '$1CONTENT$3'), development.replace(block, '$1CONTENT$3'));
    assert.ok(!(await readdir(dir)).includes('node_modules'));
  } finally { await rm(dir, { recursive: true, force: true }); }
});
test('template tokens and dollar replacement syntax in content remain literal', async () => {
  const d = sample(); d.title = '__CONTEXTCAST_DATA__ $& $`';
  const html = await compile(d);
  const json = html.match(/<script id="briefing-data" type="application\/json">([\s\S]*?)<\/script>/)![1];
  assert.equal(JSON.parse(json).title, d.title);
  assert.ok(html.includes(`<title>${d.title.replaceAll('&', '&amp;')} · ContextCast</title>`));
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
