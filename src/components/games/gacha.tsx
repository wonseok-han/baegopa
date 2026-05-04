"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import type { GameProps } from "@/types";

const SIZE = 300;
const RADIUS = 120;
const BALL_RADIUS = 12;
const CENTER = SIZE / 2;
const COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4",
  "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6", "#f43f5e",
  "#a855f7", "#6366f1", "#10b981", "#f59e0b", "#e11d48",
];

interface BallData {
  name: string;
  color: string;
  body: Matter.Body;
}

export function GachaGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<BallData[]>([]);
  const [phase, setPhase] = useState<"idle" | "mixing" | "picking" | "done">("idle");
  const [winner, setWinner] = useState("");
  const resolvedRef = useRef(false);
  const mixAngleRef = useRef(0);

  const maxBalls = Math.min(candidates.length, 15);

  const startGame = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("mixing");
    resolvedRef.current = false;

    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    engineRef.current = engine;

    // Circular boundary using edge segments
    const segments = 32;
    for (let i = 0; i < segments; i++) {
      const angle1 = (i / segments) * Math.PI * 2;
      const angle2 = ((i + 1) / segments) * Math.PI * 2;
      const x1 = CENTER + Math.cos(angle1) * RADIUS;
      const y1 = CENTER + Math.sin(angle1) * RADIUS;
      const x2 = CENTER + Math.cos(angle2) * RADIUS;
      const y2 = CENTER + Math.sin(angle2) * RADIUS;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const len = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
      const angle = Math.atan2(y2 - y1, x2 - x1);

      const wall = Matter.Bodies.rectangle(mx, my, len, 4, {
        isStatic: true,
        angle,
        restitution: 0.9,
        label: "boundary",
      });
      Matter.Composite.add(engine.world, wall);
    }

    // Create balls
    const balls: BallData[] = [];
    const selected = candidates.slice(0, maxBalls);
    for (let i = 0; i < selected.length; i++) {
      const angle = (i / selected.length) * Math.PI * 2;
      const dist = 30 + Math.random() * 50;
      const x = CENTER + Math.cos(angle) * dist;
      const y = CENTER + Math.sin(angle) * dist;
      const body = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.8,
        friction: 0.01,
        density: 0.001,
        label: `ball-${i}`,
      });
      balls.push({ name: selected[i].name, color: COLORS[i % COLORS.length], body });
      Matter.Composite.add(engine.world, body);
    }
    ballsRef.current = balls;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Apply mixing force via rotating gravity
    mixAngleRef.current = 0;
    Matter.Events.on(engine, "beforeUpdate", () => {
      if (resolvedRef.current) return;
      mixAngleRef.current += 0.12;
      const gx = Math.cos(mixAngleRef.current) * 0.003;
      const gy = Math.sin(mixAngleRef.current) * 0.003;
      engine.gravity.x = gx;
      engine.gravity.y = gy;
      engine.gravity.scale = 1;
    });

    // After mixing, pick a winner
    setTimeout(() => {
      if (resolvedRef.current) return;
      setPhase("picking");

      // Slow down
      engine.gravity.scale = 0;
      for (const ball of balls) {
        Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
      }

      setTimeout(() => {
        if (resolvedRef.current) return;
        resolvedRef.current = true;

        const winnerBall = balls[Math.floor(Math.random() * balls.length)];
        setWinner(winnerBall.name);
        setPhase("done");

        const result = candidates.find((c) => c.name === winnerBall.name) || candidates[0];
        setTimeout(() => onResult(result), 2500);
      }, 800);
    }, 3500);
  }, [phase, candidates, maxBalls, onResult]);

  // Render
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Circle boundary glow
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RADIUS + 2, 0, Math.PI * 2);
      ctx.strokeStyle = phase === "mixing" ? "#38bdf8" : phase === "picking" ? "#fbbf24" : "#475569";
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner circle fill
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RADIUS - 2, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();

      // Draw balls
      for (const ball of ballsRef.current) {
        const { x, y } = ball.body.position;
        const isWinner = winner && ball.name === winner;

        // Ball shadow
        ctx.beginPath();
        ctx.arc(x + 1, y + 1, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fill();

        // Ball
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();

        if (isWinner) {
          // Winner glow
          ctx.beginPath();
          ctx.arc(x, y, BALL_RADIUS + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 3;
          ctx.stroke();

          // Winner name
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            ball.name.length > 5 ? ball.name.slice(0, 5) + "…" : ball.name,
            x, y - BALL_RADIUS - 10
          );
        }

        // Ball shine
        ctx.beginPath();
        ctx.arc(x - 3, y - 3, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fill();

        // Number label (non-winner)
        if (!isWinner) {
          ctx.fillStyle = "rgba(255,255,255,0.8)";
          ctx.font = "bold 8px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(
            ball.name.length > 3 ? ball.name.slice(0, 3) : ball.name,
            x, y
          );
          ctx.textBaseline = "alphabetic";
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [phase, winner]);

  useEffect(() => {
    return () => {
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) Matter.Engine.clear(engineRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="h-8 flex items-center justify-center">
        {phase === "done" ? (
          <span className="text-lg font-bold text-primary">{winner}</span>
        ) : phase === "idle" ? (
          <span className="text-sm text-muted">공을 섞어볼까?</span>
        ) : phase === "mixing" ? (
          <span className="text-sm font-medium text-muted">섞는 중...</span>
        ) : (
          <span className="text-sm font-medium text-amber-500">선택 중...</span>
        )}
      </div>

      <div className="overflow-hidden rounded-full border-2 border-border shadow-xl">
        <canvas ref={canvasRef} width={SIZE} height={SIZE} />
      </div>

      <button
        onClick={startGame}
        disabled={phase !== "idle"}
        className="rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {phase === "idle" ? "추첨!" : phase === "done" ? "결과 확인 중..." : "돌아가는 중..."}
      </button>
    </div>
  );
}
