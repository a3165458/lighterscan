import { getSharedKv } from "./shared-kv.ts";

type Entry<T> = {
  value: T;
  exp: number;
  staleExp: number;
  inflight?: Promise<T>;
};

export type CachedOptions = {
  /** Extra time to serve a previous value if the producer throws. */
  staleMs?: number;
  /**
   * Read/write the shared Redis/KV layer. Default true for no-store API
   * producers. Must be false on ISR/static RSC: the Upstash REST client
   * POSTs `/pipeline` with `cache: "no-store"`, which Next.js treats as
   * opting the whole page into Dynamic (`static → dynamic` 500).
   */
  shared?: boolean;
};

const DEFAULT_STALE_MS = 10 * 60_000;
const store = new Map<string, Entry<unknown>>();
const REDIS_PREFIX = "lighterscan:cache:v1:";

export function memoryCacheSize(): number {
  return store.size;
}

export function resolveCachedOptions(
  staleMsOrOptions?: number | CachedOptions,
): { staleMs: number; shared: boolean } {
  if (typeof staleMsOrOptions === "number") {
    return { staleMs: staleMsOrOptions, shared: true };
  }
  return {
    staleMs: staleMsOrOptions?.staleMs ?? DEFAULT_STALE_MS,
    shared: staleMsOrOptions?.shared ?? true,
  };
}

async function readSharedCache<T>(key: string): Promise<T | undefined> {
  const kv = getSharedKv();
  if (!kv) return undefined;
  try {
    const value = await kv.get<T>(`${REDIS_PREFIX}${key}`);
    return value === null || value === undefined ? undefined : value;
  } catch {
    return undefined;
  }
}

async function writeSharedCache<T>(
  key: string,
  value: T,
  ttlMs: number,
): Promise<void> {
  const kv = getSharedKv();
  if (!kv) return;
  try {
    await kv.set(`${REDIS_PREFIX}${key}`, value, {
      ex: Math.max(1, Math.ceil(ttlMs / 1000)),
    });
  } catch {
    /* Shared cache is an optimization, not a hard dependency. */
  }
}

function remember<T>(key: string, value: T, ttlMs: number, staleMs: number): T {
  store.set(key, {
    value,
    exp: Date.now() + ttlMs,
    staleExp: Date.now() + Math.max(ttlMs, staleMs),
  });
  return value;
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  staleMsOrOptions?: number | CachedOptions,
): Promise<T> {
  const { staleMs, shared: useShared } = resolveCachedOptions(staleMsOrOptions);
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;
  if (existing && existing.exp > now) return existing.value;
  if (existing?.inflight) return existing.inflight;

  const inflight = (async () => {
    const shared = useShared ? await readSharedCache<T>(key) : undefined;
    if (shared !== undefined) return remember(key, shared, ttlMs, staleMs);
    try {
      const value = await fn();
      if (useShared) void writeSharedCache(key, value, ttlMs);
      return remember(key, value, ttlMs, staleMs);
    } catch (err) {
      if (existing && existing.value !== undefined && existing.staleExp > Date.now()) {
        return remember(
          key,
          existing.value,
          Math.min(ttlMs, 8_000),
          existing.staleExp - Date.now(),
        );
      }
      store.delete(key);
      throw err;
    }
  })();

  store.set(key, {
    value: existing?.value as T,
    exp: existing?.exp ?? 0,
    staleExp: existing?.staleExp ?? 0,
    inflight,
  });
  return inflight;
}
