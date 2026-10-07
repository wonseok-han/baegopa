"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getStoredPlaces, setStoredPlaces } from "@/lib/storage";
import type { Restaurant } from "@/types";

interface NearbyPlacesState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
  requestKey: string | null;
}

export function getPlacesRequestKey(lat: number, lng: number, radius: number) {
  return `${lat}:${lng}:${radius}`;
}

export function useNearbyPlaces() {
  const abortRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<NearbyPlacesState>({
    restaurants: [], loading: false, error: null, requestKey: null,
  });

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const fetchPlaces = useCallback(async (lat: number, lng: number, radius: number) => {
    abortRef.current?.abort();
    // Invalidate the previous request before even taking the cache path.
    const controller = new AbortController();
    abortRef.current = controller;
    const requestKey = getPlacesRequestKey(lat, lng, radius);
    const cached = getStoredPlaces(lat, lng, radius);
    if (cached !== null) {
      setState({ restaurants: cached, loading: false, error: null, requestKey });
      return;
    }

    setState({ restaurants: [], loading: true, error: null, requestKey });
    try {
      const res = await fetch(`/api/places?lat=${lat}&lng=${lng}&radius=${radius}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (controller.signal.aborted || abortRef.current !== controller) return;
      if (!res.ok) {
        setState({
          restaurants: [], loading: false, requestKey,
          error: typeof data.error === "string" ? data.error : "음식점을 불러오지 못했어요",
        });
        return;
      }
      if (!Array.isArray(data.restaurants)) throw new Error("Invalid places response");
      setStoredPlaces(lat, lng, radius, data.restaurants);
      setState({ restaurants: data.restaurants, loading: false, error: null, requestKey });
    } catch {
      // A stale rejection must not overwrite a newer request or cached response.
      if (controller.signal.aborted || abortRef.current !== controller) return;
      setState({
        restaurants: [], loading: false, requestKey,
        error: "음식점을 불러오지 못했어요. 연결을 확인하고 다시 시도해주세요.",
      });
    }
  }, []);

  useEffect(() => cancel, [cancel]);
  return { ...state, fetchPlaces, cancel };
}
