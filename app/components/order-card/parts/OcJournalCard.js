'use client';

// "יומן הזמנה" (A20 - הוכנס בהחלטת הבעלים, מבטל את D4) - לכל שלב + "תשלום": מתי ("היום/מחר/אתמול/תאריך עברי"), שעה, מי;
// צ׳יפ "השלב הנוכחי"; לחצן עגול "עובדים במשמרת" עם כותרת המשמרת (שעות - אין שם משמרת במודל, AMB-18) ורשימת העובדים.
// מבנה: pProcess() בדגימה (.card.proc, החדש למעלה). הנתונים מנתוני אמת: GET /api/orders/[id]/journal (lib/history/orderJournal.js),
// לא PROC_WHO/PROC_SHIFT הקבועים של הדגימה. צ׳יפי meta שהדגימה מחשבת ולא מציגה - לא מוצגים (כמו בדגימה).
// R40: "בוצעה על ידי" / "עובדים פעילים בהזמנה" לא קיימים בכרטיס החדש - המידע כאן.
import { useCallback, useEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import OcPortal from '../OcPortal';
import { fmtMoney } from '../orderCardLogic';
import { relativeDayLabel } from './ocHistoryModel';

export default function OcJournalCard({ nodes, todayKey }) {
  const list = [...(nodes || [])].reverse(); // החדש למעלה (כמו בדגימה)
  return (
    <div className="card proc">
      <div className="card-h">
        <div className="ico teal"><OcIcon name="list" size="lg" /></div>
        <h2>יומן הזמנה</h2>
      </div>
      <div className="prc-l">
        {list.length ? list.map((n) => <JournalRow key={n.key} n={n} todayKey={todayKey} />) : <div className="empty">אין שלבים להצגה</div>}
      </div>
    </div>
  );
}

function JournalRow({ n, todayKey }) {
  const day = n.when ? n.when.day : n.plannedDay;
  const dayKey = n.when ? n.when.dayKey : (n.plannedDay && n.plannedDay.dayKey);
  const rel = relativeDayLabel(dayKey, todayKey, day);
  const doneBy = n.done && n.when;
  return (
    <div className={`prc ${n.done ? 'done' : 'fut'}${n.current ? ' cur' : ''}`} aria-current={n.current ? 'step' : undefined} data-node={n.key}>
      <div className="prc-rail"><span className="prc-i"><OcIcon name={n.done ? 'check' : n.icon} /></span></div>
      <div className="prc-body">
        <div className="prc-t">
          <b>{n.label}</b>
          <small>
            {rel}
            {doneBy && n.when.time ? <> · <bdi>{n.when.time}</bdi></> : null}
            {doneBy && n.who ? ` · ${n.who}` : null}
            {n.key === 'pay' && n.paid > 0 ? <> · שולם <bdi dir="ltr">{fmtMoney(n.paid)}</bdi></> : null}
          </small>
        </div>
        {n.current ? <span className="chip gray prc-cur">השלב הנוכחי</span> : null}
        {doneBy && n.shift ? <ShiftButton shift={n.shift} /> : null}
      </div>
    </div>
  );
}

// לחצן "עובדים במשמרת" + טולטיפ עשיר של הפלטה (.pl-rt, כמו #rt בדגימה: data-rich="shift|…") ב-portal לשורש הכרטיס
function ShiftButton({ shift }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const show = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 10, left: r.left + r.width / 2 });
  }, []);
  const hide = useCallback(() => setPos(null), []);
  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [pos]);
  return (
    <>
      <button
        type="button" ref={ref} className="tip prc-sh" aria-label="עובדים במשמרת" aria-expanded={!!pos}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={() => (pos ? hide() : show())}
        onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}
      >
        <OcIcon name="users" />
      </button>
      {pos ? (
        <OcPortal>
          <ShiftTip shift={shift} pos={pos} />
        </OcPortal>
      ) : null}
    </>
  );
}

function ShiftTip({ shift, pos }) {
  const ref = useRef(null);
  const [left, setLeft] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const w = el.offsetWidth;
    setLeft(Math.max(8, Math.min(window.innerWidth - w - 8, pos.left - w / 2)));
  }, [pos]);
  return (
    <div ref={ref} className={`pl-rt${left === null ? '' : ' on'}`} role="tooltip" data-side="b" style={{ top: pos.top, left: left === null ? pos.left : left }}>
      <div className="rr1"><OcIcon name="clock" size="sm" /><span>{shift.title}</span></div>
      {(shift.names || []).map((nm) => <div className="rr1" key={nm}><OcIcon name="user" size="sm" /><span>{nm}</span></div>)}
    </div>
  );
}
