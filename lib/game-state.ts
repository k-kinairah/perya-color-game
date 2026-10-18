import { DEFAULT_GAME_STATE, GAME_COLOR_IDS } from "@/lib/game";
import type { GameColorId, GamePhase, GameState } from "@/types/game";

const globalForGameState = globalThis as typeof globalThis & {
  peryaGameState?: GameState;
};

export function getGameState() {
  if (!globalForGameState.peryaGameState) {
    globalForGameState.peryaGameState = DEFAULT_GAME_STATE;
  }

  return globalForGameState.peryaGameState;
}

export function updateGameState(input: {
  dice: GameColorId[];
  phase: GamePhase;
  countdownSeconds: number;
}) {
  const nextState: GameState = {
    round: {
      id: crypto.randomUUID(),
      phase: input.phase,
      countdownSeconds: input.countdownSeconds,
      dice: input.dice.map((colorId, index) => ({
        id: `die-${index + 1}`,
        colorId,
      })),
    },
    updatedAt: new Date().toISOString(),
  };

  globalForGameState.peryaGameState = nextState;
  return nextState;
}

export function isGameColorId(value: unknown): value is GameColorId {
  return (
    typeof value === "string" &&
    GAME_COLOR_IDS.includes(value as GameColorId)
  );
}

export function isGamePhase(value: unknown): value is GamePhase {
  return (
    value === "idle" ||
    value === "countdown" ||
    value === "rolling" ||
    value === "revealed"
  );
}
