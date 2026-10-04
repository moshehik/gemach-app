// זרימות אמיתיות בחלון "דיווח על שגיאות" (החלון האמיתי, API מדומה מ-entry.jsx): שליחת דיווח עם כל סוגי הצירוף, תגובה, טופל,
// ארכיון/שחזור, "מענה אנושי" (בגוף השיחה), אישור/דחיית סקיצה, פתיחה והורדה של צרופה, סימון אלמנט (כולל Esc), מתכנת מול מדווח,
// מונה לא נקראו, חיפוש, מעטפת ישנה, וכללי העיצוב שנבדקים בדפדפן (כפתורים עגולים כחולים, X בקצה, אייקונים בריחוף, זהב לשמות).
// מדפיס OK/FAIL; יוצא 1 בכישלון. שימוש: node scripts/error-report-audit/interact.mjs   (אחרי build.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { serve, launch, sleep, PORT, OUT } from './lib.mjs';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'OK   ' : 'FAIL ') + m); if (!c) fails++; };
fs.mkdirSync(OUT, { recursive: true });
const F = (n) => path.join(OUT, n);
fs.writeFileSync(F('דוח-שגיאה.pdf'), '%PDF-1.1 mock');
fs.writeFileSync(F('t-bad.exe'), 'MZ');
fs.writeFileSync(F('t-big.pdf'), Buffer.alloc(Math.round(3.2 * 1024 * 1024), 65));
const STEPS_HEADER = 'הפעולות שבוצעו לפני התקלה';
const s = await serve();
const b = await launch(); const p = await b.newPage();
await p.setViewport({ width: 1280, height: 900 });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error' && !/favicon|404|Failed to load resource/.test(m.text())) errs.push(m.text()); });
const go = async (q = '') => { await p.goto(`http://127.0.0.1:${PORT}/?${q}`, { waitUntil: 'load' }); await sleep(700); };
const calls = () => p.evaluate(() => window.__calls);
const lastCall = async (pred) => (await calls()).filter(pred).pop();
const center = async (sel) => p.$eval(sel, (el) => { el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
const click = async (sel, wait = 300) => { const c = await center(sel); await p.mouse.move(c.x, c.y); await sleep(60); await p.mouse.click(c.x, c.y); await sleep(wait); };
const hover = async (sel) => { const c = await center(sel); await p.mouse.move(c.x, c.y); await sleep(450); };
const text = (sel) => p.$eval(sel, (e) => e.textContent).catch(() => null);
const exists = async (sel) => !!(await p.$(sel));
const toast = () => text('#toast');
const openCard = async () => { await click('#snErr', 600); };
const openPanel = async () => { await openCard(); await click('.er-inb', 600); };
const openRow = async (id) => { await click(`.er3-r[data-id="${id}"]`, 600); };
const attach = async (file) => { const [fc] = await Promise.all([p.waitForFileChooser(), click('.er-cb[data-act="file"]', 50)]); await fc.accept([F(file)]); await sleep(500); };
const tip = async (sel) => { await hover(sel); return p.evaluate(() => { const t = document.querySelector('.gm-er .pl-tt.on'); return t ? t.textContent : null; }); };

// ---------- מונה לא נקראו + פתיחה בטופס ----------
await go();
ok((await text('#snErr .sn-badge')) === '2', 'מונה "לא נקראו" על האייקון (בדיקה קלה ?light=1): 2');
ok((await calls()).some((c) => c.url === '/api/error-report?light=1'), 'GET /api/error-report?light=1 בטעינה');
await openCard();
ok(await exists('#erPop #dlg.er-win #erTx'), 'האייקון פותח את הכרטיס על "דיווח חדש"');
ok(!(await exists('#erPop .er-newb')), 'אין "+ דיווח חדש" בטופס הדיווח');
ok(await p.$eval('#erFab', (e) => e.classList.contains('hide')), 'הכפתור הצף מוסתר כשהחלון פתוח');
ok((await p.$$('#erPop .er-cb')).length === 5, 'חמישה אייקונים בטופס (ההגדרה ai_screen_recording_enabled פעילה)');
const op0 = await p.$eval('#erPop .er-cb', (e) => getComputedStyle(e).opacity);
await p.mouse.move(2, 880); await p.evaluate(() => document.activeElement.blur()); await sleep(300);
ok((await p.$eval('#erPop .er-cb', (e) => getComputedStyle(e).opacity)) === '0', `האייקונים מוסתרים במנוחה (בפתיחה עם מיקוד: ${op0})`);
await hover('#erTx');
ok((await p.$eval('#erPop .er-cb', (e) => getComputedStyle(e).opacity)) === '1', 'האייקונים נחשפים בריחוף על התיבה');
ok((await p.$eval('#erPop .er-send', (e) => getComputedStyle(e).opacity)) === '1', 'כפתור השליחה תמיד גלוי');
const xr = await p.evaluate(() => { const x = document.querySelector('#erPop .er-x0').getBoundingClientRect(); const d = document.querySelector('#erPop #dlg').getBoundingClientRect(); return Math.round(d.right - x.right); });
ok(xr === 19, `X בקצה הימני של הכרטיס (מרחק ${xr}px, בסקיצה 19)`);
const sbRules = await p.evaluate(() => { const out = []; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch { continue; } const walk = (list) => { for (const r of list) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText && /gm-er/.test(r.selectorText) && /::-webkit-scrollbar(?![-\w])/.test(r.selectorText)) out.push(r.style.width); } }; walk(rs); } return out; });
ok(sbRules.includes('6px'), `פס גלילה דק: ::-webkit-scrollbar ברוחב 6px בהיקף החלון (${sbRules.join(',')})`);
ok((await tip('.er-cb[data-act="file"]')) === 'קובץ מהמחשב · וורד, אקסל, PDF, טקסט או תמונה - עד 3MB בסך הכל', 'טולטיפ המערכת (.pl-tt) על אייקון');

