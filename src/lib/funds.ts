import { cached } from "@/lib/cache";
import { RH_EXPLORER } from "@/lib/config";
import {
  FUND_PUB_DATA_TYPES,
  mapExplorerFundLog,
  type FundMovement,
} from "@/lib/funds-map";

export type { FundDirection, FundMovement } from "@/lib/funds-map";

export type FundPage = {
  rows: FundMovement[];
  nextOffset: number;
  hasMore: boolean;
};

const FUND_TYPE_QUERY = FUND_PUB_DATA_TYPES.join(",");

export async function getAccountFundHistory(
  accountOrAddress: string,
  offset = 0,
  limit = 40,
  selfIndexes: Array<string | number> = [accountOrAddress],
): Promise<FundPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const path = `/accounts/${encodeURIComponent(accountOrAddress)}/logs?limit=${safeLimit}&offset=${offset}&pub_data_type=${encodeURIComponent(FUND_TYPE_QUERY)}`;
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

  return {
    rows: rows
      .map((row) => mapExplorerFundLog(row, selfIndexes))
      .filter((row): row is FundMovement => Boolean(row)),
    nextOffset: offset + rows.length,
    hasMore: rows.length >= safeLimit,
  };
}

export function emptyFundPage(offset = 0): FundPage {
  return { rows: [], nextOffset: offset, hasMore: false };
}
