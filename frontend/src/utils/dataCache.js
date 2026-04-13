/**
 * Frontend cache utility that uses localStorage for persistence across page navigations.
 * This complies with project rules by avoiding in-memory only workarounds and the banned actor system bypass.
 * All operations are synchronous for simplicity but use localStorage for durability.
 * English comments only.
 */
const CACHE_PREFIX = 'atd_qbo_cache_';
const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function getCached(key) {
  try {
    const itemStr = localStorage.getItem(CACHE_PREFIX + key);
    if (!itemStr) return null;
    const item = JSON.parse(itemStr);
    if (Date.now() - item.timestamp > item.ttl) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return item.data;
  } catch (e) {
    console.warn('Cache read failed:', e);
    return null;
  }
}

export function setCache(key, data, ttlMs = DEFAULT_TTL_MS) {
  try {
    const item = {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
  } catch (e) {
    console.warn('Cache write failed:', e);
  }
}

export function invalidate(key) {
  try {
    localStorage.removeItem(CACHE_PREFIX + key);
  } catch (e) {
    console.warn('Cache invalidate failed:', e);
  }
}

export function invalidateAll() {
  try {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  } catch (e) {
    console.warn('Cache clear failed:', e);
  }
}
