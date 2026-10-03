// בדיקת דפדפן אמיתית לדף ה-PDF / ההדפסה של תוצאות החיפוש (searchPdf.js). מריץ Chrome headless:
//  1. מדפיס ל-PDF את אותו HTML (מסלול הדפסה: פונט מקומי; ומסלול שרת: lib/pdf.js renderPdf עם אותם שוליים ופונט Google כמו /api/pdf)
//  2. בודק לכל מצב: מספר עמודי ה-PDF = מספר העמודים שחושב, "עמוד X מתוך Y" בכל עמוד, כותרת בכל עמוד, כל שורה בדיוק פעם אחת
//     ושורה אחת מוצגת בשלמותה בעמוד אחד (לא נחתכת), וגם בדיקת גיאומטריה ב-DOM: אף שורה לא חורגת מגוף העמוד, RTL (getBoundingClientRect).
//  3. שומר PNG של העמודים ל-scratch/_agent_tmp/search-pdf-audit (לא נכנס ל-git).
// דרישות: Chrome מותקן (CHROME_PATH אחרת ברירת מחדל), python3 עם PyMuPDF (fitz) לחילוץ טקסט ועמודים מה-PDF.
// הרצה: node scripts/search-pdf-audit/run.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import puppeteer from 'puppeteer-core';
import { buildSearchSheet, sectionsFromGeneral, sectionFromRecords } from '../../app/components/home/searchPdf.js';
import { normalizeSearch, applyScope } from '../../app/components/home/homeLogic.js';
import { renderPdf } from '../../lib/pdf.js';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = path.resolve(import.meta.dirname, '../../scratch/_agent_tmp/search-pdf-audit');
fs.mkdirSync(OUT, { recursive: true });
let failed = 0;
const ok = (c, msg) => { if (!c) { failed++; console.error('  FAIL -', msg); } else console.log('  ok   -', msg); };

const NAMES = ['מרים כהן', 'שרה לוי', 'רחל אברמוביץ', 'לאה פרידמן', 'חנה גולדברג', 'אסתר שפירא'];
const res = applyScope(normalizeSearch({
  customers: Array.from({ length: 45 }, (_, i) => ({ id: 'c' + i, firstName: NAMES[i % 6].split(' ')[0], lastName: NAMES[i % 6].split(' ')[1] + ' ' + (1000 + i), phone1: '050-' + (1234000 + i), city: 'ירושלים' })),
  orders: Array.from({ length: 50 }, (_, i) => ({ id: 'o' + i, orderId: 40100 + i * 13, firstName: NAMES[i % 6].split(' ')[0], lastName: 'ה' + (2000 + i), eventDateHebrew: 'כ״א תשרי', status: ['', 'הוחזר', 'מושכר'][i % 3] })),
  rentals: Array.from({ length: 25 }, (_, i) => ({ orderId: 40100 + i, catalogName: 'תחרה קלאסית ' + (3000 + i), barcode: '8812-' + (6000 + i), sizeText: String(36 + (i % 6) * 2) })),
}), null);
const adv = sectionFromRecords(Array.from({ length: 60 }, (_, i) => ({
  הזמנה: '#' + (50000 + i), לקוחה: NAMES[i % 6] + ' ' + (4000 + i), טלפון: '052-' + (7000000 + i), 'תאריך אירוע': 'כ״א תשרי', החזרה: 'ח׳ חשוון', סטטוס: 'פעיל', סניף: 'נווה יעקב',
  הערה: i % 3 ? 'לתקן שולי שמלה לפני האירוע ולארוז בקולב ' + (5000 + i) : '',
})), 'תוצאות');

const SCENARIOS = [
  { name: 'general-120-portrait', sheet: (forServer) => buildSearchSheet({ sections: sectionsFromGeneral(res), query: 'כהן', gmach: 'גמ״ח שמלות', forServer }), uniq: (r) => r.map((x) => x.at(0)) },
  { name: 'adv-60-landscape', sheet: (forServer) => buildSearchSheet({ sections: [adv], title: 'תוצאות חיפוש מתקדם', query: 'הזמנות', queryLabel: 'סינון', scopeChip: 'תחום: הזמנות', forServer }), expectLandscape: true },
];

