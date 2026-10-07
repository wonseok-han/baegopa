import Matter from "matter-js";
import type { Restaurant } from "../types/index";

export const WIDTH = 360;
export const VIEW_HEIGHT = 600;
export const WORLD_HEIGHT = 1840;
export const FINISH_Y = 1690;
const COURSE_CATEGORY = 0x0001;
const COLLISION_COHORTS = 12;

// Low contact friction preserves lateral travel along the long slopes.
const surface = (restitution: number, friction = 0.00002) => Object.freeze({
  restitution,
  friction,
  frictionStatic: 0,
});

/** Applied after Bodies creates each static body; Matter resets materials in setStatic. */
export const COURSE_MATERIALS = Object.freeze({
  wall: surface(0.18),
  floor: surface(0.12),
  finish: surface(0, 0),
  gate: surface(0, 0),
  peg: surface(0.32),
  deflector: surface(0.35),
  bumper: surface(0.58),
  spinner: surface(0.38),
  ramp: surface(0.18),
  funnel: surface(0.2),
});

export const MARBLE_MATERIAL = Object.freeze({
  restitution: 0.26,
  friction: 0.00002,
  frictionStatic: 0,
  frictionAir: 0.006,
});

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
      chamfer: { radius: 6 },
      label: "ramp",
    })
  );
}

// Public steps stay at 60 Hz for playback/skip parity. Each step has two
// collision solves: capped integration travels about 3px per substep, below
// the smallest 8px radius and the 9px-thick moving paddles. Contact-position
// corrections are measured separately by maxSubstepTravel.
export const FIXED_STEP_MS = 1000 / 60;
export const MAX_RACE_STEPS = 24 * 60;
export const PHYSICS_SUBSTEPS = 2;
// Matter normalizes velocity to pixels per 60 Hz tick (324px/second here).
export const MAX_MARBLE_SPEED = 5.4;

