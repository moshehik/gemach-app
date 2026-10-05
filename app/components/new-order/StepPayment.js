'use client';

// שלב 6 "תשלום וסיום" - R.payment בעיצוב: מצב תשלום (.bal + .pbar), רישום תשלום (.amtin + .methods + הערה), תשלומים שנרשמו.
// אותה התנהגות כמו בישן: אופני התשלום מ-ALLOWED_PAYMENT_METHODS (בלי אשראי כשנדרים כבוי), "אישור תשלום" רושם/פותח אשראי,
// "חיוב אשראי" רק כש-nedarim_plus_enabled לא 'false', חיוב שבוצע לא ניתן להסרה. R27/R31/R28 - ב-controller.
import { Blk, Ic, OneCard, SubH, money } from './NoUi';
import { isChargedPayment, methodIcon, moneyTxt } from './newOrderLogic';

export default function StepPayment({ ctl }) {
  const s = ctl.settings;
  const tot = ctl.totalAmount;
  const paid = ctl.totalPaid;
  const bal = ctl.remaining;
  const pct = tot ? Math.min(100, Math.round((paid / tot) * 100)) : 0;
  const p = ctl.payment;
  const busy = ctl.saving || ctl.isProcessingCredit || !!ctl.saved;
  // Enter בסכום / בהערה = "אישור תשלום" (כמו ה-form בישן ו-keydown בעיצוב)
  const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) ctl.handleAddPaymentClick(); } };
  return (
    <OneCard>
      <Blk>
        <SubH icon="wallet" tone="green" title="מצב תשלום" />
        <div className="bal">
          <div><div className="faint sm">{bal > 0 ? 'יתרה' : 'שולם במלואו'}</div><div className="n" style={{ color: bal > 0 ? 'var(--gm-red)' : 'var(--gm-green)' }}>{money(bal)}</div></div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div className="row spread sm muted"><span>שולם {money(paid)}</span><span>סה&quot;כ חיובים {money(tot)}</span></div>
            <div className="pbar"><i style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      </Blk>
      <Blk>
        <SubH icon="card" tone="blue" title="רישום תשלום" />
          <label className="lbl" htmlFor="noPayAmt">סכום לתשלום כעת (₪)</label>
          <div className="amtin"><span>₪</span><input id="noPayAmt" type="number" inputMode="decimal" step="any" value={p.amount} onKeyDown={enter} onChange={(e) => ctl.setPayment(prev => ({ ...prev, amount: e.target.value }))} /></div>
          <div className="lbl" style={{ marginTop: 14 }}>אופן תשלום</div>
          <div className="methods" id="methods" role="radiogroup" aria-label="אופן תשלום">
            {ctl.paymentMethodOptions.map(m => (
              <button key={m} type="button" role="radio" aria-checked={p.method === m} className={p.method === m ? 'on' : ''} onClick={() => ctl.setPayment(prev => ({ ...prev, method: m }))}>
                <Ic n={methodIcon(m)} c="lg" />{m}
              </button>
            ))}
          </div>
          {/* 51f2cc56 (נווה יעקב): hide_order_payment_note='true' מסתיר את "הערה לתשלום" (כמו בישן). ברירת מחדל - מוצג */}
          {s.hide_order_payment_note !== 'true' ? (
            <details className="coll" style={{ marginTop: 14 }} open={p.notes ? true : undefined}>
              <summary><Ic n="note" />הערה לתשלום<Ic n="chev" c="chev" /></summary>
              <div className="in">
                <div className="inpw ico-in"><Ic n="note" c="sm" /><input className="inp" id="noPayNote" placeholder="מספר אישור, פרטי הבנק, שם המשלם..." autoComplete="off" value={p.notes} onKeyDown={enter} onChange={(e) => ctl.setPayment(prev => ({ ...prev, notes: e.target.value }))} /></div>
              </div>
            </details>
          ) : null}
          <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
            <button type="button" className="btn green" disabled={busy} onClick={ctl.handleAddPaymentClick}><Ic n="check" />אישור תשלום / פיצול</button>
            {s.nedarim_plus_enabled !== 'false' ? <button type="button" className="btn navy" disabled={busy} onClick={() => ctl.openCredit(p.notes)}><Ic n="card" />חיוב אשראי</button> : null}
          </div>
      </Blk>
      <Blk>
        <SubH icon="list" tone="gold" title="תשלומים שנרשמו" />
        <div className="list">
          {ctl.paymentsList.length ? ctl.paymentsList.map((x, i) => (
            <div className="li" key={i}>
              <div className="ic-b"><Ic n={methodIcon(x.method || '')} /></div>
              <div className="t"><b>{x.method}</b><small>{x.notes || ''}</small><div className="a">{money(x.amount)}</div></div>
              {isChargedPayment(x)
                ? <button type="button" className="ibtn" disabled data-tip="חיוב אשראי שכבר בוצע — לא ניתן להסרה" aria-label="הסר תשלום"><Ic n="lock" c="sm" /></button>
                : <button type="button" className="ibtn" data-tip="הסר תשלום" aria-label="הסר תשלום" disabled={busy} onClick={() => ctl.removePayment(i)}><Ic n="trash" c="sm" /></button>}
            </div>
          )) : <div className="empty">טרם נרשמו תשלומים</div>}
        </div>
        {bal > 0 ? (
          <div className="muted sm" style={{ marginTop: 12 }}><Ic n="info" c="sm" /> נותרה יתרה של {moneyTxt(bal)}. סיום ההזמנה ללא תשלום מלא אפשרי רק אם בוחרים &quot;יציאה באישור מנהל&quot; מתוך רשימת &quot;אופן תשלום&quot; למעלה (ולא בכפתור נפרד) - זה יבקש קוד וסיסמת מנהל.</div>
        ) : null}
      </Blk>
    </OneCard>
  );
}
