'use client';

// פס ההתראות הכחול מתחת לסרגל העליון של המעטפת החדשה (A5) - רכיב "באנר 113 (nb-area)" מהפלטה, כפי שבתצוגת העיצוב
// (תצוגות-עיצוב\סיימתי-לעבוד\דף-הבית.html, בלוק "[S13] nb- notice bar", והחלטה OD-16: "הזמנות שלא הוחזרו" כפס ולא כחלון).
// מי שרוצה להציג התראה בתוך המעטפת קורא ל-useNoticeBar().add({...}); מחוץ למעטפת החדשה ההוק מחזיר null וכל קורא
// נשאר עם ההתנהגות הקיימת שלו (למשל OverdueRemindersWatcher במעטפת הישנה ממשיך להציג את החלון).
// ההתנהגות כמו בעיצוב: עד 3 התראות במקביל, "+N" מכווץ/מרחיב את הערימה, "פרטים נוספים" פותח את השורות, X סוגר.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Ic } from './menuParts';

const MAX_LIVE = 3;
const OUT_MS = 300;

// kind -> [אייקון, role] - כמו KINDS בעיצוב. alert = אדום-זהב מתריע (aria-live assertive), השאר מנומסים.
const KINDS = {
  info: ['info', 'status'],
  warning: ['alert', 'status'],
  success: ['check', 'status'],
  alert: ['bell', 'alert'],
};

const NoticeBarContext = createContext(null);

/** @returns {{add: Function, dismiss: Function, dismissAll: Function} | null} null מחוץ למעטפת החדשה */
export function useNoticeBar() {
  return useContext(NoticeBarContext);
}
export const NoticeBarProvider = NoticeBarContext.Provider;

/**
 * מצב הפס. add({id, kind, title, detail, rows:[{icon, text, href?}], goHref?, goLabel?, onClose?}) - אותו id מחליף את ההתראה הקיימת
 * (ופותח אותה מחדש אם נסגרה), כך שבדיקה שעתית חוזרת לא מכפילה שורות.
 */
export function useNoticeBarState() {
  const [items, setItems] = useState([]); // [{ id, kind, title, detail, rows, goHref, goLabel, out }]
  const timers = useRef(new Map());

  const remove = useCallback((id) => {
    setItems((cur) => cur.filter((n) => n.id !== id));
    timers.current.delete(id);
  }, []);

  const itemsRef = useRef(items);
  itemsRef.current = items; // eslint-disable-line react-hooks/refs
  const dismiss = useCallback((id) => {
    const cur = itemsRef.current.find((n) => n.id === id);
    if (cur && !cur.out && typeof cur.onClose === 'function') cur.onClose(); // למשל: לזכור שנסגרה, כדי שריענון לא יחזיר אותה
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, out: true } : n)));
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => remove(id), OUT_MS));
  }, [remove]);

  const add = useCallback((notice) => {
    if (!notice || !notice.id) return false;
    clearTimeout(timers.current.get(notice.id));
    timers.current.delete(notice.id);
    setItems((cur) => {
      const same = cur.findIndex((n) => n.id === notice.id);
      const entry = { kind: 'info', rows: [], ...notice, out: false };
      if (same !== -1) {
        const next = cur.slice();
        next[same] = entry;
        return next;
      }
      if (cur.filter((n) => !n.out).length >= MAX_LIVE) return cur;
      return [...cur, entry];
    });
    return true;
  }, []);

  const dismissAll = useCallback(() => {
    itemsRef.current.forEach((n) => dismiss(n.id));
  }, [dismiss]);

  useEffect(() => {
    const map = timers.current;
    return () => { map.forEach((t) => clearTimeout(t)); map.clear(); };
  }, []);

  const api = useMemo(() => ({ add, dismiss, dismissAll }), [add, dismiss, dismissAll]);
  return { items, api };
}

function Notice({ n, onDismiss, chip }) {
  const [open, setOpen] = useState(false);
  const [entering, setEntering] = useState(true); // כל התראה נטענת פעם אחת בהוספה - אנימציית הכניסה רצה בטעינה
  const [icon, role] = KINDS[n.kind] || KINDS.info;
  const bodyId = `nb-${n.id}-b`;
  const titleId = `nb-${n.id}-t`;
  useEffect(() => {
    if (!entering) return undefined;
    const t = setTimeout(() => setEntering(false), 450);
    return () => clearTimeout(t);
  }, [entering]);
  const hasBody = (n.rows && n.rows.length > 0) || n.goHref;
  return (
    <div className={`nb-w${entering ? ' in' : ''}${n.out ? ' out' : ''}`} data-nb-id={n.id}>
      <section className={`nb nb-${n.kind}${open ? ' open' : ''}`} role={role} aria-live={role === 'alert' ? 'assertive' : 'polite'} aria-labelledby={titleId}>
        <div className="nb-main">
          <div className="nb-head">
            <span className="nb-ic" aria-hidden="true"><Ic n={icon} /></span>
            <div className="nb-msg"><b id={titleId}>{n.title}</b>{n.detail ? <span>{n.detail}</span> : null}</div>
            <button type="button" className="nb-x" aria-label="סגור" data-tip="סגור" onClick={() => onDismiss(n.id)}><Ic n="x" /></button>
          </div>
          <div className="nb-acts">
            {hasBody ? (
              <button type="button" className="nb-more" aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen(!open)}>
                <span>{open ? 'פחות פרטים' : 'פרטים נוספים'}</span><Ic n="chev" />
              </button>
            ) : null}
            {chip.hidden > 0 ? (
              <button type="button" className="nb-chip" style={{ display: 'inline-flex' }} aria-expanded={chip.all} aria-label={chip.hidden === 1 ? 'התראה נוספת' : 'התראות נוספות'} onClick={chip.toggle}>
                <span>+{chip.hidden}</span><Ic n="chev" />
              </button>
            ) : null}
          </div>
        </div>
        {hasBody ? (
          <div className="nb-bw"><div className="nb-body" id={bodyId}><div className="nb-bi">
            {(n.rows || []).map((r, k) => (r.href ? (
              <Link key={`${k}${r.text}`} className="nb-r" href={r.href} onClick={r.onClick}>
                <i><Ic n={r.icon || 'file'} /></i><span dir="auto">{r.text}</span><Ic n="ext" cls="sm" />
              </Link>
            ) : (
              <div className="nb-r" key={`${k}${r.text}`}><i><Ic n={r.icon || 'file'} /></i><span dir="auto">{r.text}</span></div>
            )))}
            {n.goHref ? <Link className="nb-go" href={n.goHref}>{n.goLabel || 'עבור להזמנה'}</Link> : null}
          </div></div></div>
        ) : null}
      </section>
    </div>
  );
}

export default function NoticeBarArea({ items, api }) {
  const [all, setAll] = useState(true); // true = כל ההתראות פרוסות, false = רק הראשונה (+N)
  const live = items.filter((n) => !n.out);
  const multi = live.length > 1;
  const col = multi && !all;
  const hidden = live.length - 1;
  const firstLiveId = live.length ? live[0].id : null;

  useEffect(() => {
    if (live.length <= 1 && !all) setAll(true);
  }, [live.length, all]);

  return (
    <div className={`nb-area${multi ? ' multi' : ''}${col ? ' col' : ''}`} id="nbArea" aria-label="התראות">
      {items.map((n) => (
        <Notice
          key={n.id}
          n={n}
          onDismiss={api.dismiss}
          chip={{ hidden: n.id === firstLiveId && multi ? hidden : 0, all, toggle: () => setAll((v) => !v) }}
        />
      ))}
    </div>
  );
}
