'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const LabelsContext = createContext();

export function LabelsProvider({ children, initialLabels = {} }) {
  const [labels, setLabels] = useState(initialLabels);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLabels = async () => {
      try {
        const res = await fetch('/api/settings/labels');
        if (res.ok) {
          const data = await res.json();
          setLabels(data || {});
        }
      } catch (err) {
        console.error('Failed to fetch UI labels', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLabels();
  }, []);

  const getLabel = (key, defaultValue) => {
    return labels[key] || defaultValue;
  };

  const updateLabels = (newLabels) => {
    setLabels(newLabels);
  };

  return (
    <LabelsContext.Provider value={{ labels, getLabel, updateLabels, loading }}>
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
