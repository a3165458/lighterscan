import { cached } from "@/lib/cache";
import { RH_API } from "@/lib/config";
import { retryDelayMs } from "@/lib/rh-retry";
import {
  classifyAsset,
  num,
  normalizeTs,
  openInterestUsd,
} from "@/lib/format";
import type {
  AccountBundle,
  AccountSummary,
  AccountAsset,
  AccountPosition,
  Candle,
  LeaderboardEntry,
  Market,
  OrderBook,
  Overview,
  Trade,
} from "@/lib/types";
import { mapFundingRates, type MarketFunding } from "./funding.ts";

export { RH_API, RH_WS } from "@/lib/config";

class RhError extends Error {
  status: number;
  code?: number;
  constructor(message: string, status = 500, code?: number) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const MIN_REQUEST_INTERVAL_MS = 250;
const MAX_REQUEST_ATTEMPTS = 4;
let nextRequestAt = 0;
let requestQueue = Promise.resolve();

async function waitForRhRequestSlot() {
  const previous = requestQueue;
  let release!: () => void;
  requestQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    let waitMs = Math.max(0, nextRequestAt - Date.now());
    while (waitMs > 0) {
      await sleep(waitMs);
      waitMs = Math.max(0, nextRequestAt - Date.now());
    }
    nextRequestAt = Date.now() + MIN_REQUEST_INTERVAL_MS;
  } finally {
    release();
  }
}

function deferRhRequests(delayMs: number) {
  nextRequestAt = Math.max(nextRequestAt, Date.now() + delayMs);
}

async function rhGet<T>(
  path: string,
  ttlMs: number,
  init?: RequestInit,
): Promise<T> {
  return cached(`rh:${path}`, ttlMs, async () => {
    let lastErr: Error = new RhError("RH API error");
    const revalidate = Math.max(1, Math.ceil(ttlMs / 1000));
    for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt++) {
      const url = path.startsWith("http") ? path : `${RH_API}${path}`;
      await waitForRhRequestSlot();
      const res = await fetch(url, {
        ...init,
        headers: {
          accept: "application/json",
          "user-agent": "LighterScan/0.1 (+robinhood-lighter explorer)",
          ...init?.headers,
        },
        next: { revalidate },
      });
      const text = await res.text();
      let body: Record<string, unknown> = {};
      try {
        body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        lastErr = new RhError(`Invalid JSON from ${path}`, res.status);
        await sleep(300);
        continue;
      }
      const code = num(body.code, res.ok ? 200 : res.status);
      if (code === 200 || code === 0) return body as T;
      const message = String(body.message || res.statusText || "RH API error");
      const missing =
        code === 21100 ||
        code === 29404 ||
        /not found/i.test(message) ||
        /invalid account/i.test(message);
      lastErr = new RhError(message, missing ? 404 : res.status || 400, code);
      if (code === 23000 || res.status === 429) {
        deferRhRequests(
          retryDelayMs(res.headers.get("retry-after"), attempt),
        );
        continue;
      }
      throw lastErr;
    }
    throw lastErr;
  });
}

function asMarketType(value: unknown): "perp" | "spot" {
  return String(value).toLowerCase() === "spot" ? "spot" : "perp";
}

function mapMarket(raw: Record<string, unknown>): Market {
  const symbol = String(raw.symbol || "");
  const marketType = asMarketType(raw.market_type);
  return {
    symbol,
    marketId: num(raw.market_id),
    marketType,
    assetClass: classifyAsset(symbol, marketType),
    status: String(raw.status || "active"),
    lastPrice: num(raw.last_trade_price ?? raw.last_price),
    markPrice: num(raw.mark_price),
    indexPrice: num(raw.index_price),
    change24h: num(raw.daily_price_change),
    volume24h: num(raw.daily_quote_token_volume),
    baseVolume24h: num(raw.daily_base_token_volume),
    trades24h: num(raw.daily_trades_count),
    openInterest: num(raw.open_interest),
    high24h: num(raw.daily_price_high),
    low24h: num(raw.daily_price_low),
    takerFee: num(raw.taker_fee),
    makerFee: num(raw.maker_fee),
    minBaseAmount: num(raw.min_base_amount),
    minQuoteAmount: num(raw.min_quote_amount),
    prices: [],
  };
}

