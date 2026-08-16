import { NextResponse } from "next/server";
import { isRealtimeSnapshotFresh } from "@/lib/realtime";
import {
  isSharedCacheConfigured,
  readPublicRealtimeSnapshot,
} from "@/lib/shared-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSharedCacheConfigured()) {
    return NextResponse.json(
      { error: "Realtime service is not configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await readPublicRealtimeSnapshot();
    if (!snapshot) {
      return NextResponse.json(
        { error: "Realtime snapshot is not available" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { ...snapshot, fresh: isRealtimeSnapshotFresh(snapshot) },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1, stale-while-revalidate=5",
        },
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Realtime service is unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
