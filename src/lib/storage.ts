import type { FoodCategoryId } from "@/lib/food-categories";
import type { Restaurant } from "@/types";

const LOCATION_KEY = "baegopa:location";
const CATEGORY_KEY = "baegopa:food-category";
// v2 preserves the full Kakao category path; v1 only kept an ambiguous leaf.
const PLACES_PREFIX = "baegopa:places:v2:";

interface StoredLocation {
  lat: number;
  lng: number;
  radius: number;
}

interface StoredPlaces {
  restaurants: Restaurant[];
  lat: number;
  lng: number;
}

export function getStoredLocation(): StoredLocation | null {
  try {
    const raw = sessionStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !value || !Number.isFinite(value.lat) || Math.abs(value.lat) > 90 ||
      !Number.isFinite(value.lng) || Math.abs(value.lng) > 180 ||
      ![100, 300, 500, 1000].includes(value.radius)
    ) return null;
    return value;
  } catch {
    return null;
  }
}

export function setStoredLocation(lat: number, lng: number, radius: number) {
  try {
    sessionStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng, radius }));
  } catch {
    // Storage may be disabled; the current selection still works in memory/URL.
  }
}

export function getStoredFoodCategory(): string | null {
  try {
    return sessionStorage.getItem(CATEGORY_KEY);
  } catch {
    return null;
  }
}

export function setStoredFoodCategory(category: FoodCategoryId) {
  try {
    sessionStorage.setItem(CATEGORY_KEY, category);
  } catch {
    // ignore
  }
}

export function getStoredPlaces(lat: number, lng: number, radius: number): Restaurant[] | null {
  try {
    const raw = sessionStorage.getItem(`${PLACES_PREFIX}${radius}`);
    if (!raw) return null;
    const cached: StoredPlaces = JSON.parse(raw);
    if (
      cached?.lat === lat && cached.lng === lng && Array.isArray(cached.restaurants) &&
      cached.restaurants.every((place) =>
        typeof place?.placeId === "string" && typeof place.name === "string" &&
        typeof place.category === "string" && typeof place.categoryPath === "string" &&
        typeof place.address === "string" && Number.isFinite(place.distance) &&
        Number.isFinite(place.location?.lat) && Number.isFinite(place.location?.lng)
      )
    ) return cached.restaurants;
  } catch {
    // ignore
  }
  return null;
}

export function setStoredPlaces(lat: number, lng: number, radius: number, restaurants: Restaurant[]) {
  try {
    sessionStorage.setItem(`${PLACES_PREFIX}${radius}`, JSON.stringify({ lat, lng, restaurants }));
  } catch {
    // ignore
  }
}

export function clearAllStorage() {
  try {
    sessionStorage.removeItem(LOCATION_KEY);
    sessionStorage.removeItem(CATEGORY_KEY);
    for (const radius of [100, 300, 500, 1000]) {
      sessionStorage.removeItem(`${PLACES_PREFIX}${radius}`);
      sessionStorage.removeItem(`baegopa:places:${radius}`);
    }
  } catch {
    // ignore
  }
}
