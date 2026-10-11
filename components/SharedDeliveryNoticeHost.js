'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

// "משלוח משותף" (shared_delivery_enabled) - חלון התראה גלובלי. השרת מחזיר `sharedDelivery: { notices, error? }` בתשובות של שמירת הזמנה (POST/PUT),
// ביטול הזמנה (DELETE) ושמירת כרטיס לקוחה (PUT) כשחיוב המשלוח של הזמנות *אחרות* באותה כתובת ויום השתנה (זיכוי נרשם אוטומטית / נוסף חיוב).
// במקום לשנות כל מסך שקורא לראוטים האלה (כרטיס הזמנה ישן וחדש, אשף הזמנה חדשה, כרטיס לקוחה), הרכיב הזה (מורכב פעם אחת ב-app/layout.js,
// רק כשמשלוחים פעילים) עוטף את window.fetch ובודק *רק* בקשות כותבות (POST/PUT/PATCH/DELETE) ל-/api/orders ו-/api/customers/ - ומציג חלון.
// בקשות קריאה לא נוגעים בהן. תשובה בלי sharedDelivery - לא נעשה כלום (שום עלות מעבר ל-clone של תשובות כתיבה מעטות).
// אירוע ידני: window.dispatchEvent(new CustomEvent('gm:shared-delivery', { detail: { notices, error, reloadOnClose } })).

const EVENT = 'gm:shared-delivery';
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function relevantUrl(url) {
  try {
    const path = new URL(url, window.location.origin).pathname;
    if (/^\/api\/orders\/calculate/.test(path) || /preview-pricing/.test(path)) return false;
    return /^\/api\/orders(\/|$)/.test(path) || /^\/api\/customers\/[^/]+\/?$/.test(path);
  } catch { return false; }
}

export default function SharedDeliveryNoticeHost() {
  const [dialog, setDialog] = useState(null);

  useEffect(() => {
    const onEvent = (e) => {
      const d = e.detail || {};
      if ((d.notices && d.notices.length) || d.error) setDialog({ notices: d.notices || [], error: d.error || null, reloadOnClose: !!d.reloadOnClose });
    };
    window.addEventListener(EVENT, onEvent);

    if (!window.__gmSharedDeliveryFetchPatched) {
      window.__gmSharedDeliveryFetchPatched = true;
      const original = window.fetch.bind(window);
      window.fetch = async (input, init) => {
        const response = await original(input, init);
        try {
          const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
          const url = typeof input === 'string' ? input : (input && input.url) || String(input);
          if (WRITE_METHODS.has(method) && response.ok && relevantUrl(url)) {
            const type = response.headers.get('content-type') || '';
            if (type.includes('application/json')) {
              response.clone().json().then((json) => {
                const sd = json && json.sharedDelivery;
                if (sd && ((sd.notices && sd.notices.length) || sd.error)) window.dispatchEvent(new CustomEvent(EVENT, { detail: { notices: sd.notices || [], error: sd.error || null } }));
              }).catch(() => {});
            }
          }
        } catch { /* ההתראה היא תוספת - לעולם לא מפילה את הבקשה */ }
        return response;
      };
    }
    return () => window.removeEventListener(EVENT, onEvent);
  }, []);

  if (!dialog || typeof document === 'undefined') return null;
  const close = () => {
    const reload = dialog.reloadOnClose;
    setDialog(null);
    if (reload) window.location.reload();
  };
  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="עדכון משלוח משותף" data-testid="shared-delivery-dialog"
      style={{ position: 'fixed', inset: 0, zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal" dir="rtl" style={{ maxWidth: '560px', width: '100%', margin: 0 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <strong>משלוח משותף - עודכנו הזמנות נוספות</strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={close}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dialog.error ? <p style={{ margin: 0, color: 'var(--danger)' }}>{dialog.error}</p> : null}
          {dialog.notices.length ? (
            <p className="hint" style={{ margin: 0, color: 'var(--text-2)' }}>
              השינוי משפיע על חיוב המשלוח של הזמנות אחרות באותה כתובת וביום. הזיכוי / החיוב נרשם אוטומטית בכל הזמנה - ניתן לעבור אליהן ולטפל:
            </p>
          ) : null}
          {dialog.notices.map((n) => (
            <div key={n.orderId} className="card card-pad" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ lineHeight: 1.5 }}>{n.message}</span>
              <Link href={`/orders/${n.orderId}`} className="btn btn-sm" onClick={() => setDialog(null)} style={{ whiteSpace: 'nowrap' }}>מעבר להזמנה #{n.orderId}</Link>
            </div>
          ))}
        </div>
        <div className="modal-foot" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 16px' }}>
          <button type="button" className="btn btn-primary" onClick={close}>הבנתי</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
