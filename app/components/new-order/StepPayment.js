'use client';

// שלב 6 "תשלום וסיום" - R.payment בעיצוב: מצב תשלום (.bal + .pbar), רישום תשלום (.amtin + .methods + הערה), תשלומים שנרשמו.
// אותה התנהגות כמו בישן: אופני התשלום מ-ALLOWED_PAYMENT_METHODS (בלי אשראי כשנדרים כבוי), "אישור תשלום" רושם/פותח אשראי,
// "חיוב אשראי" רק כש-nedarim_plus_enabled לא 'false', חיוב שבוצע לא ניתן להסרה. R27/R31/R28 - ב-controller.
// פריסה (העיצוב העדכני B2): קלף אחד (.card.one) עם שתי עמודות - הטופס (.pay-main) מימין ו"תשלומים שנרשמו" (.pay-side, נדבקת בגלילה) משמאל,
// עם קו מפריד דק ביניהן - רק כשכבר נרשם תשלום; בלי תשלומים העמוד בעמודה אחת. מתחת ל-761px העמודה מתחת, באותו קלף. הערת "נותרה יתרה..." נשארת תמיד: ליד התשלומים כשיש, ומתחת לרישום התשלום כשאין.
import { Blk, Ic, OneCard, SubH, Tip, money } from './NoUi';
import { CalcErrorNote } from './NoDeliveryBits';
import { isChargedPayment, isCreditMethod, methodIcon, moneyTxt } from './newOrderLogic';

const AMT_STEP = 10;

export default function StepPayment({ ctl }) {
  const s = ctl.settings;
  const tot = ctl.totalAmount;
  const paid = ctl.totalPaid;
  const bal = ctl.remaining;
  const pct = tot ? Math.min(100, Math.round((paid / tot) * 100)) : 0;
  const p = ctl.payment;
  const busy = ctl.saving || ctl.isProcessingCredit || !!ctl.saved;
  const hasPays = ctl.paymentsList.length > 0;
  // Enter בסכום / בהערה = "אישור תשלום" (כמו ה-form בישן ו-keydown בעיצוב)
  // סכום התשלום: אי אפשר לעבור את היתרה לתשלום (bal); +/- בקפיצות של AMT_STEP, בלי חיצי הדפדפן
  const maxPay = Math.max(0, Math.round(bal * 100) / 100);
  const setAmount = (v) => ctl.setPayment(prev => ({ ...prev, amount: v }));
  const curAmt = parseFloat(p.amount) || 0;
  const stepAmount = (dir) => setAmount(String(Math.min(maxPay, Math.max(0, Math.round((curAmt + dir * AMT_STEP) * 100) / 100))));
  const typeAmount = (raw) => { const n = parseFloat(raw); setAmount(Number.isFinite(n) && n > maxPay ? String(maxPay) : raw); };
  // בחירת אשראי פותחת את חלון החיוב מיד (בלי כפתור נפרד); לחיצה חוזרת על האריח פותחת אותו שוב. בלי סכום - רק נבחר, ו-Enter בשדה הסכום פותח
  const isCredit = isCreditMethod(p.method);
  const pickMethod = (m) => {
    ctl.setPayment(prev => ({ ...prev, method: m }));
    if (isCreditMethod(m) && !busy && curAmt > 0) ctl.openCredit(p.notes);
  };
  const enter = (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!busy) ctl.handleAddPaymentClick(); } };
  // נוסח מקוצר בטולטיפ (במקום שורת הסבר): סיום בלי תשלום מלא רק דרך "יציאה באישור מנהל" ברשימת אופן התשלום
  const balTip = bal > 0 ? `יתרה ${moneyTxt(bal)}. סיום בלי תשלום מלא: "יציאה באישור מנהל" (דורש קוד וסיסמת מנהל).` : '';
  return (
    <OneCard>
      <div className={`pay-split${hasPays ? ' has-side' : ''}`}>
        <div className="pay-main">
          <Blk>
            <SubH icon="wallet" tone="green" title="מצב תשלום" />
            <div className="bal">
              <div><div className="faint sm">{bal > 0 ? 'יתרה' : 'שולם במלואו'}</div><div className="n" style={{ color: bal > 0 ? 'var(--gm-red)' : 'var(--gm-green)' }}>{money(bal)}</div></div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="row spread sm muted"><span>שולם {money(paid)}</span></div>
                <div className="pbar"><i style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
            <CalcErrorNote ctl={ctl} />
          </Blk>
          <Blk>
            <SubH icon="card" tone="blue" title="רישום תשלום" />
            <label className="lbl" htmlFor="noPayAmt">סכום לתשלום כעת (₪)</label>
            <div className="amtin">
              <button type="button" className="numb dn" aria-label="הפחתה" tabIndex={-1} disabled={curAmt <= 0} onClick={() => stepAmount(-1)}><Ic n="minus" c="sm" /></button>
              <span>₪</span><input id="noPayAmt" type="number" inputMode="decimal" step="any" min="0" max={maxPay} value={p.amount} onKeyDown={enter} onChange={(e) => typeAmount(e.target.value)} />
              <button type="button" className="numb up" aria-label="הוספה" tabIndex={-1} disabled={curAmt >= maxPay} onClick={() => stepAmount(1)}><Ic n="plus" c="sm" /></button>
            </div>
            <div className="lbl" style={{ marginTop: 14 }}>אופן תשלום{balTip ? <> <Tip t={balTip} /></> : null}</div>
            {/* אמצעי התשלום באריחי .opt זה לצד זה, כמו כפתורי התיקונים (צוואר / שרוול / אורך) */}
            <div className="altopts" id="methods" role="radiogroup" aria-label="אופן תשלום">
              {ctl.paymentMethodOptions.map(m => (
                <button key={m} type="button" role="radio" aria-checked={p.method === m} className={`opt${p.method === m ? ' on' : ''}`} onClick={() => pickMethod(m)}>
                  {p.method === m ? <Ic n="check" c="sm evck" /> : null}<Ic n={methodIcon(m)} c="lg" /><div><b>{m}</b></div>
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
            {isCredit ? null : (
              <div className="row wrap" style={{ gap: 10, marginTop: 16 }}>
                <button type="button" className="btn green" disabled={busy} onClick={ctl.handleAddPaymentClick}><Ic n="check" />רישום תשלום</button>
              </div>
            )}
          </Blk>
        </div>
        {hasPays ? (
          <div className="pay-side">
            <Blk>
            <SubH icon="list" tone="gold" title="תשלומים שנרשמו" />
            <div className="list">
              {ctl.paymentsList.map((x, i) => (
                <div className="li" key={i}>
                  <div className="ic-b"><Ic n={methodIcon(x.method || '')} /></div>
                  <div className="t"><b>{x.method}</b><small>{x.notes || ''}</small><div className="a">{money(x.amount)}</div></div>
                  {isChargedPayment(x)
                    ? <button type="button" className="ibtn" disabled data-tip="חיוב אשראי שכבר בוצע — לא ניתן להסרה" aria-label="הסר תשלום"><Ic n="lock" c="sm" /></button>
                    : <button type="button" className="ibtn" data-tip="הסר תשלום" aria-label="הסר תשלום" disabled={busy} onClick={() => ctl.removePayment(i)}><Ic n="trash" c="sm" /></button>}
                </div>
              ))}
            </div>
            </Blk>
          </div>
        ) : null}
      </div>
    </OneCard>
  );
}
