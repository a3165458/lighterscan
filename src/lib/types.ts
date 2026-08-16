export type MarketType = "perp" | "spot";
export type AssetClass = "crypto" | "rwa" | "spot";

export type Market = {
  symbol: string;
  marketId: number;
  marketType: MarketType;
  assetClass: AssetClass;
  status: string;
  lastPrice: number;
  markPrice: number;
  indexPrice: number;
  change24h: number;
  volume24h: number;
  baseVolume24h: number;
  trades24h: number;
  openInterest: number;
  high24h: number;
  low24h: number;
  takerFee: number;
  makerFee: number;
  minBaseAmount: number;
  minQuoteAmount: number;
  prices: number[];
};

export type Overview = {
  generatedAt: number;
  totals: {
    dailyVolume: number;
    dailyTrades: number;
    markets: number;
    perpMarkets: number;
    spotMarkets: number;
    openInterest: number;
  };
  markets: Market[];
  announcements: Announcement[];
};

export type Announcement = {
  title: string;
  content: string;
  createdAt: number;
};

export type Trade = {
  tradeId: string;
  txHash: string;
  type: string;
  marketId: number;
  symbol?: string;
  size: number;
  price: number;
  usdAmount: number;
  askAccountId: number;
  bidAccountId: number;
  isMakerAsk: boolean;
  timestamp: number;
  takerIsAsk: boolean;
};

export type BookLevel = { price: number; size: number };

export type OrderBook = {
  marketId: number;
  asks: BookLevel[];
  bids: BookLevel[];
  offset?: number;
};

export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  V: number;
};

export type AccountPosition = {
  marketId: number;
  symbol: string;
  sign: number;
  position: number;
  avgEntryPrice: number;
  positionValue: number;
  unrealizedPnl: number;
  realizedPnl: number;
  liquidationPrice: number;
  allocatedMargin: number;
  initialMarginFraction: number;
  marginMode: number;
  openOrderCount: number;
};

export type AccountAsset = {
  symbol: string;
  assetId: number;
  balance: number;
  lockedBalance: number;
};

export type AccountSummary = {
  index: number;
  l1Address: string;
  status: number;
  name: string;
  collateral: number;
  availableBalance: number;
  totalAssetValue: number;
  crossAssetValue: number;
  totalOrderCount: number;
  pendingOrderCount: number;
  accountType: number;
  createdAt: number;
  positions: AccountPosition[];
  assets: AccountAsset[];
};

export type AccountBundle = {
  primary: AccountSummary;
  accounts: AccountSummary[];
};

export type LeaderboardEntry = {
  rank: number;
  l1Address: string;
  points: number;
  metadata: string;
};

export type AccountLiveStats = {
  dailyVolume: number;
  weeklyVolume: number;
  monthlyVolume: number;
  totalVolume: number;
  dailyTrades: number;
  weeklyTrades: number;
  monthlyTrades: number;
  totalTrades: number;
  collateral?: number;
  portfolioValue?: number;
  leverage?: number;
  availableBalance?: number;
  marginUsage?: number;
  buyingPower?: number;
};
