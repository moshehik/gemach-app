'use client';

// מתג רשימה / טבלה (העיצוב: .vsw + .vknob + .vopt) ומיון בכותרות הטבלה (.thw + .tsort/.tsb) - משותף להזמנות ולהיסטוריה.
import CcIcon from './CcIcon';

export function ViewSwitch({ value, onChange }) {
  const tbl = value === 'table';
  return (
    <div className={`vsw${tbl ? ' t' : ''}`} role="group" aria-label="מצב תצוגה">
      <span className="vknob" aria-hidden="true" />
      <button type="button" className={`vopt${tbl ? '' : ' on'}`} aria-label="תצוגת רשימה" aria-pressed={!tbl} data-tip="רשימה" onClick={() => onChange('list')}><CcIcon name="rows" /></button>
      <button type="button" className={`vopt${tbl ? ' on' : ''}`} aria-label="תצוגת טבלה" aria-pressed={tbl} data-tip="טבלה" onClick={() => onChange('table')}><CcIcon name="table" /></button>
    </div>
  );
}

export function SortTh({ col, label, sort, onSort }) {
  const on = sort.col === col;
  return (
    <th className={on ? `sorted ${sort.dir > 0 ? 'asc' : 'desc'}` : ''} aria-sort={on ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'}>
      <span className="thw">{label}<span className="tsort">
        <button type="button" className="tsb tu" aria-label={`מיון ${label} עולה`} onClick={() => onSort({ col, dir: 1 })}><CcIcon name="chev" size="sm" anim={false} /></button>
        <button type="button" className="tsb td" aria-label={`מיון ${label} יורד`} onClick={() => onSort({ col, dir: -1 })}><CcIcon name="chev" size="sm" anim={false} /></button>
      </span></span>
    </th>
  );
}

export function sortRows(rows, sort, val) {
  return rows.slice().sort((a, b) => { const x = val(a, sort.col); const y = val(b, sort.col); return (x < y ? -1 : x > y ? 1 : 0) * sort.dir; });
}
