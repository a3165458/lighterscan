export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up" | "down";
}) {
  const valueClass =
    tone === "up" ? "text-up" : tone === "down" ? "text-down" : "text-ink";
  return (
    <div className="panel px-4 py-3.5">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-faint">
        {label}
      </div>
      <div className={`mt-1.5 text-[22px] font-semibold tracking-tight tabular ${valueClass}`}>
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
