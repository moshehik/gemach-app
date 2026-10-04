'use client';

// OcApproval — חלון "אישור מנהל" של הכרטיס החדש (D12, בגרסת הבעלים מהעיצוב: pv-main askManagerApproval): רשימה נגללת של העובדים
// המורשים להרשאה המבוקשת לפי מסך ההרשאות (אותה הכרעה כמו customAuthPrompt: approvals[key] / canApproveWithoutPayment מ-GET
// /api/employees) + שדה קוד (אותו סוד ש-verify-pin מקבל היום, כמו בכניסה לאתר) → POST /api/auth/verify-pin עם context
// {orderId, reason, featureKey} (W0 רושם MANAGER_APPROVAL; השרת בודק את ההרשאה מחדש). בלי 4 תיבות ספרות. נעילה בצד לקוח אחרי
// 3 ניסיונות כושלים ל-30 שניות (AMB-07). שכבה 2 (#dlg2) כמו בעיצוב. הקוד לא נשמר, לא נרשם ולא נשלח לשום מקום אחר.
//
// מפת פורט: PopupProvider.js:133-196 (טעינת הרשימה, ברירת מחדל = המשתמש הנוכחי כשמורשה) ; LegacyOrderPage.js:780-806, :820-843,
// :1411-1427, :1479-1494 (verify-pin אחרי customAuthPrompt) — כאן בחלון אחד.
//
// שימוש: const res = await oc.approve('feature:item_change_approval', 'סיבה')  →  {employeeId, employeeName, pin} | null
// (oc.approve פותח את החלון דרך ui.openDialog(OcApprovalDialog, {...}, {layer:2}). pin מוחזר רק כי ה-PUT של ביטול פריט שולח
// managerPin לבדיקה חוזרת בשרת, בדיוק כמו בישן; הקורא לא שומר אותו.)

import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import OcIcon from './OcIcon';
import { DlgBtn, DlgButtons, Field, Inp } from './OcUi';
import { approvalLevelOf, employeeRoleLabel, filterApprovers, APPROVAL_LOCK_MS, APPROVAL_MAX_TRIES } from './orderCardLogic';

export default function OcApprovalDialog({ kind, reason, orderId, close, fetchImpl }) {
  const level = useMemo(() => approvalLevelOf(kind), [kind]);
  const [emps, setEmps] = useState(null); // null = בטעינה
  const [sel, setSel] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null); // {icon, text}
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const tries = useRef(0);
  const codeRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    let off = false;
    Promise.all([
      fetchSharedJson('/api/employees', { ttl: TTL.STATIC }).catch(() => []),
      fetchSharedJson('/api/me', { ttl: TTL.STATIC }).catch(() => null)
    ]).then(([all, me]) => {
      if (off) return;
      const list = filterApprovers(all, level.pickerLevel);
      setEmps(list);
      const cur = me && me.success ? me.employee : null;
      if (cur && list.some(e => e.id === cur.id)) setSel(prev => prev || String(cur.id));
    });
    return () => { off = true; };
  }, [level.pickerLevel]);

  useEffect(() => {
    if (!lockedUntil) return undefined;
    const t = setTimeout(() => { setLockedUntil(0); tries.current = 0; setMsg(null); codeRef.current && codeRef.current.focus(); }, Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [lockedUntil]);

  const locked = lockedUntil > Date.now();
  const canSubmit = !busy && !locked && !!sel && code.trim().length > 0;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setMsg(null);
    const pin = code;
    try {
      const f = fetchImpl || fetch;
      const res = await f('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, employeeId: sel, requiredLevel: level.requiredLevel, context: { orderId: orderId ?? null, reason: reason || '', featureKey: level.featureKey } })
      });
      const data = await res.json().catch(() => ({}));
      if (data && data.success) {
        const emp = (emps || []).find(e => String(e.id) === String(sel));
        close({ employeeId: data.employeeId || sel, employeeName: data.employeeName || (emp ? `${emp.firstName} ${emp.lastName}` : ''), pin });
        return;
      }
      tries.current += 1;
      setCode('');
      if (tries.current >= APPROVAL_MAX_TRIES) {
        setLockedUntil(Date.now() + APPROVAL_LOCK_MS);
        setMsg({ icon: 'lock', text: 'ניסיונות רבים · נסו שוב בעוד 30 שניות' });
      } else {
        setMsg({ icon: 'alert', text: (data && data.error) || 'קוד שגוי' });
        setTimeout(() => codeRef.current && codeRef.current.focus(), 0);
      }
    } catch {
      setMsg({ icon: 'alert', text: 'שגיאה באימות הקוד' });
    } finally {
      setBusy(false);
    }
  };

  // ניווט מקלדת ברשימה (listbox): חצים למעלה/למטה
  const onListKey = (e) => {
    if (!emps || !emps.length || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
    e.preventDefault();
    const i = Math.max(0, emps.findIndex(x => String(x.id) === String(sel)));
    const n = e.key === 'ArrowDown' ? Math.min(emps.length - 1, i + 1) : Math.max(0, i - 1);
    setSel(String(emps[n].id));
    const btn = listRef.current && listRef.current.querySelectorAll('.opt')[n];
    btn && btn.focus();
  };

  return (
    <div className="oc-appr">
      <h2 id="oc-appr-t">אישור מנהל</h2>
      <div className="sub">{reason || 'נדרש אישור מנהל'}</div>
      <div className="mfld">
        <span className="lbl" id="oc-appr-emps-l"><OcIcon name="user" size="sm" />שם משתמש</span>
        <div className="dbtns oc-emps" role="listbox" aria-labelledby="oc-appr-emps-l" ref={listRef} onKeyDown={onListKey}>
          {emps === null ? (
            <div className="faint oc-emps-wait" role="status">טוען רשימת עובדים...</div>
          ) : emps.length === 0 ? (
            <div className="faint oc-emps-wait" role="status">אין עובדים מורשים להרשאה זו לפי מסך ההרשאות.</div>
          ) : emps.map(e => {
            const on = String(e.id) === String(sel);
            return (
              <button
                key={e.id}
                type="button"
                className={`opt${on ? ' on' : ''}`}
                role="option"
                aria-selected={on}
                tabIndex={on || (!sel && e === emps[0]) ? 0 : -1}
                onClick={() => { setSel(String(e.id)); setTimeout(() => codeRef.current && codeRef.current.focus(), 0); }}
              >
                <OcIcon name="user" size="lg" />
                <div><b>{e.firstName} {e.lastName}</b><small>{employeeRoleLabel(e)}</small></div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="oc-appr-code">
        <Field label="קוד" icon="lock" htmlFor="oc-appr-code">
          <Inp
            id="oc-appr-code"
            ref={codeRef}
            type="password"
            name="oc-appr-nofill"
            autoComplete="new-password"
            value={code}
            disabled={locked}
            data-autofocus={sel ? 'true' : undefined}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat) { e.preventDefault(); submit(); } }}
          />
        </Field>
      </div>
      <div className="amsg" aria-live="polite">{msg ? <><OcIcon name={msg.icon} size="sm" />{msg.text}</> : null}</div>
      <div className="faint oc-appr-hint">הרשימה לפי ההגדרות במסך הרשאות</div>
      <DlgButtons>
        <DlgBtn kind="primary" icon="check" disabled={!canSubmit} onClick={submit}>אשר</DlgBtn>
        <DlgBtn kind="ghost" icon="back" onClick={() => close(null)}>חזרה</DlgBtn>
      </DlgButtons>
    </div>
  );
}
OcApprovalDialog.ocLayer = 2;
