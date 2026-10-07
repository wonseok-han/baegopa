import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createContext, Script } from "node:vm";
import ts from "typescript";

// A small hook harness exercises asynchronous guards without a browser or new test dependencies.
// Effects run on mount and their cleanups on unmount; assertions rerender explicitly.
function mountHook(file, exportedName, storage, globals = {}) {
  const slots = [];
  const effects = [];
  let cursor = 0;
  let firstRender = true;
  let mounted = true;
  let updatesAfterUnmount = 0;
  const react = {
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [slots[index], (next) => {
        if (!mounted) updatesAfterUnmount += 1;
        slots[index] = typeof next === "function" ? next(slots[index]) : next;
      }];
    },
    useCallback(fn) { return fn; },
    useEffect(effect) { if (firstRender) effects.push(effect); },
  };
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = createContext({
    exports: {}, AbortController,
    require: (name) => {
      if (name === "react") return react;
      if (name === "@/lib/storage") return storage;
      throw new Error(`Unexpected dependency: ${name}`);
    },
    ...globals,
  });
  new Script(code).runInContext(context);
  const render = () => { cursor = 0; return context.exports[exportedName](); };
  render();
  const cleanups = effects.map((effect) => effect()).filter(Boolean);
  firstRender = false;
  return {
    render,
    unmount() { mounted = false; cleanups.forEach((cleanup) => cleanup()); },
    get updatesAfterUnmount() { return updatesAfterUnmount; },
  };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function nearbyHarness() {
  const requests = [];
  const cache = new Map();
  const harness = mountHook("../src/hooks/use-nearby-places.ts", "useNearbyPlaces", {
    getStoredPlaces: (lat, lng, radius) => cache.get(`${lat}:${lng}:${radius}`) ?? null,
    setStoredPlaces: (lat, lng, radius, places) => cache.set(`${lat}:${lng}:${radius}`, places),
  }, {
    fetch: (url, options) => { const pending = deferred(); requests.push({ ...pending, url, ...options }); return pending.promise; },
  });
  return { ...harness, requests, cache };
}

const response = (restaurants) => ({ ok: true, json: async () => ({ restaurants }) });

test("a stale successful or failed search cannot replace the newer radius", async () => {
  for (const failOldRequest of [false, true]) {
    const harness = nearbyHarness();
    const first = harness.render().fetchPlaces(37.5, 127, 100);
    const second = harness.render().fetchPlaces(37.5, 127, 500);
    assert.equal(harness.requests[0].signal.aborted, true);
    const expected = [{ placeId: "new-radius" }];
    harness.requests[1].resolve(response(expected));
    await second;
    if (failOldRequest) harness.requests[0].reject(new Error("Late failure"));
    else harness.requests[0].resolve(response([{ placeId: "stale" }]));
    await first;
    assert.equal(harness.render().requestKey, "37.5:127:500");
    assert.equal(harness.render().restaurants, expected);
    assert.equal(harness.render().error, null);
    harness.unmount();
  }
});

test("a cache hit invalidates an earlier request and empty rosters remain successful", async () => {
  const harness = nearbyHarness();
  const first = harness.render().fetchPlaces(37.5, 127, 100);
  const cached = [];
  harness.cache.set("37.5:127:300", cached);
  await harness.render().fetchPlaces(37.5, 127, 300);
  harness.requests[0].reject(new Error("Late failure"));
  await first;
  assert.equal(harness.render().restaurants, cached);
  assert.equal(harness.render().error, null);
  assert.equal(harness.render().loading, false);
  assert.equal(harness.requests.length, 1);
  harness.unmount();
});

test("a new search clears the previous roster while it is loading, and cancel blocks updates", async () => {
  const harness = nearbyHarness();
  harness.cache.set("37.5:127:100", [{ placeId: "old" }]);
  await harness.render().fetchPlaces(37.5, 127, 100);
  const pending = harness.render().fetchPlaces(37.6, 127, 100);
  assert.equal(harness.render().restaurants.length, 0);
  assert.equal(harness.render().loading, true);
  harness.render().cancel();
  harness.requests[0].resolve(response([{ placeId: "cancelled" }]));
  await pending;
  assert.equal(harness.render().restaurants.length, 0);
  harness.unmount();
});

test("late GPS success and failure do not override manual selection, reset, or unmount", () => {
  for (const interruption of ["manual", "reset", "unmount"]) {
    const callbacks = [];
    const harness = mountHook("../src/hooks/use-geolocation.ts", "useGeolocation", { getStoredLocation: () => null }, {
      navigator: { geolocation: { getCurrentPosition: (success, error) => callbacks.push({ success, error }) } },
    });
    harness.render().requestPermission();
    if (interruption === "manual") harness.render().setManualCoordinates(35, 129);
    if (interruption === "reset") harness.render().reset();
    if (interruption === "unmount") harness.unmount();
    callbacks[0].success({ coords: { latitude: 37, longitude: 127 } });
    callbacks[0].error({ code: 1, PERMISSION_DENIED: 1 });
    if (interruption === "manual") {
      assert.equal(harness.render().coordinates.lat, 35);
      assert.equal(harness.render().coordinates.lng, 129);
    } else assert.equal(harness.render().coordinates, null);
    assert.equal(harness.render().error, null);
    assert.equal(harness.updatesAfterUnmount, 0);
    if (interruption !== "unmount") harness.unmount();
  }
});

test("only the newest GPS request can resolve", () => {
  const callbacks = [];
  const harness = mountHook("../src/hooks/use-geolocation.ts", "useGeolocation", { getStoredLocation: () => null }, {
    navigator: { geolocation: { getCurrentPosition: (success, error) => callbacks.push({ success, error }) } },
  });
  harness.render().requestPermission();
  harness.render().requestPermission();
  callbacks[0].success({ coords: { latitude: 37, longitude: 127 } });
  assert.equal(harness.render().coordinates, null);
  callbacks[1].success({ coords: { latitude: 35, longitude: 129 } });
  assert.equal(harness.render().coordinates.lat, 35);
  harness.unmount();
});
