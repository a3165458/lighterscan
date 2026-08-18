import { NextResponse } from "next/server";
import { emptyFundPage, getAccountFundHistory } from "@/lib/funds";
import { HISTORY_CACHE_CONTROL } from "@/lib/poll";
import {
  checkPublicRateLimit,
  rateLimitHeaders,
} from "@/lib/public-rate-limit";

const ACCOUNT_PATTERN = /^(?:\d{1,12}|0x[a-fA-F0-9]{40})$/;

export async function GET(req: Request) {
  const rate = await checkPublicRateLimit(req.headers, "history");
  const headers = rateLimitHeaders(rate);
  if (!rate.success) {
    return NextResponse.json(
      {
        error: rate.unavailable
          ? "Funds service is unavailable"
          : "Too many requests",
        ...emptyFundPage(),
      },
      {
        status: rate.unavailable ? 503 : 429,
        headers: { ...headers, "Cache-Control": "no-store" },
      },
    );
  }

  const url = new URL(req.url);
  const account = (url.searchParams.get("account") || "").trim();
  const rawOffset = Number(url.searchParams.get("offset") || 0);
  const rawLimit = Number(url.searchParams.get("limit") || 40);
  const offset = Number.isFinite(rawOffset)
    ? Math.min(100_000, Math.max(0, Math.trunc(rawOffset)))
    : 0;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(100, Math.max(1, Math.trunc(rawLimit)))
    : 40;
  const selves = (url.searchParams.get("selves") || account)
    .split(",")
    .map((value) => value.trim())
    .filter((value) => ACCOUNT_PATTERN.test(value))
    .slice(0, 10);
  if (!ACCOUNT_PATTERN.test(account)) {
    return NextResponse.json(
      { error: "Valid account index or address required" },
      { status: 400, headers: { ...headers, "Cache-Control": "no-store" } },
    );
  }
  try {
    const page = await getAccountFundHistory(
      account,
      offset,
      limit,
      selves.length ? selves : [account],
    );
    return NextResponse.json(page, {
      headers: { ...headers, "Cache-Control": HISTORY_CACHE_CONTROL },
    });
  } catch {
    return NextResponse.json(
      {
        error: "Funds service is unavailable",
        ...emptyFundPage(offset),
      },
      { status: 503, headers: { ...headers, "Cache-Control": "no-store" } },
    );
  }
}
