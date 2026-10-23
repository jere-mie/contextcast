import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { validateBriefing } from '../src/schema/briefing';
import { shell } from '../src/html/shell';
import { renderTemplate } from '../.agents/skills/contextcast/scripts/build.mjs';
export { safeJSON } from '../.agents/skills/contextcast/scripts/build.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
let bundle: Promise<string> | undefined;
export async function createTemplate(): Promise<string> {
  bundle ??= build({ entryPoints: [resolve(root, 'src/player/app.ts')], bundle: true, write: false, format: 'iife', target: 'es2022', minify: false, legalComments: 'none' }).then(r => r.outputFiles[0].text);
  const [js, css] = await Promise.all([bundle, readFile(resolve(root, 'src/styles/player.css'), 'utf8')]);
  // Keep player code readable, with no embedded vendor library or opaque data blobs.
  const script = js.replace(/<\/script/gi, '<\\/script');
  const csp = `default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net/npm/mermaid@12.2.0/dist/mermaid.min.js; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>
<html lang="__CONTEXTCAST_LANGUAGE__">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="referrer" content="no-referrer">
<title>__CONTEXTCAST_TITLE__ · ContextCast</title>
<style>
${css}
</style>
</head>
<body>
${shell}
<noscript>Enable JavaScript to use this briefing.</noscript>
<!-- EDIT BRIEFING CONTENT HERE. The JSON is plain text; content edits need no rebuild. -->
<script id="briefing-data" type="application/json">
__CONTEXTCAST_DATA__
</script>
<!-- Reusable player. Mermaid loads from its pinned CDN only when a diagram is opened. -->
<script>
${script}
</script>
</body>
</html>
`;
}
export async function compile(input: unknown): Promise<string> {
  return renderTemplate(await createTemplate(), validateBriefing(input));
}
export async function buildBriefing(input: string, output: string) {
  if (!output.toLowerCase().endsWith('.html')) throw new Error('Output must have an .html extension');
  if (resolve(input) === resolve(output)) throw new Error('Input and output paths must differ');
  const html = await compile(JSON.parse(await readFile(input, 'utf8')));
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, html, 'utf8');
  console.log(`${resolve(output)} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB; editable HTML, diagrams via pinned CDN)`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input = 'examples/pr-review.json', output = 'dist/example-pr-review.html'] = process.argv.slice(2);
  buildBriefing(input, output).catch(error => { console.error('Build failed:', error.message); process.exitCode = 1; });
}
