"use client";

import { useMemo, useState } from "react";
import { GAME_COLORS } from "@/lib/colors";
import { DEFAULT_COUNTDOWN_SECONDS, PLACEHOLDER_DICE } from "@/lib/game";
import { cn } from "@/lib/utils";
import type { GameColorId, GamePhase } from "@/types/game";

const phaseOptions: Array<{ label: string; value: GamePhase }> = [
  { label: "Standby", value: "idle" },
  { label: "Countdown", value: "countdown" },
  { label: "Rolling", value: "rolling" },
  { label: "Reveal", value: "revealed" },
];

export default function AdminPanel() {
  const [selectedDice, setSelectedDice] = useState<GameColorId[]>(
    PLACEHOLDER_DICE.map((die) => die.colorId),
  );
  const [phase, setPhase] = useState<GamePhase>("revealed");
  const [countdownSeconds, setCountdownSeconds] = useState(
    DEFAULT_COUNTDOWN_SECONDS,
  );
  const [status, setStatus] = useState("Ready");

  const previewLabel = useMemo(
    () => selectedDice.map((color) => color.toUpperCase()).join(" / "),
    [selectedDice],
  );

  function setDie(index: number, colorId: GameColorId) {
    setSelectedDice((current) =>
      current.map((value, currentIndex) =>
        currentIndex === index ? colorId : value,
      ),
    );
  }

  async function publish(nextPhase = phase) {
    setStatus("Publishing...");

    const response = await fetch("/api/game-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dice: selectedDice,
        phase: nextPhase,
        countdownSeconds,
      }),
    });

    setStatus(response.ok ? "Live display updated" : "Update failed");
  }

  async function publishPhase(nextPhase: GamePhase) {
    setPhase(nextPhase);
    await publish(nextPhase);
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-4 text-zinc-950 sm:p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_24rem]">
        <section className="rounded-[8px] border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-6 flex flex-col gap-2 border-b border-zinc-200 pb-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
              Private operator panel
            </p>
            <h1 className="text-3xl font-black">Manual Color Control</h1>
            <p className="max-w-2xl text-sm text-zinc-600">
              Pick the exact three dice colors, then publish them to the OBS
              display. Viewers only see the /game screen.
            </p>
          </div>

          <div className="grid gap-5">
            {[0, 1, 2].map((dieIndex) => (
              <div
                className="rounded-[8px] border border-zinc-200 bg-zinc-50 p-4"
                key={dieIndex}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="font-black uppercase tracking-[0.12em]">
                    Die {dieIndex + 1}
                  </h2>
                  <span className="text-sm font-bold uppercase text-zinc-500">
                    {selectedDice[dieIndex]}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {GAME_COLORS.map((color) => (
                    <button
                      className={cn(
                        "rounded-[8px] border-4 px-3 py-5 text-sm font-black uppercase shadow-sm transition",
                        color.backgroundClass,
                        color.borderClass,
                        color.textClass,
                        selectedDice[dieIndex] === color.id
                          ? "ring-4 ring-zinc-950"
                          : "opacity-75 hover:opacity-100",
                      )}
                      key={color.id}
                      onClick={() => setDie(dieIndex, color.id)}
                      type="button"
                    >
                      {color.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <section className="rounded-[8px] border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-black">Display State</h2>
            <div className="grid gap-3">
              {phaseOptions.map((option) => (
                <button
                  className={cn(
                    "rounded-[8px] border px-4 py-3 text-left text-sm font-black uppercase tracking-[0.12em] transition",
                    phase === option.value
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-zinc-200 bg-white hover:border-red-500",
                  )}
                  key={option.value}
                  onClick={() => publishPhase(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[8px] border border-zinc-200 bg-white p-5 shadow-sm">
            <label className="text-sm font-black uppercase tracking-[0.12em]">
              Countdown seconds
            </label>
            <input
              className="mt-2 w-full rounded-[8px] border border-zinc-300 px-4 py-3 text-2xl font-black"
              max={999}
              min={0}
              onChange={(event) =>
                setCountdownSeconds(Number(event.target.value))
              }
              type="number"
              value={countdownSeconds}
            />
            <button
              className="mt-4 w-full rounded-[8px] bg-red-700 px-4 py-4 text-sm font-black uppercase tracking-[0.16em] text-white transition hover:bg-red-800"
              onClick={() => publish()}
              type="button"
            >
              Apply Selected Colors
            </button>
          </section>

          <section className="rounded-[8px] border border-zinc-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">
              Current selection
            </p>
            <p className="mt-2 text-xl font-black">{previewLabel}</p>
            <p className="mt-3 text-sm font-bold text-red-700">{status}</p>
          </section>
        </aside>
      </div>
    </main>
  );
}
