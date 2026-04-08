// Simple in-memory cache with TTL for frontend data
const cache = new Map();
const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > item.ttl) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

export function setCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs
  });
}

export function invalidate(key) {
  cache.delete(key);
}

export function invalidateAll() {
  cache.clear();
}
