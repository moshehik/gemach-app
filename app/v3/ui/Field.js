'use client';
import { cloneElement, isValidElement, useId } from 'react';
import Icon from './Icon';
import Tip from './Tip';
import { cx } from './cx';

/**
 * Field: תווית מעל, hint, error, required. as = input (ברירת מחדל) | select | textarea.
 * לחלופין children = אלמנט קלט אחד (מקבל id / aria-describedby / aria-invalid אוטומטית).
 * שאר ה-props עוברים לקלט. tip => ⓘ צף ליד התווית.
 */
export default function Field({ label, hint, error, required, tip, as = 'input', id, className, children, ...rest }) {
  const auto = useId();
  const fid = id || `f${auto.replace(/:/g, '')}`;
  const hid = hint ? `${fid}-h` : undefined;
  const eid = error ? `${fid}-e` : undefined;
  const props = {
    id: fid, required: required || undefined,
    'aria-invalid': error ? 'true' : undefined, 'aria-describedby': [hid, eid].filter(Boolean).join(' ') || undefined,
  };
  let control;
  if (isValidElement(children)) {
    control = cloneElement(children, { ...props, className: cx('v3-input', children.props.className) });
  } else {
    const As = as;
    control = as === 'select'
      ? <As className={cx('v3-input', className)} {...props} {...rest}>{children}</As>
      : <As className={cx('v3-input', className)} {...props} {...rest} />;
  }
  return (
    <div className="v3-field">
      {label && (
        <label className="v3-label" htmlFor={fid}>
          {label}{required && <span className="v3-req" aria-hidden="true">*</span>}
          {tip && <Tip>{tip}</Tip>}
        </label>
      )}
      {control}
      {hint && <div id={hid} className="v3-hint">{hint}</div>}
      {error && <div id={eid} className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{error}</div>}
    </div>
  );
}
