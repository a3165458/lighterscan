/** Snapshot publish cadence. Keep inside 10–20s to cut Redis SETs. */
export const COLLECTOR_PUBLISH_MS = 15_000;

/** Persist the cumulative tracker ledger less often than the snapshot. */
export const COLLECTOR_LEDGER_FLUSH_MS = 30_000;

/** Idle heartbeat write so health checks still see a recent snapshot. */
export const COLLECTOR_HEARTBEAT_MS = 60_000;
