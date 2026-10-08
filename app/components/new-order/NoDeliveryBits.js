'use client';

// ac8afab7 / 1913c29a / caab5f84 (נווה יעקב): שורת חיוב המשלוח בשלבי הפריטים / התשלום.
// הלחצן "הוסף / עריכת משלוח" הוסר מכל השלבים (בקשת הבעלים 9.10.2026) - המשלוח נערך רק בשלב המשלוח עצמו.
import { Ic, money } from './NoUi';

// סקירה 6.10.2026: חישוב המחיר נכשל (רשת / שרת) - הסכום לא ידוע, שמירה וחיוב חסומים עד "נסה שוב"
export function CalcErrorNote({ ctl }) {
  if (!ctl.calcError) return null;
  return (
    <div className="empty" role="alert" style={{ textAlign: 'start', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginTop: 12 }}>
      <span><Ic n="alert" c="sm" /> חישוב המחיר נכשל. לא ניתן לשמור הזמנה או לחייב עד שהחישוב יצליח.</span>
      <button type="button" className="btn sm" onClick={ctl.retryCalc}><Ic n="refresh" c="sm" />נסה שוב</button>
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
