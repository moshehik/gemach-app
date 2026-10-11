'use client';

// A5Ui - מעטפת הדף של מסכי הרשימות החדשים (עובדים, דגמים): שורש הדף של הפלטה (.gm-ds.gm-a5 + .home-bg + .dlg-dark), טוסט,
// טולטיפ, חלון אישור כהה (ConfirmDlg) וחלון כהה כללי (Dlg) - הכול בתוך השורש (portal), כדי לרשת את ההיקף ואת הסגנון הכהה.
// אין window.alert / confirm / prompt בשום מקום: הודעות = טוסט של הפלטה (#toast), אישורים = חלון כהה (#dlg), כמו בעיצוב המאושר
// (shared.js: toast() / openDlg(); dlg-modern.js: decorate() מוסיף את העיגול העליון dbadge לפי אייקון הלחצן הראשי).
//
// שימוש:   <A5Page name="emp">...children...</A5Page>   ובילדים:   const a5 = useA5();  a5.say('...');  await a5.confirm({...})

import './a5-page.css';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HomeSprite } from '../home/HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import { Ic, decorateButtons, useA5Sprite } from './A5Icon';

export const A5PortalRoot = createContext(null);
export const A5Context = createContext(null);

/** הקשר המסך: { say(title, kind?, text?), confirm(opts) -> Promise<boolean>, dialog(render) , portalRoot } */
export const useA5 = () => useContext(A5Context);

function A5Portal({ children }) {
  const root = useContext(A5PortalRoot);
  return root ? createPortal(children, root) : children;
}

/* ---------------------------------- חלונות ---------------------------------- */

// Escape סוגר, Tab נשאר בתוך החלון, הפוקוס חוזר ללחצן שפתח (אותה התנהגות כמו useDialogKeys של כרטיס העובד)
const STACK = [];
function useDialogKeys(ref, onClose, focusSel) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const me = {};
    STACK.push(me);
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => {
      const el = ref.current && ref.current.querySelector(focusSel);
      if (el && !ref.current.contains(document.activeElement)) el.focus();
    }, 60);
    const onKey = (e) => {
      if (STACK[STACK.length - 1] !== me) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (closeRef.current) closeRef.current(); return; }
      if (e.key !== 'Tab' || !ref.current) return;
      const els = [...ref.current.querySelectorAll('button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (!ref.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      const at = STACK.indexOf(me);
      if (at >= 0) STACK.splice(at, 1);
      window.removeEventListener('keydown', onKey, true);
      try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ }
    };
  }, [ref, focusSel]);
}

/** חלון כהה של הפלטה: .scrim.on > .dlg#dlg. onClose = Escape / לחיצה על הרקע. */
export function Dlg({ labelledBy, className = '', onClose, focusSel = '.btn.primary, .btn, input', children }) {
  const ref = useRef(null);
  useDialogKeys(ref, onClose, focusSel);
  return (
    <A5Portal>
      <div className="scrim on" id="scrim" onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
        <div className={`dlg${className ? ` ${className}` : ''}`} id="dlg" role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
          {children}
        </div>
      </div>
    </A5Portal>
  );
}

// העיגול העליון (decorate() ב-dlg-modern.js): אייקון הלחצן הראשי; הנפשה לפי הסוג
export function badgeKind(icon) {
  if (icon === 'trash') return 'lid';
  if (icon === 'card') return 'tilt';
  if (icon === 'check') return 'breathe';
  return 'float';
}
export function DlgBadge({ icon = 'info' }) {
  return <div className="dbadge" aria-hidden="true" data-k={badgeKind(icon)}><Ic id={icon} /></div>;
}

/**
 * חלון אישור כמו בעיצוב המאושר (models.js rowAction): כותרת, שורת משנה, לחצן ראשי גדול (עם אייקון) ולחצן "חזרה".
 * opts = { title, sub, okLabel, icon, cancelLabel }
 */
