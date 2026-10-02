// שומר CSS לדף הבית החדש (HomeA5): בודק סטטית, בלי דפדפן, שכללים גלובליים של האתר לא דולפים לתוך .gm-ds.gm-home
// ושלא חוזרות הטעויות שמצאנו ב-2.10.2026 (רקע לבן בלחיצה בשדה החיפוש, רצועה עליונה "כחלחלה" מול תוצאות לבנות,
// כותרות טבלה בקרם, גבול שדות בטופס המתקדם). אין תלות ב-DB, ברשת או בדפדפן.
// הרצה: node scripts/test_home_css_guard.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקה חזותית מלאה מול העיצוב: scripts/home-bg-audit/README.md
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
const HOME_CSS = read('../app/components/home/home.css');
const GLOBALS = read('../app/globals.css');
const OVERRIDES = read('../app/design-overrides.css');
const DS_GLOBAL = read('../app/design-system.css');
const PALETTE = read('../design-system/components.css');
const STOCK_CSS = read('../app/components/stock/stock-check.css'); // דף בדיקת מלאי - אותו משטר (מייבא את home.css ומוסיף רק את שלו)

let passed = 0;
let failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}

/* ---------- מנתח CSS קטן: [{ sel, body, media }] לפי סדר המקור (בלי הערות; @media נפרש, @keyframes/@font-face מדולגים) ---------- */
function parseCss(src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  const readBlock = (media) => {
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length || text[i] === '}') { i++; return; }
      const start = i;
      let depthParen = 0;
      while (i < text.length && (text[i] !== '{' || depthParen) && text[i] !== ';') {
        if (text[i] === '(') depthParen++;
        else if (text[i] === ')') depthParen--;
        i++;
      }
      if (text[i] === ';') { i++; continue; } // @import / @charset
      const head = text.slice(start, i).trim();
      i++; // {
      if (/^@(media|supports|layer|container)/.test(head)) { readBlock(head); continue; }
      let depth = 1;
      const bodyStart = i;
      while (i < text.length && depth) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') depth--;
        i++;
      }
      const body = text.slice(bodyStart, i - 1);
      if (!/^@/.test(head)) rules.push({ sel: head.replace(/\s+/g, ' '), body, media: media || '' });
    }
  };
  readBlock('');
  return rules;
}
const decls = (body) => body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
  const k = d.indexOf(':');
  return k < 0 ? null : { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() };
}).filter(Boolean);
const setsProp = (r, re) => decls(r.body).filter((d) => re.test(d.prop));
const isImportant = (d) => /!important/i.test(d.value);

// פיצול selector לפי פסיקים ברמה העליונה בלבד (לא בתוך :is(...) / :not(...) / [attr])
function splitSel(sel) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && !depth) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const homeRules = parseCss(HOME_CSS);
const globalRules = [...parseCss(GLOBALS), ...parseCss(OVERRIDES), ...parseCss(DS_GLOBAL)];
// אזור החיפוש בלבד (שורת החיפוש, הלוח המשותף, הטופס המתקדם, התוצאות, השיחה): שאר הפלטה (stepper/calc/tx...) לא באחריות הדף הזה
const SEARCH_AREA = /\.(hero|hero-in|hero-row|jshell|advonly|aishell|scan|srch|cmode|cmode-b|advp|advs|advq|advfb|advfl|advplus|advlist|advo|advdp|advgrid|inp|inpw|res-one|fu|bub|li|rtbl|tblw|vsw|vopt|xlbtn|aixl|xlrow)\b/; // (עד 2.10.2026 הייתה כאן תו backspace במקום סימן גבול-מילה, והבדיקה על הפלטה רצה על רשימה ריקה)
const paletteHome = parseCss(PALETTE).filter((r) => r.sel.includes('.gm-home') && SEARCH_AREA.test(r.sel));

