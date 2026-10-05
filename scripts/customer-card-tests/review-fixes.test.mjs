// תיקוני הסקירה העצמאית (4.10.2026) - כל בדיקה כאן נכשלת בלי התיקון שלה.
// הרצה: node scripts/customer-card-tests/review-fixes.test.mjs   (בלי DB, בלי דפדפן)
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
let passed = 0;
let failed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

const ACC = '../../lib/customerAccount.js';
const hasAcc = existsSync(new URL(ACC, import.meta.url));
const acc = hasAcc ? await import(ACC) : {};
const dateKey = (d) => String(d).slice(0, 10);
const ord = (orderId, extra = {}) => ({ orderId, isDeleted: false, eventDate: '2026-09-01', items: [], obligations: [{ amount: 100 }], payments: [{ amount: 100 }], ...extra });

// (1) השכרה באיחור - שמלה אצל הלקוחה חוסמת מחיקה גם כשהתאריך עבר
await t('(1) מחיקה: פריט שנסרק ולא הוחזר חוסם, גם בהזמנה שתאריך ההחזרה שלה עבר', () => {
  assert.ok(hasAcc, 'lib/customerAccount.js חסר');
  const overdue = ord(5, { returnDate: '2026-09-10', items: [{ barcode: '451238', isReturned: false }] });
  const b = acc.deleteBlockers({ orders: [overdue], refunds: [], todayKey: '2026-10-04', dateKey });
  assert.equal(b.blocked, true);
  assert.deepEqual(b.holdingOrders, [5]);
  const returned = ord(6, { items: [{ barcode: '451238', isReturned: true }, { barcode: null, isReturned: false }] });
  assert.equal(acc.deleteBlockers({ orders: [returned], refunds: [], todayKey: '2026-10-04', dateKey }).blocked, false);
  const route = code(read('../../app/api/customers/[id]/route.js'));
  assert.match(route, /items: \{ where: \{ isDeleted: false \}, select: \{ barcode: true, isReturned: true, isDeleted: true \} \}/, 'השרת לא טוען את הפריטים (רק לא מוסרים)');
});

// D1 (סקירה סופית): פריט שהוסר מההזמנה (isDeleted) שנסרק ולא הוחזר לא חוסם מחיקה לנצח
await t('D1: פריט שהוסר (isDeleted) לא נחשב שמלה אצל הלקוחה, ופריט פעיל באותה הזמנה כן', () => {
  const removed = ord(7, { items: [{ barcode: '451238', isReturned: false, isDeleted: true }] });
  const b = acc.deleteBlockers({ orders: [removed], refunds: [], todayKey: '2026-10-04', dateKey });
  assert.equal(b.blocked, false); assert.deepEqual(b.holdingOrders, []);
  const mixed = ord(8, { items: [{ barcode: '451238', isReturned: false, isDeleted: true }, { barcode: '451239', isReturned: false, isDeleted: false }] });
  assert.deepEqual(acc.deleteBlockers({ orders: [mixed], refunds: [], todayKey: '2026-10-04', dateKey }).holdingOrders, [8]);
});

// D4: ביטול חסימה מעדכן updatedAt מתשובת ה-PATCH (אחרת ה-PUT הבא נחסם ב-409 שווא)
await t('D4: unblock לוקח updatedAt מתשובת ה-PATCH', () => {
  const hook = code(read('../../app/components/customer-card/useCustomerCard.js'));
  const i = hook.indexOf('unblockPayload()');
  const seg = hook.slice(i, hook.indexOf('ביטול חסימה', i + 400) > 0 ? i + 1800 : i + 1800);
  assert.match(seg, /patched\.updatedAt/); assert.match(seg, /setSaved\(\(p\) => \(\{ \.\.\.p, isBlocked: false, blockedReason: null, \.\.\.stamp \}\)\)/);
});

// D5: PUT על לקוחה מחוקה נדחה (409, בעברית) לפני כל בדיקה/כתיבה
await t('D5: PUT /api/customers/[id] דוחה לקוחה מחוקה לפני בדיקת ההתנגשות והכתיבה', () => {
  const route = code(read('../../app/api/customers/[id]/route.js'));
  const put = route.slice(route.indexOf('export async function PUT'), route.indexOf('export async function PATCH'));
  const iDel = put.indexOf('oldCustomer.isDeleted');
  assert.ok(iDel > 0, 'אין בדיקת isDeleted ב-PUT');
  assert.ok(iDel < put.indexOf('Data Collision') && iDel < put.indexOf('prisma.customer.update'), 'הבדיקה חייבת לבוא לפני ההתנגשות והעדכון');
  assert.match(put.slice(iDel, iDel + 300), /status: 409/); assert.match(put.slice(iDel, iDel + 300), /נמחקה/);
});

