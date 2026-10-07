import Matter from "matter-js";
import type { Restaurant } from "../types/index";

export const WIDTH = 360;
export const VIEW_HEIGHT = 600;
export const WORLD_HEIGHT = 1840;
export const FINISH_Y = 1690;
const COURSE_CATEGORY = 0x0001;
const COLLISION_COHORTS = 12;

export const PALETTE = [
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

interface TrailPoint {
  x: number;
  y: number;
}

export interface Marble {
  restaurant: Restaurant;
  body: Matter.Body;
  color: string;
  number: number;
  slot: number;
  radius: number;
  trail: TrailPoint[];
}

function shuffle<T>(items: T[], random: () => number) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function getMarbleRadius(count: number) {
  if (count <= 16) return 12;
  if (count <= 40) return 10;
  return 8;
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


export const FIXED_STEP_MS = 1000 / 60;
export const MAX_RACE_STEPS = 1800;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** One immutable roster and one fixed-step simulation, used by play and skip. */
export function createPinballRace(candidates: readonly Restaurant[], seed: number) {
  const random = seededRandom(seed);
  const unique = [...new Map(candidates.map((item) => [item.placeId, item])).values()];
  if (!unique.length) throw new Error("A race needs at least one restaurant");
  const identities = new Map(unique.map((item, index) => [item.placeId, index]));
  const racers = shuffle(unique.map((item) => ({ ...item, location: { ...item.location } })), random);
    const engine = Matter.Engine.create({
      gravity: { x: 0, y: 1, scale: 0.00032 },
      positionIterations: 12,
      velocityIterations: 10,
    });

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
      const x = 24 + column * columnWidth + (random() - 0.5) * 1.5;
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
        color: PALETTE[(identities.get(restaurant.placeId) ?? 0) % PALETTE.length],
        number: (identities.get(restaurant.placeId) ?? 0) + 1,
        slot: index,
        radius: marbleRadius,
        trail: [],
      };
    });
    Matter.Events.on(engine, "beforeUpdate", () => {
      spinners.forEach(({ body, speed }) => Matter.Body.rotate(body, speed));
    });


  let steps = 0;
  let winner: Marble | null = null;
  let reason: "finish" | "time-limit" | null = null;
  let disposed = false;
  const byBody = new Map(marbles.map((marble) => [marble.body.id, marble]));
  const leader = () => [...marbles].sort((a, b) => b.body.position.y - a.body.position.y || a.slot - b.slot)[0];
  Matter.Events.on(engine, "collisionStart", (event) => {
    if (winner) return;
    const arrivals = event.pairs.flatMap((pair) => {
      const marble = pair.bodyA.label === "finish" ? byBody.get(pair.bodyB.id) : pair.bodyB.label === "finish" ? byBody.get(pair.bodyA.id) : undefined;
      return marble ? [marble] : [];
    });
    if (arrivals.length) {
      winner = arrivals.sort((a, b) => b.body.position.y - a.body.position.y || a.slot - b.slot)[0];
      reason = "finish";
    }
  });

  return {
    engine, marbles, racers,
    get winner() { return winner; },
    get reason() { return reason; },
    get steps() { return steps; },
    step(count = 1) {
      if (disposed) return winner;
      if (steps === 0) Matter.Composite.remove(world, gate);
      for (let index = 0; index < count && !winner; index++) {
        Matter.Engine.update(engine, FIXED_STEP_MS);
        steps++;
        if (!winner && steps >= MAX_RACE_STEPS) {
          winner = leader();
          reason = "time-limit";
        }
      }
      return winner;
    },
    dispose() {
      disposed = true;
      Matter.Events.off(engine, "beforeUpdate");
      Matter.Events.off(engine, "collisionStart");
      Matter.Composite.clear(world, false);
      Matter.Engine.clear(engine);
    },
  };
}

export type PinballRace = ReturnType<typeof createPinballRace>;
