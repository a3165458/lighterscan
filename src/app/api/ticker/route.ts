import { NextResponse } from "next/server";
import { TICKER_CACHE_CONTROL } from "@/lib/poll";
import { isRealtimeSnapshotFresh } from "@/lib/realtime";
import { getOverview } from "@/lib/rh";
import {
  publicRealtimeTransport,
  readPublicRealtimeSnapshot,
} from "@/lib/shared-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const [overview, snapshot] = await Promise.all([
    getOverview(),
    publicRealtimeTransport() === "shared"
      ? readPublicRealtimeSnapshot()
      : Promise.resolve(null),
  ]);
  const realtime =
    publicRealtimeTransport() === "direct"
      ? "direct"
      : snapshot
        ? isRealtimeSnapshotFresh(snapshot)
          ? "fresh"
          : "stale"
        : "missing";
  return NextResponse.json(
    {
      dailyVolume: overview.totals.dailyVolume,
      dailyTrades: overview.totals.dailyTrades,
      openInterest: overview.totals.openInterest,
      markets: overview.totals.markets,
      realtime,
      updatedAt: snapshot?.updatedAt ?? overview.generatedAt,
    },
    { headers: { "Cache-Control": TICKER_CACHE_CONTROL } },
  );
}
