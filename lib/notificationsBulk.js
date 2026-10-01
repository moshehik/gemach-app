// lib/notificationsBulk.js — "סמן הכל כנקרא" / "ניקוי" (ארכיון) לכל ההודעות של העובד המחובר.
// משרת את POST /api/notifications/read ו-/archive עם { all: true } (פעמון התפריט החדש, Q6 ב-DECISIONS-תפריט.md).
//
// מקבל לקוח prisma כפרמטר (duck-typed) ולא מייבא אותו — כדי שאפשר לבדוק את הלוגיקה ב-node רגיל עם לקוח
// מזויף (scripts/test_shell_endpoints.mjs), ובלי `@/` כדי שהבדיקה תוכל לייבא ישירות.
//
// מה נחשב "הכל":
//   * אישיות (receiverId = העובד): כל השורות, בלי חלון — updateMany אחד.
//   * כלליות (receiverId = null): readBy / archivedBy הן עמודות טקסט עם JSON של מזהים (lib/notificationLists.js),
//     ולכן אין updateMany אחד שמוסיף מזהה; קוראים את NOTIFICATIONS_LIST_WINDOW (150) השורות החדשות — אותו חלון
//     בדיוק שהפעמון ומרכז ההודעות מציגים (GET /api/notifications, take: 150) — וכותבים כל שורה שצריכה שינוי
//     ב-compare-and-swap (where: { id, readBy: הערך שנקרא }); שורה שהשתנתה בינתיים (עובד אחר סימן אותה) נקראת
//     שוב ונכתבת שוב, עד MAX_ATTEMPTS. כך לא דורסים סימון של עובד אחר.
//   * הכתיבות ב-updateMany עוקפות את הרחבת ה-AuditLog ב-app/lib/prisma.js — בכוונה: "קראתי" / "העברתי לארכיון"
//     אינן היסטוריה עסקית (הוסכם בתוכנית הבנייה, סעיף 3.3), ו-150 שורות יומן על לחיצה אחת היו רעש. ללא רישום ידני.
//     זו סטייה מכוונת מההערה ב-app/lib/prisma.js (getActingEmployeeId: "ראוטים עם updateMany רושמים שורות יומן
//     בעצמם") — אושרה בסקירה (REVIEW-V1-endpoints S6). סימון הודעה בודדת (המסלול הישן, prisma.update) עדיין נרשם.
//   * אין טרנזקציה (ר' MEMORY: בלי קריאות בתוך $transaction, וטרנזקציה של 150 כתיבות מול Neon עוברת את 5 השניות);
//     הכתיבות רצות במנות של CONCURRENCY במקביל, כדי לא למצות את מאגר החיבורים.
// ארכיון = לא מחיקה: ההודעות נשארות בלשונית "ארכיון" במרכז ההודעות (/messages).

import { NOTIFICATIONS_LIST_WINDOW, planIdListUpdates } from './notificationLists.js';

export const BULK_MAX_ATTEMPTS = 3;
export const BULK_CONCURRENCY = 8;

async function runInBatches(items, size, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    out.push(...(await Promise.all(chunk.map(fn))));
  }
  return out;
}

/**
 * מעדכן את עמודת הרשימה (readBy / archivedBy) של ההודעות הכלליות בחלון, ב-CAS עם ניסיונות חוזרים.
 * @returns {{ updated: number, conflicts: number }} conflicts = שורות שלא נכתבו גם אחרי כל הניסיונות (נדיר)
 */
async function updateGlobalIdList(prisma, employeeId, field, add, { window = NOTIFICATIONS_LIST_WINDOW, maxAttempts = BULK_MAX_ATTEMPTS, concurrency = BULK_CONCURRENCY } = {}) {
  let rows = await prisma.notification.findMany({
    where: { receiverId: null },
    select: { id: true, [field]: true },
    orderBy: { createdAt: 'desc' },
    take: window,
  });
  let updated = 0;
  let pending = planIdListUpdates(rows, employeeId, field, add);
  for (let attempt = 1; attempt <= maxAttempts && pending.length; attempt++) {
    const results = await runInBatches(pending, concurrency, async (u) => {
      const res = await prisma.notification.updateMany({
        where: { id: u.id, [field]: u.from },
        data: { [field]: u.to },
      });
      return { id: u.id, ok: !!res && res.count === 1 };
    });
    updated += results.filter((r) => r.ok).length;
    const failedIds = results.filter((r) => !r.ok).map((r) => r.id);
    if (!failedIds.length) { pending = []; break; }
    // מישהו שינה את השורה בינתיים — קוראים את הערך העדכני ומנסים שוב רק אותה
    rows = await prisma.notification.findMany({ where: { id: { in: failedIds }, receiverId: null }, select: { id: true, [field]: true } });
    pending = planIdListUpdates(rows, employeeId, field, add);
  }
  return { updated, conflicts: pending.length };
}

/**
 * מסמן כנקראו את כל ההודעות של העובד: האישיות (updateMany) והכלליות בחלון (readBy).
 * @returns {{ personal: number, global: number, conflicts: number }}
 */
export async function markAllNotificationsRead(prisma, employeeId, opts) {
  if (!employeeId) throw new Error('employeeId is required');
  const personal = await prisma.notification.updateMany({
    where: { receiverId: employeeId, isRead: false },
    data: { isRead: true },
  });
  const g = await updateGlobalIdList(prisma, employeeId, 'readBy', true, opts);
  return { personal: personal && typeof personal.count === 'number' ? personal.count : 0, global: g.updated, conflicts: g.conflicts };
}

/**
 * מעביר לארכיון (archive=true) או מחזיר מהארכיון (archive=false) את כל ההודעות של העובד:
 * האישיות (isArchived) והכלליות בחלון (archivedBy). לא מוחק כלום.
 * @returns {{ personal: number, global: number, conflicts: number }}
 */
export async function archiveAllNotifications(prisma, employeeId, archive = true, opts) {
  if (!employeeId) throw new Error('employeeId is required');
  const doArchive = archive !== false;
  const personal = await prisma.notification.updateMany({
    where: { receiverId: employeeId, isArchived: !doArchive },
    data: { isArchived: doArchive },
  });
  const g = await updateGlobalIdList(prisma, employeeId, 'archivedBy', doArchive, opts);
  return { personal: personal && typeof personal.count === 'number' ? personal.count : 0, global: g.updated, conflicts: g.conflicts };
}
