const CRYPTO = new Set([
  "BTC",
  "ETH",
  "SOL",
  "LIT",
  "SUI",
  "ZEC",
  "DOGE",
  "XRP",
  "ADA",
  "AVAX",
  "LINK",
  "DOT",
  "NEAR",
  "APT",
  "ARB",
  "OP",
  "UNI",
  "AAVE",
  "HYPE",
  "PUMP",
  "WIF",
  "PEPE",
  "BONK",
  "ENA",
  "PAXG",
  "XMR",
  "LTC",
  "BCH",
  "TON",
  "TRX",
  "SHIB",
  "FIL",
  "ATOM",
  "SEI",
  "TIA",
  "JUP",
  "WLD",
  "ONDO",
  "PENDLE",
  "MKR",
  "CRV",
  "LDO",
  "ENS",
  "STX",
  "INJ",
  "S",
  "FARTCOIN",
  "CASHCAT",
  "ANSEM",
  "HYPE",
  "WLFI",
  "2Z",
  "DOLO",
  "APEX",
  "EDEN",
  "ZORA",
  "UNITREE",
  "GRAM",
  "RAIL",
  "CHIP",
  "BB",
]);

export function classifyAsset(
  symbol: string,
  marketType?: string,
): "crypto" | "rwa" | "spot" {
  const type = (marketType || "").toLowerCase();
  if (type === "spot" || symbol.includes("/")) return "spot";
  const base = baseSymbol(symbol);
  if (CRYPTO.has(base.toUpperCase())) return "crypto";
  return "rwa";
}

export function baseSymbol(symbol: string): string {
  return symbol.split("/")[0].replace(/-PERP$/i, "").replace(/USD[GC]?$/i, "");
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function compactUsd(value: number, digits = 1): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(digits)}T`;
  if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${sign}$${(abs / 1e3).toFixed(digits)}K`;
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs === 0) return "$0";
  return `${sign}$${abs.toFixed(4)}`;
}

export function signedUsd(value: number, digits = 1): string {
  if (value > 0) return `+${compactUsd(value, digits)}`;
  return compactUsd(value, digits);
}

export function compactNum(value: number, digits = 1): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(digits)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(digits)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(digits)}K`;
  if (abs >= 100) return `${sign}${abs.toFixed(0)}`;
  return `${sign}${abs.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

export function formatPrice(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (abs >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  if (abs >= 0.01) return value.toFixed(4);
  if (abs === 0) return "0";
  return value.toPrecision(4);
}

export function formatPct(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatFundingPct(rate: number, digits = 4): string {
  return formatPct(rate * 100, digits);
}

export function formatSize(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return compactNum(value);
  if (abs >= 1) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  if (abs === 0) return "0";
  return value.toPrecision(4);
}

export function shortAddress(addr: string, size = 4): string {
  if (!addr) return "—";
  if (addr.length <= size * 2 + 2) return addr;
  return `${addr.slice(0, size + 2)}…${addr.slice(-size)}`;
}

export function publicAddressLabel(addr: string): string {
  const value = addr.trim();
  if (!value) return "—";
  const maskIndex = value.indexOf("*");
  return maskIndex === -1 ? value : `${value.slice(0, maskIndex)}…`;
}

export function shortAccount(id: number | string): string {
  const s = String(id);
  if (s.length <= 10) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export function normalizeTs(value: number): number {
  if (!value) return Date.now();
  if (value > 1e16) return Math.floor(value / 1000);
  if (value > 1e13) return Math.floor(value / 1000);
  if (value > 1e12) return value;
  if (value > 1e9) return value * 1000;
  return value;
}

export function formatTime(value: number): string {
  const d = new Date(normalizeTs(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function formatTimeOnly(value: number): string {
  const d = new Date(normalizeTs(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatDate(value: number): string {
  const d = new Date(normalizeTs(value));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function pnlClass(value: number): string {
  if (value > 0) return "text-up";
  if (value < 0) return "text-down";
  return "text-muted";
}

export function isAddress(q: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(q.trim());
}

export function isRedactedAddress(q: string): boolean {
  return /\*/.test(q) || /0x[a-fA-F0-9]*\*+/.test(q);
}

export function canLinkAddress(q: string): boolean {
  return isAddress(q) && !isRedactedAddress(q);
}

export function openInterestUsd(baseOi: number, price: number): number {
  if (!baseOi || !price) return 0;
  return baseOi * price;
}

export function isAccountIndex(q: string): boolean {
  return /^\d{1,18}$/.test(q.trim());
}

export function isLogHash(q: string): boolean {
  return /^[0-9a-fA-F]{32,96}$/.test(q.trim());
}

export function tokenIconCandidates(symbol: string): string[] {
  const base = baseSymbol(symbol).toLowerCase();
  if (!base) return [];
  return [
    `https://assets.lighter.xyz/fe/token/${base}.png`,
    `https://assets.lighter.xyz/fe/token/${base}.svg`,
  ];
}

export function tokenIcon(symbol: string): string {
  return tokenIconCandidates(symbol)[0] ?? "";
}

export function tokenIconPng(symbol: string): string {
  return tokenIconCandidates(symbol)[0] ?? "";
}