/* ---------- 1. כל כלל ב-home.css בהיקף .gm-ds / .gm-home (לא נוגע בשאר האתר) ---------- */
t('כל כללי home.css בהיקף .gm-ds (לא דולפים לשאר האתר)', () => {
  const bad = [];
  for (const r of homeRules) for (const s of splitSel(r.sel)) if (!/\.gm-ds/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללי home.css בלי .gm-ds: ' + bad.join(' | '));
});

/* ---------- 2. רקע לבן קשיח: רק במקומות שהעיצוב באמת לבן (כדור החיפוש במסך הפתיחה) ---------- */
const WHITE_RE = /^(#fff(fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))\b/i;
// ברשימה הזו רק מה שהעיצוב (דף-הבית.html) באמת מציג לבן. כל תוספת צריכה אישור של הבעלים והשוואה לעיצוב.
const WHITE_OK = [
  '.gm-ds.gm-home .hero .scan', // כדור החיפוש (לבן בעיצוב, בכל מצב: ברירת מחדל / hover / focus)
  '.gm-ds.gm-home :is(.card,.stepper,.itm,.coll[open],.dhero)', // כרטיסים מחוץ למסגרת המשותפת (שגיאה וכד'): surface = לבן בעיצוב
];
t('אין רקע לבן קשיח ב-home.css מחוץ לרשימה המאושרת (כדור החיפוש)', () => {
  const bad = [];
  for (const r of homeRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) {
        const ok = splitSel(r.sel).every((s) => WHITE_OK.some((o) => s.trim().replace(/\s+/g, '').startsWith(o.replace(/\s+/g, ''))));
        if (!ok) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
      }
    }
  }
  assert.deepEqual(bad, [], 'רקע לבן שלא מופיע בעיצוב: ' + bad.join(' | '));
});

/* ---------- 3. !important על רקע: רק ברשימה מאושרת ---------- */
const IMPORTANT_BG_OK = new Set([
  '.gm-ds.gm-home .hero .scan', '.gm-ds.gm-home .hero .scan:hover', // כדור לבן (דורס את כלל "הזכוכית" של הפלטה)
  '.gm-ds.gm-home :is(.card,.stepper,.itm,.coll[open],.dhero)',
  '.gm-ds.gm-home .hero-in.jshell .card', // שקוף בתוך המסגרת המשותפת
  '.gm-ds.gm-home .rtbl thead tr th', // כותרת טבלה כחולה (דורס "כותרת דביקה" של globals.css)
]);
t('רקע עם !important ב-home.css רק בכללים המאושרים (אחרת זו דריסה שקטה של הפלטה)', () => {
  const bad = [];
  for (const r of homeRules) {
    if (!setsProp(r, /^background(-color|-image)?$/).some(isImportant)) continue;
    for (const s of splitSel(r.sel)) if (!IMPORTANT_BG_OK.has(s.replace(/\s+/g, ' '))) bad.push(s);
  }
  assert.deepEqual(bad, [], '!important חדש על רקע: ' + bad.join(' | '));
});

/* ---------- 4. דריסת media-query שמוגדרת לפני הכלל הלא-מותנה (מפסידה בקסקדה בשקט) ---------- */
function mediaBeforeBase(rules, label) {
  const bad = [];
  rules.forEach((r, idx) => {
    if (!r.media) return;
    const props = new Set(decls(r.body).map((d) => d.prop));
    for (let j = idx + 1; j < rules.length; j++) {
      const o = rules[j];
      if (o.media || o.sel !== r.sel) continue;
      const clash = decls(o.body).filter((d) => props.has(d.prop) && !isImportant(d));
      if (clash.length) bad.push(`${label}: "${r.sel}" ב-${r.media} מוגדר לפני הכלל הרגיל (${clash.map((d) => d.prop).join(', ')})`);
    }
  });
  return bad;
}
t('home.css: אין דריסת @media שמוגדרת לפני הכלל הלא-מותנה לאותו selector', () => {
  assert.deepEqual(mediaBeforeBase(homeRules, 'home.css'), []);
});
t('design-system/components.css (כללי .gm-home באזור החיפוש): אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(paletteHome, 'components.css'), []);
});

/* ---------- 5. דליפות גלובליות מוכרות: הכלל הגלובלי עדיין קיים => חייב להיות נטרול ב-home.css ---------- */
const hasHome = (selRe, propRe, { important = false, valueRe } = {}) => homeRules.some((r) => selRe.test(r.sel)
  && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));

