// Notification.readBy / Notification.archivedBy are scalar String columns
// (default "[]") holding a JSON-encoded array of employeeIds as text.
// They are NOT native Prisma list fields, so plain application-level
// JSON parse/stringify must be used instead of the `push`/`set` list operators.

/**
 * Parse a Notification.readBy / archivedBy string column into an array of employeeIds.
 * Defensive against null, empty string, or malformed JSON.
 */
export function parseIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// --- עזרים טהורים לפעולות "סמן הכל כנקרא" / "ניקוי" (POST /api/notifications/read|archive עם { all: true }) ---
// בלי prisma ובלי Next, כדי שאפשר לבדוק אותם ב-node רגיל (scripts/test_shell_endpoints.mjs).

/** אותו חלון בדיוק כמו GET /api/notifications (take: 150): "הכל" = מה שהפעמון ומרכז ההודעות יכולים להציג. */
export const NOTIFICATIONS_LIST_WINDOW = 150;

/**
 * מוסיף employeeId לרשימת מזהים מקודדת (readBy / archivedBy). מחזיר { changed, next } —
 * next הוא המחרוזת החדשה לכתיבה; changed=false כשהמזהה כבר שם (אין מה לכתוב).
 */
export function addIdToList(raw, employeeId) {
  const list = parseIdList(raw);
  if (list.includes(employeeId)) return { changed: false, next: raw };
  return { changed: true, next: JSON.stringify([...list, employeeId]) };
}

/** מסיר employeeId מרשימת מזהים מקודדת. changed=false כשהוא לא היה שם. */
export function removeIdFromList(raw, employeeId) {
  const list = parseIdList(raw);
  if (!list.includes(employeeId)) return { changed: false, next: raw };
  return { changed: true, next: JSON.stringify(list.filter((id) => id !== employeeId)) };
}

/**
 * מתכנן את העדכונים הדרושים להודעות כלליות (receiverId=null): לכל שורה שצריכה שינוי מחזיר
 * { id, from, to } — from = הערך שנקרא (ל-compare-and-swap), to = הערך החדש.
 * @param {Array<{id:string}>} rows  שורות עם העמודה הנתונה
 * @param {string} employeeId
 * @param {'readBy'|'archivedBy'} field
 * @param {boolean} add  true = להוסיף את העובד לרשימה, false = להסיר
 */
export function planIdListUpdates(rows, employeeId, field, add) {
  const out = [];
  if (!Array.isArray(rows) || !employeeId) return out;
  for (const row of rows) {
    if (!row || typeof row !== 'object' || typeof row.id !== 'string') continue;
    const r = add ? addIdToList(row[field], employeeId) : removeIdFromList(row[field], employeeId);
    if (r.changed) out.push({ id: row.id, from: row[field], to: r.next });
  }
  return out;
}

/**
 * מפרש את גוף הבקשה של POST /api/notifications/read ו-/archive:
 *   { notificationId }           → { mode: 'one', notificationId }          (ההתנהגות הקיימת, ללא שינוי)
 *   { all: true }                → { mode: 'all' }                           (חדש: כל ההודעות של העובד המחובר)
 *   אחרת / שניהם יחד / all שאינו בדיוק true → { error }  (400)
 * `archive` (ל-/archive בלבד) נשאר כפי שהוא בגוף; הקורא מפרש אותו.
 */
export function parseNotificationActionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'notificationId is required' };
  const hasId = !!body.notificationId; // כמו הבדיקה המקורית `if (!notificationId)` — ערך ריק/falsy = חסר
  const hasAll = body.all !== undefined;
  if (hasAll && hasId) return { error: 'Send either notificationId or all:true, not both' };
  if (hasAll) {
    if (body.all !== true) return { error: 'all must be exactly true' };
    return { mode: 'all' };
  }
  if (!hasId) return { error: 'notificationId is required' };
  return { mode: 'one', notificationId: body.notificationId };
}
