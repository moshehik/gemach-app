'use client';
// app/v3/overlays/LayerManager.js — CONSTITUTION §ד, LIBRARY-MAP §4.
//
// רכיב יחיד: כל שכבה צפה (confirm/code/form/sheet/busy) נולדת כאן ורק כאן.
// Portal ל-<div id="v3-layer-root"> ילד ישיר של body (מחוץ לשורש האפליקציה,
// כדי ששום transform/contain של אב לא יכלוא אותה - §ד.1).
//
// **הערה חשובה (ראו docs/redesign-v3/AGENT-QUESTIONS.md Q-1):** ה-MASTER-PLAN
// מתאר הרכבה חד-פעמית ב-app/layout.js. הסבב הזה בנה את הספרייה ומוכיח אותה
// בגלריה בלבד, בלי לגעת ב-layout.js המשותף לכל האתר החי - זו קביעה מפורשת
// של תיאור המשימה הזו ("Do NOT rewire existing pages yet"). מי שממשיך:
// `<LayersProvider>{children}</LayersProvider>` פעם אחת ב-layout.js, מעל כל
// ה-providers שאינם UI, כולל מסך הכניסה.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../ui/Icon';
import { CodeInput } from '../ui/Dialog';
import { cx } from '../ui/cx';
import './overlays.css';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const MAX_MODAL_LAYERS = 3;

// type -> {modal, defaultSize, role}
const TYPE_META = {
  confirm: { modal: true, size: 'S', role: 'alertdialog', followsTheme: true },
  code: { modal: true, size: 'S', role: 'dialog', followsTheme: true },
  form: { modal: true, size: 'M', role: 'dialog', followsTheme: false }, // data-entry = light בלבד תמיד (D-2)
  sheet: { modal: true, size: 'L', role: 'dialog', followsTheme: true },
  full: { modal: true, size: 'full', role: 'dialog', followsTheme: true },
  busy: { modal: true, size: 'S', role: 'alertdialog', followsTheme: true, noClose: true },
};

const LayersContext = createContext(null);

