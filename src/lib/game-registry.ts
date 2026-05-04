import type { GameMeta } from "@/types";
import { RouletteGame } from "@/components/games/roulette";
import { SlotMachineGame } from "@/components/games/slot-machine";

export const GAMES: GameMeta[] = [
  {
    id: "roulette",
    name: "룰렛",
    description: "회전판을 돌려서 골라보자!",
    icon: "🎯",
    component: RouletteGame,
  },
  {
    id: "slot-machine",
    name: "슬롯머신",
    description: "777! 잭팟 음식점은?",
    icon: "🎰",
    component: SlotMachineGame,
  },
];

export function getRandomGame(): GameMeta {
  return GAMES[Math.floor(Math.random() * GAMES.length)];
}
