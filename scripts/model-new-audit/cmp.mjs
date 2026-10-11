// השוואת נאמנות: אשף "דגם חדש" (A5) מול העיצוב המאושר (scratch/emp-models-build -> http://localhost:8902/עובדים-ודגמים/model-new.html).
// Chrome headless (puppeteer-core), שני העמודים באותו viewport, אותה סדרת פעולות; לכל מצב נמדדים כל האלמנטים בתוך .app (+ חלון פתוח + טוסט):
// מיקום / גודל יחסי ל-.app וסגנון מחושב (גופן, צבע, רקע, גבול, רדיוס, ריפוד, gap). מדווח הבדלים > 1px או כל הבדל צבע / גופן.
// הרצה: node scripts/model-new-audit/cmp.mjs [width=1440] [height=900]   (שרת הפיתוח http://localhost:3071, העיצוב על 8902; ההתחברות דרך agent-login - הסוד נקרא מ-.env.local ולא מודפס)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const W = Number(process.argv[2] || 1440); const H = Number(process.argv[3] || 900);
const MOCK = 'http://localhost:8902/' + encodeURIComponent('עובדים-ודגמים') + '/model-new.html';
const REAL = process.env.REAL_URL || 'http://localhost:3071/dashboard/dresses/new';
const envTxt = fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8');
const SECRET = (envTxt.match(/^AGENT_LOGIN_SECRET=(.*)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FREEZE = '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}';
const PROPS = ['display', 'fontSize', 'fontWeight', 'color', 'backgroundColor', 'borderTopWidth', 'borderTopColor', 'borderRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'gap', 'opacity', 'textAlign', 'lineHeight'];

async function dump(page) {
  return page.evaluate((PROPS) => {
    const app = document.querySelector('.app'); const o = app.getBoundingClientRect();
    const roots = [app, ...document.querySelectorAll('.scrim.on, #toast.on')];
    const out = [];
    const walk = (el, base, rootKey) => {
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') return;
      const r = el.getBoundingClientRect();
      const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter((c) => c && !/^ia-|^enter$|^bump$|^on$/.test(c)).sort().join('.');
      const key = rootKey + '>' + el.tagName.toLowerCase() + (cls ? '.' + cls : '');
      const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim().slice(0, 40);
      const st = {}; for (const p of PROPS) st[p] = cs[p];
      out.push({ key, x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height), text: own, st, id: el.id || '' });
      for (const c of el.children) walk(c, base, rootKey);
    };
    roots.forEach((rt, i) => walk(rt, i === 0 ? o : rt.getBoundingClientRect(), i === 0 ? 'app' : 'ovl'));
    return out;
  }, PROPS);
}

function lcs(a, b) { // יישור לפי key
  const n = a.length, m = b.length; const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i].key === b[j].key ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = []; const onlyA = []; const onlyB = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i].key === b[j].key) { pairs.push([a[i], b[j]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) onlyA.push(a[i++]); else onlyB.push(b[j++]); }
  while (i < n) onlyA.push(a[i++]);
  while (j < m) onlyB.push(b[j++]);
  return { pairs, onlyA, onlyB };
}

function compare(name, mock, real, tol = 1) {
  const { pairs, onlyA, onlyB } = lcs(mock, real);
  const diffs = [];
  for (const [a, b] of pairs) {
    const d = [];
    if (Math.abs(a.w - b.w) > tol) d.push(`w ${a.w}/${b.w}`);
    if (Math.abs(a.h - b.h) > tol) d.push(`h ${a.h}/${b.h}`);
    if (Math.abs(a.x - b.x) > tol + 1) d.push(`x ${a.x}/${b.x}`);
    if (Math.abs(a.y - b.y) > tol + 1) d.push(`y ${a.y}/${b.y}`);
    for (const p of PROPS) if (a.st[p] !== b.st[p] && !(p === 'textAlign' && /^(start|right)$/.test(a.st[p]) && /^(start|right)$/.test(b.st[p]))) d.push(`${p} ${a.st[p]}/${b.st[p]}`);
    if (a.text !== b.text) d.push(`text "${a.text}"/"${b.text}"`);
    if (d.length) diffs.push(`${a.key}${a.id ? '#' + a.id : ''}: ${d.join('; ')}`);
  }
  console.log(`\n=== ${name}: ${mock.length}/${real.length} elements, ${pairs.length} aligned, ${diffs.length} differing, mock-only ${onlyA.length}, real-only ${onlyB.length}`);
  diffs.slice(0, 40).forEach((x) => console.log('  ~', x));
  onlyA.slice(0, 15).forEach((x) => console.log('  mock-only', x.key, JSON.stringify(x.text)));
  onlyB.slice(0, 15).forEach((x) => console.log('  real-only', x.key, JSON.stringify(x.text)));
  return diffs.length + onlyA.length + onlyB.length;
}

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, args: ['--no-sandbox'] });
const mk = async (url, login) => {
  const p = await browser.newPage(); await p.setViewport({ width: W, height: H });
  if (login) { await p.goto(`http://localhost:3071/api/dev/agent-login?secret=${SECRET}`, { waitUntil: 'load' }).catch(() => {}); }
  await p.goto(url, { waitUntil: 'load', timeout: 90000 });
  await p.addStyleTag({ content: FREEZE });
  await sleep(1500);
  return p;
};
const mock = await mk(MOCK, false);
const real = await mk(REAL, true);
await real.waitForSelector('.gm-mn .hero-q', { timeout: 60000 });
await real.addStyleTag({ content: FREEZE });