// ---------- שליחת דיווח עם כל סוגי הצירוף ----------
await click('.er-send', 400);
ok((await toast() || '').includes('יש להזין תיאור שגיאה') && (await exists('#erPop .er-composer.bad')), 'שליחה ריקה: שגיאת תיקוף + טוסט');
ok(!(await calls()).some((c) => c.method === 'POST' && c.url === '/api/error-report'), 'שליחה ריקה לא נשלחת');
await p.focus('#erTx'); await p.keyboard.type('לחצתי על שמירה והדף נתקע');
ok(!(await exists('#erPop .er-composer.bad')), 'השגיאה נעלמת כשמקלידים');
await click('.er-cb[data-act="pick"]', 200);
ok(await exists('#erPill.on'), 'מצב סימון: הודעה "לחץ על האלמנט..."');
ok(await exists('#erPop #dlg'), 'במחשב הכרטיס נשאר פתוח בזמן הסימון');
await hover('#pfSave');
ok(await exists('#erLayer .er-hov'), 'מסגרת ריחוף על האלמנט');
await click('#pfSave', 1200);
ok(!(await exists('#erPill')), 'הסימון הסתיים');
ok(((await text('.er-ech .er-l')) || '').includes('button#pfSave'), 'צ׳יפ האלמנט המסומן');
ok(await exists('#erLayer .er-mark'), 'סימון ממוספר על הדף');
ok(await exists('.er-thumbs img.er-elt'), 'צילום האלמנט בצרופות');
ok(!(await calls()).some((c) => c.method !== 'GET'), 'הלחיצה על האלמנט נחסמה (לא הפעילה כלום)');
await attach('t-bad.exe');
ok((await toast() || '').includes('סוג קובץ לא נתמך'), 'קובץ לא נתמך: הודעת שגיאה');
await attach('t-big.pdf');
ok((await toast() || '').includes('מוגבל ל-3MB'), 'קובץ גדול מ-3MB: הודעת שגיאה');
await attach('דוח-שגיאה.pdf');
ok(((await text('.er-fileb span')) || '').includes('דוח-שגיאה.pdf'), 'קובץ PDF צורף');
await click('.er-cb[data-act="shot"]', 100);
for (let i = 0; i < 40 && (await p.$$('.er-thumbs .er-pt')).length < 3; i++) await sleep(250); // html2canvas איטי ב-headless
ok((await p.$$('.er-thumbs .er-pt')).length === 3 && (await exists('#erPop #dlg')), 'צילום מסך צורף (3 צרופות) והכרטיס חזר');
await click('.er-cb[data-act="steps"]', 300);
ok(await exists('#erRec.on'), 'סרגל "רושם את הפעולות שלך"');
ok(!(await exists('#erPop #dlg')), 'הכרטיס מוסתר בזמן ההקלטה');
await click('#firstName'); await p.keyboard.type('x'); await click('#other');
await click('#erRec .btn', 600);
const stepsTxt = await text('.er-stp-h');
ok(/נרשמו \d+ צעדים|נרשמו צעד אחד/.test(stepsTxt || ''), `צ׳יפ "נרשמו N צעדים" (${stepsTxt})`);
ok(!(await p.evaluate(() => /\[\d\d:\d\d\]/.test(document.querySelector('.gm-er').textContent))), 'שורות הצעדים עצמן לא מוצגות למדווח בטופס');
await click('.er-send', 1500);
const post = await lastCall((c) => c.method === 'POST' && c.url === '/api/error-report');
ok(post && JSON.stringify(Object.keys(post.body).sort()) === JSON.stringify(['attachments', 'lastButtons', 'queryParams', 'time', 'title', 'url', 'userText']), 'POST: בדיוק השדות של החלון הישן');
ok(post && post.body.userText.startsWith('לחצתי על שמירה והדף נתקע\n\n[אלמנטים מסומנים:\n1. button#pfSave'), 'userText: תיאור + אלמנטים מסומנים');
ok(post && post.body.userText.split(STEPS_HEADER).length === 2 && /\]$/.test(post.body.userText), 'userText: בלוק הצעדים פעם אחת, בסוף');
ok(post && post.body.attachments.length === 3 && post.body.attachments.some((a) => a && a.name === 'דוח-שגיאה.pdf' && a.dataUrl) && post.body.attachments.filter((a) => typeof a === 'string' && a.startsWith('data:image/')).length === 2, 'attachments: צילום אלמנט + צילום מסך (data URL) + קובץ {name,size,dataUrl}');
ok(post && Array.isArray(post.body.lastButtons) && post.body.lastButtons.length > 0 && post.body.url.startsWith('http://127.0.0.1') && post.body.queryParams === 'אין' && post.body.time.length > 5 && typeof post.body.title === 'string', 'url / time / queryParams / lastButtons / title');
ok((await toast() || '').includes('הדיווח נשלח בהצלחה'), 'טוסט הצלחה');
ok(await exists('#erBig .er3-r.fresh.sel'), 'אחרי השליחה: הפאנל נפתח והדיווח החדש מודגש ונבחר');

