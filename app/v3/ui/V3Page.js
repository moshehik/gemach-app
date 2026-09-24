'use client';
// שורש עמוד v3: data-v3 (מפעיל את ה-tokens) + dir=rtl. טוען את ה-CSS ואת שברי הספרייט של v3.
import '../tokens.css';
import '../components.css';
import IconSpriteV3 from './IconSpriteV3';
import { cx } from './cx';

/** page=false מבטל את מיכל ה-v3-page (רוחב מקסימלי + ריפוד). sprite=false אם כבר נטען. */
export default function V3Page({ children, page = true, sprite = true, className, as: As = 'div', ...rest }) {
  return (
    <As data-v3="" dir="rtl" lang="he" className={cx(page && 'v3-page', className)} {...rest}>
      {sprite && <IconSpriteV3 />}
      {children}
    </As>
  );
}
