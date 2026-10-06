// lib/creditOfferClient.js - צד הדפדפן של קיזוז זיכוי (דיווח 679a860b): שאלה אחת "לקזז?" ואחריה בקשת POST אחת עם קוד מאשר.
// משותף לכרטיס ההזמנה הישן (LegacyOrderPage: אחרי שמירה/יציאה שיצרו חוב) ולאשף ההזמנה הישן (אחרי יצירה). בלי imports - הכל מוזרק
// (confirm / sendWithApproval / fetchImpl / notify) כדי שיהיה נבדק ב-node רגיל. הכרטיס החדש (a5) יכול להשתמש באותה פונקציה או לקרוא
// ישירות ל-/api/orders/[id]/credit-offset.
//
// חוזר תמיד { status } ולא זורק:
//   'none'      אין מה לקזז (כבוי / אין חוב / אין זיכוי פתוח / שגיאת רשת בבדיקה) - ממשיכים בדיוק כמו קודם
//   'declined'  השיבו "לא"
//   'cancelled' ביטלו את חלון קוד המאשר
//   'applied'   נרשם (amount = הסכום שקוזז; גם לחיצה כפולה שכבר נרשמה)
//   'error'     השרת סירב / נכשל (ההודעה כבר הוצגה)
export function makeRequestKey() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  } catch (e) { /* ממשיכים לחלופה */ }
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export async function offerCreditOffset({ orderId, confirm, sendWithApproval, fetchImpl, notify, newKey }) {
  const f = fetchImpl || ((...a) => fetch(...a));
  const say = notify || ((m) => { if (typeof alert === 'function') alert(m); });
  const url = `/api/orders/${orderId}/credit-offset`;
  let plan;
  try {
    const res = await f(url);
    if (!res.ok) return { status: 'none' };
    plan = await res.json();
  } catch (e) {
    return { status: 'none' };
  }
  if (!plan || !plan.enabled || !(plan.offsetAmount > 0)) return { status: 'none' };

  const yes = await confirm(plan.question);
  if (!yes) return { status: 'declined' };

  const requestKey = (newKey || makeRequestKey)();
  try {
    const res = await sendWithApproval(
      (extra) => f(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxAmount: plan.offsetAmount, requestKey, ...extra }),
      }),
      {
        orderId: Number(orderId),
        kinds: ['manual_payment_credit'],
        fieldFor: () => 'approvalToken',
        messages: { manual_payment_credit: 'קיזוז זיכוי דורש קוד מאשר. אנא בחר מאשר והזן סיסמה:' },
      },
    );
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.status === 'applied' || data.status === 'duplicate') return { status: 'applied', amount: data.amount || plan.offsetAmount };
      say('אין כבר חוב או זיכוי פתוח לקיזוז.');
      return { status: 'none' };
    }
    if (res.status === 403) return { status: 'cancelled' };
    const err = await res.json().catch(() => null);
    say((err && err.error) || 'שגיאה ברישום הקיזוז.');
    return { status: 'error' };
  } catch (e) {
    say('שגיאה ברישום הקיזוז.');
    return { status: 'error' };
  }
}
