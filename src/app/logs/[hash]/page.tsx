import Link from "next/link";
import { notFound } from "next/navigation";
import { TokenIcon } from "@/components/token-icon";
import { Crumbs, Stat, StatStrip } from "@/components/ui";
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
    <div className="max-w-4xl space-y-3.5">
      <Crumbs
        items={[
          { label: t(lang, "nav.markets"), href: "/" },
          { label: t(lang, "log.title") },
        ]}
      />

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <h1 className="page-title">{t(lang, "log.title")}</h1>
          <p className="mt-1 break-all font-mono text-[11.5px] text-faint">{hash}</p>
        </div>
        <a href={official} target="_blank" rel="noreferrer" className="btn">
          {t(lang, "log.official")}
        </a>
      </div>

      {trade ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <TokenIcon symbol={trade.symbol || "?"} size={30} />
              <div>
                <div className="text-[17px] font-semibold">
                  {trade.symbol || `#${trade.marketId}`}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="tag">{trade.kind}</span>
                  <span className="tag">{trade.txType}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="hero-num">{formatPrice(trade.price)}</div>
              <div className="text-[11.5px] tabular text-muted">
                {formatSize(trade.size)} · {compactUsd(trade.usdAmount)}
              </div>
            </div>
          </div>

          <StatStrip cols={4}>
            <Stat
              label={t(lang, "log.market")}
              value={trade.symbol || String(trade.marketId)}
              hint={`market ${trade.marketId}`}
            />
            <Stat
              label={t(lang, "log.price")}
              value={formatPrice(trade.price)}
              hint={`${t(lang, "log.takerSide")} · ${trade.isTakerAsk ? t(lang, "log.ask") : t(lang, "log.bid")}`}
            />
            <Stat
              label={t(lang, "log.size")}
              value={formatSize(trade.size)}
              hint={`${t(lang, "log.notional")} ${compactUsd(trade.usdAmount)}`}
            />
            <Stat
              label={t(lang, "log.time")}
              value={formatTime(trade.timestamp)}
              hint={trade.status || "—"}
            />
          </StatStrip>

          <div className="panel overflow-hidden">
            <table className="tbl tbl-quiet">
              <tbody>
                <Row label={t(lang, "log.taker")}>
                  <Link href={`/account/${trade.taker}`} className="font-mono link-accent">
                    #{trade.taker}
                  </Link>
                  <span className={trade.isTakerAsk ? "text-down" : "text-up"}>
                    {trade.isTakerAsk
                      ? ` · ${t(lang, "tape.sell")}`
                      : ` · ${t(lang, "tape.buy")}`}
                  </span>
                </Row>
                <Row label={t(lang, "log.maker")}>
                  <Link href={`/account/${trade.maker}`} className="font-mono link-accent">
                    #{trade.maker}
                  </Link>
                </Row>
                <Row label={t(lang, "log.block")}>
                  <span className="tabular">{trade.blockNumber || "—"}</span>
                </Row>
                <Row label={t(lang, "log.batch")}>
                  <span className="tabular">{trade.batchNumber || "—"}</span>
                </Row>
                <Row label={t(lang, "log.type")}>{trade.txType}</Row>
                <Row label={t(lang, "log.hash")}>
                  <span className="wrap break-all font-mono text-[11px] text-muted">
                    {trade.hash}
                  </span>
                </Row>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="panel p-3.5 text-[12.5px] text-muted">
          <p>{t(lang, "log.missing")}</p>
          <pre className="scroll-y mt-3 max-h-80 overflow-x-auto text-[11px] leading-relaxed">
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <th className="w-32 text-left">{label}</th>
      <td className="wrap">{children}</td>
    </tr>
  );
}
