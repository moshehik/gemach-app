'use client';

// CcUi — ערכת החלונות/הטוסט של כרטיס הלקוח החדש, על רכיבי הפלטה: #scrim/#dlg (שכבה 1), #scrim2/#dlg2 (שכבה 2, מעל: אישור מנהל,
// "לזרוק את המייל?"), #toast. כולם בתוך שורש הכרטיס (CcPortal) ותמיד כהים (dlg-dark על השורש - הבעלים: "בעיצוב הכהה החדש").
// אותו ממשק כמו OcUi של כרטיס ההזמנה (feature/order-card-w1) - עותק מקומי, בלי תלות בענף שלא מוזג.
// הכרטיס החדש לא קורא לעולם ל-window.customConfirm/customAuthPrompt/alert/confirm/prompt - רק ל-useCcUi()
// (נאכף ב-scripts/customer-card-tests/static.test.mjs).
//
//   const ui = useCcUi();
//   await ui.confirm({title, sub, body, okText, cancelText, icon, danger, act})   → true | false
//   await ui.choose({title, sub, body, choices:[{key,text,icon,kind,act}]})      → key | null
//   await ui.alert({title, sub, body, okText})                                     → undefined
//   ui.toast(kind:'info'|'error'|'charge'|'credit', big, small?, action?:{text, icon?, onClick}) ; ui.hideToast()
//   await ui.openDialog(Component, props, {layer:1|2, className, dismissable})     → מה שהרכיב העביר ל-close(result)
// "דגל" החלון (dbadge, העיצוב: DLG-MODERN decorate) נגזר מהאייקון של הלחצן הראשי, כמו בעיצוב.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import CcIcon from './CcIcon';
import CcPortal from './CcPortal';

const CcUiContext = createContext(null);
export const useCcUi = () => useContext(CcUiContext);

export const NO_FILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };
const TOAST_MS = { info: 2600, error: 4500, charge: 6500, credit: 6500 };
let dlgSeq = 0;

// ---------- רכיבי עזר (מבנה החלון של העיצוב: dbadge, h2, .sub, גוף, .dbtns) ----------
// kind של הדגל לפי הפעולה (DLG-MODERN decorate): do-save → write, trash → lid, card → tilt, check → breathe, אחרת float
export function DlgBadge({ icon = 'info', act }) {
  const k = act === 'do-save' ? 'write' : icon === 'trash' ? 'lid' : icon === 'card' ? 'tilt' : icon === 'check' ? 'breathe' : 'float';
  return <div className="dbadge" aria-hidden="true" data-k={k}><CcIcon name={icon} anim={false} /></div>;
}

export function DlgHead({ id = 'cc-dlg-t', title, sub, badge, act }) {
  return (
    <>
      {badge ? <DlgBadge icon={badge} act={act} /> : null}
      <h2 id={id}>{title}</h2>
      {sub ? <div className="sub">{sub}</div> : null}
    </>
  );
}

// kind: primary (btn primary lg block) | plain (btn block) | ghost (btn ghost block) | green (btn green lg block, תשלום)
export function DlgBtn({ kind = 'plain', icon, children, onClick, disabled, autoFocus, act, ...rest }) {
  const cls = kind === 'primary' ? 'btn primary lg block' : kind === 'green' ? 'btn green lg block' : kind === 'ghost' ? 'btn ghost block' : 'btn block';
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} data-autofocus={autoFocus ? 'true' : undefined} data-act={act} {...rest}>
      {icon ? <CcIcon name={icon} size={kind === 'primary' || kind === 'green' ? undefined : 'sm'} /> : null}
      {children}
    </button>
  );
}

export function DlgButtons({ children, className = '' }) {
  return <div className={`dbtns${className ? ` ${className}` : ''}`}>{children}</div>;
}

