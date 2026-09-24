#!/usr/bin/env node
/* =============================================================================
   tables-check.cjs — verifies the ONE table-screen pattern (TABLES-PATTERN.md)
   on every list prototype, and that the list prototypes match each other.

   Setup (once):  cd <scratch dir> && npm i --no-save playwright
   Run:           PW=<that dir>/node_modules/playwright node docs/redesign-v3/prototypes/tools/tables-check.cjs [--shots=<dir>]
   Chromium:      /opt/pw-browsers/chromium-NNNN/chrome-linux/chrome (auto-detected)

   Checks (per list prototype):
   S  static: same V3-SHELL sha + same V3-TABLES sha in every list file; @media only 480/640/768/1024/1440/1920 (±1);
      no physical properties (left/right/margin-left/…/text-align:left|right/float) in page + table CSS
   O  no page-level horizontal overflow at 360/768/1024/1440 (profile "extreme" too)
   C  columns: ≤5 visible data columns at ≥1024; card mode (<640): table hidden, cards shown
   T  chips (C-1.14): ≤1 .tag per table row, ≤1 .tag per phone card, ≤1 column that holds tags, in every view/tab
   P  header/cell/pager paddings + font sizes computed identical across the list prototypes
   I  interactions: sort (aria-sort flips), expand/collapse (aria-expanded, .open, Esc returns focus),
      row menu (keyboard), error state (retry button), empty state, smart-search disables sort, pager
   A  WCAG AA text contrast (sampled, same sampler as parity-check.cjs)
   Output: console + tools/tables-results.json; screenshots to --shots dir.
   ============================================================================= */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.join(__dirname, '..');
const LISTS = ['archetype-list', 'archetype-customers-list'];
const exe = (() => { const d = '/opt/pw-browsers'; try { const c = fs.readdirSync(d).find(x => /^chromium-\d+$/.test(x)); return c ? path.join(d, c, 'chrome-linux', 'chrome') : undefined; } catch { return undefined; } })();
const SHOTS = (process.argv.find(a => a.startsWith('--shots=')) || '').split('=')[1];
const R = {}; let fails = 0;
const ok = (f, id, pass, detail) => { (R[f] = R[f] || []).push({ id, pass, detail }); if (!pass) fails++; console.log(`  ${pass ? '✓' : '✗'} ${id}${detail ? ' — ' + detail : ''}`); };

