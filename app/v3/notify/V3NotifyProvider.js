'use client';
// R20: שורת ההתראה המעוצבת (15ש', פס זהב יורד, עצירה בריחוף/מיקוד, שמירה בפעמון בסיום).
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { enqueueNotice, readQueue, subscribe, dismissNotice, pauseNotice, resumeNotice, flushExpired, flushAllBeacon } from './store';
import './notify.css';

const NotifyCtx = createContext(null);
const MAX_VISIBLE = 3;
const ICONS = { success: '✓', info: 'i', warn: '!', error: '!' };

let cachedRaw = '[]';
let cachedList = [];
function getSnapshot() {   // יציבות רפרנס ל-useSyncExternalStore
  let raw = '[]';
  try { raw = window.sessionStorage.getItem('v3.notice.queue') || '[]'; } catch { /* ignore */ }
  if (raw !== cachedRaw) { cachedRaw = raw; cachedList = readQueue(); }
  return cachedList;
}
const getServerSnapshot = () => [];

export function useV3Notify() {
  const ctx = useContext(NotifyCtx);
  // מחוץ ל-Provider: עדיין עובד (התור משותף ב-sessionStorage); התצוגה תופיע כשה-Provider יעלה.
  return ctx || { notify: enqueueNotice };
}

function NoticeItem({ n, onHref }) {
  const [on, setOn] = useState(false);
  const paused = n.remainingMs != null;
  useEffect(() => { const t = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(t); }, []);
  // טיימר הסגירה - מחושב מ-expiresAt המוחלט, לכן אין "איפוס" בניווט/ריענון.
  useEffect(() => {
    if (paused) return undefined;
    const t = setTimeout(() => dismissNotice(n.id), Math.max(0, n.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [n.id, n.expiresAt, paused]);

  const total = n.durationMs || 15000;
  const left = paused ? n.remainingMs : Math.max(0, n.expiresAt - Date.now());
  const barStyle = { animationDuration: `${total}ms`, animationDelay: `-${Math.max(0, total - left)}ms` };
  const pause = () => pauseNotice(n.id);
  const resume = (e) => { if (e?.currentTarget?.contains?.(e.relatedTarget)) return; resumeNotice(n.id); };
  const role = n.kind === 'error' || n.kind === 'warn' ? 'alert' : 'status';

  return (
    <div
      className={`v3n-item v3n-item--${n.kind}${on ? ' is-on' : ''}${paused ? ' is-paused' : ''}`}
      role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} aria-atomic="true"
      onMouseEnter={pause} onMouseLeave={resume} onFocus={pause} onBlur={resume}
      onKeyDown={(e) => { if (e.key === 'Escape') dismissNotice(n.id); }}
    >
      <span className="v3n-item__icon" aria-hidden="true">{ICONS[n.kind]}</span>
      <div className="v3n-item__body">
        <strong className="v3n-item__title">{n.title}</strong>
        {n.text ? <span className="v3n-item__text">{n.text}</span> : null}
        {n.persist ? <span className="v3n-sr">ההודעה תישמר בפעמון</span> : null}
      </div>
      {n.href ? (
        <button type="button" className="v3n-item__action" aria-label={`פתח: ${n.title}`}
          onClick={() => { onHref(n.href); dismissNotice(n.id); }}>פתח</button>
      ) : null}
      <button type="button" className="v3n-item__close" aria-label="סגור התראה" onClick={() => dismissNotice(n.id)}>×</button>
      <i className="v3n-item__bar" style={barStyle} aria-hidden="true" />
    </div>
  );
}

export function V3NotifyProvider({ children, onNavigate }) {
  const list = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  useEffect(() => {
    flushExpired();
    const onHide = () => { if (document.visibilityState === 'hidden') flushAllBeacon(); };
    window.addEventListener('pagehide', flushAllBeacon);
    document.addEventListener('visibilitychange', onHide);
    return () => { window.removeEventListener('pagehide', flushAllBeacon); document.removeEventListener('visibilitychange', onHide); };
  }, []);

  const go = useCallback((href) => { if (onNavigate) onNavigate(href); else window.location.assign(href); }, [onNavigate]);
  const value = useMemo(() => ({ notify: enqueueNotice }), []);
  const shown = list.slice(-MAX_VISIBLE).reverse();
  const extra = list.length - shown.length;

  return (
    <NotifyCtx.Provider value={value}>
      {children}
      <div id="v3-toast-region" className="v3n-region" role="region" aria-label="התראות מערכת">
        {shown.map((n) => <NoticeItem key={n.id} n={n} onHref={go} />)}
        {extra > 0 ? <div className="v3n-more">+{extra} נוספות</div> : null}
      </div>
    </NotifyCtx.Provider>
  );
}
