const { chromium } = require(process.env.PW);
const U = 'http://127.0.0.1:8765/index.html';
(async () => {
  const b = await chromium.launch(); const log = [];
  const open = async (q, w = 360, h = 800) => { const p = await b.newPage({ viewport: { width: w, height: h } }); p.__errs = []; p.on('pageerror', e => p.__errs.push(e.message)); await p.goto(U + q); await p.waitForTimeout(900); return p; };
  try {
    let p = await open('?profile=org2');
    await p.screenshot({ path: 'pshots/360-details.png', fullPage: true });
    await p.getByRole('button', { name: 'עריכה', exact: true }).click(); await p.locator('input[name=phone2]').fill('025810099'); await p.waitForTimeout(200);
    log.push('railbar text=' + await p.locator('.v3p-railbar__open').innerText());
    await p.locator('.v3p-railbar__open').click(); await p.waitForTimeout(500);
    log.push('sheet open lock=' + await p.evaluate(() => 'v3Lock' in document.documentElement.dataset) + ' rows=' + await p.locator('.v3p-sheet-rail .v3p-chg').count());
    await p.screenshot({ path: 'pshots/360-sheet.png' });
    await p.keyboard.press('Escape'); await p.waitForTimeout(300);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); log.push('360 overflowX edit=' + ov);
    await p.getByRole('button', { name: 'מייל ללקוח' }).click(); await p.waitForTimeout(700); await p.screenshot({ path: 'pshots/360-approve.png' });
    await p.close();
    // long values 360
    p = await open('?profile=org2&long=1'); log.push('long overflowX=' + await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
    await p.getByRole('tab', { name: 'תשלומים' }).click(); await p.waitForTimeout(300); await p.screenshot({ path: 'pshots/360-long-payments.png', fullPage: true });
    log.push('long payments overflowX=' + await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); await p.close();
    // load error
    p = await open('?fail=load', 1024); log.push('load error text=' + (await p.locator('.v3-empty').innerText()).split('\n')[0]); await p.screenshot({ path: 'pshots/1024-load-error.png' }); await p.close();
    // history error
    p = await open('?fail=history', 1024); await p.getByRole('tab', { name: 'היסטוריה' }).click(); await p.waitForTimeout(300); log.push('history err=' + (await p.locator('.v3-banner').innerText()).split('\n')[0]); await p.close();
    // 409
    p = await open('?fail=save409', 1024); await p.getByRole('tab', { name: 'זיכוי ובנק' }).click(); await p.locator('input[name=bankAccount]').fill('123456'); await p.locator('.v3p-rail').getByRole('button', { name: 'שמירת השינויים' }).click(); await p.waitForTimeout(700);
    log.push('409 dialog=' + (await p.locator('.v3ov-title').innerText())); await p.screenshot({ path: 'pshots/1024-conflict.png' }); await p.close();
    // format error on save
    p = await open('', 1024); await p.getByRole('button', { name: 'עריכה', exact: true }).click(); await p.locator('input[name=phone2]').fill('0527134455'); await p.locator('input[name=firstName]').fill('');
    await p.locator('.v3p-rail').getByRole('button', { name: 'שמירת השינויים' }).click(); await p.waitForTimeout(400);
    log.push('format toast=' + (await p.locator('.v3ov-toast').last().innerText()).replace(/\n/g, ' | ') + ' firstNameErr=' + (await p.locator('.v3-error').first().innerText()));
    log.push('PUT calls=' + (await p.evaluate(() => window.__calls.filter(c => c.m === 'PUT').length)));
    await p.close();
    // new customer, org2 (id required) and minimal
    for (const prof of ['org2', 'minimal']) {
      p = await open(`?id=new&profile=${prof}`, 768);
      await p.getByRole('button', { name: 'יצירת הלקוח' }).click(); await p.waitForTimeout(300);
      const errs = await p.locator('.v3-error').allInnerTexts(); log.push(`new ${prof} errors=${errs.length}: ${[...new Set(errs)].join(' ; ')}`);
      log.push(`new ${prof} consent switch=${await p.locator('[role=switch]').count()} zeoutReq=${await p.locator('input[name=zeout][required]').count()}`);
      await p.screenshot({ path: `pshots/768-new-${prof}.png`, fullPage: true }); await p.close();
    }
    // org1: consent hidden
    p = await open('?profile=org1', 1440); log.push('org1 consent row=' + await p.getByText('מאשר/ת לקבל עדכונים').count()); await p.close();
    // role not head: no unblock
    p = await open('?role=4', 1440); log.push('role4 unblock btn=' + await p.getByRole('button', { name: 'ביטול החסימה' }).count()); await p.close();
    // no legacyId
    p = await open('?data=nonum', 1440); log.push('nonum chip=' + await p.getByText('ללא מספר לקוח').count()); await p.close();
    // sparse: no email -> mail flow confirm
    p = await open('?data=sparse', 1440); await p.getByRole('button', { name: 'מייל ללקוח' }).click(); await p.waitForTimeout(400); log.push('no-mail dialog=' + await p.locator('.v3ov-title').innerText());
    await p.close();
  } catch (e) { log.push('ERR ' + e.message.split('\n')[0]); }
  console.log(log.join('\n')); await b.close();
})();
