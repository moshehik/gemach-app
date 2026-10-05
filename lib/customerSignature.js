// חתימה על התקנון ברמת הלקוח (Customer.hasSignedRegulations / Customer.regulationsSignedAt) - הלוגיקה הטהורה והשרתית.
// בלי imports ובלי תלות ב-React: ה-API (app/api/customers, app/api/orders/[id]) והבדיקות (scripts/customer-signature-tests) משתמשים בה.
//
// כללים (docs/customer-signature-rollout-2026-10-05.md):
//  1. regulationsSignedAt מחושב בשרת בלבד ('now' מהשרת). שום ערך מהלקוח (גוף הבקשה) לא נקרא לעולם.
//  2. סימון (false->true): נכתבים הדגל + החותמת. ביטול (true->false): נכתב רק הדגל - החותמת נשארת כ"נחתמה לאחרונה" ומשמשת
//     סימן ש"הביטול מכוון": הכרטיס לא יחזור ויציג חתימה נגזרת מהזמנות כשיש חותמת (ר' signatureState ב-customerCardLogic.js).
//  3. בלי שינוי בדגל - לא נוגעים בכלום (גם לא בחותמת).
//  4. רק הכרטיס החדש (cardVariant:'a5') **עם סימון מפורש** signatureEdit:true כותב דגל חתימה דרך PUT/POST. הכרטיס הישן (וכרטיס חדש
//     שרץ ב-JS ישן בלשונית פתוחה) שולח את כל אובייקט הלקוח כולל הדגל כפי שנטען - ערך ישן שלו היה דורס/מבטל חתימה שנרשמה בינתיים
//     (ה-409 על updatedAt לא תופס: ה-backfill הוא SQL גולמי בלי עדכון updatedAt). לכן hasSignedRegulations פשוט בגוף נתעלם ממנו תמיד;
//     הכרטיס החדש שולח אותו רק כשהמשתמשת שינתה את החתימה בטיוטה (buildSavePayload ב-customerCardLogic.js).
//  5. חתימה בהזמנה (Order.hasSignedRegulations עובר false->true) מסמנת גם את הלקוח, רק אם הוא עוד לא חתום.

export const SIGNATURE_FIELDS = ['hasSignedRegulations', 'regulationsSignedAt'];

/** true/false מהגוף, undefined כשלא נשלח / בלי סימון עריכה מפורש, 'invalid' כשהערך אינו בוליאני (השרת מחזיר 400 במקום לנחש). */
export function readSignatureFlag(body) {
  if (!body || typeof body !== 'object' || body.cardVariant !== 'a5' || body.signatureEdit !== true) return undefined;
  const v = body.hasSignedRegulations;
  if (v === undefined) return undefined;
  return typeof v === 'boolean' ? v : 'invalid';
}

/**
 * התוכנית לכתיבת החתימה. requested: true/false/undefined. current: שורת הלקוח השמורה ({hasSignedRegulations}) או null ליצירה.
 * מחזיר null כשאין מה לכתוב, אחרת {data, changes}: data נכנס ל-Prisma data; changes הוא הפירוט "לפני ← אחרי" ליומן
 * (שורה אחת בלבד: "חתימה על התקנון"; מועד החתימה לא נרשם בנפרד).
 */
export function planSignatureWrite({ requested, current, now = new Date() }) {
  if (requested !== true && requested !== false) return null;
  const was = !!(current && current.hasSignedRegulations);
  if (requested === was) return null;
  const data = requested ? { hasSignedRegulations: true, regulationsSignedAt: now } : { hasSignedRegulations: false };
  return { data, changes: { hasSignedRegulations: { from: was, to: requested } } };
}

/** האם ה-client של Prisma / ה-DB מכירים את העמודות (קליינט ישן או DB מקומי בלי העמודות = false). */
export const customerRowHasSignatureColumns = (row) => !!row && typeof row.hasSignedRegulations === 'boolean';

/**
 * סנכרון מהזמנה: נקרא אחרי שמירת הזמנה (מחוץ ל-$transaction - בלי קריאות בתוך טרנזקציה). מסמן את הלקוח כחתום רק כשההזמנה
 * עברה עכשיו false->true והלקוח עוד לא חתום. כשל כאן לעולם לא מכשיל שמירת הזמנה (המחזיר {ok:false}, ללא throw).
 * deps: { prisma, auditAs } מוזרקים כדי שאפשר לבדוק בלי DB. הכתיבה עוברת ב-update רגיל + auditAs כך שנרשמת שורת יומן אחת
 * על הלקוח (updateMany לא עובר דרך תוסף היומן).
 */
export async function syncCustomerSignatureFromOrder({ prisma, auditAs, customerId, orderWasSigned, orderIsSigned, orderIsDeleted = false, now = new Date() }) {
  if (!customerId || orderIsSigned !== true || orderWasSigned === true) return { ok: true, synced: false, reason: 'no-transition' };
  // רק הזמנה פעילה סופרת (אותו כלל כמו ה-backfill וכמו signatureState): הזמנה מחוקה/מבוטלת לא מסמנת את הלקוחה
  if (orderIsDeleted) return { ok: true, synced: false, reason: 'order-deleted' };
  try {
    const cust = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true, isDeleted: true, hasSignedRegulations: true } });
    if (!cust) return { ok: true, synced: false, reason: 'no-customer' };
    if (cust.isDeleted) return { ok: true, synced: false, reason: 'customer-deleted' };
    if (!customerRowHasSignatureColumns(cust)) return { ok: true, synced: false, reason: 'columns-unavailable' };
    const plan = planSignatureWrite({ requested: true, current: cust, now });
    if (!plan) return { ok: true, synced: false, reason: 'already-signed' };
    await prisma.customer.update(auditAs('UPDATE', { where: { id: customerId }, data: plan.data }, plan.changes));
    return { ok: true, synced: true };
  } catch (error) {
    console.error('customer signature sync from order failed (order save is unaffected):', error);
    return { ok: false, synced: false, reason: 'error' };
  }
}
