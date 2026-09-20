'use client';

import { useState } from 'react';
import ItemLabel from './ItemInfo';

// Searchable list for the wizard's "pages / features" step (PermissionRowWizard.js).
// Pages and features are listed together under two headings. Each row: the item's label
// (a link opening the real page in a new tab, for pages) + an info icon, an "already in
// row X" badge when the item also sits in another row (allowed — it's highlighted and the
// real access is the union of its rows), and — for pages — an eye button toggling a lazy,
// on-demand scaled preview inline under that row (never a live iframe per row up front).
const SECTIONS = [
  { group: 'pages', title: 'עמודים' },
  { group: 'features', title: 'פיצ\'רים' },
];

export default function GroupPagePicker({ items, onAdd }) {
  const [query, setQuery] = useState('');
  const [previewKey, setPreviewKey] = useState(null);

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((item) => item.label.toLowerCase().includes(q) || (item.description || '').toLowerCase().includes(q)) : items;

  const renderRow = (item) => (
    <div key={item.key} style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="combobox-option" style={{ borderBottom: 'none' }} onClick={() => onAdd(item.key)}>
        <span style={{ flex: 1, minWidth: 0 }}><ItemLabel item={item} /></span>
        {item.alsoIn && (
          <span className="badge badge-warning" style={{ fontSize: '10.5px' }} title="קיים כבר בשורה אחרת — אפשר להוסיף גם לכאן, הגישה תהיה מותרת אם אחת מהשורות מתירה">
            כבר בשורה: {item.alsoIn.join(', ')}
          </span>
        )}
        {item.route && (
          <button
            type="button"
            className="btn btn-ghost btn-icon-only btn-sm"
            title="תצוגה מקדימה"
            aria-label="תצוגה מקדימה"
            onClick={(e) => { e.stopPropagation(); setPreviewKey((k) => (k === item.key ? null : item.key)); }}
          >
            <svg className="icon"><use href="#i-eye" /></svg>
          </button>
        )}
      </div>
      {previewKey === item.key && item.route && (
        <div style={{ padding: '8px', background: 'var(--surface-alt)' }}>
          <div style={{ width: '320px', height: '200px', overflow: 'hidden', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--surface)' }}>
            <iframe
              src={item.route}
              title={item.label}
              style={{ width: '1280px', height: '800px', border: 'none', transform: 'scale(0.25)', transformOrigin: '0 0' }}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>
        <input
          className="input"
          style={{ height: '34px' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש עמוד או פיצ'ר..."
        />
      </div>
      <div style={{ maxHeight: '260px', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-3)' }}>לא נמצאו תוצאות</div>
        )}
        {SECTIONS.map(({ group, title }) => {
          const rows = filtered.filter((item) => item.group === group);
          if (!rows.length) return null;
          return (
            <div key={group}>
              <div style={{ padding: '6px 12px', fontSize: '11.5px', fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface-alt)', position: 'sticky', top: 0 }}>{title}</div>
              {rows.map(renderRow)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
