import Link from "next/link";
import { PositionsTable } from "@/components/positions-table";
import {
  PageHeader,
  Panel,
  PanelHead,
  Stat,
  StatStrip,
  toneOf,
} from "@/components/ui";
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

  const upnl = bundle
    ? bundle.primary.positions.reduce((sum, row) => sum + row.unrealizedPnl, 0)
    : 0;

  return (
    <div className="space-y-3.5">
      <PageHeader title={t(lang, "pool.title")}>
        <span className="badge font-mono">#{PUBLIC_POOL_ACCOUNT_INDEX}</span>
      </PageHeader>
      {bundle ? (
        <>
          <StatStrip cols={3}>
            <Stat
              label={t(lang, "account.collateral")}
              value={compactUsd(bundle.primary.collateral)}
              size="lg"
            />
            <Stat
              label={t(lang, "account.exposure")}
              value={compactUsd(
                bundle.primary.positions.reduce(
                  (sum, row) => sum + Math.abs(row.positionValue),
                  0,
                ),
              )}
              size="lg"
            />
            <Stat
              label={t(lang, "pos.upnl")}
              value={compactUsd(upnl)}
              tone={toneOf(upnl)}
              size="lg"
            />
          </StatStrip>
          <section className="space-y-2">
            <h2 className="panel-title">{t(lang, "account.openPositions")}</h2>
            <PositionsTable
              positions={bundle.primary.positions}
              empty={t(lang, "pos.empty")}
              labels={positionLabels(lang)}
            />
          </section>
        </>
      ) : (
        <p className="panel empty">{t(lang, "pool.empty")}</p>
      )}
      <Panel className="max-w-3xl overflow-hidden">
        <PanelHead title={t(lang, "pool.trades")} />
        {trades.length === 0 ? (
          <p className="empty">{t(lang, "tape.waiting")}</p>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>{t(lang, "table.market")}</th>
                <th className="num">{t(lang, "log.price")}</th>
                <th className="num">{t(lang, "account.notional")}</th>
                <th className="num">{t(lang, "log.time")}</th>
              </tr>
            </thead>
            <tbody>
              {trades.slice(0, 40).map((trade) => (
                <tr key={`${trade.tradeId}-${trade.timestamp}`}>
                  <td className="font-medium">
                    <Link
                      href={`/markets/${encodeURIComponent(trade.symbol || String(trade.marketId))}`}
                      className="link-accent"
                    >
                      {trade.symbol || trade.marketId}
                    </Link>
                  </td>
                  <td className="num">{formatPrice(trade.price)}</td>
                  <td className="num">{compactUsd(trade.usdAmount)}</td>
                  <td className="num text-muted">{formatTime(trade.timestamp)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
