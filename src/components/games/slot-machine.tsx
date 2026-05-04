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
    <div className="flex h-36 w-24 flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-zinc-300 bg-white dark:bg-zinc-800">
      <motion.div
        className="flex flex-col items-center gap-2"
        animate={{ y: spinning ? [0, -5, 0] : 0 }}
        transition={{ repeat: spinning ? Infinity : 0, duration: 0.1 }}
      >
        <span className="text-xs text-zinc-400 truncate w-20 text-center">
          {items[prevIndex]}
        </span>
        <span className="text-sm font-bold truncate w-20 text-center border-y-2 border-orange-400 py-2">
          {items[displayIndex]}
        </span>
        <span className="text-xs text-zinc-400 truncate w-20 text-center">
          {items[nextIndex]}
        </span>
      </motion.div>
    </div>
  );
}

export function SlotMachineGame({ candidates, onResult }: GameProps) {
  const [spinning, setSpinning] = useState(false);
  const [winnerIndex, setWinnerIndex] = useState(0);

  const names = candidates.map((r) =>
    r.name.length > 8 ? r.name.slice(0, 8) + "…" : r.name
  );

  const pull = useCallback(() => {
    if (spinning) return;

    const selected = Math.floor(Math.random() * candidates.length);
    setWinnerIndex(selected);
    setSpinning(true);

    setTimeout(() => {
      setSpinning(false);
      onResult(candidates[selected]);
    }, 3000);
  }, [spinning, candidates, onResult]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="rounded-2xl bg-gradient-to-b from-zinc-100 to-zinc-200 p-6 shadow-xl dark:from-zinc-700 dark:to-zinc-800">
        <div className="mb-3 text-center text-2xl font-bold">🎰</div>
        <div className="flex gap-2">
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
      </div>

      <button
        onClick={pull}
        disabled={spinning}
        className="rounded-full bg-red-500 px-8 py-3 text-lg font-bold text-white transition-all hover:scale-105 hover:bg-red-600 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
      >
        {spinning ? "돌아가는 중..." : "레버 당기기! 🎰"}
      </button>
    </div>
  );
}
