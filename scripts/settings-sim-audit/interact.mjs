// בדיקת התנהגות בדפדפן (Chrome ללא מסך) של מסכי ההגדרות האמיתיים מול fetch מדומה — בלי שרת פיתוח ובלי DB.
// שימוש: node scripts/settings-sim-audit/interact.mjs   (אחרי build.mjs). צילומים: out/i-*.png. יוצא עם 1 אם בדיקה נכשלה.
import path from 'node:path';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve, launch, sleep, HERE, PORT } from './lib.mjs';

const OUT = path.join(HERE, 'out');
fs.mkdirSync(OUT, { recursive: true });
const server = await serve();
const browser = await launch();
let passed = 0;
let failed = 0;
const errors = [];
async function page(q, w = 1440, h = 900) {
  const p = await browser.newPage();
  p.on('pageerror', (e) => errors.push(`${q}: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`${q}: ${m.text()}`); });
  await p.setViewport({ width: w, height: h });
  await p.goto(`http://127.0.0.1:${PORT}/index.html?${q}`, { waitUntil: 'networkidle0' });
  await sleep(500);
  return p;
}
async function t(name, fn) {
  if (process.env.ONLY && !name.includes(process.env.ONLY)) return; // ONLY=#1 node interact.mjs — מריץ רק בדיקות שהשם שלהן מכיל את המחרוזת
  try { await fn(); passed++; console.log('  ok   -', name); }
  catch (e) { failed++; console.error('  FAIL -', name, '\n        ', e.message); }
}
const clickText = (p, sel, text) => p.evaluate((sel, text) => { const b = [...document.querySelectorAll(sel)].find((x) => x.textContent.includes(text)); if (!b) throw new Error('no ' + text); b.click(); }, sel, text);
const tab = (p, id) => p.evaluate((id) => document.querySelector(`.st-stab[aria-controls$="-${id}"]`).click(), id);
const click = (p, sel) => p.$eval(sel, (e) => { e.scrollIntoView({ block: 'center' }); e.click(); });
async function typeIn(p, sel, text) { await p.$eval(sel, (e) => { e.scrollIntoView({ block: 'center' }); e.focus(); e.select(); }); await p.keyboard.type(text); }
const posts = (p) => p.evaluate(() => window.__posts);

try {
  await t('טעינה: לשוניות sys לפי העיצוב, בלי "הגדרות נוספות" כשאין מה להציג שם', async () => {
    const p = await page('view=sys');
    const tabs = await p.$$eval('.st-stab .st-slb', (x) => x.map((e) => e.textContent));
    assert.deepEqual(tabs, ['תצורה', 'מיתוג', 'תשלומים', 'ברקודים', 'הודעות', 'אוטומציה', 'סנכרון', 'הזמנות', 'משלוחים', 'מלאי ויומן', 'הדפסה', 'תצוגה וממשק', 'לא בשימוש']);
    await p.close();
  });

  await t('מתג + שדה → פאנל "שינויים לשמירה", "שונה" בשורה, מונה בלשונית; שמירה שולחת בדיוק את השינויים', async () => {
    const p = await page('view=sys');
    await click(p, '#setting-row-require_login .sw input');
    await typeIn(p, '#setting-row-gmach_address input', 'רחוב חדש 5');
    await sleep(200);
    assert.equal(await p.$eval('.st-chgn', (e) => e.textContent), '2');
    assert.ok(await p.$('#setting-row-require_login .st-chg'));
    assert.equal(await p.$eval('.st-stab.on .st-cnt', (e) => e.textContent), '2');
    await p.screenshot({ path: path.join(OUT, 'i-dirty-desk.png') });
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(400);
    const ps = await posts(p);
    assert.equal(ps.length, 1);
    assert.deepEqual(ps[0].body, { items: [{ key: 'require_login', value: 'false' }, { key: 'gmach_address', value: 'רחוב חדש 5' }] });
    assert.ok(await p.$('.nb-success'), 'באנר נשמר');
    assert.equal(await p.$('.st-chgs:not([hidden])'), null, 'הפאנל נעלם אחרי שמירה');
    await p.close();
  });

  await t('זוג מסונכרן: ימי מרווח (BUFFER_DAYS) נשלח יחד עם inventory_buffer_days; סטפר +', async () => {
    const p = await page('view=sys');
    await click(p, '#setting-row-BUFFER_DAYS .numb.up');
    await sleep(150);
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    const ps = await posts(p);
    assert.deepEqual(ps[0].body.items, [{ key: 'BUFFER_DAYS', value: '4' }, { key: 'inventory_buffer_days', value: '4' }]);
    await p.close();
  });

  await t('מתג הפוך (hide_ai_features) כותב את אותו ערך גולמי כמו הישן', async () => {
    const p = await page('view=sys');
    await tab(p, 'disp');
    const before = await p.$eval('#setting-row-hide_ai_features .sw input', (e) => e.checked);
    await click(p, '#setting-row-hide_ai_features .sw input');
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    const ps = await posts(p);
    assert.deepEqual(ps[0].body.items, [{ key: 'hide_ai_features', value: before ? 'true' : 'false' }]);
    await p.close();
  });

  await t('ביטול שינוי בודד (cl-u), וביטול הכל עם חלון אישור (בלי confirm של הדפדפן)', async () => {
    const p = await page('view=sys');
    await click(p, '#setting-row-require_login .sw input');
    await click(p, '#setting-row-track_branch_on_order .sw input');
    await sleep(100);
    await click(p, '.st-chglist .cl-u');
    await sleep(100);
    assert.equal(await p.$eval('.st-chgn', (e) => e.textContent), '1');
    await click(p, '.st-chgact [data-act="discard"]');
    await sleep(200);
    assert.ok(await p.$('.scrim.on #dlg'));
    await p.screenshot({ path: path.join(OUT, 'i-discard-dialog.png') });
    await clickText(p, '#dlg .btn', 'בטל שינויים');
    await sleep(200);
    assert.equal(await p.$('.st-chgs:not([hidden])'), null);
    assert.equal(await p.$eval('#toast', (e) => e.className.includes('on')), true);
    await p.close();
  });

  await t('ולידציה: מספר מחוץ לטווח — שגיאה בשורה והשמירה נעולה, בלי POST', async () => {
    const p = await page('view=sys');
    await tab(p, 'ord');
    await typeIn(p, '#setting-row-max_items_per_order input', '500');
    await sleep(150);
    assert.match(await p.$eval('#setting-row-max_items_per_order .st-err', (e) => e.textContent), /המקסימום המותר הוא 100/);
    assert.equal(await p.$eval('.st-chgact [data-act="save"]', (e) => e.disabled), true);
    assert.equal((await posts(p)).length, 0);
    await p.close();
  });

  await t('בלי סשן: 401 → חלון אישור הנהלה (גלולות + סיסמה) → שליחה חוזרת עם employeeId+pin', async () => {
    const p = await page('view=sys&nosession=1');
    await click(p, '#setting-row-require_login .sw input');
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(500);
    assert.ok(await p.$('.scrim.on form#dlg'));
    const names = await p.$$eval('#dlg .st-auth-emps button', (x) => x.map((e) => e.textContent));
    assert.deepEqual(names, ['שולמית לוי', 'יוסף כהן'], 'רק הנהלה ראשית / מתכנת');
    await p.screenshot({ path: path.join(OUT, 'i-auth-dialog.png') });
    await clickText(p, '#dlg .st-auth-emps button', 'יוסף');
    await p.type('#dlg input[type=password]', '0000');
    await p.click('#dlg button[type=submit]');
    await sleep(400);
    assert.ok(await p.$eval('#dlg .st-err', (e) => /שגויה/.test(e.textContent)), 'סיסמה שגויה');
    await p.$eval('#dlg input[type=password]', (e) => { e.value = ''; });
    await p.click('#dlg input[type=password]', { clickCount: 3 });
    await p.keyboard.press('Backspace');
    await p.type('#dlg input[type=password]', '1234');
    await p.click('#dlg button[type=submit]');
    await sleep(400);
    const ps = await posts(p);
    const last = ps[ps.length - 1].body;
    assert.deepEqual(last, { items: [{ key: 'require_login', value: 'false' }], employeeId: 'e2', pin: '1234' });
    assert.equal(await p.$('.scrim.on'), null);
    await p.close();
  });

  await t('חיפוש: ספירה, מעבר ללשונית עם תוצאות, מצב ריק', async () => {
    const p = await page('view=sys');
    await p.type('.st-q', 'משלוחן');
    await sleep(200);
    assert.equal(await p.$eval('.st-stab.on .st-slb', (e) => e.textContent), 'משלוחים');
    assert.ok(Number(await p.$eval('.st-count b', (e) => e.textContent)) >= 2);
    await typeIn(p, '.st-q', 'zzzzqq');
    await sleep(200);
    assert.ok(await p.$('.st-empty'));
    await p.close();
  });

  await t('קישור עמוק ?tab=אוטומציה&highlight=late_return_email_text → לשונית הודעות + הבהוב', async () => {
    const p = await page('view=sys&tab=' + encodeURIComponent('אוטומציה') + '&highlight=late_return_email_text');
    await sleep(300);
    assert.equal(await p.$eval('.st-stab.on .st-slb', (e) => e.textContent), 'הודעות');
    assert.ok(await p.$('#setting-row-late_return_email_text.st-flash'));
    await p.close();
  });

  await t('יציאה עם שינויים: לחצן חזרה → חלון "שינויים שלא נשמרו"; "חזרה לעריכה" משאיר', async () => {
    const p = await page('view=sys');
    await click(p, '#setting-row-require_login .sw input');
    await click(p, '.topbar .back');
    await sleep(200);
    assert.ok(await p.$('.scrim.on #dlg'));
    const btns = await p.$$eval('#dlg .dbtns .btn', (x) => x.map((e) => e.textContent));
    assert.deepEqual(btns, ['שמור והמשך', 'צא בלי לשמור', 'חזרה לעריכה']);
    await p.screenshot({ path: path.join(OUT, 'i-unsaved-dialog.png') });
    await clickText(p, '#dlg .btn', 'חזרה לעריכה');
    await sleep(150);
    assert.equal(await p.$('.scrim.on'), null);
    assert.ok(await p.$('.st-chgs:not([hidden])'));
    await p.close();
  });

  await t('שדות חובה (גלולות) ואמצעי תשלום: הערך נשמר באותו פורמט של הישן', async () => {
    const p = await page('view=sys');
    await tab(p, 'ord');
    await clickText(p, '#setting-row-mandatory_fields button', 'אימייל');
    await tab(p, 'pay');
    await clickText(p, '#setting-row-ALLOWED_PAYMENT_METHODS button', 'מזומן');
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    const items = (await posts(p))[0].body.items;
    assert.deepEqual(items, [
      { key: 'mandatory_fields', value: 'שם_פרטי, שם_משפחה, טלפון_1, אימייל' },
      { key: 'ALLOWED_PAYMENT_METHODS', value: 'אשראי (דרך נדרים פלוס),יציאה באישור מנהל' },
    ]);
    await p.close();
  });

  await t('הגדרות אתר: לשוניות מסד/מערכת/מיילים, באנר מתכנת, מצב מסד עם חלון אישור (POST נפרד, לא בשמירה המרוכזת)', async () => {
    const p = await page('view=site');
    const tabs = await p.$$eval('.st-stab .st-slb', (x) => x.map((e) => e.textContent));
    assert.deepEqual(tabs, ['מסד נתונים', 'מערכת', 'מיילים']);
    assert.match(await p.$eval('.st-banners', (e) => e.textContent), /אזור למתכנת בלבד/);
    await clickText(p, '.seg.pill button', 'בדיקות');
    await sleep(150);
    await p.screenshot({ path: path.join(OUT, 'i-dbmode-dialog.png') });
    await clickText(p, '#dlg .btn', 'מעבר לבדיקות');
    await sleep(400);
    const ps = await posts(p);
    assert.deepEqual(ps, [{ url: '/api/admin/db-mode', body: { mode: 'test' } }]);
    assert.match(await p.$eval('.panel.on', (e) => e.textContent), /מצב בדיקות פעיל/);
    assert.equal(await p.$('.st-chgs:not([hidden])'), null);
    await p.close();
  });

  await t('שינוי שמות: עריכה + חזרה לברירת מחדל בשורה; שמירה שולחת את האובייקט המלא כמו הישן', async () => {
    const p = await page('view=names');
    await typeIn(p, '#setting-row-customer_lastName input', 'משפחה');
    await tab(p, 'orders');
    await click(p, '#setting-row-order_status .ibtn');
    await sleep(150);
    assert.equal(await p.$eval('.st-chgn', (e) => e.textContent), '2');
    await p.screenshot({ path: path.join(OUT, 'i-names-dirty.png') });
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    const ps = await posts(p);
    assert.equal(ps[0].url, '/api/settings/labels');
    assert.equal(ps[0].body.customer_lastName, 'משפחה');
    assert.equal(ps[0].body.order_status, 'סטטוס', 'חזרה לברירת מחדל');
    assert.equal(ps[0].body.customer_firstName, 'שם פרטי');
    assert.equal(Object.keys(ps[0].body).length, 43);
    await p.close();
  });

  await t('מצבי טעינה / שגיאה: GET נכשל → הודעת שגיאה עם "נסו שוב"', async () => {
    const p = await page('view=sys&fail=1');
    assert.match(await p.$eval('.st-state', (e) => e.textContent), /לא הצלחנו לטעון/);
    await p.close();
  });

  await t('390px: לשוניות עליונות במקום הסרגל, ובשינוי — פס שמירה תחתון; אין גלילה אופקית', async () => {
    const p = await page('view=sys', 390, 844);
    assert.equal(await p.$eval('.st-stabs', (e) => getComputedStyle(e).display), 'none');
    assert.notEqual(await p.$eval('.st-toptabs', (e) => getComputedStyle(e).display), 'none');
    await click(p, '#setting-row-require_login .sw input');
    await sleep(200);
    const bar = await p.$eval('.st-saverow', (e) => { const r = e.getBoundingClientRect(); return { vis: r.height > 0, bottom: r.bottom }; });
    assert.ok(bar.vis, 'פס שמירה');
    assert.ok(bar.bottom > 700, 'בתחתית המסך');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'גלילה אופקית');
    await click(p, '.st-saverow [data-act="discard"]');
    await sleep(150);
    await clickText(p, '#dlg .btn', 'בטל שינויים');
    await sleep(200);
    assert.equal(await p.$eval('.rail', (e) => getComputedStyle(e).display), 'none', 'בלי שינויים אין פס תחתון ריק');
    await p.screenshot({ path: path.join(OUT, 'i-dirty-mob.png') });
    await p.close();
  });

  /* ================= סבב תיקוני ביקורת 4.10.2026 ================= */

  await t('#1 סוד: פוקוס+עזיבה לא מוחקים את האישור; שמירת הגדרה אחרת לא שולחת את הסוד', async () => {
    const p = await page('view=sys');
    await tab(p, 'pay');
    await p.focus('#setting-row-nedarim_plus_token input');
    assert.equal(await p.$eval('#setting-row-nedarim_plus_token input', (e) => e.value), '••••••••', 'הפוקוס לא מנקה');
    await p.keyboard.press('Backspace'); // הכל מסומן בפוקוס, מחיקה = ריק
    await p.$eval('#setting-row-nedarim_plus_token input', (e) => e.blur());
    await sleep(100);
    assert.equal(await p.$eval('#setting-row-nedarim_plus_token input', (e) => e.value), '••••••••', 'ריק חוזר לסימון');
    assert.equal(await p.$('.st-chgs:not([hidden])'), null, 'אין שינוי ממתין');
    await click(p, '#setting-row-allow_additional_payment_on_order .sw input');
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    const items = (await posts(p))[0].body.items;
    assert.equal(items.length, 1);
    assert.equal(items[0].key, 'allow_additional_payment_on_order');
    await p.close();
  });

  await t('#1 סוד: הקלדת ערך חדש מחליפה את הסימון ונשלחת; סימון חלקי לא נשלח כערך', async () => {
    const p = await page('view=sys');
    await tab(p, 'pay');
    await p.focus('#setting-row-nedarim_plus_token input');
    await p.keyboard.type('abc123');
    assert.equal(await p.$eval('#setting-row-nedarim_plus_token input', (e) => e.value), 'abc123');
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    assert.deepEqual((await posts(p))[0].body.items, [{ key: 'nedarim_plus_token', value: 'abc123' }]);
    await p.close();
    const q = await page('view=sys');
    await tab(q, 'pay');
    await q.focus('#setting-row-nedarim_plus_token input');
    await q.$eval('#setting-row-nedarim_plus_token input', (e) => e.setSelectionRange(8, 8));
    await q.keyboard.press('Backspace');
    await q.keyboard.press('Backspace');
    await sleep(100);
    const v = await q.$eval('#setting-row-nedarim_plus_token input', (e) => e.value);
    assert.ok(!v.includes('•') || v === '••••••••', 'לעולם לא ערך של נקודות חלקיות: ' + v);
    assert.equal(await q.$('.st-chgs:not([hidden])'), null);
    await q.close();
  });

  await t('#1 סוד: "נקה ערך" עם חלון אישור שולח סימן מחיקה מפורש; ביטול החלון לא משנה כלום', async () => {
    const p = await page('view=sys');
    await tab(p, 'pay');
    assert.equal(await p.$('#setting-row-yemot_api_token [data-act="clear-secret"]'), null, 'סוד ריק — אין מה לנקות');
    await click(p, '#setting-row-nedarim_plus_token [data-act="clear-secret"]');
    await sleep(200);
    assert.ok(await p.$('.scrim.on #dlg'));
    await clickText(p, '#dlg .btn', 'ביטול');
    await sleep(150);
    assert.equal(await p.$('.st-chgs:not([hidden])'), null);
    await click(p, '#setting-row-nedarim_plus_token [data-act="clear-secret"]');
    await sleep(200);
    await clickText(p, '#dlg .btn', 'נקה ערך');
    await sleep(150);
    assert.ok(await p.$('.st-chgs:not([hidden])'));
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(300);
    assert.deepEqual((await posts(p))[0].body.items, [{ key: 'nedarim_plus_token', value: '__CLEAR_SECRET__' }]);
    await p.close();
  });

  await t('#2 חיפוש: שורות שלא תואמות באמת מוסתרות (display בפועל), לא רק [hidden]', async () => {
    const p = await page('view=sys');
    await tab(p, 'dlv');
    await p.type('.st-q', 'משלוחן');
    await sleep(250);
    const r = await p.evaluate(() => {
      const rows = [...document.querySelectorAll('.panel.on .st-row')];
      const shown = rows.filter((e) => getComputedStyle(e).display !== 'none');
      return { total: rows.length, shown: shown.map((e) => e.dataset.set || e.id), hiddenAttrButVisible: rows.filter((e) => e.hidden && getComputedStyle(e).display !== 'none').length };
    });
    assert.ok(r.total > 3, 'יש שורות בלשונית');
    assert.equal(r.hiddenAttrButVisible, 0, 'שורה עם hidden נשארה גלויה');
    assert.ok(r.shown.length >= 1 && r.shown.length < r.total, 'רק התוצאות מוצגות: ' + r.shown.join(','));
    await p.close();
  });

  await t('#3 web_backup_mode (דגל המעבר החי) לא מוצג כמתג רגיל באף לשונית', async () => {
    const p = await page('view=site');
    const ids = await p.$$eval('.st-stab', (x) => x.map((e) => e.getAttribute('aria-controls').replace(/^p-site-/, '')));
    assert.ok(ids.length >= 3);
    for (const id of ids) {
      await tab(p, id);
      await sleep(80);
      assert.equal(await p.$('#setting-row-web_backup_mode'), null, 'לשונית ' + id);
    }
    assert.ok((await p.content()).includes('data-set') && !(await p.content()).includes('web_backup_mode'));
    await p.close();
  });

  await t('#4 החלפת מסד נחסמת כשיש שינויים שלא נשמרו; אחרי החלפה ההגדרות נטענות מחדש', async () => {
    const p = await page('view=site');
    await tab(p, 'mail');
    await typeIn(p, '#setting-row-email_drive_folder_id input', 'abc');
    await tab(p, 'db');
    await sleep(200);
    await clickText(p, '.seg.pill button', 'בדיקות');
    await sleep(200);
    assert.equal(await p.$('.scrim.on'), null, 'אין חלון אישור');
    assert.match(await p.$eval('.panel.on', (e) => e.textContent), /יש שינויים שלא נשמרו/);
    assert.equal((await posts(p)).length, 0, 'אין POST');
    await click(p, '.st-chgact [data-act="discard"]');
    await sleep(150);
    await clickText(p, '#dlg .btn', 'בטל שינויים');
    await sleep(200);
    const before = await p.evaluate(() => window.__gets);
    await clickText(p, '.seg.pill button', 'בדיקות');
    await sleep(150);
    await clickText(p, '#dlg .btn', 'מעבר לבדיקות');
    await sleep(500);
    assert.deepEqual(await posts(p), [{ url: '/api/admin/db-mode', body: { mode: 'test' } }]);
    assert.equal(await p.evaluate(() => window.__gets), before + 1, 'טעינה מחדש של ההגדרות');
    await p.close();
  });

  await t('#5 חלונות הרסניים: הפוקוס ההתחלתי על "ביטול", לא על לחצן הפעולה (בטל שינויים / מעבר לבדיקות / נקה ערך)', async () => {
    const focused = (p) => p.evaluate(() => { const a = document.activeElement; return { txt: a ? a.textContent : '', inDlg: !!(a && a.closest && a.closest('#dlg')) }; });
    const p = await page('view=sys');
    await click(p, '#setting-row-require_login .sw input');
    await click(p, '.st-chgact [data-act="discard"]');
    await sleep(250);
    let f = await focused(p);
    assert.ok(f.inDlg && /ביטול/.test(f.txt) && !/בטל שינויים/.test(f.txt), 'discard: ' + f.txt);
    await clickText(p, '#dlg .btn', 'ביטול');
    await tab(p, 'pay');
    await click(p, '#setting-row-nedarim_plus_token [data-act="clear-secret"]');
    await sleep(250);
    f = await focused(p);
    assert.ok(f.inDlg && /ביטול/.test(f.txt), 'clear-secret: ' + f.txt);
    await p.close();
    const q = await page('view=site');
    await clickText(q, '.seg.pill button', 'בדיקות');
    await sleep(250);
    f = await focused(q);
    assert.ok(f.inDlg && /ביטול/.test(f.txt) && !/מעבר/.test(f.txt), 'db switch: ' + f.txt);
    await q.close();
  });

  await t('#6 window.__gmDirty: true בזמן שיש שינויים, false אחרי ביטול', async () => {
    const p = await page('view=sys');
    assert.equal(await p.evaluate(() => window.__gmDirty), false);
    await click(p, '#setting-row-require_login .sw input');
    await sleep(100);
    assert.equal(await p.evaluate(() => window.__gmDirty), true);
    await click(p, '.st-chgact [data-act="discard"]');
    await sleep(150);
    await clickText(p, '#dlg .btn', 'בטל שינויים');
    await sleep(150);
    assert.equal(await p.evaluate(() => window.__gmDirty), false);
    await p.close();
  });

  await t('#6 router.push מרכיב אחר (תפריט וכד\') עם שינויים → חלון "שינויים שלא נשמרו"; בלי שינויים עובר ישר', async () => {
    const p = await page('view=sys');
    await p.evaluate(() => window.__stubRouter.push('/orders'));
    assert.deepEqual(await p.evaluate(() => window.__pushed), ['/orders'], 'בלי שינויים — ניווט רגיל');
    await p.evaluate(() => { window.__pushed = []; });
    await click(p, '#setting-row-require_login .sw input');
    await p.evaluate(() => window.__stubRouter.push('/customers'));
    await sleep(200);
    assert.ok(await p.$('.scrim.on #dlg'), 'חלון');
    assert.deepEqual(await p.evaluate(() => window.__pushed), [], 'הניווט נחסם');
    await clickText(p, '#dlg .btn', 'חזרה לעריכה');
    await sleep(100);
    assert.deepEqual(await p.evaluate(() => window.__pushed), []);
    await p.evaluate(() => window.__stubRouter.push('/customers'));
    await sleep(150);
    await clickText(p, '#dlg .btn', 'צא בלי לשמור');
    await sleep(200);
    assert.deepEqual(await p.evaluate(() => window.__pushed), ['/customers'], 'יציאה בלי שמירה מנווטת');
    await p.close();
  });

  await t('#6 לחצן חזרה של הדפדפן (popstate) עם שינויים → חלון; "חזרה לעריכה" נשארים; "צא בלי לשמור" יוצאים', async () => {
    const p = await page('view=site'); // העמוד הקודם בהיסטוריה
    const url0 = `http://127.0.0.1:${PORT}/index.html?view=sys`;
    await p.goto(url0, { waitUntil: 'networkidle0' });
    await sleep(500);
    await click(p, '#setting-row-require_login .sw input');
    await sleep(150);
    await p.evaluate(() => window.history.back());
    await sleep(300);
    assert.ok(await p.$('.scrim.on #dlg'), 'חלון אחרי חזרה');
    assert.equal(await p.url(), url0, 'נשארים בעמוד');
    await clickText(p, '#dlg .btn', 'חזרה לעריכה');
    await sleep(100);
    assert.ok(await p.$('.st-chgs:not([hidden])'), 'השינויים נשמרו');
    await p.evaluate(() => window.history.back()); // שוב — השומר חודש
    await sleep(300);
    assert.ok(await p.$('.scrim.on #dlg'), 'חלון גם בחזרה שנייה');
    await clickText(p, '#dlg .btn', 'צא בלי לשמור');
    await p.waitForFunction(() => /view=site/.test(location.search), { timeout: 5000 }).catch(() => {});
    assert.match(await p.url(), /view=site/, 'יצאנו לעמוד הקודם');
    await p.close();
  });

  await t('#6 "שמור והמשך" שנכשל בולידציה לא משאיר המשך תלוי: שמירה מאוחרת לא מנווטת', async () => {
    const p = await page('view=sys');
    await tab(p, 'ord');
    await typeIn(p, '#setting-row-max_items_per_order input', '500');
    await sleep(100);
    await p.evaluate(() => window.__stubRouter.push('/orders'));
    await sleep(150);
    await clickText(p, '#dlg .btn', 'שמור והמשך');
    await sleep(300);
    assert.deepEqual(await posts(p), [], 'אין POST — ערך לא תקין');
    assert.deepEqual(await p.evaluate(() => window.__pushed || []), []);
    await typeIn(p, '#setting-row-max_items_per_order input', '7');
    await sleep(100);
    await click(p, '.st-chgact [data-act="save"]');
    await sleep(400);
    assert.equal((await posts(p)).length, 1, 'נשמר');
    assert.deepEqual(await p.evaluate(() => window.__pushed || []), [], 'לא ניווט לשום מקום');
    await p.close();
  });
} finally {
  await browser.close();
  server.close();
}
if (errors.length) { console.log('console errors:\n' + errors.join('\n')); failed++; }
console.log(`\n${passed} passed, ${failed} failed`);
process.exitCode = failed ? 1 : 0;
