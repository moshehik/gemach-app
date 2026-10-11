// pkCss.js - ה-CSS של הגיליונות המודפסים (.pk-sheet ... .pk-lab) כמחרוזת: אותו טקסט משמש את התצוגה המקדימה והמדידה (מוזרק כ-<style> פעם אחת),
// את ההדפסה מהדפדפן ואת מסמך ה-HTML שנשלח לשרת ה-PDF (POST /api/pdf, מצב html: בלי JS, רשת חסומה חוץ מ-Google Fonts) - שלושתם תמיד זהים.
// פורט 1:1 של scratch/emp-models-build/print-kit.css (מחלקות .pk-*), מקור: דפי-הדפסה-עיצוב.html (.sh-* שונה ל-.pk-*). צבעים קבועים בלבד -
// אין שום משתנה CSS של ערכת הנושא (חלון הדפסה / שרת ה-PDF לא יורשים אותם). ברירת מחדל שחור-לבן; data-tone=color מוסיף נייבי וזהב עדינים.
// שינוי מהמוק: הגופן Rubik ראשון (כמו שאר דפי ההדפסה החדשים: print/order, print/customer...), ואחריו מה שהמוק השתמש בו.
export const SHEET_CSS = `
/* ---------- the A4 sheet ---------- */
.pk-sheet{--rp:2.3mm;--ink:#111;--mut:#555;--rule:#111;--acc:#111;--thbg:transparent;--ttl:#111;--soft:#f3f3f3;
  width:210mm;height:296.5mm;padding:10mm 12mm 9mm;background:#fff;color:var(--ink);
  font:400 12px/1.4 "Rubik","Segoe UI",Arial,"Helvetica Neue",sans-serif;letter-spacing:normal;direction:rtl;text-align:start;display:flex;flex-direction:column;position:relative;overflow:hidden;
  -webkit-print-color-adjust:exact;print-color-adjust:exact}
.pk-sheet[data-tone=color]{--rule:#0f2c52;--acc:#9a7a1f;--thbg:#e8edf4;--ttl:#0f2c52;--soft:#eef2f7}
.pk-sheet,.pk-sheet *{box-sizing:border-box}
.pk-head{display:flex;align-items:flex-start;gap:6mm;padding-bottom:2.6mm}
.pk-id{flex:1;min-width:0}
.pk-bsd{font-size:9.5px;font-weight:600;color:var(--mut);line-height:1}
.pk-id b{display:block;font-size:17px;line-height:1.2;color:var(--ttl);margin-top:1mm;font-weight:700}
.pk-id span{display:block;font-size:10px;color:var(--mut)}
.pk-meta{display:flex;flex-direction:column;align-items:flex-end;gap:1.6mm;flex:none}
.pk-date{text-align:end;font-weight:600;font-size:12px;line-height:1.25}
.pk-date small{display:block;font-weight:400;color:var(--mut);font-size:10.5px}
.pk-bc{display:flex;flex-direction:column;align-items:center;gap:.4mm}
.pk-bc svg{display:block}
.pk-bc small{font-size:7.5px;letter-spacing:.2px;color:#222;line-height:1.1;white-space:nowrap}
.pk-tb{display:flex;align-items:center;flex-wrap:wrap;gap:1mm 3mm;border-top:.9mm solid var(--rule);border-bottom:.3mm solid var(--acc);padding:2.1mm 0;margin-bottom:3.4mm}
.pk-chip{border:.3mm solid var(--rule);border-radius:99px;padding:.2mm 2.6mm;font-size:10px;font-weight:600;white-space:nowrap;color:var(--ttl)}
.pk-h1{font-size:21px;line-height:1.1;color:var(--ttl);font-weight:700}
.pk-sub{color:var(--mut);font-size:11px;flex:1 1 40mm;min-width:0}
.pk-sum{margin-inline-start:auto;font-weight:600;font-size:11px;text-align:end;line-height:1.25;white-space:nowrap}
.pk-body{flex:1 1 auto;min-height:0;max-height:none;overflow:hidden} /* max-height:none: neutralises globals.css "div:has(> table){max-height:75vh}" */
.pk-foot{margin-top:auto;border-top:.3mm solid var(--rule);padding-top:1.8mm;display:flex;align-items:center;gap:5mm;font-size:9.5px;color:var(--mut);flex:none}
.pk-foot .pk-pn{margin-inline-start:auto;font-weight:700;color:var(--ink);font-size:10.5px;white-space:nowrap}
/* narrow header (label pages) */
.pk-sheet.slim{padding-top:8mm}
.pk-sheet.slim .pk-head{padding-bottom:1.4mm;align-items:center}
.pk-sheet.slim .pk-id{display:flex;align-items:baseline;gap:2.5mm}
.pk-sheet.slim .pk-id b{display:inline;font-size:14px;margin:0}
.pk-sheet.slim .pk-id span{display:none}
.pk-sheet.slim .pk-bsd{display:inline}
.pk-sheet.slim .pk-meta{flex-direction:row;align-items:center;gap:4mm}
.pk-sheet.slim .pk-date small{display:inline;margin-inline-start:1.5mm}
.pk-sheet.slim .pk-tb{padding:1.4mm 0;margin-bottom:2.4mm}
.pk-sheet.slim .pk-h1{font-size:16px}

/* body: tables */
.pk-sheet .pk-t{width:100%;border-collapse:collapse;table-layout:fixed;font-size:11.5px;border:0;background:transparent}
.pk-sheet .pk-t th{background-color:var(--thbg)!important;background-image:none!important;text-align:start;font-weight:700;font-size:10.5px;padding:1.3mm 1.4mm;border:0;border-top:.3mm solid var(--rule);border-bottom:.5mm solid var(--rule)!important;white-space:nowrap;color:var(--ink)!important;line-height:1.4;position:static!important;box-shadow:none!important;z-index:auto!important}
/* the !important above (+ td/group border colours below) neutralise globals.css "table thead tr th{...!important}" (sticky header, theme colours) and "table tbody td{border-bottom-color:var(--divider)!important}" - a printed sheet must never follow the site theme */
.pk-sheet .pk-t td{padding:var(--rp) 1.4mm;border:0;border-bottom:.2mm solid #b9b9b9;border-bottom-color:#b9b9b9!important;vertical-align:middle;overflow-wrap:anywhere;font-size:11.5px;color:var(--ink);background:transparent;text-align:start}
.pk-sheet .pk-t td.pk-c,.pk-sheet .pk-t th.pk-c{text-align:center}
.pk-sheet .pk-t td.pk-nw{white-space:nowrap}
.pk-sheet .pk-t td small{display:block;color:var(--mut);font-size:10px;line-height:1.25}
.pk-sheet .pk-t td.pk-bcc{text-align:center;padding-top:calc(var(--rp) - .3mm);padding-bottom:calc(var(--rp) - .3mm)}
.pk-sheet .pk-t td.pk-bcc svg{display:inline-block;vertical-align:middle}
.pk-sheet .pk-t td.pk-bcc small{font-size:7.5px;color:#222}
.pk-sheet .pk-t tr.pk-g td{background:var(--soft);font-weight:700;border-top:.3mm solid var(--rule);border-bottom:.3mm solid #888;border-bottom-color:#888!important;padding:1.2mm 1.4mm;font-size:11.5px;color:var(--ttl)}
.pk-sheet .pk-t tr.pk-tot td{font-weight:700;border-top:.5mm solid var(--rule);border-bottom:0;background:var(--thbg)}
.pk-sheet .pk-t tr.pk-tot td:first-child{font-size:11.5px}
.pk-sheet .pk-ph,.pk-sheet .pk-num{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}
.pk-sheet .pk-dim{color:var(--mut)}
/* body: blocks */
.pk-sheet .pk-dg{font-weight:700;font-size:12.5px;border-bottom:.3mm solid var(--rule);padding:0 0 1mm;margin:4mm 0 2mm;color:var(--ttl)}
.pk-sheet .pk-dg:first-child{margin-top:0}
.pk-sheet .pk-kv{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2.4mm 6mm;border:.3mm solid var(--rule);border-radius:1.2mm;padding:2.4mm 3mm;margin:0 0 3mm}
.pk-sheet .pk-kv div{min-width:0}
.pk-sheet .pk-kv small{display:block;font-size:10px;color:var(--mut);line-height:1.3}
.pk-sheet .pk-kv b{display:block;font-size:12.5px;font-weight:700;color:var(--ink)}
.pk-sheet .pk-stats{display:flex;gap:4mm;font-size:11px;margin:0 0 3mm;flex-wrap:wrap}
.pk-sheet .pk-stats div{border:.3mm solid #999;border-radius:1.2mm;padding:1mm 3mm}
.pk-sheet .pk-stats b{font-size:13px;color:var(--ttl);font-weight:700}
.pk-sheet .pk-note{border:.3mm solid #aaa;background:var(--soft);border-radius:1.2mm;padding:1.6mm 2.4mm;font-size:11px;margin:0 0 3mm}
.pk-sheet .pk-note b{color:var(--ttl);font-weight:700;margin-inline-end:2mm}
/* labels */
.pk-sheet .pk-lab-grid{display:grid;grid-template-columns:repeat(3,60mm);grid-auto-rows:39.6mm;gap:2mm 3mm;justify-content:center}
.pk-sheet .pk-lab{border:.25mm dashed #888;border-radius:1.8mm;padding:1.6mm 2.2mm 1.2mm;display:flex;flex-direction:column;overflow:hidden;line-height:1.25;background:#fff}
.pk-sheet .pk-lab-nm{font-size:14px;font-weight:700;color:var(--ttl);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pk-sheet .pk-lab-md{font-size:11px;white-space:nowrap}
.pk-sheet .pk-lab-md b{font-size:17px;font-weight:700;color:var(--ttl)}
.pk-sheet .pk-lab-bc{margin-top:auto;display:flex;flex-direction:column;align-items:center;gap:.3mm}
.pk-sheet .pk-lab-bc svg{display:block}
.pk-sheet .pk-lab-bc small{font-size:7.5px;color:#222;line-height:1}
`;

