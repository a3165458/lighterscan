import Link from "next/link";
import { MarketFilter } from "@/components/market-filter";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { compactUsd, formatPrice, formatSize, pnlClass } from "@/lib/format";
import { filterByMarket, perpChoices, resolveMarketChoice } from "@/lib/market-filter";
import { loadPublicPositions } from "@/lib/public-boards";
import { getMarkets } from "@/lib/rh";
import { readPublicRealtimeSnapshot } from "@/lib/shared-cache";

export const revalidate = 60;

export const metadata = { title: "Positions" };

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const [{ market: rawMarket }, lang, snapshot, markets] = await Promise.all([
    searchParams,
    getRequestLang(),
    readPublicRealtimeSnapshot(),
    getMarkets().catch(() => []),
  ]);
  const choices = perpChoices(markets);
  const selected = resolveMarketChoice(rawMarket, choices);
  let rows = snapshot?.positions ?? [];
  if (rows.length === 0) {
    rows = await loadPublicPositions(markets).catch(() => []);
  }
  rows = filterByMarket(rows, selected, (row) => row);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "pos.boardTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t(lang, "pos.sample")}</p>
      </div>
      <MarketFilter markets={choices} selected={selected?.symbol} />
      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {selected
              ? t(lang, "pos.emptyMarket", { market: selected.symbol })
              : t(lang, "pos.emptyBoard")}
          </p>
        ) : (
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">{t(lang, "tracker.account")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "table.market")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "pos.side")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "pos.size")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "pos.entry")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "pos.lev")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "pos.upnl")}</th>
                <th className="px-4 py-2.5 font-medium">{t(lang, "pos.value")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.accountId}-${row.marketId}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 font-mono">
                    <Link href={`/account/${row.accountId}`}>#{row.accountId}</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Link href={`/markets/${encodeURIComponent(row.symbol)}`}>{row.symbol}</Link>
                  </td>
                  <td className={`px-3 py-2.5 ${row.side === "long" ? "text-up" : "text-down"}`}>
                    {row.side === "long" ? t(lang, "pos.long") : t(lang, "pos.short")}
                  </td>
                  <td className="px-3 py-2.5 tabular">{formatSize(row.size)}</td>
                  <td className="px-3 py-2.5 tabular">{formatPrice(row.entry)}</td>
                  <td className="px-3 py-2.5 tabular">
                    {row.leverage ? `${row.leverage.toFixed(1)}x` : "—"}
                  </td>
                  <td className={`px-3 py-2.5 tabular ${pnlClass(row.unrealizedPnl)}`}>
                    {compactUsd(row.unrealizedPnl)}
                  </td>
                  <td className="px-4 py-2.5 tabular">{compactUsd(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
