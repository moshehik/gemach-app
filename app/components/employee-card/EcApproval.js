'use client';

// EcApproval - חלון "אימות הרשאה" כהה של כרטיס העובד החדש (customAuthPrompt בישן -> חלון האימות של העיצוב, שכבה 2 = #dlg2).
// זהה בתוצאה לחלונית הישנה (PopupProvider.showAuthPrompt): רשימת המאשרים לפי רמת ההרשאה (filterApprovers, אותה הכרעה כמו בישן),
// ברירת מחדל = המשתמש המחובר אם הוא ברשימה, והתוצאה {pin, employeeId} - האימות עצמו נעשה בשרת בנתיב שמקבל אותה (reset-password /
// set-password / send-email), כמו קודם. שגיאת אימות מהשרת מוצגת בטוסט של הכרטיס. הקוד לא נשמר ולא נרשם.
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { filterApprovers } from '@/lib/employeeCardA5';
import { Dlg, DlgBadge, Ic, NO_FILL } from './EcUi';

export default function EcApprovalDialog({ message, level = 'מנהל', title = 'אימות הרשאה', onResult }) {
  const [emps, setEmps] = useState(null); // null = בטעינה
  const [sel, setSel] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [bad, setBad] = useState(false);
  const codeRef = useRef(null);

  useEffect(() => {
    let off = false;
    Promise.all([
      fetchSharedJson('/api/employees', { ttl: TTL.STATIC }).catch(() => []),
      fetchSharedJson('/api/me', { ttl: TTL.STATIC }).catch(() => null),
    ]).then(([all, me]) => {
      if (off) return;
      const list = filterApprovers(all, level);
      setEmps(list);
      const cur = me && me.success ? me.employee : null;
      if (cur && list.some((e) => String(e.id) === String(cur.id))) setSel((prev) => prev || String(cur.id));
    });
    return () => { off = true; };
  }, [level]);

  const done = (v) => onResult(v);
  const check = () => {
    if (!sel || !code) {
      setMsg('נדרש אימות מנהל'); setBad(true); setTimeout(() => setBad(false), 600);
      return;
    }
    done({ pin: code, employeeId: sel });
  };
  const list = useMemo(() => emps || [], [emps]);

  return (
    <Dlg layer={2} labelledBy="au-t" onClose={() => done(null)} focusSel=".opt, #auCode">
      <DlgBadge icon="check" />
      <h2 id="au-t">{title}</h2>
      <div className="sub">{message}</div>
      <div className="mfld">
        <span className="lbl" id="auL"><Ic id="user" size="sm" />בחר {level === 'מנהל' ? 'מנהל' : 'מאשר'}</span>
        <div className="ec-mgrs" role="listbox" aria-labelledby="auL">
          {emps === null ? <div className="pr-load"><span className="spin" />טוען רשימת עובדים...</div> : null}
          {emps && !list.length ? <div className="ec-warn"><Ic id="alert" size="sm" /><span>לא נמצאו מאשרים מורשים</span></div> : null}
          {list.map((e) => {
            const on = String(e.id) === sel;
            return (
              <button key={e.id} type="button" className={`opt${on ? ' on' : ''}`} role="option" aria-selected={on} data-ec="au-pick" data-emp={`${e.firstName || ''} ${e.lastName || ''}`.trim()}
                onClick={() => { setSel(String(e.id)); setMsg(''); if (codeRef.current) codeRef.current.focus(); }}>
                <Ic id="user" size="lg" /><div><b>{`${e.firstName || ''} ${e.lastName || ''}`.trim()}</b><small>{(e.department && e.department.name) || ''}</small></div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mfld" style={{ marginTop: 14 }}>
        <label className="lbl" htmlFor="auCode"><Ic id="lock" size="sm" />קוד מנהל</label>
        <input className={`inp${bad ? ' bad' : ''}`} id="auCode" type="password" placeholder="הקלד סיסמה..." autoComplete="new-password" ref={codeRef} value={code}
          onChange={(e) => { setCode(e.target.value); setMsg(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); check(); } }} {...NO_FILL} />
      </div>
      <div className="ec-amsg" id="auMsg" aria-live="polite">{msg ? <><Ic id="alert" size="sm" />{msg}</> : null}</div>
      <div className="dbtns">
        <button type="button" className="btn primary lg block" data-ec="au-ok" onClick={check}><Ic id="check" />אישור</button>
        <button type="button" className="btn ghost block" data-ec="au-no" onClick={() => done(null)}><Ic id="x" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}
