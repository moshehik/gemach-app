'use client';

// React hooks over lib/apiCache.js — the shared client-side data cache.
// See the header comment in lib/apiCache.js for semantics and migration notes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { TTL, fetchSharedJson, readCache, revalidate, subscribe } from './apiCache';

/**
 * Shared-cache data hook (stale-while-revalidate).
 *
 *   const { data, loading, error, refresh } = useCachedFetch('/api/settings', { ttl: TTL.STATIC });
 *
 * - `data` is served instantly from the shared cache when available and kept
 *   in sync with background revalidations and mutation-driven invalidations.
 * - `loading` is true only when there is no data at all (first ever fetch).
 * - Pass `enabled: false` to skip fetching (e.g. while a param is missing).
 * - `refresh()` forces a network refetch (deduped across consumers).
 */
export function useCachedFetch(url, { ttl = TTL.REFERENCE, enabled = true } = {}) {
  const active = enabled && !!url;
  const [state, setState] = useState(() => ({
    data: active ? readCache(url) : undefined,
    error: null,
  }));

  useEffect(() => {
    if (!active) return undefined;
    let alive = true;

    const syncFromCache = () => {
      if (!alive) return;
      const cached = readCache(url);
      if (cached !== undefined) {
        setState((prev) => (prev.data === cached && !prev.error ? prev : { data: cached, error: null }));
      }
    };

    const unsubscribe = subscribe(url, syncFromCache);
    syncFromCache();
    fetchSharedJson(url, { ttl })
      .then(() => syncFromCache())
      .catch((err) => {
        if (alive) setState((prev) => (prev.data !== undefined ? prev : { ...prev, error: err }));
      });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [url, active, ttl]);

  const refresh = useCallback(() => (url ? revalidate(url) : Promise.resolve(undefined)), [url]);

  return {
    data: state.data,
    error: state.error,
    loading: active && state.data === undefined && !state.error,
    refresh,
  };
}

/**
 * System settings (SystemSetting rows) as a key->value object, shared across
 * every consumer in the session. Invalidated automatically when settings are
 * saved anywhere in the app.
 *
 *   const { settings, getSetting, loading } = useSystemSettings();
 *   const holdMinutes = parseInt(getSetting('inventory_hold_minutes', '15'), 10);
 */
export function useSystemSettings() {
  const { data, loading, error, refresh } = useCachedFetch('/api/settings', { ttl: TTL.STATIC });

  const settings = useMemo(() => {
    if (Array.isArray(data)) {
      return data.reduce((acc, s) => { if (s && s.key) acc[s.key] = s.value; return acc; }, {});
    }
    return data && typeof data === 'object' ? data : {};
  }, [data]);

  const getSetting = useCallback(
    (key, defaultValue) => (settings[key] !== undefined ? settings[key] : defaultValue),
    [settings]
  );

  return {
    settings,
    settingsList: Array.isArray(data) ? data : [],
    getSetting,
    loading,
    error,
    refresh,
  };
}

/** Active employee list, shared session-wide (invalidated on employee edits). */
export function useEmployees({ enabled = true } = {}) {
  const { data, loading, error, refresh } = useCachedFetch('/api/employees', { ttl: TTL.STATIC, enabled });
  return { employees: Array.isArray(data) ? data : [], loading, error, refresh };
}

export { TTL };
