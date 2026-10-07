"use client";

import { Suspense, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PinballGame } from "@/components/games/pinball";
import { getPlacesRequestKey, useNearbyPlaces } from "@/hooks/use-nearby-places";
import { parsePlacesParams } from "@/lib/api-guard";
import { filterRestaurants, getFoodCategory, isFoodCategoryId } from "@/lib/food-categories";
import { setStoredFoodCategory, setStoredLocation } from "@/lib/storage";
import type { Restaurant } from "@/types";

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const nearby = useNearbyPlaces();
  const { fetchPlaces, cancel } = nearby;
  const lat = searchParams.get("lat") ?? "";
  const lng = searchParams.get("lng") ?? "";
  const radius = searchParams.get("radius") ?? "1000";
  const categoryId = searchParams.get("foodCategory") ?? "all";
  const selectedCategory = getFoodCategory(categoryId);
  const validCategory = isFoodCategoryId(categoryId);
  const location = useMemo(() => parsePlacesParams(new URLSearchParams({ lat, lng, radius })), [lat, lng, radius]);
  const requestKey = location.ok ? getPlacesRequestKey(location.value.lat, location.value.lng, location.value.radius) : null;
  const queryMatches = requestKey !== null && requestKey === nearby.requestKey;
  const loading = location.ok && validCategory && (!queryMatches || nearby.loading);
  const error = !location.ok ? "검색 위치나 반경이 올바르지 않아요. 다시 설정해주세요." : !validCategory ? "선택한 음식 분류를 찾을 수 없어요. 다시 골라주세요." : queryMatches ? nearby.error : null;
  const candidates = useMemo(
    () => queryMatches && !nearby.loading && !nearby.error ? filterRestaurants(nearby.restaurants, selectedCategory.id) : [],
    [queryMatches, nearby.loading, nearby.error, nearby.restaurants, selectedCategory.id]
  );

  useEffect(() => {
    if (!location.ok || !validCategory) return;
    const { lat, lng, radius } = location.value;
    setStoredLocation(lat, lng, radius);
    setStoredFoodCategory(selectedCategory.id);
    void fetchPlaces(lat, lng, radius);
    return cancel;
  }, [location, validCategory, selectedCategory.id, fetchPlaces, cancel]);

  const handleResult = useCallback((selected: Restaurant) => {
    const params = new URLSearchParams({
      placeId: selected.placeId, name: selected.name, category: selected.category,
      distance: String(selected.distance), address: selected.address,
      foodCategory: selectedCategory.id, lat, lng, radius,
      ...(selected.placeUrl ? { placeUrl: selected.placeUrl } : {}),
    });
    router.push(`/result?${params}`);
  }, [router, selectedCategory.id, lat, lng, radius]);

  if (loading) {
    return (
      <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div aria-hidden="true" className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-sm text-muted">{selectedCategory.label} 후보를 확인하고 있어요…</p>
      </div>
    );
  }

  if (error || candidates.length === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
        <span aria-hidden="true" className="text-4xl">{selectedCategory.icon}</span>
        <h1 className="text-lg font-bold">{error ? "후보를 불러오지 못했어요" : `${selectedCategory.label} 후보가 없어요`}</h1>
        <p role={error ? "alert" : "status"} className="max-w-sm text-sm leading-relaxed text-muted">{error ?? "현재 검색 결과에 일치하는 음식점이 없어요. 음식 종류나 위치, 반경을 바꿔보세요."}</p>
        <button onClick={() => router.push("/")}
          className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
          음식 · 위치 다시 고르기
        </button>
        {location.ok && validCategory && error && <button onClick={() => { void fetchPlaces(location.value.lat, location.value.lng, location.value.radius); }}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">다시 불러오기</button>}
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center bg-[radial-gradient(circle_at_top,#fff8eb_0%,#f5ead9_46%,#ead9c3_100%)] px-3 pb-8 pt-4 dark:bg-[radial-gradient(circle_at_top,#2a2018_0%,#17120e_60%,#110d0a_100%)]">
      <div className="mb-3 flex w-full max-w-[410px] items-center justify-between gap-3 px-1">
        <button onClick={() => router.push("/")} aria-label="음식과 후보 다시 고르기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#dcc5a8] bg-[#fffaf0]/80 text-[#6d4933] shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary dark:border-[#503e30] dark:bg-[#251d17] dark:text-[#c9ad91]">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden="true"><path d="m14.5 6-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#b26342]">03 · PICK WITH PINBALL</p>
          <h1 className="mt-1 text-base font-black tracking-tight text-[#4d2f20] dark:text-[#f3e4d3]">{selectedCategory.icon} {selectedCategory.label} 핀볼</h1>
        </div>
        <span aria-label={`음식점 후보 ${candidates.length}곳`} className="rounded-full border border-[#dcc5a8] bg-[#fffaf0]/70 px-3 py-2 text-xs font-black text-[#b26342] dark:border-[#503e30] dark:bg-[#251d17]">{candidates.length}곳</span>
      </div>
      <p className="mb-4 text-center text-xs text-[#826044] dark:text-[#c9ad91]">{candidates.length === 1 ? "후보 한 곳의 구슬로 오늘의 한 끼를 만나봐요." : "확인한 후보들, 이제 구슬에게 맡겨봐요."}</p>
      <PinballGame key={`${requestKey}:${selectedCategory.id}`} candidates={candidates} onResult={handleResult} />
    </main>
  );
}

export default function PlayPage() {
  return <Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center p-8 text-sm text-muted">핀볼 준비 중…</div>}><PlayContent /></Suspense>;
}
