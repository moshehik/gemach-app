'use client';

// תצוגת טבלה של "פעולות ושינויים" (A21): פעולה · תאריך · קודם · חדש · עובד מבצע, מיון עולה/יורד בכל כותרת.
// מבנה: hfTable() בדגימה (.tblw > table.rtbl, th.sorted.asc|desc, .thw/.tsort/.tsb). תאריך עברי + שעה בלבד.
import OcIcon from '../OcIcon';
import { TABLE_COLUMNS, sortTableRows, tableRow, shortHebrew } from './ocHistoryModel';
import Hl from './OcHighlight';

export default function OcHistoryTable({ entries, sort, onSort, words }) {
  const so = sort || { col: 'date', dir: -1 };
  const rows = sortTableRows(entries || [], so);
  return (
    <div className="tblw">
      <table className="rtbl">
        <thead>
          <tr>
            {TABLE_COLUMNS.map(([k, t]) => (
              <th key={k} className={so.col === k ? `sorted ${so.dir > 0 ? 'asc' : 'desc'}` : ''} aria-sort={so.col === k ? (so.dir > 0 ? 'ascending' : 'descending') : undefined}>
                <span className="thw">{t}
                  <span className="tsort">
                    <button type="button" className="tsb tu" aria-label={`מיון ${t} עולה`} onClick={() => onSort && onSort({ col: k, dir: 1 })}><OcIcon name="chev" size="sm" /></button>
                    <button type="button" className="tsb td" aria-label={`מיון ${t} יורד`} onClick={() => onSort && onSort({ col: k, dir: -1 })}><OcIcon name="chev" size="sm" /></button>
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => {
            const r = tableRow(e);
            return (
              <tr key={e.id} data-hv={e.id}>
                <td><b><Hl text={r.act} words={words} /></b></td>
                <td>{shortHebrew(e.dateHe)}{e.time && !e.dateOnly ? <> · <bdi>{e.time}</bdi></> : null}</td>
                <td><Hl text={r.prev} words={words} /></td>
                <td><Hl text={r.new} words={words} /></td>
                <td><Hl text={r.who} words={words} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
