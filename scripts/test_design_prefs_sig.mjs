// בדיקת יחידה לעוגיית designPrefs_<id> החתומה (lib/designPrefsSig.js, GQ-01b 4.10.2026): חתימה / אימות, שינוי תוכן, replay אצל עובד אחר,
// העלאת גרסה, עוגייה ישנה לא חתומה (נזרקת ונבנית מחדש מה-DB), גודל, השוואה timing-safe, וחיווט המקורות (layout / routes / לקוח).
// בלי DB, רשת ודפדפן. הרצה: node scripts/test_design_prefs_sig.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DESIGN_PREFS_COOKIE_FIELDS, DESIGN_PREFS_COOKIE_TTL_SECONDS, DESIGN_PREFS_MAX_VALUE_LENGTH,
  getDesignPrefsSecret, pickCookiePrefs, planDesignPrefsCookie, readDesignPrefsFromCookie, signDesignPrefsCookie, verifyDesignPrefsCookie,
} from '../lib/designPrefsSig.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');
const code = (src) => src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

const SECRET = 'test-secret-0123456789-abcdefghijklmnop';
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const NOW = 1_800_000_000_000;
const PREFS = { palette: 'rose', font: 'serif', density: 'compact', textScale: 'large', customColors: { primary: '#112233', accent: '#445566', neutral: '' }, uiVariants: { shell: 'a5', home: 'a5' } };
const sign = (key = A, prefs = PREFS, now = NOW, opts) => signDesignPrefsCookie(key, prefs, SECRET, now, opts);
const verify = (raw, key = A, now = NOW, secret = SECRET) => verifyDesignPrefsCookie(raw, key, secret, now);
const flipLast = (s) => s.slice(0, -2) + (s.endsWith('AA') ? 'BB' : 'AA');

console.log('1. חתימה ואימות');
t('סבב מלא: sign -> verify מחזיר את אותן העדפות (רק שדות העוגייה)', () => {
  const c = sign();
  assert.match(c, /^dp1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'פורמט base64url בלבד (בטוח ל-Set-Cookie בלי קידוד)');
  const r = verify(c);
  assert.equal(r.ok, true);
  assert.deepEqual(r.prefs, PREFS);
  assert.equal(r.exp - r.iat, DESIGN_PREFS_COOKIE_TTL_SECONDS * 1000);
});
t('שדות שאינם בעוגייה (mode / savedPalettes / autoClockIn / שדות זרים) לא נכנסים', () => {
  const c = sign(A, { ...PREFS, mode: 'dark', savedPalettes: [{ id: 'x', name: 'n', primary: '#000000', accent: '#ffffff' }], autoClockIn: true, evil: 1 });
  assert.deepEqual(verify(c).prefs, PREFS);
  assert.deepEqual(DESIGN_PREFS_COOKIE_FIELDS, ['palette', 'font', 'density', 'textScale', 'customColors', 'uiVariants', 'adminPins']);
});
t('sanitize לפני החתימה: ערכים לא תקינים נזרקים (uiVariants עם מסך / ערך לא מוכר)', () => {
  const r = verify(sign(A, { palette: 'rose', uiVariants: { shell: 'a5', login: 'a5', home: 'evil' } }));
  assert.deepEqual(r.prefs, { palette: 'rose', uiVariants: { shell: 'a5' } });
  assert.deepEqual(pickCookiePrefs(null), {});
});
t('בלי סוד / בלי מפתח עובד: sign מחזיר null ו-verify דוחה (לא זורק)', () => {
  assert.equal(signDesignPrefsCookie(A, PREFS, null, NOW), null);
  assert.equal(signDesignPrefsCookie('', PREFS, SECRET, NOW), null);
  assert.equal(signDesignPrefsCookie(undefined, PREFS, SECRET, NOW), null);
  assert.deepEqual(verify(sign(), A, NOW, null), { ok: false, reason: 'no-secret' });
  assert.equal(getDesignPrefsSecret({}), null);
  assert.equal(getDesignPrefsSecret({ AUTH_SECRET: 'abc' }), 'abc');
});

