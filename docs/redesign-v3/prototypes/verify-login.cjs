// בדיקת archetype-login.html בדפדפן headless (Playwright + Chromium). לא חלק מהאפליקציה.
// הרצה: NODE_PATH=<תיקייה עם playwright> node docs/redesign-v3/prototypes/verify-login.cjs
// פלט: screenshots/login/*.png + login-verify-results.json (באותה תיקייה)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const FILE = 'file://' + path.join(DIR, 'archetype-login.html');
const OUT = path.join(DIR, 'screenshots', 'login');
fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [[360, 780], [768, 1024], [1024, 768], [1440, 900]];
const STATES = ['who', 'who-typing', 'who-none', 'who-loading', 'who-failed', 'who-empty',
  'code', 'code-typing', 'code-pin', 'code-invalid', 'code-wrong', 'code-fallback', 'code-inactive',
  'code-server', 'code-network', 'code-loading', 'done', 'forgot', 'forgot-sent', 'forgot-nomail',
  'reset', 'reset-mismatch', 'modal-who', 'modal-code'];
const LAPTOPS = [[1440, 900], [1366, 768], [1280, 720], [1024, 768]];
const ALLOWED_BP = new Set([480, 640, 768, 1024, 1440, 1920].flatMap(n => [n, n - 1, n + 1]));

// Google Fonts: headless Chromium here doesn't trust the egress proxy's CA, so when FONT_DIR is set
// (a folder with rubik.css + map.txt "<gstatic url> <local file>") requests are served from that copy.
const FONT_DIR = process.env.FONT_DIR;
async function withFonts(ctx) {
  if (!FONT_DIR) return;
  const cssTxt = fs.readFileSync(path.join(FONT_DIR, 'rubik.css'), 'utf8');
  const map = Object.fromEntries(fs.readFileSync(path.join(FONT_DIR, 'map.txt'), 'utf8').trim().split('\n').map(l => l.split(' ')));
  await ctx.route('https://fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: cssTxt, headers: { 'access-control-allow-origin': '*' } }));
  await ctx.route('https://fonts.gstatic.com/**', r => { const f = map[r.request().url()]; return f ? r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(path.isAbsolute(f) ? f : path.join(FONT_DIR, '..', f)), headers: { 'access-control-allow-origin': '*' } }) : r.fulfill({ status: 404, body: '' }); });
}
function lum([r, g, b]) { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); }
function ratio(a, b) { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }

