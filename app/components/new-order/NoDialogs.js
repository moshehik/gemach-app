'use client';

// החלונות של אשף "הזמנה חדשה" (A5): כולם #dlg / #dlg2 של הפלטה בתוך .scrim, כהים (Q2 = "כהים" - השורש נושא dlg-dark),
// ב-portal לשורש הדף. ה-markup כמו openDlg/pinDlg/confirmDlg/... בעיצוב (h2, .sub, .mfld, .dbtns, .success, .chg).
// אף חלון כאן לא משתמש ב-window.alert / confirm / customConfirm / customAuthPrompt.
import { useEffect, useId, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { Ic, Note, NO_FILL } from './NoUi';
import { isCardNumberComplete, isExpiryComplete, justCompleted, focusField } from '@/lib/autoAdvance';
import { getCustomerFullName, getMissingMandatoryCustomerFields, CUSTOMER_FIELD_LABELS, cardNumberInput, tokefInput, parseSwipe, plural, moneyTxt } from './newOrderLogic';
import { parseFieldGroups, unsatisfiedFieldGroupShortLabels } from '@/lib/customerValidation';

// ---------- מסגרת ----------
// D7 (נגישות): aria-labelledby לכותרת החלון (ה-h1/h2/h3 הראשון בתוכו), מלכודת פוקוס (Tab / Shift+Tab נשארים בתוך החלון)
// והחזרת הפוקוס לאלמנט שפתח את החלון כשהוא נסגר.
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
export function DialogFrame({ layer, cls, onBackdrop, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const f = el.querySelector('[data-autofocus]') || el.querySelector('input:not([type=hidden]):not([disabled]),select,textarea,button:not([disabled])');
      if (f) f.focus();
    }, 40);
    return () => {
      clearTimeout(t);
      if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, []);
  useEffect(() => { // כותרת החלון יכולה להיטען אחרי הרינדור הראשון - מעדכנים בכל רינדור (זול)
    const el = ref.current;
    if (!el) return;
    const h = el.querySelector('h1,h2,h3');
    if (h) { if (!h.id) h.id = titleId; el.setAttribute('aria-labelledby', h.id); } else el.removeAttribute('aria-labelledby');
  });
  const onKeyDown = (e) => {
    if (e.key !== 'Tab') return;
    const el = ref.current;
    if (!el) return;
    const items = [...el.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!items.length) { e.preventDefault(); el.focus(); return; }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    const inside = el.contains(active);
    if (e.shiftKey && (!inside || active === first || active === el)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus(); }
  };
  const n = layer === 2 ? '2' : '';
  return (
    <div className="scrim on" id={`scrim${n}`} onMouseDown={(e) => { if (e.target === e.currentTarget && onBackdrop) onBackdrop(); }}>
      <div className={`dlg${cls ? ` ${cls}` : ''}`} id={`dlg${n}`} role="dialog" aria-modal="true" tabIndex={-1} onKeyDown={onKeyDown} ref={ref}>{children}</div>
    </div>
  );
}

const Btns = ({ children, style }) => <div className="dbtns" style={{ marginTop: 20, ...style }}>{children}</div>;
const lines = (s) => String(s || '').split('\n').map((l, i, a) => <span key={i}>{l}{i < a.length - 1 ? <br /> : null}</span>);

