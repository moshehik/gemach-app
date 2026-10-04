'use client';

// קידומות חיפוש מהיר בשורת החיפוש ('@' = האחרונים שלי, '&' = השינויים שלי) — רכיב משותף (דף הבית וחיפוש התפריט).
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

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHistory } from '@/lib/historyManager';
import { filterPrefixRows, resolveQuickPrefix, splitMatch } from '@/lib/quickPrefix';
import { buildMineModel } from '@/lib/myRecentActivityView';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
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

/* ---------- "השינויים שלי" ('&'): נתוני GET /api/me/recent-activity ----------
   נטענים רק כשצריך (הקלדת & / פתיחת /?recent=mine), עם מטמון קצר ברמת המודול (חלונית התפריט וחלונית הבית חולקות אותו) ורענון בכל פתיחה אחרי 20 שניות.
   state: idle | loading | ok | error | denied (403: אין page:orders - ואז & היא סתם טקסט). נתונים ישנים נשארים מוצגים בזמן רענון. */
const MINE_TTL_MS = 20000;
let mineCache = { at: 0, data: null };
export function resetMyActivityCache() { mineCache = { at: 0, data: null }; }

export function useMyActivity() {
  const [s, setS] = useState(() => (mineCache.data ? { state: 'ok', data: mineCache.data } : { state: 'idle', data: null }));
  const seq = useRef(0);
  const run = useCallback(async (force) => {
    if (!force && mineCache.data && Date.now() - mineCache.at < MINE_TTL_MS) { setS({ state: 'ok', data: mineCache.data }); return; }
    const my = ++seq.current;
    setS((p) => ({ state: p.data && !force ? 'ok' : 'loading', data: p.data }));
    try {
      const res = await fetch('/api/me/recent-activity', { cache: 'no-store' });
      if (res.status === 403) { if (my === seq.current) setS({ state: 'denied', data: null }); return; }
      if (!res.ok) throw new Error('status ' + res.status);
      const d = await res.json();
      if (!d || d.degraded) throw new Error('degraded');
      mineCache = { at: Date.now(), data: d };
      if (my === seq.current) setS({ state: 'ok', data: d });
    } catch {
      if (my === seq.current) setS({ state: 'error', data: null });
    }
  }, []);
  const load = useCallback(() => run(false), [run]);
  const reload = useCallback(() => run(true), [run]);
  return useMemo(() => ({ state: s.state, data: s.data, load, reload }), [s, load, reload]);
}

