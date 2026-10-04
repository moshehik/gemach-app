'use client';

// OcCreditDialog — D4 "אישור ביצוע זיכוי" (R38 "אשר ביצוע" ו"זכה ₪N"): פרטי הזיכוי הממתין והבנק (סכום, בנק, סניף), שורת הוידוא
// "בוצעה העברה בנקאית?" ושני לחצנים "כן, בוצעה העברה" / "עוד לא" (W4-D4). "כן" = אישור מנהל (AMB-22, feature:manual_payment_credit_add;
// מי שמורשה לא מתבקש) ואז PUT /api/refunds/{id} {isExecuted:true} (השרת יוצר תשלום הפכי ושולח ללקוח מייל) → סנכרון מהשרת
// (MPM approveRefund :303-326). A14: אין "זיכוי לניצול על פריט חלופי" כבחירה - זה כלל של המנוע (דמי ביטול, R39).
// props: {api, refund, close} ; close: {executed:true} | 'bank' | null

import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons } from '../OcUi';
import { fmtMoney } from '../orderCardLogic';
import { amountOf, refundNeedsBank } from '../hooks/usePaymentActions';

const Row = ({ label, value, missing }) => (
  <div className="c">
    <div className="t">{label}</div>
    <div className={`amt z${missing ? ' oc-miss' : ''}`}>{value}</div>
  </div>
);

export default function OcCreditDialog({ api, refund, close }) {
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const noBank = refundNeedsBank(refund);
  const money = fmtMoney(amountOf(refund.amount));
  const execute = async () => {
    if (busy || noBank) return;
    setErr('');
    setBusy(true);
    try {
      const r = await api.actions.executeRefundApproved(refund.id);
      if (r.cancelled) return;
      if (!r.ok) { setErr(r.error); return; }
      close({ executed: true });
    } finally { setBusy(false); }
  };
  return (
    <>
      <h2 id="oc-credit-t">אישור ביצוע זיכוי</h2>
      <div className="sub">אישור הביצוע ייצור תשלום הפכי להזמנה (החזר/זיכוי <bdi dir="ltr">{money}</bdi>) וישלח ללקוח הודעה.</div>
      <div className="chg">
        <Row label="סכום" value={<bdi dir="ltr">{money}</bdi>} />
        {refund.reason ? <Row label="סיבה" value={refund.reason} /> : null}
        <Row label="בנק" value={refund.bankName?.trim() || 'חסר'} missing={!refund.bankName?.trim()} />
        <Row label="סניף" value={refund.bankBranch?.trim() || 'חסר'} missing={!refund.bankBranch?.trim()} />
        {refund.bankAccount ? <Row label="מספר חשבון" value={<bdi dir="ltr">{refund.bankAccount}</bdi>} /> : null}
        {refund.bankAccountName ? <Row label="שם בעל החשבון" value={refund.bankAccountName} /> : null}
      </div>
      <div className="oc-confirm-row" data-act="confirm-transfer"><OcIcon name="bank" size="sm" /><span>בוצעה העברה בנקאית?</span></div>
      <div className="faint oc-dlg-note">האישור סופי: נוצר תשלום הפכי ונשלחת ללקוח הודעה. יש ללחוץ "כן" רק לאחר שההעברה בוצעה בפועל.</div>
      <div className="amsg" aria-live="polite">{err ? <><OcIcon name="alert" size="sm" />{err}</> : noBank ? <><OcIcon name="alert" size="sm" />חובה להזין בנק וסניף לפני ביצוע הזיכוי</> : null}</div>
      <DlgButtons>
        <button type="button" className="btn primary lg block" data-act="confirm-credit" disabled={busy || noBank} onClick={execute}>
          {busy ? <><span className="spinner" aria-hidden="true" />מעבד...</> : <><OcIcon name="check" />כן, בוצעה העברה</>}
        </button>
        <DlgBtn icon="bank" disabled={busy} onClick={() => close('bank')}>{noBank ? 'הזנת פרטי בנק' : 'עריכת פרטי בנק'}</DlgBtn>
        <DlgBtn kind="ghost" icon="clock" act="not-yet" disabled={busy} onClick={() => close(null)}>עוד לא</DlgBtn>
      </DlgButtons>
    </>
  );
}
