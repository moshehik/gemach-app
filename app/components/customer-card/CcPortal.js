'use client';

import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';

// חלונות (#dlg/#dlg2), טוסט (#toast), טולטיפים (.pl-tt / .pl-rt) מוצגים ב-portal לשורש הכרטיס (.gm-ds.gm-cc) ולא ל-body - כדי
// שירשו את ההיקף של הפלטה ושל customer-card.css (תבנית LzPortal של הלו״ז / OcPortal של כרטיס ההזמנה). בלי שורש - במקום.
export const CcPortalRoot = createContext(null);

export default function CcPortal({ children }) {
  const root = useContext(CcPortalRoot);
  return root ? createPortal(children, root) : children;
}
