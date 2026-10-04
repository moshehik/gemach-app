// שלבי ההרתמה של לשונית התשלומים (W4). נטען מ-stages.mjs: ...payStages(h). h = עזרי stages.mjs (p, D, fresh, clickAt, hover, away,
// sleep, demoWin, check). שלבים עם real+demo מושווים (cmp.mjs, אזור PAY = #p-payments + החלונות); שלבים real בלבד = בדיקות זרימה
// מקצה לקצה מול ה-API המדומה (pay-mock.js): endpoints, גופים, וחלונות.

export function payStages(h) {
  const { fresh, clickAt, away, sleep, demoWin, check } = h;
  const p = () => h.p();
  // בעיצוב: סמני שכבת הסקירה שהבעלים הסירו (r34 חיוב משלוח ידני, r35 "הוסף חיוב") יורדים; עטיפת r37 (span display:contents) נפתחת
  const demoPayClean = async () => p().evaluate(() => {
    if (!document.getElementById('w4-hide')) { const st = document.createElement('style'); st.id = 'w4-hide'; st.textContent = '[data-pvk=r34],[data-pvk=r35],.pv-b{display:none!important}'; document.head.append(st); }
    document.querySelectorAll('[data-pvk=r34],[data-pvk=r35],.pv-b').forEach(e => e.remove());
    document.querySelectorAll('span[data-pvk=r37]').forEach(sp => sp.replaceWith(...sp.childNodes));
  });
  const demoTab = async () => { await fresh(); await clickAt('#tabs .tab[data-tab="payments"]'); await sleep(300); await demoPayClean(); };
  const realTab = async (scn, extra = '') => { await fresh(scn + extra); await clickAt('#tabs .tab[data-tab="payments"]'); await sleep(400); };
  const calls = () => p().evaluate(() => window.__calls || []);
  const typeIn = async (sel, text) => { await clickAt(sel); await p().type(sel, text); };
  const approveWith = async (code = '1234') => { await p().waitForSelector('#scrim2.on #dlg2 .oc-emps .opt', { timeout: 5000 }); await clickAt('#dlg2 .oc-emps .opt:nth-child(1)'); await p().type('#oc-appr-code', code); await p().keyboard.press('Enter'); await sleep(700); };

  return [
    // ---------- השוואה לעיצוב ----------
    { name: 'P01-pay-tab', real: async () => { await realTab('pay'); await away(); }, demo: async () => { await demoTab(); await away(); } },
    { name: 'P02-pay-mgr', real: async () => { await realTab('pay', '&me=e3'); await clickAt('#p-payments details.coll > summary'); await sleep(300); await away(); }, demo: async () => { await demoTab(); await clickAt('#p-payments details.coll > summary'); await sleep(300); await demoPayClean(); await away(); } },
    { name: 'P03-pay-debt', real: async () => { await realTab('paydebt'); await away(); }, demo: async () => { await fresh(); await p().evaluate(() => { payments[1].amt = 0; renderAll(); }); await clickAt('#tabs .tab[data-tab="payments"]'); await sleep(300); await demoPayClean(); await away(); } },
    { name: 'P04-dlg-pay', real: async () => { await realTab('paydebt'); await clickAt('#p-payments [data-oc-pay="status"] [data-act="pay-now"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await p().evaluate(() => { payments[1].amt = 0; renderAll(); }); await clickAt('#tabs .tab[data-tab="payments"]'); await sleep(300); await demoPayClean(); await p().evaluate(() => { UI.payMethod = 'אשראי'; }); await clickAt('#p-payments .card .btn.lg.block[data-act="pay-now"]'); await sleep(500); await away(); } },
    { name: 'P05-dlg-paydet', real: async () => { await realTab('pay'); await clickAt('#p-payments [data-oc-pay="payments"] .li .ibtn[aria-label="פרטים נוספים"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await demoWin('R37'); await away(); } },
    { name: 'P06-dlg-manual', real: async () => { await realTab('pay'); await clickAt('#p-payments details.coll > summary'); await clickAt('#p-payments [data-act="manual-money"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await demoWin('R22'); await away(); } },
    { name: 'P07-dlg-refund', real: async () => { await realTab('paycredit'); await clickAt('#p-payments [data-act="credit-now"]'); await sleep(500); await away(); }, demo: async () => { await fresh(); await demoWin('R38'); await away(); } },
    { name: 'P08-dlg-bank', real: async () => { await realTab('paybank'); await clickAt('#p-payments [data-oc-pay="refunds"] .li .btn.sm:nth-of-type(1)'); await sleep(500); await away(); }, demo: async () => { await fresh(); await p().evaluate(() => bankDlg(120)); await sleep(500); await away(); } },
    { name: 'P09-dlg-credit', real: async () => { await realTab('pay'); await clickAt('#p-payments [data-oc-pay="refunds"] .li .btn.sm:nth-of-type(2)'); await sleep(500); await away(); }, demo: async () => { await demoTab(); await clickAt('#p-payments [data-pvact="refundexec"]'); await sleep(500); await away(); } },
    { name: 'P10-dlg-forced', real: async () => { await fresh('paysave'); await clickAt('.oc-banner .nb-go'); await sleep(300); await clickAt('#rail .cart-actions .btn.primary'); await sleep(1200); await away(); }, demo: async () => { await fresh(); await p().evaluate(() => { act('sim-add'); }); await sleep(300); await p().evaluate(() => payDlg()); await sleep(500); await away(); } },

    // ---------- זרימות מקצה לקצה (real בלבד) ----------
    { name: 'P20-flow-credit', real: async () => {
      await realTab('paydebt');
      await clickAt('#p-payments [data-oc-pay="status"] [data-act="pay-now"]'); await sleep(400);
      await typeIn('#oc-cc-num', '4580123456789012'); await typeIn('#oc-cc-exp', '1228');
      await clickAt('#dlg .dbtns .btn.green'); await sleep(400);
      const regs = await p().evaluate(() => (document.querySelector('#scrim2.on #dlg2 h2') || {}).textContent || '');
      await clickAt('#dlg2 .btn.primary'); await sleep(1200);
      const c = await calls();
      const writes = c.filter(x => x.method !== 'GET').map(x => `${x.method} ${x.url}`);
      const ned = c.find(x => x.url === '/api/nedarim'); const pay = c.find(x => x.url === '/api/payments');
      const nb = ned ? JSON.parse(ned.body) : {}; const pb = pay ? JSON.parse(pay.body) : {};
      const st = await p().evaluate(() => ({ dlg: document.getElementById('scrim').classList.contains('on'), toast: (document.querySelector('#toast b') || {}).textContent || '' }));
      check('credit: שער התקנון לפני אשראי (R7)', regs === 'חתימה על תקנון');
      check('credit: PUT חתימה → POST נדרים → POST תשלום', JSON.stringify(writes) === JSON.stringify(['PUT /api/orders/53375', 'POST /api/nedarim', 'POST /api/payments']));
      check('credit: גוף נדרים (מספר בלי רווחים, תוקף בלי לוכסן, סכום = היתרה, תשלומים 1)', nb.cardNumber === '4580123456789012' && nb.tokef === '1228' && nb.amount === 230 && nb.installments === 1 && nb.clientName === 'מרים אברמוביץ' && /^הזמנה 53375/.test(nb.notes));
      check('credit: גוף התשלום (אשראי, אותו סכום, notes = תשובת נדרים)', pb.orderId === 53375 && pb.amount === 230 && pb.paymentMethod === 'אשראי' && /0123456/.test(pb.notes));
      check('credit: אחרי שמירה - GET ההזמנה (סנכרון), החלון נסגר, טוסט', c.at(-1).method === 'GET' && c.at(-1).url === '/api/orders/53375' && !st.dlg && /התקבל תשלום באשראי/.test(st.toast));
    } },
    { name: 'P21-flow-declined', real: async () => {
      await realTab('paydebt'); await p().evaluate(() => { /* חתום כבר - בלי שער */ });
      await clickAt('#p-payments [data-oc-pay="status"] [data-act="pay-now"]'); await sleep(400);
      await typeIn('#oc-cc-num', '4000123412341234'); await typeIn('#oc-cc-exp', '1228');
      await clickAt('#dlg .dbtns .btn.green'); await sleep(300); await clickAt('#dlg2 .btn.primary'); await sleep(900);
      const st = await p().evaluate(() => ({ open: document.getElementById('scrim').classList.contains('on'), msg: (document.querySelector('#dlg .amsg') || {}).textContent || '' }));
      const c = await calls();
      check('declined: נדרים דחה → הודעה בחלון, אין POST תשלום', st.open && /נדחה/.test(st.msg) && !c.some(x => x.url === '/api/payments'));
    } },
    { name: 'P22-flow-forced-leave-debt', real: async () => {
      await fresh('paysave'); await clickAt('.oc-banner .nb-go'); await sleep(300); await clickAt('#rail .cart-actions .btn.primary'); await sleep(1200);
      const t = await p().evaluate(() => ({ h: (document.querySelector('#scrim.on #dlg h2') || {}).textContent || '', later: !!document.querySelector('#dlg [data-act="pay-later"]') }));
      check('forced: אחרי שמירה שיצרה חוב נפתח חלון התשלום עם "השאר חוב"', t.h === 'השינויים נשמרו! נוצר חיוב חדש' && t.later);
      await clickAt('#dlg [data-act="pay-later"]'); await approveWith('1234');
      const c = await calls();
      const vp = c.filter(x => x.url === '/api/auth/verify-pin').map(x => JSON.parse(x.body)).at(-1) || {};
      const st = await p().evaluate(() => ({ open: document.getElementById('scrim').classList.contains('on'), payOpen: !!document.querySelector('#dlg [data-act="pay-later"]'), d6: (document.querySelector('#dlg .success h2') || {}).textContent || '', toast: (document.querySelector('#toast b') || {}).textContent || '' }));
      check('forced: "השאר חוב" = אישור מאשר הזמנה ללא תשלום + context עם הסכום', vp.requiredLevel === 'מאשר הזמנה ללא תשלום' && vp.context && vp.context.orderId === 53375 && /120/.test(vp.context.reason));
      // אינטגרציה (REQUESTS-W5 #1): אחרי "השאר חוב" חלון התשלום נסגר, הטוסט "אושר על ידי" מוצג והרייל פותח D6 "נשמר · חוב ₪N"
      check('forced: החלון נסגר, טוסט "אושר על ידי" ו-D6 "נשמר · חוב ₪120" מהרייל', !st.payOpen && /אושר על ידי/.test(st.toast) && /^נשמר · חוב/.test(st.d6) && /120/.test(st.d6));
    } },
    { name: 'P23-flow-manual-charge', real: async () => {
      await realTab('pay'); await clickAt('#p-payments details.coll > summary'); await clickAt('#p-payments [data-act="manual-money"]'); await sleep(300);
      await clickAt('#dlg .btn.primary'); await sleep(300);
      const before = (await calls()).length;
      await approveWith('1234');
      await typeIn('#oc-ch-desc', 'הובלה מיוחדת'); await typeIn('#oc-ch-amt', '50'); await clickAt('#dlg .btn.primary'); await sleep(500);
      const c = await calls();
      const vp = c.slice(before - 1).filter(x => x.url === '/api/auth/verify-pin').map(x => JSON.parse(x.body)).at(-1) || {};
      const st = await p().evaluate(() => ({ pend: [...document.querySelectorAll('#p-payments [data-oc-pay="charges"] .li.pend')].map(e => e.textContent), writes: (window.__calls || []).filter(x => x.method !== 'GET' && x.url !== '/api/auth/verify-pin').length }));
      check('manual charge: אישור feature:manual_charge_add לפני החלון (R35)', vp.requiredLevel === 'feature:manual_charge_add');
      check('manual charge: שורה "ממתין לשמירה" (A13), בלי כתיבה לשרת עד השמירה', st.pend.some(t => /הובלה מיוחדת/.test(t) && /ממתין לשמירה/.test(t)) && st.writes === 0);
    } },
    { name: 'P24-flow-iban', real: async () => {
      await realTab('paybank'); await clickAt('#p-payments [data-oc-pay="refunds"] .li .btn.sm:nth-of-type(1)'); await sleep(400);
      await typeIn('#oc-bk-name', 'מרים אברמוביץ'); await typeIn('#oc-bk-acct', 'IL62 0108 0000 0009 9999 999'); await sleep(200);
      const ok = await p().evaluate(() => (document.querySelector('#dlg .oc-iban-ok') || {}).textContent || '');
      await clickAt('#dlg [data-act="bank-ok"]'); await sleep(700);
      const c = await calls(); const put = c.find(x => x.method === 'PUT' && x.url === '/api/refunds/r1');
      const b = put ? JSON.parse(put.body) : {};
      check('iban: פוענח לבנק/סניף/חשבון (A15)', /לאומי/.test(ok) && /800/.test(ok) && /99999999/.test(ok));
      check('iban: PUT /api/refunds/r1 עם ארבעת השדות + reason עם ה-IBAN, בלי שדה iban', JSON.stringify(Object.keys(b)) === '["bankName","bankBranch","bankAccount","bankAccountName","reason"]' && b.bankName === 'לאומי' && b.bankBranch === '800' && b.bankAccount === '99999999' && /IBAN: IL62/.test(b.reason || '') && !/"iban"/i.test(put.body)); // a4ed1deb: ה-IBAN נשמר רק בתוך reason (בלי עמודה חדשה)
      await clickAt('#p-payments [data-oc-pay="refunds"] .li .btn.sm:nth-of-type(1)'); await sleep(300);
      await p().evaluate(() => { const i = document.getElementById('oc-bk-acct'); i.select(); });
      await p().keyboard.type('IL63 0108 0000 0009 9999 999'); await sleep(200);
      const bad = await p().evaluate(() => (document.querySelector('#dlg .amsg') || {}).textContent || '');
      check('iban: ספרות ביקורת שגויות → הודעה', /ביקורת/.test(bad));
    } },
    { name: 'P25-flow-recalc-role', real: async () => {
      await realTab('pay'); await clickAt('#p-payments details.coll > summary'); await sleep(200);
      const worker = await p().evaluate(() => !!document.querySelector('#p-payments [data-act="recalc"]'));
      await realTab('pay', '&me=e3'); await clickAt('#p-payments details.coll > summary'); await sleep(200);
      const head = await p().evaluate(() => !!document.querySelector('#p-payments [data-act="recalc"]'));
      await clickAt('#p-payments [data-act="recalc"]'); await sleep(300); await clickAt('#dlg .btn.primary'); await sleep(800);
      const c = await calls(); const r = c.find(x => x.url === '/api/admin/recalculations');
      check('R33: "חישוב מחדש" מוסתר מעובדת, מוצג להנהלה ראשית', !worker && head);
      check('R33: POST /api/admin/recalculations {orderIds:[53375]} → GET', r && r.body === '{"orderIds":[53375]}' && c.at(-1).method === 'GET');
    } },
    { name: 'P26-flow-refund-request', real: async () => {
      await realTab('paycredit'); await clickAt('#p-payments [data-act="credit-now"]'); await sleep(400); await approveWith('1234'); // W4-MANUAL: אישור גם בגמ"ח הראשי
      await typeIn('#oc-rf-bank', 'לאומי'); await typeIn('#oc-rf-branch', '800');
      await clickAt('#dlg [data-act="refund-ok"]'); await sleep(700);
      const c = await calls(); const post = c.find(x => x.method === 'POST' && x.url === '/api/refunds');
      const b = post ? JSON.parse(post.body) : {};
      check('refund (ראשי, באישור מנהל - W4-MANUAL): POST /api/refunds עם הסכום (יתרת הזכות) ופרטי הלקוח', post && b.customerId === 'c1' && b.orderId === 53375 && b.amount === 150 && b.bankName === 'לאומי' && b.bankBranch === '800' && 'paymentDetails' in b && 'email' in b);
    } },
  ];
}
