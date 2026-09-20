'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// Shared display of one PERMISSION_CATALOG item on /admin/permissions:
//   <ItemLabel item={item} />  the label — a real link opening the page in a NEW TAB
//                              when the item has a `route` (pages), plain text for
//                              features — followed by an info icon.
//   <ItemInfoButton item={item} />  just the icon: click opens a small explanation card
//                              (what it is, whether it's enforced today, what governs it now).
// The card is portalled to <body> and fixed-positioned so a scrolling modal/table can't
// clip it; it closes on outside click, Escape, or any scroll.

export function ItemInfoButton({ item }) {
  const [pos, setPos] = useState(null); // null = closed
  const btnRef = useRef(null);

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || e.target.closest?.('[data-item-info-card]')) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const rect = btnRef.current.getBoundingClientRect();
    const width = 300;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    setPos({ top: rect.bottom + 6, left, width });
  };

  if (!item) return null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="מידע והסבר"
        aria-label={`מידע והסבר: ${item.label}`}
        aria-expanded={!!pos}
        style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: 'var(--info)', verticalAlign: 'middle' }}
      >
        <svg className="icon" style={{ width: '14px', height: '14px' }}><use href="#i-info" /></svg>
      </button>
      {pos && createPortal(
        <div
          data-item-info-card
          role="dialog"
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 1300,
            background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', boxShadow: '0 10px 30px rgba(0,0,0,.18)', padding: '12px 14px',
            fontSize: '12.5px', lineHeight: 1.65, textAlign: 'start',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '4px' }}>{item.label}</div>
          {item.description && <div style={{ color: 'var(--text-2)', marginBottom: '8px' }}>{item.description}</div>}
          <div style={{ marginBottom: item.userNote || item.route ? '6px' : 0 }}>
            {item.enforced
              ? <span className="badge badge-success">פעיל — שינוי כאן משפיע מיד</span>
              : <span className="badge badge-warning">לתיעוד בלבד — לא משנה את הגישה בפועל</span>}
          </div>
          {item.userNote && <div style={{ color: 'var(--text-3)' }}>{item.userNote}</div>}
          {item.route && (
            <a
              href={item.route}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', color: 'var(--primary)', fontWeight: 600 }}
            >
              <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-external-link" /></svg>
              פתיחת העמוד בטאב חדש
            </a>
          )}
        </div>,
        document.body
      )}
    </>
  );
}

export default function ItemLabel({ item, fallbackKey, style }) {
  if (!item) return <span style={style}>{fallbackKey || ''}</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', ...style }}>
      {item.route ? (
        <a
          href={item.route}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          title="פתיחת העמוד בטאב חדש"
          style={{ color: 'inherit', textDecoration: 'none' }}
          onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
          onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
        >
          {item.label}
        </a>
      ) : (
        <span>{item.label}</span>
      )}
      <ItemInfoButton item={item} />
    </span>
  );
}
