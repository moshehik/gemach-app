'use client';

import { useEffect, useRef, useState } from 'react';
import OverdueOrdersModal from './OverdueOrdersModal';
import { useNoticeBar } from './menu/NoticeBar';
import { onActiveInterval } from '@/lib/idleGuard';
import { overdueCheckKey, isOverdueCheckFresh } from '@/lib/overdueReminders';

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
//
// המעטפת החדשה (A5, החלטה OD-16 + תצוגת העיצוב): במקום החלון - פס התראה כחול מתחת לסרגל העליון (menu/NoticeBar.js),
// עם שורה לחיצה לכל הזמנה. מעטפת ה-legacy ממשיכה להציג את החלון כמו קודם. הלוגיקה (שעה, sessionStorage, סף האיחור) זהה.
export const OVERDUE_NOTICE_ID = 'overdue-orders';

// מצב הפס (sessionStorage, לכל עובד): { at: מתי נשלף, orders, dismissedAt }. פס לא חוסם, ולכן ריענון דף מחזיר אותו מהמצב השמור
// (בלי בקשה חדשה) כל עוד לא נסגר בשעה האחרונה; סגירה (X) נזכרת שעה, ואז הבדיקה השעתית מציגה אותו שוב - "כל שעה להקפיץ תזכורת".
export const overdueBarKey = (authToken) => `overdueBarState:${authToken || ''}`;

export function buildOverdueNotice(orders, onClose) {
  const sorted = [...orders].sort((a, b) => a.orderId - b.orderId);
  return {
    id: OVERDUE_NOTICE_ID,
    kind: 'warning',
    title: `הזמנות שלא הוחזרו (${sorted.length})`,
    detail: 'מועד ההחזרה של המשפחות האלה עבר',
    rows: sorted.map((o) => ({
      icon: 'file',
      text: `הזמנה ${o.orderId} · ${o.customerName} · ${o.daysLate} ימי איחור`,
      href: `/orders/${o.orderId}`,
    })),
    onClose,
  };
}

export default function OverdueRemindersWatcher({ authToken }) {
  const [orders, setOrders] = useState(null);
  const bar = useNoticeBar();
  const barRef = useRef(bar);
  barRef.current = bar; // eslint-disable-line react-hooks/refs

  useEffect(() => {
    if (!authToken) return undefined;

    let cancelled = false;
    const barKey = overdueBarKey(authToken);
    const readBarState = () => {
      try { return JSON.parse(sessionStorage.getItem(barKey) || 'null'); } catch (e) { return null; }
    };
    const writeBarState = (st) => {
      try { sessionStorage.setItem(barKey, JSON.stringify(st)); } catch (e) { /* storage חסום - best-effort */ }
    };
    // המעטפת החדשה: פס התראה במקום חלון. אותה בדיקה שעתית, אבל מצב "נסגר" נשמר (ולא "הוצג"), כך שריענון לא מעלים את הפס ולא מקפיץ סתם.
    const checkBar = async () => {
      try {
        const st = readBarState();
        const fresh = st && Array.isArray(st.orders) && isOverdueCheckFresh(String(st.at));
        let orders = fresh ? st.orders : null;
        if (!fresh) {
          const res = await fetch('/api/orders/overdue', { cache: 'no-store' });
          if (!res.ok) return;
          const data = await res.json();
          if (cancelled) return;
          orders = Array.isArray(data.orders) ? data.orders : [];
          writeBarState({ at: Date.now(), orders, dismissedAt: null });
        }
        const dismissedAt = fresh ? Number(st.dismissedAt || 0) : 0;
        if (orders.length === 0 || (dismissedAt && Date.now() - dismissedAt < HOUR_MS)) {
          if (barRef.current) barRef.current.dismiss(OVERDUE_NOTICE_ID);
          return;
        }
        barRef.current.add(buildOverdueNotice(orders, () => {
          const cur = readBarState() || { at: Date.now(), orders };
          writeBarState({ ...cur, dismissedAt: Date.now() });
        }));
      } catch (e) {
        // best-effort בלבד - לא חוסם כלום אם השרת/הרשת לא זמינים כרגע.
      }
    };

    const checkAndAlert = async () => {
      if (barRef.current) return checkBar();
      try {
        const lastShownAt = Number(sessionStorage.getItem(LAST_SHOWN_KEY) || 0);
        if (Date.now() - lastShownAt < HOUR_MS) return;
        // cpu-phase0: בדיקה שנעשתה לפני פחות מ-55 דק' (גם אם לא נמצאו איחורים) לא חוזרת בכל טעינת דף. סימון לכל עובד.
        const checkKey = overdueCheckKey(authToken);
        let lastCheckedRaw = null;
        try { lastCheckedRaw = sessionStorage.getItem(checkKey); } catch (e) { /* storage חסום - בודקים כרגיל */ }
        if (isOverdueCheckFresh(lastCheckedRaw)) return;
        const res = await fetch('/api/orders/overdue', { cache: 'no-store' });
        if (!res.ok) return;
        try { sessionStorage.setItem(checkKey, String(Date.now())); } catch (e) { /* best-effort */ }
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

    // lib/idleGuard.js: טאב מוסתר / שנשכח פתוח לא שולף ולא מקפיץ חלונית לאף אחד; בחזרה - בדיקה אחת אם עברה שעה.
    const stopInterval = onActiveInterval(checkAndAlert, HOUR_MS);
    return () => {
      cancelled = true;
      stopInterval();
    };
  }, [authToken]);

  return (
    <OverdueOrdersModal isOpen={Array.isArray(orders) && orders.length > 0} orders={orders || []} onClose={() => setOrders(null)} />
  );
}
