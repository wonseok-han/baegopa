"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNearbyPlaces } from "@/hooks/use-nearby-places";
import { GAMES, getRandomGame } from "@/lib/game-registry";
import { GameIcon, DiceIcon } from "@/components/ui/game-icons";
import type { GameMeta, Restaurant } from "@/types";

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restaurants, loading, error, fetchPlaces } = useNearbyPlaces();
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const radius = searchParams.get("radius") || "1000";
  const gameId = searchParams.get("gameId");

  const [selectedGame, setSelectedGame] = useState<GameMeta | null>(() => {
    if (gameId) {
      return GAMES.find((g) => g.id === gameId) || null;
    }
    return null;
  });

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
        ...(selectedGame ? { gameId: selectedGame.id } : {}),
      });
      router.push(`/result?${params.toString()}`);
    },
    [router, selectedGame]
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

  if (!selectedGame) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold">게임을 골라봐</h2>
          <p className="mt-1 text-sm text-muted">
            {restaurants.length}개 음식점 중 하나를 뽑아줄게
          </p>
        </div>

        <div className="grid w-full max-w-xs grid-cols-2 gap-3">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-6 shadow-sm transition-all hover:border-primary hover:shadow-md active:scale-[0.97]"
            >
              <div className="rounded-xl bg-primary-light p-3 text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                <GameIcon name={game.icon} className="h-7 w-7" />
              </div>
              <div className="text-center">
                <span className="block text-sm font-semibold">
                  {game.name}
                </span>
                <span className="block text-xs text-muted">
                  {game.description}
                </span>
              </div>
            </button>
          ))}
          <button
            onClick={() => setSelectedGame(getRandomGame())}
            className="group col-span-2 flex items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-dim p-4 transition-all hover:border-primary hover:bg-primary-light active:scale-[0.97]"
          >
            <div className="text-muted transition-colors group-hover:text-primary">
              <DiceIcon className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-muted group-hover:text-primary">
              랜덤으로 고르기
            </span>
          </button>
        </div>

        <button
          onClick={() => router.push("/")}
          className="text-sm text-muted transition-colors hover:text-foreground"
        >
          처음으로
        </button>
      </div>
    );
  }

  const GameComponent = selectedGame.component;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h2 className="text-lg font-bold">{selectedGame.name}</h2>
      <GameComponent candidates={restaurants} onResult={handleResult} />
      <button
        onClick={() => setSelectedGame(null)}
        className="text-sm text-muted transition-colors hover:text-foreground"
      >
        다른 게임 선택
      </button>
    </div>
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
