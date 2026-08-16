import Link from "next/link";
import { connection } from "next/server";
import { canLinkAddress, compactNum, publicAddressLabel, shortAddress } from "@/lib/format";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getLeaderboard } from "@/lib/rh";
import type { LeaderboardEntry } from "@/lib/types";

export const revalidate = 30;

export const metadata = {
  title: "Leaderboard",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  await connection();
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "lb.title")}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">{t(lang, "lb.subtitle")}</p>
        </div>
        <div className="flex rounded-full bg-elev p-0.5 text-sm">
          <Link
            href="/leaderboard?type=all"
            className={`rounded-full px-3 py-1 ${type === "all" ? "bg-card" : "text-muted"}`}
          >
            {t(lang, "lb.allTime")}
          </Link>
          <Link
            href="/leaderboard?type=weekly"
            className={`rounded-full px-3 py-1 ${type === "weekly" ? "bg-card" : "text-muted"}`}
          >
            {t(lang, "lb.weekly")}
          </Link>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {error ? (
          <p className="px-4 py-10 text-center text-sm text-muted">{error}</p>
        ) : entries.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {t(lang, "lb.empty")}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-faint">
              <tr className="border-b border-line">
                <th className="px-4 py-2.5 font-medium">{t(lang, "lb.rank")}</th>
                <th className="px-3 py-2.5 font-medium">{t(lang, "lb.address")}</th>
                <th className="px-4 py-2.5 font-medium">{t(lang, "lb.points")}</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => (
                <tr key={`${row.rank}-${row.l1Address}`} className="border-b border-line last:border-0">
                  <td className="px-4 py-2.5 tabular text-muted">
                    {String(row.rank).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-2.5 font-mono">
                    {canLinkAddress(row.l1Address) ? (
                      <Link href={`/address/${row.l1Address}`} className="hover:text-accent">
                        <span className="hidden sm:inline">{row.l1Address}</span>
                        <span className="sm:hidden">{shortAddress(row.l1Address, 6)}</span>
                      </Link>
                    ) : (
                      <span className="text-muted">{publicAddressLabel(row.l1Address)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular font-medium">
                    {compactNum(row.points, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
