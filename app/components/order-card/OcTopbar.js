'use client';

// OcTopbar — שורת הכותרת של כרטיס ההזמנה (העיצוב: .topbar > .back + .ttl(h1 "הזמנה #N") + #sbar + .tools).
// החלטות: T1/R43 — החץ ליד הכותרת הוא היציאה היחידה (oc.exit → חלון D2 כשיש שינויים, AMB-01); R1 — אין צ׳יפ סטטוס (#hdrChips
// ריק, כמו בעיצוב); R2 — אין "עודכן"; R3 — לחצן נעילה (xlbtn) בתחילת הכלים רק כשההזמנה נעולה (תאריך האירוע עבר) → חלון "הזמנה
// נעולה" → "שחרר באישור מנהל" (feature:locked_order_edit); A1/A2/R6 — Excel/הורדה/הדפסה-ומייל הם slots של W7; R42 — שורת הסריקה
// (slot של W3) במרכז; מחיקת הזמנה (D9) → oc.deleteOrder. הטולטיפים ב-data-tip (לא title).
import OcIcon, { XlGlyph } from './OcIcon';
import { DlgBtn, DlgButtons, DlgHead } from './OcUi';

function LockedDialog({ close }) {
  return (
    <>
      <DlgHead id="oc-dlg-t" title="הזמנה נעולה" sub="תאריך האירוע של הזמנה זו עבר, ולכן השכרה, עריכה ומחיקה של פריטים חסומות. החזרה מהשכרה, תשלומים וזיכויים זמינים כרגיל. שחרור מלא לעריכה דורש אישור מנהל." />
      <DlgButtons>
        <DlgBtn kind="primary" icon="lock" onClick={() => close(true)}>שחרר באישור מנהל</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(false)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

export default function OcTopbar({ oc, ui, slots }) {
  const { ScanBar, Exports, PrintMenu } = slots;
  const orderNo = oc.order?.orderId ?? oc.orderRef;
  const openLocked = async () => {
    const go = await ui.openDialog(LockedDialog, {});
    if (go) await oc.unlock();
  };
  return (
    <div className="topbar">
      <button type="button" className="back" data-act="exit" aria-label="חזרה" data-tip="חזרה" disabled={oc.saving} onClick={() => oc.exit()}>
        <OcIcon name="back" />
      </button>
      <div className="ttl">
        <h1><small>הזמנה</small><bdi>#{orderNo}</bdi></h1>
        <span id="hdrChips" className="row wrap" />
      </div>
      {oc.status === 'ready' ? <ScanBar oc={oc} ui={ui} /> : null}
      <div className="tools">
        {oc.status === 'ready' && oc.flags.isLocked ? (
          <button type="button" className="xlbtn xld" data-act="lockbtn" aria-label="הזמנה נעולה" data-tip="הזמנה נעולה — תאריך האירוע עבר. לחצו לשחרור באישור מנהל" onClick={openLocked}>
            <OcIcon name="lock" />
          </button>
        ) : null}
        {oc.status === 'ready' ? (
          <>
            <Exports oc={oc} ui={ui} />
            <PrintMenu oc={oc} ui={ui} />
            <button type="button" className="xlbtn xld" data-act="delete" aria-label="מחיקת הזמנה" data-tip="מחיקת הזמנה" onClick={() => oc.deleteOrder()}>
              <XlGlyph kind="delete" />
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
