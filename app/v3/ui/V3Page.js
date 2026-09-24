'use client';
// שורש עמוד v3: data-v3 (מפעיל את ה-tokens) + dir=rtl. טוען את ה-CSS ואת שברי הספרייט של v3.
import { useEffect } from 'react';
import '../tokens.css';
import '../tokens/base.css';
import '../components.css';
import IconSpriteV3 from './IconSpriteV3';
import { cx } from './cx';

// מונה מופעי V3Page בעמוד אחד (יכולים להיות כמה, למשל רייל/panel מקוננים) -
// מסמן document.documentElement[data-v3-page] רק כש-1+ מורכבים, מסיר כשה-0
// האחרון יורד. זה מה ש-tokens/base.css משתמש בו כדי לצבוע html/body (F2)
// בלי לגעת בשאר האתר שלא הרכיב V3Page בכלל.
let v3PageMounts = 0;

export default function V3Page({ children, page = true, sprite = true, className, as: As = 'div', ...rest }) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (v3PageMounts++ === 0) document.documentElement.setAttribute('data-v3-page', '');
    return () => {
      if (--v3PageMounts === 0) document.documentElement.removeAttribute('data-v3-page');
    };
  }, []);
  return (
    <As data-v3="" dir="rtl" lang="he" className={cx(page && 'v3-page', className)} {...rest}>
      {sprite && <IconSpriteV3 />}
      {children}
    </As>
  );
}
