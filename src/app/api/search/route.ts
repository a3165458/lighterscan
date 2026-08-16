import { NextResponse } from "next/server";
import { searchQuery } from "@/lib/rh";
import {
  checkPublicRateLimit,
  rateLimitHeaders,
} from "@/lib/public-rate-limit";

export async function GET(req: Request) {
  const rate = await checkPublicRateLimit(req.headers, "search");
  const headers = rateLimitHeaders(rate);
  if (!rate.success) {
    return NextResponse.json(
      {
        hits: [],
        error: rate.unavailable
          ? "Search service is unavailable"
          : "Too many requests",
      },
      { status: rate.unavailable ? 503 : 429, headers },
    );
  }
  const q = (new URL(req.url).searchParams.get("q") || "").trim();
  if (q.length === 0 || q.length > 100) {
    return NextResponse.json(
      { hits: [], error: "Query must contain 1 to 100 characters" },
      { status: 400, headers },
    );
  }
  try {
    const hits = await searchQuery(q);
    return NextResponse.json({ hits }, { headers });
  } catch {
    return NextResponse.json(
      { hits: [], error: "Search service is unavailable" },
      { status: 503, headers },
    );
  }
}
