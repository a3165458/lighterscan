import { aggregateVolumeFromFills } from "@/lib/account-stats";
import { cached } from "@/lib/cache";
import { RH_EXPLORER } from "@/lib/config";
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

export type { ExplorerTrade, HistoryFill } from "@/lib/history-map";

export const ACCOUNT_VOLUME_PAGE_SIZE = 100;
export const ACCOUNT_VOLUME_MAX_PAGES = 15;

export type HistoryPage = {
  fills: HistoryFill[];
  nextOffset: number;
  hasMore: boolean;
};

export { explorerLookupId } from "@/lib/history-map";

export async function getAccountTradeHistory(
  accountOrAddress: string,
  offset = 0,
  limit = 40,
  selfIndexes: Array<string | number> = [accountOrAddress],
  marketNames: Record<number, string> = {},
): Promise<HistoryPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const path = `/accounts/${encodeURIComponent(accountOrAddress)}/logs?limit=${safeLimit}&offset=${offset}&pub_data_type=Trade&pub_data_type=TradeWithFunding&pub_data_type=LiquidationTrade&pub_data_type=LiquidationTradeWithFunding`;
  const rows = await cached(`ex:${path}`, 8_000, async () => {
    const res = await fetch(`${RH_EXPLORER}${path}`, {
      headers: {
        accept: "application/json",
        "user-agent": "LighterScan/0.1 (+robinhood-lighter explorer)",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text.slice(0, 180) || `explorer ${res.status}`);
    }
    const body = text ? JSON.parse(text) : [];
    if (!Array.isArray(body)) {
      throw new Error("unexpected explorer payload");
    }
    return body as Record<string, unknown>[];
  });

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
  now = Date.now(),
): Promise<{ stats: AccountLiveStats; complete: boolean; sampled: number }> {
  const selves = selfIndexes.map(String).join(",");
  return cached(`ex-vol:${accountOrAddress}:${selves}`, 8_000, async () => {
    const fills: HistoryFill[] = [];
    let offset = 0;
    let complete = true;
    for (let page = 0; page < ACCOUNT_VOLUME_MAX_PAGES; page += 1) {
      const result = await getAccountTradeHistory(
        accountOrAddress,
        offset,
        ACCOUNT_VOLUME_PAGE_SIZE,
        selfIndexes,
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
  });
}

export async function getLogByHash(
  hash: string,
  marketNames: Record<number, string> = {},
): Promise<{ raw: Record<string, unknown>; trade: ExplorerTrade | null }> {
  const clean = hash.trim();
  const path = `/logs/${encodeURIComponent(clean)}`;
  const raw = await cached(`ex:${path}`, 15_000, async () => {
    const res = await fetch(`${RH_EXPLORER}${path}`, {
      headers: {
        accept: "application/json",
        "user-agent": "LighterScan/0.1 (+robinhood-lighter explorer)",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (res.status === 404) {
      throw Object.assign(new Error("log not found"), { status: 404 });
    }
    if (!res.ok) {
      throw new Error(text.slice(0, 180) || `explorer ${res.status}`);
    }
    return JSON.parse(text) as Record<string, unknown>;
  });
  return { raw, trade: describeExplorerLog(raw, marketNames) };
}

export function officialLogUrl(hash: string, locale: "zh" | "en" = "zh"): string {
  return `https://robinhoodchain.lighter.xyz/explorer/logs/${hash}?locale=${locale}`;
}

async function explorerGet<T>(path: string, ttlMs: number): Promise<T> {
  return cached(`ex:${path}`, ttlMs, async () => {
    const res = await fetch(`${RH_EXPLORER}${path}`, {
      headers: {
        accept: "application/json",
        "user-agent": "LighterScan/0.1 (+robinhood-lighter explorer)",
      },
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text.slice(0, 180) || `explorer ${res.status}`);
    }
    return (text ? JSON.parse(text) : null) as T;
  });
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
