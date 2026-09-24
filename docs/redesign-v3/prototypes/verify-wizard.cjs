// בדיקת אב-טיפוס A3 (הזמנה חדשה) בדפדפן headless: 360/768/1024/1440 — זרימה מלאה, שכבות, נעילה, פרופילים.
// הרצה: node docs/redesign-v3/prototypes/verify-wizard.cjs  (playwright גלובלי + Chromium). כותב ל-screenshots/wizard/.
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const path = require('path');
const F = 'file://' + path.join(__dirname, 'archetype-wizard.html');
const D = path.join(__dirname, 'screenshots', 'wizard') + '/';
const ovf = p => p.evaluate(()=>{ const bad=[]; document.querySelectorAll('body *').forEach(el=>{const r=el.getBoundingClientRect(); if(r.width && (r.right>innerWidth+1||r.left<-1) && !el.closest('#tipbox,.toasts,.drawer')) bad.push((el.className.baseVal??el.className)+':'+Math.round(r.left)+'/'+Math.round(r.right));}); return {sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,bad:bad.slice(0,6)}; });
const sel = (p, id, v) => p.evaluate(([id, v])=>{ const s=document.getElementById(id); s.value=v; s.dispatchEvent(new Event('change',{bubbles:true})); }, [id, v]);
const chk = (p, id, v) => p.evaluate(([id, v])=>{ const s=document.getElementById(id); s.checked=v; s.dispatchEvent(new Event('change',{bubbles:true})); }, [id, v]);
const layersOpen = p => p.evaluate(()=>document.querySelectorAll('#layer-root .scrim:not(.is-leaving)').length);
const iso = n => { const d = new Date(2026, 8, 24 + n); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const setDate = (p, s, v) => p.evaluate(([s, v])=>{ const i=document.querySelector(s); i.value=v; i.dispatchEvent(new Event('change',{bubbles:true})); }, [s, v]);
(async()=>{
  const b = await chromium.launch(); const res = {};
  for (const w of [360, 768, 1024, 1440]) {
    const p = await b.newPage({ignoreHTTPSErrors:true, viewport:{width:w,height:900}});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    const r = res[w] = { errs };
    await p.goto(F); await p.waitForTimeout(1000);
    await p.screenshot({path:D+`${w}-01-step1.png`}); r.ov1 = await ovf(p);
    // לקוחה חסומה → חלון אישור (כהה) → ביטול
    await p.fill('#ph-q','0523333333'); await p.click('#phoneForm [type=submit]'); await p.waitForTimeout(800);
    await p.click('[data-pick="c4"]'); await p.waitForTimeout(700); await p.screenshot({path:D+`${w}-02-blocked-code.png`});
    r.blockedDlg = await p.evaluate(()=>document.querySelector('.dlg') && document.querySelector('.dlg').dataset.v3Mode);
    await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    // לקוחה רגילה
    await p.click('[data-ctab=phone]'); await p.fill('#ph-q','0521111111'); await p.click('#phoneForm [type=submit]'); await p.waitForTimeout(800);
    await p.screenshot({path:D+`${w}-03-phone-result.png`});
    await p.click('[data-pick="c1"]'); await p.waitForTimeout(400); r.stepAfterPick = await p.evaluate(()=>document.querySelector('[aria-current=step]').dataset.step);
    await setDate(p, '#d-ev', iso(21)); await p.waitForTimeout(300); await p.screenshot({path:D+`${w}-04-step2.png`}); r.ov4 = await ovf(p);
    await p.click('[data-act=next]'); await p.waitForTimeout(400);
    await p.click('#md-q'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-05-model-list.png`});
    await p.click('[data-model="m1"]'); await p.waitForTimeout(200); await p.click('[data-size="36"]'); await p.click('[data-size="42"]'); await p.waitForTimeout(150);
    await p.screenshot({path:D+`${w}-06-sizes.png`});
    await p.click('[data-act=add]'); await p.waitForTimeout(2200); await p.screenshot({path:D+`${w}-07-cart.png`}); r.ov7 = await ovf(p);
    r.draft = await p.evaluate(()=>document.querySelector('#phChips').textContent.includes('53581'));
    await p.click('[data-act=next]'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-08-summary.png`}); r.ov8 = await ovf(p);
    await p.click('[data-act=next]'); await p.waitForTimeout(400); await p.screenshot({path:D+`${w}-09-payment.png`}); r.ov9 = await ovf(p);
    // חיוב אשראי: הצלחה → שמירה
    await p.click('[data-act=save]'); await p.waitForTimeout(400); r.creditMode = await p.evaluate(()=>document.querySelector('.dlg').dataset.v3Mode);
    await p.click('[data-go]'); await p.waitForTimeout(200); await p.screenshot({path:D+`${w}-10-credit-errors.png`});
    await p.fill('#cr-card','4580123456789012'); await p.fill('#cr-exp','0829'); await p.screenshot({path:D+`${w}-11-credit-filled.png`});
    await p.click('[data-go]'); await p.waitForTimeout(1500); await p.waitForTimeout(1400);
    await p.screenshot({path:D+`${w}-12-saved-notice.png`}); r.saved = await p.evaluate(()=>!!document.querySelector('.result'));
    r.unlocked = await p.evaluate(()=>!document.documentElement.hasAttribute('data-v3-lock'));
    // פרופיל ב׳: משלוח + יציאה באישור מנהל
    await sel(p,'dProfile','org2'); await p.click('[data-act=restart]'); await p.waitForTimeout(300);
    await p.fill('#ph-q','0522222222'); await p.click('#phoneForm [type=submit]'); await p.waitForTimeout(800); await p.screenshot({path:D+`${w}-13-two-matches.png`});
    await p.click('[data-pick="c3"]'); await p.waitForTimeout(400);
    await setDate(p, '#d-ev', iso(30)); await chk(p,'o-del',true); await p.waitForTimeout(250); await sel(p,'o-city','ירושלים'); await p.waitForTimeout(300);
    await p.screenshot({path:D+`${w}-14-delivery-addr-required.png`}); r.navBlocked = await p.evaluate(()=>document.querySelector('[data-act=next]').disabled);
    await p.fill('#o-addr','הרב קוק 3'); await p.waitForTimeout(150); r.navOpen = await p.evaluate(()=>!document.querySelector('[data-act=next]').disabled);
    await p.click('[data-act=next]'); await p.waitForTimeout(300); await p.click('#md-q'); await p.click('[data-model="m2"]'); await p.click('[data-size="36"]'); await p.click('[data-act=add]'); await p.waitForTimeout(600);
    await p.click('[data-act=next]'); await p.waitForTimeout(300); await p.screenshot({path:D+`${w}-15-summary-delivery.png`});
    await p.click('[data-act=next]'); await p.waitForTimeout(300); await sel(p,'p-m','יציאה באישור מנהל'); await p.waitForTimeout(200);
    await p.click('[data-act=save]'); await p.waitForTimeout(1500); r.mgrSaved = await p.evaluate(()=>!!document.querySelector('.result'));
    // קיצוני: לקוח חדש עם שגיאות
    await sel(p,'dProfile','max'); await p.click('[data-act=restart]'); await p.waitForTimeout(300); await p.click('[data-ctab=new]'); await p.waitForTimeout(200);
    await p.fill('#nc-firstName','אסתר'); await p.fill('#nc-phone1','12345'); await p.click('#ncForm [type=submit]'); await p.waitForTimeout(400);
    await p.screenshot({path:D+`${w}-16-new-customer-errors.png`, fullPage:false}); r.ov16 = await ovf(p);
    // יציאה עם טיוטה (dialog) + Esc
    await p.click('#exitBtn'); await p.waitForTimeout(100); r.exitNoData = await layersOpen(p);
    await p.close();
  }
  console.log(JSON.stringify(res,null,1)); await b.close();
})();