// ---------- הסרטת מסך (ai_screen_recording_enabled): הסרטה, "מעלה...", צרופת gdrive: בשליחה ----------
await go(); await openCard(); await p.type('#erTx', 'הסרטה');
await click('.er-cb[data-act="video"]', 900);
ok(((await text('#erRec b')) || '').startsWith('מסריט את המסך'), 'הסרטת מסך: סרגל "מסריט את המסך"');
await click('#other'); await click('#erRec .btn', 400);
ok(await exists('#erPop .er-thumbs .er-vid .er-spin') && (await p.$eval('#erPop .er-send', (e) => e.disabled)) && (await exists('.er-cb[data-act="video"][disabled]')), 'בזמן ההעלאה: תמונה "מעלה", שליחה ואייקון ההסרטה נעולים');
for (let i = 0; i < 20 && (await exists('#erPop .er-send[disabled]')); i++) await sleep(250);
ok(!(await exists('#erPop .er-vid .er-spin')) && (await exists('#erPop .er-thumbs .er-vid')), 'ההעלאה הסתיימה: הסרטת מסך בצרופות');
ok((await calls()).some((c) => c.url === '/api/ai/recording/init' && c.body && c.body.purpose === 'error-report'), 'פתיחת העלאה לדרייב עם purpose=error-report');
await click('.er-send', 1200);
const vpost = await lastCall((c) => c.method === 'POST' && c.url === '/api/error-report');
ok(vpost && vpost.body.attachments.includes('gdrive:DRIVE123') && vpost.body.userText.includes(STEPS_HEADER), 'השליחה כוללת gdrive:<id> + הצעדים שנרשמו בזמן ההסרטה' + (vpost ? '' : ' (אין POST)') + (vpost && !vpost.body.attachments.includes('gdrive:DRIVE123') ? ' atts=' + JSON.stringify(vpost.body.attachments).slice(0, 120) : '') + (vpost && !vpost.body.userText.includes(STEPS_HEADER) ? ' text=' + vpost.body.userText.slice(0, 80) : ''));

