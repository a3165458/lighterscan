import { aggregateVolumeFromFills } from "@/lib/account-stats";
import { cached, ISR_PAGE_CACHE } from "@/lib/cache";
import { RH_EXPLORER } from "@/lib/config";
import {
  explorerIsrFetchInit,
  explorerLiveFetchInit,
  explorerLogFetchInit,
  LOG_BY_HASH_CACHE,
  LOG_BY_HASH_TTL_MS,
  readExplorerLogResponse,
} from "@/lib/history-log";
import {
  describeExplorerLog,
  mapExplorerLog,
  type ExplorerTrade,
  type HistoryFill,
} from "@/lib/history-map";
import {
  liquidationFromExplorerTrade,
  type LiquidationRow,
} from "@/lib/liquidations";
import { PUBLIC_POOL_ACCOUNT_INDEX } from "@/lib/tracker-metrics";
import type { AccountLiveStats } from "@/lib/types";

export {
  classifyLogLookupError,
  explorerStatusFromError,
  LOG_BY_HASH_CACHE,
  LOG_BY_HASH_REVALIDATE_SECONDS,
  LOG_BY_HASH_STALE_MS,
  LOG_BY_HASH_TTL_MS,
} from "@/lib/history-log";

export type { ExplorerTrade, HistoryFill } from "@/lib/history-map";

export const ACCOUNT_VOLUME_PAGE_SIZE = 100;
export const ACCOUNT_VOLUME_MAX_PAGES = 15;

export type HistoryPage = {
  fills: HistoryFill[];
  nextOffset: number;
  hasMore: boolean;
};

export { explorerLookupId } from "@/lib/history-map";

const EXPLORER_TTL_MS = 8_000;

export type ExplorerReadOptions = {
  /** ISR/static RSC: Next Data Cache, no Upstash/KV write-through. */
  isr?: boolean;
};

async function fetchExplorer(
  path: string,
  ttlMs: number,
  isr: boolean,
): Promise<unknown> {
  const res = await fetch(
    `${RH_EXPLORER}${path}`,
    isr ? explorerIsrFetchInit(ttlMs) : explorerLiveFetchInit(),
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text.slice(0, 180) || `explorer ${res.status}`);
  }
  if (!text) return [];
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("invalid explorer payload");
  }
}

async function cachedExplorerArray(
  path: string,
  ttlMs: number,
  isr: boolean,
): Promise<Record<string, unknown>[]> {
  return cached(
    `ex:${path}`,
    ttlMs,
    async () => {
      const body = await fetchExplorer(path, ttlMs, isr);
      if (!Array.isArray(body)) {
        throw new Error("unexpected explorer payload");
      }
      return body as Record<string, unknown>[];
    },
    isr ? ISR_PAGE_CACHE : undefined,
  );
}

export async function getAccountTradeHistory(
  accountOrAddress: string,
  offset = 0,
  limit = 40,
  selfIndexes: Array<string | number> = [accountOrAddress],
  marketNames: Record<number, string> = {},
  options?: ExplorerReadOptions,
): Promise<HistoryPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const path = `/accounts/${encodeURIComponent(accountOrAddress)}/logs?limit=${safeLimit}&offset=${offset}&pub_data_type=Trade&pub_data_type=TradeWithFunding&pub_data_type=LiquidationTrade&pub_data_type=LiquidationTradeWithFunding`;
  const rows = await cachedExplorerArray(
    path,
    EXPLORER_TTL_MS,
    options?.isr === true,
  );

  const fills = rows
    .map((row) => mapExplorerLog(row, selfIndexes, marketNames))
    .filter((row): row is HistoryFill => Boolean(row));

  return {
    fills,
    nextOffset: offset + rows.length,
    hasMore: rows.length >= safeLimit,
  };
}

