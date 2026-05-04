"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { GameProps } from "@/types";

const SEGMENT_COLORS = [
  "#e85d24",
  "#2a9d8f",
  "#4a90d9",
  "#7c5cbf",
  "#d94f6b",
  "#d4a035",
  "#3bb58f",
  "#6366f1",
];

export function RouletteGame({ candidates, onResult }: GameProps) {
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [currentName, setCurrentName] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const rafRef = useRef<number>(0);

  const segmentAngle = 360 / candidates.length;
  const fontSize = candidates.length <= 6 ? 14 : candidates.length <= 10 ? 12 : 10;
  const maxChars = candidates.length <= 6 ? 7 : candidates.length <= 10 ? 6 : 5;

  useEffect(() => {
    if (!spinning) {
      return;
    }

    const track = () => {
      const svg = svgRef.current;
      if (!svg) return;

      const computed = window.getComputedStyle(svg);
      const transform = computed.transform;

      if (transform && transform !== "none") {
        const match = transform.match(/matrix\((.+)\)/);
        if (match) {
          const [a, b] = match[1].split(",").map(Number);
          const angle = Math.atan2(b, a) * (180 / Math.PI);
          const normalized = ((angle % 360) + 360) % 360;
          const pointerPos = (360 - normalized) % 360;
          const idx =
            Math.floor(pointerPos / segmentAngle) % candidates.length;
          setCurrentName(candidates[idx].name);
        }
      }

      rafRef.current = requestAnimationFrame(track);
    };

    rafRef.current = requestAnimationFrame(track);
    return () => cancelAnimationFrame(rafRef.current);
  }, [spinning, candidates, segmentAngle]);

  const spin = useCallback(() => {
    if (spinning) return;

    const extraSpins = 5 + Math.random() * 3;
    const randomOffset = Math.random() * 360;
    const targetAngle = rotation + extraSpins * 360 + randomOffset;

    const effectiveAngle = targetAngle % 360;
    const pointerPos = (360 - effectiveAngle + 360) % 360;
    const winnerIndex =
      Math.floor(pointerPos / segmentAngle) % candidates.length;

    setSpinning(true);
    setRotation(targetAngle);

    setTimeout(() => {
      setSpinning(false);
      setCurrentName(candidates[winnerIndex].name);
      onResult(candidates[winnerIndex]);
    }, 4200);
  }, [spinning, rotation, candidates, segmentAngle, onResult]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="h-8 flex items-center justify-center">
        {spinning ? (
          <span className="text-lg font-bold text-primary truncate max-w-[200px]">
            {currentName}
          </span>
        ) : (
          <span className="text-sm text-muted">포인터가 가리키는 곳은?</span>
        )}
      </div>

      <div className="relative">
        {/* Pointer */}
        <svg
          viewBox="0 0 24 20"
          className="absolute -top-5 left-1/2 z-10 h-6 w-6 -translate-x-1/2 drop-shadow-md"
        >
          <path d="M12 20 L2 2 L22 2 Z" fill="var(--primary)" />
        </svg>

        {/* Wheel */}
        <div className="rounded-full p-1 shadow-xl bg-gradient-to-b from-zinc-200 to-zinc-300 dark:from-zinc-600 dark:to-zinc-700">
          <svg
            ref={svgRef}
            viewBox="0 0 300 300"
            className="h-72 w-72"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning
                ? "transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)"
                : "none",
            }}
          >
            {candidates.map((restaurant, i) => {
              const startAngle = i * segmentAngle - 90;
              const endAngle = (i + 1) * segmentAngle - 90;
              const startRad = (startAngle * Math.PI) / 180;
              const endRad = (endAngle * Math.PI) / 180;
              const x1 = 150 + 148 * Math.cos(startRad);
              const y1 = 150 + 148 * Math.sin(startRad);
              const x2 = 150 + 148 * Math.cos(endRad);
              const y2 = 150 + 148 * Math.sin(endRad);
              const largeArc = segmentAngle > 180 ? 1 : 0;

              const midAngleDeg = (startAngle + endAngle) / 2;
              const midAngleRad = midAngleDeg * (Math.PI / 180);
              const textX = 150 + 90 * Math.cos(midAngleRad);
              const textY = 150 + 90 * Math.sin(midAngleRad);

              const normAngle = ((midAngleDeg % 360) + 360) % 360;
              const flip = normAngle > 90 && normAngle < 270;
              const textRotation = flip ? midAngleDeg + 180 : midAngleDeg;

              const label =
                restaurant.name.length > maxChars
                  ? restaurant.name.slice(0, maxChars) + "…"
                  : restaurant.name;

              return (
                <g key={restaurant.placeId}>
                  <path
                    d={`M150,150 L${x1},${y1} A148,148 0 ${largeArc},1 ${x2},${y2} Z`}
                    fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]}
                  />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    transform={`rotate(${textRotation}, ${textX}, ${textY})`}
                    className="fill-white font-bold"
                    style={{ fontSize: `${fontSize}px`, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            <circle cx="150" cy="150" r="18" fill="white" />
            <circle
              cx="150"
              cy="150"
              r="15"
              fill="var(--primary)"
              className="drop-shadow-sm"
            />
          </svg>
        </div>
      </div>

      <button
        onClick={spin}
        disabled={spinning}
        className="rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {spinning ? "돌아가는 중..." : "돌리기"}
      </button>
    </div>
  );
}