// ---------- שליחה: שגיאת תקשורת / שרת ----------
await go('post=fail'); await openCard(); await p.type('#erTx', 'בדיקה'); await click('.er-send', 600);
ok(((await text('#erPop .merr')) || '').includes('שגיאת תקשורת') && (await p.$eval('#erTx', (e) => e.value)) === 'בדיקה', 'שגיאת תקשורת: הודעה, הטקסט נשמר');
await go('post=err'); await openCard(); await p.type('#erTx', 'בדיקה'); await click('.er-send', 600);
ok(((await text('#erPop .merr')) || '').includes('שגיאה בשליחת דיווח'), 'שגיאת שרת: הודעת השרת');

// ---------- שרשור: נקרא, צעדים מוסתרים, מענה אנושי בגוף השיחה, תגובה, טופל, ארכיון ----------
await go(); await openPanel();
ok(await exists('#erBig .er3-r.sel'), 'ברוחב מלא נבחר שרשור אוטומטית');
ok((await p.$$('#erBig .er3-r')).length === 8 && (await exists('#erBig .er3-hr')), 'רשימה: 8 פניות פתוחות ומפריד אחד');
ok((await text('.er3-lnk')) === 'ארכיון (2)', 'קישור ארכיון בתחתית');
ok(!(await exists('.er3-s')), 'אין חיפוש כשיש עד 8 פניות');
await openRow('r1');
const patchRead = await lastCall((c) => c.method === 'PATCH');
ok(patchRead && patchRead.body.reportId === 'r1' && patchRead.body.isReadByUser === true, 'פתיחת שרשור: PATCH isReadByUser');
ok((await text('#snErr .sn-badge')) === '1', 'המונה על האייקון ירד ל-1');
ok(!(await p.evaluate((h) => document.querySelector('#erBig').textContent.includes(h), STEPS_HEADER)), 'מדווח: "הפעולות שבוצעו לפני התקלה" לא מופיע בשרשור');
ok(!(await exists('#erBig .er3-steps')), 'מדווח: אין רשימת צעדים בבועה');
ok(await exists('#erBig .er3-msgs .er3-hum .er-human'), '"אוף! אני צריך מענה אנושי!" בגוף השיחה');
ok(await p.evaluate(() => { const h = document.querySelector('.er3-hum'); const prev = h.previousElementSibling; return prev && prev.classList.contains('prog') && !h.nextElementSibling; }), 'הכפתור מתחת לתשובת הסוכן האחרונה');
ok(!(await p.evaluate(() => document.querySelector('.er3-th').textContent.includes('אוף'))), 'הכפתור לא בכותרת השרשור');
ok(!(await exists('.er3-mw, .er3-menu, [role="menu"]')), 'אין תפריט ⋯');
const rb = await p.$eval('.er3-acts .xlbtn', (e) => { const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), rad: c.borderTopLeftRadius, bg: c.backgroundColor, bd: c.borderTopColor, ic: getComputedStyle(e.querySelector('svg')).color }; });
ok(rb.w === 36 && rb.h === 36 && parseFloat(rb.rad) >= 18 && rb.bg === 'rgb(211, 215, 220)' && rb.bd === 'rgb(127, 184, 230)' && rb.ic === 'rgb(30, 99, 196)', `כפתורי הכותרת: עגולים כחולים של הפלטה (${JSON.stringify(rb)})`);
ok((await p.$$('.er3-acts .xlbtn')).length === 2, 'מדווח: רק "טופל" ו"ארכיון" (בלי פעולות מתכנת)');
ok((await tip('.er3-acts [data-act="handled"]')) === 'סמן כטופל', 'טולטיפ "סמן כטופל"');
ok((await tip('.er3-acts [data-act="archive"]')) === 'העבר לארכיון', 'טולטיפ "העבר לארכיון"');
const nameCol = await p.$eval('.er3-bh b', (e) => getComputedStyle(e).color);
ok(nameCol === 'rgb(154, 122, 31)', `שם השולח בזהב של הפלטה --gm-gold-d (${nameCol})`);
ok((await p.$eval('.er3-b', (e) => e.getAttribute('data-tip'))) && !(await p.$eval('.er3-b', (e) => /\d\d:\d\d/.test(e.querySelector('.er3-bh').textContent))), 'תאריך ושעה רק בטולטיפ של הבועה');
await click('.er-human', 500);
const ph = await lastCall((c) => c.method === 'PATCH');
ok(ph && ph.body.needsHuman === true && ph.body.reportId === 'r1', 'מענה אנושי: PATCH needsHuman=true');
ok(!(await exists('.er-human')) && (await text('.er3-tt small')) === 'הבקשה למענה אנושי נשלחה', 'אחרי הבקשה: הכפתור נעלם, שורת מצב שקטה');
await p.focus('#erRt'); await p.keyboard.type('עדיין לא עובד'); await p.keyboard.press('Enter'); await sleep(600);
const rp = await lastCall((c) => c.url === '/api/error-report/reply');
ok(rp && JSON.stringify(rp.body) === JSON.stringify({ reportId: 'r1', text: 'עדיין לא עובד', isQuestion: false, attachments: [] }), 'תגובה (Enter): { reportId, text, isQuestion:false, attachments }');
ok(((await p.$$eval('.er3-b.mine p', (a) => a.map((x) => x.textContent))) || []).includes('עדיין לא עובד'), 'התגובה מופיעה בשרשור');
await click('.er3-acts [data-act="handled"]', 500);
const pH = await lastCall((c) => c.method === 'PATCH');
ok(pH && pH.body.isHandled === true, 'V: PATCH isHandled=true');
ok((await p.$eval('.er3-acts [data-act="handled"]', (e) => e.getAttribute('aria-pressed'))) === 'true' && (await tip('.er3-acts [data-act="handled"]')) === 'בטל סימון טופל', 'V לחוץ, טולטיפ "בטל סימון טופל"');
await click('.er3-acts [data-act="archive"]', 600);
const pA = await lastCall((c) => c.method === 'PATCH');
ok(pA && pA.body.status === 'ARCHIVED' && (await toast() || '').includes('הועבר לארכיון'), 'ארכיון: PATCH status=ARCHIVED + טוסט');
ok((await text('.er3-lnk')) === 'ארכיון (3)', 'מונה הארכיון עלה');
await click('.er3-lnk', 500); await openRow('r1');
ok((await tip('.er3-acts [data-act="archive"]')) === 'שחזר מהארכיון', 'בארכיון: "שחזר מהארכיון"');
await click('.er3-acts [data-act="archive"]', 600);
ok((await lastCall((c) => c.method === 'PATCH')).body.status === 'OPEN', 'שחזור: PATCH status=OPEN');

