'use client';

import { useEffect, useRef } from 'react';

const HOUR_MS = 60 * 60 * 1000;

const buildMessage = (orders) => {
  const lines = orders
    .slice(0, 20)
    .map((o) => `- ${o.customerName} (הזמנה #${o.orderId}) - ${o.daysLate} ימים באיחור`);
  const more = orders.length > 20 ? `\n... ועוד ${orders.length - 20} משפחות` : '';
  return `יש ${orders.length} משפחות שעדיין לא החזירו את השמלות ומועד ההחזרה שלהן עבר:\n\n${lines.join('\n')}${more}\n\nאפשר לראות את הרשימה המלאה בטאב "השכרות" (סינון "הוחזר חלקי"/"הכל").`;
};

// דיווח משתמשת (749aaf87, 2026-09-09): "כשעובדת נכנסת... יקפוץ לה המשפחות שעדיין
// באיחור ולא החזירו, וכן כל שעה להקפיץ תזכורת". רכיב זה מותקן פעם אחת בתוך
// AppShell (רק כשמחוברים - authToken), כך שההתקנה הראשונה שלו אחרי ריענון מלא
// (LoginScreen תמיד עושה window.location.href/reload בהצלחה - ר' LoginScreen.js)
// כבר מספקת את "בכניסה" בלי הוק נפרד, ואז setInterval שעתי ממשיך מזה כל עוד
// הטאב פתוח. window.alert מיורט על ידי PopupProvider לדיאלוג המותאם של המערכת.
export default function OverdueRemindersWatcher({ authToken }) {
  const shownOnceRef = useRef(false);

  useEffect(() => {
    if (!authToken) return undefined;

    let cancelled = false;
    const checkAndAlert = async () => {
      try {
        const res = await fetch('/api/orders/overdue', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.orders) && data.orders.length > 0) {
          alert(buildMessage(data.orders));
        }
      } catch (e) {
        // best-effort בלבד - לא חוסם כלום אם השרת/הרשת לא זמינים כרגע.
      }
    };

    if (!shownOnceRef.current) {
      shownOnceRef.current = true;
      checkAndAlert();
    }

    const interval = setInterval(checkAndAlert, HOUR_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken]);

  return null;
}
