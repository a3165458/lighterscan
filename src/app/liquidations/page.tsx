import Link from "next/link";
import { MarketFilter } from "@/components/market-filter";
import { PageHeader } from "@/components/ui";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { compactUsd, formatPrice, formatTime } from "@/lib/format";
import { liquidationsFromTrades, mergeLiquidationRows } from "@/lib/liquidations";
import { filterByMarket, perpChoices, resolveMarketChoice } from "@/lib/market-filter";
import { loadPublicLiquidations } from "@/lib/public-boards";
import { getMarkets } from "@/lib/rh";
import { readPublicRealtimeSnapshot } from "@/lib/shared-cache";

export const revalidate = 60;

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
    <div className="space-y-3.5">
      <PageHeader title={t(lang, "liq.title")}>
        <div className="text-right">
          <div className="eyebrow">{t(lang, "liq.total")}</div>
          <div className="text-[17px] font-semibold tabular">{compactUsd(total)}</div>
        </div>
      </PageHeader>
      <MarketFilter markets={choices} selected={selected?.symbol} />
      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="empty">
            {selected
              ? t(lang, "liq.emptyMarket", { market: selected.symbol })
              : t(lang, "liq.empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[620px]">
              <thead>
                <tr>
                  <th>{t(lang, "log.time")}</th>
                  <th>{t(lang, "table.market")}</th>
                  <th>{t(lang, "liq.account")}</th>
                  <th>{t(lang, "liq.side")}</th>
                  <th className="num">{t(lang, "log.price")}</th>
                  <th className="num">{t(lang, "liq.notional")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.tradeId}-${row.timestamp}`} className="deferred-row">
                    <td className="tabular text-muted">{formatTime(row.timestamp)}</td>
                    <td className="font-medium">
                      <Link
                        href={`/markets/${encodeURIComponent(row.symbol || String(row.marketId))}`}
                        className="link-accent"
                      >
                        {row.symbol || row.marketId}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/account/${row.accountId}`}
                        className="font-mono text-muted link-accent"
                      >
                        #{row.accountId}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`font-medium ${row.side === "long" ? "text-up" : "text-down"}`}
                      >
                        {row.side === "long" ? t(lang, "pos.long") : t(lang, "pos.short")}
                      </span>
                    </td>
                    <td className="num">{formatPrice(row.price)}</td>
                    <td className="num font-medium">{compactUsd(row.usdAmount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
