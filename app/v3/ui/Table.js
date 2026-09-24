'use client';
import { Fragment, useMemo, useState } from 'react';
import Icon from './Icon';
import { cx } from './cx';

/** hook: מיון לקוח. מחזיר {rows, sort, onSort}. sort={key,dir:'asc'|'desc'}|null. */
export function useSort(rows, columns, initial = null) {
  const [sort, setSort] = useState(initial);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    const get = col?.sortValue || ((r) => r[sort.key]);
    const m = sort.dir === 'desc' ? -1 : 1;
    return [...rows].sort((a, b) => { const x = get(a), y = get(b); return (x > y ? 1 : x < y ? -1 : 0) * m; });
  }, [rows, columns, sort]);
  const onSort = (key) => setSort((s) => (s?.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));
  return { rows: sorted, sort, onSort };
}

/**
 * Table (R16 מינימלי): columns=[{key,header,render?,sortable?,sortValue?,num?}] · rows · rowKey
 * sort/onSort (מ-useSort) · sticky (כותרת דביקה, גלילה פנימית) · renderExpanded(row) = שורה מורחבת בלחיצה
 */
export default function Table({ columns, rows, rowKey = 'id', sort, onSort, sticky, renderExpanded, onRowClick, caption, className }) {
  const [open, setOpen] = useState(null);
  return (
    <div className={cx('v3-table__wrap', sticky && 'v3-table__wrap--scroll')}>
      <table className={cx('v3-table', sticky && 'v3-table--sticky', className)}>
        {caption && <caption className="v3-sr">{caption}</caption>}
        <thead>
          <tr>
            {renderExpanded && <th aria-label="הרחבה" />}
            {columns.map((c) => {
              const on = sort?.key === c.key;
              return (
                <th key={c.key} scope="col" className={c.num ? 'v3-num' : undefined} aria-sort={c.sortable ? (on ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}>
                  {c.sortable ? (
                    <button type="button" className="v3-th-btn" onClick={() => onSort?.(c.key)}>
                      {c.header}<Icon name="sort" size="sm" className={on ? 'is-on' : undefined} anim={false} />
                    </button>
                  ) : c.header}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const k = r[rowKey];
            const isOpen = open === k;
            return (
              <Fragment key={k}>
                <tr aria-expanded={renderExpanded ? isOpen : undefined}
                  className={onRowClick ? 'v3-tr--link' : undefined} onClick={onRowClick ? () => onRowClick(r) : undefined}>
                  {renderExpanded && (
                    <td>
                      <button type="button" className="v3-th-btn" aria-label={isOpen ? 'סגירת פרטים' : 'פתיחת פרטים'} aria-expanded={isOpen} onClick={(e) => { e.stopPropagation(); setOpen(isOpen ? null : k); }}>
                        <Icon name="chevron-down" size="sm" className={isOpen ? 'is-on' : undefined} anim={false} />
                      </button>
                    </td>
                  )}
                  {columns.map((c) => <td key={c.key} className={c.num ? 'v3-cell-num' : undefined}>{c.render ? c.render(r) : r[c.key]}</td>)}
                </tr>
                {renderExpanded && isOpen && <tr><td colSpan={columns.length + 1}>{renderExpanded(r)}</td></tr>}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
