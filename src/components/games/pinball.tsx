"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Matter from "matter-js";
import type { GameProps, Restaurant } from "@/types";

const WIDTH = 360;
const VIEW_HEIGHT = 600;
const WORLD_HEIGHT = 1840;
const FINISH_Y = 1690;
const COURSE_CATEGORY = 0x0001;
const COLLISION_COHORTS = 12;

const PALETTE = [
  "#e85d24",
  "#168c82",
  "#e1a62b",
  "#3973b9",
  "#cc4d67",
  "#7654a8",
  "#5f8f3c",
  "#d5762c",
  "#287e9f",
  "#a65d3f",
];

type RacePhase = "lobby" | "countdown" | "racing" | "finished";

interface TrailPoint {
  x: number;
  y: number;
}

interface Marble {
  restaurant: Restaurant;
  body: Matter.Body;
  color: string;
  number: number;
  radius: number;
  trail: TrailPoint[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

function shuffle<T>(items: T[]) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function getMarbleRadius(count: number) {
  if (count <= 16) return 12;
  if (count <= 40) return 10;
  return 8;
}

function shortName(name: string, length = 7) {
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
    const spacingX = (WIDTH - 34) / (columns + 1);
    const startX = 17 + (shifted ? spacingX * 1.5 : spacingX);

    for (let column = 0; column < count; column++) {
      Matter.Composite.add(
        world,
        Matter.Bodies.circle(
          startX + column * spacingX,
          startY + row * spacingY,
          5,
          {
            isStatic: true,
            restitution: 0.78,
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
  gap: number,
  angle = 0.14
) {
  const length = WIDTH - gap;
  const x = side === "left" ? length / 2 : WIDTH - length / 2;
  Matter.Composite.add(
    world,
    Matter.Bodies.rectangle(x, y, length, 13, {
      isStatic: true,
      angle: side === "left" ? angle : -angle,
      friction: 0,
      frictionStatic: 0,
      restitution: 0.28,
      chamfer: { radius: 6 },
      label: "ramp",
    })
  );
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
}

export function PinballGame({ candidates, onResult }: GameProps) {
  const racers = useMemo(() => shuffle(candidates), [candidates]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
  const runnerRef = useRef<Matter.Runner | null>(null);
  const marblesRef = useRef<Marble[]>([]);
  const marbleByBodyRef = useRef(new Map<number, Marble>());
  const featuredMarblesRef = useRef(new Set<string>());
  const particlesRef = useRef<Particle[]>([]);
  const cameraYRef = useRef(0);
  const resolvedRef = useRef(false);
  const animationRef = useRef<number>(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const leaderFrameRef = useRef(0);
  const lastLeaderRef = useRef("");
  const lastAnnouncementRef = useRef(0);

  const [phase, setPhase] = useState<RacePhase>("lobby");
  const [countdown, setCountdown] = useState("3");
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [leaders, setLeaders] = useState<Marble[]>([]);
  const [progress, setProgress] = useState(0);
  const [announcement, setAnnouncement] = useState("출전 구슬 준비 완료");
  const [soundEnabled, setSoundEnabled] = useState(false);

  const playTone = useCallback(
    (frequency: number, duration = 0.08) => {
      if (!soundEnabled) return;
      try {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as typeof window & {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;
        if (!AudioContextClass) return;
        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.07, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(
          0.001,
          audioContext.currentTime + duration
        );
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start();
        oscillator.stop(audioContext.currentTime + duration);
        oscillator.addEventListener("ended", () => audioContext.close());
      } catch {
        // Sound is optional; gameplay continues when audio is unavailable.
      }
    },
    [soundEnabled]
  );

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
      Matter.Events.off(engineRef.current, "collisionStart");
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
      setAnnouncement(`${marble.restaurant.name} 우승!`);
      setPhase("finished");
      playTone(784, 0.22);
      navigator.vibrate?.([35, 40, 80]);

      const resultTimer = setTimeout(() => onResult(marble.restaurant), 2400);
      timersRef.current.push(resultTimer);
    },
    [onResult, playTone]
  );

  const startRace = useCallback(() => {
    if (phase !== "lobby" || !canvasRef.current) return;

    stopEngine();
    resolvedRef.current = false;
    cameraYRef.current = 0;
    leaderFrameRef.current = 0;
    lastLeaderRef.current = "";
    lastAnnouncementRef.current = 0;
    particlesRef.current = [];
    setWinner(null);
    setLeaders([]);
    setProgress(0);
    setCountdown("3");
    setAnnouncement("잠시 후 출발합니다");
    setPhase("countdown");
    playTone(440);

    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.00032 },
      positionIterations: 12,
      velocityIterations: 10,
    });
    engineRef.current = engine;

    const world = engine.world;
    const marbleRadius = getMarbleRadius(racers.length);
    const columnSpacing = marbleRadius * 2 + 1;
    const rowSpacing =
      racers.length > 100 ? marbleRadius * 0.65 : columnSpacing;
    const spawnColumns = Math.max(
      5,
      Math.floor((WIDTH - 48) / columnSpacing)
    );
    const spawnRows = Math.ceil(racers.length / spawnColumns);
    const gateY = Math.min(
      190,
      38 + spawnRows * rowSpacing + marbleRadius + 8
    );

    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(2, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, {
        isStatic: true,
        label: "wall",
      }),
      Matter.Bodies.rectangle(WIDTH - 2, WORLD_HEIGHT / 2, 20, WORLD_HEIGHT, {
        isStatic: true,
        label: "wall",
      }),
      Matter.Bodies.rectangle(WIDTH / 2, FINISH_Y + 82, WIDTH, 18, {
        isStatic: true,
        label: "floor",
      }),
      Matter.Bodies.rectangle(WIDTH / 2, FINISH_Y, WIDTH - 36, 6, {
        isStatic: true,
        isSensor: true,
        label: "finish",
      }),
    ]);

    const gate = Matter.Bodies.rectangle(WIDTH / 2, gateY, WIDTH - 12, 12, {
      isStatic: true,
      friction: 0,
      chamfer: { radius: 6 },
      label: "gate",
    });
    Matter.Composite.add(world, gate);

    addPegField(world, 225, 7, 7, 61);

    const bumpers = [
      { x: 92, y: 690, radius: 29 },
      { x: 268, y: 690, radius: 29 },
      { x: 180, y: 790, radius: 37 },
    ];
    bumpers.forEach(({ x, y, radius }) => {
      Matter.Composite.add(
        world,
        Matter.Bodies.circle(x, y, radius, {
          isStatic: true,
          restitution: 1.04,
          friction: 0,
          label: "bumper",
        })
      );
    });

    const spinners: { body: Matter.Body; speed: number }[] = [];
    [
      { x: 103, y: 935, speed: 0.032 },
      { x: 257, y: 935, speed: -0.032 },
      { x: 180, y: 1045, speed: 0.038 },
    ].forEach(({ x, y, speed }) => {
      const body = Matter.Bodies.rectangle(x, y, 104, 9, {
        isStatic: true,
        restitution: 0.58,
        chamfer: { radius: 4 },
        label: "spinner",
      });
      spinners.push({ body, speed });
      Matter.Composite.add(world, body);
    });

    addRamp(world, 1165, "left", 72, 0.16);
    addRamp(world, 1280, "right", 72, 0.16);
    addPegField(world, 1395, 3, 6, 59);

    Matter.Composite.add(world, [
      Matter.Bodies.rectangle(76, 1590, 168, 14, {
        isStatic: true,
        angle: 0.3,
        friction: 0,
        chamfer: { radius: 7 },
        label: "funnel",
      }),
      Matter.Bodies.rectangle(WIDTH - 76, 1590, 168, 14, {
        isStatic: true,
        angle: -0.3,
        friction: 0,
        chamfer: { radius: 7 },
        label: "funnel",
      }),
    ]);

    const marbles = racers.map((restaurant, index) => {
      const column = index % spawnColumns;
      const row = Math.floor(index / spawnColumns);
      const columnWidth =
        spawnColumns === 1 ? 0 : (WIDTH - 48) / (spawnColumns - 1);
      const x = 24 + column * columnWidth + (Math.random() - 0.5) * 1.5;
      const y = 38 + row * rowSpacing;
      const cohortCategory = 1 << ((index % COLLISION_COHORTS) + 1);
      const body = Matter.Bodies.circle(x, y, marbleRadius, {
        restitution: 0.66,
        friction: 0,
        frictionStatic: 0,
        frictionAir: 0.004,
        density: 0.0012,
        collisionFilter: {
          category: cohortCategory,
          mask: COURSE_CATEGORY | cohortCategory,
        },
        label: `marble:${restaurant.placeId}`,
      });
      Matter.Composite.add(world, body);
      return {
        restaurant,
        body,
        color: PALETTE[index % PALETTE.length],
        number: index + 1,
        radius: marbleRadius,
        trail: [],
      };
    });
    marblesRef.current = marbles;
    marbleByBodyRef.current = new Map(
      marbles.map((marble) => [marble.body.id, marble])
    );
    Matter.Events.on(engine, "beforeUpdate", () => {
      spinners.forEach(({ body, speed }) => Matter.Body.rotate(body, speed));
    });

    Matter.Events.on(engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        const marbleA = marbleByBodyRef.current.get(pair.bodyA.id);
        const marbleB = marbleByBodyRef.current.get(pair.bodyB.id);
        const marble = marbleA ?? marbleB;
        if (!marble) continue;

        const obstacle = marbleA ? pair.bodyB : pair.bodyA;
        if (obstacle.label === "finish") {
          finishRace(marble);
          break;
        }

        const speed = Math.hypot(
          marble.body.velocity.x,
          marble.body.velocity.y
        );

        if (speed < 2.2 || particlesRef.current.length > 90) continue;

        for (let index = 0; index < 5; index++) {
          particlesRef.current.push({
            x: marble.body.position.x,
            y: marble.body.position.y,
            vx: (Math.random() - 0.5) * 3.6,
            vy: (Math.random() - 0.5) * 3.6,
            life: 1,
            color: marble.color,
          });
        }
      }
    });

    const countdownTwo = setTimeout(() => {
      setCountdown("2");
      playTone(494);
    }, 450);
    const countdownOne = setTimeout(() => {
      setCountdown("1");
      playTone(554);
    }, 900);
    const countdownGo = setTimeout(() => {
      setCountdown("GO!");
      setAnnouncement("게이트 오픈!");
      playTone(659, 0.14);
      navigator.vibrate?.(30);
      Matter.Composite.remove(world, gate);
    }, 1350);
    const raceStart = setTimeout(() => setPhase("racing"), 1600);
    timersRef.current.push(
      countdownTwo,
      countdownOne,
      countdownGo,
      raceStart
    );

    const timeoutTimer = setTimeout(() => {
      if (resolvedRef.current) return;
      const leader = marbles.reduce((current, marble) =>
        marble.body.position.y > current.body.position.y ? marble : current
      );
      finishRace(leader);
    }, 30000);
    timersRef.current.push(timeoutTimer);

    const runner = Matter.Runner.create();
    runnerRef.current = runner;
    Matter.Runner.run(runner, engine);
  }, [finishRace, phase, playTone, racers, stopEngine]);

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

