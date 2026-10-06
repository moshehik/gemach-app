'use client';

// פעמון ההתראות של המעטפת החדשה: hook (מונה + רשימה) וגוף הפאנל (nf-w, פלטה: באנר 56/58/114, nf-row 105/116/122/164).
// הלוגיקה של הרשת מועתקת מ-NotificationBell.js (// COPIED FROM) ולא משתנה:
//   - מונה "לא נקראו" = הדוגם המשותף (GET /api/poll, lib/pollClient.js) כל 5 דקות, מושהה כשהטאב מוסתר / שנשכח פתוח, וברענון בניווט.
//     כפתור דיווח התקלות משתתף באותה בקשה (בקשה אחת לטאב). אחרי פעולה של המשתמש (סימון/ארכיון) - רענון מיידי (pollAfterAction).
//   - הרשימה המלאה (GET /api/notifications) נטענת רק כשהפעמון נפתח - לא בטעינת הדף (מכסת Neon).
// נוספו (החלטות הבעלים, Q6): "סמן הכל כנקרא" ו"ניקוי" (= ארכיון פר-משתמש, לא מחיקה) דרך { all: true }.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Ic, MenuRow, relativeTime } from './menuParts';
import { usePollSnapshot } from '@/lib/usePoll';
import { pollRefresh, pollAfterAction, NAV_REFRESH_MAX_AGE_MS, OPEN_REFRESH_MAX_AGE_MS } from '@/lib/pollClient';

const SHOW = 5;
const MAX = 20;

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { ok: res.ok && (!data || data.success !== false), data };
}

export function useNotifications({ enabled, employeeId, pathname, isOpen, onError }) {
  const [list, setList] = useState(null); // null = הרשימה המלאה עוד לא נטענה (הפעמון סגור)
  const [pollCount, setPollCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ring, setRing] = useState(false);
  const openRef = useRef(false);
  const prevCount = useRef(null);
  const errRef = useRef(onError);
  useEffect(() => { errRef.current = onError; });

  useEffect(() => { openRef.current = isOpen; }, [isOpen]);

  const loadList = useCallback(() => {
    if (!enabled || !employeeId) return;
    setLoading(true);
    fetch('/api/notifications')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setList(data.notifications || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [enabled, employeeId]);

  // המונה מהדוגם המשותף (מנוי = טיימר אחד לטאב + בקשה אחת גם לכפתור דיווח התקלות; מושהה במוסתר/idle, ר' lib/pollClient.js).
  const snap = usePollSnapshot(!!(enabled && employeeId));
  useEffect(() => {
    const nf = snap.notifications;
    if (!nf.known) return;
    setPollCount(nf.unread);
    if (!openRef.current) setList(null);
  }, [snap.notifications]);

  // רענון המונה בכל ניווט (מונה בלבד; הרשימה נטענת רק בפתיחה). מדלגים אם דגמנו בדקה האחרונה.
  useEffect(() => {
    if (enabled && employeeId) pollRefresh({ maxAgeMs: NAV_REFRESH_MAX_AGE_MS });
  }, [pathname, enabled, employeeId]);

  // פתיחת הפעמון = טעינת הרשימה (לא יותר מפעם בכל פתיחה) + רענון המונה המשותף אם התיישן.
  useEffect(() => {
    if (isOpen) { loadList(); pollRefresh({ maxAgeMs: OPEN_REFRESH_MAX_AGE_MS }); }
  }, [isOpen, loadList]);

  const active = (list || []).filter((n) => !n.isArchived);
  const unread = list ? active.filter((n) => !n.isRead).length : pollCount;

  // צלצול קצר כשהמונה גדל (כמו nf-ring בעיצוב).
  useEffect(() => {
    if (prevCount.current !== null && unread > prevCount.current) {
      setRing(true);
      const t = setTimeout(() => setRing(false), 1000);
      prevCount.current = unread;
      return () => clearTimeout(t);
    }
    prevCount.current = unread;
    return undefined;
  }, [unread]);

  const fail = (msg) => { if (errRef.current) errRef.current(msg); };

  const markOne = useCallback(async (id) => {
    const r = await postJson('/api/notifications/read', { notificationId: id }).catch(() => ({ ok: false }));
    if (!r.ok) return fail('סימון ההתראה כנקראה נכשל');
    setList((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)) : prev));
    setPollCount((c) => Math.max(0, c - 1));
    pollAfterAction();
    return undefined;
  }, []);

  const archiveOne = useCallback(async (id) => {
    const r = await postJson('/api/notifications/archive', { notificationId: id, archive: true }).catch(() => ({ ok: false }));
    if (!r.ok) return fail('הסרת ההתראה נכשלה');
    setList((prev) => (prev ? prev.map((n) => (n.id === id ? { ...n, isArchived: true } : n)) : prev));
    pollAfterAction();
    return undefined;
  }, []);

  const markAll = useCallback(async () => {
    const r = await postJson('/api/notifications/read', { all: true }).catch(() => ({ ok: false }));
    if (!r.ok) return fail('סימון הכל כנקרא נכשל');
    setList((prev) => (prev ? prev.map((n) => ({ ...n, isRead: true })) : prev));
    setPollCount(0);
    pollAfterAction();
    return undefined;
  }, []);

  const clearAll = useCallback(async () => {
    const r = await postJson('/api/notifications/archive', { all: true, archive: true }).catch(() => ({ ok: false }));
    if (!r.ok) return fail('הניקוי נכשל');
    setList((prev) => (prev ? prev.map((n) => ({ ...n, isArchived: true })) : prev));
    setPollCount(0);
    pollAfterAction();
    return undefined;
  }, []);

  return { list, active, unread, loading, ring, markOne, archiveOne, markAll, clearAll };
}

