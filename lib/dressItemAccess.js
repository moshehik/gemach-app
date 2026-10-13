// lib/dressItemAccess.js - מי רשאי לנהל פריטי דגם (DressItem): הוספה, עריכה (מיקום / קרטון / בתיקון / לא בשימוש), מחיקה ושחזור.
// החלטת הבעלים 11.10.2026 (D1 ב-docs/a5-staff-models/security-audit.md): "רק הנהלה - ועל פי ההרשאות הספציפיות שניתן להגדיר".
// ההרשאה היא פריט קטלוג רגיל, feature:dress_items_manage (lib/permissionsMetadata.js): ברירת מחדל סגורה, הנהלה ראשית ומתכנת תמיד מורשים,
// כל גישה אחרת מגיעה מחריגה אישית בכרטיס העובד או משורת הרשאה ב-/admin/permissions (אותו מנגנון כמו שאר ההרשאות - hasPermission).
// ההכרעה בשרת בלבד, מהעוגייה החתומה (getSessionEmployee) - לא ממה שהלקוח שולח. כשל בבדיקה = סגור.
// לא נכלל כאן (ונשאר פתוח בכוונה): עדכוני מיקום/סטטוס של DressItem שנגזרים מזרימות הזמנה - השכרה, החזרה, ביטול החזרה, סימוני הלו"ז היומי
// (POST /api/rentals/confirm, /api/rentals/scan, /api/returns/scan, lib/schedule/marks.js). אלה אינם ניהול קטלוג אלא תוצאה של פעולה בהזמנה.
import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export const DRESS_ITEMS_MANAGE_KEY = 'feature:dress_items_manage';
export const DRESS_ITEMS_FORBIDDEN_MESSAGE = 'נדרשת הרשאת "ניהול פריטי דגם (הוספה, עריכה ומחיקה)" - אפשר לבקש אותה מההנהלה.';
export const DRESS_ITEMS_LOGIN_MESSAGE = 'יש להתחבר כדי לנהל פריטי דגם';

// הכרעה טהורה (נבדקת ב-node): authed = checkAuth() עבר; employee = העובד מהעוגייה החתומה (פעיל) או null; allowed = hasPermission.
export function decideDressItemAccess({ authed, employee, allowed }) {
  if (!authed) return { ok: false, status: 401, error: 'Unauthorized' };
  if (!employee) return { ok: false, status: 401, error: DRESS_ITEMS_LOGIN_MESSAGE }; // אורח במצב פתוח / עוגייה של עובד שנמחק או הושבת
  if (!allowed) return { ok: false, status: 403, error: DRESS_ITEMS_FORBIDDEN_MESSAGE };
  return { ok: true };
}

// בתחילת כל מטפל שיוצר / עורך / מוחק / משחזר DressItem: `const denied = await requireDressItemManager(); if (denied) return denied;`
export async function requireDressItemManager() {
  let authed = false;
  let employee = null;
  let allowed = false;
  try {
    authed = !!(await checkAuth());
    if (authed) {
      employee = await getSessionEmployee();
      allowed = employee ? !!(await hasPermission(employee, DRESS_ITEMS_MANAGE_KEY)) : false;
    }
  } catch (error) {
    console.error('requireDressItemManager error:', error);
    allowed = false; // כשל = סגור
  }
  const d = decideDressItemAccess({ authed, employee, allowed });
  return d.ok ? null : NextResponse.json({ error: d.error }, { status: d.status });
}

// ---- העברה מהירה של ברקודים (docs/branches-plan.md, שלב ב): סניף / מחסן / רזרבה / קרטון ----
// החלטת הבעלים 12.10.2026: "כל מי שיש לה הרשאות מלאי" - לא ההרשאה לניהול הפריט עצמו (feature:dress_items_manage), ובלי הרשאה חדשה.
// ההרשאה הקיימת של מסכי המלאי היא page:dresses_catalog (קטלוג שמלות: דגמים ופריטים, כרטיס הדגם; הנהלה ראשית ומתכנת תמיד, אחרים לפי שורת הרשאה).
// להחלפה לפריט אחר (למשל page:orders, השער של בדיקת מלאי) - לשנות את הקבוע הזה בלבד.
export const ITEM_TRANSFER_PERMISSION_KEY = 'page:dresses_catalog';
export const ITEM_TRANSFER_FORBIDDEN_MESSAGE = 'נדרשת הרשאת מלאי (קטלוג שמלות) כדי להעביר פריטים - אפשר לבקש אותה מההנהלה.';

// בתחילת מטפל ההעברה המהירה: `const denied = await requireItemTransferAccess(); if (denied) return denied;`. עובד מחובר בלבד (נרשם ביומן), כשל = סגור.
export async function requireItemTransferAccess() {
  let authed = false;
  let employee = null;
  let allowed = false;
  try {
    authed = !!(await checkAuth());
    if (authed) {
      employee = await getSessionEmployee();
      allowed = employee ? !!(await hasPermission(employee, ITEM_TRANSFER_PERMISSION_KEY)) : false;
    }
  } catch (error) {
    console.error('requireItemTransferAccess error:', error);
    allowed = false;
  }
  if (!authed) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!employee) return NextResponse.json({ error: DRESS_ITEMS_LOGIN_MESSAGE }, { status: 401 });
  if (!allowed) return NextResponse.json({ error: ITEM_TRANSFER_FORBIDDEN_MESSAGE }, { status: 403 });
  return null;
}
