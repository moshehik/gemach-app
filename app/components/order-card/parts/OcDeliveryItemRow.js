'use client';

// OcDeliveryItemRow - המשלוח כשורה בלשונית "פריטים" (נושא 9 - דוחות; ההגדרה delivery_as_item_row, ברירת מחדל כבוי).
// תצוגה בלבד: זה לא פריט מלאי (בלי ברקוד/מידה/החזרה/תפוסה, לא נספר ב"פריטים N" ולא נכנס ל-oc.items) - המחיר הוא חיוב המשלוח
// שכבר נספר בסה"כ לחיוב (lib/orderDelivery.js buildDeliverySection). הנתונים מהכרטיס עצמו, כולל חיוב "תצוגה מקדימה" שעוד לא נשמר.
import { useMemo } from 'react';
import OcIcon from '../OcIcon';
import { fmtMoney } from '../orderCardLogic';
import { buildDeliverySection, deliverySettingsFrom } from '@/lib/orderDelivery';

/** מחזיר את שורת הפריט של המשלוח (או null) - ההגדרה דולקת, המשלוחים דולקים וההזמנה היא משלוח. */
export function useDeliveryItemRow(oc) {
  const raw = oc.settings && oc.settings.raw;
  const order = oc.order;
  const obligations = oc.obligations;
  return useMemo(() => {
    if (!order || !order.isDelivery || !raw) return null;
    const section = buildDeliverySection(order, { settings: deliverySettingsFrom(raw), obligations });
    return section && section.itemRow ? section.itemRow : null;
  }, [order, obligations, raw]);
}

const priceOf = (row) => (row.amount === null || row.amount === undefined ? '—' : fmtMoney(row.amount));

export function DeliveryItemListRow({ row }) {
  return (
    <article className="hrow irow oc-delrow" data-delivery-item="1">
      <div className="li lrow">
        <div className="ic-b"><OcIcon name="truck" /><span className="rlbl">משלוח</span></div>
        <div className="t">
          <b><bdi>{row.label}</bdi></b>
          <span className="ln">{row.detail ? <>{row.detail} · </> : null}<bdi dir="ltr">{priceOf(row)}</bdi></span>
        </div>
      </div>
    </article>
  );
}

export function DeliveryItemTableRow({ row, cols }) {
  return (
    <tr className="oc-delrow" data-delivery-item="1">
      <td colSpan={cols - 1}><b><OcIcon name="truck" size="sm" /> <bdi>{row.label}</bdi></b>{row.detail ? <div className="oc-delrow-d">{row.detail}</div> : null}</td>
      <td><bdi dir="ltr">{priceOf(row)}</bdi></td>
    </tr>
  );
}
