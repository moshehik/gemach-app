'use client';

// hook: פאנל "ניהול" המקוצר (בקשת הבעלים 4.10.2026, docs/admin-menu-short-2026-10-04.md) — "כלי ניהול שנפתחו לאחרונה".
// העץ מגיע מהשרת עם פאנל ברירת מחדל (בלי אחרונים) ועם מאגר הכלים המותרים (tab.pool). כאן: רישום ביקור בכלי ניהול
// ב-localStorage (lib/menu/adminRecents.js, מפתח לכל עובד) והרכבת הפאנל מחדש עם applyAdminRecents (lib/menu/buildMenuTree.js).
// נרשם רק נתיב שמתאים לשורה במאגר — כלומר רק כלי שמותר למשתמש הזה לפתוח; גם בקריאה הפאנל מסנן מול המאגר הנוכחי.
// האחסון נקרא רק אחרי הטעינה (useEffect), כך שהרינדור בשרת ובלקוח זהה (בלי אי-התאמת hydration).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { applyAdminRecents, matchAdminPoolItem } from '@/lib/menu/buildMenuTree';
import { adminRecentHrefs, sameRecents, clearAdminRecentsStorage, readAdminRecents, recordAdminVisit, writeAdminRecents } from '@/lib/menu/adminRecents';

/**
 * @param {object} tree עץ התפריט מהשרת
 * @returns {{ tree: object, clearOnLogout: () => void }} העץ עם פאנל "ניהול" לפי האחרונים
 */
export default function useAdminRecents(tree) {
  const pathname = usePathname();
  const userKey = tree && tree.user && tree.user.logged ? tree.user.id : null;
  const [list, setList] = useState([]);

  // ביקור: קוראים מחדש מהאחסון (טאב אחר אולי כתב בינתיים), מוסיפים את הכלי אם הנתיב שייך למאגר, ומציגים.
  useEffect(() => {
    const stored = readAdminRecents(userKey);
    const hit = matchAdminPoolItem(tree, pathname);
    const next = hit ? recordAdminVisit(stored, hit.href) : stored;
    if (next !== stored) writeAdminRecents(userKey, next);
    // סנכרון מאחסון הדפדפן אחרי הטעינה — רק כשהרשימה השתנתה בפועל (אחרת רינדור מיותר של כל המעטפת בכל ניווט).
    setList((prev) => (sameRecents(prev, next) ? prev : next));
  }, [tree, pathname, userKey]);

  const view = useMemo(() => applyAdminRecents(tree, adminRecentHrefs(list)), [tree, list]);
  const clearOnLogout = useCallback(() => { clearAdminRecentsStorage(); }, []);
  return { tree: view, clearOnLogout };
}
