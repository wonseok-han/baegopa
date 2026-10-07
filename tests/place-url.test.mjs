import assert from "node:assert/strict";
import test from "node:test";
import { getSafeKakaoPlaceUrl } from "../src/lib/place-url.ts";

test("카카오맵 http(s) URL만 결과 링크로 허용한다", () => {
  assert.equal(getSafeKakaoPlaceUrl("https://place.map.kakao.com/123"), "https://place.map.kakao.com/123");
  assert.equal(getSafeKakaoPlaceUrl("http://map.kakao.com/link/map/123"), "http://map.kakao.com/link/map/123");
  for (const invalid of [null, "", "javascript:alert(1)", "data:text/html,test", "//place.map.kakao.com/123", "https://place.map.kakao.com.evil.test/123", "https://evil.test@place.map.kakao.com/123", "https://map.kakao.com:8443/123", "https://kakao.com/123", "https://evil.test/123"]) {
    assert.equal(getSafeKakaoPlaceUrl(invalid), null, `${invalid} should be rejected`);
  }
});
