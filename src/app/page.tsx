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
    <div className="flex flex-1 flex-col items-center justify-center gap-10 p-8">
      <div className="text-center">
        <h1 className="text-5xl font-extrabold tracking-tight text-primary">
          배고파
        </h1>
        <p className="mt-2 text-lg text-muted">뭐 먹지? 게임으로 골라줄게.</p>
      </div>

      {!coordinates && (
        <button
          onClick={requestPermission}
          disabled={loading}
          className="rounded-full bg-primary px-8 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50"
        >
          {loading ? "위치 찾는 중..." : "내 위치 찾기"}
        </button>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      {coordinates && (
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            위치 확인 완료
          </div>

          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-medium text-muted">반경</p>
            <div className="flex gap-2 rounded-full bg-surface-dim p-1">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRadius(opt.value)}
                  className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                    radius === opt.value
                      ? "bg-primary text-white shadow-sm"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStart}
            className="rounded-full bg-primary px-10 py-4 text-lg font-semibold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95"
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
