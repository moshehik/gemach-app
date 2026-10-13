'use client';

// ReturnToNewDesignButton — הלחצן הבולט "חזרה לממשק החדש" בכותרת הממשק הישן (בקשת הבעלים לנווה יעקב, 12.10.2026:
// "...שיופיע בכותרת בישן בצורה ברורה לחצן חזרה לחדש").
//
// מוצג רק בסרגל העליון של המעטפת הישנה (AppShell) ובדפים ישנים בתוך המעטפת החדשה (CornerToggle ב-VariantFrame, placement="corner") - לעולם
// לא בממשק החדש עצמו. הלחצן מחליף את העדפת העובד/ת לחדש בכל המסכים בבת אחת (POST /api/me/ui-variant { value: 'a5' } -> עקיפה אישית
// ב-Employee.themeColor.uiVariants + רענון עוגיית designPrefs_<id> בתשובה) ואז טוען את הדף מחדש. אין כאן הגדרת ארגון וגם אין החלטה
// בצד הלקוח: ההרשאה נאכפת בשרת (העובד המאומת, פעיל), והלחצן מוצג רק למי ש-canSelfSwitch (useCanSelfSwitch('shell') - לא בקיוסק / שעון / הדפסה).
//
// מראה: לחצן הזהב של הפלטה (--gm-gbtn, מסגרת שחורה 1.5px, אייקון 57 "החלפה") עם טקסט קבוע; CSS ב-pageVariantToggle.css (היקף .gm-pvt-return).
// במובייל (עד 640px) הלחצן יורד לשורה משלו, ברוחב מלא, מתחת לשורת הכותרת - עדיין חלק מהכותרת.

import './pageVariantToggle.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanSelfSwitch } from '../UiVariantContext';
import { usePopup } from '../PopupProvider';
import {
  RETURN_TO_NEW_LABEL, RETURN_TO_NEW_FAILED_LABEL, UNSAVED_CONFIRM_MESSAGE, UNSAVED_CONFIRM_TITLE, isPageDirty, isEditableControl,
} from '@/lib/pageVariantToggle';
import { SPRITE_SYMBOLS } from '../menu/spriteSymbols';

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

export default function ReturnToNewDesignButton({ placement = 'topbar' }) {
  const allowed = useCanSelfSwitch('shell'); // מסך המעטפת: '*' בכל האתר, חוץ מקיוסק / שעון / הדפסה
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const popup = usePopup();
  const userEdited = useRef(false);

  // אותו אישור "שינויים שלא נשמרו" כמו PageVariantToggle - הטעינה מחדש מאבדת קלט.
  useEffect(() => {
    if (!allowed) return undefined;
    const mark = (e) => { if (e.isTrusted && isEditableControl(e.target)) userEdited.current = true; };
    document.addEventListener('input', mark, true);
    document.addEventListener('change', mark, true);
    return () => { document.removeEventListener('input', mark, true); document.removeEventListener('change', mark, true); };
  }, [allowed]);

  const onClick = useCallback(async () => {
    if (busy) return;
    if (isPageDirty({ win: window, doc: document, userEdited: userEdited.current }) && popup && popup.showConfirm) {
      const ok = await popup.showConfirm(UNSAVED_CONFIRM_MESSAGE, UNSAVED_CONFIRM_TITLE);
      if (!ok) return;
    }
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/me/ui-variant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: 'a5' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      window.location.reload();
    } catch (e) {
      setBusy(false);
      setFailed(true);
    }
  }, [busy, popup]);

  if (!allowed) return null;

  return (
    <span className={`gm-pvt gm-pvt-return gm-pvt-return-${placement}`} data-guide-id="disp.return-new" data-pvt-return="1">
      <button
        type="button"
        className="gm-pvt-return-btn"
        aria-busy={busy ? 'true' : undefined}
        disabled={busy}
        onClick={onClick}
        title={RETURN_TO_NEW_LABEL}
      >
        <SwapIcon />
        <span className="gm-pvt-return-txt">{failed ? RETURN_TO_NEW_FAILED_LABEL : RETURN_TO_NEW_LABEL}</span>
      </button>
      {failed && <span className="gm-pvt-sr" role="alert">{RETURN_TO_NEW_FAILED_LABEL}</span>}
    </span>
  );
}