console.log('2. זיוף ושינוי');
t('שינוי ה-body (הדלקת מסך A5 ידנית) -> חתימה שגויה', () => {
  const [f, body, sig] = sign(A, { palette: 'rose' }).split('.');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  payload.p.uiVariants = { shell: 'a5', home: 'a5', admin_hub: 'a5' };
  const forged = `${f}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${sig}`;
  assert.deepEqual(verify(forged), { ok: false, reason: 'bad-signature' });
  assert.equal(readDesignPrefsFromCookie(forged, A, SECRET, NOW), null);
});
t('שינוי החתימה / חיתוך / הוספת תוכן -> נדחה', () => {
  const c = sign();
  for (const bad of [flipLast(c), c.slice(0, -5), `${c}x`, `${c}.extra`, c.replace(/^dp1\./, '')]) {
    assert.equal(verify(bad).ok, false, bad.slice(0, 30));
  }
});
t('חתימה בסוד אחר -> נדחה; חתימה עם סוד של auth_session (הפרדת תחום) -> נדחה', () => {
  assert.equal(verify(signDesignPrefsCookie(A, PREFS, 'another-secret-xxxxxxxxxxxxxxxxxxxx', NOW)).ok, false);
  // טוקן auth_session אמיתי (אותו סוד) לא תקף כעוגיית העדפות
  const tok = createRequire(import.meta.url)('../lib/authTokens.js').createSessionToken({ id: A, roleId: 2 }, SECRET, NOW);
  assert.equal(verify(tok).ok, false);
});
t('replay: עוגייה של עובד A לא תקפה אצל עובד B (גם אם שם העוגייה / המפתח הוחלף)', () => {
  const cA = sign(A);
  assert.equal(verify(cA, A).ok, true);
  assert.deepEqual(verify(cA, B), { ok: false, reason: 'bad-signature' });
  assert.equal(readDesignPrefsFromCookie(cA, B, SECRET, NOW), null);
  // ה-body זהה ב-A וב-B אבל החתימות שונות
  assert.notEqual(sign(A).split('.')[2], sign(B).split('.')[2]);
});
t('פג תוקף -> expired; לפני הפקיעה תקף', () => {
  const c = sign();
  assert.equal(verify(c, A, NOW + DESIGN_PREFS_COOKIE_TTL_SECONDS * 1000 - 1).ok, true);
  assert.deepEqual(verify(c, A, NOW + DESIGN_PREFS_COOKIE_TTL_SECONDS * 1000 + 1), { ok: false, reason: 'expired' });
});
t('קלטים משובשים לא זורקים: null / מספר / אובייקט / base64 שבור / JSON שבור', () => {
  for (const raw of [null, undefined, '', 5, {}, 'dp1.', 'dp1..', 'dp1.%%%.%%%', '....', 'x'.repeat(5000)]) {
    const r = verify(raw);
    assert.equal(r.ok, false);
  }
  const body = Buffer.from('not json').toString('base64url');
  assert.equal(verify(`dp1.${body}.AAAA`).ok, false);
});

console.log('3. גרסאות');
t('העלאת גרסת פורמט (dp2) מבטלת את כל העוגיות הקיימות', () => {
  const c = sign();
  assert.deepEqual(verify(c.replace(/^dp1\./, 'dp2.')), { ok: false, reason: 'version' });
  // עוגייה שנחתמה בפורמט dp2 (עתידי) לא מתקבלת ע"י קוד dp1
  assert.equal(verify(sign(A, PREFS, NOW, { format: 'dp2' })).ok, false);
});
t('גרסת payload שונה (v:2) חתומה כהלכה -> נדחית', () => {
  assert.deepEqual(verify(sign(A, PREFS, NOW, { version: 2 })), { ok: false, reason: 'version' });
});

