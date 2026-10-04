'use client';

// החלונות של מסכי ההגדרות (עיצוב "סימולציה"): אישור (confirmDlg בעיצוב), "שינויים שלא נשמרו" (שמור והמשך / צא בלי לשמור /
// חזרה לעריכה), אישור הנהלה ראשית / מתכנת כשאין התחברות (החלטות J6 / C3 א'), והטוסט (#toast). רכיבי הפלטה בלבד:
// .scrim > .dlg#dlg כהה (שורש הדף נושא dlg-dark), .dbadge / h2 / .sub / .chg / .dbtns. בלי window.alert / confirm.
// החלונות מוצגים ב-portal לשורש הדף (.gm-ds.gm-st) כדי שהעור הכהה של הפלטה יחול עליהם וכדי שלא יירשו מהשורה שפתחה אותם.

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SPRITE_ID_PREFIX } from '../menu/spriteSymbols';
import { cutTxt } from '@/lib/settingsSimLayout';

/** אייקון מה-sprite המוטמע (#gmi-…). plain = בתוך רכיב עם data-ico (האנימציה של הלחצן, לא של האייקון) — כמו במסך הניהול. */
export function Ic({ id, size, plain }) {
  const cls = `ic${plain ? '' : ` ia-${id} ia-h`}${size ? ` ${size}` : ''}`;
  return (
    <svg className={cls} aria-hidden="true" focusable="false"><use href={`#${SPRITE_ID_PREFIX}${id}`} /></svg>
  );
}

// Escape סוגר, Tab נשאר בתוך החלון, הפוקוס חוזר בסגירה ללחצן שפתח (כמו AttendanceDialogs)
function useDialogKeys(open, dlgRef, onClose, focusSel = '.btn.primary, .btn') {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => { const b = dlgRef.current && dlgRef.current.querySelector(focusSel); if (b) b.focus(); }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !dlgRef.current) return;
      const els = [...dlgRef.current.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (!dlgRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ }
    };
  }, [open, dlgRef, focusSel]);
}

function Portal({ root, children }) {
  if (!root) return null;
  return createPortal(children, root);
}

/** confirmDlg של העיצוב: אייקון, כותרת, שורת משנה, לחצן ראשי + ביטול. k = האנימציה של התג (lid / tilt / breathe / float) */
export function ConfirmDialog({ open, root, heading, sub, okLabel = 'אישור', okIcon = 'check', icon = 'alert', k = 'lid', busy = false, onYes, onNo }) {
  const dlgRef = useRef(null);
  useDialogKeys(open, dlgRef, onNo);
  if (!open) return null;
  return (
    <Portal root={root}>
      <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onNo(); }}>
        <div className="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="st-cf-t" ref={dlgRef}>
          <div className="dbadge" aria-hidden="true" data-k={k}><Ic id={icon} /></div>
          <h2 id="st-cf-t">{heading}</h2>
          {sub ? <div className="sub">{sub}</div> : null}
          <div className="dbtns">
            <button type="button" className="btn primary lg block" onClick={onYes} disabled={busy}><Ic id={okIcon} />{okLabel}</button>
            <button type="button" className="btn ghost block" onClick={onNo} disabled={busy}><Ic id="x" />ביטול</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/** "שינויים שלא נשמרו" — שלושת השינויים הראשונים (שונה X: מ ← אל) ו"ועוד N", שלוש פעולות כמו בעיצוב. */
export function UnsavedDialog({ open, root, items, busy, onSave, onLeave, onStay }) {
  const dlgRef = useRef(null);
  useDialogKeys(open, dlgRef, onStay);
  if (!open) return null;
  const list = items.slice(0, 3);
  const more = items.length - list.length;
  return (
    <Portal root={root}>
      <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onStay(); }}>
        <div className="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="st-us-t" ref={dlgRef}>
          <div className="dbadge" aria-hidden="true" data-k="write"><Ic id="pencil" /></div>
          <h2 id="st-us-t">שינויים שלא נשמרו</h2>
          <div className="chg">
            {list.map((it) => (
              <div className="c" key={it.key}>
                <div className="ico green" style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', flex: 'none' }}><Ic id={it.icon} /></div>
                <div className="t">שונה <b>{it.label}</b><div className="faint sm"><bdi>{cutTxt(it.from)}</bdi> ← <bdi>{cutTxt(it.to)}</bdi></div></div>
              </div>
            ))}
          </div>
          {more > 0 ? <div className="faint sm" style={{ textAlign: 'center', marginBottom: 12 }}>ועוד {more} שינויים</div> : null}
          <div className="dbtns">
            <button type="button" className="btn primary lg block" onClick={onSave} disabled={busy}><Ic id="check" />{busy ? 'שומר…' : 'שמור והמשך'}</button>
            <button type="button" className="btn block" onClick={onLeave} disabled={busy}><Ic id="x" />צא בלי לשמור</button>
            <button type="button" className="btn ghost block" onClick={onStay} disabled={busy}><Ic id="pencil" />חזרה לעריכה</button>
          </div>
        </div>
      </div>
    </Portal>
  );
}

