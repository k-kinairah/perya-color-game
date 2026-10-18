import {
  getGameState,
  isGameColorId,
  isGamePhase,
  updateGameState,
} from "@/lib/game-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(getGameState());
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    dice?: unknown;
    phase?: unknown;
    countdownSeconds?: unknown;
  };

  if (
    !Array.isArray(body.dice) ||
    body.dice.length !== 3 ||
    !body.dice.every(isGameColorId) ||
    !isGamePhase(body.phase)
  ) {
    return Response.json({ error: "Invalid game state payload." }, { status: 400 });
  }

  const countdownSeconds =
    typeof body.countdownSeconds === "number"
      ? Math.max(0, Math.min(999, Math.floor(body.countdownSeconds)))
      : 30;

  return Response.json(
    updateGameState({
      dice: body.dice,
      phase: body.phase,
      countdownSeconds,
    }),
  );
}
