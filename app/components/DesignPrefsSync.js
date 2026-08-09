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
        const local = readLocalPrefs();
        if (data.prefs) {
          // DB wins over whatever this (possibly shared) browser had.
          const merged = { ...local, ...data.prefs };
          writeLocalPrefs(merged);
          writeDesignPrefsCookie(employeeId, merged);
          if (merged.mode) writeThemeCookie(employeeId, merged.mode);
          applyPrefsToDom(merged);
          try {
            window.dispatchEvent(new CustomEvent(DESIGN_PREFS_EVENT, { detail: merged }));
          } catch (e) {}
        } else if (local && Object.keys(local).length > 0) {
          // First login since the DB store exists — migrate the legacy
          // browser-local prefs up so they follow the employee everywhere.
          pushPrefsToServer(local);
          writeDesignPrefsCookie(employeeId, local);
          if (local.mode) writeThemeCookie(employeeId, local.mode);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return null;
}
