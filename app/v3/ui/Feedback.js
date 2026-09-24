'use client';
import Icon from './Icon';
import { cx } from './cx';

/** Empty: מצב ריק. icon, title, text, action (node, בדרך כלל Btn). */
export function Empty({ icon = 'search', title, text, action, className, ...rest }) {
  return (
    <div className={cx('v3-empty', className)} {...rest}>
      <Icon name={icon} size="xl" />
      {title && <b className="v3-h2">{title}</b>}
      {text && <p className="v3-empty__text">{text}</p>}
      {action}
    </div>
  );
}

const KIND_ICON = { info: 'info', warning: 'alert-tri', success: 'check-circle', alert: 'alert-circle' };

/** Banner (בשורה, לא צף): kind info | warning | success | alert · title · text · action={label,onClick} · onClose */
export function Banner({ kind = 'info', title, text, action, onClose, icon, className, ...rest }) {
  return (
    <div className={cx('v3-banner', kind !== 'info' && `v3-banner--${kind}`, className)} role={kind === 'alert' ? 'alert' : 'status'} {...rest}>
      <div className="v3-banner__main">
        <span className="v3-banner__ic"><Icon name={icon || KIND_ICON[kind]} /></span>
        <div className="v3-banner__msg">{title && <b>{title}</b>}{text && <span>{text}</span>}</div>
        {action && <button type="button" className="v3-banner__more" onClick={action.onClick}>{action.label}<Icon name="chevron-start" size="sm" /></button>}
        {onClose && <button type="button" className="v3-banner__x" aria-label="סגירה" onClick={onClose}><Icon name="x" size="sm" /></button>}
      </div>
    </div>
  );
}