// ---------- אישור הרשאה (pinDlg בעיצוב; R37: רשימת המאשרים לפי הרשאה, המשתמש המחובר נבחר מראש, הבדיקה בשרת) ----------
// אותה הכרעה כמו customAuthPrompt (app/components/PopupProvider.js): רמות קבועות לפי roleId, ו-feature:* לפי approvals[key]
// שמחושב בשרת (GET /api/employees) באותה הכרעה ש-verify-pin אוכף.
export function filterApprovers(all, requiredLevel) {
  let employees = Array.isArray(all) ? all : [];
  if (requiredLevel === 'מנהל') employees = employees.filter(e => e.roleId === 1 || e.roleId === 2);
  else if (requiredLevel === 'מתכנת') employees = employees.filter(e => e.roleId === 2);
  else if (requiredLevel === 'הנהלה ראשית') employees = employees.filter(e => e.roleId === 0 || e.roleId === 2);
  else if (requiredLevel === 'מנהל סניף ומעלה') employees = employees.filter(e => e.roleId === 0 || e.roleId === 1 || e.roleId === 2);
  else if (typeof requiredLevel === 'string' && requiredLevel.startsWith('feature:')) employees = employees.filter(e => e.approvals && e.approvals[requiredLevel]);
  return employees;
}
const levelNoun = (lvl) => (lvl === 'הנהלה ראשית' ? 'הנהלה ראשית' : 'מאשר');

export function ApprovalDialog({ message, level, close, fetchImpl }) {
  const [emps, setEmps] = useState(null);
  const [sel, setSel] = useState('');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let off = false;
    Promise.all([
      fetchSharedJson('/api/employees?slim=1', { ttl: TTL.STATIC }).catch(() => []),
      fetchSharedJson('/api/me', { ttl: TTL.STATIC }).catch(() => null),
    ]).then(([all, me]) => {
      if (off) return;
      const list = filterApprovers(all, level);
      setEmps(list);
      const cur = me && me.success ? me.employee : null;
      // כמו customAuthPrompt בישן: המשתמש המחובר נבחר מראש רק אם הוא עצמו מאשר; אחרת הבחירה נשארת ריקה (לא המאשר הראשון ברשימה)
      if (cur && list.some(e => e.id === cur.id)) setSel(String(cur.id));
    });
    return () => { off = true; };
  }, [level]);
  const submit = async () => {
    if (busy) return;
    if (!sel) { setErr(emps && emps.length ? 'יש לבחור מאשר.' : 'אין עובד מורשה לבחירה.'); return; }
    if (!code) { setErr('יש להזין סיסמה.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await (fetchImpl || fetch)('/api/auth/verify-pin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: code, employeeId: sel, requiredLevel: level })
      });
      const data = await res.json();
      if (!data.success) { setErr(data.error || 'סיסמה שגויה או הרשאה לא מספקת.'); setCode(''); setBusy(false); return; }
      close({ pin: code, employeeId: sel });
    } catch {
      setErr('שגיאה באימות מול השרת.'); setBusy(false);
    }
  };
  const noun = levelNoun(level);
  return (
    <>
      <h2>אימות הרשאה</h2>
      <div className="sub">{lines(message)}</div>
      <div className="mfld">
        <label className="lbl with-ic" htmlFor="noPinWho"><Ic n="user" c="sm" />בחר {noun}</label>
        <div className="inpw">
          <select className="inp" id="noPinWho" value={sel} onChange={(e) => setSel(e.target.value)} disabled={emps === null || emps.length === 0}>
            {emps === null ? <option value="">טוען רשימת עובדים...</option> : emps.length === 0 ? <option value="">אין עובדים מורשים לפי מסך ההרשאות</option>
              : [<option key="" value="">{`בחר ${noun}...`}</option>, ...emps.map(e => <option key={e.id} value={String(e.id)}>{`${e.firstName || ''} ${e.lastName || ''}`.trim()}</option>)]}
          </select>
        </div>
      </div>
      <div className="mfld" style={{ marginTop: 12 }}>
        <label className="lbl with-ic" htmlFor="noPinCode"><Ic n="lock" c="sm" />סיסמת {noun}</label>
        <div className="inpw">
          <input className="inp" id="noPinCode" type="password" dir="ltr" placeholder="הקלד סיסמה..." autoComplete="new-password" name="no-pin-nofill" {...NO_FILL}
            value={code} data-autofocus="true" onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }} />
        </div>
      </div>
      {err ? <Note style={{ marginTop: 12 }}>{err}</Note> : null}
      <Btns>
        <button type="button" className="btn primary lg block" disabled={busy} onClick={submit}><Ic n="check" />אישור</button>
        <button type="button" className="btn ghost block" onClick={() => close(null)}><Ic n="back" c="sm" />ביטול</button>
      </Btns>
    </>
  );
}

