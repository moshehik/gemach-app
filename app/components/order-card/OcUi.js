'use client';

// OcUi — ערכת החלונות/הטוסט/הטולטיפ של כרטיס ההזמנה החדש, על רכיבי הפלטה: #scrim/#dlg (שכבה 1), #scrim2/#dlg2 (שכבה 2, מעל:
// אישור מנהל, "לזרוק?"), #toast, .pl-tt. כולם בתוך שורש הכרטיס (OcPortal) ותמיד כהים (dlg-dark על השורש, A25).
// הכרטיס החדש לא קורא לעולם ל-window.customConfirm/customAuthPrompt/customPrompt/customThreeWayConfirm/alert/confirm/prompt -
// רק ל-useOcUi() (נאכף ב-scripts/order-card-tests/static.test.mjs).
//
// ממשק (לכל הזרמים):
//   const ui = useOcUi();
//   await ui.confirm({title, sub, body, okText, cancelText, icon, danger})            → true | false
//   await ui.threeWay({title, sub, body, primary:{text,icon}, secondary:{text,icon}, tertiary:{text,icon}}) → 'primary'|'secondary'|'tertiary'|null
//   await ui.choose({title, sub, body, choices:[{key,text,icon,kind:'primary'|'plain'|'ghost'|'danger'}]}) → key | null
//   await ui.prompt({title, sub, label, icon, type, inputMode, dir, placeholder, defaultValue, okText, cancelText, validate}) → string | null
//   await ui.alert({title, sub, body, okText, kind:'info'|'error'})                     → undefined
//   ui.toast(kind:'info'|'charge'|'credit'|'error', big, small?, action?:{text, icon?, onClick})   ; ui.hideToast()
//   await ui.openDialog(Component, props, {layer:1|2, className, dismissable, badge})   → מה שהרכיב העביר ל-close(result)
//        badge:false = בלי תג האייקון העגול בראש החלון (ברירת מחדל: יש, כמו בעיצוב)
//        הרכיב מקבל {...props, close}. Escape / לחיצה על הרקע = close(null) (אלא אם dismissable:false).
//   רכיבי עזר לבניית חלון באותו מבנה של העיצוב: <DlgHead/>, <DlgButtons/>, <DlgBtn kind/>, <Field/>, <Inp/>.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import OcIcon from './OcIcon';
import OcPortal from './OcPortal';

const OcUiContext = createContext(null);
export const useOcUi = () => useContext(OcUiContext);

const NO_FILL = { autoComplete: 'off', 'data-lpignore': 'true', 'data-1p-ignore': true, 'data-form-type': 'other' };
const TOAST_MS = { info: 2600, error: 4500, charge: 6500, credit: 6500 };
let dlgSeq = 0;

// ---------- רכיבי עזר (מבנה החלון של העיצוב: h2, .sub, גוף, .dbtns) ----------
export function DlgHead({ id, title, sub }) {
  return (
    <>
      <h2 id={id}>{title}</h2>
      {sub ? <div className="sub">{sub}</div> : null}
    </>
  );
}

// kind: primary (= P בעיצוב: btn primary lg block) | plain (= B: btn block) | ghost (= G: btn ghost block) | danger (מחיקה)
export function DlgBtn({ kind = 'plain', icon, children, onClick, disabled, autoFocus, act, ...rest }) {
  const cls = kind === 'primary' ? 'btn primary lg block' : kind === 'ghost' ? 'btn ghost block' : kind === 'danger' ? 'btn primary lg block' : 'btn block';
  return (
    <button type="button" className={cls} onClick={onClick} disabled={disabled} data-autofocus={autoFocus ? 'true' : undefined} data-act={act || (kind === 'danger' ? 'delete' : undefined)} {...rest}>
      {icon ? <OcIcon name={icon} size={kind === 'primary' || kind === 'danger' ? undefined : 'sm'} /> : null}
      {children}
    </button>
  );
}

export function DlgButtons({ children, style }) {
  return <div className="dbtns" style={style}>{children}</div>;
}

