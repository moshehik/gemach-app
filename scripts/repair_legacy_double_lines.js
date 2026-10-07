#!/usr/bin/env node
/**
 * תיקון חד-פעמי להזמנות ישנות מהאקסס שכבר נשמרה בהן שורת השכרה כפולה לאותה שמלה (נווה יעקב בלבד, דיווחים 09648183 ו-e76d4ec3 מ-6.10.2026).
 *
 * הרקע: הזמנה שנוצרה באקסס שומרת את חיוב ההשכרה של כל שמלה כשורה ידנית עם orderItemId + productId. כל שמירה של ההזמנה (לפני התיקון) הוסיפה
 * על אותה שמלה שורת השכרה מחושבת שנייה. החלטת הבעלים (7.10.2026): שמלה שלא השתנתה נשארת במחיר הישן שנגבה; רק אם הדגם או שורת המחיר השתנו
 * נשארת השורה לפי המחירון. הסקריפט מיישם את אותה החלטה בדיוק על הזמנות שכבר הוכפלו (אותו סיווג כמו classifyLegacyItemLines ב-lib/pricingCalc.js -
 * ברירת הפונקציה כאן מועתקת כי הסקריפט רץ ב-Node רגיל בלי alias; scripts/test_legacy_item_lines_replace.mjs בודק שהן נותנות אותה תוצאה):
 *   - שמלה שלא השתנתה (keep_old):      נמחקת השורה המחושבת המיותרת (בדיוק מה ששמירה רגילה של ההזמנה, כשההגדרה דולקת, הייתה עושה).
 *   - שמלה שהדגם/שורת המחיר שלה השתנו (use_pricelist): השורה הישנה מבוטלת (soft-delete, CANCEL_OBLIGATION) והמחושבת נשארת.
 *   - כל מקרה אחר (כמה שורות ישנות, כמה שורות מחושבות, פריט בלי שורת מחיר): לא נוגעים - "לבדיקה ידנית".
 * מתעדכנים גם Order.totalAmount (בהפרש המדויק של מה שהוסר) ו-OrderItem.finalPrice של שמלה שנשארה במחיר הישן. הסקריפט לא יוצר בקשות
 * זיכוי: אם אחרי התיקון ללקוחה יש יתרת זכות, בקשת הזיכוי הממתינה (syncPendingCreditRefund) תיווצר בשמירה הרגילה הבאה של ההזמנה במערכת.
 *
 * בטיחות:
 *  - dry-run כברירת מחדל (רק SELECT + הדפסה של מה שהיה קורה). כתיבה רק עם --write וגם --i-understand וגם --expect-host=<תחילית ה-host>.
 *  - ארגון 2 (נווה יעקב) בלבד; host חייב להיות שונה מה-host של הגמח הראשי; ובכתיבה ההגדרה legacy_item_lines_replaced_on_recalc חייבת להיות
 *    'true' ב-DB של נווה (אחרת הזמנה שתישמר שוב הייתה מוסיפה חיוב כפול מחדש).
 *  - כל שינוי נכתב עם שורת AuditLog מקבילה (הסקריפט עוקף את תוסף היומן האוטומטי, כמו normalize_legacy_rental_flags.js), באותה טרנזקציה.
 *  - לפני כתיבה של הזמנה נקראים שוב השורות שלה; אם השתנו מאז התכנון - ההזמנה מדולגת (בטוח להריץ שוב).
 *
 * שימוש:
 *   node scripts/repair_legacy_double_lines.js --org=2                       # dry-run, כל ההזמנות הכפולות
 *   node scripts/repair_legacy_double_lines.js --org=2 --order=53300,52830   # dry-run להזמנות מסוימות
 *   node scripts/repair_legacy_double_lines.js --org=2 --future-only         # רק אירועים שעוד לא עברו
 *   node scripts/repair_legacy_double_lines.js --org=2 --write --i-understand --expect-host=ep-xxxx   # כתיבה (רק באישור הבעלים)
 */
'use strict';

const { parseOrgArg, resolveDbUrl } = require('./lib/db-env');

