'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

// "משלוח משותף" (shared_delivery_enabled) - כרטיס בלשונית המשלוח של הזמנה שמורה: האם יש עוד הזמנות לאותה כתובת באותו יום,
// מי "משלוח ראשי" (משלם מחיר מלא) ומי מצורפת (מחיר מוזל), ושדה דו-מצבי להחלפה. מוצג רק כשהפיצ'ר דלוק ויש קבוצה של 2 הזמנות ומעלה -
// אחרת לא מרונדר כלום (גמ"ח בלי משלוחים / מתג כבוי: GET מחזיר {enabled:false}). ר' docs/shared-delivery-discount.md.
// החלפת ראשי = POST /api/orders/[id]/shared-delivery; השרת מחשב מחדש ומחזיר notices - מוצגים בחלון הגלובלי (SharedDeliveryNoticeHost)
// ואחרי הסגירה הכרטיס נטען מחדש (הסכומים בהזמנה השתנו בשרת).

const fmt = (n) => (n === null || n === undefined ? '' : `${n} ₪`);

export default function SharedDeliveryPanel({ orderId, order }) {
  const [info, setInfo] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [pickNext, setPickNext] = useState(false);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}/shared-delivery`, { cache: 'no-store' });
      if (!res.ok) { setInfo(null); return; }
      setInfo(await res.json());
    } catch { setInfo(null); }
  }, [orderId]);

  // נטען מחדש כשכתובת / תאריך / כיוון בכרטיס השתנו ונשמרו (order.updatedAt) - לא על כל הקלדה
  useEffect(() => { load(); }, [load, order?.updatedAt, order?.isDelivery]);

  if (!info || !info.enabled || !info.applicable || !info.shared) return null;

  const choosePrimary = async (primaryOrderId) => {
    if (busy) return;
    if (!window.confirm('החלפת "משלוח ראשי" מחשבת מחדש את חיוב המשלוח בכל ההזמנות בקבוצה (זיכוי / חיוב נרשמים אוטומטית) וטוענת מחדש את הכרטיס. שינויים שלא נשמרו בכרטיס יאבדו. להמשיך?')) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/shared-delivery`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ primaryOrderId }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error || 'החלפת "משלוח ראשי" נכשלה'); return; }
      setPickNext(false);
      if (data.notices && data.notices.length) {
        window.dispatchEvent(new CustomEvent('gm:shared-delivery', { detail: { notices: data.notices, reloadOnClose: true } }));
      } else {
        window.location.reload();
      }
    } catch { setError('החלפת "משלוח ראשי" נכשלה'); } finally { setBusy(false); }
  };

  const others = info.members.filter((m) => !m.isSelf);
  const legsText = (m) => (m.discountedLegs.length === 0 ? 'מחיר מלא' : `מוזל (${m.discountedLegs.map((l) => (l === 'out' ? 'הלוך' : 'חזור')).join(' + ')})`);

  return (
    <div className="card card-pad" style={{ marginBottom: '16px' }} data-testid="shared-delivery-panel">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <strong>משלוח משותף</strong>
          <div className="hint" style={{ color: 'var(--text-2)' }}>
            {info.members.length} הזמנות לאותה כתובת באותו יום אירוע.{' '}
            {info.isPrimary ? 'הזמנה זו היא המשלוח הראשי - משלמת את מחיר המשלוח המלא.' : `הזמנה זו מצורפת למשלוח של הזמנה #${info.primaryOrderId} - מחיר מוזל.`}
            {!info.discountConfigured ? ' (לא הוגדר מחיר מוזל בהגדרות - אין הנחה בפועל.)' : ''}
          </div>
        </div>
        <div role="group" aria-label="משלוח ראשי" style={{ display: 'inline-flex', gap: '4px' }}>
          <button type="button" className={`btn btn-sm${info.isPrimary ? ' btn-primary' : ''}`} aria-pressed={info.isPrimary} disabled={busy || info.isPrimary || !info.canChangePrimary}
            title={info.canChangePrimary ? 'הפוך הזמנה זו למשלוח הראשי' : 'החלפה אינה זמינה כרגע'} onClick={() => choosePrimary(orderId)}>
            משלוח ראשי
          </button>
          <button type="button" className={`btn btn-sm${!info.isPrimary ? ' btn-primary' : ''}`} aria-pressed={!info.isPrimary} disabled={busy || !info.isPrimary || !info.canChangePrimary}
            title="הפוך להזמנה מצורפת (מוזלת) - תבחר איזו הזמנה תהיה הראשית" onClick={() => (others.length === 1 ? choosePrimary(others[0].orderId) : setPickNext((v) => !v))}>
            משלוח מצורף (מוזל)
          </button>
        </div>
      </div>
      {pickNext ? (
        <div style={{ marginTop: '10px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="hint">מי יהיה המשלוח הראשי?</span>
          {others.map((m) => <button key={m.orderId} type="button" className="btn btn-sm" disabled={busy} onClick={() => choosePrimary(m.orderId)}>#{m.orderId} {m.customerName}</button>)}
        </div>
      ) : null}
      {error ? <div style={{ color: 'var(--danger)', marginTop: '8px' }}>{error}</div> : null}
      <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {info.members.map((m) => (
          <div key={m.orderId} className="hint" style={{ display: 'flex', gap: '10px', alignItems: 'center', color: m.isSelf ? 'var(--text)' : 'var(--text-2)' }}>
            <span style={{ minWidth: '88px' }}>{m.isPrimary ? 'ראשי' : 'מצורף'}</span>
            {m.isSelf ? <b>#{m.orderId} {m.customerName} (הזמנה זו)</b> : <Link href={`/orders/${m.orderId}`}>#{m.orderId} {m.customerName}</Link>}
            <span>{m.direction}</span>
            <span>{legsText(m)}</span>
            <span>{fmt(m.deliveryAmount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