const LEAKS = [
  {
    name: 'design-overrides.css: input:focus נותן טבעת box-shadow (--primary-light) — "רקע לבן/ורדרד בלחיצה בשדה החיפוש"',
    global: () => OVERRIDES.includes('input:not([type="checkbox"]):not([type="radio"]):focus') && /box-shadow:\s*0 0 0 3px var\(--primary-light\)/.test(OVERRIDES),
    fixed: () => hasHome(/\.scan input/, /^box-shadow$/, { valueRe: /^none/ }),
  },
  {
    name: 'design-overrides.css: input:not(x4) (0,4,1) דורס את גבול .advp .inp (0,4,0) של הפלטה',
    global: () => /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="range"\]\):not\(\[type="color"\]\)/.test(OVERRIDES),
    fixed: () => hasHome(/\.gm-home\.gm-home \.advp input\.inp/, /^border$/, { valueRe: /gold/ }),
  },
  {
    name: 'globals.css: "table thead tr th" כופה רקע קרם (--sticky-header-bg) ב-!important על כותרות טבלה',
    global: () => /table thead tr th[\s\S]{0,700}background-color:\s*var\(--sticky-header-bg[^;]*!important/.test(GLOBALS),
    fixed: () => hasHome(/\.rtbl thead tr th/, /^background-color$/, { important: true }),
  },
  {
    name: 'כלל 6 ב-home.css צובע כל .card לבן ב-!important => בתוך המסגרת המשותפת (.jshell) חייב להיות שקוף',
    global: () => hasHome(/\.card/, /^background$/, { important: true, valueRe: /gm-surface/ }),
    fixed: () => hasHome(/\.hero-in\.jshell \.card/, /^background$/, { important: true, valueRe: /^transparent/ }),
  },
  {
    name: 'כלל 6 ב-home.css כופה border-color:#fff על .scan => בתוך .jshell הגבול sky-300, ובפוקוס זהב',
    global: () => hasHome(/\.hero \.scan/, /^border-color$/, { important: true, valueRe: /#fff/ }),
    fixed: () => hasHome(/\.hero-in\.jshell \.scan(:hover)?$/, /^border-color$/, { important: true, valueRe: /sky-300/ })
      && hasHome(/\.hero-in\.jshell \.scan:focus-within/, /^border-color$/, { important: true, valueRe: /gold-b/ }),
  },
];
for (const leak of LEAKS) {
  t('נטרול דליפה: ' + leak.name, () => {
    if (!leak.global()) return; // הכלל הגלובלי כבר לא קיים (תוקן במקור) — אין מה לנטרל
    assert.ok(leak.fixed(), 'הכלל הגלובלי עדיין קיים אבל home.css לא מנטרל אותו: ' + leak.name);
  });
}

/* ---------- 6. כלל גלובלי חדש מסוג "רקע/צל על input/focus/th/card" שלא מוכר => עצירה ---------- */
// מפתח = selector כפי שמופיע ב-CSS הגלובלי. כל אחד מהם נבדק ידנית מול דף הבית (ר' docs/ui-fidelity-search-backgrounds.md).
const KNOWN_GLOBAL = new Set([
  'input, select, textarea', 'input:focus, select:focus, textarea:focus',
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]), select, textarea',
  'input:not([type="checkbox"]):not([type="radio"]):focus, select:focus, textarea:focus',
  'thead th, th', '[data-theme="dark"] thead th, [data-theme="dark"] th',
  'table thead tr th, table.items-table thead tr th, .sticky-table-header thead tr th, .sticky-th',
  '[data-theme="dark"] table thead tr th, [data-theme="dark"] table.items-table thead tr th, [data-theme="dark"] .sticky-table-header thead tr th, [data-theme="dark"] .sticky-th',
]);
const RISKY_SEL = /(^|[\s,>+~])(input|select|textarea|th|thead th|td|button)\b(?![-_])|:focus(-within)?\b/;
const RISKY_PROP = /^(background(-color|-image)?|box-shadow|border(-color)?|outline)$/;
t('אין כלל גלובלי חדש (globals/design-overrides/design-system) שמעצב input/th/focus ברקע/צל/גבול בלי היקף', () => {
  const unknown = [];
  for (const r of globalRules) {
    if (r.media) continue;
    // רק כללים עם selector "חשוף" על אלמנטים של טפסים/טבלאות/פוקוס, לא מחלקות של רכיבים ייעודיים של האתר
    const sels = splitSel(r.sel);
    const risky = sels.filter((s) => RISKY_SEL.test(s) && !/^\.|\[class|\.gm-ds|:not\(\.gm-ds/.test(s) && !/\.[a-z]/i.test(s.replace(/\[[^\]]*\]/g, '').replace(/:not\([^)]*\)/g, '')));
    if (!risky.length) continue;
    if (!setsProp(r, RISKY_PROP).length) continue;
    if (KNOWN_GLOBAL.has(r.sel)) continue;
    unknown.push(r.sel);
  }
  assert.deepEqual(unknown, [], 'כלל גלובלי חדש שעלול לדלוף לדף הבית: ' + unknown.join(' | ')
    + '\n          הוסיפו נטרול ב-app/components/home/home.css בהיקף .gm-ds.gm-home, בדקו מול העיצוב, והוסיפו את ה-selector ל-KNOWN_GLOBAL כאן.');
});

