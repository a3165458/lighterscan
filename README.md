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
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

RH rate-limits hard. Responses are cached in memory; live tape and account fills come from the public WebSocket.

## Honest gaps vs litscan.io

Litscan on Lighter Core runs a private indexer (hourly volume reconstruction, PnL ranks, integrator flow). This build uses only public RH endpoints, so it does not invent 7-day trader leaderboards. Account 24h/7d/all volume is aggregated from the same explorer trade history as the fills table (capped at 1,500 fills). The public `account_all` socket overlays official totals when it actually connects.
