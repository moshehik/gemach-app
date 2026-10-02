// app/components/schedule/print/pages/PP12.js — תבנית "תעודות משלוח" (דף 12): <Sheet> לכל הזמנה, כל אחת בעמוד A4 משלה.
// נתונים: lib/schedule/print/pages/PP-12.js build(). עיצוב: p12() בתצוגה (dn-wrap.one): כותרת "תעודת משלוח · הזמנה #", "נמסר אל",
// שם (גדול), כתובת, טלפונים, שלוש עמודות מידע (תאריך האירוע, משלוח יוצא, מספר שמלות), "שקית ___ מתוך ___", הערות, שורות חתימה.
// ברקוד הכותרת = DOT-<הזמנה> ("סימון המשלוח כבוצע"); אין ברקוד בתוך התעודה (הוסר לפי הבעלים). קלאסים .pp-dn* ב-print.css.
import { Sheet, Phone, Flag, EmptyBody } from '../PrintShell';
import './pp12.css';

function Note({ o }) {
  return (
    <div className="pp-dn-wrap">
      <div className="pp-dn">
        <div className="dn-h"><b>תעודת משלוח</b><span>הזמנה #{o.orderId}</span></div>
        <div className="to">נמסר אל</div>
        <div className="nm">{o.name}</div>
        <div className="ad">{o.street ? [o.street, o.city].filter(Boolean).join(', ') : <><Flag>חסרה כתובת</Flag>{o.city ? ' ' + o.city : null}</>}</div>
        <div className="phs"><Phone value={o.phone1} />{o.phone2 ? <Phone value={o.phone2} /> : null}</div>
        <div className="info">
          <div><b>תאריך האירוע</b>{o.eventFull}<br />{o.eventGreg}</div>
          <div><b>משלוח יוצא</b>{o.dispatchFull}<br />{o.dispatchGreg}</div>
          <div><b>מספר שמלות</b>{o.dressCount}</div>
        </div>
        <div className="bagrow"><span>שקית</span><span className="pp-ul s" /><span>מתוך</span><span className="pp-ul s" /></div>
        {o.notes ? <div className="nts"><b>הערות:</b> {o.notes}</div> : <div className="nts pp-dn-none"><b>הערות:</b> אין</div>}
        <div className="sg"><div>נמסר ל (שם)</div><div>חתימה</div><div>תאריך ושעה</div></div>
      </div>
    </div>
  );
}

export default function PP12({ meta, page }) {
  const d = page.data;
  if (d.empty) return <Sheet meta={meta} page={page}><EmptyBody /></Sheet>;
  return (
    <>
      {d.orders.map((o, i) => (
        <Sheet
          key={o.orderId}
          meta={meta}
          page={page}
          title="תעודת משלוח"
          sub="תעודה אחת בכל עמוד"
          sum={'הזמנה #' + o.orderId}
          code={o.code}
          codeNote="סימון המשלוח כבוצע"
          sheetIndex={i + 1}
          sheetCount={d.orders.length}
        >
          <Note o={o} />
        </Sheet>
      ))}
    </>
  );
}
