import type { GameMeta } from "@/types";
import { RouletteGame } from "@/components/games/roulette";
import { SlotMachineGame } from "@/components/games/slot-machine";
import { PinballGame } from "@/components/games/pinball";

export const GAMES: GameMeta[] = [
  {
    id: "roulette",
    name: "룰렛",
    description: "회전판을 돌려서 골라보자",
    icon: "roulette",
    component: RouletteGame,
  },
  {
    id: "slot-machine",
    name: "슬롯머신",
    description: "잭팟 음식점은?",
    icon: "slot",
    component: SlotMachineGame,
  },
  {
    id: "pinball",
    name: "핀볼",
    description: "공이 떨어질 곳은 어디?",
    icon: "pinball",
    component: PinballGame,
  },
];

export function getRandomGame(): GameMeta {
  return GAMES[Math.floor(Math.random() * GAMES.length)];
}
