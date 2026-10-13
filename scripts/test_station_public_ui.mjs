// עמדת הלקוח הציבורית /station - עיצוב (13.10.2026): מסגרות חצי שקופות (var(--gm-milk)), כיוון חצים RTL, וטופס "מילוי פרטים אישיים" כשורות של טופס "לקוחה חדשה"
// עם מתגים דו-מצביים. בדיקות סטטיות על ה-CSS / הקוד + רינדור SSR (renderToStaticMarkup) של KioskRegistration ו-KioskPublic. בלי DB, שרת או דפדפן.
// הרצה: node scripts/test_station_public_ui.mjs   (יוצא עם קוד 1 אם משהו נכשל)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

/* ---------- הרצת JSX / ESM של האתר ב-Node: SWC של Next -> CommonJS, כינוי @/, מחלקות CSS מדומות, @hebcal/core מדומה (לא נקרא בנתיבים הנבדקים) ---------- */
const swc = require(path.join(ROOT, 'node_modules/next/dist/build/swc'));
await swc.loadBindings();
const origLoad = Module._load;
const origResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...rest) {
  if (typeof request === 'string' && request.startsWith('@/')) request = path.join(ROOT, request.slice(2));
  return origResolve.call(this, request, ...rest);
};
Module._load = function load(request, ...rest) {
  if (typeof request === 'string' && request.endsWith('.css')) return {};
  if (request === '@hebcal/core' || request.startsWith('@hebcal/')) return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : class {}) });
  if (request === 'next/link') {
    const R = origLoad.call(this, 'react', ...rest);
    return { __esModule: true, default: ({ href, children, ...p }) => R.createElement('a', { href, ...p }, children) };
  }
  return origLoad.call(this, request, ...rest);
};
const origJs = Module._extensions['.js'];
Module._extensions['.js'] = function ext(module, filename) {
  const norm = filename.split(path.sep).join('/');
  if (!norm.startsWith(ROOT.split(path.sep).join('/')) || norm.includes('/node_modules/')) return origJs(module, filename);
  const out = swc.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    jsc: { parser: { syntax: 'ecmascript', jsx: true }, transform: { react: { runtime: 'automatic' } } },
    module: { type: 'commonjs' },
  });
  return module._compile(out.code, filename);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const h = React.createElement;
const KioskRegistration = require(path.join(ROOT, 'app/components/kiosk/KioskRegistration.js')).default;
const KioskPublic = require(path.join(ROOT, 'app/components/kiosk/KioskPublic.js')).default;
const { getMissingRegFields, settingsFromRules } = require(path.join(ROOT, 'app/components/kiosk/kioskLogic.js'));

const html = (node) => renderToStaticMarkup(node);
const classes = (s) => [...s.matchAll(/class="([^"]*)"/g)].map((m) => m[1].split(/\s+/));
const countClass = (s, c) => classes(s).filter((l) => l.includes(c)).length;

