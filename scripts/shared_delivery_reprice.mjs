#!/usr/bin/env node
// "משלוח משותף" - חישוב מחדש של הזמנות משלוח עתידיות קיימות לפי הכללים (lib/sharedDelivery.js - אותו קוד בדיוק כמו באתר).
// ברירת מחדל: DRY-RUN - מדפיס דוח של מה היה משתנה (קבוצה, ראשי, הפרש מחיר, זיכוי / חוב) ולא כותב כלום.
//
//   SD_DATABASE_URL=<חיבור> node scripts/shared_delivery_reprice.mjs --expect-host=<חלק משם המארח> [--json] [--from=YYYY-MM-DD]
//   כתיבה בפועל (רק אחרי שראית את הדוח):  ... --write --expect-host=<חלק משם המארח>
//
// בטיחות:
//  * ה-DB נקרא רק מהמשתנה SD_DATABASE_URL (במכוון לא DATABASE_URL) ושם המארח מודפס. --write בלי --expect-host מסרב; --expect-host שלא תואם מסרב.
//  * מסרב לרוץ על הגמ"ח הראשי: GEMACH_ORG=main, או DB שבו אין enable_deliveries ו-shared_delivery_enabled דלוקים (בגמ"ח הראשי אין משלוחים).
//  * נוגע רק בהזמנות משלוח עתידיות (מהיום ואילך, שעון ישראל) שנמצאות בקבוצת משלוח משותף, ורק בשורת חיוב המשלוח האוטומטית הקיימת שלהן.
//    זיכוי אוטומטי נרשם דרך syncPendingCreditRefund הרגיל; כל שינוי נרשם בהיסטוריה (AuditLog, בלי עובד).
//  * לא להריץ על פרודקשן בלי אישור הבעלים. הסקריפט לא נוצר כדי להיות מורץ אוטומטית.
import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
process.env.PROJ = process.env.PROJ || path.resolve(here, '..');
register(pathToFileURL(path.join(here, 'lib', 'shared-delivery-script-hooks.mjs')).href);

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : null; };
const WRITE = flag('write');
const AS_JSON = flag('json');
const expectHost = opt('expect-host');
const fromKey = opt('from');

function die(msg, code = 2) { console.error(`\nמסרב להמשיך: ${msg}`); process.exit(code); }

const url = process.env.SD_DATABASE_URL;
if (!url) die('חסר SD_DATABASE_URL (חיבור ה-DB של הגמ"ח שבו מריצים; לא נקרא DATABASE_URL במכוון).');
let host;
try { host = new URL(url.replace(/^postgres(ql)?:/, 'http:')).hostname; } catch { die('SD_DATABASE_URL אינו כתובת תקינה.'); }
if (process.env.GEMACH_ORG === 'main') die('GEMACH_ORG=main - הגמ"ח הראשי אין לו משלוחים; הסקריפט מיועד לנווה יעקב בלבד.');
if (WRITE && !expectHost) die('--write דורש --expect-host=<חלק משם המארח> (הגנה מכתיבה ל-DB לא נכון).');
if (expectHost && !host.includes(expectHost)) die(`המארח בפועל (${host}) אינו מכיל את --expect-host (${expectHost}).`);
console.error(`DB host: ${host}${WRITE ? '   [מצב כתיבה]' : '   [dry-run - לא נכתב כלום]'}`);

const L = (rel) => import(pathToFileURL(path.join(process.env.PROJ, rel)).href);
const SD = await L('lib/sharedDelivery.js');
const H = await L('lib/hebrewDate.js');
const { default: prisma, disconnect } = await import(pathToFileURL(path.join(here, 'lib', 'shared-delivery-script-prisma.mjs')).href);