function staticChecks(f) {
  const h = fs.readFileSync(path.join(ROOT, f + '.html'), 'utf8');
  const page = h.replace(/<!-- V3-SHELL:CSS[\s\S]*?\/V3-SHELL:CSS -->/, '');
  const css = [...page.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const OKW = new Set([480, 640, 768, 1024, 1440, 1920].flatMap(n => [n - 1, n, n + 1]));
  const bad = [...new Set([...css.matchAll(/@media[^{]*?(\d{3,5})px/g)].map(m => +m[1]).filter(n => !OKW.has(n)))];
  const PH = /(^|[;{\s])(left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:|text-align\s*:\s*(left|right)|float\s*:\s*(left|right)/g;
  return { shell: (h.match(/V3-SHELL:CSS (v\d+ sha:\w+)/) || [, 'NONE'])[1], tables: (h.match(/V3-TABLES:CSS (v\d+ sha:\w+)/) || [, 'NONE'])[1], badMedia: bad, physical: (css.match(PH) || []).length, chipClass: (h.match(/class="chip\b/g) || []).length };
}
const contrastFn = () => {
  const lum = c => { const m = c.match(/[\d.]+/g); if (!m) return null; const [r, g, b] = m.slice(0, 3).map(x => { x = +x / 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
  const alpha = c => { const m = c.match(/[\d.]+/g); return m && m.length > 3 ? +m[3] : 1; };
  const bgOf = e => { while (e) { const cs = getComputedStyle(e); if (cs.backgroundImage !== 'none') return null; if (alpha(cs.backgroundColor) > .9) return cs.backgroundColor; e = e.parentElement; } return 'rgb(220,237,250)'; };
  const bad = []; let n = 0;
  document.querySelectorAll('.app *').forEach(e => { if (![...e.childNodes].some(t => t.nodeType === 3 && t.textContent.trim())) return; const r = e.getBoundingClientRect(); if (!r.width || e.closest('[disabled],.demo,[aria-hidden=true]')) return; const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < .9) return; const bg = bgOf(e); if (!bg) return; const L1 = lum(cs.color), L2 = lum(bg); if (L1 == null || L2 == null) return; n++; const ratio = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05); const large = parseFloat(cs.fontSize) >= 24 || (parseFloat(cs.fontSize) >= 18.66 && +cs.fontWeight >= 700); if (ratio < (large ? 3 : 4.5)) bad.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} "${e.textContent.trim().slice(0, 18)}" ${ratio.toFixed(2)}`); });
  return { n, bad };
};
const chipFn = () => {
  const vis = e => e.getBoundingClientRect().width > 0;
  const rows = [...document.querySelectorAll('.tp-row')].filter(vis), cards = [...document.querySelectorAll('.tp-cards .itm')].filter(vis);
  const maxRow = Math.max(0, ...rows.map(r => r.querySelectorAll('.tag').length)), maxCard = Math.max(0, ...cards.map(c => c.querySelectorAll('.tag').length));
  const cols = new Set(); rows.forEach(r => [...r.children].forEach((td, i) => { if (td.querySelector('.tag')) cols.add(i); }));
  const other = [...document.querySelectorAll('.app .tag,.app .chip,.app .badge')].filter(e => vis(e) && !e.closest('.tp-row,.tp-cards')).length;
  return { rows: rows.length, cards: cards.length, maxRow, maxCard, tagCols: cols.size, outside: other };
};
const geomFn = () => {
  const pick = (s, withH) => { const e = [...document.querySelectorAll(s)].find(x => x.getBoundingClientRect().width > 0); if (!e) return null; const c = getComputedStyle(e); return ['padding-top', 'padding-bottom', 'padding-inline-start', 'padding-inline-end', 'font-size', 'font-weight', 'color', 'background-color', 'border-bottom-color'].map(p => p + '=' + c.getPropertyValue(p)).join(';') + (withH ? ';height=' + Math.round(e.getBoundingClientRect().height) : ''); };
  return { th: pick('.tbl thead th.tp-th', 1), td: pick('.tbl tbody .tp-row td:not(.tp-act)'), act: pick('.tbl tbody .tp-row td.tp-act'), foot: pick('.tp-foot'), sort: pick('.tp-sort', 1), kv: pick('.tp-x.open .tp-kv') };   /* row heights follow content; only header geometry is compared by height */
};

(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const st = {}; LISTS.forEach(f => st[f] = staticChecks(f));
  const geo = {};
  for (const f of LISTS) {
    console.log(`\n${f}`);
    const s = st[f];
    ok(f, 'S shell sha same as other lists', LISTS.every(x => st[x].shell === s.shell) && s.shell !== 'NONE', s.shell);
    ok(f, 'S tables sha same as other lists', LISTS.every(x => st[x].tables === s.tables) && s.tables !== 'NONE', s.tables);
    ok(f, 'S @media only allowed widths', !s.badMedia.length, JSON.stringify(s.badMedia));
    ok(f, 'S no physical properties (page + tables CSS)', s.physical === 0, String(s.physical));
    ok(f, 'S no .chip class in page markup', s.chipClass === 0, String(s.chipClass));
    const p = await b.newPage();
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    const url = 'file://' + path.join(ROOT, f + '.html');
    const go = async (w, prof) => { await p.setViewportSize({ width: w, height: 900 }); await p.goto(url); await p.waitForTimeout(700); if (prof) { await p.selectOption('#dProfile', prof); await p.waitForTimeout(700); } };
    for (const prof of [null, 'max']) for (const w of [360, 768, 1024, 1440]) {
      await go(w, prof);
      const o = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      ok(f, `O no page overflow @${w}${prof ? ' (' + prof + ')' : ''}`, o.sw <= o.cw, `${o.sw}/${o.cw}`);
      if (!prof) {
        const c = await p.evaluate(() => ({ cols: [...document.querySelectorAll('.tbl thead th')].filter(t => t.getBoundingClientRect().width > 0 && !t.classList.contains('tp-act')).length, table: !!document.querySelector('.tp-tbl-wrap') && getComputedStyle(document.querySelector('.tp-tbl-wrap')).display !== 'none', cards: !!document.querySelector('.tp-cards') && getComputedStyle(document.querySelector('.tp-cards')).display !== 'none', tableScroll: (() => { const x = document.querySelector('.tp-tbl-wrap'); return x ? x.scrollWidth - x.clientWidth : 0; })() }));
        if (w >= 1024) ok(f, `C ≤5 data columns @${w}`, c.cols <= 5, String(c.cols));
        if (w >= 640) ok(f, `C table (not cards) @${w}, no inner scroll`, c.table && !c.cards && c.tableScroll <= 1, `inner scroll ${c.tableScroll}px`);
        else ok(f, `C card mode @${w}`, !c.table && c.cards);
        const ch = await p.evaluate(chipFn);
        ok(f, `T chips @${w}: ≤1/row, ≤1/card, ≤1 tag column, 0 outside rows`, ch.maxRow <= 1 && ch.maxCard <= 1 && ch.tagCols <= 1 && ch.outside === 0, JSON.stringify(ch));
        if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${f}-${w}.png`) });
      }
    }
    /* chips in every view (orders tabs) */
    await go(1440);
    const views = await p.$$eval('#tpViews [data-view]', a => a.map(x => x.dataset.view));
    for (const v of views) { await p.click(`#tpViews [data-view="${v}"]`); await p.waitForTimeout(600); const ch = await p.evaluate(chipFn); ok(f, `T chips in view "${v}"`, ch.maxRow <= 1 && ch.tagCols <= 1 && ch.outside === 0, `rows ${ch.rows}, max/row ${ch.maxRow}, tag cols ${ch.tagCols}`); }
    /* interactions @1440 */
    await go(1440);
    const th = p.locator('th.tp-th').nth(0), before = await th.getAttribute('aria-sort');
    await th.locator('.tp-sort').click(); await p.waitForTimeout(600);
    const after = await p.locator('th.tp-th').nth(0).getAttribute('aria-sort');
    ok(f, 'I sort header flips aria-sort', before !== after && after !== 'none', `${before} → ${after}`);
    const chev = p.locator('.tp-row .chevb').first(); await chev.click(); await p.waitForTimeout(400);
    const exp = await p.evaluate(() => ({ a: document.querySelector('.tp-row .chevb').getAttribute('aria-expanded'), open: !!document.querySelector('.tp-x.open'), h: document.querySelector('.tp-x.open .tp-xw') ? document.querySelector('.tp-x.open .tp-xw').getBoundingClientRect().height : 0, trans: getComputedStyle(document.querySelector('.tp-xw')).transition }));
    ok(f, 'I expand row (aria-expanded, open, height, sketch .3s transition)', exp.a === 'true' && exp.open && exp.h > 20 && /0\.3s/.test(exp.trans), JSON.stringify(exp));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${f}-1440-expanded.png`) });
    geo[f] = await p.evaluate(geomFn);
    await p.keyboard.press('Escape'); await p.waitForTimeout(400);
    const esc = await p.evaluate(() => ({ open: !!document.querySelector('.tp-x.open'), focus: document.activeElement && document.activeElement.classList.contains('chevb') }));
    ok(f, 'I Esc collapses and returns focus to the chevron', !esc.open && esc.focus, JSON.stringify(esc));
    const hasMenu = await p.locator('[data-tp-more]').count();
    if (hasMenu) { await p.locator('[data-tp-more]').first().focus(); await p.keyboard.press('Enter'); await p.waitForTimeout(200); const m = await p.evaluate(() => ({ open: !!document.querySelector('.tp-menu.open'), focusIn: !!(document.activeElement && document.activeElement.closest('.tp-menu')) })); await p.keyboard.press('Escape'); await p.waitForTimeout(100); const back = await p.evaluate(() => !!(document.activeElement && document.activeElement.matches('[data-tp-more]'))); ok(f, 'I row menu opens by keyboard, Esc returns focus', m.open && m.focusIn && back, JSON.stringify({ ...m, back })); }
    if (await p.locator('[data-tp-pg]').count()) { await p.locator('[data-tp-pg]').last().click(); await p.waitForTimeout(700); const pg = await p.inputValue('#tpPage'); ok(f, 'I pager next → page 2', pg === '2', pg); }
    await p.selectOption('#dLoad', 'error'); await p.waitForTimeout(800);
    const er = await p.evaluate(() => ({ note: !!document.querySelector('.tp-note.err [role],.tp-note.err'), retry: !!document.querySelector('.tp-note.err [data-tp-act=retry]'), role: (document.querySelector('.tp-note.err') || {}).getAttribute && document.querySelector('.tp-note.err').getAttribute('role') }));
    ok(f, 'I error state: inline alert + retry', er.note && er.retry && er.role === 'alert', JSON.stringify(er));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${f}-1440-error.png`) });
    await p.selectOption('#dLoad', 'ok'); await p.selectOption('#dData', await p.$eval('#dData option:last-child', o => o.value)); await p.waitForTimeout(800);
    const em = await p.evaluate(() => ({ empty: !!document.querySelector('.tp-empty'), act: !!document.querySelector('.tp-empty [data-tp-act]') }));
    ok(f, 'I empty state with action', em.empty && em.act, JSON.stringify(em));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${f}-1440-empty.png`) });
    await go(1440); await p.fill('#tpQ', 'zzzz'); await p.press('#tpQ', 'Enter'); await p.waitForTimeout(700);
    const nr = await p.evaluate(() => (document.querySelector('.tp-empty b') || {}).textContent || '');
    ok(f, 'I no-results state names the search', /zzzz/.test(nr), nr);
    await go(1440);
    if (await p.locator('[data-tp-bar=ai]').count()) { await p.click('[data-tp-bar=ai]'); await p.fill('#tpQ', 'בית שמש'); await p.press('#tpQ', 'Enter'); await p.waitForTimeout(800); const ai = await p.evaluate(() => ({ note: !!document.querySelector('.tp-note [data-tp-act=exitAi]'), sortOff: [...document.querySelectorAll('.tp-sort')].every(b => b.disabled) })); ok(f, 'I smart search: banner + exit, sort disabled', ai.note && ai.sortOff, JSON.stringify(ai)); if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${f}-1440-smart.png`) }); }
    /* C-1.16: dialogs — no two fields in one vertical band (filter + export), phone and desktop */
    for (const w of [390, 1440]) for (const [btn, name] of [['[data-tp-bar=adv]', 'filter'], ['[data-head-act=export]', 'export']]) {
      await go(w); const vis = await p.locator(btn).first().isVisible(); if (!vis) { await p.click('[data-tp-hm]'); await p.waitForTimeout(150); }
      await p.locator(`${btn}:visible`).first().click(); await p.waitForTimeout(450);
      const fl = await p.evaluate(() => { const L = [...document.querySelectorAll('#dlg input:not([type=checkbox]):not([type=radio]),#dlg select,#dlg textarea')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.getBoundingClientRect()); let bad = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const a = L[i], b = L[j]; if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 4) bad++; } const d = document.querySelector('#dlg'); return { n: L.length, bad, light: d.classList.contains('mailwin') }; });
      ok(f, `F ${name} dialog @${w}: one field per line, light data-entry window`, fl.n > 0 && fl.bad === 0 && fl.light, JSON.stringify(fl));
      if (SHOTS && w === 390) await p.screenshot({ path: path.join(SHOTS, `${f}-390-${name}-dialog.png`) });
      await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    }
    /* export above the row limit asks for approval on the second layer (LI-66 / CL-49) */
    await go(1440); await p.click('[data-head-act=export]'); await p.waitForTimeout(300); await p.fill('#tpExN', '5000'); await p.click('[data-tpx=xlsx]'); await p.waitForTimeout(300);
    const ap = await p.evaluate(() => ({ on: document.querySelector('#scrim2').classList.contains('on'), appr: document.querySelector('#dlg2').classList.contains('apprwin') }));
    await p.fill('#tpApPw', '1234'); await p.click('#tpApOk'); await p.waitForTimeout(300);
    const tst = await p.evaluate(() => (document.querySelector('#toast') || {}).textContent || '');
    ok(f, 'I export above limit → approval window (2nd layer) → toast', ap.on && ap.appr && /הקובץ ירד/.test(tst), JSON.stringify({ ...ap, toast: tst.trim().slice(0, 40) }));
    /* phone: card expand uses the sketch det-wrap */
    await go(360); await p.locator('.tp-cards .chevb').first().click(); await p.waitForTimeout(450);
    const ce = await p.evaluate(() => { const c = document.querySelector('.tp-cards .itm.open'); return { open: !!c, trans: c ? getComputedStyle(c.querySelector('.det-wrap')).transition : '', h: c ? c.querySelector('.det-wrap').getBoundingClientRect().height : 0 }; });
    ok(f, 'I phone card expands (sketch .det-wrap .3s)', ce.open && ce.h > 20 && /0\.3s/.test(ce.trans), JSON.stringify(ce));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${f}-360-card-open.png`), fullPage: false });
    await go(1440); const ct = await p.evaluate(contrastFn);
    ok(f, 'A text contrast ≥ AA (sampled)', ct.bad.length === 0, `${ct.bad.length} of ${ct.n}: ${ct.bad.slice(0, 4).join(' | ')}`);
    ok(f, 'no JS errors', errs.length === 0, errs.slice(0, 3).join(' | '));
    await p.close();
  }
  console.log('\nshared geometry');
  for (const k of ['th', 'td', 'act', 'foot', 'sort', 'kv']) ok('shared', `P ${k} identical across lists`, LISTS.every(f => geo[f] && geo[f][k] === geo[LISTS[0]][k]), LISTS.map(f => geo[f] && geo[f][k]).join('  ||  '));
  fs.writeFileSync(path.join(__dirname, 'tables-results.json'), JSON.stringify({ when: new Date().toISOString(), results: R, geometry: geo }, null, 1));
  console.log(`\n${fails ? '✗ ' + fails + ' failing' : '✓ all passed'}`);
  await b.close(); process.exit(fails ? 1 : 0);
})();