const SETTING_KEY = 'legacy_item_lines_replaced_on_recalc';
const NON_RENTAL_PREFIX = /^(תיקון |חיוב מקורי|זיכוי|דמי ביטול)/;
const hostOf = (url) => (String(url).match(/@([^/?]+)/) || [])[1] || '';
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ---- סיווג: זהה ל-classifyLegacyItemLines / isLegacyRentalUnchanged ב-lib/pricingCalc.js (שורת ההשכרה המחושבת = השמורה בהזמנה) ----
function isLegacyRentalUnchanged({ line, item, rental, priceList }) {
  const itemPrefix = item.barcodePrefix;
  const dressPrefix = item.dressItem && item.dressItem.dress ? item.dressItem.dress.barcodePrefix : undefined;
  if (itemPrefix !== null && itemPrefix !== undefined && dressPrefix !== null && dressPrefix !== undefined
    && Number(itemPrefix) !== Number(dressPrefix)) return { unchanged: false, reason: 'דגם שונה' };
  const key = String(line.productId);
  const legacyRow = (priceList || []).find(p => String(p.id) === key || (p.legacyId !== null && p.legacyId !== undefined && String(p.legacyId) === key));
  const computedRow = (priceList || []).find(p => String(p.id) === String(rental.productId));
  if (!legacyRow || !computedRow) return { unchanged: true, reason: 'אין הוכחה לשינוי (שורת מחיר לא נמצאה במחירון)' };
  if (legacyRow.id === computedRow.id) return { unchanged: true, reason: 'אותו דגם ואותה שורת מחיר' };
  const size = parseInt(item.sizeText || '0');
  const inRange = legacyRow.category === computedRow.category
    && size >= (legacyRow.fromSize || 0)
    && (legacyRow.toSize === null || legacyRow.toSize === undefined || size <= legacyRow.toSize);
  return inRange ? { unchanged: true, reason: 'אותה שורת מחיר (המידה בתוך הטווח הישן)' } : { unchanged: false, reason: 'שורת מחיר שונה' };
}

function classifyLegacyItemLines({ manualObligations, newObligations, items, priceList }) {
  const legacyByItem = new Map();
  for (const ob of manualObligations || []) {
    if (ob.isDeleted || !ob.isManual || !ob.orderItemId || !ob.productId || !(ob.amount > 0)) continue;
    if (!legacyByItem.has(ob.orderItemId)) legacyByItem.set(ob.orderItemId, []);
    legacyByItem.get(ob.orderItemId).push(ob);
  }
  const itemsById = new Map((items || []).map(i => [i.id, i]));
  const kept = [];
  const replaced = [];
  for (const [itemId, lines] of legacyByItem) {
    const item = itemsById.get(itemId);
    if (lines.length !== 1 || !item) continue;
    const rental = (newObligations || []).find(o =>
      o.orderItemId === itemId && !o.isDraft && o.amount > 0 && !String(o.description || '').startsWith('תיקון ')
    );
    if (!rental) continue;
    const verdict = isLegacyRentalUnchanged({ line: lines[0], item, rental, priceList });
    if (verdict.unchanged) kept.push({ line: lines[0], itemId, amount: lines[0].amount, reason: verdict.reason });
    else replaced.push({ ...lines[0], _reason: verdict.reason });
  }
  return { kept, replaced };
}

