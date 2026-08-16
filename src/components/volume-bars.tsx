import Link from "next/link";
import { compactUsd } from "@/lib/format";

export function VolumeBars({
  title,
  hint,
  rows,
  totalLabel,
}: {
  title: string;
  hint?: string;
  rows: { label: string; value: number; href?: string }[];
  totalLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);
  return (
    <section className="panel p-4">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-[0.12em] text-faint">
            {totalLabel ?? "Total"}
          </div>
          <div className="text-sm font-semibold tabular">{compactUsd(total)}</div>
        </div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const inner = (
            <>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{row.label}</span>
                <span className="tabular text-muted">{compactUsd(row.value)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-hover">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(3, (row.value / max) * 100)}%` }}
                />
              </div>
            </>
          );
          return row.href ? (
            <Link key={row.label} href={row.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={row.label}>{inner}</div>
          );
        })}

      </div>
    </section>
  );
}