console.log('4. עוגייה ישנה לא חתומה (legacy)');
const legacyRaw = encodeURIComponent(JSON.stringify({ palette: 'rose', uiVariants: { shell: 'a5' } })); // כמו document.cookie בעבר
t('JSON גולמי / מקודד -> legacy-unsigned, לא נסמך (אין עקיפה אישית, אין פלטה)', () => {
  assert.deepEqual(verify(legacyRaw), { ok: false, reason: 'legacy-unsigned' });
  assert.deepEqual(verify(JSON.stringify({ uiVariants: { shell: 'a5' } })), { ok: false, reason: 'legacy-unsigned' });
  assert.equal(readDesignPrefsFromCookie(legacyRaw, A, SECRET, NOW), null);
});
t('תכנון: legacy + DB עם העדפות -> set חתום מה-DB (rebuilt=true), התוכן מה-DB ולא מהעוגייה', () => {
  const dbPrefs = { v: 1, palette: 'ocean', mode: 'dark', uiVariants: { shell: 'legacy' } };
  const plan = planDesignPrefsCookie(legacyRaw, A, dbPrefs, SECRET, NOW);
  assert.equal(plan.action, 'set'); assert.equal(plan.rebuilt, true);
  assert.deepEqual(verify(plan.value).prefs, { palette: 'ocean', uiVariants: { shell: 'legacy' } });
});
t('תכנון: legacy + DB ריק -> delete (העוגייה הישנה לא נשארת); אין עוגייה + DB ריק -> none', () => {
  assert.deepEqual(planDesignPrefsCookie(legacyRaw, A, null, SECRET, NOW), { action: 'delete' });
  assert.deepEqual(planDesignPrefsCookie(legacyRaw, A, { v: 1, mode: 'dark' }, SECRET, NOW), { action: 'delete' }, 'mode בלבד לא נכנס לעוגייה');
  assert.deepEqual(planDesignPrefsCookie(undefined, A, null, SECRET, NOW), { action: 'none' });
});
t('תכנון: עוגייה מזויפת (עקיפה שהבעלים ביטל) -> נבנית מחדש מה-DB בלי העקיפה', () => {
  const forged = sign(A, { uiVariants: { shell: 'a5' } }).replace(/.$/, 'A');
  const plan = planDesignPrefsCookie(forged, A, { v: 1, palette: 'rose' }, SECRET, NOW);
  assert.equal(plan.action, 'set'); assert.equal(plan.rebuilt, true);
  assert.deepEqual(verify(plan.value).prefs, { palette: 'rose' });
});
t('תכנון: עוגייה תקפה ותואמת -> none; ה-DB השתנה -> set בלי rebuilt; ה-DB התרוקן -> delete', () => {
  const db = { v: 1, palette: 'rose', uiVariants: { shell: 'a5' } };
  const c = sign(A, db);
  assert.deepEqual(planDesignPrefsCookie(c, A, db, SECRET, NOW + 1000), { action: 'none' });
  assert.deepEqual(planDesignPrefsCookie(c, A, { ...db, uiVariants: undefined }, SECRET, NOW + 1000).action, 'set');
  const changed = planDesignPrefsCookie(c, A, { ...db, palette: 'ocean' }, SECRET, NOW + 1000);
  assert.equal(changed.action, 'set'); assert.equal(changed.rebuilt, false);
  assert.deepEqual(planDesignPrefsCookie(c, A, { v: 1 }, SECRET, NOW + 1000), { action: 'delete' });
});
t('תכנון: עוגייה של עובד אחר באותו שם -> נבנית מחדש; סדר המפתחות בתוכן לא משנה; מתחדש אחרי חצי חיים', () => {
  const db = { v: 1, palette: 'rose', font: 'serif' };
  assert.equal(planDesignPrefsCookie(sign(B, db), A, db, SECRET, NOW).rebuilt, true);
  const reordered = signDesignPrefsCookie(A, { font: 'serif', palette: 'rose' }, SECRET, NOW);
  assert.deepEqual(planDesignPrefsCookie(reordered, A, db, SECRET, NOW), { action: 'none' });
  const late = NOW + DESIGN_PREFS_COOKIE_TTL_SECONDS * 1000 * 0.6;
  assert.equal(planDesignPrefsCookie(reordered, A, db, SECRET, late).action, 'set');
});
t('תכנון: בלי סוד -> none (אי אפשר לחתום ואי אפשר לסמוך)', () => {
  assert.deepEqual(planDesignPrefsCookie(legacyRaw, A, { v: 1, palette: 'rose' }, null, NOW), { action: 'none' });
});

console.log('5. גודל כותרות');
t('המקרה הגרוע: כל 8 המסכים + צבעים מותאמים + מפתח UUID -> ערך < 700 תווים, כל ה-Cookie header < 1KB', () => {
  const uiVariants = Object.fromEntries(['shell', 'home', 'order_card', 'customer_card', 'profile', 'admin_hub', 'attendance', 'error_report'].map((s) => [s, 'a5']));
  const c = sign(A, { ...PREFS, uiVariants });
  assert.ok(c.length < 700, `value=${c.length}`);
  const header = `designPrefs_${A}=${c}; auth_token=${A}; auth_session=${'x'.repeat(260)}; theme_${A}=contrast`;
  assert.ok(header.length < 1024, `header=${header.length}`);
  assert.ok(`designPrefs_${A}=${c}; Path=/; Max-Age=7776000; HttpOnly; Secure; SameSite=Lax`.length < 4096);
});
t('ערך גדול מדי (מעבר לתקרה) -> null במקום עוגייה שהדפדפן ידחה', () => {
  assert.ok(DESIGN_PREFS_MAX_VALUE_LENGTH <= 3000);
  assert.equal(signDesignPrefsCookie('k'.repeat(10), PREFS, SECRET, NOW, { format: 'dp1' }) !== null, true);
  assert.equal(verify(`dp1.${'a'.repeat(DESIGN_PREFS_MAX_VALUE_LENGTH)}.x`).ok, false);
});

