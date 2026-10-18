import type { DieFace, GameRound, GameState } from "@/types/game";

export const DEFAULT_COUNTDOWN_SECONDS = 30;

export const PLACEHOLDER_DICE: DieFace[] = [
  { id: "die-1", colorId: "red" },
  { id: "die-2", colorId: "blue" },
  { id: "die-3", colorId: "green" },
];

export const PLACEHOLDER_ROUND: GameRound = {
  id: "preview-round",
  phase: "revealed",
  countdownSeconds: DEFAULT_COUNTDOWN_SECONDS,
  dice: PLACEHOLDER_DICE,
};

export const DEFAULT_GAME_STATE: GameState = {
  round: PLACEHOLDER_ROUND,
  updatedAt: new Date(0).toISOString(),
};

export const GAME_COLOR_IDS = [
  "red",
  "blue",
  "green",
  "yellow",
  "white",
  "pink",
] as const;
