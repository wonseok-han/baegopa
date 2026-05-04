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
        <p className="text-lg text-zinc-500">오늘의 선택은...</p>
        <h1 className="mt-2 text-4xl font-bold">🎉 {name}</h1>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 p-6 shadow-sm dark:border-zinc-700">
        <div className="flex flex-col gap-3">
          <div className="flex justify-between">
            <span className="text-zinc-500">카테고리</span>
            <span className="font-medium">{category}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">거리</span>
            <span className="font-medium">{distance}m</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">주소</span>
            <span className="text-right text-sm font-medium">{address}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {placeUrl && (
          <a
            href={placeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-yellow-400 px-8 py-3 text-center font-semibold text-zinc-900 transition-transform hover:scale-105 hover:bg-yellow-500 active:scale-95"
          >
            📍 카카오맵에서 보기
          </a>
        )}
        <button
          onClick={() => router.back()}
          className="rounded-full bg-orange-500 px-8 py-3 font-semibold text-white transition-transform hover:scale-105 hover:bg-orange-600 active:scale-95"
        >
          🔄 다시 고르기
        </button>
        <button
          onClick={() => router.push("/")}
          className="rounded-full border border-zinc-300 px-8 py-3 font-medium transition-transform hover:scale-105 dark:border-zinc-600"
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <ResultContent />
    </Suspense>
  );
}
