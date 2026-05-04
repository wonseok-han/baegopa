"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { GameProps } from "@/types";

const CAPSULE_COLORS = [
  "from-red-400 to-red-600",
  "from-blue-400 to-blue-600",
  "from-green-400 to-green-600",
  "from-purple-400 to-purple-600",
  "from-yellow-400 to-yellow-600",
  "from-pink-400 to-pink-600",
];

type Phase = "idle" | "cranking" | "dropping" | "opening" | "revealed";

export function GachaGame({ candidates, onResult }: GameProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState<string>("");
  const [capsuleColor] = useState(
    () => CAPSULE_COLORS[Math.floor(Math.random() * CAPSULE_COLORS.length)]
  );

  const handleCrank = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("cranking");

    const selected = candidates[Math.floor(Math.random() * candidates.length)];

    setTimeout(() => {
      setPhase("dropping");
    }, 800);

    setTimeout(() => {
      setPhase("opening");
    }, 1800);

    setTimeout(() => {
      setWinner(selected.name);
      setPhase("revealed");
    }, 2600);

    setTimeout(() => {
      onResult(selected);
    }, 4000);
  }, [phase, candidates, onResult]);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="h-7 flex items-center justify-center">
        {phase === "revealed" ? (
          <span className="text-lg font-bold text-primary">{winner}</span>
        ) : phase === "idle" ? (
          <span className="text-sm text-muted">레버를 돌려보세요</span>
        ) : (
          <span className="text-sm text-muted">뽑는 중...</span>
        )}
      </div>

      <div className="relative flex flex-col items-center">
        {/* Machine body */}
        <div className="relative w-56 h-64 rounded-3xl bg-gradient-to-b from-gray-100 to-gray-200 border-2 border-gray-300 shadow-lg overflow-hidden dark:from-gray-800 dark:to-gray-900 dark:border-gray-700">
          {/* Glass dome top */}
          <div className="absolute inset-x-4 top-4 h-32 rounded-2xl bg-white/60 border border-white/80 backdrop-blur-sm overflow-hidden dark:bg-white/10 dark:border-white/20">
            {/* Mini capsules inside */}
            <div className="relative w-full h-full">
              {Array.from({ length: 8 }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`absolute w-6 h-6 rounded-full bg-gradient-to-br ${CAPSULE_COLORS[i % CAPSULE_COLORS.length]} shadow-sm`}
                  style={{
                    left: `${15 + (i % 4) * 20}%`,
                    top: `${20 + Math.floor(i / 4) * 35}%`,
                  }}
                  animate={
                    phase === "cranking"
                      ? {
                          x: [0, (i % 2 === 0 ? 5 : -5), 0],
                          y: [0, -3, 2, 0],
                        }
                      : {}
                  }
                  transition={{
                    duration: 0.3,
                    repeat: phase === "cranking" ? 3 : 0,
                    delay: i * 0.05,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Dispensing slot */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-14 h-10 rounded-lg bg-gray-800 border-2 border-gray-600 dark:bg-gray-950 dark:border-gray-600" />
        </div>

        {/* Crank handle */}
        <motion.button
          onClick={handleCrank}
          disabled={phase !== "idle"}
          className="absolute -right-6 top-20 flex flex-col items-center disabled:cursor-default"
          animate={
            phase === "cranking"
              ? { rotate: [0, 360] }
              : {}
          }
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          <div className="w-4 h-16 rounded-full bg-gradient-to-b from-gray-400 to-gray-500 shadow-md" />
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 shadow-lg border-2 border-red-400" />
        </motion.button>

        {/* Dropping capsule animation */}
        <AnimatePresence>
          {(phase === "dropping" || phase === "opening" || phase === "revealed") && (
            <motion.div
              className="absolute -bottom-4 left-1/2"
              initial={{ y: -40, x: "-50%", scale: 0.5, opacity: 0 }}
              animate={{
                y: phase === "dropping" ? [-40, 20] : 20,
                x: "-50%",
                scale: phase === "opening" || phase === "revealed" ? [1, 1.2, 1] : 1,
                opacity: 1,
              }}
              transition={{
                y: { duration: 0.6, ease: "easeIn" },
                scale: { duration: 0.4, delay: phase === "opening" ? 0 : 0.6 },
              }}
            >
              <div className={`relative w-16 h-16 rounded-full bg-gradient-to-br ${capsuleColor} shadow-xl`}>
                {/* Capsule split line */}
                <div className="absolute inset-x-0 top-1/2 h-0.5 bg-black/20" />

                {/* Revealed text */}
                <AnimatePresence>
                  {phase === "revealed" && (
                    <motion.div
                      className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-3 py-1.5 text-sm font-bold text-white shadow-lg"
                      initial={{ opacity: 0, y: 10, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 15 }}
                    >
                      {winner}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rotate-45 bg-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={handleCrank}
        disabled={phase !== "idle"}
        className="mt-8 rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {phase === "idle" ? "뽑기!" : phase === "revealed" ? "결과 확인 중..." : "뽑는 중..."}
      </button>
    </div>
  );
}
