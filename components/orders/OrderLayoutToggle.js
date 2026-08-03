'use client';

import { Rows3, LayoutGrid } from 'lucide-react';

const OPTIONS = [
  { id: 'classic', label: 'קלאסי', icon: Rows3, title: 'תצוגה קלאסית — נושא מתחת לנושא' },
  { id: 'workspace', label: 'חלון אחד', icon: LayoutGrid, title: 'תצוגת חלון אחד — כל הנושאים זה לצד זה' }
];

/**
 * לחצן דו-מצבי לקביעת עיצוב כרטיס ההזמנה (קלאסי / חלון אחד).
 */
export default function OrderLayoutToggle({ value, onChange }) {
  const activeIndex = Math.max(0, OPTIONS.findIndex(o => o.id === value));

  return (
    <div
      role="group"
      aria-label="עיצוב כרטיס ההזמנה"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '0.25rem',
        background: '#f1f5f9',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        gap: '0.15rem'
      }}
    >
      {/* גלולה נעה שמסמנת את המצב הפעיל */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '0.25rem',
          bottom: '0.25rem',
          right: `calc(0.25rem + ${activeIndex} * (50% - 0.25rem))`,
          width: 'calc(50% - 0.25rem)',
          background: 'white',
          borderRadius: '9px',
          boxShadow: '0 2px 6px rgba(15, 23, 42, 0.12)',
          transition: 'right 0.28s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      />
      {OPTIONS.map(option => {
        const Icon = option.icon;
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            title={option.title}
            aria-pressed={isActive}
            style={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.85rem',
              background: 'none',
              border: 'none',
              borderRadius: '9px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: isActive ? '700' : '500',
              color: isActive ? '#0f172a' : '#64748b',
              whiteSpace: 'nowrap',
              transition: 'color 0.2s ease'
            }}
          >
            <Icon size={16} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
