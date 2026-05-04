import type { Restaurant } from "@/types";

const LOCATION_KEY = "baegopa:location";
const PLACES_KEY = "baegopa:places";

interface StoredLocation {
  lat: number;
  lng: number;
  radius: number;
}

interface StoredPlaces {
  restaurants: Restaurant[];
  lat: number;
  lng: number;
  radius: number;
}

export function getStoredLocation(): StoredLocation | null {
  try {
    const raw = sessionStorage.getItem(LOCATION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredLocation(lat: number, lng: number, radius: number) {
  try {
    sessionStorage.setItem(LOCATION_KEY, JSON.stringify({ lat, lng, radius }));
  } catch {
    // ignore
  }
}

export function getStoredPlaces(
  lat: number,
  lng: number,
  radius: number
): Restaurant[] | null {
  try {
    const raw = sessionStorage.getItem(PLACES_KEY);
    if (!raw) return null;
    const cached: StoredPlaces = JSON.parse(raw);
    if (cached.lat === lat && cached.lng === lng && cached.radius === radius) {
      return cached.restaurants;
    }
  } catch {
    // ignore
  }
  return null;
}

export function setStoredPlaces(
  lat: number,
  lng: number,
  radius: number,
  restaurants: Restaurant[]
) {
  try {
    sessionStorage.setItem(
      PLACES_KEY,
      JSON.stringify({ lat, lng, radius, restaurants })
    );
  } catch {
    // ignore
  }
}

export function clearAllStorage() {
  try {
    sessionStorage.removeItem(LOCATION_KEY);
    sessionStorage.removeItem(PLACES_KEY);
  } catch {
    // ignore
  }
}