export function Field({ label, icon, htmlFor, children, labelId }) {
  return (
    <div className="mfld">
      <label className="lbl" htmlFor={htmlFor} id={labelId}>{icon ? <OcIcon name={icon} size="sm" /> : null}{label}</label>
      {children}
    </div>
  );
}

export function Inp(props) {
  return <input className="inp" {...NO_FILL} {...props} />;
}

// ---------- חלונות בסיסיים ----------
function ConfirmDlg({ title, sub, body, okText = 'אישור', cancelText = 'ביטול', icon = 'check', danger, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title={title || 'אישור פעולה'} sub={sub} />
      {body}
      <DlgButtons>
        <DlgBtn kind={danger ? 'danger' : 'primary'} icon={icon} autoFocus onClick={() => close(true)}>{okText}</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(false)}>{cancelText}</DlgBtn>
      </DlgButtons>
    </>
  );
}

function ChooseDlg({ title, sub, body, choices = [], close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title={title} sub={sub} />
      {body}
      <DlgButtons>
        {choices.map((c, i) => (
          <DlgBtn key={c.key} kind={c.kind || (i === 0 ? 'primary' : 'plain')} icon={c.icon} autoFocus={i === 0} act={c.act} onClick={() => close(c.key)}>{c.text}</DlgBtn>
        ))}
      </DlgButtons>
    </>
  );
}