// ---- ניתוח הזמנה אחת (קריאה בלבד) ----
// order: הזמנה עם items (+dressItem.dress), obligations (לא מבוטלות), payments (לא מבוטלים), customer
function analyzeOrder(order, priceList) {
  const activeItems = order.items.filter(i => !i.isDeleted);
  const obligations = order.obligations.filter(o => !o.isDeleted);
  const manual = obligations.filter(o => o.isManual);
  const storedComputed = obligations.filter(o => !o.isManual && o.orderItemId && !NON_RENTAL_PREFIX.test(o.description || ''));
  const { kept, replaced } = classifyLegacyItemLines({ manualObligations: manual, newObligations: storedComputed.filter(o => o.amount > 0), items: activeItems, priceList });
  const keptById = new Map(kept.map(k => [k.itemId, k]));
  const replacedByItem = new Map(replaced.map(l => [l.orderItemId, l]));

  const itemsOut = [];
  for (const item of activeItems) {
    const legacyLines = manual.filter(o => o.orderItemId === item.id && o.productId && o.amount > 0);
    const computedLines = storedComputed.filter(o => o.orderItemId === item.id && o.amount > 0);
    if (legacyLines.length === 0 || computedLines.length === 0) continue; // לא כפול
    const base = {
      itemId: item.id,
      dress: (item.dressItem && item.dressItem.dress && item.dressItem.dress.name) || '',
      size: item.sizeText || '',
      legacy: legacyLines.map(l => ({ id: l.id, amount: l.amount, productId: l.productId })),
      computed: computedLines.map(c => ({ id: c.id, amount: c.amount, description: c.description })),
    };
    if (legacyLines.length !== 1 || computedLines.length !== 1) {
      itemsOut.push({ ...base, decision: 'manual_review', reason: legacyLines.length !== 1 ? 'כמה שורות ישנות חיוביות לאותה שמלה' : 'כמה שורות מחושבות לאותה שמלה', remove: [], shouldBeItemAmount: null });
    } else if (keptById.has(item.id)) {
      itemsOut.push({ ...base, decision: 'keep_old', reason: keptById.get(item.id).reason, remove: [{ kind: 'computed', id: computedLines[0].id, amount: computedLines[0].amount, description: computedLines[0].description }], shouldBeItemAmount: legacyLines[0].amount });
    } else if (replacedByItem.has(item.id)) {
      const l = legacyLines[0];
      itemsOut.push({ ...base, decision: 'use_pricelist', reason: replacedByItem.get(item.id)._reason, remove: [{ kind: 'legacy', id: l.id, amount: l.amount, description: l.description }], shouldBeItemAmount: computedLines[0].amount });
    } else {
      itemsOut.push({ ...base, decision: 'manual_review', reason: 'לא סווג', remove: [], shouldBeItemAmount: null });
    }
  }
  if (itemsOut.length === 0) return null;

  const displayedRequired = r2(obligations.reduce((s, o) => s + o.amount, 0));
  const paid = r2(order.payments.filter(p => !p.isDeleted).reduce((s, p) => s + p.amount, 0));
  const removed = r2(itemsOut.reduce((s, it) => s + it.remove.reduce((x, r) => x + r.amount, 0), 0));
  const shouldBeRequired = r2(displayedRequired - removed);
  const displayedDebt = r2(displayedRequired - paid);
  const correctDebt = r2(shouldBeRequired - paid);
  return {
    orderId: order.orderId,
    customer: order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : '',
    eventDate: order.eventDate,
    status: order.status,
    storedTotalAmount: order.totalAmount,
    items: itemsOut,
    displayedRequired, paid, removed, shouldBeRequired, displayedDebt, correctDebt,
    autoFixable: itemsOut.every(i => i.decision !== 'manual_review'),
    becomesCredit: correctDebt < -0.005,
    phantomDebtRemoved: displayedDebt > 0.005 && correctDebt <= 0.005,
  };
}

async function loadAnalysis(prisma, { orderIds } = {}) {
  const priceList = await prisma.priceList.findMany();
  const orders = await prisma.order.findMany({
    where: {
      isDeleted: false,
      ...(orderIds && orderIds.length ? { orderId: { in: orderIds } } : {}),
      AND: [
        { obligations: { some: { isManual: true, isDeleted: false, productId: { not: null }, orderItemId: { not: null }, amount: { gt: 0 } } } },
        { obligations: { some: { isManual: false, isDeleted: false, orderItemId: { not: null }, amount: { gt: 0 } } } },
      ],
    },
    include: {
      customer: { select: { firstName: true, lastName: true } },
      items: { include: { dressItem: { include: { dress: true } } } },
      obligations: { where: { isDeleted: false } },
      payments: { where: { isDeleted: false } },
    },
    orderBy: { orderId: 'asc' },
  });
  return { priceList, orders, analyses: orders.map(o => analyzeOrder(o, priceList)).filter(Boolean) };
}

// ---- תכנון הכתיבות (טהור) ----
function planWrites(a) {
  const writes = [];
  let newTotal = a.storedTotalAmount;
  for (const it of a.items) {
    if (it.decision === 'keep_old') {
      for (const r of it.remove) writes.push({ type: 'delete_computed', obligationId: r.id, amount: r.amount, description: r.description, audit: { action: 'DELETE', changes: { deleted: true, description: r.description, amount: r.amount } } });
      writes.push({ type: 'item_final_price', itemId: it.itemId, to: it.shouldBeItemAmount, audit: { action: 'UPDATE', changes: { finalPrice: { from: null, to: it.shouldBeItemAmount } } } });
    } else if (it.decision === 'use_pricelist') {
      for (const r of it.remove) writes.push({ type: 'cancel_legacy', obligationId: r.id, amount: r.amount, description: r.description, audit: { action: 'CANCEL_OBLIGATION', changes: { isDeleted: { from: false, to: true }, amount: r.amount, description: r.description || 'חיוב השכרה ישן מהאקסס - הוחלף בחיוב לפי המחירון', note: 'הדגם או שורת המחיר של הפריט השתנו - הוחלף בחיוב לפי המחירון (repair_legacy_double_lines)' } } });
    }
  }
  if (a.removed > 0 && newTotal !== null && newTotal !== undefined) {
    newTotal = r2(newTotal - a.removed);
    writes.push({ type: 'order_total', from: a.storedTotalAmount, to: newTotal, audit: { action: 'UPDATE', changes: { totalAmount: { from: a.storedTotalAmount, to: newTotal }, _note: 'repair_legacy_double_lines' } } });
  }
  return writes;
}

