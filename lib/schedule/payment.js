// lib/schedule/payment.js - "האם ההזמנה שולמה" בשורת שלב 1 של הלו״ז, לפי התשלומים שנרשמו בפועל.
// פונקציה טהורה (בלי DB). הסכום ששולם = Σ Payment.amount שאינם מחוקים - בדיוק כמו totalPaid ב-GET /api/orders.
// Order.isPaid הוא דגל ישן מהייבוא מ-Access ואינו מתעדכן בהזמנות שנוצרות באתר, לכן לא משתמשים בו (דיווח 7f3ee630).
//
// payStatus: 'paid' (שולם במלואו, או יותר) | 'partial' (שולם חלק) | 'unpaid' (יש סכום ולא שולם כלום) |
//            null (אין סכום ואין תשלום - אין מה לשלם, לא מציגים כלום).
const round2 = (n) => Math.round(n * 100) / 100;

export function orderPaymentView(totalAmount, payments) {
  const total = Number(totalAmount) > 0 ? Number(totalAmount) : 0;
  const totalPaid = round2((payments || []).reduce((s, p) => s + (p && !p.isDeleted ? Number(p.amount) || 0 : 0), 0));
  const balance = total > 0 ? Math.max(0, round2(total - totalPaid)) : 0;
  let payStatus;
  if (total > 0) payStatus = totalPaid >= total ? 'paid' : totalPaid > 0 ? 'partial' : 'unpaid';
  else payStatus = totalPaid > 0 ? 'paid' : null;
  return { totalPaid, balance, payStatus };
}
