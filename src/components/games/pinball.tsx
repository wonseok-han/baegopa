"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import type { GameProps } from "@/types";

const WIDTH = 320;
const CANVAS_HEIGHT = 520;
const BALL_RADIUS = 6;
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

export function PinballGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<BallData[]>([]);
  const cameraYRef = useRef(0);
  const worldHeightRef = useRef(0);
  const goalYRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [winner, setWinner] = useState("");
  const resolvedRef = useRef(false);

  const ballCount = candidates.length;

  const startGame = useCallback(() => {
    if (started) return;
    setStarted(true);
    resolvedRef.current = false;
    setStatus(`${ballCount}개 구슬 출발!`);

    if (!canvasRef.current) return;

    // World height scales with ball count - longer course for more balls
    const worldHeight = Math.max(1500, 800 + ballCount * 30);
    worldHeightRef.current = worldHeight;
    const goalY = worldHeight - 60;
    goalYRef.current = goalY;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.4, scale: 0.001 },
    });
    engineRef.current = engine;

    // Walls (full world height)
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(WIDTH / 2, worldHeight + 30, WIDTH, 60, { isStatic: true, label: "floor" }),
      Matter.Bodies.rectangle(-10, worldHeight / 2, 20, worldHeight + 200, { isStatic: true, label: "wall" }),
      Matter.Bodies.rectangle(WIDTH + 10, worldHeight / 2, 20, worldHeight + 200, { isStatic: true, label: "wall" }),
    ]);

    // Generate obstacles throughout the course
    const pegStartY = 80;
    const pegEndY = goalY - 100;
    const pegSpacing = 45;
    const pegRows = Math.floor((pegEndY - pegStartY) / pegSpacing);

    for (let row = 0; row < pegRows; row++) {
      const y = pegStartY + row * pegSpacing;
      const cols = row % 2 === 0 ? 8 : 7;
      const spacing = WIDTH / (cols + 1);
      const offsetX = row % 2 === 0 ? spacing : spacing + spacing / 2;

      for (let col = 0; col < cols; col++) {
        const peg = Matter.Bodies.circle(
          offsetX + col * spacing,
          y,
          4,
          { isStatic: true, restitution: 0.7, label: "peg" }
        );
        Matter.Composite.add(engine.world, peg);
      }
    }

    // Spinning obstacles every ~200px
    const spinnerCount = Math.floor((pegEndY - pegStartY) / 200);
    for (let i = 0; i < spinnerCount; i++) {
      const y = pegStartY + 120 + i * 200;
      const x = i % 2 === 0 ? WIDTH * 0.3 : WIDTH * 0.7;
      const bar = Matter.Bodies.rectangle(x, y, 55, 5, {
        isStatic: true,
        label: "spinner",
        chamfer: { radius: 2.5 },
      });
      Matter.Composite.add(engine.world, bar);
      Matter.Events.on(engine, "beforeUpdate", () => {
        Matter.Body.rotate(bar, 0.03);
      });
    }

    // Deflectors scattered
    const deflectorCount = Math.floor((pegEndY - pegStartY) / 150);
    for (let i = 0; i < deflectorCount; i++) {
      const y = pegStartY + 80 + i * 150;
      const side = i % 2 === 0;
      const x = side ? 55 + Math.random() * 40 : WIDTH - 55 - Math.random() * 40;
      const angle = side ? 0.35 : -0.35;
      const body = Matter.Bodies.rectangle(x, y, 45, 5, {
        isStatic: true,
        angle,
        restitution: 0.5,
        label: "deflector",
        chamfer: { radius: 2 },
      });
      Matter.Composite.add(engine.world, body);
    }

    // Funnel near the end to create tension
    const funnelY = goalY - 60;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(60, funnelY, 100, 5, { isStatic: true, angle: 0.4, label: "deflector", chamfer: { radius: 2 } }),
      Matter.Bodies.rectangle(WIDTH - 60, funnelY, 100, 5, { isStatic: true, angle: -0.4, label: "deflector", chamfer: { radius: 2 } }),
    ]);

    // Create balls with staggered spawn
    const balls: BallData[] = [];
    const cols = Math.min(ballCount, 10);
    for (let i = 0; i < ballCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (WIDTH / (cols + 1)) * (col + 1) + (Math.random() - 0.5) * 6;
      const y = 20 + row * (BALL_RADIUS * 2.5);
      const body = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.45,
        friction: 0.02,
        density: 0.0008,
        label: `ball-${i}`,
      });
      balls.push({ name: candidates[i].name, color: COLORS[i % COLORS.length], body });
      Matter.Composite.add(engine.world, body);
    }
    ballsRef.current = balls;

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
  }, [started, candidates, ballCount]);

  // Render loop with camera
  useEffect(() => {
    if (!canvasRef.current || !started) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, WIDTH, CANVAS_HEIGHT);

      const engine = engineRef.current;
      if (!engine) { animId = requestAnimationFrame(render); return; }

      // Find leading ball Y for camera
      let leadY = 0;
      for (const ball of ballsRef.current) {
        if (ball.body.position.y > leadY) {
          leadY = ball.body.position.y;
        }
      }

      // Camera follows leading ball with lerp
      const targetCameraY = Math.max(0, leadY - CANVAS_HEIGHT * 0.6);
      cameraYRef.current += (targetCameraY - cameraYRef.current) * 0.05;
      const camY = cameraYRef.current;

      // Draw goal line
      const goalScreenY = goalYRef.current - camY;
      if (goalScreenY > -10 && goalScreenY < CANVAS_HEIGHT + 10) {
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(0, goalScreenY);
        ctx.lineTo(WIDTH, goalScreenY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#fbbf2460";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("GOAL", WIDTH / 2, goalScreenY + 14);
      }

      // Draw static bodies (only visible ones)
      for (const body of Matter.Composite.allBodies(engine.world)) {
        const screenY = body.position.y - camY;
        if (screenY < -50 || screenY > CANVAS_HEIGHT + 50) continue;

        if (body.label === "peg") {
          ctx.beginPath();
          ctx.arc(body.position.x, screenY, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#374151";
          ctx.fill();
          ctx.strokeStyle = "#4b5563";
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
        if (body.label === "spinner") {
          ctx.save();
          ctx.translate(body.position.x, screenY);
          ctx.rotate(body.angle);
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.roundRect(-27, -2.5, 55, 5, 2.5);
          ctx.fill();
          ctx.restore();
        }
        if (body.label === "deflector") {
          ctx.save();
          ctx.translate(body.position.x, screenY);
          ctx.rotate(body.angle);
          ctx.fillStyle = "#06b6d4";
          ctx.beginPath();
          ctx.roundRect(-22, -2.5, 45, 5, 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw balls
      for (const ball of ballsRef.current) {
        const { x, y } = ball.body.position;
        const screenY = y - camY;
        if (screenY < -20 || screenY > CANVAS_HEIGHT + 20) continue;

        ctx.beginPath();
        ctx.arc(x, screenY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Shine
        ctx.beginPath();
        ctx.arc(x - 2, screenY - 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();
      }

      // Winner highlight
      if (winner) {
        const winBall = ballsRef.current.find((b) => b.name === winner);
        if (winBall) {
          const screenY = winBall.body.position.y - camY;
          ctx.beginPath();
          ctx.arc(winBall.body.position.x, screenY, BALL_RADIUS + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2.5;
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          const name = winBall.name.length > 6 ? winBall.name.slice(0, 6) + "…" : winBall.name;
          ctx.fillText(name, winBall.body.position.x, screenY - BALL_RADIUS - 8);
        }
      }

      // Progress indicator
      const progress = Math.min(1, leadY / goalYRef.current);
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(WIDTH - 8, 10, 4, CANVAS_HEIGHT - 20);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(WIDTH - 8, 10, 4, (CANVAS_HEIGHT - 20) * progress);

      // Goal detection
      if (!resolvedRef.current) {
        for (const ball of ballsRef.current) {
          if (ball.body.position.y >= goalYRef.current) {
            resolvedRef.current = true;
            setWinner(ball.name);
            setStatus("골인!");

            const result = candidates.find((c) => c.name === ball.name) || candidates[0];
            setTimeout(() => onResult(result), 2500);
            break;
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [started, winner, candidates, onResult]);

  useEffect(() => {
    return () => {
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) Matter.Engine.clear(engineRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-7 flex items-center justify-center">
        {winner ? (
          <span className="text-lg font-bold text-primary">{winner}</span>
        ) : status ? (
          <span className="text-sm font-medium text-muted">{status}</span>
        ) : (
          <span className="text-sm text-muted">마블 레이스!</span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
        <canvas ref={canvasRef} width={WIDTH} height={CANVAS_HEIGHT} />
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-sm">
            <p className="text-lg font-bold text-white">{ballCount}개 구슬 레이스</p>
            <p className="text-xs text-white/70">먼저 골인하는 구슬이 당첨!</p>
          </div>
        )}
      </div>

      <button
        onClick={startGame}
        disabled={started}
        className="rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {started ? (winner ? "결과 확인 중..." : "레이스 중...") : "시작!"}
      </button>
    </div>
  );
}
