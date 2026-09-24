'use client';

import React, { useEffect, useState } from 'react';
// v3: sun/moon נמצאים עכשיו בספריית האיקונים של v3 (IconSpriteV3) - כבר לא lucide.
import { Icon } from '@/app/v3/ui';
import { DESIGN_PREFS_EVENT, pushPrefsToServer } from '../lib/designPrefs';

export default function ThemeToggle({ employeeId, initialTheme, className = '' }) {
  // Starts from the server-rendered cookie value (matches SSR, avoids a hydration
  // mismatch). For GUESTS a mount-only effect below then defers to an explicit
  // mode saved by the /display-settings page in localStorage; for logged-in
  // employees the cookie/DB (synced by DesignPrefsSync) is authoritative —
  // replaying browser-wide localStorage would leak the previous employee's
  // mode on a shared terminal.
  const [theme, setTheme] = useState(initialTheme || 'light');

  useEffect(() => {
    if (employeeId) return; // logged-in: cookie already correct, DB sync below
    try {
      const saved = JSON.parse(localStorage.getItem('gemachDesignPrefs') || '{}');
      if (saved.mode === 'dark' || saved.mode === 'light' || saved.mode === 'contrast') {
        setTheme(saved.mode);
      }
    } catch (e) {}
  }, [employeeId]);

  // Follow whatever DesignPrefsSync / display-settings applies, so the icon
  // doesn't go stale when the mode changes elsewhere.
  useEffect(() => {
    const onApplied = (e) => {
      const mode = e?.detail?.mode;
      if (mode === 'dark' || mode === 'light' || mode === 'contrast') setTheme(mode);
      else if (mode === 'auto') {
        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
      }
    };
    window.addEventListener(DESIGN_PREFS_EVENT, onApplied);
    return () => window.removeEventListener(DESIGN_PREFS_EVENT, onApplied);
  }, []);

  // v3: יש עכשיו שני מופעים (סרגל + מגירת מובייל). מעקב אחרי data-theme שומר את האיקון מסונכרן
  // בין המופעים ובין כל מקור אחר שמשנה את ההעדפה (DesignPrefsSync / display-settings).
  useEffect(() => {
    const el = document.documentElement;
    const mo = new MutationObserver(() => {
      const t = el.getAttribute('data-theme');
      if (t === 'dark' || t === 'light' || t === 'contrast') setTheme((prev) => (prev === t ? prev : t));
    });
    mo.observe(el, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (employeeId) {
      document.cookie = `theme_${employeeId}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [theme, employeeId]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    // Keep the settings page's saved mode in sync, so this button and the
    // /display-settings picker don't fight over data-theme on next navigation.
    try {
      const saved = JSON.parse(localStorage.getItem('gemachDesignPrefs') || '{}');
      localStorage.setItem('gemachDesignPrefs', JSON.stringify({ ...saved, mode: next }));
    } catch (e) {}
    // Per-user persistence: mode is part of the employee's DB prefs too.
    if (employeeId) pushPrefsToServer({ mode: next });
  };

  return (
    <button
      type="button"
      className={`v3-topbar__ib ${className}`.trim()}
      onClick={toggleTheme}
      title={theme === 'light' ? 'עבור למצב כהה' : 'עבור למצב בהיר'}
      aria-label={theme === 'light' ? 'עבור למצב כהה' : 'עבור למצב בהיר'}
    >
      <Icon name={theme === 'light' ? 'moon' : 'sun'} />
    </button>
  );
}
