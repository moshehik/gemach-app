'use client';

// PageVariantToggle — האייקון העגול "מעבר לתצוגה החדשה" / "חזרה לתצוגה הישנה" (בקשת הבעלים 4.10.2026). רכיב אחד לכל המסכים.
//
// מתי מוצג (useCanSelfSwitch, app/components/UiVariantContext.js): רק למי שרשאי להחליף לעצמו (הנהלה ראשית / מתכנת —
// SELF_SWITCH_ROLE_IDS ב-lib/uiVariantSelfSwitch.js), רק במסך שברשומה (lib/uiVariantScreens.js) יש לו גם ישן וגם חדש, ולעולם
// לא בקיוסק / שעון נוכחות / הדפסה (isForcedLegacyPath). אחרת — null (שום DOM).
//
// לחיצה: POST /api/me/ui-variant/<screen> { value: 'a5' | 'legacy' } — עקיפה אישית ב-Employee.themeColor.uiVariants, והשרת
// מרענן את עוגיית designPrefs_<id> בתשובה (כמו "האתר הישן" בתפריט החדש). אחר כך טעינה מלאה — אותו נתיב, או נתיב היעד של
// הגרסה השנייה כשהוא שונה (switchTargetFor, למשל /employees -> /employees/attendance).
//
// מראה: לחצן אייקון עגול של הפלטה (רקע זהב --gm-gbtn, מסגרת שחורה 1.5px, אייקון 57 "החלפה" מה-sprite). ה-CSS עצמאי
// (pageVariantToggle.css, טוקני --gm-* הגלובליים) כדי שיעבוד גם בדפים הישנים, בלי components.css של הפלטה.
// טולטיפ: systemTip=true -> data-tip בלבד (הטולטיפ של המערכת בדף החדש: usePageTooltip / חלון הדיווח); אחרת טולטיפ משלו
// (.gm-pvt-tt, אותו מראה כמו .pl-tt של הפלטה) — בדפים הישנים ובפינה אין מי שמטפל ב-data-tip.
//
// placement: 'header' (בסרגל הכותרת של דף חדש) | 'corner' (פינה קבועה, נפתח מ-VariantFrame בדפים הישנים) | 'topbar' (סרגל
// המעטפת הישנה) | 'overlay' (מעל החלון הישן של דיווח השגיאות).

import './pageVariantToggle.css';
import { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useCanSelfSwitch, useUiVariant } from '../UiVariantContext';
import { switchTargetFor } from '@/lib/uiVariantScreens';
import { SPRITE_SYMBOLS } from '../menu/spriteSymbols';

export const TOGGLE_LABELS = Object.freeze({
  toNew: 'מעבר לתצוגה החדשה',
  toOld: 'חזרה לתצוגה הישנה',
  failed: 'המעבר נכשל. נסו שוב.',
});

// אייקון 57 בפלטה ("החלפה", design-system/icons.json) — מוטמע מאותו מקור כמו ה-sprite (spriteSymbols.js), כי בדפים הישנים
// ה-sprite של הפלטה לא תמיד נטען.
const SWAP = SPRITE_SYMBOLS.find((s) => s[0] === 'swap');
function SwapIcon() {
  if (!SWAP) return null;
  const [, viewBox, shapes] = SWAP;
  return (
    <svg className="gm-pvt-ic" viewBox={viewBox} aria-hidden="true" focusable="false">
      {shapes.map(([Tag, attrs], i) => <Tag key={i} {...attrs} />)}
    </svg>
  );
}

export default function PageVariantToggle({ screen, placement = 'header', systemTip = false, className = '' }) {
  const allowed = useCanSelfSwitch(screen);
  const current = useUiVariant(screen);
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const target = current === 'a5' ? 'legacy' : 'a5';
  const label = failed ? TOGGLE_LABELS.failed : (target === 'a5' ? TOGGLE_LABELS.toNew : TOGGLE_LABELS.toOld);

  const onClick = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch(`/api/me/ui-variant/${encodeURIComponent(screen)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: target }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const dest = switchTargetFor(screen, target, pathname || window.location.pathname);
      if (dest) window.location.assign(dest);
      else window.location.reload();
    } catch (e) {
      setBusy(false);
      setFailed(true);
    }
  }, [busy, screen, target, pathname]);

  if (!allowed) return null;

  return (
    <span className={`gm-pvt gm-pvt-${placement}${systemTip ? '' : ' gm-pvt-owntip'}${className ? ` ${className}` : ''}`} data-pvt-screen={screen} data-pvt-target={target}>
      <button
        type="button"
        className="gm-pvt-btn"
        aria-label={label}
        {...(systemTip ? { 'data-tip': label } : {})}
        aria-busy={busy ? 'true' : undefined}
        disabled={busy}
        onClick={onClick}
      >
        <SwapIcon />
      </button>
      {!systemTip && <span className="gm-pvt-tt" role="tooltip" aria-hidden="true">{label}</span>}
      {failed && <span className="gm-pvt-sr" role="alert">{TOGGLE_LABELS.failed}</span>}
    </span>
  );
}
