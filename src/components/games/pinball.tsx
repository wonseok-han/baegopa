"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import type { GameProps } from "@/types";

const WIDTH = 320;
const HEIGHT = 560;
const BALL_RADIUS = 7;
const GOAL_Y = HEIGHT - 40;
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

export function PinballGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<BallData[]>([]);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [winner, setWinner] = useState("");
  const resolvedRef = useRef(false);

  const maxBalls = Math.min(candidates.length, 15);

  const startGame = useCallback(() => {
    if (started) return;
    setStarted(true);
    resolvedRef.current = false;
    setStatus("출발!");

    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
    });
    engineRef.current = engine;

    // Walls
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(WIDTH / 2, HEIGHT + 25, WIDTH, 50, { isStatic: true, label: "floor" }),
      Matter.Bodies.rectangle(-10, HEIGHT / 2, 20, HEIGHT + 100, { isStatic: true, label: "wall" }),
      Matter.Bodies.rectangle(WIDTH + 10, HEIGHT / 2, 20, HEIGHT + 100, { isStatic: true, label: "wall" }),
    ]);

    // Peg rows - diamond pattern
    const pegRows = 10;
    for (let row = 0; row < pegRows; row++) {
      const cols = row % 2 === 0 ? 8 : 7;
      const spacing = WIDTH / (cols + 1);
      const offsetX = row % 2 === 0 ? spacing : spacing + spacing / 2;
      for (let col = 0; col < cols; col++) {
        const peg = Matter.Bodies.circle(
          offsetX + col * spacing,
          100 + row * 42,
          5,
          { isStatic: true, restitution: 0.8, label: "peg" }
        );
        Matter.Composite.add(engine.world, peg);
      }
    }

    // Spinning obstacles (2 kinematic rotators)
    const spinners = [
      { x: WIDTH * 0.35, y: 220 },
      { x: WIDTH * 0.65, y: 350 },
    ];
    for (const sp of spinners) {
      const bar = Matter.Bodies.rectangle(sp.x, sp.y, 60, 6, {
        isStatic: true,
        label: "spinner",
        chamfer: { radius: 3 },
      });
      Matter.Body.setAngularVelocity(bar, 0.05);
      Matter.Composite.add(engine.world, bar);

      // Spin the bar manually each frame
      Matter.Events.on(engine, "beforeUpdate", () => {
        Matter.Body.rotate(bar, 0.04);
      });
    }

    // Deflectors - angled walls
    const deflectors = [
      { x: 60, y: 160, angle: 0.4, w: 50 },
      { x: WIDTH - 60, y: 160, angle: -0.4, w: 50 },
      { x: 80, y: 290, angle: -0.3, w: 45 },
      { x: WIDTH - 80, y: 290, angle: 0.3, w: 45 },
      { x: WIDTH / 2, y: 420, angle: 0.2, w: 55 },
    ];
    for (const d of deflectors) {
      const body = Matter.Bodies.rectangle(d.x, d.y, d.w, 5, {
        isStatic: true,
        angle: d.angle,
        restitution: 0.5,
        label: "deflector",
        chamfer: { radius: 2 },
      });
      Matter.Composite.add(engine.world, body);
    }

    // Goal line marker (visual only)
    // No physics body needed

    // Create balls with slight stagger
    const balls: BallData[] = [];
    const selected = candidates.slice(0, maxBalls);
    for (let i = 0; i < selected.length; i++) {
      const x = WIDTH / 2 + (i - selected.length / 2) * 16 + (Math.random() - 0.5) * 8;
      const y = 20 + Math.floor(i / 5) * 16;
      const body = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.5,
        friction: 0.02,
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
  }, [started, candidates, maxBalls]);

  // Render loop + goal detection
  useEffect(() => {
    if (!canvasRef.current || !started) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const render = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Background
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const engine = engineRef.current;
      if (!engine) { animId = requestAnimationFrame(render); return; }

      // Draw goal line
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(0, GOAL_Y);
      ctx.lineTo(WIDTH, GOAL_Y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#fbbf2440";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("GOAL", WIDTH / 2, GOAL_Y + 14);

      // Draw static bodies
      for (const body of Matter.Composite.allBodies(engine.world)) {
        if (body.label === "peg") {
          ctx.beginPath();
          ctx.arc(body.position.x, body.position.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#475569";
          ctx.fill();
          ctx.strokeStyle = "#64748b";
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (body.label === "spinner") {
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.roundRect(-30, -3, 60, 6, 3);
          ctx.fill();
          ctx.restore();
        }
        if (body.label === "deflector") {
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          const w = body.bounds.max.x - body.bounds.min.x;
          ctx.fillStyle = "#06b6d4";
          ctx.beginPath();
          ctx.roundRect(-w / 2, -2.5, w, 5, 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Draw balls
      for (const ball of ballsRef.current) {
        const { x, y } = ball.body.position;
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Highlight shine
        ctx.beginPath();
        ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.fill();
      }

      // Winner glow
      if (winner) {
        const winBall = ballsRef.current.find((b) => b.name === winner);
        if (winBall) {
          const { x, y } = winBall.body.position;
          ctx.beginPath();
          ctx.arc(x, y, BALL_RADIUS + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      }

      // Goal detection
      if (!resolvedRef.current) {
        for (const ball of ballsRef.current) {
          if (ball.body.position.y >= GOAL_Y) {
            resolvedRef.current = true;
            setWinner(ball.name);
            setStatus("도착!");

            const result = candidates.find((c) => c.name === ball.name) || candidates[0];
            setTimeout(() => onResult(result), 2000);
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
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-sm">
            <p className="text-lg font-bold text-white">{maxBalls}개 구슬 레이스</p>
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
