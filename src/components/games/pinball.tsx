"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Matter from "matter-js";
import type { GameProps } from "@/types";

const WIDTH = 320;
const HEIGHT = 480;
const PIN_RADIUS = 5;
const BALL_RADIUS = 10;
const SLOT_HEIGHT = 50;

export function PinballGame({ candidates, onResult }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const [launched, setLaunched] = useState(false);
  const [winner, setWinner] = useState<string>("");
  const resolvedRef = useRef(false);

  const slotCount = Math.min(candidates.length, 8);
  const slotWidth = WIDTH / slotCount;

  const launch = useCallback(() => {
    if (launched || !engineRef.current) return;
    setLaunched(true);
    resolvedRef.current = false;

    const x = WIDTH / 2 + (Math.random() - 0.5) * 60;
    const ball = Matter.Bodies.circle(x, 30, BALL_RADIUS, {
      restitution: 0.5,
      friction: 0.05,
      density: 0.002,
      render: { fillStyle: "#e85d24" },
      label: "ball",
    });

    Matter.Composite.add(engineRef.current.world, ball);
  }, [launched]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
    });
    engineRef.current = engine;

    const walls = [
      Matter.Bodies.rectangle(WIDTH / 2, HEIGHT + 25, WIDTH, 50, {
        isStatic: true,
        label: "floor",
      }),
      Matter.Bodies.rectangle(-25, HEIGHT / 2, 50, HEIGHT, {
        isStatic: true,
      }),
      Matter.Bodies.rectangle(WIDTH + 25, HEIGHT / 2, 50, HEIGHT, {
        isStatic: true,
      }),
    ];

    const pins: Matter.Body[] = [];
    const rows = 7;
    for (let row = 0; row < rows; row++) {
      const cols = row % 2 === 0 ? 7 : 6;
      const offsetX = row % 2 === 0 ? slotWidth / 2 : slotWidth;
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * (WIDTH / (cols + 1)) * 1.1;
        const y = 80 + row * 45;
        pins.push(
          Matter.Bodies.circle(x, y, PIN_RADIUS, {
            isStatic: true,
            restitution: 0.8,
            render: { fillStyle: "#d1d5db" },
          })
        );
      }
    }

    const dividers: Matter.Body[] = [];
    for (let i = 1; i < slotCount; i++) {
      const x = i * slotWidth;
      dividers.push(
        Matter.Bodies.rectangle(x, HEIGHT - SLOT_HEIGHT / 2, 3, SLOT_HEIGHT, {
          isStatic: true,
          render: { fillStyle: "#6b7280" },
        })
      );
    }

    Matter.Composite.add(engine.world, [...walls, ...pins, ...dividers]);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d")!;

    const slotLabels = candidates.slice(0, slotCount).map((r) =>
      r.name.length > 4 ? r.name.slice(0, 4) + "…" : r.name
    );

    let animId: number;
    const render = () => {
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "var(--surface, #ffffff)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      for (let i = 0; i < slotCount; i++) {
        const x = i * slotWidth;
        ctx.fillStyle = i % 2 === 0 ? "#fef3ee" : "#f0fdf4";
        ctx.fillRect(x, HEIGHT - SLOT_HEIGHT, slotWidth, SLOT_HEIGHT);

        ctx.fillStyle = "#374151";
        ctx.font = "bold 10px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          slotLabels[i],
          x + slotWidth / 2,
          HEIGHT - SLOT_HEIGHT / 2 + 4
        );
      }

      for (const body of Matter.Composite.allBodies(engine.world)) {
        if (body.isStatic && body.label !== "floor") {
          const { x, y } = body.position;
          if (body.circleRadius) {
            ctx.beginPath();
            ctx.arc(x, y, body.circleRadius, 0, Math.PI * 2);
            ctx.fillStyle = "#9ca3af";
            ctx.fill();
          } else if (
            body.bounds.max.x - body.bounds.min.x < 10 &&
            body.bounds.max.y - body.bounds.min.y > 10
          ) {
            ctx.fillStyle = "#d1d5db";
            ctx.fillRect(
              body.bounds.min.x,
              body.bounds.min.y,
              body.bounds.max.x - body.bounds.min.x,
              body.bounds.max.y - body.bounds.min.y
            );
          }
        }

        if (body.label === "ball") {
          const { x, y } = body.position;
          ctx.beginPath();
          ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
          ctx.fillStyle = "#e85d24";
          ctx.fill();
          ctx.strokeStyle = "#c2410c";
          ctx.lineWidth = 1.5;
          ctx.stroke();

          if (
            !resolvedRef.current &&
            y > HEIGHT - SLOT_HEIGHT - BALL_RADIUS &&
            Math.abs(body.velocity.y) < 0.5
          ) {
            resolvedRef.current = true;
            const slotIndex = Math.min(
              Math.floor(x / slotWidth),
              slotCount - 1
            );
            const selected = candidates[Math.max(0, slotIndex)];
            setWinner(selected.name);

            setTimeout(() => {
              onResult(selected);
            }, 1500);
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      Matter.Runner.stop(runner);
      Matter.Engine.clear(engine);
    };
  }, [candidates, slotCount, slotWidth, onResult]);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-7 flex items-center justify-center">
        {winner ? (
          <span className="text-lg font-bold text-primary">{winner}</span>
        ) : launched ? (
          <span className="text-sm text-muted">공이 내려가는 중...</span>
        ) : (
          <span className="text-sm text-muted">공을 발사해보세요</span>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border shadow-lg">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="bg-surface"
        />
      </div>

      <button
        onClick={launch}
        disabled={launched}
        className="rounded-full bg-primary px-10 py-3.5 text-base font-bold text-white shadow-md transition-all hover:bg-primary-hover hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:shadow-md"
      >
        {launched ? (winner ? "결과 확인 중..." : "떨어지는 중...") : "발사!"}
      </button>
    </div>
  );
}
