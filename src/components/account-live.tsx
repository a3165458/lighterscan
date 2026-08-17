"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { StatCard } from "@/components/stat-card";
import { compactNum, compactUsd } from "@/lib/format";
import { RH_WS } from "@/lib/config";
import { mergeAccountStreamMessage } from "@/lib/account-stats";
import type { AccountLiveStats } from "@/lib/types";

export function AccountLive({
  accountIndex,
  initial,
  complete = true,
}: {
  accountIndex: number;
  initial?: AccountLiveStats | null;
  complete?: boolean;
}) {
  const { t } = useI18n();
  const [stats, setStats] = useState<AccountLiveStats | null>(initial ?? null);
  const [streamed, setStreamed] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let ping: number | null = null;

    function connect() {
      ws = new WebSocket(RH_WS);
      ws.onopen = () => {
        ws?.send(
          JSON.stringify({ type: "subscribe", channel: `account_all/${accountIndex}` }),
        );
        ws?.send(
          JSON.stringify({ type: "subscribe", channel: `user_stats/${accountIndex}` }),
        );
        ping = window.setInterval(() => {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 45_000);
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string) as unknown;
          setStats((prev) => {
            const merged = mergeAccountStreamMessage(msg, prev);
            if (merged.volumeFromStream) {
              queueMicrotask(() => setStreamed(true));
            }
            return merged.stats;
          });
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (ping) window.clearInterval(ping);
        if (!closed) window.setTimeout(connect, 2000);
      };
    }

    connect();
    return () => {
      closed = true;
      if (ping) window.clearInterval(ping);
      ws?.close();
    };
  }, [accountIndex]);

  const vol24Hint = streamed
    ? t("account.liveHint")
    : stats
      ? t("account.tradesCount", { count: compactNum(stats.dailyTrades, 0) })
      : t("account.connectingHint");
  const volAllHint =
    !complete && stats
      ? t("account.historyPartial", { count: compactNum(stats.totalTrades, 0) })
      : t("account.tradesCount", { count: compactNum(stats?.totalTrades ?? 0, 0) });

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("account.vol24")}
        value={compactUsd(stats?.dailyVolume ?? 0)}
        hint={vol24Hint}
      />
      <StatCard
        label={t("account.vol7")}
        value={compactUsd(stats?.weeklyVolume ?? 0)}
        hint={t("account.tradesCount", { count: compactNum(stats?.weeklyTrades ?? 0, 0) })}
      />
      <StatCard
        label={t("account.volAll")}
        value={compactUsd(stats?.totalVolume ?? 0)}
        hint={volAllHint}
      />
      <StatCard
        label={t("account.portfolio")}
        value={compactUsd(stats?.portfolioValue ?? 0)}
        hint={
          stats?.leverage
            ? t("account.leverage", { value: stats.leverage.toFixed(2) })
            : t("account.liveStats")
        }
      />
    </div>
  );
}
