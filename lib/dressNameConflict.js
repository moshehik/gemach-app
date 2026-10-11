// lib/dressNameConflict.js - שם דגם כפול (DressModel.name הוא UNIQUE במסד, כולל דגמים מחוקים רכות).
// עד 11.10.2026 יצירה / שינוי שם לשם שכבר קיים החזירו 500 כללי ("שגיאה ביצירת הדגם") בשני האשפים ובשני הכרטיסים. עכשיו הנתיבים
// POST /api/dresses ו-PUT /api/dresses/[id] בודקים לפני הכתיבה (findNameConflict) וממפים גם P2002 על name (מרוץ בין שתי יצירות) ל-400 ברור:
//   { error: 'דגם בשם «X» כבר קיים (קוד N)', field: 'name' }
//   { error: 'דגם בשם «X» קיים ברשימת המחוקים (קוד N) — אפשר לשחזר אותו', field: 'name' }
// ההודעה מוחזרת רק לקוראים שכבר עברו את שער ההנהלה הראשית של הנתיב (שם הדגם וקודו הם נתוני קטלוג רגילים; בלי שדות נוספים).
// הלוגיקה נטולת תלות ב-Next ובמסד (prisma מועבר כפרמטר) כדי שאפשר לבדוק אותה ב-node.

/** השוואה כפי שהמשתמש תופס אותה: בלי רווחים בקצוות ובלי הבדל בין אותיות לטיניות גדולות / קטנות. */
export function normalizeModelName(name) {
  return String(name == null ? '' : name).trim().toLowerCase();
}

/** הודעת השגיאה (עברית) לפי הדגם הקיים: { name, barcodePrefix, isDeleted }. */
export function buildDuplicateNameMessage(name, existing) {
  const label = `«${String(name == null ? '' : name).trim()}»`;
  const code = existing && existing.barcodePrefix != null ? ` (קוד ${existing.barcodePrefix})` : '';
  if (existing && existing.isDeleted) return `דגם בשם ${label} קיים ברשימת המחוקים${code} — אפשר לשחזר אותו`;
  return `דגם בשם ${label} כבר קיים${code}`;
}

/** גוף תשובת 400 אחיד (field מאפשר ללקוח להציג את ההודעה ליד שדה השם). */
export function duplicateNameBody(name, existing) {
  return { error: buildDuplicateNameMessage(name, existing), field: 'name' };
}

/** האם זו שגיאת unique של Prisma (P2002) על העמודה name של DressModel. */
export function isNameUniqueViolation(error) {
  if (!error || error.code !== 'P2002') return false;
  const target = error.meta && error.meta.target;
  const list = Array.isArray(target) ? target : target ? [String(target)] : [];
  if (list.length === 0) return true; // אין פירוט: ל-DressModel יש אילוץ unique אחד על שם (legacyId אינו נכתב מהנתיבים האלה)
  return list.some((t) => /(^|_)name(_|$)/i.test(String(t)));
}

/**
 * הדגם הקיים (פעיל קודם, אחרת מחוק) ששמו זהה לשם המבוקש - בדיוק (כפי שהמסד מתייחס אליו) או בלי רווחי קצוות / רישיות.
 * excludeId = הדגם הנערך (שינוי שם). null כשאין התנגשות או כשהשם ריק.
 */
export async function findNameConflict(prisma, name, excludeId) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (!trimmed) return null;
  const where = { OR: [{ name }, { name: { equals: trimmed, mode: 'insensitive' } }] };
  if (excludeId) where.id = { not: excludeId };
  return prisma.dressModel.findFirst({
    where,
    select: { id: true, name: true, barcodePrefix: true, isDeleted: true },
    orderBy: [{ isDeleted: 'asc' }],
  });
}