// ---------- חלונות בסיסיים ----------
function ConfirmDlg({ title, sub, body, okText = 'אישור', cancelText = 'חזרה', icon = 'check', cancelIcon = 'back', act, close }) {
  return (
    <>
      <DlgHead title={title || 'אישור פעולה'} sub={sub} badge={icon} act={act} />
      {body}
      <DlgButtons>
        <DlgBtn kind="primary" icon={icon} autoFocus act={act} onClick={() => close(true)}>{okText}</DlgBtn>
        <DlgBtn kind="ghost" icon={cancelIcon} act="close" onClick={() => close(false)}>{cancelText}</DlgBtn>
      </DlgButtons>
    </>
  );
}

function ChooseDlg({ title, sub, body, choices = [], close }) {
  const first = choices[0] || {};
  return (
    <>
      <DlgHead title={title} sub={sub} badge={first.icon || 'info'} act={first.act} />
      {body}
      <DlgButtons>
        {choices.map((c, i) => (
          <DlgBtn key={c.key} kind={c.kind || (i === 0 ? 'primary' : 'plain')} icon={c.icon} autoFocus={i === 0} act={c.act} onClick={() => close(c.key)}>{c.text}</DlgBtn>
        ))}
      </DlgButtons>
    </>
  );
}

function AlertDlg({ title, sub, body, okText = 'הבנתי', icon = 'info', close }) {
  return (
    <>
      <DlgHead title={title || 'הודעה'} sub={sub} badge={icon} />
      {body}
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" autoFocus onClick={() => close(undefined)}>{okText}</DlgBtn>
      </DlgButtons>
    </>
  );
}

