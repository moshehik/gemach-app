// בדיקות סטטיות על קוד הדף (app/components/schedule): האייקונים מגיעים מה-sprite המוטמע (#gmi-<שם>), לא
// מקובץ sprite.svg חיצוני - מסנני תוכן של אינטרנט מסונן מחליפים את הקובץ בריבוע לבן והאייקונים נעלמים
// (סקירה 2.10, חוסם 1; אותה אכיפה כמו scripts/test_home_logic.mjs לדף הבית). וגם: כל שם אייקון שהדף משתמש
// בו קיים ב-spriteSymbols.js, וה-sprite מוטמע פעם אחת (LocalSprite מוותר כש-MenuA5Shell כבר מספק אותו).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const L = (rel) => import(pathToFileURL(process.env.PROJ + '/' + rel).href);
const { SPRITE_SYMBOLS, SPRITE_ID_PREFIX } = await L('app/components/menu/spriteSymbols.js');
const SPRITE_IDS = new Set(SPRITE_SYMBOLS.map(([id]) => id));
const DIR = path.join(process.env.PROJ, 'app', 'components', 'schedule');
const files = readdirSync(DIR).filter((f) => f.endsWith('.js'));
const src = (f) => readFileSync(path.join(DIR, f), 'utf8');

// literals של תנאים (status === 'x') אינם שמות אייקונים
const literals = (expr) => [...String(expr).replace(/[=!]==?\s*(?:'[^']*'|"[^"]*")/g, '').matchAll(/'([a-z][a-z0-9-]*)'|"([a-z][a-z0-9-]*)"/g)].map((m) => m[1] || m[2]);

function iconNames() {
  const names = new Map(); // name -> file
  const add = (n, f) => { if (!names.has(n)) names.set(n, f); };
  for (const f of files) {
    const s = src(f);
    for (const m of s.matchAll(/<ScheduleIcon\s+name="([a-z][a-z0-9-]*)"/g)) add(m[1], f);
    for (const m of s.matchAll(/<ScheduleIcon\s+name=\{([^}]*)\}/g)) for (const n of literals(m[1])) add(n, f);
    for (const m of s.matchAll(/\bicon:\s*'([a-z][a-z0-9-]*)'/g)) add(m[1], f);
  }
  return names;
}

test('no schedule component references an external sprite.svg# (content filters replace the file with a white square)', () => {
  assert.ok(files.length >= 8, 'found only ' + files.length + ' files');
  for (const f of files) assert.ok(!src(f).includes('sprite.svg#'), `${f} still references an external sprite.svg#...`);
  const icon = src('ScheduleIcon.js');
  assert.ok(icon.includes("'#' + SPRITE_ID_PREFIX + name"), 'ScheduleIcon must reference the inline #gmi-<name> symbol');
  assert.equal(SPRITE_ID_PREFIX, 'gmi-');
});

test('every icon name used by the schedule page exists in the inline sprite (spriteSymbols.js)', () => {
  const names = iconNames();
  assert.ok(names.size >= 15, 'scan found only ' + names.size + ' icon names');
  for (const n of ['rows', 'table', 'alert', 'shield', 'refresh', 'cal', 'gift', 'chev', 'arrr', 'arrl', 'scan', 'wallet', 'pin', 'check', 'gear']) assert.ok(names.has(n), 'scan missed ' + n);
  for (const [n, f] of names) assert.ok(SPRITE_IDS.has(n), `icon "${n}" used in ${f} is missing from spriteSymbols.js`);
});

test('the sprite is embedded once: ScheduleDay renders LocalSprite, which yields to MenuA5Shell via useA5Shell (HomeSprite pattern, #207)', () => {
  assert.equal((src('ScheduleDay.js').match(/<LocalSprite \/>/g) || []).length, 1);
  const icon = src('ScheduleIcon.js');
  assert.match(icon, /const inA5Shell = useA5Shell\(\);/);
  assert.match(icon, /\{inA5Shell \? null : <MenuSprite \/>\}/);
  assert.ok(icon.includes('id="lz-i-checkc"'), 'the local check-circle symbol (J09) is kept');
  assert.ok(icon.includes('id="lz-i-checks"'), 'the local double-check symbol (J09, "הכל בוצע") is kept');
  const shell = readFileSync(path.join(process.env.PROJ, 'app', 'components', 'menu', 'MenuA5Shell.js'), 'utf8');
  assert.equal((shell.match(/<MenuSprite \/>/g) || []).length, 1);
  assert.ok(shell.indexOf('<A5ShellProvider') < shell.indexOf('<MenuSprite />'));
});

test('the page does not pull /api/settings just for the branch list (it comes with /api/schedule)', () => {
  assert.ok(!src('ScheduleDay.js').includes("'/api/settings'"));
  assert.ok(src('ScheduleDay.js').includes('data.settings.branches'));
});

test('?date= tokens: ScheduleDay reads/validates them through hebrewCalendar.js and follows menu clicks on the same page', () => {
  const day = src('ScheduleDay.js');
  assert.ok(day.includes('parseDateParam(d)') && day.includes('resolveDateParam('), 'URL date must go through the whitelist');
  assert.ok(!/DATE_RE\.test\(/.test(day), 'no second, looser date check in ScheduleDay');
  // לחיצה על "היום"/"מחר" בתפריט כשהדף כבר פתוח: הרכיב לא נטען מחדש - חייב לעקוב אחרי ?date=
  assert.ok(day.includes('useSearchParams()') && day.includes('parseDateParam(urlDate)'), 'same-page menu navigation is ignored');
});
