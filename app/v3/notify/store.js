// מאגר התראות (R20) - מודול טהור, ללא React. נשמר ב-sessionStorage כדי לשרוד ניווט/ריענון.
const QKEY = 'v3.notice.queue';
const SKEY = 'v3.notice.seen';
export const DEFAULT_MS = 15000;
export const SHORT_MS = 4000;
const listeners = new Set();

const hasWin = () => typeof window !== 'undefined';
function read(key, fallback) {
  if (!hasWin()) return fallback;
  try { const v = JSON.parse(window.sessionStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function write(key, val) {
  if (!hasWin()) return;
  try { window.sessionStorage.setItem(key, JSON.stringify(val)); } catch { /* מצב פרטי/מלא */ }
}
function emit() { listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); }

export function readQueue() { return read(QKEY, []); }
function saveQueue(q) { write(QKEY, q); emit(); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

/** dedupeKey ברירת מחדל: סוג+כותרת+טקסט+דלי של 10 שניות (מכסה StrictMode ולחיצה כפולה). */
function makeKey(n) {
  return [n.kind, n.title, n.text, Math.floor(Date.now() / 10000)].join('|');
}

/**
 * enqueueNotice({kind,title,text,href,persistToBell,durationMs,dedupeKey,entity})
 * מחזיר את ה-id, או null אם נבלע ככפילות. בטוח לקריאה ממש לפני router.push.
 */
export function enqueueNotice(input = {}) {
  if (!hasWin()) return null;
  const now = Date.now();
  const kind = ['success', 'info', 'warn', 'error'].includes(input.kind) ? input.kind : 'info';
  const dedupeKey = input.dedupeKey || makeKey({ ...input, kind });
  const seen = read(SKEY, {});
  for (const k of Object.keys(seen)) if (now - seen[k] > 60000) delete seen[k];
  const q = readQueue();
  if (seen[dedupeKey] || q.some((x) => x.dedupeKey === dedupeKey)) return null;
  seen[dedupeKey] = now;
  write(SKEY, seen);
  const durationMs = input.durationMs || DEFAULT_MS;
  const n = {
    id: `n_${now}_${Math.random().toString(36).slice(2, 7)}`,
    dedupeKey, kind,
    title: String(input.title || ''),
    text: input.text ? String(input.text) : '',
    href: input.href || null,
    entity: input.entity || null,
    createdAt: now,
    durationMs,
    expiresAt: now + durationMs,
    remainingMs: null,           // מתמלא בזמן pause
    persist: !!input.persistToBell,
    persisted: false,
  };
  saveQueue([...q, n]);
  return n.id;
}

export function updateNotice(id, patch) {
  saveQueue(readQueue().map((n) => (n.id === id ? { ...n, ...patch } : n)));
}

export function pauseNotice(id) {
  const n = readQueue().find((x) => x.id === id);
  if (!n || n.remainingMs != null) return;
  updateNotice(id, { remainingMs: Math.max(0, n.expiresAt - Date.now()) });
}
export function resumeNotice(id) {
  const n = readQueue().find((x) => x.id === id);
  if (!n || n.remainingMs == null) return;
  updateNotice(id, { expiresAt: Date.now() + n.remainingMs, remainingMs: null });
}

/** שמירה בפעמון: POST כפי שתוכנן (category=activity_note). ראו reports/notify-api-patch.md */
export async function persistNote(n, { beacon = false } = {}) {
  if (!n || !n.persist || n.persisted) return false;
  const content = n.text + (n.href ? `\n↩ ${n.href}` : '');
  const body = JSON.stringify({ category: 'activity_note', title: n.title, content: content || n.title });
  try {
    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const ok = navigator.sendBeacon('/api/notifications', new Blob([body], { type: 'application/json' }));
      if (ok) updateNotice(n.id, { persisted: true });
      return ok;
    }
    const res = await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    if (res.ok) {
      window.dispatchEvent(new CustomEvent('v3:bell-refresh'));
      return true;
    }
  } catch { /* נשאר persisted=false ← ינסה שוב ב-flush */ }
  return false;
}

/** הסרה מהתור (אחרי hide) - קודם שמירה בפעמון. */
export async function dismissNotice(id, opts) {
  const n = readQueue().find((x) => x.id === id);
  if (!n) return;
  saveQueue(readQueue().filter((x) => x.id !== id));   // הסרה מיידית מהתצוגה
  if (n.persist && !n.persisted) await persistNote(n, opts);
}

/** בטעינה: פריטים שפג תוקפם בזמן שהטאב היה סגור - נשמרים ומוסרים. */
export function flushExpired() {
  const now = Date.now();
  readQueue().filter((n) => n.remainingMs == null && n.expiresAt <= now).forEach((n) => dismissNotice(n.id));
}

/** pagehide: כל מה שלא נשמר עדיין - beacon. */
export function flushAllBeacon() {
  readQueue().forEach((n) => { if (n.persist && !n.persisted) persistNote(n, { beacon: true }); });
}
