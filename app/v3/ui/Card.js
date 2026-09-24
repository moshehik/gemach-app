'use client';
import Icon from './Icon';
import Tip from './Tip';
import { cx } from './cx';

/**
 * Card: icon + title (+ tip ⓘ צף) + actions בקצה. variant: cust | info | quiet.
 * level: רמת הכותרת (ברירת מחדל 2). בלי title/actions — אין header.
 */
export default function Card({ icon, title, tip, actions, variant, level = 2, as: As = 'section', className, children, ...rest }) {
  const H = `h${level}`;
  return (
    <As className={cx('v3-card', variant && `v3-card--${variant}`, className)} {...rest}>
      {(title || actions) && (
        <header className="v3-card__head">
          <H className="v3-card__title">{icon && <Icon name={icon} />}{title}{tip && <Tip>{tip}</Tip>}</H>
          {actions}
        </header>
      )}
      {children}
    </As>
  );
}