function currentSiteTheme() {
  if (typeof document === 'undefined') return 'light';
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

let uidCounter = 0;
function nextUid() { return `v3lyr-${++uidCounter}`; }

export function LayersProvider({ children }) {
  const [modalStack, setModalStack] = useState([]);   // [{id, type, ...config, resolve}]
  const [toasts, setToasts] = useState([]);            // [{id, ...config, expiresAt}]
  const [notices, setNotices] = useState([]);          // [{id, ...config, expiresAt}]  (§ד.7: אחד פעיל בפועל, נשמר כתור)
  const [portalRoot, setPortalRoot] = useState(null);

  useEffect(() => {
    let el = document.getElementById('v3-layer-root');
    if (!el) {
      el = document.createElement('div');
      el.id = 'v3-layer-root';
      document.body.appendChild(el);
    }
    setPortalRoot(el);
  }, []);

  // נעילת גלילה + inert לתוכן שמאחורי המודאלית העליונה (§ד.1, §ג.2)
  useEffect(() => {
    const hasModal = modalStack.length > 0;
    if (hasModal) {
      document.documentElement.dataset.v3Lock = '';
    } else {
      delete document.documentElement.dataset.v3Lock;
    }
    const root = portalRoot;
    const siblings = root ? [...document.body.children].filter((el) => el !== root) : [];
    siblings.forEach((el) => {
      if (hasModal) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
      else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
    });
    return () => { siblings.forEach((el) => { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }); };
  }, [modalStack.length, portalRoot]);

  const openLayer = useCallback((config) => {
    if (modalStack.length >= MAX_MODAL_LAYERS) {
      console.warn(`[v3 LayerManager] מקסימום ${MAX_MODAL_LAYERS} שכבות מודאליות (CONSTITUTION §ד.1) — הקריאה נחסמה.`, config);
      return Promise.resolve(undefined);
    }
    const id = nextUid();
    return new Promise((resolve) => {
      setModalStack((s) => [...s, { id, ...config, resolve }]);
    }).finally(() => {
      setModalStack((s) => s.filter((l) => l.id !== id));
    });
  }, [modalStack.length]);

  const closeLayer = useCallback((id, result) => {
    setModalStack((s) => {
      const layer = s.find((l) => l.id === id);
      layer?.resolve?.(result);
      return s;
    });
  }, []);

  const confirmHelper = useCallback((opts = {}) => openLayer({
    type: 'confirm',
    size: opts.size || 'S',
    title: opts.title,
    sub: opts.sub,
    icon: opts.icon || (opts.danger ? 'alert-tri' : 'alert-circle'),
    danger: opts.danger,
    body: opts.body,
    confirmLabel: opts.confirmLabel || 'אישור',
    cancelLabel: opts.cancelLabel || 'ביטול',
    altLabel: opts.altLabel,
  }), [openLayer]);

  const codeHelper = useCallback((opts = {}) => openLayer({
    type: 'code',
    size: 'S',
    title: opts.title || 'אישור מנהל',
    sub: opts.sub,
    approvers: opts.approvers || [],
    purpose: opts.purpose,
  }), [openLayer]);

  const promptHelper = useCallback((opts = {}) => openLayer({
    type: 'form',
    size: opts.size || 'M',
    title: opts.title,
    sub: opts.sub,
    label: opts.label,
    defaultValue: opts.defaultValue || '',
    multiline: opts.multiline,
  }), [openLayer]);

  const toast = useCallback((cfg) => {
    const id = nextUid();
    const duration = cfg.duration ?? (cfg.kind === 'info' ? 2600 : 6500);
    const expiresAt = Date.now() + duration;
    setToasts((t) => [...t.slice(-2), { id, kind: 'default', ...cfg, duration, expiresAt, pausedAt: null }]);
    return id;
  }, []);
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const notice = useCallback((cfg) => {
    const id = nextUid();
    const duration = cfg.duration ?? 15000;
    setNotices((n) => [...n, { id, ...cfg, duration, expiresAt: Date.now() + duration }]);
    return id;
  }, []);
  const dismissNotice = useCallback((id) => setNotices((n) => n.filter((x) => x.id !== id)), []);

  const value = useMemo(() => ({
    open: openLayer,
    close: closeLayer,
    confirm: confirmHelper,
    code: codeHelper,
    prompt: promptHelper,
    toast,
    dismissToast,
    notice,
    dismissNotice,
    modalOpenCount: modalStack.length,
  }), [openLayer, closeLayer, confirmHelper, codeHelper, promptHelper, toast, dismissToast, notice, dismissNotice, modalStack.length]);

  return (
    <LayersContext.Provider value={value}>
      {children}
      {portalRoot && createPortal(
        <>
          {modalStack.map((layer, i) => (
            <LayerSurface key={layer.id} layer={layer} index={i} isTop={i === modalStack.length - 1}
              onClose={(result) => closeLayer(layer.id, result)} />
          ))}
          <ToastRegion toasts={toasts} onDismiss={dismissToast} modalOpen={modalStack.length > 0} />
          <NoticeRegion notices={notices} onDismiss={dismissNotice} modalOpen={modalStack.length > 0} />
        </>,
        portalRoot,
      )}
    </LayersContext.Provider>
  );
}

export function useLayers() {
  const ctx = useContext(LayersContext);
  if (!ctx) throw new Error('useLayers() requires <LayersProvider> — הרכיבו אותו פעם אחת מעל האפליקציה (ראו הערת layout.js למעלה).');
  return ctx;
}

// ---------------------------------------------------------------------
// LayerSurface — גוף המודאלית עצמה (Confirm/Code/Form/Sheet/Busy)
// ---------------------------------------------------------------------
function LayerSurface({ layer, index, isTop, onClose }) {
  const uid = useId().replace(/:/g, '');
  const ref = useRef(null);
  const meta = TYPE_META[layer.type] || TYPE_META.confirm;
  const size = layer.size || meta.size;
  const mode = meta.followsTheme ? currentSiteTheme() : 'light';
  const dismissOnScrim = layer.dismiss?.scrim ?? (layer.type === 'confirm' || layer.type === 'sheet');
  const dismissOnEsc = layer.dismiss?.esc ?? !meta.noClose;

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;
    const prevFocus = document.activeElement;
    const target = root.querySelector('[data-autofocus]') || root.querySelector(FOCUSABLE) || root;
    target.focus({ preventScroll: true });
    const onKey = (e) => {
      if (!isTop) return;
      if (e.key === 'Escape' && dismissOnEsc) { e.stopPropagation(); onClose(layer.type === 'confirm' ? false : null); return; }
      if (e.key !== 'Tab') return;
      const items = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!items.length) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    };
  }, [isTop, dismissOnEsc, layer.type, onClose]);

  const tid = layer.title ? `v3lt-${uid}` : undefined;
  const sid = layer.sub ? `v3ls-${uid}` : undefined;

  return (
    <div
      className={cx('v3ov-scrim', index > 0 && 'v3ov-scrim--nested')}
      style={{ '--v3-lz-offset': index * 10 }}
      onMouseDown={(e) => { if (dismissOnScrim && e.target === e.currentTarget) onClose(layer.type === 'confirm' ? false : null); }}
    >
      <div
        ref={ref}
        role={meta.role}
        aria-modal="true"
        aria-labelledby={tid}
        aria-describedby={sid}
        tabIndex={-1}
        data-v3-mode={mode}
        data-v3-layer-type={layer.type}
        className={cx('v3ov-surface', `v3ov-surface--${size}`, `v3ov-surface--${layer.type}`, 'v3-m-dialog-in')}
      >
        {layer.icon && (
          <div className={cx('v3ov-badge', layer.danger && 'v3ov-badge--danger')} aria-hidden="true">
            <Icon name={layer.icon} anim={false} size="lg" />
          </div>
        )}
        {layer.title && <h2 id={tid} className="v3ov-title">{layer.title}</h2>}
        {layer.sub && <p id={sid} className="v3ov-sub">{layer.sub}</p>}
        <LayerBody layer={layer} onClose={onClose} />
      </div>
    </div>
  );
}

