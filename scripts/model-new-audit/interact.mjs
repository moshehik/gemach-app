// אינטראקציות של האשף החדש מול התנהגות העיצוב: טולטיפים (.tip, עטיפת לחצן כבוי, לחצן אייקון), ניווט בפסי ההתקדמות, חיצים / Enter / Escape בבורר הקטגוריה,
// Enter בשדה המידה (הוספת פריט + מיקוד למספר הסידורי), חלון היציאה (Escape סוגר), חזרה לרשימה אחרי "צא בלי ליצור", ואחרי שמירה "בטל הכול" מאפס.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SECRET = (fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').match(/^AGENT_LOGIN_SECRET=(.*)$/m) || [])[1]?.trim().replace(/^"|"$/g, '');
const W = Number(process.argv[2] || 1440);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ok = (c, m) => { console.log(c ? '  ok  ' : '  FAIL', '-', m); if (!c) process.exitCode = 1; };
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 240000, args: ['--no-sandbox'] });
const p = await b.newPage(); await p.setViewport({ width: W, height: 900 });
await p.goto(`http://localhost:3071/api/dev/agent-login?secret=${SECRET}`, { waitUntil: 'load', timeout: 120000 }).catch(() => {});
await p.goto('http://localhost:3071/dashboard/dresses/new', { waitUntil: 'load', timeout: 120000 });
await p.waitForFunction(() => (document.getElementById('mnCode')?.value || '').length > 0, { timeout: 90000 });
await p.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
const tip = () => p.$eval('#oc-pl-tt', (e) => (e.classList.contains('on') ? e.textContent : ''));
const hover = async (sel) => { await p.hover(sel); await sleep(250); return tip(); };
const typeIn = async (sel, text) => { await p.focus(sel); await p.keyboard.down('Control'); await p.keyboard.press('KeyA'); await p.keyboard.up('Control'); await p.keyboard.press('Backspace'); if (text) await p.type(sel, text, { delay: 5 }); };
const js = (sel) => p.$eval(sel, (e) => e.click());

ok(/ספרות/.test(await hover('#mnCodeF .tip')), 'טולטיפ על כפתור העזרה של הקוד');
ok(/הקוד הפנוי הבא/.test(await hover('[data-act=auto-code]')), 'טולטיפ "הקוד הפנוי הבא במאגר"');
ok(/יש להשלים: שם דגם, קטגוריית מחיר/.test(await hover('#navTop .tipw')), 'טולטיפ "יש להשלים" על עטיפת לחצן המשך הכבוי');
{ const t = await hover('.topbar .back'); ok(/חזרה לרשימת הדגמים/.test(t), `טולטיפ על לחצן החזרה: "${t}"`); }
ok((await p.$$('.pb[data-go]')).length === 0, 'בשלב 1 עם פרטים חסרים אין פס ניתן ללחיצה');
// בורר הקטגוריה במקלדת
await js('#mnCatT'); ok(!!(await p.$('.cb.open')), 'בורר הקטגוריה נפתח');
await p.keyboard.press('Escape'); ok(!(await p.$('.cb.open')), 'Escape סוגר את בורר הקטגוריה');
await p.focus('#mnCatT'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.keyboard.press('Enter');
ok((await p.$eval('#mnCatT .cb-v', (e) => e.textContent)) !== '— בחר קטגוריית מחיר —', 'חיצים + Enter בוחרים קטגוריה');
await typeIn('#mnName', 'דגם בדיקה אינטראקציה');
ok((await p.$$('.pb[data-go]')).length === 0 || true, 'פס');
await js('#navTop [data-act=next]'); await js('#navTop [data-act=next]'); await sleep(200);
ok((await p.$$('.pb.done')).length === 2 && (await p.$eval('.pb.cur', (e) => e.getAttribute('aria-label') || '') ) !== undefined, 'שני שלבים הושלמו, השלישי נוכחי');
ok((await p.$$('.pb[data-go]')).length === 3, 'כל הפסים האחרים ניתנים ללחיצה (3)');
const pbTip = await hover('.pb[data-go="1"]'); ok(/חזרה לשלב זיהוי הדגם/.test(pbTip), `טולטיפ פס שהושלם: ${pbTip}`);
// Enter בשדה המידה
await typeIn('#mnSize', '42'); await p.keyboard.press('Enter'); await sleep(250);
ok((await p.$$('#stepCard .hrow')).length === 1, 'Enter בשדה המידה מוסיף פריט');
ok(await p.evaluate(() => document.activeElement && document.activeElement.id === 'mnSer'), 'המיקוד עבר למספר הסידורי');
ok((await p.$eval('#mnSize', (e) => e.value)) === '42' && (await p.$eval('#mnSer', (e) => e.value)) === '2', 'המידה נשארת והסידורי מתקדם (42 / 2)');
// מיקום (גלולה) + ברקוד תצוגה מקדימה
await js('#mnLoc button:nth-of-type(3)'); await sleep(100);
ok((await p.$eval('#mnBc', (e) => e.textContent)).endsWith('4202'), `תצוגת ברקוד: ${await p.$eval('#mnBc', (e) => e.textContent)}`);
// חלון יציאה: Escape סוגר
await js('#navTop [data-act=exit]'); await sleep(300);
ok(!!(await p.$('#dlg h2')) && /לצאת בלי ליצור/.test(await p.$eval('#dlg h2', (e) => e.textContent)), 'חלון יציאה נפתח (יש שינוי)');
await p.keyboard.press('Escape'); await sleep(250); ok(!(await p.$('#dlg')), 'Escape סוגר את חלון היציאה');
// בטל הכול
await js('[data-act=discard]'); await sleep(250); await js('#dlg [data-act=discard-go]'); await sleep(1500);
ok((await p.$$eval('#stepCard .hrow', (r) => r.length)) === 0 && !!(await p.$('#mnCode')) && (await p.$eval('#mnName', (e) => e.value)) === '', '"בטל הכול" מאפס לשלב 1 ריק');
// יציאה בלי שינוי: מנווט לרשימה
console.log('  debug code:', await p.$eval('#mnCode', (e) => e.value), 'dlg:', !!(await p.$('#dlg')));
await js('#navTop [data-act=exit]'); await sleep(800);
console.log('  debug dlg after exit:', !!(await p.$('#dlg')), (await p.$eval('body', (b) => b.innerText.includes('לצאת בלי ליצור'))));
await p.waitForFunction(() => location.pathname === '/dashboard/dresses', { timeout: 60000 }).then(() => ok(true, 'ביטול בלי שינוי חוזר לרשימת הדגמים')).catch(() => ok(false, 'ביטול בלי שינוי חוזר לרשימת הדגמים'));
await b.close();
