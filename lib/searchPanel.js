// lib/searchPanel.js - השרת של פאנל התפוסה / הפריט (GET /api/search-panel): שולף את השורות הנדרשות (שאילתות ממוקדות, בהקבלה) ומעביר ל-lib/searchPanelCore.js.
// מה מוצג ואיך מחושב: docs/search-capacity-embed.md. כל קריאה ל-DB היא קריאה בלבד; רשימות עמודות מפורשות (אין * / oi.* / o.*) - ר' scripts/test_search_leak_gate.mjs.
//
// ביצועים: מספר הסבבים לשרת ה-DB הוא מה שקובע (≈0.75 שנייה לסבב מהמחשב המקומי מול Neon; ≈20ms בפרודקשן), ולכן:
//   - רשימת הדגמים (142 שורות) במטמון זיכרון ל-60 שניות לכל מסד - הכרעה אם קוד שייך לדגם היא חינם, ושאילתת מספר הזמנה (3-6 ספרות) שלא שייכת לדגם לא עולה שאילתה.
//   - אחרי ההכרעה: כל השאילתות בהקבלה (Promise.all), שורה אחת מצורפת לכל שאילתה (JOIN ל-Order / Customer / DressItem) - בלי N+1 ובלי relation-loading של Prisma.
//   - ההזמנות של הדגם נשלפות פעם אחת לכל המידות (קידומת מאונדקסת), והסינון למידה נעשה בזיכרון.

import prisma from '@/app/lib/prisma';
import { currentDbModeTag } from '@/lib/dbMode';
import { israelDayKey } from '@/lib/searchNormalize';
import { parseSearchIntent } from '@/lib/searchIntent';
import { sizeInList } from '@/lib/sizeSearch';
import { capacityWindow } from '@/lib/capacityRules';
import { buildItemPanel, buildModelPanel, eventDayKey, redactPerson } from '@/lib/searchPanelCore';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { hebrewDateLabel } from '@/lib/globalSearch';

export const PANEL_PAGE_KEYS = Object.freeze(['page:orders', 'page:rentals']); // מי יכולה לקבל את הפאנל בכלל (תפוסה = page:orders, כמו החיפוש המתקדם; השכרות/החזרות = page:rentals)
export const PERSON_PAGE_KEYS = Object.freeze(['page:customers', 'page:orders', 'page:rentals']); // מי רואה שם משפחה וטלפון של לקוחה
export const MODEL_CARD_PAGE_KEY = 'page:dresses_catalog';
export const MODEL_CARD_PATH = '/dashboard/dresses/';

const MODELS_TTL_MS = 60 * 1000;
const RETURNED_FETCH = 12;
const RENTALS_FETCH = 60;
const HALF_DAY_MS = 12 * 3600 * 1000;

// ---------------------------------------------------------------------------------------------------------------------------------
// דגמים (מטמון זיכרון קצר)
// ---------------------------------------------------------------------------------------------------------------------------------
const modelsCache = new Map(); // dbTag -> { at, byPrefix: Map<number, model[]>, list }
export function __resetPanelCache() { modelsCache.clear(); }

async function loadModels() {
  const tag = currentDbModeTag();
  const hit = modelsCache.get(tag);
  if (hit && Date.now() - hit.at < MODELS_TTL_MS) return hit;
  const rows = await prisma.dressModel.findMany({ where: { isDeleted: false, barcodePrefix: { not: null } }, select: { id: true, name: true, barcodePrefix: true } });
  const byPrefix = new Map();
  for (const m of rows) { const l = byPrefix.get(m.barcodePrefix) || []; l.push(m); byPrefix.set(m.barcodePrefix, l); }
  const entry = { at: Date.now(), byPrefix, list: rows };
  if (modelsCache.size >= 4) modelsCache.delete(modelsCache.keys().next().value);
  modelsCache.set(tag, entry);
  return entry;
}

