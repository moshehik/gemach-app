'use client';

// "אחרונים" (בית 18/20/55/56 hres + card res-one): הפריטים שנצפו לאחרונה בדפדפן הזה (agy_history —
// הזמנה, לקוח, דגם, השכרה). כפתור "נקה" מנקה רק את ההיסטוריה המקומית. הכפתור שפותח את הכרטיס הוא
// אייקון בלבד, בלי כיתוב (החלטת הבעלים, פריט 24).

import Link from 'next/link';
import { Ic } from './HomeParts';

export default function HomeRecents({ rows, onClear, onClose }) {
  return (
    <div className="card res-one recent">
      <div className="card-h">
        <h2 id="rk-h">אחרונים</h2>
        {rows.length > 0 && (
          <button type="button" className="ibtn" aria-label="ניקוי רשימת האחרונים" data-tip="נקה" onClick={onClear}><Ic id="eraser" size="sm" /></button>
        )}
        <button type="button" className="ibtn" aria-label="חזרה לחיפוש הכללי" data-tip="חזרה לחיפוש הכללי" onClick={onClose}><Ic id="x" size="sm" /></button>
      </div>
      {rows.length === 0 ? (
        <div className="empty"><Ic id="clock" size="lg" /><div>עוד לא נפתחו כאן הזמנות או לקוחות</div></div>
      ) : (
        <div className="list" aria-labelledby="rk-h">
          {rows.map((r) => (
            <Link key={r.key} className="li rlink lrow" href={r.url}>
              <div className="ic-b"><Ic id={r.icon} /><span className="rlbl">{r.kind}</span></div>
              <div className="t"><b>{r.title}</b>{r.sub ? <span className="ln">{r.sub}</span> : null}</div>
              <Ic id="chev" size="sm" className="go" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
