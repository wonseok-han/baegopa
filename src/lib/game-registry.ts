import type { GameMeta } from "@/types";
import { RouletteGame } from "@/components/games/roulette";
import { SlotMachineGame } from "@/components/games/slot-machine";
import { PinballGame } from "@/components/games/pinball";
import { GachaGame } from "@/components/games/gacha";

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
  {
    id: "gacha",
    name: "뽑기",
    description: "캡슐에서 뭐가 나올까?",
    icon: "gacha",
    component: GachaGame,
  },
];

export function getRandomGame(): GameMeta {
  return GAMES[Math.floor(Math.random() * GAMES.length)];
}
