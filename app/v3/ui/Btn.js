'use client';
import Icon from './Icon';
import { cx } from './cx';

const VARIANT = { primary: 'v3-btn--primary', secondary: '', quiet: 'v3-btn--quiet', danger: 'v3-btn--danger', 'on-dark': 'v3-btn--on-dark' };
const SIZE = { sm: 'v3-btn--sm', md: '', lg: 'v3-btn--lg' };

/**
 * variant: primary | secondary (ברירת מחדל) | quiet | danger | on-dark
 * size: sm | md | lg · block · round · loading (מנוטרל + ספינר + aria-busy)
 * icon / iconEnd: שם איקון בתחילת / בסוף הכפתור · href => <a> · onClick נשאר כפי שהוא (R8)
 */
export default function Btn({ variant = 'secondary', size = 'md', block, round, loading, disabled, icon, iconEnd, href, type = 'button', className, children, ...rest }) {
  const cls = cx('v3-btn', VARIANT[variant], SIZE[size], block && 'v3-btn--block', round && 'v3-btn--round', className);
  const inner = (
    <>
      {loading ? <span className="v3-spin" aria-hidden="true" /> : icon && <Icon name={icon} />}
      {children != null && <span>{children}</span>}
      {!loading && iconEnd && <Icon name={iconEnd} />}
    </>
  );
  if (href) return <a className={cls} href={href} aria-disabled={disabled || loading || undefined} {...rest}>{inner}</a>;
  return <button type={type} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>{inner}</button>;
}

/** כפתור איקון בלבד. label חובה (aria-label). */
export function IconBtn({ icon, label, variant = 'secondary', size = 'md', className, ...rest }) {
  return <Btn variant={variant} size={size} icon={icon} aria-label={label} className={cx('v3-btn--icon', className)} {...rest} />;
}