const LOG = (m) => console.log('[step] ' + m);
const both = async (fn) => { await mock.bringToFront(); await fn(mock); await real.bringToFront(); await fn(real); await sleep(350); };
const typeIn = (sel, text) => both(async (p) => { await p.focus(sel); await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace'); if (text) await p.type(sel, text, { delay: 5 }); });
const click = (sel) => both(async (p) => { await p.click(sel); });
const clickJs = (sel) => both(async (p) => { await p.$eval(sel, (e) => e.click()); });
let total = 0;
const snap = async (name) => { await mock.bringToFront(); await mock.evaluate(() => window.scrollTo(0, 0)); await real.bringToFront(); await real.evaluate(() => window.scrollTo(0, 0)); await sleep(300); await mock.bringToFront(); const a = await dump(mock); await real.bringToFront(); const b = await dump(real); total += compare(name, a, b); };
const shot = async (name) => { await mock.bringToFront(); await sleep(150); const d = path.join(ROOT, '..', 'model-new-shots'); fs.mkdirSync(d, { recursive: true }); await mock.screenshot({ path: path.join(d, `${name}-mock.png`), fullPage: true }); await real.bringToFront(); await sleep(150); await real.screenshot({ path: path.join(d, `${name}-real.png`), fullPage: true }); };

await typeIn('#mnCode', '901');
await snap('01 step1 code only'); await shot('01');
await typeIn('#mnName', 'רומנטיקה');
await clickJs('#mnCatT'); await snap('02 step1 category open'); await shot('02');
await clickJs('.cb-o'); await snap('03 step1 filled');
await typeIn('#mnCode', '12'); await typeIn('#mnName', ''); await clickJs('#mnEntry');
await snap('04 step1 errors'); await shot('04');
await typeIn('#mnCode', '901'); await typeIn('#mnName', 'רומנטיקה');
await clickJs('#navTop [data-act=next]'); await snap('05 step2'); await shot('05');
await typeIn('#mnNotes', 'הערה לדוגמה'); await clickJs('#mnInsp button'); await snap('06 step2 notes+inspect'); await shot('06');
await clickJs('#navTop [data-act=next]'); await snap('07 step3 empty'); await shot('07');
await typeIn('#mnSize', '38');
await clickJs('[data-act=add-item]'); await snap('08 step3 one item'); await shot('08');
await typeIn('#mnSize', '300'); await clickJs('[data-act=add-item]'); await snap('09 step3 add error'); await shot('09');
await typeIn('#mnSize', '40'); await clickJs('[data-act=add-item]');
await clickJs('#navTop [data-act=next]'); await snap('10 step4 with items'); await shot('10');
await clickJs('#navTop [data-act=prev]'); await clickJs('#stepCard [data-rm]'); await clickJs('#stepCard [data-rm]');
await clickJs('#navTop [data-act=next]'); await snap('11 step4 no items'); await shot('11');
await clickJs('#navTop [data-act=exit]'); await snap('12 exit dialog'); await shot('12');
await clickJs('#dlg [data-act=close]');
await clickJs('[data-go-step="1"]'); await clickJs('[data-act=date-entry]'); await snap('13 date dialog'); await shot('13');
await clickJs('#dlg [data-act=close]');
await clickJs('[data-act=discard]'); await snap('14 discard dialog'); await shot('14');
await clickJs('#dlg [data-act=close]');
await clickJs('#pbars .pb[data-go="2"]'); await clickJs('[data-act=img-url]'); await snap('15 url dialog'); await shot('15');
await typeIn('#mnUrl', '/images/dresses/901.jpg'); await clickJs('#dlg [data-act=url-ok]'); await sleep(500); await snap('16 step2 image linked'); await shot('16');
await clickJs('#pbars .pb[data-go="1"]'); await typeIn('#mnName', ''); await clickJs('.gl.items-c'); await sleep(200); await snap('17 warn toast'); await shot('17');
await clickJs('.cart-t'); await snap('18 rail toggled'); await shot('18');
console.log(`\nTOTAL differences: ${total}`);
await browser.close();