/* ---------- 6ב. דף הלו״ז (app/schedule/schedule.css) - אותה משפחת דליפות: היקף + נטרול הגופנים של design-overrides.css ---------- */
// הדף נטען בלי home.css, ולכן הנטרולים של דף הבית לא עוזרים לו. נבדק כאן רק מה שמשותף: היקף .gm-ds, אין @media לפני
// הכלל הרגיל, וכללי הגופן (!important על לחצנים/שדות וכותרות) שבלעדיהם הדף מוצג ב-Frank Ruhl/Assistant.
// רקעים/צבעים של הלו״ז מגיעים מהעיצוב המאושר (לוז-יומי.html) ולא נבדקים כאן מול רשימת הלבנים של דף הבית.
const SCHEDULE_CSS = read('../app/schedule/schedule.css');
const scheduleRules = parseCss(SCHEDULE_CSS);
const hasSched = (selRe, propRe, { important = false, valueRe } = {}) => scheduleRules.some((r) => selRe.test(r.sel)
  && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('schedule.css: כל הכללים בהיקף .gm-ds.gm-lz (לא דולפים לשאר האתר)', () => {
  const bad = [];
  for (const r of scheduleRules) for (const s of splitSel(r.sel)) if (!/\.gm-ds\.gm-lz/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללי schedule.css בלי .gm-ds.gm-lz: ' + bad.join(' | '));
});
t('schedule.css: אין דריסת @media שמוגדרת לפני הכלל הלא-מותנה לאותו selector', () => {
  assert.deepEqual(mediaBeforeBase(scheduleRules, 'schedule.css'), []);
});
t('נטרול דליפה בלו״ז: design-overrides.css כופה גופן Assistant על button/input ו-Frank Ruhl על כותרות => schedule.css מנטרל ב-!important', () => {
  const globalFonts = /button,\s*input,\s*select,\s*textarea[\s\S]{0,200}font-family:[^;]*!important/.test(OVERRIDES) || /h1, h2, h3, h4, h5, h6\s*\{\s*font-family:[^;]*!important/.test(OVERRIDES);
  if (!globalFonts) return; // הכלל הגלובלי כבר לא קיים (תוקן במקור) - אין מה לנטרל
  assert.ok(hasSched(/\.gm-ds\.gm-lz :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'schedule.css: חסר font-family:inherit!important ללחצנים/שדות');
  assert.ok(hasSched(/\.gm-ds\.gm-lz :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'schedule.css: חסר font-family:inherit!important לכותרות');
});

/* ---------- 7. אין עוד כפתור/אייקון "אחרונים" בשורת החיפוש (החלטת הבעלים 2.10.2026) ---------- */
t('בשורת החיפוש של דף הבית אין כפתור "אחרונים" (cmode-i) ואין קוד מת שלו', () => {
  const a5 = read('../app/components/home/HomeA5.js');
  assert.ok(!/cmode-i/.test(a5) && !/cmode-i/.test(HOME_CSS), 'cmode-i חזר');
  assert.ok(!/recentOpen|HomeRecents|getHistory/.test(a5), 'HomeA5.js עדיין תלוי באחרונים');
});

/* ---------- 8. דף בדיקת מלאי (app/components/stock/stock-check.css): אותו משטר כמו home.css ---------- */
const stockRules = parseCss(STOCK_CSS);
const STOCK_IMPORTANT_BG_OK = new Set([
  '.gm-ds.gm-home.stock-page .hero-in.jshell .card', // זכוכית (לבן 30% + טשטוש) כמו בעיצוב המאושר של הדף (בדיקת-מלאי.html), ערכי הפלטה
]);
t('stock-check.css: כל כלל בהיקף .gm-ds.gm-home.stock-page (לא דולף לדף הבית ולא לשאר האתר)', () => {
  const bad = [];
  for (const r of stockRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-home\.stock-page(\s|$)/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('stock-check.css: אין רקע לבן קשיח / var(--gm-surface) (הכרטיסים בעיצוב הם זכוכית, לא לבן מלא)', () => {
  const bad = [];
  for (const r of stockRules) for (const d of setsProp(r, /^background(-color)?$/)) {
    const v = d.value.replace(/!important/i, '').trim();
    if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
  }
  assert.deepEqual(bad, []);
});
t('stock-check.css: !important על רקע רק בכלל הזכוכית המאושר', () => {
  const bad = [];
  for (const r of stockRules) {
    if (!setsProp(r, /^background(-color|-image)?$/).some(isImportant)) continue;
    for (const s of splitSel(r.sel)) if (!STOCK_IMPORTANT_BG_OK.has(s.replace(/\s+/g, ' '))) bad.push(s);
  }
  assert.deepEqual(bad, []);
});
t('stock-check.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(stockRules, 'stock-check.css'), []);
});
t('stock-check.css לא מכפיל את נטרולי home.css (גופן / כרטיס / מלא-רוחב) - הדף מייבא את home.css', () => {
  const page = read('../app/components/stock/StockCheckPage.js');
  assert.ok(/import '\.\.\/home\/home\.css'/.test(page), 'StockCheckPage.js חייב לייבא ../home/home.css');
  const dup = stockRules.filter((r) => /font-family|\.app-shell \.main \.content/.test(r.sel + r.body)).map((r) => r.sel);
  assert.deepEqual(dup, [], 'כללים שכבר ב-home.css: ' + dup.join(' | '));
});
t('הפלטה: .advgrid של הטופס המתקדם נערם לעמודה אחת ברוחב צר (max-width 640px) - גם לבדיקת מלאי', () => {
  const stacked = parseCss(PALETTE).find((r) => r.media && /max-width:\s*640px/.test(r.media) && /\.gm-home \.advp \.advgrid$/.test(r.sel) && /grid-template-columns:\s*1fr\s*$/.test(r.body.trim().replace(/;$/, '')));
  assert.ok(stacked, 'חסר כלל @media שמערים את .advgrid');
});

/* ---------- 9. כפתור הורדת PDF + דף ההדפסה של התוצאות (searchPdf.js): בלי CSS חדש בדף הבית, בלי דליפת רקע ---------- */
// כפתור ה-PDF הוא כפתור ההורדה הקיים של הפלטה (xlbtn xld) — רק התווית והפעולה השתנו. כל עיצוב חדש לכפתור = כלל חדש ב-home.css = סיכון דליפה.
t('כפתור הורדת PDF: אותו כפתור פלטה (xlbtn xld), בלי מחלקה/סגנון חדש ובלי כלל xld ב-home.css', () => {
  const parts = read('../app/components/home/HomeParts.js');
  const m = /className="xlbtn xld"[\s\S]{0,300}?onClick=\{onPdf \|\| onDownload\}/.exec(parts);
  assert.ok(m, 'הכפתור השלישי ב-XlButtons חייב להישאר xlbtn xld עם onPdf');
  assert.ok(!/xlpdf|xlbtn pdf/i.test(parts + HOME_CSS), 'נוספה מחלקת כפתור PDF חדשה');
  assert.deepEqual(homeRules.filter((r) => /\.xl(btn|d|p|g)/.test(r.sel)).map((r) => r.sel), [], 'home.css לא אמור לעצב את כפתורי הייצוא (הם מהפלטה)');
});
// דף ההדפסה נכתב לחלון/שרת נפרד: צבעים קבועים בלבד, בלי משתני ערכת נושא, ורקע יחיד מאושר (אפור בהיר לכותרת קטגוריה + לבן)
t('searchPdf.js: דף ההדפסה בלי משתני ערכת נושא ועם רקעים מאושרים בלבד (#fff / #f3f3f3 / #e9ebee למסך הדפדפן)', () => {
  const src = read('../app/components/home/searchPdf.js');
  assert.ok(!/var\(--/.test(src), 'משתנה CSS בדף ההדפסה');
  const bgs = [...src.matchAll(/background(?:-color)?:\s*([^;'+]+)/g)].map((x) => x[1].trim());
  const bad = bgs.filter((v) => !/^(#fff|#f3f3f3|#e9ebee)$/i.test(v));
  assert.deepEqual(bad, [], 'רקע לא מאושר בדף ההדפסה: ' + bad.join(' | '));
  assert.ok(!/background-image|url\(/.test(src.replace(/@import url\([^)]*\);/, '').replace(/\/\/.*$/gm, '')), 'תמונת רקע בדף ההדפסה');
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
