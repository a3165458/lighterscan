"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { StatCard } from "@/components/stat-card";
import { compactNum, compactUsd } from "@/lib/format";
import { RH_WS } from "@/lib/config";
import { resolveLiveStatus } from "@/lib/live-status";
import type { AccountLiveStats } from "@/lib/types";

export function AccountLive({
  accountIndex,
}: {
  accountIndex: number;
}) {
  const { t } = useI18n();
  const [stats, setStats] = useState<AccountLiveStats | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let ping: number | null = null;

    function connect() {
      ws = new WebSocket(RH_WS);
      ws.onopen = () => {
        setLive(true);
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
          const msg = JSON.parse(ev.data as string) as Record<string, unknown>;
          const type = String(msg.type || "");
          if (type.includes("account_all") && !type.includes("trade")) {
            setStats((prev) => ({
              dailyVolume: Number(msg.daily_volume ?? prev?.dailyVolume ?? 0),
              weeklyVolume: Number(msg.weekly_volume ?? prev?.weeklyVolume ?? 0),
              monthlyVolume: Number(msg.monthly_volume ?? prev?.monthlyVolume ?? 0),
              totalVolume: Number(msg.total_volume ?? prev?.totalVolume ?? 0),
              dailyTrades: Number(msg.daily_trades_count ?? prev?.dailyTrades ?? 0),
              weeklyTrades: Number(msg.weekly_trades_count ?? prev?.weeklyTrades ?? 0),
              monthlyTrades: Number(msg.monthly_trades_count ?? prev?.monthlyTrades ?? 0),
              totalTrades: Number(msg.total_trades_count ?? prev?.totalTrades ?? 0),
              collateral: prev?.collateral,
              portfolioValue: prev?.portfolioValue,
              leverage: prev?.leverage,
              availableBalance: prev?.availableBalance,
              marginUsage: prev?.marginUsage,
              buyingPower: prev?.buyingPower,
            }));
          }
          if (type.includes("user_stats")) {
            const s = (msg.stats || {}) as Record<string, unknown>;
            setStats((prev) => ({
              dailyVolume: prev?.dailyVolume ?? 0,
              weeklyVolume: prev?.weeklyVolume ?? 0,
              monthlyVolume: prev?.monthlyVolume ?? 0,
              totalVolume: prev?.totalVolume ?? 0,
              dailyTrades: prev?.dailyTrades ?? 0,
              weeklyTrades: prev?.weeklyTrades ?? 0,
              monthlyTrades: prev?.monthlyTrades ?? 0,
              totalTrades: prev?.totalTrades ?? 0,
              ...prev,
              collateral: Number(s.collateral ?? prev?.collateral ?? 0),
              portfolioValue: Number(s.portfolio_value ?? prev?.portfolioValue ?? 0),
              leverage: Number(s.leverage ?? prev?.leverage ?? 0),
              availableBalance: Number(s.available_balance ?? prev?.availableBalance ?? 0),
              marginUsage: Number(s.margin_usage ?? prev?.marginUsage ?? 0),
              buyingPower: Number(s.buying_power ?? prev?.buyingPower ?? 0),
            }));
          }
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        setLive(false);
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

  const shown = resolveLiveStatus(live ? "live" : "connecting", Boolean(stats));

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("account.vol24")}
        value={compactUsd(stats?.dailyVolume ?? 0)}
        hint={shown === "live" ? t("account.liveHint") : t("account.connectingHint")}
      />
      <StatCard
        label={t("account.vol7")}
        value={compactUsd(stats?.weeklyVolume ?? 0)}
        hint={t("account.tradesCount", { count: compactNum(stats?.weeklyTrades ?? 0, 0) })}
      />
      <StatCard
        label={t("account.volAll")}
        value={compactUsd(stats?.totalVolume ?? 0)}
        hint={t("account.tradesCount", { count: compactNum(stats?.totalTrades ?? 0, 0) })}
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
