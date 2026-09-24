// בדיקת אב-הטיפוס בדפדפן headless: זרימה מלאה ב-360/768/1024/1440, בדיקת גלישה אופקית, נעילת גלילה ושכבות.
// הרצה: node docs/redesign-v3/prototypes/verify-prototype.cjs  (צריך playwright גלובלי + Chromium).
// הערה: כותב צילומים לתיקיית screenshots/ (מחליף קבצים בשם זהה) — בוחרים ידנית אילו להשאיר ב-repo.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const path = require('path');
const F = 'file://' + path.join(__dirname, 'archetype-detail-card.html');
const D = path.join(__dirname, 'screenshots') + '/';
const ovf = p => p.evaluate(()=>{ const bad=[]; document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width && (r.right>innerWidth+1||r.left<-1) && !el.closest('.tabs,.tbl-wrap,#tipbox,.toasts,.drawer')) bad.push((el.className.baseVal??el.className)+':'+Math.round(r.left)+'/'+Math.round(r.right));}); return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:bad.slice(0,6)}; });
(async()=>{
  const b = await chromium.launch(); const res = {};
  for (const w of [360, 768, 1024, 1440]) {
    const p = await b.newPage({ignoreHTTPSErrors:true, viewport:{width:w,height:900}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(F); await p.waitForTimeout(1500);
    await p.screenshot({path:D+`${w}-01-details.png`});
    await p.click('#editBtn'); await p.fill('#f-phone2','0501112233'); await p.fill('#f-city','בית שמש'); await p.waitForTimeout(200);
    await p.screenshot({path:D+`${w}-02-editing.png`});
    // undo + redo
    if (w >= 1024) { await p.click('[data-undo=city]'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-03-undo.png`}); await p.click('[data-redo=city]'); }
    else { await p.click('[data-act=openSheet]'); await p.waitForTimeout(350); await p.click('#rail [data-undo=city]'); await p.waitForTimeout(250); await p.screenshot({path:D+`${w}-03-sheet-undo.png`}); await p.click('#rail [data-redo=city]'); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    const cnt = await p.evaluate(()=>document.querySelectorAll('.chg:not(.undone)').length);
    for (const t of ['orders','payments','refunds','history']) { await p.click(`#t-${t}`); await p.waitForTimeout(200); }
    await p.click('#t-payments'); await p.click('[data-pay=p1]'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-04-payments.png`});
    await p.click('#t-history'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-05-history.png`});
    await p.click('#t-details');
    await p.click('#mailBtn'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-06-code-dark.png`});
    const lock = await p.evaluate(()=>document.documentElement.hasAttribute('data-v3-lock') && document.querySelector('#page').inert);
    for (const i of [0,1,2,3]) await p.fill(`[data-pin="${i}"]`, String(i+1));
    await p.click('[data-go]'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-07-email-form.png`});
    await p.fill('#m-sub','בדיקה'); await p.click('.dlg [data-cancel]'); await p.waitForTimeout(350); await p.screenshot({path:D+`${w}-08-stacked-confirm.png`});
    const stacked = await p.evaluate(()=>document.querySelectorAll('#layer-root .scrim:not(.is-leaving)').length);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    const afterEsc = await p.evaluate(()=>document.querySelectorAll('#layer-root .scrim:not(.is-leaving)').length);
    await p.click('#backBtn'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-09-exit-3way.png`});
    await p.click('[data-r=save]'); await p.waitForTimeout(1400); await p.screenshot({path:D+`${w}-10-saved-notice.png`});
    const unlocked = await p.evaluate(()=>!document.documentElement.hasAttribute('data-v3-lock'));
    // extreme profile
    await p.evaluate(()=>{ const s=document.querySelector('#dProfile'); s.value='max'; s.dispatchEvent(new Event('change')); });
    await p.waitForTimeout(300); const ovMax = await ovf(p); await p.screenshot({path:D+`${w}-11-extreme-profile.png`});
    await p.evaluate(()=>{ const s=document.querySelector('#dMode'); s.value='new'; s.dispatchEvent(new Event('change')); });
    await p.waitForTimeout(200); await p.click('#newForm [type=submit]'); await p.waitForTimeout(300); const ovNew = await ovf(p); await p.screenshot({path:D+`${w}-12-new-customer-errors.png`});
    await p.evaluate(()=>{ const s=document.querySelector('#dMode'); s.value='card'; s.dispatchEvent(new Event('change')); const t=document.querySelector('#dTheme'); t.click(); });
    await p.click('#mailBtn'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-13-code-light.png`});
    res[w] = { errs, cnt, lock, stacked, afterEsc, unlocked, ovMax, ovNew };
    await p.close();
  }
  console.log(JSON.stringify(res,null,1)); await b.close();
})();
