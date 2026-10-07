'use client';

// חלון "השלמת פרטי לקוח" באשף "הזמנה חדשה" הישן (דיווח f96f3952, נווה יעקב; מאחורי order_inline_customer_edit).
// במקום קישור שנפתח בכרטיסייה חדשה: אותו מסך, רק השדות שחסרים ללקוח (לא יותר ולא פחות), שמירה דרך PUT /api/customers/[id] הקיים,
// ואז onSaved(הלקוח המעודכן) - האשף בוחר אותו אוטומטית וממשיך. הלוגיקה (איזה שדות / בדיקה / גוף הבקשה) ב-lib/customerInlineEdit.js.
// קובץ נפרד ולא בתוך LegacyNewOrderPage.js כדי לצמצם את השינוי בדף הישן הקפוא (חיווט בלבד שם).
import { useEffect, useRef, useState } from 'react';
import { buildCompletionPlan, initialValues, validateCompletion, saveCustomerCompletion, groupLabel } from '../../../lib/customerInlineEdit';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled])';

export default function CustomerCompleteModal({ customer, missingKeys, groups, saveLabel = 'שמור ובחר את הלקוח', onSaved, onClose }) {
  const [plan] = useState(() => buildCompletionPlan(missingKeys, groups)); // נקבע פעם אחת בפתיחה - רק מה שחסר ברגע שנלחץ "עריכה"
  const [values, setValues] = useState(() => initialValues(plan));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const boxRef = useRef(null);
  const savingRef = useRef(false);
  const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() || 'הלקוח';
  const check = validateCompletion(plan, values, customer);

  // פוקוס: לשדה הראשון בפתיחה, וחזרה לאלמנט שפתח את החלון כשנסגר
  useEffect(() => {
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => {
      const el = boxRef.current && boxRef.current.querySelector('input');
      if (el) el.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      if (opener && opener !== document.body && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    };
  }, []);

  const set = (key, v) => { setServerError(''); setValues(prev => ({ ...prev, [key]: v })); };

  const submit = async () => {
    if (savingRef.current) return;
    setTried(true);
    if (!check.ok) return;
    savingRef.current = true;
    setSaving(true);
    setServerError('');
    try {
      const updated = await saveCustomerCompletion(customer, values);
      onSaved(updated);
    } catch (e) {
      setServerError(e.message || 'שגיאה בשמירת פרטי הלקוח');
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); if (!savingRef.current) onClose(); return; }
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); submit(); return; }
    if (e.key !== 'Tab') return;
    const items = [...boxRef.current.querySelectorAll(FOCUSABLE)].filter(x => x.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  return (
    <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal" ref={boxRef} role="dialog" aria-modal="true" aria-labelledby="cust-complete-title" dir="rtl" style={{ maxWidth: '460px', width: '100%', maxHeight: 'min(90vh, calc(100vh - 68px))' }} onKeyDown={onKeyDown}>
        <div className="modal-head">
          <strong id="cust-complete-title">השלמת פרטי לקוח - {name}</strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה" onClick={onClose} disabled={saving}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>
        <div className="modal-body">
          <p className="hint" style={{ margin: '0 0 14px' }}>
            חסרים ללקוח רק הפרטים האלה. אחרי השמירה הלקוח יתעדכן ויבחר אוטומטית להמשך ההזמנה.
          </p>
          {plan.fields.map((f) => {
            const id = `cust-complete-${f.key}`;
            const err = tried && check.errors[f.key];
            if (f.kind === 'switch') {
              return (
                <div className="field" key={f.key}>
                  <label className="checkbox-row" style={{ cursor: 'pointer' }}>
                    <input id={id} type="checkbox" checked={!!values[f.key]} onChange={e => set(f.key, e.target.checked)} aria-invalid={err ? 'true' : undefined} />
                    <span>{f.label} {f.required && <span style={{ color: 'var(--danger)' }}>*</span>}</span>
                  </label>
                  {err && <span className="error-text" role="alert">{err}</span>}
                </div>
              );
            }
            return (
              <div className="field" key={f.key}>
                <label htmlFor={id}>{f.label} {f.required && <span style={{ color: 'var(--danger)' }}>*</span>}</label>
                <input
                  id={id}
                  className="input"
                  type={f.kind === 'tel' ? 'tel' : 'text'}
                  inputMode={f.kind === 'tel' ? 'tel' : f.kind === 'digits' ? 'numeric' : f.kind === 'email' ? 'email' : undefined}
                  dir={f.ltr ? 'ltr' : undefined}
                  autoComplete="off"
                  value={values[f.key]}
                  onChange={e => set(f.key, e.target.value)}
                  aria-invalid={err ? 'true' : undefined}
                  aria-describedby={err ? `${id}-err` : undefined}
                />
                {err && <span className="error-text" id={`${id}-err`} role="alert">{err}</span>}
              </div>
            );
          })}
          {plan.groups.map((g) => (
            <p key={g.join('|')} className="hint" style={{ margin: '0 0 8px', color: tried && check.groupErrors.length ? 'var(--danger)' : undefined }} role={tried && check.groupErrors.length ? 'alert' : undefined}>
              יש למלא לפחות אחד מבין: {groupLabel(g)}.
            </p>
          ))}
          {serverError && <p className="error-text" role="alert" style={{ margin: '8px 0 0' }}>{serverError}</p>}
          <p className="hint" style={{ margin: '12px 0 0' }}>
            <a href={`/customers/${customer.id}`} target="_blank" rel="noreferrer">עריכה מלאה בכרטיס הלקוח (נפתח בכרטיסייה נפרדת)</a>
          </p>
        </div>
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>ביטול</button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving} aria-busy={saving}>
            {saving ? 'שומר...' : saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