console.log('6. השוואה timing-safe ובלי לוג של סוד');
t('המקור משתמש ב-timingSafeEqual ולא ב-=== על חתימות; אין console.* בליבה', () => {
  const src = code(read('lib/designPrefsSig.js'));
  assert.match(src, /timingSafeEqual\(given, expected\)/);
  assert.ok(!/console\./.test(src), 'אין לוגים בליבה');
  assert.ok(!/parts\[2\]\s*===|sig\s*===/.test(src));
});

console.log('7. חיווט: כל מי שקורא את העוגייה מאמת; כל מי שכותב חותם');
const SRC = {
  layout: code(read('app/layout.js')), server: code(read('app/lib/uiVariantServer.js')), route: code(read('app/lib/uiVariantRoute.js')),
  prefsRoute: code(read('app/api/me/design-prefs/route.js')), sync: code(read('app/components/DesignPrefsSync.js')),
  clientLib: code(read('app/lib/designPrefs.js')), display: code(read('app/display-settings/page.js')), helper: code(read('app/lib/designPrefsCookie.js')),
};
t('layout ו-uiVariantServer קוראים רק דרך readSignedDesignPrefs (בלי JSON.parse של העוגייה)', () => {
  assert.match(SRC.layout, /readSignedDesignPrefs\(cookieStore, authToken\.value\)/);
  assert.match(SRC.server, /readSignedDesignPrefs\(cookieStore, authToken\.value\)/);
  for (const s of [SRC.layout, SRC.server]) {
    assert.ok(!/cookieStore\.get\(`designPrefs_/.test(s), 'אין קריאה גולמית של designPrefs_<id>');
    assert.ok(!/decodeURIComponent\(designPrefs|JSON\.parse\(decodeURIComponent\(raw\)\)/.test(s));
  }
});
t('מפתח העוגייה = ערך auth_token המאומת (getVerifiedAuthCookie) בשלושת הקוראים / הכותבים', () => {
  assert.match(SRC.layout, /getVerifiedAuthCookie\(cookieStore\)/);
  assert.match(SRC.server, /getVerifiedAuthCookie\(cookieStore\)/);
  assert.match(SRC.route, /cookieKey: token\.value/);
  assert.match(SRC.prefsRoute, /cookieKey = token\.value/);
});
t('הכותבים בשרת (design-prefs GET/PUT, ui-variant POST) עוברים דרך syncDesignPrefsCookie מנתוני ה-DB', () => {
  assert.equal((SRC.prefsRoute.match(/syncDesignPrefsCookie\(/g) || []).length, 2);
  assert.match(SRC.prefsRoute, /syncDesignPrefsCookie\(res, session\.cookieStore, session\.cookieKey, next\)/);
  assert.match(SRC.prefsRoute, /syncDesignPrefsCookie\(res, session\.cookieStore, session\.cookieKey, prefs\)/);
  assert.match(SRC.route, /syncDesignPrefsCookie\(res, session\.cookieStore, session\.cookieKey, result\.nextPrefs\)/);
  assert.ok(!/res\.cookies\.set/.test(SRC.route), 'ה-route לא כותב עוגייה גולמית');
});
t('העוגייה httpOnly, נכתבת רק בשרת; הלקוח לא כותב ולא קורא אותה', () => {
  assert.match(SRC.helper, /httpOnly: true/);
  for (const s of [SRC.sync, SRC.clientLib, SRC.display]) {
    assert.ok(!/designPrefs_\$\{/.test(s.replace(/\/\/.*$/gm, '')), 'אין designPrefs_<id> בקוד לקוח');
    assert.ok(!/writeDesignPrefsCookie|readCookieUiVariants/.test(s));
  }
  // theme_<id> (מצב תצוגה בלבד, לא מרשה כלום) נשאר נכתב בלקוח
  assert.match(SRC.clientLib, /theme_\$\{employeeId\}=/);
});
t('ה-PUT עדיין מוחק uiVariants מהגוף (עובד לא מדליק A5 דרך ה-API הזה)', () => {
  assert.match(SRC.prefsRoute, /delete safeBody\.uiVariants/);
});

console.log(`\n${passed} passed${process.exitCode ? ', WITH FAILURES' : ''}`);
