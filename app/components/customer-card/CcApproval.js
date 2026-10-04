'use client';

// CcApproval — חלון "אישור מנהל" של כרטיס הלקוח החדש. הבעלים (appr4 / apprreal / PG1, 4.10.2026): לא קוד 4 ספרות - בחירת שם
// מנהל + סיסמה (העיצוב הקיים במערכת, customAuthPrompt), "חלון כהה עם רשימה נגללת מודרנית של האתר + סינון השמות של העובדים שאין
// להם את רמת ההרשאה הנדרשת". המבנה: apprwin של העיצוב (ashield, כותרת, תת-כותרת) + חיפוש שם + רשימה נגללת (listbox) של העובדים
// המורשים בלבד (אותה הכרעה כמו customAuthPrompt: approvals[key] / תפקיד, מ-GET /api/employees) + שדה סיסמה.
// האימות בשרת: POST /api/customers/[id]/events {action:'MANAGER_APPROVAL', approval:{employeeId,pin,requiredLevel}, meta:{reason}}
// (lib/history/customerEvents.js) - אותם כללים כמו /api/auth/verify-pin, ונרשמת שורת "אישור מנהל" בהיסטוריית הלקוח.
// נעילה בצד לקוח אחרי 3 ניסיונות כושלים ל-30 שניות. שכבה 2 (#dlg2). הסיסמה לא נשמרת ולא נרשמת; היא מוחזרת לקורא רק כי
// שליחת מייל (POST /api/send-email, username/password) ומחיקה (DELETE, approverPin) בודקות אותה שוב בשרת - בדיוק כמו בישן.
//
// שימוש: const res = await ui.openDialog(CcApprovalDialog, { level, reason, customerId }, { layer: 2, className: 'apprwin', labelledBy: 'cc-appr-t' })
//        → {employeeId, employeeName, pin} | null

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import CcIcon from './CcIcon';
import { DlgBtn, DlgButtons, NO_FILL } from './CcUi';
import { filterApprovers, employeeRoleLabel, APPROVAL_LOCK_MS, APPROVAL_MAX_TRIES } from './customerCardLogic';
import { postCustomerEvent } from './ccEvents';

