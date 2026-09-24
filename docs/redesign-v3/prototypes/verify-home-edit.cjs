// Home-edit verification (owner request 2026-09-25): node docs/redesign-v3/prototypes/verify-home-edit.cjs [before.json]
// Env: PW=<path to playwright(-core)>, CHROME=<chrome executable>. Writes screenshots to screenshots/home-edit/ and prints JSON.
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PW || 'playwright-core');
const exe = process.env.CHROME || 'C:/Users/moshe/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe';
const FILE = 'file:///' + path.join(__dirname, 'archetype-dashboard.html').split(path.sep).join('/');
const OUT = path.join(__dirname, 'screenshots', 'home-edit'); fs.mkdirSync(OUT, { recursive: true });
const before = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null;
const sel = (p, id, v) => p.evaluate(([id, v]) => { const s = document.querySelector(id); s.value = v; s.dispatchEvent(new Event('change')); }, [id, v]);
const STATES = { start: async p => {}, results: async p => { await p.fill('#sq', 'כהן'); await p.click('#sForm [type=submit]'); await p.waitForTimeout(1100); },
  ai: async p => { await p.click('[data-mode=ai]'); await p.click('#sForm [type=submit]'); await p.waitForTimeout(1100); },
  error: async p => sel(p, '#dHome', 'error'), none: async p => sel(p, '#dHome', 'none'),
  org2: async p => { await sel(p, '#dProfile', 'org2'); await sel(p, '#dHome', 'start'); }, branch: async p => { await sel(p, '#dRole', '1'); await sel(p, '#dHome', 'start'); } };