function pdfInfo(file) {
  const py = `
import fitz, json, sys
d = fitz.open(sys.argv[1]); out = []
for i, p in enumerate(d):
    out.append({'w': round(p.rect.width), 'h': round(p.rect.height), 'text': p.get_text()})
    if i < 3: p.get_pixmap(dpi=70).save(sys.argv[2] + '-p' + str(i + 1) + '.png')
print(json.dumps(out, ensure_ascii=False))`;
  return JSON.parse(execFileSync('python', ['-X', 'utf8', '-c', py, file, file.replace(/\.pdf$/, '')], { encoding: 'utf8', maxBuffer: 1 << 26 }));
}

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
try {
  for (const sc of SCENARIOS) {
    for (const mode of ['print', 'server']) {
      console.log(`\n== ${sc.name} / ${mode}`);
      const sheet = sc.sheet(mode === 'server');
      const file = path.join(OUT, `${sc.name}-${mode}.pdf`);
      if (mode === 'server') {
        fs.writeFileSync(file, await renderPdf({ html: sheet.html, landscape: sheet.landscape }));
      } else {
        const page = await browser.newPage();
        await page.setContent(sheet.html, { waitUntil: 'load' });
        // גיאומטריה ב-DOM: כל שורה בתוך גוף העמוד שלה; RTL: העמודה הראשונה מימין לעמודה האחרונה
        const geo = await page.evaluate(() => {
          const bad = [];
          let rtl = true;
          document.querySelectorAll('.pg').forEach((pg, i) => {
            const bd = pg.querySelector('.bd').getBoundingClientRect();
            pg.querySelectorAll('.r').forEach((r) => {
              const b = r.getBoundingClientRect();
              if (b.bottom > bd.bottom + 0.5 || b.top < bd.top - 0.5 || b.right > bd.right + 0.5 || b.left < bd.left - 0.5) bad.push(i + 1);
              const cells = r.children;
              if (cells.length > 1 && cells[0].getBoundingClientRect().left < cells[cells.length - 1].getBoundingClientRect().left) rtl = false;
            });
          });
          const pg0 = document.querySelector('.pg').getBoundingClientRect();
          const bgs = [...document.querySelectorAll('.pg,.hd,.cx,.r,.c')].map((e) => getComputedStyle(e).backgroundImage).filter((v) => v !== 'none');
          return { bad, rtl, pgW: Math.round(pg0.width), pgH: Math.round(pg0.height), bgImages: bgs.length, bodyBg: getComputedStyle(document.body).backgroundColor };
        });
        ok(geo.bad.length === 0, `אף שורה לא חורגת מגוף העמוד (DOM) [${geo.bad.join(',')}]`);
        ok(geo.rtl, 'RTL: העמודה הראשונה מימין (getBoundingClientRect)');
        ok(geo.bgImages === 0, 'אין תמונות רקע בדף');
        await page.pdf({ path: file, preferCSSPageSize: true, printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } });
        await page.close();
      }
      const pages = pdfInfo(file);
      ok(pages.length === sheet.pages, `מספר עמודי ה-PDF (${pages.length}) = החישוב (${sheet.pages})`);
      const land = pages[0].w > pages[0].h;
      ok(land === sheet.landscape, `כיוון הדף ב-PDF ${land ? 'לרוחב' : 'לאורך'}`);
      pages.forEach((p, i) => {
        const n = i + 1;
        const t = p.text.replace(/\s+/g, ' ');
        // הטקסט מה-PDF בסדר ויזואלי הפוך לעברית; בודקים את שני הספרות ואת המילים בלי להסתמך על סדר
        ok(/\b/.test(t) && t.includes(String(sheet.pages)) && t.includes(String(n)) && /עמוד|דומע/.test(t), `עמוד ${n}: מספר עמוד "X מתוך ${sheet.pages}"`);
        ok(/תוצאות|תואצות/.test(t) && /תשפ|ז״פשת|ז"פשת|תשרי|ירשת/.test(t), `עמוד ${n}: כותרת + תאריך עברי`);
      });
      // כל ערך ייחודי של שורה (שם משפחה+מספר / מס' הזמנה) מופיע בעמוד אחד בדיוק (שורה לא נחתכת ולא כפולה)
      const all = pages.map((p) => p.text);
      const probes = sc.name.startsWith('general') ? [...res.customers.slice(0, 45).map((c) => String(1000 + Number(c.id.slice(1)))), ...res.orders.map((o) => String(o.id))] : Array.from({ length: 60 }, (_, i) => String(50000 + i));
      const miss = probes.filter((p) => all.filter((t) => t.includes(p)).length !== 1);
      ok(miss.length === 0, `כל שורה מופיעה בעמוד אחד בדיוק (${probes.length} נבדקו${miss.length ? ', חריגות: ' + miss.slice(0, 5) : ''})`);
    }
  }
} finally {
  await browser.close();
}
console.log(failed ? `\n${failed} FAILED` : '\nall ok');
process.exit(failed ? 1 : 0);
