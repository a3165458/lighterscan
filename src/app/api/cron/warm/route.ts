import { NextResponse } from "next/server";
import {
  loadPublicHourlyVolume,
  loadPublicLiquidations,
  loadPublicPositions,
} from "@/lib/public-boards";
import { getOverview } from "@/lib/rh";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const overview = await getOverview();
  const [hourly, liquidations, positions] = await Promise.all([
    loadPublicHourlyVolume(overview.markets).catch(() => []),
    loadPublicLiquidations(overview.markets).catch(() => []),
    loadPublicPositions(overview.markets).catch(() => []),
  ]);

  return NextResponse.json(
    {
      ok: true,
      markets: overview.markets.length,
      hourly: hourly.length,
      liquidations: liquidations.length,
      positions: positions.length,
      updatedAt: overview.generatedAt,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
