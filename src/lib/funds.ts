import { cached, ISR_PAGE_CACHE } from "@/lib/cache";
import { RH_EXPLORER } from "@/lib/config";
import { explorerIsrFetchInit, explorerLiveFetchInit } from "@/lib/history-log";
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

const FUND_TTL_MS = 8_000;

export async function getAccountFundHistory(
  accountOrAddress: string,
  offset = 0,
  limit = 40,
  selfIndexes: Array<string | number> = [accountOrAddress],
  options?: { isr?: boolean },
): Promise<FundPage> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const path = `/accounts/${encodeURIComponent(accountOrAddress)}/logs?limit=${safeLimit}&offset=${offset}&pub_data_type=${encodeURIComponent(FUND_TYPE_QUERY)}`;
  const isr = options?.isr === true;
  const rows = await cached(
    `ex:${path}`,
    FUND_TTL_MS,
    async () => {
      const res = await fetch(
        `${RH_EXPLORER}${path}`,
        isr ? explorerIsrFetchInit(FUND_TTL_MS) : explorerLiveFetchInit(),
      );
      const text = await res.text();
      if (!res.ok) {
        throw new Error(text.slice(0, 180) || `explorer ${res.status}`);
      }
      const body = text ? JSON.parse(text) : [];
      if (!Array.isArray(body)) {
        throw new Error("unexpected explorer payload");
      }
      return body as Record<string, unknown>[];
    },
    isr ? ISR_PAGE_CACHE : undefined,
  );

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
