"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Matter from "matter-js";
import type { GameProps, Restaurant } from "@/types";

const WIDTH = 340;
const VIEW_HEIGHT = 520;
const WORLD_HEIGHT = 2100;
const FINISH_Y = 1960;
const BALL_RADIUS = 11;
const MAX_RACERS = 12;

const COLORS = [
  "#ff6b35",
  "#22c55e",
  "#38bdf8",
  "#fbbf24",
  "#a78bfa",
  "#fb7185",
  "#2dd4bf",
  "#60a5fa",
  "#f472b6",
  "#a3e635",
  "#f97316",
  "#818cf8",
];

type RacePhase = "idle" | "racing" | "finished";

interface Marble {
  restaurant: Restaurant;
  body: Matter.Body;
  color: string;
  number: number;
}

function pickRacers(candidates: Restaurant[]) {
  const shuffled = [...candidates];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled.slice(0, MAX_RACERS);
}

function shortName(name: string, length = 8) {
  return name.length > length ? `${name.slice(0, length)}…` : name;
}

function addPegField(
  world: Matter.World,
  startY: number,
  rows: number,
  columns: number,
  spacingY: number
) {
  for (let row = 0; row < rows; row++) {
    const shifted = row % 2 === 1;
    const count = shifted ? columns - 1 : columns;
    const spacingX = WIDTH / (columns + 1);
    const startX = shifted ? spacingX * 1.5 : spacingX;

    for (let column = 0; column < count; column++) {
      Matter.Composite.add(
        world,
        Matter.Bodies.circle(
          startX + column * spacingX,
          startY + row * spacingY,
          5,
          {
            isStatic: true,
            restitution: 0.82,
            friction: 0,
            label: "peg",
          }
        )
      );
    }
  }
}

function addRamp(
  world: Matter.World,
  y: number,
  side: "left" | "right",
  gap: number
) {
  const length = WIDTH - gap;
  const x = side === "left" ? length / 2 : WIDTH - length / 2;
  Matter.Composite.add(
    world,
    Matter.Bodies.rectangle(x, y, length, 14, {
      isStatic: true,
      angle: side === "left" ? 0.13 : -0.13,
      friction: 0,
      frictionStatic: 0,
      restitution: 0.35,
      chamfer: { radius: 7 },
      label: "ramp",
    })
  );
}

