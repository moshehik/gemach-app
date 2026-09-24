'use client';
// חלונית v3 (R19). variant: confirm | code | form | sheet.
//  - mode light|dark: נתמך ב-confirm/code/sheet-בלי-קלט. form = תמיד בהיר (מתעלם מ-mode).
//  - portal ל-body, aria-modal, לכידת פוקוס, Esc (רק העליונה), נעילת גלילה, החזרת פוקוס.
//  - מובייל: גיליון תחתון (CSS קיים ב-components.css).
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Icon from './Icon';
import { cx } from './cx';

const VARIANT_CLASS = { confirm: '', code: 'v3-dialog--code', form: 'v3-dialog--form', sheet: 'v3-dialog--sheet' };
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack = [];
let locks = 0;

export default function Dialog({
  open, onClose, variant = 'confirm', mode = 'light', title, sub, icon, badgeKind, actions, closeOnScrim = true, nested = false,
  initialFocus, className, children, ...rest
}) {
  const uid = useId().replace(/:/g, '');
  const ref = useRef(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dark = mode === 'dark' && variant !== 'form';

  useEffect(() => {
    if (!open || !mounted) return undefined;
    const root = ref.current;
    if (!root) return undefined; // fix by main: בטעינה ראשונה כשהחלונית כבר פתוחה ה-portal עוד לא הורכב
    const token = uid;
    stack.push(token);
    const prev = document.activeElement;
    if (locks++ === 0) { document.documentElement.dataset.v3Lock = ''; document.body.style.overflow = 'hidden'; }
    const target = (initialFocus && root.querySelector(initialFocus)) || root.querySelector('[data-autofocus]') || root.querySelector(FOCUSABLE) || root;
    target.focus({ preventScroll: true });
    const onKey = (e) => {
      if (stack[stack.length - 1] !== token) return;
      if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current?.(); return; }
      if (e.key !== 'Tab') return;
      const items = [...root.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); root.focus(); return; }
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === root)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      stack.splice(stack.indexOf(token), 1);
      if (--locks === 0) { delete document.documentElement.dataset.v3Lock; document.body.style.overflow = ''; }
      if (prev && document.contains(prev)) prev.focus({ preventScroll: true });
    };
  }, [open, mounted, uid, initialFocus]);

  if (!open || !mounted) return null;
  const tid = title ? `dt${uid}` : undefined, sid = sub ? `ds${uid}` : undefined;
  return createPortal(
    <div data-v3="" dir="rtl" className={cx('v3-scrim is-on', nested && 'v3-scrim--2')}
      onMouseDown={(e) => { if (closeOnScrim && e.target === e.currentTarget) onCloseRef.current?.(); }}>
      <div ref={ref} role={variant === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true" aria-labelledby={tid} aria-describedby={sid} tabIndex={-1}
        data-v3-mode={dark ? 'dark' : 'light'} className={cx('v3-dialog', VARIANT_CLASS[variant], className)} {...rest}>
        {icon && <div className="v3-dialog__badge" data-k={badgeKind} aria-hidden="true"><Icon name={icon} anim={false} /></div>}
        {title && <h2 id={tid} className="v3-dialog__title">{title}</h2>}
        {sub && <p id={sid} className="v3-dialog__sub">{sub}</p>}
        {children}
        {actions && <div className={variant === 'form' ? 'v3-mail__actions' : 'v3-dialog__actions'}>{actions}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** שדה קוד (PIN): length תאים, value מחרוזת, onChange(str). state: 'bad'|'good'. לשימוש בתוך Dialog variant=code. */
export function CodeInput({ length = 4, value = '', onChange, state, label = 'קוד אישור', autoFocus }) {
  const refs = useRef([]);
  const set = (i, ch) => {
    const arr = value.padEnd(length, ' ').split('');
    arr[i] = ch || ' ';
    onChange?.(arr.join('').replace(/\s+$/, ''));
  };
  return (
    <div className="v3-codes" role="group" aria-label={label}>
      {Array.from({ length }, (_, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} className={cx('v3-code', state && `is-${state}`)} inputMode="numeric" autoComplete="one-time-code"
          maxLength={1} aria-label={`${label} ${i + 1}`} data-autofocus={autoFocus && i === 0 ? '' : undefined} value={(value[i] || '').trim()}
          onChange={(e) => { const ch = e.target.value.replace(/\D/g, '').slice(-1); set(i, ch); if (ch) refs.current[i + 1]?.focus(); }}
          onKeyDown={(e) => { if (e.key === 'Backspace' && !value[i]) refs.current[i - 1]?.focus(); }}
          onPaste={(e) => { const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length); if (t) { e.preventDefault(); onChange?.(t); refs.current[Math.min(t.length, length - 1)]?.focus(); } }} />
      ))}
    </div>
  );
}
