'use client';

import { memo, useState } from 'react';
import ScheduleIcon from './ScheduleIcon';
import { MarkButton } from './MarkControls';
import {
  STAGE_META, subText, subParts, flagLabels, alertText, itemText, alterationSummary, formatAddress,
} from './scheduleMeta';

// שורת לו״ז אחת (שורות / טבלה). המראה = העיצוב המאושר (תצוגות-עיצוב/לוז-יומי.html, rowHTML/trHTML/statusHTML, שורות
// 1975-1986): אייקון השלב, שם + מספר הזמנה, שורת פרטים, ואז בקצה (lz-act) התראה אדומה ולחצן "בוצע" (MarkControls.js).
//
// החוזה האחיד של סימון "בוצע" (useStageMarks.js דרך StageSection.js):
//   <StageRow stage row doneState={marks.doneState(stage, row)} onMarkDone={marks.onMarkDone} dayLabel />
//   onMarkDone(stage, row, { done: boolean, outcome?: 'ok'|'not_ok' }) - נקרא אחרי אישור בחלון "בטוח?" (S03).
//   doneState: { available, canMark, done, doneVia, doneBy, doneAt, outcome, busy } (null = אין hook / אין טבלה);
//   השורה עצמה (row.done / row.returnCondition) כבר מעודכנת אופטימית ע״י ה-hook.
// שלבי המידע (1 הזמנה, 7 אירוע) בלי לחצן בכלל (החלטת הבעלים: בלי "בוצע"). שלבי ההחזרה (8, 9): לחצן "בוצע" (= הוחזר
// תקין), ובריחוף/מיקוד/מגע צף מימינו "הוחזר לא תקין" (A4); אחרי הסימון: שבב "תקין" / "לא תקין" + "בוצע" דלוק (B17).
// שלב בלי מקור "בוצע" (stage.doneSource) ובלי טבלת סימונים (doneState.available) - בלי לחצן ובלי מחלקת done/todo.
function rowKnown(stage, doneState) {
  return !stage.infoOnly && !!(stage.doneSource || (doneState && doneState.available));
}

function AlertChip({ row }) {
  if (!row.alerts || !row.alerts.length) return null;
  const all = row.alerts.map(alertText).join(' · ');
  return (
    <span className="chip red" data-tip={all}>
      <ScheduleIcon name="alert" />
      {alertText(row.alerts[0])}
      {row.alerts.length > 1 ? ' +' + (row.alerts.length - 1) : ''}
    </span>
  );
}

// שבבי מידע במיקום שהבעלים אישר: דגלי ההזמנה בשורת האירוע בלבד (B21), "חיוב משלוח קיים" בשורות המשלוח (B08)
function InfoChips({ stage, row }) {
  const flags = stage.key === 'event' ? flagLabels(row.flags) : [];
  return (
    <>
      {flags.map((f) => (
        <span key={f} className="chip gray lz-flag" data-tip="דגל הזמנה שמשפיע על התאריכים">{f}</span>
      ))}
      {(stage.key === 'dout' || stage.key === 'dback') && row.chargeExists ? (
        <span className="chip gray lz-flag" data-tip="כבר נוסף חיוב משלוח להזמנה"><ScheduleIcon name="wallet" />חיוב משלוח קיים</span>
      ) : null}
    </>
  );
}

function DetailRow({ label, children }) {
  return (
    <div className="hv-r">
      <small>{label}</small>
      <b>{children}</b>
    </div>
  );
}

function Phone({ value }) {
  return <a href={'tel:' + String(value).replace(/[^\d+]/g, '')} dir="ltr">{value}</a>;
}

// הרחבת השורה (היסטוריה 26, hdet - המיקום שאושר ב-B05/B06/B07): פירוט הפריטים (דגם / מידה / מיקום / בתיקון),
// טלפונים, כתובת, הערות. נבנית רק כשהשורה פתוחה.
function RowDetails({ stage, row }) {
  const items = row.items || [];
  const phones = [row.customer?.phone1, row.customer?.phone2].filter(Boolean);
  const addr = formatAddress(row.address);
  return (
    <div className="hdet">
      <div className="hdet-in">
        {items.map((it) => (
          <DetailRow key={it.orderItemId} label="שמלה">
            <span className="lz-itm">
              {itemText(it) || 'פריט ללא דגם'}
              {stage.key === 'repair' && alterationSummary(it) ? <span className="chip gray">תיקון: {alterationSummary(it)}</span> : null}
              {it.location ? <span className="chip gray"><ScheduleIcon name="pin" />מיקום: {it.location}</span> : null}
              {it.inRepair ? <span className="chip red">בתיקון</span> : null}
            </span>
          </DetailRow>
        ))}
        {!items.length && row.dressCount ? (
          <DetailRow label="שמלות">{row.dressCount}</DetailRow>
        ) : null}
        {phones.length ? (
          <DetailRow label="טלפון">
            {phones.map((p, i) => (
              <span key={i}>{i > 0 ? ' · ' : ''}<Phone value={p} /></span>
            ))}
          </DetailRow>
        ) : null}
        {stage.showAddress ? <DetailRow label="כתובת">{addr || 'חסרה כתובת'}</DetailRow> : null}
        {row.branch ? <DetailRow label="סניף">{row.branch}{row.pickupBranch && row.pickupBranch !== row.branch ? ' · איסוף: ' + row.pickupBranch : ''}</DetailRow> : null}
        {row.notes ? <DetailRow label="הערות">{row.notes}</DetailRow> : null}
        {row.internalNotes ? (
          <DetailRow label="הערה פנימית">
            {row.internalNotes} <span className="chip gray lz-mgt">הנהלה בלבד</span>
          </DetailRow>
        ) : null}
      </div>
    </div>
  );
}

