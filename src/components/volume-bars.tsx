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
    <section className="panel flex h-[32rem] flex-col p-4">
      <div className="mb-3 flex shrink-0 items-end justify-between gap-3">
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
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1">
        {rows.map((row, index) => {
          const share = total > 0 ? (row.value / total) * 100 : 0;
          const inner = (
            <>
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="w-5 shrink-0 tabular text-faint">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate font-medium">{row.label}</span>
                </span>
                <span className="shrink-0 tabular text-muted">
                  {compactUsd(row.value)}
                  <span className="ml-2 text-faint">{share.toFixed(1)}%</span>
                </span>
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
