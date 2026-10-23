import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBriefing } from '../src/schema/briefing';
import { sample } from './helpers';
test('validates all six layouts and preserves the complete transcript', () => {
  const data = validateBriefing(sample()); assert.equal(new Set(data.scenes.map(s => s.layout)).size, 6);
  assert.equal(data.scenes.flatMap(s => s.beats).length, 48);
});
for (const [name, mutate] of Object.entries<Record<string, (d: any) => void>[string]>({
  'missing ID': d => { delete d.scenes[0].id; },
  'empty scenes': d => { d.scenes = []; },
  'empty beats': d => { d.scenes[0].beats = []; },
  'empty speech': d => { d.scenes[0].beats[0].speech = '  '; },
  'unknown layout': d => { d.scenes[0].layout = 'arbitrary'; },
  'mismatched visual': d => { d.scenes[0].visual = { code: 'x' }; },
  'broken reference': d => { d.scenes[0].beats[0].sourceIds = ['missing']; },
  'duplicate beat ID': d => { d.scenes[1].beats[0].id = d.scenes[0].beats[0].id; },
  'duplicate visual ID': d => { d.scenes[1].visual.items[0].id = d.scenes[0].visual.items[0].id; },
  'dangerous source': d => { d.sources[0].url = 'javascript:alert(1)'; },
  'HTTP source': d => { d.sources[0].url = 'http://localhost/'; },
  'credential URL': d => { d.sources[0].url = 'https://secret:password@example.com/'; },
  'source without evidence': d => { delete d.sources[0].excerpt; },
  'authored JS': d => { d.scenes[0].script = 'alert(1)'; },
  'audio payload': d => { d.audio = 'data:audio/wav;base64,abc'; },
  'Markdown narration': d => { d.scenes[0].beats[0].speech = 'Read **this** finding'; },
  'reversed line ranges': d => { d.scenes[4].visual.highlights = [[50, 40]]; },
})) test(`rejects ${name}`, () => { const data = sample(); mutate(data); assert.throws(() => validateBriefing(data)); });
test('unknown versions offer an explicit migration error', () => {
  assert.throws(() => validateBriefing({ schemaVersion: '2' }), /migrate.*explicitly/);
});
