'use client';

import { useEffect } from 'react';
import {
  DESIGN_PREFS_EVENT,
  applyPrefsToDom,
  pushPrefsToServer,
  readLocalPrefs,
  writeLocalPrefs,
  writeThemeCookie,
} from '../lib/designPrefs';
import { splitServerPrefs } from '@/lib/designPrefsSchema';
import { readPersistedFresh, writePersisted } from '@/lib/apiCache';

// Mounted once from RootLayout for authenticated sessions. Makes the DB
// (Employee.themeColor JSON, via /api/me/design-prefs) the source of truth
// for design preferences:
//   * DB has prefs  → apply them and refresh the fast mirrors (localStorage +
//     theme_<id> cookie), so a login from a brand-new browser paints correctly
//     from the second page load onward (and already on this load, right after mount).
//   * DB empty      → one-time migration: push whatever this browser already
//     had locally (legacy localStorage-only behavior) into the DB.
// The SSR cookie designPrefs_<id> is signed + httpOnly (lib/designPrefsSig.js, GQ-01b): this component can neither read
// nor write it. The GET below makes the SERVER rebuild it from the DB whenever it is missing / legacy-unsigned / forged /
// expired (response header x-design-prefs-cookie: rebuilt) — so no worker loses preferences and nothing is trusted from the client.
// When it was rebuilt and the worker has "old/new" screen overrides, the server-rendered page of THIS load used the
// defaults, so reload once (per tab session) to render with the real overrides.
// Renders nothing; runs once per full page load.
export default function DesignPrefsSync() {
  useEffect(() => {
    let cancelled = false;
    let cookieRebuilt = false;
    let pendingPush = Promise.resolve(); // ההגירה החד-פעמית (PUT) חייבת להסתיים לפני רענון הדף
    // CPU 5.10.2026: תשובה של פחות מ-60 שנ' (אותו עובד, אותה לשונית - sessionStorage, lib/apiCachePersist.js) משרתת את הטעינה
    // המלאה הבאה בלי רשת. כשפונים לשרת (הכותרת x-design-prefs-cookie נקראת כמו קודם) התשובה נשמרת לפעם הבאה. תשובה מהאחסון לא
    // מחליפה את בניית העוגייה: זו כבר נבנתה/אומתה בקריאה שיצרה אותה, לפני פחות מדקה.
    const stored = readPersistedFresh('/api/me/design-prefs');
    (stored !== undefined
      ? Promise.resolve(stored)
      : fetch('/api/me/design-prefs')
        .then((res) => {
          cookieRebuilt = res.headers.get('x-design-prefs-cookie') === 'rebuilt';
          return res.ok ? res.json() : null;
        })
        .then((d) => {
          if (d && d.success && d.employeeId) writePersisted('/api/me/design-prefs', d);
          return d;
        }))
      .then((data) => {
        if (cancelled || !data || !data.success || !data.employeeId) return;
        const employeeId = data.employeeId;
        // uiVariants (דגלי "ישן / A5") מגיעים רק מה-DB של העובד המחובר: ערך מ-localStorage המשותף
        // לדפדפן היה מדליף עקיפה של עובד אחר, ולכן מסירים אותו מכאן ולא כותבים אותו חזרה לשם.
        const { uiVariants: _ignoredLocalVariants, ...local } = readLocalPrefs();
        // prefs שמכיל רק uiVariants (עקיפה שהבעלים קבע) הוא "אין העדפות": לא חוסם את ההגירה החד-פעמית.
        const server = splitServerPrefs(data.prefs);
        if (server.hasPrefs) {
          // DB wins over whatever this (possibly shared) browser had.
          const merged = { ...local, ...server.prefs };
          writeLocalPrefs(merged);
          if (merged.mode) writeThemeCookie(employeeId, merged.mode);
          applyPrefsToDom(merged);
          try {
            window.dispatchEvent(new CustomEvent(DESIGN_PREFS_EVENT, { detail: merged }));
          } catch (e) {}
        } else if (local && Object.keys(local).length > 0) {
          // First login since the DB store exists — migrate the legacy
          // browser-local prefs up so they follow the employee everywhere.
          // (PUT מתמזג על ההעדפות השמורות, ולכן עקיפת uiVariants קיימת נשמרת.)
          pendingPush = pushPrefsToServer(local); // התשובה (PUT) כותבת את העוגייה החתומה
          if (local.mode) writeThemeCookie(employeeId, local.mode);
        }
        // העוגייה נבנתה מחדש כרגע ויש עקיפות "ישן / חדש" ב-DB: ה-SSR של הטעינה הזו רץ בלעדיהן. רענון אחד (פעם לכל לשונית).
        if (cookieRebuilt && server.uiVariants && Object.keys(server.uiVariants).length > 0) {
          try {
            const guard = `gemachPrefsCookieReload_${employeeId}`;
            if (!sessionStorage.getItem(guard)) {
              sessionStorage.setItem(guard, '1');
              pendingPush.then(() => { if (!cancelled) window.location.reload(); });
            }
          } catch (e) {}
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return null;
}