// ---------- צרופה: פתיחה והורדה ----------
await go(); await openPanel(); await openRow('r1');
const dl = await p.$eval('.er3-chip .er3-dl', (a) => ({ href: a.getAttribute('href'), d: a.getAttribute('download') }));
ok(dl.href && dl.d, `כל צרופה עם קישור הורדה (${dl.d})`);
await click('.er3-co', 500);
ok(await exists('#scrim2.on #dlg2.er-lb img.er-lbimg'), 'לחיצה על צרופה פותחת אותה בחלון הכהה');
ok(await p.$eval('#dlg2 .er-lbd', (a) => !!a.getAttribute('download')), 'כפתור "הורדה" בחלון');
await p.keyboard.press('Escape'); await sleep(300);
ok(!(await exists('#scrim2')) && (await exists('#erBig')), 'Esc סוגר רק את התצוגה הגדולה');

// ---------- סקיצה: אישור / דחייה ----------
await openRow('r2');
await click('.er3-sk .btn.primary', 600);
let sk = await lastCall((c) => c.url === '/api/error-report/sketch-decision');
ok(sk && sk.body.decision === 'APPROVED' && sk.body.replyId, 'אשר: POST sketch-decision APPROVED');
ok((await text('.er3-sk .er3-q')) === 'אושרה', 'אחרי אישור: "אושרה"');
await go(); await openPanel(); await openRow('r2');
await click('.er3-sk .btn.ghost', 300); await p.type('#erSkNote', 'צבע אחר'); await click('.er3-sk .btn.danger', 600);
sk = await lastCall((c) => c.url === '/api/error-report/sketch-decision');
ok(sk && sk.body.decision === 'REJECTED' && sk.body.note === 'צבע אחר', 'דחה + הערה: POST sketch-decision REJECTED');
await click('.er3-sk a', 500);
ok(await exists('#dlg2 iframe.er-lbfr[sandbox=""]'), 'צפה בסקיצה: iframe sandbox בחלון הכהה');
await p.keyboard.press('Escape'); await sleep(200);