/** דגמים תואמים לכוונה: לפי קידומת (מדויק) או לפי שם ("מכיל", ושם זהה מנצח). */
export function pickModels(models, intent) {
  if (intent.prefix != null) return models.byPrefix.get(intent.prefix) || [];
  const needle = String(intent.modelName || '').trim().toLowerCase();
  if (!needle) return [];
  const contains = models.list.filter((m) => String(m.name || '').toLowerCase().includes(needle));
  const exact = contains.filter((m) => String(m.name || '').toLowerCase() === needle);
  return exact.length ? exact : contains;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// שאילתות
// ---------------------------------------------------------------------------------------------------------------------------------
const ROW_COLS = `oi.id, oi."orderId", oi.barcode, oi."sizeText", oi.size, oi."barcodePrefix" AS "oiPrefix", oi.quantity, oi."isTaken", oi."isReturned",
  oi."takenDate", oi."returnDate" AS "oiReturn", o."eventDate", o."returnDate" AS "orderReturn", o."eventDateHebrew", o.status,
  c."firstName", c."lastName", c.phone1, c.phone2, di."barcodePrefix" AS "diPrefix", di."sizeText" AS "diSize"`;
const ROW_FROM = `FROM "OrderItem" oi
  JOIN "Order" o ON o."orderId" = oi."orderId" AND o."isDeleted" = false
  LEFT JOIN "Customer" c ON c.id = o."customerId"
  LEFT JOIN "DressItem" di ON di.id = oi."dressItemId"`;

const num = (v) => (typeof v === 'bigint' ? Number(v) : v);
const normRow = (r) => ({ ...r, quantity: r.quantity == null ? null : num(r.quantity), oiPrefix: r.oiPrefix == null ? null : num(r.oiPrefix), diPrefix: r.diPrefix == null ? null : num(r.diPrefix), orderId: num(r.orderId) });

async function queryItems(prefix) {
  return prisma.$queryRawUnsafe(
    `SELECT "dressBarcode", "sizeText", "serialNumber", location, quantity, "inRepair", "notInUse", "isDeleted" FROM "DressItem" WHERE "barcodePrefix" = $1 AND "isDeleted" = false`,
    prefix,
  ).then((rows) => rows.map((r) => ({ ...r, quantity: r.quantity == null ? null : num(r.quantity), serialNumber: r.serialNumber == null ? null : num(r.serialNumber) })));
}

/** הזמנות הדגם (כל המידות) שנחתכות עם חלון התאריך, או בחוץ / עתידיות שטרם נלקחו (ביקוש). */
async function queryModelRows(prefix, win, todayKey) {
  const todayFloor = new Date(Date.parse(todayKey + 'T00:00:00Z') - HALF_DAY_MS); // sync עם eventDayKey: סוף הזמנה מהיום והלאה
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${ROW_COLS} ${ROW_FROM}
     WHERE oi."isDeleted" = false AND o."eventDate" IS NOT NULL
       AND (oi."barcodePrefix" = $1 OR di."barcodePrefix" = $1)
       AND ( (o."eventDate" <= $3 AND COALESCE(o."returnDate", o."eventDate") >= $2)
             OR (oi."isReturned" = false AND (oi."isTaken" = true OR COALESCE(o."returnDate", o."eventDate") >= $4)) )`,
    prefix, win.fromLimit, win.toLimit, todayFloor,
  );
  return rows.map(normRow);
}

async function queryReturned(prefix, sizes) {
  const list = [...new Set((sizes || []).flatMap((s) => sizeInList(s)))];
  const bySize = list.length ? ` AND (oi."sizeText" = ANY($2::text[]) OR oi.size = ANY($2::text[]) OR di."sizeText" = ANY($2::text[]))` : '';
  const params = list.length ? [prefix, list] : [prefix];
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${ROW_COLS} ${ROW_FROM}
     WHERE oi."isDeleted" = false AND oi."isReturned" = true AND (oi."barcodePrefix" = $1 OR di."barcodePrefix" = $1)${bySize}
     ORDER BY COALESCE(oi."returnDate", oi."takenDate", o."eventDate") DESC NULLS LAST, oi.id
     LIMIT ${RETURNED_FETCH}`,
    ...params,
  );
  return rows.map(normRow);
}

