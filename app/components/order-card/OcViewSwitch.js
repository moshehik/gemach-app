'use client';

// OcViewSwitch — מתג רשימה / טבלה דו-מצבי של הפלטה (.vsw + .vknob + .vopt; אותו מתג כמו CcViewSwitch בכרטיס הלקוח ובהיסטוריה של הכרטיס).
// משמש בלשונית "פריטים" ובפיד ההיסטוריה. נגישות: role=group + aria-pressed לכל אפשרות (שני לחצנים, Tab/Enter/רווח); הסדר לפי ה-DOM = רשימה ואז טבלה (RTL).
// act: קידומת ל-data-act של הלחצנים (act="view" → view-list / view-table) - המסמן של בדיקות הדפדפן; בלי act אין data-act.
import OcIcon from './OcIcon';

export default function OcViewSwitch({ value, onChange, act }) {
  const tbl = value === 'table';
  return (
    <div className={`vsw${tbl ? ' t' : ''}`} role="group" aria-label="מצב תצוגה">
      <span className="vknob" aria-hidden="true" />
      <button type="button" className={`vopt${tbl ? '' : ' on'}`} aria-label="תצוגת רשימה" aria-pressed={!tbl} data-tip="רשימה" data-act={act ? `${act}-list` : undefined} onClick={() => onChange('list')}><OcIcon name="rows" /></button>
      <button type="button" className={`vopt${tbl ? ' on' : ''}`} aria-label="תצוגת טבלה" aria-pressed={tbl} data-tip="טבלה" data-act={act ? `${act}-table` : undefined} onClick={() => onChange('table')}><OcIcon name="table" /></button>
    </div>
  );
}
