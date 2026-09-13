import { NextRequest } from "next/server";
import { AppError, hashForLog } from "@/lib/core";
import { db } from "@/lib/db";

type RateLimit = {
  limit: number;
  windowSeconds: number;
  message?: string;
};

let rateLimitTableReady: Promise<void> | undefined;

function ensureRateLimitTable() {
  if (!rateLimitTableReady) {
    const sql = db();
    rateLimitTableReady = sql.unsafe(`
      CREATE TABLE IF NOT EXISTS rate_limit_buckets (
        scope TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        hits INTEGER NOT NULL CHECK (hits >= 0),
        resets_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (scope, key_hash)
      );
      CREATE INDEX IF NOT EXISTS rate_limit_buckets_resets_at_index
        ON rate_limit_buckets (resets_at);
      ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;
    `).then(() => undefined).catch((error) => {
      rateLimitTableReady = undefined;
      throw error;
    });
  }
  return rateLimitTableReady;
}

export function requestFingerprint(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  return forwarded.split(",")[0].trim().slice(0, 120) || "unknown";
}

export async function enforceRateLimit(scope: string, key: string, options: RateLimit) {
  await ensureRateLimitTable();
  const keyHash = hashForLog(scope + ":" + key);
  const rows = await db().unsafe(
    "INSERT INTO rate_limit_buckets (scope, key_hash, hits, resets_at) VALUES ($1, $2, 1, NOW() + ($3 * INTERVAL '1 second')) ON CONFLICT (scope, key_hash) DO UPDATE SET hits = CASE WHEN rate_limit_buckets.resets_at <= NOW() THEN 1 ELSE rate_limit_buckets.hits + 1 END, resets_at = CASE WHEN rate_limit_buckets.resets_at <= NOW() THEN EXCLUDED.resets_at ELSE rate_limit_buckets.resets_at END RETURNING hits",
    [scope, keyHash, options.windowSeconds]
  );
  if (Number(rows[0]?.hits || 0) > options.limit) {
    throw new AppError(options.message || "Too many requests. Please wait and try again.", 429);
  }
}
