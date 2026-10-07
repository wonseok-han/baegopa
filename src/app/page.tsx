"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getPlacesRequestKey, useNearbyPlaces } from "@/hooks/use-nearby-places";
import { FOOD_CATEGORIES, filterRestaurants, getFoodCategory } from "@/lib/food-categories";
import {
  getStoredLocation, setStoredLocation, getStoredFoodCategory,
  setStoredFoodCategory, clearAllStorage,
} from "@/lib/storage";
import type { FoodCategoryId } from "@/lib/food-categories";

const RADIUS_OPTIONS = [
  { value: 100, label: "100m" }, { value: 300, label: "300m" },
  { value: 500, label: "500m" }, { value: 1000, label: "1km" },
];
const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2";
interface SearchPlace { name: string; address: string; lat: number; lng: number }

export default function Home() {
  const router = useRouter();
  const { coordinates, error, loading, requestPermission, reset: resetGeolocation, setManualCoordinates } = useGeolocation();
  const nearby = useNearbyPlaces();
  const { fetchPlaces, cancel: cancelPlaces } = nearby;
  const [radius, setRadius] = useState(100);
  const [foodCategory, setFoodCategory] = useState<FoodCategoryId>("all");
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchPlace[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const currentQueryRef = useRef("");
  const [mapReady, setMapReady] = useState(false);
  const [mapUnavailable, setMapUnavailable] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);
  const circleRef = useRef<kakao.maps.Circle | null>(null);
  const locationMarkerRef = useRef<kakao.maps.Marker | null>(null);
  const markersRef = useRef<kakao.maps.Marker[]>([]);

  const selectedCategory = getFoodCategory(foodCategory);
  const requestKey = coordinates ? getPlacesRequestKey(coordinates.lat, coordinates.lng, radius) : null;
  const queryMatches = requestKey !== null && nearby.requestKey === requestKey;
  const placesLoading = !!coordinates && (!queryMatches || nearby.loading);
  const placesError = queryMatches ? nearby.error : null;
  const candidates = useMemo(
    () => queryMatches && !nearby.loading && !nearby.error ? filterRestaurants(nearby.restaurants, foodCategory) : [],
    [queryMatches, nearby.loading, nearby.error, nearby.restaurants, foodCategory]
  );
  const readyToPlay = !!coordinates && !placesLoading && !placesError && candidates.length > 0;

  useEffect(() => {
    const stored = getStoredLocation();
    // Restore after hydration, so server and first client render match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setRadius(stored.radius);
    setFoodCategory(getFoodCategory(getStoredFoodCategory()).id);
  }, []);

  useEffect(() => {
    if (!coordinates) return;
    setStoredLocation(coordinates.lat, coordinates.lng, radius);
    // The REST search works even without a map key or a loaded map SDK.
    void fetchPlaces(coordinates.lat, coordinates.lng, radius);
    return cancelPlaces;
  }, [coordinates, radius, fetchPlaces, cancelPlaces]);

  useEffect(() => {
    if (!coordinates) return;
    const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;
    if (!key) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMapUnavailable(true);
      return;
    }
    let active = true;
    const markUnavailable = () => { if (active) setMapUnavailable(true); };
    const loadMap = () => {
      if (!window.kakao?.maps) return markUnavailable();
      window.kakao.maps.load(() => {
        if (!active) return;
        clearTimeout(timeout);
        setMapReady(true);
        setMapUnavailable(false);
      });
    };
    const existing = document.getElementById("kakao-map-sdk") as HTMLScriptElement | null;
    const script = existing ?? document.createElement("script");
    const timeout = setTimeout(markUnavailable, 10_000);
    script.addEventListener("load", loadMap);
    script.addEventListener("error", markUnavailable);
    if (window.kakao?.maps) loadMap();
    else if (!existing) {
      script.id = "kakao-map-sdk";
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&autoload=false`;
      script.async = true;
      document.head.appendChild(script);
    }
    return () => {
      active = false;
      clearTimeout(timeout);
      script.removeEventListener("load", loadMap);
      script.removeEventListener("error", markUnavailable);
    };
  }, [coordinates]);

  useEffect(() => {
    if (!mapReady || !coordinates || !mapContainerRef.current) return;
    const position = new kakao.maps.LatLng(coordinates.lat, coordinates.lng);
    const level = radius <= 100 ? 3 : radius <= 300 ? 4 : radius <= 500 ? 5 : 6;
    if (!mapRef.current) mapRef.current = new kakao.maps.Map(mapContainerRef.current, { center: position, level });
    locationMarkerRef.current?.setMap(null);
    locationMarkerRef.current = new kakao.maps.Marker({ map: mapRef.current, position, title: "검색 기준 위치" });
    circleRef.current?.setMap(null);
    circleRef.current = new kakao.maps.Circle({
      center: position, radius, strokeWeight: 2, strokeColor: "#e85d24",
      strokeOpacity: 0.8, fillColor: "#e85d24", fillOpacity: 0.08,
    });
    circleRef.current.setMap(mapRef.current);
    mapRef.current.setLevel(level);
    mapRef.current.setCenter(position);
  }, [mapReady, coordinates, radius]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = candidates.map((restaurant) => new kakao.maps.Marker({
      map: mapRef.current!,
      position: new kakao.maps.LatLng(restaurant.location.lat, restaurant.location.lng),
      title: restaurant.name,
    }));
  }, [mapReady, coordinates, candidates]);

  const cancelSearch = useCallback(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchAbortRef.current?.abort();
    searchAbortRef.current = null;
    currentQueryRef.current = "";
    setSearching(false);
    setLoadingMore(false);
  }, []);

  const fetchSearchResults = useCallback(async (query: string, page: number, append: boolean) => {
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    if (append) setLoadingMore(true); else setSearching(true);
    setSearchError(null);
    const isCurrent = () => !controller.signal.aborted && searchAbortRef.current === controller && currentQueryRef.current === query;
    try {
      const res = await fetch(`/api/search?query=${encodeURIComponent(query)}&page=${page}`, { signal: controller.signal });
      const data = await res.json();
      if (!isCurrent()) return;
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "장소를 검색하지 못했어요");
      if (!Array.isArray(data.results)) throw new Error("검색 결과를 불러오지 못했어요");
      setSearchResults((prev) => append ? [...prev, ...data.results] : data.results);
      setHasMore(data.hasMore ?? false);
      setSearchPage(page);
      setSearchedQuery(query);
    } catch (requestError) {
      if (!isCurrent()) return;
      setSearchError(requestError instanceof Error ? requestError.message : "연결을 확인하고 다시 검색해주세요");
    } finally {
      if (isCurrent()) { setSearching(false); setLoadingMore(false); }
    }
  }, []);

  const handleSearchInput = (value: string) => {
    cancelSearch();
    setSearchQuery(value);
    setSearchResults([]);
    setSearchError(null);
    setSearchedQuery("");
    setHasMore(false);
    setSearchPage(1);
    const normalized = value.trim();
    currentQueryRef.current = normalized;
    if (normalized.length < 2) return;
    setSearching(true);
    searchTimerRef.current = setTimeout(() => { void fetchSearchResults(normalized, 1, false); }, 300);
  };

  const handleSelectPlace = (place: SearchPlace) => {
    cancelSearch();
    setManualCoordinates(place.lat, place.lng);
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setShowSearch(false);
  };

  const handleCategory = (category: FoodCategoryId) => {
    setFoodCategory(category);
    setStoredFoodCategory(category);
    setShowAllCandidates(false);
  };

  const handleReset = () => {
    cancelPlaces();
    cancelSearch();
    clearAllStorage();
    // A location change should not discard the food choice.
    setStoredFoodCategory(foodCategory);
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    locationMarkerRef.current?.setMap(null);
    locationMarkerRef.current = null;
    circleRef.current?.setMap(null);
    circleRef.current = null;
    mapRef.current = null;
    setSearchQuery("");
    setSearchResults([]);
    setSearchError(null);
    setSearchedQuery("");
    setHasMore(false);
    setShowSearch(false);
    setShowAllCandidates(false);
    resetGeolocation();
  };

  const handleStart = () => {
    if (!readyToPlay || !coordinates) return;
    setStoredLocation(coordinates.lat, coordinates.lng, radius);
    setStoredFoodCategory(foodCategory);
    router.push(`/play?${new URLSearchParams({ lat: String(coordinates.lat), lng: String(coordinates.lng), radius: String(radius), foodCategory })}`);
  };

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
  }, []);

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-5 pb-10 pt-9 sm:px-8">
      <header className="text-center">
        <p className="text-[10px] font-bold tracking-[0.24em] text-primary">A LITTLE GAME, A GOOD MEAL</p>
        <h1 className="mt-2 text-5xl font-extrabold tracking-tight text-primary">배고파</h1>
        <p className="mt-3 text-sm text-muted">먹고 싶은 음식부터, 마지막 선택은 핀볼로.</p>
        <ol aria-label="진행 순서" className="mt-5 flex justify-center gap-3 text-xs font-medium text-muted">
          <li className="text-primary">1 음식 선택</li><li aria-hidden="true">→</li>
          <li>2 후보 확인</li><li aria-hidden="true">→</li><li>3 핀볼</li>
        </ol>
      </header>

      <section aria-labelledby="category-heading" className="rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <h2 id="category-heading" className="text-base font-bold"><span className="mr-2 text-primary">01</span> 오늘은 뭐가 당겨요?</h2>
        <p className="mb-4 mt-1 text-xs text-muted">한 가지 골라주세요. 고민되면 전체도 좋아요.</p>
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {FOOD_CATEGORIES.map((category) => (
            <button key={category.id} type="button" aria-pressed={foodCategory === category.id}
              onClick={() => handleCategory(category.id)}
              className={`flex min-h-19 flex-col items-center justify-center gap-1.5 rounded-2xl border px-0.5 py-3 text-[10px] font-semibold transition-colors sm:text-xs ${FOCUS} ${foodCategory === category.id ? "border-primary bg-primary-light text-primary" : "border-transparent bg-surface-dim text-muted hover:border-border hover:text-foreground"}`}>
              <span aria-hidden="true" className="text-2xl">{category.icon}</span><span>{category.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="candidates-heading" className="flex flex-col gap-4 rounded-3xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 id="candidates-heading" className="text-base font-bold"><span className="mr-2 text-primary">02</span> 주변 후보 확인</h2>
          {coordinates && <button onClick={handleReset} className={`rounded-md px-1 py-2 text-xs text-muted hover:text-foreground ${FOCUS}`}>위치 변경</button>}
        </div>

        {!coordinates ? (
          <div className="flex flex-col gap-4">
            <div aria-label="위치 설정 방법" className="flex gap-1 rounded-full bg-surface-dim p-1">
              <button aria-pressed={!showSearch} onClick={() => { cancelSearch(); setShowSearch(false); }}
                className={`flex-1 rounded-full py-2.5 text-sm font-medium ${FOCUS} ${!showSearch ? "bg-primary text-white shadow-sm" : "text-muted"}`}>내 위치</button>
              <button aria-pressed={showSearch} onClick={() => { resetGeolocation(); setShowSearch(true); if (searchQuery.trim()) handleSearchInput(searchQuery); }}
                className={`flex-1 rounded-full py-2.5 text-sm font-medium ${FOCUS} ${showSearch ? "bg-primary text-white shadow-sm" : "text-muted"}`}>장소 검색</button>
            </div>
            {!showSearch ? (
              <div className="flex flex-col gap-3 text-center">
                <p className="text-xs text-muted">현재 위치 근처의 {selectedCategory.label === "전체" ? "음식점" : selectedCategory.label} 후보를 찾아요.</p>
                <button onClick={requestPermission} disabled={loading}
                  className={`w-full rounded-2xl bg-primary px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-50 ${FOCUS}`}>
                  {loading ? "위치 찾는 중…" : "내 위치로 음식점 찾기"}
                </button>
              </div>
            ) : (
              <div>
                <label htmlFor="place-search" className="sr-only">검색할 장소 또는 주소</label>
                <input id="place-search" type="search" value={searchQuery} maxLength={80}
                  onChange={(event) => handleSearchInput(event.target.value)}
                  placeholder="강남역, 홍대입구, 서울시 마포구…" autoComplete="off"
                  aria-describedby="search-status"
                  className={`w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-base placeholder:text-sm placeholder:text-muted ${FOCUS}`} />
                <p id="search-status" role="status" className="mt-2 text-xs text-muted">
                  {searching ? "장소 검색 중…" : searchQuery.trim().length < 2 ? "장소나 주소를 2글자 이상 입력해주세요." : searchedQuery === searchQuery.trim() && searchResults.length === 0 ? "검색 결과가 없어요. 다른 장소 이름을 입력해주세요." : "검색 결과에서 기준 위치를 선택해주세요."}
                </p>
                {searchError && <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">{searchError}</p>}
                {searchResults.length > 0 && (
                  <ul aria-label="장소 검색 결과" className="mt-3 max-h-64 divide-y divide-border overflow-y-auto rounded-2xl border border-border">
                    {searchResults.map((place, index) => (
                      <li key={`${place.lat}-${place.lng}-${index}`}>
                        <button onClick={() => handleSelectPlace(place)} className={`w-full px-4 py-3 text-left hover:bg-surface-dim ${FOCUS}`}>
                          <span className="block text-sm font-medium">{place.name}</span><span className="block text-xs text-muted">{place.address}</span>
                        </button>
                      </li>
                    ))}
                    {hasMore && <li><button onClick={() => { void fetchSearchResults(currentQueryRef.current, searchPage + 1, true); }} disabled={loadingMore}
                      className={`w-full py-3 text-sm font-medium text-primary disabled:opacity-50 ${FOCUS}`}>{loadingMore ? "더 불러오는 중…" : "장소 더 보기"}</button></li>}
                  </ul>
                )}
              </div>
            )}
            {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted">검색 반경</span>
              <div aria-label="검색 반경" className="flex rounded-full bg-surface-dim p-1">
                {RADIUS_OPTIONS.map((option) => (
                  <button key={option.value} aria-pressed={radius === option.value}
                    onClick={() => { setRadius(option.value); setShowAllCandidates(false); }}
                    className={`rounded-full px-3 py-2 text-xs font-semibold sm:px-4 ${FOCUS} ${radius === option.value ? "bg-primary text-white shadow-sm" : "text-muted hover:text-foreground"}`}>
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-dim">
              <div ref={mapContainerRef} role="img" aria-label="검색 위치와 선택한 음식점 후보 지도" className="h-40 w-full sm:h-44" />
              {!mapReady && <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-muted">
                {mapUnavailable ? "지도를 표시할 수 없어도 아래 후보에서 고를 수 있어요." : "지도 불러오는 중…"}
              </div>}
            </div>
            <div aria-live="polite" aria-busy={placesLoading}>
              {placesLoading ? <p className="py-5 text-center text-sm text-muted">반경 {radius}m 안의 음식점 찾는 중…</p> : placesError ? (
                <div className="rounded-2xl bg-surface-dim p-4 text-center">
                  <p role="alert" className="text-sm">{placesError}</p>
                  <button onClick={() => { void fetchPlaces(coordinates.lat, coordinates.lng, radius); }} className={`mt-3 rounded-full px-4 py-2 text-sm font-semibold text-primary ${FOCUS}`}>다시 불러오기</button>
                </div>
              ) : candidates.length === 0 ? (
                <div className="rounded-2xl bg-surface-dim p-5 text-center">
                  <p className="font-semibold">{selectedCategory.label} 후보가 아직 없어요</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted">현재 불러온 음식점 중 일치하는 후보가 없어요.<br />{radius < 1000 ? "반경을 넓히거나 다른 음식을 골라보세요." : "다른 음식을 고르거나 검색 위치를 바꿔보세요."}</p>
                  {radius < 1000 && <button onClick={() => setRadius(RADIUS_OPTIONS.find((option) => option.value > radius)!.value)}
                    className={`mt-3 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-primary ${FOCUS}`}>반경 넓히기</button>}
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">{selectedCategory.icon} {selectedCategory.label} 후보 <span className="text-primary">{candidates.length}곳</span></h3>
                    <span className="text-[10px] text-muted">불러온 {nearby.restaurants.length}곳 중</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {(showAllCandidates ? candidates : candidates.slice(0, 4)).map((restaurant) => (
                      <li key={restaurant.placeId} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0"><p className="truncate text-sm font-medium">{restaurant.name}</p><p className="mt-0.5 truncate text-xs text-muted">{restaurant.category}</p></div>
                        <span className="shrink-0 text-xs tabular-nums text-muted">{restaurant.distance}m</span>
                      </li>
                    ))}
                  </ul>
                  {candidates.length > 4 && <button aria-expanded={showAllCandidates} onClick={() => setShowAllCandidates(!showAllCandidates)}
                    className={`mt-1 w-full rounded-xl bg-surface-dim py-2.5 text-xs font-medium text-muted ${FOCUS}`}>{showAllCandidates ? "후보 접기" : `${candidates.length}곳 모두 보기`}</button>}
                  {candidates.length === 1 && <p className="mt-3 text-xs text-primary">후보가 한 곳이에요. 이 가게의 구슬로 핀볼을 즐겨보세요.</p>}
                </>
              )}
            </div>
            <p className="text-[10px] leading-relaxed text-muted">카카오맵 분류 기준이에요. 검색 결과는 주변의 모든 음식점을 포함하지 않을 수 있어요.</p>
          </>
        )}
      </section>

      <section aria-labelledby="play-heading" className="text-center">
        <h2 id="play-heading" className="mb-3 text-sm font-bold"><span className="mr-2 text-primary">03</span> 마지막 선택은 핀볼로</h2>
        <button onClick={handleStart} disabled={!readyToPlay}
          className={`w-full rounded-2xl bg-primary px-6 py-4 text-base font-bold text-white shadow-md transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-dim disabled:text-muted disabled:shadow-none ${FOCUS}`}>
          {readyToPlay ? `${selectedCategory.label} ${candidates.length}곳으로 핀볼 시작` : placesLoading ? "후보를 불러오고 있어요…" : "후보를 확인하고 핀볼 시작"}
        </button>
        <p className="mt-4 text-[10px] leading-relaxed text-muted">위치와 선택한 음식은 현재 탭에만 임시 저장돼요.</p>
      </section>
    </main>
  );
}
