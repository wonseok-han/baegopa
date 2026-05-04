"use client";

import { useState, useCallback } from "react";
import type { GameProps } from "@/types";

export function RouletteGame({ candidates, onResult }: GameProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);

  const segmentAngle = 360 / candidates.length;

  const spin = useCallback(() => {
    if (spinning) return;

    const winnerIndex = Math.floor(Math.random() * candidates.length);
    const extraSpins = 5 + Math.random() * 3;
    const targetAngle =
      extraSpins * 360 + (360 - winnerIndex * segmentAngle - segmentAngle / 2);

    setSpinning(true);
    setRotation(targetAngle);

    setTimeout(() => {
      setSpinning(false);
      onResult(candidates[winnerIndex]);
    }, 4000);
  }, [spinning, candidates, segmentAngle, onResult]);

  const colors = [
    "bg-orange-400",
    "bg-emerald-400",
    "bg-sky-400",
    "bg-violet-400",
    "bg-rose-400",
    "bg-amber-400",
    "bg-teal-400",
    "bg-indigo-400",
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        {/* Pointer */}
        <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 text-3xl">
          ▼
        </div>

        {/* Wheel */}
        <div
          className="relative h-72 w-72 rounded-full border-4 border-zinc-300 shadow-lg overflow-hidden"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: spinning
              ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
              : "none",
          }}
        >
          {candidates.map((restaurant, i) => (
            <div
              key={restaurant.placeId}
              className={`absolute top-0 left-0 h-full w-full ${colors[i % colors.length]}`}
              style={{
                clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(((i * segmentAngle - 90) * Math.PI) / 180)}% ${50 + 50 * Math.sin(((i * segmentAngle - 90) * Math.PI) / 180)}%, ${50 + 50 * Math.cos((((i + 1) * segmentAngle - 90) * Math.PI) / 180)}% ${50 + 50 * Math.sin((((i + 1) * segmentAngle - 90) * Math.PI) / 180)}%)`,
              }}
            >
              <span
                className="absolute text-xs font-bold text-white drop-shadow-md"
                style={{
                  top: "25%",
                  left: "50%",
                  transform: `rotate(${i * segmentAngle + segmentAngle / 2}deg) translateY(-20px)`,
                  transformOrigin: "0 100px",
                }}
              >
                {restaurant.name.length > 6
                  ? restaurant.name.slice(0, 6) + "…"
                  : restaurant.name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="rounded-full bg-orange-500 px-8 py-3 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-orange-600 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
      >
        {spinning ? "돌아가는 중..." : "돌리기! 🎯"}
      </button>
    </div>
  );
}