// ---------- Esc בזמן סימון לא סוגר את החלון ----------
await go(); await openCard(); await click('.er-cb[data-act="pick"]', 200); await p.keyboard.press('Escape'); await sleep(300);
ok(!(await exists('#erPill')) && (await exists('#erPop #dlg')), 'Esc מבטל את הסימון בלבד - החלון נשאר');
await p.keyboard.press('Escape'); await sleep(300);
ok(!(await exists('#erPop')), 'Esc נוסף סוגר את החלון');

// ---------- מתכנת ----------
await go('role=programmer'); await openPanel(); await openRow('r1');
const progSteps = await p.evaluate((h) => (document.querySelector('#erBig .er3-b.me0').textContent.split(h).length - 1), STEPS_HEADER);
ok(progSteps === 1, `מתכנת: "הפעולות שבוצעו לפני התקלה" מופיע פעם אחת (${progSteps})`);
ok(((await text('.er3-steps summary')) || '').startsWith('צעדים שהוקלטו'), 'מתכנת: הצעדים מקופלים תחת "צעדים שהוקלטו"');
ok((await p.$$('.er3-th .er3-acts .xlbtn')).length === 4, 'מתכנת: 4 כפתורים (טופל, ארכיון, שאלה פתוחה, העתק)');
ok((await tip('.er3-acts [data-act="question"]')) === 'סמן שיש שאלה פתוחה למדווח' && (await tip('.er3-acts [data-act="copy"]')) === 'העתק פרטי מערכת', 'טולטיפים של פעולות המתכנת');
ok(!(await exists('.er-human')), 'מתכנת: בלי כפתור "מענה אנושי"');
await click('.er3-acts [data-act="question"]', 200);
ok((await p.$eval('#erRt', (e) => e.placeholder)) === 'הקלד תגובה (שאלה פתוחה למדווח)...', 'שאלה פתוחה פעילה: ה-placeholder משתנה');
await p.focus('#erRt'); await p.keyboard.type('איזה דפדפן?'); await click('.er3-reply .er-send', 600);
ok((await lastCall((c) => c.url === '/api/error-report/reply')).body.isQuestion === true, 'מתכנת: התגובה נשלחת עם isQuestion=true');
ok((await p.$eval('.er3-acts [data-act="question"]', (e) => e.getAttribute('aria-pressed'))) === 'false', 'הסימון מתאפס אחרי שליחה');
ok((await p.$$('.er3-hd .er3-acts .xlbtn')).length === 1, 'מתכנת: מתג הסוכן האוטומטי בכותרת הפאנל');
await click('.er3-hd [data-act="agent"]', 500);
ok((await lastCall((c) => c.url === '/api/agent/fix-loop' && c.method === 'PATCH')).body.enabled === true, 'מתג הסוכן: PATCH /api/agent/fix-loop {enabled:true}');
ok(await exists('.er3-hd [data-act="deploy"]'), 'מתג הפריסות מופיע כשהסוכן פעיל');

// ---------- בלי הרשאה ----------
await go('role=user'); await openCard();
ok(await exists('.er-deny') && !(await exists('#erTx')), 'בלי הרשאה: "יצירת דיווח חדש מותרת למנהלים בלבד", בלי טופס');
await click('.er-inb', 500);
ok(await exists('#erBig .er3-r') && !(await exists('.er-newb')), 'בלי הרשאה: "פניות שלי" נפתח, בלי "+ דיווח חדש"');

// ---------- חיפוש (מעל 8), ארבעה אייקונים כשההסרטה כבויה, מעטפת ישנה ----------
await go('data=many'); await openPanel();
ok(await exists('.er3-s input#erQ'), 'חיפוש מופיע כשיש יותר מ-8 פניות');
await p.type('#erQ', 'הדפסה'); await sleep(300);
ok((await p.$$eval('.er3-r .er3-t', (a) => a.map((x) => x.textContent))).every((t) => t.includes('הפוך') || t.includes('הדפסה')), 'החיפוש מסנן (גם לפי טקסט הדיווח)');
await go('rec=0'); await openCard();
ok((await p.$$('#erPop .er-cb')).length === 4 && !(await exists('.er-cb[data-act="video"]')), 'ההגדרה כבויה: 4 אייקונים (בלי הסרטת מסך)');
await go('shell=legacy');
ok(await exists('.topbar-icon-cluster .icon-btn'), 'מעטפת ישנה: כפתור icon-btn');
await click('.topbar-icon-cluster .icon-btn', 600);
ok(await exists('#erPop #dlg #erTx') && (await exists('svg[data-gm-sprite] symbol#gmi-crosshair')), 'מעטפת ישנה: אותו חלון + ספריית האייקונים');
await click('.topbar-icon-cluster .icon-btn', 400);
ok(!(await exists('#erPop')), 'לחיצה נוספת על הכפתור סוגרת');

