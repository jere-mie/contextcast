import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { createTemplate } from './build-briefing';
const assets = new URL('../.agents/skills/contextcast/assets/', import.meta.url);
await mkdir(assets, { recursive: true });
await writeFile(new URL('template.html', assets), await createTemplate(), 'utf8');
for (const sample of ['architecture', 'pr-review']) {
  await copyFile(new URL(`../examples/${sample}.json`, import.meta.url), new URL(`${sample}.json`, assets));
}
console.log('Refreshed portable skill template and examples. Authors need only Node.js, no npm install.');
