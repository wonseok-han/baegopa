"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import type { GameProps } from "@/types";

const WIDTH = 320;
const CANVAS_HEIGHT = 520;
const BALL_RADIUS = 10;
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
  finished: boolean;
}

export function PinballGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const ballsRef = useRef<BallData[]>([]);
  const cameraYRef = useRef(0);
  const finishYRef = useRef(0);
  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState("");
  const [winner, setWinner] = useState("");
  const resolvedRef = useRef(false);

  const ballCount = candidates.length;

  const startGame = useCallback(() => {
    if (started) return;
    setStarted(true);
    resolvedRef.current = false;
    setStatus(`${ballCount}개 구슬 레이스!`);

    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.2, scale: 0.001 },
    });
    engineRef.current = engine;

    // Starting Y after ball placement
    let y = 100 + Math.ceil(ballCount / 8) * (BALL_RADIUS * 2.5) + 40;

    // Continuous side walls
    const wallH = 5000;
    Matter.Composite.add(engine.world, [
      Matter.Bodies.rectangle(-5, wallH / 2, 10, wallH, { isStatic: true, label: "wall" }),
      Matter.Bodies.rectangle(WIDTH + 5, wallH / 2, 10, wallH, { isStatic: true, label: "wall" }),
    ]);

    // ═══ Section 1: Peg field ═══
    for (let row = 0; row < 6; row++) {
      const py = y + row * 42;
      const cols = row % 2 === 0 ? 7 : 6;
      const sp = WIDTH / (cols + 1);
      const ox = row % 2 === 0 ? sp : sp + sp / 2;
      for (let col = 0; col < cols; col++) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.circle(ox + col * sp, py, 5, {
            isStatic: true, restitution: 0.8, label: "peg",
          })
        );
      }
    }
    y += 290;

    // ═══ Section 2: Zigzag S-curves ═══
    for (let i = 0; i < 4; i++) {
      const zy = y + i * 90;
      const fromLeft = i % 2 === 0;
      const gapW = 55;
      const ww = WIDTH - gapW;
      const wx = fromLeft ? ww / 2 : WIDTH - ww / 2;
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(wx, zy, ww, 6, {
          isStatic: true, label: "zigzag",
          angle: fromLeft ? 0.18 : -0.18,
          friction: 0, frictionStatic: 0, restitution: 0.3,
        })
      );
    }
    y += 400;

    // ═══ Section 3: Diamond obstacles ═══
    const diamonds = [
      { dx: 0.5, dy: 0, s: 28, spd: 0.02 },
      { dx: 0.22, dy: 120, s: 22, spd: -0.025 },
      { dx: 0.78, dy: 120, s: 22, spd: 0.025 },
      { dx: 0.38, dy: 240, s: 25, spd: -0.018 },
      { dx: 0.68, dy: 240, s: 20, spd: 0.022 },
    ];
    for (const d of diamonds) {
      const diamond = Matter.Bodies.polygon(WIDTH * d.dx, y + d.dy, 4, d.s, {
        isStatic: true, label: "diamond", restitution: 0.5,
      });
      Matter.Composite.add(engine.world, diamond);
      const spd = d.spd;
      Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(diamond, spd));
    }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.circle(35 + col * (WIDTH - 70), y + 60 + row * 90, 5, {
            isStatic: true, restitution: 0.7, label: "peg",
          })
        );
      }
    }
    y += 310;

    // ═══ Section 4: Spinning bars ═══
    for (let i = 0; i < 5; i++) {
      const by = y + i * 60 + 30;
      const bx = i % 2 === 0 ? WIDTH * 0.3 : WIDTH * 0.7;
      const bar = Matter.Bodies.rectangle(bx, by, 80, 5, {
        isStatic: true, label: "spinner", chamfer: { radius: 2.5 },
        angle: Math.PI * 0.2 * (i % 2 === 0 ? 1 : -1),
      });
      Matter.Composite.add(engine.world, bar);
      const spd = (i % 2 === 0 ? 1 : -1) * 0.04;
      Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(bar, spd));
    }
    y += 360;

    // ═══ Section 5: Tighter zigzag ═══
    for (let i = 0; i < 3; i++) {
      const zy = y + i * 100;
      const fromLeft = i % 2 === 0;
      const gapW = 45;
      const ww = WIDTH - gapW;
      const wx = fromLeft ? ww / 2 : WIDTH - ww / 2;
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(wx, zy, ww, 6, {
          isStatic: true, label: "zigzag",
          angle: fromLeft ? 0.22 : -0.22,
          friction: 0, frictionStatic: 0, restitution: 0.3,
        })
      );
    }
    y += 340;

    // ═══ Section 6: Dense peg field ═══
    for (let row = 0; row < 8; row++) {
      const py = y + row * 38;
      const cols = row % 2 === 0 ? 8 : 7;
      const sp = WIDTH / (cols + 1);
      const ox = row % 2 === 0 ? sp : sp + sp / 2;
      for (let col = 0; col < cols; col++) {
        Matter.Composite.add(engine.world,
          Matter.Bodies.circle(ox + col * sp, py, 5, {
            isStatic: true, restitution: 0.9, label: "peg",
          })
        );
      }
    }
    y += 340;

    // ═══ Section 7: Mixed diamonds + spinners ═══
    const mixDiamonds = [
      { dx: 0.3, dy: 30, s: 20, spd: -0.03 },
      { dx: 0.7, dy: 30, s: 20, spd: 0.03 },
      { dx: 0.5, dy: 130, s: 24, spd: -0.02 },
    ];
    for (const d of mixDiamonds) {
      const dm = Matter.Bodies.polygon(WIDTH * d.dx, y + d.dy, 4, d.s, {
        isStatic: true, label: "diamond", restitution: 0.5,
      });
      Matter.Composite.add(engine.world, dm);
      const spd = d.spd;
      Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(dm, spd));
    }
    for (let i = 0; i < 3; i++) {
      const by = y + 70 + i * 60;
      const bx = i % 2 === 0 ? WIDTH * 0.15 : WIDTH * 0.85;
      const bar = Matter.Bodies.rectangle(bx, by, 50, 5, {
        isStatic: true, label: "spinner", chamfer: { radius: 2.5 },
      });
      Matter.Composite.add(engine.world, bar);
      const spd = (i % 2 === 0 ? 1 : -1) * 0.05;
      Matter.Events.on(engine, "beforeUpdate", () => Matter.Body.rotate(bar, spd));
    }
    y += 230;

    // ═══ Section 8: Final V-funnel ═══
    for (let i = 0; i < 3; i++) {
      const fy = y + i * 70;
      const inset = 15 + i * 20;
      const wallLen = inset + 30;
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(inset / 2 + 15, fy, wallLen, 6, {
          isStatic: true, label: "funnel",
          angle: 0.3 + i * 0.05,
          friction: 0, frictionStatic: 0, restitution: 0.3,
        })
      );
      Matter.Composite.add(engine.world,
        Matter.Bodies.rectangle(WIDTH - inset / 2 - 15, fy, wallLen, 6, {
          isStatic: true, label: "funnel",
          angle: -(0.3 + i * 0.05),
          friction: 0, frictionStatic: 0, restitution: 0.3,
        })
      );
    }
    y += 260;

    // Finish line
    finishYRef.current = y;
    Matter.Composite.add(engine.world,
      Matter.Bodies.rectangle(WIDTH / 2, y + 80, WIDTH, 10, {
        isStatic: true, label: "floor",
      })
    );

    // Create balls
    const balls: BallData[] = [];
    const cols = Math.min(ballCount, 8);
    for (let i = 0; i < ballCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = (WIDTH / (cols + 1)) * (col + 1) + (Math.random() - 0.5) * 6;
      const by = 20 + row * (BALL_RADIUS * 2.5);
      const body = Matter.Bodies.circle(bx, by, BALL_RADIUS, {
        restitution: 0.6, friction: 0.005, frictionStatic: 0, density: 0.001,
        label: `ball-${i}`,
      });
      balls.push({
        name: candidates[i].name,
        color: COLORS[i % COLORS.length],
        body,
        finished: false,
      });
      Matter.Composite.add(engine.world, body);
    }
    ballsRef.current = balls;

    // Anti-stuck nudge - frequent and aggressive
    let tick = 0;
    Matter.Events.on(engine, "beforeUpdate", () => {
      tick++;
      if (tick % 60 !== 0) return;
      for (const ball of balls) {
        if (ball.finished) continue;
        const spd = Math.sqrt(ball.body.velocity.x ** 2 + ball.body.velocity.y ** 2);
        if (spd < 0.5) {
          Matter.Body.applyForce(ball.body, ball.body.position, {
            x: (Math.random() - 0.5) * 0.001,
            y: 0.0008,
          });
        }
      }
    });

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
  }, [started, candidates, ballCount]);

  // Render loop
  useEffect(() => {
    if (!canvasRef.current || !started) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const drawVerts = (verts: Matter.Vector[], camY: number) => {
      ctx.beginPath();
      ctx.moveTo(verts[0].x, verts[0].y - camY);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x, verts[i].y - camY);
      }
      ctx.closePath();
    };

    const render = () => {
      ctx.clearRect(0, 0, WIDTH, CANVAS_HEIGHT);
      ctx.fillStyle = "#050a18";
      ctx.fillRect(0, 0, WIDTH, CANVAS_HEIGHT);

      const engine = engineRef.current;
      if (!engine) { animId = requestAnimationFrame(render); return; }

      const finishY = finishYRef.current;
      const active = ballsRef.current.filter((b) => !b.finished);

      // Check finish - first ball to cross wins
      if (!resolvedRef.current) {
        for (const ball of ballsRef.current) {
          if (!ball.finished && ball.body.position.y >= finishY) {
            ball.finished = true;
            resolvedRef.current = true;
            setWinner(ball.name);
            setStatus("우승!");
            const result = candidates.find((c) => c.name === ball.name) || candidates[0];
            setTimeout(() => onResult(result), 2500);
            break;
          }
        }
      }

      // Camera: follow leader, lock on finish after winner
      if (resolvedRef.current) {
        const target = Math.max(0, finishY - CANVAS_HEIGHT * 0.5);
        cameraYRef.current += (target - cameraYRef.current) * 0.06;
      } else if (active.length > 0) {
        const sorted = active.map((b) => b.body.position.y).sort((a, b) => b - a);
        const leadY = sorted[0];
        const target = Math.max(0, leadY - CANVAS_HEIGHT * 0.35);
        cameraYRef.current += (target - cameraYRef.current) * 0.05;
      }
      const camY = cameraYRef.current;

      // Side wall neon glow lines
      ctx.strokeStyle = "rgba(34, 197, 94, 0.15)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0.5, 0);
      ctx.lineTo(0.5, CANVAS_HEIGHT);
      ctx.moveTo(WIDTH - 0.5, 0);
      ctx.lineTo(WIDTH - 0.5, CANVAS_HEIGHT);
      ctx.stroke();

      // Draw obstacles
      for (const body of Matter.Composite.allBodies(engine.world)) {
        if (body.label === "wall" || body.label === "floor" || body.label.startsWith("ball")) continue;

        const screenY = body.position.y - camY;
        if (screenY < -100 || screenY > CANVAS_HEIGHT + 100) continue;

        if (body.label === "peg") {
          ctx.shadowColor = "#06b6d4";
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(body.position.x, screenY, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#0e7490";
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        if (body.label === "zigzag" || body.label === "funnel") {
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 8;
          drawVerts(body.vertices, camY);
          ctx.fillStyle = body.label === "funnel" ? "#0891b2" : "#0e7490";
          ctx.fill();
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 0.5;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        if (body.label === "diamond") {
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 15;
          drawVerts(body.vertices, camY);
          ctx.fillStyle = "#0e7490";
          ctx.fill();
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }

        if (body.label === "spinner") {
          ctx.shadowColor = "#fbbf24";
          ctx.shadowBlur = 10;
          drawVerts(body.vertices, camY);
          ctx.fillStyle = "#d97706";
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Finish line
      const flY = finishY - camY;
      if (flY > -10 && flY < CANVAS_HEIGHT + 10) {
        ctx.setLineDash([8, 4]);
        ctx.shadowColor = "#fbbf24";
        ctx.shadowBlur = 4;
        ctx.strokeStyle = "#fbbf24";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(10, flY);
        ctx.lineTo(WIDTH - 10, flY);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;

        ctx.fillStyle = "#fbbf24";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("FINISH", WIDTH / 2, flY - 8);
      }

      // Draw balls
      for (const ball of ballsRef.current) {
        if (ball.finished && ball.name !== winner) continue;
        const { x, y: by } = ball.body.position;
        const sY = by - camY;
        if (sY < -30 || sY > CANVAS_HEIGHT + 30) continue;

        const isWin = winner === ball.name;

        // Ball glow
        ctx.shadowColor = ball.color;
        ctx.shadowBlur = isWin ? 15 : 6;
        ctx.beginPath();
        ctx.arc(x, sY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = ball.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = isWin ? "#fbbf24" : "rgba(255,255,255,0.3)";
        ctx.lineWidth = isWin ? 2 : 0.8;
        ctx.stroke();

        // Shine highlight
        ctx.beginPath();
        ctx.arc(x - 3, sY - 3, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.fill();

        // Restaurant name
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = "bold 7px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ball.name.length > 4 ? ball.name.slice(0, 4) : ball.name, x, sY);
        ctx.textBaseline = "alphabetic";

        // Winner highlight ring + name above
        if (isWin) {
          ctx.shadowColor = "#fbbf24";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(x, sY, BALL_RADIUS + 8, 0, Math.PI * 2);
          ctx.strokeStyle = "#fbbf24";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.shadowBlur = 0;

          ctx.fillStyle = "#fbbf24";
          ctx.font = "bold 12px sans-serif";
          ctx.textAlign = "center";
          const nm = ball.name.length > 7 ? ball.name.slice(0, 7) + "…" : ball.name;
          ctx.fillText(nm, x, sY - BALL_RADIUS - 12);
        }
      }

      // Progress bar (right edge)
      ctx.fillStyle = "rgba(30,41,59,0.5)";
      ctx.fillRect(WIDTH - 7, 10, 3, CANVAS_HEIGHT - 20);
      if (active.length > 0 && finishY > 0) {
        const maxBallY = Math.max(...active.map((b) => b.body.position.y));
        const progress = Math.min(1, maxBallY / finishY);
        ctx.shadowColor = "#38bdf8";
        ctx.shadowBlur = 3;
        ctx.fillStyle = "#38bdf8";
        ctx.fillRect(WIDTH - 7, 10, 3, (CANVAS_HEIGHT - 20) * progress);
        ctx.shadowBlur = 0;
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
          <span className="text-lg font-bold text-amber-400">{winner}</span>
        ) : status ? (
          <span className="text-sm font-medium text-muted">{status}</span>
        ) : (
          <span className="text-sm text-muted">마블 레이스!</span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border shadow-lg">
        <canvas ref={canvasRef} width={WIDTH} height={CANVAS_HEIGHT} />
        {!started && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 backdrop-blur-sm">
            <p className="text-lg font-bold text-white">{ballCount}개 구슬 레이스</p>
            <p className="text-xs text-white/70">가장 먼저 결승선을 통과하는 구슬이 당첨!</p>
          </div>
        )}
      </div>

      <button
        onClick={startGame}
        disabled={started}
        className="rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {started ? (winner ? "결과 확인 중..." : "레이스 중...") : "출발!"}
      </button>
    </div>
  );
}
