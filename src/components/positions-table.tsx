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
    return <div className="panel empty">{empty}</div>;
  }
  return (
    <div className="panel overflow-x-auto">
      <table className="tbl min-w-[700px]">
        <thead>
          <tr>
            <th>{L.market}</th>
            <th>{L.side}</th>
            <th className="num">{L.size}</th>
            <th className="num">{L.entry}</th>
            <th className="num">{L.value}</th>
            <th className="num">{L.upnl}</th>
            <th className="num">{L.rpnl}</th>
            <th className="num">{L.liq}</th>
          </tr>
        </thead>
        <tbody>
          {open.map((p) => (
            <tr key={`${p.marketId}-${p.symbol}`}>
              <td>
                <Link
                  href={`/markets/${encodeURIComponent(p.symbol)}`}
                  className="flex items-center gap-2 font-medium"
                >
                  <TokenIcon symbol={p.symbol} size={18} />
                  {p.symbol}
                </Link>
              </td>
              <td>
                <span className={`font-medium ${p.sign >= 0 ? "text-up" : "text-down"}`}>
                  {p.sign >= 0 ? L.long : L.short}
                </span>
              </td>
              <td className="num text-muted">{formatSize(p.position)}</td>
              <td className="num">{formatPrice(p.avgEntryPrice)}</td>
              <td className="num">{compactUsd(p.positionValue)}</td>
              <td className={`num font-medium ${pnlClass(p.unrealizedPnl)}`}>
                {compactUsd(p.unrealizedPnl)}
              </td>
              <td className={`num ${pnlClass(p.realizedPnl)}`}>
                {compactUsd(p.realizedPnl)}
              </td>
              <td className="num text-faint">
                {p.liquidationPrice ? formatPrice(p.liquidationPrice) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
