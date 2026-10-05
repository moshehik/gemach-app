'use client';

// OcManualMoneyDialog — R22: הלחצן המאוחד "חיוב / זיכוי ידני" ב"אפשרויות מנהל" (בקשת הבעלים: לחצן אחד, בשני הגמ"חים), ובתוכו:
//   "הוספת חיוב" (R35: רק מנהל - אישור feature:manual_charge_add לפני החלון; השרת אוכף שוב ב-PUT לגוף cardVariant:'a5')
//   "רישום תשלום נוסף (למשל מזומן)" (רק כש-allow_additional_payment_on_order, כמו "תשלום נוסף" בישן)
//   "בקשת זיכוי ללקוח" (R38)
// האישור feature:manual_payment_credit_add לתשלום/זיכוי - כמו בישן: רק כש-consolidate_manual_payment_credit_ui (נווה) - ר' W4-NOTES AMB-17.
// OcAddChargeDialog — "הוספת חיוב" (WIN.addcharge בעיצוב): תיאור + סכום; נשמר עם שמירת ההזמנה (MPM addObligation :154-166). חיובים ידניים
// שמורים מוצגים כאן עם מחיקה (AMB-16: אותו אישור), כי "מחק"/"פרטי חיוב" ירדו מכרטיס החיובים (R35).

import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, Field, Inp } from '../OcUi';
import { fmtMoney } from '../orderCardLogic';
import { amountOf, obligationLabel, validateManualCharge } from '../hooks/usePaymentActions';

// close: 'charge' | 'payment' | 'refund' | null
export default function OcManualMoneyDialog({ needsApproval, allowPayment, close }) {
  return (
    <>
      <h2 id="oc-manual-t">חיוב / זיכוי ידני</h2>
      {needsApproval ? <div className="sub">נדרש אישור מנהל לפני כל אחת מהפעולות.</div> : null}
      <DlgButtons>
        <DlgBtn kind="primary" icon="plus" autoFocus onClick={() => close('charge')}>הוספת חיוב</DlgBtn>
        {allowPayment ? <DlgBtn icon="cash" onClick={() => close('payment')}>רישום תשלום נוסף (למשל מזומן)</DlgBtn> : null}
        <DlgBtn icon="undo" onClick={() => close('refund')}>בקשת זיכוי ללקוח</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}

// close: {add:{description, amount:number}} | {remove: obligation} | null
export function OcAddChargeDialog({ api, close }) {
  const [desc, setDesc] = useState('');
  const [amt, setAmt] = useState('');
  const [err, setErr] = useState('');
  const manual = (api.oc.obligations || []).filter(o => !o.isDeleted && o.isManual !== false && o.id);
  const submit = () => {
    const e = validateManualCharge({ description: desc, amount: amt });
    if (e) { setErr(e); return; }
    close({ add: { description: desc.trim(), amount: parseFloat(amt) } });
  };
  const key = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };
  return (
    <>
      <h2 id="oc-charge-t">הוספת חיוב</h2>
      <div className="sub">חיוב חריג ידני. נשמר עם שמירת ההזמנה.</div>
      <div className="oc-ccf">
        <Field label="תיאור החיוב" icon="file" htmlFor="oc-ch-desc">
          <Inp id="oc-ch-desc" placeholder="למשל: הובלה מיוחדת" data-autofocus="true" value={desc} onChange={(e) => { setDesc(e.target.value); setErr(''); }} onKeyDown={key} />
        </Field>
        <Field label="סכום (₪)" icon="tag" htmlFor="oc-ch-amt">
          <Inp id="oc-ch-amt" type="number" inputMode="decimal" dir="ltr" value={amt} onChange={(e) => { setAmt(e.target.value); setErr(''); }} onKeyDown={key} />
        </Field>
      </div>
      {manual.length ? (
        <div className="mfld">
          <span className="lbl"><OcIcon name="pencil" size="sm" />חיובים ידניים בהזמנה</span>
          <div className="chg">
            {manual.map((o, i) => (
              <div className="c" key={o.id || i}>
                <div className="t">{obligationLabel(o)}</div>
                <div className="amt z"><bdi dir="ltr">{fmtMoney(amountOf(o.amount))}</bdi></div>
                <button type="button" className="ibtn" aria-label={`מחק חיוב: ${obligationLabel(o)}`} data-tip="מחק" onClick={() => close({ remove: o })}><OcIcon name="trash" size="sm" /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="amsg" aria-live="polite">{err ? <><OcIcon name="alert" size="sm" />{err}</> : null}</div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="plus" disabled={!desc.trim() || !amt} onClick={submit}>הוסף חיוב</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}
