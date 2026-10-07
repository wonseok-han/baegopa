import assert from 'node:assert/strict';
import test from 'node:test';
import { createPinballRace, MAX_RACE_STEPS } from '../src/lib/pinball-race.ts';

const candidates = (count) => Array.from({ length: count }, (_, index) => ({
  placeId: String(index), name: `후보 ${index + 1}`, category: '한식', distance: index,
  address: '테스트 주소', location: { lat: 37.5, lng: 127 },
}));
function resolve(race, batch) {
  while (!race.winner) race.step(batch);
  return { id: race.winner.restaurant.placeId, steps: race.steps, reason: race.reason };
}

test('normal playback, batched playback and skip resolve the same fixed-step race', () => {
  for (const seed of [0, 1, 23, 1000000, 4294967295]) {
    const normal = createPinballRace(candidates(24), seed);
    const skipped = createPinballRace(candidates(24), seed);
    const interrupted = createPinballRace(candidates(24), seed);
    interrupted.step(217);
    const expected = resolve(normal, 1);
    assert.deepEqual(resolve(skipped, 90), expected);
    assert.deepEqual(resolve(interrupted, 600), expected);
    normal.dispose(); skipped.dispose(); interrupted.dispose();
  }
});

test('all unique candidates enter, and the source roster cannot mutate an active race', () => {
  const source = candidates(50);
  source.push(source[0]);
  const race = createPinballRace(source, 42);
  source[0].name = 'Changed';
  source[0].location.lat = 0;
  source.splice(1);
  assert.equal(race.marbles.length, 50);
  assert.equal(new Set(race.marbles.map((item) => item.restaurant.placeId)).size, 50);
  const frozen = race.marbles.find((item) => item.restaurant.placeId === '0').restaurant;
  assert.equal(frozen.name, '후보 1');
  assert.equal(frozen.location.lat, 37.5);
  race.dispose();
});

test('empty roster fails, one candidate resolves, large roster terminates within the bound', () => {
  assert.throws(() => createPinballRace([], 1));
  for (const size of [1, 2, 12, 45, 150, 405]) {
    const race = createPinballRace(candidates(size), 31);
    const result = resolve(race, 90);
    assert.ok(Number(result.id) >= 0 && Number(result.id) < size);
    assert.ok(result.steps <= MAX_RACE_STEPS);
    race.dispose();
  }
});

test('resolved or disposed simulations never advance or change their outcome', () => {
  const race = createPinballRace(candidates(12), 1);
  const result = resolve(race, 90);
  race.step(5000);
  assert.deepEqual(resolve(race, 1), result);
  race.dispose();
  race.step(5000);
  assert.equal(race.steps, result.steps);
  const cancelled = createPinballRace(candidates(12), 2);
  cancelled.step(30);
  cancelled.dispose();
  cancelled.step(5000);
  assert.equal(cancelled.steps, 30);
  assert.equal(cancelled.winner, null);
});


test('restaurant number and color stay stable when starting slots shuffle', () => {
  const source = candidates(12);
  const first = createPinballRace(source, 1);
  const second = createPinballRace(source, 2);
  for (const marble of first.marbles) {
    const same = second.marbles.find((item) => item.restaurant.placeId === marble.restaurant.placeId);
    assert.equal(same.number, marble.number);
    assert.equal(same.color, marble.color);
    assert.equal(marble.number, Number(marble.restaurant.placeId) + 1);
  }
  assert.notDeepEqual(first.racers.map((item) => item.placeId), second.racers.map((item) => item.placeId));
  first.dispose(); second.dispose();
});

test('time-limit fallback is stable across normal and skipped playback, including ties', async () => {
  const {default: Matter} = await import('matter-js');
  const run = (batch) => {
    const race = createPinballRace(candidates(12), 29);
    for (const marble of race.marbles) {
      Matter.Body.setPosition(marble.body, { x: 180, y: 200 });
      Matter.Body.setStatic(marble.body, true);
    }
    const outcome = resolve(race, batch);
    assert.equal(outcome.reason, 'time-limit');
    assert.equal(outcome.steps, MAX_RACE_STEPS);
    assert.equal(race.winner.slot, 0);
    race.dispose();
    return outcome;
  };
  assert.deepEqual(run(1), run(90));
  assert.deepEqual(run(90), run(600));
});
