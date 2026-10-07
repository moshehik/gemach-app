// lib/printFitOnePage.js - "הזמנה מודפסת תמיד בעמוד אחד" (דיווחים 6f173798 + 7d921d3b, נווה יעקב).
// נטען רק מ-app/print/order/page.js, ורק כש-print_order_fit_one_page=true (כבוי = אפס שינוי בהדפסה).
//
// איך זה עובד (בלי לנחש לפי מספר פריטים - מודדים את הדף האמיתי):
//   1. מודדים את גובה כל הזמנה ברוחב שבו היא מודפסת בפועל (190 מ"מ = A4 פחות השוליים של @page ב-app/print/order/page.js).
//   2. נכנס לעמוד (עם מרווח ביטחון) - לא נוגעים בכלום, ההדפסה זהה לקודמת.
//   3. לא נכנס - שלב "מצומצם": בלי מסגרות/רקעים מיותרים, לוגו וכותרת קטנים, ריווחים קטנים (class fit-compact).
//   4. עדיין לא נכנס - מקטינים את הכתב והריווחים בכל ההזמנה ביחס (CSS zoom) עד שנכנסת, עד רצפה (FIT_MIN_SCALE).
// הלוגיקה של ההחלטה (decideFit) היא פונקציה טהורה ונבדקת ב-scripts/test_print_fit_one_page.mjs;
// ההדפסה האמיתית (מספר עמודים) נבדקה בנפרד בדפדפן headless - ר' הערות הענף.

const MM_TO_PX = 96 / 25.4;
// A4 גובה 297 מ"מ פחות @page margin (10 מ"מ למעלה + 15 מ"מ למטה) ב-app/print/order/page.js
export const PAGE_CONTENT_HEIGHT_PX = (297 - 10 - 15) * MM_TO_PX;
// מרווח ביטחון: ההבדל בין מדידה על המסך להדפסה בפועל (עיגולי שורות, גופן) לא אמור לדחוף שורה לעמוד שני
export const FIT_SAFETY = 0.96;
export const FIT_TARGET_PX = Math.floor(PAGE_CONTENT_HEIGHT_PX * FIT_SAFETY);
// הקטנה מקסימלית - מתחת לזה הכתב כבר לא קריא; הזמנה גדולה מזה (כמעט לא קיימת) תזלוג לעמוד שני במקום להפוך לבלתי קריאה
export const FIT_MIN_SCALE = 0.45;

/**
 * החלטה טהורה: באיזה שלב ההזמנה נכנסת לעמוד.
 * @param {{naturalPx:number, measureCompact:()=>number, targetPx?:number, minScale?:number}} p
 * @returns {{stage:'natural'|'compact'|'scaled'|'overflow', scale:number}}
 */
export function decideFit({ naturalPx, measureCompact, targetPx = FIT_TARGET_PX, minScale = FIT_MIN_SCALE }) {
  if (!(naturalPx > 0) || naturalPx <= targetPx) return { stage: 'natural', scale: 1 };
  const compactPx = measureCompact();
  if (!(compactPx > 0) || compactPx <= targetPx) return { stage: 'compact', scale: 1 };
  // zoom z מרחיב את רוחב הפריסה ל-רוחב/z, כך שהגובה בפועל <= z * compactPx (פחות שורות נשברות) - ההקטנה שמרנית
  const raw = Math.floor((targetPx / compactPx) * 100) / 100;
  if (raw < minScale) return { stage: 'overflow', scale: minScale };
  return { stage: 'scaled', scale: raw };
}

const SECTION_SELECTOR = '[data-fit-section]';

/**
 * מחיל את ההתאמה על כל הזמנה (data-fit-section) בתוך root. בטוח לקריאה חוזרת (מאפס ומחשב מחדש).
 * root מקבל זמנית את המחלקה fit-measure (רוחב הדפסה) - ר' ה-CSS ב-app/print/order/page.js.
 * @returns {Array<{stage:string, scale:number, naturalPx:number}>}
 */
export function fitOrdersToOnePage(root, { targetPx = FIT_TARGET_PX, minScale = FIT_MIN_SCALE } = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const sections = Array.from(root.querySelectorAll(SECTION_SELECTOR));
  const results = [];
  root.classList.add('fit-measure');
  try {
    // איפוס מלא לפני כל מדידה, כדי שהמדידה לא תושפע מהחלה קודמת
    for (const s of sections) {
      s.classList.remove('fit-compact');
      s.style.zoom = '';
      s.removeAttribute('data-fit-stage');
    }
    for (const s of sections) {
      // הזמנה ראשונה בקבוצה מקבלת מעליה כותרת "הזמנות משלוח/איסוף" שתופסת מקום באותו עמוד
      const prev = s.parentElement && s.parentElement.previousElementSibling;
      const divider = prev && prev.classList && prev.classList.contains('prep-group-divider') ? prev : null;
      const reserve = divider ? divider.getBoundingClientRect().height + 24 : 0;
      const naturalPx = s.getBoundingClientRect().height + reserve;
      const decision = decideFit({
        naturalPx,
        targetPx,
        minScale,
        measureCompact: () => {
          s.classList.add('fit-compact');
          return s.getBoundingClientRect().height + reserve;
        },
      });
      if (decision.stage === 'natural') s.classList.remove('fit-compact');
      else s.classList.add('fit-compact');
      let scale = decision.scale;
      let finalPx = s.getBoundingClientRect().height + reserve;
      if (scale < 1) {
        // הערכת ה-zoom שמרנית (שורות נשברות פחות כשהפריסה רחבה יותר) - מודדים את התוצאה בפועל ומתקנים עד 4 פעמים:
        // קודם מקטינים אם עדיין חורג, ואם נשאר מקום רב - מגדילים בחזרה (כתב גדול ככל האפשר שעדיין נכנס)
        for (let i = 0; i < 4; i++) {
          s.style.zoom = String(scale);
          finalPx = s.getBoundingClientRect().height + reserve;
          if (finalPx > targetPx && scale > minScale) {
            scale = Math.max(minScale, Math.floor(scale * (targetPx / finalPx) * 100) / 100);
            continue;
          }
          if (finalPx < targetPx * 0.93 && scale < 1) {
            const up = Math.min(1, Math.floor(scale * (targetPx / finalPx) * 100) / 100);
            if (up > scale) {
              s.style.zoom = String(up);
              const upPx = s.getBoundingClientRect().height + reserve;
              if (upPx <= targetPx) { scale = up; finalPx = upPx; } else { s.style.zoom = String(scale); }
            }
          }
          break;
        }
      }
      if (scale < 1) s.style.zoom = String(scale);
      s.setAttribute('data-fit-stage', decision.stage);
      results.push({ ...decision, scale, naturalPx, finalPx });
    }
  } finally {
    root.classList.remove('fit-measure');
  }
  return results;
}
