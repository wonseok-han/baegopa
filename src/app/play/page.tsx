"use client";

import { Suspense, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PinballGame } from "@/components/games/pinball";
import { useNearbyPlaces } from "@/hooks/use-nearby-places";
import type { Restaurant } from "@/types";

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restaurants, loading, error, fetchPlaces } = useNearbyPlaces();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "1000";

  useEffect(() => {
    if (lat && lng) {
      fetchPlaces(parseFloat(lat), parseFloat(lng), parseInt(radius));
    }
  }, [lat, lng, radius, fetchPlaces]);

  const handleResult = useCallback(
    (selected: Restaurant) => {
      const params = new URLSearchParams({
        placeId: selected.placeId,
        name: selected.name,
        category: selected.category,
        distance: String(selected.distance),
        address: selected.address,
        ...(selected.placeUrl ? { placeUrl: selected.placeUrl } : {}),
      });
      router.push(`/result?${params.toString()}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        <p className="text-muted">주변 음식점 찾는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
        <div className="rounded-full bg-surface-dim p-4">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-muted">
            <path
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-center text-muted">{error}</p>
        <button
          onClick={() => router.push("/")}
          className="rounded-full bg-surface-dim px-6 py-2.5 text-sm font-medium transition-colors hover:bg-border"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!loading && restaurants.length < 2 && !error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8">
        <div className="rounded-full bg-surface-dim p-4">
          <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8 text-muted">
            <path
              d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className="text-center">
          <p className="font-medium">음식점이 부족해요</p>
          <p className="mt-1 text-sm text-muted">
            반경을 늘려서 다시 시도해보세요
          </p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-primary-hover active:scale-95"
        >
          반경 재설정
        </button>
      </div>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center bg-[radial-gradient(circle_at_top,#fff8eb_0%,#f5ead9_46%,#ead9c3_100%)] px-3 pb-8 pt-4 dark:bg-[radial-gradient(circle_at_top,#2a2018_0%,#17120e_60%,#110d0a_100%)]">
      <div className="mb-3 flex w-full max-w-[410px] items-center justify-between px-1">
        <button
          onClick={() => router.push("/")}
          aria-label="위치 다시 설정"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dcc5a8] bg-[#fffaf0]/80 text-[#6d4933] shadow-sm transition-colors hover:bg-white dark:border-[#503e30] dark:bg-[#251d17] dark:text-[#c9ad91]"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="m14.5 6-6 6 6 6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="text-center">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#b26342]">
            Baegopa Arcade
          </p>
          <h1 className="text-sm font-black tracking-tight text-[#4d2f20] dark:text-[#f3e4d3]">
            배고파 마블런
          </h1>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-[#dcc5a8] bg-[#fffaf0]/70 text-[10px] font-black text-[#b26342] dark:border-[#503e30] dark:bg-[#251d17]">
          {restaurants.length > 999 ? "999+" : restaurants.length}
        </div>
      </div>
      <PinballGame candidates={restaurants} onResult={handleResult} />
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
