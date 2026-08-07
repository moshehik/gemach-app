'use client';

import React, { useEffect, useState } from 'react';
// The "אריג" icon sprite has no sun/moon glyph (the mockup handles theme via a
// settings page, not a topbar icon) — kept as the only lucide icon in the shell
// since this real toggle predates the sprite and dropping it isn't an option.
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ employeeId, initialTheme }) {
  // Starts from the server-rendered cookie value (matches SSR, avoids a hydration
  // mismatch); a mount-only effect below then defers to an explicit mode saved by
  // the /display-settings page, if any, since that page also owns data-theme.
  const [theme, setTheme] = useState(initialTheme || 'light');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gemachDesignPrefs') || '{}');
      if (saved.mode === 'dark' || saved.mode === 'light' || saved.mode === 'contrast') {
        setTheme(saved.mode);
      }
    } catch (e) {}
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
