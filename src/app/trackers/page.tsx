import { connection } from "next/server";
import { TrackerBoard } from "@/components/tracker-board";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { publicRealtimeTransport } from "@/lib/shared-cache";
import { getTrackedMarkets, type TrackedMarket } from "@/lib/trackers";

export const revalidate = 20;

export const metadata = {
  title: "Account Trackers",
};

export default async function TrackersPage() {
  await connection();
  const [lang, marketsResult] = await Promise.all([
    getRequestLang(),
    getTrackedMarkets().catch(() => [] as TrackedMarket[]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-accent">
          {t(lang, "tracker.kicker")}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {t(lang, "tracker.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {t(lang, "tracker.subtitle")}
        </p>
      </div>

      <TrackerBoard
        markets={marketsResult}
        transport={publicRealtimeTransport()}
      />

    </div>
  );
}
