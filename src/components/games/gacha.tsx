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
  "#84cc16", "#0ea5e9", "#d946ef", "#f472b6", "#2dd4bf",
];

interface BallData {
  name: string;
  color: string;
  body: Matter.Body;
}

type Phase = "idle" | "mixing" | "slowing" | "revealing" | "done";

export function GachaGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<BallData[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [winner, setWinner] = useState("");
  const winnerRef = useRef<BallData | null>(null);
  const revealProgressRef = useRef(0);
  const mixAngleRef = useRef(0);

  const maxBalls = Math.min(candidates.length, 20);

  const startGame = useCallback(() => {
    if (phase !== "idle") return;
    setPhase("mixing");

    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0, scale: 0 },
    });
    engineRef.current = engine;

    // Circular boundary
    const segments = 36;
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

      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(mx, my, len, 4, {
          isStatic: true, angle, restitution: 0.9, label: "boundary",
        })
      );
    }

    // Create balls
    const balls: BallData[] = [];
    const selected = candidates.slice(0, maxBalls);
    for (let i = 0; i < selected.length; i++) {
      const angle = (i / selected.length) * Math.PI * 2;
      const dist = 20 + Math.random() * 60;
      const x = CENTER + Math.cos(angle) * dist;
      const y = CENTER + Math.sin(angle) * dist;
      const body = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.8, friction: 0.01, density: 0.001, label: `ball-${i}`,
      });
      balls.push({ name: selected[i].name, color: COLORS[i % COLORS.length], body });
      Matter.Composite.add(engine.world, body);
    }
    ballsRef.current = balls;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    // Rotating gravity for mixing
    mixAngleRef.current = 0;
    Matter.Events.on(engine, "beforeUpdate", () => {
      if (winnerRef.current) return;
      mixAngleRef.current += 0.12;
      engine.gravity.x = Math.cos(mixAngleRef.current) * 0.004;
      engine.gravity.y = Math.sin(mixAngleRef.current) * 0.004;
      engine.gravity.scale = 1;
    });

    // After mixing, slow down then pick
    setTimeout(() => {
      setPhase("slowing");
      // Gradually reduce velocities
      const slowInterval = setInterval(() => {
        for (const ball of balls) {
          const v = ball.body.velocity;
          Matter.Body.setVelocity(ball.body, { x: v.x * 0.85, y: v.y * 0.85 });
        }
      }, 50);

      setTimeout(() => {
        clearInterval(slowInterval);
        engine.gravity.scale = 0;
        for (const ball of balls) {
          Matter.Body.setVelocity(ball.body, { x: 0, y: 0 });
        }

        // Pick winner
        const picked = balls[Math.floor(Math.random() * balls.length)];
        winnerRef.current = picked;
        setWinner(picked.name);
        setPhase("revealing");
        revealProgressRef.current = 0;

        // After reveal animation completes
        const result = candidates.find((c) => c.name === picked.name) || candidates[0];
        setTimeout(() => {
          setPhase("done");
          setTimeout(() => onResult(result), 1500);
        }, 2000);
      }, 1000);
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
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, SIZE, SIZE);

      // Circle boundary
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RADIUS + 2, 0, Math.PI * 2);
      ctx.strokeStyle = phase === "mixing" ? "#38bdf8" : phase === "revealing" || phase === "done" ? "#fbbf24" : "#475569";
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(CENTER, CENTER, RADIUS - 2, 0, Math.PI * 2);
      ctx.fillStyle = "#1e293b";
      ctx.fill();

      const winBall = winnerRef.current;
      const isRevealing = phase === "revealing" || phase === "done";

      // Animate reveal progress
      if (isRevealing && revealProgressRef.current < 1) {
        revealProgressRef.current = Math.min(1, revealProgressRef.current + 0.02);
      }
      const t = revealProgressRef.current;

      // Draw non-winner balls (fade out during reveal)
      for (const ball of ballsRef.current) {
        if (winBall && ball.name === winBall.name) continue;
        const { x, y } = ball.body.position;

        const alpha = isRevealing ? Math.max(0.15, 1 - t * 0.85) : 1;
        const scale = isRevealing ? Math.max(0.6, 1 - t * 0.4) : 1;
        const r = BALL_RADIUS * scale;

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();

        if (!isRevealing) {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "bold 7px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(ball.name.length > 3 ? ball.name.slice(0, 3) : ball.name, x, y);
          ctx.textBaseline = "alphabetic";
        }
        ctx.globalAlpha = 1;
      }

      // Draw winner ball (move to center + enlarge during reveal)
      if (winBall) {
        const { x: bx, y: by } = winBall.body.position;
        const targetX = CENTER;
        const targetY = CENTER;
        const x = isRevealing ? bx + (targetX - bx) * t : bx;
        const y = isRevealing ? by + (targetY - by) * t : by;
        const scale = isRevealing ? 1 + t * 1.5 : 1;
        const r = BALL_RADIUS * scale;

        // Glow
        if (isRevealing) {
          ctx.beginPath();
          ctx.arc(x, y, r + 8 * t, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(251, 191, 36, ${t * 0.8})`;
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        // Ball
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = winBall.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Shine
        ctx.beginPath();
        ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();

        // Name on ball
        if (isRevealing && t > 0.3) {
          ctx.globalAlpha = Math.min(1, (t - 0.3) * 2);
          ctx.fillStyle = "#ffffff";
          ctx.font = `bold ${Math.round(10 + t * 6)}px sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const name = winBall.name.length > 7 ? winBall.name.slice(0, 7) + "…" : winBall.name;
          ctx.fillText(name, x, y);
          ctx.textBaseline = "alphabetic";
          ctx.globalAlpha = 1;
        } else if (!isRevealing) {
          ctx.fillStyle = "rgba(255,255,255,0.7)";
          ctx.font = "bold 7px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(winBall.name.length > 3 ? winBall.name.slice(0, 3) : winBall.name, x, y);
          ctx.textBaseline = "alphabetic";
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [phase]);

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
          <span className="text-xl font-bold text-primary">{winner}</span>
        ) : phase === "revealing" ? (
          <span className="text-sm font-medium text-amber-500">당첨!</span>
        ) : phase === "idle" ? (
          <span className="text-sm text-muted">공을 섞어볼까?</span>
        ) : phase === "mixing" ? (
          <span className="text-sm font-medium text-muted">섞는 중...</span>
        ) : (
          <span className="text-sm font-medium text-muted">멈추는 중...</span>
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
