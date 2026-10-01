'use client';

// קידומות חיפוש מהיר בשורת החיפוש ('@' = האחרונים שלי) — רכיב משותף (דף הבית היום; חיפוש התפריט בהמשך).
// לוגיקה טהורה: lib/quickPrefix.js (נבדקת ב-scripts/test_home_logic.mjs). התצוגה היא רשימת הפלטה הנגללת
// ul.advlist / li.advo (אותה רשימה כמו הצעות החיפוש המתקדם — design-system/components.css), בלי עיצוב חדש.
//
// שימוש:
//   const rows = useLocalRecentRows();
//   const qp = useQuickPrefix({ q, rows, enabled, onPick: (row) => router.push(row.url) });
//   <input {...qp.inputProps} onKeyDown={qp.onKeyDown} onFocus={qp.onFocus} onBlur={qp.onBlur} />
//   <QuickPrefixList qp={qp} />          // בתוך מיכל עם position:relative, מתחת לשדה
//
// שורה: { key, kind, icon, title, sub?, url } — `kind` הוא סוג הרשומה; סוגים חדשים (חיפוש חכם, טיוטות) נכנסים כשורות עם kind משלהם.
// מקור הנתונים היום: ההיסטוריה המקומית agy_history (lib/historyManager.js) — אותם נתונים שהיו בכרטיס "אחרונים" הישן.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHistory } from '@/lib/historyManager';
import { detectQuickPrefix, filterPrefixRows, splitMatch } from '@/lib/quickPrefix';
import { recentRows } from '../home/homeLogic';

/** שורות "האחרונים שלי" מההיסטוריה המקומית; מתעדכן כשההיסטוריה משתנה (גם מלשונית אחרת). */
export function useLocalRecentRows(enabled = true) {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    const load = () => setRows(recentRows(getHistory()));
    load();
    window.addEventListener('agy_history_updated', load);
    window.addEventListener('storage', load);
    return () => {
      window.removeEventListener('agy_history_updated', load);
      window.removeEventListener('storage', load);
    };
  }, [enabled]);
  return rows;
}

export function useQuickPrefix({ q, rows, enabled = true, onPick, listId = 'qp-list' }) {
  const hit = enabled ? detectQuickPrefix(q) : null;
  const term = hit ? hit.term : '';
  const [dismissedFor, setDismissedFor] = useState(null); // הטקסט שעבורו הרשימה נסגרה (Escape / יציאה מהשדה)
  const [actState, setActState] = useState({ q: null, i: -1 });
  const qRef = useRef(q);
  useEffect(() => { qRef.current = q; }, [q]);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const open = !!hit && dismissedFor !== q;
  const items = useMemo(() => (hit ? filterPrefixRows(rows, term) : []), [hit, rows, term]);
  const act = open && actState.q === q && actState.i < items.length ? actState.i : -1;

  useEffect(() => {
    if (act < 0) return;
    const el = document.getElementById(`${listId}-o${act}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [act, listId]);

  const pick = useCallback((row) => {
    if (!row) return;
    setDismissedFor(qRef.current);
    if (onPick) onPick(row);
  }, [onPick]);

  const onKeyDown = useCallback((e) => {
    if (!open) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!items.length) return;
      const d = e.key === 'ArrowDown' ? 1 : -1;
      setActState({ q, i: act < 0 ? (d > 0 ? 0 : items.length - 1) : (act + d + items.length) % items.length });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setDismissedFor(q);
    } else if (e.key === 'Enter') {
      e.preventDefault(); // לא מריצים חיפוש על טקסט שמתחיל בקידומת
      if (act >= 0) pick(items[act]);
    }
  }, [open, items, act, q, pick]);

  const onFocus = useCallback(() => { clearTimeout(timer.current); setDismissedFor(null); }, []);
  const onBlur = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDismissedFor(qRef.current), 120);
  }, []);

  const inputProps = hit
    ? {
      role: 'combobox',
      'aria-autocomplete': 'list',
      'aria-expanded': open,
      'aria-controls': open ? listId : undefined,
      'aria-activedescendant': open && act >= 0 ? `${listId}-o${act}` : undefined,
    }
    : {};
  return { open, items, act, term, rows, def: hit ? hit.def : null, listId, pick, onKeyDown, onFocus, onBlur, inputProps };
}

function Marked({ text, term }) {
  const [a, m, b] = splitMatch(text, term);
  return m ? <>{a}<mark>{m}</mark>{b}</> : a;
}

export function QuickPrefixList({ qp }) {
  if (!qp || !qp.open || !qp.def) return null;
  return (
    <ul className="advlist" id={qp.listId} role="listbox" aria-label={qp.def.listLabel} onMouseDown={(e) => e.preventDefault()}>
      {qp.items.length === 0 && (
        <li className="advo none" role="presentation">{qp.rows.length === 0 ? qp.def.empty : qp.def.noMatch}</li>
      )}
      {qp.items.map((r, i) => (
        <li
          key={r.key}
          id={`${qp.listId}-o${i}`}
          role="option"
          aria-selected={i === qp.act}
          className={`advo${i === qp.act ? ' act' : ''}`}
          data-kind={r.kind}
          onMouseDown={(e) => { e.preventDefault(); qp.pick(r); }}
        >
          <span className="advo-t"><Marked text={r.title} term={qp.term} /></span>
          <span className="faint" style={{ marginInlineStart: 'auto' }}>{r.kind}{r.sub ? ' · ' + r.sub : ''}</span>
        </li>
      ))}
    </ul>
  );
}
