'use client';

import { chunkOrderIds } from '@/lib/approvalTokenStore';

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

// A batch of orders (refunds page: "approve the selected debts"): ONE code prompt, then one verify-pin call per chunk of at most
// MAX_ORDERS_PER_APPROVAL orders (a token covers at most 100 orders; a bigger selection used to get no token at all). Every chunk
// gets its own signed token. → { ...authResult, approvals: [{ orderIds, approvalToken }] } or null (cancelled / refused - nothing partial is returned).
export const verifyPinForOrders = async (message, level, orderIds) => {
  const authResult = await window.customAuthPrompt(message, level);
  if (!authResult || !authResult.pin) return null;
  const approvals = [];
  try {
    for (const chunk of chunkOrderIds(orderIds)) {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: level, orderIds: chunk })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
        return null;
      }
      approvals.push({ orderIds: chunk, approvalToken: data.approvalToken || null });
    }
    return { ...authResult, approvals };
  } catch (err) {
    alert('שגיאה באימות מול השרת.');
    return null;
  }
};
