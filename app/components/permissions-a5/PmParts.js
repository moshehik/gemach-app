'use client';

// רכיבים קטנים משותפים של מסך ההרשאות החדש: תווית פריט (קישור לעמוד בטאב חדש + כרטיס הסבר), צ'יפ עובד, צ'יפ פריט.
// עיצוב: צ'יפים (.chip) ואייקון המידע (.tip) של הפלטה; הכרטיס צף (portal לשורש הדף) כדי שטבלה / חלון גולל לא יחתכו אותו.
import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { A5PortalRoot } from '../a5-list/A5Ui';
import { Ic } from '../settings-sim/SettingsDialogs';
import { employeeName } from './pmLogic';

export function InfoButton({ item }) {
  const root = useContext(A5PortalRoot);
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null); // null = סגור

  useEffect(() => {
    if (!pos) return undefined;
    const close = () => setPos(null);
    const onDown = (e) => {
      if ((btnRef.current && btnRef.current.contains(e.target)) || (e.target.closest && e.target.closest('[data-pm-pop]'))) return;
      close();
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  if (!item) return null;
  const toggle = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8);
    setPos({ top: r.bottom + 8, left, width });
  };

  return (
    <>
      <button ref={btnRef} type="button" className="tip pm-info" aria-label={`מידע והסבר: ${item.label}`} aria-expanded={!!pos} data-tip="מידע והסבר" onClick={toggle}>
        <Ic id="info" plain />
      </button>
      {pos && root ? createPortal(
        <div className="pm-pop" data-pm-pop role="dialog" aria-label={item.label} style={{ top: pos.top, left: pos.left, width: pos.width }} onClick={(e) => e.stopPropagation()}>
          <b className="pm-pop-t">{item.label}</b>
          {item.description ? <p>{item.description}</p> : null}
          <span className={`chip ${item.enforced ? 'green' : 'amber'}`}>{item.enforced ? 'פעיל - שינוי כאן משפיע מיד' : 'לתיעוד בלבד - לא משנה את הגישה בפועל'}</span>
          {item.userNote ? <p className="pm-pop-n">{item.userNote}</p> : null}
          {item.route ? <a className="pm-pop-a" href={item.route} target="_blank" rel="noopener noreferrer"><Ic id="ext" plain />פתיחת העמוד בטאב חדש</a> : null}
        </div>,
        root,
      ) : null}
    </>
  );
}

/** תווית פריט: עמוד = קישור לעמוד האמיתי בטאב חדש; פיצ'ר = טקסט. אחריה אייקון ההסבר. */
export function ItemLabel({ item, fallbackKey }) {
  if (!item) return <span>{fallbackKey || ''}</span>;
  return (
    <span className="pm-lbl">
      {item.route
        ? <a href={item.route} target="_blank" rel="noopener noreferrer" data-tip="פתיחת העמוד בטאב חדש" onClick={(e) => e.stopPropagation()}>{item.label}</a>
        : <span>{item.label}</span>}
      <InfoButton item={item} />
    </span>
  );
}

/** צ'יף פריט בשורה: עמוד / פיצ'ר, וסימון כשהוא מופיע גם בשורה אחרת (הגישה = האיחוד של השורות). */
export function ItemChip({ item, fallbackKey, alsoIn, onRemove, disabled }) {
  const kind = alsoIn && alsoIn.length ? 'amber' : item && item.group === 'features' ? 'teal' : 'blue';
  return (
    <span className={`chip ${kind} pm-chip`} data-tip={alsoIn && alsoIn.length ? `מופיע גם בשורה: ${alsoIn.join(', ')} - אם אחת השורות מתירה, הגישה מותרת` : undefined}>
      {alsoIn && alsoIn.length ? <Ic id="ext" plain /> : null}
      <bdi>{item ? item.label : fallbackKey}</bdi>
      {onRemove ? <button type="button" className="pm-chip-x" aria-label={`הסרת ${item ? item.label : fallbackKey}`} data-tip="הסר מהשורה" disabled={disabled} onClick={onRemove}><Ic id="x" plain /></button> : null}
    </span>
  );
}

/** צ'יף עובד: עיגול ראשי תיבות + שם (ועם הסרה בעורך). */
export function EmployeeChip({ employee, onRemove, disabled }) {
  const name = employeeName(employee);
  const initial = ((employee && (employee.firstName || employee.lastName)) || name || '?').trim().charAt(0);
  return (
    <span className="chip pm-emp" data-tip={employee && employee.department && employee.department.name ? `${name} - ${employee.department.name}` : name}>
      <span className="pm-ini" aria-hidden="true">{initial}</span>
      <bdi>{name}</bdi>
      {onRemove ? <button type="button" className="pm-chip-x" aria-label={`הסרת ${name}`} data-tip="הסר עובד" disabled={disabled} onClick={onRemove}><Ic id="x" plain /></button> : null}
    </span>
  );
}