const planSignature = (a) => JSON.stringify(a.items.map(i => [i.itemId, i.decision, i.legacy.map(l => `${l.id}:${l.amount}`), i.computed.map(c => `${c.id}:${c.amount}`)]));

// ---- ארגומנטים והגנות (מיוצאים לבדיקה) ----
function parseArgs(argv) {
  const { org, rest } = parseOrgArg(argv);
  const get = (name) => { const a = rest.find(x => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : ''; };
  return {
    org,
    write: rest.includes('--write'),
    iUnderstand: rest.includes('--i-understand'),
    expectHost: get('expect-host'),
    orderIds: get('order').split(',').map(s => parseInt(s, 10)).filter(Number.isFinite),
    futureOnly: rest.includes('--future-only'),
    json: get('json'),
  };
}

/** מחזיר רשימת סיבות סירוב (ריק = מותר). dry-run תמיד מותר, אבל רק לארגון 2 ועם host תקין. */
function writeRefusals(args, { host, otherHost, settingValue }) {
  const out = [];
  if (args.org !== 2) out.push('הסקריפט מיועד לנווה יעקב (--org=2) בלבד');
  if (!host || host === otherHost) out.push(`host לא תקין או זהה ל-host של הגמח השני ("${host}")`);
  if (args.write) {
    if (!args.iUnderstand) out.push('כתיבה דורשת גם --i-understand');
    if (!args.expectHost) out.push('כתיבה דורשת --expect-host=<תחילית ה-host של ה-DB המיועד>');
    else if (!String(host).startsWith(args.expectHost)) out.push(`ה-host (${host}) לא מתחיל ב-${args.expectHost}`);
    if (settingValue !== 'true') out.push(`ההגדרה ${SETTING_KEY} חייבת להיות 'true' ב-DB לפני כתיבה (כרגע: ${settingValue === undefined ? 'חסרה' : settingValue})`);
  }
  return out;
}

const todayIsraelKey = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
const isFutureEvent = (eventDate) => !!eventDate && new Date(eventDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' }) >= todayIsraelKey();

async function applyPlan(prisma, a, writes) {
  await prisma.$transaction(async (tx) => {
    for (const w of writes) {
      if (w.type === 'delete_computed') {
        await tx.paymentObligation.delete({ where: { id: w.obligationId } });
        await tx.auditLog.create({ data: { entityType: 'PaymentObligation', entityId: w.obligationId, action: w.audit.action, changesJson: JSON.stringify(w.audit.changes), employeeId: null } });
      } else if (w.type === 'cancel_legacy') {
        await tx.paymentObligation.update({ where: { id: w.obligationId }, data: { isDeleted: true } });
        await tx.auditLog.create({ data: { entityType: 'PaymentObligation', entityId: w.obligationId, action: w.audit.action, changesJson: JSON.stringify(w.audit.changes), employeeId: null } });
      } else if (w.type === 'item_final_price') {
        const cur = await tx.orderItem.findUnique({ where: { id: w.itemId }, select: { finalPrice: true } });
        if (cur && cur.finalPrice !== w.to) {
          await tx.orderItem.update({ where: { id: w.itemId }, data: { finalPrice: w.to } });
          await tx.auditLog.create({ data: { entityType: 'OrderItem', entityId: w.itemId, action: 'UPDATE', changesJson: JSON.stringify({ finalPrice: { from: cur.finalPrice, to: w.to }, _note: 'repair_legacy_double_lines' }), employeeId: null } });
        }
      } else if (w.type === 'order_total') {
        await tx.order.update({ where: { orderId: a.orderId }, data: { totalAmount: w.to } });
        await tx.auditLog.create({ data: { entityType: 'Order', entityId: String(a.orderId), action: w.audit.action, changesJson: JSON.stringify(w.audit.changes), employeeId: null } });
      }
    }
  }, { timeout: 30000, maxWait: 15000 });
}

function describeWrite(w) {
  switch (w.type) {
    case 'delete_computed': return `DELETE שורה מחושבת מיותרת ${w.obligationId.slice(0, 8)} (${w.amount}) "${w.description}" | audit ${w.audit.action} ${JSON.stringify(w.audit.changes)}`;
    case 'cancel_legacy': return `CANCEL שורה ישנה ${w.obligationId.slice(0, 8)} (${w.amount}) | audit ${w.audit.action} ${JSON.stringify(w.audit.changes)}`;
    case 'item_final_price': return `OrderItem ${w.itemId.slice(0, 8)} finalPrice -> ${w.to} | audit UPDATE`;
    case 'order_total': return `Order.totalAmount ${w.from} -> ${w.to} | audit UPDATE`;
    default: return JSON.stringify(w);
  }
}

async function main() {
  const { PrismaClient } = require('@prisma/client');
  const args = parseArgs(process.argv.slice(2));
  const url = resolveDbUrl(args.org);
  const host = hostOf(url);
  const otherHost = hostOf(resolveDbUrl(args.org === 1 ? 2 : 1));
  const prisma = new PrismaClient({ datasourceUrl: url });
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: SETTING_KEY } });
    const refusals = writeRefusals(args, { host, otherHost, settingValue: setting ? setting.value : undefined });
    console.log(`org${args.org} DB host: ${host} | mode: ${args.write ? 'WRITE' : 'dry-run'} | ${SETTING_KEY} = ${setting ? setting.value : '(חסרה)'}`);
    if (refusals.length) {
      console.error('REFUSED:\n - ' + refusals.join('\n - '));
      process.exitCode = 1;
      return;
    }
    const { analyses } = await loadAnalysis(prisma, { orderIds: args.orderIds });
    const chosen = analyses.filter(a => !args.futureOnly || isFutureEvent(a.eventDate));
    console.log(`הזמנות כפולות: ${analyses.length} (עם אירוע עתידי: ${analyses.filter(a => isFutureEvent(a.eventDate)).length}); נבחרו: ${chosen.length}`);
    let done = 0; let skipped = 0;
    for (const a of chosen) {
      const writes = planWrites(a);
      console.log(`\nהזמנה ${a.orderId} | ${a.customer} | אירוע ${a.eventDate ? new Date(a.eventDate).toISOString().slice(0, 10) : '-'}${isFutureEvent(a.eventDate) ? ' (עתידי)' : ''} | נדרש ${a.displayedRequired} -> ${a.shouldBeRequired}, שולם ${a.paid}, חוב ${a.displayedDebt} -> ${a.correctDebt}${a.becomesCredit ? '  [יתרת זכות / אפשרות להחזר]' : ''}${a.autoFixable ? '' : '  [חלק לבדיקה ידנית]'}`);
      for (const it of a.items) console.log(`   פריט ${it.dress} מידה ${it.size}: ישן ${it.legacy.map(l => l.amount).join('+')} / מחושב ${it.computed.map(c => c.amount).join('+')} => ${it.decision} (${it.reason})`);
      for (const w of writes) console.log(`   ${args.write ? 'WRITE' : 'WOULD'}: ${describeWrite(w)}`);
      if (!args.write || writes.length === 0) continue;
      // קריאה חוזרת של ההזמנה (מחוץ לטרנזקציה): אם השורות השתנו מאז התכנון - מדלגים
      const fresh = await loadAnalysis(prisma, { orderIds: [a.orderId] });
      const f = fresh.analyses[0];
      if (!f || planSignature(f) !== planSignature(a)) { console.log('   SKIPPED: ההזמנה השתנתה מאז התכנון'); skipped++; continue; }
      await applyPlan(prisma, f, planWrites(f));
      done++;
    }
    if (args.write) console.log(`\nנכתבו ${done} הזמנות, דולגו ${skipped}.`);
    else console.log('\nDRY RUN - לא נכתב דבר. כתיבה רק באישור הבעלים: --write --i-understand --expect-host=<host>.');
    if (args.json) require('fs').writeFileSync(args.json, JSON.stringify(chosen, null, 1));
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = { classifyLegacyItemLines, analyzeOrder, loadAnalysis, planWrites, parseArgs, writeRefusals, isFutureEvent, planSignature };

if (require.main === module) {
  main().catch((e) => { console.error(e); process.exitCode = 1; });
}
