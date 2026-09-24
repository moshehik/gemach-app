'use client';
import { useRef } from 'react';
import Icon from './Icon';
import { Badge } from './Chip';
import { cx } from './cx';

/**
 * Tabs: items=[{key,label,icon?,count?}] · value · onChange(key). ניווט חצים לפי כיוון הדף (RTL: שמאלה = הבא).
 */
export function Tabs({ items, value, onChange, label, className, ...rest }) {
  const ref = useRef(null);
  const onKey = (e) => {
    const rtl = getComputedStyle(ref.current).direction === 'rtl';
    const dir = { ArrowLeft: rtl ? 1 : -1, ArrowRight: rtl ? -1 : 1 }[e.key];
    const home = e.key === 'Home', end = e.key === 'End';
    if (!dir && !home && !end) return;
    e.preventDefault();
    const i = items.findIndex((t) => t.key === value);
    const n = home ? 0 : end ? items.length - 1 : (i + dir + items.length) % items.length;
    onChange(items[n].key);
    ref.current.querySelectorAll('[role="tab"]')[n]?.focus();
  };
  return (
    <div ref={ref} role="tablist" aria-label={label} className={cx('v3-tabs', className)} onKeyDown={onKey} {...rest}>
      {items.map((t) => (
        <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={t.key === value} tabIndex={t.key === value ? 0 : -1}
          className="v3-tab" onClick={() => onChange(t.key)}>
          {t.icon && <Icon name={t.icon} />}{t.label}{t.count != null && <Badge variant="neutral">{t.count}</Badge>}
        </button>
      ))}
    </div>
  );
}

/** Seg: בורר מקטעים (בחירה יחידה). options=[{value,label,icon?}] */
export function Seg({ options, value, onChange, label, className, ...rest }) {
  return (
    <div role="group" aria-label={label} className={cx('v3-seg', className)} {...rest}>
      {options.map((o) => (
        <button key={o.value} type="button" className="v3-seg__btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.icon && <Icon name={o.icon} />}{o.label}
        </button>
      ))}
    </div>
  );
}

/** Switch: מתג הפעלה/כיבוי. label = טקסט; בלי label חובה aria-label. */
export function Switch({ checked, onChange, label, disabled, className, ...rest }) {
  return (
    <label className={cx('v3-switch-row', className)}>
      <span className="v3-switch">
        <input type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={(e) => onChange?.(e.target.checked)} {...rest} />
        <i />
      </span>
      {label && <span>{label}</span>}
    </label>
  );
}
