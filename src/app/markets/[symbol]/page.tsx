import Link from "next/link";
import { notFound } from "next/navigation";
import { LiveTape } from "@/components/live-tape";
import { OrderBookView } from "@/components/order-book";
import { PriceChart } from "@/components/price-chart";
import { StatCard } from "@/components/stat-card";
import { TokenIcon } from "@/components/token-icon";
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
import { pickMarketFunding } from "@/lib/funding";
import { publicRealtimeTransport } from "@/lib/shared-cache";
import { mergeHistoricalSeries } from "@/lib/series";

export const revalidate = 10;

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

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs text-muted">
          <Link href="/" className="hover:text-ink">
            {t(lang, "market.crumb")}
          </Link>
          <span className="mx-1.5 text-faint">/</span>
          {market.symbol}
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <TokenIcon symbol={market.symbol} size={40} />
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{market.symbol}</h1>
            <p className="text-sm text-muted">
              {t(lang, market.marketType === "spot" ? "common.spot" : "common.perp")} ·{" "}
              {t(
                lang,
                market.assetClass === "spot"
                  ? "common.spot"
                  : market.assetClass === "crypto"
                    ? "common.crypto"
                    : "common.rwa",
              )}{" "}
              · {market.marketId}
            </p>
          </div>
          <div className="ml-auto text-right">
            <div className="text-3xl font-semibold tabular">
              {formatPrice(market.lastPrice)}
            </div>
            <div className={`text-sm tabular ${pnlClass(market.change24h)}`}>
              {formatPct(market.change24h)} 24h
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={t(lang, "market.volume")}
          value={compactUsd(market.volume24h)}
          hint={t(lang, "market.volumeHint")}
        />
        <StatCard
          label={t(lang, "market.trades")}
          value={compactNum(market.trades24h, 0)}
          hint={`${formatPrice(market.low24h)} – ${formatPrice(market.high24h)}`}
        />
        <StatCard
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
        <StatCard
          label={t(lang, "market.funding")}
          value={
            pickMarketFunding(fundingRows, market.marketId)
              ? `${((pickMarketFunding(fundingRows, market.marketId)?.lighter ?? 0) * 100).toFixed(4)}%`
              : "—"
          }
          hint={`${t(lang, "market.spread")} ${formatPrice((market.markPrice || market.lastPrice) - (market.indexPrice || market.lastPrice))}`}
        />
      </div>

      <div className="flex gap-2 text-xs">
        {(["1h", "4h", "1d"] as const).map((value) => (
          <Link
            key={value}
            href={`/markets/${encodeURIComponent(market.symbol)}?tf=${value}`}
            className={`rounded-full px-3 py-1 ${tf === value ? "bg-hover text-ink" : "text-muted"}`}
          >
            {t(lang, value === "1h" ? "chart.1h" : value === "4h" ? "chart.4h" : "chart.1d")}
          </Link>
        ))}
      </div>

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
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <OrderBookView
          book={book}
          title={t(lang, "book.title")}
          hint={t(lang, "book.hint")}
          bidsLabel={t(lang, "book.bids")}
          asksLabel={t(lang, "book.asks")}
        />
        <div className="space-y-4">
          <LiveTape
            markets={[{ marketId: market.marketId, symbol: market.symbol }]}
            title={t(lang, "tape.marketTitle")}
            max={30}
            seed={seeded}
            transport={publicRealtimeTransport()}
          />
        </div>
      </div>
    </div>
  );
}
