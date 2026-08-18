import Link from "next/link";
import { TokenIcon } from "@/components/token-icon";
import { PanelHead } from "@/components/ui";
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
    <section className="panel flex h-[26rem] flex-col overflow-hidden">
      <PanelHead title={title} hint={hint} />
      <ol className="scroll-y min-h-0 flex-1 py-1">
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
                className="flex items-center gap-2 px-3 py-[5px] text-[12.5px] hover:bg-hover"
              >
                <span className="w-4 shrink-0 text-[10.5px] tabular text-faint">
                  {i + 1}
                </span>
                <TokenIcon symbol={m.symbol} size={19} />
                <span className="min-w-0 flex-1 truncate font-medium">{m.symbol}</span>
                <span className="w-[72px] shrink-0 text-right tabular text-muted">
                  {formatPrice(last)}
                </span>
                <span
                  className={`w-[56px] shrink-0 text-right tabular ${pnlClass(m.change24h)}`}
                >
                  {formatPct(m.change24h)}
                </span>
                <span className="w-[58px] shrink-0 text-right tabular font-medium">
                  {value}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
