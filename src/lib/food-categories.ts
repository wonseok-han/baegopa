import type { Restaurant } from "@/types";

export const FOOD_CATEGORIES = [
  { id: "all", label: "전체", icon: "🍽️" },
  { id: "korean", label: "한식", icon: "🍚" },
  { id: "japanese", label: "일식", icon: "🍣" },
  { id: "chinese", label: "중식", icon: "🥟" },
  { id: "western", label: "양식", icon: "🍝" },
  { id: "asian", label: "아시아음식", icon: "🍜" },
  { id: "snack", label: "분식", icon: "🍢" },
  { id: "chicken", label: "치킨", icon: "🍗" },
  { id: "fastfood", label: "패스트푸드", icon: "🍔" },
  { id: "other", label: "기타", icon: "🥄" },
] as const;

export type FoodCategoryId = (typeof FOOD_CATEGORIES)[number]["id"];

const CATEGORY_BRANCHES: Record<string, FoodCategoryId> = {
  한식: "korean",
  일식: "japanese",
  중식: "chinese",
  양식: "western",
  아시아음식: "asian",
  분식: "snack",
  치킨: "chicken",
  패스트푸드: "fastfood",
};

export function isFoodCategoryId(value: unknown): value is FoodCategoryId {
  return FOOD_CATEGORIES.some((category) => category.id === value);
}

export function getFoodCategory(value: unknown) {
  return FOOD_CATEGORIES.find((category) => category.id === value) ?? FOOD_CATEGORIES[0];
}

/** Use Kakao's category branch, never restaurant names or brand guesses. */
export function classifyRestaurant(restaurant: Pick<Restaurant, "category" | "categoryPath">): FoodCategoryId {
  const parts = (restaurant.categoryPath || restaurant.category)
    .split(">")
    .map((part) => part.trim())
    .filter(Boolean);
  const branch = parts[0] === "음식점" ? parts[1] : parts[0];
  return branch && Object.hasOwn(CATEGORY_BRANCHES, branch) ? CATEGORY_BRANCHES[branch] : "other";
}

export function filterRestaurants(restaurants: Restaurant[], category: FoodCategoryId): Restaurant[] {
  return category === "all"
    ? restaurants
    : restaurants.filter((restaurant) => classifyRestaurant(restaurant) === category);
}