export async function getOverview(): Promise<Overview> {
  const detailsPromise = rhGet<Record<string, unknown>>(
    "/api/v1/orderBookDetails",
    20_000,
  ).catch(() =>
    rhGet<Record<string, unknown>>("/api/v1/orderBooks", 20_000),
  );
  const [details, stats, charts, announcements] = await Promise.all([
    detailsPromise,
    rhGet<Record<string, unknown>>("/api/v1/exchangeStats", 20_000).catch(
      () => ({}) as Record<string, unknown>,
    ),
    rhGet<Record<string, unknown>>("/api/v1/marketPriceCharts", 45_000).catch(
      () => ({}) as Record<string, unknown>,
    ),
    rhGet<Record<string, unknown>>("/api/v1/announcement", 90_000).catch(
      () => ({}) as Record<string, unknown>,
    ),
  ]);

  const rawMarkets = [
    ...((details.order_book_details as Record<string, unknown>[]) || []),
    ...((details.spot_order_book_details as Record<string, unknown>[]) || []),
    ...((details.order_books as Record<string, unknown>[]) || []),
  ];

  const chartMap = new Map<number, number[]>();
  for (const row of (charts.price_charts as Record<string, unknown>[]) || []) {
    const id = num(row.market_id);
    const prices = Array.isArray(row.prices)
      ? row.prices.map((p) => num(p)).filter((n) => n > 0)
      : [];
    chartMap.set(id, prices);
  }

  const statMap = new Map<string, Record<string, unknown>>();
  for (const row of (stats.order_book_stats as Record<string, unknown>[]) || []) {
    statMap.set(String(row.symbol), row);
  }

  const markets = rawMarkets
    .map((raw) => {
      const extra = statMap.get(String(raw.symbol));
      const merged = extra ? { ...raw, ...extra } : raw;
      const market = mapMarket(merged);
      market.prices = chartMap.get(market.marketId) || [];
      return market;
    })
    .filter((m) => m.symbol)
    .sort((a, b) => b.volume24h - a.volume24h);

  const unique = new Map<string, Market>();
  for (const m of markets) {
    const key = `${m.marketType}:${m.symbol}`;
    if (!unique.has(key)) unique.set(key, m);
  }
  const list = [...unique.values()];

  const dailyVolume =
    num(stats.daily_usd_volume) ||
    list.reduce((s, m) => s + m.volume24h, 0);
  const dailyTrades =
    num(stats.daily_trades_count) ||
    list.reduce((s, m) => s + m.trades24h, 0);

  return {
    generatedAt: Date.now(),
    totals: {
      dailyVolume,
      dailyTrades,
      markets: list.length,
      perpMarkets: list.filter((m) => m.marketType === "perp").length,
      spotMarkets: list.filter((m) => m.marketType === "spot").length,
      openInterest: list
        .filter((m) => m.marketType === "perp")
        .reduce(
          (s, m) => s + openInterestUsd(m.openInterest, m.markPrice || m.lastPrice),
          0,
        ),
    },
    markets: list,
    announcements: ((announcements.announcements as Record<string, unknown>[]) || [])
      .map((a) => ({
        title: String(a.title || ""),
        content: String(a.content || ""),
        createdAt: normalizeTs(num(a.created_at)),
      }))
      .filter((a) => a.title),
  };
}

export async function getMarkets(): Promise<Market[]> {
  const overview = await getOverview();
  return overview.markets;
}

export async function getMarket(symbol: string): Promise<Market | null> {
  const markets = await getMarkets();
  const key = decodeURIComponent(symbol).toUpperCase();
  return (
    markets.find((m) => m.symbol.toUpperCase() === key) ||
    markets.find((m) => m.symbol.split("/")[0].toUpperCase() === key) ||
    null
  );
}

