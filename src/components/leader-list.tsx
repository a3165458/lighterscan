import Link from "next/link";
import { TokenIcon } from "@/components/token-icon";
import { compactUsd, formatPct, pnlClass } from "@/lib/format";
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
    <section className="panel p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      </div>
      <ol className="space-y-1">
        {markets.map((m, i) => {
          const value =
            metric === "volume"
              ? compactUsd(m.volume24h)
              : metric === "trades"
                ? m.trades24h.toLocaleString()
                : formatPct(m.change24h);
          const tone =
            metric === "change" ? pnlClass(m.change24h) : "text-ink";
          return (
            <li key={m.symbol}>
              <Link
                href={`/markets/${encodeURIComponent(m.symbol)}`}
                className="flex items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-hover"
              >
                <span className="w-5 text-xs tabular text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <TokenIcon symbol={m.symbol} size={22} />
                <span className="flex-1 text-sm font-medium">{m.symbol}</span>
                <span className={`text-sm tabular ${tone}`}>{value}</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
