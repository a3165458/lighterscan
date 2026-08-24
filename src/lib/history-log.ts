/** Immutable explorer logs: keep Redis/memory hot for a day. */
export const LOG_BY_HASH_TTL_MS = 24 * 60 * 60 * 1000;
/** Serve in-process stale copies across upstream 429/5xx after TTL. */
export const LOG_BY_HASH_STALE_MS = 7 * 24 * 60 * 60 * 1000;
/** Align Next Data Cache with `export const revalidate` on /logs/[hash]. */
export const LOG_BY_HASH_REVALIDATE_SECONDS = 60;

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

export function explorerLogFetchInit(): RequestInit & {
  next: { revalidate: number };
} {
  return {
    headers: {
      accept: "application/json",
      "user-agent": "LighterScan/0.1 (+robinhood-lighter explorer)",
    },
    next: { revalidate: LOG_BY_HASH_REVALIDATE_SECONDS },
  };
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