function PromptDlg({ title, sub, label, icon, type = 'text', inputMode, dir, placeholder, defaultValue = '', okText = 'אישור', cancelText = 'ביטול', validate, close }) {
  const [v, setV] = useState(defaultValue);
  const [err, setErr] = useState('');
  const submit = () => {
    const e = validate ? validate(v) : '';
    if (e) { setErr(e); return; }
    close(v);
  };
  return (
    <>
      <DlgHead id="oc-dlg-t" title={title || 'הזנת נתונים'} sub={sub} />
      <Field label={label || title} icon={icon} htmlFor="oc-prompt-in">
        <Inp id="oc-prompt-in" type={type} inputMode={inputMode} dir={dir} placeholder={placeholder} value={v} data-autofocus="true"
          onChange={(e) => { setV(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }} />
      </Field>
      <div className="amsg" aria-live="polite">{err ? <><OcIcon name="alert" size="sm" />{err}</> : null}</div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={submit}>{okText}</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>{cancelText}</DlgBtn>
      </DlgButtons>
    </>
  );
}

function AlertDlg({ title, sub, body, okText = 'הבנתי', kind, close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title={title || (kind === 'error' ? 'שגיאה' : 'הודעה')} sub={sub} />
      {body}
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" autoFocus onClick={() => close(undefined)}>{okText}</DlgBtn>
      </DlgButtons>
    </>
  );
}

// ---------- תג האייקון בראש החלון (בלוק DLG-MODERN בעיצוב: decorate) ----------
// לכל חלון עם h2 ישיר: עיגול 56px עם האייקון של הלחצן הראשי (או לפי data-act), ו-data-k שבוחר את הנפשת ההמתנה. לא בחלון שיש בו
// כבר "גיבור" משלו (.ashield/.big-ck/.mico) ולא כש-opts.badge===false. האייקון נקרא מה-DOM אחרי ההרכבה (כמו בעיצוב).
const BADGE_BY_ACT = { 'confirm-pay': 'card', 'confirm-pay-only': 'card', 'confirm-credit': 'undo', 'discard-close': 'trash' };
function DlgBadge({ boxId, dlgKey }) {
  const [b, setB] = useState(null);
  useLayoutEffect(() => {
    const d = document.getElementById(boxId);
    if (!d || !d.querySelector(':scope > h2') || d.querySelector('.ashield,.big-ck,.mico')) { setB(null); return; }
    const p = d.querySelector('.btn.primary,.btn.green');
    const href = p && p.querySelector('use') ? p.querySelector('use').getAttribute('href') || '' : '';
    const act = p && p.dataset.act;
    const icon = (act && BADGE_BY_ACT[act]) || href.replace(/^#gmi-/, '') || 'info';
    const k = act === 'confirm-credit' ? 'coin' : act === 'do-save' ? 'write' : icon === 'trash' ? 'lid' : icon === 'card' ? 'tilt' : icon === 'check' ? 'breathe' : 'float';
    setB({ icon, k });
  }, [boxId, dlgKey]);
  if (!b) return null;
  return <div className="dbadge" aria-hidden="true" data-k={b.k}><OcIcon name={b.icon} /></div>;
}

// dismissable: false | true | () => boolean (נבדק בכל Esc/לחיצה על הרקע - למשל חלון תשלום בזמן חיוב רץ)
const canDismiss = (opts) => (typeof opts.dismissable === 'function' ? !!opts.dismissable() : opts.dismissable !== false);

// ---------- ספק ----------
export function OcUiProvider({ children }) {
  const [stack, setStack] = useState([]); // [{id, layer, Component, props, resolve, opts}]
  const [toast, setToast] = useState(null); // {kind, big, small, action, n}
  const [toastOut, setToastOut] = useState(false);
  const toastTimer = useRef(null);
  const outTimer = useRef(null);
  const focusBack = useRef([]);

  const close = useCallback((id, result) => {
    setStack(prev => {
      const it = prev.find(x => x.id === id);
      if (it) setTimeout(() => it.resolve(result), 0);
      return prev.filter(x => x.id !== id);
    });
    const back = focusBack.current.pop();
    // הלחצן שפתח את החלון יכול להיעלם בזמן שהחלון פתוח (למשל "שמור" ברייל אחרי שמירה מוצלחת) - אז המיקוד חוזר ללחצן-גיבוי (data-oc-focus-fallback)
    if (back && typeof back.focus === 'function') {
      setTimeout(() => {
        try {
          if (back.isConnected === false) { const fb = document.querySelector('[data-oc-focus-fallback]'); if (fb) fb.focus(); } else back.focus();
        } catch { /* noop */ }
      }, 0);
    }
  }, []);

  const openDialog = useCallback((Component, props = {}, opts = {}) => new Promise((resolve) => {
    if (!Component) { resolve(null); return; }
    const id = ++dlgSeq;
    const layer = opts.layer || Component.ocLayer || 1;
    focusBack.current.push(typeof document !== 'undefined' ? document.activeElement : null);
    setStack(prev => [...prev, { id, layer, Component, props, resolve, opts }]);
  }), []);

  const hideToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToastOut(true);
    clearTimeout(outTimer.current);
    outTimer.current = setTimeout(() => { setToast(null); setToastOut(false); }, 270);
  }, []);

  const showToast = useCallback((kind, big, small, action) => {
    const k = TOAST_MS[kind] ? kind : 'info';
    clearTimeout(toastTimer.current);
    clearTimeout(outTimer.current);
    setToastOut(false);
    setToast({ kind: k, big, small: small || '', action: action || null, n: Date.now() });
    toastTimer.current = setTimeout(() => hideToast(), TOAST_MS[k]);
  }, [hideToast]);
  useEffect(() => () => { clearTimeout(toastTimer.current); clearTimeout(outTimer.current); }, []);

  const ui = useMemo(() => ({
    openDialog,
    confirm: (o = {}) => openDialog(ConfirmDlg, o).then(r => r === true),
    choose: (o = {}) => openDialog(ChooseDlg, o),
    threeWay: (o = {}) => openDialog(ChooseDlg, {
      ...o,
      choices: [
        { key: 'primary', text: o.primary?.text || 'שמור', icon: o.primary?.icon || 'check', kind: 'primary' },
        { key: 'secondary', text: o.secondary?.text || 'אל תשמור', icon: o.secondary?.icon || 'x', kind: 'plain', act: o.secondary?.act },
        { key: 'tertiary', text: o.tertiary?.text || 'חזרה', icon: o.tertiary?.icon || 'back', kind: 'ghost' },
      ]
    }),
    prompt: (o = {}) => openDialog(PromptDlg, o),
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
        if (!canDismiss(top.opts)) { e.stopImmediatePropagation(); e.preventDefault(); return; }
        e.stopImmediatePropagation(); e.preventDefault();
        close(top.id, null);
        return;
      }
      if (e.key === 'Tab' && box) {
        const f = [...box.querySelectorAll('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(x => x.offsetParent !== null);
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [stack, close]);

  // מיקוד ראשוני בחלון שנפתח: [data-autofocus] או הלחצן הראשי
  const lastTopId = useRef(0);
  useEffect(() => {
    if (!stack.length) return;
    const top = [...stack].sort((a, b) => (a.layer - b.layer) || (a.id - b.id)).pop();
    if (top.id === lastTopId.current) return;
    lastTopId.current = top.id;
    const t = setTimeout(() => {
      const box = document.getElementById(top.layer === 2 ? 'dlg2' : 'dlg');
      if (!box) return;
      const el = box.querySelector('[data-autofocus="true"]') || box.querySelector('.btn.primary:not([disabled])') || box.querySelector('button:not([disabled])');
      if (el) el.focus();
    }, 30);
    return () => clearTimeout(t);
  }, [stack]);

  const layerTop = (layer) => { const l = stack.filter(x => x.layer === layer); return l.length ? l[l.length - 1] : null; };
  const renderLayer = (layer) => {
    const top = layerTop(layer);
    const sid = layer === 2 ? 'scrim2' : 'scrim';
    const did = layer === 2 ? 'dlg2' : 'dlg';
    return (
      <div
        className={`scrim${top ? ' on' : ''}`}
        id={sid}
        onMouseDown={(e) => { if (top && e.target === e.currentTarget && canDismiss(top.opts)) close(top.id, null); }}
      >
        <div className={`dlg${top && top.opts.className ? ` ${top.opts.className}` : ''}`} id={did} role="dialog" aria-modal="true" aria-labelledby={top ? (top.opts.labelledBy || 'oc-dlg-t') : undefined}>
          {top && top.opts.badge !== false ? <DlgBadge key={`b${top.id}`} boxId={did} dlgKey={top.id} /> : null}
          {top ? <top.Component key={top.id} {...top.props} close={(r) => close(top.id, r)} /> : null}
        </div>
      </div>
    );
  };

  return (
    <OcUiContext.Provider value={ui}>
      {children}
      <OcPortal>
        <div
          id="toast"
          role="status"
          aria-live="polite"
          data-kind={toast ? toast.kind : undefined}
          className={toast ? `${toast.kind}${toastOut ? ' out' : ' on pulse'}` : ''}
          style={toast ? { '--tdur': `${TOAST_MS[toast.kind]}ms` } : undefined}
          key={toast ? toast.n : 'none'}
          onClick={(e) => { if (toast && !(e.target.closest && e.target.closest('.tbtn'))) hideToast(); }}
        >
          {toast ? (
            <>
              <button type="button" className="tclose" data-tip="סגור" aria-label="סגירה" onClick={hideToast}><OcIcon name="x" size="sm" /></button>
              <div className="tb"><OcIcon name={toast.kind === 'charge' ? 'plus' : toast.kind === 'credit' ? 'undo' : toast.kind === 'error' ? 'alert' : 'info'} size="lg" /></div>
              <div><b>{toast.big}</b>{toast.small ? <small>{toast.small}</small> : null}</div>
              {toast.action ? (
                <button type="button" className="tbtn" onClick={(e) => { e.stopPropagation(); hideToast(); toast.action.onClick && toast.action.onClick(); }}>
                  <OcIcon name={toast.action.icon || 'check'} size="sm" />{toast.action.text}
                </button>
              ) : null}
            </>
          ) : null}
        </div>
        {renderLayer(1)}
        {renderLayer(2)}
      </OcPortal>
    </OcUiContext.Provider>
  );
}
