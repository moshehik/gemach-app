'use client';

// שורת תוצאת חיפוש אחת - המקור היחיד לצורת השורה ברשימת "תוצאות" של דף הבית (HomeResults.js) ולפאנל התפוסה / הפריט (search/SearchPanel.js):
// אייקון + תווית סוג (.ic-b / .rlbl), גוף (.t: כותרת b + שורה קטנה .ln), חץ (.go). שינוי עיצוב של שורת תוצאה כאן חל על שניהם.
// ללא קישור וללא פעולה = שורה בלי חץ (.nolink). עם onAct = שורה-פעולה (נראית כקישור, נפתחת/נסגרת במקום; role=button).
import Link from 'next/link';
import { Ic } from './homeIcon';

export function Stx({ s }) {
  return <span className={`stx ${s.cls}`}><Ic id={s.icon} />{s.label}</span>;
}

/**
 * @param {{icon: string, kind: string, url?: string, onAct?: Function, open?: boolean, data?: object, children: any}} p
 *   children = תוכן .t (למשל <b>כותרת</b><span className="ln">...</span>)
 */
export function ResultRow({ icon, kind, url = '', onAct, open, data, children }) {
  const head = <div className="ic-b"><Ic id={icon} /><span className="rlbl">{kind}</span></div>;
  if (url) {
    return (
      <Link className="li rlink lrow" href={url} {...data}>
        {head}
        <div className="t">{children}</div>
        <Ic id="chev" size="sm" className="go" />
      </Link>
    );
  }
  if (onAct) {
    return (
      <div
        className={`li rlink lrow${open ? ' sp-open' : ''}`}
        role="button"
        tabIndex={0}
        aria-expanded={open === undefined ? undefined : !!open}
        onClick={onAct}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAct(e); } }}
        {...data}
      >
        {head}
        <div className="t">{children}</div>
        <Ic id="chev" size="sm" className="go" />
      </div>
    );
  }
  // שורה בלי קישור (למשל מלאי למי שאין לה הרשאה לכרטיס הדגם): אותה צורה, בלי חץ, ניתנת למיקוד כדי שמקלדת תעבור עליה
  return (
    <div className="li lrow nolink" tabIndex={0} {...data}>
      {head}
      <div className="t">{children}</div>
    </div>
  );
}

/** כותרת קבוצה בתוך רשימת התוצאות (בחוץ / הוחזרו / ממתינות). */
export function ResultGroupHead({ title, count }) {
  return (
    <div className="rgrp-h">
      <b>{title}</b>{count != null ? <> <span className="faint">({count})</span></> : null}
    </div>
  );
}

/** מצב ריק של קבוצה (אותה מחלקה .empty של "אין תוצאות", בגודל קבוצה). */
export function ResultEmpty({ children }) {
  return <div className="empty rgrp-empty">{children}</div>;
}
