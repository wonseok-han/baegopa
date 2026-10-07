import assert from "node:assert/strict";
import test from "node:test";
import { FOOD_CATEGORIES, classifyRestaurant, filterRestaurants, getFoodCategory, isFoodCategoryId } from "../src/lib/food-categories.ts";

const place = (categoryPath, name = "무관한 가게 이름") => ({
  placeId: categoryPath, name, category: categoryPath.split(">").at(-1).trim(), categoryPath,
  distance: 50, address: "서울", location: { lat: 37.5, lng: 127 },
});

test("상위 카카오 분류로 브랜드/세부 업종까지 묶는다", () => {
  for (const [branch, id] of [["한식", "korean"], ["일식", "japanese"], ["중식", "chinese"], ["양식", "western"], ["아시아음식", "asian"], ["분식", "snack"], ["치킨", "chicken"], ["패스트푸드", "fastfood"]]) {
    assert.equal(classifyRestaurant(place(` 음식점 > ${branch} > 세부업종 > 브랜드 `)), id);
  }
});

test("가게명으로 추측하지 않고 알 수 없는 분류는 기타로 남긴다", () => {
  assert.equal(classifyRestaurant(place("음식점 > 기타", "한식 일식 중식 치킨")), "other");
  assert.equal(classifyRestaurant({ category: "스시브랜드" }), "other");
  assert.equal(classifyRestaurant({ category: "일식" }), "japanese");
  assert.equal(classifyRestaurant({ category: "", categoryPath: "" }), "other");
  assert.equal(classifyRestaurant({ category: "toString" }), "other");
  assert.equal(classifyRestaurant(place("음식점 > 한식 > 치킨")), "korean");
});

test("선택 분류만 필터링하고 원래 순서와 장소 ID를 보존한다", () => {
  const list = [place("음식점 > 한식 > 국밥"), place("음식점 > 일식 > 초밥"), place("음식점 > 한식 > 비빔밥")];
  assert.equal(filterRestaurants(list, "all"), list);
  assert.deepEqual(filterRestaurants(list, "korean"), [list[0], list[2]]);
  assert.deepEqual(filterRestaurants(list, "japanese"), [list[1]]);
  assert.deepEqual(filterRestaurants(list, "chinese"), []);
  assert.deepEqual(filterRestaurants([], "all"), []);
  assert.equal(list.length, 3);
});

test("카테고리 ID를 검증하고 기본값은 전체로 표시한다", () => {
  assert.equal(new Set(FOOD_CATEGORIES.map((category) => category.id)).size, FOOD_CATEGORIES.length);
  assert.equal(isFoodCategoryId("korean"), true);
  for (const invalid of [null, undefined, "KOREAN", "bad", "toString"]) {
    assert.equal(isFoodCategoryId(invalid), false);
    assert.equal(getFoodCategory(invalid).id, "all");
  }
});
