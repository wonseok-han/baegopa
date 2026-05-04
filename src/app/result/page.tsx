"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function ResultContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const name = searchParams.get("name");
  const category = searchParams.get("category");
  const distance = searchParams.get("distance");
  const address = searchParams.get("address");
  const placeUrl = searchParams.get("placeUrl");

  if (!name) {
    router.replace("/");
    return null;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <p className="text-sm font-medium text-muted">오늘의 선택</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{name}</h1>
      </div>

      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="divide-y divide-border">
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-muted">카테고리</span>
            <span className="text-sm font-medium">{category}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-muted">거리</span>
            <span className="text-sm font-medium">{distance}m</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-sm text-muted">주소</span>
            <span className="text-right text-sm font-medium max-w-[200px]">
              {address}
            </span>
          </div>
        </div>
      </div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {placeUrl && (
          <a
            href={placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 rounded-full bg-[#fee500] px-8 py-3.5 text-sm font-semibold text-[#191919] shadow-sm transition-all hover:brightness-95 active:scale-95"
          >
            카카오맵에서 보기
          </a>
        )}
        <button
          onClick={() => router.back()}
          className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-hover active:scale-95"
        >
          다시 고르기
        </button>
        <button
          onClick={() => router.push("/")}
          className="rounded-full border border-border px-8 py-3.5 text-sm font-medium transition-all hover:bg-surface-dim active:scale-95"
        >
          처음으로
        </button>
      </div>
    </div>
  );
}

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-primary border-t-transparent" />
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