export async function getAccountVolumeStats(
  accountOrAddress: string,
  selfIndexes: Array<string | number> = [accountOrAddress],
  nowOrOptions: number | ExplorerReadOptions = Date.now(),
  maybeOptions?: ExplorerReadOptions,
): Promise<{ stats: AccountLiveStats; complete: boolean; sampled: number }> {
  const now = typeof nowOrOptions === "number" ? nowOrOptions : Date.now();
  const options =
    typeof nowOrOptions === "number" ? maybeOptions : nowOrOptions;
  const selves = selfIndexes.map(String).join(",");
  const isr = options?.isr === true;
  return cached(`ex-vol:${accountOrAddress}:${selves}`, EXPLORER_TTL_MS, async () => {
    const fills: HistoryFill[] = [];
    let offset = 0;
    let complete = true;
    for (let page = 0; page < ACCOUNT_VOLUME_MAX_PAGES; page += 1) {
      const result = await getAccountTradeHistory(
        accountOrAddress,
        offset,
        ACCOUNT_VOLUME_PAGE_SIZE,
        selfIndexes,
        {},
        options,
      );
      fills.push(...result.fills);
      if (!result.hasMore) {
        complete = true;
        break;
      }
      offset = result.nextOffset;
      complete = false;
    }
    return {
      stats: aggregateVolumeFromFills(fills, now),
      complete,
      sampled: fills.length,
    };
  }, isr ? ISR_PAGE_CACHE : undefined);
}

export async function getLogByHash(
  hash: string,
  marketNames: Record<number, string> = {},
): Promise<{ raw: Record<string, unknown>; trade: ExplorerTrade | null }> {
  const clean = hash.trim();
  const path = `/logs/${encodeURIComponent(clean)}`;
  const raw = await cached(
    `ex:${path}`,
    LOG_BY_HASH_TTL_MS,
    async () => {
      const res = await fetch(`${RH_EXPLORER}${path}`, explorerLogFetchInit());
      return readExplorerLogResponse(res);
    },
    LOG_BY_HASH_CACHE,
  );
  return { raw, trade: describeExplorerLog(raw, marketNames) };
}

export function officialLogUrl(hash: string, locale: "zh" | "en" = "zh"): string {
  return `https://robinhoodchain.lighter.xyz/explorer/logs/${hash}?locale=${locale}`;
}

/** Board ISR only. Public `/api/history` stays on `explorerLiveFetchInit`. */
async function explorerGet<T>(path: string, ttlMs: number): Promise<T> {
  return cached(
    `ex:${path}`,
    ttlMs,
    async () => (await fetchExplorer(path, ttlMs, true)) as T,
    ISR_PAGE_CACHE,
  );
}

const LIQUIDATION_LOG_TYPES = [
  "LiquidationTrade",
  "LiquidationTradeWithFunding",
];

export async function getAccountExplorerLogs(
  account: string | number,
  types: string[],
  limit = 40,
): Promise<Record<string, unknown>[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const typeQuery = types
    .map((type) => `pub_data_type=${encodeURIComponent(type)}`)
    .join("&");
  const path = `/accounts/${encodeURIComponent(String(account))}/logs?limit=${safeLimit}&offset=0${typeQuery ? `&${typeQuery}` : ""}`;
  const rows = await explorerGet<unknown>(path, 8_000);
  return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
}

export async function getRecentExplorerLiquidations(
  marketNames: Record<number, string> = {},
  extraAccounts: Array<string | number> = [],
): Promise<LiquidationRow[]> {
  const accounts = [
    PUBLIC_POOL_ACCOUNT_INDEX,
    ...extraAccounts.filter(
      (id) => String(id) !== String(PUBLIC_POOL_ACCOUNT_INDEX),
    ),
  ].slice(0, 6);
  const pages = await Promise.all(
    accounts.map((account) =>
      getAccountExplorerLogs(account, LIQUIDATION_LOG_TYPES, 50).catch(() => []),
    ),
  );
  const rows: LiquidationRow[] = [];
  const seen = new Set<string>();
  for (const logs of pages) {
    for (const raw of logs) {
      const trade = describeExplorerLog(raw, marketNames);
      if (!trade) continue;
      const row = liquidationFromExplorerTrade(trade);
      if (!row || seen.has(row.tradeId)) continue;
      seen.add(row.tradeId);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => b.timestamp - a.timestamp);
}
