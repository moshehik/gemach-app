'use client';

// מתאם דק ל-POST /api/customers/[id]/events (החוזה: lib/history/customerEvents.js). רישום הדפסה/הורדה/ייצוא לא חוסם את הפעולה
// עצמה: כשל ברישום מוחזר לקורא אבל לא נזרק. מזהה בקשה (clientEventId) נוצר לכל אירוע כדי שלחיצה כפולה לא תיצור שתי שורות.

export function newClientEventId() {
  const r = Math.random().toString(36).slice(2, 12);
  return `cc${Date.now().toString(36)}${r}`.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
}

export async function postCustomerEvent(customerId, body, fetchImpl) {
  const f = fetchImpl || fetch;
  try {
    const res = await f(`/api/customers/${encodeURIComponent(customerId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, data: { error: 'שגיאת רשת' } };
  }
}

/** רישום אירוע מסמך/ייצוא (בלי אישור) - לא נזרק לעולם. */
export function logCustomerEvent(customerId, action, meta) {
  if (!customerId) return Promise.resolve({ ok: false });
  return postCustomerEvent(customerId, { action, meta: meta || {}, clientEventId: newClientEventId() });
}
