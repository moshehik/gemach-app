// returnAlert.js - נקודת החיבור של התראת "להעביר לסניף אחר / להחזיר לרזרבה" בסריקת החזרה (docs/branches-plan.md, שלב ד).
// בלי React - אפשר לייבא מכל זרימת סריקה (כולל זרימת quick-barcode):
//   notifyReturnToOtherBranch(advice | advice[])   - מקפיץ את חלון ההתראה (BranchReturnAlertHost) עם הנחיות מהשרת
// ברירת מחדל אין צורך לקרוא לזה ידנית: installReturnAdviceInterceptor() (מותקן ע"י BranchReturnAlertHost) עוטף את fetch ומקפיץ
// כשתשובת POST /api/returns/scan כוללת branchAdvices - כך אף זרימת החזרה קיימת לא השתנתה. advice = { kind: 'branch'|'reserve', title, text, barcode, ... }.
export const RETURN_ADVICE_EVENT = 'gm:branch-return-advice';

/** @param {object|object[]} advice */
export function notifyReturnToOtherBranch(advice) {
  if (typeof window === 'undefined') return;
  const list = (Array.isArray(advice) ? advice : [advice]).filter(Boolean);
  if (!list.length) return;
  window.dispatchEvent(new CustomEvent(RETURN_ADVICE_EVENT, { detail: { advices: list } }));
}

export function installReturnAdviceInterceptor() {
  if (typeof window === 'undefined' || window.__gmReturnAdviceInstalled) return;
  window.__gmReturnAdviceInstalled = true;
  const baseFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await baseFetch.apply(this, args);
    try {
      const input = args[0];
      const url = typeof input === 'string' ? input : (input && input.url) || '';
      const method = String((args[1] && args[1].method) || (input && typeof input === 'object' && input.method) || 'GET').toUpperCase();
      if (method === 'POST' && response.ok && url.includes('/api/returns/scan')) {
        const u = new URL(url, window.location.origin);
        if (u.origin === window.location.origin && u.pathname === '/api/returns/scan') {
          response.clone().json().then((j) => { if (j && Array.isArray(j.branchAdvices) && j.branchAdvices.length) notifyReturnToOtherBranch(j.branchAdvices); }).catch(() => {});
        }
      }
    } catch {
      // לעולם לא לשבור את הבקשה עצמה
    }
    return response;
  };
}
