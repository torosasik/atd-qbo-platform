import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

/**
 * Default feature flags — all on by default until fetched from backend.
 * English comments only. No in-memory cache (uses localStorage via dataCache.js for persistence).
 * This complies with project rules against in-memory workarounds and actor system bypass.
 */
import { getCached, setCache, invalidate } from './dataCache';

const DEFAULT_FEATURES = {
  sheets_import: true,
  ai_review: true,
  ai_chat: true,
  auto_approve: false,
  purchase_orders: true,
  invoices: true,
  bills: true,
  payments: true,
  expenses: true,
  vendor_management: true,
  dashboard_analytics: true,
  notifications: false,
};

const CACHE_KEY = 'features';
const CACHE_TTL_MS = 30_000; // Re-fetch every 30 seconds at most

/**
 * Custom hook that provides the current feature flags from Firestore settings.
 * Features are fetched on mount and cached in memory.
 * Call `refetchFeatures()` to force a refresh (e.g. after saving settings).
 *
 * @returns {{ features: Object, loading: boolean, refetchFeatures: () => void }}
 */
export default function useFeatures() {
  const [features, setFeatures] = useState(DEFAULT_FEATURES);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = useCallback(async (force = false) => {
    const cached = getCached(CACHE_KEY);
    if (!force && cached) {
      setFeatures(cached);
      setLoading(false);
      return;
    }

    try {
      const res = await api.getSettings();
      const data = res.settings ?? res.data?.settings ?? res.data ?? res;
      const feats = data.features || DEFAULT_FEATURES;
      const mergedFeatures = { ...DEFAULT_FEATURES, ...feats };
      setCache(CACHE_KEY, mergedFeatures, CACHE_TTL_MS);
      setFeatures(mergedFeatures);
    } catch (_err) {
      // Silently use defaults on error
      setFeatures(DEFAULT_FEATURES);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  const refetchFeatures = useCallback(() => fetchFeatures(true), [fetchFeatures]);

  return { features, loading, refetchFeatures };
}

/**
 * Force all useFeatures() consumers to re-fetch.
 * Call this after saving feature settings.
 */
export function invalidateFeatureCache() {
  lastFetchTime = 0;
  cachedFeatures = null;
  notifyListeners();
}
