"use client";

import { useCallback, useState } from "react";
import { getStoredLocation } from "@/lib/storage";

interface GeolocationState {
  coordinates: { lat: number; lng: number } | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>(() => {
    const stored = getStoredLocation();
    if (stored) {
      return { coordinates: { lat: stored.lat, lng: stored.lng }, error: null, loading: false };
    }
    return { coordinates: null, error: null, loading: false };
  });

  const requestPermission = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "이 브라우저에서는 위치 정보를 사용할 수 없어요",
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          coordinates: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          },
          error: null,
          loading: false,
        });
      },
      (err) => {
        let message = "위치 정보를 가져올 수 없어요";
        if (err.code === err.PERMISSION_DENIED) {
          message = "위치 권한을 허용해주세요";
        }
        setState({ coordinates: null, error: message, loading: false });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  return { ...state, requestPermission };
}
