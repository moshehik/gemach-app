'use client';

import { useEffect, useState } from 'react';
import OverdueOrdersModal from './OverdueOrdersModal';

const HOUR_MS = 60 * 60 * 1000;
const LAST_SHOWN_KEY = 'overdueRemindersLastShownAt';

// דיווח משתמשת (749aaf87, 2026-09-09): "כשעובדת נכנסת... יקפוץ לה המשפחות שעדיין
// באיחור ולא החזירו, וכן כל שעה להקפיץ תזכורת". רכיב זה מותקן פעם אחת בתוך
// AppShell (רק כשמחוברים - authToken, וכן רק כשמופעל בהגדרות - ר' showOverdueRemindersPopup/
// enable_unreturned_orders_popup ב-app/layout.js, שמופעל רק בגמח נווה יעקב), כך
// שההתקנה הראשונה שלו אחרי ריענון מלא (LoginScreen תמיד עושה window.location.href/reload
// בהצלחה - ר' LoginScreen.js) כבר מספקת את "בכניסה" בלי הוק נפרד, ואז setInterval
// שעתי ממשיך מזה כל עוד הטאב פתוח.
//
// דיווח 30e2cf4f (2026-09-14): "האם מסמנת אישור הוא ממשיך להציג לי אותם" - התברר
// (לפי תשובת המשתמשת) שזה קורה מיד אחרי ריענון ידני של הדף (F5/רענון), לא סתם
// שוב באותה טעינה. "הוצג פעם אחת" נשמר בעבר ב-ref בתוך הרכיב (shownOnceRef) -
// ריענון מלא של הדף ממחזר את כל הרכיב מחדש כולל ה-ref, כך שהתזכורת עלתה שוב
// מיד למרות שהרשימה לא השתנתה. עברנו ל-sessionStorage (שורד ריענון דף, נמחק רק
// כשהטאב/חלון נסגר) כדי שריענון לא יגרום לה לקפוץ שוב לפני שעבר שעה בפועל,
// בלי לפגוע בכוונה המקורית: כניסה חדשה (טאב/חלון חדש) עדיין מציגה מיד, וכל שעה
// היא עדיין מוצגת מחדש כל עוד יש איחורים.
//
// דיווח (2026-09-16): המרה מ-window.customConfirm הטקסטואלי למודל אמיתי
// (OverdueOrdersModal) כדי לאפשר מיון השורות לפי מספר הזמנה וקישור/אייקון נקי
// לכניסה לכל הזמנה - customConfirm (PopupProvider.js) מציג רק טקסט, ללא JSX.
export default function OverdueRemindersWatcher({ authToken }) {
  const [orders, setOrders] = useState(null);

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
          setOrders(data.orders);
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

  return (
    <OverdueOrdersModal isOpen={Array.isArray(orders) && orders.length > 0} orders={orders || []} onClose={() => setOrders(null)} />
  );
}
