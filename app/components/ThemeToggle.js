'use client';

import React, { useEffect, useState } from 'react';
// The "אריג" icon sprite has no sun/moon glyph (the mockup handles theme via a
// settings page, not a topbar icon) — kept as the only lucide icon in the shell
// since this real toggle predates the sprite and dropping it isn't an option.
import { Sun, Moon } from 'lucide-react';
import { DESIGN_PREFS_EVENT, pushPrefsToServer } from '../lib/designPrefs';

export default function ThemeToggle({ employeeId, initialTheme }) {
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
      className="icon-btn"
      onClick={toggleTheme}
      title={theme === 'light' ? 'עבור למצב כהה' : 'עבור למצב בהיר'}
    >
      {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  );
}
