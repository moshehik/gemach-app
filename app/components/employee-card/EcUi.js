'use client';

// EcUi - רכיבים משותפים של כרטיס העובד החדש (גוף מילוי, portal, אינדיקציות): אייקון הפלטה, שורש ה-portal (חלונות / טוסט / טולטיפ
// מוצגים בתוך .gm-ds.gm-ec ולא ב-body, כדי שירשו את ההיקף - תבנית CcPortal / LzPortal), חלון (scrim > .dlg#dlg) עם מלכודת פוקוס,
// והטוסט של הפלטה (#toast.info). אין window.alert / confirm בשום מקום בכרטיס.
import { createContext, useContext, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Ic, decorateButtons } from '../attendance/parts';

export { Ic };

// autofill של דפדפן / מנהלי סיסמאות מנוטרל על שדות הכרטיס (כמו בפרופיל ובעיצוב)
export const NO_FILL = { 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };

export const EcPortalRoot = createContext(null);

export function EcPortal({ children }) {
  const root = useContext(EcPortalRoot);
  return root ? createPortal(children, root) : children;
}

// Escape סוגר, Tab נשאר בתוך החלון, הפוקוס חוזר בסגירה ללחצן שפתח (כמו useDialogKeys של סיכום הנוכחות)
const DIALOG_STACK = [];
export function useDialogKeys(dlgRef, onClose, focusSel = '.btn.primary, .btn, input') {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    // כמה חלונות פתוחים יחד (חלון אימות מנהל מעל חלון המייל): רק העליון מטפל ב-Escape / Tab
    const me = {};
    DIALOG_STACK.push(me);
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => {
      const el = dlgRef.current && dlgRef.current.querySelector(focusSel);
      if (el && !dlgRef.current.contains(document.activeElement)) el.focus();
    }, 60);
    const onKey = (e) => {
      if (DIALOG_STACK[DIALOG_STACK.length - 1] !== me) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (closeRef.current) closeRef.current(); return; }
      if (e.key !== 'Tab' || !dlgRef.current) return;
      const els = [...dlgRef.current.querySelectorAll('button, a[href], input, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (!dlgRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      const at = DIALOG_STACK.indexOf(me);
      if (at >= 0) DIALOG_STACK.splice(at, 1);
      window.removeEventListener('keydown', onKey, true);
      try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ }
    };
  }, [dlgRef, focusSel]);
}

/**
 * חלון כהה של הפלטה: .scrim.on > .dlg#dlg (שכבה 1) או #scrim2 > #dlg2 (שכבה 2, מעל חלון אחר - אימות מנהל מעל חלון המייל).
 * onClose = Escape / לחיצה על הרקע. הסגנון הכהה בא משורש הדף (dlg-dark).
 */
export function Dlg({ layer = 1, labelledBy, className = '', onClose, focusSel, children }) {
  const ref = useRef(null);
  useDialogKeys(ref, onClose, focusSel);
  const id = layer === 2 ? 'dlg2' : 'dlg';
  return (
    <EcPortal>
      <div className="scrim on" id={layer === 2 ? 'scrim2' : 'scrim'} onMouseDown={(e) => { if (e.target === e.currentTarget && onClose) onClose(); }}>
        <div className={`dlg${className ? ` ${className}` : ''}`} id={id} role="dialog" aria-modal="true" aria-labelledby={labelledBy} ref={ref}>
          {children}
        </div>
      </div>
    </EcPortal>
  );
}

// העיגול העליון בחלון (decorate() בעיצוב): אייקון הלחצן הראשי, והנפשת הריחוף לפי הסוג
export function badgeKind(icon) {
  if (icon === 'trash') return 'lid';
  if (icon === 'card') return 'tilt';
  if (icon === 'check') return 'breathe';
  return 'float';
}
export function DlgBadge({ icon = 'info' }) {
  return <div className="dbadge" aria-hidden="true" data-k={badgeKind(icon)}><Ic id={icon} /></div>;
}

/** אישור (customConfirm בישן -> dlgConfirm בעיצוב): כותרת, שורת משנה, "אישור" ו"ביטול" */
export function ConfirmDlg({ title, sub, okLabel = 'אישור', icon = 'check', onYes, onNo }) {
  return (
    <Dlg labelledBy="ec-cf-t" onClose={onNo} focusSel=".btn.primary">
      <DlgBadge icon={icon} />
      <h2 id="ec-cf-t">{title}</h2>
      {sub ? <div className="sub">{sub}</div> : null}
      <div className="dbtns">
        <button type="button" className="btn primary lg block" data-ec="conf-ok" onClick={onYes}><Ic id={icon} />{okLabel}</button>
        <button type="button" className="btn ghost block" data-ec="conf-no" onClick={onNo}><Ic id="x" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}

export const TOAST_MS = 2600;
export const TOAST_ERR_MS = 6500;

/** הטוסט של הפלטה (#toast.info.pulse.on, say() בעיצוב). הודעה ארוכה: big + small */
export function EcToast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div id="toast" className="info on pulse" data-kind="info" role="status" aria-live="polite" key={toast.n} style={{ '--tdur': `${toast.ms || TOAST_MS}ms` }}>
      <button type="button" className="tclose" data-ico="x" aria-label="סגירה" data-tip="סגור" onClick={onClose}><Ic id="x" size="sm" /></button>
      <div className="tb"><Ic id={toast.icon || (toast.kind === 'error' ? 'alert' : 'check')} size="lg" /></div>
      <div><b>{toast.title}</b>{toast.text ? <small>{toast.text}</small> : null}</div>
    </div>
  );
}

// הקשר הכרטיס: say(title, kind, text), confirm(opts)->Promise<boolean>, approve(opts)->Promise<{employeeId,pin}|null>, info(item)
export const EcContext = createContext(null);
export const useEc = () => useContext(EcContext);

// tipify() של העיצוב: decorateButtons (data-ico + טולטיפ מ-aria-label) + הסרת title מלחצנים (הטולטיפ של הפלטה מחליף אותו)
export function decorateEc(root) {
  if (!root) return;
  decorateButtons(root);
  root.querySelectorAll('button[title],[role=button][title]').forEach((b) => {
    if (b.dataset.tip || b.textContent.trim()) b.removeAttribute('title');
  });
}