/**
 * אישור הנהלה ראשית / מתכנת כשאין סשן (POST /api/settings החזיר 401) — אותו גוף כמו הישן: { items, employeeId, pin }.
 * הרשימה: GET /api/employees (כמו PopupProvider showAuthPrompt), מסוננת להנהלה ראשית / מתכנת פעילים (roleId 0/2).
 */
export function AuthDialog({ open, root, error, busy, onSubmit, onCancel }) {
  const dlgRef = useRef(null);
  const [emps, setEmps] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [empId, setEmpId] = useState('');
  const [pin, setPin] = useState('');
  useDialogKeys(open, dlgRef, onCancel, '.sizes button, input');
  useEffect(() => {
    if (!open) return undefined;
    setPin('');
    setLoadErr(null);
    const ctrl = new AbortController();
    fetch('/api/employees', { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error((d && d.error) || 'שגיאה בטעינת רשימת המנהלים'); return d; })
      .then((d) => {
        const all = (Array.isArray(d) ? d : []).filter((e) => e && e.isActive !== false);
        // בלי סשן מאומת ה-API מחזיר שמות בלבד (בלי roleId) — אז מוצגים כולם, והשרת בודק את התפקיד בעצמו (HEAD_MANAGEMENT_ROLES)
        const hasRoles = all.some((e) => typeof e.roleId === 'number');
        const list = hasRoles ? all.filter((e) => e.roleId === 0 || e.roleId === 2) : all;
        setEmps(list);
        if (list.length === 1) setEmpId(list[0].id);
      })
      .catch((e) => { if (e && e.name === 'AbortError') return; setEmps([]); setLoadErr(e.message || 'שגיאה בטעינת רשימת המנהלים'); });
    return () => ctrl.abort();
  }, [open]);
  if (!open) return null;
  const submit = (e) => { e.preventDefault(); if (empId && pin && !busy) onSubmit({ employeeId: empId, pin }); };
  return (
    <Portal root={root}>
      <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onCancel(); }}>
        <form className="dlg" id="dlg" role="dialog" aria-modal="true" aria-labelledby="st-au-t" ref={dlgRef} onSubmit={submit}>
          <div className="dbadge" aria-hidden="true" data-k="breathe"><Ic id="lock" /></div>
          <h2 id="st-au-t">אישור הנהלה לשמירה</h2>
          <div className="sub">שמירת ההגדרות דורשת הרשאת הנהלה ראשית או מתכנת. יש לבחור מנהל ולהזין את הסיסמה שלו.</div>
          {emps === null ? (
            <div className="faint sm st-dlg-note">טוען רשימת מנהלים…</div>
          ) : emps.length ? (
            <div className="sizes st-wide-btn st-auth-emps" role="radiogroup" aria-label="בחירת מנהל">
              {emps.map((e) => (
                <button key={e.id} type="button" role="radio" aria-checked={empId === e.id} className={empId === e.id ? 'on' : ''} onClick={() => setEmpId(e.id)}>
                  <span className="ck" aria-hidden="true"><Ic id="check" plain /></span>
                  <Ic id={e.roleId === 2 ? 'gear' : 'shield'} />{e.fullName || [e.firstName, e.lastName].filter(Boolean).join(' ') || 'עובד'}
                </button>
              ))}
            </div>
          ) : (
            <div className="faint sm st-dlg-note">{loadErr || 'לא נמצאו עובדי הנהלה ראשית או מתכנת פעילים.'}</div>
          )}
          <label className="st-auth-pin">
            <span className="sr-only">סיסמה</span>
            <input
              className="inp"
              type="password"
              dir="ltr"
              autoComplete="current-password"
              placeholder="סיסמה"
              aria-label="סיסמת המנהל"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              disabled={busy}
            />
          </label>
          {error ? <div className="st-err st-dlg-note" role="alert">{error}</div> : null}
          <div className="dbtns">
            <button type="submit" className="btn primary lg block" disabled={!empId || !pin || busy}><Ic id="check" />{busy ? 'שומר…' : 'אישור ושמירה'}</button>
            <button type="button" className="btn ghost block" onClick={onCancel} disabled={busy}><Ic id="x" />ביטול</button>
          </div>
        </form>
      </div>
    </Portal>
  );
}

/** #toast של העיצוב (say): כותרת, שורת משנה, סגירה. נעלם אחרי 3.8 שניות. */
export function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(onClose, 3800);
    return () => clearTimeout(t);
  }, [toast, onClose]);
  return (
    <div id="toast" role="status" aria-live="polite" className={toast ? 'info pulse on' : ''}>
      {toast ? (
        <>
          <span className="tb"><Ic id={toast.icon || 'check'} /></span>
          <div><b>{toast.title}</b><small>{toast.sub || ''}</small></div>
          <button type="button" className="tclose" aria-label="סגירה" onClick={onClose}><Ic id="x" /></button>
        </>
      ) : null}
    </div>
  );
}
