'use client';

// OcPayDialog — חלון התשלום D3 של כרטיס ההזמנה החדש (A18/R14/R36/R46/R7), בעיצוב payDlg של כרטיס-הזמנה.html + סמן r36 של שכבת
// הסקירה (שדות הכרטיס מתחת לשיטות כשבוחרים "אשראי"). הלוגיקה = MPM הישן (hooks/usePaymentActions.js):
//   אשראי → POST /api/nedarim ואז POST /api/payments (R36), "העברה מהירה" (קורא מגנטי), מעקף מתכנת (אישור 'מתכנת')
//   מזומן/העברה/צ׳ק → POST /api/payments (רק כש-allow_additional_payment_on_order, כמו "תשלום נוסף" בישן)
//   "השאר חוב (באישור מנהל)" → oc.approveDebt({amount}) - רק כשהחלון נפתח בגלל חוב חדש שנוצר בשמירה/יציאה (AMB-06)
//   שער התקנון (R7) לפני אשראי: "כן, חתם" נשמר מיד.
// חלונות-משנה (העברה מהירה, שער התקנון) בשכבה 2 - כדי שהחלון הזה יישאר פתוח עם מה שהוקלד.
// props: {api, source:'save'|'exit'|'server-action'|'pay-now'|'manual', amount, href, intent, close}
// close: {paid:true, amount, method, persisted} | {leftDebt:{employeeId,employeeName}} | null

