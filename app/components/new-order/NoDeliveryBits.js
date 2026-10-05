'use client';

// ac8afab7 / 1913c29a / caab5f84 (נווה יעקב): "הוסף / עריכת משלוח" ושורת חיוב המשלוח בשלבי הפריטים / הסיכום / התשלום.
// בישן זה חלון עם אותם שדות; ב-A5 המשלוח הוא שלב נפרד, לכן הלחצן קופץ אליו וחוזר לשלב המקור (controller: openDeliveryEdit / closeDeliveryEdit).
// שניהם מוצגים רק כשיש משלוח בהגדרות (ctl.deliveryEnabled = אותם שערים כמו שלב המשלוח - enable_deliveries).
import { Ic, money } from './NoUi';

export function DeliveryEditButton({ ctl, from, marginTop = 14 }) {
  if (!ctl.deliveryEnabled || ctl.saved) return null;
  return (
    <div style={{ marginTop }}>
      <button type="button" className="btn lg" style={{ width: '100%', fontWeight: 700 }} disabled={ctl.saving || ctl.isProcessingCredit} onClick={() => ctl.openDeliveryEdit(from)}>
        <Ic n="truck" />{ctl.order.isDelivery ? 'עריכת משלוח' : 'הוסף משלוח'}
      </button>
    </div>
  );
}

// אותו מספר שכבר כלול בסה"כ (deliveryAmount מ-/api/orders/calculate) - רק לתצוגה
export function DeliveryChargeLine({ ctl }) {
  const o = ctl.order;
  if (!ctl.deliveryEnabled || !o.isDelivery) return null;
  const amount = ctl.calculatedData.deliveryAmount || 0;
  // בלי עיר משלוח השרת נופל לעיר הלקוח (resolveEffectiveDeliveryCity) - אם יש סכום, זו העיר שחויבה
  const city = o.deliveryCity || (amount > 0 && o.selectedCustomer && o.selectedCustomer.city) || '';
  let val;
  if (!ctl.activeItems.length) val = <span>יחושב אחרי הוספת פריטים</span>;
  else if (!city && !amount) val = <span style={{ color: 'var(--gm-red)' }}>יש לבחור עיר משלוח</span>;
  else val = <b style={{ color: 'var(--navy-900)' }}>{money(amount)}</b>;
  return (
    <div className="row spread sm muted" style={{ gap: 12, marginTop: 12 }}>
      <span><Ic n="truck" c="sm" /> מתוכם משלוח{city ? ` · ${city}` : ''} · {o.deliveryDirection}</span>
      {val}
    </div>
  );
}
