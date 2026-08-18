import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { canLinkAddress, compactNum, publicAddressLabel, shortAddress } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getLeaderboard } from "@/lib/rh";
import type { LeaderboardEntry } from "@/lib/types";

export const revalidate = 60;

export const metadata = {
  title: "Leaderboard",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: rawType } = await searchParams;
  const lang = await getRequestLang();
  const type = rawType === "weekly" ? "weekly" : "all";
  let entries: LeaderboardEntry[] = [];
  let error: string | null = null;
  try {
    entries = await getLeaderboard(type);
  } catch {
    error = t(lang, "lb.loadFail");
  }

  return (
    // Header and board share one column so the range toggle stays with the
    // table instead of drifting to the far edge of the content width.
    <div className="max-w-4xl space-y-3.5">
      <PageHeader title={t(lang, "lb.title")} lede={t(lang, "lb.subtitle")}>
        <div className="seg">
          <Link href="/leaderboard?type=all" data-on={type === "all"}>
            {t(lang, "lb.allTime")}
          </Link>
          <Link href="/leaderboard?type=weekly" data-on={type === "weekly"}>
            {t(lang, "lb.weekly")}
          </Link>
        </div>
      </PageHeader>

      <div className="panel overflow-hidden">
        {error ? (
          <p className="empty">{error}</p>
        ) : entries.length === 0 ? (
          <p className="empty">{t(lang, "lb.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th className="num w-14">{t(lang, "lb.rank")}</th>
                  <th>{t(lang, "lb.address")}</th>
                  <th className="num">{t(lang, "lb.points")}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => (
                  <tr key={`${row.rank}-${row.l1Address}`}>
                    <td className="num text-faint">{row.rank}</td>
                    <td className="font-mono">
                      {canLinkAddress(row.l1Address) ? (
                        <Link href={`/address/${row.l1Address}`} className="link-accent">
                          <span className="hidden sm:inline">{row.l1Address}</span>
                          <span className="sm:hidden">{shortAddress(row.l1Address, 6)}</span>
                        </Link>
                      ) : (
                        <span className="text-faint">
                          {publicAddressLabel(row.l1Address)}
                        </span>
                      )}
                    </td>
                    <td className="num font-medium">{compactNum(row.points, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
