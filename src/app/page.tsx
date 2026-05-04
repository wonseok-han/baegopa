"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGeolocation } from "@/hooks/use-geolocation";

const RADIUS_OPTIONS = [
  { value: 500, label: "500m" },
  { value: 1000, label: "1km" },
  { value: 2000, label: "2km" },
];

export default function Home() {
  const router = useRouter();
  const { coordinates, error, loading, requestPermission } = useGeolocation();
  const [radius, setRadius] = useState(1000);

  const handleStart = () => {
    if (!coordinates) return;
    router.push(
      `/play?lat=${coordinates.lat}&lng=${coordinates.lng}&radius=${radius}`
    );
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">🍚 배고파</h1>
        <p className="mt-3 text-xl text-zinc-500 dark:text-zinc-400">
          뭐 먹지? 게임으로 골라줄게!
        </p>
      </div>

      {!coordinates && (
        <button
          onClick={requestPermission}
          disabled={loading}
          className="rounded-full bg-orange-500 px-8 py-4 text-lg font-semibold text-white transition-transform hover:scale-105 hover:bg-orange-600 active:scale-95 disabled:opacity-50"
        >
          {loading ? "위치 찾는 중..." : "📍 내 위치 찾기"}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      {coordinates && (
        <div className="flex flex-col items-center gap-6">
          <p className="text-sm text-emerald-600 dark:text-emerald-400">
            ✓ 위치 확인 완료!
          </p>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
              반경 선택
            </p>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    radius === opt.value
                      ? "bg-orange-500 text-white scale-105"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="rounded-full bg-orange-500 px-8 py-4 text-lg font-semibold text-white transition-transform hover:scale-105 hover:bg-orange-600 active:scale-95"
          >
            🎮 게임 시작!
          </button>
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        위치 정보는 음식점 검색에만 사용되며 저장되지 않아요
      </p>
    </div>
  );
}
