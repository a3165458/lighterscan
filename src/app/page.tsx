import { Suspense } from "react";
import Link from "next/link";
import { LeaderList } from "@/components/leader-list";
import { LiveTape } from "@/components/live-tape";
import { MarketTable } from "@/components/market-table";
import { StatCard } from "@/components/stat-card";
import { TokenIcon } from "@/components/token-icon";
import { VolumeBars } from "@/components/volume-bars";
import { compactUsd, formatPct, pnlClass } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getOverview } from "@/lib/rh";
import { publicRealtimeTransport } from "@/lib/shared-cache";

export const revalidate = 15;

export default async function HomePage() {
  const [data, lang] = await Promise.all([getOverview(), getRequestLang()]);
  const perps = data.markets.filter((m) => m.marketType === "perp");
  const liquid = perps.filter((m) => m.volume24h > 10_000);
  const gainers = [...liquid]
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 6);
  const losers = [...liquid]
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 6);
  const volumeLeaders = perps;
  const tradeLeaders = [...perps].sort((a, b) => b.trades24h - a.trades24h);
  const breakdown = perps.map((m) => ({
    label: m.symbol,
    value: m.volume24h,
    href: `/markets/${encodeURIComponent(m.symbol)}`,
  }));
  const tapeMarkets = perps.slice(0, 16).map((m) => ({
    marketId: m.marketId,
    symbol: m.symbol,
  }));

  return (
    <div className="space-y-8">
      <section className="fade-up">
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          {t(lang, "home.kicker")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t(lang, "home.title")}
        </h1>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t(lang, "home.perpVolume")}
          value={compactUsd(data.totals.dailyVolume)}
          hint={t(lang, "home.perpVolumeHint")}
        />
        <StatCard
          label={t(lang, "home.trades")}
          value={data.totals.dailyTrades.toLocaleString()}
          hint={t(lang, "home.tradesHint")}
        />
        <StatCard
          label={t(lang, "home.markets")}
          value={String(data.totals.markets)}
          hint={t(lang, "home.marketsHint", {
            perp: data.totals.perpMarkets,
            spot: data.totals.spotMarkets,
          })}
        />
        <StatCard
          label={t(lang, "home.openInterest")}
          value={compactUsd(data.totals.openInterest)}
          hint={t(lang, "home.openInterestHint")}
        />
      </section>

      {data.announcements[0] ? (
        <div className="panel px-4 py-3 text-sm">
          <span className="mr-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
            {t(lang, "home.notice")}
          </span>
          <span className="font-medium">{data.announcements[0].title}</span>
          <span className="text-muted"> — {data.announcements[0].content}</span>
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        {[
          { title: t(lang, "home.gainers"), rows: gainers },
          { title: t(lang, "home.losers"), rows: losers },
        ].map((group) => (
          <div key={group.title}>
            <div className="mb-3">
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <p className="text-xs text-muted">{t(lang, "home.discoveryHint")}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.rows.map((m) => (
                <Link
                  key={m.symbol}
                  href={`/markets/${encodeURIComponent(m.symbol)}`}
                  className="panel flex items-center gap-3 px-3 py-3 hover:bg-hover"
                >
                  <TokenIcon symbol={m.symbol} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{m.symbol}</span>
                      <span className={`text-sm tabular ${pnlClass(m.change24h)}`}>
                        {formatPct(m.change24h)}
                      </span>
                    </div>
                    <div className="text-xs text-muted">
                      {t(lang, "home.dailyVolume", { value: compactUsd(m.volume24h) })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <LeaderList
          title={t(lang, "home.volumeLeaders")}
          hint={t(lang, "home.volumeLeadersHint")}
          markets={volumeLeaders}
          metric="volume"
        />
        <LeaderList
          title={t(lang, "home.mostTraded")}
          hint={t(lang, "home.mostTradedHint")}
          markets={tradeLeaders}
          metric="trades"
        />
        <VolumeBars
          title={t(lang, "home.volumeMix")}
          hint={t(lang, "home.volumeMixHint")}
          rows={breakdown}
          totalLabel={t(lang, "home.volumeMixTotal")}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <Suspense>
          <MarketTable markets={data.markets} />
        </Suspense>
        <LiveTape
          markets={tapeMarkets}
          title={t(lang, "tape.title")}
          transport={publicRealtimeTransport()}
        />
      </div>
    </div>
  );
}