export interface PinballRaceDiagnostics {
  readonly obstacleContacts: number;
  readonly winnerObstacleContacts: number;
  readonly winnerDistinctObstacles: number;
  readonly winnerLateralTravel: number;
  readonly maxObservedSpeed: number;
  readonly maxSubstepTravel: number;
  readonly outOfBoundsCount: number;
  readonly nonFiniteCount: number;
  readonly leadChanges: number;
}

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
  const racers = Object.freeze(shuffle(unique.map((item) => Object.freeze({
    ...item,
    location: Object.freeze({ ...item.location }),
  })), random));
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.00046 },
    positionIterations: 12,
    velocityIterations: 10,
  });

  const world = engine.world;
  const marbleRadius = getMarbleRadius(racers.length);
  const columnSpacing = marbleRadius * 2 + 1;
  const rowSpacing =
    racers.length > 100 ? marbleRadius * 0.65 : columnSpacing;
  const spawnColumns = Math.min(racers.length, Math.floor((WIDTH - 56) / columnSpacing));
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
    chamfer: { radius: 6 },
    label: "gate",
  });
  Matter.Composite.add(world, gate);

  addPegField(world, 225, 6, 5, 63);
  // Side kickers close the straight wall lanes between the staggered pegs.
  [
    { x: 50, y: 315, angle: 0.3 },
    { x: 310, y: 445, angle: -0.3 },
    { x: 50, y: 575, angle: 0.3 },
  ].forEach(({ x, y, angle }) => Matter.Composite.add(
    world,
    Matter.Bodies.rectangle(x, y, 106, 16, {
      isStatic: true,
      angle,
      chamfer: { radius: 7 },
      label: "deflector",
    })
  ));

  const bumpers = [
    { x: 92, y: 690, radius: 29 },
    { x: 268, y: 690, radius: 29 },
    { x: 180, y: 790, radius: 37 },
    { x: 12, y: 815, radius: 32 },
    { x: 348, y: 815, radius: 32 },
  ];
  bumpers.forEach(({ x, y, radius }) => {
    Matter.Composite.add(
      world,
      Matter.Bodies.circle(x, y, radius, {
        isStatic: true,
        label: "bumper",
      })
    );
  });

  const spinners: { body: Matter.Body; speed: number }[] = [];
  [
    { x: 103, y: 935, speed: 0.022 },
    { x: 257, y: 935, speed: -0.022 },
    { x: 180, y: 1045, speed: 0.028 },
  ].forEach(({ x, y, speed }) => {
    const body = Matter.Bodies.rectangle(x, y, 104, 9, {
      isStatic: true,
      chamfer: { radius: 4 },
      label: "spinner",
    });
    spinners.push({ body, speed });
    Matter.Composite.add(world, body);
  });

  addRamp(world, 1165, "left", 66, 0.22);
  addRamp(world, 1280, "right", 66, 0.22);
  addPegField(world, 1395, 3, 6, 59);

  Matter.Composite.add(world, [
    Matter.Bodies.rectangle(76, 1590, 168, 14, {
      isStatic: true,
      angle: 0.3,
      chamfer: { radius: 7 },
      label: "funnel",
    }),
    Matter.Bodies.rectangle(WIDTH - 76, 1590, 168, 14, {
      isStatic: true,
      angle: -0.3,
      chamfer: { radius: 7 },
      label: "funnel",
    }),
  ]);

  // Matter.Body.setStatic resets restitution/friction during construction.
  // Assign the tested surface materials only after all static geometry exists.
  for (const body of Matter.Composite.allBodies(world)) {
    const material = COURSE_MATERIALS[body.label as keyof typeof COURSE_MATERIALS];
    if (material) Object.assign(body, material);
  }

  const marbles = racers.map((restaurant, index) => {
    const column = index % spawnColumns;
    const row = Math.floor(index / spawnColumns);
    const columnWidth =
      spawnColumns === 1 ? 0 : (WIDTH - 56) / (spawnColumns - 1);
    const x = spawnColumns === 1
      ? 50 + random() * (WIDTH - 100)
      : 28 + column * columnWidth + (random() - 0.5) * 3;
    const y = 38 + row * rowSpacing;
    const cohortCategory = 1 << ((index % COLLISION_COHORTS) + 1);
    const body = Matter.Bodies.circle(x, y, marbleRadius, {
      ...MARBLE_MATERIAL,
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
    spinners.forEach(({ body, speed }) => {
      const rotation = speed / PHYSICS_SUBSTEPS;
      Matter.Body.rotate(body, rotation);
      // Static motors still need contact-point velocity so a paddle can kick a ball.
      Matter.Body.setAngularVelocity(body, rotation);
    });
  });

  let steps = 0;
  let winner: Marble | null = null;
  let reason: "finish" | "time-limit" | null = null;
  let disposed = false;
  const byBody = new Map(marbles.map((marble) => [marble.body.id, marble]));
  const obstacleLabels = new Set(["peg", "deflector", "bumper", "spinner", "ramp", "funnel"]);
  const measurements = marbles.map((marble) => ({
    contacts: 0,
    obstacles: new Set<number>(),
    lateralTravel: 0,
    x: marble.body.position.x,
    y: marble.body.position.y,
  }));
  let obstacleContacts = 0;
  let maxObservedSpeed = 0;
  let maxSubstepTravel = 0;
  let outOfBoundsCount = 0;
  let nonFiniteCount = 0;
  let leadChanges = 0;
  let lastLeaderSlot: number | null = null;
  const leader = () => marbles.reduce((first, marble) =>
    marble.body.position.y > first.body.position.y ? marble : first
  );
  const limitSpeed = (body: Matter.Body) => {
    if (Matter.Body.getSpeed(body) > MAX_MARBLE_SPEED) {
      Matter.Body.setSpeed(body, MAX_MARBLE_SPEED);
    }
  };
  const recordMotion = () => {
    for (const marble of marbles) {
      const { body, radius, slot } = marble;
      limitSpeed(body);
      const { x, y } = body.position;
      const motion = measurements[slot];
      const speed = Matter.Body.getSpeed(body);
      if (![x, y, speed].every(Number.isFinite)) nonFiniteCount++;
      maxObservedSpeed = Math.max(maxObservedSpeed, speed);
      maxSubstepTravel = Math.max(maxSubstepTravel, Math.hypot(x - motion.x, y - motion.y));
      motion.lateralTravel += Math.abs(x - motion.x);
      motion.x = x;
      motion.y = y;
      if (x < radius - 1 || x > WIDTH - radius + 1 || y < -radius || y > WORLD_HEIGHT) {
        outOfBoundsCount++;
      }
    }
  };
  Matter.Events.on(engine, "collisionStart", (event) => {
    if (winner) return;
    for (const pair of event.pairs) {
      const marble = byBody.get(pair.bodyA.id) ?? byBody.get(pair.bodyB.id);
      const obstacle = byBody.has(pair.bodyA.id) ? pair.bodyB : pair.bodyA;
      if (marble && obstacleLabels.has(obstacle.label)) {
        obstacleContacts++;
        measurements[marble.slot].contacts++;
        measurements[marble.slot].obstacles.add(obstacle.id);
      }
    }
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
    // Read-only telemetry never feeds back into the race or chooses a winner.
    get diagnostics(): PinballRaceDiagnostics {
      const selected = winner ? measurements[winner.slot] : undefined;
      return {
        obstacleContacts,
        winnerObstacleContacts: selected?.contacts ?? 0,
        winnerDistinctObstacles: selected?.obstacles.size ?? 0,
        winnerLateralTravel: selected?.lateralTravel ?? 0,
        maxObservedSpeed,
        maxSubstepTravel,
        outOfBoundsCount,
        nonFiniteCount,
        leadChanges,
      };
    },
    step(count = 1) {
      if (disposed) return winner;
      if (steps === 0) Matter.Composite.remove(world, gate);
      for (let index = 0; index < count && !winner; index++) {
        for (let substep = 0; substep < PHYSICS_SUBSTEPS && !winner; substep++) {
          for (const marble of marbles) limitSpeed(marble.body);
          Matter.Engine.update(engine, FIXED_STEP_MS / PHYSICS_SUBSTEPS);
          recordMotion();
        }
        steps++;
        const leadingSlot = leader().slot;
        if (lastLeaderSlot !== null && leadingSlot !== lastLeaderSlot) leadChanges++;
        lastLeaderSlot = leadingSlot;
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
