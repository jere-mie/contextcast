import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { validateBriefing } from '../src/schema/briefing';
import { shell } from '../src/html/shell';

const root = fileURLToPath(new URL('../', import.meta.url));
export const safeJSON = (value: unknown) => JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
let bundle: Promise<string> | undefined;
export async function compile(input: unknown): Promise<string> {
  const data = validateBriefing(input);
  bundle ??= build({ entryPoints: [resolve(root, 'src/player/app.ts')], bundle: true, write: false, format: 'iife', target: 'es2022', minify: true, legalComments: 'inline' }).then(r => r.outputFiles[0].text);
  const [js, css] = await Promise.all([bundle, readFile(resolve(root, 'src/styles/player.css'), 'utf8')]);
  // HTML parsing precedes JS parsing, so escape closing script tags in vendor strings too.
  const script = js.replace(/<\/script/gi, '<\\/script');
  const hash = createHash('sha256').update(script).digest('base64');
  const csp = `default-src 'none'; script-src 'sha256-${hash}'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
  return `<!doctype html>\n<html lang="${escape(data.language)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="referrer" content="no-referrer"><title>${escape(data.title)} · ContextCast</title><style>${css}</style></head><body>${shell}<noscript>Enable JavaScript to use the player. All narration is also included below.<pre>${escape(data.scenes.map(s => s.title + '\n' + s.beats.map(b => b.speech).join('\n')).join('\n\n'))}</pre></noscript><script id="briefing-data" type="application/json">${safeJSON(data)}</script><script>${script}</script></body></html>\n`;
}
export async function buildBriefing(input: string, output: string) {
  if (!output.toLowerCase().endsWith('.html')) throw new Error('Output must have an .html extension');
  if (resolve(input) === resolve(output)) throw new Error('Input and output paths must differ');
  const html = await compile(JSON.parse(await readFile(input, 'utf8')));
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, html, 'utf8');
  console.log(`${resolve(output)} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MiB; single file, offline assets)`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input = 'examples/pr-review.json', output = 'dist/example-pr-review.html'] = process.argv.slice(2);
  buildBriefing(input, output).catch(error => { console.error('Build failed:', error.message); process.exitCode = 1; });
}
