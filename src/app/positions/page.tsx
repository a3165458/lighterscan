import Link from "next/link";
import { MarketFilter } from "@/components/market-filter";
import { PageHeader } from "@/components/ui";
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
    <div className="space-y-3.5">
      <PageHeader title={t(lang, "pos.boardTitle")} lede={t(lang, "pos.sample")} />
      <MarketFilter markets={choices} selected={selected?.symbol} />
      <div className="panel overflow-hidden">
        {rows.length === 0 ? (
          <p className="empty">
            {selected
              ? t(lang, "pos.emptyMarket", { market: selected.symbol })
              : t(lang, "pos.emptyBoard")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl min-w-[720px]">
              <thead>
                <tr>
                  <th>{t(lang, "tracker.account")}</th>
                  <th>{t(lang, "table.market")}</th>
                  <th>{t(lang, "pos.side")}</th>
                  <th className="num">{t(lang, "pos.size")}</th>
                  <th className="num">{t(lang, "pos.entry")}</th>
                  <th className="num">{t(lang, "pos.lev")}</th>
                  <th className="num">{t(lang, "pos.upnl")}</th>
                  <th className="num">{t(lang, "pos.value")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={`${row.accountId}-${row.marketId}`}
                    className="deferred-row"
                  >
                    <td>
                      <Link
                        href={`/account/${row.accountId}`}
                        className="font-mono text-muted link-accent"
                      >
                        #{row.accountId}
                      </Link>
                    </td>
                    <td className="font-medium">
                      <Link
                        href={`/markets/${encodeURIComponent(row.symbol)}`}
                        className="link-accent"
                      >
                        {row.symbol}
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`font-medium ${row.side === "long" ? "text-up" : "text-down"}`}
                      >
                        {row.side === "long" ? t(lang, "pos.long") : t(lang, "pos.short")}
                      </span>
                    </td>
                    <td className="num text-muted">{formatSize(row.size)}</td>
                    <td className="num">{formatPrice(row.entry)}</td>
                    <td className="num text-muted">
                      {row.leverage ? `${row.leverage.toFixed(1)}x` : "—"}
                    </td>
                    <td className={`num font-medium ${pnlClass(row.unrealizedPnl)}`}>
                      {compactUsd(row.unrealizedPnl)}
                    </td>
                    <td className="num">{compactUsd(row.value)}</td>
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
