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
      style={{
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-main)',
        padding: '0',
        transition: 'color 0.3s ease, transform 0.2s ease',
        opacity: 0.85
      }}
      className="icon-nav-link"
      onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.color = 'var(--primary-color)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseOut={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.color = 'var(--text-main)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      {theme === 'light' ? <Moon data-element-name="רכיב_ThemeToggle_2" size={22} /> : <Sun data-element-name="רכיב_ThemeToggle_3" size={22} />}
    </button>
  );
}
