'use client';

import React, { useEffect, useState } from 'react';
// The "אריג" icon sprite has no sun/moon glyph (the mockup handles theme via a
// settings page, not a topbar icon) — kept as the only lucide icon in the shell
// since this real toggle predates the sprite and dropping it isn't an option.
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ employeeId, initialTheme }) {
  const [theme, setTheme] = useState(initialTheme || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (employeeId) {
      document.cookie = `theme_${employeeId}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [theme, employeeId]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
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
