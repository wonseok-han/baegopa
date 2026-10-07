import assert from 'node:assert/strict';
import test from 'node:test';
import Matter from 'matter-js';
import { createPinballClock } from '../src/lib/pinball-clock.ts';
import { createPinballRace, COURSE_MATERIALS, MARBLE_MATERIAL, FIXED_STEP_MS, MAX_MARBLE_SPEED, MAX_RACE_STEPS, PHYSICS_SUBSTEPS } from '../src/lib/pinball-race.ts';

const candidates = (count) => Array.from({ length: count }, (_, index) => ({
  placeId: String(index), name: `후보 ${index}`, category: '한식', address: '테스트',
  distance: index, location: { lat: 37.5, lng: 127 },
}));
const resolve = (race, batch = 90) => {
  while (!race.winner) race.step(batch);
  return { id: race.winner.restaurant.placeId, slot: race.winner.slot, steps: race.steps, reason: race.reason };
};

test('the course has bounded speed, meaningful collisions and natural finishes across roster sizes', () => {
  assert.equal(PHYSICS_SUBSTEPS, 2);
  for (const count of [1, 2, 5, 12, 25, 45, 150, 405]) {
    for (const seed of [0, 17, 41, 73]) {
      const race = createPinballRace(candidates(count), seed);
      resolve(race);
      const metrics = race.diagnostics;
      const label = `${count} candidates / seed ${seed}`;
      assert.equal(race.reason, 'finish', label);
      assert.ok(race.steps * FIXED_STEP_MS >= 7000, `${label}: must not be a straight quick drop`);
      assert.ok(race.steps <= MAX_RACE_STEPS, label);
      assert.ok(metrics.maxObservedSpeed <= MAX_MARBLE_SPEED + 1e-8, label);
      assert.ok(metrics.winnerObstacleContacts >= 5, `${label}: needs observable obstacle interactions`);
      assert.equal(metrics.outOfBoundsCount, 0, label);
      assert.equal(metrics.nonFiniteCount, 0, label);
      race.dispose();
    }
  }
});

test('real-time irregular frames and skipping share the identical winner and physics outcome', () => {
  for (const seed of [0, 17, 41]) {
    const animated = createPinballRace(candidates(45), seed);
    const skipped = createPinballRace(candidates(45), seed);
    const clock = createPinballClock(FIXED_STEP_MS);
    clock.reset(0);
    let now = 0;
    let frame = 0;
    const deltas = [7, 17, 24, 12, 34, 18, 9, 29];
    while (!animated.winner) {
      now += deltas[frame++ % deltas.length];
      clock.advance(now, () => Boolean(animated.step()));
    }
    const expected = { id: animated.winner.restaurant.placeId, slot: animated.winner.slot, steps: animated.steps, reason: animated.reason };
    assert.deepEqual(resolve(skipped, 120), expected);
    animated.dispose(); skipped.dispose();
  }
});

test('restaurant names and IDs do not change the course physics or winning slot', () => {
  const original = candidates(45);
  const renamed = original.map((item, index) => ({ ...item, placeId: `renamed-${index}`, name: `다른 이름 ${index}` }));
  for (const seed of [0, 17, 41]) {
    const first = createPinballRace(original, seed);
    const second = createPinballRace(renamed, seed);
    resolve(first); resolve(second);
    assert.equal(first.winner.slot, second.winner.slot);
    assert.equal(first.steps, second.steps);
    for (const marble of first.marbles) {
      const sameSlot = second.marbles.find((other) => other.slot === marble.slot);
      assert.deepEqual(sameSlot.body.position, marble.body.position);
    }
    first.dispose(); second.dispose();
  }
});


test('actual Matter bodies retain the intended materials after static-body initialization', () => {
  const race = createPinballRace(candidates(12), 17);
  const labels = new Set();
  for (const body of Matter.Composite.allBodies(race.engine.world)) {
    const material = body.isStatic ? COURSE_MATERIALS[body.label] : MARBLE_MATERIAL;
    assert.ok(material, `known material for ${body.label}`);
    for (const [property, value] of Object.entries(material)) {
      assert.equal(body[property], value, `${body.label}.${property}`);
    }
    if (body.isStatic) labels.add(body.label);
  }
  for (const label of ['peg', 'bumper', 'spinner', 'ramp', 'deflector', 'funnel']) assert.ok(labels.has(label));
  assert.ok(COURSE_MATERIALS.bumper.restitution > MARBLE_MATERIAL.restitution);
  race.dispose();
});