// ---------- אישור כללי / הודעה ----------
export function ConfirmDialog({ title = 'אישור פעולה', message, ok = 'אישור', cancel = 'ביטול', close }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="sub">{lines(message)}</div>
      <Btns>
        <button type="button" className="btn primary lg block" onClick={() => close(true)}><Ic n="check" />{ok}</button>
        <button type="button" className="btn ghost block" onClick={() => close(false)}><Ic n="x" c="sm" />{cancel}</button>
      </Btns>
    </>
  );
}
export function MessageDialog({ title, message, body, close }) {
  return (
    <>
      <h2>{title}</h2>
      <div className="sub">{lines(message)}</div>
      {body}
      <Btns><button type="button" className="btn ghost block" onClick={() => close()}><Ic n="x" c="sm" />סגירה</button></Btns>
    </>
  );
}

// R13 + Q5: שינוי תאריך / ציפוף בלי מלאי - חלון עם פירוט החוסר; השינוי נחסם (התאריך נשאר)
export function StockShortageDialog({ title, intro, rows, spacingNote, close }) {
  return (
    <MessageDialog title={title} message={intro} close={close} body={(
      <>
        <div className="list" style={{ marginTop: 12 }}>
          {rows.map((r, i) => (
            <div className="li" key={i}><div className="ic-b"><Ic n="dress" /></div><div className="t"><b>{r.dressName} (מידה {r.sizeText})</b><small>חסרים {r.missing} במלאי{r.spacing ? ' (בגלל ציפוף)' : ''}</small></div></div>
          ))}
        </div>
        {spacingNote ? <div className="muted sm" style={{ marginTop: 12 }}>{spacingNote}</div> : null}
      </>
    )} />
  );
}

// R02: מגן "אחורה" בדפדפן (במקום window.confirm) - אותו נוסח
export function BackGuardDialog({ close }) {
  return (
    <>
      <h2>יש נתונים שלא נשמרו</h2>
      <div className="sub">יש נתונים שהוזנו בהזמנה ועדיין לא נשמרו. לצאת בכל זאת ולאבד אותם?</div>
      <Btns>
        <button type="button" className="btn primary lg block" onClick={() => close(false)}><Ic n="pencil" c="sm" />הישאר בהזמנה</button>
        <button type="button" className="btn block" onClick={() => close(true)}><Ic n="x" c="sm" />לצאת בכל זאת</button>
      </Btns>
    </>
  );
}

// יציאה מההזמנה (כפתור היציאה / "ביטול")
export function ExitDialog({ draftOrderId, itemsCount, close }) {
  return (
    <>
      <h2>יציאה מההזמנה</h2>
      <div className="sub">{draftOrderId
        ? `ההזמנה שמורה כטיוטה #${draftOrderId} עם ${itemsCount} פריטים, ואפשר להמשיך אותה מרשימת ההזמנות.`
        : 'ההזמנה עדיין לא נשמרה. יציאה עכשיו תמחק את מה שהוזן במסך.'}</div>
      <Btns>
        <button type="button" className="btn primary lg block" onClick={() => close(false)}><Ic n="pencil" c="sm" />המשך בהזמנה</button>
        <button type="button" className="btn block" onClick={() => close(true)}><Ic n="x" c="sm" />{draftOrderId ? 'צא — הטיוטה נשמרה' : 'צא בלי לשמור'}</button>
      </Btns>
    </>
  );
}

