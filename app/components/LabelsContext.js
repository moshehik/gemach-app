'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchSharedJson, subscribe, TTL } from '@/lib/apiCache';

const LabelsContext = createContext();

export function LabelsProvider({ children, initialLabels = {} }) {
  const [labels, setLabels] = useState(initialLabels);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const applyLabels = (data) => { if (alive && data) setLabels(data); };
    // Shared cache: served instantly on repeat navigations, auto-refreshed
    // when labels are saved (mutations to /api/settings invalidate this key).
    const unsubscribe = subscribe('/api/settings/labels', () => {
      fetchSharedJson('/api/settings/labels', { ttl: TTL.STATIC }).then(applyLabels).catch(() => {});
    });
    fetchSharedJson('/api/settings/labels', { ttl: TTL.STATIC })
      .then(applyLabels)
      .catch((err) => console.warn('Failed to fetch UI labels:', err?.message || err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; unsubscribe(); };
  }, []);

  const getLabel = (key, defaultValue) => {
    return labels[key] || defaultValue;
  };

  const updateLabels = (newLabels) => {
    setLabels(newLabels);
  };

  return (
    <LabelsContext.Provider data-element-name="רכיב_LabelsContext_1" value={{ labels, getLabel, updateLabels, loading }}>
      {children}
    </LabelsContext.Provider>
  );
}

export function useLabels() {
  const context = useContext(LabelsContext);
  if (context === undefined) {
    // Return a fallback getLabel function if used outside provider, to prevent crash
    return {
      getLabel: (key, defaultValue) => defaultValue,
      labels: {},
      updateLabels: () => {},
      loading: false
    };
  }
  return context;
}
