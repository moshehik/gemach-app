'use client';

import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// חלון "בטוח?" של הלו״ז יושב כמו בעיצוב (L.modal: scrim שמתווסף ל-body, אח של .app) - לא בתוך השורה. בתוך השורה הוא
// ירש מהשורה סמן/משקל/צבע (li.lrow) ונחתך ע״י transform/overflow של אבות. ScheduleDay מספק את שורש הדף (.gm-ds.gm-lz,
// כדי שהפלטה ו-schedule.css ימשיכו לחול) ו-LzPortal מעביר את החלון אליו. בלי שורש (רינדור ראשון / מחוץ לדף) - במקום.
export const LzPortalRoot = createContext(null);

export function LzPortal({ children }) {
  const root = useContext(LzPortalRoot);
  return root ? createPortal(children, root) : children;
}