    const drawCourseStamp = (
      label: string,
      y: number,
      cameraY: number,
      color: string
    ) => {
      const screenY = y - cameraY;
      if (screenY < -30 || screenY > VIEW_HEIGHT + 30) return;

      context.save();
      context.globalAlpha = 0.68;
      context.fillStyle = color;
      context.font = "800 10px sans-serif";
      context.textAlign = "left";
      context.letterSpacing = "1px";
      context.fillText(label, 24, screenY);
      context.restore();
    };

    const render = () => {
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const paper = context.createLinearGradient(0, 0, WIDTH, VIEW_HEIGHT);
      paper.addColorStop(0, "#fbf4e6");
      paper.addColorStop(1, "#eedfc7");
      context.fillStyle = paper;
      context.fillRect(0, 0, WIDTH, VIEW_HEIGHT);

      context.fillStyle = "rgba(93, 58, 34, 0.055)";
      for (let x = 18; x < WIDTH; x += 28) {
        for (let y = 14; y < VIEW_HEIGHT; y += 28) {
          context.beginPath();
          context.arc(x, y, 1, 0, Math.PI * 2);
          context.fill();
        }
      }

      const engine = engineRef.current;
      const marbles = marblesRef.current;
      if (!engine || phase === "lobby") {
        animationRef.current = requestAnimationFrame(render);
        return;
      }

      let leadY = 0;
      for (const marble of marbles) {
        leadY = Math.max(leadY, marble.body.position.y);
      }
      const targetCamera = resolvedRef.current
        ? FINISH_Y - VIEW_HEIGHT * 0.7
        : Math.max(
            0,
            Math.min(
              leadY - VIEW_HEIGHT * 0.34,
              WORLD_HEIGHT - VIEW_HEIGHT
            )
          );
      cameraYRef.current += (targetCamera - cameraYRef.current) * 0.052;
      const cameraY = cameraYRef.current;

      if (!resolvedRef.current && phase === "racing") {
        leaderFrameRef.current += 1;
        if (leaderFrameRef.current % 12 === 0) {
          const sorted = [...marbles].sort(
            (a, b) => b.body.position.y - a.body.position.y
          );
          featuredMarblesRef.current = new Set(
            sorted
              .slice(0, 12)
              .map((marble) => marble.restaurant.placeId)
          );
          setLeaders(sorted.slice(0, 3));
          setProgress(Math.min(99, Math.round((leadY / FINISH_Y) * 100)));

          const currentLeader = sorted[0];
          const now = Date.now();
          if (
            currentLeader &&
            currentLeader.restaurant.placeId !== lastLeaderRef.current &&
            now - lastAnnouncementRef.current > 1200
          ) {
            const wasLeading = lastLeaderRef.current !== "";
            lastLeaderRef.current = currentLeader.restaurant.placeId;
            lastAnnouncementRef.current = now;
            setAnnouncement(
              wasLeading
                ? `${shortName(currentLeader.restaurant.name)} 선두 탈환!`
                : `${shortName(currentLeader.restaurant.name)} 치고 나갑니다`
            );
          }
        }
      }

      drawCourseStamp("01  LUCKY PEGS", 190, cameraY, "#a65d3f");
      drawCourseStamp("02  ORANGE BUMPERS", 625, cameraY, "#d94f24");
      drawCourseStamp("03  TURNTABLE", 880, cameraY, "#167d73");
      drawCourseStamp("04  SWITCHBACK", 1110, cameraY, "#7654a8");
      drawCourseStamp("05  HOME STRETCH", 1350, cameraY, "#3973b9");

      for (const body of Matter.Composite.allBodies(engine.world)) {
        if (
          body.label === "wall" ||
          body.label === "floor" ||
          body.label === "finish" ||
          body.label.startsWith("marble:")
        ) {
          continue;
        }

        const screenY = body.position.y - cameraY;
        if (screenY < -110 || screenY > VIEW_HEIGHT + 110) continue;

        if (body.label === "peg") {
          context.shadowColor = "rgba(124, 79, 38, 0.22)";
          context.shadowBlur = 5;
          context.shadowOffsetY = 2;
          context.beginPath();
          context.arc(body.position.x, screenY, 5, 0, Math.PI * 2);
          context.fillStyle = "#e2ae4e";
          context.fill();
          context.strokeStyle = "#9b6a28";
          context.lineWidth = 1.25;
          context.stroke();
          context.shadowBlur = 0;
          context.shadowOffsetY = 0;
          continue;
        }

        if (body.label === "bumper") {
          context.shadowColor = "rgba(169, 68, 27, 0.25)";
          context.shadowBlur = 12;
          context.shadowOffsetY = 4;
          context.beginPath();
          context.arc(
            body.position.x,
            screenY,
            body.circleRadius ?? 30,
            0,
            Math.PI * 2
          );
          context.fillStyle = "#e85d24";
          context.fill();
          context.strokeStyle = "#7f3520";
          context.lineWidth = 4;
          context.stroke();
          context.beginPath();
          context.arc(
            body.position.x,
            screenY,
            (body.circleRadius ?? 30) - 10,
            0,
            Math.PI * 2
          );
          context.strokeStyle = "#ffd08c";
          context.lineWidth = 3;
          context.stroke();
          context.shadowBlur = 0;
          context.shadowOffsetY = 0;
          continue;
        }

        drawPolygon(body, cameraY);
        context.shadowColor = "rgba(76, 45, 28, 0.22)";
        context.shadowBlur = 6;
        context.shadowOffsetY = 3;

        if (body.label === "spinner") {
          context.fillStyle = "#168c82";
          context.strokeStyle = "#0e514d";
        } else if (body.label === "gate") {
          context.fillStyle = "#e2ae4e";
          context.strokeStyle = "#7f5426";
        } else if (body.label === "funnel") {
          context.fillStyle = "#3973b9";
          context.strokeStyle = "#24496e";
        } else {
          context.fillStyle = "#7654a8";
          context.strokeStyle = "#493267";
        }
        context.lineWidth = 2;
        context.fill();
        context.stroke();
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;
      }

      const finishScreenY = FINISH_Y - cameraY;
      if (finishScreenY > -40 && finishScreenY < VIEW_HEIGHT + 40) {
        context.fillStyle = "#553321";
        context.fillRect(18, finishScreenY - 3, WIDTH - 36, 6);

        const tileSize = 12;
        for (let x = 22; x < WIDTH - 22; x += tileSize) {
          context.fillStyle =
            Math.floor(x / tileSize) % 2 === 0 ? "#fff7e8" : "#e85d24";
          context.fillRect(x, finishScreenY - 7, tileSize, 7);
          context.fillStyle =
            Math.floor(x / tileSize) % 2 === 0 ? "#e85d24" : "#fff7e8";
          context.fillRect(x, finishScreenY, tileSize, 7);
        }
        context.fillStyle = "#553321";
        context.font = "900 12px sans-serif";
        context.textAlign = "center";
        context.fillText("FINISH", WIDTH / 2, finishScreenY - 17);
      }

      for (const marble of marbles) {
        const x = marble.body.position.x;
        const y = marble.body.position.y - cameraY;
        if (y < -60 || y > VIEW_HEIGHT + 60) continue;

        const isFeatured = featuredMarblesRef.current.has(
          marble.restaurant.placeId
        );
        if (isFeatured) {
          marble.trail.push({ x, y: marble.body.position.y });
          if (marble.trail.length > 6) marble.trail.shift();

          marble.trail.forEach((point, index) => {
            const trailY = point.y - cameraY;
            const alpha = ((index + 1) / marble.trail.length) * 0.18;
            context.globalAlpha = alpha;
            context.beginPath();
            context.arc(
              point.x,
              trailY,
              marble.radius * ((index + 1) / marble.trail.length),
              0,
              Math.PI * 2
            );
            context.fillStyle = marble.color;
            context.fill();
          });
        } else if (marble.trail.length > 0) {
          marble.trail = [];
        }
        context.globalAlpha = 1;

        const isWinner =
          winner?.placeId === marble.restaurant.placeId && resolvedRef.current;
        context.shadowColor = isWinner
          ? "rgba(226, 174, 78, 0.9)"
          : "rgba(75, 43, 25, 0.3)";
        context.shadowBlur = isWinner ? 22 : 7;
        context.shadowOffsetY = isWinner ? 0 : 3;
        context.beginPath();
        context.arc(x, y, marble.radius, 0, Math.PI * 2);
        context.fillStyle = marble.color;
        context.fill();
        context.strokeStyle = isWinner ? "#ffd98d" : "#fff8e9";
        context.lineWidth = isWinner ? 3 : 2;
        context.stroke();
        context.shadowBlur = 0;
        context.shadowOffsetY = 0;

        const shine = context.createRadialGradient(
          x - 4,
          y - 5,
          1,
          x,
          y,
          marble.radius
        );
        shine.addColorStop(0, "rgba(255,255,255,0.82)");
        shine.addColorStop(0.35, "rgba(255,255,255,0.09)");
        shine.addColorStop(1, "rgba(70,35,18,0.25)");
        context.fillStyle = shine;
        context.beginPath();
        context.arc(
          x,
          y,
          Math.max(1, marble.radius - 1),
          0,
          Math.PI * 2
        );
        context.fill();

        if (marble.radius >= 7) {
          context.fillStyle = "#fffdf7";
          context.font = `900 ${marble.radius >= 10 ? 9 : 7}px sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(String(marble.number), x, y + 0.5);
          context.textBaseline = "alphabetic";
        }

        if (isWinner) {
          context.strokeStyle = "#e2ae4e";
          context.lineWidth = 2.5;
          context.beginPath();
          context.arc(x, y, marble.radius + 9, 0, Math.PI * 2);
          context.stroke();
        }
      }

      const particles = particlesRef.current.filter(
        (particle) => particle.life > 0
      );
      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.94;
        particle.vy *= 0.94;
        particle.life = Math.max(0, particle.life - 0.045);
        context.globalAlpha = Math.max(0, particle.life);
        context.fillStyle = particle.color;
        context.beginPath();
        context.arc(
          particle.x,
          particle.y - cameraY,
          Math.max(0.1, 2.4 * particle.life),
          0,
          Math.PI * 2
        );
        context.fill();
      }
      context.globalAlpha = 1;
      particlesRef.current = particles.filter((particle) => particle.life > 0);

      const progressHeight = VIEW_HEIGHT - 64;
      context.fillStyle = "rgba(83, 51, 33, 0.12)";
      drawRoundedRect(context, WIDTH - 15, 32, 5, progressHeight, 3);
      context.fill();
      context.fillStyle = "#e85d24";
      drawRoundedRect(
        context,
        WIDTH - 15,
        32,
        5,
        progressHeight * (Math.min(leadY, FINISH_Y) / FINISH_Y),
        3
      );
      context.fill();

      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [phase, winner]);

  useEffect(() => stopEngine, [stopEngine]);

  return (
    <div className="w-full max-w-[410px]">
      <div className="overflow-hidden rounded-[34px] border border-[#78472c] bg-[#603821] p-2 shadow-[0_24px_70px_rgba(83,45,24,0.28)]">
        <div className="relative overflow-hidden rounded-[27px] border border-[#d1b48d] bg-[#f7eddc]">
          <div className="flex h-14 items-center justify-between border-b border-[#d9c5a7] bg-[#fff8eb]/95 px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e85d24] text-[11px] font-black text-white shadow-sm">
                B
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#a65d3f]">
                  Baegopa Marble Club
                </p>
                <p className="text-xs font-extrabold text-[#4d2f20]">
                  오늘의 푸드 레이스
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSoundEnabled((enabled) => !enabled)}
              aria-label={soundEnabled ? "사운드 끄기" : "사운드 켜기"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d9c5a7] bg-white/70 text-[#6b4631] transition-colors hover:bg-white"
            >
              {soundEnabled ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                  <path
                    d="M5 9v6h4l5 4V5L9 9H5Zm12.5-.5a5 5 0 010 7"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
                  <path
                    d="M5 9v6h4l5 4V5L9 9H5Zm12 1 4 4m0-4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>

          <div className="relative aspect-[3/5] w-full">
            <canvas
              ref={canvasRef}
              className="h-full w-full"
              role="img"
              aria-label="음식점 구슬들이 프리미엄 아케이드 코스를 달리는 마블 레이스"
            />

            {phase !== "lobby" && (
              <div className="pointer-events-none absolute inset-x-3 top-3 flex items-center justify-between gap-2">
                <div className="min-w-0 rounded-full border border-[#d9c5a7]/80 bg-[#fff8eb]/92 px-3 py-1.5 shadow-sm backdrop-blur">
                  <p className="truncate text-[11px] font-extrabold text-[#593723]">
                    {announcement}
                  </p>
                </div>
                <div className="shrink-0 rounded-full bg-[#593723] px-2.5 py-1.5 text-[10px] font-black tabular-nums text-[#fff8eb]">
                  {progress}%
                </div>
              </div>
            )}

            {phase === "lobby" && (
              <div className="absolute inset-0 flex flex-col bg-[linear-gradient(180deg,rgba(255,248,235,0.72),rgba(247,237,220,0.97))] px-5 pb-5 pt-6 backdrop-blur-[1.5px]">
                <div className="text-center">
                  <span className="inline-flex rounded-full border border-[#d9c5a7] bg-white/65 px-3 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#a65d3f]">
                    {racers.length} Restaurants · All In
                  </span>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-[#4d2f20]">
                    조회된 음식점 전원 출전!
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#896b55]">
                    주변 {candidates.length}곳이 하나도 빠짐없이
                    <br />
                    구슬이 되어 아케이드 코스를 달려요.
                  </p>
                </div>

                <div className="mb-2 mt-5 grid grid-cols-2 gap-2">
                  {racers.slice(0, 8).map((restaurant, index) => (
                    <div
                      key={restaurant.placeId}
                      className="flex min-w-0 items-center gap-2 rounded-xl border border-[#dfcdb3] bg-white/72 px-2.5 py-2 shadow-[0_2px_0_rgba(117,77,49,0.08)]"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white text-[9px] font-black text-white shadow-sm"
                        style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                      >
                        {index + 1}
                      </span>
                      <span className="truncate text-[11px] font-bold text-[#5b3b29]">
                        {restaurant.name}
                      </span>
                    </div>
                  ))}
                </div>
                {racers.length > 8 && (
                  <p className="text-center text-[10px] font-bold text-[#9a765f]">
                    외 {racers.length - 8}개 음식점도 모두 함께 출발해요
                  </p>
                )}

                <button
                  type="button"
                  onClick={startRace}
                  className="mt-auto w-full rounded-2xl border-b-4 border-[#a33e18] bg-[#e85d24] px-6 py-3.5 text-base font-black text-white shadow-[0_10px_24px_rgba(232,93,36,0.24)] transition-all hover:bg-[#d94f1b] active:translate-y-0.5 active:border-b-2"
                >
                  {racers.length}개 구슬 레이스 시작
                </button>
              </div>
            )}

            {phase === "countdown" && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#4d2f20]/18 backdrop-blur-[1px]">
                <div className="flex h-28 w-28 items-center justify-center rounded-full border-8 border-[#fff8eb] bg-[#e85d24] text-5xl font-black text-white shadow-[0_14px_0_#a33e18,0_24px_50px_rgba(83,45,24,0.35)]">
                  {countdown}
                </div>
              </div>
            )}

            {phase === "racing" && leaders.length > 0 && (
              <div className="pointer-events-none absolute inset-x-3 bottom-3 flex gap-1.5">
                {leaders.map((leader, index) => (
                  <div
                    key={leader.restaurant.placeId}
                    className={`flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-1.5 shadow-sm backdrop-blur ${
                      index === 0
                        ? "flex-[1.35] border-[#d6a63d] bg-[#fff4d2]/95"
                        : "flex-1 border-[#d9c5a7] bg-[#fff8eb]/90"
                    }`}
                  >
                    <span className="text-[9px] font-black text-[#8a654d]">
                      {index + 1}
                    </span>
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: leader.color }}
                    />
                    <span className="truncate text-[10px] font-extrabold text-[#513321]">
                      {shortName(leader.restaurant.name, index === 0 ? 7 : 4)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {phase === "finished" && winner && (
              <div className="absolute inset-0 flex items-end bg-[linear-gradient(180deg,transparent_35%,rgba(67,37,20,0.54))] p-4">
                <div className="w-full rounded-[22px] border border-[#e9c56c] bg-[#fff8eb]/96 p-5 text-center shadow-[0_18px_50px_rgba(63,35,19,0.34)] backdrop-blur">
                  <div className="mx-auto -mt-11 flex h-14 w-14 items-center justify-center rounded-full border-4 border-[#fff8eb] bg-[#e2ae4e] text-xl shadow-lg">
                    🏆
                  </div>
                  <p className="mt-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#a65d3f]">
                    Today&apos;s Winner
                  </p>
                  <p className="mt-1 truncate text-xl font-black text-[#4d2f20]">
                    {winner.name}
                  </p>
                  <p className="mt-1 text-xs text-[#8a6a54]">
                    우승 기록을 확인하러 이동할게요
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#9a765f]">
        <span>Equal odds</span>
        <span className="h-1 w-1 rounded-full bg-[#c7a98d]" />
        <span>Physics race</span>
        <span className="h-1 w-1 rounded-full bg-[#c7a98d]" />
        <span>All {racers.length} marbles</span>
      </div>
    </div>
  );
}
