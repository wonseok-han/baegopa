import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinballClock } from '../src/lib/pinball-clock.ts';
import { FIXED_STEP_MS } from '../src/lib/pinball-race.ts';

function countFrames(times, stepMs = 1000 / 120) {
  const clock = createPinballClock(stepMs);
  clock.reset(0);
  let count = 0;
  for (const time of times) clock.advance(time, () => { count++; return false; });
  return count;
}

test('one second of 30/60/120 Hz display time advances exactly one second of physics', () => {
  for (const hz of [30, 60, 120]) {
    assert.equal(countFrames(Array.from({ length: hz }, (_, index) => (index + 1) * 1000 / hz)), 120);
  }
});

test('irregular display frames preserve fixed-step elapsed time without a speed multiplier', () => {
  const times = [7, 24, 49, 65, 98, 123, 166, 213, 250, 290, 343, 401, 460, 503, 555, 610, 667, 714, 780, 835, 901, 963, 1000];
  assert.equal(countFrames(times), 120);
});

test('background resume is bounded and finishing ends stepping in that frame', () => {
  assert.equal(countFrames([1000, 1016.6666666667]), 14);
  const clock = createPinballClock(10);
  clock.reset(0);
  let count = 0;
  clock.advance(100, () => ++count === 3);
  assert.equal(count, 3);
});


test('the production clock runs at 1x on a 60Hz display', () => {
  const times = Array.from({ length: 60 }, (_, index) => (index + 1) * 1000 / 60);
  assert.equal(countFrames(times, FIXED_STEP_MS), Math.round(1000 / FIXED_STEP_MS));
});
