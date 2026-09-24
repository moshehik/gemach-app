const { chromium } = require(process.env.PW);
const U = 'http://127.0.0.1:8765/index.html';
(async () => {
  const b = await chromium.launch(); const log = [];
  const open = async (q, w = 1440, h = 900) => { const p = await b.newPage({ viewport: { width: w, height: h } }); p.__errs = []; p.on('pageerror', e => p.__errs.push(e.message)); await p.goto(U + q); await p.waitForTimeout(900); return p; };
  const calls = (p, f) => p.evaluate((f) => window.__calls.filter(c => c.u.startsWith(f)), f);
  // 1. edit -> change -> rail -> undo/redo -> save (PUT payload)
  let p = await open('?profile=org2');
  await p.getByRole('button', { name: 'עריכה' }).click(); await p.waitForTimeout(200);
  await p.locator('input[name=phone2]').fill('025810091'); await p.locator('input[name=city]').fill('בית שמש'); await p.waitForTimeout(200);
  log.push('rail rows after 2 edits: ' + await p.locator('.v3p-rail .v3p-chg').count());
  await p.screenshot({ path: 'pshots/1440-editing.png', fullPage: true });
  await p.getByRole('button', { name: 'ביטול השינוי בעיר' }).first().click(); await p.waitForTimeout(200);
  log.push('after undo city value=' + await p.locator('input[name=city]').inputValue() + ' undoneRows=' + await p.locator('.v3p-rail .v3p-chg--undone').count());
  await p.getByRole('button', { name: 'החזרת השינוי בעיר' }).first().click(); await p.waitForTimeout(200);
  log.push('after redo city=' + await p.locator('input[name=city]').inputValue());
  await p.locator('.v3p-rail').getByRole('button', { name: 'שמירת השינויים' }).click(); await p.waitForTimeout(900);
  const put = (await calls(p, '/api/customers/c1')).find(c => c.m === 'PUT');
  log.push('PUT keys has orders=' + !!(put && put.body.orders) + ' email=' + (put && put.body.email) + ' phone2=' + (put && put.body.phone2) + ' updatedAt sent=' + !!(put && put.body.updatedAt));
  log.push('notice shown=' + await p.locator('.v3ov-notice').count() + ' railRows=' + await p.locator('.v3p-rail .v3p-chg').count() + ' editing closed? ' + !(await p.locator('input[name=phone2]').count()));
  await p.screenshot({ path: 'pshots/1440-saved-notice.png' });
  // 2. mail: approve wrong then right, send via drive
  await p.getByRole('button', { name: 'מייל ללקוח' }).click(); await p.waitForTimeout(700);
  log.push('approve default selected=' + await p.locator('.v3p-appr[aria-selected=true]').innerText().catch(() => 'none'));
  await p.screenshot({ path: 'pshots/1440-approve.png' });
  await p.getByLabel('הסיסמה של המאשר').fill('0000'); await p.getByRole('button', { name: 'אישור' }).click(); await p.waitForTimeout(500);
  log.push('wrong pw err=' + await p.locator('.v3p-err').innerText());
  await p.getByLabel('הסיסמה של המאשר').fill('secret-123'); await p.getByRole('button', { name: 'אישור' }).click(); await p.waitForTimeout(700);
  const vp = (await calls(p, '/api/auth/verify-pin')).pop(); log.push('verify-pin body=' + JSON.stringify(vp.body));
  log.push('mail layer mode=' + await p.locator('[data-v3-layer-type=form]').getAttribute('data-v3-mode'));
  await p.getByLabel('נושא').fill('תזכורת'); await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  log.push('lock after esc=' + await p.evaluate(() => 'v3Lock' in document.documentElement.dataset));
  await p.getByRole('button', { name: 'מייל ללקוח' }).click(); await p.waitForTimeout(600);
  await p.getByLabel('הסיסמה של המאשר').fill('secret-123'); await p.getByRole('button', { name: 'אישור' }).click(); await p.waitForTimeout(700);
  log.push('draft kept subject=' + await p.getByLabel('נושא').inputValue());
  await p.getByLabel('תוכן ההודעה').fill('שלום'); await p.getByRole('button', { name: 'קישור מהדרייב' }).click();
  await p.getByRole('button', { name: 'שליחה' }).click(); await p.waitForTimeout(700);
  const se = (await calls(p, '/api/send-email')).pop(); log.push('send-email keys=' + Object.keys(se.body).join(',') + ' username=' + se.body.username + ' sendMode=' + se.body.sendMode);
  log.push('sent banner=' + (await p.locator('.v3-banner--success').innerText()).replace(/\n/g, ' | '));
  await p.screenshot({ path: 'pshots/1440-mail-sent.png' });
  await p.waitForTimeout(2800); log.push('lock after auto close=' + await p.evaluate(() => 'v3Lock' in document.documentElement.dataset));
  // 3. unblock
  await p.getByRole('button', { name: 'ביטול החסימה' }).click(); await p.waitForTimeout(400);
  await p.screenshot({ path: 'pshots/1440-unblock-confirm.png' });
  await p.locator('.v3ov-btn--primary').click(); await p.waitForTimeout(500);
  const pa = (await calls(p, '/api/customers/c1')).find(c => c.m === 'PATCH'); log.push('PATCH body=' + JSON.stringify(pa.body) + ' banner gone=' + !(await p.locator('.v3p-block').count()));
  // 4. back with changes -> 3-way
  try {
  log.push('before4 layers=' + await p.locator('.v3ov-scrim').count() + ' editBtn=' + await p.getByRole('button', { name: 'עריכה', exact: true }).count());
  await p.locator('input[name=street]').fill('עמוס'); await p.getByRole('button', { name: 'חזרה' }).click(); await p.waitForTimeout(400);
  log.push('3way buttons=' + (await p.locator('.v3ov-actions button').allInnerTexts()).join(' / '));
  await p.screenshot({ path: 'pshots/1440-exit-3way.png' });
  await p.getByRole('button', { name: 'יציאה בלי לשמור' }).click(); await p.waitForTimeout(200);
  log.push('nav=' + JSON.stringify(await p.evaluate(() => window.__navLog)));
  // tabs screenshots
  for (const tab of ['הזמנות', 'תשלומים', 'זיכוי ובנק', 'היסטוריה']) { await p.getByRole('tab', { name: tab }).click(); await p.waitForTimeout(400); await p.screenshot({ path: `pshots/1440-tab-${tab}.png`, fullPage: true }); }
  await p.getByRole('tab', { name: 'הזמנות' }).click(); await p.locator('tbody tr').first().click(); await p.waitForTimeout(100);
  log.push('row click nav=' + JSON.stringify((await p.evaluate(() => window.__navLog)).slice(-1)));
  } catch (e) { log.push('ERR ' + e.message.split('\n')[0]); await p.screenshot({ path: 'pshots/err.png' }); }
  log.push('page errors=' + JSON.stringify(p.__errs)); await p.close();
  console.log(log.join('\n')); await b.close();
})();
