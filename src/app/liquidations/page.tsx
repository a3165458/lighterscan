import Link from "next/link";
import { MarketFilter } from "@/components/market-filter";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { compactUsd, formatPrice, formatTime } from "@/lib/format";
import { liquidationsFromTrades, mergeLiquidationRows } from "@/lib/liquidations";
import { filterByMarket, perpChoices, resolveMarketChoice } from "@/lib/market-filter";
import { loadPublicLiquidations } from "@/lib/public-boards";
import { getMarkets } from "@/lib/rh";
import { readPublicRealtimeSnapshot } from "@/lib/shared-cache";

export const revalidate = 8;

export const metadata = { title: "Liquidations" };

export default async function LiquidationsPage({
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
  let rows = mergeLiquidationRows(
    snapshot?.liquidations,
    snapshot ? liquidationsFromTrades(snapshot.trades) : [],
  );
  if (rows.length === 0) {
    rows = await loadPublicLiquidations(markets).catch(() => []);
  }
  rows = filterByMarket(rows, selected, (row) => row);
  const total = rows.reduce((sum, row) => sum + row.usdAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "liq.title")}</h1>
        <p className="text-sm text-muted">
          {t(lang, "liq.total")} {compactUsd(total)}
        </p>
      </div>
      <MarketFilter markets={choices} selected={selected?.symbol} />
      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {selected
              ? t(lang, "liq.emptyMarket", { market: selected.symbol })
              : t(lang, "liq.empty")}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">{t(lang, "log.time")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "table.market")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "liq.account")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "liq.side")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "log.price")}</th>
                <th className="px-4 py-2.5 font-medium">{t(lang, "liq.notional")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.tradeId}-${row.timestamp}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 tabular text-muted">{formatTime(row.timestamp)}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/markets/${encodeURIComponent(row.symbol || String(row.marketId))}`}>
                      {row.symbol || row.marketId}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    <Link href={`/account/${row.accountId}`}>#{row.accountId}</Link>
                  </td>
                  <td className={`px-3 py-2.5 ${row.side === "long" ? "text-up" : "text-down"}`}>
                    {row.side === "long" ? t(lang, "pos.long") : t(lang, "pos.short")}
                  </td>
                  <td className="px-3 py-2.5 tabular">{formatPrice(row.price)}</td>
                  <td className="px-4 py-2.5 tabular">{compactUsd(row.usdAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
