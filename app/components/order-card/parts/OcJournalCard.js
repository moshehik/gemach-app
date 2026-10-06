'use client';

// "יומן הזמנה" (A20 + שלבי ההזמנה A5 מאוחדים, D2) - לכל שלב + "תשלום": מתי ("היום/מחר/אתמול/תאריך עברי"), שעה, מי;
// צ׳יפ "השלב הנוכחי"; לחצן עגול "עובדים במשמרת" עם כותרת המשמרת (שעות - אין שם משמרת במודל, AMB-18) ורשימת העובדים.
// מבנה: pProcess() בדגימה (.card.proc, החדש למעלה). הנתונים מנתוני אמת: GET /api/orders/[id]/journal (lib/history/orderJournal.js),
// לא PROC_WHO/PROC_SHIFT הקבועים של הדגימה. צ׳יפי meta שהדגימה מחשבת ולא מציגה - לא מוצגים (כמו בדגימה).
// R40: "בוצעה על ידי" / "עובדים פעילים בהזמנה" לא קיימים בכרטיס החדש - המידע כאן.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import OcIcon from '../OcIcon';
import OcPortal from '../OcPortal';
import { fmtMoney } from '../orderCardLogic';
import { relativeDayLabel } from './ocHistoryModel';
import { ESTIMATE_TIP } from '@/lib/alterationEstimate';

// כרטיס אחד (D2, החלטת הבעלים 2026-10-05): "שלבי ההזמנה" + "יומן הזמנה" אוחדו לרשימה אחת. שורה לכל שלב + "תשלום" (החדש למעלה): שם השלב,
// מתי / מי (היומן), לחצן "עובדים במשמרת" (רק כשהוגדרו משמרות - D3), וה-meta של השלב ("סמן הכנה בוצעה" / "בטל סימון"; בלי צ׳יפ "טרם בוצע").
// החלטת הבעלים 2026-10-05: אין צ׳יפ "נרשמה" (שורת ההזמנה) ולא "מידע בלבד" (שורת האירוע) - שלב מידע-בלבד בלי meta כלל.
// הזמנה שהוחזרה במלואה / שבוטלה (stage.closedByReturn): אין "השלב הנוכחי", אין "סמן הכנה בוצעה" ואין "טרם בוצע" - אין פעולה ממתינה.
export default function OcJournalCard({ nodes, stages, todayKey, canMark, busyKey, onMark }) {
  const list = [...(nodes || [])].reverse(); // החדש למעלה (כמו בדגימה)
  const byKey = new Map((stages || []).map((s) => [s.key, s]));
  return (
    <div className="card proc">
      <div className="card-h">
        <div className="ico teal"><OcIcon name="list" size="lg" /></div>
        <h2>יומן הזמנה <button type="button" className="tip" data-tip="לפי השלבים שהוגדרו במסך הלוז" aria-label="עזרה"><OcIcon name="info" size="sm" /></button></h2>
      </div>
      <div className="prc-l">
        {list.length ? list.map((n) => <JournalRow key={n.key} n={n} stage={byKey.get(n.key) || null} todayKey={todayKey} canMark={canMark} busy={busyKey === n.key} onMark={onMark} />) : <div className="empty">אין שלבים להצגה</div>}
      </div>
    </div>
  );
}

function StageMeta({ s, canMark, busy, onMark }) {
  const markable = s.markable && canMark;
  if (s.infoOnly || s.closedByReturn) return null;
  if (markable && !s.done) {
    return (
      <button type="button" className="btn sm" data-act="prep-mark" disabled={busy} onClick={() => onMark && onMark(s, true)}>
        <OcIcon name="check" size="sm" />סמן הכנה בוצעה
      </button>
    );
  }
  if (markable && s.done && s.doneVia === 'mark') {
    return (
      <button type="button" className="btn sm ghost" data-act="prep-unmark" disabled={busy} onClick={() => onMark && onMark(s, false)}>
        <OcIcon name="undo" size="sm" />בטל סימון
      </button>
    );
  }
  return null; // שלב שלא בוצע: בלי תווית (בעלים 2026-10-06) - היעדר ✓ = טרם בוצע; ההדגשה של השלב הנוכחי ולחצן "סמן הכנה בוצעה" נשארים
}

