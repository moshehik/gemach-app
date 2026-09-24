// בדיקת אב-הטיפוס A5 (בית/סיכום) ב-Chromium headless. הרצה: node docs/redesign-v3/prototypes/verify-dashboard.cjs
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const P='/home/user/gemach-app/docs/redesign-v3/prototypes/'; const D=P+'screenshots/dashboard/';
const ovf = p => p.evaluate(()=>{ const bad=[]; document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width && (r.right>innerWidth+1||r.left<-1) && !el.closest('.tbl-wrap,#tipbox,.toasts,.seg') && getComputedStyle(el).position!=='fixed') bad.push((el.className.baseVal??el.className)+':'+Math.round(r.left)+'/'+Math.round(r.right));}); return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:bad.slice(0,4)}; });
const st = p => p.evaluate(()=>({lock:document.documentElement.hasAttribute('data-v3-lock'), inert:!!document.querySelector('#page')?.inert, layers:document.querySelectorAll('#layer-root .scrim:not(.is-leaving)').length, modes:[...document.querySelectorAll('#layer-root .dlg')].map(d=>d.dataset.v3Mode)}));
const sel = (p,id,v) => p.evaluate(([id,v])=>{const s=document.querySelector(id); s.value=v; s.dispatchEvent(new Event('change'));},[id,v]);
(async()=>{ const b=await chromium.launch(); const R={};
 for (const w of [360,768,1024,1440]) { const p=await b.newPage({viewport:{width:w,height:900}}); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); const r={};
  await p.goto('file://'+P+'archetype-dashboard.html'); await p.waitForTimeout(400);
  await p.fill('#sq','כהן'); await p.click('#sForm [type=submit]'); await p.waitForTimeout(1100); await p.screenshot({path:D+`${w}-02-results.png`, fullPage:true}); r.ovRes=await ovf(p);
  await p.click('[data-more=c]'); await p.waitForTimeout(100);
  await p.click('[data-mode=ai]'); r.keepText = await p.inputValue('#sq'); await p.click('#sForm [type=submit]'); await p.waitForTimeout(1100); await p.screenshot({path:D+`${w}-03-ai-chat.png`, fullPage:true}); r.ovAi=await ovf(p);
  await p.click('[data-exp="0"]'); await p.fill('#fuQ','ומי מהן בירושלים?'); await p.click('#fuForm [type=submit]'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-04-ai-typing.png`}); await p.waitForTimeout(900);
  await p.click('[data-act=setting]'); await p.waitForTimeout(900); await p.screenshot({path:D+`${w}-05-setting-head-denied.png`}); r.settingHead = await st(p); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await sel(p,'#dRole','1'); await sel(p,'#dHome','ai'); await p.waitForTimeout(200); await p.click('[data-act=setting]'); await p.waitForTimeout(900); await p.click('.dlg [data-save]'); await p.waitForTimeout(700); r.settingSave = await st(p); await p.screenshot({path:D+`${w}-06-setting-save-code.png`}); await p.keyboard.press('Escape'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  await sel(p,'#dHome','start'); await p.waitForTimeout(150); await p.screenshot({path:D+`${w}-07-branch-manager-home.png`}); r.links1 = await p.evaluate(()=>document.querySelectorAll('.ql').length);
  await sel(p,'#dProfile','org2'); await p.waitForTimeout(150); r.linksOrg2 = await p.evaluate(()=>document.querySelectorAll('.ql').length); r.aiSegOrg2 = await p.evaluate(()=>!!document.querySelector('[data-mode=ai]')); await p.screenshot({path:D+`${w}-08-org2-home.png`});
  await sel(p,'#dProfile','max'); await sel(p,'#dRole','0'); await p.evaluate(()=>{document.querySelector('#dProposal').click();}); await p.waitForTimeout(150); await p.screenshot({path:D+`${w}-09-extreme-proposal.png`, fullPage:true}); r.ovMax=await ovf(p);
  await sel(p,'#dHome','error'); await p.waitForTimeout(150); await p.screenshot({path:D+`${w}-10-search-error.png`});
  await sel(p,'#dHome','none'); await p.waitForTimeout(150); await p.screenshot({path:D+`${w}-11-no-results.png`, fullPage:true});
  await sel(p,'#dPage','dash'); await p.waitForTimeout(300); await p.screenshot({path:D+`${w}-12-dashboard-extreme.png`, fullPage:true}); r.ovDash=await ovf(p);
  await sel(p,'#dProfile','org1'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-13-dashboard.png`, fullPage:true});
  await p.click('.kpi'); await p.waitForTimeout(300); r.kpi = await st(p); await p.screenshot({path:D+`${w}-14-kpi-viewer-dark.png`}); await p.keyboard.press('Escape'); await p.waitForTimeout(250); r.kpiFocusBack = await p.evaluate(()=>document.activeElement.classList.contains('kpi'));
  await p.click('[data-trend=monthly]'); await p.click('[data-act=tblTrend]'); await p.click('[data-act=tblMethods]'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-15-dashboard-tables.png`, fullPage:true});
  await sel(p,'#dDash','empty'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-16-dashboard-empty.png`, fullPage:true});
  await sel(p,'#dRole','3'); await p.waitForTimeout(150); await p.screenshot({path:D+`${w}-17-dashboard-denied.png`});
  r.errs=errs; R['dash-'+w]=r; await p.close(); }
 console.log(JSON.stringify(R)); await b.close(); })();
