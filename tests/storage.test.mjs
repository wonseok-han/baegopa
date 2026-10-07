import assert from "node:assert/strict";
import test from "node:test";
import { clearAllStorage, getStoredFoodCategory, getStoredLocation, getStoredPlaces, setStoredFoodCategory, setStoredLocation, setStoredPlaces } from "../src/lib/storage.ts";

const stored = new Map();
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
  getItem: (key) => stored.get(key) ?? null,
  setItem: (key, value) => stored.set(key, value),
  removeItem: (key) => stored.delete(key),
} });
const restaurant = {
  placeId: "123", name: "국밥집", category: "국밥", categoryPath: "음식점 > 한식 > 국밥",
  address: "서울", distance: 35, location: { lat: 37.5, lng: 127 },
};

test("v1 캐시는 읽지 않고 v2의 좌표와 반경을 구분한다", () => {
  stored.clear();
  stored.set("baegopa:places:100", JSON.stringify({ lat: 37.5, lng: 127, restaurants: [restaurant] }));
  assert.equal(getStoredPlaces(37.5, 127, 100), null);
  setStoredPlaces(37.5, 127, 100, [restaurant]);
  assert.deepEqual(getStoredPlaces(37.5, 127, 100), [restaurant]);
  assert.equal(getStoredPlaces(37.6, 127, 100), null);
  assert.equal(getStoredPlaces(37.5, 127, 300), null);
});

test("빈 결과도 캐시하며 분류 경로가 없는 데이터는 다시 조회한다", () => {
  stored.clear();
  setStoredPlaces(37.5, 127, 100, []);
  assert.deepEqual(getStoredPlaces(37.5, 127, 100), []);
  setStoredPlaces(37.5, 127, 100, [{ ...restaurant, categoryPath: undefined }]);
  assert.equal(getStoredPlaces(37.5, 127, 100), null);
  stored.set("baegopa:places:v2:100", "{bad json");
  assert.equal(getStoredPlaces(37.5, 127, 100), null);
});

test("음식과 위치를 저장하고 손상된 위치를 거부한다", () => {
  stored.clear();
  setStoredFoodCategory("japanese");
  setStoredLocation(37.5, 127, 300);
  assert.equal(getStoredFoodCategory(), "japanese");
  assert.deepEqual(getStoredLocation(), { lat: 37.5, lng: 127, radius: 300 });
  stored.set("baegopa:location", JSON.stringify({ lat: 91, lng: 127, radius: 300 }));
  assert.equal(getStoredLocation(), null);
  stored.set("baegopa:location", JSON.stringify({ lat: 37.5, lng: 127, radius: 999 }));
  assert.equal(getStoredLocation(), null);
  clearAllStorage();
  assert.equal(getStoredFoodCategory(), null);
  assert.equal(getStoredLocation(), null);
});

test("sessionStorage를 사용할 수 없어도 읽기와 초기화가 실패하지 않는다", () => {
  const storage = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, get() { throw new Error("Storage unavailable"); } });
  try {
    assert.equal(getStoredLocation(), null);
    assert.equal(getStoredFoodCategory(), null);
    assert.equal(getStoredPlaces(37.5, 127, 100), null);
    assert.doesNotThrow(() => { setStoredLocation(37.5, 127, 100); setStoredFoodCategory("all"); setStoredPlaces(37.5, 127, 100, []); clearAllStorage(); });
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: storage });
  }
});