const firstLine = (s, n) => {
  const t = String(s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

function NfRow({ n, onRead, onArchive }) {
  const who = n.sender ? `${n.sender.firstName || ''} ${n.sender.lastName || ''}`.trim() : 'מערכת';
  const hasTitle = n.title && n.title !== 'הודעה חדשה';
  const title = hasTitle ? n.title : firstLine(n.content, 80);
  const sub = hasTitle ? firstLine(n.content, 140) : '';
  const ts = new Date(n.createdAt).getTime();
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRead(n.id); }
    else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onArchive(n.id); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...e.currentTarget.parentElement.querySelectorAll('.nf-row')].filter((r) => r.offsetParent);
      const i = rows.indexOf(e.currentTarget);
      const next = rows[i + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) next.focus();
    }
  };
  return (
    <div
      className={`nf-row${n.isRead ? '' : ' unread'}`}
      role="menuitem"
      tabIndex={-1}
      onClick={() => { if (!n.isRead) onRead(n.id); }}
      onKeyDown={onKey}
    >
      <span className="nf-ic"><Ic n="msg" /></span>
      <div className="nf-b">
        <b>{title}</b>
        {sub ? <small>{sub}</small> : null}
        <small className="nf-t">
          <time dateTime={Number.isFinite(ts) ? new Date(ts).toISOString() : undefined}>{Number.isFinite(ts) ? relativeTime(ts) : ''}</time> · {who}
          {n.receiverId === null ? ' · לכולם' : ''}
        </small>
      </div>
      <div className="nf-a">
        <button
          type="button"
          className="nf-x"
          aria-label="הסרת ההתראה"
          data-tip="הסרה"
          onClick={(e) => { e.stopPropagation(); onArchive(n.id); }}
        >
          <Ic n="x" />
        </button>
      </div>
    </div>
  );
}

/** גוף פאנל ההתראות (משמש גם בפעמון בסרגל וגם באקורדיון במגירת הנייד). */
export default function BellBody({ nf, rows, onNavigate, onAction, activeItemId }) {
  const [showAll, setShowAll] = useState(false);
  const items = nf.active.slice(0, MAX);
  const tot = items.length;
  const un = nf.unread;
  const shown = showAll ? items : items.slice(0, SHOW);
  const cnt = un ? `${un} ${un === 1 ? 'חדשה' : 'חדשות'}` : (tot ? 'הכול נקרא' : '');
  const loadingFirst = nf.loading && nf.list === null;
  return (
    <div className="nf-w">
      <div className="sn-ph"><strong>התראות</strong><span className="nf-cnt">{cnt}</span></div>
      {tot > 0 && (
        <div className="nf-tools">
          <button type="button" data-nf-all disabled={!un} onClick={nf.markAll}>סמן הכל כנקרא</button>
          <button type="button" data-nf-clear onClick={nf.clearAll}>ניקוי</button>
        </div>
      )}
      {tot > 0 && (
        <div className="nf-list" role="group" aria-label="רשימת התראות">
          {shown.map((n) => <NfRow key={n.id} n={n} onRead={nf.markOne} onArchive={nf.archiveOne} />)}
        </div>
      )}
      {tot === 0 && (
        <div className="nf-empty">
          <Ic n="bell" />
          <span>{loadingFirst ? 'טוען…' : 'אין התראות חדשות'}</span>
        </div>
      )}
      {tot > SHOW && (
        <button type="button" className="nf-more" data-nf-more onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'הצג פחות' : `הצג עוד ${tot - SHOW}`}
        </button>
      )}
      {rows && rows.length > 0 && <div className="sn-sep" />}
      {(rows || []).map((it) => (
        <MenuRow key={it.id} item={it} menu active={it.id === activeItemId} onNavigate={onNavigate} onAction={onAction} />
      ))}
    </div>
  );
}
