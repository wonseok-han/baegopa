"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Matter from "matter-js";
import type { GameProps, Restaurant } from "@/types";

import {
  createPinballRace, WIDTH, VIEW_HEIGHT, WORLD_HEIGHT, FINISH_Y, PALETTE, FIXED_STEP_MS,
  type Marble, type PinballRace,
} from "@/lib/pinball-race";

type RacePhase = "lobby" | "countdown" | "racing" | "finished";
interface Particle { x: number; y: number; vx: number; vy: number; life: number; color: string; }
function shortName(name: string, length = 7) {
  return name.length > length ? `${name.slice(0, length)}…` : name;
}
function subscribeMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function getMotionPreference() { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
function getServerMotionPreference() { return false; }

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
  // Freeze candidates once for this mounted round. A new category remounts the game.
  const [racers] = useState(() => [...new Map(candidates.map((item) => [item.placeId, { ...item, location: { ...item.location } }])).values()]);
  const raceRef = useRef<PinballRace | null>(null);
  const startedRef = useRef(false);
  const deliveredRef = useRef(false);
  const advancingRef = useRef(false);
  const physicsFrameRef = useRef(0);
  const generationRef = useRef(0);
  const [skipping, setSkipping] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const prefersReducedMotion = useSyncExternalStore(subscribeMotion, getMotionPreference, getServerMotionPreference);
  const reduceMotion = motionOverride ?? prefersReducedMotion;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const skipButtonRef = useRef<HTMLButtonElement>(null);
  const resultButtonRef = useRef<HTMLButtonElement>(null);
  const engineRef = useRef<Matter.Engine | null>(null);
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
  const soundRef = useRef(false);

  const playTone = useCallback(
    (frequency: number, duration = 0.08) => {
      if (!soundRef.current) return;
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
    []
  );

  const stopEngine = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    cancelAnimationFrame(physicsFrameRef.current);
    generationRef.current++;
    raceRef.current?.dispose();
    raceRef.current = null;
    engineRef.current = null;
  }, []);

  const finishRace = useCallback((marble: Marble) => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    cancelAnimationFrame(physicsFrameRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setSkipping(false);
    setWinner(marble.restaurant);
    setTimedOut(raceRef.current?.reason === "time-limit");
    setLeaders([marble]);
    setProgress(100);
    setAnnouncement(raceRef.current?.reason === "time-limit"
      ? `제한 시간 선두, ${marble.restaurant.name} 선택!`
      : `${marble.restaurant.name} 도착!`);
    setPhase("finished");
    playTone(784, 0.22);
  }, [playTone]);

  const advanceToResult = useCallback(() => {
    if (!raceRef.current || resolvedRef.current || advancingRef.current) return;
    advancingRef.current = true;
    cancelAnimationFrame(physicsFrameRef.current);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setPhase("racing");
    setSkipping(true);
    setAnnouncement("같은 핀볼의 결과를 확인하고 있어요");
    const generation = generationRef.current;
    const advance = () => {
      const race = raceRef.current;
      if (!race || generation !== generationRef.current) return;
      const selected = race.step(90);
      if (selected) finishRace(selected);
      else timersRef.current.push(setTimeout(advance, 0));
    };
    advance();
  }, [finishRace]);

  const showResult = useCallback(() => {
    if (!winner || deliveredRef.current) return;
    deliveredRef.current = true;
    onResult(winner);
  }, [winner, onResult]);

  const startRace = useCallback(() => {
    if (startedRef.current || !racers.length) return;
    startedRef.current = true;
    stopEngine();
    resolvedRef.current = false;
    advancingRef.current = false;
    cameraYRef.current = 0;
    particlesRef.current = [];
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    const race = createPinballRace(racers, seed);
    raceRef.current = race;
    engineRef.current = race.engine;
    marblesRef.current = race.marbles;
    marbleByBodyRef.current = new Map(race.marbles.map((marble) => [marble.body.id, marble]));
    setPhase("countdown");
    setCountdown("3");
    setAnnouncement(`${racers.length}곳 확정 · 출발 준비`);
    if (reduceMotion) { advanceToResult(); return; }

    Matter.Events.on(race.engine, "collisionStart", (event) => {
      if (advancingRef.current || resolvedRef.current) return;
      for (const pair of event.pairs) {
        const marble = marbleByBodyRef.current.get(pair.bodyA.id) ?? marbleByBodyRef.current.get(pair.bodyB.id);
        if (!marble || Math.hypot(marble.body.velocity.x, marble.body.velocity.y) < 2.2 || particlesRef.current.length > 90) continue;
        for (let index = 0; index < 4; index++) particlesRef.current.push({
          x: marble.body.position.x, y: marble.body.position.y,
          vx: (Math.random() - 0.5) * 3.6, vy: (Math.random() - 0.5) * 3.6, life: 1, color: marble.color,
        });
      }
    });
    const generation = generationRef.current;
    const run = () => {
      if (generation !== generationRef.current || advancingRef.current) return;
      setPhase("racing");
      setAnnouncement("먼저 도착하는 음식점으로!");
      let last = performance.now();
      let accumulator = 0;
      const frame = (now: number) => {
        if (generation !== generationRef.current || advancingRef.current || resolvedRef.current) return;
        // Fixed simulation steps; frame rate and skip affect only presentation speed.
        accumulator += Math.min(now - last, 100) * 3;
        last = now;
        while (accumulator >= FIXED_STEP_MS && !race.winner) {
          race.step();
          accumulator -= FIXED_STEP_MS;
        }
        if (race.winner) finishRace(race.winner);
        else physicsFrameRef.current = requestAnimationFrame(frame);
      };
      physicsFrameRef.current = requestAnimationFrame(frame);
    };
    timersRef.current.push(
      setTimeout(() => { setCountdown("2"); playTone(494); }, 350),
      setTimeout(() => { setCountdown("1"); playTone(554); }, 700),
      setTimeout(run, 1050),
    );
  }, [advanceToResult, finishRace, playTone, racers, reduceMotion, stopEngine]);

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
      if (!engine || phase === "lobby" || reduceMotion || skipping) return;

      let leadY = 0;
      for (const marble of marbles) {
        leadY = Math.max(leadY, marble.body.position.y);
      }
      const winnerY = marbles.find((marble) => marble.restaurant.placeId === winner?.placeId)?.body.position.y ?? FINISH_Y;
      const targetCamera = resolvedRef.current
        ? Math.max(0, Math.min(winnerY - VIEW_HEIGHT * 0.45, WORLD_HEIGHT - VIEW_HEIGHT))
        : Math.max(
            0,
            Math.min(
              leadY - VIEW_HEIGHT * 0.34,
              WORLD_HEIGHT - VIEW_HEIGHT
            )
          );
      cameraYRef.current = resolvedRef.current
        ? targetCamera
        : cameraYRef.current + (targetCamera - cameraYRef.current) * 0.052;
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

      if (phase !== "finished") animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationRef.current);
  }, [phase, winner, reduceMotion, skipping]);

  useEffect(() => stopEngine, [stopEngine]);

  useEffect(() => {
    // Restore the action focus only when the previous action was removed.
    // Leave focus alone when the user moved to sound, back, or another control.
    if (document.activeElement !== document.body) return;
    if (phase === "finished") resultButtonRef.current?.focus({ preventScroll: true });
    else if (phase === "countdown" || phase === "racing") skipButtonRef.current?.focus({ preventScroll: true });
  }, [phase]);

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
                  Baegopa Pinball Club
                </p>
                <p className="text-xs font-extrabold text-[#4d2f20]">
                  오늘의 한 끼 핀볼
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { soundRef.current = !soundRef.current; setSoundEnabled(soundRef.current); }}
              aria-pressed={soundEnabled}
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
              aria-label="음식점 구슬들의 핀볼 코스. 결과는 아래 텍스트로도 안내합니다."
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
                    {racers.length}곳 · 준비 완료
                  </span>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-[#4d2f20]">
                    오늘은 어디서 먹을까?
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-[#896b55]">
                    확인한 후보 {racers.length}곳이
                    <br />
                    핀볼 코스를 달려 오늘의 한 끼를 골라요.
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
                  disabled={!racers.length}
                  className="mt-auto w-full rounded-2xl border-b-4 border-[#a33e18] bg-[#e85d24] px-6 py-3.5 text-base font-black text-white shadow-[0_10px_24px_rgba(232,93,36,0.24)] transition-all hover:bg-[#d94f1b] active:translate-y-0.5 active:border-b-2"
                >
                  {racers.length === 1 ? "이 음식점으로 핀볼 시작" : "핀볼로 골라줘!"}
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
                    {timedOut ? "제한 시간에 가장 앞선 음식점이에요" : "오늘의 한 끼, 여기 어때요?"}
                  </p>
                  <button ref={resultButtonRef} type="button" onClick={showResult} className="mt-4 w-full rounded-xl bg-[#e85d24] px-4 py-3 text-sm font-extrabold text-white">음식점 정보 보기</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <p role="status" aria-live="polite" aria-atomic="true" className="mt-4 text-center text-sm font-bold text-[#6d4933] dark:text-[#d7bda5]">
        {phase === "finished" ? announcement : skipping ? "움직임 없이 같은 결과를 계산하고 있어요…" : phase === "lobby" ? `${racers.length}곳이 준비됐어요` : "핀볼 진행 중 · 후보는 바뀌지 않아요"}
      </p>
      {phase === "lobby" && <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 text-xs text-[#6d4933] dark:text-[#d7bda5]">
        <input type="checkbox" checked={reduceMotion} onChange={(event) => setMotionOverride(event.target.checked)} className="h-4 w-4 accent-[#e85d24]" />
        움직임 없이 결과 보기
      </label>}
      {(phase === "countdown" || phase === "racing") && <button ref={skipButtonRef} type="button" onClick={advanceToResult} disabled={skipping} className="mt-3 w-full rounded-xl border border-[#c7a98d] px-4 py-3 text-sm font-bold text-[#6d4933] disabled:opacity-50 dark:text-[#d7bda5]">
        {skipping ? "결과 확인 중…" : "연출 건너뛰고 결과 보기"}
      </button>}
      <p className="mt-3 text-center text-[11px] leading-5 text-[#896b55] dark:text-[#bfa38b]">
        출발 순서를 무작위로 섞고 먼저 도착한 음식점을 선택해요.
        <br />제한 시간에는 선두를 선택하며, 건너뛰어도 같은 핀볼 결과예요.
      </p>

    </div>
  );
}
