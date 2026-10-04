'use client';

// OcCapacityDialog — 📅 "בדוק תפוסה לתאריך אירוע" (R29; העיצוב: WIN.capacity). פורט של components/orders/ItemCapacityModal.js:
// אותה בדיקת תנאים (תאריך אירוע / דגם / מידה), אותן קריאות (/api/inventory/models כשחסרה קידומת → GET /api/inventory/capacity
// עם טווח של חודש לפני ואחרי), אותם שלושה מספרים (במלאי / בתפוסה מתוכננת / רזרבה זמינה) ואותה רשימת הזמנות תופסות (הזמנה נוכחית
// מסומנת, קישור לכל הזמנה). שינויים: תאריכים עבריים בלבד, ותצוגת "לוח" (CapacityCalendar, לוח לועזי) לא נכללת.
import { useEffect, useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from '../OcUi';
import { hebDateOf } from '../orderCardLogic';
import { itemName } from '../hooks/useItemActions';

// טווח השאילתה של הישן (חודש לפני ואחרי, YYYY-MM-DD ב-UTC כמו toISOString().split('T')[0])
export function capacityRange(eventDate) {
  const e = new Date(eventDate);
  const from = new Date(e); from.setMonth(from.getMonth() - 1);
  const to = new Date(e); to.setMonth(to.getMonth() + 1);
  return { fromDate: from.toISOString().split('T')[0], toDate: to.toISOString().split('T')[0] };
}
export function capacityPrecheck(item, order) {
  const hasIdentifier = item && (item.dressModelId || item.dressItem?.dressModelId || item.barcodePrefix || item.dressItem?.barcodePrefix || item.dressItem?.dress?.barcodePrefix);
  const size = item?.sizeText || item?.size;
  if (!order?.eventDate) return 'לא הוגדר תאריך אירוע להזמנה זו.';
  if (!hasIdentifier) return 'לא ניתן לבדוק תפוסה לפריט ללא דגם (פריט כללי).';
  if (!size) return 'לא ניתן לבדוק תפוסה לפריט ללא מידה מוגדרת.';
  return '';
}

export default function OcCapacityDialog({ item, order, close, fetchImpl }) {
  const pre = capacityPrecheck(item, order);
  const [state, setState] = useState(pre ? { error: pre } : { loading: true });
  useEffect(() => {
    if (pre) return undefined;
    let off = false;
    const f = fetchImpl || fetch;
    (async () => {
      try {
        const { fromDate, toDate } = capacityRange(order.eventDate);
        let prefix = item.barcodePrefix || item.dressItem?.barcodePrefix || item.dressItem?.dress?.barcodePrefix;
        const actualModelId = item.dressModelId || item.dressItem?.dressModelId;
        if (!prefix && actualModelId) {
          const mRes = await f(`/api/inventory/models`);
          const mData = await mRes.json();
          const model = mData.models?.find(m => m.id === actualModelId);
          if (model) prefix = model.barcodePrefix;
        }
        if (!prefix) throw new Error('לא נמצא קוד פריט');
        const params = new URLSearchParams({ barcodePrefix: prefix, size: item.sizeText || item.size, fromDate, toDate });
        const res = await f(`/api/inventory/capacity?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת נתונים');
        if (!off) setState({ results: data });
      } catch (err) {
        if (!off) setState({ error: err.message });
      }
    })();
    return () => { off = true; };
  }, []);
  const r = state.results;
  const occupied = r ? [...(r.occupiedOrders || [])].sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate)) : [];
  return (
    <>
      <DlgHead id="oc-dlg-t" title="בדוק תפוסה לתאריך אירוע" sub={`דגם ${itemName(item)} · מידה ${item.sizeText || item.size || '—'}${order?.eventDate ? ` · ${hebDateOf(order.eventDate)}` : ''}`} />
      {state.loading ? <div className="chg"><div className="c" role="status"><span className="spinner" aria-hidden="true" /><div className="t faint">טוען נתוני תפוסה...</div></div></div> : null}
      {state.error ? <div className="amsg oc-caperr" role="alert"><OcIcon name="alert" size="sm" />{state.error}</div> : null}
      {r ? (
        <>
          <div className="chg oc-capnums">
            <div className="c"><div className="t">במלאי</div><div className="amt z">{r.inStock}</div></div>
            <div className="c"><div className="t">בתפוסה מתוכננת</div><div className="amt z">{r.occupiedCount}</div></div>
            <div className="c"><div className="t">רזרבה זמינה</div><div className="amt z">{r.reserve}</div></div>
          </div>
          <div className="faint oc-caprange">מוצג טווח של חודש לפני ואחרי תאריך האירוע</div>
          {r.occupiedCount > 0 ? (
            <div className="chg oc-caplist">
              {occupied.map(o => {
                const isCurrent = o.orderId === order.orderId;
                return (
                  <div className="c" key={o.id || o.orderId}>
                    <div className="t">
                      <b>{hebDateOf(o.eventDate) || '—'}</b>{isCurrent ? <span className="chip gray oc-capchip">הזמנה נוכחית</span> : null}
                      <small className="faint oc-capcust">{o.customerName} · כמות {o.quantity}</small>
                    </div>
                    <a className="btn sm oc-caplink" href={`/orders/${o.orderId}`} target="_blank" rel="noopener noreferrer">צפה בהזמנה <bdi>#{o.orderId}</bdi><OcIcon name="ext" size="sm" /></a>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="chg"><div className="c"><div className="t"><b>אין הזמנות תפוסות בטווח התאריכים</b><small className="faint oc-capcust">הפריט פנוי לחלוטין בתאריכים אלו.</small></div></div></div>
          )}
        </>
      ) : null}
      <DlgButtons>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>סגירה</DlgBtn>
      </DlgButtons>
    </>
  );
}
