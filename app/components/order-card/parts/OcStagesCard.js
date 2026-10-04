'use client';

// "שלבי ההזמנה" (A5, החלטת הבעלים: "ללא פרטים מיותרים, רק השלבים כפי שיוגדר במסך לוז") - ראש לשונית ההיסטוריה.
// מבנה: pStages() בדגימה (כרטיס-הזמנה.html) - .card.stg > .prc-l > .prc (rail + body + .prc-m). הנתונים: GET /api/orders/[id]/journal
// (stages, lib/schedule/orderStages.js). "סמן הכנה בוצעה" / "בטל סימון" לכל מי שפתחה הזמנה כש-canMark (AMB-08 (B): page:orders + טבלת הסימונים קיימת) - דרך
// POST /api/orders/[id]/prep-mark (OcHistoryTab); אחרות רואות בוצע / טרם בוצע בלבד.
import OcIcon from '../OcIcon';

const INFO_CHIP = { order: 'נרשמה', event: 'מידע בלבד' };

export default function OcStagesCard({ stages, canMark, busyKey, onMark }) {
  const list = stages || [];
  return (
    <div className="card stg">
      <div className="card-h">
        <div className="ico teal"><OcIcon name="list" size="lg" /></div>
        <h2>שלבי ההזמנה <button type="button" className="tip" data-tip="לפי השלבים שהוגדרו במסך הלוז" aria-label="עזרה"><OcIcon name="info" size="sm" /></button></h2>
      </div>
      <div className="prc-l">
        {list.length ? list.map((s) => <StageRow key={s.key} s={s} canMark={canMark} busy={busyKey === s.key} onMark={onMark} />) : <div className="empty">אין שלבים להצגה</div>}
      </div>
    </div>
  );
}

function StageRow({ s, canMark, busy, onMark }) {
  const day = s.day || {};
  const markable = s.markable && canMark;
  let meta;
  if (s.infoOnly) meta = <span className="chip gray">{INFO_CHIP[s.key] || 'מידע בלבד'}</span>;
  else if (markable && !s.done) {
    meta = (
      <button type="button" className="btn sm" data-act="prep-mark" disabled={busy} onClick={() => onMark && onMark(s, true)}>
        <OcIcon name="check" size="sm" />סמן הכנה בוצעה
      </button>
    );
  } else if (markable && s.done && s.doneVia === 'mark') {
    meta = (
      <>
        <span className="chip green"><OcIcon name="check" size="sm" />בוצע</span>
        <button type="button" className="btn sm ghost" data-act="prep-unmark" disabled={busy} onClick={() => onMark && onMark(s, false)}>
          <OcIcon name="undo" size="sm" />בטל סימון
        </button>
      </>
    );
  } else meta = s.done ? <span className="chip green"><OcIcon name="check" size="sm" />בוצע</span> : <span className="chip amber">טרם בוצע</span>;
  return (
    <div className={`prc ${s.done ? 'done' : 'fut'}${s.current ? ' cur' : ''}`} aria-current={s.current ? 'step' : undefined} data-stage={s.key}>
      <div className="prc-rail"><span className="prc-i"><OcIcon name={s.done ? 'check' : s.icon} /></span></div>
      <div className="prc-body">
        <div className="prc-t"><b>{s.label}</b><small>{[day.wd, day.heShort].filter(Boolean).join(' · ')}</small></div>
        <div className="prc-m">{meta}</div>
      </div>
    </div>
  );
}
