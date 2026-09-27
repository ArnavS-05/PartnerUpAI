import { ApiError } from './errors';

// Fixed-window in-memory limiter. Good enough to stop a runaway client from
// burning AI credits during a hackathon; swap for Redis/Upstash in production.

const windows = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): void {
  const now = Date.now();
  const entry = windows.get(key);
  if (!entry || now - entry.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    }
    return;
  }
  entry.count++;
  if (entry.count > limit) {
    throw new ApiError(429, 'rate_limited', 'You’re going a little fast — give Partner AI a few seconds and try again.');
  }
}
