'use client';

// pkDom.js - החלק של ההדפסה שנוגע ב-DOM: הזרקת ה-CSS של הגיליונות, ה-adapter של מנוע העימוד (מדידת הפריסה האמיתית בגיליון נסתר מחוץ למסך)
// ובניית הגיליונות ממודל מסמך. הלוגיקה עצמה (paginate / shell / table) טהורה ונמצאת ב-pkCore.js.
import { MM, fixN, paginate, pagesToSheets, shell } from './pkCore';
import { SHEET_CSS } from './pkCss';

/** מזריק את CSS הגיליונות פעם אחת למסמך (תצוגה + מדידה) */
export function ensureSheetStyles() {
  if (document.getElementById('pk-sheet-css')) return;
  const st = document.createElement('style');
  st.id = 'pk-sheet-css';
  st.textContent = SHEET_CSS;
  document.head.appendChild(st);
}

function measureHost() {
  let h = document.getElementById('pkMeasure');
  if (!h) {
    h = document.createElement('div');
    h.id = 'pkMeasure';
    h.setAttribute('aria-hidden', 'true');
    document.body.appendChild(h);
  }
  return h;
}

/** ה-adapter של paginate מעל DOM אמיתי: ביקוש "נכנס בגוף הגיליון" = הקצה התחתון של האטום האחרון, פחות מרווח של 3 מ"מ */
export function domAdapter(head, ctx, host) {
  const GAP = 3 * MM;
  let bodyEl = null;
  return {
    newPage(n) {
      host.innerHTML = shell(Object.assign({}, head, { body: '', pn: n }), ctx);
      bodyEl = host.querySelector('.pk-body');
    },
    put(a, prev) {
      let tbl = null;
      let node;
      if (a.table) {
        if (prev) tbl = prev.tbl;
        else {
          bodyEl.insertAdjacentHTML('beforeend', `<table class="pk-t"><colgroup>${a.cols || ''}</colgroup><thead>${a.thead}</thead><tbody></tbody></table>`);
          tbl = bodyEl.lastElementChild;
        }
        tbl.tBodies[0].insertAdjacentHTML('beforeend', a.html);
        node = tbl.tBodies[0].lastElementChild;
      } else {
        bodyEl.insertAdjacentHTML('beforeend', a.html);
        node = bodyEl.lastElementChild;
      }
      return { node, tbl };
    },
    remove(h) {
      h.node.remove();
      if (h.tbl && !h.tbl.tBodies[0].children.length) h.tbl.remove();
    },
    fits() {
      const last = bodyEl.lastElementChild;
      return !last || last.getBoundingClientRect().bottom <= bodyEl.getBoundingClientRect().bottom - GAP + 0.5;
    },
    finalize() { return host.firstElementChild.outerHTML; },
  };
}

/** מודל מסמך (pkSpecs) -> מערך מחרוזות HTML של גיליונות, ברירת מחדל שחור-לבן */
export function buildSheets(doc, ctx) {
  ensureSheetStyles();
  if (doc.kind === 'pages') return pagesToSheets(doc.pages, ctx);
  const host = measureHost();
  try {
    return fixN(paginate(doc.atoms, domAdapter(doc.head, ctx, host)));
  } finally {
    host.innerHTML = '';
  }
}

/** ממתין לגופן Rubik (נטען מ-Google Fonts ע"י ה-CSS של הדף) לפני המדידה - אחרת העימוד נמדד בגופן חלופי. לא חוסם מעבר ל-2.5 שניות. */
export async function ensureFonts() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
  const loads = [400, 500, 600, 700].map((w) => document.fonts.load(`${w} 12px Rubik`, 'אבג abc 123').catch(() => []));
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 2500))]);
}
