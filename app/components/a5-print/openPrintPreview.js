'use client';

// openPrintPreview.js - נקודת הכניסה היחידה להדפסה / הורדת PDF מעוצבים בכל מסך:
//     await openPrintPreview({ doc: 'employees-list', kind: 'print' | 'download', data: { rows, state, filters }, say })
// doc = מזהה ב-pkRegistry.js; data = מה שהבונה של המסמך צריך (ר' pkSpecs.js); say(title, kind, text) = הטוסט של המסך (להודעת "אין מה להדפיס").
// התצוגה עצמה נטענת כשורש React נפרד על document.body (#pk-host) - לא תלויה בעץ של המסך שפתח אותה ולא בקשר הדיאלוגים שלו.
// מחזיר { ok: true } כשנפתחה תצוגה, אחרת { ok: false, reason }.
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import PrintPreview from './PrintPreview';
import { PRINT_DOCS } from './pkRegistry';
import { buildSheets, ensureFonts } from './pkDom';
import { makePrintCtx, pdfBaseName } from './pkContext';

let host = null;
let root = null;
let opener = null;

function ensureHost() {
  if (host && document.body.contains(host)) return;
  host = document.createElement('div');
  host.id = 'pk-host';
  const print = document.createElement('div');
  print.id = 'pkPrint';
  print.setAttribute('aria-hidden', 'true');
  const mount = document.createElement('div');
  mount.id = 'pk-mount';
  host.appendChild(mount);
  host.appendChild(print);
  document.body.appendChild(host);
  root = createRoot(mount);
}

export function closePrintPreview() {
  if (root) root.render(null);
  if (opener && document.contains(opener)) { try { opener.focus({ preventScroll: true }); } catch { /* */ } }
  opener = null;
}

export async function openPrintPreview({ doc: docId, kind = 'print', data, say, onDone }) {
  const spec = PRINT_DOCS[docId];
  if (!spec) throw new Error(`מסמך הדפסה לא מוכר: ${docId}`);
  const mode = kind === 'download' ? 'download' : 'print';
  const active = typeof document !== 'undefined' ? document.activeElement : null;
  const ctx = await makePrintCtx();
  const doc = spec.build(data, ctx);
  if (doc.empty) {
    if (say) say(doc.empty.title, 'warn', doc.empty.text);
    return { ok: false, reason: 'empty' };
  }
  await ensureFonts();
  const sheets = buildSheets(doc, ctx);
  if (!sheets.length) {
    if (say) say('אין מה להדפיס', 'warn', '');
    return { ok: false, reason: 'empty' };
  }
  ensureHost();
  if (!opener) opener = active && active !== document.body ? active : null;
  root.render(createElement(PrintPreview, {
    sheets, previewTitle: doc.previewTitle, kind: mode, pdfName: pdfBaseName(doc.file, ctx), surface: spec.surface, onClose: closePrintPreview, onDone,
  }));
  return { ok: true, sheets: sheets.length };
}
