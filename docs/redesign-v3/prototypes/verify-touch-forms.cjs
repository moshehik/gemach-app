// בדיקת אבות-הטיפוס A6 (מגע) ו-A7 (טפסים) בדפדפן headless: 360/768/1024/1440 + עמדה גבוהה/נמוכה.
// הרצה: node docs/redesign-v3/prototypes/verify-touch-forms.cjs  (playwright גלובלי + Chromium).
// כותב צילומים ל-screenshots/touch ו-screenshots/forms (מחליף קבצים בשם זהה).
const { chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const path = require('path');
const T = 'file://' + path.join(__dirname, 'archetype-touch.html');
const F = 'file://' + path.join(__dirname, 'archetype-forms.html');
const D = path.join(__dirname, 'screenshots') + '/';
const which = process.argv[2] || 'all';
const ovf = p => p.evaluate(() => { const bad = []; document.querySelectorAll('body *').forEach(el => { const r = el.getBoundingClientRect(); if (r.width && (r.right > innerWidth + 1 || r.left < -1) && !el.closest('.tbl-wrap,#tipbox,.toasts,.drawer,[hidden]') && getComputedStyle(el).visibility !== 'hidden') bad.push(((el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className) || el.tagName) + ':' + Math.round(r.left) + '/' + Math.round(r.right)); }); return { sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bad: bad.slice(0, 6) }; });
const small = p => p.evaluate(() => { const bad = []; document.querySelectorAll('button:not([disabled]),input:not([type=hidden]):not([type=checkbox]):not([type=range]),select,[role=button],a[href]').forEach(el => { const r = el.getBoundingClientRect(); if (!r.width || el.closest('.demo-panel,.demo-fab,.demo,[hidden],.tip')) return; if (Math.min(r.width, r.height) < 44) bad.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 24) + ':' + Math.round(r.width) + 'x' + Math.round(r.height)); }); return bad.slice(0, 8); });
module.exports = { ovf, small };
(async () => {
  const b = await chromium.launch(); const res = {};
  if (which === 'all' || which === 'touch') {
    for (const [w, h] of [[360, 780], [768, 1024], [1024, 768], [1440, 900], [1080, 1920], [1366, 600]]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 1024 });
      const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto(T); await p.waitForTimeout(800);
      const tag = `${w}x${h}`; const r = { errs };
      await p.screenshot({ path: D + `touch/${tag}-01-date.png` }); r.ovDate = await ovf(p); r.small1 = await small(p);
      await p.evaluate(() => { const s = document.querySelector('#dProfile'); s.value = 'org2'; s.dispatchEvent(new Event('change')); });
      await p.waitForTimeout(200); await p.screenshot({ path: D + `touch/${tag}-02-date-reg.png` }); r.ovReg = await ovf(p);
      await p.click('#regForm [type=submit]'); await p.waitForTimeout(200); r.regErrs = await p.evaluate(() => document.querySelectorAll('.field.is-err').length);
      await p.fill('#r-firstName', 'רבקה'); await p.fill('#r-lastName', 'כהן'); await p.fill('#r-phone1', '0521234567'); await p.click('#regForm [type=submit]'); await p.waitForTimeout(900);
      r.regServer = await p.evaluate(() => (document.querySelector('.errbox .b-t span') || {}).textContent || '');
      await p.screenshot({ path: D + `touch/${tag}-03-reg-server-error.png` });
      const day = await p.$$('.day:not(.muted)'); await day[10].click(); await p.waitForTimeout(900);
      await p.screenshot({ path: D + `touch/${tag}-04-catalog.png` }); r.ovCat = await ovf(p); r.small2 = await small(p);
      await p.click('[data-act=panel]'); await p.waitForTimeout(400); await p.screenshot({ path: D + `touch/${tag}-05-filters.png` });
      if (w < 1024) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); } else { await p.click('[data-act=panel]'); }
      await p.click('[data-model] .d-name'); await p.waitForTimeout(800); await p.screenshot({ path: D + `touch/${tag}-06-orders-viewer.png` });
      r.lockViewer = await p.evaluate(() => document.documentElement.hasAttribute('data-v3-lock') && document.querySelector('#app').inert);
      await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      await p.click('[data-act=lock]'); await p.waitForTimeout(400); await p.screenshot({ path: D + `touch/${tag}-07-locked.png` });
      r.topbarHidden = await p.evaluate(() => document.querySelector('#topbar').hidden);
      await p.click('[data-act=unlock]'); await p.waitForTimeout(350);
      await p.click('#ul-list .appr'); await p.fill('#ul-pw', '0000'); await p.click('[data-go]'); await p.waitForTimeout(800);
      await p.screenshot({ path: D + `touch/${tag}-08-unlock-dark-wrong.png` }); r.unlockErr = await p.evaluate(() => document.querySelector('#ulErr').textContent);
      await p.fill('#ul-pw', 'secret1'); await p.click('[data-go]'); await p.waitForTimeout(900);
      r.unlocked = await p.evaluate(() => !document.querySelector('#topbar').hidden && !document.documentElement.hasAttribute('data-v3-lock'));
      for (const m of ['grid', 'table']) {
        if (w < 1024) { await p.click('[data-act=panel]'); await p.waitForTimeout(350); await p.click(`#layer-root [data-mode=${m}]`); await p.keyboard.press('Escape'); }
        else { await p.click('[data-act=panel]'); await p.waitForTimeout(150); await p.click(`[data-mode=${m}]`); await p.click('[data-act=panel]'); }
        await p.waitForTimeout(350); await p.screenshot({ path: D + `touch/${tag}-08b-view-${m}.png` }); r['ov_' + m] = await ovf(p);
      }
      await p.evaluate(() => { document.querySelector('#dTheme').click(); });
      await p.click('[data-act=lock]'); await p.waitForTimeout(300); await p.click('[data-act=print]'); await p.waitForTimeout(350);
      await p.screenshot({ path: D + `touch/${tag}-08c-print-approve-light.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      r.stillLocked = await p.evaluate(() => document.querySelector('#topbar').hidden);
      await p.click('[data-act=unlock]'); await p.waitForTimeout(300); await p.click('#ul-list .appr'); await p.fill('#ul-pw', 'secret1'); await p.click('[data-go]'); await p.waitForTimeout(900);
      await p.evaluate(() => { const s = document.querySelector('#dScreen'); s.value = 'punch'; s.dispatchEvent(new Event('change')); });
      await p.waitForTimeout(300); await p.screenshot({ path: D + `touch/${tag}-09-punch.png` }); r.ovPunch = await ovf(p); r.small3 = await small(p);
      await p.click('[data-punch=IN]'); await p.waitForTimeout(200); r.punchNoEmp = await p.evaluate(() => !!document.querySelector('.attnbox'));
      await p.click('#pcEmp'); await p.fill('#pcEmp', 'נחמה'); await p.waitForTimeout(150); await p.screenshot({ path: D + `touch/${tag}-10-punch-combo.png` });
      await p.click('[data-emp=e1]'); await p.fill('#pcPw', 'abcd1234'); await p.click('[data-punch=OUT]'); await p.waitForTimeout(500);
      await p.screenshot({ path: D + `touch/${tag}-11-laundress-confirm.png` });
      await p.click('[data-r=go]'); await p.waitForTimeout(1000); await p.screenshot({ path: D + `touch/${tag}-12-punch-ok.png` });
      r.punchOk = await p.evaluate(() => (document.querySelector('.okbox b') || {}).textContent || '');
      res['touch-' + tag] = r; await p.close();
    }
  }
  if (which === 'all' || which === 'forms') {
    for (const w of [360, 768, 1024, 1440]) {
      const p = await b.newPage({ viewport: { width: w, height: 900 } });
      const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
      await p.goto(F); await p.waitForTimeout(900); const r = { errs };
      await p.screenshot({ path: D + `forms/${w}-01-profile.png`, fullPage: true }); r.ov1 = await ovf(p);
      await p.fill('#f-phone1', '0529998877'); await p.fill('#f-city', 'בני ברק'); await p.fill('#f-email', 'not-an-email'); await p.waitForTimeout(150);
      await p.screenshot({ path: D + `forms/${w}-02-changed.png` });
      r.changed = await p.evaluate(() => document.querySelectorAll('.field.is-changed').length);
      await p.click('[data-act=save]'); await p.waitForTimeout(300); r.emailErr = await p.evaluate(() => (document.querySelector('#e-email') || {}).textContent || '');
      await p.screenshot({ path: D + `forms/${w}-03-email-error.png` });
      await p.fill('#f-email', 'rivka@example.com'); await p.click('[data-act=save]'); await p.waitForTimeout(1100);
      await p.screenshot({ path: D + `forms/${w}-04-saved-notice.png` }); r.notice = await p.evaluate(() => !!document.querySelector('.notice'));
      await p.click('[data-act=pwOpen]'); await p.waitForTimeout(200); await p.fill('#pw-old', '0000'); await p.fill('#pw-new', '12'); await p.click('[data-act=pwGo]'); await p.waitForTimeout(300);
      r.pwShort = await p.evaluate(() => (document.querySelector('#pwErr') || {}).textContent || '');
      await p.fill('#pw-new', 'abcd12'); await p.click('[data-act=pwGo]'); await p.waitForTimeout(900); r.pwOld = await p.evaluate(() => (document.querySelector('#pwErr') || {}).textContent || '');
      await p.screenshot({ path: D + `forms/${w}-05-password.png` });
      await p.fill('#f-lastName', 'x'); await p.click('[data-act=back]'); await p.waitForTimeout(400); await p.screenshot({ path: D + `forms/${w}-06-leave-confirm.png` });
      r.lock = await p.evaluate(() => document.documentElement.hasAttribute('data-v3-lock') && document.querySelector('#page').inert);
      await p.keyboard.press('Escape'); await p.waitForTimeout(300);
      await p.evaluate(() => { const s = document.querySelector('#dProfile'); s.value = 'max'; s.dispatchEvent(new Event('change')); });
      await p.waitForTimeout(300); await p.screenshot({ path: D + `forms/${w}-07-extreme.png`, fullPage: true }); r.ovMax = await ovf(p);
      await p.evaluate(() => { const s = document.querySelector('#dLoad'); s.value = 'error'; s.dispatchEvent(new Event('change')); });
      await p.waitForTimeout(300); await p.screenshot({ path: D + `forms/${w}-08-load-error.png` });
      r.small = await small(p);
      res['forms-' + w] = r; await p.close();
    }
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
