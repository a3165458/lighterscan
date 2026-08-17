import Link from "next/link";
import { notFound } from "next/navigation";
import { StatCard } from "@/components/stat-card";
import { TokenIcon } from "@/components/token-icon";
import { compactUsd, formatPrice, formatSize, formatTime } from "@/lib/format";
import { officialLogUrl, getLogByHash } from "@/lib/history";
import { t } from "@/lib/i18n";
import { getRequestLang } from "@/lib/lang-server";
import { getMarkets } from "@/lib/rh";

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  return { title: hash.slice(0, 12) };
}

export default async function LogPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  const lang = await getRequestLang();
  const markets = await getMarkets().catch(() => []);
  const names = Object.fromEntries(markets.map((m) => [m.marketId, m.symbol]));
  let payload;
  try {
    payload = await getLogByHash(hash, names);
  } catch (err) {
    const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
    if (status === 404) notFound();
    throw err;
  }
  const { trade, raw } = payload;
  const official = officialLogUrl(hash, lang);

  return (
    <div className="space-y-6">
      <div className="text-xs text-muted">
        <Link href="/" className="hover:text-ink">
          {t(lang, "nav.markets")}
        </Link>
        <span className="mx-1.5 text-faint">/</span>
        {t(lang, "log.title")}
      </div>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "log.title")}</h1>
        <p className="mt-2 break-all font-mono text-sm text-muted">{hash}</p>
      </div>

      {trade ? (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <TokenIcon symbol={trade.symbol || "?"} size={36} />
            <div>
              <div className="text-2xl font-semibold">
                {trade.symbol || `#${trade.marketId}`}
              </div>
              <div className="text-sm text-muted">
                {trade.kind} · {trade.txType}
              </div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-3xl font-semibold tabular">{formatPrice(trade.price)}</div>
              <div className="text-sm text-muted">
                {formatSize(trade.size)} · {compactUsd(trade.usdAmount)}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={t(lang, "log.market")}
              value={trade.symbol || String(trade.marketId)}
              hint={`market ${trade.marketId}`}
            />
            <StatCard
              label={t(lang, "log.price")}
              value={formatPrice(trade.price)}
              hint={t(lang, "log.takerSide") + " · " + (trade.isTakerAsk ? t(lang, "log.ask") : t(lang, "log.bid"))}
            />
            <StatCard
              label={t(lang, "log.size")}
              value={formatSize(trade.size)}
              hint={t(lang, "log.notional") + " " + compactUsd(trade.usdAmount)}
            />
            <StatCard
              label={t(lang, "log.time")}
              value={formatTime(trade.timestamp)}
              hint={trade.status || "—"}
            />
          </div>

          <div className="panel overflow-hidden">
            <table className="w-full text-left text-sm">
              <tbody>
                <Row label={t(lang, "log.taker")}>
                  <Link href={`/account/${trade.taker}`} className="hover:text-accent">
                    {trade.taker}
                  </Link>
                  {trade.isTakerAsk ? ` · ${t(lang, "tape.sell")}` : ` · ${t(lang, "tape.buy")}`}
                </Row>
                <Row label={t(lang, "log.maker")}>
                  <Link href={`/account/${trade.maker}`} className="hover:text-accent">
                    {trade.maker}
                  </Link>
                </Row>
                <Row label={t(lang, "log.block")}>{trade.blockNumber || "—"}</Row>
                <Row label={t(lang, "log.batch")}>{trade.batchNumber || "—"}</Row>
                <Row label={t(lang, "log.type")}>{trade.txType}</Row>
                <Row label={t(lang, "log.hash")}>
                  <span className="break-all font-mono text-xs">{trade.hash}</span>
                </Row>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="panel px-4 py-6 text-sm text-muted">
          <p>{t(lang, "log.missing")}</p>
          <pre className="mt-3 overflow-x-auto text-xs">{JSON.stringify(raw, null, 2)}</pre>
        </div>
      )}

      <a
        href={official}
        target="_blank"
        rel="noreferrer"
        className="inline-flex rounded-full border border-line bg-elev px-3 py-1.5 text-sm hover:bg-hover"
      >
        {t(lang, "log.official")}
      </a>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-line last:border-0">
      <th className="w-36 px-4 py-2 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-faint">
        {label}
      </th>
      <td className="px-4 py-2">{children}</td>
    </tr>
  );
}
