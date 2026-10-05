// בדיקות סטטיות לכרטיס הלקוח החדש (בלי DB, בלי דפדפן): מבנה ה-Switch, היקף ה-CSS, פריטים שהבעלים הסיר / ביקש, והבטחת ההערות.
// הרצה: node scripts/customer-card-tests/static.test.mjs
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const CC_DIR = 'app/components/customer-card';
const walk = (dir) => readdirSync(path.join(ROOT, dir)).flatMap((f) => { const rel = `${dir}/${f}`; return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : [rel]; });
const JS = walk(CC_DIR).filter((f) => f.endsWith('.js'));
const CSS = read(`${CC_DIR}/customer-card.css`);
const ALL = JS.map((f) => [f, read(f)]);
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); // בלי הערות

let passed = 0;
let failed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

t('app/customers/[id]/page.js היא מעטפת דקה ל-CustomerCardSwitch', () => {
  const page = read('app/customers/[id]/page.js');
  assert.match(page, /CustomerCardSwitch/);
  assert.ok(page.split('\n').length < 15, 'page.js צריך להיות קצר');
});
t('הכרטיס הישן הועבר כמו שהוא ל-LegacyCustomerPage.js והמתג מכבד את useUiVariant(customer_card) עם ברירת מחדל ישן', () => {
  assert.ok(existsSync(path.join(ROOT, 'app/customers/[id]/LegacyCustomerPage.js')));
  const sw = read(`${CC_DIR}/CustomerCardSwitch.js`);
  assert.match(sw, /useUiVariant\('customer_card'\)/);
  assert.match(sw, /variant !== 'a5'\) return <LegacyCustomerPage/);
  assert.match(sw, /dynamic\(\(\) => import\('\.\/CustomerCardA5'\), \{ ssr: false \}\)/);
  assert.match(sw, /dynamic\(\(\) => import\('\.\/NewCustomerA5'\), \{ ssr: false \}\)/);
});
t('שורש הכרטיס: gm-ds gm-cc home-bg dlg-dark ולעולם לא gm-home', () => {
  for (const f of ['CustomerCardA5.js', 'NewCustomerA5.js']) {
    const s = read(`${CC_DIR}/${f}`);
    assert.match(s, /className="gm-ds gm-cc home-bg dlg-dark"/, f);
  }
  for (const [f, s] of ALL) assert.ok(!/gm-home/.test(code(s)), `${f}: gm-home`);
  assert.ok(!/gm-home/.test(CSS.replace(/\/\*[\s\S]*?\*\//g, '')), 'customer-card.css: gm-home');
});
t('בלי window.alert/confirm/prompt/customConfirm/customAuthPrompt בכרטיס החדש', () => {
  for (const [f, s] of ALL) {
    const c = code(s);
    assert.ok(!/\b(window\.)?(alert|confirm|prompt)\s*\(/.test(c.replace(/ui\.(alert|confirm)\(/g, '').replace(/\.(alert|confirm)\s*[:=]/g, '')), `${f}: alert/confirm/prompt`);
    assert.ok(!/custom(Confirm|AuthPrompt|Prompt|ThreeWayConfirm)/.test(c), `${f}: window.custom*`);
  }
});
t('בלי title= על אלמנטים (טולטיפים ב-data-tip; prop בשם title של רכיב React מותר)', () => {
  for (const [f, s] of ALL) assert.ok(!/<[a-z][a-z0-9]*[^<>]*\stitle=/.test(code(s)), `${f}: title=`);
});
t('כל כלל ב-customer-card.css בהיקף .gm-ds.gm-cc (חוץ מביטול ריפוד המעטפת ו-@keyframes)', () => {
  const text = CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  const sels = [];
  const re = /([^{}@]+)\{[^{}]*\}/g;
  let m;
  const flat = text.replace(/@media[^{]+\{([\s\S]*?\})\s*\}/g, '$1').replace(/@keyframes[^{]+\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  while ((m = re.exec(flat))) sels.push(...m[1].split(/,(?![^()]*\))/).map((x) => x.trim()).filter(Boolean));
  const bad = sels.filter((x) => !/^(:where\()?\.gm-ds\.gm-cc/.test(x) && x !== '.app-shell .main .content:has(> .gm-ds.gm-cc)' && !/^(from|to|\d+%)$/.test(x));
  assert.deepEqual(bad, []);
});
t('הוסרו: "שם מלא", "כתובת מגורים", לשונית "זיכויים ופרטי בנק", כפתור שמירה בתחתית טופס הכרטיס', () => {
  for (const [f, s] of ALL) {
    assert.ok(!s.includes('שם מלא') || /הבעלים|אין "שם מלא"|\/\/|\/\*/.test(s.split('\n').find((l) => l.includes('שם מלא')) || ''), `${f}: שם מלא`);
    assert.ok(!code(s).includes("'שם מלא'") && !code(s).includes('"שם מלא"') && !code(s).includes('>שם מלא<'), `${f}: שם מלא בתווית`);
    assert.ok(!code(s).includes('כתובת מגורים'), `${f}: כתובת מגורים`);
    assert.ok(!code(s).includes('זיכויים ופרטי בנק'), `${f}: לשונית זיכויים ופרטי בנק`);
  }
  const card = read(`${CC_DIR}/CustomerCardA5.js`);
  assert.ok(!/id: 'refunds'/.test(card), 'refunds tab');
  assert.deepEqual([...card.matchAll(/\{ id: '(\w+)', label/g)].map((x) => x[1]), ['details', 'orders', 'payments', 'history']);
  const details = code(read(`${CC_DIR}/tabs/CcDetailsTab.js`));
  assert.ok(!/type="submit"/.test(details) && !/שמירת שינויים/.test(details), 'כפתור שמירה בטופס הפרטים');
  assert.ok(!/<form/.test(details), 'טופס עם submit בלשונית הפרטים');
});
t('לא נבנו הפריטים שהבעלים דחה: אמצעי קשר מועדף, תזכורת לפני אירוע, "הזמנה חדשה", "פעילות בלבד", "נפתחה · עובד", אפשרויות מנהל', () => {
  for (const [f, s] of ALL) {
    const c = code(s);
    for (const w of ['אמצעי קשר מועדף', 'תזכורת לפני אירוע', 'הזמנה חדשה', 'פעילות בלבד', 'אפשרויות מנהל', 'רישום תשלום ידני', 'בקשת זיכוי', 'חישוב מחדש']) assert.ok(!c.includes(w), `${f}: ${w}`);
  }
});
t('שדות החובה מההגדרות נאכפים בכל שמירה (עריכה ולקוח חדש) ובשרת לגוף a5', () => {
  const ctl = read(`${CC_DIR}/useCustomerCard.js`);
  assert.match(ctl, /requiredFieldsFromSettings\(settings\)/);
  assert.match(ctl, /validateForSave\(cur, \{ requiredKeys, isNew: false, settings \}\)/);
  const nw = read(`${CC_DIR}/NewCustomerA5.js`);
  assert.match(nw, /validateForSave\(c, \{ requiredKeys, isNew: true, settings \}\)/);
  for (const r of ['app/api/customers/[id]/route.js', 'app/api/customers/route.js']) {
    const s = read(r);
    assert.match(s, /body\.cardVariant === 'a5'/, r);
    assert.match(s, /requiredFieldErrors\(body, requiredFieldsFromSettings\(sMap\)\)/, r);
  }
  assert.match(read('lib/settingsMetadata.js'), /customer_required_fields: 'שדות חובה בכרטיס לקוח'/);
  assert.match(read('app/admin/settings/SettingsClient.js'), /isCustomerRequiredSetting/);
});
t('ההערות נשמרות רק דרך "שמור" במסילה: אין קריאת שרת מתיבת ההערות / onBlur, וה-PUT יוצא רק מ-putCustomer', () => {
  const details = code(read(`${CC_DIR}/tabs/CcDetailsTab.js`));
  const notesArea = details.slice(details.indexOf('id="notes"'), details.indexOf('id="notes"') + 400);
  assert.match(notesArea, /onChange=\{\(e\) => setField\('notes', joinNotes\(cc\.saved\.notes, e\.target\.value\)\)\}/);
  assert.ok(!/onBlur/.test(details), 'onBlur בלשונית הפרטים');
  assert.ok(!/fetch\(/.test(details), 'fetch בלשונית הפרטים (חוץ מהצעות כתובת)');
  const ctl = code(read(`${CC_DIR}/useCustomerCard.js`));
  const puts = [...ctl.matchAll(/method: 'PUT'/g)].length;
  assert.equal(puts, 1, 'PUT אחד בלבד');
  assert.ok(ctl.indexOf("method: 'PUT'") > ctl.indexOf('const putCustomer'), 'ה-PUT בתוך putCustomer');
  // putCustomer נקרא רק מתוך save (אחרי חלון הסיכום או משומר היציאה)
  const calls = [...ctl.matchAll(/putCustomer\(\)/g)].length;
  assert.equal(calls, 1);
  const rail = read(`${CC_DIR}/CcRail.js`);
  assert.match(rail, /data-act="save"[^>]*onClick=\{\(\) => cc\.save\(\)\}/);
  assert.ok(!/setInterval|autosave|autoSave/.test(ctl), 'שמירה אוטומטית');
});
t('כפתור "השלם ל-@gmail.com" ו-העתקת מייל צפה (בלי לחצן "העתק" נפרד)', () => {
  const f = read(`${CC_DIR}/CcFields.js`);
  assert.match(f, /השלם ל- <bdi dir="ltr">@gmail\.com<\/bdi>/);
  assert.match(f, /className=\{`cc-copy/);
  assert.ok(!/העתק כתובת מייל<\//.test(f));
  assert.match(CSS, /\.inpw:is\(:hover,:focus-within\) \.cc-copy\{opacity:1/);
});
t('הצעות עיר/רחוב ברשימה הנגללת של המערכת (.advlist) ולא datalist', () => {
  for (const [f, s] of ALL) assert.ok(!/<datalist|list=/.test(code(s)), `${f}: datalist`);
  assert.match(read(`${CC_DIR}/CcSuggest.js`), /className="advlist"/);
});
t('אישור מנהל: חלון כהה עם רשימה מסוננת לפי הרשאה + סיסמה (לא 4 ספרות), נבדק בשרת', () => {
  const a = read(`${CC_DIR}/CcApproval.js`);
  assert.match(a, /filterApprovers\(all, level\)/);
  assert.match(a, /type="password"/);
  assert.ok(!/maxLength=\{?1|className="ac"/.test(a), 'קוד 4 ספרות');
  assert.match(a, /action: 'MANAGER_APPROVAL'/);
  assert.match(read('app/api/customers/[id]/events/route.js'), /verifySecret\(approval\.pin/);
});
t('מסמכי מייל: רק מסמכים קיימים (בלי "תקנון חתום" / "קבלות")', () => {
  const l = read(`${CC_DIR}/customerCardLogic.js`);
  const fn = l.slice(l.indexOf('export function mailDocuments'), l.indexOf('export const MISSING_MAIL_DOCUMENTS'));
  assert.ok(!/תקנון חתום|קבלות/.test(fn));
  assert.match(fn, /\/print\/customer\?/);
  assert.match(fn, /\/print\/order\?/);
});
t('תאריכים עבריים בלבד בכרטיס (בלי toLocaleDateString לועזי)', () => {
  for (const [f, s] of ALL) assert.ok(!/toLocaleDateString\('he-IL'\)|toLocaleDateString\("he-IL"\)/.test(code(s)), f);
  assert.ok(!/toLocaleDateString\('he-IL'/.test(code(read('app/print/customer/page.js'))));
});
t('רישום אירועים: אותן פעולות כמו חוזה W0 לישות Customer, בלי PIN בשורה', () => {
  const ev = read('lib/history/customerEvents.js');
  for (const a of ['CUSTOMER_PRINTED', 'CUSTOMER_PDF_DOWNLOADED', 'CUSTOMER_XLSX_EXPORTED', 'HISTORY_EXPORTED', 'MANAGER_APPROVAL']) assert.match(ev, new RegExp(`${a}: '${a}'`));
  const route = read('app/api/customers/[id]/events/route.js');
  assert.match(route, /getActingEmployeeId\(\)/);
  assert.ok(!/pin:\s*approval\.pin|changesJson:.*pin/.test(route));
});

console.log(`\nstatic: ${passed} passed, ${failed} failed`);
