// lib/schedule/print/repairItems.js — עזרי פריט משותפים לדפי התיקונים וההכנה (03, 04, 08, 09). טהור, בלי DB.
//
// * תווית דגם: "שם דגם - קידומת" (כמו d.lab בעיצוב: "תחרה קלאסית - 4512"); חסר שם = הקידומת, חסרה קידומת = השם.
// * תיקון: אותו כלל כמו /print/alterations (lengthAltOf) ו-lib/schedule/loaders.js - ערכי legacy '' / 'null' / '0' = אין תיקון.
// * מספר הפריט בברקוד (REP-40113-2, PRP-40113-2): n = המקום הסידורי (1..k) של הפריט בהזמנה כשהפריטים הלא-מחוקים
//   ממוינים לפי id של הפריט (extras.itemInfo, lib/schedule/print/extras/itemInfo.js). כשה-extra חסר (בדיקות, שגיאה)
//   n = המקום בשורת השלב + 1 - ר' seqOf. אותו כלל חייב לשמש את הסורק כשיבנה (פענוח REP-<הזמנה>-<n>).
import { customerName, customerPhones } from './format';

export function modelLabel(item) {
  const name = (item && item.model ? String(item.model) : '').trim();
  const prefix = item && item.modelPrefix !== null && item.modelPrefix !== undefined && item.modelPrefix !== '' ? String(item.modelPrefix) : '';
  if (name && prefix) return name + ' - ' + prefix;
  return name || prefix || 'דגם לא ידוע';
}

/** ערך אורך אמיתי או '' (legacy '', 'null', '0' = אין) */
export function lengthAlt(v) {
  const s = (v ?? '').toString().trim();
  return !s || s === 'null' || s === '0' ? '' : s;
}

/** תיקוני פריט כמספרים/טקסט: { neck:number, len:string, sleeve:number, det:string } */
export function alterationOf(item) {
  const neck = Number(item && item.neckAlteration) > 0 ? Number(item.neckAlteration) : 0;
  const sleeve = Number(item && item.sleeveAlteration) > 0 ? Number(item.sleeveAlteration) : 0;
  return { neck, len: lengthAlt(item && item.lengthAlteration), sleeve, det: ((item && item.alterationDetails) || '').toString().trim() };
}

export function hasAlteration(item) {
  const a = alterationOf(item);
  return !!(a.neck || a.len || a.sleeve);
}

/** "צוואר: הצרה 2 | אורך: קיצור 4 | שרוול: הארכה 3" (כמו תווית התופרות הקיימת) */
export function repairText(a) {
  return [a.neck ? 'צוואר: הצרה ' + a.neck : '', a.len ? 'אורך: ' + a.len : '', a.sleeve ? 'שרוול: הארכה ' + a.sleeve : ''].filter(Boolean).join(' | ');
}

/** מספר הפריט בברקוד: מה-extra אם יש, אחרת המקום בשורת השלב (pos מתחיל ב-0) */
export function seqOf(extras, orderId, orderItemId, pos) {
  const m = extras && extras.itemInfo && extras.itemInfo[orderId];
  const hit = m && orderItemId !== undefined && orderItemId !== null ? m[orderItemId] : null;
  return hit && hit.n ? hit.n : pos + 1;
}

/** האם להזמנה יש תיקון כלשהו לפי extras.itemInfo (שלב ההכנה לא נושא תיקונים) */
export function orderHasAlteration(extras, orderId) {
  const m = extras && extras.itemInfo && extras.itemInfo[orderId];
  return !!m && Object.values(m).some((x) => x.alt);
}

/** שורות שלב -> מערך שטוח של פריטים עם הקשר ההזמנה (בדף תיקונים: רק פריטים שטרם בוצעו, כמו alterations_pending) */
export function stageRows(day, key) {
  const stage = ((day && day.stages) || []).find((s) => s.key === key);
  return stage ? stage.items : [];
}

export function rowIdentity(r) {
  return { orderId: r.orderId, name: customerName(r.customer), phone: customerPhones(r.customer)[0] || '', eventKey: r.eventKey || null };
}

/** השוואת מידות: מספרית כשאפשר (36 < 38 < 100), אחרת עברית */
export function sizeCompare(a, b) {
  return String(a ?? '').localeCompare(String(b ?? ''), 'he', { numeric: true });
}
/** חלוקה לקבוצות של size (מדבקות: 18 בעמוד) */
export function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export const heCompare = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'he', { numeric: true });
