import { NextResponse } from "next/server";
import { isRealtimeSnapshotFresh } from "@/lib/realtime";
import {
  publicRealtimeTransport,
  readPublicRealtimeSnapshot,
} from "@/lib/shared-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  if (publicRealtimeTransport() === "direct") {
    return NextResponse.json(
      { status: "healthy", realtime: "direct", updatedAt: null },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const snapshot = await readPublicRealtimeSnapshot();
    const healthy = Boolean(snapshot && isRealtimeSnapshotFresh(snapshot));
    return NextResponse.json(
      {
        status: healthy ? "healthy" : "unhealthy",
        realtime: snapshot ? (healthy ? "fresh" : "stale") : "missing",
        updatedAt: snapshot?.updatedAt ?? null,
      },
      {
        status: healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return NextResponse.json(
      { status: "unhealthy", realtime: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
