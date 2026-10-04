// לוגיקת החלטה טהורה (ללא React/DB) לשלב התשלום ולהוספת פריט בטופס ההזמנה החדשה
// (app/orders/new/page.js) - מופרדת כדי שאפשר לכסות אותה בבדיקה (scripts/test_new_order_money.mjs).

export const MANAGER_EXIT_METHOD = 'יציאה באישור מנהל';

export const isManagerExitMethod = (method) => String(method || '').trim() === MANAGER_EXIT_METHOD;

// אשראי "פנימי" (נדרים פלוס) - לא אשראי חיצוני. אותו תנאי שהיה מפוזר בקובץ הטופס.
export const isCreditMethod = (method) => {
  const m = String(method || '');
  return m.includes('אשראי') && !m.includes('חיצונית');
};

// אופן התשלום שנשמר לחיוב שבוצע בכרטיס: תמיד אופציית האשראי הראשונה ברשימה, ולא מה שנבחר
// בתפריט (החיוב מהכפתור "חיוב אשראי" נפתח גם כשנבחר "מזומן" - ונרשם כמזומן עם הערת נדרים).
export const pickCreditMethod = (options) =>
  (Array.isArray(options) ? options : []).find(isCreditMethod) || 'אשראי (דרך נדרים פלוס)';

// "אישור תשלום / פיצול": מוסיף תשלום שנגבה בפועל. "יציאה באישור מנהל" אינה אמצעי תשלום -
// היא רק "יוצא עם חוב" ונרשמת בסיום ההזמנה (סכום 0, בזרימת האישור שלה) - לכן נדחית כאן.
export const validateSplitPayment = (amount, method) => {
  const n = parseFloat(amount) || 0;
  if (n <= 0) return { ok: false, error: 'יש להזין סכום גדול מ-0' };
  if (isManagerExitMethod(method)) {
    return {
      ok: false,
      error: '"יציאה באישור מנהל" אינה אמצעי תשלום ולא ניתן לרשום באמצעותה סכום ששולם. כדי לצאת עם חוב, בחר אותה ולחץ "סיום" (בלי "אישור תשלום").',
    };
  }
  return { ok: true, amount: n };
};

// האם נדרש אישור מנהל לפני רישום תשלום (הגדרת PAYMENT_APPROVAL_LEVEL, ברירת מחדל 'כולם' = בלי חלונית).
export const paymentApprovalLevelRequiresPrompt = (settings) => {
  const level = (settings && settings.PAYMENT_APPROVAL_LEVEL) || 'כולם';
  return level === 'מנהל' || level === 'עובד' || level === 'מנהל סניף ומעלה';
};

// תשלום מפוצל במזומן/אחר (לא אשראי - אשראי עובר בחלון הכרטיס) כפוף לאותה בדיקת אישור כמו בסיום.
export const splitPaymentNeedsApproval = (settings, method, amount) =>
  (parseFloat(amount) || 0) > 0 && !isCreditMethod(method) && paymentApprovalLevelRequiresPrompt(settings);

export const describeItemAlterations = (item) => [
  item.neckAlteration && 'צוואר',
  item.sleeveAlteration && 'שרוול',
  item.lengthAlteration && `אורך (${item.lengthAlteration})`,
].filter(Boolean).join(', ') || 'ללא תיקונים';

// פריט להוספה לסל: כשסומן תיקון ואין פירוט חופשי - ממלאים פירוט ברירת מחדל מהתיוג (בלי חסימה,
// 97ea96be) כדי שהתופרת תקבל הערה. כשהתיקונים כבויים בהגדרות - לא נוגעים בפריט.
export const withDefaultAlterationDetails = (newItem, alterationsEnabled) => {
  const item = { ...newItem };
  if (alterationsEnabled && (item.neckAlteration || item.sleeveAlteration || item.lengthAlteration)
      && (!item.repairs || !String(item.repairs).trim())) {
    item.repairs = describeItemAlterations(item);
  }
  return item;
};
