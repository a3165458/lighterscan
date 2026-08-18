const FUND_TYPES = new Set([
  "L1Deposit",
  "L1DepositV2",
  "Withdraw",
  "WithdrawV2",
  "L2Transfer",
  "L2TransferV2",
]);

export const FUND_PUB_DATA_TYPES = [
  "L1Deposit",
  "L1DepositV2",
  "Withdraw",
  "WithdrawV2",
  "L2Transfer",
  "L2TransferV2",
] as const;

export type FundDirection = "deposit" | "withdraw" | "transfer_in" | "transfer_out";

export type FundCounterpartyKind = "account" | "address" | "none";

export type FundMovement = {
  hash: string;
  time: string;
  timestamp: number;
  kind: string;
  txType: string;
  direction: FundDirection;
  amount: number;
  asset: string;
  status: string;
  route: string;
  counterparty: string;
  counterpartyKind: FundCounterpartyKind;
  selfIndex: string;
};

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function text(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function assetSymbol(value: unknown, fallback = "USDG"): string {
  const raw = text(value);
  if (!raw) return fallback;
  if (/^\d+$/.test(raw)) return fallback;
  return raw;
}

function isUsdAsset(asset: string): boolean {
  return /^USD[GC]?$/i.test(asset);
}

export function isStableFundAsset(asset: string): boolean {
  return isUsdAsset(asset);
}

function pickPub(
  pub: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> | null {
  for (const key of keys) {
    const inner = pub[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner)) {
      return inner as Record<string, unknown>;
    }
  }
  return Object.keys(pub).length ? pub : null;
}

export function extractFundPub(
  raw: Record<string, unknown>,
): { kind: string; pub: Record<string, unknown> } | null {
  const kind = text(raw.pubdata_type);
  if (!FUND_TYPES.has(kind)) return null;
  const pub = (raw.pubdata || {}) as Record<string, unknown>;
  const inner =
    kind.startsWith("L1Deposit")
      ? pickPub(pub, ["l1_deposit_pubdata_v2", "l1_deposit_pubdata"])
      : kind.startsWith("Withdraw")
        ? pickPub(pub, ["withdraw_pubdata_v2", "withdraw_pubdata"])
        : pickPub(pub, ["l2_transfer_pubdata_v2", "l2_transfer_pubdata"]);
  return inner ? { kind, pub: inner } : null;
}

function fundAmount(pub: Record<string, unknown>): number {
  return num(pub.accepted_amount ?? pub.amount ?? pub.usdc_amount);
}

export function mapExplorerFundLog(
  raw: Record<string, unknown>,
  selfIndexes: Iterable<string | number>,
): FundMovement | null {
  const extracted = extractFundPub(raw);
  if (!extracted) return null;
  const { kind, pub } = extracted;
  const self = new Set([...selfIndexes].map((value) => String(value)));
  const time = text(raw.time);
  const ts = Date.parse(time);
  const status = text(raw.status);
  const txType = text(raw.tx_type);
  const hash = text(raw.hash) || `${time}-${kind}`;

  if (kind.startsWith("L1Deposit")) {
    const selfIndex = text(pub.account_index);
    if (!selfIndex || !self.has(selfIndex)) return null;
    const asset = assetSymbol(pub.asset_index, "USDG");
    const l1 = text(pub.l1_address);
    return {
      hash,
      time,
      timestamp: Number.isFinite(ts) ? ts : 0,
      kind,
      txType,
      direction: "deposit",
      amount: fundAmount(pub),
      asset,
      status,
      route: text(pub.route_type),
      counterparty: l1,
      counterpartyKind: l1 ? "address" : "none",
      selfIndex,
    };
  }

  if (kind.startsWith("Withdraw")) {
    const selfIndex = text(pub.from_account_index);
    if (!selfIndex || !self.has(selfIndex)) return null;
    const asset = assetSymbol(pub.asset_index, "USDG");
    return {
      hash,
      time,
      timestamp: Number.isFinite(ts) ? ts : 0,
      kind,
      txType,
      direction: "withdraw",
      amount: fundAmount(pub),
      asset,
      status,
      route: text(pub.route_type),
      counterparty: "",
      counterpartyKind: "none",
      selfIndex,
    };
  }

  const from = text(pub.from_account_index);
  const to = text(pub.to_account_index);
  const selfIndex = self.has(to) ? to : self.has(from) ? from : "";
  if (!selfIndex) return null;
  const incoming = selfIndex === to;
  const asset = assetSymbol(pub.asset_index, "USDG");
  const counterparty = incoming ? from : to;
  return {
    hash,
    time,
    timestamp: Number.isFinite(ts) ? ts : 0,
    kind,
    txType,
    direction: incoming ? "transfer_in" : "transfer_out",
    amount: fundAmount(pub),
    asset,
    status,
    route: text(pub.to_route_type || pub.from_route_type),
    counterparty,
    counterpartyKind: counterparty ? "account" : "none",
    selfIndex,
  };
}
