// בדיקות סטטיות של חלקי W2b (פורט נווה יעקב, R49): רישום ב-slots, מאחורי ההגדרות הקיימות, בלי DDL בזמן ריצה, SQL ממתין תואם לסכימה,
// ה-patch של route.js (קובץ W0) ושל הבקר (קובץ W1), מפתחות בהגדרות, וכללי הסגנון (בלי window.alert/confirm, data-tip, בלי "טוגל", בלי AuditLog ידני).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const PROJ = process.env.PROJ;
const read = (p) => fs.readFileSync(path.join(PROJ, p), 'utf8').split('\r\n').join('\n');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const OC = 'app/components/order-card';
const PARTS = ['parts/OcDeliveryJoinPicker.js', 'parts/OcDressLocationBanner.js', 'parts/OcBarcodeSequencePanel.js', 'parts/OcScanBarWithSequence.js', 'parts/ocNeveLogic.js'];
const SRC = Object.fromEntries(PARTS.map(f => [f, strip(read(`${OC}/${f}`))]));
const ALL = Object.values(SRC).join('\n');

test('slots.js: TopBanners / DeliveryJoinPicker / ScanBar רשומים (שורה לכל אחד) ומאותו קובץ parts', () => {
  const s = read(`${OC}/slots.js`);
  assert.match(s, /import OcDressLocationBanner from '\.\/parts\/OcDressLocationBanner';/);
  assert.match(s, /import OcDeliveryJoinPicker from '\.\/parts\/OcDeliveryJoinPicker';/);
  assert.match(s, /import OcScanBarWithSequence from '\.\/parts\/OcScanBarWithSequence';/);
  assert.match(s, /TopBanners: OcDressLocationBanner,/);
  assert.match(s, /DeliveryJoinPicker: OcDeliveryJoinPicker,/);
  assert.match(s, /ScanBar: OcScanBarWithSequence,/);
});

test('כל חלק מאחורי ההגדרה הקיימת שלו (כבוי = null / השדה הרגיל); הגדרות מהבקר, לא נקראות ישירות', () => {
  assert.match(SRC['parts/OcDressLocationBanner.js'], /oc\.settings\.enableDressLocationAlert/);
  assert.match(SRC['parts/OcDeliveryJoinPicker.js'], /oc\.settings\.enableDeliveryJoin/);
  assert.match(strip(read(`${OC}/parts/OcScanBar.js`)), /oc\.settings\.enableBarcodeSequenceMode/);
  assert.match(SRC['parts/OcDressLocationBanner.js'], /if \(!enabled \|\| alerts\.length === 0\) return null;/);
  assert.match(SRC['parts/OcDeliveryJoinPicker.js'], /if \(!enabledSetting \|\| !available\) return null;/);
  const ctl = read(`${OC}/orderCardLogic.js`);
  for (const k of ['delivery_separate_tab', 'enable_delivery_join', 'enable_barcode_sequence_mode', 'enable_dress_location_alert']) assert.ok(ctl.includes(`'${k}'`), k);
  // לשונית משלוח נפרדת: הנראות כבר ב-W1; בלי לשונית נפרדת התוכן בתוך "פרטים"
  assert.match(read(`${OC}/OcTabs.js`), /delivery_separate_tab|deliverySeparateTab/);
});

