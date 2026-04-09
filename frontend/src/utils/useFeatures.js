import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

// Default feature flags — all on by default until fetched from backend
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

// Simple in-memory cache so multiple components don't refetch constantly.
let cachedFeatures = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 30_000; // Re-fetch every 30 seconds at most
const listeners = new Set();

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...cachedFeatures }));
}

/**
 * Custom hook that provides the current feature flags from Firestore settings.
 * Features are fetched on mount and cached in memory.
 * Call `refetchFeatures()` to force a refresh (e.g. after saving settings).
 *
 * @returns {{ features: Object, loading: boolean, refetchFeatures: () => void }}
 */
export default function useFeatures() {
  const [features, setFeatures] = useState(cachedFeatures || DEFAULT_FEATURES);
  const [loading, setLoading] = useState(!cachedFeatures);

  const fetchFeatures = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && cachedFeatures && now - lastFetchTime < CACHE_TTL_MS) {
      setFeatures({ ...cachedFeatures });
      setLoading(false);
      return;
    }

    try {
      const res = await api.getSettings();
      const data = res.settings ?? res.data?.settings ?? res.data ?? res;
      const feats = data.features || DEFAULT_FEATURES;
      cachedFeatures = { ...DEFAULT_FEATURES, ...feats };
      lastFetchTime = Date.now();
      setFeatures({ ...cachedFeatures });
      notifyListeners();
    } catch (_err) {
      // Silently use defaults on error
      if (!cachedFeatures) cachedFeatures = { ...DEFAULT_FEATURES };
      setFeatures({ ...cachedFeatures });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeatures();

    // Listen for updates from other components calling refetchFeatures
    const listener = (newFeats) => setFeatures(newFeats);
    listeners.add(listener);
    return () => listeners.delete(listener);
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
