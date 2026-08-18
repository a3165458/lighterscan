import Link from "next/link";
import { PanelHead } from "@/components/ui";
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
    <section className="panel flex h-[26rem] flex-col overflow-hidden">
      <PanelHead title={title} hint={hint}>
        <div className="text-right">
          <div className="eyebrow">{totalLabel ?? "Total"}</div>
          <div className="text-[13px] font-semibold tabular">{compactUsd(total)}</div>
        </div>
      </PanelHead>
      <div className="scroll-y min-h-0 flex-1 space-y-1.5 px-3 py-2.5">
        {rows.map((row, index) => {
          const share = total > 0 ? (row.value / total) * 100 : 0;
          const inner = (
            <>
              <div className="mb-[3px] flex items-baseline gap-2 text-[12px]">
                <span className="w-4 shrink-0 text-[10.5px] tabular text-faint">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
                <span className="shrink-0 tabular text-muted">{compactUsd(row.value)}</span>
                <span className="w-10 shrink-0 text-right tabular text-faint">
                  {share.toFixed(1)}%
                </span>
              </div>
              <div className="meter ml-6">
                <span style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
              </div>
            </>
          );
          return row.href ? (
            <Link key={row.label} href={row.href} className="block rounded-md">
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
