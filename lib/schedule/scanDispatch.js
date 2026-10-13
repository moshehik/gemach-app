// lib/schedule/scanDispatch.js — מה עושה שורת הסריקה של הלו״ז (StageRail #scanIn) עם קוד שנסרק. טהור (בלי React / prisma) - נבדק ב-barcode-scan.test.mjs.
// docs/schedule-barcode-plan.md ח׳: שני סוגי קודים נכנסים לאותה שורה:
//   1. קוד שלב מהדף המודפס (PRP-40113 / DOT- / PCK- / MRT- / DBK- / REP-, או ALL-PRP-261014 "כל הדף") - lib/schedule/print/barcode.js parseScheduleCode;
//   2. ברקוד שמלה (ספרות בלבד, 5+) - מזין את ההזמנה ה"פעילה": החלונית הפתוחה, או ההזמנה שקוד השלב שלה נסרק אחרונה.
import { parseScheduleCode } from './print/barcode';
import { normalizeScannedBarcode, isDressBarcodeFormat } from './barcodeEntry';

/**
 * @param {string} raw
 * @returns {{kind:'stage-order', stageKey:string, orderId:number}
 *          |{kind:'stage-day', stageKey:string, dayKey:string}
 *          |{kind:'dress', barcode:string}
 *          |{kind:'none', reason:'empty'|'unknown'}}
 */
export function classifyScan(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return { kind: 'none', reason: 'empty' };
  const code = parseScheduleCode(text);
  if (code.kind === 'order' || code.kind === 'item') return { kind: 'stage-order', stageKey: code.stage, orderId: code.orderId };
  if (code.kind === 'day') return { kind: 'stage-day', stageKey: code.stage, dayKey: code.day };
  const bc = normalizeScannedBarcode(text);
  if (isDressBarcodeFormat(bc)) return { kind: 'dress', barcode: bc };
  return { kind: 'none', reason: 'unknown' };
}

/**
 * מוצא את השורה של קוד שלב בנתוני היום שמוצגים.
 * @param {{stages: Array<{key:string, items:object[]}>}|null} data  תשובת GET /api/schedule
 * @returns {{stage: object, row: object}|null}
 */
export function findRowForCode(data, stageKey, orderId) {
  if (!data || !Array.isArray(data.stages)) return null;
  const stage = data.stages.find((s) => s.key === stageKey);
  if (!stage || !Array.isArray(stage.items)) return null;
  const row = stage.items.find((r) => r.orderId === orderId);
  return row ? { stage, row } : null;
}

/**
 * החלטת הפעולה לקוד שלב של הזמנה בודדת, לפי מצב השורה בדף (בלי side effects).
 *  - 'not-shown'   ההזמנה לא בשלב הזה ביום המוצג
 *  - 'info-only'   שלב מידע (אין "בוצע")
 *  - 'already'     השורה כבר בוצעה
 *  - 'barcodes'    השורה דורשת ברקודים וחסרים - נפתחת חלונית הברקוד
 *  - 'confirm'     "בטוח?" ואז סימון בוצע
 */
export function decideStageScan(data, stageKey, orderId) {
  const found = findRowForCode(data, stageKey, orderId);
  if (!found) return { action: 'not-shown' };
  const { stage, row } = found;
  if (stage.infoOnly) return { action: 'info-only', stage, row };
  if (row.done === true) return { action: 'already', stage, row };
  const info = row.barcodeInfo;
  if (info && !info.complete) return { action: 'barcodes', stage, row };
  return { action: 'confirm', stage, row };
}
