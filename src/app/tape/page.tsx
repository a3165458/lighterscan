import { LiveTape } from "@/components/live-tape";
import { MarketFilter } from "@/components/market-filter";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { perpChoices, resolveMarketChoice } from "@/lib/market-filter";
import { getMarkets } from "@/lib/rh";
import { publicRealtimeTransport } from "@/lib/shared-cache";

export const revalidate = 60;

export const metadata = {
  title: "Live Trades",
};

export default async function TapePage({
  searchParams,
}: {
  searchParams: Promise<{ market?: string }>;
}) {
  const [{ market: rawMarket }, markets, lang] = await Promise.all([
    searchParams,
    getMarkets(),
    getRequestLang(),
  ]);
  const choices = perpChoices(markets);
  const selected = resolveMarketChoice(rawMarket, choices);
  const seeds = selected
    ? [selected]
    : choices.slice(0, 40);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "tape.pageTitle")}</h1>
      </div>
      <MarketFilter markets={choices} selected={selected?.symbol} />
      <LiveTape
        key={selected?.symbol ?? "all"}
        markets={seeds}
        max={80}
        title={t(lang, "tape.title")}
        transport={selected ? "direct" : publicRealtimeTransport()}
        showFilter
      />
    </div>
  );
}