function JournalRow({ n, stage, todayKey, canMark, busy, onMark }) {
  const day = n.when ? n.when.day : n.plannedDay;
  const dayKey = n.when ? n.when.dayKey : (n.plannedDay && n.plannedDay.dayKey);
  const rel = relativeDayLabel(dayKey, todayKey, day);
  const doneBy = n.done && n.when;
  const meta = stage ? StageMeta({ s: stage, canMark, busy, onMark }) : null;
  return (
    <div className={`prc ${n.done ? 'done' : 'fut'}${n.current ? ' cur' : ''}`} aria-current={n.current ? 'step' : undefined} data-node={n.key} data-stage={stage ? stage.key : undefined}>
      <div className="prc-rail"><span className="prc-i"><OcIcon name={n.done ? 'check' : n.icon} /></span></div>
      <div className="prc-body">
        <div className="prc-t">
          <b>{n.label}</b>{stage && stage.estimated ? <> <span className="faint" data-tip={ESTIMATE_TIP}>(משוער)</span></> : null}
          <small>
            {rel}
            {doneBy && n.when.time ? <> · <bdi>{n.when.time}</bdi></> : null}
            {doneBy && n.who ? ` · ${n.who}` : null}
            {n.key === 'pay' && n.paid > 0 ? <> · שולם <bdi dir="ltr">{fmtMoney(n.paid)}</bdi></> : null}
          </small>
        </div>
        {meta ? <div className="prc-m">{meta}</div> : null}
        {n.current ? <span className="chip gray prc-cur">השלב הנוכחי</span> : null}
        {doneBy && n.shift ? <ShiftButton shift={n.shift} /> : null}
      </div>
    </div>
  );
}

// לחצן "עובדים במשמרת" + טולטיפ עשיר של הפלטה (.pl-rt, כמו #rt בדגימה: data-rich="shift|…", מיקום כמו placeRich - מימין/משמאל
// לכפתור במסך רחב, אחרת מעל/מתחת; חץ .ra) ב-portal לשורש הכרטיס
function ShiftButton({ shift }) {
  const ref = useRef(null);
  const [anchor, setAnchor] = useState(null);
  const show = useCallback(() => { if (ref.current) setAnchor(ref.current.getBoundingClientRect()); }, []);
  const hide = useCallback(() => setAnchor(null), []);
  useEffect(() => {
    if (!anchor) return undefined;
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); };
  }, [anchor, hide]);
  return (
    <>
      <button
        type="button" ref={ref} className="tip prc-sh" aria-label="עובדים במשמרת" aria-expanded={!!anchor}
        onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}
        onClick={() => (anchor ? hide() : show())}
        onKeyDown={(e) => { if (e.key === 'Escape') hide(); }}
      >
        <OcIcon name="users" />
      </button>
      {anchor ? (
        <OcPortal>
          <ShiftTip shift={shift} anchor={anchor} />
        </OcPortal>
      ) : null}
    </>
  );
}

function placeTip(r, w, h) {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const g = 12;
  let x;
  let y;
  let side;
  const wide = vw >= 700;
  if (wide && r.right + g + w <= vw - 8) { x = r.right + g; y = r.top + r.height / 2 - h / 2; side = 'r'; }
  else if (wide && r.left - g - w >= 8) { x = r.left - g - w; y = r.top + r.height / 2 - h / 2; side = 'l'; }
  else { x = r.left + r.width / 2 - w / 2; if (r.top - g - h >= 8) { y = r.top - g - h; side = 't'; } else { y = r.bottom + g; side = 'b'; } }
  x = Math.max(8, Math.min(vw - w - 8, x));
  y = Math.max(8, Math.min(vh - h - 8, y));
  const arrow = side === 'r' || side === 'l'
    ? { top: Math.max(14, Math.min(h - 14, r.top + r.height / 2 - y)) }
    : { left: Math.max(14, Math.min(w - 14, r.left + r.width / 2 - x)) };
  return { x, y, side, arrow };
}

function ShiftTip({ shift, anchor }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setPos(placeTip(anchor, el.offsetWidth, el.offsetHeight));
  }, [anchor]);
  return (
    <div ref={ref} className={`pl-rt${pos ? ' on' : ''}`} role="tooltip" data-side={pos ? pos.side : undefined} style={{ left: pos ? pos.x : 0, top: pos ? pos.y : 0 }}>
      <div className="rr1"><OcIcon name="clock" size="sm" /><span>{shift.title}</span></div>
      {(shift.names || []).map((nm) => <div className="rr1" key={nm}><OcIcon name="user" size="sm" /><span>{nm}</span></div>)}
      <i className="ra" style={pos ? pos.arrow : undefined} />
    </div>
  );
}