/* ---------- מנתח CSS קטן: [{ sel, body }] לפי סדר המקור (בלי הערות; @media נפרש, @keyframes / @font-face מדולגים) ---------- */
function parseCss(src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  const block = () => {
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length || text[i] === '}') { i++; return; }
      const start = i;
      let depth = 0;
      while (i < text.length && (text[i] !== '{' || depth) && text[i] !== ';') { if (text[i] === '(') depth++; else if (text[i] === ')') depth--; i++; }
      if (text[i] === ';') { i++; continue; }
      const sel = text.slice(start, i).trim();
      i++; // {
      if (/^@(media|supports)/.test(sel)) { block(); continue; }
      if (sel.startsWith('@')) { let d = 1; while (i < text.length && d) { if (text[i] === '{') d++; else if (text[i] === '}') d--; i++; } continue; }
      const bs = i;
      while (i < text.length && text[i] !== '}') i++;
      rules.push({ sel, body: text.slice(bs, i).trim() });
      i++;
    }
  };
  block();
  return rules;
}
const CSS = read('app/components/kiosk/kiosk-a5.css');
const RULES = parseCss(CSS);
const bodyOf = (re) => RULES.filter((r) => r.sel.split(',').some((s) => re.test(s.trim()))).map((r) => r.body).join(';');
const hexes = (s) => (s.match(/#[0-9a-fA-F]{3,8}\b/g) || []);

const REG_SRC = read('app/components/kiosk/KioskRegistration.js');
const PUB_SRC = read('app/components/kiosk/KioskPublic.js');
const CAL_SRC = read('app/components/kiosk/KioskCalendar.js');
const SPRITE = read('app/components/menu/spriteSymbols.js');
const spritePath = (id) => { const m = new RegExp(`\\["${id}","0 0 24 24",\\[\\["path",\\{"d":"([^"]+)"`).exec(SPRITE); return m ? m[1] : null; };

/* ---------- טופס "מילוי פרטים אישיים": SSR ---------- */
const RULES_ALL = { required: { email: true, address: true, idNumber: true }, oneOf: [['phone2', 'email']], marketingMustBeYes: true };
const reg = (props = {}) => html(h(KioskRegistration, { mode: 'public', rules: RULES_ALL, onBack: () => {}, ...props }));

console.log('KioskRegistration: שורה תחת שורה, שדות הפלטה');
t('כל שדה בשורה משלו: עמודה אחת (.ks-col), בלי רשת ובלי שדות מקבילים', () => {
  const s = reg();
  assert.equal(countClass(s, 'ks-col'), 2); // עמודת השדות + עמודת המתגים
  assert.equal(countClass(s, 'ks-grid'), 0);
  assert.ok(!/ks-grid|ks-span2/.test(s) && !/ks-grid|ks-span2/.test(CSS));
  const bodyCol = bodyOf(/\.ks-col$/);
  assert.match(bodyCol, /display:flex/);
  assert.match(bodyCol, /flex-direction:column/);
});
t('שדות: תשעה בסך הכול עם טלפון נוסף (שם פרטי / משפחה / ת"ז / נייד / נוסף / מייל / עיר / רחוב / בית), כל אחד field > lbl + inpw > inp', () => {
  const s = reg();
  assert.equal(countClass(s, 'field'), 9);
  assert.equal(countClass(s, 'lbl'), 9);
  assert.equal(countClass(s, 'inpw'), 9);
  assert.equal(classes(s).filter((l) => l.includes('inp')).length, 9);
  // כמו CcInput: אייקון בתוך .inpw לפני השדה, ולחצן ניקוי .inpx אחריו
  assert.equal([...s.matchAll(/<div class="inpw"><svg class="ic sm"/g)].length, 9);
  assert.equal(countClass(s, 'inpx'), 9);
  assert.match(s, /<form class="ks-card ks-form dfields"/);
});
t('בלי טלפון נוסף כשהשרת לא ביקש (rules בלי oneOf): שמונה שדות', () => {
  assert.equal(countClass(reg({ rules: { required: {} } }), 'field'), 8);
});
t('כוכביות לפי rules: ת"ז / מייל / עיר / רחוב / בית נדרשים; בלי rules אין כוכבית', () => {
  const s = reg();
  for (const l of ['תעודת זהות *', 'אימייל *', 'עיר מגורים *', 'רחוב *', 'מספר בית *', 'שם פרטי *', 'שם משפחה *', 'טלפון נייד *']) assert.ok(s.includes(`>${l}</label>`), l);
  const n = reg({ rules: { required: {} } });
  for (const l of ['תעודת זהות', 'אימייל', 'עיר מגורים', 'רחוב', 'מספר בית']) assert.ok(n.includes(`>${l}</label>`), 'ללא כוכבית: ' + l);
});
t('כל שדה מקושר לתווית (htmlFor = id) ובעל data-agy-id', () => {
  const s = reg();
  for (const id of ['ks-r-first', 'ks-r-last', 'ks-r-id', 'ks-r-phone', 'ks-r-phone2', 'ks-r-mail', 'ks-r-city', 'ks-r-street', 'ks-r-house']) {
    assert.ok(s.includes(`for="${id}"`), 'label for ' + id);
    assert.ok(s.includes(`id="${id}"`), 'input ' + id);
  }
  assert.ok(s.includes('data-agy-id="reg_firstName_input"'));
});
t('שדות הטקסט משתמשים בכללי הפלטה (.dfields .inp): בכללי הטופס ב-CSS אין כלל .lbl / .inpw / .inpx / .inp מקביל, ול-.field/.inp רק פריסה (רוחב / שוליים / גבול שגיאה)', () => {
  const regCss = CSS.slice(CSS.indexOf('/* ===== מילוי פרטים אישיים'), CSS.indexOf('/* ===== חלונות'));
  const rules = parseCss(regCss);
  for (const r of rules) {
    for (const sel of r.sel.split(',').map((x) => x.trim())) {
      const last = sel.split(/\s+/).pop();
      if (/^\.(lbl|inpw|inpx)$/.test(last)) assert.fail('כלל מקביל: ' + sel);
      if (/^\.(inp|field)$/.test(last) || /\.field\.bad \.inp$/.test(sel)) {
        assert.ok(/^(\s*(width|max-width|margin|border-color)\s*:[^;]+;?)+$/.test(r.body.replace(/!important/g, '').trim()), 'כלל ' + sel + ' חורג מפריסה: ' + r.body);
      }
    }
  }
  assert.ok(/\.ks-form\.dfields \.field/.test(CSS));
});
t('שגיאה לפי שדה: .field.bad + הודעה מתחת לשדה (שדה חובה) אחרי ניסיון שליחה', () => {
  assert.match(REG_SRC, /className=\{`field\$\{bad \? ' bad' : ''\}`\}/);
  assert.match(REG_SRC, /className="ks-ferr" role="alert"/);
  assert.match(bodyOf(/\.field\.bad \.inp$/), /border-color:var\(--gm-rose-500\)/);
});

console.log('KioskRegistration: מתגים דו-מצביים במקום כן / לא');
t('שלוש הבחירות (תקנון / דיוורים / פרטיות) הן label.sw עם checkbox, בשורת .trow', () => {
  const s = reg();
  assert.equal(countClass(s, 'sw'), 3);
  assert.equal(countClass(s, 'trow'), 3);
  for (const id of ['ks-terms', 'ks-mkt', 'ks-priv']) assert.match(s, new RegExp(`<label class="sw"><input type="checkbox" id="${id}"`));
  assert.equal(countClass(s, 'ks-swrow'), 3);
});
t('אין עוד כפתורי כן / לא: בלי radiogroup, role=radio, btn tgl, ks-yn, YesNo, ולא "כן" / "לא" ככפתורים', () => {
  const s = reg();
  assert.ok(!/role="radio"|role="radiogroup"|ks-yn|cnf-yn|btn tgl|type="checkbox"[^>]*class="ks-check"/.test(s));
  assert.ok(!/<button[^>]*>\s*(כן|לא)\s*<\/button>/.test(s));
  assert.ok(!/YesNo/.test(REG_SRC));
  assert.ok(!/YesNo|ks-yn/.test(read('app/components/kiosk/KioskParts.js')) && !/ks-yn/.test(CSS));
});
t('מצב ראשוני: כל המתגים כבויים (אין checked)', () => {
  const s = reg();
  assert.ok(!/<input type="checkbox"[^>]*checked/.test(s));
});
t('ליד כל מתג הסבר למשמעות המצב הכבוי, מקושר ב-aria-describedby', () => {
  const s = reg();
  assert.match(s, /id="ks-terms-h">כבוי = עדיין לא חתמת/);
  assert.match(s, /id="ks-mkt-h">כבוי = לא מאשר\/ת קבלת דיוורים/);
  assert.match(s, /id="ks-priv-h">חובה לאשר/);
  for (const id of ['ks-terms', 'ks-mkt', 'ks-priv']) assert.ok(s.includes(`aria-describedby="${id}-h"`), id);
});
t('סימון חובה: פרטיות תמיד; דיוורים רק כש-marketingMustBeYes; תקנון בלי כוכבית (כבוי = "לא" מפורש מותר)', () => {
  const s = reg();
  assert.ok(s.includes('אישרתי את מדיניות הפרטיות *'));
  assert.ok(s.includes('מאשר/ת קבלת דיוורים *'));
  assert.ok(!s.includes('חתמ/ה על התקנון *'));
  const n = reg({ rules: { required: {} } });
  assert.ok(n.includes('>מאשר/ת קבלת דיוורים</label>'));
});
t('קישורים: "צפייה בתקנון" ו"מדיניות פרטיות" נשארים (לחצני חלון, לא ניווט)', () => {
  const s = reg();
  assert.match(s, /data-agy-id="kiosk_view_terms_btn"[^>]*>.*צפייה בתקנון/);
  assert.match(s, /data-agy-id="kiosk_view_privacy_btn"[^>]*>.*מדיניות פרטיות/);
});
t('החוזה: מתג כבוי נשלח כ-false מפורש (EMPTY בוליאני), ורק פרטיות (ודיוור כשנדרש "כן") חוסמים שליחה', () => {
  assert.match(REG_SRC, /acceptedTerms: false, marketingConsent: false, acceptedPrivacy: false/);
  assert.match(REG_SRC, /marketingConsent: showMarketing \? form\.marketingConsent : false/);
  const empty = { firstName: 'א', lastName: 'ב', phone1: '0501234567', zeout: '', email: '', city: '', street: '', houseNum: '', acceptedTerms: false, marketingConsent: false, acceptedPrivacy: false };
  assert.deepEqual(getMissingRegFields(empty, {}), ['acceptedPrivacy']);
  assert.deepEqual(getMissingRegFields({ ...empty, acceptedPrivacy: true }, {}), []);
  assert.deepEqual(getMissingRegFields({ ...empty, acceptedPrivacy: true }, settingsFromRules(RULES_ALL)).includes('marketingConsent'), true);
  assert.deepEqual(getMissingRegFields({ ...empty, acceptedPrivacy: true, marketingConsent: true }, { require_marketing_consent: 'true' }), []);
});
t('ניווט Enter: אותו hook משותף; checkbox הוא עצירה (Enter מקדם, רווח משנה); data-enter-submit בלחצן השליחה', () => {
  assert.match(REG_SRC, /useEnterNavigation/);
  assert.match(REG_SRC, /onKeyDown=\{onFormKeyDown\}/);
  assert.match(reg(), /data-enter-submit=""/);
  const nav = read('lib/enterNavigation.js');
  assert.match(nav, /ENTER_STOP_SELECTOR = 'input, select, textarea/);
  assert.ok(!/data-enter-skip/.test(reg()));
});
t('useNoFill נשאר על כל שדה טקסט; honeypot נשאר מוסתר', () => {
  assert.match(REG_SRC, /useNoFill\(\)/);
  assert.equal((REG_SRC.match(/\{\.\.\.nf\(/g) || []).length, 9);
  assert.match(reg(), /class="ks-hp" aria-hidden="true"/);
});
t('מתגים: שורת המתג בנויה מרכיבי הפלטה (.sw/.trow) ולא מ-CSS מקביל; פריסת ההסבר ללא היסט קשיח', () => {
  assert.ok(!RULES.some((r) => r.sel.split(',').some((x) => /(^|\s)\.sw(\s|:|$|\.|\[)/.test(x.trim()))), 'אין כלל .sw מקביל');
  assert.ok(!/(margin|padding)-inline-start:\s*\d+px/.test(bodyOf(/\.ks-swrow/)));
});

/* ---------- חצים (RTL): הקודם = ימינה (arrr), הבא = שמאלה (arrl) ---------- */
console.log('כיוון חצים');
t('אייקוני הפלטה: arrl מצביע שמאלה (ראש החץ בקצה השמאלי), arrr ימינה', () => {
  assert.match(spritePath('arrl'), /^M19 12H5/); // הקו מסתיים ב-x=5: ראש החץ בצד שמאל
  assert.match(spritePath('arrr'), /^M5 12h14/); // מסתיים ב-x=19: ראש החץ בצד ימין
  assert.match(spritePath('back'), /^M5 12h14/); // back = כמו arrr: "חזרה" ב-RTL
});
t('לוח התאריך: החודש הקודם arrr והבא arrl, וה-CSS לא מסובב את האייקונים', () => {
  assert.match(CAL_SRC, /data-calnav="-1"[^>]*onClick=\{prevMonth\}><KIcon id="arrr"/);
  assert.match(CAL_SRC, /data-calnav="1"[^>]*onClick=\{nextMonth\}><KIcon id="arrl"/);
  assert.ok(!/data-calnav[^{]*\.ic\s*\{[^}]*rotate/.test(CSS));
  assert.ok(!/\bchev\b/.test(CAL_SRC.replace(/\/\/.*$/gm, '')));
});
t('דף הבית של העמדה: כרטיסי "להתחלה" / "למילוי הפרטים" וכפתור "הצגת השמלות" עם arrl (קדימה = שמאלה); "חזרה" עם back', () => {
  const home = html(h(KioskPublic, { config: { enabled: true, showInventory: true, showRegistration: true, registration: null } }));
  const ems = [...home.matchAll(/<em>(.*?)<\/em>/g)].map((m) => m[1]);
  assert.equal(ems.length, 2);
  for (const e of ems) { assert.ok(e.includes('href="#gmi-arrl"'), e); assert.ok(!e.includes('gmi-back') && !e.includes('gmi-arrr'), e); }
  assert.match(PUB_SRC, /הצגת השמלות<KIcon id="arrl"/);
  assert.equal((PUB_SRC.match(/<KIcon id="back" size="sm" \/>חזרה/g) || []).length, 2); // "חזרה" = back (ימינה)
  assert.ok(!/<em>[^<]*<KIcon id="back"/.test(PUB_SRC));
});
t('אין חץ SVG ידני בעמדה הציבורית (כולם מהפלטה)', () => {
  assert.ok(!/<svg[^>]*viewBox="0 0 28 20"/.test(PUB_SRC));
});

/* ---------- חצי שקוף ---------- */
console.log('מסגרות חצי שקופות');
const MILK_PANELS = [
  ['.kp-card', /\.kp-card$/], ['.kp-datechip', /\.kp-datechip$/], ['.kp-bar .btn.ghost', /\.kp-bar \.btn\.ghost$/], ['.kp-unavail', /\.kp-unavail$/],
  ['.caldock', /\.caldock$/], ['.ks-card', /\.ks-card$/], ['.tile', /\.tile$/], ['.ks-toolbar', /\.ks-toolbar$/], ['.ks-filter', /\.ks-filter$/], ['.ks-cta', /\.ks-cta$/],
  ['.ks-row', /\.ks-row$/], ['.ks-table-wrap', /\.ks-table-wrap$/], ['.empty.ks-state', /\.empty\.ks-state$/], ['.ks-datesum:not(:empty)', /\.ks-datesum:not\(:empty\)$/],
];
for (const [name, re] of MILK_PANELS) {
  t(`${name}: רקע var(--gm-milk) (בלי לבן קשיח או צבע מקודד)`, () => {
    const decl = RULES.filter((r) => r.sel.split(',').some((s) => re.test(s.trim()))).map((r) => r.body).join(';');
    assert.ok(decl, 'אין כלל');
    const bg = (decl.match(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/g) || []).pop() || '';
    assert.match(bg, /var\(--gm-milk\)/, bg);
    assert.ok(!/rgba\(255,\s*255,\s*255|#fff/i.test(bg), bg);
  });
}
t('טשטוש עדין (backdrop-filter) על כל המסגרות החצי שקופות, מטוקן אחד', () => {
  const rule = RULES.find((r) => /backdrop-filter:var\(--ks-blur\)/.test(r.body) && /\.kp-card/.test(r.sel));
  assert.ok(rule, 'כלל טשטוש משותף');
  for (const name of ['.ks-card', '.tile', '.caldock', '.kp-card', '.kp-datechip', '.kp-unavail', '.empty.ks-state', '.ks-toolbar', '.ks-filter']) assert.ok(rule.sel.includes(name), name);
  assert.match(bodyOf(/^\.gm-ds\.gm-ks$/), /--ks-blur:blur\(\d+px\)/);
});
t('אין רקע לבן שקוף מקודד על לוחות המסלול הציבורי (kp-*)', () => {
  const kp = RULES.filter((r) => /\.kp-/.test(r.sel)).map((r) => r.body).join(';');
  assert.ok(!/background:rgba\(255,255,255/.test(kp), 'רקע לבן שקוף קשיח ב-kp-*');
});
t('הגדרת --gm-milk קיימת בטוקנים ושקופה (alpha < 1)', () => {
  const m = /--gm-milk:\s*rgba\(255,255,255,\s*(\.\d+|0?\.\d+)\)/.exec(read('design-system/tokens.css'));
  assert.ok(m && parseFloat(m[1]) < 1);
});
t('בלי צבע hex חדש: בקוד הטופס, בכללי הטופס ב-CSS ובכללי המסלול הציבורי החדשים', () => {
  assert.deepEqual(hexes(REG_SRC.replace(/\/\/.*$/gm, '')), []);
  const regCss = CSS.slice(CSS.indexOf('/* ===== מילוי פרטים אישיים'), CSS.indexOf('/* ===== חלונות'));
  assert.ok(regCss.length > 500);
  assert.deepEqual(hexes(regCss), []);
  const pubCss = CSS.slice(CSS.indexOf('/* ===== המסלול הציבורי'));
  const hardHexBefore = ['#9a7a1f', '#f7e3ab', '#e0c56e', '#fff6d8', '#c9a227']; // ההדרגה הזהובה הקיימת של הכותרת (לא חדשה)
  const found = hexes(pubCss).filter((x) => !hardHexBefore.includes(x.toLowerCase()) && x.toLowerCase() !== '#fff'); // #fff: טקסט ריחוף קיים על רקע נייבי
  assert.deepEqual(found, []);
  assert.deepEqual(hexes(bodyOf(/\.ks-datesum:not\(:empty\)$/)), []);
});
t('הטופס ללא גודל קשיח חדש מסוג היסט (margin-inline / padding-inline בפיקסלים) ועם רוחב נגזר', () => {
  assert.match(bodyOf(/\.ks-reg$/), /width:min\(\d+px,100%\)/);
});

console.log(`\n${passed} passed${process.exitCode ? ' (with failures)' : ''}`);
