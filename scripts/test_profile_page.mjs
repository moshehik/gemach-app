// בדיקת חוזה סטטית לדף "הפרופיל שלי" (/profile) אחרי המעבר לעיצוב החדש (3.10.2026): מוודאת שקוד הדף שומר על כל הקריאות
// ל-API ועל שדות ה-payload של הדף הישן, שהעיצוב הוא עמודה אחת, ששורת העזר של מתג הכניסה האוטומטית הוסרה, ושאין סיסמאות ביומן.
// בלי DB, רשת ודפדפן. הרצה: node scripts/test_profile_page.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקה חזותית מול העיצוב: scripts/profile-bg-audit (ר' ההערה בראש run.mjs).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const ROUTE = read('../app/profile/page.js');
const SWITCH = read('../app/components/profile/ProfileSwitch.js');
const PAGE = read('../app/components/profile/ProfilePage.js');
const CSS = read('../app/components/profile/profile.css');
const AUTO = read('../app/components/login/AutoClockSwitch.js');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const has = (src, re, msg) => assert.ok(re.test(src), msg);

t('הנתיב /profile טוען את הדף דרך dynamic (ה-CSS הגדול של הפלטה לא נכנס ל-bundle של שאר הדפים)', () => {
  has(ROUTE, /ProfileSwitch/, 'page.js חייב לרנדר את ProfileSwitch');
  has(SWITCH, /dynamic\(\(\) => import\('\.\/ProfilePage'\), \{ ssr: false \}\)/, 'ProfileSwitch חייב לטעון את ProfilePage ב-dynamic');
  assert.ok(!/components\.css/.test(ROUTE + SWITCH), 'ה-CSS של הפלטה נטען רק מתוך ProfilePage');
  has(PAGE, /import '@\/design-system\/components\.css'/, 'ProfilePage חייב לייבא את הפלטה');
});

