import { FundingBoard } from "@/components/funding-board";
import { PageHeader } from "@/components/ui";
import { fundingBoardRows } from "@/lib/funding";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getFundingRates } from "@/lib/rh";

export const revalidate = 60;

export const metadata = {
  title: "Funding",
};

export default async function FundingPage() {
  const lang = await getRequestLang();
  let rows = fundingBoardRows([]);
  let error: string | null = null;
  try {
    rows = fundingBoardRows(await getFundingRates());
  } catch {
    error = t(lang, "funding.loadFail");
  }

  return (
    <div className="space-y-3.5">
      <PageHeader title={t(lang, "funding.title")} lede={t(lang, "funding.subtitle")}>
        <span className="badge">{rows.length}</span>
      </PageHeader>

      <div className="panel overflow-hidden">
        {error ? (
          <p className="empty">{error}</p>
        ) : (
          <FundingBoard rows={rows} emptyLabel={t(lang, "funding.empty")} />
        )}
      </div>
      <p className="text-[11.5px] leading-5 text-faint">{t(lang, "funding.footnote")}</p>
    </div>
  );
}
