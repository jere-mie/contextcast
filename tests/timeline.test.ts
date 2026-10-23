import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timeline, totalDuration, nearest, skipTarget } from '../src/player/timeline';
import { validSample } from './helpers';
test('deterministic ordering and cumulative estimates scale with rate', () => {
  const data = validSample(); const a = timeline(data); assert.deepEqual(a, timeline(data));
  assert.equal(a[0].start, 0); assert.equal(a[6].sceneIndex, 1); assert.equal(a[6].beatIndex, 0);
  a.slice(1).forEach((e, i) => assert.equal(e.start, a[i].start + a[i].duration));
  assert.equal(totalDuration(timeline(data, 2)), totalDuration(a) / 2);
  assert.ok(totalDuration(a) > 300 && totalDuration(a) < 600);
});
test('skip always moves directionally and clamps at edges', () => {
  const a = timeline(validSample());
  for (let i = 1; i < a.length - 1; i++) {
    assert.ok(skipTarget(a, i, a[i].start, -1) < i);
    assert.ok(skipTarget(a, i, a[i].start + 8, 1) > i);
  }
  assert.equal(skipTarget(a, 0, 0, -1), 0);
  assert.equal(skipTarget(a, a.length - 1, totalDuration(a), 1), a.length - 1);
  assert.equal(nearest(a, -100), 0); assert.equal(nearest(a, Infinity), 0);
  assert.equal(nearest(a, totalDuration(a)), a.length - 1);
});
