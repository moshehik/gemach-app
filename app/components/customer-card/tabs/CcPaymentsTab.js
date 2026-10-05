'use client';

// לשונית "תשלומים" (העיצוב: pPayments). "מצב חשבון" עם סה״כ זיכויים ונוסחת החוב (refkpi; J3 ב': הזיכוי משפיע על היתרה - אותה
// נוסחה כמו הכרטיס הישן: חוב = חיובים − (תשלומים − זיכויים)), "חיובים פתוחים" (openchg), "תשלומים שהתקבלו" כולל הזיכויים (הרשימה
// שהייתה בלשונית הזיכויים - reflist), תשלום מהכרטיס (pay), ופרטי הבנק לזיכויים בקצרה (J1 ב'; העריכה בלשונית פרטים).
// הוסרו: בשורת זיכוי - סוג / הזמנה מקושרת / סטטוס ביצוע (paytype), "אפשרויות מנהל" (mgropt).

import { getHebrewDateString } from '@/lib/hebrewDate';
import { paymentNoteSummary } from '@/lib/history/sanitize';
import CcIcon from '../CcIcon';
import { Tip } from '../CcFields';
import { paymentMethodIcon, paymentRows } from '../customerCardLogic';
import { eventLabel } from './CcOrdersTab';

const money = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;
const heb = (d) => (d ? getHebrewDateString(d) : '');

export default function CcPaymentsTab({ cc }) {
  const { account, charges, cur } = cc;
  const bal = account.balance;
  const rows = paymentRows(cur, cc.refunds);
  const bank = [cur.bankName, cur.bankBranch ? `סניף ${cur.bankBranch}` : '', cur.bankAccount ? `חשבון ${cur.bankAccount}` : '', cur.bankAccountName].filter(Boolean).join(' · ');
  const payLabel = cc.paymentsEnabled ? 'תשלום' : 'לתשלום בהזמנה';
  return (
    <>
      <div className="card">
        <div className="card-h"><div className="ico green"><CcIcon name="wallet" size="lg" /></div><h2>מצב חשבון</h2></div>
        <div className="bal">
          <div><div className="faint sm">{bal < 0 ? 'זיכוי זמין' : 'נשאר לתשלום'}</div><div className="n"><bdi dir="ltr">{money(bal)}</bdi></div></div>
          <div className="cc-balbar">
            <div className="row spread sm muted"><span>שולם <bdi dir="ltr">{money(Math.min(Math.max(account.effectivePaid, 0), account.required))}</bdi></span><span>מתוך <bdi dir="ltr">{money(account.required)}</bdi></span></div>
            <div className="pbar"><i style={{ width: `${account.pct}%` }} /></div>
          </div>
        </div>
        <div className="cc-formula faint sm">
          <span>חיובים <bdi dir="ltr">{money(account.required)}</bdi></span>
          <span>תשלומים <bdi dir="ltr">{money(account.paid)}</bdi></span>
          <span>סה״כ זיכויים <bdi dir="ltr">{money(account.refunds)}</bdi></span>
          <Tip text="יתרה = חיובים − (תשלומים − זיכויים)" />
        </div>
        {bal > 0 && charges.length && !cc.readOnly ? (
          <button type="button" className="btn primary cc-mt24" data-act="pay-now" disabled={cc.paying} onClick={() => cc.pay()}><CcIcon name="card" />{payLabel} <bdi dir="ltr">{money(bal)}</bdi></button>
        ) : null}
        {cc.bankEnabled ? (
          <div className="cc-bankline faint sm">
            <CcIcon name="bank" size="sm" anim={false} />
            <span>פרטי בנק לזיכויים: {bank || 'לא הוזנו'}</span>
            <button type="button" className="cc-linkbtn" hidden={cc.readOnly} onClick={() => { cc.setTab('details'); cc.setEditCust(true); }}>עריכה</button>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div className="card-h"><div className="ico rose"><CcIcon name="file" size="lg" /></div><h2>חיובים פתוחים <Tip text="הזמנות שטרם שולמו במלואן" /></h2></div>
        <div className="list">
          {charges.length ? charges.map((c) => (
            <div className="li" key={c.order.orderId}>
              <div className="ic-b"><CcIcon name="file" /></div>
              <div className="t"><b>הזמנה <bdi>#{c.order.orderId}</bdi></b><small>אירוע {eventLabel(c.order)} · שולם <bdi dir="ltr">{money(c.paid)}</bdi> מתוך <bdi dir="ltr">{money(c.required)}</bdi></small><div className="a"><bdi dir="ltr">{money(c.due)}</bdi></div></div>
            </div>
          )) : <div className="empty">אין חיובים פתוחים</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <div className="ico blue"><CcIcon name="card" size="lg" /></div><h2>תשלומים שהתקבלו</h2>
          {bal > 0 && charges.length && !cc.readOnly ? <button type="button" className="btn navy" data-act="pay-now" disabled={cc.paying} onClick={() => cc.pay()}><CcIcon name="plus" />{cc.paymentsEnabled ? 'הוסף תשלום' : 'תשלום בהזמנה'}</button> : null}
        </div>
        <div className="list">
          {rows.length ? rows.map((p) => {
            const refund = p.entryType === 'refund';
            const note = refund ? (p.reason || '') : paymentNoteSummary(p.notes);
            return (
              <div className="li" key={`${p.entryType}-${p.id}`}>
                <div className="ic-b"><CcIcon name={refund ? 'undo' : paymentMethodIcon(p.paymentMethod)} /></div>
                <div className="t">
                  <b>{refund ? 'זיכוי' : (p.paymentMethod || 'תשלום')}</b>
                  <small>{[heb(p.paymentDate), !refund && p.orderId ? `הזמנה #${p.orderId}` : '', note].filter(Boolean).join(' · ')}</small>
                  <div className={`a${refund ? ' cr' : ''}`}><bdi dir="ltr">{refund ? '−' : ''}{money(p.amount)}</bdi></div>
                </div>
              </div>
            );
          }) : <div className="empty">אין תשלומים ללקוחה זו</div>}
        </div>
      </div>
    </>
  );
}
