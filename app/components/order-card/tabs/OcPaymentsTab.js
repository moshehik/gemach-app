'use client';

// OcPaymentsTab — לשונית "תשלומים" של כרטיס ההזמנה החדש (W4). עיצוב: pPayments של כרטיס-הזמנה.html + סמני r37/r38/r39 של שכבת
// הסקירה (במצב "מאושר"); לוגיקה: פורט של ModernPaymentsManager (hooks/usePaymentActions.js). החלטות הבעלים (PLAN §B.7):
//   A12 מד "שולם ₪X מתוך ₪Y" · A13 שורות "ממתין לשמירה" · R39 אייקון/צבע לסוג חיוב + "ניתן לזכות ₪X על פריט חדש עוד mm:ss"
//   R37 פרטי תשלום מלאים + מחק תשלום · R38 זיכויים ממתינים (פרטי בנק, אשר ביצוע) · R22 לחצן אחד "חיוב / זיכוי ידני" ב"אפשרויות מנהל"
//   R33 "חישוב מחדש" רק להנהלה ראשית · R35 אין "הוסף חיוב"/"מחק"/"פרטי חיוב" בכרטיס החיובים · R34 אין חיוב משלוח ידני
//   A14/AMB-15 אין לוחית זיכוי ואין אריח "זיכוי ביטול זמין לניצול" - הספירה נשארת בשורת דמי הביטול.
// אירועי הבקר (debtCreated / autoRefundNeedsBank) ובקשות תשלום מבחוץ (R4, requestPayment) - ב-usePaymentActions.
// props: {oc, ui, active}

import { useEffect, useState } from 'react';
import OcIcon from '../OcIcon';
import { fmtMoney, fmtSignedMoney, hebDateOf } from '../orderCardLogic';
import { formatIsraelHHMM } from '@/lib/loginFlow';
import usePaymentActions, {
  amountOf, cancellationCreditInfo, countdownText, creditWindowMinutes, money2, obligationIconName, obligationLabel, obligationRows,
  paymentIconName, pendingRefundsOf, refundNeedsBank
} from '../hooks/usePaymentActions';
import OcPayDialog from '../dialogs/OcPayDialog';
import OcCreditDialog from '../dialogs/OcCreditDialog';
import OcBankDialog from '../dialogs/OcBankDialog';
import OcRefundRequestDialog from '../dialogs/OcRefundDialogs';
import OcManualMoneyDialog, { OcAddChargeDialog } from '../dialogs/OcManualMoneyDialog';
import OcPaymentDetails from '../dialogs/OcPaymentDetails';

const DIALOGS = { Pay: OcPayDialog, Credit: OcCreditDialog, Bank: OcBankDialog, RefundRequest: OcRefundRequestDialog, Manual: OcManualMoneyDialog, AddCharge: OcAddChargeDialog, PaymentDetails: OcPaymentDetails };

const Money = ({ n }) => <bdi dir="ltr">{fmtMoney(n)}</bdi>;
const Tip = ({ text }) => <button type="button" className="tip" data-tip={text} aria-label="עזרה"><OcIcon name="info" size="sm" /></button>;
const when = (d) => [hebDateOf(d), formatIsraelHHMM(d)].filter(Boolean).join(' · ');

// R39: "ניתן לזכות ₪X על פריט חדש עוד mm:ss" - מתעדכן כל שנייה ונעלם כשהזמן פג (CancellationCreditBadge של הישן)
function CreditCountdown({ info }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const c = countdownText(info.deadline, now);
  if (!c) return null;
  return (
    <span className={`chip ${c.urgent ? 'red' : 'gray'} oc-cdown`} data-tip="ניתן לנצל סכום זה כזיכוי אוטומטי אם יתווסף פריט חלופי לאותה הזמנה, עד לתום הזמן שנקבע בהגדרות">
      <OcIcon name="clock" size="sm" />ניתן לזכות <bdi dir="ltr">{fmtMoney(info.remaining)}</bdi> על פריט חדש עוד <bdi dir="ltr" className="cdn">{c.text}</bdi>
    </span>
  );
}

