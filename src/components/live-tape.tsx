"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { compactUsd, formatPrice, formatSize, formatTimeOnly } from "@/lib/format";
import { RH_WS } from "@/lib/config";
import { resolveLiveStatus } from "@/lib/live-status";
import { tradeLogHref } from "@/lib/account-stats";
import {
  isPublicRealtimeSnapshot,
  parseLighterTradeMessage,
} from "@/lib/realtime";
import type { Trade } from "@/lib/types";

type Seed = { marketId: number; symbol: string };

export function LiveTape({
  markets,
  title = "Live Trades",
  max = 48,
  seed = [],
  transport = "direct",
}: {
  markets: Seed[];
  title?: string;
  max?: number;
  seed?: Trade[];
  transport?: "direct" | "shared";
}) {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>(seed);
  const [status, setStatus] = useState<"connecting" | "live" | "idle">(
    seed.length > 0 ? "live" : "connecting",
  );
  const map = useMemo(
    () => new Map(markets.map((m) => [m.marketId, m.symbol])),
    [markets],
  );
  const ids = useMemo(() => markets.map((m) => m.marketId), [markets]);
  const idSet = useMemo(() => new Set(ids), [ids]);
  const ping = useRef<number | null>(null);
  const flushTimer = useRef<number | null>(null);
  const pendingTrades = useRef<Trade[]>([]);

  useEffect(() => {
    if (transport !== "shared" || ids.length === 0) return;
    let active = true;
    let timer: number | undefined;

    async function load() {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        const value = (await response.json()) as unknown;
        if (!response.ok || !isPublicRealtimeSnapshot(value)) {
          throw new Error("Realtime snapshot unavailable");
        }
        if (!active) return;
        setTrades(
          value.trades.filter((trade) => idSet.has(trade.marketId)).slice(0, max),
        );
        setStatus(
          (value as typeof value & { fresh?: boolean }).fresh
            ? "live"
            : "connecting",
        );
      } catch {
        if (active) setStatus("connecting");
      } finally {
        if (active) timer = window.setTimeout(load, 2_000);
      }
    }

    void load();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [idSet, ids.length, max, transport]);

  useEffect(() => {
    if (transport === "shared" || !ids.length) {
      return;
    }
    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;

    function connect() {
      if (closed) return;
      setStatus((prev) => (prev === "live" || seed.length > 0 ? "live" : "connecting"));
      ws = new WebSocket(RH_WS);
      ws.onopen = () => {
        retry = 0;
        setStatus("live");
        for (const id of ids) {
          ws?.send(JSON.stringify({ type: "subscribe", channel: `trade/${id}` }));
        }
        ping.current = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 45_000);
      };
      ws.onmessage = (ev) => {
        try {
          const mapped = parseLighterTradeMessage(
            JSON.parse(ev.data as string) as unknown,
            map,
          );
          if (mapped.length === 0) return;
          pendingTrades.current.push(...mapped);
          if (flushTimer.current === null) {
            flushTimer.current = window.setTimeout(() => {
              const batch = pendingTrades.current.reverse();
              pendingTrades.current = [];
              flushTimer.current = null;
              setTrades((prev) => [...batch, ...prev].slice(0, max));
            }, 100);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (ping.current) window.clearInterval(ping.current);
        if (closed) return;
        retry += 1;
        window.setTimeout(connect, Math.min(8_000, 800 * retry));
      };
    }

    connect();
    return () => {
      closed = true;
      if (ping.current) window.clearInterval(ping.current);
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current);
      pendingTrades.current = [];
      ws?.close();
    };
  }, [ids, map, max, seed.length, transport]);

  const shown = ids.length === 0 ? "idle" : resolveLiveStatus(status, trades.length > 0);

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title || t("tape.title")}</h2>
          <p className="text-xs text-muted">{t("tape.hint")}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className={shown === "live" ? "live-dot" : "h-1.5 w-1.5 rounded-full bg-faint"} />
          {shown === "live"
            ? t("tape.live")
            : shown === "connecting"
              ? t("tape.connecting")
              : t("tape.idle")}
        </div>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {trades.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">
            {t("tape.waiting")}
          </p>
        ) : (
          <ul>
            {trades.map((fill) => {
              const href = tradeLogHref(fill.txHash);
              const rowClass =
                "deferred-row grid grid-cols-[72px_1fr_auto] items-center gap-2 px-4 py-2 text-sm";
              const body = (
                <>
                  <span className="font-medium">{fill.symbol || fill.marketId}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={fill.takerIsAsk ? "text-down" : "text-up"}>
                        {fill.takerIsAsk ? t("tape.sell") : t("tape.buy")}
                      </span>
                      <span className="tabular">{formatSize(fill.size)}</span>
                      <span className="text-muted">@</span>
                      <span className="tabular">{formatPrice(fill.price)}</span>
                    </div>
                    {fill.type !== "trade" ? (
                      <div className="truncate text-[11px] text-faint">{fill.type}</div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className="tabular text-sm">{compactUsd(fill.usdAmount)}</div>
                    <div className="text-[11px] text-faint">{formatTimeOnly(fill.timestamp)}</div>
                  </div>
                </>
              );
              return (
                <li
                  key={`${fill.tradeId}-${fill.timestamp}`}
                  className="border-b border-line last:border-0"
                >
                  {href ? (
                    <Link href={href} className={`${rowClass} hover:bg-hover`}>
                      {body}
                    </Link>
                  ) : (
                    <div className={rowClass}>{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
