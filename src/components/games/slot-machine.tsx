"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import type { GameProps } from "@/types";

function Reel({
  items,
  finalIndex,
  spinning,
  delay,
}: {
  items: string[];
  finalIndex: number;
  spinning: boolean;
  delay: number;
}) {
  const [currentOffset, setCurrentOffset] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (spinning) {
      let tick = 0;
      intervalRef.current = setInterval(() => {
        tick++;
        setCurrentOffset(tick % items.length);
      }, 80);

      setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setCurrentOffset(finalIndex);
      }, 1500 + delay);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [spinning, finalIndex, delay, items.length]);

  const displayIndex = currentOffset;
  const prevIndex = (displayIndex - 1 + items.length) % items.length;
  const nextIndex = (displayIndex + 1) % items.length;

  return (
    <div className="flex h-32 w-20 sm:h-40 sm:w-28 flex-col items-center justify-center overflow-hidden rounded-xl bg-white shadow-inner dark:bg-zinc-900">
      <motion.div
        className="flex flex-col items-center gap-1"
        animate={{ y: spinning ? [0, -4, 0] : 0 }}
        transition={{ repeat: spinning ? Infinity : 0, duration: 0.1 }}
      >
        <span className="truncate w-16 sm:w-24 text-center text-[10px] sm:text-xs text-muted/50 py-1.5 sm:py-2">
          {items[prevIndex]}
        </span>
        <span className="truncate w-16 sm:w-24 text-center text-xs sm:text-sm font-bold py-2 sm:py-3 border-y border-primary/30 text-foreground">
          {items[displayIndex]}
        </span>
        <span className="truncate w-16 sm:w-24 text-center text-[10px] sm:text-xs text-muted/50 py-1.5 sm:py-2">
          {items[nextIndex]}
        </span>
      </motion.div>
    </div>
  );
}

function Lever({ pulled, onPull }: { pulled: boolean; onPull: () => void }) {
  return (
    <div
      className="cursor-pointer select-none"
      style={{ perspective: "400px" }}
      onClick={onPull}
    >
      <motion.div
        style={{ transformOrigin: "center bottom" }}
        animate={{ rotateX: pulled ? -55 : 0 }}
        transition={
          pulled
            ? { type: "tween", duration: 0.35, ease: [0.32, 0, 0.67, 0] }
            : { type: "spring", stiffness: 500, damping: 10 }
        }
      >
        <svg
          viewBox="0 0 60 180"
          className="h-36 sm:h-40 w-10 sm:w-12 drop-shadow-lg"
        >
          <defs>
            <linearGradient id="lever-shaft" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#9ca3af" />
              <stop offset="30%" stopColor="#e5e7eb" />
              <stop offset="50%" stopColor="#f9fafb" />
              <stop offset="70%" stopColor="#d1d5db" />
              <stop offset="100%" stopColor="#6b7280" />
            </linearGradient>
            <linearGradient id="lever-ball" x1="0.2" y1="0.1" x2="0.8" y2="0.9">
              <stop offset="0%" stopColor="#fca5a5" />
              <stop offset="30%" stopColor="#ef4444" />
              <stop offset="70%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </linearGradient>
            <linearGradient id="lever-bracket" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#71717a" />
              <stop offset="50%" stopColor="#52525b" />
              <stop offset="100%" stopColor="#3f3f46" />
            </linearGradient>
            <filter id="lever-shadow">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Shaft */}
          <rect
            x="25"
            y="10"
            width="10"
            height="145"
            rx="5"
            fill="url(#lever-shaft)"
          />
          <rect
            x="28"
            y="12"
            width="3"
            height="140"
            rx="1.5"
            fill="white"
            opacity="0.3"
          />

          {/* Grip ball */}
          <circle
            cx="30"
            cy="10"
            r="14"
            fill="url(#lever-ball)"
            filter="url(#lever-shadow)"
          />
          <ellipse cx="25" cy="4" rx="5" ry="4" fill="white" opacity="0.4" />
          <ellipse cx="28" cy="1" rx="2" ry="1.5" fill="white" opacity="0.6" />

          {/* Bottom mount */}
          <rect
            x="18"
            y="150"
            width="24"
            height="25"
            rx="5"
            fill="url(#lever-bracket)"
          />
          <circle cx="30" cy="158" r="4" fill="#3f3f46" />
          <circle cx="30" cy="158" r="2.5" fill="#52525b" />
        </svg>
      </motion.div>
    </div>
  );
}

export function SlotMachineGame({ candidates, onResult }: GameProps) {
  const [spinning, setSpinning] = useState(false);
  const [pulled, setPulled] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(0);

  const names = candidates.map((r) =>
    r.name.length > 8 ? r.name.slice(0, 8) + "…" : r.name,
  );

  const pull = useCallback(() => {
    if (spinning) return;

    const selected = Math.floor(Math.random() * candidates.length);
    setWinnerIndex(selected);
    setPulled(true);

    setTimeout(() => {
      setSpinning(true);
      setPulled(false);
    }, 450);

    setTimeout(() => {
      setSpinning(false);
      onResult(candidates[selected]);
    }, 3300);
  }, [spinning, candidates, onResult]);

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="rounded-2xl border border-border bg-surface-dim p-3 sm:p-5 shadow-lg">
        <div className="mb-3 sm:mb-4 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-widest text-muted">
          slot machine
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="flex gap-1.5 sm:gap-2 rounded-xl bg-surface p-2 sm:p-3 shadow-inner">
            <Reel
              items={names}
              finalIndex={winnerIndex}
              spinning={spinning}
              delay={0}
            />
            <Reel
              items={names}
              finalIndex={winnerIndex}
              spinning={spinning}
              delay={500}
            />
            <Reel
              items={names}
              finalIndex={winnerIndex}
              spinning={spinning}
              delay={1000}
            />
          </div>
          <Lever pulled={pulled} onPull={pull} />
        </div>
      </div>

      {!spinning && <p className="text-sm text-muted">레버를 당겨보세요</p>}
    </div>
  );
}
