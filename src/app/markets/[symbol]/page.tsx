import { notFound } from "next/navigation";
import { LiveTape } from "@/components/live-tape";
import { OrderBookView } from "@/components/order-book";
import { PriceChart } from "@/components/price-chart";
import { TokenIcon } from "@/components/token-icon";
import { FundingStrip } from "@/components/funding-strip";
import { Crumbs, Stat, StatStrip } from "@/components/ui";
import {
  compactNum,
  compactUsd,
  formatPct,
  formatPrice,
  openInterestUsd,
  pnlClass,
} from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import {
  getCandles,
  getFundingRates,
  getMarket,
  getOrderBook,
  getRecentTrades,
} from "@/lib/rh";
import { hasLighterFunding, pickMarketFunding } from "@/lib/funding";
import { publicRealtimeTransport } from "@/lib/shared-cache";
import { mergeHistoricalSeries } from "@/lib/series";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
  return { title: decodeURIComponent(symbol).toUpperCase() };
}

export default async function MarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ tf?: string }>;
}) {
  const { symbol } = await params;
  const { tf: rawTf } = await searchParams;
  const lang = await getRequestLang();
  const market = await getMarket(symbol);
  if (!market) notFound();
  const tf = rawTf === "4h" || rawTf === "1d" ? rawTf : "1h";
  const countBack = tf === "1d" ? 90 : tf === "4h" ? 90 : 72;

  const [candles, trades, book, fundingRows] = await Promise.all([
    getCandles(market.marketId, tf, countBack).catch(() => []),
    getRecentTrades(market.marketId, 40).catch(() => []),
    getOrderBook(market.marketId, 16).catch(() => ({
      marketId: market.marketId,
      asks: [],
      bids: [],
    })),
    getFundingRates().catch(() => []),
  ]);

  const seeded = trades.map((row) => ({ ...row, symbol: market.symbol }));
  const chartCandles = mergeHistoricalSeries(candles, market.prices);

  const funding = pickMarketFunding(fundingRows, market.marketId);

  return (
    <div className="space-y-3.5">
      <Crumbs
        items={[
          { label: t(lang, "market.crumb"), href: "/" },
          { label: market.symbol },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <TokenIcon symbol={market.symbol} size={34} />
          <div className="min-w-0">
            <h1 className="page-title">{market.symbol}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11.5px] text-faint">
              <span className="tag">
                {t(lang, market.marketType === "spot" ? "common.spot" : "common.perp")}
              </span>
              <span className="tag">
                {t(
                  lang,
                  market.assetClass === "spot"
                    ? "common.spot"
                    : market.assetClass === "crypto"
                      ? "common.crypto"
                      : "common.rwa",
                )}
              </span>
              <span className="tabular">#{market.marketId}</span>
            </p>
          </div>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="hero-num">{formatPrice(market.lastPrice)}</span>
          <span className={`text-[13px] tabular font-medium ${pnlClass(market.change24h)}`}>
            {formatPct(market.change24h)}
            <span className="ml-1 text-faint">24h</span>
          </span>
        </div>
      </div>

      <StatStrip cols={4}>
        <Stat
          label={t(lang, "market.volume")}
          value={compactUsd(market.volume24h)}
          hint={t(lang, "market.volumeHint")}
        />
        <Stat
          label={t(lang, "market.trades")}
          value={compactNum(market.trades24h, 0)}
          hint={`${formatPrice(market.low24h)} – ${formatPrice(market.high24h)}`}
        />
        <Stat
          label={t(lang, "market.oi")}
          value={
            market.marketType === "perp"
              ? compactUsd(
                  openInterestUsd(market.openInterest, market.markPrice || market.lastPrice),
                )
              : "—"
          }
          hint={
            market.marketType === "perp"
              ? t(lang, "market.oiBase", {
                  value: market.openInterest.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  }),
                })
              : t(lang, "market.spot")
          }
        />
        <Stat
          label={t(lang, "market.spread")}
          value={formatPrice(
            (market.markPrice || market.lastPrice) - (market.indexPrice || market.lastPrice),
          )}
          hint={t(lang, "market.mark")}
        />
      </StatStrip>

      {hasLighterFunding(funding) ? <FundingStrip funding={funding} lang={lang} /> : null}

      <PriceChart
        candles={chartCandles}
        emptyLabel={t(lang, "chart.empty")}
        heading={t(lang, "chart.hourly")}
        rangeLabel={
          chartCandles.length >= 2
            ? t(lang, "chart.range", {
                count: chartCandles.length,
                min: formatPrice(Math.min(...chartCandles.map((c) => c.l))),
                max: formatPrice(Math.max(...chartCandles.map((c) => c.h))),
              })
            : ""
        }
        timeframes={(["1h", "4h", "1d"] as const).map((value) => ({
          label: t(lang, value === "1h" ? "chart.1h" : value === "4h" ? "chart.4h" : "chart.1d"),
          href: `/markets/${encodeURIComponent(market.symbol)}?tf=${value}`,
          active: tf === value,
        }))}
      />

      <div className="grid items-start gap-3.5 lg:grid-cols-2">
        <OrderBookView
          book={book}
          title={t(lang, "book.title")}
          hint={t(lang, "book.hint")}
          bidsLabel={t(lang, "book.bids")}
          asksLabel={t(lang, "book.asks")}
        />
        <LiveTape
          markets={[{ marketId: market.marketId, symbol: market.symbol }]}
          title={t(lang, "tape.marketTitle")}
          max={30}
          seed={seeded}
          transport={publicRealtimeTransport()}
          height="21rem"
        />
      </div>
    </div>
  );
}
