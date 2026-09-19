'use client';

import { useState } from 'react';

// Searchable multi-select list for PageGroupModal.js's "attach a page/feature" step.
// Replaces a native <select> so each row can carry an "open the real page" icon and
// a lazy, on-demand scaled preview — a native <option> can't render either. Only
// 'pages' items have a `route` (see lib/permissionsMetadata.js); 'features' items
// render as a plain searchable list with no open/preview icons.
//
// The preview iframe is mounted only while a specific row's preview is toggled open
// (never for the whole list at once — a live page per row would mean loading every
// page in the catalog simultaneously) and renders inline under that row, not in a
// floating overlay, so it stays correctly positioned inside the modal's own
// scrolling container.
export default function GroupPagePicker({ items, onAdd }) {
  const [query, setQuery] = useState('');
  const [previewKey, setPreviewKey] = useState(null);

  const filtered = query.trim()
    ? items.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
      <div style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>
        <input
          className="input"
          style={{ height: '34px' }}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש..."
        />
      </div>
      <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-3)' }}>לא נמצאו תוצאות</div>
        )}
        {filtered.map((item) => (
          <div key={item.key} style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="combobox-option" style={{ borderBottom: 'none' }} onClick={() => onAdd(item.key)}>
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.heldBy && (
                <span className="badge badge-neutral" style={{ fontSize: '10.5px' }} title="הוספה תעביר אותו לשורה הנוכחית">כעת בשורה: {item.heldBy}</span>
              )}
              {item.route && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon-only btn-sm"
                    title="פתיחת העמוד בכרטיסייה חדשה"
                    aria-label="פתיחת העמוד בכרטיסייה חדשה"
                    onClick={(e) => { e.stopPropagation(); window.open(item.route, '_blank', 'noopener'); }}
                  >
                    <svg className="icon"><use href="#i-external-link" /></svg>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon-only btn-sm"
                    title="תצוגה מקדימה"
                    aria-label="תצוגה מקדימה"
                    onClick={(e) => { e.stopPropagation(); setPreviewKey((k) => (k === item.key ? null : item.key)); }}
                  >
                    <svg className="icon"><use href="#i-eye" /></svg>
                  </button>
                </>
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
        ))}
      </div>
    </div>
  );
}