export function GoLink({ orderId }) {
  return (
    <a
      className="go lz-go"
      href={'/orders/' + orderId}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={'לכרטיס ההזמנה #' + orderId}
      data-tip="לכרטיס ההזמנה"
    >
      <ScheduleIcon name="chev" className="sm" />
    </a>
  );
}

// מחלקות המצב של השורה כמו בעיצוב (cls(), שורה 1980): lz-done / lz-todo (לא בשלבי המידע) + lz-late כשיש התראה
function rowClass(stage, row, doneState) {
  const known = rowKnown(stage, doneState);
  return 'lz-r' + (!known ? '' : (row.done === true ? ' lz-done' : ' lz-todo')) + (row.alerts && row.alerts.length ? ' lz-late' : '');
}

function StageRow({ stage, row, onMarkDone, doneState, dayLabel }) {
  const [open, setOpen] = useState(false);
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const name = row.customer?.name || 'לא ידוע';
  return (
    <article className={'hrow irow ' + rowClass(stage, row, doneState) + (open ? ' open' : '')}>
      <div className="li lrow">
        <div className="ic-b"><ScheduleIcon name={meta.icon} /></div>
        <div className="t">
          <button type="button" className="lz-tbtn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <b>{name} <bdi>#{row.orderId}</bdi></b>
            <span className="ln">
              {subParts(stage.key, row).map((part, i) => (
                <span key={i} className="lz-p">{i > 0 ? ' · ' : ''}<span className="lz-pn">{part}</span></span>
              ))}
            </span>
          </button>
        </div>
        <div className="lz-act">
          <AlertChip row={row} />
          <InfoChips stage={stage} row={row} />
          <MarkButton stage={stage} row={row} onMarkDone={onMarkDone} doneState={doneState} dayLabel={dayLabel} />
        </div>
        <GoLink orderId={row.orderId} />
      </div>
      {open ? <RowDetails stage={stage} row={row} /> : null}
    </article>
  );
}

export default memo(StageRow);

// שורת טבלה (תצוגת "טבלה", trHTML בעיצוב): עמודות הזמנה / לקוחה / פרטים / התראה / ביצוע / כרטיס
function StageTableRowImpl({ stage, row, onMarkDone, doneState, dayLabel }) {
  const items = row.items || [];
  const itemLines = items.map((it) => {
    const parts = [itemText(it)];
    if (stage.key === 'repair' && alterationSummary(it)) parts.push('תיקון: ' + alterationSummary(it));
    if (it.location) parts.push('מיקום: ' + it.location);
    if (it.inRepair) parts.push('בתיקון');
    return parts.filter(Boolean).join(' · ');
  }).filter(Boolean);
  return (
    <tr className={rowClass(stage, row, doneState)}>
      <td><bdi>#{row.orderId}</bdi></td>
      <td>
        <b>{row.customer?.name || 'לא ידוע'}</b>
        {row.customer?.phone1 ? <small className="lz-sm"><bdi dir="ltr">{row.customer.phone1}</bdi></small> : null}
      </td>
      <td>
        {subText(stage.key, row, { tbl: true })}
        {itemLines.map((l, i) => <small key={i} className="lz-sm">{l}</small>)}
        {row.notes ? <small className="lz-sm">הערה: {row.notes}</small> : null}
        {row.internalNotes ? <small className="lz-sm">הערה פנימית (הנהלה בלבד): {row.internalNotes}</small> : null}
      </td>
      <td><AlertChip row={row} /><InfoChips stage={stage} row={row} /></td>
      {stage.infoOnly ? null : <td className="tc"><div className="lz-act"><MarkButton stage={stage} row={row} onMarkDone={onMarkDone} doneState={doneState} dayLabel={dayLabel} /></div></td>}
      <td className="tc"><GoLink orderId={row.orderId} /></td>
    </tr>
  );
}

export const StageTableRow = memo(StageTableRowImpl);
