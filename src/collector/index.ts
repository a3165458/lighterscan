import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import WebSocket from "ws";
import { RH_WS } from "../lib/config.ts";

function loadLocalEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const text = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of text.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
        const eq = trimmed.indexOf("=");
        const key = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
        if (key && process.env[key] === undefined) process.env[key] = value;
      }
    } catch {
      /* optional local file */
    }
  }
}
import {
  buildPublicRealtimeSnapshot,
  parseLighterTradeMessage,
  type RealtimeMarket,
} from "../lib/realtime.ts";
import { getAccountByIndex, getMarkets, getOverview } from "../lib/rh.ts";
import { isLiquidationTrade } from "../lib/liquidations.ts";
import {
  accountEquity,
  collectActiveAccountIds,
} from "../lib/tracker-metrics.ts";
import {
  ALL_TRACKER_BUCKET,
  applyEquitiesToLedger,
  applyTradesToLedger,
  emptyTrackerLedger,
  ledgerBucketToSample,
  type TrackerLedger,
} from "../lib/tracker-ledger.ts";
import {
  getSharedRedis,
  loadOrCreateTrackerLedger,
  readPublicRealtimeSnapshot,
  writeHourlyStat,
  writePublicRealtimeSnapshot,
  writeTrackerLedger,
} from "../lib/shared-cache.ts";
import type { AccountPosition, Trade } from "../lib/types.ts";

const MARKET_LIMIT = Math.min(
  100,
  Math.max(1, Number(process.env.COLLECTOR_MARKET_LIMIT ?? 40)),
);
const TRADE_BUFFER_LIMIT = 1_200;
const PUBLISH_INTERVAL_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 5_000;
const MARKET_REFRESH_INTERVAL_MS = 5 * 60_000;
const PING_INTERVAL_MS = 30_000;
const EQUITY_REFRESH_INTERVAL_MS = 45_000;
const EQUITY_CANDIDATE_LIMIT = 40;
const STATS_FLUSH_INTERVAL_MS = 15 * 60_000;

let markets: RealtimeMarket[] = [];
let marketSymbols = new Map<number, string>();
let trades: Trade[] = [];
let seenTradeIds = new Set<string>();
let socket: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | undefined;
let pingTimer: NodeJS.Timeout | undefined;
let reconnectAttempt = 0;
let dirty = true;
let lastPublishedAt = 0;
let stopping = false;
const accountEquities = new Map<
  number,
  { collateral: number; totalAssetValue: number }
>();
const accountPositions = new Map<number, AccountPosition[]>();
let ledger: TrackerLedger = emptyTrackerLedger();
let ledgerDirty = false;

async function loadMarkets(): Promise<RealtimeMarket[]> {
  const rows = await getMarkets();
  return rows
    .filter(
      (market) => market.marketType === "perp" && market.status === "active",
    )
    .slice(0, MARKET_LIMIT)
    .map((market) => ({
      marketId: market.marketId,
      symbol: market.symbol,
    }));
}

function tradeKey(trade: Trade): string {
  return `${trade.marketId}:${trade.tradeId}:${trade.txHash}`;
}

function appendTrades(incoming: Trade[]): void {
  if (incoming.length === 0) return;
  const additions: Trade[] = [];
  for (const trade of incoming) {
    const key = tradeKey(trade);
    if (seenTradeIds.has(key)) continue;
    seenTradeIds.add(key);
    additions.push(trade);
  }
  if (additions.length === 0) return;
  trades = [...additions.reverse(), ...trades].slice(0, TRADE_BUFFER_LIMIT);
  seenTradeIds = new Set(trades.map(tradeKey));
  const applied = applyTradesToLedger(ledger, additions).applied;
  if (applied) ledgerDirty = true;
  dirty = true;
}

function equityRecord(): Record<
  number,
  { collateral: number; totalAssetValue: number }
> {
  return Object.fromEntries(accountEquities);
}

async function persistLedger(): Promise<void> {
  if (!ledgerDirty) return;
  applyEquitiesToLedger(ledger, equityRecord());
  await writeTrackerLedger(ledger);
  ledgerDirty = false;
}

function clearConnectionTimers(): void {
  clearInterval(pingTimer);
  pingTimer = undefined;
}

function scheduleReconnect(): void {
  if (stopping || reconnectTimer) return;
  reconnectAttempt += 1;
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(reconnectAttempt - 1, 5));
  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connect();
  }, delay);
}

function connect(): void {
  if (stopping || markets.length === 0) return;
  clearConnectionTimers();
  socket = new WebSocket(RH_WS);
  socket.on("open", () => {
    reconnectAttempt = 0;
    dirty = true;
    for (const market of markets) {
      socket?.send(
        JSON.stringify({
          type: "subscribe",
          channel: `trade/${market.marketId}`,
        }),
      );
    }
    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
    console.info(`collector connected (${markets.length} markets)`);
  });
  socket.on("message", (data) => {
    try {
      appendTrades(
        parseLighterTradeMessage(
          JSON.parse(data.toString()) as unknown,
          marketSymbols,
        ),
      );
    } catch {
      // Upstream occasionally emits non-JSON control frames.
    }
  });
  socket.on("error", (error) => {
    console.error(`collector websocket error: ${error.message}`);
  });
  socket.on("close", () => {
    clearConnectionTimers();
    socket = null;
    scheduleReconnect();
  });
}

