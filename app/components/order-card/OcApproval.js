'use client';

// OcApproval — חלון "אישור מנהל" של הכרטיס החדש (D12, בגרסת הבעלים מהעיצוב: pv-main askManagerApproval; D7 2026-10-05: בורר נפתח במקום כל השמות על המסך): בחירה מרשימה נגללת של העובדים
// המורשים להרשאה המבוקשת לפי מסך ההרשאות (אותה הכרעה כמו customAuthPrompt: approvals[key] / canApproveWithoutPayment מ-GET
// /api/employees) + שדה קוד (אותו סוד ש-verify-pin מקבל היום, כמו בכניסה לאתר) → POST /api/auth/verify-pin עם context
// {orderId, reason} (חוזה W0 §1.2: השרת רושם MANAGER_APPROVAL ובודק את ההרשאה מחדש; לחוב featureKey='feature:debt_approval' בשרת). בלי 4 תיבות ספרות. נעילה בצד לקוח אחרי
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
import { approvalLevelOf, employeeRoleLabel, filterApprovers, verifyPinBody, APPROVAL_LOCK_MS, APPROVAL_MAX_TRIES } from './orderCardLogic';

// D7 (בעלים 2026-10-05): "אל תציג את כל השמות אלא בחירה מרשימה נגללת של המערכת" - בורר נפתח (combobox) במקום כל המורשים כשורות/צ'יפים:
// לחצן שמציג את המאשר שנבחר + רשימה נגללת (max-height של .advlist מהפלטה) של העובדים המורשים מ-GET /api/employees (מסנן ההרשאות הקיים,
// בלי הרשאות חדשות). מקלדת: חצים / Home / End / Enter / Escape (סוגר רק את הרשימה כשהיא פתוחה - ר' data-oc-esc ב-OcUi).
function ApproverPicker({ emps, sel, onPick, labelId }) {
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(-1);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const listRef = useRef(null);
  const pointerIn = useRef(false); // לחיצה (גם על פס הגלילה של הרשימה) בתוך הבורר - לא נחשבת כיציאת המוקד
  const list = emps || [];
  const cur = list.find((e) => String(e.id) === String(sel)) || null;
  const empty = emps !== null && list.length === 0;
  const optId = (i) => `oc-appr-opt-${i}`;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open || act < 0 || !listRef.current) return;
    const el = listRef.current.querySelectorAll('[role="option"]')[act];
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
  }, [open, act]);

  // המוקד עבר לשדה הקוד (Tab) / מחוץ לבורר -> הרשימה נסגרת (לא נשארת פתוחה מעל השדה). לחיצה בתוך הבורר (אפשרות / פס גלילה) לא סוגרת.
  const onBlur = (e) => {
    if (pointerIn.current) return;
    if (wrapRef.current && e.relatedTarget && wrapRef.current.contains(e.relatedTarget)) return;
    setOpen(false);
  };
  const onPointerDown = () => {
    pointerIn.current = true;
    document.addEventListener('mouseup', () => {
      pointerIn.current = false;
      if (btnRef.current && wrapRef.current && !wrapRef.current.contains(document.activeElement)) btnRef.current.focus();
    }, { once: true });
  };

  const show = () => { if (!list.length) return; setAct(Math.max(0, list.findIndex((e) => String(e.id) === String(sel)))); setOpen(true); };
  const choose = (i) => { const e = list[i]; if (!e) return; setOpen(false); onPick(e.id); };
  const onKey = (e) => {
    if (!list.length) return;
    if (e.key === 'Escape') { if (open) { e.preventDefault(); e.stopPropagation(); setOpen(false); } return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { show(); return; }
      setAct((a) => (e.key === 'ArrowDown' ? Math.min(list.length - 1, a + 1) : Math.max(0, a - 1)));
    } else if (e.key === 'Home' && open) { e.preventDefault(); setAct(0); }
    else if (e.key === 'End' && open) { e.preventDefault(); setAct(list.length - 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && open) { e.preventDefault(); choose(act >= 0 ? act : 0); }
  };

  return (
    <div className="oc-appr-pick" ref={wrapRef} onBlur={onBlur} onMouseDown={onPointerDown}>
      <button
        type="button" ref={btnRef} id="oc-appr-sel" className="inp oc-appr-sel" role="combobox" data-oc-esc="own"
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? 'oc-appr-list' : undefined} aria-labelledby={`${labelId} oc-appr-sel`}
        aria-activedescendant={open && act >= 0 ? optId(act) : undefined}
        disabled={emps === null || empty}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKey}
      >
        <OcIcon name="user" size="sm" />
        {emps === null ? <span className="faint" role="status">טוען רשימת עובדים...</span>
          : empty ? <span className="faint" role="status">אין עובדים מורשים להרשאה זו לפי מסך ההרשאות.</span>
            : cur ? <span className="oc-appr-cur"><b>{cur.firstName} {cur.lastName}</b><small>{employeeRoleLabel(cur)}</small></span>
              : <span className="faint">בחרו מאשר מהרשימה</span>}
        <OcIcon name="chev" size="sm" className="oc-appr-chev" />
      </button>
      {open ? (
        <ul className="advlist" id="oc-appr-list" role="listbox" aria-labelledby={labelId} ref={listRef}>
          {list.map((e, i) => (
            <li key={e.id} id={optId(i)} role="option" aria-selected={String(e.id) === String(sel)} className={`advo${i === act ? ' act' : ''}`}
              onMouseDown={(ev) => ev.preventDefault()} onMouseEnter={() => setAct(i)} onClick={() => choose(i)}>
              <span className="advo-t"><b>{e.firstName} {e.lastName}</b><small className="faint oc-advcode"> · {employeeRoleLabel(e)}</small></span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function OcApprovalDialog({ kind, reason, orderId, close, fetchImpl }) {
  const level = useMemo(() => approvalLevelOf(kind), [kind]);
  const [emps, setEmps] = useState(null); // null = בטעינה
  const [sel, setSel] = useState('');
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState(null); // {icon, text}
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const tries = useRef(0);
  const codeRef = useRef(null);

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
    if (!locked) return undefined;
    const t = setTimeout(() => { setLocked(false); tries.current = 0; setMsg(null); codeRef.current && codeRef.current.focus(); }, APPROVAL_LOCK_MS);
    return () => clearTimeout(t);
  }, [locked]);

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
        body: JSON.stringify(verifyPinBody({ pin, employeeId: sel, requiredLevel: level.requiredLevel, orderId, reason }))
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
        setLocked(true);
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

  return (
    <>
      <h2 id="oc-appr-t">אישור מנהל</h2>
      <div className="sub">{reason || 'נדרש אישור מנהל'}</div>
      <div className="mfld oc-appr-fld">
        <span className="lbl" id="oc-appr-emps-l"><OcIcon name="user" size="sm" />שם משתמש</span>
        <ApproverPicker emps={emps} sel={sel} labelId="oc-appr-emps-l" onPick={(id) => { setSel(String(id)); setTimeout(() => codeRef.current && codeRef.current.focus(), 0); }} />
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
    </>
  );
}
OcApprovalDialog.ocLayer = 2;
// החלון נפתח עם className 'oc-appr' על #dlg2 (ר' approve ב-useOrderCardController) - כך ה-h2 הוא ילד ישיר של החלון ומקבל את
// תג האייקון של העיצוב (.dbadge, OcUi).
