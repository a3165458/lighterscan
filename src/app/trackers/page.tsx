import { MarketFilter } from "@/components/market-filter";
import { TrackerBoard } from "@/components/tracker-board";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { perpChoices, resolveMarketChoice } from "@/lib/market-filter";
import { getMarkets, getRecentTrades } from "@/lib/rh";
import {
  readPublicRealtimeSnapshot,
  readTrackerLedger,
} from "@/lib/shared-cache";
import {
  ALL_TRACKER_BUCKET,
  applyEquitiesToLedger,
  applyTradesToLedger,
  emptyTrackerLedger,
  ledgerBucketToSample,
} from "@/lib/tracker-ledger";
import { freezeTrackedSample } from "@/lib/tracker-metrics";
import { getTrackedMarkets, type TrackedMarket } from "@/lib/trackers";
import type { Trade } from "@/lib/types";

export const revalidate = 60;

export const metadata = {
  title: "Account Trackers",
};

function mergeTrades(...lists: Trade[][]): Trade[] {
  const seen = new Set<string>();
  const rows: Trade[] = [];
  for (const list of lists) {
    for (const trade of list) {
      const key = `${trade.marketId}:${trade.tradeId}:${trade.txHash}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(trade);
    }
  }
  return rows;
}

export default async function TrackersPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const [{ market: rawMarket }, lang, markets, defaultTracked, snapshot, stored] =
    await Promise.all([
      searchParams,
      getRequestLang(),
      getMarkets().catch(() => []),
      getTrackedMarkets().catch(() => [] as TrackedMarket[]),
      readPublicRealtimeSnapshot(),
      readTrackerLedger(),
    ]);
  const choices = perpChoices(markets);
  const selected = resolveMarketChoice(rawMarket, choices);
  const extraTrades = selected
    ? await getRecentTrades(selected.marketId, 100, {
        symbol: selected.symbol,
      }).catch(() => [])
    : [];
  const source = mergeTrades(snapshot?.trades ?? [], extraTrades).filter((trade) =>
    selected
      ? trade.marketId === selected.marketId ||
        trade.symbol === selected.symbol
      : true,
  );
  const equities = Object.fromEntries(
    (snapshot?.trackers.whales ?? []).map((row) => [row.accountId, row.accountValue]),
  );
  const ledger = stored ?? emptyTrackerLedger();
  applyTradesToLedger(ledger, source);
  applyEquitiesToLedger(ledger, equities);
  const bucketKey = selected?.symbol ?? ALL_TRACKER_BUCKET;
  const cumulative = ledgerBucketToSample(ledger, bucketKey);
  const sample =
    cumulative.sampledTrades > 0
      ? cumulative
      : freezeTrackedSample(
          source,
          selected
            ? [selected.symbol]
            : defaultTracked.map((market) => market.symbol),
          equities,
        );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          {t(lang, "tracker.kicker")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t(lang, "tracker.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {t(lang, "tracker.subtitle")}
        </p>
      </div>
      <MarketFilter markets={choices} selected={selected?.symbol} />
      <TrackerBoard
        sample={sample}
        emptyLabel={
          selected
            ? t(lang, "tracker.emptyMarket", { market: selected.symbol })
            : undefined
        }
      />
    </div>
  );
}
