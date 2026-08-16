import Link from "next/link";
import { TokenIcon } from "@/components/token-icon";
import {
  compactUsd,
  formatPrice,
  formatSize,
  pnlClass,
} from "@/lib/format";
import type { AccountPosition } from "@/lib/types";

export function PositionsTable({
  positions,
  empty = "No open positions.",
  labels,
}: {
  positions: AccountPosition[];
  empty?: string;
  labels?: {
    market: string;
    side: string;
    size: string;
    entry: string;
    value: string;
    upnl: string;
    rpnl: string;
    liq: string;
    long: string;
    short: string;
  };
}) {
  const L = labels ?? {
    market: "Market",
    side: "Side",
    size: "Size",
    entry: "Entry",
    value: "Value",
    upnl: "uPnL",
    rpnl: "rPnL",
    liq: "Liq.",
    long: "Long",
    short: "Short",
  };
  const open = positions.filter((p) => p.position !== 0);
  if (!open.length) {
    return (
      <div className="panel px-4 py-10 text-center text-sm text-muted">{empty}</div>
    );
  }
  return (
    <div className="panel overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 font-medium">{L.market}</th>
            <th className="px-3 py-2.5 font-medium">{L.side}</th>
            <th className="px-3 py-2.5 font-medium">{L.size}</th>
            <th className="px-3 py-2.5 font-medium">{L.entry}</th>
            <th className="px-3 py-2.5 font-medium">{L.value}</th>
            <th className="px-3 py-2.5 font-medium">{L.upnl}</th>
            <th className="px-3 py-2.5 font-medium">{L.rpnl}</th>
            <th className="px-4 py-2.5 font-medium">{L.liq}</th>
          </tr>
        </thead>
        <tbody>
          {open.map((p) => (
            <tr key={`${p.marketId}-${p.symbol}`} className="border-b border-line last:border-0">
              <td className="px-4 py-2.5">
                <Link
                  href={`/markets/${encodeURIComponent(p.symbol)}`}
                  className="flex items-center gap-2"
                >
                  <TokenIcon symbol={p.symbol} size={20} />
                  {p.symbol}
                </Link>
              </td>
              <td className={`px-3 py-2.5 ${p.sign >= 0 ? "text-up" : "text-down"}`}>
                {p.sign >= 0 ? L.long : L.short}
              </td>
              <td className="px-3 py-2.5 tabular">{formatSize(p.position)}</td>
              <td className="px-3 py-2.5 tabular">{formatPrice(p.avgEntryPrice)}</td>
              <td className="px-3 py-2.5 tabular">{compactUsd(p.positionValue)}</td>
              <td className={`px-3 py-2.5 tabular ${pnlClass(p.unrealizedPnl)}`}>
                {compactUsd(p.unrealizedPnl)}
              </td>
              <td className={`px-3 py-2.5 tabular ${pnlClass(p.realizedPnl)}`}>
                {compactUsd(p.realizedPnl)}
              </td>
              <td className="px-4 py-2.5 tabular text-muted">
                {p.liquidationPrice ? formatPrice(p.liquidationPrice) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