// (2) כלל אחד לשרת ולכרטיס; זיכוי שלא בוצע חוסם
await t('(2) מחיקה: אותה פונקציה בשרת ובכרטיס (deleteBlockers), חוב = נוסחת הכרטיס, זיכוי שטרם בוצע חוסם', () => {
  assert.ok(hasAcc, 'lib/customerAccount.js חסר');
  const route = code(read('../../app/api/customers/[id]/route.js'));
  const ctl = code(read('../../app/components/customer-card/useCustomerCard.js'));
  const logic = code(read('../../app/components/customer-card/customerCardLogic.js'));
  assert.match(route, /from '@\/lib\/customerAccount'/);
  assert.match(route, /deleteBlockers\(\{ orders: customer\.orders, refunds: customer\.refunds/);
  assert.match(ctl, /deleteBlockers\(\{ orders: saved\?\.orders \|\| \[\], refunds,/);
  assert.match(logic, /from '\.\.\/\.\.\/\.\.\/lib\/customerAccount\.js'/, 'הכרטיס מחשב חוב בעצמו במקום המודול המשותף');
  assert.ok(!/Math\.max\(0, required - paid\)/.test(route), 'השרת עדיין מחשב חוב בנפרד');
  // חוב: זיכוי מקטין את "שולם בפועל" (כמו הכרטיס), גם על הזמנה מחוקה עם דמי ביטול
  const orders = [ord(1, { obligations: [{ amount: 300 }], payments: [{ amount: 300 }] }), ord(2, { isDeleted: true, obligations: [{ amount: 40 }], payments: [] })];
  const b = acc.deleteBlockers({ orders, refunds: [], todayKey: '2026-10-04', dateKey });
  assert.equal(b.debt, 40);
  assert.equal(acc.accountSummary({ orders }, []).balance, 40);
  const zero = [ord(3)];
  const pend = acc.deleteBlockers({ orders: zero, refunds: [{ amount: 50, isExecuted: false }], todayKey: '2026-10-04', dateKey });
  assert.equal(pend.blocked, true);
  assert.equal(pend.pendingRefunds, 50);
  assert.equal(acc.deleteBlockers({ orders: zero, refunds: [{ amount: 50, isExecuted: true }, { amount: 9, isExecuted: false, isDeleted: true }], todayKey: '2026-10-04', dateKey }).pendingRefunds, 0);
  assert.match(route, /refunds: \{ where: \{ isDeleted: false \}/, 'השרת לא טוען זיכויים');
});

// (3) נווה יעקב: אישור feature:manual_payment_credit_add לפני חלון התשלום
await t('(3) תשלום מהכרטיס: consolidate_manual_payment_credit_ui → חלון אישור feature:manual_payment_credit_add לפני חלון התשלום', async () => {
  const logic = await import('../../app/components/customer-card/customerCardLogic.js');
  assert.equal(typeof logic.paymentApprovalLevel, 'function');
  assert.equal(logic.paymentApprovalLevel({ consolidate_manual_payment_credit_ui: 'true' }), 'feature:manual_payment_credit_add');
  assert.equal(logic.paymentApprovalLevel({}), null);
  const ctl = code(read('../../app/components/customer-card/useCustomerCard.js'));
  const body = ctl.slice(ctl.indexOf('const pay = useCallback'), ctl.indexOf('const mailGuard'));
  const ap = body.indexOf('openDialog(CcApprovalDialog');
  const pd = body.indexOf('openDialog(PaymentDialog');
  assert.ok(ap > 0 && pd > ap, 'חלון האישור חייב להיפתח לפני חלון התשלום');
  assert.match(body, /paymentApprovalLevel\(settings\)/);
  assert.match(body, /if \(!auth\) return;/);
});

// (4) נעילה בזמן תשלום
await t('(4) תשלום: נעילה (ref) מהפתיחה עד סוף הרענון, והלחצנים מנוטרלים בזמן הזה', () => {
  const ctl = code(read('../../app/components/customer-card/useCustomerCard.js'));
  const body = ctl.slice(ctl.indexOf('const pay = useCallback'), ctl.indexOf('const mailGuard'));
  assert.match(body, /payingRef\.current\) return;/);
  assert.match(body, /finally \{\s*payingRef\.current = false;\s*setPaying\(false\);/);
  assert.ok(body.indexOf("fetch(`/api/customers/${customerId}`)") < body.indexOf('payingRef.current = false'), 'הנעילה משתחררת לפני שהרענון חוזר');
  for (const f of ['CcRail.js', 'tabs/CcPaymentsTab.js', 'tabs/CcOrdersTab.js']) {
    const s = read(`../../app/components/customer-card/${f}`);
    const btns = [...s.matchAll(/data-act="pay-now"[^>]*>/g)].map((m) => m[0]);
    assert.ok(btns.length > 0, f);
    for (const b of btns) assert.match(b, /disabled=\{cc\.paying\}/, `${f}: ${b.slice(0, 60)}`);
  }
});

// (5) סקריפט הזריעה: --org חובה, DRY-RUN כברירת מחדל, --apply דורש --expect-host תואם
await t('(5) seed_customer_required_fields_setting.js: בלי --org נכשל, --apply בלי --expect-host נכשל, host חייב להתאים', () => {
  const require = createRequire(import.meta.url);
  const m = require('../seed_customer_required_fields_setting.js');
  assert.equal(typeof m.parseArgs, 'function', 'אין parseArgs (הסקריפט רץ ישר מול ה-DB)');
  assert.throws(() => m.parseArgs([]), /--org/);
  assert.throws(() => m.parseArgs(['--org=3']), /--org/);
  assert.throws(() => m.parseArgs(['--org=2', '--apply']), /expect-host/);
  assert.deepEqual(m.parseArgs(['--org=2']), { org: 2, apply: false, expectHost: null });
  assert.equal(m.hostMatches('ep-abc-123.eu.aws.neon.tech', 'ep-abc'), true);
  assert.equal(m.hostMatches('ep-other.eu.aws.neon.tech', 'ep-abc'), false);
  assert.equal(m.hostMatches('ep-abc.x', null), false);
});

// (6) MANAGER_APPROVAL לא עוקף את בדיקת הסיסמה דרך clientEventId כפול
await t('(6) נתיב האירועים: קיצור "כבר נרשם" לא חל על MANAGER_APPROVAL', () => {
  const r = code(read('../../app/api/customers/[id]/events/route.js'));
  assert.match(r, /clientEventId && action !== CUSTOMER_EVENT_ACTIONS\.MANAGER_APPROVAL\s*\?\s*prisma\.auditLog\.findFirst/);
});

// (7) לקוחה שנמחקה: פס "נמחק", בלי עריכה / מחיקה / תשלום
await t('(7) לקוחה מחוקה: פס "כרטיס הלקוח נמחק" וכרטיס לצפייה בלבד', () => {
  const ctl = code(read('../../app/components/customer-card/useCustomerCard.js'));
  assert.match(ctl, /const readOnly = !!saved\?\.isDeleted;/);
  assert.match(ctl, /if \(!CARD_FIELD_KEYS\.includes\(key\) \|\| readOnly\) return;/);
  const card = read('../../app/components/customer-card/CustomerCardA5.js');
  assert.match(card, /כרטיס הלקוח נמחק/);
  assert.match(card, /<DeletedBanner cc=\{cc\} \/>/);
  assert.match(read('../../app/components/customer-card/CcTopbar.js'), /\{!cc\.readOnly \? <button type="button" className="xlbtn xld" data-act="delete"/);
  const det = read('../../app/components/customer-card/tabs/CcDetailsTab.js');
  assert.match(det, /hidden=\{cc\.readOnly\}/);
  assert.match(det, /readOnly=\{cc\.readOnly\}/);
});

// (8) קוסמטי: הערות, "none" בפיקר, נעילת "שלח"
await t('(8) הערה מעודכנת ב-DELETE, הפניה לקובץ בדיקה קיים, "none" לא נשאר ליד שדה, "שלח" ננעל לפני חלון האישור', () => {
  const route = read('../../app/api/customers/[id]/route.js');
  assert.ok(!/העובד המחובר מורשה בעצמו, או/.test(route), 'ההערה עדיין אומרת שעובד מורשה פטור מסיסמה');
  const ev = read('../../app/api/customers/[id]/events/route.js');
  const cited = [...ev.matchAll(/scripts\/customer-card-tests\/([\w.-]+\.mjs)/g)].map((m) => m[1]);
  for (const f of cited) assert.ok(existsSync(new URL(`./${f}`, import.meta.url)), `ההערה מפנה לקובץ שלא קיים: ${f}`);
  assert.match(read('../../app/admin/settings/SettingsClient.js'), /rawItems\.filter\(item => item\.toLowerCase\(\) !== 'none'\)/);
  const mail = code(read('../../app/components/customer-card/CcMailSheet.js'));
  assert.ok(mail.indexOf("setState('approving')") > 0 && mail.indexOf("setState('approving')") < mail.indexOf('openDialog(CcApprovalDialog'), '"שלח" לא ננעל לפני פתיחת חלון האישור');
  assert.match(mail, /sendLock\.current\) \{/);
});

console.log(`\nreview-fixes: ${passed} passed, ${failed} failed`);
