'use client';

import { useCallback } from 'react';
import { usePopup } from '../PopupProvider';
import { isBackupSwitchCommand } from '@/lib/backupCommand';

// שורת החיפוש בדף הבית (HomeA5 + LegacyHome): הקלדת "עבור למסד הגיבוי" (lib/backupCommand.js) מקפיצה חלונית אישור, ואחרי אישור
// רק המחשב הזה עובר למסד הגיבוי (POST /api/admin/db-view; עוגייה חתומה, ר' lib/deviceDbView.js).
// זה מופעל רק למי שמורשה (מתכנת, או עובד שהמתכנת סימן ב-lib/deviceBackupAccess.js): לכל אחד אחר הפונקציה מחזירה false והטקסט
// ממשיך כחיפוש רגיל - בלי שום רמז שהפקודה קיימת.
// tryHandle(text) -> true אם הטקסט טופל כפקודה (גם אם המשתמש ביטל): הקורא לא מריץ חיפוש.
export default function useBackupSwitchCommand() {
  const { showConfirm, showAlert } = usePopup() || {};

  return useCallback(async (text) => {
    if (!showConfirm || !isBackupSwitchCommand(text)) return false;
    let st = null;
    try {
      const res = await fetch('/api/admin/db-view', { cache: 'no-store' });
      st = res.ok ? await res.json() : null;
    } catch { st = null; }
    // לא מורשה / אין מסד גיבוי / המחשב כבר בגיבוי -> חיפוש רגיל
    if (!st || !st.canEnable || !st.available || st.device === 'backup') return false;

    const ok = await showConfirm(
      'המחשב הזה (רק הוא) יעבור להציג ולשמור נתונים על מסד הגיבוי — נתונים שאינם האמיתיים. שאר המחשבים ימשיכו לראות את הנתונים האמיתיים. '
      + 'ההתחברות תיבדק מחדש מול מסד הגיבוי, והמצב יחזור לבד לנתונים האמיתיים אחרי יממה (או מיד בלחיצה על "חזרה לנתונים האמיתיים" בפס האדום). להמשיך?',
      'מעבר למסד הגיבוי במחשב הזה',
    );
    if (!ok) return true;

    try {
      const res = await fetch('/api/admin/db-view', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'backup' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      try { window.sessionStorage.clear(); } catch { /* מצב פרטי */ }
      window.location.reload(); // מטמוני הלקוח שייכים למסד הקודם
    } catch (e) {
      showAlert(e.message || 'המעבר למסד הגיבוי נכשל');
    }
    return true;
  }, [showConfirm, showAlert]);
}
