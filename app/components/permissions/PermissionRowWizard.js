'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import GroupPagePicker from './GroupPagePicker';
import EmployeeTag, { employeeDisplayName } from './EmployeeTag';
import ItemLabel from './ItemInfo';

// Create/edit wizard for one row of /admin/permissions (PermissionsClient.js). One
// unified table holds pages AND features, so a row can mix both. Five steps:
//   1 שם  →  2 עמודים/פיצ'רים  →  3 מחלקות  →  4 עובדים ספציפיים  →  5 אישור
// Steps 1-2 must be valid before moving on; 3-4 have smart defaults/explanations; step 5
// is a read-only summary with warnings (enforced features, items shared with other rows,
// nobody allowed) and the actual save. `group` is null for a new row, else the row edited
// (all steps reachable right away when editing).
const STEPS = ['שם', 'עמודים ופיצ\'רים', 'מחלקות', 'עובדים ספציפיים', 'אישור'];

export default function PermissionRowWizard({ group, catalog, allGroups, departments, employees, onClose, onSaved }) {
  const isEditing = !!group;
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(isEditing ? STEPS.length - 1 : 0);
  const [name, setName] = useState(group?.name || '');
  const [keys, setKeys] = useState(group?.keys ? [...group.keys] : []);
  const [access, setAccess] = useState(() => {
    const initial = {};
    for (const dept of departments) initial[dept.roleId] = !!group?.access?.[dept.roleId];
    return initial;
  });
  const [accessTouched, setAccessTouched] = useState(isEditing);
  const [employeeIds, setEmployeeIds] = useState(() => new Set(group?.employeeAccess || []));
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const itemFor = (key) => catalog.find((item) => item.key === key);
  const selectedItems = keys.map(itemFor).filter(Boolean);

  // key -> names of the OTHER rows that also hold it. A key may sit in several rows: it
  // is highlighted, and the real access is the union of those rows (lenient — if any row
  // allows a department/employee, they're in). See lib/permissionPageGroups.js.
  const otherRowsByKey = new Map();
  for (const g of allGroups || []) {
    if (g.id === group?.id) continue;
    for (const k of g.keys) otherRowsByKey.set(k, [...(otherRowsByKey.get(k) || []), g.name]);
  }
  // Number-type items (feature:export_max_rows) have no yes/no to set from a row, so
  // they aren't offered (managed from the employee's own permissions card).
  const availableToAdd = catalog
    // notConfigurable items (locked to head management / no login) have nothing to configure here
    .filter((item) => item.type === 'boolean' && !item.notConfigurable && !keys.includes(item.key))
    .map((item) => ({ ...item, alsoIn: otherRowsByKey.get(item.key) }));

  const defaultsFor = (itemList) => {
    const next = {};
    for (const dept of departments) next[dept.roleId] = itemList.length > 0 && itemList.every((item) => !!item.defaultForRoleId?.(dept.roleId));
    return next;
  };

  const addKey = (key) => {
    if (!key || keys.includes(key)) return;
    // First item of a brand-new row, toggles untouched: start them from that item's
    // current default so saving can't silently revoke today's access.
    if (!isEditing && !accessTouched && keys.length === 0) setAccess(defaultsFor([itemFor(key)].filter(Boolean)));
    setKeys([...keys, key]);
  };
  const removeKey = (key) => setKeys(keys.filter((k) => k !== key));
  const toggleAccess = (roleId) => { setAccessTouched(true); setAccess((prev) => ({ ...prev, [roleId]: !prev[roleId] })); };
  const setAllAccess = (value) => { setAccessTouched(true); setAccess(Object.fromEntries(departments.map((d) => [d.roleId, value]))); };
  const resetToDefaults = () => { setAccessTouched(true); setAccess(defaultsFor(selectedItems)); };

  // Employee step: only a boolean, non-legacy item can carry an EmployeePermissionOverride.
  const eligibleForEmployeeAccess = selectedItems.some((item) => item.type === 'boolean' && !item.legacyEmployeeField);
  const legacyItemsInRow = selectedItems.filter((item) => item.legacyEmployeeField);
  const employeeSearchResults = (employees || []).filter((emp) => {
    if (employeeIds.has(emp.id)) return false;
    const q = employeeQuery.trim().toLowerCase();
    return !q || employeeDisplayName(emp).toLowerCase().includes(q);
  });
  const selectedEmployees = (employees || []).filter((emp) => employeeIds.has(emp.id));
  const addEmployee = (id) => setEmployeeIds((prev) => new Set(prev).add(id));
  const removeEmployee = (id) => setEmployeeIds((prev) => { const next = new Set(prev); next.delete(id); return next; });

  const validateStep = (index) => {
    if (index === 0 && !name.trim()) return 'יש להזין שם לשורה';
    if (index === 1 && keys.length === 0) return 'יש לצרף לפחות עמוד או פיצ\'ר אחד לשורה';
    return null;
  };
  const goTo = (target) => {
    // Moving forward: every step before the target must be valid.
    if (target > step) {
      for (let i = step; i < target; i++) {
        const problem = validateStep(i);
        if (problem) { setError(problem); setStep(i); return; }
      }
    }
    setError(null);
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
  };

  const allowedDepartments = departments.filter((d) => access[d.roleId]);
  const hasEnforced = selectedItems.some((item) => item.enforced);
  const hasDocOnly = selectedItems.some((item) => !item.enforced);
  const sharedItems = selectedItems.filter((item) => otherRowsByKey.has(item.key));
  const nobodyAllowed = allowedDepartments.length === 0 && selectedEmployees.length === 0;

  const handleSave = async () => {
    const problem = validateStep(0) || validateStep(1);
    if (problem) { setError(problem); setStep(validateStep(0) ? 0 : 1); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isEditing ? `/api/admin/permissions/page-groups/${group.id}` : '/api/admin/permissions/page-groups', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, keys, access, employeeIds: eligibleForEmployeeAccess ? [...employeeIds] : [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!(await window.customConfirm(`למחוק את השורה "${group.name}"? העמודים והפיצ'רים שבה יחזרו להרשאת ברירת המחדל שלהם (למעט אלה שמופיעים גם בשורה אחרת).`))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/permissions/page-groups/${group.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה במחיקה');
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message || 'שגיאה במחיקה');
    } finally {
      setSaving(false);
    }
  };

  const hint = { fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px', lineHeight: 1.6 };
  const itemChip = (item) => {
    const alsoIn = otherRowsByKey.get(item.key);
    return (
      <span
        key={item.key}
        className="chip"
        title={alsoIn ? `מופיע גם בשורה: ${alsoIn.join(', ')}` : undefined}
        style={alsoIn ? { background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))', fontWeight: 700 } : undefined}
      >
        {alsoIn && <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-link" /></svg>}
        <ItemLabel item={item} />
        {step === 1 && (
          <button
            type="button"
            onClick={() => removeKey(item.key)}
            disabled={saving}
            title="הסר מהשורה"
            aria-label="הסר מהשורה"
            style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
          >
            <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-x" /></svg>
          </button>
        )}
      </span>
    );
  };

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>שם השורה</label>
          <div style={hint}>שם שיעזור לזהות מיד על מה השורה — לדוגמה &quot;דפי ניהול מלאי&quot; או &quot;אישור הזמנות בחוב&quot;.</div>
          <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') goTo(1); }} placeholder="שם השורה" disabled={saving} />
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>עמודים ופיצ&apos;רים בשורה</label>
          <div style={hint}>
            אפשר לשלב עמודים ופיצ&apos;רים באותה שורה. לחיצה על שם עמוד פותחת אותו בטאב חדש, והאיקון מסביר מה הפריט עושה ומה שולט בו היום.
            פריט שכבר נמצא בשורה אחרת יודגש — הוא יכול להופיע בכמה שורות, והגישה בפועל מותרת אם לפחות שורה אחת מתירה אותה.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
            {selectedItems.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>עדיין לא נבחרו פריטים</span>}
            {selectedItems.map(itemChip)}
          </div>
          {availableToAdd.length > 0
            ? <GroupPagePicker items={availableToAdd} onAdd={addKey} />
            : <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>כל הפריטים כבר משובצים לשורה זו</span>}
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>אילו מחלקות מורשות</label>
          <div style={hint}>חל בבת אחת על כל הפריטים בשורה. התג ליד כל מחלקה מראה מה ברירת המחדל של המערכת היום עבורה. הנהלה ראשית ומתכנת תמיד מורשים לכל דבר (למעט מה שמוגבל למתכנת בלבד), ולכן אינם מופיעים ברשימה.</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllAccess(true)} disabled={saving}>סמן הכל</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAllAccess(false)} disabled={saving}>נקה הכל</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={resetToDefaults} disabled={saving || selectedItems.length === 0}>
              <svg className="icon"><use href="#i-refresh" /></svg>אפס לברירת המחדל
            </button>
          </div>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            {departments.map((dept) => {
              const defaultAllows = selectedItems.length > 0 && selectedItems.every((item) => !!item.defaultForRoleId?.(dept.roleId));
              return (
                <div key={dept.roleId} className="select-row">
                  <span style={{ flex: 1 }}>{dept.name}</span>
                  {selectedItems.length > 0 && (
                    <span className={defaultAllows ? 'badge badge-success' : 'badge badge-neutral'} style={{ fontSize: '10.5px' }}>
                      {defaultAllows ? 'מותר כיום' : 'לא מותר כיום'}
                    </span>
                  )}
                  <div className={access[dept.roleId] ? 'switch on' : 'switch'} onClick={() => !saving && toggleAccess(dept.roleId)} />
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="field" style={{ marginBottom: 0 }}>
          <label>עובדים ספציפיים עם גישה (לא חובה)</label>
          {eligibleForEmployeeAccess ? (
            <>
              <div style={hint}>עובד שנבחר כאן מקבל גישה לפריטי השורה גם אם המחלקה שלו כבויה בשלב הקודם. זה יופיע גם ב&quot;הרשאות ספציפיות&quot; בכרטיס העובד שלו. אפשר לדלג.</div>
              {legacyItemsInRow.length > 0 && (
                <div className="callout callout-warning" style={{ marginBottom: '10px' }}>
                  <svg className="icon"><use href="#i-alert-tri" /></svg>
                  {legacyItemsInRow.map((item) => item.label).join(', ')} לא יינתנו לעובדים שנבחרו כאן: פריט כזה מוענק לעובד ספציפי רק בתיבת הסימון שלו בכרטיס העובד.
                </div>
              )}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {selectedEmployees.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>לא נבחרו עובדים ספציפיים</span>}
                {selectedEmployees.map((emp) => <EmployeeTag key={emp.id} employee={emp} onRemove={() => removeEmployee(emp.id)} disabled={saving} />)}
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                <div style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>
                  <input className="input" style={{ height: '34px' }} value={employeeQuery} onChange={(e) => setEmployeeQuery(e.target.value)} placeholder="חיפוש עובד..." disabled={saving} />
                </div>
                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {employeeSearchResults.length === 0 && <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-3)' }}>לא נמצאו תוצאות</div>}
                  {employeeSearchResults.map((emp) => (
                    <div key={emp.id} className="combobox-option" onClick={() => !saving && addEmployee(emp.id)}>
                      <span style={{ flex: 1 }}>{employeeDisplayName(emp)} {emp.department?.name ? `— ${emp.department.name}` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="callout callout-info">
              אף פריט בשורה הזו לא תומך בהרשאה פרטנית לעובד (פריטים שמנוהלים מכרטיס העובד עצמו, כמו שימוש ב-AI ודיווח על תקלות, לא נתמכים כאן). אפשר להמשיך לשלב האישור.
            </div>
          )}
        </div>
      );
    }

    // step 4 — summary
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <div style={{ ...hint, marginBottom: '2px' }}>שם השורה</div>
          <strong>{name.trim() || '—'}</strong>
        </div>
        <div>
          <div style={{ ...hint, marginBottom: '4px' }}>עמודים ופיצ&apos;רים ({selectedItems.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{selectedItems.map(itemChip)}</div>
        </div>
        <div>
          <div style={{ ...hint, marginBottom: '4px' }}>מחלקות מורשות</div>
          {allowedDepartments.length === 0
            ? <span className="badge badge-neutral">אף מחלקה</span>
            : allowedDepartments.length === departments.length
              ? <span className="badge badge-success"><svg className="icon"><use href="#i-check" /></svg>כל המחלקות</span>
              : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{allowedDepartments.map((d) => <span key={d.roleId} className="badge badge-primary">{d.name}</span>)}</div>}
        </div>
        <div>
          <div style={{ ...hint, marginBottom: '4px' }}>עובדים ספציפיים</div>
          {eligibleForEmployeeAccess && selectedEmployees.length > 0
            ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{selectedEmployees.map((emp) => <EmployeeTag key={emp.id} employee={emp} />)}</div>
            : <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>ללא</span>}
        </div>

        {hasEnforced && (
          <div className="callout callout-warning">
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            השורה כוללת פריטים שנאכפים <strong>בפועל</strong> — שמירה משנה מיד את מי שמורשה (עמוד שנשלל ממחלקה נחסם גם בכניסה ישירה בכתובת, ונעלם מהתפריט).
          </div>
        )}
        {hasEnforced && nobodyAllowed && (
          <div className="callout callout-danger">
            <svg className="icon"><use href="#i-alert-circle" /></svg>
            לא נבחרה אף מחלקה ואף עובד — הפריטים שבשורה ייחסמו לכולם (חוץ מהנהלה ראשית ומתכנת).
          </div>
        )}
        {hasDocOnly && (
          <div className="callout callout-info">
            <svg className="icon"><use href="#i-info" /></svg>
            עמודים המסומנים &quot;לתיעוד בלבד&quot; נשמרים לתיעוד בלבד — הגישה בפועל אליהם נשארת כמו שהיא היום ולא תשתנה.
          </div>
        )}
        {sharedItems.length > 0 && (
          <div className="callout callout-info">
            <svg className="icon"><use href="#i-link" /></svg>
            {sharedItems.map((item) => item.label).join(', ')} מופיע גם בשורה אחרת — הגישה בפועל היא האיחוד של כל השורות (מותר אם אחת מהן מתירה).
          </div>
        )}
      </div>
    );
  };

  const isLast = step === STEPS.length - 1;

  const content = (
    <div
      className="modal-backdrop"
      onClick={() => !saving && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="modal animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ width: '92%', maxWidth: '640px', maxHeight: '88vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-shield" /></svg>
            {isEditing ? 'עריכת שורת הרשאה' : 'שורת הרשאה חדשה'}
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={onClose} title="סגירה" aria-label="סגירה">
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 20px 4px', overflowX: 'auto' }}>
          {STEPS.map((label, index) => {
            const reachable = index <= maxStep;
            const done = index < step;
            const active = index === step;
            return (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: index === STEPS.length - 1 ? '0 0 auto' : '1 1 auto', minWidth: 0 }}>
                <button
                  type="button"
                  onClick={() => reachable && !saving && goTo(index)}
                  disabled={!reachable || saving}
                  title={label}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', border: 'none', background: 'none', padding: 0,
                    cursor: reachable ? 'pointer' : 'default', font: 'inherit', color: active ? 'var(--primary)' : 'var(--text-2)', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    width: '24px', height: '24px', borderRadius: '50%', flex: '0 0 auto', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                    background: active ? 'var(--primary)' : done ? 'var(--success-tint)' : 'var(--surface-sunken)',
                    color: active ? 'var(--surface, #fff)' : done ? 'var(--success)' : 'var(--text-3)',
                  }}>
                    {done && !active ? <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-check" /></svg> : index + 1}
                  </span>
                  <span style={{ fontSize: '12.5px', fontWeight: active ? 700 : 500, opacity: reachable ? 1 : 0.6 }}>{label}</span>
                </button>
                {index < STEPS.length - 1 && <span style={{ flex: 1, height: '1px', minWidth: '10px', background: 'var(--border)' }} />}
              </div>
            );
          })}
        </div>

        <div className="modal-body" style={{ overflowY: 'auto', minHeight: '260px' }}>
          {error && <div className="callout callout-danger" style={{ marginBottom: '14px' }}>{error}</div>}
          {renderStep()}
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          {isEditing ? (
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleDelete} disabled={saving}>
              <svg className="icon"><use href="#i-trash" /></svg>מחק שורה
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: '8px' }}>
            {step === 0
              ? <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>ביטול</button>
              : <button type="button" className="btn btn-secondary" onClick={() => goTo(step - 1)} disabled={saving}>הקודם</button>}
            {isLast ? (
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <span className="spinner" /> : <svg className="icon"><use href="#i-check" /></svg>}
                {isEditing ? 'עדכון השורה' : 'יצירת השורה'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => goTo(step + 1)} disabled={saving}>הבא</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