// ---------- ספק ----------
export function CcUiProvider({ children }) {
  const [stack, setStack] = useState([]); // [{id, layer, Component, props, resolve, opts}]
  const [toast, setToast] = useState(null); // {kind, big, small, action, n}
  const [toastOut, setToastOut] = useState(false);
  const toastTimer = useRef(null);
  const outTimer = useRef(null);
  const focusBack = useRef([]);

  const close = useCallback((id, result) => {
    setStack((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) setTimeout(() => it.resolve(result), 0);
      return prev.filter((x) => x.id !== id);
    });
    const back = focusBack.current.pop();
    if (back && typeof back.focus === 'function') setTimeout(() => { try { if (document.contains(back)) back.focus(); } catch { /* noop */ } }, 0);
  }, []);

  const openDialog = useCallback((Component, props = {}, opts = {}) => new Promise((resolve) => {
    if (!Component) { resolve(null); return; }
    const id = ++dlgSeq;
    const layer = opts.layer || Component.ccLayer || 1;
    focusBack.current.push(typeof document !== 'undefined' ? document.activeElement : null);
    setStack((prev) => [...prev, { id, layer, Component, props, resolve, opts }]);
  }), []);

  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToastOut(true);
    clearTimeout(outTimer.current);
    outTimer.current = setTimeout(() => { setToast(null); setToastOut(false); }, 270);
  }, []);

  const showToast = useCallback((kind, big, small, action, ms) => {
    const k = TOAST_MS[kind] ? kind : 'info';
    clearTimeout(toastTimer.current);
    clearTimeout(outTimer.current);
    setToastOut(false);
    const dur = ms || TOAST_MS[k];
    setToast({ kind: k, big, small: small || '', action: action || null, n: Date.now(), dur });
    toastTimer.current = setTimeout(() => hideToast(), dur);
  }, [hideToast]);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(outTimer.current); }, []);

  const ui = useMemo(() => ({
    openDialog,
    confirm: (o = {}) => openDialog(ConfirmDlg, o).then((r) => r === true),
    choose: (o = {}) => openDialog(ChooseDlg, o),
    alert: (o = {}) => openDialog(AlertDlg, o).then(() => undefined),
    toast: showToast,
    hideToast,
  }), [openDialog, showToast, hideToast]);

  // Escape סוגר את החלון העליון (שכבה 2 קודם); Tab נשאר בתוך החלון העליון (כמו בעיצוב)
  useEffect(() => {
    if (!stack.length) return undefined;
    const top = [...stack].sort((a, b) => (a.layer - b.layer) || (a.id - b.id)).pop();
    const onKey = (e) => {
      const box = typeof document !== 'undefined' ? document.getElementById(top.layer === 2 ? 'dlg2' : 'dlg') : null;
      if (e.key === 'Escape') {
        if (top.opts.dismissable === false) return;
        e.stopImmediatePropagation(); e.preventDefault();
        if (typeof top.opts.onEscape === 'function') { top.opts.onEscape(); return; }
        close(top.id, null);
        return;
      }
      if (e.key === 'Tab' && box) {
        const f = [...box.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter((x) => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); } else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [stack, close]);

  // מיקוד ראשוני בחלון שנפתח: [data-autofocus] או הלחצן הראשי
  const lastTopId = useRef(0);
  useEffect(() => {
    if (!stack.length) return undefined;
    const top = [...stack].sort((a, b) => (a.layer - b.layer) || (a.id - b.id)).pop();
    if (top.id === lastTopId.current) return undefined;
    lastTopId.current = top.id;
    const t = setTimeout(() => {
      const box = document.getElementById(top.layer === 2 ? 'dlg2' : 'dlg');
      if (!box) return;
      const el = box.querySelector('[data-autofocus="true"]') || box.querySelector('.btn.primary:not([disabled])') || box.querySelector('button:not([disabled])');
      if (el) el.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [stack]);

  // Escape על טוסט פתוח (בלי חלון) סוגר אותו - כמו בעיצוב
  useEffect(() => {
    if (!toast || stack.length) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') hideToast(); };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [toast, stack.length, hideToast]);

  const layerTop = (layer) => { const l = stack.filter((x) => x.layer === layer); return l.length ? l[l.length - 1] : null; };
  const renderLayer = (layer) => {
    const top = layerTop(layer);
    const sid = layer === 2 ? 'scrim2' : 'scrim';
    const did = layer === 2 ? 'dlg2' : 'dlg';
    return (
      <div
        className={`scrim${top ? ' on' : ''}`}
        id={sid}
        onMouseDown={(e) => {
          if (!top || e.target !== e.currentTarget || top.opts.dismissable === false) return;
          if (typeof top.opts.onEscape === 'function') { top.opts.onEscape(); return; }
          close(top.id, null);
        }}
      >
        <div className={`dlg${top && top.opts.className ? ` ${top.opts.className}` : ''}`} id={did} role="dialog" aria-modal="true" aria-labelledby={top ? (top.opts.labelledBy || 'cc-dlg-t') : undefined}>
          {top ? <top.Component key={top.id} {...top.props} close={(r) => close(top.id, r)} /> : null}
        </div>
      </div>
    );
  };

  const toastIcon = toast ? (toast.kind === 'charge' ? 'plus' : toast.kind === 'credit' ? 'undo' : toast.kind === 'error' ? 'alert' : 'info') : 'info';
  return (
    <CcUiContext.Provider value={ui}>
      {children}
      <CcPortal>
        <div
          id="toast"
          role="status"
          aria-live="polite"
          data-kind={toast ? toast.kind : undefined}
          className={toast ? `${toast.kind}${toastOut ? ' out' : ' on pulse'}` : ''}
          style={toast ? { '--tdur': `${toast.dur}ms` } : undefined}
          key={toast ? toast.n : 'none'}
          onClick={(e) => { if (toast && !(e.target.closest && e.target.closest('.tbtn'))) hideToast(); }}
        >
          {toast ? (
            <>
              <button type="button" className="tclose" data-tip="סגור" aria-label="סגירה" onClick={hideToast}><CcIcon name="x" size="sm" /></button>
              <div className="tb"><CcIcon name={toastIcon} size="lg" anim={false} /></div>
              <div><b>{toast.big}</b><small>{toast.small}</small></div>
              {toast.action ? (
                <button type="button" className="tbtn" data-act="save" onClick={(e) => { e.stopPropagation(); hideToast(); if (toast.action.onClick) toast.action.onClick(); }}>
                  <CcIcon name={toast.action.icon || 'check'} size="sm" />{toast.action.text}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {renderLayer(1)}
        {renderLayer(2)}
      </CcPortal>
    </CcUiContext.Provider>
  );
}
