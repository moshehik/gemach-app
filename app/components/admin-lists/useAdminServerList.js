'use client';

// useAdminServerList - מצב וטעינה של רשימת ניהול בעימוד שרת (הזמנות / לקוחות) על ערכת הרשימות (A5List במצב שרת: total + page + onPage).
// שני נתיבי שרת: הרשימה (עמוד של 50) והספירות של אפשרויות הסינון. שניהם POST JSON (מזהי "חיפוש חכם" ארוכים מדי ל-URL). תשובה ישנה לא דורסת חדשה (seq).
// שינוי חיפוש / סינון / מיון / טווח / חיפוש חכם מחזיר לעמוד 1.
// עלות: הספירות נטענות רק כשחלון "סינון" פתוח (countsOpen, מ-onFilterOpen של הערכה) ובדיבאונס של COUNTS_DEBOUNCE_MS - לא בכל טעינת עמוד / הקשה;
// תשובת שרת 400 / 503 ("צמצמו את הסינון") מוצגת כהודעה בגוף הרשימה במקום "נכשל".
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const SEARCH_DEBOUNCE_MS = 400;
export const COUNTS_DEBOUNCE_MS = 300;
export const EXPORT_PAGE = 500; // שורות לעמוד בייצוא (export:true) - מקסימום השרת
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' });
  if (!res.ok) {
    let message = '';
    try { const j = await res.json(); message = (j && j.error) || ''; } catch { /* גוף לא JSON */ }
    const err = new Error(message || String(res.status));
    err.status = res.status;
    err.userMessage = res.status === 503 || res.status === 400 ? message : '';
    throw err;
  }
  return res.json();
}

/**
 * @param {{endpoint:string, buildQuery:(s:object)=>object, countsKey:(q:object)=>string, defaultSort:{k:string,dir:number}}} cfg
 */
export default function useAdminServerList({ endpoint, buildQuery, countsKey, defaultSort }) {
  const [ui, setUi] = useState({ sel: {}, sort: defaultSort });
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [custom, setCustom] = useState(null); // { from, to } של "טווח מותאם"
  const [aiIds, setAiIds] = useState(null);
  const [data, setData] = useState(null); // { rows, total, notices }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [countsState, setCountsState] = useState({ key: '', data: null });
  const [variant, setVariant] = useState(0);
  const [tick, setTick] = useState(0);
  const [countsOpen, setCountsOpen] = useState(false); // חלון "סינון" פתוח
  const seq = useRef(0);
  const cseq = useRef(0);
  const countsFor = useRef(''); // המפתח האחרון שהספירות שלו נטענו (בלי טעינה חוזרת בפתיחה חוזרת של החלון)
  const timer = useRef(null);

  const query = useMemo(() => buildQuery({ sel: ui.sel, sort: ui.sort, q, page, custom, aiIds }), [buildQuery, ui, q, page, custom, aiIds]);
  const qKey = JSON.stringify(query);

  useEffect(() => {
    const my = ++seq.current;
    setBusy(true); setError('');
    post(endpoint, query)
      .then((d) => {
        if (my !== seq.current) return;
        setData({ rows: Array.isArray(d.data) ? d.data : [], total: Number(d.total) || 0, notices: Array.isArray(d.notices) ? d.notices : [] });
        setVariant(Number(d.variant) || 0);
      })
      .catch((e) => {
        if (my !== seq.current) return;
        setError((e && e.userMessage) || 'טעינת הרשימה נכשלה');
        setData((x) => x || { rows: [], total: 0, notices: [] });
      })
      .finally(() => { if (my === seq.current) setBusy(false); });
  }, [qKey, tick, endpoint]);

  // ספירות: רק כשהחלון פתוח, בדיבאונס; המפתח כולל את הווריאנט ואת ה-tick. ספירות של מפתח אחר (מסנן שהשתנה כשהחלון סגור) לא מוצגות.
  const cKey = `${countsKey(query)}|${variant}|${tick}`;
  useEffect(() => {
    if (!countsOpen || countsFor.current === cKey) return undefined;
    const my = ++cseq.current;
    const t = setTimeout(() => {
      post(`${endpoint}/counts`, { ...query, variant })
        .then((d) => { if (my === cseq.current) { countsFor.current = cKey; setCountsState({ key: cKey, data: d }); } })
        .catch(() => { if (my === cseq.current) setCountsState({ key: cKey, data: null }); });
    }, COUNTS_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [cKey, countsOpen, endpoint]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onQueryChange = useCallback((text) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { setQ(text.trim()); setPage(1); }, SEARCH_DEBOUNCE_MS);
  }, []);
  const uiRef = useRef(ui);
  useEffect(() => { uiRef.current = ui; });
  const onStateChange = useCallback((s) => {
    if (same(uiRef.current.sel, s.sel) && same(uiRef.current.sort, s.sort)) return;
    setUi({ sel: s.sel, sort: s.sort });
    setPage(1);
  }, []);
  useEffect(() => { setPage(1); }, [custom, aiIds]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const onFilterOpen = useCallback((open) => setCountsOpen(!!open), []);

  /** כל השורות של הרשימה הנוכחית (לייצוא): עמודי ייצוא של 500 (export:true, בלי פירוט פריטים) עד max. מחזיר { rows, truncated, total }. */
  const fetchAll = useCallback(async (max) => {
    const rows = [];
    let total = 0;
    for (let p = 1; rows.length < max; p++) {
      const d = await post(endpoint, { ...query, page: p, limit: EXPORT_PAGE, export: true });
      total = Number(d.total) || 0;
      rows.push(...(d.data || []));
      if (!d.data || d.data.length < EXPORT_PAGE || rows.length >= total) break;
    }
    return { rows: rows.slice(0, max), truncated: total > max, total };
  }, [endpoint, query]);

  const counts = countsState.key === cKey ? countsState.data : null;
  return { ui, q, page, setPage, custom, setCustom, aiIds, setAiIds, data, busy, error, counts, query, onQueryChange, onStateChange, onFilterOpen, reload, fetchAll };
}

/** חיפוש חכם (smart-search): אוסף את מזהי התוצאות מכל העמודים (עד 10). pick(row) -> מזהה. מחזיר מערך מזהים או זורק עם הודעה. */
export async function smartSearchIds(prompt, pageContext, pick) {
  const call = (extra) => fetch('/api/ai/smart-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, pageContext, ...extra }) });
  const res = await call({});
  const first = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(first.error || 'שגיאה בחיפוש החכם');
  let rows = first.data || [];
  for (let p = 2; p <= Math.min(first.totalPages || 1, 10); p++) {
    const r = await call({ page: p, whereClause: first.whereClause });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) break;
    rows = rows.concat(j.data || []);
  }
  return [...new Set(rows.map(pick).filter(Boolean))];
}