async function publish(): Promise<void> {
  if (socket?.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  if (!dirty && now - lastPublishedAt < HEARTBEAT_INTERVAL_MS) return;
  applyEquitiesToLedger(ledger, equityRecord());
  const snapshot = buildPublicRealtimeSnapshot(
    trades,
    markets,
    now,
    equityRecord(),
    Object.fromEntries(accountPositions),
  );
  const cumulative = ledgerBucketToSample(ledger, ALL_TRACKER_BUCKET, 40);
  if (cumulative.sampledTrades > 0) {
    snapshot.trackers = {
      whales: cumulative.whales,
      highFrequency: [],
      sampledTrades: cumulative.sampledTrades,
      windowStart: cumulative.windowStart,
      windowEnd: cumulative.windowEnd,
      markets: cumulative.markets,
    };
  }
  await writePublicRealtimeSnapshot(snapshot);
  await persistLedger();
  dirty = false;
  lastPublishedAt = now;
}

async function refreshMarkets(): Promise<void> {
  const next = await loadMarkets();
  const changed =
    next.length !== markets.length ||
    next.some((market, index) => market.marketId !== markets[index]?.marketId);
  if (!changed) return;
  markets = next;
  marketSymbols = new Map(
    markets.map((market) => [market.marketId, market.symbol]),
  );
  dirty = true;
  socket?.close(1000, "market subscriptions changed");
  if (!socket) connect();
}

async function refreshAccountEquities(): Promise<void> {
  const ranking = ledgerBucketToSample(ledger, ALL_TRACKER_BUCKET, 40).whales;
  const rankedIds = ranking.slice(0, 20).map((account) => account.accountId);
  const others = collectActiveAccountIds(trades, 200).filter(
    (accountId) => !rankedIds.includes(accountId),
  );
  const rotateTake = 16;
  const offset =
    others.length === 0
      ? 0
      : Math.floor(Date.now() / EQUITY_REFRESH_INTERVAL_MS) % others.length;
  const rotated =
    others.length === 0
      ? []
      : [...others.slice(offset), ...others.slice(0, offset)].slice(
          0,
          rotateTake,
        );
  const knownRich = [...accountEquities.entries()]
    .sort((left, right) => accountEquity(right[1]) - accountEquity(left[1]))
    .slice(0, 8)
    .map(([accountId]) => accountId);
  const candidates = [
    ...new Set([...rankedIds, ...rotated, ...knownRich]),
  ].slice(0, EQUITY_CANDIDATE_LIMIT);
  if (candidates.length === 0) return;

  let changed = false;
  for (const accountId of candidates) {
    if (stopping) return;
    try {
      const bundle = await getAccountByIndex(accountId);
      const next = {
        collateral: bundle.primary.collateral,
        totalAssetValue: bundle.primary.totalAssetValue,
      };
      accountPositions.set(
        accountId,
        bundle.primary.positions.filter((position) => position.position !== 0),
      );
      const previous = accountEquities.get(accountId);
      if (
        !previous ||
        previous.collateral !== next.collateral ||
        previous.totalAssetValue !== next.totalAssetValue
      ) {
        accountEquities.set(accountId, next);
        changed = true;
      }
    } catch (error) {
      console.error(
        `collector account ${accountId} refresh error: ${
          error instanceof Error ? error.message : "unknown"
        }`,
      );
    }
  }
  if (changed) {
    applyEquitiesToLedger(ledger, equityRecord());
    ledgerDirty = true;
    dirty = true;
  }
}

async function flushHourlyStats(): Promise<void> {
  const overview = await getOverview();
  const hourAgo = Date.now() - 3_600_000;
  const liquidations = trades
    .filter((trade) => isLiquidationTrade(trade) && trade.timestamp >= hourAgo)
    .reduce((sum, trade) => sum + trade.usdAmount, 0);
  await writeHourlyStat({
    t: Date.now(),
    volume: overview.totals.dailyVolume,
    trades: overview.totals.dailyTrades,
    openInterest: overview.totals.openInterest,
    liquidations,
  });
}

async function main(): Promise<void> {
  loadLocalEnv();
  if (!getSharedRedis()) {
    throw new Error("Upstash Redis REST credentials are required");
  }
  // Prime shared REST cache so Vercel instances do not all stampede RH.
  markets = await loadMarkets();
  if (markets.length === 0) throw new Error("No active perp markets returned");
  marketSymbols = new Map(
    markets.map((market) => [market.marketId, market.symbol]),
  );
  ledger = await loadOrCreateTrackerLedger();
  const previous = await readPublicRealtimeSnapshot();
  if (previous?.trades.length) {
    const seeded = applyTradesToLedger(ledger, previous.trades).applied;
    if (seeded) ledgerDirty = true;
  }
  connect();

  const publishTimer = setInterval(() => {
    publish().catch((error: unknown) => {
      console.error(
        `collector publish error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    });
  }, PUBLISH_INTERVAL_MS);
  const refreshTimer = setInterval(() => {
    refreshMarkets().catch((error: unknown) => {
      console.error(
        `collector market refresh error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    });
  }, MARKET_REFRESH_INTERVAL_MS);
  const equityTimer = setInterval(() => {
    refreshAccountEquities().catch((error: unknown) => {
      console.error(
        `collector equity refresh error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    });
  }, EQUITY_REFRESH_INTERVAL_MS);
  const statsTimer = setInterval(() => {
    flushHourlyStats().catch((error: unknown) => {
      console.error(
        `collector stats flush error: ${error instanceof Error ? error.message : "unknown"}`,
      );
    });
  }, STATS_FLUSH_INTERVAL_MS);
  void flushHourlyStats();

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(publishTimer);
    clearInterval(refreshTimer);
    clearInterval(equityTimer);
    clearInterval(statsTimer);
    clearConnectionTimers();
    clearTimeout(reconnectTimer);
    socket?.close(1000, "collector shutdown");
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error(
    `collector failed: ${error instanceof Error ? error.message : "unknown"}`,
  );
  process.exitCode = 1;
});