t('חוזה ה-API: GET/PUT /api/me/profile (גוף = אובייקט הפרופיל), POST /api/employees/<id>/password {oldPassword,newPassword}, GET /api/settings', () => {
  has(PAGE, /fetch\('\/api\/me\/profile'\)/, 'GET /api/me/profile');
  has(PAGE, /fetch\('\/api\/me\/profile', \{\s*method: 'PUT'/, 'PUT /api/me/profile');
  has(PAGE, /body: JSON\.stringify\(profile\)/, 'גוף השמירה הוא אובייקט הפרופיל כמו שהוא');
  has(PAGE, /fetch\(`\/api\/employees\/\$\{profile\.id\}\/password`, \{\s*method: 'POST'/, 'POST /api/employees/<id>/password');
  has(PAGE, /JSON\.stringify\(\{ oldPassword: oldPasswordInput, newPassword: newPasswordInput \}\)/, 'שדות הסיסמה oldPassword/newPassword');
  has(PAGE, /fetch\('\/api\/settings'\)/, 'GET /api/settings');
  has(PAGE, /show_employee_profile_image/, 'ההגדרה show_employee_profile_image');
  has(PAGE, /invalidate\(\['\/api\/me'\]\)/, 'invalidate([\'/api/me\']) אחרי שמירה');
});

t('שדות הטופס: אותם name כמו בדף הישן (כולל receiveEmailAlerts); בלי "שם מלא" (נגזר מפרטי+משפחה) ובלי תאריך כניסה (רק בניהול)', () => {
  for (const n of ['firstName', 'lastName', 'phone1', 'phone2', 'email', 'city', 'street', 'houseNum', 'receiveEmailAlerts']) {
    has(PAGE, new RegExp(`name="${n}"`), `חסר שדה ${n}`);
  }
  assert.ok(!/name="fullName"|profile-fullName/.test(PAGE), 'שדה שם מלא חזר');
  assert.ok(!/joinDate/.test(PAGE), 'תאריך כניסה חזר לדף האישי (החלטת הבעלים 4.10.2026: רק בכרטיס הניהול)');
  has(PAGE, /checked=\{!!profile\.receiveEmailAlerts\}/, 'receiveEmailAlerts נשלט מהפרופיל');
  has(PAGE, /className="sw"><input[^>]*name="receiveEmailAlerts"/, '"קבלת התראות למייל" הוא מתג הפעלה/כיבוי של הפלטה');
});

t('תמונת פרופיל: FileReader -> dataURL, הסרה, תלוי בהגדרה; מצבי 401/403 וטעינה; כפתור חזרה router.back()', () => {
  has(PAGE, /readAsDataURL/, 'FileReader.readAsDataURL');
  has(PAGE, /profileImage: ''/, 'הסרת תמונה');
  has(PAGE, /showProfileImage &&/, 'התמונה מוצגת רק כשההגדרה פעילה');
  has(PAGE, /res\.status === 401 \|\| res\.status === 403/, 'מצב לא מחובר');
  has(PAGE, /כדי לצפות בפרופיל האישי יש להתחבר למערכת עם המשתמש שלך\./, 'טקסט מצב לא מחובר');
  has(PAGE, /טוען נתונים\.\.\./, 'מצב טעינה');
  has(PAGE, /router\.back\(\)/, 'כפתור חזרה');
  has(PAGE, /\{saving \? 'שומר\.\.\.' : 'שמירת פרטים'\}/, 'מצב שמירה');
});

t('הודעות: טוסט של הפלטה (#toast) במקום alert, והטקסטים הקיימים נשמרו', () => {
  assert.ok(!/window\.alert|\balert\(/.test(PAGE), 'alert חזר');
  has(PAGE, /id="toast" className="info on pulse"/, 'טוסט הפלטה');
  for (const m of ['הפרטים נשמרו בהצלחה!', 'שגיאה בשמירת נתונים', 'יש להזין סיסמא חדשה', 'הסיסמא שונתה בהצלחה', 'שינוי הסיסמה נכשל', 'שגיאה בשינוי הסיסמה']) {
    assert.ok(PAGE.includes(m), `חסרה הודעה: ${m}`);
  }
  has(PAGE, /data\.error \|\| 'שגיאה בשמירת נתונים'/, 'הודעת שגיאה מהשרת בשמירה');
  has(PAGE, /data\.message \|\| 'שינוי הסיסמה נכשל'/, 'הודעת שגיאה מהשרת בשינוי סיסמה');
});

t('סיסמאות לא נרשמות ולא מוצגות: אין console.* בדף, והשדות מסוג password כברירת מחדל', () => {
  assert.ok(!/console\.(log|info|debug|warn|error)/.test(PAGE + AUTO), 'console.* בדף');
  has(PAGE, /type=\{shown \? 'text' : 'password'\}/, 'שדה סיסמה מוסתר כברירת מחדל');
  has(PAGE, /aria-pressed=\{shown\}/, 'כפתור העין מציין מצב');
});

t('עמודה אחת: אין עמודה צדדית; סדר הכרטיסים: אישיים, קשר, כתובת, אבטחה, העדפות; כפתור השמירה אחרון בתחתית', () => {
  assert.ok(!/pf-side|<aside|className="rail|grid-template-columns:[^;}]*372px/.test(PAGE + CSS), 'עמודה צדדית');
  const order = ['h-personal', 'h-contact', 'h-address', 'h-security', 'h-prefs'].map((id) => PAGE.indexOf(`aria-labelledby="${id}"`));
  assert.ok(order.every((x) => x > 0) && order.every((x, i) => i === 0 || x > order[i - 1]), 'סדר הכרטיסים שגוי: ' + order);
  const save = PAGE.indexOf('כפתור_profile_save');
  assert.ok(save > order[4], 'כפתור השמירה חייב לבוא אחרי כרטיס ההעדפות');
  has(PAGE, /className="btn primary lg block"/, 'כפתור השמירה ראשי ברוחב מלא');
  assert.equal((PAGE.match(/className="card dfields"/g) || []).length, 5, 'חמישה כרטיסים בדיוק');
  has(PAGE, /<Ic id="userck"|icon="userck"/, 'אייקון פרטים אישיים');
  has(PAGE.slice(order[0], order[1]), /pf-avwrap/, 'תמונת הפרופיל בתוך כרטיס "פרטים אישיים"');
});

t('מתג הכניסה האוטומטית: בלי שורת העזר, אותה תווית ואותה התנהגות (נשמר מיד ב-PUT /api/me/auto-clock-in)', () => {
  // 4.10.2026 ("ישן / חדש"): שורת העזר קיימת רק בענף של הדף הישן (useUiVariant('profile') === 'legacy'), לא במראה החדש
  const AUTO_NEW = AUTO.slice(AUTO.indexOf('<div className="pf-pref">'));
  assert.ok(AUTO.includes('<div className="pf-pref">') && /profileVariant === 'legacy'/.test(AUTO), 'המראה החדש / ענף הישן');
  assert.ok(!/בלי לחיצה על/.test(PAGE + AUTO_NEW), 'שורת העזר חזרה');
  assert.ok(!/נשמר מיד/.test(PAGE + AUTO_NEW), 'שורת העזר חזרה');
  has(AUTO, /export const AUTO_CLOCK_LABEL = 'רשום לי התחלת עבודה אוטומטית בכניסה'/, 'התווית השתנתה');
  has(AUTO, /fetch\('\/api\/me\/auto-clock-in', \{\s*method: 'PUT'/, 'שמירה מיידית');
  has(AUTO, /className="sw"><input type="checkbox" id="profile-autoClockIn"/, 'מתג הפלטה');
  has(AUTO, /export function readAutoClockMirror/, 'readAutoClockMirror (בשימוש LoginNew)');
  has(AUTO, /export function writeAutoClockMirror/, 'writeAutoClockMirror (בשימוש LoginNew)');
  has(PAGE, /<AutoClockSwitch \/>/, 'הדף מרנדר את המתג');
});

t('כל אלמנט אינטראקטיבי של הדף הישן שמר data-element-name', () => {
  for (const n of ['כפתור_profile_back', 'שדה_profile_1', 'שדה_profile_10', 'שדה_profile_11', 'שדה_profile_12', 'שדה_profile_13', 'שדה_profile_15', 'שדה_profile_16', 'כפתור_profile_pw', 'כפתור_profile_pw_cancel', 'כפתור_profile_pw_ok', 'כפתור_profile_img_rm', 'כפתור_profile_save']) {
    assert.ok(PAGE.includes(`"${n}"`), `חסר data-element-name ${n}`);
  }
});

t('השורש .gm-ds.gm-pf.home-bg בלי gm-home, ועם RTL; האייקונים מה-sprite המוטמע (לא קובץ חיצוני)', () => {
  has(PAGE, /className="gm-ds gm-pf home-bg"/, 'שורש הדף');
  assert.ok(!/gm-home/.test(PAGE), 'gm-home בשורש');
  assert.ok(!/sprite\.svg/.test(PAGE), 'הפניה ל-sprite.svg חיצוני');
  has(PAGE, /<HomeSprite \/>/, 'הטמעת ה-sprite כשאין מעטפת A5');
});

t('תיבת הסיסמא: Enter מאשר רק משדה טקסט (לא מ"ביטול"/עין), בלי שליחה כפולה, והסר-תמונה מופיע לכל ערך תמונה', () => {
  assert.ok(PAGE.includes("e.target.tagName === 'INPUT'"), 'Enter לא מוגבל לשדה טקסט');
  assert.ok(PAGE.includes('e.repeat'), 'אין התעלמות ממקש מוחזק');
  assert.ok(PAGE.includes('pwBusyRef.current'), 'אין הגנה משליחה כפולה');
  assert.ok(PAGE.includes('disabled={pwBusy}'), 'אשר שינוי לא מנוטרל בזמן שליחה');
  assert.ok(PAGE.includes('{profile.profileImage && ('), 'הסר-תמונה תלוי ב-hasPhoto');
});

console.log(`\n${passed} passed`);
if (process.exitCode) process.exit(1);
