import { getSharedKv } from "./shared-kv.ts";

type Entry<T> = {
  value: T;
  exp: number;
  staleExp: number;
  inflight?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();
const REDIS_PREFIX = "lighterscan:cache:v1:";

export function memoryCacheSize(): number {
  return store.size;
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
  staleMs = 10 * 60_000,
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as Entry<T> | undefined;
  if (existing && existing.exp > now) return existing.value;
  if (existing?.inflight) return existing.inflight;

  const inflight = (async () => {
    const shared = await readSharedCache<T>(key);
    if (shared !== undefined) return remember(key, shared, ttlMs, staleMs);
    try {
      const value = await fn();
      void writeSharedCache(key, value, ttlMs);
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