(async () => {
  const results = { static: {}, pages: [], laptops: [], contrast: [], flows: [], console: [] };

  // ---------- static checks on the source ----------
  const src = fs.readFileSync(path.join(DIR, 'archetype-login.html'), 'utf8');
  const css = (src.match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  const mq = [...css.matchAll(/@media[^{]*\((?:max|min)-width:\s*(\d+)px\)/g)].map(m => +m[1]);
  results.static.breakpoints = { used: [...new Set(mq)], bad: mq.filter(n => !ALLOWED_BP.has(n)) };
  results.static.heightQueries = (css.match(/(max|min)-height:\s*\d+px\)/g) || []);
  results.static.physical = (css.match(/(?:^|[;{\s])(left|right|top|bottom|margin-(?:left|right|top|bottom)|padding-(?:left|right|top|bottom)|border-(?:left|right|top|bottom)(?:-[a-z]+)?)\s*:/g) || [])
    .concat(css.match(/text-align:\s*(left|right)|float:\s*(left|right)|transform-origin:[^;]*(left|right)/g) || []);
  const js = (src.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
  results.static.physicalJs = (js.match(/style\.(left|right|top|bottom)\b/g) || []);
  results.static.dialogsApi = (js.match(/\b(alert|confirm|prompt)\s*\(/g) || []);
  results.static.externals = [...src.matchAll(/(?:href|src)="(https?:[^"]+)"/g)].map(m => m[1]);
  results.static.chipClass = (src.match(/class="[^"]*\bchip\b/g) || []).length;

  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium' });

  // ---------- screenshots + overflow for each width x state ----------
  for (const [w, h] of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await withFonts(ctx); const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') results.console.push(`${w} ${m.text()}`); });
    page.on('pageerror', e => results.console.push(`${w} pageerror ${e.message}`));
    for (const st of STATES) {
      await page.goto(`${FILE}#state=${st}&demo=0`);
      await page.evaluate(() => document.fonts && document.fonts.ready);
      await page.waitForTimeout(150);
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
        sh: document.documentElement.scrollHeight, ch: window.innerHeight,
        bodyBg: getComputedStyle(document.documentElement).backgroundColor,
      }));
      const file = `${w}-${st}.png`;
      await page.screenshot({ path: path.join(OUT, file) });
      results.pages.push({ w, h, st, hOverflow: m.sw > m.cw, vScroll: m.sh > m.ch, file });
    }
    await ctx.close();
  }

  // ---------- no scroll on laptops ----------
  for (const [w, h] of LAPTOPS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
    await withFonts(ctx); const page = await ctx.newPage();
    for (const st of ['who', 'code', 'code-pin', 'code-fallback', 'forgot-nomail', 'reset-mismatch', 'done']) {
      await page.goto(`${FILE}#state=${st}&demo=0&emps=120`);
      await page.waitForTimeout(120);
      const m = await page.evaluate(() => ({ sh: document.documentElement.scrollHeight, ch: window.innerHeight, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      results.laptops.push({ w, h, st, vScroll: m.sh > m.ch, hOverflow: m.sw > m.cw, sh: m.sh });
    }
    await ctx.close();
  }

  // ---------- contrast (text vs effective background, worst gradient stop) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await withFonts(ctx); const page = await ctx.newPage();
    for (const st of ['who', 'who-failed', 'code-pin', 'code-wrong', 'forgot-sent', 'modal-code', 'done']) {
      await page.goto(`${FILE}#state=${st}&demo=0&org=b`);
      await page.waitForTimeout(120);
      const rows = await page.evaluate(() => {
        const rgb = s => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 4).map(Number);
        const stops = s => (s.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi) || []).map(c => c.startsWith('#') ? [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)) : rgb(c));
        const out = [];
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        const seen = new Set();
        while (walker.nextNode()) {
          const n = walker.currentNode; if (!n.textContent.trim()) continue;
          const el = n.parentElement; if (seen.has(el)) continue; seen.add(el);
          if (el.closest('#dm,.dm-fab,#tt,[aria-hidden="true"],.sr-only,[hidden]')) continue;
          const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
          const cs = getComputedStyle(el); const fg = rgb(cs.color);
          let bgs = null, e = el;
          while (e) { const c = getComputedStyle(e); const bi = c.backgroundImage;
            if (bi && bi !== 'none' && /gradient/.test(bi) && e !== document.documentElement) { bgs = stops(bi).map(s => s.slice(0, 3)); break; }
            const b = rgb(c.backgroundColor); if (b.length === 3 || (b.length === 4 && b[3] > 0.5)) { bgs = [b.slice(0, 3)]; break; }
            e = e.parentElement; }
          if (!bgs) bgs = [[220, 237, 250]];
          out.push({ text: n.textContent.trim().slice(0, 30), fg: fg.slice(0, 3), bgs, size: parseFloat(cs.fontSize), weight: +cs.fontWeight });
        }
        return out;
      });
      for (const r of rows) {
        const worst = Math.min(...r.bgs.map(b => ratio(r.fg, b)));
        const large = r.size >= 24 || (r.size >= 18.66 && r.weight >= 700);
        const need = large ? 3 : 4.5;
        results.contrast.push({ st, text: r.text, ratio: +worst.toFixed(2), need, pass: worst >= need });
      }
    }
    await ctx.close();
  }

  // ---------- keyboard / behaviour flows ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await withFonts(ctx); const page = await ctx.newPage();
    const flow = async (name, fn) => { try { const r = await fn(); results.flows.push({ name, pass: !!r.pass, detail: r.detail }); } catch (e) { results.flows.push({ name, pass: false, detail: e.message }); } };
    const step = () => page.evaluate(() => document.querySelector('.step .h1')?.id || (document.querySelector('.done') ? 'done' : '?'));

    await flow('focus lands in search on load; typing filters; ArrowDown+Enter selects → code step, focus in password', async () => {
      await page.goto(`${FILE}#state=who&demo=0`); await page.waitForTimeout(150);
      const f1 = await page.evaluate(() => document.activeElement.id);
      await page.keyboard.type('ל'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter'); await page.waitForTimeout(100);
      const f2 = await page.evaluate(() => document.activeElement.id);
      return { pass: f1 === 'login-employee' && (await step()) === 'h-code' && f2 === 'login-password', detail: { f1, f2 } };
    });
    await flow('Enter on empty password → client validation, no network, aria-invalid', async () => {
      await page.keyboard.press('Enter'); await page.waitForTimeout(80);
      const r = await page.evaluate(() => ({ t: document.querySelector('#loginErrT').textContent, inv: document.querySelector('#login-password').getAttribute('aria-invalid'), busy: document.querySelector('#go').getAttribute('aria-busy') }));
      return { pass: r.t === 'צריך סיסמה כדי להמשיך' && r.inv === 'true' && !r.busy, detail: r };
    });
    await flow('wrong password (server 401) → server message verbatim, button re-enabled', async () => {
      await page.evaluate(() => { const s = document.querySelector('#dmServer'); s.value = 'wrong'; s.dispatchEvent(new Event('change')); { const c = document.querySelector('#dmSlow'); c.checked = false; c.dispatchEvent(new Event('change')); } });
      await page.fill('#login-password', 'abc'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({ t: document.querySelector('#loginErrT').textContent, busy: document.querySelector('#go').getAttribute('aria-busy') }));
      return { pass: r.t === 'סיסמא שגויה' && !r.busy, detail: r };
    });
    await flow('eye toggles type + aria-pressed, keeps value', async () => {
      await page.click('#eye'); await page.waitForTimeout(50);
      const r = await page.evaluate(() => ({ type: document.querySelector('#login-password').type, v: document.querySelector('#login-password').value, p: document.querySelector('#eye').getAttribute('aria-pressed') }));
      return { pass: r.type === 'text' && r.v === 'abc' && r.p === 'true', detail: r };
    });
    await flow('success → done step', async () => {
      await page.evaluate(() => { const s = document.querySelector('#dmServer'); s.value = 'ok'; s.dispatchEvent(new Event('change')); });
      await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      return { pass: (await step()) === 'done', detail: await step() };
    });
    await flow('trusted PIN: maxlength 4, slots fill, requireFullPassword falls back to full password', async () => {
      await page.goto(`${FILE}#state=code-pin&demo=0`); await page.waitForTimeout(120);
      await page.evaluate(() => { { const c = document.querySelector('#dmSlow'); c.checked = false; c.dispatchEvent(new Event('change')); } const s = document.querySelector('#dmServer'); s.value = 'noPin'; s.dispatchEvent(new Event('change')); });
      await page.fill('#login-password', ''); await page.type('#login-password', '123456');
      const v = await page.evaluate(() => ({ v: document.querySelector('#login-password').value, on: document.querySelectorAll('.slots i.on').length }));
      await page.keyboard.press('Enter'); await page.waitForTimeout(250);
      const r = await page.evaluate(() => ({ pin: !!document.querySelector('.inp.pin'), t: document.querySelector('#loginErrT').textContent }));
      return { pass: v.v === '1234' && v.on === 4 && !r.pin && r.t.startsWith('לעובד זה טרם הוגדר'), detail: { v, r } };
    });
    await flow('forgot → server "no email" message; back returns to code', async () => {
      await page.evaluate(() => { const s = document.querySelector('#dmForgot'); s.value = 'noMail'; s.dispatchEvent(new Event('change')); });
      await page.click('#forgotBtn'); await page.click('#fSend'); await page.waitForTimeout(200);
      const t = await page.evaluate(() => document.querySelector('.step .msg span').textContent);
      await page.click('#fBack'); await page.waitForTimeout(50);
      return { pass: t.startsWith('לא קיימת כתובת מייל') && (await step()) === 'h-code', detail: t };
    });
    await flow('reset: mismatch blocked; cannot go back', async () => {
      await page.goto(`${FILE}#state=reset&demo=0`); await page.waitForTimeout(100);
      await page.fill('#login-newpass1', 'abcd'); await page.fill('#login-newpass2', 'abce'); await page.keyboard.press('Enter'); await page.waitForTimeout(60);
      const r = await page.evaluate(() => ({ t: document.querySelector('#resetErr span').textContent, back: !!document.querySelector('#fBack,#notMe,.x') }));
      return { pass: r.t === 'שתי הסיסמאות לא זהות' && !r.back, detail: r };
    });
    await flow('autofill attributes: default = today (new-password, no username); pm=1 → username + current-password', async () => {
      await page.goto(`${FILE}#state=code&demo=0`); await page.waitForTimeout(80);
      const a = await page.evaluate(() => ({ ac: document.querySelector('#login-password').autocomplete, u: !!document.querySelector('[autocomplete=username]'), formOff: document.querySelector('#fLogin').getAttribute('autocomplete') }));
      await page.goto(`${FILE}#state=code&demo=0&pm=1`); await page.reload(); await page.waitForTimeout(80);
      const b = await page.evaluate(() => { const u = document.querySelector('[autocomplete=username]'); return { ac: document.querySelector('#login-password').autocomplete, u: !!u, uDisplay: u && getComputedStyle(u).display, formOff: document.querySelector('#fLogin').getAttribute('autocomplete') }; });
      await page.goto(`${FILE}#state=who&demo=0`); await page.reload(); await page.waitForTimeout(80);
      const s = await page.evaluate(() => { const i = document.querySelector('#login-employee'); return { ac: i.autocomplete, name: i.name }; });
      return { pass: a.ac === 'new-password' && !a.u && a.formOff === 'off' && b.ac === 'current-password' && b.u && b.uDisplay !== 'none' && !b.formOff && s.ac === 'new-password' && /^no-autofill-/.test(s.name), detail: { a, b, s } };
    });
    await flow('modal: X closes; Esc closes when nothing typed', async () => {
      await page.goto(`${FILE}#state=modal-who&demo=0`); await page.reload(); await page.waitForTimeout(100);
      const has1 = await page.evaluate(() => !!document.querySelector('.dlg'));
      await page.keyboard.press('Escape'); await page.waitForTimeout(60);
      const has2 = await page.evaluate(() => !!document.querySelector('.dlg'));
      return { pass: has1 && !has2, detail: { has1, has2 } };
    });
    await flow('tooltip: focus on ⓘ shows role=tooltip, Esc hides', async () => {
      await page.goto(`${FILE}#state=code-pin&demo=0`); await page.reload(); await page.waitForTimeout(100);
      await page.focus('.note .tip'); await page.waitForTimeout(50);
      const on = await page.evaluate(() => document.querySelector('#tt').classList.contains('on') && document.querySelector('.note .tip').getAttribute('aria-describedby') === 'tt');
      await page.keyboard.press('Escape');
      const off = await page.evaluate(() => !document.querySelector('#tt').classList.contains('on'));
      return { pass: on && off, detail: { on, off } };
    });
    await flow('focus ring visible on primary button (outline ≥ 3px)', async () => {
      await page.focus('#login-password'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
      const r = await page.evaluate(() => { const a = document.activeElement; const c = getComputedStyle(a); return { id: a.id, cls: a.className, outline: c.outlineWidth + ' ' + c.outlineStyle }; });
      return { pass: parseFloat(r.outline) >= 3 && !/none/.test(r.outline), detail: r };
    });
    await ctx.close();
  }
  // reduced-motion screenshot (animations off → content fully visible)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    await withFonts(ctx); await withFonts(ctx); const page = await ctx.newPage(); await page.goto(`${FILE}#state=done&demo=0`); await page.waitForTimeout(50);
    results.reducedMotionDoneOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('.done .ring')).opacity);
    await page.waitForTimeout(100);
    results.reducedMotionCheckDashOffset = await page.evaluate(() => getComputedStyle(document.querySelector('.done .ring path')).strokeDashoffset);
    await ctx.close();
  }
  await browser.close();

  const s = results;
  s.summary = {
    screenshots: s.pages.length,
    hOverflow: s.pages.filter(p => p.hOverflow).map(p => `${p.w}-${p.st}`),
    laptopVScroll: s.laptops.filter(p => p.vScroll).map(p => `${p.w}x${p.h}-${p.st}(${p.sh})`),
    contrastFail: s.contrast.filter(c => !c.pass),
    flowsFail: s.flows.filter(f => !f.pass).map(f => f.name),
    flowsPass: s.flows.filter(f => f.pass).length + '/' + s.flows.length,
    console: s.console,
  };
  fs.writeFileSync(path.join(OUT, 'login-verify-results.json'), JSON.stringify(s, null, 1));
  console.log(JSON.stringify({ static: s.static, summary: s.summary, rm: s.reducedMotionDoneOpacity, rmCheck: s.reducedMotionCheckDashOffset }, null, 1));
})();
