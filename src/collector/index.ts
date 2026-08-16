import WebSocket from "ws";
import { RH_WS } from "../lib/config.ts";
import {
  buildPublicRealtimeSnapshot,
  parseLighterTradeMessage,
  type RealtimeMarket,
} from "../lib/realtime.ts";
import { getAccountByIndex, getMarkets } from "../lib/rh.ts";
import {
  getSharedRedis,
  writePublicRealtimeSnapshot,
} from "../lib/shared-cache.ts";
import type { Trade } from "../lib/types.ts";

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
  dirty = true;
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
  await writePublicRealtimeSnapshot(
    buildPublicRealtimeSnapshot(
      trades,
      markets,
      now,
      Object.fromEntries(accountEquities),
    ),
  );
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
  const ranking = buildPublicRealtimeSnapshot(
    trades,
    markets,
    Date.now(),
    Object.fromEntries(accountEquities),
  ).trackers.whales;
  const candidates = ranking
    .slice(0, EQUITY_CANDIDATE_LIMIT)
    .map((account) => account.accountId);
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
  if (changed) dirty = true;
}

async function main(): Promise<void> {
  if (!getSharedRedis()) {
    throw new Error("Upstash Redis REST credentials are required");
  }
  markets = await loadMarkets();
  if (markets.length === 0) throw new Error("No active perp markets returned");
  marketSymbols = new Map(
    markets.map((market) => [market.marketId, market.symbol]),
  );
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

  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    clearInterval(publishTimer);
    clearInterval(refreshTimer);
    clearInterval(equityTimer);
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
