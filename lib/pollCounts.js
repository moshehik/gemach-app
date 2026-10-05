// ============================================================================
// pollCounts.js - חישוב שני מוני "לא נקראו" לנקודת הקצה המאוחדת GET /api/poll
// ============================================================================
//
// מחליף (בלי למחוק) את שתי בדיקות ה-?light=1 הישנות - אותן הסמנטיקות בדיוק, ב-invocation אחד:
//   * דיווחי תקלות (היה: GET /api/error-report?light=1 + countUnread בלקוח, app/components/errorReport/erModel.js):
//       מתכנת (roleId 2) רואה את כל הדיווחים, כל השאר - רק את שלו (employeeId). "לא נקרא" = לא בארכיון ו-
//       (מתכנת: !isReadByProgrammer, אחר: !isReadByUser). כאן נספר ב-count() במקום למשוך כל שורה ולספור בלקוח
//       (כל השדות לא-nullable בסכימה, לכן status != 'ARCHIVED' זהה ל-JS; אין בעיית NULL).
//       isManager = hasPermission(employee, 'feature:error_reports') - אותה בדיקה כמו ב-route הישן (קובע אם מותר להגיש דיווח חדש).
//   * התראות (היה: GET /api/notifications?light=1): אותו where/orderBy/take 150 ואותו חישוב isRead/isArchived (הודעות כלליות
//       לפי readBy/archivedBy, אישיות לפי isRead/isArchived).
//
// הרשאות: המונה מוחזר רק לעובד המחובר עצמו (עוגיית auth_token חתומה, ר' app/api/poll/route.js) וסופר רק את מה שהוא רשאי לראות -
// בדיוק כמו בנתיבים הישנים. התפקיד (מתכנת/לא) נלקח מהטוקן החתום הטרי (readVerifiedSession, תקף 15 דקות - אותו מודל אמון כמו
// checkAuth) ובלעדיו מ-DB. isManager נשמר במטמון 30 שנ' (התוצאה משפיעה רק על הצגת כפתור "דיווח חדש"; POST /api/error-report
// בודק את ההרשאה שוב בשרת).
//
// כל התלויות מוזרקות (prisma, hasPermission, מטמון) - בדיקות עם prisma מזויף: scripts/poll-endpoint.test.mjs.
// ============================================================================

import { parseIdList } from './notificationLists.js';
import { pollCache } from './pollCache.js';

export function createPollService({ prisma, hasPermission, cache = pollCache } = {}) {
  async function computeErrorReports(employeeId, roleId) {
    const isProgrammer = roleId === 2;
    const where = {
      ...(isProgrammer ? {} : { employeeId }),
      status: { not: 'ARCHIVED' },
      ...(isProgrammer ? { isReadByProgrammer: false } : { isReadByUser: false }),
    };
    const [unread, isManager] = await Promise.all([
      prisma.errorReport.count({ where }),
      hasPermission({ id: employeeId, roleId }, 'feature:error_reports'),
    ]);
    return { unread, isProgrammer, isManager: !!isManager, roleId };
  }

  async function computeNotifications(employeeId) {
    const rows = await prisma.notification.findMany({
      where: { OR: [{ receiverId: employeeId }, { receiverId: null }] },
      select: { receiverId: true, isRead: true, isArchived: true, readBy: true, archivedBy: true },
      orderBy: { createdAt: 'desc' },
      take: 150,
    });
    const unread = rows.filter((n) => {
      const isGlobal = n.receiverId === null;
      const archived = isGlobal ? parseIdList(n.archivedBy).includes(employeeId) : n.isArchived;
      if (archived) return false;
      const read = isGlobal ? parseIdList(n.readBy).includes(employeeId) : n.isRead;
      return !read;
    }).length;
    return { unread };
  }

  /**
   * employeeId: מזהה העובד מהעוגייה החתומה. sessionRoleId: התפקיד מהטוקן החתום הטרי (או null = לא ידוע, יילקח מ-DB רק אם צריך).
   * fresh: עוקף מטמון (אחרי פעולה של המשתמש עצמו). מחזיר { status, body, limited }.
   */
  async function getPollCounts({ employeeId, sessionRoleId = null, fresh = false } = {}) {
    if (!employeeId) return { status: 401, body: { success: false, error: 'לא מורשה' }, limited: false };
    const limited = !cache.takeToken(employeeId);

    // ---- דיווחי תקלות ----
    const loadErrorReports = async () => {
      const hit = cache.get('er', employeeId);
      const roleOk = !hit || sessionRoleId === null || hit.value.roleId === sessionRoleId;
      if (hit && roleOk && ((hit.fresh && !fresh) || limited)) return { value: hit.value };
      let roleId = sessionRoleId;
      if (roleId === null) {
        const emp = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, roleId: true } });
        if (!emp) return { notFound: true };
        roleId = emp.roleId;
      }
      const value = await computeErrorReports(employeeId, roleId);
      cache.set('er', employeeId, value);
      return { value };
    };

    // ---- התראות ----
    const loadNotifications = async () => {
      const hit = cache.get('nf', employeeId);
      if (hit && ((hit.fresh && !fresh) || limited)) return hit.value;
      const value = await computeNotifications(employeeId);
      cache.set('nf', employeeId, value);
      return value;
    };

    const [erRes, nfRes] = await Promise.allSettled([loadErrorReports(), loadNotifications()]);
    if (erRes.status === 'fulfilled' && erRes.value.notFound) {
      return { status: 404, body: { success: false, error: 'משתמש לא נמצא' }, limited };
    }
    const er = erRes.status === 'fulfilled' ? erRes.value.value : null;
    const nf = nfRes.status === 'fulfilled' ? nfRes.value : null;
    if (!er && !nf) {
      const reason = erRes.status === 'rejected' ? erRes.reason : nfRes.reason;
      return { status: 500, body: { success: false, error: (reason && reason.message) || 'Internal Server Error' }, limited, error: reason };
    }
    return {
      status: 200,
      limited,
      body: {
        success: true,
        errorReports: er ? { unread: er.unread, isProgrammer: er.isProgrammer, isManager: er.isManager } : null,
        notifications: nf ? { unread: nf.unread } : null,
      },
    };
  }

  return { getPollCounts };
}
