'use client';

import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// חלונות (#dlg/#dlg2), טוסט (#toast), טולטיפ (.pl-tt) והרייל הנייד מוצגים ב-portal לשורש הכרטיס (.gm-ds.gm-oc) ולא ל-body - כדי
// שירשו את ההיקף של הפלטה ושל css/oc-*.css (תבנית LzPortal של הלו״ז). השורש הוא אלמנט נפרד בתוך הכרטיס ולא ה-.app, כדי שלא
// יירשו פריסה/transform מהתוכן. בלי שורש (רינדור ראשון) - מרונדר במקום.
export const OcPortalRoot = createContext(null);

export default function OcPortal({ children }) {
  const root = useContext(OcPortalRoot);
  return root ? createPortal(children, root) : children;
}
