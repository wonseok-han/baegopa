"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { parsePlacesParams } from "@/lib/api-guard";
import { getFoodCategory } from "@/lib/food-categories";
import { getSafeKakaoPlaceUrl } from "@/lib/place-url";
import { getStoredFoodCategory, getStoredLocation } from "@/lib/storage";

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const name = searchParams.get("name");
  const category = searchParams.get("category");
  const distance = searchParams.get("distance");
  const address = searchParams.get("address");
  const placeUrl = getSafeKakaoPlaceUrl(searchParams.get("placeUrl"));
  const selectedCategory = getFoodCategory(searchParams.get("foodCategory"));
  const distanceValue = distance?.trim() ? Number(distance) : NaN;
  const distanceLabel = Number.isFinite(distanceValue) && distanceValue >= 0 ? `${Math.round(distanceValue)}m` : "정보 없음";

  useEffect(() => { if (!name) router.replace("/"); }, [name, router]);

  const handleRetry = () => {
    const fromUrl = parsePlacesParams(searchParams);
    const location = fromUrl.ok ? fromUrl.value : getStoredLocation();
    if (!location) { router.push("/"); return; }
    const foodCategory = getFoodCategory(searchParams.get("foodCategory") ?? getStoredFoodCategory()).id;
    router.push(`/play?${new URLSearchParams({ lat: String(location.lat), lng: String(location.lng), radius: String(location.radius), foodCategory })}`);
  };

  if (!name) return null;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-7 px-6 py-10">
      <header className="max-w-sm text-center">
        <span aria-hidden="true" className="text-5xl">{selectedCategory.icon}</span>
        <p className="mt-4 text-xs font-bold tracking-widest text-primary">오늘의 한 끼, 결정!</p>
        <h1 className="mt-3 break-words text-3xl font-extrabold tracking-tight">{name}</h1>
        <p className="mt-2 text-sm text-muted">{selectedCategory.label} 후보에서 핀볼이 고른 한 곳</p>
      </header>
      <dl className="w-full max-w-sm divide-y divide-border overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-muted">음식 종류</dt><dd className="text-right text-sm font-medium">{category || "음식점"}</dd></div>
        <div className="flex items-center justify-between gap-4 px-5 py-4"><dt className="text-sm text-muted">거리</dt><dd className="text-sm font-medium">{distanceLabel}</dd></div>
        <div className="flex items-start justify-between gap-4 px-5 py-4"><dt className="shrink-0 text-sm text-muted">주소</dt><dd className="max-w-[220px] break-words text-right text-sm font-medium">{address || "정보 없음"}</dd></div>
      </dl>
      <div className="flex w-full max-w-sm flex-col gap-3">
        {placeUrl && <a href={placeUrl} target="_blank" rel="noopener noreferrer"
          className="rounded-2xl bg-[#fee500] px-6 py-4 text-center text-sm font-semibold text-[#191919] shadow-sm hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">카카오맵에서 보기 <span className="sr-only">(새 탭)</span></a>}
        <button onClick={handleRetry} className="rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-white shadow-sm hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">같은 음식으로 다시 핀볼</button>
        <button onClick={() => router.push("/")} className="rounded-full py-3 text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">음식 · 위치 다시 고르기</button>
      </div>
      <p className="max-w-sm text-center text-xs leading-relaxed text-muted">방문 전 영업시간과 메뉴는 카카오맵에서 확인해주세요.</p>
    </main>
  );
}

export default function ResultPage() {
  return <Suspense fallback={<div role="status" className="flex flex-1 items-center justify-center p-8 text-sm text-muted">결과 불러오는 중…</div>}><ResultContent /></Suspense>;
}
