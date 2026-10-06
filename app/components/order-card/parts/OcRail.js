'use client';

// OcRail — הרייל "סיכום" של כרטיס ההזמנה החדש (A17/A18/R4): צ׳יפים (חתימה / משלוח / פריטים / תשלום), "שינויים בהזמנה" עם ביטול לכל שורה
// ו"החזר ביטול", סכומים (חיוב/זיכוי ממתין, לתשלום אחרי שמירה), והלחצנים: תשלום / זיכוי / שמור / שלם ₪N / זכה ₪N + "בטל שינויים".
// מוצג בתוך <aside class="rail" id="rail"> של OrderCardA5 (slot Rail). אין כאן לוגיקה עסקית: כל ההחלטות ב-ocRailLogic.js (נבדק ב-node), כל
// הכתיבות דרך הבקר (oc.save / oc.discardAll / oc.undoChange / oc.redo / oc.toggleSignature).
//
// חוזה עם W4 (REQUESTS-W4 "ל-W5"): שמירה שיצרה חוב חדש → הבקר שולח debtCreated ו-W4 פותח את חלון התשלום בעצמו - הרייל לא פותח חלון תשלום
// ולא D6 באותו רגע; חוב שהיה קודם → requestPayment('pay'); "שלם ₪N"/"זכה ₪N"/צ׳יפ הארנק → oc.goPayments() + בקשת תשלום (אירוע oc:pay-request).
// "השאר חוב (באישור מנהל)" קיים רק בחלון התשלום (A18) - לא כאן, וגם אין שורת אזהרת חוב מתחת ללחצנים (AMB-05, החלטת בעלים).
//
// מפת פורט: _renderRail/renderRail/fx בעיצוב (תצוגות-עיצוב/כרטיס-הזמנה.html); הצ׳יפ "משלוח" (gl del) כשיש משלוח; סמני "enter"/"leaving"/"bump"/"pop"
// של האנימציות; ב-375 הרייל הוא גיליון תחתון (.rail.open נקבע ע"י לחצן "שינויים בהזמנה").

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import { useOcEvent } from '../useOrderCardController';
import { Money, Emph } from '../dialogs/ocDialogParts';
import OcSuccessDialog from '../dialogs/OcSuccessDialog';
import {
  displayLine, iconClass, railPrimary, railShowActions, payChip, cartTotals, cartSum, successHead, successTargets, printUrl,
  createRailActions, requestPaymentEvent, OC_PAYMENT_DONE_EVENT, OC_RAIL_PRIMARY_EVENT,
} from './ocRailLogic';

const UNDO_LEAVE_MS = 220;

function customerNameOf(order) {
  const c = order && order.customer;
  return c ? [c.firstName, c.lastName].filter(Boolean).join(' ') : '';
}