function LayerBody({ layer, onClose }) {
  if (layer.type === 'confirm') return <ConfirmBody layer={layer} onClose={onClose} />;
  if (layer.type === 'code') return <CodeBody layer={layer} onClose={onClose} />;
  if (layer.type === 'form') return <FormBody layer={layer} onClose={onClose} />;
  if (layer.type === 'busy') return <BusyBody layer={layer} onClose={onClose} />;
  if (layer.render) return layer.render({ close: onClose });
  return layer.body || null;
}

function ConfirmBody({ layer, onClose }) {
  return (
    <>
      {layer.body && <div className="v3ov-body">{layer.body}</div>}
      <div className="v3ov-actions">
        <button type="button" className={cx('v3ov-btn', layer.danger ? 'v3ov-btn--danger' : 'v3ov-btn--primary')}
          onClick={() => onClose(true)} data-autofocus={layer.danger ? undefined : ''}>
          {layer.confirmLabel}
        </button>
        {layer.altLabel && (
          <button type="button" className="v3ov-btn v3ov-btn--quiet" onClick={() => onClose('alt')}>{layer.altLabel}</button>
        )}
        <button type="button" className="v3ov-btn v3ov-btn--quiet" onClick={() => onClose(false)} data-autofocus={layer.danger ? '' : undefined}>
          {layer.cancelLabel}
        </button>
      </div>
    </>
  );
}

