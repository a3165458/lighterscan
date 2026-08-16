import { connection } from "next/server";
import { LiveTape } from "@/components/live-tape";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getMarkets } from "@/lib/rh";
import { publicRealtimeTransport } from "@/lib/shared-cache";

export const revalidate = 30;

export const metadata = {
  title: "Live Trades",
};

export default async function TapePage() {
  await connection();
  const [markets, lang] = await Promise.all([getMarkets(), getRequestLang()]);
  const seeds = markets
    .filter((m) => m.marketType === "perp")
    .slice(0, 40)
    .map((m) => ({ marketId: m.marketId, symbol: m.symbol }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "tape.pageTitle")}</h1>
      </div>
      <LiveTape
        markets={seeds}
        max={80}
        title={t(lang, "tape.title")}
        transport={publicRealtimeTransport()}
      />
    </div>
  );
}
