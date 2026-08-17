import { Redis } from "@upstash/redis";
import { createClient } from "redis";

export type SharedCacheBackend = "tcp" | "upstash" | "none";

export type SharedKv = {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, options?: { ex?: number }): Promise<void>;
};

export type TcpRedisOptions = {
  url?: string;
  socket?: { host: string; port: number };
  password?: string;
};

type EnvMap = Record<string, string | undefined>;

function readEnv(env: EnvMap, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

/** REDIS_URL / REDIS_HOST win so a self-hosted box can replace Upstash REST. */
export function resolveSharedCacheBackend(
  env: EnvMap = process.env,
): SharedCacheBackend {
  if (readEnv(env, "REDIS_URL") || readEnv(env, "REDIS_HOST")) return "tcp";
  const url =
    readEnv(env, "UPSTASH_REDIS_REST_URL") ?? readEnv(env, "KV_REST_API_URL");
  const token =
    readEnv(env, "UPSTASH_REDIS_REST_TOKEN") ??
    readEnv(env, "KV_REST_API_TOKEN");
  if (url && token) return "upstash";
  return "none";
}

export function resolveTcpRedisOptions(
  env: EnvMap = process.env,
): TcpRedisOptions | null {
  const password = readEnv(env, "REDIS_PASSWORD");
  const url = readEnv(env, "REDIS_URL");
  if (url) {
    return password ? { url, password } : { url };
  }
  const host = readEnv(env, "REDIS_HOST");
  if (!host) return null;
  const parsedPort = Number(env.REDIS_PORT ?? 6379);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 6379;
  return password
    ? { socket: { host, port }, password }
    : { socket: { host, port } };
}

function createTcpKv(options: TcpRedisOptions): SharedKv {
  const client = createClient(options);
  client.on("error", () => {
    /* Call sites soft-fail; an unhandled error event would crash the process. */
  });
  const ready = client.connect();
  return {
    async get<T>(key: string): Promise<T | null> {
      await ready;
      const raw = await client.get(key);
      if (raw == null) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return raw as T;
      }
    },
    async set(key: string, value: unknown, options?: { ex?: number }) {
      await ready;
      const raw = JSON.stringify(value);
      if (options?.ex) {
        await client.set(key, raw, { EX: options.ex });
        return;
      }
      await client.set(key, raw);
    },
  };
}

function createUpstashKv(url: string, token: string): SharedKv {
  const redis = new Redis({ url, token });
  return {
    get: <T>(key: string) => redis.get<T>(key),
    async set(key: string, value: unknown, options?: { ex?: number }) {
      if (options?.ex) {
        await redis.set(key, value, { ex: options.ex });
        return;
      }
      await redis.set(key, value);
    },
  };
}

function createSharedKv(env: EnvMap = process.env): SharedKv | null {
  const backend = resolveSharedCacheBackend(env);
  if (backend === "tcp") {
    const options = resolveTcpRedisOptions(env);
    return options ? createTcpKv(options) : null;
  }
  if (backend === "upstash") {
    const url =
      readEnv(env, "UPSTASH_REDIS_REST_URL") ?? readEnv(env, "KV_REST_API_URL");
    const token =
      readEnv(env, "UPSTASH_REDIS_REST_TOKEN") ??
      readEnv(env, "KV_REST_API_TOKEN");
    return url && token ? createUpstashKv(url, token) : null;
  }
  return null;
}

let kv: SharedKv | null | undefined;
let kvOverride: SharedKv | null | undefined;
let upstash: Redis | null | undefined;

export function isSharedCacheConfigured(env: EnvMap = process.env): boolean {
  return resolveSharedCacheBackend(env) !== "none";
}

export function getSharedKv(): SharedKv | null {
  if (kvOverride !== undefined) return kvOverride;
  if (kv !== undefined) return kv;
  kv = createSharedKv();
  return kv;
}

/** Upstash REST client only. Standard Redis uses the local limiter instead. */
export function getSharedRedis(): Redis | null {
  if (resolveSharedCacheBackend() !== "upstash") return null;
  if (upstash !== undefined) return upstash;
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  upstash = url && token ? new Redis({ url, token }) : null;
  return upstash;
}

export function setSharedKvForTests(value: SharedKv | null | undefined): void {
  kvOverride = value;
}

export function resetSharedKvForTests(): void {
  kv = undefined;
  kvOverride = undefined;
  upstash = undefined;
}
