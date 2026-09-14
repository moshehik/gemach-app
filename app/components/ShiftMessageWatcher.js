'use client';

import { useEffect, useRef } from 'react';
import { usePopup } from './PopupProvider';

// דיווח משתמשת (f8a11b55, 2026-09-10): הודעת "בין משמרות" (Notification.category
// === 'shift_handover') כבר ניתנת לכתיבה/סימון-טופל דרך /messages, אבל לא הופיעה
// אוטומטית לעובד אחר בכניסה - זה בדיוק מה שהיה חסר. רכיב זה מותקן פעם אחת בתוך
// AppShell (באותו תבנית כמו OverdueRemindersWatcher) כך שריענון מלא אחרי התחברות
// (LoginScreen) כבר מספק "בכניסה" בלי הוק נפרד. "אישור" בדיאלוג מסמן טופל; "ביטול"
// משאיר את ההודעה פתוחה כדי שתקפוץ שוב לעובד/ת הבא/ה שיכנס - זה בדיוק המנגנון
// שהמדווחת ביקשה ("תפסיק לקפוץ רק לאחר שעובד כלשהו יסמן טופל").
export default function ShiftMessageWatcher({ authToken }) {
  const { showConfirm } = usePopup();
  const shownOnceRef = useRef(false);

  useEffect(() => {
    if (!authToken) return undefined;

    let cancelled = false;
    const checkAndPrompt = async () => {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data.success) return;

        const pending = (data.notifications || []).filter(
          (n) => n.category === 'shift_handover' && !n.handledAt
        );

        for (const note of pending) {
          if (cancelled) return;
          const senderName = note.sender
            ? `${note.sender.firstName} ${note.sender.lastName}`
            : 'עובד/ת';
          const confirmed = await showConfirm(
            `${note.content}\n\n(מאת ${senderName}) — לסמן כטופל?`,
            'הודעה למשמרת הבאה'
          );
          if (cancelled) return;
          if (confirmed) {
            await fetch('/api/notifications/handle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ notificationId: note.id, handled: true }),
            }).catch(() => {});
          }
        }
      } catch (e) {
        // best-effort בלבד - לא חוסם כלום אם השרת/הרשת לא זמינים כרגע.
      }
    };

    if (!shownOnceRef.current) {
      shownOnceRef.current = true;
      checkAndPrompt();
    }

    return () => {
      cancelled = true;
    };
  }, [authToken, showConfirm]);

  return null;
}
