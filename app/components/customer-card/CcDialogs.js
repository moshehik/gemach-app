'use client';

// חלונות הכרטיס (העיצוב: summaryDlg / successDlg / discard / delete / pay-now ב-כרטיס-לקוח.html), תמיד כהים (dlg-dark על השורש).
// כל חלון הוא רכיב שמקבל close(result) מ-CcUi.openDialog. הטקסטים כמו בעיצוב; מה שהבעלים הסיר לא מופיע (הזמנה חדשה).

import { useMemo, useState } from 'react';
import CcIcon from './CcIcon';
import { DlgBadge, DlgBtn, DlgButtons, DlgHead, NO_FILL } from './CcUi';
import { paymentMethodIcon } from './customerCardLogic';

const money = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;

function ChangeRows({ changes }) {
  return (
    <div className="chg">
      {changes.map((c) => (
        <div className="c" key={c.key}>
          <div className="ico gray cc-cico"><CcIcon name={c.icon} size="sm" anim={false} /></div>
          <div className="t"><b>{c.label}</b> {c.verb}{c.note ? <div className="faint sm"><bdi>{c.note}</bdi></div> : null}</div>
        </div>
      ))}
    </div>
  );
}

// סיכום לפני שמירה (intent 'save') / שינויים שלא נשמרו ביציאה (intent 'exit') → 'save' | 'discard' | 'leave' | null
export function SummaryDialog({ intent = 'save', changes = [], close }) {
  const exit = intent === 'exit';
  return (
    <>
      <DlgHead title={exit ? 'שינויים שלא נשמרו' : 'סיכום'} badge="check" act="do-save" />
      <ChangeRows changes={changes} />
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" act="do-save" autoFocus onClick={() => close('save')}>שמור</DlgBtn>
        {exit
          ? <DlgBtn kind="plain" icon="x" act="leave-nosave" onClick={() => close('leave')}>צא בלי לשמור</DlgBtn>
          : <DlgBtn kind="plain" icon="undo" act="discard-close" onClick={() => close('discard')}>בטל שינויים</DlgBtn>}
        <DlgBtn kind="ghost" icon="pencil" act="close" onClick={() => close(null)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// "לבטל את כל השינויים?" → true | false
export function DiscardDialog({ count = 0, close }) {
  return (
    <>
      <DlgHead title="לבטל את כל השינויים?" sub={count === 1 ? 'שינוי אחד יימחק' : `${count} שינויים יימחקו`} badge="trash" />
      <DlgButtons>
        <DlgBtn kind="primary" icon="trash" act="discard-close" autoFocus onClick={() => close(true)}>בטל שינויים</DlgBtn>
        <DlgBtn kind="ghost" icon="back" act="close" onClick={() => close(false)}>חזרה לעריכה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// "הכרטיס נשמר" → 'print' | 'list' | null (המשך לצפות). בלי "הזמנה חדשה" (הבעלים: neword - לא להכניס).
export function SuccessDialog({ head = 'הכרטיס נשמר', sub = '', close }) {
  return (
    <div className="success">
      <div className="big-ck"><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.500 4.500 4.500L19 7.500" /></svg></div>
      <h2 id="cc-dlg-t">{head}</h2>
      <div className="sub cc-sub0">{sub}</div>
      <div className="cc-gap24" />
      <DlgButtons>
        <DlgBtn kind="primary" icon="file" act="close" autoFocus onClick={() => close(null)}>המשך לצפות בכרטיס</DlgBtn>
        <DlgBtn kind="plain" icon="print" act="print-done" onClick={() => close('print')}>הדפסת כרטיס</DlgBtn>
        <DlgBtn kind="ghost" icon="back" act="to-list" onClick={() => close('list')}>לרשימה</DlgBtn>
      </DlgButtons>
    </div>
  );
}

// מחיקת לקוחה → true | false. blockers: הזמנות פעילות / יתרת חוב (גם השרת בודק ומסרב).
export function DeleteDialog({ blockers = [], close }) {
  const blocked = blockers.length > 0;
  return (
    <>
      <DlgHead title="מחיקת לקוחה" badge="trash" sub={blocked ? 'לא ניתן למחוק את הכרטיס כרגע:' : 'הכרטיס יוסר מרשימת הלקוחות. הפעולה דורשת אישור מנהל.'} />
      {blocked ? (
        <div className="chg">
          {blockers.map((b) => (
            <div className="c" key={b}><div className="ico gray cc-cico"><CcIcon name="alert" size="sm" anim={false} /></div><div className="t">{b}</div></div>
          ))}
        </div>
      ) : null}
      <DlgButtons>
        <DlgBtn kind="primary" icon="trash" act="delete-go" disabled={blocked} autoFocus={!blocked} onClick={() => close(true)}>מחק לקוחה</DlgBtn>
        <DlgBtn kind="ghost" icon="back" act="close" autoFocus={blocked} onClick={() => close(false)}>חזרה</DlgBtn>
      </DlgButtons>
    </>
  );
}

// תשלום מכרטיס הלקוח (העיצוב: pay-now) → {orderId, amount, paymentMethod, notes} | null. התשלום נרשם על הזמנה מסוימת
// (POST /api/payments דורש orderId) - כשיש כמה הזמנות פתוחות בוחרים אחת (ברירת מחדל: זו שממנה נפתח החלון / הראשונה).
export function PaymentDialog({ charges = [], defaultOrderId, methods = ['מזומן'], close }) {
  const first = charges.find((c) => c.order.orderId === defaultOrderId) || charges[0];
  const [orderId, setOrderId] = useState(first ? first.order.orderId : null);
  const due = useMemo(() => (charges.find((c) => c.order.orderId === orderId) || {}).due || 0, [charges, orderId]);
  const [amount, setAmount] = useState(first ? String(first.due) : '');
  const [method, setMethod] = useState(methods[0] || 'מזומן');
  const [err, setErr] = useState('');
  const pickOrder = (id) => { setOrderId(id); const c = charges.find((x) => x.order.orderId === id); if (c) setAmount(String(c.due)); };
  const submit = () => {
    const n = parseFloat(amount);
    if (!orderId) { setErr('יש לבחור הזמנה'); return; }
    if (!n || n <= 0) { setErr('יש להזין סכום חיובי לתשלום'); return; }
    close({ orderId, amount: n, paymentMethod: method, notes: '' });
  };
  return (
    <>
      <DlgBadge icon="card" />
      <h2 id="cc-dlg-t">תשלום</h2>
      <div className="sub">{charges.length > 1 ? 'בחירת הזמנה וסכום' : `יתרת חוב בהזמנה #${orderId}`}</div>
      {charges.length > 1 ? (
        <div className="dbtns cc-emps cc-payorders" role="listbox" aria-label="הזמנה">
          {charges.map((c) => {
            const on = c.order.orderId === orderId;
            return (
              <button key={c.order.orderId} type="button" role="option" aria-selected={on} className={`opt${on ? ' on' : ''}`} onClick={() => pickOrder(c.order.orderId)}>
                <CcIcon name="file" size="lg" />
                <div><b>הזמנה <bdi>#{c.order.orderId}</bdi></b><small>נשאר לתשלום {money(c.due)}</small></div>
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="amtin"><span>₪</span><input id="payAmt" type="number" inputMode="decimal" aria-label="סכום" value={amount} data-autofocus="true" onChange={(e) => { setAmount(e.target.value); setErr(''); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} {...NO_FILL} /></div>
      {due && parseFloat(amount) > due ? <div className="faint cc-payhint">הסכום גבוה מהיתרה בהזמנה ({money(due)})</div> : null}
      <div className="methods">
        {methods.map((m) => (
          <button key={m} type="button" data-method={m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}><CcIcon name={paymentMethodIcon(m)} size="lg" />{m}</button>
        ))}
      </div>
      <div className="amsg" aria-live="polite">{err ? <><CcIcon name="alert" size="sm" />{err}</> : null}</div>
      <DlgButtons>
        <DlgBtn kind="green" icon="check" act="confirm-pay-only" onClick={submit}>אישור תשלום</DlgBtn>
        <DlgBtn kind="ghost" icon="back" act="close" onClick={() => close(null)}>חזרה</DlgBtn>
      </DlgButtons>
    </>
  );
}
