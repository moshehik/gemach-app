'use client';

// מסילת "סיכום" (העיצוב: _renderRail): שבבי "במבט" (חתימה, הזמנות, מצב תשלום, פרטים) עם כרטיסי ריחוף עשירים, ורשימת "שינויים
// בכרטיס" עם ביטול לשדה, "החזר ביטול" ומונה; למטה "שמור" + "בטל שינויים" (M1 = "שמירת שינויים"/"ביטול שינויים" של הישן), או
// "שלם ₪" כשאין שינויים ויש חוב. זו הדרך היחידה לשמור את הכרטיס (בלי כפתור שמירה בתחתית הטופס - הבעלים save2).

import { useEffect, useRef, useState } from 'react';
import CcIcon from './CcIcon';
import { signatureState } from './customerCardLogic';
import { missingRequiredFields } from '@/lib/customerRequiredFields';

const money = (n) => `₪${Math.abs(Number(n) || 0).toLocaleString('he-IL')}`;
const ordersText = (n) => (n === 1 ? 'הזמנה אחת' : `${n} הזמנות`);

export default function CcRail({ cc, open, setOpen }) {
  const { cur, changes, dirty, account } = cc;
  const prevKeys = useRef(new Set());
  const [leaving, setLeaving] = useState(null);
  const prevCount = useRef(changes.length);
  const [bump, setBump] = useState(false);
  useEffect(() => {
    if (changes.length > prevCount.current) { setBump(true); const t = setTimeout(() => setBump(false), 600); prevCount.current = changes.length; return () => clearTimeout(t); }
    prevCount.current = changes.length;
    return undefined;
  }, [changes.length]);
  const fresh = new Set(changes.map((c) => c.key).filter((k) => !prevKeys.current.has(k)));
  useEffect(() => { prevKeys.current = new Set(changes.map((c) => c.key)); });

  const sig = signatureState(cur);
  const nOrd = (cur.orders || []).length;
  const bal = account.balance;
  const pc = bal > 0 ? 'debt' : bal < 0 ? 'cred' : 'ok';
  const pv = bal > 0 ? `חוב ${money(bal)}` : bal < 0 ? `זיכוי ${money(bal)}` : 'שולם';
  const miss = missingRequiredFields(cur, cc.requiredKeys);
  const canPay = !dirty && bal > 0 && cc.charges.length > 0;

  const undo = (key, field) => {
    setLeaving(key);
    setTimeout(() => { setLeaving(null); cc.undo(field); }, 220);
  };

  return (
    <div className="rcard cart">
      <div className="sec-h"><CcIcon name="list" size="sm" /><span>סיכום</span></div>
      <div className="glance">
        <span className={`gl sig ${sig.signed ? 'yes' : 'no'}`} tabIndex={0} data-rich="sig" aria-label={`${sig.signed ? 'חתום' : 'לא חתום'} - חתימה על תקנון`}><CcIcon name={sig.signed ? 'check' : 'x'} anim={false} /><span className="gv">{sig.signed ? 'חתום' : 'לא חתום'}</span></span>
        <span className="gl itm-c" tabIndex={0} data-rich="orders" aria-label={ordersText(nOrd)}><CcIcon name="file" anim={false} /><span className="gv">{ordersText(nOrd)}</span></span>
        <span className={`gl pay ${pc}`} tabIndex={0} data-rich="pay" aria-label="מצב תשלום"><CcIcon name="card" anim={false} /><span className="gv"><bdi dir="ltr">{pv}</bdi></span></span>
        <span className={`gl det${miss.length ? ' no' : ''}`} tabIndex={0} data-rich="det" aria-label="פרטי קשר"><CcIcon name={miss.length ? 'alert' : 'check'} anim={false} /><span className="gv">{miss.length ? `חסרים ${miss.length}` : 'פרטים מלאים'}</span></span>
      </div>
      <div className="cart-h">
        <button type="button" className={`cart-t${bump ? ' bump' : ''}`} data-act="cart-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <CcIcon name="cart" size="sm" anim={false} /><b>שינויים בכרטיס</b><span className="badge">{changes.length}</span><span className="cart-sum" /><CcIcon name="chev" size="sm" anim={false} />
        </button>
        {cc.redoCount ? (
          <button type="button" className="redo" data-act="redo" data-tip="החזר ביטול" aria-label="החזר ביטול" onClick={cc.redo}><CcIcon name="redo" size="sm" />{cc.redoCount > 1 ? <i>{cc.redoCount}</i> : null}</button>
        ) : null}
      </div>
      <div className="cart-body">
        <div className="cart-list">
          {changes.length ? changes.map((c) => (
            <div key={c.key} className={`cl${fresh.has(c.key) ? ' enter' : ''}${leaving === c.key ? ' leaving' : ''}`} data-key={c.key} data-rich={`chg|${c.key}`} tabIndex={0}>
              <div className="cl-i"><CcIcon name={c.icon} anim={false} /></div>
              <div className="cl-t"><span><b>{c.label}</b> {c.verb}</span><small><bdi>{c.note}</bdi></small></div>
              <button type="button" className="cl-u" data-act="undo" data-k={c.key} aria-label="ביטול השינוי" data-tip="ביטול" onClick={() => undo(c.key, c.field)}><CcIcon name="bk" size="sm" /></button>
            </div>
          )) : (
            <div className="cart-empty"><CcIcon name="check" size="lg" anim={false} /><span>אין שינויים</span></div>
          )}
        </div>
      </div>
      {dirty ? (
        <div className="cart-actions">
          <button type="button" className="btn primary lg block" data-act="save" disabled={cc.saving} onClick={() => cc.save()}><CcIcon name="check" />{cc.saving ? 'שומר…' : 'שמור'}</button>
          <button type="button" className="btn ghost block sec" data-act="discard" onClick={cc.discardAll}><CcIcon name="undo" size="sm" />בטל שינויים</button>
        </div>
      ) : canPay ? (
        <div className="cart-actions">
          <button type="button" className="btn primary lg block" data-act="pay-now" onClick={() => cc.pay()}><CcIcon name="card" />שלם <bdi dir="ltr">{money(bal)}</bdi></button>
        </div>
      ) : null}
    </div>
  );
}
