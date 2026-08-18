import { Suspense } from "react";
import Link from "next/link";
import { LeaderList } from "@/components/leader-list";
import { LiveTape } from "@/components/live-tape";
import { MarketTable } from "@/components/market-table";
import { TokenIcon } from "@/components/token-icon";
import { PageHeader, Panel, PanelHead, Stat, StatStrip } from "@/components/ui";
import { VolumeBars } from "@/components/volume-bars";
import { compactUsd, formatPct, formatPrice, pnlClass } from "@/lib/format";
import { t, type Lang } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getOverview } from "@/lib/rh";
import { publicRealtimeTransport } from "@/lib/shared-cache";
import type { Market } from "@/lib/types";

export const revalidate = 60;

export default async function HomePage() {
  const [data, lang] = await Promise.all([getOverview(), getRequestLang()]);
  const perps = data.markets.filter((m) => m.marketType === "perp");
  const liquid = perps.filter((m) => m.volume24h > 10_000);
  const gainers = [...liquid]
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 5);
  const losers = [...liquid]
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 5);
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
    <div className="space-y-4">
      <div className="fade-up space-y-3">
        <PageHeader title={t(lang, "home.title")}>
          <span className="eyebrow hidden sm:inline">{t(lang, "home.kicker")}</span>
        </PageHeader>
        <StatStrip cols={4}>
          <Stat
            label={t(lang, "home.perpVolume")}
            value={compactUsd(data.totals.dailyVolume)}
            hint={t(lang, "home.perpVolumeHint")}
            size="lg"
          />
          <Stat
            label={t(lang, "home.openInterest")}
            value={compactUsd(data.totals.openInterest)}
            hint={t(lang, "home.openInterestHint")}
            size="lg"
          />
          <Stat
            label={t(lang, "home.trades")}
            value={data.totals.dailyTrades.toLocaleString()}
            hint={t(lang, "home.tradesHint")}
          />
          <Stat
            label={t(lang, "home.markets")}
            value={String(data.totals.markets)}
            hint={t(lang, "home.marketsHint", {
              perp: data.totals.perpMarkets,
              spot: data.totals.spotMarkets,
            })}
          />
        </StatStrip>
      </div>

      {data.announcements[0] ? (
        <div className="panel flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 py-2 text-[12.5px]">
          <span className="eyebrow text-accent">{t(lang, "home.notice")}</span>
          <span className="font-medium">{data.announcements[0].title}</span>
          <span className="text-muted">{data.announcements[0].content}</span>
        </div>
      ) : null}

      <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_336px]">
        <Suspense>
          <MarketTable markets={data.markets} />
        </Suspense>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          <LiveTape
            markets={tapeMarkets}
            title={t(lang, "tape.title")}
            transport={publicRealtimeTransport()}
            max={24}
            height="17rem"
          />
          <Panel>
            <PanelHead title={t(lang, "home.discovery")} hint={t(lang, "home.discoveryHint")} />
            <div className="grid sm:grid-cols-1">
              <MoverGroup label={t(lang, "home.gainers")} rows={gainers} lang={lang} />
              <MoverGroup
                label={t(lang, "home.losers")}
                rows={losers}
                lang={lang}
                divide
              />
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-3">
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
    </div>
  );
}

function MoverGroup({
  label,
  rows,
  lang,
  divide = false,
}: {
  label: string;
  rows: Market[];
  lang: Lang;
  divide?: boolean;
}) {
  return (
    <div className={divide ? "border-t border-line" : ""}>
      <div className="flex items-center gap-2 px-3 pt-2 pb-1">
        <span className="eyebrow min-w-0 flex-1">{label}</span>
        <span className="eyebrow w-[68px] text-right">{t(lang, "table.last")}</span>
        <span className="eyebrow w-[58px] text-right">{t(lang, "table.change")}</span>
      </div>
      <ul className="pb-1.5">
        {rows.map((m) => (
          <li key={m.symbol}>
            <Link
              href={`/markets/${encodeURIComponent(m.symbol)}`}
              className="flex items-center gap-2 px-3 py-[3px] text-[12.5px] hover:bg-hover"
            >
              <TokenIcon symbol={m.symbol} size={17} />
              <span className="min-w-0 flex-1 truncate font-medium">{m.symbol}</span>
              <span className="w-[68px] shrink-0 text-right tabular text-muted">
                {formatPrice(m.lastPrice)}
              </span>
              <span
                className={`w-[58px] shrink-0 text-right tabular font-medium ${pnlClass(m.change24h)}`}
              >
                {formatPct(m.change24h)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
