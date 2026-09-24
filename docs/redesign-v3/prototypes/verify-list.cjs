// בדיקת אב-טיפוס A1 (רשימת הזמנות) בדפדפן headless: 360/768/1024/1440, גלישה אופקית, שכבות, נעילה, מצבים.
// הרצה: node docs/redesign-v3/prototypes/verify-list.cjs  (playwright גלובלי + Chromium). כותב ל-screenshots/list/.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const path = require('path');
const F = 'file://' + path.join(__dirname, 'archetype-list.html');
const D = path.join(__dirname, 'screenshots', 'list') + '/';
const ovf = p => p.evaluate(()=>{ const bad=[]; document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width && (r.right>innerWidth+1||r.left<-1) && !el.closest('.tscroll,.statseg,#tipbox,.toasts,.drawer,.dlg .tabs')) bad.push((el.className.baseVal??el.className)+':'+Math.round(r.left)+'/'+Math.round(r.right));}); return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:bad.slice(0,6)}; });
const sel = (p, id, v) => p.evaluate(([id, v])=>{ const s=document.getElementById(id); s.value=v; s.dispatchEvent(new Event('change')); }, [id, v]);
const chk = (p, id, v) => p.evaluate(([id, v])=>{ const s=document.getElementById(id); s.checked=v; s.dispatchEvent(new Event('change')); }, [id, v]);
const layersOpen = p => p.evaluate(()=>document.querySelectorAll('#layer-root .scrim:not(.is-leaving)').length);
(async()=>{
  const b = await chromium.launch(); const res = {};
  for (const w of [360, 768, 1024, 1440]) {
    const p = await b.newPage({ignoreHTTPSErrors:true, viewport:{width:w,height:900}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    const r = res[w] = { errs };
    await p.goto(F); await p.waitForTimeout(1200);
    await p.screenshot({path:D+`${w}-01-list.png`}); r.ov1 = await ovf(p);
    const phone = w <= 640; const scope = phone ? '.clist' : '.olist';
    await p.click(`${scope} [data-exp]`); await p.waitForTimeout(350);
    await p.screenshot({path:D+`${w}-02-expanded.png`}); r.expanded = await p.evaluate(()=>!!document.querySelector('.expin'));
    await p.click(`${scope} [data-more]`); await p.waitForTimeout(300);
    await p.screenshot({path:D+`${w}-03-more-menu.png`}); r.menu = await p.evaluate(()=>!!document.querySelector('.pop') || document.querySelectorAll('#layer-root .scrim').length>0);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    // מחיקה: עוברים ללשונית "בקרוב", מוחקים את השורה הראשונה שאפשר
    const target = await p.evaluate(()=>{ const r=[...document.querySelectorAll('.olist tr.orow, .clist .ocard')].find(x=>/בקרוב/.test(x.textContent)); return r ? (r.querySelector('[data-exp]')||{}).dataset.exp : null; });
    if (target) {
      await p.evaluate(t=>{ if ([...document.querySelectorAll(`[data-del="${t}"]`)].some(x=>x.offsetParent)) return; const b=[...document.querySelectorAll(`[data-exp="${t}"]`)].find(x=>x.offsetParent); b.click(); }, target); await p.waitForTimeout(300);
      await p.evaluate(t=>{ const b=[...document.querySelectorAll(`[data-del="${t}"]`)].find(x=>x.offsetParent); b.click(); }, target); await p.waitForTimeout(350);
      await p.screenshot({path:D+`${w}-04-delete-confirm-dark.png`});
      r.lockDuringConfirm = await p.evaluate(()=>document.documentElement.hasAttribute('data-v3-lock') && document.querySelector('#page').inert && document.querySelector('.dlg').dataset.v3Mode);
      r.focusOnCancel = await p.evaluate(()=>document.activeElement && document.activeElement.textContent.trim());
      await p.click('[data-r=y]'); await p.waitForTimeout(900); await p.screenshot({path:D+`${w}-05-deleted-toast.png`});
    }
    // סינון מתקדם
    await p.click('[data-act=adv]'); await p.waitForTimeout(350); await p.screenshot({path:D+`${w}-06-adv-filter.png`});
    r.advMode = await p.evaluate(()=>document.querySelector('.dlg').dataset.v3Mode);
    await p.click('#ft-details'); await p.fill('#f-customerCity','ירושלים'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    r.stackedOnEsc = await layersOpen(p); await p.screenshot({path:D+`${w}-07-adv-leave-confirm.png`});
    await p.click('[data-r=apply]'); await p.waitForTimeout(400); r.afterApply = await layersOpen(p);
    await p.screenshot({path:D+`${w}-08-filtered-pills.png`}); r.ov8 = await ovf(p);
    // ייצוא מעל תקרה → חלון קוד (שכבה שנייה)
    await p.click('[data-act=export]'); await p.waitForTimeout(300); await p.fill('#exRows','500'); await p.click('[data-ex=excel]'); await p.waitForTimeout(400);
    r.exportStack = await layersOpen(p); await p.screenshot({path:D+`${w}-09-export-code-dark.png`});
    await p.fill('#ap-pw','0000'); await p.click('[data-go]'); await p.waitForTimeout(700); await p.screenshot({path:D+`${w}-10-code-wrong.png`});
    await p.keyboard.press('Escape'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    r.unlocked = await p.evaluate(()=>!document.documentElement.hasAttribute('data-v3-lock'));
    // אשף הדפסה בפרופיל ב׳
    await sel(p,'dProfile','org2'); await p.waitForTimeout(300); await p.click('[data-act=print]'); await p.waitForTimeout(300); await p.screenshot({path:D+`${w}-11-print-org2.png`});
    r.prepDefault = await p.evaluate(()=>document.querySelector('[name=pt]:checked').value); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    // מצבים
    await sel(p,'dLoad','loading'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-12-loading.png`});
    await sel(p,'dLoad','error'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-13-error.png`});
    await sel(p,'dLoad','ok'); await p.fill('#q','לא קיים בכלל'); await p.press('#q','Enter'); await p.waitForTimeout(300); await p.screenshot({path:D+`${w}-14-empty.png`});
    await sel(p,'dProfile','max'); await p.waitForTimeout(300); await p.click('[data-act=clearAll]'); await p.waitForTimeout(300);
    await p.screenshot({path:D+`${w}-15-extreme.png`}); r.ovMax = await ovf(p);
    await sel(p,'dData','many'); await p.waitForTimeout(400); r.pagesMany = await p.evaluate(()=>document.querySelector('.pg-info') && document.querySelector('.pg-info').textContent);
    await p.close();
  }
  console.log(JSON.stringify(res,null,1)); await b.close();
})();
