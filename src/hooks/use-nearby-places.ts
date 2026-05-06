"use client";

import { useCallback, useState } from "react";
import { getStoredPlaces, setStoredPlaces } from "@/lib/storage";
import type { Restaurant } from "@/types";

interface NearbyPlacesState {
  restaurants: Restaurant[];
  loading: boolean;
  error: string | null;
}

export function useNearbyPlaces() {
  const [state, setState] = useState<NearbyPlacesState>({
    restaurants: [],
    loading: false,
    error: null,
  });

  const fetchPlaces = useCallback(
    async (lat: number, lng: number, radius: number) => {
      const cached = getStoredPlaces(lat, lng, radius);
      if (cached && cached.length > 0) {
        setState({ restaurants: cached, loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const res = await fetch(
          `/api/places?lat=${lat}&lng=${lng}&radius=${radius}`
        );
        const data = await res.json();

        if (!res.ok) {
          setState({
            restaurants: [],
            loading: false,
            error: data.error || "검색 실패",
          });
          return;
        }

        if (data.restaurants.length === 0) {
          setState({
            restaurants: [],
            loading: false,
            error: "주변에 음식점이 없어요. 반경을 넓혀보세요!",
          });
          return;
        }

        setStoredPlaces(lat, lng, radius, data.restaurants);
        setState({ restaurants: data.restaurants, loading: false, error: null });
      } catch {
        setState({
          restaurants: [],
          loading: false,
          error: "네트워크 오류가 발생했어요",
        });
      }
    },
    []
  );

  return { ...state, fetchPlaces };
}