async function queryItemByBarcode(barcode) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT di."dressBarcode", di."sizeText", di."serialNumber", di.location, di.quantity, di."inRepair", di."notInUse", di."isDeleted", di."barcodePrefix",
            dm.id AS "modelId", dm.name AS "modelName", dm."barcodePrefix" AS "modelPrefix"
     FROM "DressItem" di LEFT JOIN "DressModel" dm ON dm.id = di."dressModelId"
     WHERE di."dressBarcode" = $1 ORDER BY di."isDeleted" ASC LIMIT 1`,
    barcode,
  );
  return rows[0] || null;
}
async function queryRentals(barcode) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ${ROW_COLS} ${ROW_FROM}
     WHERE oi.barcode = $1 AND oi."isDeleted" = false
     ORDER BY COALESCE(oi."takenDate", o."eventDate") DESC NULLS LAST, oi.id
     LIMIT ${RENTALS_FETCH}`,
    barcode,
  );
  return rows.map(normRow);
}
async function queryRentCount(barcode) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS n FROM "OrderItem" oi JOIN "Order" o ON o."orderId" = oi."orderId" AND o."isDeleted" = false
     WHERE oi.barcode = $1 AND oi."isDeleted" = false AND oi."isTaken" = true`,
    barcode,
  );
  return Number(rows[0] ? rows[0].n : 0);
}

// ---------------------------------------------------------------------------------------------------------------------------------
// תצוגה: תאריך עברי קצר לשורה
// ---------------------------------------------------------------------------------------------------------------------------------
// השנה היא האסימון האחרון (מתחיל ב-ת/הת); בלי שנה = כמו eventDateHebrew באתר ("ט״ו תשרי")
function stripYear(raw) {
  const parts = String(raw).trim().split(/\s+/);
  if (parts.length >= 3 && /^ה?ת/.test(parts[parts.length - 1])) parts.pop();
  return parts.join(' ');
}
function hebShort(key, stored) {
  if (stored) return stripYear(stored);
  if (!key) return '';
  const [y, m, d] = key.split('-').map(Number);
  return stripYear(getHebrewDateString(new Date(y, m - 1, d, 12)));
}
const isoDay = (d) => (d ? israelDayKey(new Date(d)) : null);

function decorate(panel) {
  for (const sec of Object.values(panel.sections)) {
    sec.rows = sec.rows.map((r) => {
      const { takenAt, returnedAt, hebText, ...rest } = r;
      // תאריכים לתצוגה בעברית בלבד (כלל הבעלים); החזרה / לקיחה הם רגעים אמיתיים -> היום הישראלי שלהם
      return { ...rest, hebDate: hebShort(r.eventKey, hebText), returnedHeb: hebShort(isoDay(returnedAt)), takenHeb: hebShort(isoDay(takenAt)) };
    });
  }
  const st = panel.tiles && panel.tiles.status;
  if (st && st.at) st.atHeb = hebShort(isoDay(st.at));
  return panel;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// נקודת הכניסה
// ---------------------------------------------------------------------------------------------------------------------------------
/**
 * @param {string} q   מה שהוקלד
 * @param {{now?: Date, model?: number|null, size?: string|null, perms: {person: boolean, modelCard: boolean}}} opts
 *   model/size = בחירה מפורשת של המשתמשת (דגם מתוך רשימת מועמדים / מידה מתוך הפירוט) - גוברת על מה שבשורת החיפוש
 * @returns {Promise<{panel: object|null, reason?: string, ms: number}>}
 */
export async function resolvePanel(q, { now = new Date(), model = null, size = null, perms = { person: false, modelCard: false } } = {}) {
  const t0 = Date.now();
  const done = (panel, reason) => ({ panel, ...(reason ? { reason } : {}), ms: Date.now() - t0 });
  const intent = parseSearchIntent(q, { now });
  if (intent.kind === 'none') return done(null, 'no-intent');
  const todayKey = israelDayKey(now);
  const dateKey = intent.dateKey || todayKey;
  const models = await loadModels();

  let panel = null;
  if (intent.kind === 'item') panel = await itemPanel(intent, models, { dateKey, todayKey });
  else panel = await modelPanel(intent, models, { dateKey, todayKey, model, size });
  if (!panel) return done(null, 'not-found');

  if (panel.mode !== 'choose') {
    decorate(panel);
    panel.date = { key: dateKey, isToday: dateKey === todayKey, label: dateKey === todayKey ? 'היום' : hebrewDateLabel(dateKey) };
    if (perms.modelCard && panel.model && panel.model.id) panel.modelLink = MODEL_CARD_PATH + panel.model.id;
    if (!perms.person) panel = redactPerson(panel);
  }
  return done(panel);
}

async function modelPanel(intent, models, { dateKey, todayKey, model, size }) {
  let found = pickModels(models, intent);
  if (model != null) found = (models.byPrefix.get(Number(model)) || []);
  if (!found.length) return null;
  if (found.length > 1) {
    return { mode: 'choose', candidates: found.slice(0, 12).map((m) => ({ prefix: m.barcodePrefix, name: m.name || '' })), candidatesTotal: found.length };
  }
  const m = found[0];
  const prefix = m.barcodePrefix;
  const sizes = size ? [String(size)] : intent.sizes;
  const win = capacityWindow(dateKey, dateKey);
  const [items, rows, returned] = await Promise.all([queryItems(prefix), queryModelRows(prefix, win, todayKey), queryReturned(prefix, sizes)]);
  const panel = buildModelPanel({ model: { id: m.id, name: m.name, prefix }, items, rows, returned, sizes, dateKey, todayKey });
  panel.partial = !!intent.partial;
  return panel;
}

async function itemPanel(intent, models, { dateKey, todayKey }) {
  const barcode = intent.barcode;
  const derivedPrefix = Number(barcode.slice(0, -4));
  const derivedSize = barcode.slice(-4, -2);
  const knownDerived = (models.byPrefix.get(derivedPrefix) || [])[0] || null;
  const win = capacityWindow(dateKey, dateKey);
  // שלב אחד: הכול בהקבלה, על הקידומת שנגזרת מהספרות; אם הפריט האמיתי שייך לקידומת אחרת - שולפים שוב את נתוני הדגם
  const [itemRow, rentals, rentCount, items0, rows0] = await Promise.all([
    queryItemByBarcode(barcode),
    queryRentals(barcode),
    queryRentCount(barcode),
    knownDerived ? queryItems(derivedPrefix) : [],
    knownDerived ? queryModelRows(derivedPrefix, win, todayKey) : [],
  ]);
  let modelRef = knownDerived;
  if (itemRow && itemRow.modelId) modelRef = { id: itemRow.modelId, name: itemRow.modelName, barcodePrefix: num(itemRow.modelPrefix) };
  if (!modelRef) {
    // ברקוד שלא נמצא כפריט ולא שייך לדגם ידוע: אין מה להציג (אם יש לו השכרות - הן עדיין ברשימת התוצאות הרגילה)
    return null;
  }
  const prefix = modelRef.barcodePrefix;
  let items = items0, rows = rows0;
  if (prefix !== derivedPrefix) [items, rows] = await Promise.all([queryItems(prefix), queryModelRows(prefix, win, todayKey)]);
  const item = itemRow ? { ...itemRow, quantity: itemRow.quantity == null ? null : num(itemRow.quantity), serialNumber: itemRow.serialNumber == null ? null : num(itemRow.serialNumber) } : null;
  const sizeText = item && item.sizeText != null && String(item.sizeText).trim() !== '' ? item.sizeText : derivedSize;
  return buildItemPanel({ model: { id: modelRef.id, name: modelRef.name, prefix }, item, barcode, sizeText, rentals, rentCount, items, rows, dateKey, todayKey });
}

export { eventDayKey };
