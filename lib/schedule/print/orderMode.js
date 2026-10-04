// lib/schedule/print/orderMode.js — "מצב הזמנה בודדת" של דפי ההדפסה של הלו״ז (כרטיס הזמנה חדש, W7: A3 דף הכנה, A4 דף משלוח).
//
// `?orderId=N` ב-GET /api/schedule/print וב-/schedule/print/<PP-07|PP-12> מדפיס את אותו דף של הלו״ז, אבל להזמנה אחת בלבד
// ובלי קשר ליום: הדף נבנה מההזמנה עצמה (lib/schedule/print/singleOrder.js) ולא מרשימת היום. רק שני הדפים "הזמנה בכל עמוד":
//   PP-07 דף הכנה, גרסה ב׳ (ברקוד PRP-<הזמנה>) · PP-12 תעודת משלוח (ברקוד DOT-<הזמנה>, רק להזמנה עם משלוח הלוך).
// קובץ טהור (בלי Prisma/next): נטען גם בדפדפן (דף ההדפסה) וגם בבדיקות.
//
// רישום בהיסטוריה (W0 §1.5, AMB-20): כשיש orderId הדף עצמו רושם ORDER_PRINTED {doc:'prep'|'delivery', sheet, source:'print-page'}
// דרך POST /api/orders/events. הדפסות יום מרוכזות של הלו״ז (בלי orderId) לעולם לא נרשמות לכל הזמנה.

export const ORDER_MODE_PAGES = Object.freeze({
  'PP-07': Object.freeze({ doc: 'prep', version: 'b', stage: 'prep' }),
  'PP-12': Object.freeze({ doc: 'delivery', version: null, stage: 'dout' }),
});

/** מספר הזמנה מפרמטר כתובת: ספרות בלבד, 1..2147483647. null = אין/שגוי. */
export function parseOrderIdParam(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  if (!/^[1-9]\d{0,9}$/.test(s)) return null;
  const n = Number(s);
  return n <= 2147483647 ? n : null;
}

/** האם הערך (גם ריק/שגוי) בכלל "ניסה" להעביר orderId - כדי שפרמטר שגוי יחזיר 400 ולא יתעלמו ממנו בשקט */
export const hasOrderIdParam = (raw) => raw !== null && raw !== undefined && String(raw).trim() !== '';

/** null כשכל הדפים תקפים למצב הזמנה בודדת; אחרת הודעת שגיאה (400) */
export function orderModePageError(keys) {
  const list = Array.isArray(keys) ? keys : [];
  if (!list.length) return 'נדרש דף (PP-07 או PP-12) להדפסת הזמנה בודדת';
  const bad = list.filter((k) => !ORDER_MODE_PAGES[k]);
  return bad.length ? `הדפסה להזמנה בודדת (orderId) זמינה רק לדף הכנה (PP-07) ולתעודת משלוח (PP-12), לא ל-${bad.join(', ')}` : null;
}

/** גרסאות כפויות במצב הזמנה: דף הכנה = גרסה ב׳ (הזמנה בעמוד נפרד) */
export function orderModeVersions(keys) {
  const out = {};
  for (const k of keys || []) if (ORDER_MODE_PAGES[k] && ORDER_MODE_PAGES[k].version) out[k] = ORDER_MODE_PAGES[k].version;
  return out;
}

/** כתובת דף ההדפסה להזמנה בודדת (נפתחת מכרטיס ההזמנה בלשונית חדשה / נשלחת ל-/api/pdf) */
export function orderPrintPath(pageKey, orderId, { downloadPdf = false } = {}) {
  const id = parseOrderIdParam(orderId);
  if (!ORDER_MODE_PAGES[pageKey] || !id) return null;
  const qs = new URLSearchParams({ orderId: String(id) });
  const v = ORDER_MODE_PAGES[pageKey].version;
  if (v) qs.set('version', `${pageKey}:${v}`);
  if (downloadPdf) qs.set('downloadPdf', 'true');
  return `/schedule/print/${pageKey}?${qs.toString()}`;
}

/**
 * גוף POST /api/orders/events להדפסת דף לו״ז של הזמנה אחת (חוזה W0 §1.1: ORDER_PRINTED, doc prep/delivery, sheet PP-07/PP-12).
 * clientEventId ייחודי לכל דף (השרת מזהה כפילות לפי action + orderId + clientEventId) - לכן נגזר מקוד הדף.
 */
export function schedulePrintEventBody({ orderId, pageKey, loadId }) {
  const id = parseOrderIdParam(orderId);
  const def = ORDER_MODE_PAGES[pageKey];
  if (!id || !def) return null;
  const base = String(loadId || 'load').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || 'load';
  return {
    orderId: id,
    action: 'ORDER_PRINTED',
    meta: { doc: def.doc, sheet: pageKey, source: 'print-page', batch: false },
    clientEventId: `${base}-${def.doc}`.slice(0, 64).padEnd(8, '0'),
  };
}
