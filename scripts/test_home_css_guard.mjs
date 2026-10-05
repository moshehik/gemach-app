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
  '.gm-ds.gm-home .scan .pfx-form input.inp', // שדה שם "שמור חיפוש" בתוך חלונית $: שדה לבן בעיצוב המאושר (תצוגות-עיצוב/חיפוש-קיצורים.html)
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
  '.gm-ds.gm-home.gm-home .advp .inpw > select.inp', // חץ בורר "סטטוס הזמנה" (כספים): כלל השדות של הפלטה מאפס background-image דרך #dlg בסלקטור
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
  // 4.10.2026 ("ישן / חדש"): שורת העזר קיימת רק בענף של הדף הישן (useUiVariant('profile') === 'legacy'), לא במראה החדש
  const autoNew = auto.slice(auto.indexOf('<div className="pf-pref">'));
  assert.ok(auto.includes('<div className="pf-pref">') && /profileVariant === 'legacy'/.test(auto), 'המראה החדש / ענף הישן');
  assert.ok(!/בלי לחיצה על/.test(page + autoNew), 'שורת העזר של מתג הכניסה האוטומטית חזרה');
  assert.ok(!/window\.alert/.test(page), 'window.alert חזר (הודעות בטוסט)');
  assert.ok(!/gm-home/.test(page), 'שורש הדף לא יכול לשאת gm-home (ראו docs/ui-fidelity-schedule.md)');
});