export function mapTrade(
  raw: Record<string, unknown>,
  symbol?: string,
): Trade {
  const isMakerAsk = Boolean(raw.is_maker_ask);
  return {
    tradeId: String(raw.trade_id_str ?? raw.trade_id ?? ""),
    txHash: String(raw.tx_hash || ""),
    type: String(raw.type || "trade"),
    marketId: num(raw.market_id),
    symbol,
    size: num(raw.size),
    price: num(raw.price),
    usdAmount: num(raw.usd_amount),
    askAccountId: num(raw.ask_account_id),
    bidAccountId: num(raw.bid_account_id),
    isMakerAsk,
    timestamp: normalizeTs(num(raw.timestamp ?? raw.transaction_time)),
    takerIsAsk: !isMakerAsk,
  };
}

export async function getRecentTrades(
  marketId: number,
  limit = 40,
  options?: { type?: string; symbol?: string },
): Promise<Trade[]> {
  const type = options?.type ? `&type=${encodeURIComponent(options.type)}` : "";
  const data = await rhGet<Record<string, unknown>>(
    `/api/v1/recentTrades?market_id=${marketId}&limit=${Math.min(limit, 100)}${type}`,
    4_000,
  );
  return ((data.trades as Record<string, unknown>[]) || []).map((row) =>
    mapTrade(row, options?.symbol),
  );
}

export async function getCandles(
  marketId: number,
  resolution = "1h",
  countBack = 72,
): Promise<Candle[]> {
  const end = Date.now();
  const span: Record<string, number> = {
    "1m": 60_000,
    "5m": 5 * 60_000,
    "15m": 15 * 60_000,
    "30m": 30 * 60_000,
    "1h": 60 * 60_000,
    "4h": 4 * 60 * 60_000,
    "12h": 12 * 60 * 60_000,
    "1d": 24 * 60 * 60_000,
  };
  const start = end - (span[resolution] || span["1h"]) * countBack;
  const data = await rhGet<Record<string, unknown>>(
    `/api/v1/candles?market_id=${marketId}&resolution=${resolution}&start_timestamp=${start}&end_timestamp=${end}&count_back=${countBack}`,
    15_000,
  );
  return ((data.c as Record<string, unknown>[]) || []).map((c) => ({
    t: num(c.t),
    o: num(c.o),
    h: num(c.h),
    l: num(c.l),
    c: num(c.c),
    v: num(c.v),
    V: num(c.V),
  }));
}

export async function getOrderBook(
  marketId: number,
  limit = 20,
): Promise<OrderBook> {
  const data = await rhGet<Record<string, unknown>>(
    `/api/v1/orderBookOrders?market_id=${marketId}&limit=${limit}`,
    3_000,
  );
  const book =
    (data.order_book as Record<string, unknown>) ||
    (data as Record<string, unknown>);
  const mapLevels = (rows: unknown): { price: number; size: number }[] =>
    ((rows as Record<string, unknown>[]) || []).map((r) => ({
      price: num(r.price),
      size: num(r.size ?? r.remaining_base_amount ?? r.initial_base_amount),
    }));
  return {
    marketId,
    asks: mapLevels(book.asks),
    bids: mapLevels(book.bids),
  };
}

function mapPosition(raw: Record<string, unknown>): AccountPosition {
  return {
    marketId: num(raw.market_id),
    symbol: String(raw.symbol || ""),
    sign: num(raw.sign, 1),
    position: num(raw.position),
    avgEntryPrice: num(raw.avg_entry_price),
    positionValue: num(raw.position_value),
    unrealizedPnl: num(raw.unrealized_pnl),
    realizedPnl: num(raw.realized_pnl),
    liquidationPrice: num(raw.liquidation_price),
    allocatedMargin: num(raw.allocated_margin),
    initialMarginFraction: num(raw.initial_margin_fraction),
    marginMode: num(raw.margin_mode),
    openOrderCount: num(raw.open_order_count),
  };
}

function mapAsset(raw: Record<string, unknown>): AccountAsset {
  return {
    symbol: String(raw.symbol || ""),
    assetId: num(raw.asset_id),
    balance: num(raw.balance),
    lockedBalance: num(raw.locked_balance),
  };
}

