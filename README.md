# LighterScan

Unofficial explorer for **Lighter on Robinhood Chain**. Same job as [litscan.io](https://litscan.io/), pointed at the Robinhood Lighter Domain instead of Lighter Core.

- REST: `https://api.rh.lighter.xyz`
- WebSocket: `wss://api.rh.lighter.xyz/stream`
- Quote: USDG

## Pages

| Route | What it shows |
| --- | --- |
| `/` | 24h volume, trades, OI, hot markets, market table, live tape |
| `/markets/[symbol]` | Price, OI, hourly chart, book, prints |
| `/account/[id]` | Collateral, positions, assets, live volume + fills |
| `/address/[0x…]` | Every RH Lighter account on an L1 wallet |
| `/leaderboard` | Official points ranking (addresses are often redacted by RH) |
| `/tape` | Multi-market public trade stream |

Search from the header (`⌘K`) by market symbol, account index, or `0x` address.

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

RH rate-limits hard. Locally, REST responses stay in memory. In production they also write through to Upstash Redis so every Vercel instance shares the same hot data.

## Production on Vercel

The site can scale on Vercel. The official Lighter API cannot. Deploy it like this:

1. Point the app at Redis. Prefer `REDIS_URL` for a normal TCP Redis. If the server requires `AUTH`, set `REDIS_PASSWORD` as a separate env var (do not commit a `redis://` URL that contains the password). `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` also work. If only `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_*`) are set, the existing Upstash REST client is used.
2. Set `CRON_SECRET`. Vercel Cron will call `/api/cron/warm` every 5 minutes (Pro plan) to refresh overview, liquidations, positions, and hourly volume into Redis.
3. Run the collector as a **long-lived process** somewhere else (`npm run collector`). Serverless cannot hold the public WebSocket. The collector writes the live snapshot that `/liquidations`, `/positions`, `/tape`, and `/trackers` read.
4. Do **not** set `PUBLIC_REALTIME_MODE=direct` in production. That makes every browser open its own official WebSocket.

HTML no longer reads language/theme cookies on the server, so market pages can stay on the CDN. Language and theme still switch in the browser.

## Honest gaps vs litscan.io

Litscan on Lighter Core runs a private indexer (hourly volume reconstruction, PnL ranks, integrator flow). This build uses only public RH endpoints, so it does not invent 7-day trader leaderboards. Account 24h/7d/all volume is aggregated from the same explorer trade history as the fills table (capped at 1,500 fills). The public `account_all` socket overlays official totals when it actually connects.
