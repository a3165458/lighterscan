import { Stat, StatStrip, toneOf } from "@/components/ui";
import { formatFundingPct } from "@/lib/format";
import { COMPARE_VENUES, hourlyFromRhRate, type MarketFunding } from "@/lib/funding";
import { t, type Lang } from "@/lib/i18n";

const VENUE_KEY = {
  lighter: "funding.lighter",
  hyperliquid: "funding.hyperliquid",
  binance: "funding.binance",
  bybit: "funding.bybit",
} as const;

export function FundingStrip({
  funding,
  lang,
}: {
  funding: MarketFunding;
  lang: Lang;
}) {
  const venues = [
    { id: "lighter" as const, rate: funding.lighter },
    ...COMPARE_VENUES.map((id) => ({ id, rate: funding[id] })),
  ].filter((row): row is { id: keyof typeof VENUE_KEY; rate: number } => {
    return row.rate != null && Number.isFinite(row.rate);
  });

  if (venues.length === 0) return null;

  const cols = venues.length <= 2 ? 2 : venues.length === 3 ? 3 : 4;

  return (
    <section>
      <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 className="panel-title">{t(lang, "market.funding")}</h2>
        <span className="text-[11.5px] text-faint">{t(lang, "market.fundingHint")}</span>
      </div>
      <StatStrip cols={cols}>
        {venues.map((row) => (
          <Stat
            key={row.id}
            label={t(lang, VENUE_KEY[row.id])}
            value={formatFundingPct(row.rate)}
            tone={toneOf(row.rate)}
            hint={t(lang, "funding.hourly", {
              value: formatFundingPct(hourlyFromRhRate(row.rate)),
            })}
          />
        ))}
      </StatStrip>
    </section>
  );
}
