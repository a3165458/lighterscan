import Link from "next/link";
import { PositionsTable } from "@/components/positions-table";
import { StatCard } from "@/components/stat-card";
import { compactUsd, formatPrice, formatTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { positionLabels } from "@/lib/position-labels";
import { getAccountByIndex, RhError } from "@/lib/rh";
import { readPublicRealtimeSnapshot } from "@/lib/shared-cache";
import { PUBLIC_POOL_ACCOUNT_INDEX } from "@/lib/tracker-metrics";

export const revalidate = 60;

export const metadata = { title: "Public Pool" };

export default async function PoolPage() {
  const lang = await getRequestLang();
  const snapshot = await readPublicRealtimeSnapshot();
  let bundle = null;
  try {
    bundle = await getAccountByIndex(PUBLIC_POOL_ACCOUNT_INDEX);
  } catch (error) {
    if (!(error instanceof RhError && error.status === 404)) throw error;
  }
  const trades = (snapshot?.trades ?? []).filter(
    (trade) =>
      trade.askAccountId === PUBLIC_POOL_ACCOUNT_INDEX ||
      trade.bidAccountId === PUBLIC_POOL_ACCOUNT_INDEX,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "pool.title")}</h1>
        <p className="mt-2 font-mono text-sm text-muted">#{PUBLIC_POOL_ACCOUNT_INDEX}</p>
      </div>
      {bundle ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard label={t(lang, "account.collateral")} value={compactUsd(bundle.primary.collateral)} />
            <StatCard
              label={t(lang, "account.exposure")}
              value={compactUsd(
                bundle.primary.positions.reduce((sum, row) => sum + Math.abs(row.positionValue), 0),
              )}
            />
            <StatCard
              label={t(lang, "pos.upnl")}
              value={compactUsd(
                bundle.primary.positions.reduce((sum, row) => sum + row.unrealizedPnl, 0),
              )}
            />
          </div>
          <PositionsTable
            positions={bundle.primary.positions}
            empty={t(lang, "pos.empty")}
            labels={positionLabels(lang)}
          />
        </>
      ) : (
        <p className="panel px-4 py-10 text-center text-sm text-muted">{t(lang, "pool.empty")}</p>
      )}
      <section className="panel overflow-hidden">
        <div className="border-b border-line px-4 py-3 text-sm font-semibold">
          {t(lang, "pool.trades")}
        </div>
        {trades.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{t(lang, "tape.waiting")}</p>
        ) : (
          <ul>
            {trades.slice(0, 40).map((trade) => (
              <li
                key={`${trade.tradeId}-${trade.timestamp}`}
                className="flex items-center justify-between border-b border-line px-4 py-2 text-sm last:border-0"
              >
                <Link href={`/markets/${encodeURIComponent(trade.symbol || String(trade.marketId))}`}>
                  {trade.symbol || trade.marketId}
                </Link>
                <span className="tabular">{formatPrice(trade.price)}</span>
                <span className="tabular">{compactUsd(trade.usdAmount)}</span>
                <span className="text-xs text-muted">{formatTime(trade.timestamp)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
