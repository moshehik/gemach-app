// עמדת הלקוח (/customer-interface) מרונדרת "ללא שלד האתר" (12.10.2026): בדיקות סטטיות + לוגיקה טהורה, בלי שרת ובלי DB.
// הרצה (מהשורש): node scripts/test_kiosk_bare.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isKioskBarePath } from '../lib/shellBare.js';
import { isForcedLegacyPath } from '../lib/uiVariant.js';

const read = (f) => readFileSync(new URL(f, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const noComments = (src) => src.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
let passed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, e.message); process.exitCode = 1; }
};

t('הנתיב: העמדה ותת-נתיביה בלבד, לפי גבול מקטע', () => {
  for (const p of ['/customer-interface', '/customer-interface/', '/customer-interface/x', '/customer-interface?a=1', '/customer-interface#h']) assert.equal(isKioskBarePath(p), true, p);
  for (const p of ['/customer-interfaces', '/customer-interface-evil', '/', '/station', '/orders', '/admin/customer-interface', '', null, undefined, 5]) assert.equal(isKioskBarePath(p), false, String(p));
});
t('כל נתיב bare הוא גם "legacy" למעטפת (אין מצב שבו מעטפת A5 מוצגת בעמדה)', () => {
  assert.equal(isForcedLegacyPath('/customer-interface'), true);
});