export default function CcApprovalDialog({ level, reason, customerId, close }) {
  const [emps, setEmps] = useState(null); // null = בטעינה
  const [q, setQ] = useState('');
  const [sel, setSel] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null); // {icon, text}
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [okName, setOkName] = useState('');
  const tries = useRef(0);
  const codeRef = useRef(null);
  const listRef = useRef(null);

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

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const t = setTimeout(() => { setLockedUntil(0); tries.current = 0; setMsg(null); if (codeRef.current) codeRef.current.focus(); }, Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [lockedUntil]);

  const shown = useMemo(() => {
    const w = q.trim();
    if (!emps) return null;
    return w ? emps.filter((e) => `${e.firstName || ''} ${e.lastName || ''}`.includes(w)) : emps;
  }, [emps, q]);

  const locked = lockedUntil > Date.now();
  const canSubmit = !busy && !locked && !!sel && code.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    const pin = code;
    try {
      const { ok, data } = await postCustomerEvent(customerId, {
        action: 'MANAGER_APPROVAL',
        meta: { reason: reason || '' },
        approval: { employeeId: sel, pin, requiredLevel: level },
      });
      if (ok && data && data.ok) {
        const emp = (emps || []).find((e) => String(e.id) === String(sel));
        const name = data.approverName || (emp ? `${emp.firstName} ${emp.lastName}` : '');
        setOkName(name);
        setTimeout(() => close({ employeeId: data.approverId || sel, employeeName: name, pin }), 450);
        return;
      }
      tries.current += 1;
      setCode('');
      if (tries.current >= APPROVAL_MAX_TRIES) {
        setLockedUntil(Date.now() + APPROVAL_LOCK_MS);
        setMsg({ icon: 'lock', text: 'נסיונות רבים · נסו שוב בעוד 30 שניות' });
      } else {
        setMsg({ icon: 'alert', text: (data && data.error) || 'סיסמה שגויה' });
        setTimeout(() => codeRef.current && codeRef.current.focus(), 0);
      }
    } catch {
      setMsg({ icon: 'alert', text: 'שגיאה באימות מול השרת' });
    } finally {
      setBusy(false);
    }
  };

  // ניווט מקלדת ברשימה (listbox): חצים למעלה/למטה
  const onListKey = (e) => {
    if (!shown || !shown.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const i = Math.max(0, shown.findIndex((x) => String(x.id) === String(sel)));
    const n = e.key === 'ArrowDown' ? Math.min(shown.length - 1, i + 1) : Math.max(0, i - 1);
    setSel(String(shown[n].id));
    const btn = listRef.current && listRef.current.querySelectorAll('.opt')[n];
    if (btn) btn.focus();
  };

  return (
    <div className="appr">
      <div className="ashield" aria-hidden="true"><CcIcon name="shield" size="lg" anim={false} /></div>
      <h2 id="cc-appr-t">אישור מנהל</h2>
      <div className="sub">{reason || 'נדרש אישור מנהל'}</div>
      {emps && emps.length > 6 ? (
        <div className="mfld cc-appr-q">
          <div className="inpw">
            <CcIcon name="search" size="sm" />
            <input className="inp" type="search" placeholder="חיפוש שם..." aria-label="חיפוש מנהל" value={q} onChange={(e) => setQ(e.target.value)} {...NO_FILL} />
          </div>
        </div>
      ) : null}
      <div className="mfld">
        <span className="lbl" id="cc-appr-emps-l"><CcIcon name="user" size="sm" />בחירת מנהל</span>
        <div className="dbtns cc-emps" role="listbox" aria-labelledby="cc-appr-emps-l" ref={listRef} onKeyDown={onListKey}>
          {shown === null ? (
            <div className="faint cc-emps-wait" role="status">טוען רשימת עובדים...</div>
          ) : shown.length === 0 ? (
            <div className="faint cc-emps-wait" role="status">{emps.length ? 'אין עובד בשם הזה ברשימה.' : 'אין עובדים מורשים להרשאה זו לפי מסך ההרשאות.'}</div>
          ) : shown.map((e, idx) => {
            const on = String(e.id) === String(sel);
            return (
              <button
                key={e.id}
                type="button"
                className={`opt${on ? ' on' : ''}`}
                role="option"
                aria-selected={on}
                tabIndex={on || (!sel && idx === 0) ? 0 : -1}
                onClick={() => { setSel(String(e.id)); setTimeout(() => codeRef.current && codeRef.current.focus(), 0); }}
              >
                <span className="av" aria-hidden="true">{(e.firstName || '?').trim().charAt(0)}</span>
                <div><b>{e.firstName} {e.lastName}</b><small>{employeeRoleLabel(e)}</small></div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="mfld cc-appr-code">
        <label className="lbl" htmlFor="cc-appr-code"><CcIcon name="lock" size="sm" />סיסמה</label>
        <input
          id="cc-appr-code"
          ref={codeRef}
          className="inp"
          type="password"
          name="cc-appr-nofill"
          {...NO_FILL}
          autoComplete="new-password"
          value={code}
          disabled={locked || !!okName}
          data-autofocus={sel ? 'true' : undefined}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }}
        />
      </div>
      <div className="amsg" id="appr-msg" aria-live="polite">{msg ? <><CcIcon name={msg.icon} size="sm" />{msg.text}</> : null}</div>
      {okName ? (
        <div className="amgr" id="appr-mgr"><span className="av">{okName.charAt(0)}</span><b>{okName}</b><span className="amck"><CcIcon name="check" size="sm" /></span></div>
      ) : null}
      <div className="ahint">הרשימה לפי ההגדרות במסך ההרשאות</div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" disabled={!canSubmit || !!okName} act="appr-ok" onClick={submit}>{busy ? 'בודק…' : 'אשר'}</DlgBtn>
        <DlgBtn kind="ghost" icon="back" act="appr-back" onClick={() => close(null)}>חזרה</DlgBtn>
      </DlgButtons>
    </div>
  );
}
CcApprovalDialog.ccLayer = 2;
