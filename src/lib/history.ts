import { cached } from "@/lib/cache";
import { RH_EXPLORER } from "@/lib/config";
import {
  describeExplorerLog,
  mapExplorerLog,
  type ExplorerTrade,
  type HistoryFill,
} from "@/lib/history-map";

export type { ExplorerTrade, HistoryFill } from "@/lib/history-map";

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
