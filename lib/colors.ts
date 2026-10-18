import type { GameColor } from "@/types/game";

export const GAME_COLORS: GameColor[] = [
  {
    id: "red",
    label: "Red",
    hex: "#ff1f2d",
    backgroundClass: "bg-red-500",
    borderClass: "border-red-300",
    textClass: "text-red-50",
  },
  {
    id: "blue",
    label: "Blue",
    hex: "#1237ff",
    backgroundClass: "bg-blue-500",
    borderClass: "border-blue-300",
    textClass: "text-blue-50",
  },
  {
    id: "green",
    label: "Green",
    hex: "#00ef10",
    backgroundClass: "bg-emerald-500",
    borderClass: "border-emerald-300",
    textClass: "text-emerald-50",
  },
  {
    id: "yellow",
    label: "Yellow",
    hex: "#eaff00",
    backgroundClass: "bg-yellow-300",
    borderClass: "border-yellow-100",
    textClass: "text-yellow-950",
  },
  {
    id: "white",
    label: "White",
    hex: "#f7f7f7",
    backgroundClass: "bg-zinc-50",
    borderClass: "border-white",
    textClass: "text-zinc-950",
  },
  {
    id: "pink",
    label: "Pink",
    hex: "#e000ef",
    backgroundClass: "bg-pink-500",
    borderClass: "border-pink-300",
    textClass: "text-pink-50",
  },
];
