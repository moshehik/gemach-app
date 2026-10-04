'use client';

// OcRefundDialogs — R38 "יצירת בקשת זיכוי" (WIN.refundreq בעיצוב + השדות של MPM :1357-1407): סכום, בנק, סניף, מספר חשבון, שם בעל
// החשבון, סיבה, אמצעי התשלום לזיכוי (מהתשלום האחרון, לקריאה בלבד) ומייל הלקוח. שמירה = POST /api/refunds (אותם מפתחות; השרת מעדכן גם
// את פרטי הבנק בכרטיס הלקוח) → GET ההזמנה → applyServerOrder (MPM submitRefund :230-261).
// props: {api, amount?, close} ; close: {created:true} | null

import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, Field, Inp } from '../OcUi';
import { BankFields } from './OcBankDialog';
import { refundPrefill } from '../hooks/usePaymentActions';

export default function OcRefundRequestDialog({ api, amount, close }) {
  const oc = api.oc;
  const [data, setData] = useState(() => ({ ...refundPrefill(oc.order?.customer, oc.payments), amount: amount > 0 ? String(amount) : '' }));
  const [ibanErr, setIbanErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch) => { setData(d => ({ ...d, ...patch })); setErr(''); };
  const submit = async () => {
    if (busy) return;
    if (ibanErr) { setErr(ibanErr); return; }
    setErr('');
    setBusy(true);
    try {
      const r = await api.actions.createRefund(data);
      if (!r.ok) { setErr(r.error); return; }
      close({ created: true });
    } finally { setBusy(false); }
  };
  const key = (e) => { if (e.key === 'Enter' && !busy) { e.preventDefault(); submit(); } };
  return (
    <>
      <h2 id="oc-refund-t">יצירת בקשת זיכוי</h2>
      <div className="sub">הפרטים נשמרים גם בכרטיס הלקוח.</div>
      <div className="oc-ccf">
        <Field label="סכום לזיכוי *" icon="tag" htmlFor="oc-rf-amt">
          <Inp id="oc-rf-amt" type="number" inputMode="decimal" dir="ltr" data-autofocus="true" value={data.amount} onChange={(e) => set({ amount: e.target.value })} onKeyDown={key} />
        </Field>
        <BankFields idp="oc-rf" value={data} onChange={(v) => set(v)} iban onIbanError={setIbanErr} onEnter={submit} />
        <Field label="סיבה / הערות" icon="note" htmlFor="oc-rf-reason">
          <Inp id="oc-rf-reason" value={data.reason} onChange={(e) => set({ reason: e.target.value })} onKeyDown={key} />
        </Field>
        <Field label="אמצעי תשלום לזיכוי (נלקח אוטומטית מתשלום אחרון)" icon="card" htmlFor="oc-rf-pd">
          <Inp id="oc-rf-pd" readOnly value={data.paymentDetails} />
        </Field>
        <Field label="מייל הלקוח" icon="mail" htmlFor="oc-rf-mail">
          <Inp id="oc-rf-mail" type="email" dir="ltr" value={data.email} onChange={(e) => set({ email: e.target.value })} onKeyDown={key} />
        </Field>
      </div>
      <div className="amsg" aria-live="polite">{err || ibanErr ? <><OcIcon name="alert" size="sm" />{err || ibanErr}</> : null}</div>
      <DlgButtons>
        <button type="button" className="btn primary lg block" data-act="refund-ok" disabled={busy} onClick={submit}>
          {busy ? <><span className="spinner" aria-hidden="true" />מעבד...</> : <><OcIcon name="check" />צור בקשת זיכוי</>}
        </button>
        <DlgBtn kind="ghost" icon="x" disabled={busy} onClick={() => close(null)}>ביטול</DlgBtn>
      </DlgButtons>
    </>
  );
}