test('הבורר מוצג רק בלשונית המשלוח (או בתוך "פרטים"): OcDeliveryCards קורא ל-SLOTS.DeliveryJoinPicker אחרי כרטיס "יעד"; העיר/הכתובת מנוטרלות בהצטרפות', () => {
  const del = strip(read(`${OC}/tabs/OcDeliveryTab.js`));
  assert.ok(del.indexOf('<h2>יעד</h2>') < del.indexOf('<JoinPicker oc={oc} ui={ui} />'));
  assert.match(del, /const joined = !!order\.deliveryJoinedTo;/);
  assert.equal((del.match(/disabled=\{joined\}/g) || []).length, 2);
  assert.match(SRC['parts/OcDeliveryJoinPicker.js'], /className=\{`card dfields oc-join/, 'מחזיר .card משלו (ילד ישיר של הלוח)');
});

test('אין window.alert / confirm / prompt ואין חלון בהיר; חלונות דרך ui.openDialog; tooltip דרך data-tip בלבד; בלי "טוגל"', () => {
  assert.ok(!/\b(window\.)?(alert|confirm|prompt)\(/.test(ALL.replace(/ui\.(alert|confirm|prompt)\(/g, '')));
  assert.ok(!/customAuthPrompt|customConfirm|customAlert|customThreeWayConfirm/.test(ALL));
  assert.ok(!/\btitle=/.test(ALL), 'tooltip = data-tip');
  assert.ok(!/טוגל/.test(ALL + read(`${OC}/css/oc-details.css`)));
  assert.match(SRC['parts/OcBarcodeSequencePanel.js'], /data-tip=/);
  assert.ok(!/style=\{\{/.test(ALL.replace(/style=\{\{ '--n': 2, '--i': mi \}\}/, '')), 'סגנון מוטבע רק עבור מיקום הגלולה (--n/--i כמו בכל ה-seg של הכרטיס); השאר ב-oc-details.css');
});

test('תאריכים עבריים בלבד, בלי toLocale*, ו-fetch רק לנקודות הקצה המותרות', () => {
  assert.ok(!/toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat/.test(ALL));
  const urls = [...ALL.matchAll(/(?:getJson|fetch)\(\s*[`'"]([^`'"]+)/g)].map(m => m[1]);
  for (const u of urls) assert.match(u, /^\/api\/(deliveries\/join|orders\/dress-location-alerts)/, u);
  assert.ok(urls.length >= 3);
});

test('רצף ברקודים: אין לוגיקת השכרה כפולה - משתמש ב-useItemActions של W3; שגיאות מהטוסט נתפסות; אין fetch ישיר לשכרה', () => {
  const s = SRC['parts/OcBarcodeSequencePanel.js'];
  assert.match(s, /useItemActions\(oc, sequenceUi/);
  assert.match(s, /kind === 'error'\) errRef\.current = big/);
  assert.ok(!/api\/rentals/.test(s));
  assert.match(s, /a\.cancelRent\(item, \{ confirmed: true \}\)/);
  assert.match(s, /a\.cancelReturn\(item, \{ confirmed: true \}\)/);
  assert.match(s, /id="scanIn"/, 'אותו id של שדה הסריקה (פוקוס אחרי חלונות)');
});

test('lib/deliveryJoin.js + routes: אין DDL / SQL גולמי / AuditLog ידני / $transaction; הטבלה חסרה נתפסת', () => {
  for (const f of ['lib/deliveryJoin.js', 'app/api/deliveries/join/route.js', 'lib/dressLocationAlerts.js', 'app/api/orders/dress-location-alerts/route.js']) {
    const c = strip(read(f));
    assert.ok(!/CREATE TABLE|CREATE INDEX|ALTER TABLE|DROP TABLE|\$executeRaw|\$queryRaw|\$transaction|auditLog\.create|\.deleteMany|\.updateMany|\.upsert/.test(c), f);
  }
  const lib = read('lib/deliveryJoin.js');
  assert.match(lib, /P2021/); assert.match(lib, /42P01/); assert.match(lib, /TABLE_RECHECK_MS/);
  assert.match(read('app/api/deliveries/join/route.js'), /isDeliveryJoinAvailable/);
});

test('SQL הממתין: IF NOT EXISTS, תוספת בלבד (בלי DROP/ALTER/DELETE מחוץ להערות), העמודות והאינדקס = מודל DeliveryJoin ב-schema.prisma', () => {
  const sql = read('prisma/migrations-pending/2026-10-04-delivery-join.sql');
  const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  assert.match(code, /CREATE TABLE IF NOT EXISTS "DeliveryJoin"/);
  assert.match(code, /CREATE INDEX IF NOT EXISTS "DeliveryJoin_joinedToOrderId_idx" ON "DeliveryJoin"\("joinedToOrderId"\)/);
  assert.ok(!/^\s*(DROP|ALTER|DELETE|UPDATE|TRUNCATE|INSERT)/im.test(code));
  assert.ok(!/BEGIN|COMMIT/.test(code), 'הסקריפט המריץ עוטף בטרנזקציה (כמו ScheduleStageMark)');
  const schema = read('prisma/schema.prisma');
  const model = schema.slice(schema.indexOf('model DeliveryJoin {'));
  const body = model.slice(0, model.indexOf('\n}'));
  const fields = [...body.matchAll(/^\s{2}(\w+)\s+(\w+)(\?)?(?:\s+@(\w+)(?:\(([^)]*)\))?)*/gm)].map(m => ({ n: m[1], t: m[2], opt: !!m[3] })).filter(f => !['index'].includes(f.n));
  const cols = [...code.matchAll(/^\s+"(\w+)"\s+(INTEGER|TEXT|BOOLEAN|TIMESTAMP\(3\))( NOT NULL)?/gm)].map(m => ({ n: m[1], t: m[2], notNull: !!m[3] }));
  const TYPE = { Int: 'INTEGER', String: 'TEXT', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)' };
  assert.deepEqual(cols.map(c => c.n).sort(), fields.map(f => f.n).sort());
  for (const f of fields) {
    const c = cols.find(x => x.n === f.n);
    assert.equal(c.t, TYPE[f.t], f.n);
    assert.equal(c.notNull, !f.opt, `${f.n}: nullable`);
  }
  assert.match(code, /PRIMARY KEY \("orderId"\)/);
  assert.match(body, /orderId\s+Int\s+@id/);
  assert.match(body, /@@index\(\[joinedToOrderId\]\)/);
  assert.ok(!/@relation/.test(body), 'בלי FK (כמו ScheduleStageMark)');
});

test('PUT של ההזמנה (קובץ W0): deliveryJoin נשמר לפני applyDeliveryCharge, רק כשההגדרה דלוקה, וכישלון לא מפיל את השמירה; ה-TODO הוחלף', () => {
  const r = read('app/api/orders/[id]/route.js');
  assert.ok(!/TODO\(W2b, R49\)/.test(r));
  const join = r.indexOf('data.deliveryJoin !== undefined || data.isDelivery === false');
  const charge = r.indexOf('await applyDeliveryCharge(parsedOrderId);');
  assert.ok(join > 0 && join < charge);
  const block = r.slice(join, charge);
  assert.match(block, /isDeliveryJoinEnabled\(\)/); assert.match(block, /releaseOrderJoins\(parsedOrderId\)/); assert.match(block, /saveDeliveryJoin\(parsedOrderId, data\.deliveryJoin\)/);
  assert.match(block, /catch \(joinFailure\)/);
  // סקירה 3: כישלון (ok:false או זריקה) לא שקט - joinError בעברית חוזר בתשובה
  assert.match(block, /joinError = joinResult\.error/); assert.match(block, /joinError = 'ההצטרפות למשלוח לא נשמרה בגלל תקלה/);
  assert.match(r, /\.\.\.\(joinError \? \{ joinError \} : \{\}\)/);
  // סקירה 4: שחרור מצטרפים בכיבוי משלוח - ומחשבים להם מחדש לפני חישוב החיוב של ההזמנה עצמה
  assert.match(block, /for \(const releasedId of releasedJoiners\)[\s\S]*applyDeliveryCharge\(releasedId\)/);
});

test('סקירה 4: ביטול הזמנה (DELETE) משחרר את ההצטרפות שלה / את מצטרפיה ומחשב להם חיוב מחדש, בלי AuditLog ידני', () => {
  const r = read('app/api/orders/[id]/route.js');
  const del = r.slice(r.indexOf('export async function DELETE'));
  assert.match(del, /releaseOrderJoins\(parsedOrderId\)/);
  assert.match(del, /applyDeliveryCharge\(releasedId\)/);
  assert.ok(del.indexOf('releaseOrderJoins') > del.indexOf('$transaction'), 'אחרי הטרנזקציה (בלי קריאות בתוכה)');
  assert.ok(!/join/i.test(del.slice(del.indexOf('$transaction'), del.indexOf('releaseOrderJoins'))), 'הטרנזקציה לא נוגעת בשורות ההצטרפות');
});

test('הבקר (קבצי W1): deliveryJoin בשני גופי ה-PUT, deliveryJoinedTo בתצוגה המקדימה ובמפעילי התצוגה; מפתחות בהגדרות', () => {
  const lg = read(`${OC}/orderCardLogic.js`);
  assert.match(lg, /body\.deliveryJoin = \{\};/);
  assert.match(lg, /deliveryJoinedTo: o\.deliveryJoinedTo/);
  assert.match(lg, /'extraDay', 'deliveryJoinedTo'\]/);
  assert.match(read(`${OC}/useOrderCardController.js`), /order\?\.deliveryJoinedTo/);
  const sm = read('lib/settingsMetadata.js');
  for (const k of ['delivery_separate_tab', 'enable_delivery_join', 'delivery_join_price', 'enable_barcode_sequence_mode', 'enable_dress_location_alert']) assert.ok(sm.includes(k + ':'), k);
});

test('התמחור: joinPrice ב-computeDeliveryObligationPreview, applyDeliveryCharge ו-preview-pricing; כבוי = בלי שינוי', () => {
  assert.match(read('lib/pricingCalc.js'), /joinPrice = null,/);
  assert.match(read('lib/pricingCalc.js'), /if \(joinPrice && Number\(joinPrice\) > 0\) cityPrice = joinPrice;/);
  const eng = read('lib/pricingEngine.js');
  assert.match(eng, /getDeliveryJoinPrice\(\)/); assert.match(eng, /isOrderJoinValid\(order\.orderId, \{ dropStale: true \}\)/); // S1: הצטרפות נבדקת מול השורש (במקום isOrderJoined)
  const pv = read('app/api/orders/[id]/preview-pricing/route.js');
  assert.match(pv, /'enable_delivery_join'/); assert.match(pv, /orderOverrides\.deliveryJoinedTo !== undefined/);
  assert.match(pv, /requested: orderOverrides\.extraDay/); // S2: דרך resolveExtraDay (כבוי = מתעלמים)
});

test('לא נכתבות הגדרות / לא מורץ DDL: אין SystemSetting.create/update/upsert ואין קריאת/הרצת קובץ SQL בקוד', () => {
  const files = ['lib/deliveryJoin.js', 'lib/dressLocationAlerts.js', 'app/api/deliveries/join/route.js', 'app/api/orders/dress-location-alerts/route.js', ...PARTS.map(f => `${OC}/${f}`)];
  for (const f of files) {
    const c = strip(read(f));
    assert.ok(!/systemSetting\.(create|update|upsert|delete)/.test(c), f);
    assert.ok(!/from 'node:fs'|from 'fs'|require\('fs'\)|readFile|child_process/.test(c), f + ' (לא קורא/מריץ את קובץ ה-SQL)');
  }
});

test('סקירה 7: /api/deliveries/join קריאה בלבד - אין POST (ההצטרפות נשמרת רק ב-PUT של ההזמנה שמחשב מחדש), ושום קוד לא קורא לו ב-POST', () => {
  const route = read('app/api/deliveries/join/route.js');
  assert.ok(!/export async function (POST|PUT|PATCH|DELETE)/.test(route));
  assert.match(route, /export async function GET/);
  assert.ok(!/saveDeliveryJoin/.test(strip(route)));
  for (const f of [`${OC}/parts/OcDeliveryJoinPicker.js`, `${OC}/orderCardFlows.js`, `${OC}/useOrderCardController.js`]) {
    assert.ok(!/deliveries\/join[^\n]*method:\s*'POST'/.test(read(f)), f);
  }
});

test('סקירה 2/8/9 (ממשק): ביטול הצטרפות לא מתאימה, roving tabindex בשתי רשימות הרדיו, יומן הסריקות נסגר, ההצטרפות השמורה מנעילה את הכתובת', () => {
  const pk = read(`${OC}/parts/OcDeliveryJoinPicker.js`);
  assert.match(pk, /data-join-clear/); assert.match(pk, /oc-join-missing/);
  assert.ok(!/tabIndex=\{0\}/.test(pk), 'אין tabIndex קבוע 0 בשורות - roving tabindex');
  assert.equal((pk.match(/rovingTab\(/g) || []).length, 2, 'מופעל בשתי הרשימות');
  assert.equal((pk.match(/rovingKeyDown\(e,/g) || []).length, 2);
  assert.match(pk, /savedJoinSyncPatch\(/); assert.match(pk, /oc\.patchOrder\(syncPatch\)/);
  const sq = read(`${OC}/parts/OcBarcodeSequencePanel.js`);
  assert.match(sq, /aria-label="סגירת יומן הסריקות"/); assert.match(sq, /setPopOpen\(false\)/); assert.match(sq, /e\.key === 'Escape'/);
  // סעיף 8: העיר/הכתובת מנוטרלות לפי order.deliveryJoinedTo - שהבורר מסנכרן מההצטרפות השמורה (info.joinedToOrderId) ל-order בטעינה;
  // false (ביטול) לא נועל
  const tab = read(`${OC}/tabs/OcDeliveryTab.js`);
  assert.match(tab, /const joined = !!order\.deliveryJoinedTo;/);
  assert.equal((tab.match(/disabled=\{joined\}/g) || []).length, 2);
});

// הערת הבעלים 2026-10-05: "למה המשלוח לא בלשונית נפרדת בנווה". הקוד תקין - הלשונית דורשת enable_deliveries וגם delivery_separate_tab = 'true';
// השורה לא נוצרה ב-DB של נווה (הענף שלה לא מוזג) ולכן גם לא היה מתג במסך ההגדרות. סקריפט seed (dry-run) מוסיף אותה (org2=true, org1=false).
test('לשונית משלוח נפרדת: שער אחד (enable_deliveries && delivery_separate_tab), ברירת מחדל כבוי, אותו תוכן בלשונית או בתוך "פרטים" (לא כפול)', async () => {
  const tabs = strip(read(`${OC}/OcTabs.js`));
  assert.match(tabs, /t\.id !== 'delivery' \|\| \(settings\.enableDeliveries && settings\.deliverySeparateTab\)/);
  const logic = read(`${OC}/orderCardLogic.js`);
  assert.match(logic, /deliverySeparateTab: bool\('delivery_separate_tab', false\)/);
  assert.match(logic, /enableDeliveries: bool\('enable_deliveries', false\)/);
  const details = strip(read(`${OC}/tabs/OcDetailsTab.js`));
  assert.match(details, /s\.enableDeliveries && !s\.deliverySeparateTab \? <OcDeliveryCards/, 'בתוך "פרטים" רק כשאין לשונית נפרדת');
  assert.match(strip(read(`${OC}/tabs/OcDeliveryTab.js`)), /export default function OcDeliveryTab\(\{ oc, ui \}\) \{\s*return <OcDeliveryCards oc=\{oc\} ui=\{ui\} \/>;/);
  const { parseSettings } = await import(pathToFileURL(path.join(PROJ, OC, 'orderCardLogic.js')).href);
  const on = parseSettings([{ key: 'enable_deliveries', value: 'true' }, { key: 'delivery_separate_tab', value: 'true' }]);
  assert.equal(on.enableDeliveries && on.deliverySeparateTab, true);
  const missing = parseSettings([{ key: 'enable_deliveries', value: 'true' }]);
  assert.equal(missing.deliverySeparateTab, false, 'שורה חסרה = כבוי (המצב בנווה היום)');
  assert.equal(parseSettings([]).deliverySeparateTab, false);
});

test('seed delivery_separate_tab: דרך seedBoolSetting (בדיקת host, dry-run כברירת מחדל), org2=true, בלי כתיבה ישירה', () => {
  const s = read('scripts/seed_delivery_separate_tab_setting.js');
  assert.match(s, /require\('\.\/lib\/seed-bool-setting'\)/);
  assert.match(s, /key: 'delivery_separate_tab'/);
  assert.match(s, /trueForOrg: 2/);
  assert.ok(!/systemSetting\.(create|update|upsert)/.test(s), 'הכתיבה רק דרך העזר עם --write');
});