// "רגע, בדקת מלאי?" (ציפוף מיוחד)
export function SpacingDialog({ close }) {
  return (
    <>
      <h2>רגע, בדקת מלאי?</h2>
      <div className="sub">ציפוף מיוחד משפיע על בדיקת המלאי להזמנה זו בלבד, ומסמן את ההזמנה לאישור מנהל.</div>
      <Btns>
        <button type="button" className="btn block" onClick={() => close('search')}><Ic n="search" c="sm" />פתח חיפוש תפוסה מהיר</button>
        <button type="button" className="btn primary lg block" onClick={() => close('yes')}><Ic n="check" />כן, המשך</button>
        <button type="button" className="btn ghost block" onClick={() => close(null)}><Ic n="x" c="sm" />ביטול</button>
      </Btns>
    </>
  );
}

// לקוח קיים לפי טלפון (חלון "לקוח קיים במערכת")
export function DuplicateCustomerDialog({ customers, settings, onUse, onCreate, close }) {
  const groups = parseFieldGroups(settings.mandatory_field_groups);
  return (
    <>
      <h2>{customers.length > 1 ? 'כמה לקוחות עם מספר טלפון זה' : 'לקוח קיים במערכת'}</h2>
      <div className="sub">{customers.length > 1
        ? 'נמצאו כמה לקוחות עם מספר הטלפון שהוזן. אפשר להשתמש באחד מהכרטיסים הקיימים, או ליצור כרטיס נוסף.'
        : 'הלקוח שהוזן זוהה במערכת לפי מספר הטלפון. אפשר להשתמש בכרטיס הקיים, או ליצור כרטיס נוסף.'}</div>
      <div className="chg">
        {customers.map(c => {
          const missing = [...getMissingMandatoryCustomerFields(settings, c).map(k => CUSTOMER_FIELD_LABELS[k]), ...unsatisfiedFieldGroupShortLabels(c, groups)];
          return (
            <div className="c" key={c.id}>
              <div className="ico rose no-chg-ico"><Ic n="user" c="sm" /></div>
              <div className="t">
                <b>{getCustomerFullName(c)}</b>{c.isBlocked ? <> <span className="chip red">לקוח חסום</span></> : null}
                <div className="faint sm">טלפון: <bdi>{c.phone1}{c.phone2 ? ` | ${c.phone2}` : ''}</bdi> · עיר: {c.city || 'לא צוינה'}</div>
                {missing.length ? <div className="faint sm">חסר ללקוח: {missing.join(', ')}. <a href={`/customers/${c.id}`} target="_blank" rel="noreferrer" className="lnk">עריכת פרטי לקוח</a></div> : null}
                <div style={{ marginTop: 8 }}><button type="button" className="btn sm" onClick={() => onUse(c)}><Ic n="check" c="sm" />השתמש בלקוח הזה</button></div>
              </div>
            </div>
          );
        })}
      </div>
      <Btns style={{ marginTop: 16 }}>
        <button type="button" className="btn block" onClick={onCreate}><Ic n="plus" c="sm" />צור לקוח חדש בכל זאת</button>
        <button type="button" className="btn ghost block" onClick={() => close()}><Ic n="x" c="sm" />ביטול</button>
      </Btns>
    </>
  );
}

// "הזמנה זו כבר נשמרה" (409 duplicateOrder)
export function DuplicateOrderDialog({ existingOrderId, close }) {
  return (
    <>
      <h2>הזמנה זו כבר נשמרה</h2>
      <div className="sub">כבר קיימת הזמנה שמורה עבור אותו לקוח ואותו תאריך — הזמנה מס&apos; {existingOrderId}. כדאי לבדוק אותה לפני שממשיכים, כדי לא ליצור הזמנה כפולה.</div>
      <div style={{ margin: '14px 0' }}><a href={`/orders/${existingOrderId}`} target="_blank" rel="noopener noreferrer" className="lnk">פתח את הזמנה #{existingOrderId} <Ic n="ext" c="sm" /></a></div>
      <div className="dbtns">
        <button type="button" className="btn primary lg block" onClick={() => close(true)}><Ic n="check" />שמור בכל זאת כהזמנה נפרדת</button>
        <button type="button" className="btn ghost block" onClick={() => close(false)}><Ic n="eye" c="sm" />אבדוק את הקיימת</button>
      </div>
    </>
  );
}