export function useQuickPrefix({ q, rows, enabled = true, onPick, listId = 'qp-list', mine = null, prefixes = null }) {
  // prefixes: אילו קידומות פעילות במקום הזה (ברירת מחדל: כולן); אין מקור / אין הרשאה (403): '&' היא סתם טקסט
  const hit = resolveQuickPrefix(q, { enabled, prefixes, mineUsable: !!mine && mine.state !== 'denied' });
  const term = hit ? hit.term : '';
  const src = hit ? PREFIX_SOURCES[hit.def.source] || null : null; // מקור מרוחק מהרישום (PREFIX_SOURCES); null = 'local' (שורות פשוטות שהקורא מעביר)
  const [dismissedFor, setDismissedFor] = useState(null); // הטקסט שעבורו הרשימה נסגרה (Escape / יציאה מהשדה)
  const [actState, setActState] = useState({ q: null, i: -1 });
  const qRef = useRef(q);
  useEffect(() => { qRef.current = q; }, [q]);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);

  const open = !!hit && dismissedFor !== q;
  const mineLoad = mine ? mine.load : null;
  useEffect(() => { if (src && open && mineLoad) mineLoad(); }, [src, open, mineLoad]);
  const mineData = mine ? mine.data : null;
  const mineState = mine ? mine.state : 'idle';
  const model = useMemo(() => (src ? src.buildModel({ state: mineState, data: mineData, term }) : null), [src, mineState, mineData, term]);
  const items = useMemo(() => (src ? model.items : hit ? filterPrefixRows(rows, term) : []), [src, model, hit, rows, term]);
  const act = open && actState.q === q && actState.i < items.length ? actState.i : -1;

  useEffect(() => {
    if (act < 0) return;
    const el = document.getElementById(`${listId}-o${act}`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [act, listId]);

  const mineReload = mine ? mine.reload : null;
  const pick = useCallback((row) => {
    if (!row) return;
    if (row.type === 'retry') { if (mineReload) mineReload(); return; } // "נסי שוב": הרשימה נשארת פתוחה
    setDismissedFor(qRef.current);
    if (onPick) onPick(row);
  }, [onPick, mineReload]);

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
  return { open, items, act, term, rows, def: hit ? hit.def : null, model, mineModel: model, listId, pick, onKeyDown, onFocus, onBlur, inputProps };
}

function Marked({ text, term }) {
  const [a, m, b] = splitMatch(text, term);
  return m ? <>{a}<mark>{m}</mark>{b}</> : a;
}

function QIc({ id }) {
  return <svg className="ic" aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>;
}

// שורת "השינויים שלי" (אותו מראה בחלונית הבית וב"אחרונים" של התפריט): אריח אייקון + שם הלקוחה + "הזמנה #N · מה השתנה · מתי".
export function MineRowBody({ r, term }) {
  return (
    <>
      <span className="sn-li"><QIc id={r.icon} /></span>
      <span className="mine-t">
        <b><Marked text={r.title} term={term} /></b>
        <small>{r.type === 'order' ? <>הזמנה <bdi>#{r.orderNumber}</bdi> · {r.detail}{r.when ? ' · ' + r.when : ''}</> : r.sub}</small>
      </span>
      {r.tail ? <span className="sn-k">{r.tail}</span> : null}
    </>
  );
}

function MineList({ qp }) {
  const m = qp.mineModel;
  if (!m) return null;
  let n = -1;
  const row = (r) => {
    n += 1;
    const i = n;
    return (
      <li
        key={r.key}
        id={`${qp.listId}-o${i}`}
        role="option"
        aria-selected={i === qp.act}
        className={`advo mine-o${r.type === 'all' ? ' mine-more' : ''}${i === qp.act ? ' act' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); qp.pick(r); }}
      ><MineRowBody r={r} term={qp.term} /></li>
    );
  };
  return (
    <ul className="advlist mine-list" id={qp.listId} role="listbox" aria-label={qp.def.listLabel} onMouseDown={(e) => e.preventDefault()}>
      {m.state === 'loading' && <li className="advo none" role="status">{m.none}</li>}
      {m.state === 'error' && <li className="advo none" role="alert">{m.none}<small>{m.sub}</small></li>}
      {m.state === 'error' && m.items.map(row)}
      {m.state !== 'loading' && m.state !== 'error' && m.sections.map((s) => (
        <Fragment key={s.key}>
          <li className="advo-h" role="presentation">{s.head}<b>{s.count}</b></li>
          {s.rows.map(row)}
        </Fragment>
      ))}
      {m.state === 'ok' && m.more && row(m.more)}
      {m.state === 'ok' && m.none && <li className="advo none" role="presentation">{m.none}{m.sub ? <small>{m.sub}</small> : null}</li>}
      <li className="mine-note" role="note"><QIc id="lock" /><span>{m.note}</span></li>
    </ul>
  );
}

export function QuickPrefixList({ qp }) {
  if (!qp || !qp.open || !qp.def) return null;
  const Src = PREFIX_SOURCES[qp.def.source];
  if (Src) return <Src.List qp={qp} />;
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

/* רישום המקורות המרוחקים של הקידומות: source (lib/quickPrefix.js QUICK_PREFIXES) -> { buildModel({ state, data, term }) => { items, ... }, List }.
   buildModel הוא מודל טהור (כמו buildMineModel); List הוא הציור בחלונית הבית. מקור חדש ('#' / '$') = רשומה כאן + שורה ב-QUICK_PREFIXES.
   (נתוני המקור מגיעים היום בפרמטר mine של useQuickPrefix - מקור שני יוסיף פרמטר דומה; ציור הרשימה בחיפוש התפריט ב-MenuSearchPanel.js נשאר מפורש.) */
export const PREFIX_SOURCES = {
  mine: { buildModel: ({ state, data, term }) => buildMineModel({ state, data }, { term }), List: MineList },
};