let exitCode = 0;
try {
  const settings = await SD.loadSharedDeliverySettings();
  if (!settings.enabled) die('בבסיס הנתונים הזה משלוח משותף כבוי (shared_delivery_enabled / enable_deliveries) - כנראה הגמ"ח הראשי או שהפיצ\'ר עוד לא הופעל.');

  const today = H.getIsraelTodayKey();
  const start = fromKey && fromKey > today ? fromKey : today;
  const startRange = H.getIsraelDayRange(start).start;
  const rows = await prisma.order.findMany({
    where: { isDeleted: false, isDelivery: true, OR: [{ eventDate: { gte: startRange } }, { eventDate: null, fromDate: { gte: startRange } }] },
    select: { eventDate: true, fromDate: true },
  });
  const days = [...new Set(rows.map((r) => H.getIsraelDateKey(r.eventDate || r.fromDate)).filter(Boolean))].sort();

  // כל הקבוצות של הימים העתידיים
  const allKeys = [];
  const groupInfo = new Map();
  for (const day of days) {
    const state = await SD.getDayState(day, settings);
    for (const [key, g] of state.groups) {
      allKeys.push(key);
      groupInfo.set(key, { day, primary: g.plan.primaryOrderId, members: g.members });
    }
  }

  const dry = await SD.reconcileSharedDelivery({ groupKeys: allKeys, dryRun: true, reason: 'משלוח משותף - חישוב מחדש חד-פעמי (dry-run)' });
  const byGroup = new Map();
  for (const r of dry.results) { if (!byGroup.has(r.groupKey)) byGroup.set(r.groupKey, []); byGroup.get(r.groupKey).push(r); }

  const changed = dry.results.filter((r) => r.status === 'updated');
  const summary = {
    host, mode: WRITE ? 'write' : 'dry-run', fromDay: start, days: days.length, groups: allKeys.length,
    groupsWithTwoOrMore: [...groupInfo.values()].filter((g) => g.members.length > 1).length,
    ordersChecked: dry.results.length, ordersToChange: changed.length,
    totalDelta: Math.round(changed.reduce((s, r) => s + r.delta, 0) * 100) / 100,
    creditsToRegister: Math.round(changed.reduce((s, r) => s + (r.creditAmount || 0), 0) * 100) / 100,
    debtsCreated: Math.round(changed.reduce((s, r) => s + (r.debtAmount || 0), 0) * 100) / 100,
    skipped: dry.results.filter((r) => r.status === 'skipped').reduce((m, r) => ({ ...m, [r.reason]: (m[r.reason] || 0) + 1 }), {}),
  };

  if (AS_JSON) {
    console.log(JSON.stringify({ summary, groups: [...groupInfo].map(([key, g]) => ({ key, day: g.day, primaryOrderId: g.primary, members: g.members.map((m) => m.orderId), results: byGroup.get(key) || [] })) }, null, 1));
  } else {
    console.log('\n=== דוח משלוח משותף (dry-run) ===');
    for (const [key, g] of groupInfo) {
      const res = byGroup.get(key) || [];
      if (g.members.length < 2 && !res.some((r) => r.status === 'updated')) continue;
      console.log(`\nקבוצה ${key}   (יום ${g.day}, ראשי: #${g.primary}, ${g.members.length} הזמנות)`);
      for (const m of g.members) {
        const r = res.find((x) => x.orderId === m.orderId);
        const tag = m.orderId === g.primary ? 'ראשי ' : 'מצורף';
        if (!r) { console.log(`  ${tag} #${m.orderId} ${m.customerName}  -`); continue; }
        if (r.status === 'updated') console.log(`  ${tag} #${m.orderId} ${r.customerName}  ${r.before} -> ${r.after}  (${r.delta > 0 ? '+' : ''}${r.delta})  ${r.creditAmount ? `זיכוי אוטומטי ${r.creditAmount}` : ''}${r.debtAmount ? `חוב ${r.debtAmount}` : ''}`);
        else console.log(`  ${tag} #${m.orderId} ${r.customerName || m.customerName}  ${r.status === 'unchanged' ? `ללא שינוי (${r.before})` : `דולגה: ${r.reason || r.error}`}`);
      }
    }
    console.log('\nסיכום:', JSON.stringify(summary, null, 1));
  }

  if (WRITE) {
    if (changed.length === 0) { console.error('אין מה לכתוב.'); }
    else {
      console.error(`\nכותב ${changed.length} הזמנות...`);
      const real = await SD.reconcileSharedDelivery({ groupKeys: allKeys, reason: 'משלוח משותף - חישוב מחדש חד-פעמי' });
      const ok = real.results.filter((r) => r.status === 'updated').length;
      const failed = real.results.filter((r) => r.status === 'error');
      console.error(`נכתבו ${ok}; שגיאות ${failed.length}.`);
      for (const f of failed) console.error(`  #${f.orderId}: ${f.error}`);
      if (failed.length) exitCode = 1;
    }
  }
} catch (e) {
  console.error('שגיאה:', e);
  exitCode = 1;
} finally {
  await disconnect().catch(() => {});
}
process.exit(exitCode);
