import { MarketFilter } from "@/components/market-filter";
import { StatCard } from "@/components/stat-card";
import { VolumeBars } from "@/components/volume-bars";
import { compactUsd, formatTime, openInterestUsd } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { filterByMarket, perpChoices, resolveMarketChoice } from "@/lib/market-filter";
import { loadPublicHourlyVolume, loadPublicLiquidations } from "@/lib/public-boards";
import { getCandles, getOverview } from "@/lib/rh";
import { hourlyQuoteVolume } from "@/lib/series";
import { readHourlyStats, readPublicRealtimeSnapshot } from "@/lib/shared-cache";

export const revalidate = 60;

export const metadata = { title: "Stats" };

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const [{ market: rawMarket }, lang, overview, hours, snapshot] = await Promise.all([
    searchParams,
    getRequestLang(),
    getOverview(),
    readHourlyStats(),
    readPublicRealtimeSnapshot(),
  ]);
  const choices = perpChoices(overview.markets);
  const selected = resolveMarketChoice(rawMarket, choices);
  const selectedMarket = selected
    ? overview.markets.find((market) => market.marketId === selected.marketId)
    : null;
  const candleHours = selected
    ? hourlyQuoteVolume(
        await getCandles(selected.marketId, "1h", 24).catch(() => []),
      )
    : await loadPublicHourlyVolume(overview.markets).catch(() => []);
  const curve =
    candleHours.length >= 2
      ? candleHours
      : selected
        ? candleHours
        : hours.map((row) => ({ t: row.t, volume: row.volume }));
  const values = curve.map((row) => row.volume);
  const max = Math.max(...values, 1);
  const liveLiqs = filterByMarket(
    snapshot?.liquidations ?? [],
    selected,
    (row) => row,
  );
  let liquidationNotional = selected
    ? liveLiqs.reduce((sum, row) => sum + row.usdAmount, 0)
    : hours.at(-1)?.liquidations ?? 0;
  if (!liquidationNotional) {
    const fallback = liveLiqs.length
      ? liveLiqs
      : filterByMarket(
          await loadPublicLiquidations(overview.markets).catch(() => []),
          selected,
          (row) => row,
        );
    liquidationNotional = fallback.reduce((sum, row) => sum + row.usdAmount, 0);
  }
  const volume = selectedMarket?.volume24h ?? overview.totals.dailyVolume;
  const oi = selectedMarket
    ? openInterestUsd(
        selectedMarket.openInterest,
        selectedMarket.markPrice || selectedMarket.lastPrice,
      )
    : overview.totals.openInterest;
  const mix = (selectedMarket ? [selectedMarket] : overview.markets)
    .filter((market) => market.marketType === "perp")
    .map((market) => ({
      label: market.symbol,
      value: market.volume24h,
      href: `/markets/${encodeURIComponent(market.symbol)}`,
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "stats.title")}</h1>
        <MarketFilter markets={choices} selected={selected?.symbol} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t(lang, "stats.volume")} value={compactUsd(volume)} />
        <StatCard label={t(lang, "stats.oi")} value={compactUsd(oi)} />
        <StatCard
          label={t(lang, "stats.liquidations")}
          value={compactUsd(liquidationNotional)}
        />
      </div>
      <div className="panel p-4">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">{t(lang, "stats.volumeCurve")}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {selected
              ? t(lang, "stats.volumeCurveHintMarket", { market: selected.symbol })
              : t(lang, "stats.volumeCurveHint")}
          </p>
        </div>
        {curve.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">
            {selected
              ? t(lang, "stats.emptyMarket", { market: selected.symbol })
              : t(lang, "stats.empty")}
          </p>
        ) : (
          <div className="flex h-56 items-end gap-1">
            {curve.map((row) => (
              <div
                key={row.t}
                className="flex-1 rounded-sm bg-accent/70"
                style={{ height: `${Math.max(6, (row.volume / max) * 100)}%` }}
                title={`${formatTime(row.t)} · ${compactUsd(row.volume)}`}
              />
            ))}
          </div>
        )}
      </div>
      <VolumeBars
        title={t(lang, "home.volumeMix")}
        hint={t(lang, "home.volumeMixHint")}
        rows={mix}
        totalLabel={t(lang, "home.volumeMixTotal")}
      />
    </div>
  );
}
