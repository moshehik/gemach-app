'use client';

import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ employeeId, initialTheme }) {
  const [theme, setTheme] = useState(initialTheme || 'light');

  // When theme state changes, apply it to document and save to cookie
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (employeeId) {
      // Save cookie for 1 year
      document.cookie = `theme_${employeeId}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [theme, employeeId]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <button data-element-name="כפתור_ThemeToggle_1"
      onClick={toggleTheme}
      title={theme === 'light' ? 'עבור למצב כהה' : 'עבור למצב בהיר'}
      className="icon-nav-link"
    >
      {theme === 'light' ? <Moon data-element-name="רכיב_ThemeToggle_2" size={20} /> : <Sun data-element-name="רכיב_ThemeToggle_3" size={20} />}
    </button>
  );
}
