import Link from "next/link";
import { TokenIcon } from "@/components/token-icon";
import { compactUsd, formatPct, formatPrice, pnlClass } from "@/lib/format";
import type { Market } from "@/lib/types";

export function LeaderList({
  title,
  hint,
  markets,
  metric,
}: {
  title: string;
  hint?: string;
  markets: Market[];
  metric: "volume" | "trades" | "change";
}) {
  return (
    <section className="panel flex h-[32rem] flex-col p-4">
      <div className="mb-3 shrink-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <ol className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
        {markets.map((m, i) => {
          const value =
            metric === "volume"
              ? compactUsd(m.volume24h)
              : metric === "trades"
                ? m.trades24h.toLocaleString()
                : formatPct(m.change24h);
          const last = m.lastPrice || m.markPrice;
          return (
            <li key={m.symbol}>
              <Link
                href={`/markets/${encodeURIComponent(m.symbol)}`}
                className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 hover:bg-hover"
              >
                <span className="w-6 shrink-0 text-xs tabular text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <TokenIcon symbol={m.symbol} size={22} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{m.symbol}</span>
                    <span className="text-sm tabular">{formatPrice(last)}</span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className={`tabular ${pnlClass(m.change24h)}`}>
                      {formatPct(m.change24h)}
                    </span>
                    <span className="tabular text-muted">{value}</span>
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