// כללי ההדפסה מהדפדפן - מוזרקים רק בזמן ההדפסה (ושוב מוסרים), כדי ש-@page וההסתרה לא ישפיעו על שום הדפסה אחרת באתר.
// html.pk-printing נקבע רגע לפני window.print() ומוסר ב-afterprint. #pk-host = השורש של התצוגה (#pkv) ואזור ההדפסה (#pkPrint).
export const PRINT_CSS = `
@page{size:A4;margin:0}
@media print{
  html.pk-printing,html.pk-printing body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;min-height:0!important;overflow:visible!important}
  html.pk-printing body>*:not(#pk-host){display:none!important}
  html.pk-printing #pk-host #pkv{display:none!important}
  html.pk-printing #pk-host #pkPrint{display:block!important}
  #pkPrint .pk-sheet{box-shadow:none!important;border:0;margin:0;transform:none;position:relative;break-after:page;page-break-after:always;break-inside:avoid}
  #pkPrint .pk-sheet:last-child{break-after:auto;page-break-after:auto}
  *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}
`;

// מסמך ה-HTML לשרת ה-PDF: אותם גיליונות (כבר מעומדים), @page ללא שוליים, גופן Rubik מ-Google Fonts (המארח היחיד שהשרת מתיר חוץ מ-data:).
export const PDF_DOC_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap');
@page{size:A4;margin:0}
html,body{margin:0;padding:0;background:#fff}
.pk-sheet{break-after:page;page-break-after:always;break-inside:avoid;box-shadow:none}
.pk-sheet:last-child{break-after:auto;page-break-after:auto}
*{-webkit-print-color-adjust:exact;print-color-adjust:exact}
`;