function mapAccount(raw: Record<string, unknown>): AccountSummary {
  return {
    index: num(raw.index ?? raw.account_index),
    l1Address: String(raw.l1_address || ""),
    status: num(raw.status),
    name: String(raw.name || ""),
    collateral: num(raw.collateral),
    availableBalance: num(raw.available_balance),
    totalAssetValue: num(raw.total_asset_value),
    crossAssetValue: num(raw.cross_asset_value),
    totalOrderCount: num(raw.total_order_count),
    pendingOrderCount: num(raw.pending_order_count),
    accountType: num(raw.account_type),
    createdAt: normalizeTs(num(raw.created_at)),
    positions: ((raw.positions as Record<string, unknown>[]) || []).map(
      mapPosition,
    ),
    assets: ((raw.assets as Record<string, unknown>[]) || []).map(mapAsset),
  };
}

async function fetchAccounts(
  by: "index" | "l1_address",
  value: string,
): Promise<AccountSummary[]> {
  const data = await rhGet<Record<string, unknown>>(
    `/api/v1/account?by=${by}&value=${encodeURIComponent(value)}`,
    30_000,
  );
  return ((data.accounts as Record<string, unknown>[]) || []).map(mapAccount);
}

export async function getAccountByIndex(
  index: string | number,
): Promise<AccountBundle> {
  const accounts = await fetchAccounts("index", String(index));
  if (!accounts.length) {
    throw new RhError("Account not found", 404, 21100);
  }
  return { primary: accounts[0], accounts };
}

export async function getAccountsByAddress(
  address: string,
): Promise<AccountBundle> {
  const accounts = await fetchAccounts("l1_address", address);
  if (!accounts.length) {
    throw new RhError("Address not found on Robinhood Lighter", 404, 21100);
  }
  const sorted = [...accounts].sort(
    (a, b) =>
      Math.abs(b.collateral) +
      Math.abs(b.totalAssetValue) -
      (Math.abs(a.collateral) + Math.abs(a.totalAssetValue)),
  );
  return { primary: sorted[0], accounts: sorted };
}

export async function getLeaderboard(
  type: "all" | "weekly" | "competition" = "all",
): Promise<LeaderboardEntry[]> {
  const data = await rhGet<Record<string, unknown>>(
    `/api/v1/leaderboard?type=${type}`,
    30_000,
  );
  return ((data.entries as Record<string, unknown>[]) || []).map((row, i) => ({
    rank: num(row.entry, i + 1) || i + 1,
    l1Address: String(row.l1_address || ""),
    points: num(row.points),
    metadata: String(row.metadata || ""),
  }));
}

export async function getFundingRates(): Promise<MarketFunding[]> {
  const data = await rhGet<Record<string, unknown>>(
    "/api/v1/funding-rates",
    30_000,
  );
  return mapFundingRates(data.funding_rates);
}

export async function searchQuery(q: string): Promise<{
  kind: "address" | "account" | "market" | "log" | "unknown";
  href?: string;
  label: string;
  detail?: string;
}[]> {
  const query = q.trim();
  if (!query) return [];
  if (/^[0-9a-fA-F]{32,96}$/.test(query)) {
    return [
      {
        kind: "log",
        href: `/logs/${query}`,
        label: query,
        detail: "explorer log",
      },
    ];
  }
  const markets = await getMarkets();
  const upper = query.toUpperCase();
  const hits = markets
    .filter(
      (m) =>
        m.symbol.toUpperCase().includes(upper) ||
        String(m.marketId) === query,
    )
    .slice(0, 6)
    .map((m) => ({
      kind: "market" as const,
      href: `/markets/${encodeURIComponent(m.symbol)}`,
      label: m.symbol,
      detail: `${m.marketType} · ${m.assetClass}`,
    }));

  if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
    return [
      {
        kind: "address",
        href: `/address/${query}`,
        label: query,
        detail: "L1 wallet",
      },
      ...hits,
    ];
  }
  if (/^\d{1,18}$/.test(query)) {
    return [
      {
        kind: "account",
        href: `/account/${query}`,
        label: `Account ${query}`,
        detail: "Account index",
      },
      ...hits,
    ];
  }
  return hits;
}

export { RhError };
