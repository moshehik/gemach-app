#!/usr/bin/env node
/* tables-flow.cjs — page-specific flows of the two list prototypes (the generic checks are in tables-check.cjs).
   Run: PW=<dir>/node_modules/playwright node docs/redesign-v3/prototypes/tools/tables-flow.cjs [--shots=<dir>] */
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PW || 'playwright');
const ROOT = path.join(__dirname, '..');
const exe = (() => { const d = '/opt/pw-browsers'; try { const c = fs.readdirSync(d).find(x => /^chromium-\d+$/.test(x)); return c ? path.join(d, c, 'chrome-linux', 'chrome') : undefined; } catch { return undefined; } })();
const SHOTS = (process.argv.find(a => a.startsWith('--shots=')) || '').split('=')[1];
let fails = 0; const ok = (id, pass, d) => { if (!pass) fails++; console.log(`  ${pass ? '✓' : '✗'} ${id}${d ? ' — ' + d : ''}`); };
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
(async () => {
  const b = await chromium.launch({ executablePath: exe });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const open = async (f, w = 1440) => { await p.setViewportSize({ width: w, height: 900 }); await p.goto('file://' + path.join(ROOT, f + '.html')); await p.waitForTimeout(700); };
  const views = () => p.$$eval('#tpViews [data-view]', a => a.map(x => x.dataset.view));

  console.log('orders');
  await open('archetype-list');
  ok('org1 views', JSON.stringify(await views()) === JSON.stringify(['soon', 'archive', 'deleted', 'unpaid', 'not_taken', 'all']), JSON.stringify(await views()));
  ok('one tag per row, payment as text', await p.evaluate(() => [...document.querySelectorAll('.tp-row')].every(r => r.querySelectorAll('.tag').length === 1) && document.querySelectorAll('.tp-row .tp-l2 .stx').length > 0));
  ok('cart countdown + local draft text shown', await p.evaluate(() => !!document.querySelector('[data-timer]') && [...document.querySelectorAll('.tp-row .stx')].some(x => /לא נשמר/.test(x.textContent))));
  ok('3-month default shown as text + button', await p.evaluate(() => /ברירת מחדל/.test(document.querySelector('#tpPills').textContent) && !!document.querySelector('[data-fs-act=allDates]')));
  await p.click('#tpViews [data-view=unpaid]'); await p.waitForTimeout(600);
  const up = await p.evaluate(() => ({ note: /לא מוצג כמה שולם/.test((document.querySelector('.tp-note') || {}).textContent || ''), payTxt: document.querySelectorAll('.tp-row .tp-l2 .stx').length, sortOff: [...document.querySelectorAll('.tp-sort')].every(x => x.disabled) }));
  ok('"לא שולם": note, no payment text, fixed sort (LI-48/67)', up.note && up.payTxt === 0 && up.sortOff, JSON.stringify(up)); await shot(p, 'flow-orders-unpaid');
  await p.click('#tpViews [data-view=soon]'); await p.waitForTimeout(600);
  await p.click('[data-tp-bar=adv]'); await p.waitForTimeout(300); await p.fill('#f-customerCity', 'ירושלים'); await p.check('#advF [data-rs=pendingOnly]'); await p.click('#advGo'); await p.waitForTimeout(700);
  const pl = await p.evaluate(() => ({ pills: [...document.querySelectorAll('#tpPills .hf-pill')].map(x => x.textContent.trim()), bdg: document.querySelector('.hf-bdg').textContent }));
  ok('advanced filter → removable pills + count on "סינון"', pl.pills.length === 2 && pl.bdg === '2', JSON.stringify(pl)); await shot(p, 'flow-orders-filter-pills');
  await p.click('#tpPills .hf-pill'); await p.waitForTimeout(600);
  ok('removing a pill re-queries', await p.evaluate(() => document.querySelectorAll('#tpPills .hf-pill').length === 1));
  await open('archetype-list');
  const row = await p.evaluate(() => { const r = [...document.querySelectorAll('.tp-row')].find(x => /בקרוב/.test(x.textContent) && x.querySelector('[data-tp-more]')); return r && r.dataset.id; });
  await p.click(`.tp-row[data-id="${row}"] [data-tp-more]`); await p.waitForTimeout(200); await p.click('.tp-menu [data-tp-act=del]'); await p.waitForTimeout(400);
  const cf = await p.evaluate(() => ({ open: document.querySelector('#scrim').classList.contains('on'), txt: document.querySelector('#dlg h2').textContent, dark: document.body.classList.contains('dlg-dark') }));
  ok('delete → confirm window (theme-following)', cf.open && /למחוק/.test(cf.txt), JSON.stringify(cf)); await shot(p, 'flow-orders-delete-confirm');
  await p.click('#dlg [data-ans=y]'); await p.waitForTimeout(900);
  ok('delete → toast + row gone', await p.evaluate(id => /נמחקה/.test(document.querySelector('#toast').textContent) && !document.querySelector(`.tp-row[data-id="${id}"]`), row));
  await p.selectOption('#dProfile', 'org2'); await p.waitForTimeout(800);
  ok('org2: "לא נלקחו" view gone (show_not_taken_orders)', !(await views()).includes('not_taken'), JSON.stringify(await views()));
  const r2 = await p.evaluate(() => { const r = [...document.querySelectorAll('.tp-row')].find(x => /בקרוב/.test(x.textContent) && x.querySelector('[data-tp-more]')); return r && r.dataset.id; });
  await p.click(`.tp-row[data-id="${r2}"] [data-tp-more]`); await p.waitForTimeout(200); await p.click('.tp-menu [data-tp-act=del]'); await p.waitForTimeout(300); await p.click('#dlg [data-ans=y]'); await p.waitForTimeout(700);
  const idd = await p.evaluate(() => ({ open: document.querySelector('#scrim').classList.contains('on'), id: !!document.querySelector('#idIn') }));
  if (idd.id) { await p.fill('#idIn', '111'); await p.click('#idGo'); await p.waitForTimeout(200); const er = await p.evaluate(() => (document.querySelector('#dlg .ferr') || {}).textContent || ''); await shot(p, 'flow-orders-id-check'); await p.fill('#idIn', '123456782'); await p.click('#idGo'); await p.waitForTimeout(900); ok('org2: ID check before delete (wrong → error, right → deleted)', /לא תואמת/.test(er) && /נמחקה/.test(await p.evaluate(() => document.querySelector('#toast').textContent)), er.trim()); }
  else ok('org2: ID check before delete', false, 'no ID window (row customer may have no ID number) ' + JSON.stringify(idd));
  await p.selectOption('#dProfile', 'max'); await p.waitForTimeout(800);
  const mx = await p.evaluate(() => ({ v: [...document.querySelectorAll('#tpViews [data-view]')].map(x => x.dataset.view), ai: !!document.querySelector('[data-tp-bar=ai]'), greg: document.querySelectorAll('.tp-row .tp-l2 bdi').length, th: document.querySelector('.tbl thead th').textContent.trim() }));
  ok('extreme: "טיוטות" view, no AI, no Gregorian line, long label', mx.v.includes('drafts') && !mx.ai && mx.greg === 0 && /במערכת/.test(mx.th), JSON.stringify(mx)); await shot(p, 'flow-orders-extreme');
  await p.selectOption('#dProfile', 'org2'); await p.waitForTimeout(600); await p.click('[data-head-act=print]'); await p.waitForTimeout(300);
  ok('org2: print window offers the prep report as default', await p.evaluate(() => { const c = document.querySelector('#dlg [name=pt]:checked'); return c && c.value === 'order_prep_by_date' && !document.querySelector('[data-pr=pdf]'); })); await shot(p, 'flow-orders-print');

  console.log('customers');
  await open('archetype-customers-list');
  ok('no views row; blocked = the only tag', await p.evaluate(() => !document.querySelector('#tpViews .seg') && [...document.querySelectorAll('.tp-row .tag')].every(t => /חסום/.test(t.textContent)) && document.querySelectorAll('.tp-row .tag').length >= 1));
  ok('export column "קוד לקוח" note present', await (async () => { await p.click('[data-head-act=export]'); await p.waitForTimeout(250); const t = await p.evaluate(() => document.querySelector('#dlg').textContent); await p.keyboard.press('Escape'); return /קוד לקוח/.test(t); })());
  const nm = await p.evaluate(() => document.querySelector('.tp-row td:nth-child(2)').textContent.trim().split(' '));
  await p.fill('#tpQ', nm.join(' ')); await p.press('#tpQ', 'Enter'); await p.waitForTimeout(700);
  await shot(p, 'flow-customers-name-search');
  ok('two-word name search (first + last)', await p.evaluate(nm => [...document.querySelectorAll('.tp-row')].length > 0 && [...document.querySelectorAll('.tp-row')].every(r => r.textContent.includes(nm[0]) && r.textContent.includes(nm[1])), nm), nm.join(' '));
  await open('archetype-customers-list'); await p.fill('#tpQ', 'ה'); await p.press('#tpQ', 'Enter'); await p.waitForTimeout(600);
  await p.click('[data-tp-bar=adv]'); await p.waitForTimeout(300); await p.fill('#a-ct', 'בית שמש'); await p.click('#dlg [data-ans=apply]'); await p.waitForTimeout(700);
  ok('search + advanced filter combine (AND) and show a pill', await p.evaluate(() => document.querySelectorAll('#tpPills .hf-pill').length === 1));
  await p.uncheck('#dAi'); await p.waitForTimeout(300);
  ok('AI off → star/statistics hidden (CL-5 fix)', await p.evaluate(() => !document.querySelector('[data-tp-bar=ai]') && !document.querySelector('[data-tp-bar=stats]')));
  await shot(p, 'flow-customers-filter'); await open('archetype-customers-list');
  await p.selectOption('#dProfile', 'org2'); await p.waitForTimeout(700); await p.click('.tp-row .chevb'); await p.waitForTimeout(400);
  ok('org2: marketing-consent line in expanded row', await p.evaluate(() => /דיוור/.test(document.querySelector('.tp-x.open').textContent)));
  await p.selectOption('#dProfile', 'org1'); await p.waitForTimeout(700); await p.click('.tp-row .chevb'); await p.waitForTimeout(400);
  ok('org1: no marketing-consent line (hide_marketing_consent_field)', await p.evaluate(() => !/דיוור/.test(document.querySelector('.tp-x.open').textContent)));
  const blk = await p.evaluate(() => { const r = [...document.querySelectorAll('.tp-row')].find(x => x.querySelector('.tag')); return r && r.dataset.id; });
  if (blk) { await p.click(`.tp-row[data-id="${blk}"] .chevb`); await p.waitForTimeout(400); ok('blocked customer: reason in expanded row', await p.evaluate(id => /סיבת החסימה/.test(document.getElementById('tpx-' + id).textContent), blk)); await shot(p, 'flow-customers-blocked'); }
  await p.click('.tp-sort[data-tp-sort=lastName]'); await p.waitForTimeout(600);
  ok('sort by name header = last name ascending', await p.evaluate(() => { const n = [...document.querySelectorAll('.tp-row td:nth-child(2)')].slice(0, 10).map(t => t.textContent.trim().split(' ').pop()); return n.every((x, i) => !i || n[i - 1].localeCompare(x, 'he') <= 0); }));
  ok('no JS errors (both pages)', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(fails ? `✗ ${fails} failing` : '✓ all passed');
  await b.close(); process.exit(fails ? 1 : 0);
})();
