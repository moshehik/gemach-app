// שלבי W5 של הרתמה: הרייל (#rail), טוסט "חיוב/זיכוי ממתין", חלונות השמירה (D1 סיכום, D7 ביטול שינויים, D6 "נשמרה"), באנר הטיוטה (R11) -
// הדף האמיתי מול כרטיס-הזמנה.html. + בדיקות זרימה מקצה לקצה (רק בדף האמיתי) של הלחצנים, הטוסט, הביטול/החזרה, D6 והדפסה.
// נטען מ-stages.mjs: railRoots(ROOTS, D) מוסיף את אזורי ההשוואה; railStages(ctx) מחזיר את השלבים.
export const railRoots = (ROOTS, D) => { ROOTS.push(['RAIL', '#rail'], ['NB', D ? '#nbArea' : '.oc-banner']); };

export function railStages({ p, D, fresh, clickAt, hover, away, sleep, check }) {
  // העיצוב: לחיצה על data-act כמו act() של הדף (כפתור זמני עם data-act נלחץ - מאזין ה-click של המסמך תופס אותו)
  const demoAct = async (a) => { await p.evaluate((x) => { const b = document.createElement('button'); b.dataset.act = x; document.body.append(b); b.click(); b.remove(); }, a); await sleep(400); };
  // אמיתי: משחזר את הטיוטה בלחיצה על הבאנר. בלי לסגור את הטוסט (הטוסט "חיוב ממתין" הוא חלק מההשוואה)
  const restore = async () => { await clickAt('.oc-banner .nb-go'); await sleep(900); };
  // כמו restore, ובנוסף סוגר את טוסט "שוחזרו" (בעיצוב אין טוסט כשהשינוי היחיד הוא הערות)
  const restoreQuiet = async () => { await restore(); await p.evaluate(() => { const t = document.querySelector('#toast .tclose'); if (t) t.click(); }); await sleep(450); };
  const addDemo = async () => { await fresh(); await demoAct('sim-add'); await away(); };
  const addReal = async () => { await fresh('railadd'); await restore(); await away(); };
  const rmDemo = async () => { await fresh(); await demoAct('sim-rm'); await away(); };
  const rmReal = async () => { await fresh('railrm'); await restore(); await away(); };
  const notesDemo = async () => { await fresh(); await p.type('#notes', 'x'); await sleep(300); await away(); };
  // במסך צר הרייל הוא גיליון תחתון מקופל (רשימת השינויים ולחצן "בטל שינויים" נראים רק כשהוא פתוח) - פותחים לפני לחיצה עליהם
  const openCart = async () => { if (await p.evaluate(() => innerWidth) < 1024) { await clickAt('#rail [data-act="cart-toggle"]'); await sleep(350); } };
  const nav = () => p.evaluate(() => window.__nav || []);
  const calls = () => p.evaluate(() => window.__calls || []);

  return [
    // --- הרייל: חיוב ממתין (נוסף פריט), זיכוי ממתין (הוסר פריט), ביטול שורה + החזר ביטול ---
    { name: 'R01-rail-charge', real: addReal, demo: addDemo },
    { name: 'R02-rail-credit', real: rmReal, demo: rmDemo },
    // הערות בלבד (סכום 0): הלחצן הראשי "שמור", בלי סכומים; ביטול השורה → "אין שינויים" + "החזר ביטול"
    { name: 'R03-rail-notes', real: async () => { await fresh('railnotes'); await restoreQuiet(); await away(); }, demo: notesDemo },
    { name: 'R08-rail-undo-redo', real: async () => { await fresh('railnotes'); await restoreQuiet(); await openCart(); await clickAt('#rail .cl-u'); await sleep(500); await away(); }, demo: async () => { await notesDemo(); await openCart(); await clickAt('#rail .cl-u'); await sleep(500); await away(); } },
    // --- חלונות: D1 סיכום (נווה), D7 ביטול שינויים, D6 נשמרה ---
    { name: 'R04-summary-d1', real: async () => { await addReal(); await clickAt('#rail .btn.primary'); await sleep(900); await away(); }, demo: async () => { await addDemo(); await clickAt('#rail .btn.primary'); await sleep(900); await away(); } },
    { name: 'R05-discard-d7', real: async () => { await addReal(); await openCart(); await clickAt('#rail .btn[data-act="discard"]'); await sleep(700); await away(); }, demo: async () => { await addDemo(); await openCart(); await clickAt('#rail .btn[data-act="discard"]'); await sleep(700); await away(); } },
    { name: 'R06-success-d6', real: async () => { await fresh('railnotes'); await restoreQuiet(); await clickAt('#rail .btn.primary'); await sleep(1200); await away(); }, demo: async () => { await fresh(); await p.evaluate(() => finish('ההזמנה נשמרה', [])); await sleep(700); await away(); } },
    // --- ריחוף: ביטול שורה, לחצן ראשי, צ׳יפ התשלום (מצבי hover של הפלטה) ---
    { name: 'R09-hover-undo', real: async () => { await addReal(); await openCart(); await hover('#rail .cl-u'); }, demo: async () => { await addDemo(); await openCart(); await hover('#rail .cl-u'); } },
    { name: 'R10-hover-primary', real: async () => { await addReal(); await hover('#rail .btn.primary'); }, demo: async () => { await addDemo(); await hover('#rail .btn.primary'); } },
    // --- באנר הטיוטה (R11) ---
    { name: 'R07-draft-banner', real: async () => { await fresh('railbanner'); await away(); }, demo: async () => { await fresh(); await p.select('#pvState', 'draft'); await sleep(500); await away(); } },
    // --- רק בדף האמיתי: צילומים + בדיקות זרימה ---
    { name: 'R20-exit-d2-main', real: async () => { await fresh('railadd'); await restore(); await clickAt('#app > .topbar .back'); await sleep(700); await away(); } },
    { name: 'R21-summary-main-nosummary', real: async () => { await fresh('railnotes'); await restore(); await away(); } },
    // שמירה מקצה לקצה עם D1 (נווה): לחצן ראשי → D1 → אישור → PUT יחיד → D6 עם 3 לחצנים → הדפסה (window.open) → "הזמנה חדשה" ניווט
    { name: 'R22-flow-save-d1-d6', real: async () => {
      await fresh('railadd'); await restore();
      await p.evaluate(() => { window.__opened = []; window.open = (u, t) => { window.__opened.push([u, t]); return null; }; });
      const prim = await p.$eval('#rail .btn.primary', (e) => e.textContent.trim());
      const toast = await p.$eval('#toast b', (e) => e.textContent.trim()).catch(() => '');
      await clickAt('#rail .btn.primary'); await sleep(900);
      const d1 = await p.evaluate(() => ({ h2: (document.querySelector('#dlg > h2') || {}).textContent, rows: document.querySelectorAll('#dlg .chg')[1] ? document.querySelectorAll('#dlg .chg')[1].querySelectorAll('.c').length : 0, primary: (document.querySelector('#dlg .btn.primary') || {}).textContent }));
      await clickAt('#dlg .btn.primary'); await sleep(1200);
      const puts = (await calls()).filter((c) => c.method === 'PUT').length;
      const d6 = await p.evaluate(() => ({ head: (document.querySelector('#dlg .success h2') || {}).textContent, btns: [...document.querySelectorAll('#dlg .success .btn')].map((b) => b.textContent.trim()), sub: (document.querySelector('#dlg .success .sub') || {}).textContent }));
      await clickAt('#dlg .success .btn[data-act="print-done"]'); await sleep(500);
      const opened = await p.evaluate(() => window.__opened);
      const stillOpen = await p.evaluate(() => document.getElementById('scrim').classList.contains('on'));
      check('flow: הלחצן הראשי "תשלום" והטוסט "חיוב ממתין ₪150"', prim === 'תשלום' && toast === 'חיוב ממתין ₪150');
      check('flow: D1 "סיכום" עם 3 שורות כסף ולחצן "תשלום"', d1.h2 === 'סיכום' && d1.rows === 3 && d1.primary === 'תשלום');
      check('flow: PUT יחיד אחרי אישור D1', puts === 1);
      check('flow: D6 "ההזמנה נשמרה" + שלושה לחצנים (הזמנה חדשה / הדפסה / המשך לצפות) + שם הלקוח', d6.head === 'ההזמנה נשמרה' && d6.btns.join('|') === 'הזמנה חדשה|הדפסה|המשך לצפות בהזמנה' && /#53375 · מרים אברמוביץ/.test(d6.sub));
      check('flow: "הדפסה" פותחת /print/order בחלון חדש וסוגרת את החלון', opened.length === 1 && opened[0][0] === '/print/order?orderId=53375&type=order' && opened[0][1] === '_blank' && !stillOpen);
    } },
    { name: 'R23-flow-d6-new-order', real: async () => {
      await fresh('railnotes'); await restore(); await clickAt('#rail .btn.primary'); await sleep(1200);
      await clickAt('#dlg .success .btn[data-act="new-order"]'); await sleep(700);
      const n = await nav();
      check('flow: D6 "הזמנה חדשה" מנווטת ליעד ההגדרה (order_edit_redirect_screen=new_order → /orders/new)', n.length === 1 && n[0] === '/orders/new');
    } },
    // undo → redo → discard מקצה לקצה; הטוסט "לשמירה" פותח את אותו מסלול כמו הלחצן הראשי
    { name: 'R24-flow-undo-redo-discard', real: async () => {
      await fresh('railadd'); await restore();
      const badge0 = await p.$eval('#rail .badge', (e) => e.textContent);
      await openCart();
      await clickAt('#rail .cl-u'); await sleep(600);
      const st1 = await p.evaluate(() => ({ badge: document.querySelector('#rail .badge').textContent, redo: !!document.querySelector('#rail .redo'), empty: !!document.querySelector('#rail .cart-empty'), acts: !!document.querySelector('#rail .cart-actions') }));
      await clickAt('#rail .redo'); await sleep(500);
      const st2 = await p.evaluate(() => ({ badge: document.querySelector('#rail .badge').textContent, redo: !!document.querySelector('#rail .redo') }));
      await clickAt('#rail .btn[data-act="discard"]'); await sleep(600);
      const d7 = await p.evaluate(() => ({ h2: (document.querySelector('#dlg > h2') || {}).textContent, sub: (document.querySelector('#dlg > .sub') || {}).textContent }));
      await clickAt('#dlg .btn.primary'); await sleep(700);
      const st3 = await p.evaluate(() => ({ badge: document.querySelector('#rail .badge').textContent, acts: !!document.querySelector('#rail .cart-actions') }));
      const cancel = (await calls()).filter((c) => /cancel-changes/.test(c.url)).length;
      check('flow: ביטול שורה → 0 שינויים, "אין שינויים", כפתור החזר ביטול, בלי לחצנים', badge0 === '1' && st1.badge === '0' && st1.redo && st1.empty && !st1.acts);
      check('flow: החזר ביטול מחזיר את השורה וכפתור ההחזר נעלם', st2.badge === '1' && !st2.redo);
      check('flow: D7 "לבטל את כל השינויים?" + "שינוי אחד יימחק"', d7.h2 === 'לבטל את כל השינויים?' && d7.sub === 'שינוי אחד יימחק');
      check('flow: אישור D7 מבטל את השינויים וכותב cancel-changes', st3.badge === '0' && !st3.acts && cancel === 1);
    } },
    { name: 'R25-flow-toast-save', real: async () => {
      await fresh('railnotes'); await p.evaluate(() => {}); // בלי שינוי כסף - אין טוסט כסף
      await restore();
      const t0 = await p.evaluate(() => document.getElementById('toast').dataset.kind || '');
      // "לשמירה" בטוסט (railadd) → אותו מסלול כמו הלחצן הראשי (D1)
      await fresh('railadd'); await restore();
      await clickAt('#toast .tbtn'); await sleep(900);
      const h2 = await p.evaluate(() => (document.querySelector('#dlg > h2') || {}).textContent);
      check('flow: טוסט כסף לא מוצג כשהסכום הממתין 0 (עריכת הערות בלבד)', t0 !== 'charge' && t0 !== 'credit');
      check('flow: "לשמירה" בטוסט פותח את חלון הסיכום (אותו מסלול כמו הלחצן הראשי)', h2 === 'סיכום');
    } },
    { name: 'R26-flow-draft-banner-x', real: async () => {
      await fresh('railbanner');
      const ls0 = await p.evaluate(() => !!localStorage.getItem('gemachOrderDraft:53375'));
      await clickAt('.oc-banner .nb-x'); await sleep(400);
      const st = await p.evaluate(() => ({ banner: !!document.querySelector('.oc-banner .nb'), ls: !!localStorage.getItem('gemachOrderDraft:53375') }));
      check('flow: X בבאנר הטיוטה סוגר את הבאנר בלבד (הטיוטה נשארת)', ls0 && !st.banner && st.ls);
    } },
  ];
}
