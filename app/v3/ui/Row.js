'use client';
import Icon from './Icon';
import Tip from './Tip';
import { cx } from './cx';

/** Row (R15): תווית מעל, ערך מתחת. missing => "חסר" עם איקון זהב. tip => ⓘ צף ליד התווית. */
export default function Row({ label, icon, missing, missingText = 'חסר', tip, className, children, ...rest }) {
  return (
    <div className={cx('v3-row', missing && 'v3-row--missing', className)} {...rest}>
      {icon && <Icon name={icon} className="v3-row__ic" />}
      <div className="v3-row__body">
        <span className="v3-row__label">{label}{tip && <> <Tip>{tip}</Tip></>}</span>
        <div className="v3-row__value">
          {missing ? <span className="v3-missing"><Icon name="alert-circle" size="sm" />{missingText}</span> : children}
        </div>
      </div>
    </div>
  );
}
export function Rows({ className, children, ...rest }) { return <div className={cx('v3-rows', className)} {...rest}>{children}</div>; }