import { useMemo, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import { DlgBtn, DlgButtons, Field, Inp } from '../OcUi';
import { CREDIT_METHOD, cardNumberInput, money2, parseSwipe, payMethodsFor, paymentIconName, tokefInput } from '../hooks/usePaymentActions';

const DEBT_SOURCES = ['save', 'exit', 'server-action'];

// ---------- "העברה מהירה" (MPM :1095-1118): שדה נסתר שקולט את הטראק מהקורא המגנטי ----------
export function OcSwipeDialog({ close }) {
  const [v, setV] = useState('');
  const ref = useRef(null);
  return (
    <>
      <h2 id="oc-swipe-t">העברת כרטיס מהירה</h2>
      <div className="sub">אנא העבר כעת את כרטיס האשראי בקורא המגנטי...</div>
      <input
        ref={ref}
        className="oc-swipe-in"
        type="text"
        aria-label="קריאת הכרטיס"
        autoComplete="off"
        data-autofocus="true"
        value={v}
        onChange={(e) => { const val = e.target.value; setV(val); const p = parseSwipe(val); if (p) close(p); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        onBlur={(e) => { const t = e.target; setTimeout(() => { if (t && t.isConnected) t.focus(); }, 100); }}
      />
      <DlgButtons>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(null)}>ביטול חלון מהיר</DlgBtn>
      </DlgButtons>
    </>
  );
}
OcSwipeDialog.ocLayer = 2;

// ---------- שער התקנון (R7, MPM :1074-1092) ----------
export function OcRegsDialog({ close }) {
  return (
    <>
      <h2 id="oc-regs-t">חתימה על תקנון</h2>
      <div className="sub">לפני קבלת תשלום יש לוודא שהלקוח חתם על התקנון. האם הלקוח חתם על התקנון?</div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" onClick={() => close(true)}>כן, חתם</DlgBtn>
        <DlgBtn kind="ghost" icon="x" onClick={() => close(false)}>לא (ביטול)</DlgBtn>
      </DlgButtons>
    </>
  );
}
OcRegsDialog.ocLayer = 2;

export default function OcPayDialog({ api, source = 'pay-now', amount, close }) {
  const oc = api.oc;
  const manualOnly = source === 'manual';
  const methods = useMemo(() => payMethodsFor(oc.settings, { manualOnly }), [oc.settings, manualOnly]);
  const debtFlow = DEBT_SOURCES.includes(source);
  const allowLeaveDebt = source === 'save' || source === 'exit';
  const start = money2(amount !== undefined && amount !== null ? amount : oc.totals.balance);
  const [amt, setAmt] = useState(start > 0 ? String(start) : '');
  const [method, setMethod] = useState(methods[0] || '');
  const [card, setCard] = useState({ cardNumber: '', tokef: '', installments: 1, notes: '' });
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState('');
  const amountRef = useRef(null);
  const cardRef = useRef(null);
  const tokefRef = useRef(null);
  const instRef = useRef(null);
  const notesRef = useRef(null);
  const isCredit = method === CREDIT_METHOD;
  const cust = oc.order?.customer || {};

  const focusRef = (r) => { if (r && r.current) r.current.focus(); };
  const nextOnEnter = (e, next) => { if (e.key !== 'Enter') return; e.preventDefault(); if (next === 'submit') { if (!busy) submit(); } else focusRef(next); };

  // R7: שער התקנון לפני אשראי. true = מותר להמשיך
  const regsGate = async () => {
    if (api.oc.order?.hasSignedRegulations) return true;
    const yes = await api.ui.openDialog(OcRegsDialog, {}, { layer: 2, labelledBy: 'oc-regs-t' });
    if (!yes) return false;
    const ok = await api.actions.signRegulations();
    if (!ok) { setErr('שגיאה בשמירת אישור החתימה'); return false; }
    return true;
  };

  const pickMethod = async (m) => {
    setErr('');
    if (m === CREDIT_METHOD && !(await regsGate())) return;
    setMethod(m);
    if (m === CREDIT_METHOD) setTimeout(() => focusRef(cardRef), 30);
  };

  const swipe = async () => {
    setErr('');
    const r = await api.ui.openDialog(OcSwipeDialog, {}, { layer: 2, labelledBy: 'oc-swipe-t' });
    if (r) { setCard(c => ({ ...c, cardNumber: r.cardNumber, tokef: r.tokef })); setTimeout(() => focusRef(instRef), 30); }
  };

  const submit = async () => {
    if (busy) return;
    setErr('');
    if (!method) { setErr('אין אופן תשלום זמין בהגדרות'); return; }
    if (isCredit && !(await regsGate())) return;
    setBusy('pay');
    try {
      const r = isCredit
        ? await api.actions.chargeCard({ ...card, amount: amt })
        : await api.actions.addManualPayment({ amount: amt, paymentMethod: method, notes });
      if (!r.ok) { setErr(r.error || 'שגיאה בתשלום'); return; }
      close({ paid: true, amount: r.amount, method: r.method, persisted: r.persisted });
    } finally { setBusy(''); }
  };

  const bypass = async () => {
    if (busy) return;
    setErr('');
    setBusy('bypass');
    try {
      const r = await api.actions.bypassCard({ ...card, amount: amt });
      if (r.cancelled) return;
      if (!r.ok) { setErr(r.error); return; }
      close({ paid: true, amount: r.amount, method: r.method, persisted: false });
    } finally { setBusy(''); }
  };

  const leaveDebt = async () => {
    if (busy) return;
    setBusy('debt');
    try {
      const a = await api.oc.approveDebt({ amount: start });
      if (a) close({ leftDebt: a });
    } finally { setBusy(''); }
  };

  return (
    <>
      <h2 id="oc-pay-t">{manualOnly ? 'תשלום נוסף' : debtFlow ? 'השינויים נשמרו! נוצר חיוב חדש' : 'תשלום'}</h2>
      {manualOnly ? <div className="sub">רישום תשלום נוסף להזמנה (מזומן, העברה, צ׳ק).</div> : debtFlow ? <div className="sub">יש להשלים את הגבייה.</div> : null}
      <div className="amtin">
        <span>₪</span>
        <input ref={amountRef} type="number" inputMode="decimal" min="0" step="any" aria-label="סכום" value={amt} data-autofocus="true"
          onChange={(e) => { setAmt(e.target.value); setErr(''); }} onKeyDown={(e) => nextOnEnter(e, isCredit ? cardRef : notesRef)} />
      </div>
      {methods.length ? (
        <div className="methods" role="radiogroup" aria-label="אופן תשלום">
          {methods.map(m => (
            <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'on' : ''} data-method={m} onClick={() => pickMethod(m)}>
              <OcIcon name={paymentIconName(m)} size="lg" />{m}
            </button>
          ))}
        </div>
      ) : <div className="faint oc-pay-none" role="status">אין אופן תשלום זמין בהגדרות (נדרים פלוס כבוי ותשלום נוסף לא מאופשר).</div>}
      {isCredit ? (
        <div className="oc-ccf" data-oc="r36">
          <Field label="שם לקוח" icon="user" htmlFor="oc-cc-name">
            <Inp id="oc-cc-name" readOnly value={`${cust.firstName || ''} ${cust.lastName || ''}`.trim()} />
          </Field>
          <Field label="מספר כרטיס אשראי" icon="card" htmlFor="oc-cc-num">
            <Inp id="oc-cc-num" ref={cardRef} dir="ltr" inputMode="numeric" placeholder="0000 0000 0000 0000" maxLength={19} value={card.cardNumber}
              onChange={(e) => { const v = e.target.value; setCard(c => ({ ...c, ...cardNumberInput(v, c.tokef) })); setErr(''); }}
              onKeyDown={(e) => nextOnEnter(e, tokefRef)} />
          </Field>
          <div className="grid2">
            <Field label="תוקף (MM/YY)" htmlFor="oc-cc-exp">
              <Inp id="oc-cc-exp" ref={tokefRef} dir="ltr" inputMode="numeric" placeholder="MM/YY" maxLength={5} value={card.tokef}
                onChange={(e) => { const v = e.target.value; setCard(c => ({ ...c, tokef: tokefInput(v) })); setErr(''); }}
                onKeyDown={(e) => nextOnEnter(e, instRef)} />
            </Field>
            <Field label="תשלומים (1-36)" htmlFor="oc-cc-inst">
              <Inp id="oc-cc-inst" ref={instRef} type="number" min={1} max={36} dir="ltr" value={card.installments}
                onChange={(e) => { const v = e.target.value; setCard(c => ({ ...c, installments: v })); }}
                onKeyDown={(e) => nextOnEnter(e, notesRef)} />
            </Field>
          </div>
          <Field label="הערות" htmlFor="oc-cc-notes">
            <Inp id="oc-cc-notes" ref={notesRef} placeholder="הערות לחיוב" value={card.notes}
              onChange={(e) => { const v = e.target.value; setCard(c => ({ ...c, notes: v })); }}
              onKeyDown={(e) => nextOnEnter(e, 'submit')} />
          </Field>
          <div className="row wrap oc-cc-tools">
            <button type="button" className="btn sm" onClick={swipe} disabled={!!busy}><OcIcon name="scan" size="sm" />העברה מהירה</button>
            <button type="button" className="ibtn oc-bypass" onClick={bypass} disabled={!!busy} aria-label="מעקף מתכנת" data-tip="מעקף מתכנת: רישום ידני כאילו שולם, ללא חיוב אשראי בפועל (מוגבל למתכנת)"><OcIcon name="shield" size="sm" /></button>
          </div>
        </div>
      ) : method ? (
        <div className="oc-ccf">
          <Field label="הערות" htmlFor="oc-pay-notes">
            <Inp id="oc-pay-notes" ref={notesRef} placeholder="הערות לתשלום" value={notes} onChange={(e) => setNotes(e.target.value)} onKeyDown={(e) => nextOnEnter(e, 'submit')} />
          </Field>
        </div>
      ) : null}
      <div className="amsg" aria-live="polite">{err ? <><OcIcon name="alert" size="sm" />{err}</> : null}</div>
      <DlgButtons>
        <button type="button" className="btn green lg block" data-act="confirm-pay" disabled={!!busy || !method} onClick={submit}>
          {busy === 'pay' ? <><span className="spinner" aria-hidden="true" />מעבד...</> : <><OcIcon name="check" />{manualOnly ? 'שמור תשלום' : 'אישור תשלום'}</>}
        </button>
        {allowLeaveDebt ? <DlgBtn icon="lock" act="pay-later" disabled={!!busy} onClick={leaveDebt}>השאר חוב (באישור מנהל)</DlgBtn> : null}
        <DlgBtn kind="ghost" icon={debtFlow ? 'wallet' : 'back'} disabled={busy === 'pay'} onClick={() => close(null)}>{debtFlow ? 'אטפל בזה בטאב תשלומים' : manualOnly ? 'ביטול' : 'חזרה'}</DlgBtn>
      </DlgButtons>
    </>
  );
}