export function ConfirmDlg({ title, sub, okLabel = 'אישור', icon = 'check', cancelLabel = 'חזרה', onYes, onNo }) {
  return (
    <Dlg labelledBy="a5-cf-t" onClose={onNo} focusSel=".btn.primary">
      <DlgBadge icon={icon} />
      <h2 id="a5-cf-t">{title}</h2>
      {sub ? <div className="sub">{sub}</div> : null}
      <div className="dbtns">
        <button type="button" className="btn primary lg block" data-a5="conf-ok" onClick={onYes}><Ic id={icon} />{okLabel}</button>
        <button type="button" className="btn ghost block" data-a5="conf-no" onClick={onNo}><Ic id="back" size="sm" />{cancelLabel}</button>
      </div>
    </Dlg>
  );
}

/* ----------------------------------- טוסט ----------------------------------- */

export const TOAST_MS = 2800; // shared.js: toastT = setTimeout(..., 2800)
export const TOAST_ERR_MS = 6500;

/** הטוסט של הפלטה (#toast.info.on.pulse): big + small, סגירה בלחיצה (shared.js toast()). */
export function A5Toast({ toast, onClose }) {
  if (!toast) return null;
  const icon = toast.kind === 'ok' ? 'check' : toast.kind === 'warn' || toast.kind === 'error' ? 'alert' : 'info';
  return (
    <div id="toast" className="info on pulse" data-kind={toast.kind || 'info'} role="status" aria-live="polite" key={toast.n} onClick={onClose} style={{ '--tdur': `${toast.ms}ms` }}>
      <button type="button" className="tclose" data-ico="x" aria-label="סגירה" data-tip="סגור" onClick={onClose}><Ic id="x" size="sm" /></button>
      <div className="tb"><Ic id={icon} size="lg" /></div>
      <div><b>{toast.title}</b><small>{toast.text || ''}</small></div>
    </div>
  );
}

/* ------------------------------- שורש הדף ------------------------------- */

/**
 * שורש מסך רשימות. name = מחלקת הדף (gm-emp / gm-mdl...), כמו .gm-ec / .gm-at בשאר המסכים. מחזיר את ההקשר ב-useA5().
 * extra: צמתים שיוצגו בתוך השורש (חלונות שהדף מנהל בעצמו).
 */
export function A5Page({ name = '', children, extra = null }) {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const toastTimer = useRef(null);
  const [portalRoot, setPortalRoot] = useState(null);
  const [toast, setToast] = useState(null);
  const [conf, setConf] = useState(null);
  const setRoot = useCallback((el) => { rootRef.current = el; setPortalRoot(el); }, []);

  useA5Sprite();
  usePageTooltip(rootRef, ttRef, false);

  const say = useCallback((title, kind = 'info', text = '') => {
    const ms = kind === 'error' || kind === 'warn' ? TOAST_ERR_MS : TOAST_MS;
    setToast({ title, text, kind, n: Date.now(), ms });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const confirm = useCallback((opts) => new Promise((resolve) => setConf({ opts, resolve })), []);
  const closeConf = (v) => { const c = conf; setConf(null); if (c) c.resolve(v); };

  // קישוט לחצנים (data-ico + data-tip מ-aria-label) - tipify() של העיצוב; גם בחלונות (הם בתוך השורש)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const run = () => {
      raf = 0;
      decorateButtons(root);
      root.querySelectorAll('button[title],[role=button][title]').forEach((b) => { if (b.dataset.tip || b.textContent.trim()) b.removeAttribute('title'); });
    };
    run();
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(run); });
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const ctx = useMemo(() => ({ say, confirm, portalRoot }), [say, confirm, portalRoot]);
  return (
    <div className={`gm-ds gm-a5${name ? ` ${name}` : ''} home-bg dlg-dark`} ref={setRoot} dir="rtl">
      <HomeSprite />
      <A5PortalRoot.Provider value={portalRoot}>
        <A5Context.Provider value={ctx}>
          {children}
          <A5Toast toast={toast} onClose={() => setToast(null)} />
          {conf ? <ConfirmDlg {...conf.opts} onYes={() => closeConf(true)} onNo={() => closeConf(false)} /> : null}
          {extra}
        </A5Context.Provider>
      </A5PortalRoot.Provider>
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
