'use client';

// אימות עובד/מנהל/מתכנת מול השרת. מחזיר את פרטי המאשר או null אם בוטל/נכשל.
// opts.orderId / opts.orderIds (hardening 2026-10-05): ההזמנות שהאישור מיועד להן - השרת מחזיר אז approvalToken חתום (מקושר אליהן, לעובד המחובר
// ולסוג האישור; תקף 5 דקות, חד-פעמי לכל הזמנה) והוא חוזר בתוצאה כ-`approvalToken`. בלי opts = בדיוק כמו קודם.
export const verifyPin = async (message, level, opts = {}) => {
  const authResult = await window.customAuthPrompt(message, level);
  if (!authResult || !authResult.pin) return null;
  try {
    const res = await fetch('/api/auth/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: level,
        ...(opts.orderId ? { orderId: opts.orderId } : {}), ...(opts.orderIds ? { orderIds: opts.orderIds } : {})
      })
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
      return null;
    }
    return data.approvalToken ? { ...authResult, approvalToken: data.approvalToken } : authResult;
  } catch (err) {
    alert('שגיאה באימות מול השרת.');
    return null;
  }
};
