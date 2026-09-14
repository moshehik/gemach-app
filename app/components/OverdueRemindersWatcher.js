'use client';

import { useEffect } from 'react';

const HOUR_MS = 60 * 60 * 1000;
const LAST_SHOWN_KEY = 'overdueRemindersLastShownAt';

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
// הטאב פתוח. משתמשים ב-window.customConfirm (דיאלוג חוסם, לא נעלם לבד) ולא
// ב-alert הרגיל - בדיוק כמו ב-UserMenu.js:handleLogout לאותה הודעה עצמה -
// כי alert מיורט ל-toast שנעלם אוטומטית אחרי 4 שניות (PopupProvider.showAlert),
// קצר מדי לרשימה של עשרות משפחות (דיווח 2bda255f, 2026-09-14).
//
// דיווח 30e2cf4f (2026-09-14): "האם מסמנת אישור הוא ממשיך להציג לי אותם" - התברר
// (לפי תשובת המשתמשת) שזה קורה מיד אחרי ריענון ידני של הדף (F5/רענון), לא סתם
// שוב באותה טעינה. "הוצג פעם אחת" נשמר בעבר ב-ref בתוך הרכיב (shownOnceRef) -
// ריענון מלא של הדף ממחזר את כל הרכיב מחדש כולל ה-ref, כך שהתזכורת עלתה שוב
// מיד למרות שהרשימה לא השתנתה. עברנו ל-sessionStorage (שורד ריענון דף, נמחק רק
// כשהטאב/חלון נסגר) כדי שריענון לא יגרום לה לקפוץ שוב לפני שעבר שעה בפועל,
// בלי לפגוע בכוונה המקורית: כניסה חדשה (טאב/חלון חדש) עדיין מציגה מיד, וכל שעה
// היא עדיין מוצגת מחדש כל עוד יש איחורים.
export default function OverdueRemindersWatcher({ authToken }) {
  useEffect(() => {
    if (!authToken) return undefined;

    let cancelled = false;
    const checkAndAlert = async () => {
      try {
        const lastShownAt = Number(sessionStorage.getItem(LAST_SHOWN_KEY) || 0);
        if (Date.now() - lastShownAt < HOUR_MS) return;
        const res = await fetch('/api/orders/overdue', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (Array.isArray(data.orders) && data.orders.length > 0) {
          sessionStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
          await window.customConfirm(buildMessage(data.orders), 'הזמנות באיחור');
        }
      } catch (e) {
        // best-effort בלבד - לא חוסם כלום אם השרת/הרשת לא זמינים כרגע.
      }
    };

    checkAndAlert();

    const interval = setInterval(checkAndAlert, HOUR_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authToken]);

  return null;
}