// ---------- חיוב אשראי (נדרים פלוס) - R28: השגיאה בתוך החלון ----------
export function CreditDialog({ data, setData, error, processing, onCharge, onSwipe, close, autoAdvance = false }) {
  // Enter בכל שדה = "בצע חיוב" (כמו ה-form בישן)
  const onKeyDown = (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && !processing) { e.preventDefault(); onCharge(); } };
  return (
    <>
      <h2>חיוב באשראי (נדרים פלוס)</h2>
      <div className="sub">ההזמנה תישמר מיד לאחר אישור החיוב</div>
      <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 8 }}>
        <button type="button" className="btn sm" data-tip="העברת כרטיס מהירה בקורא מגנטי" onClick={onSwipe} disabled={processing}><Ic n="scan" c="sm" />העברה מהירה</button>
      </div>
      {error ? <Note style={{ marginBottom: 12 }}>{error}</Note> : null}
        <div className="mfld">
          <label className="lbl with-ic" htmlFor="noCcNum"><Ic n="card" c="sm" />מספר כרטיס אשראי (או העברה בקורא)</label>
          <div className="inpw"><input className="inp" id="noCcNum" onKeyDown={onKeyDown} dir="ltr" inputMode="numeric" placeholder="0000 0000 0000 0000" autoComplete="cc-number" maxLength={19}
            value={data.cardNumber} data-autofocus="true" onChange={(e) => { const v = cardNumberInput(e.target.value, data.tokef); setData(p => ({ ...p, ...v })); if (autoAdvance && justCompleted(isCardNumberComplete, data.cardNumber, v.cardNumber)) focusField('noCcExp'); }} /></div>
        </div>
        <div className="grid2" style={{ marginTop: 12 }}>
          <div className="mfld">
            <label className="lbl with-ic" htmlFor="noCcExp"><Ic n="cal" c="sm" />תוקף (MM/YY)</label>
            <div className="inpw"><input className="inp" id="noCcExp" onKeyDown={onKeyDown} dir="ltr" placeholder="12/25" autoComplete="cc-exp" maxLength={5} value={data.tokef} onChange={(e) => { const t = tokefInput(e.target.value); setData(p => ({ ...p, tokef: t })); if (autoAdvance && justCompleted(isExpiryComplete, data.tokef, t)) focusField('noCcAmt'); }} /></div>
          </div>
          <div className="mfld">
            <label className="lbl with-ic" htmlFor="noCcAmt"><Ic n="wallet" c="sm" />סכום לחיוב (₪)</label>
            <div className="inpw"><input className="inp" id="noCcAmt" onKeyDown={onKeyDown} type="number" dir="ltr" value={data.amount} onChange={(e) => setData(p => ({ ...p, amount: e.target.value }))} /></div>
          </div>
          <div className="mfld">
            <label className="lbl with-ic" htmlFor="noCcInst"><Ic n="list" c="sm" />תשלומים</label>
            <div className="inpw"><input className="inp" id="noCcInst" onKeyDown={onKeyDown} type="number" dir="ltr" min="1" max="12" value={data.installments} onChange={(e) => setData(p => ({ ...p, installments: e.target.value }))} /></div>
          </div>
          <div className="mfld">
            <label className="lbl with-ic" htmlFor="noCcNote"><Ic n="note" c="sm" />הערות לנדרים</label>
            <div className="inpw"><input className="inp" id="noCcNote" onKeyDown={onKeyDown} value={data.notes} onChange={(e) => setData(p => ({ ...p, notes: e.target.value }))} /></div>
          </div>
        </div>
      <Btns>
        <button type="button" onClick={onCharge} className="btn green lg block" disabled={processing} aria-busy={processing}><Ic n="check" />{processing ? 'מבצע חיוב...' : 'בצע חיוב ושמור הזמנה'}</button>
        <button type="button" className="btn ghost block" onClick={() => close()} disabled={processing}><Ic n="x" c="sm" />ביטול</button>
      </Btns>
    </>
  );
}

