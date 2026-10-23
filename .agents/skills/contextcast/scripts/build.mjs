import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBriefing } from './validate.mjs';

export const safeJSON = data => JSON.stringify(data, null, 2)
  .replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026')
  .replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export function renderTemplate(template, data) {
  const replacements = { LANGUAGE: escape(data.language), TITLE: escape(data.title), DATA: safeJSON(data) };
  return template.replace(/__CONTEXTCAST_(LANGUAGE|TITLE|DATA)__/g, (_, name) => replacements[name]);
}

export async function buildBriefing(input, output) {
  if (!output?.toLowerCase().endsWith('.html')) throw new Error('Output must have an .html extension');
  if (resolve(input) === resolve(output)) throw new Error('Input and output paths must differ');
  const data = validateBriefing(JSON.parse(await readFile(input, 'utf8')));
  const template = await readFile(new URL('../assets/template.html', import.meta.url), 'utf8');
  const html = renderTemplate(template, data);
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, html, 'utf8');
  console.log(`${resolve(output)} (${(Buffer.byteLength(html) / 1024).toFixed(1)} KiB; diagrams via pinned CDN)`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) { console.error('Usage: node build.mjs briefing.json briefing.html'); process.exitCode = 1; }
  else buildBriefing(input, output).catch(error => { console.error(error.message); process.exitCode = 1; });
}