export function PinballGame({ candidates, onResult }: GameProps) {
  const racers = useMemo(() => pickRacers(candidates), [candidates]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const marblesRef = useRef<Marble[]>([]);
  const cameraYRef = useRef(0);
  const resolvedRef = useRef(false);
  const animationRef = useRef<number>(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const leaderFrameRef = useRef(0);

  const [phase, setPhase] = useState<RacePhase>("idle");
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [leaders, setLeaders] = useState<Marble[]>([]);
  const [progress, setProgress] = useState(0);

  const stopEngine = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (runnerRef.current) {
      Matter.Runner.stop(runnerRef.current);
      runnerRef.current = null;
    }
    if (engineRef.current) {
      Matter.Events.off(engineRef.current, "beforeUpdate");
      Matter.Events.off(engineRef.current, "afterUpdate");
      Matter.Engine.clear(engineRef.current);
      engineRef.current = null;
    }
  }, []);

  const finishRace = useCallback(
    (marble: Marble) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      Matter.Body.setVelocity(marble.body, { x: 0, y: 0 });
      Matter.Body.setStatic(marble.body, true);
      setWinner(marble.restaurant);
      setLeaders([marble]);
      setProgress(100);
      setPhase("finished");

      const resultTimer = setTimeout(() => onResult(marble.restaurant), 2400);
      timersRef.current.push(resultTimer);
    },
    [onResult]
  );

  const startRace = useCallback(() => {
    if (phase !== "idle" || !canvasRef.current) return;

    stopEngine();
    resolvedRef.current = false;
    cameraYRef.current = 0;
    leaderFrameRef.current = 0;
    setWinner(null);
    setLeaders([]);
    setProgress(0);
    setPhase("racing");

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1.05, scale: 0.001 },
      positionIterations: 12,
      velocityIterations: 10,
    });
    engineRef.current = engine;

    const world = engine.world;
    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(-8, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, {
        isStatic: true,
        label: "wall",
      }),
      Matter.Bodies.rectangle(WIDTH + 8, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, {
        isStatic: true,
        label: "wall",
      }),
      Matter.Bodies.rectangle(WIDTH / 2, FINISH_Y + 85, WIDTH, 18, {
        isStatic: true,
        label: "floor",
      }),
    ]);

    const gate = Matter.Bodies.rectangle(WIDTH / 2, 128, WIDTH - 24, 12, {
      isStatic: true,
      friction: 0,
      label: "gate",
    });
    Matter.Composite.add(world, gate);

    addPegField(world, 220, 9, 7, 58);

    const bumpers = [
      { x: 86, y: 790, radius: 28 },
      { x: 254, y: 790, radius: 28 },
      { x: 170, y: 900, radius: 34 },
    ];
    bumpers.forEach(({ x, y, radius }) => {
      Matter.Composite.add(
        world,
        Matter.Bodies.circle(x, y, radius, {
          isStatic: true,
          restitution: 1.08,
          friction: 0,
          label: "bumper",
        })
      );
    });

    const spinners: { body: Matter.Body; speed: number }[] = [];
    [
      { x: 92, y: 1035, speed: 0.035 },
      { x: 248, y: 1035, speed: -0.035 },
      { x: 170, y: 1145, speed: 0.042 },
    ].forEach(({ x, y, speed }) => {
      const body = Matter.Bodies.rectangle(x, y, 94, 8, {
        isStatic: true,
        restitution: 0.7,
        chamfer: { radius: 4 },
        label: "spinner",
      });
      spinners.push({ body, speed });
      Matter.Composite.add(world, body);
    });

    addRamp(world, 1280, "left", 64);
    addRamp(world, 1400, "right", 64);
    addRamp(world, 1520, "left", 58);
    addPegField(world, 1625, 4, 6, 54);

    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(70, 1880, 155, 14, {
        isStatic: true,
        angle: 0.31,
        friction: 0,
        chamfer: { radius: 7 },
        label: "funnel",
      }),
      Matter.Bodies.rectangle(WIDTH - 70, 1880, 155, 14, {
        isStatic: true,
        angle: -0.31,
        friction: 0,
        chamfer: { radius: 7 },
        label: "funnel",
      }),
    ]);

    const columns = Math.min(6, racers.length);
    const marbles = racers.map((restaurant, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x =
        (WIDTH / (columns + 1)) * (column + 1) +
        (Math.random() - 0.5) * 8;
      const y = 48 + row * 30;
      const body = Matter.Bodies.circle(x, y, BALL_RADIUS, {
        restitution: 0.68,
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0.009,
        density: 0.0012,
        label: `marble-${restaurant.placeId}`,
      });
      Matter.Composite.add(world, body);
      return {
        restaurant,
        body,
        color: COLORS[index % COLORS.length],
        number: index + 1,
      };
    });
    marblesRef.current = marbles;

    let tick = 0;
    Matter.Events.on(engine, "beforeUpdate", () => {
      tick += 1;
      spinners.forEach(({ body, speed }) => Matter.Body.rotate(body, speed));

      if (tick % 75 !== 0) return;
      marbles.forEach((marble) => {
        const { x, y } = marble.body.velocity;
        const speed = Math.hypot(x, y);
        if (speed < 0.65 && marble.body.position.y < FINISH_Y) {
          Matter.Body.applyForce(marble.body, marble.body.position, {
            x: (Math.random() - 0.5) * 0.0012,
            y: 0.001,
          });
        }
      });
    });

    const gateTimer = setTimeout(() => {
      Matter.Composite.remove(world, gate);
      marbles.forEach((marble) => {
        Matter.Body.applyForce(marble.body, marble.body.position, {
          x: (Math.random() - 0.5) * 0.0007,
          y: 0.0003,
        });
      });
    }, 650);
    timersRef.current.push(gateTimer);

    const timeoutTimer = setTimeout(() => {
      if (resolvedRef.current || marbles.length === 0) return;
      const leader = [...marbles].sort(
        (a, b) => b.body.position.y - a.body.position.y
      )[0];
      finishRace(leader);
    }, 28000);
    timersRef.current.push(timeoutTimer);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
  }, [finishRace, phase, racers, stopEngine]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * pixelRatio;
    canvas.height = VIEW_HEIGHT * pixelRatio;
    const context = canvas.getContext("2d");
    if (!context) return;

    const drawPolygon = (body: Matter.Body, cameraY: number) => {
      context.beginPath();
      context.moveTo(body.vertices[0].x, body.vertices[0].y - cameraY);
      for (let index = 1; index < body.vertices.length; index++) {
        context.lineTo(body.vertices[index].x, body.vertices[index].y - cameraY);
      }
      context.closePath();
    };

    const drawCourseLabel = (
      label: string,
      y: number,
      cameraY: number,
      color: string
    ) => {
      const screenY = y - cameraY;
      if (screenY < -30 || screenY > VIEW_HEIGHT + 30) return;
      context.font = "700 10px sans-serif";
      context.textAlign = "left";
      context.fillStyle = color;
      context.globalAlpha = 0.7;
      context.fillText(label, 14, screenY);
      context.globalAlpha = 1;
    };

    const render = () => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      const background = context.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
      background.addColorStop(0, "#091426");
      background.addColorStop(1, "#050914");
      context.fillStyle = background;
      context.fillRect(0, 0, WIDTH, VIEW_HEIGHT);

      const engine = engineRef.current;
      const marbles = marblesRef.current;

      if (!engine || phase === "idle") {
        context.strokeStyle = "rgba(56, 189, 248, 0.12)";
        context.lineWidth = 1;
        for (let y = 24; y < VIEW_HEIGHT; y += 32) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(WIDTH, y);
          context.stroke();
        }
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      const sorted = [...marbles].sort(
        (a, b) => b.body.position.y - a.body.position.y
      );
      const leadY = sorted[0]?.body.position.y ?? 0;
      const targetCamera = resolvedRef.current
        ? FINISH_Y - VIEW_HEIGHT * 0.72
        : Math.max(0, Math.min(leadY - VIEW_HEIGHT * 0.32, WORLD_HEIGHT - VIEW_HEIGHT));
      cameraYRef.current += (targetCamera - cameraYRef.current) * 0.055;
      const cameraY = cameraYRef.current;

      if (!resolvedRef.current) {
        leaderFrameRef.current += 1;
        if (leaderFrameRef.current % 12 === 0) {
          setLeaders(sorted.slice(0, 3));
          setProgress(Math.min(99, Math.round((leadY / FINISH_Y) * 100)));
        }
      }

      drawCourseLabel("01  PEG DROP", 190, cameraY, "#38bdf8");
      drawCourseLabel("02  BUMPER FIELD", 735, cameraY, "#f472b6");
      drawCourseLabel("03  SPIN ZONE", 980, cameraY, "#fbbf24");
      drawCourseLabel("04  SWITCHBACK", 1235, cameraY, "#a78bfa");
      drawCourseLabel("05  FINAL DROP", 1590, cameraY, "#2dd4bf");

      for (const body of Matter.Composite.allBodies(engine.world)) {
        if (
          body.label === "wall" ||
          body.label === "floor" ||
          body.label.startsWith("marble")
        ) {
          continue;
        }

        const screenY = body.position.y - cameraY;
        if (screenY < -100 || screenY > VIEW_HEIGHT + 100) continue;

        if (body.label === "peg") {
          context.shadowColor = "#38bdf8";
          context.shadowBlur = 8;
          context.beginPath();
          context.arc(body.position.x, screenY, 5, 0, Math.PI * 2);
          context.fillStyle = "#0e7490";
          context.fill();
          context.strokeStyle = "#67e8f9";
          context.lineWidth = 1;
          context.stroke();
          context.shadowBlur = 0;
          continue;
        }

        drawPolygon(body, cameraY);
        if (body.label === "bumper") {
          context.shadowColor = "#fb7185";
          context.shadowBlur = 16;
          context.fillStyle = "#9f1239";
          context.strokeStyle = "#fda4af";
        } else if (body.label === "spinner") {
          context.shadowColor = "#fbbf24";
          context.shadowBlur = 12;
          context.fillStyle = "#b45309";
          context.strokeStyle = "#fde68a";
        } else if (body.label === "gate") {
          context.shadowColor = "#38bdf8";
          context.shadowBlur = 10;
          context.fillStyle = "#0369a1";
          context.strokeStyle = "#7dd3fc";
        } else {
          context.shadowColor = "#a78bfa";
          context.shadowBlur = 9;
          context.fillStyle = body.label === "funnel" ? "#0f766e" : "#5b21b6";
          context.strokeStyle =
            body.label === "funnel" ? "#5eead4" : "#c4b5fd";
        }
        context.lineWidth = 1;
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
      }

      const finishScreenY = FINISH_Y - cameraY;
      if (finishScreenY > -30 && finishScreenY < VIEW_HEIGHT + 30) {
        context.setLineDash([9, 5]);
        context.strokeStyle = "#fbbf24";
        context.shadowColor = "#fbbf24";
        context.shadowBlur = 8;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(18, finishScreenY);
        context.lineTo(WIDTH - 18, finishScreenY);
        context.stroke();
        context.setLineDash([]);
        context.shadowBlur = 0;
        context.fillStyle = "#fde68a";
        context.font = "800 12px sans-serif";
        context.textAlign = "center";
        context.fillText("FINISH", WIDTH / 2, finishScreenY - 12);
      }

      for (const marble of marbles) {
        const x = marble.body.position.x;
        const y = marble.body.position.y - cameraY;
        if (y < -40 || y > VIEW_HEIGHT + 40) continue;

        const isWinner =
          winner?.placeId === marble.restaurant.placeId && resolvedRef.current;
        context.shadowColor = isWinner ? "#fbbf24" : marble.color;
        context.shadowBlur = isWinner ? 22 : 10;
        context.beginPath();
        context.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        context.fillStyle = marble.color;
        context.fill();
        context.strokeStyle = isWinner ? "#fde68a" : "rgba(255,255,255,0.75)";
        context.lineWidth = isWinner ? 3 : 1.5;
        context.stroke();
        context.shadowBlur = 0;

        const highlight = context.createRadialGradient(
          x - 4,
          y - 5,
          1,
          x,
          y,
          BALL_RADIUS
        );
        highlight.addColorStop(0, "rgba(255,255,255,0.75)");
        highlight.addColorStop(0.35, "rgba(255,255,255,0.08)");
        highlight.addColorStop(1, "rgba(0,0,0,0.24)");
        context.fillStyle = highlight;
        context.beginPath();
        context.arc(x, y, BALL_RADIUS - 1, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "#ffffff";
        context.font = "800 9px sans-serif";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(marble.number), x, y + 0.5);
        context.textBaseline = "alphabetic";

        if (isWinner) {
          context.strokeStyle = "#fbbf24";
          context.lineWidth = 2;
          context.beginPath();
          context.arc(x, y, BALL_RADIUS + 9, 0, Math.PI * 2);
          context.stroke();
        }
      }

      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [phase, winner]);

  useEffect(() => stopEngine, [stopEngine]);

  useEffect(() => {
    if (phase !== "racing") return;

    const checkFinish = () => {
      if (resolvedRef.current) return;
      const finisher = marblesRef.current.find(
        (marble) => marble.body.position.y >= FINISH_Y
      );
      if (finisher) finishRace(finisher);
    };

    const engine = engineRef.current;
    if (!engine) return;
    Matter.Events.on(engine, "afterUpdate", checkFinish);
    return () => Matter.Events.off(engine, "afterUpdate", checkFinish);
  }, [finishRace, phase]);

  return (
    <div className="flex w-full max-w-[390px] flex-col items-center gap-4">
      <div className="w-full rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-foreground">
            {phase === "idle"
              ? `${racers.length}개 구슬 출전`
              : phase === "finished"
                ? "레이스 종료"
                : "선두 구슬 추적 중"}
          </span>
          <span className="tabular-nums text-muted">{progress}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-dim">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-3 flex min-h-6 items-center gap-2 overflow-hidden">
          {phase === "idle" ? (
            <p className="truncate text-xs text-muted">
              주변 {candidates.length}곳 중 무작위로 선발했어요
            </p>
          ) : (
            leaders.map((leader, index) => (
              <div
                key={leader.restaurant.placeId}
                className="flex min-w-0 items-center gap-1.5 rounded-full bg-surface-dim px-2 py-1"
              >
                <span className="text-[10px] font-bold text-muted">
                  {index + 1}
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: leader.color }}
                />
                <span className="max-w-16 truncate text-[11px] font-medium">
                  {shortName(leader.restaurant.name, 6)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="relative aspect-[17/26] w-full max-w-[340px] overflow-hidden rounded-[28px] border border-slate-700 bg-slate-950 shadow-2xl shadow-slate-950/20">
        <canvas
          ref={canvasRef}
          className="h-full w-full"
          role="img"
          aria-label="음식점 구슬들이 장애물 코스를 달리는 마블 레이스"
        />

        {phase === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/45 px-8 text-center backdrop-blur-[2px]">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-sky-300/30 bg-sky-400/10 shadow-[0_0_30px_rgba(56,189,248,0.22)]">
              <svg viewBox="0 0 48 48" className="h-9 w-9 text-sky-300" fill="none">
                <circle cx="12" cy="10" r="4" fill="currentColor" />
                <circle cx="28" cy="8" r="4" fill="currentColor" opacity=".8" />
                <circle cx="38" cy="20" r="4" fill="currentColor" opacity=".6" />
                <path
                  d="M8 21h24L16 40h24"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-xl font-extrabold text-white">누가 먼저 도착할까?</p>
            <p className="mt-2 text-sm leading-5 text-slate-300">
              구슬 하나가 음식점 하나예요.
              <br />
              결승선을 먼저 통과하면 오늘의 메뉴!
            </p>
            <button
              type="button"
              onClick={startRace}
              className="mt-6 w-full rounded-full bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-orange-950/30 transition-all hover:bg-primary-hover active:scale-[0.98]"
            >
              레이스 시작
            </button>
          </div>
        )}

        {phase === "finished" && winner && (
          <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-amber-300/30 bg-slate-950/90 p-4 text-center shadow-[0_0_30px_rgba(251,191,36,0.22)] backdrop-blur">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
              Winner
            </p>
            <p className="mt-1 truncate text-lg font-extrabold text-white">
              {winner.name}
            </p>
            <p className="mt-1 text-xs text-slate-400">결과 화면으로 이동할게요</p>
          </div>
        )}
      </div>

      <div className="grid w-full grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-3">
        {racers.map((restaurant, index) => (
          <div
            key={restaurant.placeId}
            className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-1.5"
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-extrabold text-white shadow-sm"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            >
              {index + 1}
            </span>
            <span className="truncate text-xs font-medium">{restaurant.name}</span>
          </div>
        ))}
      </div>

      {phase !== "idle" && (
        <div className="w-full rounded-full bg-surface-dim px-8 py-3 text-center text-sm font-semibold text-muted">
          {phase === "racing" ? "레이스 진행 중" : "우승자 확인 중"}
        </div>
      )}
    </div>
  );
}
