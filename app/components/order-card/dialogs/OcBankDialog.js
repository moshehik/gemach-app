'use client';

// OcBankDialog — D4b "פרטי בנק" להחזר (A15) על זיכוי קיים: שם בעל החשבון + "IBAN / מספר חשבון" (כמו bankDlg בעיצוב), ומתחת בנק + סניף
// (חובה בשרת). IBAN ישראלי תקין (lib/iban.js, mod-97) מפורק לשדות הקיימים bankName/bankBranch/bankAccount - בלי DDL, וה-IBAN עצמו לא
// נשלח. בלי IBAN: מספר חשבון + בנק + סניף כמו בישן (R38). שמירה = PUT /api/refunds/{id} עם ארבעת השדות (MPM submitAutoRefundBank :453-476).
// BankFields משותף גם לבקשת זיכוי (OcRefundDialogs.js).
// props: {api, refund, auto, close} ; close: {saved:true} | 'later' | null

import { useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, Field, Inp } from '../OcUi';
import { fmtMoney } from '../orderCardLogic';
import { looksLikeIban, parseIsraeliIban, normalizeIban, IL_IBAN_LENGTH } from '@/lib/iban';
import { autoRefundBankPrefill, amountOf } from '../hooks/usePaymentActions';

/**
 * שדות הבנק. value = {bankName, bankBranch, bankAccount, bankAccountName}; onChange(next). iban=true: שדה החשבון מקבל גם IBAN
 * ומפרק אותו. מחזיר גם שגיאת IBAN דרך onIbanError (או '' כשתקין/לא IBAN).
 */
export function BankFields({ value, onChange, iban = false, idp = 'oc-bk', onIbanError, onEnter }) {
  const [acct, setAcct] = useState(value.bankAccount || '');
  const [parsed, setParsed] = useState(null);
  const set = (patch) => onChange({ ...value, ...patch });
  const key = (e) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } };
  const onAcct = (raw) => {
    setAcct(raw);
    if (iban && looksLikeIban(raw)) {
      const s = normalizeIban(raw);
      const r = parseIsraeliIban(s);
      if (r.ok) {
        setParsed(r);
        onIbanError && onIbanError('');
        onChange({ ...value, bankName: r.bankName, bankBranch: r.bankBranch, bankAccount: r.bankAccount });
      } else {
        setParsed(null);
        onIbanError && onIbanError(s.length >= IL_IBAN_LENGTH || !s.startsWith('IL') ? r.error : 'IBAN חלקי');
        onChange({ ...value, bankAccount: '' });
      }
      return;
    }
    setParsed(null);
    onIbanError && onIbanError('');
    set({ bankAccount: raw });
  };
  return (
    <div className="oc-bank">
      <Field label="שם בעל החשבון" icon="user" htmlFor={`${idp}-name`}>
        <Inp id={`${idp}-name`} value={value.bankAccountName || ''} onChange={(e) => set({ bankAccountName: e.target.value })} onKeyDown={key} />
      </Field>
      <Field label={iban ? 'IBAN / מספר חשבון' : 'מספר חשבון'} icon="bank" htmlFor={`${idp}-acct`}>
        <Inp id={`${idp}-acct`} dir="ltr" placeholder={iban ? 'IL00 0000 0000 0000 0000 000' : undefined} value={acct} onChange={(e) => onAcct(e.target.value)} onKeyDown={key} />
      </Field>
      {parsed ? <div className="faint oc-iban-ok" role="status"><OcIcon name="check" size="sm" />{`בנק ${parsed.bankName} · סניף ${parsed.bankBranch} · חשבון ${parsed.bankAccount}`}</div> : null}
      <div className="grid2">
        <Field label="בנק *" htmlFor={`${idp}-bank`}>
          <Inp id={`${idp}-bank`} value={value.bankName || ''} onChange={(e) => set({ bankName: e.target.value })} onKeyDown={key} />
        </Field>
        <Field label="סניף *" htmlFor={`${idp}-branch`}>
          <Inp id={`${idp}-branch`} dir="ltr" inputMode="numeric" value={value.bankBranch || ''} onChange={(e) => set({ bankBranch: e.target.value })} onKeyDown={key} />
        </Field>
      </div>
    </div>
  );
}

export default function OcBankDialog({ api, refund, auto = false, close }) {
  const [bank, setBank] = useState(() => autoRefundBankPrefill(refund, api.oc.order?.customer));
  const [ibanErr, setIbanErr] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy) return;
    if (ibanErr) { setErr(ibanErr); return; }
    setErr('');
    setBusy(true);
    try {
      const r = await api.actions.saveRefundBank(refund.id, bank);
      if (!r.ok) { setErr(r.error); return; }
      close({ saved: true });
    } finally { setBusy(false); }
  };
  return (
    <>
      <h2 id="oc-bank-t">פרטי בנק</h2>
      <div className="sub">להחזר <bdi dir="ltr">{fmtMoney(amountOf(refund.amount))}</bdi></div>
      {auto ? <div className="faint oc-dlg-note">ללקוח נוצרה יתרת זכות עבור הזמנה זו. יש להזין (או לאשר) את פרטי הבנק להעברת הזיכוי.</div> : null}
      <BankFields value={bank} onChange={(v) => { setBank(v); setErr(''); }} iban onIbanError={setIbanErr} onEnter={save} />
      <div className="amsg" aria-live="polite">{err || ibanErr ? <><OcIcon name="alert" size="sm" />{err || ibanErr}</> : null}</div>
      <DlgButtons>
        <button type="button" className="btn green lg block" data-act="bank-ok" disabled={busy} onClick={save}>
          {busy ? <><span className="spinner" aria-hidden="true" />שומר...</> : <><OcIcon name="check" />שמירת פרטי בנק</>}
        </button>
        <DlgBtn kind="ghost" icon="back" disabled={busy} onClick={() => close(auto ? 'later' : null)}>{auto ? 'סגור, אמלא מאוחר יותר' : 'חזרה'}</DlgBtn>
      </DlgButtons>
    </>
  );
}
