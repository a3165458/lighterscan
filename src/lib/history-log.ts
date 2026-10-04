/** Immutable explorer logs: keep the in-process copy hot for a day. */
export const LOG_BY_HASH_TTL_MS = 24 * 60 * 60 * 1000;
/** Serve in-process stale copies across upstream 429/5xx after TTL. */
export const LOG_BY_HASH_STALE_MS = 7 * 24 * 60 * 60 * 1000;
/** Align Next Data Cache with `export const revalidate` on /logs/[hash]. */
export const LOG_BY_HASH_REVALIDATE_SECONDS = 60;
/**
 * ISR pages cannot touch Upstash/KV: REST `set`/`pipeline` uses
 * `cache: "no-store"` and dynamizes `/logs/[hash]` at runtime.
 */
export const LOG_BY_HASH_CACHE = {
  staleMs: LOG_BY_HASH_STALE_MS,
  shared: false,
} as const;

export function explorerStatusFromError(err: unknown): number {
  if (err && typeof err === "object" && "status" in err) {
    const status = Number((err as { status: unknown }).status);
    return Number.isFinite(status) ? status : 0;
  }
  return 0;
}

export function classifyLogLookupError(
  err: unknown,
): "not-found" | "unavailable" {
  return explorerStatusFromError(err) === 404 ? "not-found" : "unavailable";
}

function explorerFailure(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

const EXPLORER_HEADERS = {
  accept: "application/json",
  "user-agent": "LighterScan/0.1 (+robinhood-lighter explorer)",
} as const;

/** Public API producers stay uncached at the fetch layer. */
export function explorerLiveFetchInit(): RequestInit {
  return {
    headers: { ...EXPLORER_HEADERS },
    cache: "no-store",
  };
}

/** ISR pages must use Next Data Cache. `cache: "no-store"` dynamizes the page. */
export function explorerIsrFetchInit(ttlMs: number): RequestInit & {
  next: { revalidate: number };
} {
  return {
    headers: { ...EXPLORER_HEADERS },
    next: { revalidate: Math.max(1, Math.ceil(ttlMs / 1000)) },
  };
}

export function explorerLogFetchInit(): RequestInit & {
  next: { revalidate: number };
} {
  return explorerIsrFetchInit(LOG_BY_HASH_REVALIDATE_SECONDS * 1000);
}

export async function readExplorerLogResponse(
  res: Response,
): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (res.status === 404) {
    throw explorerFailure("log not found", 404);
  }
  if (!res.ok) {
    throw explorerFailure(
      text.slice(0, 180) || `explorer ${res.status}`,
      res.status,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw explorerFailure("invalid explorer log payload", 502);
  }
}
