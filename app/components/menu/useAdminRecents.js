'use client';

// hook: פאנל "ניהול" המקוצר (בקשת הבעלים 4.10.2026, docs/admin-menu-short-2026-10-04.md) — "כלי ניהול שנפתחו לאחרונה".
// העץ מגיע מהשרת עם פאנל ברירת מחדל (בלי אחרונים) ועם מאגר הכלים המותרים (tab.pool). כאן: רישום ביקור בכלי ניהול
// ב-localStorage (lib/menu/adminRecents.js, מפתח לכל עובד) והרכבת הפאנל מחדש עם applyAdminRecents (lib/menu/buildMenuTree.js).
// נרשם רק נתיב שמתאים לשורה במאגר — כלומר רק כלי שמותר למשתמש הזה לפתוח; גם בקריאה הפאנל מסנן מול המאגר הנוכחי.
// האחסון נקרא רק אחרי הטעינה (useEffect), כך שהרינדור בשרת ובלקוח זהה (בלי אי-התאמת hydration).
//
// נעיצה (סיכה צפה על שורה, 8.10.2026): כלי נעוץ תקוע בפאנל תמיד (lib/menu/buildMenuTree.js composeAdminItems). בניגוד ל"אחרונים"
// הנעיצה נשמרת לכל עובד ב-DB (PUT /api/me/design-prefs, שדה adminPins בהעדפות העובד) ולכן עוקבת אחריו בין מחשבים. הנעיצות
// הראשוניות מגיעות מהשרת בתוך העץ (tab.pins, מהעוגייה החתומה) - אותו רינדור בשרת ובלקוח. שינוי מוצג מיד (אופטימי) ונשלח
// לשרת בתור (בקשות לא מתחלפות בסדר); כשל שמירה מחזיר את המצב הקודם ומדווח.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { applyAdminRecents, matchAdminPoolItem } from '@/lib/menu/buildMenuTree';
import { adminRecentHrefs, sameRecents, clearAdminRecentsStorage, readAdminRecents, recordAdminVisit, writeAdminRecents, samePins, sanitizeAdminPins, toggleAdminPin } from '@/lib/menu/adminRecents';

/**
 * @param {object} tree עץ התפריט מהשרת
 * @returns {{ tree: object, clearOnLogout: () => void }} העץ עם פאנל "ניהול" לפי האחרונים
 */
export default function useAdminRecents(tree) {
  const pathname = usePathname();
  const userKey = tree && tree.user && tree.user.logged ? tree.user.id : null;
  const [list, setList] = useState([]);
  const serverPins = useMemo(() => {
    const t = tree && Array.isArray(tree.tabs) ? tree.tabs.find((x) => x && x.id === 'admin') : null;
    return sanitizeAdminPins(t && t.pins);
  }, [tree]);
  const [pins, setPins] = useState(serverPins);
  const pinsRef = useRef(serverPins);
  const saveChain = useRef(Promise.resolve());
  // העץ מהשרת התחדש (ניווט מלא / רענון) - הנעיצות השמורות שם הן האמת.
  useEffect(() => {
    if (!samePins(pinsRef.current, serverPins)) { pinsRef.current = serverPins; setPins(serverPins); }
  }, [serverPins]);

  // ביקור: קוראים מחדש מהאחסון (טאב אחר אולי כתב בינתיים), מוסיפים את הכלי אם הנתיב שייך למאגר, ומציגים.
  useEffect(() => {
    const stored = readAdminRecents(userKey);
    const hit = matchAdminPoolItem(tree, pathname);
    const next = hit ? recordAdminVisit(stored, hit.href) : stored;
    if (next !== stored) writeAdminRecents(userKey, next);
    // סנכרון מאחסון הדפדפן אחרי הטעינה — רק כשהרשימה השתנתה בפועל (אחרת רינדור מיותר של כל המעטפת בכל ניווט).
    setList((prev) => (sameRecents(prev, next) ? prev : next));
  }, [tree, pathname, userKey]);

  const view = useMemo(() => applyAdminRecents(tree, adminRecentHrefs(list), pins), [tree, list, pins]);
  const clearOnLogout = useCallback(() => { clearAdminRecentsStorage(); }, []);

  /** נעיצה / שחרור של כלי. מחזיר Promise<'pinned'|'unpinned'|'full'|'error'>. */
  const togglePin = useCallback((href) => {
    const r = toggleAdminPin(pinsRef.current, href);
    if (r.full) return Promise.resolve('full');
    if (!r.changed) return Promise.resolve('error');
    const before = pinsRef.current;
    const wasPinned = before.includes(href);
    pinsRef.current = r.pins;
    setPins(r.pins);
    const next = saveChain.current.then(async () => {
      try {
        const res = await fetch('/api/me/design-prefs', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPins: r.pins }),
        });
        if (!res.ok) throw new Error(String(res.status));
        return wasPinned ? 'unpinned' : 'pinned';
      } catch (e) {
        // השמירה נכשלה: חוזרים למצב הקודם רק אם אף שינוי אחר לא נעשה בינתיים.
        if (samePins(pinsRef.current, r.pins)) { pinsRef.current = before; setPins(before); }
        return 'error';
      }
    });
    saveChain.current = next;
    return next;
  }, []);
  return { tree: view, clearOnLogout, togglePin };
}
