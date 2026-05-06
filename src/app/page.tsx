"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useGeolocation } from "@/hooks/use-geolocation";
import {
  getStoredLocation,
  setStoredLocation,
  getStoredPlaces,
  setStoredPlaces,
  clearAllStorage,
} from "@/lib/storage";
import type { Restaurant } from "@/types";

const RADIUS_OPTIONS = [
  { value: 100, label: "100m" },
  { value: 300, label: "300m" },
  { value: 500, label: "500m" },
  { value: 1000, label: "1km" },
];

const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_JS_KEY}&autoload=false`;

export default function Home() {
  const router = useRouter();
  const { coordinates, error, loading, requestPermission, reset: resetGeolocation, setManualCoordinates } = useGeolocation();
  const [radius, setRadius] = useState(() => {
    const stored = getStoredLocation();
    return stored ? stored.radius : 100;
  });
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ name: string; address: string; lat: number; lng: number }[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchListRef = useRef<HTMLUListElement>(null);
  const currentQueryRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const circleRef = useRef<kakao.maps.Circle | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);

  useEffect(() => {
    if (!coordinates) return;
    if (document.getElementById("kakao-map-sdk")) {
      if (window.kakao?.maps) {
        window.kakao.maps.load(() => setMapReady(true));
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "kakao-map-sdk";
    script.src = KAKAO_SDK_URL;
    script.async = true;
    script.onload = () => {
      window.kakao.maps.load(() => setMapReady(true));
    };
    document.head.appendChild(script);
  }, [coordinates]);

  useEffect(() => {
    if (!mapReady || !coordinates || !mapContainerRef.current) return;

    const position = new kakao.maps.LatLng(coordinates.lat, coordinates.lng);

    if (!mapRef.current) {
      const map = new kakao.maps.Map(mapContainerRef.current, {
        center: position,
        level: radius <= 100 ? 3 : radius <= 300 ? 4 : radius <= 500 ? 5 : 6,
      });

      new kakao.maps.Marker({
        map,
        position,
        title: "내 위치",
      });

      mapRef.current = map;
    }

    if (circleRef.current) {
      circleRef.current.setMap(null);
    }

    const circle = new kakao.maps.Circle({
      center: position,
      radius,
      strokeWeight: 2,
      strokeColor: "#e85d24",
      strokeOpacity: 0.8,
      fillColor: "#e85d24",
      fillOpacity: 0.08,
    });
    circle.setMap(mapRef.current);
    circleRef.current = circle;

    const level = radius <= 100 ? 3 : radius <= 300 ? 4 : radius <= 500 ? 5 : 6;
    mapRef.current.setLevel(level);
    mapRef.current.setCenter(position);
  }, [mapReady, coordinates, radius]);

  const updateMarkers = useCallback(
    (list: Restaurant[]) => {
      if (!mapRef.current) return;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = list.map((r) => {
        const marker = new kakao.maps.Marker({
          map: mapRef.current!,
          position: new kakao.maps.LatLng(r.location.lat, r.location.lng),
          title: r.name,
        });
        return marker;
      });
    },
    []
  );

  const fetchAndMarkRestaurants = useCallback(async () => {
    if (!coordinates) return;

    const cached = getStoredPlaces(coordinates.lat, coordinates.lng, radius);
    if (cached && cached.length > 0) {
      setRestaurants(cached);
      updateMarkers(cached);
      return;
    }

    try {
      const res = await fetch(
        `/api/places?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=${radius}`
      );
      const data = await res.json();
      if (res.ok && data.restaurants) {
        setRestaurants(data.restaurants);
        setStoredLocation(coordinates.lat, coordinates.lng, radius);
        setStoredPlaces(coordinates.lat, coordinates.lng, radius, data.restaurants);
        updateMarkers(data.restaurants);
      }
    } catch {
      // silently fail, user can proceed without markers
    }
  }, [coordinates, radius, updateMarkers]);

  useEffect(() => {
    if (mapReady && coordinates) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchAndMarkRestaurants();
    }
  }, [mapReady, coordinates, radius, fetchAndMarkRestaurants]);

  const handleStart = () => {
    if (!coordinates) return;
    setStoredLocation(coordinates.lat, coordinates.lng, radius);
    router.push(
      `/play?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=${radius}`
    );
  };

  const handleReset = () => {
    clearAllStorage();
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (circleRef.current) circleRef.current.setMap(null);
    circleRef.current = null;
    mapRef.current = null;
    setRestaurants([]);
    setMapReady(false);
    setRadius(100);
    setSearchQuery("");
    setSearchResults([]);
    setHasMore(false);
    setSearchPage(1);
    setShowSearch(false);
    resetGeolocation();
  };

  const fetchSearchResults = useCallback(async (query: string, page: number, append: boolean) => {
    if (append) setLoadingMore(true); else setSearching(true);
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&page=${page}`);
      const data = await res.json();
      if (res.ok && data.results) {
        setSearchResults((prev) => append ? [...prev, ...data.results] : data.results);
        setHasMore(data.hasMore ?? false);
        setSearchPage(page);
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }, []);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setHasMore(false);
      return;
    }
    currentQueryRef.current = value.trim();
    searchTimerRef.current = setTimeout(() => {
      fetchSearchResults(value.trim(), 1, false);
    }, 300);
  };

  const handleLoadMore = () => {
    if (loadingMore || !hasMore) return;
    fetchSearchResults(currentQueryRef.current, searchPage + 1, true);
  };

  const handleSearchScroll = () => {
    const el = searchListRef.current;
    if (!el || loadingMore || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      handleLoadMore();
    }
  };

  const handleSelectPlace = (place: { name: string; address: string; lat: number; lng: number }) => {
    setManualCoordinates(place.lat, place.lng);
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary">
          배고파
        </h1>
        <p className="mt-2 text-lg text-muted">뭐 먹지? 게임으로 골라줄게.</p>
      </div>

      {!coordinates && (
        <div className="flex w-full max-w-sm flex-col items-center gap-5">
          <div className="flex w-full gap-1 rounded-full bg-surface-dim p-1">
            <button
              onClick={() => setShowSearch(false)}
              className="relative flex-1 rounded-full py-2.5 text-sm font-medium transition-colors"
            >
              {!showSearch && (
                <motion.span
                  layoutId="location-tab"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${!showSearch ? "text-white" : "text-muted"}`}>
                내 위치
              </span>
            </button>
            <button
              onClick={() => setShowSearch(true)}
              className="relative flex-1 rounded-full py-2.5 text-sm font-medium transition-colors"
            >
              {showSearch && (
                <motion.span
                  layoutId="location-tab"
                  className="absolute inset-0 rounded-full bg-primary shadow-sm"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className={`relative z-10 ${showSearch ? "text-white" : "text-muted"}`}>
                장소 검색
              </span>
            </button>
          </div>

          <AnimatePresence mode="wait">
            {!showSearch ? (
              <motion.div
                key="gps"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex w-full flex-col items-center gap-3"
              >
                <p className="text-sm text-muted">GPS로 현재 위치를 찾아요</p>
                <button
                  onClick={requestPermission}
                  disabled={loading}
                  className="w-full rounded-full bg-primary px-8 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50"
                >
                  {loading ? "위치 찾는 중..." : "내 위치 찾기"}
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="search"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="relative w-full"
              >
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchInput(e.target.value)}
                    placeholder="강남역, 홍대입구, 서울시 마포구..."
                    className="w-full rounded-2xl border border-border bg-surface px-4 py-3.5 pr-10 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-3 top-3.5">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="h-4 w-4 rounded-full border-2 border-muted border-t-primary"
                      />
                    </div>
                  )}
                </div>
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.ul
                      ref={searchListRef}
                      onScroll={handleSearchScroll}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute z-10 mt-2 max-h-64 w-full overflow-y-auto overscroll-contain rounded-2xl border border-border bg-surface shadow-xl"
                    >
                      {searchResults.map((place, i) => (
                        <motion.li
                          key={`${place.lat}-${place.lng}-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i, 9) * 0.05 }}
                        >
                          <button
                            onClick={() => handleSelectPlace(place)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-dim"
                          >
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs text-primary">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">{place.name}</p>
                              <p className="truncate text-xs text-muted">{place.address}</p>
                            </div>
                          </button>
                        </motion.li>
                      ))}
                      {loadingMore && (
                        <li className="flex justify-center py-3">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="h-5 w-5 rounded-full border-2 border-muted border-t-primary"
                          />
                        </li>
                      )}
                      {!hasMore && searchResults.length >= 15 && (
                        <li className="py-2 text-center text-xs text-muted">
                          모든 결과를 불러왔어요
                        </li>
                      )}
                    </motion.ul>
                  )}
                </AnimatePresence>
                {searchQuery.length > 0 && searchQuery.length < 2 && (
                  <p className="mt-2 text-center text-xs text-muted">2글자 이상 입력해주세요</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {coordinates && (
        <div className="flex w-full max-w-md flex-col items-center gap-5">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
              위치 확인 완료
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-muted transition-colors hover:text-foreground"
            >
              위치 재설정
            </button>
          </div>

          <div
            ref={mapContainerRef}
            className="h-52 w-full overflow-hidden rounded-2xl border border-border shadow-sm"
          />

          {restaurants.length > 0 && (
            <p className="text-xs text-muted">
              반경 내 음식점 {restaurants.length}개 발견
            </p>
          )}

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-muted">반경</p>
            <div className="flex gap-1 rounded-full bg-surface-dim p-1">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className="relative rounded-full px-5 py-2 text-sm font-medium transition-colors"
                >
                  {radius === opt.value && (
                    <motion.span
                      layoutId="radius-indicator"
                      className="absolute inset-0 rounded-full bg-primary shadow-sm"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className={`relative z-10 ${radius === opt.value ? "text-white" : "text-muted hover:text-foreground"}`}>
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="w-full max-w-xs rounded-full bg-primary px-10 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95"
          >
            시작하기
          </button>
        </div>
      )}

      <p className="text-xs text-muted">
        위치 정보는 음식점 검색에만 사용되며 저장되지 않아요
      </p>
    </div>
  );
}
