export type GameColorId =
  | "red"
  | "blue"
  | "green"
  | "yellow"
  | "white"
  | "pink";

export type GamePhase = "idle" | "countdown" | "rolling" | "revealed";

export interface GameColor {
  id: GameColorId;
  label: string;
  hex: string;
  backgroundClass: string;
  borderClass: string;
  textClass: string;
}

export interface DieFace {
  id: string;
  colorId: GameColorId;
}

export interface GameRound {
  id: string;
  phase: GamePhase;
  countdownSeconds: number;
  dice: DieFace[];
}

export interface GameState {
  round: GameRound;
  updatedAt: string;
}
