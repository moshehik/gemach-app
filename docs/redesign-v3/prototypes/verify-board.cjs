// בדיקת אב-הטיפוס A4 (לוח) ב-Chromium headless: זרימות, שכבות, נעילת גלילה, RTL, גלישה ב-360/768/1024/1440.
// הרצה: node docs/redesign-v3/prototypes/verify-board.cjs  (playwright גלובלי). כותב צילומים ל-screenshots/board/.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const P='/home/user/gemach-app/docs/redesign-v3/prototypes/';
const ovf = p => p.evaluate(()=>{ const bad=[]; document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width && (r.right>innerWidth+1||r.left<-1) && !el.closest('.tbl-wrap,#tipbox,#richtip,.toasts,.seg') && getComputedStyle(el).position!=='fixed') bad.push((el.className.baseVal??el.className)+':'+Math.round(r.left)+'/'+Math.round(r.right));}); return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:bad.slice(0,4)}; });
const st = p => p.evaluate(()=>({lock:document.documentElement.hasAttribute('data-v3-lock'), inert:!!document.querySelector('#page')?.inert, layers:document.querySelectorAll('#layer-root .scrim:not(.is-leaving)').length, modes:[...document.querySelectorAll('#layer-root .dlg')].map(d=>d.dataset.v3Mode+':'+d.className.split(' ').slice(2).join('.')), focus:document.activeElement?.getAttribute('aria-label')||document.activeElement?.textContent?.trim().slice(0,30)}));
(async()=>{ const b=await chromium.launch(); const R={};
 for (const w of [360,768,1024,1440]) { const p=await b.newPage({viewport:{width:w,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const r={}; const D=P+'screenshots/board/';
  await p.goto('file://'+P+'archetype-board.html'); await p.waitForTimeout(500); if (w===768) { await p.screenshot({path:D+'768-01b-compact-month.png'}); await p.click('[data-view=list]'); }
  // arrows geometry: prev should point right, next left
  r.arrows = await p.evaluate(()=>{ const g=s=>{const u=document.querySelector(`[data-act=${s}] use`); const sym=document.querySelector(u.getAttribute('href')); return sym.querySelector('path:last-child').getAttribute('d');}; return {prev:g('prev'), next:g('next')}; });
  if (w>=1024){ await p.click('.oc-main'); await p.waitForTimeout(250); await p.screenshot({path:D+`${w}-02-menu.png`}); r.menu = await p.evaluate(()=>!!document.querySelector('.menu')); await p.keyboard.press('Escape'); r.menuFocusBack = await p.evaluate(()=>document.activeElement.classList.contains('oc-main'));
   await p.hover('.oc-info'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-03-richtip.png`}); }
  await p.click('.oc-info'); await p.waitForTimeout(300); r.details = await st(p); await p.screenshot({path:D+`${w}-04-details-dark.png`});
  await p.keyboard.press('Escape'); await p.waitForTimeout(250); r.afterEsc = await st(p);
  // day dialog
  await p.locator('[data-day]:visible').first().click(); await p.waitForTimeout(300); r.day = await st(p); await p.fill('#dayQ','#'); await p.fill('#dayQ','481'); await p.waitForTimeout(100); await p.screenshot({path:D+`${w}-05-day-dialog.png`});
  // wheel shouldn't scroll page
  const y0 = await p.evaluate(()=>scrollY); await p.mouse.wheel(0,600); await p.waitForTimeout(150); r.scrollLocked = (await p.evaluate(()=>scrollY))===y0;
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  // adv search live
  await p.click('[data-act=adv]'); await p.waitForTimeout(300); await p.fill('#adv-orderId','4813'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-06-adv.png`}); r.adv = await st(p); await p.click('[data-apply]'); await p.waitForTimeout(250); r.filterChips = await p.evaluate(()=>document.querySelectorAll('.filters-on .chip').length); await p.screenshot({path:D+`${w}-07-filtered.png`}); await p.click('[data-act=clearAll]');
  // global search
  await p.fill('#sq','כהן'); await p.click('[data-act=global]'); await p.waitForTimeout(900); await p.screenshot({path:D+`${w}-08-global.png`}); r.global = await st(p); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await p.click('[data-act=clearSearch]').catch(()=>{});
  // rental card via menu
  await p.evaluate(()=>rentalDlg(ORDERS.find(o=>o.day>TODAY_I+3 && o.items.filter(i=>!i.isDeleted).length>=2)));
  await p.waitForTimeout(350); await p.fill('#rrB','81234'); await p.click('#rrScan [type=submit]'); await p.waitForTimeout(700); r.codeStack = await st(p); await p.screenshot({path:D+`${w}-09-code-over-rental.png`});
  await p.fill('#ap-pw','0000'); await p.click('[data-go]'); await p.waitForTimeout(600); await p.screenshot({path:D+`${w}-10-code-wrong.png`}); await p.fill('#ap-pw','abc123'); await p.click('[data-go]'); await p.waitForTimeout(700);
  await p.screenshot({path:D+`${w}-11-rental-pending.png`}); await p.click('.dlg.form [data-x]'); await p.waitForTimeout(350); r.closePending = await st(p); await p.screenshot({path:D+`${w}-12-close-pending.png`}); await p.click('[data-r=s]'); await p.waitForTimeout(250); await p.click('[data-confirm]'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-13-confirm-partial.png`}); await p.keyboard.press('Escape'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(400); r.threeWay = await st(p); await p.click('[data-r=d]'); await p.waitForTimeout(400); r.end = await st(p);
  // views
  await p.click('[data-view=week]'); await p.waitForTimeout(250); await p.screenshot({path:D+`${w}-14-week.png`, fullPage:true}); r.ovWeek = await ovf(p);
  await p.click('[data-view=list]'); await p.waitForTimeout(250); await p.click('[data-act=today]'); await p.waitForTimeout(500); await p.screenshot({path:D+`${w}-15-list-today.png`}); r.ovList = await ovf(p);
  await p.click('[data-view=month]'); await p.evaluate(()=>{const s=document.querySelector('#dProfile'); s.value='max'; s.dispatchEvent(new Event('change')); const d=document.querySelector('#dData'); d.value='busy'; d.dispatchEvent(new Event('change'));}); await p.waitForTimeout(300); await p.screenshot({path:D+`${w}-16-extreme-busy.png`, fullPage:true}); r.ovMax = await ovf(p);
  await p.fill('#sq','x'); await p.click('[data-act=toggleAi]'); await p.click('#sForm [type=submit]'); await p.waitForTimeout(1100); await p.screenshot({path:D+`${w}-17-ai-mode.png`}); r.ai = await p.evaluate(()=>!!document.querySelector('.ai-banner'));
  for (const s of ['loading','error','denied']) { await p.evaluate(v=>{const d=document.querySelector('#dLoad'); d.value=v; d.dispatchEvent(new Event('change'));}, s); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-18-${s}.png`}); }
  r.errs=errs; R['board-'+w]=r; await p.close(); }
 console.log(JSON.stringify(R,null,0)); await b.close(); })();