/* ---------- 10b. כרטיס הלקוח החדש (app/components/customer-card/customer-card.css): אותו משטר היקף כמו הפרופיל ---------- */
// שורש .gm-ds.gm-cc.home-bg.dlg-dark (בלי .gm-home). נבדק: היקף, אין לבן קשיח, !important על רקע רק בכללים המאושרים מהעיצוב,
// אין @media לפני הכלל הלא-מותנה, ונטרולי הדליפה שנמצאו ב-scripts/customer-card-audit (גופן, .tab margin, .tabs margin,
// .field margin, ריפוד לחצנים/שדות שנמחק ע"י *{padding:0}, ריפוד לחצן החזרה, רקע/מסגרת input גלובליים בתוך רכיבים).
const CC_CSS = read('../app/components/customer-card/customer-card.css');
const ccRules = parseCss(CC_CSS);
const CC_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-cc)']);
const CC_IMPORTANT_BG_OK = [
  /^\.gm-ds\.gm-cc \.app :is\(\.card,\.coll\[open\]\)$/, // פנים "פנינה" (pearl-faces בעיצוב) מול הזכוכית של הפלטה
  /^\.gm-ds\.gm-cc \.rtbl thead tr th$/, // כותרת טבלה כחולה (נטרול כותרת קרם גלובלית)
  /^\.gm-ds\.gm-cc \.app \.btn\.cc-gmail/, // "השלם ל-@gmail.com" = לחצן "מחוקים" של כרטיס ההזמנה (שקוף, בריחוף כחול)
  /^\.gm-ds\.gm-cc #dlg\.fx-sheet :is\(input,textarea\)\.inp/, // שדות גיליון המייל (mail-sheet-css בעיצוב)
  /^\.gm-ds\.gm-cc\.dlg-dark :is\(#dlg,#dlg2\) \.chg \.c \.ico$/, // DLG-MODERN בעיצוב
];
t('customer-card.css: כל כלל בהיקף .gm-ds.gm-cc (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const r of ccRules) for (const s of splitSel(r.sel)) if (!/^(:where\()?\.gm-ds\.gm-cc(\)|[\s.:#[]|$)/.test(s) && !CC_OUT_OF_SCOPE_OK.has(s)) bad.push(s);
  assert.deepEqual(bad, []);
});
t('customer-card.css: אין רקע לבן קשיח; !important על רקע רק בכללים המאושרים', () => {
  const bad = [];
  for (const r of ccRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    if (setsProp(r, /^background(-color|-image)?$/).some(isImportant)) for (const s of splitSel(r.sel)) if (!CC_IMPORTANT_BG_OK.some((re) => re.test(s.replace(/\s+/g, ' ')))) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('customer-card.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(ccRules, 'customer-card.css'), []);
});
const hasCc = (selRe, propRe, { important = false, valueRe } = {}) => ccRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('customer-card.css: נטרולי הדליפות שנמצאו בבדיקת הנאמנות', () => {
  assert.ok(hasCc(/\.gm-ds\.gm-cc :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'גופן ללחצנים/שדות');
  assert.ok(hasCc(/\.gm-ds\.gm-cc :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true }), 'גופן לכותרות');
  assert.ok(hasCc(/^\.gm-ds\.gm-cc \.tabs \.tab$/, /^margin-inline-end$/, { valueRe: /^0/ }), '.tab{margin-inline-end:22px} של design-system.css');
  assert.ok(hasCc(/^\.gm-ds\.gm-cc \.tabs$/, /^margin$/, { valueRe: /^0/ }), '.tabs{margin-bottom} של design-system.css');
  assert.ok(hasCc(/^\.gm-ds\.gm-cc \.field$/, /^margin-bottom$/, { valueRe: /^0/ }), '.field{margin-bottom:14px}');
  assert.ok(hasCc(/^:where\(\.gm-ds\.gm-cc\) :where\(button\)$/, /^padding$/), 'ריפוד ברירת מחדל ללחצנים (*{padding:0})');
  assert.ok(hasCc(/^\.gm-ds\.gm-cc \.back$/, /^padding$/), 'ריפוד לחצן החזרה');
  assert.ok(hasCc(/\.gm-ds\.gm-cc :is\(\.hf-s,\.amtin\) input/, /^background$/), 'רקע input גלובלי בחיפוש ההיסטוריה / סכום התשלום');
});
t('הדליפות שנוטרלו בכרטיס הלקוח עדיין קיימות ב-CSS הגלובלי (אם נעלמו - אפשר להסיר את הנטרול)', () => {
  assert.ok(/\.tab\{[^}]*margin-inline-end:22px/.test(DS_GLOBAL), 'design-system.css: .tab{margin-inline-end:22px} כבר לא קיים');
  assert.ok(/\*\s*\{[^}]*padding:\s*0/.test(GLOBALS), 'globals.css: *{padding:0} כבר לא קיים');
});
t('כרטיס הלקוח: שורש בלי gm-home, בלי window.alert, חלונות כהים', () => {
  for (const f of ['CustomerCardA5.js', 'NewCustomerA5.js']) {
    const src = read(`../app/components/customer-card/${f}`);
    assert.match(src, /className="gm-ds gm-cc home-bg dlg-dark"/, f);
    assert.ok(!/window\.alert/.test(src), f);
  }
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

/* ---------- 11ב. הלוח החודשי (app/components/board/board.css) + חלון "אין הרשאה" החדש (app/components/gate/gate.css) ---------- */
// שורש הלוח: .gm-ds.gm-lz.gm-bd - schedule.css חל עליו (כולל נטרולי הגופן של design-overrides.css, סעיף 6ב), ו-board.css מוסיף רק
// בהיקף .gm-ds.gm-bd. נבדק: היקף, אין @media לפני הכלל הרגיל (הבאג שנמצא בעיצוב עצמו - ר' ההערה ב-board.css על .lz-pr),
// אין !important על רקע, השורש בלי gm-home, ונטרול שדה החיפוש מול design-overrides.css (input:not(x4)).
const BOARD_CSS = read('../app/components/board/board.css');
const boardRules = parseCss(BOARD_CSS);
const BOARD_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-bd)']); // ביטול ריפוד המעטפת לדף מלא-רוחב, כמו profile.css
t('board.css: כל כלל בהיקף .gm-ds.gm-bd (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const r of boardRules) for (const x of splitSel(r.sel)) if (!/^\.gm-ds\.gm-bd(\s|$|\.|#)/.test(x) && !BOARD_OUT_OF_SCOPE_OK.has(x)) bad.push(x);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('board.css: אין דריסת @media לפני הכלל הלא-מותנה, ואין !important על רקע/גבול', () => {
  assert.deepEqual(mediaBeforeBase(boardRules, 'board.css'), []);
  const bad = [];
  for (const r of boardRules) if (setsProp(r, /^(background(-color|-image)?|border(-color)?|box-shadow)$/).some(isImportant)) bad.push(r.sel);
  assert.deepEqual(bad, []);
});
t('הלוח: השורש .gm-ds.gm-lz.gm-bd (schedule.css מנטרל את הגופנים), בלי gm-home', () => {
  const page = read('../app/components/board/BoardPage.js');
  assert.match(page, /className="gm-ds gm-lz gm-bd home-bg dlg-dark"/);
  assert.ok(!/gm-home/.test(page), 'gm-home על שורש הלוח');
  assert.ok(!boardRules.some((r) => /#bdQ|\.hf-cl/.test(r.sel)), 'נשארו כללי CSS של תיבת החיפוש שהוסרה');
  assert.ok(boardRules.some((r) => /#mToday$/.test(r.sel) && setsProp(r, /^height$/).some((d) => d.value === '28px')), 'S04: "החודש הנוכחי" בגובה המתג (28px)');
});
const GATE_CSS = read('../app/components/gate/gate.css');
const gateRules = parseCss(GATE_CSS);
t('gate.css: היקף .gm-ds.gm-login.gm-gate (חלון "אין הרשאה" = החלון הכהה של דף הכניסה), בלי צבעים משלו', () => {
  const bad = [];
  for (const r of gateRules) for (const x of splitSel(r.sel)) if (!/^\.gm-ds\.gm-login\.gm-gate(\s|$)/.test(x) && x !== '.app-shell .main .content:has(> .gm-ds.gm-gate)') bad.push(x);
  assert.deepEqual(bad, []);
  assert.ok(!gateRules.some((r) => setsProp(r, /^(background(-color|-image)?|color|border-color)$/).length), 'gate.css לא מגדיר צבעים - הכול מ-login.css');
  assert.deepEqual(mediaBeforeBase(gateRules, 'gate.css'), []);
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

/* ---------- 11. כרטיס ההזמנה החדש - לשוניות פרטים/משלוח (app/components/order-card/css/oc-details.css, W2a) ---------- */
// הקובץ נטען תמיד עם oc-base.css (נטרולי הגופן/השדות/המתג של הכרטיס כולו) - כאן רק המשטר של הקובץ עצמו: היקף .gm-ds.gm-oc, בלי
// !important (הכול נשען על הפלטה), בלי לבן קשיח, בלי @media לפני הכלל הרגיל, בלי "-*/" בהערות (שובר next build).
const OC_DETAILS_CSS = read('../app/components/order-card/css/oc-details.css');
const ocDetailsRules = parseCss(OC_DETAILS_CSS);
t('oc-details.css: כל כלל בהיקף .gm-ds.gm-oc (לא דולף לשאר האתר / לכרטיס הישן)', () => {
  const bad = [];
  for (const r of ocDetailsRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('oc-details.css: בלי !important ובלי רקע לבן קשיח / var(--gm-surface) (הכרטיסים "פנינה" מ-oc-base, החלונות כהים מהפלטה)', () => {
  const bad = [];
  for (const r of ocDetailsRules) for (const d of decls(r.body)) {
    if (isImportant(d)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    if (/^background(-color)?$/.test(d.prop) && (WHITE_RE.test(d.value.trim()) || /var\(--gm-surface\)/.test(d.value))) bad.push(`${r.sel} { ${d.prop}: ${d.value} } (לבן)`);
  }
  assert.deepEqual(bad, []);
});
t('oc-details.css: אין דריסת @media לפני הכלל הלא-מותנה, ואין "-*/" בהערות', () => {
  assert.deepEqual(mediaBeforeBase(ocDetailsRules, 'oc-details.css'), []);
  assert.ok(!/[a-z0-9]-\*\//i.test(OC_DETAILS_CSS), 'הערה עם "-*/"');
});

/* ---------- 12. כרטיס ההזמנה — לשונית פריטים (W3, app/components/order-card/css/oc-items.css) ---------- */
// נטען רק בתוך הכרטיס החדש (.gm-ds.gm-oc). רוב העיצוב מהפלטה; כאן: לחצני הסרגל בסגנון "מחוקים" (A10), שורת הברקוד (R25), מובייל.
const OC_ITEMS_CSS = read('../app/components/order-card/css/oc-items.css');
const ocItemsRules = parseCss(OC_ITEMS_CSS);
// !important על רקע רק בלחצני הסרגל — בדיוק כמו #delToggle בפלטה (שקוף; כחול בריחוף), אחרת חוק ה-.btn של הפלטה גובר
const OC_ITEMS_IMPORTANT_BG_OK = new Set(['.gm-ds.gm-oc .app .hres-bar .btn.tgl', '.gm-ds.gm-oc .app .hres-bar .btn.tgl:is(:hover,:focus-visible)']);
t('oc-items.css: כל כלל בהיקף .gm-ds.gm-oc', () => {
  const bad = [];
  for (const r of ocItemsRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('oc-items.css: אין רקע לבן קשיח; !important על רקע רק בלחצני הסרגל (כמו #delToggle)', () => {
  const bad = [];
  for (const r of ocItemsRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    if (setsProp(r, /^background(-color|-image)?$/).some(isImportant)) for (const s of splitSel(r.sel)) if (!OC_ITEMS_IMPORTANT_BG_OK.has(s.replace(/\s+/g, ' '))) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('oc-items.css: אין דריסת @media לפני הכלל הלא-מותנה; אין "-*/" בהערה; אין סלקטור גלובלי', () => {
  assert.deepEqual(mediaBeforeBase(ocItemsRules, 'oc-items.css'), []);
  assert.ok(!/[a-z0-9]-\*\//i.test(OC_ITEMS_CSS), '"-*/" בתוך הערה שובר next build');
  assert.ok(!/(^|[},\s])(:root|html|body)\b/.test(OC_ITEMS_CSS.replace(/\/\*[\s\S]*?\*\//g, '')), 'סלקטור גלובלי');
});
const hasOcItems = (selRe, propRe, valueRe) => ocItemsRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => !valueRe || valueRe.test(d.value)));
t('oc-items.css: A10 — לחצני הסרגל בגובה 32 ובמסגרת הכחולה של "מחוקים", ✓ ורוד בנבחר; צבע טקסט השדות גובר על globals (0,4,1)', () => {
  assert.ok(hasOcItems(/\.hres-bar \.btn\.tgl$/, /^height$/, /^32px/), 'גובה 32 ללחצני הסרגל');
  assert.ok(hasOcItems(/\.hres-bar \.btn\.tgl$/, /^border$/, /var\(--gm-navy\)/), 'מסגרת כחולה כמו #delToggle');
  assert.ok(hasOcItems(/\.hres-bar \.btn\.tgl \.evck$/, /^stroke$/, /#f38a6b/), '✓ ורוד כמו #delToggle');
  assert.ok(/#delToggle[^{]*\{[^}]*height:32px/.test(PALETTE.replace(/\s+/g, '')) || /#delToggle\{min-height:32px;height:32px/.test(PALETTE), 'הפלטה: #delToggle בגובה 32 (המקור שאליו מיישרים)');
  assert.ok(hasOcItems(/:is\(\.items-card,\.sbar\) :is\(input,textarea\)\.inp$/, /^color$/), 'צבע טקסט לשדות הלשונית ושורת הסריקה');
});

/* ---------- 13. כרטיס ההזמנה החדש - לשונית התשלומים (app/components/order-card/css/oc-payments.css, W4) ---------- */
// נטען בתוך שורש .gm-ds.gm-oc (בלי .gm-home). רק תוספות למה שאין בפלטה: היקף, בלי לבן קשיח / !important / גופן, צבעים רק מאסימוני הפלטה,
// אין @media לפני הכלל הרגיל, ואין "-*/" בהערה. הבדיקה החזותית מול העיצוב: scripts/order-card-bg-audit (שלבי P01-P10).
const OC_PAY_CSS = read('../app/components/order-card/css/oc-payments.css');
const ocPayRules = parseCss(OC_PAY_CSS);
t('oc-payments.css: כל כלל בהיקף .gm-ds.gm-oc', () => {
  const bad = [];
  for (const r of ocPayRules) for (const s2 of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s2)) bad.push(s2);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('oc-payments.css: אין רקע לבן קשיח, אין !important, אין font-family, צבעים רק מאסימוני הפלטה (var(--gm-*))', () => {
  const bad = [];
  for (const r of ocPayRules) {
    for (const d of decls(r.body)) {
      if (isImportant(d)) bad.push(`!important: ${r.sel} { ${d.prop} }`);
      if (d.prop === 'font-family') bad.push(`font-family: ${r.sel}`);
      if (/^(background(-color)?|color|border(-color)?)$/.test(d.prop)) {
        const v = d.value.trim();
        if (WHITE_RE.test(v) || /#[0-9a-f]{3,8}\b|rgba?\(/i.test(v)) bad.push(`${r.sel} { ${d.prop}: ${v} }`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
t('oc-payments.css: אין דריסת @media לפני הכלל הלא-מותנה; אין "-*/" בתוך הערה', () => {
  assert.deepEqual(mediaBeforeBase(ocPayRules, 'oc-payments.css'), []);
  assert.ok(!/[a-z0-9]-\*\//i.test(OC_PAY_CSS), '"-*/" שובר next build');
});
t('oc-payments.css: נטרול דליפת input של החלון בשדה הסכום (amtin) - בהיקף החלון, כמו בעיצוב', () => {
  assert.ok(ocPayRules.some((r) => /:is\(#dlg,#dlg2\) \.amtin input/.test(r.sel) && decls(r.body).some((d) => d.prop === 'border-radius' && /^0/.test(d.value))));
});

/* ---------- 14. כרטיס ההזמנה החדש - לשונית היסטוריה (W6, app/components/order-card/css/oc-history.css) ---------- */
// שורש .gm-ds.gm-oc (לעולם לא gm-home). רוב הרכיבים מהפלטה; כאן רק תוספות העיצוב ונטרולי הדליפה שנמצאו בבדיקת
// scripts/order-card-bg-audit (שלבים 40-48, TOTAL 0 ב-1280/375): שדה החיפוש (input גלובלי לבן/גבול/רדיוס), ריפוד לחצן הניקוי,
// מסגרת לחצן הסינון כשהתפריט פתוח. אין רקע לבן קשיח, אין !important על רקע, אין @media לפני הבסיס.
const OC_HIST_CSS = read('../app/components/order-card/css/oc-history.css');
const ocHistRules = parseCss(OC_HIST_CSS);
t('oc-history.css: כל כלל בהיקף .gm-ds.gm-oc, בלי gm-home', () => {
  const bad = [];
  for (const r of ocHistRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(\s|$)/.test(s) || /gm-home/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('oc-history.css: אין רקע לבן קשיח ואין !important על רקע; אין @media לפני הכלל הלא-מותנה; אין "-*/" בהערה', () => {
  const bad = [];
  for (const r of ocHistRules) for (const d of setsProp(r, /^background(-color|-image)?$/)) {
    const v = d.value.replace(/!important/i, '').trim();
    if (WHITE_RE.test(v) || isImportant(d)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
  }
  assert.deepEqual(bad, []);
  assert.deepEqual(mediaBeforeBase(ocHistRules, 'oc-history.css'), []);
  assert.ok(!/[a-z0-9]-\*\//i.test(OC_HIST_CSS));
});
const hasOcHist = (selRe, propRe, valueRe) => ocHistRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => !valueRe || valueRe.test(d.value)));
t('oc-items.css: בורר תקין/לא תקין של פריט שהוחזר (.oc-cond) - בהיקף .gm-ds.gm-oc, בלי רקע קשיח, רק גודל/ריפוד', () => {
  assert.ok(hasOcItems(/\.seg\.pill\.oc-cond$/, /^flex$/), 'מכל הבורר');
  assert.ok(hasOcItems(/\.seg\.pill\.oc-cond button$/, /^padding$/), 'ריפוד לחצני הבורר (הפלטה נותנת 10px 16px)');
  const bad = ocItemsRules.filter((r) => /\.oc-(cond|retchip)/.test(r.sel)).flatMap((r) => setsProp(r, /^background(-color|-image)?$/).map((d) => `${r.sel} { ${d.prop}: ${d.value} }`));
  assert.deepEqual(bad, []);
});
t('oc-history.css: נטרולי הדליפה - שדה החיפוש שקוף בלי גבול/רדיוס, ריפוד לחצן הניקוי, מסגרת הסינון הפתוח, מטא השלבים', () => {
  assert.ok(hasOcHist(/input#hfQ/, /^background$/, /^transparent/), 'רקע שדה החיפוש');
  assert.ok(hasOcHist(/input#hfQ/, /^border$/, /^0/), 'גבול שדה החיפוש');
  assert.ok(hasOcHist(/input#hfQ/, /^border-radius$/, /^0/), 'רדיוס שדה החיפוש (design-overrides 10px)');
  assert.ok(hasOcHist(/\.hf-cl$/, /^padding$/), 'ריפוד לחצן הניקוי (globals.css מאפס)');
  assert.ok(hasOcHist(/\.hf-sel\.on \.hf-t$/, /^border-color$/), 'מסגרת לחצן הסינון כשהתפריט פתוח');
  assert.ok(hasOcHist(/\.card\.proc \.prc-m$/, /^display$/, /^flex/), 'מטא שורת שלב (שכבת הסקירה, מאושר)');
});
t('הדליפות שנוטרלו בלשונית ההיסטוריה עדיין קיימות ב-CSS הגלובלי (אם נעלמו - אפשר להסיר את הנטרול)', () => {
  assert.ok(/input[^{]*\{[^}]*border-radius:\s*10px/.test(OVERRIDES), 'design-overrides.css: input{border-radius:10px} כבר לא קיים');
});

/* ---------- 15. כרטיס ההזמנה החדש - מסמכים: תפריט הדפסה, מייל מהיר, כתובת מייל חסרה (app/components/order-card/css/oc-docs.css, W7) ---------- */
// בלוק mail-sheet-css של העיצוב (גיליון תחתון בשתי עמודות) בשמות הפלטה (--gm-*) בהיקף הכרטיס. החריג היחיד ל"בלי !important" הוא שדות הטקסט של
// גיליון המייל (מסגרת זהב + זוהר במיקוד) - בדיוק כמו בעיצוב, כדי לגבור על design-overrides.css (input:not(...){...!important}).
const OC_DOCS_CSS = read('../app/components/order-card/css/oc-docs.css');
const ocDocsRules = parseCss(OC_DOCS_CSS);
const OC_DOCS_IMPORTANT_OK = /\.fx-sheet :is\(input,textarea\)\.inp/;
t('oc-docs.css: כל כלל בהיקף .gm-ds.gm-oc (לא דולף לשאר האתר / לכרטיס הישן)', () => {
  const bad = [];
  for (const r of ocDocsRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('oc-docs.css: !important רק בשדות הטקסט של גיליון המייל; בלי רקע לבן קשיח / var(--gm-surface)', () => {
  const bad = [];
  for (const r of ocDocsRules) for (const d of decls(r.body)) {
    if (isImportant(d) && !OC_DOCS_IMPORTANT_OK.test(r.sel)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    if (/^background(-color)?$/.test(d.prop) && (WHITE_RE.test(d.value.trim()) || /var\(--gm-surface\)/.test(d.value))) bad.push(`${r.sel} { ${d.prop}: ${d.value} } (לבן)`);
  }
  assert.deepEqual(bad, []);
});
t('oc-docs.css: אין דריסת @media לפני הכלל הלא-מותנה, אין "-*/" בהערות, ואין מחלקות/סלקטורים של תפריט ההדפסה (הם מהפלטה)', () => {
  assert.deepEqual(mediaBeforeBase(ocDocsRules, 'oc-docs.css'), []);
  assert.ok(!/[a-z0-9]-\*\//i.test(OC_DOCS_CSS), 'הערה עם "-*/"');
  // החריג היחיד: עוגן התפריט במסך צר (בעיצוב הוא נחתך מחוץ למסך) - בלי שינוי בצבעים/רקעים/צורה של התפריט
  const ownMenuRules = ocDocsRules.filter((r) => /(^|[\s,])\.(gm-ds\.gm-oc )?(menu|xlbtn)|\.xl[gdp]/.test(r.sel) && r.sel !== '.gm-ds.gm-oc .tools .menu');
  assert.deepEqual(ownMenuRules.map((r) => r.sel), [], 'התפריט וכפתורי ה-xlbtn הם רכיבי פלטה - בלי כלל משלהם');
  assert.deepEqual(ocDocsRules.filter((r) => r.sel === '.gm-ds.gm-oc .tools .menu').flatMap((r) => decls(r.body).map((d) => d.prop)).sort(), ['inset-inline-end', 'inset-inline-start'], 'עוגן התפריט בלבד');
});

/* ---------- 16. כרטיס ההזמנה החדש - הרייל וחלונות השמירה (app/components/order-card/css/oc-rail.css, W5) ---------- */
// נטען בתוך שורש .gm-ds.gm-oc (בלי .gm-home). רק תוספות למה שאין בפלטה: היקף, בלי לבן קשיח / !important / גופן, צבעים רק מאסימוני הפלטה,
// אין @media לפני הכלל הרגיל, ואין "-*/" בהערה. הבדיקה החזותית מול העיצוב: scripts/order-card-bg-audit (שלבי R01-R08).
const OC_RAIL_CSS = read('../app/components/order-card/css/oc-rail.css');
const ocRailRules = parseCss(OC_RAIL_CSS);
t('oc-rail.css: כל כלל בהיקף .gm-ds.gm-oc', () => {
  assert.ok(ocRailRules.length >= 4, 'הקובץ לא ריק');
  const bad = [];
  for (const r of ocRailRules) for (const s2 of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s2)) bad.push(s2);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('oc-rail.css: אין רקע לבן קשיח, אין !important, אין font-family, צבעים רק מאסימוני הפלטה (בלי hex/rgb)', () => {
  const bad = [];
  for (const r of ocRailRules) {
    for (const d of decls(r.body)) {
      if (isImportant(d)) bad.push(`!important: ${r.sel} { ${d.prop} }`);
      if (d.prop === 'font-family') bad.push(`font-family: ${r.sel}`);
      if (/^(background(-color)?|color|border(-color)?)$/.test(d.prop)) {
        const v = d.value.trim();
        if (WHITE_RE.test(v) || /#[0-9a-f]{3,8}|rgba?\(/i.test(v)) bad.push(`${r.sel} { ${d.prop}: ${v} }`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
t('oc-rail.css: אין דריסת @media לפני הכלל הלא-מותנה; אין "-*/" בתוך הערה', () => {
  assert.deepEqual(mediaBeforeBase(ocRailRules, 'oc-rail.css'), []);
  assert.ok(!/[a-z0-9]-\*\//i.test(OC_RAIL_CSS), '"-*/" שובר next build');
});
t('oc-rail.css: נטרולי הדליפה של הרייל והבאנר - ריפוד לחצני ביטול/החזר (globals.css מאפס padding), רווחי באנר הטיוטה, מרווח D6', () => {
  const has = (selRe, prop, valRe) => ocRailRules.some((r) => selRe.test(r.sel) && decls(r.body).some((d) => d.prop === prop && valRe.test(d.value)));
  assert.ok(has(/\.rail :is\(\.cl-u,\.redo\)/, 'padding', /^1px 6px$/), 'padding של .cl-u/.redo');
  assert.ok(has(/\.oc-banner \.nb-bi$/, 'gap', /^2px$/), 'gap של שורות הבאנר');
  assert.ok(has(/\.oc-banner \.nb-bi \.nb-go$/, 'margin-top', /^12px$/), 'מרווח לחצן הבאנר');
  assert.ok(has(/\.success \.oc-success-gap$/, 'height', /^24px$/), 'D6: מרווח 24px');
  assert.ok(!ocRailRules.some((r) => /oc-r5|shield/.test(r.sel)), 'AMB-05: אין כלל לשורת מגן חוב');
});

/* ---------- 15. אשף "הזמנה חדשה" (app/components/new-order/css/new-order.css): אותו משטר היקף כמו הפרופיל ---------- */
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
t('new-order.css: אין רקע לבן קשיח לבלוקים; !important על רקע רק לשיטוח (none/transparent), לכרטיס הפנינה, לאריח האייקון (.ico) של העיצוב או לכותרת הטבלה בחלון התפוסה (.rtbl>thead>tr>th, globals.css כופה רקע על כל th)', () => {
  const bad = [];
  for (const r of noRules) {
    for (const d of setsProp(r, /^background(-color|-image)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (/var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
      if (isImportant(d) && !/^(none|transparent)$/.test(v) && !PEARL_RE.test(v.replace(/\s+/g, '')) && !/ \.ico\[class\]$/.test(r.sel) && !/\.rtbl>thead>tr>th$/.test(r.sel)) bad.push('!important: ' + r.sel + ' ' + v.slice(0, 40));
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

/* ---------- 10. "סיכום נוכחות" (app/components/attendance/attendance.css, 4.10.2026) ---------- */
// אותו משטר כמו הפרופיל והלו״ז: כל כלל בהיקף .gm-ds.gm-at, שורש בלי gm-home, נטרולי הדליפות של globals / design-overrides במקום,
// ומתג התצוגה בגובה הלחצנים (46px). בדיקת נאמנות מלאה מול העיצוב: scripts/attendance-bg-audit (run.mjs + print.mjs).
const ATT_CSS = read('../app/components/attendance/attendance.css');
const ATT_PRINT_CSS = read('../app/components/attendance/print/attendancePrint.css');
const attRules = parseCss(ATT_CSS);
const ATT_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-at)']);
t('attendance.css: כל כלל בהיקף .gm-ds.gm-at (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const r of attRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-at(\.dlg-dark)?(\s|$)/.test(s) && !ATT_OUT_OF_SCOPE_OK.has(s) && !/^(from|to|\d+%)$/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('attendance.css: אין רקע לבן קשיח מחוץ לרשימה; !important על רקע רק בכרטיס הפנינה ובכותרות הטבלאות', () => {
  const OK = new Set(['.gm-ds.gm-at .card', '.gm-ds.gm-at .rtbl>thead>tr>th', '.gm-ds.gm-at .at-sh>thead>tr>th', '.gm-ds.gm-at .ea-tbl thead tr.per th']);
  const bad = [];
  for (const r of attRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (/var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    // !important שקוף (כללי הנייד של העיצוב: השורה הופכת לכרטיס בלי רקע תא) מותר
    if (setsProp(r, /^background(-color|-image)?$/).some((d) => isImportant(d) && !/^transparent\s*!important$/i.test(d.value))) for (const s of splitSel(r.sel)) if (!OK.has(s.replace(/\s+/g, ' '))) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('attendance.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(attRules, 'attendance.css'), []);
});
const hasAtt = (selRe, propRe, { important = false, valueRe } = {}) => attRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('attendance.css: נטרול דליפות - גופן (!important), כותרות הטבלאות, field margin, צבע שדה, ריפוד לחצני אייקון, כרטיס הפנינה', () => {
  assert.ok(hasAtt(/\.gm-ds\.gm-at :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }));
  assert.ok(hasAtt(/\.gm-ds\.gm-at :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }));
  assert.ok(hasAtt(/^\.gm-ds\.gm-at \.rtbl>thead>tr>th$/, /^background-color$/, { important: true }), 'כותרת הטבלה הראשית (globals כופה קרם)');
  assert.ok(hasAtt(/^\.gm-ds\.gm-at \.at-sh>thead>tr>th$/, /^background-color$/, { important: true }), 'כותרת טבלת המשמרות שבפירוט');
  assert.ok(!attRules.some((r) => /\.rtbl thead tr th/.test(r.sel)), 'נטרול כותרת הטבלה בלי > תופס גם את טבלת הפירוט המקוננת (באג שנמצא בבדיקה)');
  assert.ok(hasAtt(/^\.gm-ds\.gm-at \.field$/, /^margin-bottom$/, { valueRe: /^0/ }));
  assert.ok(hasAtt(/\.gm-ds\.gm-at input\.inp:not\(:disabled\)/, /^color$/));
  assert.ok(hasAtt(/^\.gm-ds\.gm-at :is\(\.back,\.ibtn\)$/, /^padding$/));
  assert.ok(hasAtt(/^\.gm-ds\.gm-at \.card$/, /^background$/, { important: true }));
});
t('attendance.css: מתג "לפי חודש / לפי עובד" ו"החודש" בגובה 46px כמו שאר לחצני הסרגל (תיקון הבעלים 4.10.2026)', () => {
  assert.ok(hasAtt(/\.seg\.pill\.at-vseg$/, /^height$/, { valueRe: /^46px/ }));
  assert.ok(hasAtt(/#mNow$/, /^height$/, { valueRe: /^46px/ }));
  assert.ok(!/lz-wpin/.test(ATT_CSS), 'סיסמת מאשר לייצוא (בוטלה - AT-08)');
});
t('סיכום נוכחות: שורש בלי gm-home, בלי title=, הדף המודפס בלי משתני ערכת נושא', () => {
  const dir = '../app/components/attendance/';
  const src = ['AttendancePage.js', 'AttendanceEdit.js', 'AttendanceWizard.js', 'AttendanceDialogs.js', 'parts.js'].map((f) => read(dir + f)).join('\n');
  assert.ok(/className="gm-ds gm-at home-bg dlg-dark"/.test(src));
  assert.ok(!/gm-home/.test(src));
  assert.ok(!/\btitle="/.test(src.replace(/<iframe[^>]*>/g, '')), 'title= (טולטיפ דפדפן) במקום data-tip');
  assert.ok(!/var\(--(?!pp-)/.test(ATT_PRINT_CSS.replace(/\/\*[\s\S]*?\*\//g, '')), 'משתנה ערכת נושא בדף המודפס');
  assert.ok(!/@import/.test(ATT_PRINT_CSS), '@import ב-CSS של ההדפסה (הגופן נטען בדף עצמו)');
});

/* ---------- 11. חלון "דיווח על שגיאות" (app/components/errorReport/errorReport.css + launcher.css): אותו משטר היקף ---------- */
// החלון מוצג מעל כל דף (portal ל-body) בשתי המעטפות, ולכן דליפה ממנו = דליפה לכל האתר. בדיקת נאמנות: scripts/error-report-audit.
const ER_CSS = read('../app/components/errorReport/errorReport.css');
const ER_LAUNCH_CSS = read('../app/components/errorReport/launcher.css');
const erRules = parseCss(ER_CSS);
const erLaunchRules = parseCss(ER_LAUNCH_CSS);
const ER_OUT_OF_SCOPE_OK = new Set(['body.gm-er-picking', 'body.gm-er-picking *']); // סמן כוונת בזמן סימון אלמנט בעמוד
// לבן קשיח מהסקיצה המאושרת: רקע התמונות הממוזערות, תיבת הכתיבה והשדות בחלון הבהיר
const ER_WHITE_OK = new Set(['.gm-ds.gm-er .er-shot', '.gm-ds.gm-er .er-elt', '.gm-ds.gm-er .er-fileb', '.gm-ds.gm-er .er-vid', '.gm-ds.gm-er.dlg-dark #dlg.er-light .er-composer', '.gm-ds.gm-er.dlg-dark #dlg.er-light :is(input,textarea):not([type=checkbox])', '.gm-ds.gm-er .er-lbel', '.gm-ds.gm-er .er-lbfr']);
// !important על רקע - רק הכללים של הסקיצה (תיבת הטקסט שקופה בתוך תיבת הכתיבה, שדה החיפוש, "פניות שלי" / "+ דיווח חדש" במצב נוכחי)
const ER_IMPORTANT_BG_OK = new Set(['.gm-ds.gm-er #dlg.er-win .er-composer textarea.inp', '.gm-ds.gm-er #dlg.er-win .er3-s input', '.gm-ds.gm-er #dlg.er-win .er-newb.cur', '.gm-ds.gm-er #dlg.er-win .er-inb']);
t('errorReport.css: כל כלל בהיקף .gm-ds.gm-er (חוץ מסמן הסימון על body), בלי .gm-home', () => {
  const bad = [];
  for (const r of erRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-er(?![\w-])/.test(s) && !ER_OUT_OF_SCOPE_OK.has(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
  assert.ok(!/gm-home/.test(ER_CSS), 'gm-home בחלון');
});
t('launcher.css (הכפתור הצף, נטען בכל דף): כל כלל בהיקף .gm-er-launch ובלי הפלטה', () => {
  const bad = [];
  for (const r of erLaunchRules) for (const s of splitSel(r.sel)) if (!/^\.gm-er-launch(\s|$)/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
  assert.ok(!/\.gm-ds/.test(ER_LAUNCH_CSS.replace(/\/\*[\s\S]*?\*\//g, '')), 'הכפתור הצף לא תלוי בפלטה (components.css נטען רק עם החלון)');
});
t('errorReport.css: אין רקע לבן קשיח מחוץ לרשימה; !important על רקע רק בכללי הסקיצה', () => {
  const bad = [];
  for (const r of erRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if ((WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) && !splitSel(r.sel).every((s) => ER_WHITE_OK.has(s))) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    if (setsProp(r, /^background(-color|-image)?$/).some(isImportant)) for (const s of splitSel(r.sel)) if (!ER_IMPORTANT_BG_OK.has(s)) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('errorReport.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(erRules, 'errorReport.css'), []);
});
const hasEr = (selRe, propRe, { important = false, valueRe } = {}) => erRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('errorReport.css: נטרול דליפות (נמצאו ב-error-report-audit) - גופן, צבע כותרות, ריפוד לחצנים, כפתור שליחה מנוטרל, שורש בלי רקע/גובה של .gm-ds', () => {
  assert.ok(hasEr(/\.gm-ds\.gm-er :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'גופן ללחצנים/שדות (design-overrides.css)');
  assert.ok(hasEr(/\.gm-ds\.gm-er :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }), 'גופן לכותרות');
  assert.ok(hasEr(/\.gm-ds\.gm-er :where\(h1,h2,h3,h4,h5,h6\)/, /^color$/, { valueRe: /^inherit/ }), 'צבע כותרות (globals.css חום)');
  assert.ok(hasEr(/:where\(\.er-x0,\.er-cb,\.er-send/, /^padding$/, { valueRe: /^1px 6px/ }), 'ריפוד ברירת המחדל של לחצנים (globals.css מאפס)');
  assert.ok(hasEr(/\.er-send:disabled/, /^opacity$/, { valueRe: /^1/ }), 'כפתור שליחה מנוטרל אטום (globals.css)');
  assert.ok(hasEr(/^\.gm-ds\.gm-er$/, /^display$/, { valueRe: /^contents/ }), 'השורש display:contents (הפלטה נותנת ל-.gm-ds רקע וגובה מסך)');
});
t('errorReport.css: הוראות הבעלים 4.10.2026 - כפתורים עגולים כחולים (.xlbtn.xlp), שמות בזהב (טוקן), בלי תפריט ⋯', () => {
  assert.ok(hasEr(/\.er3-acts \.xlbtn \.ic/, /^color$/, { valueRe: /#1e63c4/ }), 'אייקון בכחול של הכפתור');
  assert.ok(!erRules.some((r) => /\.er3-acts/.test(r.sel) && setsProp(r, /^(width|height|border-radius|background|border)$/).length && !/\.on|:disabled/.test(r.sel)), 'הכפתור העגול לא מעוצב מחדש - רק הפלטה (.tools .xlbtn.xlp)');
  assert.ok(hasEr(/\.er3-bh b/, /^color$/, { valueRe: /var\(--er-name\)/ }) && /--er-name:var\(--eg-tx\)/.test(ER_CSS) && /--er-name:var\(--gm-gold-300\)/.test(ER_CSS), 'שמות בזהב של הפלטה');
  assert.ok(!/er3-menu|\.menu\b|er3-mw/.test(ER_CSS), 'כללי תפריט ⋯');
});

/* ---------- כותרת צפה של החיפוש החכם (4.10.2026, "הכותרת לא צפה כמו בדמו") ---------- */
const CHAT_JS = read('../app/components/home/HomeChat.js');
t('חיפוש חכם: כללי הכותרת הצפה (.aibar) בפלטה - fixed, מוסתרת עד .on, ללא דריסה בדף', () => {
  const rs = parseCss(PALETTE).filter((r) => /\.gm-ds\.gm-home \.advp\.aiw>\.card-h\.aibar/.test(r.sel));
  assert.ok(rs.some((r) => /position:\s*fixed/.test(r.body) && /opacity:\s*0/.test(r.body) && /visibility:\s*hidden/.test(r.body)), 'מצב מוסתר, position:fixed');
  assert.ok(rs.some((r) => /\.on$/.test(r.sel) && /opacity:\s*1/.test(r.body) && /visibility:\s*visible/.test(r.body)), 'מצב .on');
  assert.ok(!parseCss(HOME_CSS).some((r) => /aibar/.test(r.sel)), 'home.css לא דורס את הכותרת הצפה');
});
t('HomeChat: הכותרת הצפה מרונדרת ב-portal ל-body (אבות עם backdrop-filter שוברים fixed), בשני עוטפים .gm-ds.gm-home > .advp.aiw > .card-h.aibar', () => {
  assert.match(CHAT_JS, /createPortal\(/);
  assert.match(CHAT_JS, /document\.body/);
  assert.match(CHAT_JS, /className="gm-ds gm-home"[^>]*style=\{FLOAT_WRAP_STYLE\}/);
  assert.match(CHAT_JS, /className="advp aiw" style=\{FLOAT_WRAP_STYLE\}/);
  assert.match(CHAT_JS, /FLOAT_WRAP_STYLE = \{ display: 'contents' \}/);
  assert.match(CHAT_JS, /className="card-h aibar"/);
});
t('HomeChat: ההיגיון כמו בדמו - 8px מתחת לסרגל, צר ב-34px מכל צד, "on" כשהכותרת יצאה ועד סוף הכרטיס, מאזין לגלילה/שינוי גודל', () => {
  assert.match(CHAT_JS, /side = 34/);
  assert.match(CHAT_JS, /inset = 14/);
  assert.match(CHAT_JS, /Math\.min\(nb \+ 8, cr\.bottom - bh - inset\)/);
  assert.match(CHAT_JS, /classList\.toggle\('on', hr\.bottom < nb \+ 4 && cr\.bottom > nb \+ bh \+ inset \+ 8\)/);
  assert.match(CHAT_JS, /addEventListener\('scroll'/);
  assert.match(CHAT_JS, /addEventListener\('resize'/);
  assert.match(CHAT_JS, /querySelector\('\.snav'\)/);
});

t('חיפוש חכם: ה-X בשורת שאלת ההמשך מוצג רק כשיש טקסט (.ibtn[hidden] מוסתר; hidden={!fu}; פוקוס חוזר לשדה)', () => {
  assert.ok(parseCss(HOME_CSS).some((r) => r.sel.trim() === '.gm-ds.gm-home .scan .ibtn[hidden]' && /display:\s*none\s*!important/.test(r.body)), 'כלל .scan .ibtn[hidden] ב-home.css (הפלטה נותנת ל-.ibtn display:grid ולכן hidden לא עבד)');
  assert.match(CHAT_JS, /aria-label="ניקוי הטקסט"[^>]*hidden=\{!fu\}/);
  assert.match(CHAT_JS, /setFu\(''\); if \(fuRef\.current\) fuRef\.current\.focus\(\)/);
});

/* ---------- 12. אייקון המעבר "ישן / חדש" (app/components/variant/pageVariantToggle.css, 4.10.2026) ---------- */
// נטען בכל דף שבו האייקון מוצג - גם בדפים הישנים (בלי components.css) ובמעטפת הישנה - ולכן קטן, עצמאי ובהיקף .gm-pvt בלבד.
// בדיקת המראה בדפדפן: scripts/variant-toggle-audit (computed style בדף חדש ובדף ישן, 1280 / 375).
const PVT_CSS = read('../app/components/variant/pageVariantToggle.css');
const pvtRules = parseCss(PVT_CSS);
t('pageVariantToggle.css: כל כלל בהיקף .gm-pvt, בלי הפלטה (.gm-ds), בלי data-ui-*, בלי */ בתוך הערה', () => {
  const bad = [];
  for (const r of pvtRules) for (const s of splitSel(r.sel)) if (!/^\.gm-pvt(?![\w-])/.test(s) && s !== '.gm-pvt-spacer') bad.push(s); // + המרווח בסוף דף ישן
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
  const code = PVT_CSS.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/\.gm-ds|gm-home|data-ui-|!important(?![^{}]*display:none)/.test(code.replace(/@media print\{[^}]*\}\}?/, '')), 'תלות בפלטה / data-ui / !important');
  assert.ok(pvtRules.length > 10, 'הכללים נקראו');
});
t('pageVariantToggle.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(pvtRules, 'pageVariantToggle.css'), []);
});
t('pageVariantToggle.css: לחצן אייקון עגול של הפלטה - עיגול, רקע --gm-gbtn, מסגרת שחורה 1.5px, פוקוס נייבי; פינה בצד שמאל (inline-end) מתחת ל-AI/דיווח', () => {
  const has = (selRe, propRe, valueRe) => pvtRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => valueRe.test(d.value)));
  assert.ok(has(/^\.gm-pvt \.gm-pvt-btn$/, /^border-radius$/, /^50%/), 'עגול');
  assert.ok(has(/^\.gm-pvt \.gm-pvt-btn$/, /^background$/, /var\(--gm-gbtn\)/), 'רקע זהב של הפלטה');
  assert.ok(has(/^\.gm-pvt \.gm-pvt-btn$/, /^border$/, /^1\.5px solid #000/), 'מסגרת');
  assert.ok(has(/:focus-visible/, /^outline$/, /var\(--gm-navy\)/), 'פוקוס');
  assert.ok(has(/^\.gm-pvt\.gm-pvt-corner$/, /^inset-inline-end$/, /^20px/), 'פינה שמאלית (ימין תפוס ע"י AI + הדיווח)');
  assert.ok(has(/^\.gm-pvt\.gm-pvt-overlay$/, /^z-index$/, /^1000000/), 'מעל החלון הישן של הדיווח (999999)');
});

/* ---------- 13. "השינויים שלי" (& ו-/?recent=mine, 4.10.2026): בלוק 15 ב-home.css ---------- */
const mineRules = parseCss(HOME_CSS).filter((r) => /\.mine-/.test(r.sel));
t('השינויים שלי: הכללים קיימים, כולם בהיקף .gm-ds.gm-home, בלי !important, ורק משתני הפלטה --gm-* (בלי var(--navy)... של דף הדמו)', () => {
  assert.ok(mineRules.length >= 20, 'נמצאו ' + mineRules.length);
  const bad = [];
  for (const r of mineRules) {
    for (const sel of splitSel(r.sel)) if (!/^\.gm-ds\.gm-home /.test(sel)) bad.push(sel);
    if (/!important/.test(r.body)) bad.push('!important ב-' + r.sel);
    for (const m of r.body.matchAll(/var\(--([a-z0-9-]+)/gi)) if (!m[1].startsWith('gm-')) bad.push('משתנה שאינו gm-: --' + m[1]);
  }
  assert.deepEqual(bad, [], bad.join(' | '));
});
t('השינויים שלי: אין דריסת @media לפני הכלל הלא-מותנה, וה-CSS של החלונית לא מגדיר צבע / גופן חדש (רק rgba של הזהב / הלבן שכבר בפלטה, בלי font-family)', () => {
  assert.deepEqual(mediaBeforeBase(mineRules, 'home.css (mine)'), []);
  for (const r of mineRules) {
    assert.ok(!/font-family|#[0-9a-f]{3,8}/i.test(r.body), 'צבע hex / גופן חדש ב-' + r.sel);
  }
});
t('השינויים שלי: הקומפוננטות משתמשות באותם מחלקות (mine-list / mine-o / mine-t / mine-note / mine-view) ובאייקוני sprite בלבד', () => {
  const QP = read('../app/components/search/QuickPrefix.js');
  const HM = read('../app/components/home/HomeMine.js');
  for (const c of ['advlist mine-list', 'advo mine-o', 'mine-t', 'mine-note', 'advo-h']) assert.ok(QP.includes(c), c);
  for (const c of ['mine-view', 'mine-sec-h', 'mine-nt', 'mine-big']) assert.ok(HM.includes(c), c);
  for (const c of ['advlist.mine-list', 'mine-list .advo-h', 'mine-view .mine-sec-h', 'mine-view .mine-nt', 'mine-view .mine-big', 'mine-note', 'mine-t ', 'mine-list .mine-head', 'mine-who .chip', 'mine-list .mine-all']) assert.ok(HOME_CSS.includes(c), 'חסר כלל: ' + c);
  for (const c of ['XlButtons', 'ViewSwitch', 'ResultsTable', 'li rlink lrow', 'card res-one recent mine-view']) assert.ok(HM.includes(c), 'HomeMine משתמש ברכיבי תוצאות החיפוש: ' + c);
  assert.ok(QP.includes('mine-head') && QP.includes('mine-all') && QP.includes('MineWho'), 'כותרת החלונית: שבבי עובדת + "הכל"');
  assert.ok(!/<img|\.svg['"]/.test(QP + HM), 'בלי תמונות / קבצי svg חיצוניים');
});

/* ---------- 14. "כרטיס עובד (ניהול)" (app/components/employee-card/employee-card.css, 4.10.2026) ---------- */
// אותו משטר כמו הפרופיל / סיכום הנוכחות: כל כלל בהיקף .gm-ds.gm-ec, שורש בלי gm-home, נטרולי הדליפות של globals / design-overrides במקום,
// ובלי כלל גלובלי. בדיקת נאמנות מלאה מול העיצוב: scripts/employee-card-audit (run.mjs, API מדומה, פורט 5203).
const EC_CSS = read('../app/components/employee-card/employee-card.css');
const ecRules = parseCss(EC_CSS);
const EC_OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-ec)', 'body *']); // body * = כלל ההדפסה (visibility) כמו בכרטיס הישן
t('employee-card.css: כל כלל בהיקף .gm-ds.gm-ec (חוץ מביטול ריפוד המעטפת וכלל ההדפסה), בלי .gm-home', () => {
  const bad = [];
  for (const r of ecRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-ec(?![\w-])/.test(s) && !EC_OUT_OF_SCOPE_OK.has(s) && !/^(from|to|\d+%)$/.test(s)) bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
  assert.ok(!/gm-home/.test(EC_CSS.replace(/\/\*[\s\S]*?\*\//g, '')), 'gm-home בכרטיס');
});
t('employee-card.css: אין רקע לבן קשיח מחוץ לרשימה; !important על רקע רק בכרטיס הפנינה, בכותרות הטבלה ובהדפסה', () => {
  const OK = new Set(['.gm-ds.gm-ec .card', '.gm-ds.gm-ec .rtbl>thead>tr>th', '.gm-ds.gm-ec .rtbl>thead>tr.per>th', '.gm-ds.gm-ec .print-area', '.gm-ds.gm-ec .print-area .card', '.gm-ds.gm-ec .print-area .rtbl>thead>tr>th', '.gm-ds.gm-ec .rtbl td', '.gm-ds.gm-ec .rtbl th']);
  const bad = [];
  for (const r of ecRules) {
    for (const d of setsProp(r, /^background(-color)?$/)) {
      const v = d.value.replace(/!important/i, '').trim();
      if (/var\(--gm-surface\)/.test(v)) bad.push(`${r.sel} { ${d.prop}: ${d.value} }`);
    }
    // !important שקוף (כללי הנייד של העיצוב: השורה הופכת לכרטיס בלי רקע תא) מותר
    if (setsProp(r, /^background(-color|-image)?$/).some((d) => isImportant(d) && !/^transparent\s*!important$/i.test(d.value))) for (const s of splitSel(r.sel)) if (!OK.has(s.replace(/\s+/g, ' ')) && !/^\.gm-ds\.gm-ec \.rtbl>?\s*(tbody|tr|td|th|thead)/.test(s) && !/^\.gm-ds\.gm-ec \.rtbl[ ,]/.test(s) && !/\.rtbl/.test(s)) bad.push('!important: ' + s);
  }
  assert.deepEqual(bad, []);
});
t('employee-card.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(ecRules, 'employee-card.css'), []);
});
const hasEc = (selRe, propRe, { important = false, valueRe } = {}) => ecRules.some((r) => selRe.test(r.sel) && setsProp(r, propRe).some((d) => (!important || isImportant(d)) && (!valueRe || valueRe.test(d.value))));
t('employee-card.css: נטרול דליפות - גופן (!important), כותרות הטבלה (>), field margin, צבע שדה, ריפוד לחצני אייקון, כרטיס הפנינה, לשונית, רדיוס שדות בחלון כהה', () => {
  assert.ok(hasEc(/\.gm-ds\.gm-ec :is\(button,input,select,textarea\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }));
  assert.ok(hasEc(/\.gm-ds\.gm-ec :is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, { important: true, valueRe: /^inherit/ }));
  assert.ok(hasEc(/^\.gm-ds\.gm-ec \.rtbl>thead>tr>th$/, /^background-color$/, { important: true }), 'כותרת הטבלה (globals כופה קרם)');
  assert.ok(!ecRules.some((r) => /\.rtbl thead tr th/.test(r.sel)), 'נטרול כותרת הטבלה בלי >');
  assert.ok(hasEc(/^\.gm-ds\.gm-ec \.field$/, /^margin-bottom$/, { valueRe: /^0/ }));
  assert.ok(hasEc(/\.gm-ds\.gm-ec input\.inp:not\(:disabled\)/, /^color$/));
  assert.ok(hasEc(/^\.gm-ds\.gm-ec :is\(\.back,\.ibtn\)$/, /^padding$/));
  assert.ok(hasEc(/^\.gm-ds\.gm-ec \.card$/, /^background$/, { important: true }));
  assert.ok(hasEc(/^\.gm-ds\.gm-ec \.tab$/, /^margin-inline-end$/, { valueRe: /^0/ }), '.tab{margin-inline-end:22px} הגלובלי');
  assert.ok(hasEc(/^\.gm-ds\.gm-ec :is\(#dlg,#dlg2\) \.inp$/, /^border-radius$/, { valueRe: /^14px/ }), 'input:not(...) הגלובלי (0,4,1) דורס את רדיוס .inp בחלונות');
});
t('employee-card.css: EC-12 - הכרטיס הצר 1040px וכפתור השמירה 420px', () => {
  assert.ok(hasEc(/^\.gm-ds\.gm-ec \.app\.ec$/, /^max-width$/, { valueRe: /^1040px/ }));
  assert.ok(hasEc(/^\.gm-ds\.gm-ec \.ec-save \.btn$/, /^max-width$/, { valueRe: /^420px/ }));
});
t('כרטיס עובד: שורש בלי gm-home, בלי title= על רכיבי הכרטיס (טולטיפ data-tip), בלי window.alert / confirm', () => {
  const dir = '../app/components/employee-card/';
  const src = ['EmployeeCardA5.js', 'EcUi.js', 'EcApproval.js', 'EcAttendance.js', 'EcHistory.js', 'EcMail.js', 'EcPermissions.js'].map((f) => read(dir + f));
  // בלי הערות (בלוק רק בתחילת שורה: accept="image/*" אינו הערה)
  const joined = src.join('\n').replace(/^\s*\/\*[\s\S]*?\*\//gm, '').replace(/^\s*\/\/.*$/gm, '');
  assert.ok(/className="gm-ds gm-ec home-bg dlg-dark"/.test(joined));
  assert.ok(!/gm-home/.test(joined));
  assert.ok(!/title=/.test(joined), 'אין title= מקורי באף רכיב של הכרטיס (גם לא על label/קישור/מתג): data-tip בלבד');
  assert.ok(!/window\.(alert|confirm|prompt)\(/.test(joined));
  assert.ok(!/@import/.test(EC_CSS));
});

/* ---------- הגדרות מערכת / אתר / שינוי שמות בעיצוב "סימולציה" (app/components/settings-sim/settings-sim.css) ---------- */
const ST_CSS = read('../app/components/settings-sim/settings-sim.css');
const stRules = parseCss(ST_CSS);
t('settings-sim.css: כל כלל בהיקף .gm-ds.gm-st (חוץ מנטרול הריפוד של המעטפת סביב השורש)', () => {
  const bad = [];
  for (const r of stRules) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-st(\s|\.|:|$)/.test(s) && s !== '.app-shell .main .content:has(> .gm-ds.gm-st)') bad.push(s);
  assert.deepEqual(bad, [], 'כללים מחוץ להיקף: ' + bad.join(' | '));
});
t('settings-sim.css: אין דריסת @media לפני הכלל הלא-מותנה', () => {
  assert.deepEqual(mediaBeforeBase(stRules, 'settings-sim.css'), []);
});
t('הגדרות: השורש gm-ds gm-st home-bg dlg-dark, בלי gm-home; אין רקע לבן קשיח חדש ב-settings-sim.css', () => {
  assert.match(read('../app/components/settings-sim/SettingsSimPage.js'), /className="gm-ds gm-st home-bg dlg-dark"/);
  const bad = [];
  for (const r of stRules) for (const d of setsProp(r, /^background(-color)?$/)) {
    const v = d.value.replace(/!important/i, '').trim();
    if (WHITE_RE.test(v) || /var\(--gm-surface\)/.test(v)) bad.push(r.sel);
  }
  // .tp-c (תאי בוחר השעה) לבנים בעיצוב
  assert.deepEqual(bad.filter((s) => !/\.tp-c/.test(s)), []);
});

/* ---------- כספים והתראות בחיפוש המתקדם (5.10.2026) ---------- */
const CLS_PRE = String.fromCharCode(92) + '.'; // regex: נקודה ליטרלית
const CLS_POST = String.fromCharCode(92) + 'b'; // regex: גבול מילה
const selRules = parseCss(HOME_CSS).filter((r) => /select\.inp/.test(r.sel));
t('כספים: בורר "סטטוס הזמנה" (select.inp) — כלל אחד בהיקף .gm-ds.gm-home, בלי !important, בלי hex / תמונה, רק משתני --gm-*', () => {
  assert.ok(selRules.length >= 1, 'חסר כלל select.inp ב-home.css');
  for (const r of selRules) {
    for (const sel of splitSel(r.sel)) assert.ok(/^\.gm-ds\.gm-home(\.gm-home)? /.test(sel), 'מחוץ להיקף: ' + sel);
    assert.deepEqual(decls(r.body).filter((d) => isImportant(d)).map((d) => d.prop), ['background-image', 'background-position', 'background-size', 'background-repeat'], '!important רק על מאפייני החץ המצויר (הפלטה מאפסת אותם דרך #dlg בסלקטור)');
    assert.ok(!/#[0-9a-f]{3,8}\b|url\(/i.test(r.body), 'hex / תמונה ב-' + r.sel);
    for (const m of r.body.matchAll(/var\(--([a-z0-9-]+)/gi)) assert.ok(m[1].startsWith('gm-'), 'משתנה שאינו gm-: --' + m[1]);
    assert.ok(/appearance:\s*none/.test(r.body), 'בלי appearance:none חץ הדפדפן מצטרף לחץ המצויר');
  }
  assert.deepEqual(mediaBeforeBase(selRules, 'home.css (select)'), []);
});
t('כספים והתראות: הקומפוננטות משתמשות רק במחלקות שכבר בפלטה (advs / advgrid / advflags / advfl / field / inpw / inp / chip) ובאייקוני sprite', () => {
  const ADV = read('../app/components/home/HomeAdvanced.js');
  const RES = read('../app/components/home/HomeAdvResults.js');
  const CFG = read('../app/components/home/homeAdvConfig.js');
  for (const c of ['advs', 'advgrid', 'advflags', 'advfl', 'className="field"', 'className="inpw"', 'className="inp"']) assert.ok(ADV.includes(c), c);
  // כל מחלקה שהקומפוננטה החדשה מזכירה קיימת בפלטה או ב-home.css
  for (const c of ['advs', 'advgrid', 'advflags', 'advfl', 'inpw', 'chip', 'rlink', 'lrow']) {
    assert.ok(new RegExp(CLS_PRE + c + CLS_POST).test(PALETTE) || new RegExp(CLS_PRE + c + CLS_POST).test(HOME_CSS), 'אין כלל ל-.' + c);
  }
  // צ'יפים בתוצאות הכספים וההתראות הם מחלקות פלטה קיימות
  for (const c of ['amtd', 'amtc', 'red', 'amber', 'gold', 'rose', 'blue']) assert.ok(new RegExp(CLS_PRE + 'chip' + CLS_PRE + c + CLS_POST).test(PALETTE), 'אין .chip.' + c + ' בפלטה');
  // כל אייקון שהתחומים החדשים מבקשים קיים ב-sprite
  const SPRITE = read('../app/components/menu/spriteSymbols.js');
  for (const i of ['bell', 'wallet', 'card', 'flag', 'bank', 'alert', 'undo', 'bag', 'user', 'pencil', 'list', 'file', 'mail']) assert.ok(SPRITE.includes('["' + i + '"'), 'אין אייקון ' + i);
  assert.ok(!/<img|\.svg['"]/.test(ADV + RES), 'בלי תמונות / קבצי svg חיצוניים');
  assert.ok(!/window\.(alert|confirm|prompt)|\balert\(|\bconfirm\(/.test(ADV + RES + CFG), 'בלי alert/confirm של הדפדפן');
  assert.ok(!/<(button|a|span|div|li|label|input|select|svg|bdi)[^>]*\stitle=/.test(ADV + RES), 'טולטיפ דרך data-tip, לא title= על אלמנט');
  assert.ok(!/טוגל/.test(ADV + RES + CFG + read('../lib/advAlerts.js') + read('../app/api/a5/adv-alerts/route.js')), 'בלי הלועזית "טוגל"');
});

/* ---------- 20. שדות הקלט: בלי מלבן "כחול בהיר" (autofill / הדגשת בחירה של הדפדפן) - דיווח הבעלים 5.10.2026 ---------- */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
t('שורת החיפוש הראשית: autoComplete="off" (לא הערך הלא-תקני "nope" ש-Chrome מתייחס אליו כהשלמה), שם ייחודי, בלי תיקון / הגדלה / בדיקת איות', () => {
  const A5 = read('../app/components/home/HomeA5.js');
  const i = A5.indexOf('id="sq"');
  assert.ok(i > 0, 'לא נמצא שדה #sq');
  const tag = A5.slice(A5.lastIndexOf('<input', i), A5.indexOf('/>', i));
  assert.ok(/autoComplete="off"/.test(tag), 'חסר autoComplete="off"');
  assert.ok(!/autoComplete="nope"/.test(tag));
  assert.ok(/name="gm-home-search"/.test(tag), 'חסר name ייחודי');
  assert.ok(/autoCorrect="off"/.test(tag) && /autoCapitalize="off"/.test(tag) && /spellCheck=\{false\}/.test(tag));
});
t('כל שדות הטקסט בדף הבית (חיפוש מתקדם, שאלת המשך) בלי autoComplete="nope"', () => {
  for (const f of ['HomeA5', 'HomeAdvanced', 'HomeChat']) assert.ok(!/autoComplete="nope"/.test(stripComments(read(`../app/components/home/${f}.js`))), f);
});
t('home.css: :-webkit-autofill נצבע מחדש בצל פנימי בצבע המשטח (--gm-surface), עם טקסט בצבע הדיו, ו-transition ארוך - בלי hex', () => {
  const rules = homeRules.filter((r) => /:-webkit-autofill/.test(r.sel));
  assert.ok(rules.length >= 1, 'אין כלל autofill');
  const sels = rules.flatMap((r) => splitSel(r.sel));
  for (const st of ['', ':hover', ':focus', ':active']) assert.ok(sels.some((s) => s.replace(/\s+/g, ' ') === `.gm-ds.gm-home input:-webkit-autofill${st}`), 'חסר מצב ' + (st || 'רגיל'));
  const body = rules.map((r) => r.body).join(';');
  assert.ok(/box-shadow:\s*0 0 0 1000px var\(--gm-surface\) inset\s*!important/.test(body), 'הצל הפנימי העבה');
  assert.ok(/-webkit-text-fill-color:\s*var\(--gm-ink\)\s*!important/.test(body), 'צבע הטקסט');
  assert.ok(/transition:\s*background-color 600000s/.test(body), 'transition ארוך נגד הבהוב צבע הדפדפן');
  assert.ok(!/#[0-9a-f]{3,8}\b/i.test(body), 'hex בכלל autofill');
});
t('home.css: ::selection בשדות הדף בצבעי פלטה (זהב-בהיר + כחול כהה), בלי כחול ברירת מחדל / hex', () => {
  const rules = homeRules.filter((r) => /::selection/.test(r.sel));
  assert.ok(rules.length >= 1, 'אין כלל ::selection');
  for (const r of rules) {
    for (const s of splitSel(r.sel)) assert.ok(/\.gm-ds\.gm-home/.test(s), 'מחוץ להיקף: ' + s);
    assert.ok(/background:\s*var\(--gm-/.test(r.body) && /color:\s*var\(--gm-/.test(r.body), 'צבעים לא מטוקן פלטה: ' + r.body.trim());
    assert.ok(!/#[0-9a-f]{3,8}\b|rgb|blue/i.test(r.body));
  }
});
t('אין ב-home.css כלל שצובע את שדות הקלט ב-#e8f0fe / כחול autofill של Chrome', () => {
  assert.ok(!/#e8f0fe|#e3effa|#d2e3fc|rgb\(\s*232\s*,\s*240\s*,\s*254/i.test(stripComments(HOME_CSS)));
});
t('כל :-webkit-autofill בפלטה / globals שמשנה את שדות הדף לא מכניס רקע שאינו --gm-', () => {
  for (const r of [...paletteHome, ...globalRules].filter((x) => /:-webkit-autofill/.test(x.sel))) {
    assert.ok(!/background(-color)?:\s*(#|rgb)/i.test(r.body), r.sel);
  }
});

/* ---------- 21. תוצאות החיפוש הראשי (5.10.2026): יישור תגית הסטטוס, שורת פריט / מלאי / צ'יפים של הלו"ז ---------- */
t('.stx (תגית סטטוס: "פעיל / הושכר") ב-components.css: vertical-align:middle - לא יושבת על קו הבסיס של האייקון', () => {
  const rule = parseCss(PALETTE).find((r) => r.sel === '.gm-ds.gm-home .stx');
  assert.ok(rule, 'חסר כלל .stx');
  const props = Object.fromEntries(decls(rule.body).map((d) => [d.prop, d.value]));
  assert.equal(props['vertical-align'], 'middle');
  assert.equal(props['align-items'], 'center');
  assert.equal(props.display, 'inline-flex');
  assert.equal(props['line-height'], '1');
});
t('שורת תוצאה: .li הוא flex עם align-items:center והעמודה .t נמתחת (flex:1, min-width:0) - התגית והשורה על אותו קו', () => {
  const li = parseCss(PALETTE).find((r) => r.sel === '.gm-ds.gm-home .res-one .li');
  assert.ok(li && /align-items:\s*center/.test(li.body), '.res-one .li ללא align-items:center');
  const t2 = homeRules.find((r) => r.sel === '.gm-ds.gm-home .res-one .li .t');
  assert.ok(t2 && /flex:\s*1/.test(t2.body) && /min-width:\s*0/.test(t2.body));
});
t('המחלקות שרכיבי התוצאות החדשים משתמשים בהן קיימות: בפלטה (chip / btnlike / amber / rose / gold / stx / li / lrow) או ב-home.css (dchips / invs / invd / invz / nolink / rt)', () => {
  const RES = read('../app/components/home/HomeResults.js');
  for (const c of ['chip', 'stx', 'li', 'lrow', 'rlink', 'ic-b', 'rlbl']) assert.ok(new RegExp(CLS_PRE + c + CLS_POST).test(PALETTE), 'אין .' + c + ' בפלטה');
  for (const c of ['amber', 'rose', 'gold', 'btnlike']) assert.ok(new RegExp(CLS_PRE + 'chip' + CLS_PRE + c + CLS_POST).test(PALETTE), 'אין .chip.' + c);
  for (const c of ['dchips', 'dchips-h', 'dchips-r', 'invs', 'invd', 'invz', 'nolink', 'rt', 'dchip-al']) {
    assert.ok(new RegExp(CLS_PRE + c + '(?![\\w-])').test(HOME_CSS), 'אין כלל ב-home.css ל-.' + c);
    assert.ok(RES.includes(c), c + ' לא בשימוש ב-HomeResults');
  }
  const SPRITE = read('../app/components/menu/spriteSymbols.js');
  for (const i of ['box', 'cal', 'dress', 'user', 'file', 'chev', 'bag', 'check', 'clock', 'x', 'undo', 'pencil']) assert.ok(SPRITE.includes('["' + i + '"'), 'אין אייקון ' + i);
});
t('כללי הסעיף החדש ב-home.css (19): בהיקף .gm-ds.gm-home, רק טוקני --gm-*, בלי hex / רקע לבן / !important על רקע', () => {
  const at = HOME_CSS.indexOf('/* 19) תוצאות החיפוש הכללי');
  assert.ok(at > 0, 'סעיף 19 חסר');
  const sec = parseCss(HOME_CSS.slice(at));
  assert.ok(sec.length >= 8);
  for (const r of sec) {
    for (const s of splitSel(r.sel)) assert.ok(/^\.gm-ds\.gm-home /.test(s), 'מחוץ להיקף: ' + s);
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(r.body), 'hex ב-' + r.sel);
    for (const m of r.body.matchAll(/var\(--([a-z0-9-]+)/gi)) assert.ok(m[1].startsWith('gm-'), 'משתנה שאינו gm-: --' + m[1]);
    assert.ok(!setsProp(r, /^background(-color)?$/).some((d) => WHITE_RE.test(d.value) || isImportant(d)), r.sel);
  }
  assert.deepEqual(mediaBeforeBase(sec, 'home.css (19)'), []);
});
t('הדגשת התאמה (mark) בתוצאות: אותו עיצוב כמו .advo mark / .mine-t mark - טקסט זהב מודגש בלי רקע', () => {
  const r = homeRules.find((x) => x.sel === '.gm-ds.gm-home .res-one .li mark');
  assert.ok(r);
  assert.ok(/background:\s*transparent/.test(r.body) && /color:\s*var\(--gm-gold-d\)/.test(r.body) && /font-weight:\s*700/.test(r.body));
});

console.log(String.fromCharCode(10) + passed + ' passed, ' + failed + ' failed, ' + (passed + failed) + ' total');
if (failed) process.exit(1);