function CodeBody({ layer, onClose }) {
  const [employeeId, setEmployeeId] = useState(layer.approvers?.[0]?.id || '');
  const [pin, setPin] = useState('');
  const [state, setState] = useState(undefined);
  return (
    <>
      {layer.purpose && <p className="v3ov-purpose">{layer.purpose}</p>}
      {layer.approvers?.length > 1 && (
        <select className="v3ov-select" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} aria-label="מאשר">
          {layer.approvers.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
      <CodeInput length={4} value={pin} onChange={(v) => { setPin(v); setState(undefined); }} state={state} autoFocus />
      <div className="v3ov-actions">
        <button type="button" className="v3ov-btn v3ov-btn--primary" disabled={pin.length < 4}
          onClick={() => onClose({ employeeId, pin, ok: true })}>אישור</button>
        <button type="button" className="v3ov-btn v3ov-btn--quiet" onClick={() => onClose(null)}>ביטול</button>
      </div>
    </>
  );
}

function FormBody({ layer, onClose }) {
  const [value, setValue] = useState(layer.defaultValue || '');
  const Field = layer.multiline ? 'textarea' : 'input';
  return (
    <>
      {layer.label && <label className="v3ov-label" htmlFor="v3ov-form-input">{layer.label}</label>}
      <Field id="v3ov-form-input" className="v3ov-input" data-autofocus="" value={value}
        onChange={(e) => setValue(e.target.value)} rows={layer.multiline ? 4 : undefined} />
      <div className="v3ov-actions">
        <button type="button" className="v3ov-btn v3ov-btn--primary" onClick={() => onClose(value)}>שמירה</button>
        <button type="button" className="v3ov-btn v3ov-btn--quiet" onClick={() => onClose(null)}>ביטול</button>
      </div>
    </>
  );
}

function BusyBody({ layer, onClose }) {
  useEffect(() => {
    if (!layer.autoCloseAfter) return undefined;
    const t = setTimeout(() => onClose(true), layer.autoCloseAfter);
    return () => clearTimeout(t);
  }, [layer.autoCloseAfter, onClose]);
  return (
    <div className="v3ov-busy" role="status" aria-live="polite">
      <span className="v3ov-spinner" aria-hidden="true"><Icon name="loader" anim="spin" loop /></span>
      <span>{layer.body || 'רק רגע…'}</span>
    </div>
  );
}

// ---------------------------------------------------------------------
// Toast — CONSTITUTION §ד.6 (פינה שמאלית-תחתונה פיזית, עד 3, טיימר מושהה)
// ---------------------------------------------------------------------
function ToastRegion({ toasts, onDismiss, modalOpen }) {
  return (
    <div className="v3ov-toastregion" role="status" aria-live="polite">
      {toasts.map((t) => <ToastItem key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} paused={modalOpen} />)}
    </div>
  );
}

function ToastItem({ toast, onDismiss, paused }) {
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const remainingRef = useRef(toast.duration);
  const startRef = useRef(null);

  useEffect(() => {
    if (paused || hover) { clearTimeout(timerRef.current); if (startRef.current != null) remainingRef.current -= Date.now() - startRef.current; return undefined; }
    startRef.current = Date.now();
    timerRef.current = setTimeout(onDismiss, remainingRef.current);
    return () => clearTimeout(timerRef.current);
  }, [paused, hover, onDismiss]);

  return (
    <div className={cx('v3ov-toast', toast.kind && `v3ov-toast--${toast.kind}`, 'v3-m-pop')}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
      {toast.icon !== false && (
        <span className="v3ov-toast__ic" aria-hidden="true"><Icon name={toast.icon || 'info'} anim={false} /></span>
      )}
      <div className="v3ov-toast__msg">
        {toast.title && <b>{toast.title}</b>}
        {toast.text && <span>{toast.text}</span>}
      </div>
      {toast.action && <button type="button" className="v3ov-toast__action" onClick={toast.action.onClick}>{toast.action.label}</button>}
      <button type="button" className="v3ov-toast__x" aria-label="סגירה" onClick={onDismiss}><Icon name="x" size="sm" anim={false} /></button>
    </div>
  );
}

// ---------------------------------------------------------------------
// NoticeBar — CONSTITUTION §ד.7 (מתחת לסרגל העליון, פס זהב יורד ~15ש')
// ---------------------------------------------------------------------
function NoticeRegion({ notices, onDismiss, modalOpen }) {
  const active = notices[0];
  if (!active) return null;
  return <NoticeItem notice={active} onDismiss={() => onDismiss(active.id)} paused={modalOpen} />;
}

function NoticeItem({ notice, onDismiss, paused }) {
  const [hover, setHover] = useState(false);
  const timerRef = useRef(null);
  const remainingRef = useRef(notice.duration);
  const startRef = useRef(null);

  useEffect(() => {
    if (paused || hover) { clearTimeout(timerRef.current); if (startRef.current != null) remainingRef.current -= Date.now() - startRef.current; return undefined; }
    startRef.current = Date.now();
    timerRef.current = setTimeout(onDismiss, remainingRef.current);
    return () => clearTimeout(timerRef.current);
  }, [paused, hover, onDismiss]);

  return (
    <div className="v3ov-notice" role="status" aria-live="polite"
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)} onBlur={() => setHover(false)}>
      <span className="v3ov-notice__ic" aria-hidden="true"><Icon name={notice.icon || 'check-circle'} anim={false} /></span>
      <span className="v3ov-notice__text">{notice.text}</span>
      {notice.action && <button type="button" className="v3ov-notice__action" onClick={notice.action.onClick}>{notice.action.label}</button>}
      <button type="button" className="v3ov-notice__x" aria-label="סגירה" onClick={onDismiss}><Icon name="x" size="sm" anim={false} /></button>
      <span className="v3ov-notice__bar" style={{ animationPlayState: (paused || hover) ? 'paused' : 'running', animationDuration: `${notice.duration}ms` }} />
    </div>
  );
}