// העברת כרטיס מהירה: שדה נסתר שקולט את הקורא המגנטי (כמו בישן)
export function SwipeDialog({ onCard, close }) {
  const [v, setV] = useState('');
  const ref = useRef(null);
  return (
    <>
      <h2>העברת כרטיס מהירה</h2>
      <div className="sub">אנא העבר כעת את כרטיס האשראי בקורא המגנטי. פרטי הכרטיס ייקלטו אוטומטית.</div>
      <input ref={ref} data-autofocus="true" type="text" value={v} aria-label="קלט קורא כרטיסים" className="no-swipe-in" autoComplete="off" {...NO_FILL}
        onChange={(e) => { setV(e.target.value); const c = parseSwipe(e.target.value); if (c) onCard(c); }}
        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
        onBlur={(e) => { const t = e.target; setTimeout(() => t && t.isConnected && t.focus(), 100); }} />
      <Btns><button type="button" className="btn ghost block" onClick={() => close()}><Ic n="x" c="sm" />ביטול</button></Btns>
    </>
  );
}

// חסימת המסך בזמן חיוב/שמירה
export function BusyDialog({ title, sub }) {
  return (
    <div className="success" role="alert" aria-busy="true"><div className="big-ck no-spin"><Ic n="refresh" /></div><h2>{title}</h2><div className="sub">{sub}</div></div>
  );
}

// S08 (להכניס): "ההזמנה נשמרה" עם צ'יפים וארבעה כפתורים; R35: צ'יפים של מייל האישור ורשימת התפוצה (לפי ההגדרות ומייל הלקוחה)
export function SuccessDialog({ orderId, customerName, dateLabel, chips, targetLabel, onNew, onPrint, onTarget, close }) {
  return (
    <div className="success">
      <div className="big-ck"><svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg></div>
      <h2>ההזמנה נשמרה</h2>
      <div className="sub" style={{ marginBottom: 0 }}>הזמנה #{orderId} · {customerName}{dateLabel ? ` · ${dateLabel}` : ''}</div>
      <div className="sc">{chips.map(c => <span key={c.t} className={`chip ${c.tone}`}><Ic n={c.i} />{c.t}</span>)}</div>
      <div className="dbtns">
        <button type="button" className="btn primary lg block" onClick={onNew}><Ic n="plus" />הזמנה חדשה</button>
        <button type="button" className="btn block" onClick={onPrint}><Ic n="print" c="sm" />הדפסה</button>
        <button type="button" className="btn ghost block" onClick={onTarget}><Ic n="file" c="sm" />{targetLabel}</button>
        <button type="button" className="btn ghost block" onClick={() => close()}><Ic n="eye" c="sm" />המשך לצפות במסך</button>
      </div>
    </div>
  );
}

export function successChips({ itemsCount, isDelivery, deliveryDirection, balance, specialSpacing, settings, customerEmail }) {
  const hasMail = !!(customerEmail && String(customerEmail).includes('@'));
  return [
    { t: plural(itemsCount, 'פריט אחד', 'פריטים'), i: 'dress', tone: 'green' },
    isDelivery ? { t: `משלוח ${deliveryDirection}`, i: 'truck', tone: 'teal' } : null,
    { t: balance <= 0 ? 'שולם במלואו' : `יתרה ${moneyTxt(balance)}`, i: 'card', tone: 'gold' },
    specialSpacing ? { t: 'ציפוף לאישור מנהל', i: 'alert', tone: 'amber' } : null,
    settings.auto_email_on_order_create === 'true' && hasMail ? { t: 'נשלח מייל אישור', i: 'mail', tone: 'green' } : null,
    settings.mailing_list_auto_sync === 'true' && hasMail ? { t: 'נוספה לרשימת תפוצה', i: 'users', tone: 'teal' } : null,
  ].filter(Boolean);
}