function ObligationRow({ o, pend, credit }) {
  const amt = amountOf(o.amount);
  const cr = amt < 0;
  const label = obligationLabel(o);
  const sub = pend ? 'ממתין לשמירה' : (o.createdAt ? when(o.createdAt) : '');
  return (
    <div className={`li${pend ? ' pend' : ''}`} data-oc-obl={o.id || o._localId || ''}>
      <div className="ic-b"><OcIcon name={obligationIconName(o)} /></div>
      <div className="t">
        <b>{label}</b>
        {sub ? <small>{sub}</small> : null}
        <div className={`a${cr ? ' cr' : ''}`}><bdi dir="ltr">{pend ? fmtSignedMoney(amt) : cr ? `−${fmtMoney(amt)}` : fmtMoney(amt)}</bdi></div>
        {credit ? <CreditCountdown info={credit} /> : null}
      </div>
    </div>
  );
}

export default function OcPaymentsTab({ oc, ui }) {
  const pay = usePaymentActions(oc, ui, DIALOGS);
  const { totals } = oc;
  const bal = money2(totals.balance);
  const required = money2(totals.required);
  const paid = money2(totals.paid);
  const pct = required > 0 ? Math.max(0, Math.min(100, Math.round((paid / required) * 100))) : (paid > 0 ? 100 : 0);
  const minutes = creditWindowMinutes(oc.settings, oc.settingsReady);
  const rows = obligationRows(oc.obligations, (oc.snapshot && oc.snapshot.obligations) || []);
  const payments = [...oc.payments.filter(p => !p.isDeleted)].sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0));
  const pending = pendingRefundsOf(oc.refunds);

  return (
    <div className="oc-pay-tab">
      {/* A12 מצב תשלום */}
      <div className="card" data-oc-pay="status">
        <div className="card-h"><div className="ico green"><OcIcon name="wallet" size="lg" /></div><h2>מצב תשלום</h2></div>
        <div className="bal">
          <div>
            <div className="faint sm">{bal < 0 ? 'זיכוי זמין' : 'נשאר לתשלום'}</div>
            <div className={`n ${bal > 0 ? 'oc-debt' : 'oc-ok'}`}><Money n={Math.abs(bal)} /></div>
          </div>
          <div className="oc-pbar-w">
            <div className="row spread sm muted"><span>שולם <Money n={Math.min(paid, required)} /></span><span>מתוך <Money n={required} /></span></div>
            <div className="pbar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`שולם ${pct}%`}><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
        {bal > 0 ? <button type="button" className="btn lg block oc-pay-main" data-act="pay-now" disabled={oc.saving} onClick={pay.payNow}><OcIcon name="card" />תשלום <Money n={bal} /></button> : null}
        {bal < 0 ? <button type="button" className="btn primary lg block oc-pay-main" data-act="credit-now" disabled={oc.saving} onClick={pay.creditNow}><OcIcon name="undo" />זכה <Money n={bal} /></button> : null}
      </div>

      {/* R38 זיכויים ממתינים */}
      {pending.length ? (
        <div className="card" id="oc-pending-refunds" data-oc-pay="refunds">
          <div className="card-h"><div className="ico rose"><OcIcon name="undo" size="lg" /></div><h2>זיכויים ממתינים</h2></div>
          <div className="list">
            {pending.map(r => {
              const noBank = refundNeedsBank(r);
              return (
                <div className="li oc-rf" key={r.id}>
                  <div className="ic-b"><OcIcon name="bank" /></div>
                  <div className="t">
                    <b>זיכוי <Money n={amountOf(r.amount)} /> · ממתין לביצוע</b>
                    <small>{[r.reason || 'ללא סיבה', noBank ? 'חסרים פרטי בנק' : `בנק ${r.bankName} · סניף ${r.bankBranch}`, r.createdAt ? hebDateOf(r.createdAt) : ''].filter(Boolean).join(' · ')}</small>
                  </div>
                  <button type="button" className="btn sm" onClick={() => pay.openBank(r)}><OcIcon name="pencil" size="sm" />{noBank ? 'הזנת פרטי בנק' : 'עריכת פרטי בנק'}</button>
                  <button type="button" className="btn sm" onClick={() => pay.openCredit(r)}><OcIcon name="check" size="sm" />אשר ביצוע</button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* חיובים (A13 + R39; R34/R35: בלי לחצני הוספה/מחיקה) */}
      <div className="card" data-oc-pay="charges">
        <div className="card-h"><div className="ico rose"><OcIcon name="file" size="lg" /></div><h2>חיובים <Tip text="מתעדכן אוטומטית" /></h2>{oc.preview.isPreviewing ? <span className="faint oc-calc" role="status"><span className="spinner" aria-hidden="true" />מחשב מחדש ברקע…</span> : null}</div>
        <div className="list">
          {rows.length ? rows.map(({ o, pend }, i) => (
            <ObligationRow key={o.id || o._localId || `p${i}`} o={o} pend={pend} credit={pend ? null : cancellationCreditInfo(o, { obligations: oc.obligations, items: oc.items, minutes })} />
          )) : <div className="empty oc-empty"><OcIcon name="file" size="lg" /><span>אין חיובים מתועדים</span></div>}
        </div>
      </div>

      {/* תשלומים שהתקבלו (R37) */}
      <div className="card" data-oc-pay="payments">
        <div className="card-h">
          <div className="ico blue"><OcIcon name="card" size="lg" /></div><h2>תשלומים שהתקבלו</h2>
          {bal > 0 && !oc.dirty ? <button type="button" className="btn navy" data-act="pay-now" disabled={oc.saving} onClick={pay.payNow}><OcIcon name="plus" />הוסף תשלום</button> : null}
        </div>
        <div className="list">
          {payments.length ? payments.map((p, i) => {
            const amt = amountOf(p.amount);
            const fresh = !p.id;
            return (
              <div className={`li${fresh ? ' pend' : ''}`} key={p.id || p._localId || i} data-oc-pay-row={p.id || p._localId || ''}>
                <div className="ic-b"><OcIcon name={paymentIconName(p.paymentMethod)} /></div>
                <div className="t">
                  <b>{p.paymentMethod || '-'}</b>
                  <small>{fresh ? 'ממתין לשמירה' : when(p.paymentDate)}</small>
                  <div className={`a${amt < 0 ? ' cr' : ''}`}><bdi dir="ltr">{amt < 0 ? `−${fmtMoney(amt)}` : fmtMoney(amt)}</bdi></div>
                </div>
                <button type="button" className="ibtn oc-ib" aria-label="פרטים נוספים" data-tip="פרטים נוספים" onClick={() => pay.openPaymentDetails(p)}><OcIcon name="info" size="sm" /></button>
                {/* שורה שעוד לא נשמרה (חיוב אשראי שלא נשמר בשרת / מעקף) לא נמחקת מכאן - כסף שכבר זז לא נעלם בלחיצה; ביטול השינוי ברייל */}
                {fresh ? null : <button type="button" className="ibtn oc-ib" aria-label="מחק תשלום" data-tip="מחק תשלום" onClick={async () => {
                  const ok = await ui.confirm({ title: 'מחיקת תשלום', sub: `למחוק את התשלום ב${p.paymentMethod || 'תשלום'} בסך ${fmtMoney(amt)}? הפעולה נשמרת עם שמירת ההזמנה.`, okText: 'מחק', icon: 'trash', danger: true });
                  if (ok) pay.actions.deletePayment(p);
                }}><OcIcon name="trash" size="sm" /></button>}
              </div>
            );
          }) : <div className="empty oc-empty"><OcIcon name="cash" size="lg" /><span>לא בוצעו תשלומים</span></div>}
        </div>
      </div>

      {/* אפשרויות מנהל: R22 (לחצן אחד) + R33 (הנהלה ראשית בלבד) */}
      <details className="coll" data-oc-pay="manager">
        <summary><OcIcon name="lock" />אפשרויות מנהל<OcIcon name="chev" className="chev" /></summary>
        <div className="in">
          <div className="row wrap oc-mgr">
            <button type="button" className="btn" data-act="manual-money" onClick={pay.openManual}><OcIcon name="cash" size="sm" />חיוב / זיכוי ידני</button>
            {pay.canRecalc ? (
              <button type="button" className="btn" data-act="recalc" disabled={pay.busy === 'recalc' || oc.saving} onClick={pay.runRecalc}>
                {pay.busy === 'recalc' ? <span className="spinner" aria-hidden="true" /> : <OcIcon name="refresh" size="sm" />}חישוב מחדש
              </button>
            ) : null}
          </div>
        </div>
      </details>
    </div>
  );
}
