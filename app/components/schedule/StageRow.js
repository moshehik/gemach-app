'use client';

import { memo, useState } from 'react';
import ScheduleIcon, { CheckCircleIcon } from './ScheduleIcon';
import { MarkButton } from './MarkControls';
import {
  STAGE_META, NOT_MARKED_TIP, subText, subParts, flagLabels, alertText, itemText, alterationSummary, formatAddress,
} from './scheduleMeta';

// סטטוס "בוצע": עם סימון (doneState.available + onMarkDone מ-useStageMarks.js) - לחצן "בוצע" (MarkControls.js);
// בלי (הטבלה עדיין לא נוצרה / אין hook) - צ'יפים לקריאה בלבד כמו ב-V1. done=null (אין שום מקור) מוצג כ"—"
// עם הסבר, לא כ"לא בוצע" (אין המצאה).
export function StatusChips({ stage, row, doneState, onMarkDone }) {
  if (stage.infoOnly) return null;
  const out = [];
  if ((stage.key === 'manret' || stage.key === 'dback') && row.returnCondition) {
    out.push(
      row.returnCondition === 'ok'
        ? <span key="rc" className="chip green lz-rc">תקין</span>
        : <span key="rc" className="chip rose lz-rc">לא תקין</span>,
    );
  }
  // אורח במצב פתוח (canMark=false) רואה את הצ'יפים לקריאה בלבד, לא לחצן מושבת
  if (doneState && doneState.available && doneState.canMark && onMarkDone) {
    out.push(<MarkButton key="mk" stage={stage} row={row} doneState={doneState} onMarkDone={onMarkDone} />);
    return out;
  }
  if (row.done === true) {
    out.push(<span key="d" className="chip green lz-done-chip"><CheckCircleIcon className="sm" />בוצע</span>);
  } else if (row.done === false) {
    out.push(<span key="d" className="chip gray lz-todo-chip">לביצוע</span>);
  } else {
    out.push(
      <span key="d" className="chip gray lz-nd" title={NOT_MARKED_TIP} aria-label={'לא זמין - ' + NOT_MARKED_TIP}>—</span>,
    );
  }
  return out;
}

function AlertChips({ row }) {
  if (!row.alerts || !row.alerts.length) return null;
  const all = row.alerts.map(alertText).join(' · ');
  return (
    <span className="chip red lz-al" title={all}>
      <ScheduleIcon name="alert" />
      {alertText(row.alerts[0])}
      {row.alerts.length > 1 ? ' +' + (row.alerts.length - 1) : ''}
    </span>
  );
}

function InfoChips({ stage, row }) {
  const flags = flagLabels(row.flags);
  return (
    <>
      {flags.map((f) => (
        <span key={f} className="chip gray lz-flag" title="דגל הזמנה שמשפיע על התאריכים">{f}</span>
      ))}
      {(stage.key === 'dout' || stage.key === 'dback') && row.chargeExists ? (
        <span className="chip gray lz-flag" title="כבר נוסף חיוב משלוח להזמנה"><ScheduleIcon name="wallet" />חיוב משלוח קיים</span>
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

// הרחבת השורה: פירוט הפריטים (דגם / מידה / מיקום / בתיקון), טלפונים, כתובת, הערות.
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
      title="לכרטיס ההזמנה"
    >
      <ScheduleIcon name="chev" className="sm" />
    </a>
  );
}

// doneState / onMarkDone: אופציונליים - מגיעים מ-StageSection (useStageMarks.js); בלעדיהם השורה לקריאה בלבד.
function StageRow({ stage, row, doneState, onMarkDone }) {
  const [open, setOpen] = useState(false);
  const meta = STAGE_META[stage.key] || STAGE_META.order;
  const late = (row.alerts || []).some((a) => a.code === 'late_not_done');
  const name = row.customer?.name || 'לא ידוע';
  return (
    <article className={'hrow irow lz-r' + (late ? ' lz-late' : '') + (open ? ' open' : '')}>
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
          <AlertChips row={row} />
          <InfoChips stage={stage} row={row} />
          <StatusChips stage={stage} row={row} doneState={doneState} onMarkDone={onMarkDone} />
        </div>
        <GoLink orderId={row.orderId} />
      </div>
      {open ? <RowDetails stage={stage} row={row} /> : null}
    </article>
  );
}

export default memo(StageRow);

// שורת טבלה (תצוגת "טבלה"): מציגה גם את פרטי הדגמים בתא "פרטים"
function StageTableRowImpl({ stage, row, doneState, onMarkDone }) {
  const late = (row.alerts || []).some((a) => a.code === 'late_not_done');
  const items = row.items || [];
  const itemLines = items.map((it) => {
    const parts = [itemText(it)];
    if (stage.key === 'repair' && alterationSummary(it)) parts.push('תיקון: ' + alterationSummary(it));
    if (it.location) parts.push('מיקום: ' + it.location);
    if (it.inRepair) parts.push('בתיקון');
    return parts.filter(Boolean).join(' · ');
  }).filter(Boolean);
  return (
    <tr className={'lz-r' + (late ? ' lz-late' : '')}>
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
      <td><AlertChips row={row} /><InfoChips stage={stage} row={row} /></td>
      {stage.infoOnly ? null : <td className="tc"><div className="lz-act"><StatusChips stage={stage} row={row} doneState={doneState} onMarkDone={onMarkDone} /></div></td>}
      <td className="tc"><GoLink orderId={row.orderId} /></td>
    </tr>
  );
}

export const StageTableRow = memo(StageTableRowImpl);
