import { getRequestIP, setResponseHeader, type H3Event } from "h3";

const MAX_REQUESTS = 10;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_TRACKED_KEYS = 10_000;

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

function pruneBuckets(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }

  if (buckets.size < MAX_TRACKED_KEYS) return;

  const oldestKey = buckets.keys().next().value;
  if (oldestKey) buckets.delete(oldestKey);
}

function setRateLimitHeaders(event: H3Event, remaining: number, resetAt: number) {
  setResponseHeader(event, "x-ratelimit-limit", String(MAX_REQUESTS));
  setResponseHeader(
    event,
    "x-ratelimit-remaining",
    String(Math.max(0, remaining)),
  );
  setResponseHeader(
    event,
    "x-ratelimit-reset",
    String(Math.ceil(resetAt / 1000)),
  );
}

export function enforcePublicRateLimit(event: H3Event, scope: string): void {
  const ip = getRequestIP(event, { xForwardedFor: true });
  if (!ip) {
    throw createError({
      statusCode: 503,
      statusMessage: "Rate limit unavailable",
    });
  }

  const now = Date.now();
  pruneBuckets(now);

  const key = `${scope}:${ip}`;
  const current = buckets.get(key);
  const bucket =
    current && current.resetAt > now
      ? current
      : { count: 0, resetAt: now + WINDOW_MS };

  if (bucket.count >= MAX_REQUESTS) {
    setRateLimitHeaders(event, 0, bucket.resetAt);
    setResponseHeader(
      event,
      "retry-after",
      String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))),
    );
    throw createError({
      statusCode: 429,
      statusMessage: "Too many requests",
    });
  }

  bucket.count += 1;
  buckets.set(key, bucket);
  setRateLimitHeaders(event, MAX_REQUESTS - bucket.count, bucket.resetAt);
}
