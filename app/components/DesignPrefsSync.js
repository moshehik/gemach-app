'use client';

import { useEffect } from 'react';
import {
  DESIGN_PREFS_EVENT,
  applyPrefsToDom,
  pushPrefsToServer,
  readLocalPrefs,
  writeDesignPrefsCookie,
  writeLocalPrefs,
  writeThemeCookie,
} from '../lib/designPrefs';
import { splitServerPrefs } from '@/lib/designPrefsSchema';

// Mounted once from RootLayout for authenticated sessions. Makes the DB
// (Employee.themeColor JSON, via /api/me/design-prefs) the source of truth
// for design preferences:
//   * DB has prefs  → apply them and refresh the fast mirrors (localStorage +
//     designPrefs_<id> / theme_<id> cookies), so a login from a brand-new
//     browser paints correctly from the second page load onward (and already
//     on this load, right after mount).
//   * DB empty      → one-time migration: push whatever this browser already
//     had locally (legacy localStorage-only behavior) into the DB.
// Renders nothing; runs once per full page load.
export default function DesignPrefsSync() {
  useEffect(() => {
    let cancelled = false;
    fetch('/api/me/design-prefs')
      .then((res) => (res.ok ? res.json() : null))
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
          writeDesignPrefsCookie(employeeId, merged, server.uiVariants);
          if (merged.mode) writeThemeCookie(employeeId, merged.mode);
          applyPrefsToDom(merged);
          try {
            window.dispatchEvent(new CustomEvent(DESIGN_PREFS_EVENT, { detail: merged }));
          } catch (e) {}
        } else if (local && Object.keys(local).length > 0) {
          // First login since the DB store exists — migrate the legacy
          // browser-local prefs up so they follow the employee everywhere.
          // (PUT מתמזג על ההעדפות השמורות, ולכן עקיפת uiVariants קיימת נשמרת.)
          pushPrefsToServer(local);
          writeDesignPrefsCookie(employeeId, local, server.uiVariants);
          if (local.mode) writeThemeCookie(employeeId, local.mode);
        } else {
          // אין העדפות ואין מה להגר — רק מרעננים את עוגיית העקיפה כדי שהשרת יראה אותה בטעינה הבאה,
          // ומנקים עוגייה ישנה עם uiVariants אם הבעלים כבר ביטל את העקיפה (אחרת היא נשארת עד שנה).
          let staleCookie = false;
          try {
            const c = decodeURIComponent(document.cookie);
            staleCookie = c.includes(`designPrefs_${employeeId}=`) && c.includes('"uiVariants"');
          } catch (e) {}
          if (server.uiVariants || staleCookie) {
            writeDesignPrefsCookie(employeeId, {}, server.uiVariants || null);
          }
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return null;
}
