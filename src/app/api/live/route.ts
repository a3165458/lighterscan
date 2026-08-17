import { NextResponse } from "next/server";
import { LIVE_CACHE_CONTROL } from "@/lib/poll";
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
          "Cache-Control": LIVE_CACHE_CONTROL,
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
