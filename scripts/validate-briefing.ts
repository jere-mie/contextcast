import { readFile } from 'node:fs/promises';
import { validateBriefing } from '../src/schema/briefing';
import { timeline, totalDuration, formatTime } from '../src/player/timeline';
try {
  const data = validateBriefing(JSON.parse(await readFile(process.argv[2] ?? 'examples/pr-review.json', 'utf8')));
  const entries = timeline(data);
  console.log(`Valid version ${data.schemaVersion}: ${data.scenes.length} scenes, ${entries.length} beats, ≈ ${formatTime(totalDuration(entries))} at 1×.`);
  entries.forEach(e => { const words = e.beat.speech.split(/\s+/).length; if (words < 12 || words > 30) console.warn(`Authoring note: ${e.beat.id} has ${words} words (target 12–30).`); });
} catch (error) { console.error('Validation failed:', error instanceof Error ? error.message : error); process.exitCode = 1; }