const probe = () => {
  const rgb = c => (c.match(/[\d.]+/g) || []).map(Number);
  const hue = ([r, g, b]) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l }; };
  const out = { salmon: [], filled: 0, alignBad: [], linkBad: [], bgNoTransition: [] };
  document.querySelectorAll('body *').forEach(el => {
    const cs = getComputedStyle(el); const bg = rgb(cs.backgroundColor); if (bg.length < 3 || (bg[3] === 0)) return;
    const r = el.getBoundingClientRect(); if (!r.width || cs.visibility === 'hidden' || el.closest('svg')) return;
    const H = hue(bg); if (H.s > .5 && H.h >= 5 && H.h <= 30 && H.l > .55) out.salmon.push((el.className || el.tagName) + ' ' + cs.backgroundColor);
    if (el.matches('button,.btn,.ibtn') && !el.closest('.demo,.snav') ) out.filled++;
  });
  document.querySelectorAll('#app input,#app textarea,#app select').forEach(i => { const c = getComputedStyle(i); if (!/^(right|start)$/.test(c.textAlign) || c.direction !== 'rtl') out.alignBad.push(i.id + ':' + c.textAlign); });
  document.querySelectorAll('#app a,#siteFoot a').forEach(a => { const c = getComputedStyle(a); const [r, g, b] = rgb(c.color); if (/underline/.test(c.textDecorationLine) || (b > 150 && r < 100 && g < 130 && b > r + 60 && b < 255 && !(r === 15 && g === 44))) out.linkBad.push(a.className + ' ' + c.color + ' ' + c.textDecorationLine); });
  return out;
};
(async () => {
  const b = await chromium.launch({ executablePath: exe }); const R = {};
  for (const w of [1440, 1024, 390]) {
    const r = R[w] = { states: {} };
    const p = await b.newPage({ viewport: { width: w, height: 900 } }); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(FILE); await p.waitForTimeout(500);
    for (const [name, fn] of Object.entries(STATES)) {
      if (name === 'org2' || name === 'branch') { await sel(p, '#dProfile', 'org1'); await sel(p, '#dRole', '0'); }
      await fn(p); await p.waitForTimeout(250);
      r.states[name] = await p.evaluate(() => ({ nav: Math.round(document.querySelector('.snav').getBoundingClientRect().width), sw: document.documentElement.scrollWidth,
        cards: [...document.querySelectorAll('#app .card')].map(c => ({ h: (c.querySelector('h2') || {}).textContent?.trim().slice(0, 14), w: Math.round(c.getBoundingClientRect().width), right: Math.round(c.getBoundingClientRect().right) })) }));
      Object.assign(r.states[name], await p.evaluate(`(${probe})()`));
      if (before && before[w] && before[w][name]) r.states[name].ratio = r.states[name].cards.map((c, i) => before[w][name].cards[i] ? +(c.w / before[w][name].cards[i].w).toFixed(3) : null);
    }
    // ---- start-state details
    await sel(p, '#dProfile', 'org1'); await sel(p, '#dRole', '0'); await sel(p, '#dHome', 'start'); await p.reload(); await p.waitForTimeout(500);
    r.detail = await p.evaluate(() => {
      const cs = (e, pr) => getComputedStyle(e)[pr]; const h = document.querySelector('.card>.card-h'), ico = h.querySelector('.ico'), card = h.parentElement;
      const nav = document.querySelector('.snav'); const row = document.querySelector('.srch-row .lrow');
      return { cardH_bg: cs(h, 'backgroundColor'), h2_color: cs(h.querySelector('h2'), 'color'), ico_bg: cs(ico, 'backgroundColor') + ' | ' + cs(ico, 'backgroundImage').slice(0, 40), ico_color: cs(ico, 'color'), ico_radius: cs(ico, 'borderTopLeftRadius'),
        cardBorder: cs(card, 'borderTopWidth') + ' ' + cs(card, 'borderTopColor'), cardHrect: [Math.round(h.getBoundingClientRect().left), Math.round(h.getBoundingClientRect().right), Math.round(card.getBoundingClientRect().left), Math.round(card.getBoundingClientRect().right)],
        navBg: cs(nav, 'backgroundImage').slice(0, 30), recentTag: row.tagName, recentRest: { bg: cs(row, 'backgroundColor'), border: cs(row, 'borderTopWidth'), barScale: cs(row, 'transitionDuration'), before: getComputedStyle(row, '::before').transform + ' / ' + getComputedStyle(row, '::before').transitionDuration + ' ' + getComputedStyle(row, '::before').transitionProperty },
        recentCount: document.querySelectorAll('.srch-row .lrow').length, recentType: row.getAttribute('type'),
        scanRest: { bg: cs(document.querySelector('.scan'), 'backgroundColor'), td: cs(document.querySelector('.scan'), 'transitionDuration'), tp: cs(document.querySelector('.scan'), 'transitionProperty') },
        btnRest: cs(document.querySelector('.scan .btn'), 'backgroundColor'), btnTd: cs(document.querySelector('.scan .btn'), 'transitionDuration') };
    });
    // hover recent row
    const rowH = p.locator('.srch-row .lrow').first(); await rowH.hover(); await p.waitForTimeout(500);
    r.detail.recentHover = await p.evaluate(() => { const row = document.querySelector('.srch-row .lrow'); const b = getComputedStyle(row, '::before'); return { bg: getComputedStyle(row).backgroundColor, before: b.transform, barBg: b.backgroundColor, anims: document.getAnimations().length }; });
    await p.screenshot({ path: path.join(OUT, `${w}-hover-recent.png`) });
    await p.locator('.srch-row .lrow').first().focus(); await p.keyboard.press('Tab'); await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(400);
    r.detail.recentFocus = await p.evaluate(() => ({ active: document.activeElement.className, before: getComputedStyle(document.activeElement, '::before').transform, focusVisible: document.activeElement.matches(':focus-visible') }));
    // hover the search field
    await p.mouse.move(1, 1); await p.waitForTimeout(400);
    await p.locator('.scan input').hover(); await p.waitForTimeout(500);
    r.detail.scanHover = await p.evaluate(() => ({ scan: getComputedStyle(document.querySelector('.scan')).backgroundColor, btn: getComputedStyle(document.querySelector('.scan .btn')).backgroundColor, td: getComputedStyle(document.querySelector('.scan')).transitionDuration }));
    await p.screenshot({ path: path.join(OUT, `${w}-hover-search.png`) });
    await p.mouse.move(1, 1); await p.locator('.scan input').focus(); await p.waitForTimeout(500);
    r.detail.scanFocus = await p.evaluate(() => ({ scan: getComputedStyle(document.querySelector('.scan')).backgroundColor, btn: getComputedStyle(document.querySelector('.scan .btn')).backgroundColor }));
    // ---- sweep: every interactive element in home start + results: hover changes bg -> transition must exist
    const sweep = [];
    for (const st of ['start', 'results']) {
      await sel(p, '#dHome', st); await p.mouse.move(1, 1); await p.waitForTimeout(300);
      const n = await p.locator('#app button,#app a,#app input,#siteFoot a,#app [role=tab]').count();
      for (let i = 0; i < n; i++) {
        const el = p.locator('#app button,#app a,#app input,#siteFoot a,#app [role=tab]').nth(i);
        if (!(await el.isVisible())) continue;
        await p.mouse.move(1, 1); await p.waitForTimeout(30);
        const rest = await el.evaluate(e => getComputedStyle(e).backgroundColor);
        try { await el.hover({ timeout: 800 }); } catch (e) { continue; }
        await p.waitForTimeout(320);
        const info = await el.evaluate(e => { const c = getComputedStyle(e); return { bg: c.backgroundColor, td: c.transitionDuration, tp: c.transitionProperty, k: e.tagName + '.' + e.className }; });
        if (info.bg !== rest) { const dur = Math.max(...info.td.split(',').map(x => parseFloat(x))); if (!(dur > 0) || !/all|background/.test(info.tp)) sweep.push(`${st}: ${info.k} ${rest}->${info.bg} td=${info.td} tp=${info.tp}`); }
      }
    }
    r.sweepNoTransition = sweep;
    // short-page footer: tall viewport, start state
    await p.setViewportSize({ width: w, height: 1800 }); await sel(p, '#dHome', 'start'); await p.waitForTimeout(300);
    r.footerShort = await p.evaluate(() => { const f = document.querySelector('#siteFoot').getBoundingClientRect(); return { footBottom: Math.round(f.bottom), vh: innerHeight, scrollH: document.documentElement.scrollHeight, cs: getComputedStyle(document.querySelector('#siteFoot')).position }; });
    await p.setViewportSize({ width: w, height: 900 }); await sel(p, '#dHome', 'results'); await p.waitForTimeout(300);
    r.footerLong = await p.evaluate(() => { const f = document.querySelector('#siteFoot').getBoundingClientRect(); return { footBottomDoc: Math.round(f.bottom + scrollY), scrollH: document.documentElement.scrollHeight, cs: getComputedStyle(document.querySelector('#siteFoot')).position }; });
    // C-1.23 : text right vs action right inside chat bubble
    await sel(p, '#dHome', 'ai'); await p.waitForTimeout(300);
    r.c123 = await p.evaluate(() => [...document.querySelectorAll('.bub.bot')].map(b => { const t = b.querySelector('p'), a = b.querySelector('.bub-acts > *'); return a ? [Math.round(t.getBoundingClientRect().right), Math.round(a.getBoundingClientRect().right)] : null; }).filter(Boolean));
    // screenshots
    for (const st of ['start', 'results']) { await p.setViewportSize({ width: w, height: 900 }); await p.reload(); await p.waitForTimeout(400); if (st === 'results') { await p.fill('#sq', 'כהן'); await p.click('#sForm [type=submit]'); await p.waitForTimeout(1100); } await p.mouse.move(1, 1); await p.waitForTimeout(300); await p.screenshot({ path: path.join(OUT, `${w}-${st}.png`), fullPage: true }); }
    r.errs = errs; await p.close();
  }
  await b.close(); console.log(JSON.stringify(R, null, 1));
})();
