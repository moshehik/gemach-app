// בדיקות סטטיות של כרטיס ההזמנה החדש (app/components/order-card/**): הכרטיס הישן קפוא, ה-Switch, השורש, ואיסורים
// (PLAN §E.1 static + CHECKLIST S). חלות על כל הקבצים בתיקייה - גם על אלה שזרמים אחרים יוסיפו.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PROJ = process.env.PROJ;
const OC = path.join(PROJ, 'app/components/order-card');
const read = (p) => fs.readFileSync(p, 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
const FILES = walk(OC);
const JS = FILES.filter((f) => f.endsWith('.js'));
const CSS = FILES.filter((f) => f.endsWith('.css'));
const rel = (f) => path.relative(PROJ, f).replace(/\\/g, '/');
// הסרת הערות (לא בתוך מחרוזות - מספיק לקוד שלנו: אין "//" בתוך מחרוזות חוץ מ-URL עם http, שאין כאן)
const stripJsComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');
const CODE = Object.fromEntries(JS.map((f) => [rel(f), stripJsComments(read(f))]));
const grepAll = (re) => Object.entries(CODE).filter(([, s]) => re.test(s)).map(([f]) => f);

// ---------- הכרטיס הישן והמעבר ----------
const LEGACY_SHA256_LF = 'd9276912171eef1051a2ad7c705a355370e656292f1dded9aa5c4e1e4521dc17'; // = app/orders/[id]/page.js של main ב-32d00e0c (אחרי c4d6e619: isWeekdayEvent הוסר; 1215fb9b/8830bc63: פריטי ברקוד לא מלכלכים את הכרטיס, חיוב ידני)
test('LegacyOrderPage.js זהה מילולית לדף הקודם (קפוא, PLAN §D.1)', () => {
  const s = read(path.join(PROJ, 'app/orders/[id]/LegacyOrderPage.js')).replace(/\r\n/g, '\n');
  assert.equal(crypto.createHash('sha256').update(s).digest('hex'), LEGACY_SHA256_LF);
});

test('page.js דק → OrderCardSwitch; ה-Switch: legacy כברירת מחדל, a5 דרך dynamic בלי SSR, בלי data-ui-order-card', () => {
  const page = read(path.join(PROJ, 'app/orders/[id]/page.js'));
  assert.ok(/<OrderCardSwitch params=\{params\} \/>/.test(page));
  assert.ok(page.split('\n').length < 20, 'page.js נשאר עטיפה דקה');
  const sw = read(path.join(OC, 'OrderCardSwitch.js'));
  assert.ok(sw.includes("useUiVariant('order_card')"));
  assert.ok(/dynamic\(\(\) => import\('\.\/OrderCardA5'\), \{ ssr: false \}\)/.test(sw));
  assert.ok(/variant !== 'a5'\) return <VariantFrame screen="order_card" variant="legacy"><LegacyOrderPage params=\{params\} \/><\/VariantFrame>/.test(sw), 'הישן עטוף ב-VariantFrame (אייקון המעבר בפינה)');
  assert.ok(/<VariantFrame screen="order_card" variant="a5"><A5Route params=\{params\} \/><\/VariantFrame>/.test(sw));
  assert.ok(/<PageVariantToggle screen="order_card" placement="header" systemTip \/>/.test(read(path.join(OC, 'OcTopbar.js'))), 'האייקון "חזרה לתצוגה הישנה" בכותרת הכרטיס החדש');
  assert.ok(!/components\.css/.test(sw + page), 'ה-CSS של הפלטה נטען רק בתוך המודול הדינמי');
  assert.deepEqual(grepAll(/data-ui-order-card/), []);
});

