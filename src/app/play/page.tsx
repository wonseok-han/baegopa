"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useNearbyPlaces } from "@/hooks/use-nearby-places";
import { GAMES, getRandomGame } from "@/lib/game-registry";
import type { GameMeta, Restaurant } from "@/types";

function PlayContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { restaurants, loading, error, fetchPlaces } = useNearbyPlaces();
  const [selectedGame, setSelectedGame] = useState<GameMeta | null>(null);

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
        lat: String(selected.location.lat),
        lng: String(selected.location.lng),
        ...(selected.rating ? { rating: String(selected.rating) } : {}),
      });
      router.push(`/result?${params.toString()}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        <p className="text-zinc-500">주변 음식점 찾는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-lg">😢</p>
        <p className="text-zinc-600 dark:text-zinc-400">{error}</p>
        <button
          onClick={() => router.back()}
          className="rounded-full bg-zinc-200 px-6 py-2 text-sm dark:bg-zinc-700"
        >
          돌아가기
        </button>
      </div>
    );
  }

  if (!selectedGame) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
        <h2 className="text-2xl font-bold">🎮 게임을 골라봐!</h2>
        <div className="grid grid-cols-2 gap-4">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game)}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-zinc-200 p-6 transition-all hover:scale-105 hover:border-orange-400 hover:shadow-lg dark:border-zinc-700"
            >
              <span className="text-4xl">{game.icon}</span>
              <span className="font-bold">{game.name}</span>
              <span className="text-xs text-zinc-500">{game.description}</span>
            </button>
          ))}
          <button
            onClick={() => setSelectedGame(getRandomGame())}
            className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 p-6 transition-all hover:scale-105 hover:border-orange-400 dark:border-zinc-600"
          >
            <span className="text-4xl">🎲</span>
            <span className="font-bold">랜덤</span>
            <span className="text-xs text-zinc-500">아무거나!</span>
          </button>
        </div>
        <p className="text-sm text-zinc-400">
          {restaurants.length}개 음식점을 찾았어요
        </p>
      </div>
    );
  }

  const GameComponent = selectedGame.component;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h2 className="text-xl font-bold">
        {selectedGame.icon} {selectedGame.name}
      </h2>
      <GameComponent candidates={restaurants} onResult={handleResult} />
      <button
        onClick={() => setSelectedGame(null)}
        className="text-sm text-zinc-400 underline hover:text-zinc-600"
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
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <PlayContent />
    </Suspense>
  );
}
