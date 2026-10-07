import assert from "node:assert/strict";
import test from "node:test";
import {
  consumeRateLimit,
  getClientIdentifier,
  parsePlacesParams,
  parseSearchParams,
} from "../src/lib/api-guard.ts";

test("places 파라미터를 정상 변환한다", () => {
  const result = parsePlacesParams(
    new URLSearchParams({
      lat: "37.4979",
      lng: "127.0276",
      radius: "500",
    })
  );

  assert.deepEqual(result, {
    ok: true,
    value: { lat: 37.4979, lng: 127.0276, radius: 500 },
  });
});

test("누락되거나 범위를 벗어난 좌표를 거부한다", () => {
  assert.equal(
    parsePlacesParams(new URLSearchParams({ lng: "127", radius: "100" })).ok,
    false
  );
  assert.equal(
    parsePlacesParams(
      new URLSearchParams({ lat: "91", lng: "127", radius: "100" })
    ).ok,
    false
  );
});

test("허용 목록에 없는 반경을 거부한다", () => {
  const result = parsePlacesParams(
    new URLSearchParams({ lat: "37", lng: "127", radius: "2000" })
  );

  assert.equal(result.ok, false);
});

test("검색어와 페이지 범위를 검증한다", () => {
  assert.deepEqual(
    parseSearchParams(new URLSearchParams({ query: " 강남역 ", page: "2" })),
    { ok: true, value: { query: "강남역", page: 2 } }
  );
  assert.equal(
    parseSearchParams(new URLSearchParams({ query: "강", page: "1" })).ok,
    false
  );
  assert.equal(
    parseSearchParams(new URLSearchParams({ query: "강남", page: "46" })).ok,
    false
  );
  assert.equal(
    parseSearchParams(new URLSearchParams({ query: "강남", page: "1.5" })).ok,
    false
  );
});

test("고정 윈도우 요청 제한을 적용하고 다음 윈도우에 초기화한다", () => {
  const key = `test:${Math.random()}`;
  const first = consumeRateLimit(key, 2, 1000, 100);
  const second = consumeRateLimit(key, 2, 1000, 200);
  const blocked = consumeRateLimit(key, 2, 1000, 300);
  const reset = consumeRateLimit(key, 2, 1000, 1200);

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
  assert.equal(reset.allowed, true);
  assert.equal(reset.remaining, 1);
});

test("프록시 헤더에서 첫 번째 클라이언트 주소를 사용한다", () => {
  assert.equal(
    getClientIdentifier(
      new Headers({ "x-forwarded-for": "203.0.113.8, 10.0.0.1" })
    ),
    "203.0.113.8"
  );
  assert.equal(getClientIdentifier(new Headers()), "unknown");
});
