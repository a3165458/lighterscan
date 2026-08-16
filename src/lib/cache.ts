type Entry<T> = {
  value: T;
  exp: number;
  staleExp: number;
  inflight?: Promise<T>;
};

const store = new Map<string, Entry<unknown>>();

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

  const inflight = fn()
    .then((value) => {
      store.set(key, {
        value,
        exp: Date.now() + ttlMs,
        staleExp: Date.now() + Math.max(ttlMs, staleMs),
      });
      return value;
    })
    .catch((err) => {
      if (existing && existing.value !== undefined && existing.staleExp > Date.now()) {
        store.set(key, {
          value: existing.value,
          exp: Date.now() + Math.min(ttlMs, 8_000),
          staleExp: existing.staleExp,
        });
        return existing.value;
      }
      store.delete(key);
      throw err;
    });

  store.set(key, {
    value: existing?.value as T,
    exp: existing?.exp ?? 0,
    staleExp: existing?.staleExp ?? 0,
    inflight,
  });
  return inflight;
}