test('שורש: .gm-ds.gm-oc.home-bg.dlg-dark עם dir=rtl; אין gm-home בקוד ובסלקטורים', () => {
  const a5 = read(path.join(OC, 'OrderCardA5.js'));
  assert.ok(a5.includes('className="gm-ds gm-oc home-bg dlg-dark" dir="rtl"'));
  assert.deepEqual(grepAll(/gm-home/), []);
  for (const f of CSS) assert.ok(!/\.gm-home/.test(read(f).replace(/\/\*[\s\S]*?\*\//g, '')), rel(f));
  for (const c of ['components.css', 'oc-base.css', 'oc-details.css', 'oc-items.css', 'oc-payments.css', 'oc-rail.css', 'oc-history.css', 'oc-docs.css']) assert.ok(a5.includes(c), `OrderCardA5 מייבא את ${c}`);
});

// ---------- איסורים ----------
test('אין window.customConfirm/customAuthPrompt/customPrompt/customThreeWayConfirm/alert/confirm/prompt (רק useOcUi)', () => {
  assert.deepEqual(grepAll(/\bwindow\.(customConfirm|customAuthPrompt|customPrompt|customThreeWayConfirm|alert|confirm|prompt)\b/), []);
  assert.deepEqual(grepAll(/(^|[^.\w])(alert|confirm|prompt)\s*\(/m), []);
});

test('אין title= על אלמנט DOM (טולטיפים ב-data-tip)', () => {
  assert.deepEqual(grepAll(/<[a-z][a-z0-9]*\b[^>]*\stitle=/), []);
});

test('אייקונים: רק sprite מוטמע #gmi- (לא /design-system/sprite.svg ולא #i-* של IconSprite הישן)', () => {
  assert.deepEqual(grepAll(/design-system\/sprite\.svg/), []);
  assert.deepEqual(grepAll(/href=["'{`]+#i-/), []);
  const names = read(path.join(PROJ, 'app/components/menu/spriteSymbols.js')).match(/\["([a-z0-9-]+)","0 0 24 24"/g).map((m) => m.slice(2, m.indexOf('"', 2)));
  const used = new Set();
  for (const s of Object.values(CODE)) for (const m of s.matchAll(/<OcIcon name="([a-z0-9-]+)"/g)) used.add(m[1]);
  for (const s of Object.values(CODE)) for (const m of s.matchAll(/\bicon: '([a-z0-9-]+)'/g)) used.add(m[1]);
  const missing = [...used].filter((n) => !names.includes(n));
  assert.deepEqual(missing, [], 'שמות אייקונים שלא קיימים ב-sprite: ' + missing.join(', '));
});

test('תאריכים עבריים בלבד: אין toLocaleDateString / toLocaleTimeString / Intl.DateTimeFormat בתצוגה', () => {
  assert.deepEqual(grepAll(/toLocaleDateString|toLocaleTimeString|Intl\.DateTimeFormat/), []);
});

test('A28: אין רכיבי מעטפת של הדגימה (snav/nbArea/siteFoot/demoBar/pv-)', () => {
  assert.deepEqual(grepAll(/\b(snav|nbArea|siteFoot|demoBar|demoTog)\b|["' ]pv-[a-z]/), []);
});

test('הסרות מתוך §B שלא יחזרו בטעות (R17, R30, R31, A14, A27, R23)', () => {
  assert.deepEqual(grepAll(/order_date_edit_approval/), [], 'R17');
  assert.deepEqual(grepAll(/\/dashboard\/dresses\//), [], 'R30');
  assert.deepEqual(grepAll(/unpaid_action_items_tab/), [], 'R31');
  assert.deepEqual(grepAll(/creditile|CreditWindowTile/), [], 'A14/AMB-15');
  assert.deepEqual(grepAll(/לפי הגדרות הגמ״ח|לפי הגדרות הגמ"ח/), [], 'A27');
  assert.deepEqual(grepAll(/ס״מ|ס"מ/), [], 'R23/A27');
});

test('כל fetch מתוך רשימת ה-endpoints המותרת של הכרטיס', () => {
  const ALLOWED = [
    /^`\/api\/orders\/\$\{[^}]+\}`$/, /^'\/api\/orders\/validate-inventory'$/, /^`\/api\/orders\/\$\{[^}]+\}\/preview-pricing`$/,
    /^`\/api\/orders\/\$\{[^}]+\}\/cancel-changes`$/, /^`\/api\/inventory\/preload\?\$\{queryParams\.toString\(\)\}`$/, /^'\/api\/auth\/verify-pin'$/, /^ORDER_EVENTS_URL$/,
    /^`\/api\/orders\/\$\{[^}]+\}\/(items|email|history|journal|prep-mark|employees)[^`]*`$/, /^'\/api\/(payments|nedarim|refunds|rentals\/[a-z-]+|returns\/report-issue|admin\/recalculations|pdf|customers|orders\/events)'$/,
    /^`\/api\/(refunds|customers|orders\/[^`]+\/items|audit\/order-item|inventory\/(capacity|models|sizes)|orders\/availability|schedule\/(marks|print))[^`]*`$/, // W7: schedule\/print = בדיקת הרשאות להדפסת דפי לו״ז (format=access) מ-parts/OcPrintMenu.js
    // W2b (R49): בורר ההצטרפות למשלוח + באנר מיקום שמלה (שניהם כבויים בהגדרות / הטבלה חסרה = תשובה ריקה)
    /^`\/api\/(deliveries\/join|orders\/dress-location-alerts)[^`]*`$/,
  ];
  const bad = [];
  for (const [f, s] of Object.entries(CODE)) {
    for (const m of s.matchAll(/\bf(?:etch)?\(\s*(`[^`]*`|'[^']*'|[A-Za-z_.]+)/g)) {
      const arg = m[1].trim();
      if (/^\.\.\.a$|^url$|^\.\.\./.test(arg)) continue; // עטיפות (fetch(...a)) - הקריאות עצמן נבדקות במקום שבו הן נכתבות
      if (!/^['`]|^ORDER_EVENTS_URL$/.test(arg)) continue;
      if (!ALLOWED.some((re) => re.test(arg))) bad.push(`${f}: ${arg}`);
    }
    for (const m of s.matchAll(/fetchSharedJson\(\s*'([^']+)'/g)) if (!['/api/settings', '/api/employees', '/api/me'].includes(m[1])) bad.push(`${f}: fetchSharedJson ${m[1]}`);
  }
  assert.deepEqual(bad, []);
});

test('logEvent: כל פעולה שנשלחת קיימת ב-ORDER_EVENT_ACTIONS (ocEvents.js), ואין MANAGER_APPROVAL מהלקוח', () => {
  const ev = CODE['app/components/order-card/ocEvents.js'];
  const allowed = [...ev.match(/ORDER_EVENT_ACTIONS = Object\.freeze\(\[([^\]]+)\]/)[1].matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
  assert.ok(!allowed.includes('MANAGER_APPROVAL'));
  const bad = [];
  for (const [f, s] of Object.entries(CODE)) for (const m of s.matchAll(/logEvent\(\s*'([A-Z_]+)'/g)) if (!allowed.includes(m[1])) bad.push(`${f}: ${m[1]}`);
  assert.deepEqual(bad, []);
  assert.deepEqual(grepAll(/action:\s*'MANAGER_APPROVAL'/), []);
  // חוזה W0 §1.5: /print/order רושם ORDER_PRINTED בעצמו - הכרטיס לא רושם הדפסה שוב
  assert.deepEqual(grepAll(/logEvent\(\s*'ORDER_PRINTED'/), []);
});

test('קוד אישור המנהל לא נרשם: אין console.* עם pin, אין localStorage/sessionStorage בחלון האישור', () => {
  assert.deepEqual(grepAll(/console\.[a-z]+\([^)]*\bpin\b/i), []);
  assert.ok(!/localStorage|sessionStorage/.test(CODE['app/components/order-card/OcApproval.js']));
});

// ---------- CSS ----------
function parseCss(src) {
  const text = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  const readBlock = (media) => {
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length || text[i] === '}') { i++; return; }
      const start = i;
      let dp = 0;
      while (i < text.length && (text[i] !== '{' || dp) && text[i] !== ';') { if (text[i] === '(') dp++; else if (text[i] === ')') dp--; i++; }
      if (text[i] === ';') { i++; continue; }
      const head = text.slice(start, i).trim();
      i++;
      if (/^@(media|supports|layer|container)/.test(head)) { readBlock(head); continue; }
      let depth = 1; const b = i;
      while (i < text.length && depth) { if (text[i] === '{') depth++; else if (text[i] === '}') depth--; i++; }
      if (!/^@/.test(head)) rules.push({ sel: head.replace(/\s+/g, ' '), body: text.slice(b, i - 1), media: media || '' });
    }
  };
  readBlock('');
  return rules;
}
const splitSel = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(' || ch === '[') d++; else if (ch === ')' || ch === ']') d--; if (ch === ',' && !d) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
const decls = (body) => body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(':'); return k < 0 ? null : { prop: d.slice(0, k).trim().toLowerCase(), value: d.slice(k + 1).trim() }; }).filter(Boolean);
const OUT_OF_SCOPE_OK = new Set(['.app-shell .main .content:has(> .gm-ds.gm-oc)']);

test('CSS: כל כלל בכל oc-*.css בהיקף .gm-ds.gm-oc (חוץ מביטול ריפוד המעטפת)', () => {
  const bad = [];
  for (const f of CSS) for (const r of parseCss(read(f))) for (const s of splitSel(r.sel)) if (!/^\.gm-ds\.gm-oc(?=[\s.:#[>]|$)/.test(s) && !OUT_OF_SCOPE_OK.has(s)) bad.push(`${rel(f)}: ${s}`);
  assert.deepEqual(bad, []);
});

test('CSS: אין @media שמוגדר לפני הכלל הלא-מותנה של אותו selector', () => {
  const bad = [];
  for (const f of CSS) {
    const rules = parseCss(read(f));
    rules.forEach((r, idx) => {
      if (!r.media) return;
      const props = new Set(decls(r.body).map((d) => d.prop));
      for (let j = idx + 1; j < rules.length; j++) {
        const o = rules[j];
        if (o.media || o.sel !== r.sel) continue;
        if (decls(o.body).some((d) => props.has(d.prop) && !/!important/.test(d.value))) bad.push(`${rel(f)}: ${r.sel}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});

test('CSS: אין "-*/" או ":root/html/body" (הערה שנסגרת באמצע שוברת next build; אין סלקטורים גלובליים)', () => {
  for (const f of CSS) {
    const s = read(f);
    assert.ok(!/[a-z0-9]-\*\//i.test(s), `${rel(f)}: "-*/"`);
    const noComments = s.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/(^|[},\s])(:root|html|body)\b/.test(noComments), `${rel(f)}: סלקטור גלובלי`);
  }
});

test('CSS: נטרולי הדליפה של §D.2 קיימים ב-oc-base.css', () => {
  const rules = parseCss(read(path.join(OC, 'css/oc-base.css')));
  const has = (selRe, propRe, valRe) => rules.some((r) => selRe.test(r.sel) && decls(r.body).some((d) => propRe.test(d.prop) && (!valRe || valRe.test(d.value))));
  assert.ok(has(/:is\(button,input,select,textarea\)/, /^font-family$/, /!important/), 'גופן לחצנים/שדות');
  assert.ok(has(/:is\(h1,h2,h3,h4,h5,h6\)/, /^font-family$/, /!important/), 'גופן כותרות');
  assert.ok(has(/\.ttl h1/, /^color$/), 'h1 color');
  assert.ok(has(/\.field$/, /^margin-bottom$/), '.field margin');
  assert.ok(has(/\.back$/, /^padding$/), 'padding לחצן חזרה');
  assert.ok(has(/\.sw input/, /^background$/), 'רקע input של מתג');
  assert.ok(has(/div:has\(> table\)/, /^max-height$/), 'div:has(>table)');
  assert.ok(has(/thead tr th/, /^background-color$/, /!important/), 'כותרת טבלה');
  assert.ok(has(/\.card/, /^background$/, /linear-gradient\(135deg,rgba\(255,252,247/), 'פנינה במקום זכוכית');
  assert.ok(has(/#sbar/, /^display$/, /!important/), 'R42: .sbar גלוי');
  assert.ok(has(/#stepper/, /^display$/, /none!important/), 'A5: סטפר מוסתר');
  assert.ok(has(/\.oc-appr-sel$/, /^min-height$/), 'D12/D7: בורר המאשר (רשימה נגללת נפתחת)');
});

test('סקירה 4: החץ ולחצני השמירה של הרייל מנוטרלים בזמן שמירה (oc.saving)', () => {
  const top = read(path.join(OC, 'OcTopbar.js'));
  assert.ok(/className="back"[^>]*disabled=\{oc\.saving\}/.test(top));
  const rail = read(path.join(OC, 'OcDefaultParts.js'));
  assert.ok((rail.match(/data-act="save" disabled=\{busy\}/g) || []).length === 3);
  assert.ok(/const busy = !!oc\.saving;/.test(rail));
});
