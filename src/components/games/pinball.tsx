"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import type { GameProps } from "@/types";

const WIDTH = 320;
const CANVAS_HEIGHT = 520;
const BALL_RADIUS = 7;
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
  eliminated: boolean;
}

export function PinballGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<BallData[]>([]);
  const cameraYRef = useRef(0);
  const worldHeightRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [winner, setWinner] = useState("");
  const [aliveCount, setAliveCount] = useState(0);
  const resolvedRef = useRef(false);

  const ballCount = candidates.length;

  const startGame = useCallback(() => {
    if (started) return;
    setStarted(true);
    resolvedRef.current = false;
    setAliveCount(ballCount);
    setStatus(`${ballCount}개 구슬 서바이벌!`);

    if (!canvasRef.current) return;

    const worldHeight = Math.max(2000, 1200 + ballCount * 25);
    worldHeightRef.current = worldHeight;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 0.5, scale: 0.001 },
    });
    engineRef.current = engine;

    // Side walls only - no floor (balls fall out the bottom)
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(-10, worldHeight / 2, 20, worldHeight + 200, { isStatic: true, label: "wall" }),
      Matter.Bodies.rectangle(WIDTH + 10, worldHeight / 2, 20, worldHeight + 200, { isStatic: true, label: "wall" }),
    ]);

    // Generate the course
    const courseStartY = 80;
    const courseEndY = worldHeight - 100;
    const sectionHeight = (courseEndY - courseStartY) / 5;

    // Section 1: Dense peg field
    for (let row = 0; row < 8; row++) {
      const y = courseStartY + row * 35;
      const cols = row % 2 === 0 ? 9 : 8;
      const spacing = WIDTH / (cols + 1);
      const offsetX = row % 2 === 0 ? spacing : spacing + spacing / 2;
      for (let col = 0; col < cols; col++) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.circle(offsetX + col * spacing, y, 4, {
            isStatic: true, restitution: 1.0, label: "peg",
          })
        );
      }
    }

    // Section 2: Rotating bars (angled start so balls don't rest flat)
    const sec2Start = courseStartY + sectionHeight;
    for (let i = 0; i < 4; i++) {
      const y = sec2Start + i * 60 + 30;
      const x = i % 2 === 0 ? WIDTH * 0.3 : WIDTH * 0.7;
      const bar = Matter.Bodies.rectangle(x, y, 70, 6, {
        isStatic: true, label: "spinner", chamfer: { radius: 3 },
        angle: Math.PI * 0.25 * (i % 2 === 0 ? 1 : -1),
      });
      Matter.Composite.add(engine.world, bar);
      const speed = (i % 2 === 0 ? 1 : -1) * 0.05;
      Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(bar, speed));
    }

    // Scattered pegs in section 2
    for (let row = 0; row < 5; row++) {
      const y = sec2Start + row * 50 + 10;
      for (let col = 0; col < 3; col++) {
        const x = 40 + col * 120 + (row % 2) * 60;
        Matter.Composite.add(engine.world,
          Matter.Bodies.circle(x, y, 4, { isStatic: true, restitution: 0.7, label: "peg" })
        );
      }
    }

    // Section 3: Funnels with narrow gaps (elimination zones)
    const sec3Start = courseStartY + sectionHeight * 2;
    for (let i = 0; i < 3; i++) {
      const y = sec3Start + i * 80 + 40;
      const gapX = WIDTH * (0.3 + Math.random() * 0.4);
      const gapWidth = 35;

      // Left part of funnel
      if (gapX - gapWidth / 2 > 20) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.rectangle(
            (gapX - gapWidth / 2) / 2, y,
            gapX - gapWidth / 2, 6,
            { isStatic: true, label: "funnel", chamfer: { radius: 3 } }
          )
        );
      }
      // Right part of funnel
      const rightStart = gapX + gapWidth / 2;
      if (WIDTH - rightStart > 20) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.rectangle(
            rightStart + (WIDTH - rightStart) / 2, y,
            WIDTH - rightStart, 6,
            { isStatic: true, label: "funnel", chamfer: { radius: 3 } }
          )
        );
      }
    }

    // Section 4: More rotating obstacles + pegs
    const sec4Start = courseStartY + sectionHeight * 3;
    for (let i = 0; i < 3; i++) {
      const y = sec4Start + i * 70 + 35;
      const x = WIDTH / 2 + (i % 2 === 0 ? -40 : 40);
      const bar = Matter.Bodies.rectangle(x, y, 80, 5, {
        isStatic: true, label: "spinner", chamfer: { radius: 2.5 },
        angle: Math.PI * 0.3,
      });
      Matter.Composite.add(engine.world, bar);
      const speed = (i % 2 === 0 ? 1 : -1) * 0.045;
      Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(bar, speed));
    }

    for (let row = 0; row < 4; row++) {
      const y = sec4Start + row * 55;
      const cols = row % 2 === 0 ? 7 : 6;
      const spacing = WIDTH / (cols + 1);
      for (let col = 0; col < cols; col++) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.circle(spacing + col * spacing, y, 4, {
            isStatic: true, restitution: 0.8, label: "peg",
          })
        );
      }
    }

    // Section 5: Final narrow funnel - tight gap at end
    const sec5Start = courseStartY + sectionHeight * 4;
    for (let i = 0; i < 4; i++) {
      const y = sec5Start + i * 50 + 25;
      const gapWidth = 40 - i * 5; // Gets narrower
      const gapX = WIDTH / 2 + (Math.random() - 0.5) * 60;

      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(
          (gapX - gapWidth / 2) / 2, y,
          Math.max(10, gapX - gapWidth / 2), 6,
          { isStatic: true, label: "funnel", chamfer: { radius: 3 } }
        )
      );
      const rightStart = gapX + gapWidth / 2;
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(
          rightStart + (WIDTH - rightStart) / 2, y,
          Math.max(10, WIDTH - rightStart), 6,
          { isStatic: true, label: "funnel", chamfer: { radius: 3 } }
        )
      );
    }

    // Final rotating bar before exit
    const finalBar = Matter.Bodies.rectangle(WIDTH / 2, courseEndY - 20, 90, 5, {
      isStatic: true, label: "spinner", chamfer: { radius: 2.5 },
      angle: Math.PI * 0.2,
    });
    Matter.Composite.add(engine.world, finalBar);
    Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(finalBar, 0.04));

    // Create balls
    const balls: BallData[] = [];
    const cols = Math.min(ballCount, 10);
    for (let i = 0; i < ballCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (WIDTH / (cols + 1)) * (col + 1) + (Math.random() - 0.5) * 8;
      const y = 15 + row * (BALL_RADIUS * 2.8);
      const body = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.8,
        friction: 0.01,
        density: 0.001,
        label: `ball-${i}`,
      });
      balls.push({ name: candidates[i].name, color: COLORS[i % COLORS.length], body, eliminated: false });
      Matter.Composite.add(engine.world, body);
    }
    ballsRef.current = balls;

    // Anti-stuck: nudge balls that aren't moving
    let tickCount = 0;
    Matter.Events.on(engine, "beforeUpdate", () => {
      tickCount++;
      if (tickCount % 120 !== 0) return; // Check every ~2 seconds
      for (const ball of balls) {
        if (ball.eliminated) continue;
        const speed = Math.sqrt(ball.body.velocity.x ** 2 + ball.body.velocity.y ** 2);
        if (speed < 0.3) {
          Matter.Body.applyForce(ball.body, ball.body.position, {
            x: (Math.random() - 0.5) * 0.0005,
            y: 0.0003,
          });
        }
      }
    });

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
  }, [started, candidates, ballCount]);

  // Render + elimination detection
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

      // Check eliminations - balls that fall below world
      const worldH = worldHeightRef.current;
      let alive = 0;
      for (const ball of ballsRef.current) {
        if (ball.eliminated) continue;
        if (ball.body.position.y > worldH + 50) {
          ball.eliminated = true;
          Matter.Composite.remove(engine.world, ball.body);
        } else {
          alive++;
        }
      }

      setAliveCount(alive);

      // Winner detection - last ball standing
      if (!resolvedRef.current && alive === 1) {
        const lastBall = ballsRef.current.find((b) => !b.eliminated);
        if (lastBall) {
          resolvedRef.current = true;
          setWinner(lastBall.name);
          setStatus("최후의 1개!");
          const result = candidates.find((c) => c.name === lastBall.name) || candidates[0];
          setTimeout(() => onResult(result), 2500);
        }
      }

      // Fallback: if all eliminated, pick random from last few
      if (!resolvedRef.current && alive === 0) {
        resolvedRef.current = true;
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        setWinner(pick.name);
        setStatus("당첨!");
        setTimeout(() => onResult(pick), 2000);
      }

      // Camera follows the bulk of alive balls (median Y)
      const aliveBalls = ballsRef.current.filter((b) => !b.eliminated);
      if (aliveBalls.length > 0) {
        const positions = aliveBalls.map((b) => b.body.position.y).sort((a, b) => a - b);
        const medianY = positions[Math.floor(positions.length / 2)];
        const targetCamY = Math.max(0, medianY - CANVAS_HEIGHT * 0.4);
        cameraYRef.current += (targetCamY - cameraYRef.current) * 0.04;
      }
      const camY = cameraYRef.current;

      // Draw static bodies
      for (const body of Matter.Composite.allBodies(engine.world)) {
        const screenY = body.position.y - camY;
        if (screenY < -60 || screenY > CANVAS_HEIGHT + 60) continue;

        if (body.label === "peg") {
          ctx.beginPath();
          ctx.arc(body.position.x, screenY, 4, 0, Math.PI * 2);
          ctx.fillStyle = "#374151";
          ctx.fill();
        }
        if (body.label === "spinner") {
          ctx.save();
          ctx.translate(body.position.x, screenY);
          ctx.rotate(body.angle);
          const w = body.bounds.max.x - body.bounds.min.x;
          ctx.fillStyle = "#f59e0b";
          ctx.beginPath();
          ctx.roundRect(-w / 2, -3, w, 6, 3);
          ctx.fill();
          ctx.restore();
        }
        if (body.label === "funnel") {
          const w = body.bounds.max.x - body.bounds.min.x;
          const h = body.bounds.max.y - body.bounds.min.y;
          ctx.fillStyle = "#06b6d4";
          ctx.beginPath();
          ctx.roundRect(body.bounds.min.x, screenY - h / 2, w, h, 3);
          ctx.fill();
        }
      }

      // Draw balls
      for (const ball of ballsRef.current) {
        if (ball.eliminated) continue;
        const { x, y } = ball.body.position;
        const screenY = y - camY;
        if (screenY < -20 || screenY > CANVAS_HEIGHT + 20) continue;

        const isWin = winner === ball.name;

        ctx.beginPath();
        ctx.arc(x, screenY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.strokeStyle = isWin ? "#fbbf24" : "rgba(255,255,255,0.2)";
        ctx.lineWidth = isWin ? 2.5 : 0.8;
        ctx.stroke();

        // Shine
        ctx.beginPath();
        ctx.arc(x - 2, screenY - 2, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.fill();

        if (isWin) {
          ctx.beginPath();
          ctx.arc(x, screenY, BALL_RADIUS + 6, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.stroke();

          ctx.fillStyle = "#fff";
          ctx.font = "bold 11px sans-serif";
          ctx.textAlign = "center";
          const name = ball.name.length > 6 ? ball.name.slice(0, 6) + "…" : ball.name;
          ctx.fillText(name, x, screenY - BALL_RADIUS - 10);
        }
      }

      // HUD: alive count + progress bar
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(WIDTH - 8, 10, 4, CANVAS_HEIGHT - 20);
      if (aliveBalls.length > 0) {
        const positions2 = aliveBalls.map((b) => b.body.position.y);
        const maxY = Math.max(...positions2);
        const progress = Math.min(1, maxY / worldH);
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(WIDTH - 8, 10, 4, (CANVAS_HEIGHT - 20) * progress);
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
          <span className="text-sm font-medium text-muted">
            {status} {started && !winner && `(${aliveCount}개 생존)`}
          </span>
        ) : (
          <span className="text-sm text-muted">마블 서바이벌!</span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
        <canvas ref={canvasRef} width={WIDTH} height={CANVAS_HEIGHT} />
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 backdrop-blur-sm">
            <p className="text-lg font-bold text-white">{ballCount}개 구슬 서바이벌</p>
            <p className="text-xs text-white/70">마지막까지 떨어지지 않는 구슬이 당첨!</p>
          </div>
        )}
      </div>

      <button
        onClick={startGame}
        disabled={started}
        className="rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {started ? (winner ? "결과 확인 중..." : "서바이벌 중...") : "시작!"}
      </button>
    </div>
  );
}
