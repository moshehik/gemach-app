// מייצר את app/components/menu/spriteSymbols.js מתוך design-system/sprite.svg.
//
// למה: המעטפת החדשה (MenuA5Shell) טענה את האייקונים כקובץ חיצוני
// (<use href="/design-system/sprite.svg#i-x">). מסנני תוכן של ספקי אינטרנט מסונן (Netspark/רימון/נטפרי
// וכד') מיירטים HTTPS ומחליפים "תמונות" שלא אושרו בריבוע לבן 2x2 - וכך גם את קובץ ה-sprite (10KB,
// image/svg+xml), ולכן המעטפת עלתה אצל הבעלים בלי אייקונים בכלל. ה-HTML עצמו עובר במסנן ללא שינוי,
// ולכן הסמלים מוטמעים עכשיו בתוך הדף (MenuSprite ב-menuParts.js) כמו ה-IconSprite של האתר הישן.
//
// הרצה (אחרי כל build/install.py של הפלטה):  node scripts/build_menu_sprite.mjs
// בדיקה בלבד (יוצא 1 אם לא מסונכרן):          node scripts/build_menu_sprite.mjs --check
// scripts/test_menu_logic.mjs בודק את הסנכרון בכל הרצה.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SPRITE_SRC = path.join(ROOT, 'design-system', 'sprite.svg');
export const SPRITE_OUT = path.join(ROOT, 'app', 'components', 'menu', 'spriteSymbols.js');

// המחולל נשמר פשוט בכוונה: ב-sprite כל <symbol> הוא שורה אחת של צורות בסיסיות (path/circle/rect) עם
// מאפיינים פשוטים בלבד. כל דבר אחר נזרק כשגיאה כדי שלא ייכנס לדף משהו שלא עבר כאן.
const ALLOWED_TAGS = new Set(['path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse']);
const ALLOWED_ATTRS = new Set(['d', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'width', 'height', 'points', 'transform']);

export function parseSprite(svgText) {
  const version = (svgText.match(/גרסה (\S+)\./) || [])[1] || '';
  const symbols = [];
  const symRe = /<symbol id="i-([a-z0-9-]+)" viewBox="([^"]+)">(.*?)<\/symbol>/g;
  let m;
  while ((m = symRe.exec(svgText))) {
    const [, id, viewBox, inner] = m;
    const shapes = [];
    const shapeRe = /<([a-z]+)((?:\s+[a-z0-9-]+="[^"]*")*)\s*\/>/g;
    let s;
    let consumed = '';
    while ((s = shapeRe.exec(inner))) {
      const [whole, tag, attrText] = s;
      consumed += whole;
      if (!ALLOWED_TAGS.has(tag)) throw new Error(`sprite: unsupported element <${tag}> in #i-${id}`);
      const attrs = {};
      for (const a of attrText.matchAll(/([a-z0-9-]+)="([^"]*)"/g)) {
        if (!ALLOWED_ATTRS.has(a[1])) throw new Error(`sprite: unsupported attribute ${a[1]} in #i-${id}`);
        attrs[a[1]] = a[2];
      }
      shapes.push([tag, attrs]);
    }
    if (consumed !== inner) throw new Error(`sprite: unexpected content in #i-${id}: ${inner}`);
    symbols.push({ id, viewBox, shapes });
  }
  const declared = (svgText.match(/(\d+) סמלים/) || [])[1];
  if (declared && Number(declared) !== symbols.length) throw new Error(`sprite: header says ${declared} symbols, parsed ${symbols.length}`);
  if (symbols.length === 0) throw new Error('sprite: no symbols parsed');
  return { version, symbols };
}

export function renderModule({ version, symbols }) {
  const lines = symbols.map((s) => `  ${JSON.stringify([s.id, s.viewBox, s.shapes])},`);
  return `// נוצר אוטומטית ע"י scripts/build_menu_sprite.mjs מתוך design-system/sprite.svg (גרסה ${version}) - לא לערוך ידנית.
// הסמלים מוטמעים בדף ע"י MenuSprite (menuParts.js) תחת המזהים gmi-<שם>, כדי שלא יישלחו כקובץ תמונה נפרד
// שמסנני תוכן מחליפים בריבוע לבן (ר' הערת הכותרת ב-scripts/build_menu_sprite.mjs).
export const SPRITE_VERSION = ${JSON.stringify(version)};
export const SPRITE_ID_PREFIX = 'gmi-';
/** @type {Array<[id: string, viewBox: string, shapes: Array<[tag: string, attrs: Record<string, string>]>]>} */
export const SPRITE_SYMBOLS = [
${lines.join('\n')}
];
`;
}

export function buildModuleText() {
  return renderModule(parseSprite(fs.readFileSync(SPRITE_SRC, 'utf8')));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const text = buildModuleText();
  const check = process.argv.includes('--check');
  const current = fs.existsSync(SPRITE_OUT) ? fs.readFileSync(SPRITE_OUT, 'utf8') : null;
  if (check) {
    if (current === text) { console.log('spriteSymbols.js is in sync with design-system/sprite.svg'); }
    else { console.error('spriteSymbols.js is OUT OF SYNC - run: node scripts/build_menu_sprite.mjs'); process.exit(1); }
  } else if (current === text) {
    console.log('spriteSymbols.js unchanged');
  } else {
    fs.writeFileSync(SPRITE_OUT, text);
    console.log(`wrote ${path.relative(ROOT, SPRITE_OUT)} (${text.length} bytes)`);
  }
}
