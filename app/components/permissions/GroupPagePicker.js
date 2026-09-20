'use client';

import { useState } from 'react';
import ItemLabel from './ItemInfo';

// Searchable list for the wizard's "pages / features" step (PermissionRowWizard.js).
// Pages and features are listed together under two headings. Each row: the item's label
// (a link opening the real page in a new tab, for pages) + an info icon, an "already
// in row X" badge when the item also sits in another row (allowed — it's highlighted and
// the real access is the union of its rows), and an explicit "+ הוסף" button — the label
// is a link, so clicking it must NOT add (it opens the page); adding is the button (or a
// click on the empty part of the row). There used to be an inline iframe preview
// (eye button) here; it rendered a blank white window, so it was removed — the label link
// opens the real page instead.
const SECTIONS = [
  { group: 'pages', title: 'עמודים' },
  { group: 'features', title: 'פיצ\'רים' },
];

export default function GroupPagePicker({ items, onAdd }) {
  const [query, setQuery] = useState('');

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
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          title={`הוסף לשורה: ${item.label}`}
          aria-label={`הוסף לשורה: ${item.label}`}
          onClick={(e) => { e.stopPropagation(); onAdd(item.key); }}
        >
          <svg className="icon"><use href="#i-plus" /></svg>הוסף
        </button>
      </div>
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
