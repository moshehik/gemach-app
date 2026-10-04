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
import { buildMineModel, buildWhoChips } from '@/lib/myRecentActivityView';
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
   נטענים רק כשצריך (הקלדת & / פתיחת /?recent=mine), עם מטמון קצר ברמת המודול לכל עובדת (חלונית התפריט וחלונית הבית חולקות אותו) ורענון בכל פתיחה אחרי 20 שניות.
   state: idle | loading | ok | error | denied (403: אין page:orders - ואז & היא סתם טקסט). נתונים ישנים נשארים מוצגים בזמן רענון.
   הנהלה (MY-04 ב): people = רשימת העובדות לבורר (GET .../employees; 403 = אין הרשאה, נזכר עד רענון הדף), who = העובדת הנבחרת (null = שלי).
   who נטען מהכתובת (/?recent=mine&emp=<id>) ומוחזק בהוק של הדף; אם השרת מסרב לה (403) חוזרים בשקט לרשימה של עצמה. */
const MINE_TTL_MS = 20000;
const PEOPLE_IDLE = { state: 'idle', employees: [], meId: null };
let mineCache = new Map(); // מפתח: מזהה העובדת הנבחרת ('' = שלי) -> { at, data }
let minePeople = PEOPLE_IDLE;
let peoplePromise = null;
export function resetMyActivityCache() { mineCache = new Map(); minePeople = PEOPLE_IDLE; peoplePromise = null; }

async function fetchPeople() {
  try {
    const res = await fetch('/api/me/recent-activity/employees', { cache: 'no-store' });
    if (res.status === 401 || res.status === 403) return { state: 'denied', employees: [], meId: null };
    if (!res.ok) throw new Error('status ' + res.status);
    const d = await res.json();
    return { state: 'ok', employees: Array.isArray(d && d.employees) ? d.employees : [], meId: d && typeof d.meId === 'string' ? d.meId : null };
  } catch {
    return { state: 'error', employees: [], meId: null };
  }
}

export function useMyActivity() {
  const [who, setWho] = useState(null);
  const key = who || '';
  const [s, setS] = useState({ key: '', state: 'idle', data: null });
  const [people, setPeople] = useState(minePeople);
  const seq = useRef(0);
  const cached = mineCache.get(key);
  const cur = s.key === key ? s : cached ? { key, state: 'ok', data: cached.data } : { key, state: 'idle', data: null };
  const run = useCallback(async (force) => {
    const k = who || '';
    const c = mineCache.get(k);
    if (!force && c && Date.now() - c.at < MINE_TTL_MS) { setS({ key: k, state: 'ok', data: c.data }); return; }
    const my = ++seq.current;
    setS((p) => { const keep = p.key === k && p.data; return { key: k, state: keep && !force ? 'ok' : 'loading', data: keep ? p.data : null }; });
    try {
      const res = await fetch('/api/me/recent-activity' + (who ? '?employeeId=' + encodeURIComponent(who) : ''), { cache: 'no-store' });
      if (res.status === 403) {
        if (my !== seq.current) return;
        if (who) setWho(null); else setS({ key: k, state: 'denied', data: null });
        return;
      }
      if (!res.ok) throw new Error('status ' + res.status);
      const d = await res.json();
      if (!d || d.degraded) throw new Error('degraded');
      mineCache.set(k, { at: Date.now(), data: d });
      if (my === seq.current) setS({ key: k, state: 'ok', data: d });
    } catch {
      if (my === seq.current) setS({ key: k, state: 'error', data: null });
    }
  }, [who]);
  const loadPeople = useCallback(async () => {
    if (minePeople.state === 'idle' || minePeople.state === 'error') {
      if (!peoplePromise) peoplePromise = fetchPeople().then((p) => { minePeople = p; peoplePromise = null; return p; });
      await peoplePromise;
    } else if (peoplePromise) await peoplePromise;
    setPeople(minePeople);
  }, []);
  const load = useCallback(() => { loadPeople(); return run(false); }, [run, loadPeople]);
  const reload = useCallback(() => run(true), [run]);
  const { chips, whoName } = useMemo(() => buildWhoChips({ people, who }), [people, who]);
  return useMemo(() => ({ state: cur.state, data: cur.data, load, reload, who, setWho, chips, whoName }), [cur.state, cur.data, load, reload, who, chips, whoName]);
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
  const whoName = mine ? mine.whoName : '';
  const whoId = mine ? mine.who : null;
  const model = useMemo(() => (src ? src.buildModel({ state: mineState, data: mineData, term, whoName, whoId }) : null), [src, mineState, mineData, term, whoName, whoId]);
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
  return { open, items, act, term, rows, def: hit ? hit.def : null, model, mineModel: model, mine, listId, pick, onKeyDown, onFocus, onBlur, inputProps };
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

/** שבבי בחירת העובדת (הנהלה בלבד; chips ריק = לא מוצג). onMouseDown במקום onClick: שדה החיפוש שומר על המיקוד בזמן הבחירה. */
export function MineWho({ chips, setWho, className = 'mine-who' }) {
  if (!chips || !chips.length) return null;
  return (
    <div className={className} role="group" aria-label="רשימות של עובדת">
      {chips.map((c) => (
        <button key={c.id || 'me'} type="button" className={`chip btnlike ${c.on ? 'gold' : 'gray'}`} aria-pressed={c.on} onMouseDown={(e) => { e.preventDefault(); setWho(c.id); }} onClick={(e) => { if (e.detail === 0) setWho(c.id); }}>{c.name}</button>
      ))}
    </div>
  );
}

/** כותרת החלונית של "השינויים שלי": בורר עובדת להנהלה (מימין) וכפתור "הכל" בצד שמאל, שפותח את הרשימות כתוצאות חיפוש (MY-01 / MY-04). */
export function MineHeader({ chips, setWho, more, act, onAll, listId, idx }) {
  if (!more && !(chips && chips.length)) return null;
  return (
    <li className="mine-head" role="presentation">
      <MineWho chips={chips} setWho={setWho} />
      {more && (
        <button
          type="button"
          id={`${listId}-o${idx}`}
          role="option"
          aria-selected={act}
          className={`btn sm mine-all${act ? ' act' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); onAll(more); }}
        >{more.title}<QIc id="arrl" /></button>
      )}
    </li>
  );
}

function MineList({ qp }) {
  const m = qp.mineModel;
  if (!m) return null;
  const mine = qp.mine;
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
      <MineHeader chips={mine ? mine.chips : []} setWho={mine ? mine.setWho : () => {}} more={m.state === 'ok' ? m.more : null} act={m.more ? qp.act === m.items.length - 1 : false} onAll={qp.pick} listId={qp.listId} idx={m.items.length - 1} />
      {m.state === 'loading' && <li className="advo none" role="status">{m.none}</li>}
      {m.state === 'error' && <li className="advo none" role="alert">{m.none}<small>{m.sub}</small></li>}
      {m.state === 'error' && m.items.map(row)}
      {m.state !== 'loading' && m.state !== 'error' && m.sections.map((s) => (
        <Fragment key={s.key}>
          <li className="advo-h" role="presentation">{s.head}<b>{s.count}</b></li>
          {s.rows.map(row)}
        </Fragment>
      ))}
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
  mine: { buildModel: ({ state, data, term, whoName, whoId }) => buildMineModel({ state, data }, { term, whoName, whoId }), List: MineList },
};
