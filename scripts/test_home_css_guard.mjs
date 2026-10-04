// שומר CSS לדף הבית החדש (HomeA5): בודק סטטית, בלי דפדפן, שכללים גלובליים של האתר לא דולפים לתוך .gm-ds.gm-home
// ושלא חוזרות הטעויות שמצאנו ב-2.10.2026 (רקע לבן בלחיצה בשדה החיפוש, רצועה עליונה "כחלחלה" מול תוצאות לבנות,
// כותרות טבלה בקרם, גבול שדות בטופס המתקדם). אין תלות ב-DB, ברשת או בדפדפן.
// הרצה: node scripts/test_home_css_guard.mjs   (יוצא עם קוד 1 אם משהו נכשל)
// בדיקה חזותית מלאה מול העיצוב: scripts/home-bg-audit/README.md
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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

/* ---------- 6א. עטיפת הטבלה (.tblw) לא חתוכה (באג 4.10.2026: "עוד N" בתצוגת טבלה - אי אפשר לגלול לשורות התחתונות) ---------- */
// globals.css: `div:has(> table){max-height:75vh;overflow-y:auto}` ("כותרת דביקה") תופס גם את .gm-ds .tblw, והפלטה קובעת לו overflow:hidden =>
// גוף הטבלה נחתך ב-75vh בלי גלילה פנימית. התיקון: max-height:none ל-.gm-ds .tblw (ספציפיות גבוהה מ-div:has(> table)), כך שהדף הוא שגולל.
// בדיקה בדפדפן אמיתי (גלגלת + מגע): scripts/home-scroll-audit/README.md.
t('globals.css: .gm-ds .tblw פטור ממגבלת ה-75vh של div:has(> table) (אחרת "עוד N" בטבלה חותך שורות)', () => {
  assert.ok(globalRules.some((r) => r.sel === 'div:has(> table)' && setsProp(r, /^max-height$/).length), 'הכלל הגלובלי div:has(> table){max-height} נעלם - אפשר להסיר את הפטור והבדיקה הזו');
  const ex = globalRules.filter((r) => splitSel(r.sel).includes('.gm-ds .tblw') && setsProp(r, /^max-height$/).some((d) => /^none\b/.test(d.value)));
  assert.ok(ex.length, 'חסר `.gm-ds .tblw { max-height: none }` ב-app/globals.css (אחרי הכלל div:has(> table))');
  const all = globalRules.map((r, i) => ({ r, i }));
  const gi = all.find((x) => x.r.sel === 'div:has(> table)' && setsProp(x.r, /^max-height$/).length).i;
  assert.ok(all.find((x) => x.r === ex[0]).i > gi, 'הפטור של .tblw חייב לבוא אחרי הכלל הגלובלי (ובספציפיות גבוהה ממנו)');
});
t('אף כלל בפלטה / home.css / stock-check.css / schedule.css לא מגביל גובה לעטיפת הטבלה (.tblw) - הדף גולל, לא העטיפה', () => {
  const bad = [];
  for (const [label, rules] of [['components.css', parseCss(PALETTE)], ['home.css', homeRules], ['stock-check.css', parseCss(STOCK_CSS)], ['schedule.css', parseCss(read('../app/schedule/schedule.css'))]]) {
    for (const r of rules) {
      if (!splitSel(r.sel).some((s) => /\.tblw\b(?!\s+\S)/.test(s) || /\.tblw$/.test(s))) continue;
      for (const d of setsProp(r, /^(max-height|height)$/)) if (!/^(none|auto|unset|initial)\b/.test(d.value)) bad.push(`${label}: ${r.sel} { ${d.prop}: ${d.value} }`);
      for (const d of setsProp(r, /^overflow(-y)?$/)) if (/\b(auto|scroll)\b/.test(d.prop === 'overflow' ? d.value.split(/\s+/).pop() : d.value)) bad.push(`${label}: ${r.sel} { ${d.prop}: ${d.value} } (גלילה אנכית פנימית)`);
    }
  }
  assert.deepEqual(bad, [], 'עטיפת הטבלה מוגבלת בגובה: ' + bad.join(' | '));
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

/* ---------- 6ג. דף הלו״ז - נאמנות לעיצוב (ביקורת הבעלים 2.10.2026, docs/ui-fidelity-schedule.md) ---------- */
const SCHED_DIR = new URL('../app/components/schedule/', import.meta.url);
const schedSrc = (f) => readFileSync(new URL(f, SCHED_DIR), 'utf8');
const SCHED_FILES = ['ScheduleDay.js', 'StageRow.js', 'StageSection.js', 'StageRail.js', 'HebrewDayPicker.js', 'ScheduleToolbarSlots.js', 'ScheduleIcon.js', 'ScheduleSkeleton.js', 'scheduleMeta.js', 'MarkControls.js', 'MarkDialogs.js', 'useStageMarks.js'];
t('לוז: השורש בלי .gm-home (הבלוק .gm-ds.gm-home של הפלטה = CSS של דף הבית, דורס שורות/מתג/טבלה של הלוז)', () => {
  assert.match(schedSrc('ScheduleDay.js'), /className="gm-ds gm-lz home-bg dlg-dark"/);
  assert.ok(!/gm-home/.test(schedSrc('ScheduleDay.js')), 'gm-home חזר לשורש הלוז');
});
t('לוז: טולטיפים רק דרך data-tip (הטולטיפ של המערכת, כמו בעיצוב) - אין title= על רכיבי הדף', () => {
  for (const f of SCHED_FILES) assert.ok(!/\btitle=/.test(schedSrc(f)), f + ' משתמש ב-title= (טולטיפ דפדפן) במקום data-tip');
});
t('לוז: אין טקסטים שהבעלים לא הגדיר (כיתוב "לקריאה בלבד", "יסומן בגרסה הבאה", "אין נוכחות רשומה", תאריך מעל הכותרת, תגיות ספירה כמו "N אירועים", "אין פעולות" בציר)', () => {
  const all = SCHED_FILES.map(schedSrc).join(String.fromCharCode(10));
  // 'lz-nwd' = השבב הישן (chip st-today עם הסבר); 'chip st-mid' = "N אירועים" (SCH-CHIP-EVENTS = ב', 4.10.2026)
  for (const bad of ['לקריאה בלבד', 'יסומן בגרסה', 'אין נוכחות', '>במשמרת', 'chip st-mid', 'lz-note', 'lz-staff', 'lz-nwd', 'NonWorkingChip', 'nonWorkingDayText', 'NOT_MARKED_TIP']) assert.ok(!all.includes(bad), 'הטקסט/הרכיב "' + bad + '" חזר לדף');
  assert.ok(!/<small>\{[^}]*hebrewLong/.test(schedSrc('ScheduleDay.js')), 'שורת התאריך מעל "לוח זמנים" חזרה');
  const sec = schedSrc('StageSection.js');
  assert.ok(!/\{[^}]*\} \{(stage\.plural|meta\.plural)\}/.test(sec) && !/(stage|meta)\.plural/.test(sec) && !sec.split(String.fromCharCode(10)).filter((l) => !/^\s*\/\//.test(l)).join('').includes('אירועים'), 'תגית "N אירועים" חזרה לכותרת השלב (SCH-CHIP-EVENTS = ב׳)');
  // "אין פעולות" מתחת לשם שלב ריק בציר הוסר (SCH-EMPTY-TXT = ב', 4.10.2026): ה-<small> היחיד בציר הוא "N פריטים" של "הכל"
  const rail = schedSrc('StageRail.js');
  assert.equal((rail.match(/<small>/g) || []).length, 1, 'כיתוב קטן חזר מתחת לשם שלב בציר');
  assert.ok(rail.includes('<small>{allTotal} פריטים</small>') && !/<small>\{line\}<\/small>/.test(rail), '"אין פעולות" חזר מתחת לשם השלב בציר');
});
t('לוז: השבבים שהבעלים הגדיר ב-4.10.2026 - בנוסח המדויק ובמקום אחד בלבד ("יום לא עובד" ליד המתג, "N התראות" בכותרת שלב); אין שבבים אחרים בכותרת', () => {
  const all = SCHED_FILES.map(schedSrc).join(String.fromCharCode(10));
  const day = schedSrc('ScheduleDay.js'), sec = schedSrc('StageSection.js');
  // SCH-CHIP-NWD = א': תגית 14 (chip gray), הנוסח בדיוק "יום לא עובד", מוצג לפי data.nonWorkingDay מהשרת (lib/businessDays.js)
  const nwd = '<span className="chip gray lz-offday">יום לא עובד</span>';
  assert.equal(day.split(nwd).length - 1, 1, 'שבב "יום לא עובד" חסר / שונה נוסח / מופיע יותר מפעם אחת');
  assert.equal((all.match(/>יום לא עובד</g) || []).length, 1, 'הנוסח "יום לא עובד" מוצג במקום נוסף בדף');
  assert.ok(/!loading && data && data\.nonWorkingDay \? <span className="chip gray lz-offday">/.test(day), 'השבב חייב להיות מותנה ב-data.nonWorkingDay של השרת (הכלל האחיד), לא בחישוב מקומי');
  assert.ok(day.indexOf(nwd) > day.indexOf('id="vsw"') && day.indexOf(nwd) < day.indexOf('<BranchSeg'), 'השבב יושב מיד אחרי מתג שורות/טבלה');
  assert.ok(!/getDay\(\)|isChag|isNonWorkingDay\(/.test(day), 'הדף לא מחשב "יום לא עובד" בעצמו');
  // SCH-CHIP-ALERTS = א': chip st-bad עם אייקון alert והנוסח "N התראות" (עיצוב cardHTML שורה 1992), רק בכותרת השלב
  const al = '<span className="chip st-bad"><ScheduleIcon name="alert" />{alertRows} התראות</span>';
  assert.equal(sec.split(al).length - 1, 1, 'שבב "N התראות" חסר / שונה נוסח');
  assert.ok(/\{alertRows \? <span className="chip st-bad">/.test(sec), 'השבב מוצג רק כשיש התראות בשלב');
  assert.equal((all.match(/chip st-bad/g) || []).length, 1, 'chip st-bad מופיע במקום נוסף בדף');
  // בכותרת השלב רק השבבים שהוגדרו: התראות, משמרת (S08), שעות איסוף (B13)
  const chipClasses = [...sec.matchAll(/className="(chip[^"]*)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(chipClasses, ['chip st-bad', 'chip st-today', 'chip st-today'], 'שבב לא מוגדר נוסף לכותרת השלב');
  const dayChips = [...day.matchAll(/className="(chip[^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(dayChips, ['chip gray lz-offday'], 'שבב לא מוגדר נוסף לשורת המתג');
  assert.ok(hasSched(/\.gm-ds\.gm-lz \.chip\.st-bad$/, /^background$/, { valueRe: /^#f4a68c$/ }), 'schedule.css: חסר צבע st-bad של העיצוב (1122)');
});
t('לוז: הרכיבים של העיצוב קיימים - לחצן "בוצע" (btn tgl lz-mark), "הוחזר לא תקין" (lz-retw), "הכל בוצע" (lz-all), כלי XL/הורדה/הדפסה (lz-dtools/lz-stools), שורת ברקוד (sbar)', () => {
  // המראה של לחצני הסימון יושב ב-MarkControls.js (אותו markup כמו בעיצוב), ההתנהגות ב-useStageMarks.js - חוזה אחד
  const mk = schedSrc('MarkControls.js'), row = schedSrc('StageRow.js'), sec = schedSrc('StageSection.js'), rail = schedSrc('StageRail.js'), day = schedSrc('ScheduleDay.js'), slots = schedSrc('ScheduleToolbarSlots.js');
  assert.ok(mk.includes('className="btn tgl lz-mark"') && mk.includes('className="btn tgl lz-mark on"') && mk.includes("className={'lz-retw' + (pairOpen ? ' open' : '')}") && mk.includes('lz-mark lz-bad'));
  assert.ok(mk.includes('className="ibtn lz-all"') && row.includes('<MarkButton') && sec.includes('<MarkAllButton') && sec.includes('<SectionTools'));
  assert.ok(day.includes('useStageMarks({ data, setData })') && day.includes('<MarkToast'), 'ScheduleDay מחבר את ה-hook ואת הטוסט');
  assert.ok(/onMarkDone\(stage, row, \{ done/.test(mk) && !/onMarkDone\(row, stage/.test(mk + row + sec + day) && !/condition: 'bad'/.test(mk + row), 'חוזה אחד: onMarkDone(stage, row, { done, outcome })');
  assert.ok(!existsSync(new URL('marks.css', SCHED_DIR)) && !/lz-busy|StatusChips|lz-done-chip|lz-todo-chip/.test(mk + row + sec), 'שאריות של פקדי הסימון הישנים');
  assert.ok(day.includes('<PageTools') && slots.includes('className="tools lz-dtools"') && slots.includes('className="tools lz-stools"'));
  assert.ok(rail.includes('className="sbar"') && rail.includes('id="scanIn"'));
  // הטולטיפים של לחצני הסימון הם בדיוק טקסטי העיצוב
  const meta = schedSrc('scheduleMeta.js');
  for (const tip of ["'סמן כבוצע'", "'סמן כבוצע (הוחזר תקין)'", "'סמן כהוחזר לא תקין'", "'לחיצה לביטול סימון הביצוע'", "'הכל בוצע'"]) assert.ok(meta.includes(tip), 'חסר טקסט עיצוב ' + tip);
});
t('schedule.css: הכרטיס עם רקע הפנינה של העיצוב ב-!important (הפלטה כופה זכוכית לבנה), וכותרת הטבלה מנטרלת את globals/design-overrides', () => {
  assert.ok(hasSched(/\.gm-ds\.gm-lz \.lz-st$/, /^background$/, { important: true, valueRe: /linear-gradient\(135deg,rgba\(255,252,247,\.62\)/ }), 'חסר רקע הכרטיס מהעיצוב (1145)');
  assert.ok(hasSched(/\.rtbl thead tr th/, /^background-color$/, { important: true, valueRe: /navy/ }));
  assert.ok(hasSched(/\.rtbl thead tr th/, /^color$/, { important: true, valueRe: /gold-300/ }));
  assert.ok(hasSched(/\.rtbl thead tr th/, /^font-family$/, { important: true, valueRe: /^inherit/ }));
  assert.ok(hasSched(/\.rtbl thead tr th/, /^box-shadow$/, { important: true, valueRe: /^none/ }));
  assert.ok(hasSched(/\.lz-snav \.sbar$/, /^display$/, { important: true, valueRe: /^flex/ }), 'שורת הברקוד: הפלטה מסתירה .sbar ב-!important');
  assert.ok(hasSched(/#scanIn/, /^background$/, { important: true, valueRe: /^transparent/ }), 'שדה הברקוד: הפלטה צובעת .inp בלבן ב-!important');
  assert.ok(hasSched(/\.rtbl thead tr th/, /^border-bottom$/, { important: true, valueRe: /^0/ }), 'כותרת הטבלה: globals.css כופה border-bottom זהוב בערכת כהה');
});
t('schedule.css: לחצן כבוי ("בוצע" / "הכל בוצע") שומר על הריחוף והמיקוד של העיצוב - איפוסי המראה הכבוי מוגבלים למנוחה (סקירה 2.10, B)', () => {
  const resets = scheduleRules.filter((r) => /(lz-mark|lz-all)[^,]*:disabled/.test(r.sel) && setsProp(r, /^(background|color|border-color)$/).length);
  assert.ok(resets.length >= 2, 'חסרים כללי המראה הכבוי');
  for (const r of resets) for (const s of splitSel(r.sel)) if (/(lz-mark|lz-all)[^,]*:disabled/.test(s)) assert.match(s, /:not\(:hover\):not\(:focus-visible\)/, 'כלל כבוי שמבטל ריחוף/מיקוד: ' + s);
  // opacity:1 לכבוי לא חל על "הוחזר לא תקין" (lz-bad) - הוא מופיע בריחוף דרך opacity
  const op1 = scheduleRules.filter((r) => /:disabled/.test(r.sel) && setsProp(r, /^opacity$/).some((d) => /^1$/.test(d.value.trim())));
  assert.ok(op1.length, 'חסר opacity:1 ללחצן כבוי');
  for (const r of op1) for (const s of splitSel(r.sel)) if (/lz-mark/.test(s)) assert.match(s, /:not\(\.lz-bad\)/, 'opacity:1 חל גם על lz-bad: ' + s);
  // חלון "בטוח?" והטוסט על רכיבי הפלטה (scrim/dlg/#toast), בלי קובץ CSS נפרד לסימון
  assert.ok(hasSched(/\.dlg\.lz-cf$/, /^max-width$/), 'חסר כלל החלון lz-cf');
  assert.ok(hasSched(/\.lz-det \.li$/, /^background$/), 'חסרות שורות הפירוט lz-det (עיצוב 1209)');
  assert.ok(hasSched(/#toast \.tclose$/, /^display$/), 'חסר לחצן הסגירה של הטוסט');
  // החלון ב-portal לשורש הדף (אח של .app, כמו L.modal בעיצוב) - בתוך השורה הוא ירש סמן/משקל/צבע; הטוסט תמיד info כמו L.say
  const dlg = schedSrc('MarkDialogs.js');
  assert.ok(/<LzPortal>/.test(dlg) && schedSrc('ScheduleDay.js').includes('<LzPortalRoot.Provider'), 'חלון "בטוח?" לא ב-portal לשורש הדף');
  assert.ok(dlg.includes('className="info pulse on"') && !hasSched(/lz-toast-(error|warn)/, /^background$/), 'טוסט בצבע שלא בעיצוב');
  // "הוחזר לא תקין": בלי transition משלו (בעיצוב הכלל שלו מפסיד לכלל הלחצן - מופיע מיד, .15s כמו "בוצע"); בלי צבע ורוד מומצא
  assert.ok(!hasSched(/\.lz-bad/, /^transition$/) && !hasSched(/\.lz-bad/, /^(color|border-color)$/), 'lz-bad עם transition/צבע שלא בעיצוב');
  // מגע: הקשה ראשונה פותחת את הזוג (lz-retw.open) כמו בעיצוב
  assert.ok(/setPairOpen\(true\)/.test(schedSrc('MarkControls.js')) && hasSched(/\.lz-retw:is\([^)]*\.open\) \.lz-bad$/, /^visibility$/), 'חסרה פתיחת הזוג במגע');
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
t('בדיקת מלאי: שורש הדף נושא home-bg (תמונת הרקע של המערכת, כמו בדף הבית)', () => {
  assert.match(read('../app/components/stock/StockCheckPage.js'), /className="gm-ds gm-home stock-page home-bg"/);
});
t('בדיקת מלאי: "נקה" מנקה גם את התאריך (לא רק דגם ומידות)', () => {
  const src = read('../app/components/stock/StockCheckPage.js');
  const i = src.indexOf('const clearAll = () => {');
  assert.ok(i >= 0, 'clearAll לא נמצא');
  const body = src.slice(i, src.indexOf('};', i));
  assert.ok(body.includes("setDate('')"), 'clearAll לא מאפס את התאריך');
});
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

/* ---------- 9. שעון הנוכחות (app/components/login/punch-clock.css): תוספת קטנה ל-login.css, אותו היקף ואותו משטר ---------- */
const PUNCH_CSS = read('../app/components/login/punch-clock.css');
const punchRules = parseCss(PUNCH_CSS);
t('punch-clock.css: כל כלל בהיקף .gm-ds.gm-login.gm-punch (לא דולף לדף הכניסה ולא לשאר האתר)', () => {
  const bad = [];
  for (const r of punchRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-login\.gm-punch(\s|\.|$)/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('punch-clock.css: אין רקע לבן קשיח, אין !important על רקע (חוץ משכבת הבסיס של המסך המלא), ואין צבע קשיח ברקע', () => {
  const bad = [];
  for (const r of punchRules) for (const d of setsProp(r, /^background(-color|-image)?$/)) {
    const v = d.value.replace(/!important/i, '').trim();
    if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v) || (isImportant(d) && r.sel !== '.gm-ds.gm-login.gm-punch.is-overlay')) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    if (/#[0-9a-f]{3,8}\b|rgba?\(/i.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} } (צבע קשיח)`);
  }
  assert.deepEqual(bad, []);
});
t('punch-clock.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(punchRules, 'punch-clock.css'), []);
});
t('login.css / punch-clock.css: משתני CSS (custom properties) עם צבע קשיח - רק מרשימה מאושרת (צבע חדש = אישור והשוואה לעיצוב)', () => {
  // הבדיקות על background* לא רואות צבע שמוגדר כמשתנה ומשמש אחר כך; לכן נסרקות גם הגדרות --x: #hex / rgb(a) עצמן.
  // --lg-* = ערכי login-page.html (:root), --k-* = החלון הכהה של הפלטה. punch-clock.css: אסור בו שום צבע קשיח במשתנה.
  const APPROVED = new Set(['--lg-petal', '--lg-base', '--lg-glass', '--lg-gold-soft', '--lg-gold-ink', '--lg-danger', '--lg-danger-soft', '--lg-danger-line',
    '--lg-ok', '--lg-ok-soft', '--lg-sh', '--k-bg', '--k-sheen', '--k-solid', '--k-ink', '--k-sub', '--k-row', '--k-rowb', '--k-bd', '--k-gap', '--k-ghost', '--k-ic', '--k-err', '--k-sh']);
  const COLOR = /#[0-9a-f]{3,8}\b|rgba?\(/i;
  const check = (file, rules, allowed) => rules.flatMap((r) => decls(r.body)
    .filter((d) => d.prop.startsWith('--') && COLOR.test(d.value) && !(allowed && allowed.has(d.prop)))
    .map((d) => `${file}: ${r.sel} { ${d.prop}: ${d.value} }`));
  const LOGIN_CSS2 = read('../app/components/login/login.css');
  const bad = [...check('login.css', parseCss(LOGIN_CSS2), APPROVED), ...check('punch-clock.css', punchRules, null)];
  assert.deepEqual(bad, [], 'משתנה צבע חדש: ' + bad.join(' | '));
  // והמשתנה שמשמש את שכבת הבסיס של המסך המלא מוגדר ב-login.css (לא ב-punch-clock.css)
  assert.ok(/--lg-base:#faf7f2/.test(LOGIN_CSS2) && /background:var\(--lg-base\)!important/.test(PUNCH_CSS), 'שכבת הבסיס צריכה להשתמש ב-var(--lg-base)');
});
t('login.css: הפלטה כופה על כל .gm-ds .card רקע לבן 30% ב-!important => כרטיס הדף המלא (כניסה + שעון נוכחות) חייב לדרוס ל-48% של העיצוב', () => {
  const LOGIN_CSS = read('../app/components/login/login.css');
  const paletteForcesCard = parseCss(PALETTE).some((r) => /^\.gm-ds \.card\b/.test(splitSel(r.sel)[0]) && setsProp(r, /^background$/).some(isImportant));
  if (!paletteForcesCard) return; // הכלל בפלטה כבר לא קיים - אין מה לדרוס
  const rule = parseCss(LOGIN_CSS).find((r) => r.sel === '.gm-ds.gm-login:not(.is-modal) .card.lg-card');
  assert.ok(rule, 'חסר כלל הדריסה של כרטיס הדף המלא ב-login.css');
  assert.ok(setsProp(rule, /^background$/).some((d) => isImportant(d) && /--lg-glass/.test(d.value)), 'הרקע חייב להיות var(--lg-glass) ב-!important');
  assert.ok(setsProp(rule, /^border-color$/).some((d) => isImportant(d) && /\.75/.test(d.value)), 'גבול 75% ב-!important');
});
t('שעון הנוכחות משתמש בשדות של login.css (input.inp בהיקף .gm-login) ולא בשדות הגלובליים של האתר', () => {
  const page = read('../app/components/login/PunchClockNew.js');
  const parts = read('../app/components/login/loginParts.js');
  assert.ok(/import '\.\/login\.css'/.test(page), 'PunchClockNew.js חייב לייבא login.css');
  assert.ok(/className=\{`inp\$\{pin/.test(parts) && /className="inp"/.test(parts), 'שדות העובד והסיסמה חייבים להיות .inp');
  assert.ok(!/className="input"|className="btn |className="card card-pad"|className="callout/.test(page + parts), 'מחלקות הרכיבים הישנים של האתר דולפות לדף החדש');
  assert.ok(!/<use[^>]*sprite\.svg/.test(page + parts), 'אסור להפנות ל-sprite.svg חיצוני - האייקונים מוטמעים (#gmi-*)');
  assert.ok(!/font-family/.test(PUNCH_CSS), 'punch-clock.css לא נוגע בגופנים (login.css כבר מנטרל את design-overrides.css)');
});

/* ---------- 10. דף "הפרופיל שלי" (app/components/profile/profile.css): אותו משטר היקף כמו הלו״ז ---------- */
// הדף נטען בלי home.css (שורש .gm-ds.gm-pf, בלי .gm-home), ולכן נבדק כאן: היקף, אין לבן קשיח, !important על רקע רק בכרטיס "פנינה" המאושר,
// נטרולי הדליפה שנמצאו בבדיקת scripts/profile-bg-audit (גופן, margin של .field, צבע טקסט שדה, ריפוד לחצן חזרה, רקע ה-input של המתג).
const PROFILE_CSS = read('../app/components/profile/profile.css');
const profileRules = parseCss(PROFILE_CSS);
const PROFILE_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-pf)']); // ביטול ריפוד המעטפת לדף מלא-רוחב, כמו home.css כלל 1
const PROFILE_IMPORTANT_BG_OK = new Set(['.gm-ds.gm-pf .card']); // גרדיאנט "פנינה" של העיצוב (פרופיל-עובד.html: body .app :is(.card,...)) מול זכוכית הפלטה
t('profile.css: כל כלל בהיקף .gm-ds.gm-pf (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const r of profileRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-pf(\s|$)/.test(s) && !PROFILE_OUT_OF_SCOPE_OK.has(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('profile.css: אין רקע לבן קשיח; !important על רקע רק בכרטיס הפנינה', () => {
  const bad = [];
  for (const r of profileRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    if (setsProp(r, /^background(-color|-image)?$/).some(isImportant)) for (const s of splitSel(r.sel)) if (!PROFILE_IMPORTANT_BG_OK.has(s.replace(/\s+/g, ' '))) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('profile.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(profileRules, 'profile.css'), []);
});
const hasProfile = (selRe, propRe, { important = false, valueRe } = {}) => profileRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('profile.css: נטרול דליפות - גופן Rubik (!important על לחצנים/שדות/כותרות), field margin, צבע טקסט שדה, ריפוד לחצן חזרה', () => {
  assert.ok(hasProfile(/\.gm-ds\.gm-pf :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'חסר font-family:inherit!important ללחצנים/שדות');
  assert.ok(hasProfile(/\.gm-ds\.gm-pf :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'חסר font-family:inherit!important לכותרות');
  assert.ok(hasProfile(/^\.gm-ds\.gm-pf \.field$/, /^margin-bottom$/, { valueRe: /^0/ }), 'חסר איפוס margin-bottom של .field (globals.css)');
  assert.ok(hasProfile(/\.gm-ds\.gm-pf \.dfields input\.inp:not\(:disabled\)/, /^color$/), 'חסר צבע טקסט לשדה (design-overrides.css צובע בחום)');
  assert.ok(hasProfile(/^\.gm-ds\.gm-pf \.back$/, /^padding$/), 'חסר ריפוד ברירת מחדל ללחצן החזרה');
});
t('הדליפות שנוטרלו בפרופיל עדיין קיימות ב-CSS הגלובלי (אם נעלמו - אפשר להסיר את הנטרול)', () => {
  assert.ok(/\.field\s*\{[^}]*margin-bottom/.test(DS_GLOBAL), 'design-system.css: .field{margin-bottom} כבר לא קיים');
});
t('הפרופיל: עמודה אחת, בלי עמודה צדדית, בלי שורת העזר של הכניסה האוטומטית (החלטת הבעלים 3.10.2026)', () => {
  const page = read('../app/components/profile/ProfilePage.js');
  const auto = read('../app/components/login/AutoClockSwitch.js');
  assert.ok(!/pf-side|<aside|className="rail/.test(page + PROFILE_CSS), 'עמודה צדדית חזרה');
  assert.ok(!/בלי לחיצה על/.test(page + auto), 'שורת העזר של מתג הכניסה האוטומטית חזרה');
  assert.ok(!/window\.alert/.test(page), 'window.alert חזר (הודעות בטוסט)');
  assert.ok(!/gm-home/.test(page), 'שורש הדף לא יכול לשאת gm-home (ראו docs/ui-fidelity-schedule.md)');
});

/* ---------- 11. "מסך ניהול ראשי" (app/components/admin-hub/admin-hub.css): אותו משטר היקף כמו הפרופיל ---------- */
// שורש .gm-ds.gm-adm.home-bg (בלי .gm-home). נבדק: היקף, לבן קשיח רק בעיגול האייקון של האריח (לבן בעיצוב ניהול-ראשי-כרטיסים.html),
// !important על רקע רק בכותרת הטבלה (כמו home.css כלל 10), ונטרולי הדליפה שנמצאו בבדיקת scripts/admin-hub-audit.
const ADM_CSS = read('../app/components/admin-hub/admin-hub.css');
const admRules = parseCss(ADM_CSS);
const ADM_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-adm)']);
const ADM_WHITE_OK = new Set(['.gm-ds.gm-adm .adm-tile .ico']); // עיגול האייקון באריח: background:#fff בעיצוב (.adm-tile .ico)
const ADM_IMPORTANT_BG_OK = new Set(['.gm-ds.gm-adm .rtbl thead tr th']);
t('admin-hub.css: כל כלל בהיקף .gm-ds.gm-adm (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const r of admRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-adm(\s|$)/.test(s) && !ADM_OUT_OF_SCOPE_OK.has(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('admin-hub.css: לבן קשיח רק בעיגול האייקון של האריח; !important על רקע רק בכותרת הטבלה', () => {
  const bad = [];
  for (const r of admRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if ((WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) && !splitSel(r.sel).every((s) => ADM_WHITE_OK.has(s.trim().replace(/\s+/g, ' ')))) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    if (setsProp(r, /^background(-color|-image)?$/).some(isImportant)) for (const s of splitSel(r.sel)) if (!ADM_IMPORTANT_BG_OK.has(s.trim().replace(/\s+/g, ' '))) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('admin-hub.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(admRules, 'admin-hub.css'), []);
});
const hasAdm = (selRe, propRe, { important = false, valueRe } = {}) => admRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('admin-hub.css: נטרול דליפות - גופן, כותרת טבלה, שדה החיפוש (design-overrides input:not x4), ריפוד לחצן הניקוי, גבול הכרטיס', () => {
  assert.ok(hasAdm(/\.gm-ds\.gm-adm :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'גופן לחצנים/שדות');
  assert.ok(hasAdm(/\.gm-ds\.gm-adm :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'גופן כותרות');
  assert.ok(hasAdm(/\.gm-ds\.gm-adm \.rtbl thead tr th/, /^background-color$/, { important: true }), 'רקע כותרת טבלה (globals.css כותרת דביקה)');
  assert.ok(hasAdm(/\.gm-ds\.gm-adm \.rtbl thead tr th/, /^font-family$/, { important: true }), 'גופן כותרת טבלה (design-overrides.css Assistant)');
  // ספציפיות (0,5,1) מעל input:not(x4) (0,4,1) של design-overrides.css
  assert.ok(hasAdm(/^\.gm-ds\.gm-adm \.adm-bar \.hf-s input\[type="search"\]$/, /^background$/, { valueRe: /^transparent/ }), 'רקע שדה החיפוש');
  assert.ok(hasAdm(/^\.gm-ds\.gm-adm \.adm-bar \.hf-s input\[type="search"\]:focus$/, /^box-shadow$/, { valueRe: /^none/ }), 'טבעת הפוקוס של design-overrides.css');
  assert.ok(hasAdm(/^\.gm-ds\.gm-adm \.hf-cl$/, /^padding$/), 'ריפוד לחצן הניקוי');
  assert.ok(hasAdm(/^\.gm-ds\.gm-adm \.adm-app \.card$/, /^border-color$/, { important: true }), 'גבול זכוכית לבן לכרטיס (הפלטה צובעת כחול)');
});
t('הדליפות שנוטרלו במסך הניהול עדיין קיימות ב-CSS הגלובלי (אם נעלמו - אפשר להסיר את הנטרול)', () => {
  assert.ok(OVERRIDES.includes('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"])'), 'design-overrides.css: input:not(x4)');
  assert.ok(/table thead th\s*\{[^}]*font-family:\s*'Assistant'/.test(OVERRIDES), 'design-overrides.css: table thead th Assistant');
});
t('מסך הניהול: בלי מונה, בלי window.alert, ושורש בלי gm-home (החלטות הבעלים 4.10.2026)', () => {
  const page = read('../app/components/admin-hub/AdminHubPage.js');
  assert.ok(!/hres-n|adm-cnt/.test(page + ADM_CSS), 'המונה חזר');
  assert.ok(!/window\.alert/.test(page), 'window.alert');
  assert.ok(!/gm-home/.test(page), 'gm-home בשורש');
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


/* ---------- 12. אשף "הזמנה חדשה" (app/components/new-order/css/new-order.css): אותו משטר היקף כמו הפרופיל ---------- */
// שורש .gm-ds.gm-no.home-bg.dlg-dark (בלי gm-home). ה-page glue של העיצוב (B2) מגדיר רקעים עם !important רק כדי לשטח את בלוקי
// קוביית השלב (none/transparent) ואת כרטיס ה"פנינה" של העיצוב (body .app :is(.card,...)). נטרולי הדליפה: scripts/new-order-bg-audit.
const NO_CSS = read('../app/components/new-order/css/new-order.css');
const noRules = parseCss(NO_CSS);
const NO_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-no)']);
const PEARL_RE = /^linear-gradient\(135deg,rgba\(255,252,247,\.62\)/;
t('new-order.css: כל כלל בהיקף .gm-ds.gm-no (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const r of noRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-no(\s|$)/.test(s) && !NO_OUT_OF_SCOPE_OK.has(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('new-order.css: אין רקע לבן קשיח לבלוקים; !important על רקע רק לשיטוח (none/transparent), לכרטיס הפנינה או לאריח האייקון (.ico) של העיצוב', () => {
  const bad = [];
  for (const r of noRules) {
    for (const d of setsProp(r, /^background(-color|-image)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (/var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
      if (isImportant(d) && !/^(none|transparent)$/.test(v) && !PEARL_RE.test(v.replace(/\s+/g, '')) && !/ \.ico\[class\]$/.test(r.sel)) bad.push('!important: ' + r.sel + ' ' + v.slice(0, 40));
    }
  }
  assert.deepEqual(bad, []);
});
t('new-order.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(noRules, 'new-order.css'), []);
});
const hasNo = (selRe, propRe, { important = false, valueRe } = {}) => noRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('new-order.css: נטרול דליפות - גופן, field margin, צבע/גבול שדה (.inp.inp), ריפוד לחצן חזרה/ibtn, גופן שאלת השלב', () => {
  assert.ok(hasNo(/\.gm-ds\.gm-no :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'חסר font-family:inherit!important ללחצנים/שדות');
  assert.ok(hasNo(/\.gm-ds\.gm-no :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'חסר font-family:inherit!important לכותרות');
  assert.ok(hasNo(/^\.gm-ds\.gm-no \.hero-t \.hero-q$/, /^font-family$/, { important: true, valueRe: /FB Melatef/ }), 'שאלת השלב חייבת לגבור על כלל הכותרות');
  assert.ok(hasNo(/^\.gm-ds\.gm-no \.field$/, /^margin-bottom$/, { valueRe: /^0/ }), 'חסר איפוס margin-bottom של .field');
  assert.ok(hasNo(/^\.gm-ds\.gm-no \.no-app \.inp\.inp$/, /^color$/), 'חסר צבע טקסט לשדה (design-overrides.css צובע בחום)');
  assert.ok(hasNo(/^\.gm-ds\.gm-no \.back$/, /^padding$/) && hasNo(/^\.gm-ds\.gm-no \.ibtn$/, /^padding$/), 'חסר ריפוד ברירת מחדל ללחצן חזרה / ibtn');
  assert.ok(/input:not\(\[type="checkbox"\]\)/.test(OVERRIDES), 'design-overrides.css: כלל ה-input הכללי כבר לא קיים - אפשר להסיר את .inp.inp');
});
t('אשף הזמנה חדשה: שורש gm-ds gm-no home-bg dlg-dark, בלי gm-home, בלי alert/confirm של הדפדפן, בלי title=', () => {
  const dir = '../app/components/new-order/';
  const files = ['NewOrderA5.js', 'NewOrderSwitch.js', 'NoUi.js', 'NoDialogs.js', 'NoSuggest.js', 'NoHebrewCalendar.js', 'useNewOrderController.js', 'StepCustomer.js', 'StepDates.js', 'StepDelivery.js', 'StepItems.js', 'StepSummary.js', 'StepPayment.js', 'newOrderLogic.js'];
  const all = files.map((f) => read(dir + f)).join(String.fromCharCode(10));
  assert.ok(/className="gm-ds gm-no home-bg dlg-dark"/.test(read(dir + 'NewOrderA5.js')), 'שורש הדף');
  assert.ok(!/gm-home/.test(all.replace(/\/\/.*$/gm, '')), 'gm-home בקוד האשף');
  assert.ok(!/window\.(alert|confirm|customConfirm|customAuthPrompt|prompt)|alert\(/.test(all.replace(/\/\/.*$/gm, '')), 'חלון דפדפן בקוד האשף');
  assert.ok(!/<[a-z][a-z0-9]*[^>]*\stitle=/.test(all), 'title= על אלמנט DOM (טולטיפ דפדפן) במקום data-tip');
  const font = read(dir + 'css/new-order-font.css').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  assert.ok(/^@font-face\{[^}]*\}$/.test(font), 'קובץ הגופן מכיל רק @font-face');
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