// ---------- נייד: גיליון תחתון ----------
await p.setViewport({ width: 375, height: 812 });
await go(); await openCard();
const sheet = await p.evaluate(() => { const d = document.querySelector('#scrim.er-sheet #dlg'); if (!d) return null; const r = d.getBoundingClientRect(); return { bottom: Math.round(r.bottom), w: Math.round(r.width) }; });
ok(sheet && sheet.bottom === 812 && sheet.w === 375, `נייד: גיליון תחתון (${JSON.stringify(sheet)})`);
await click('.er-inb', 500); await openRow('r1');
ok(await exists('.er3-l.off') && (await exists('.er3-back')), 'נייד: שרשור במקום הרשימה + חזרה');
const crowd = await p.evaluate(() => { const th = document.querySelector('.er3-th').getBoundingClientRect(); return [...document.querySelectorAll('.er3-th .xlbtn')].every((x) => { const r = x.getBoundingClientRect(); return r.left >= th.left - 1 && r.right <= th.right + 1 && r.width === 36; }); });
ok(crowd, 'נייד: כפתורי הכותרת גלויים ובתוך הכותרת');
await click('.er3-back', 300);
ok(!(await exists('.er3-l.off')), 'חזרה לרשימה');

// ---------- מגע (בלי ריחוף): נגיעה בתיבה חושפת את האייקונים; נגיעה בבועה מציגה תאריך ושעה; נגיעה ראשונה בכפתור הצף רק חושפת ----------
await p.setViewport({ width: 375, height: 812, hasTouch: true, isMobile: true });
const cdp = await p.createCDPSession();
await cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }, { name: 'pointer', value: 'coarse' }] });
await go();
const fabBox = await p.$eval('#erFab .er-fab-b', (e) => { const r = e.getBoundingClientRect(); return { x: Math.min(r.left + r.width / 2, 370), y: r.top + r.height / 2 }; });
await p.touchscreen.tap(Math.max(fabBox.x, 368), fabBox.y); await sleep(400);
ok(await exists('#erFab.reveal') && !(await exists('#scrim.er-sheet')), 'מגע: נגיעה ראשונה בכפתור הצף רק חושפת אותו');
await sleep(500); const fab2 = await center('#erFab .er-fab-b'); await sleep(200); await p.touchscreen.tap(fab2.x, fab2.y); await sleep(700);
ok(await exists('#scrim.er-sheet #dlg'), 'מגע: נגיעה שנייה פותחת את הגיליון');
const tx = await center('#erTx'); await p.touchscreen.tap(tx.x, tx.y); await sleep(400);
ok((await exists('.er-composer.reveal')) && (await p.$eval('.er-cb', (e) => getComputedStyle(e).opacity)) === '1', 'מגע: נגיעה בתיבה חושפת את האייקונים');
await click('.er-inb', 500); await p.touchscreen.tap(...Object.values(await center('.er3-r[data-id="r2"]'))); await sleep(600);
const bub = await center('.er3-b.me0 p'); await sleep(400); await p.touchscreen.tap(bub.x, bub.y); await sleep(300);
ok(/\d\d:\d\d/.test((await p.evaluate(() => { const t = document.querySelector('.gm-er .pl-tt.on'); return t ? t.textContent : ''; })) || ''), 'מגע: נגיעה בבועה מציגה תאריך ושעה');
await cdp.send('Emulation.setEmulatedMedia', { features: [] });

ok(errs.length === 0, 'בלי שגיאות דפדפן' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
s.close();
await Promise.race([b.close(), sleep(5000)]); // אחרי אמולציית מגע Chrome לפעמים לא נסגר - לא מחזיקים את הפורט
process.exit(fails ? 1 : 0);
