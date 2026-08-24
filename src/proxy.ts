import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  checkPublicRateLimit,
  isPrefetchRequest,
  rateLimitHeaders,
} from "@/lib/public-rate-limit";

export async function proxy(request: NextRequest) {
  if (isPrefetchRequest(request.headers)) {
    return NextResponse.next();
  }

  const rate = await checkPublicRateLimit(request.headers, "logs");
  if (rate.success) {
    return NextResponse.next();
  }

  const retryAfter = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1_000));
  const hash = request.nextUrl.pathname.replace(/^\/logs\//, "").split("/")[0] ?? "";
  const official = hash
    ? `https://robinhoodchain.lighter.xyz/explorer/logs/${encodeURIComponent(hash)}`
    : "https://robinhoodchain.lighter.xyz/explorer";

  return new NextResponse(
    `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Too many log lookups · LighterScan</title>
  </head>
  <body>
    <p>请求过于频繁，请稍后再试这条日志。</p>
    <p>Too many log lookups. Please try again shortly.</p>
    <p><a href="${official}">Open official explorer</a></p>
  </body>
</html>`,
    {
      status: 429,
      headers: {
        ...rateLimitHeaders(rate),
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "Retry-After": String(retryAfter),
      },
    },
  );
}

export const config = {
  matcher: "/logs/:hash+",
};