export default function OcRail({ oc, ui }) {
  const rootRef = useRef(null);
  const ocRef = useRef(oc);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(null);
  const [sessionPays, setSessionPays] = useState([]);
  const [sheet, setSheet] = useState(false); // מתחת ל-1024px הרייל הוא גיליון תחתון (נפתח/נסגר); מעליו תמיד פתוח
  const leavingRef = useRef(false);
  useLayoutEffect(() => { ocRef.current = oc; });
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(max-width:1023px)');
    const sync = () => setSheet(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  // D6 - אחרי שמירה (R10). היעד הראשי לפי order_edit_redirect_screen (R44); "הדפסה" פותחת את /print/order (נרשם ע"י הדף עצמו - R9)
  const showSuccess = useCallback(async ({ kind, amount, method }) => {
    const cur = ocRef.current;
    const order = cur.order || {};
    const targets = successTargets(cur.settings.orderEditRedirectScreen, { customerId: order.customerId });
    const choice = await ui.openDialog(OcSuccessDialog, {
      head: successHead({ kind, amount, method }), orderId: order.orderId, customerName: customerNameOf(order), targets,
    }, { badge: false, labelledBy: 'oc-dlg-t' });
    if (choice === 'nav' && targets.primary.href) await ocRef.current.exit(targets.primary.href);
    else if (choice === 'print' && typeof window !== 'undefined') window.open(printUrl(order.orderId), '_blank', 'noopener');
  }, [ui]);

  // getOc/showSuccess קוראים את ocRef רק בתוך handler / אירוע (אף פעם לא ברינדור); הקומפיילר של React לא יודע לראות את זה דרך createRailActions
  // eslint-disable-next-line react-hooks/refs
  const actions = useMemo(() => createRailActions({
    getOc: () => ocRef.current,
    requestPayment: requestPaymentEvent,
    showSuccess,
  }), [showSuccess]);

  // אירועים: תשלום שהתקבל (W4), הלחצן הראשי (הטוסט "לשמירה"), השארת חוב (debtApproved - REQUESTS-W5 #1)
  useEffect(() => {
    const onPaid = (e) => {
      const d = (e && e.detail) || {};
      actions.paymentDone(d);
      if (d.persisted) setSessionPays((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, method: d.method || 'תשלום', amount: Number(d.amount) || 0 }]);
    };
    const onPrimary = () => { actions.primary(); };
    window.addEventListener(OC_PAYMENT_DONE_EVENT, onPaid);
    window.addEventListener(OC_RAIL_PRIMARY_EVENT, onPrimary);
    return () => { window.removeEventListener(OC_PAYMENT_DONE_EVENT, onPaid); window.removeEventListener(OC_RAIL_PRIMARY_EVENT, onPrimary); };
  }, [actions]);
  useOcEvent(oc, 'debtApproved', (p) => { actions.debtLeft(p || {}); });
  // עריכה חדשה אחרי השמירה - תשלום מאוחר יותר כבר לא "נשמר ושולם" של אותה שמירה
  useEffect(() => { if (oc.dirty) actions.clearPending(); }, [oc.dirty, actions]);

  // ב-375 הרייל הוא גיליון תחתון: .rail.open על ה-aside (בבעלות OrderCardA5) לפי לחצן "שינויים בהזמנה"
  useEffect(() => {
    const aside = rootRef.current && rootRef.current.closest('#rail');
    if (aside) aside.classList.toggle('open', open);
  }, [open]);
  // הגיליון התחתון (מתחת ל-1024px): Esc או לחיצה מחוץ לגיליון סוגרים אותו (a11y); החלונות והטוסט לא נחשבים "מחוץ"
  useEffect(() => {
    if (!open || !sheet) return undefined;
    const close = () => { setOpen(false); const t = rootRef.current && rootRef.current.querySelector('.cart-t'); if (t) t.focus(); };
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('#scrim.on, #scrim2.on')) close(); };
    const onDown = (e) => {
      const t = e.target;
      if (!t || !t.closest) return;
      if (t.closest('#rail, #scrim, #scrim2, #toast, .oc-portal')) return;
      setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, sheet]);

  const { totals, changes, dirty, order, items } = oc;
  const net = totals.pendingNet;
  const due = totals.balance;
  const saved = totals.savedBalance;
  const busy = !!oc.saving;
  const count = changes.length + sessionPays.length;
  const nAct = items.filter((i) => !i.isDeleted).length;
  const pr = railPrimary({ dirty, due, net, saved });
  const chip = payChip(saved);
  const rows = cartTotals({ net, saved });
  const sum = cartSum({ net, saved });
  const signed = !!(order && order.hasSignedRegulations);
  const showAct = railShowActions({ dirty, saved });

  // אנימציות קטנות (העיצוב: bump לספירה שעלתה, pop לשינוי מצב התשלום) - class זמני על ה-DOM, בלי state
  const prevCount = useRef(null);
  useEffect(() => {
    const el = rootRef.current && rootRef.current.querySelector('.cart-t');
    // כמו בעיצוב: ה-class קיים רק אחרי רינדור שהספירה בו עלתה; כל שינוי ספירה אחר מנקה אותו
    if (el) { el.classList.remove('bump'); if (prevCount.current !== null && count > prevCount.current) { void el.offsetWidth; el.classList.add('bump'); } }
    prevCount.current = count;
  }, [count]);
  const prevChip = useRef(null);
  useEffect(() => {
    const el = rootRef.current && rootRef.current.querySelector('.gl.pay');
    if (el) { el.classList.remove('pop'); if (prevChip.current !== null && prevChip.current !== chip.cls) { void el.offsetWidth; el.classList.add('pop'); } }
    prevChip.current = chip.cls;
  }, [chip.cls]);

  // לחיצה כפולה על ביטול: בזמן ש"הנעלמת" רצה מתעלמים (אחרת undoChange רץ פעמיים והאחרון מבטל שורה אחרת)
  const undo = (key) => {
    if (leavingRef.current) return;
    leavingRef.current = true;
    setLeaving(key);
    setTimeout(() => { leavingRef.current = false; setLeaving(null); undoFocusRef.current = true; ocRef.current.undoChange(key); }, UNDO_LEAVE_MS);
  };
  // C4: אחרי ביטול שורה (גם יחיד) השורה - והלחצן שהיה בפוקוס - נעלמת והמיקוד נופל ל-body: עובר ללחצן הביטול של השורה הבאה, ואם אין - ל"שינויים בהזמנה"
  const undoFocusRef = useRef(false);
  useEffect(() => {
    if (!undoFocusRef.current) return;
    undoFocusRef.current = false;
    const ae = document.activeElement;
    if (ae && ae !== document.body && ae.isConnected !== false && !(rootRef.current && rootRef.current.contains(ae) && ae.closest('.cl.leaving'))) return;
    const root = rootRef.current;
    const next = root && root.querySelector('.cart-list .cl-u:not([disabled])');
    const target = next || (root && root.querySelector('.cart-t'));
    if (target) target.focus();
  }, [changes, count]);

  // הלחצן הראשי נעלם אחרי שמירה (אין שינויים) - המיקוד לא הולך לאיבוד אל ה-body: עובר ללחצן "שינויים בהזמנה"
  const hadPrimary = useRef(false);
  useEffect(() => {
    const has = pr.kind !== 'none' && showAct;
    if (hadPrimary.current && !has) {
      const ae = document.activeElement;
      if (!ae || ae === document.body) { const t = rootRef.current && rootRef.current.querySelector('.cart-t'); if (t) t.focus(); }
    }
    hadPrimary.current = has;
  }, [pr.kind, showAct]);

  const primaryBtn = pr.kind === 'none' ? null : (
    <button type="button" className="btn primary lg block" data-act={pr.kind === 'pay-now' ? 'pay-now' : pr.kind === 'credit-now' ? 'credit-now' : 'save'} data-ico={pr.icon} disabled={busy} onClick={() => actions.primary()}>
      <OcIcon name={pr.icon} anim className={iconClass(pr.icon)} />{pr.text}{pr.amount ? <> <Money n={pr.amount} /></> : null}
    </button>
  );

  return (
    <div className="rcard cart" ref={rootRef}>
      <div className="sec-h"><OcIcon name="list" size="sm" /><span>סיכום</span></div>
      <div className="glance">
        <button type="button" className={`gl sig ${signed ? 'yes' : 'no'}`} data-act="sig" data-rich="sig" aria-label={`${signed ? 'חתום' : 'לא חתום'} - חתימה על תקנון`} onClick={() => oc.toggleSignature()}>
          <OcIcon name={signed ? 'check' : 'x'} /><span className="gv">{signed ? 'חתום' : 'לא חתום'}</span>
        </button>
        {order && order.isDelivery ? (
          <span className="gl del" role="img" tabIndex={0} data-rich="del" aria-label={`משלוח ${order.deliveryDirection || ''}`.trim()}><OcIcon name="truck" /><span className="gv">{order.deliveryDirection || 'משלוח'}</span></span>
        ) : null}
        <span className="gl itm-c" role="img" tabIndex={0} data-rich="items" aria-label={nAct === 1 ? 'פריט אחד' : `${nAct} פריטים`}><OcIcon name="dress" /><span className="gv">{nAct === 1 ? 'פריט אחד' : `${nAct} פריטים`}</span></span>
        <span className={`gl pay ${chip.cls}`} role="button" tabIndex={0} data-act="wallet" data-rich="pay" aria-label="מצב תשלום" onClick={() => actions.wallet()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); actions.wallet(); } }}>
          <OcIcon name="card" /><span className="gv">{chip.cls === 'ok' ? chip.label : <>{chip.label} <Money n={chip.amount} /></>}</span>
        </span>
      </div>
      <div className="cart-h">
        <button type="button" className="cart-t" data-act="cart-toggle" data-oc-focus-fallback="1" aria-expanded={sheet ? open : true} onClick={() => setOpen((v) => !v)}>
          <OcIcon name="cart" size="sm" /><b>שינויים בהזמנה</b><span className="badge">{count}</span>
          <span className="cart-sum">{sum ? <Money n={sum.value} signed={sum.signed} /> : null}</span><OcIcon name="chev" size="sm" />
        </button>
        {oc.redoCount ? (
          <button type="button" className="redo fresh" data-act="redo" data-ico="redo" data-tip="החזר ביטול" aria-label="החזר ביטול" disabled={busy} onClick={oc.redo}>
            <OcIcon name="redo" size="sm" anim />{oc.redoCount > 1 ? <i>{oc.redoCount}</i> : null}
          </button>
        ) : null}
      </div>
      <div className="cart-body">
        <div className="cart-list">
          {count ? (
            <>
              {changes.map((c) => {
                const line = displayLine(c);
                return (
                  <div className={`cl enter${leaving === c.key ? ' leaving' : ''}`} key={c.key} data-key={c.key} data-rich={`chg|${c.key}`} tabIndex={0}>
                    <div className="cl-i"><OcIcon name={c.icon} /></div>
                    <div className="cl-t"><span><Emph text={line.text} /></span>{line.note ? <small>{line.note}</small> : null}{c.amt ? <em className={c.amt > 0 ? 'p' : 'm'}><Money n={c.amt} signed /></em> : null}</div>
                    <button type="button" className="cl-u" data-act="undo" data-k={c.key} data-ico="bk" data-tip="ביטול השינוי" aria-label="ביטול השינוי" disabled={busy} onClick={() => undo(c.key)}><OcIcon name="bk" size="sm" anim className={iconClass('bk')} /></button>
                  </div>
                );
              })}
              {sessionPays.map((p) => (
                <div className="cl enter" key={`sp-${p.id}`} tabIndex={0}>
                  <div className="cl-i"><OcIcon name="cash" /></div>
                  <div className="cl-t"><span>תשלום · <b>{p.method}</b></span><em className="n"><Money n={p.amount} /></em></div>
                </div>
              ))}
            </>
          ) : <div className="cart-empty"><OcIcon name="check" size="lg" /><span>אין שינויים</span></div>}
        </div>
        {rows.length ? (
          <div className="cart-tot">
            {rows.map((r) => (
              <div className={r.cls} key={r.label}><small>{r.label}</small>{r.due ? <b className="cart-due"><Money n={r.value} /></b> : <b><Money n={r.value} signed={r.signed} /></b>}</div>
            ))}
          </div>
        ) : null}
      </div>
      {showAct ? (
        <div className="cart-actions enter">
          {primaryBtn}
          {dirty ? <button type="button" className="btn ghost block sec" data-act="discard" data-ico="undo" disabled={busy} onClick={() => oc.discardAll()}><OcIcon name="undo" size="sm" anim className={iconClass('undo')} />בטל שינויים</button> : null}
        </div>
      ) : null}
    </div>
  );
}
