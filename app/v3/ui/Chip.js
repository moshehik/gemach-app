'use client';
import Icon from './Icon';
import { cx } from './cx';

/** Chip: variant info | done | gold | attn (ללא = ניטרלי) · onClick => כפתור */
export function Chip({ variant, icon, onClick, className, children, ...rest }) {
  const cls = cx('v3-chip', variant && `v3-chip--${variant}`, onClick && 'v3-chip--btn', className);
  const inner = <>{icon && <Icon name={icon} />}{children}</>;
  return onClick ? <button type="button" className={cls} onClick={onClick} {...rest}>{inner}</button> : <span className={cls} {...rest}>{inner}</span>;
}
/** Tag: variant soft | done | attn */
export function Tag({ variant, icon, className, children, ...rest }) {
  return <span className={cx('v3-tag', variant && `v3-tag--${variant}`, className)} {...rest}>{icon && <Icon name={icon} />}{children}</span>;
}
/** Badge (מספר): variant navy | gold | neutral · large */
export function Badge({ variant = 'navy', large, className, children, ...rest }) {
  return <span className={cx('v3-badge', `v3-badge--${variant}`, large && 'v3-badge--lg', className)} {...rest}>{children}</span>;
}
export default Chip;
