'use client';

// LegacyErrorReportFrame — הגרסה הישנה של "דיווח על שגיאות" (4.10.2026). מרנדר את החלון הקודם כפי שהוא
// (app/components/LegacyErrorReportButton.js, c944cb95) ומוסיף, רק כשהחלון הישן פתוח ורק למי שרשאי להחליף לעצמו, את אייקון
// "מעבר לתצוגה החדשה" מעל החלון (placement 'overlay', z-index מעל ה-999999 של החלון הישן) — בלי לגעת בקובץ הישן.
//
// איך יודעים שהחלון הישן פתוח בלי לשנות אותו: הוא נפתח כ-portal ישירות ל-body (.modal-backdrop עם z-index 999999 וכותרת
// "מערכת תמיכה ושגיאות" / "דיווח על תקלה חדשה"). MutationObserver על ילדי ה-body בלבד, ורק למשתמש שהאייקון מוצג לו.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import LegacyErrorReportButton from '../LegacyErrorReportButton';
import { ScreenVariantScope, useCanSelfSwitch } from '../UiVariantContext';
import PageVariantToggle from './PageVariantToggle';

const LEGACY_TITLES = ['מערכת תמיכה ושגיאות', 'דיווח על תקלה חדשה'];

export function isLegacyErrorReportOpen(doc) {
  if (!doc || !doc.body) return false;
  for (const el of Array.from(doc.body.children)) {
    if (!el.classList || !el.classList.contains('modal-backdrop')) continue;
    if (String(el.style && el.style.zIndex) !== '999999') continue;
    const head = el.querySelector('.modal-head');
    if (head && LEGACY_TITLES.some((t) => (head.textContent || '').includes(t))) return true;
  }
  return false;
}

export default function LegacyErrorReportFrame({ trigger }) {
  const allowed = useCanSelfSwitch('error_report');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!allowed || typeof MutationObserver === 'undefined') return undefined;
    const check = () => setOpen(isLegacyErrorReportOpen(document));
    check();
    // subtree: הכותרת מתחלפת ("מערכת תמיכה" <-> "תקלה חדשה") בתוך החלון; הבדיקה זולה (רק ילדי ה-body הישירים)
    const mo = new MutationObserver(check);
    mo.observe(document.body, { childList: true, subtree: true, characterData: false });
    return () => mo.disconnect();
  }, [allowed]);

  return (
    <ScreenVariantScope screen="error_report" variant="legacy">
      <LegacyErrorReportButton trigger={trigger} />
      {allowed && open ? createPortal(<PageVariantToggle screen="error_report" placement="overlay" />, document.body) : null}
    </ScreenVariantScope>
  );
}
