/** RH explorer accepts account index or EIP-55 checksum address, not lowercase 0x. */
export function explorerLookupId(
  urlParam: string,
  accountIndexes: Array<string | number> = [],
  checksumAddress?: string,
): string {
  if (accountIndexes.length > 0) return String(accountIndexes[0]);
  if (checksumAddress && /^0x[a-fA-F0-9]{40}$/.test(checksumAddress)) {
    return checksumAddress;
  }
  return urlParam;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export type HistoryFill = {
  hash: string;
  time: string;
  timestamp: number;
  kind: string;
  marketId: number;
  symbol?: string;
  price: number;
  size: number;
  usdAmount: number;
  side: "buy" | "sell";
  role: "taker" | "maker";
  counterparty: string;
  selfIndex: string;
};

const TRADE_TYPES = new Set([
  "Trade",
  "TradeWithFunding",
  "LiquidationTrade",
  "LiquidationTradeWithFunding",
  "Deleverage",
  "DeleverageWithFunding",
]);

export type ExplorerTrade = {
  hash: string;
  time: string;
  timestamp: number;
  kind: string;
  txType: string;
  blockNumber: number;
  batchNumber: number;
  status: string;
  marketId: number;
  symbol?: string;
  price: number;
  size: number;
  usdAmount: number;
  isTakerAsk: boolean;
  taker: string;
  maker: string;
  takerFee: number;
  makerFee: number;
};

export function extractTradePub(raw: Record<string, unknown>): Record<string, unknown> | null {
  const kind = String(raw.pubdata_type || "");
  if (!TRADE_TYPES.has(kind)) return null;
  const pub = (raw.pubdata || {}) as Record<string, unknown>;
  const trade = (pub.trade_pubdata ||
    pub.trade_pubdata_with_funding ||
    pub.deleverage_pubdata ||
    pub.deleverage_pubdata_with_funding ||
    {}) as Record<string, unknown>;
  return Object.keys(trade).length ? trade : null;
}

export function describeExplorerLog(
  raw: Record<string, unknown>,
  marketNames: Record<number, string> = {},
): ExplorerTrade | null {
  const trade = extractTradePub(raw);
  if (!trade) return null;
  const price = num(trade.price ?? trade.quote);
  const size = num(trade.size);
  const time = String(raw.time || "");
  const ts = Date.parse(time);
  const marketId = num(trade.market_index);
  return {
    hash: String(raw.hash || ""),
    time,
    timestamp: Number.isFinite(ts) ? ts : 0,
    kind: String(raw.pubdata_type || ""),
    txType: String(raw.tx_type || ""),
    blockNumber: num(raw.block_number),
    batchNumber: num(raw.batch_number),
    status: String(raw.status || ""),
    marketId,
    symbol: marketNames[marketId],
    price,
    size,
    usdAmount: price && size ? price * size : num(trade.quote),
    isTakerAsk: num(trade.is_taker_ask) === 1,
    taker: String(trade.taker_account_index ?? trade.bankrupt_account_index ?? ""),
    maker: String(trade.maker_account_index ?? trade.deleverager_account_index ?? ""),
    takerFee: num(trade.taker_fee),
    makerFee: num(trade.maker_fee),
  };
}

export function mapExplorerLog(
  raw: Record<string, unknown>,
  selfIndexes: Iterable<string | number>,
  marketNames: Record<number, string> = {},
): HistoryFill | null {
  const kind = String(raw.pubdata_type || "");
  const trade = extractTradePub(raw);
  if (!trade) return null;

  const taker = String(trade.taker_account_index ?? trade.bankrupt_account_index ?? "");
  const maker = String(trade.maker_account_index ?? trade.deleverager_account_index ?? "");
  const self = new Set([...selfIndexes].map((v) => String(v)));
  const selfIndex = self.has(taker) ? taker : self.has(maker) ? maker : "";
  if (!selfIndex) return null;

  const isTakerAsk = num(trade.is_taker_ask) === 1;
  const isTaker = selfIndex === taker;
  const side: "buy" | "sell" = isTaker
    ? isTakerAsk
      ? "sell"
      : "buy"
    : isTakerAsk
      ? "buy"
      : "sell";
  const price = num(trade.price ?? trade.quote);
  const size = num(trade.size);
  const time = String(raw.time || "");
  const ts = Date.parse(time);
  const marketId = num(trade.market_index);

  return {
    hash: String(raw.hash || `${time}-${marketId}-${size}`),
    time,
    timestamp: Number.isFinite(ts) ? ts : 0,
    kind,
    marketId,
    symbol: marketNames[marketId],
    price,
    size,
    usdAmount: price && size ? price * size : num(trade.quote),
    side,
    role: isTaker ? "taker" : "maker",
    counterparty: isTaker ? maker : taker,
    selfIndex,
  };
}
