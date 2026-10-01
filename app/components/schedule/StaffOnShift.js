'use client';

import ScheduleIcon from './ScheduleIcon';

// "מי במשמרת" (B02): שמות בלבד (השרת לא מחזיר שכר/פרטים). open=true = עדיין לא יצאה.
export default function StaffOnShift({ staff }) {
  const list = Array.isArray(staff) ? staff : [];
  return (
    <div className="lz-staff" aria-label="מי במשמרת">
      <div className="lz-staff-h"><ScheduleIcon name="users" className="sm" />במשמרת{list.length ? ' (' + list.length + ')' : ''}</div>
      {list.length ? (
        <div className="lz-staff-l">
          {list.map((p) => (
            <span key={p.employeeId} className={'chip lz-staff-c' + (p.open ? ' on' : '')} title={p.open ? 'במשמרת כעת' : 'סיימה משמרת'}>
              <i aria-hidden="true" />{p.name}
            </span>
          ))}
        </div>
      ) : (
        <div className="lz-staff-e">אין נוכחות רשומה ליום זה</div>
      )}
    </div>
  );
}