const layout = read('../app/layout.js');
t('layout.js: kioskBare נגזר מ-x-pathname דרך lib/shellBare', () => {
  assert.match(layout, /import \{ isKioskBarePath \} from '@\/lib\/shellBare';/);
  assert.match(layout, /const kioskBare = isKioskBarePath\(requestPathname\);/);
});
t('layout.js: kioskBare בענף "בלי מעטפת" (לא ShellSwitch / PrefetchManager / GuideProvider / AI), לא בונה menuTree, ותמיד בהיר', () => {
  assert.match(layout, /\(punchBare \|\| printBare \|\| stationBare \|\| kioskBare\) \? \(/);
  assert.match(layout, /uiVariants\.shell === 'a5' && !showLogin && !printBare && !stationBare && !kioskBare/);
  assert.match(layout, /const lightChrome = showLogin \|\| punchBare \|\| printBare \|\| kioskBare;/);
});
t('layout.js: באנרי הצוות / חלון משלוח משותף עטופים ב-HideOnKioskBare (ניווט רך אל העמדה)', () => {
  assert.match(layout, /<HideOnKioskBare><SharedDeliveryNoticeHost \/><\/HideOnKioskBare>/);
  for (const c of ['ClipboardDebugger', 'DevEnvBanner', 'PreviewModeBanner', 'BackupModeBanner']) assert.match(layout, new RegExp('<HideOnKioskBare><' + c), c);
});
t('אבטחה: פטור קיר ההתחברות לא שונה - העמדה נשארת isPublicKiosk בדיוק כמו קודם; kioskBare לא נכנס ל-showLogin', () => {
  assert.match(layout, /const isPublicKiosk = requestPathname\.startsWith\('\/customer-interface'\) \|\| stationBare;/);
  assert.match(layout, /const showLogin = requireLogin && !isAuthenticated && !isPublicKiosk && !isPunchClock && !isPublicDoc;/);
});
t('ShellSwitch: בנתיב העמדה מרנדר רק את התוכן (בלי AppShell ובלי MenuA5Shell) - ניווט רך', () => {
  const s = read('../app/components/menu/ShellSwitch.js');
  assert.match(s, /usePathname/);
  const body = s.slice(s.indexOf('export default function ShellSwitch'));
  const iBare = body.indexOf('isKioskBarePath(pathname)');
  assert.ok(iBare > 0 && iBare < body.indexOf('<MenuA5Shell menuTree') && iBare < body.indexOf('<AppShell'), 'הבדיקה חייבת לבוא לפני בחירת המעטפת');
});
t('HideOnKioskBare: לקוח, לפי usePathname', () => {
  const s = read('../app/components/HideOnKioskBare.js');
  assert.match(s, /^'use client';/);
  assert.match(s, /usePathname/);
  assert.match(s, /isKioskBarePath\(pathname\)/);
});
t('AIFloatingWidget משתמש באותו נתיב', () => {
  assert.match(read('../app/components/AIFloatingWidget.js'), /isKioskBarePath\(pathname\) \|\| hideAIFeatures/);
});
t('"חזרה למערכת": ניווט מלא ל-/ (ה-layout לא מרונדר מחדש בניווט רך, ולכן אחרת הדף היה נטען בלי תפריט), בשתי העמדות', () => {
  const a5 = noComments(read('../app/components/kiosk/KioskA5.js'));
  assert.match(a5, /const exitToSystem = \(\) => \{ window\.location\.assign\('\/'\); \};/);
  assert.match(a5, /if \(isLocked\) \{ setUnlockIntent\('unlock'\); setShowUnlockModal\(true\); return; \} exitToSystem\(\);/);
  assert.doesNotMatch(a5, /router\.push/);
  const legacy = noComments(read('../app/customer-interface/LegacyKioskPage.js'));
  assert.match(legacy, /window\.location\.assign\('\/'\)/);
  assert.doesNotMatch(legacy, /router\.push/);
});
t('הנעילה נשארה: body.hide-global-nav + מסך מלא (הגנה כפולה; הכלל ב-globals.css נשאר)', () => {
  assert.match(read('../app/components/kiosk/KioskA5.js'), /classList\.add\('hide-global-nav'\)/);
  assert.match(read('../app/globals.css'), /body\.hide-global-nav \.app-shell > \.sidebar/);
});
t('העמדה הציבורית /station ודפי ההדפסה לא נפגעו (stationBare / printBare)', () => {
  assert.match(layout, /const stationBare = requestPathname === '\/station'/);
  assert.match(layout, /const printBare = requestPathname === '\/schedule\/print'/);
});

// ----- חלבי + בלי "שאלי את ה-AI" -----
const css = read('../app/components/kiosk/kiosk-a5.css');
const tokens = read('../design-system/tokens.css');
const comps = read('../design-system/components.css');
const rule = (sel) => {
  const i = css.indexOf(sel);
  assert.ok(i >= 0, sel);
  return css.slice(i, css.indexOf('}', i));
};
t('טוקן --gm-milk מוגדר פעם אחת בפלטה ומשמש גם את מסגרת התוצאות של דף הבית וגם את העמדה (אותו גוון)', () => {
  assert.match(tokens, /--gm-milk:rgba\(255,255,255,\.6\);/);
  assert.match(comps, /\.gm-ds\.gm-home \.hero-in\.jshell\{position:relative;background:var\(--gm-milk\);/);
});
const MILK_SELECTORS = ['.gm-ds.gm-ks .ks-toolbar{', '.gm-ds.gm-ks .ks-datebar{', '.gm-ds.gm-ks .ks-filter{', '.gm-ds.gm-ks .ks-msearch{', '.gm-ds.gm-ks .ks-aipill{',
  '.gm-ds.gm-ks .ks-sel select{', '.gm-ds.gm-ks .tile{', '.gm-ds.gm-ks .ks-row{', '.gm-ds.gm-ks .ks-table-wrap{', '.gm-ds.gm-ks .empty.ks-state{', '.gm-ds.gm-ks .ks-cta{', '.gm-ds.gm-ks .ks-card{'];
t('כל המסננים והכרטיסים בעמדה על --gm-milk (סרגל, פס תאריך, פאנל סינון, שדות חיפוש, אריחים, שורות, טבלה, כרטיסי מצב / CTA / טופס)', () => {
  for (const sel of MILK_SELECTORS) assert.match(rule(sel), /background:var\(--gm-milk\)/, sel);
});
t('בלי רקעים לבנים קשיחים בכרטיסים / מסננים (rgba 255 / #fff) - רק טוקנים', () => {
  for (const sel of MILK_SELECTORS) assert.doesNotMatch(rule(sel), /background:(#fff|rgba\(255,255,255)/, sel);
});
t('לחצני האייקון בסרגל התוצאות: גודל אחיד', () => {
  assert.match(rule('.gm-ds.gm-ks .ks-toolbar .ibtn{'), /flex:none;width:44px;height:44px/);
});
t('שדה ה-AI בסרגל התוצאות: בלי placeholder גלוי ("שאלי את ה-AI"), עם aria-label; הכבוד להגדרות ה-AI נשמר', () => {
  const k = read('../app/components/kiosk/KioskA5.js');
  const line = k.split('\n').find((l) => l.includes('data-agy-id="catalog_ai_input"'));
  assert.ok(line, 'השדה קיים');
  assert.doesNotMatch(line, /placeholder/);
  assert.match(line, /aria-label="שאלי את העוזר החכם"/);
  assert.doesNotMatch(k, /שאלי את ה-AI/);
  assert.match(k, /const aiEnabled = settings\.hide_ai_features !== 'true' && settings\.enable_ai_specific_employees !== 'true';/);
  assert.match(k, /\{aiEnabled && \(isAiChatVisible/);
});

console.log(passed + ' passed' + (process.exitCode ? ' (with failures)' : ''));
