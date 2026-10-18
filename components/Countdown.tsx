export interface CountdownProps {
  seconds: number;
  label?: string;
}

export default function Countdown({
  seconds,
  label = "Next roll",
}: CountdownProps) {
  return (
    <div className="flex min-w-40 flex-col items-center rounded-[8px] border-4 border-amber-300/70 bg-black/55 px-6 py-3 text-center shadow-[inset_0_0_24px_rgba(251,191,36,0.18)]">
      <span className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">
        {label}
      </span>
      <span className="font-mono text-5xl font-black tabular-nums leading-none text-white sm:text-6xl">
        {seconds}
      </span>
      {/* TODO: Replace static value with live countdown state. */}
    </div>
  );
}
