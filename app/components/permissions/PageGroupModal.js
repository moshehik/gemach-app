'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import GroupPagePicker from './GroupPagePicker';
import EmployeeTag, { employeeDisplayName } from './EmployeeTag';

// Floating panel for creating/editing one row of the pages or features table on
// /admin/permissions/PermissionsClient.js (`catalogGroup` picks which). A row
// bundles one or more same-group PERMISSION_CATALOG keys under one name; saving
// pushes the chosen department access to every attached key at once
// (app/api/admin/permissions/page-groups/**). `group` is null for a brand-new row,
// or the row being edited.
export default function PageGroupModal({ group, catalogGroup, catalog, allGroups, departments, employees, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || '');
  const [keys, setKeys] = useState(group?.keys ? [...group.keys] : []);
  const [access, setAccess] = useState(() => {
    const initial = {};
    for (const dept of departments) initial[dept.roleId] = !!group?.access?.[dept.roleId];
    return initial;
  });
  const [employeeIds, setEmployeeIds] = useState(() => new Set(group?.employeeAccess || []));
  const [employeeQuery, setEmployeeQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEditingRealGroup = !!group;

  // key -> name of the OTHER row currently holding it. Such keys stay pickable:
  // saving moves them into this row (the API strips them from the other row).
  const heldByOtherGroup = new Map(
    (allGroups || [])
      .filter((g) => g.id !== group?.id)
      .flatMap((g) => g.keys.map((k) => [k, g.name]))
  );
  const availableToAdd = catalog
    .filter((item) => !keys.includes(item.key))
    .map((item) => ({ ...item, heldBy: heldByOtherGroup.get(item.key) }));

  const addKey = (key) => {
    if (!key || keys.includes(key)) return;
    setKeys([...keys, key]);
  };
  const removeKey = (key) => setKeys(keys.filter((k) => k !== key));
  const toggleAccess = (roleId) => setAccess((prev) => ({ ...prev, [roleId]: !prev[roleId] }));

  const itemFor = (key) => catalog.find((item) => item.key === key);
  const labelFor = (key) => itemFor(key)?.label || key;
  const itemNoun = catalogGroup === 'features' ? 'פיצ\'ר' : 'עמוד';
  const itemNounPlural = catalogGroup === 'features' ? 'פיצ\'רים' : 'עמודים';

  // Mirrors applyAccessToEmployees in lib/permissionPageGroups.js: only a
  // boolean, non-legacy key can carry an EmployeePermissionOverride row, so the
  // picker is only meaningful once the row has at least one such key attached.
  const eligibleForEmployeeAccess = keys.some((key) => {
    const item = itemFor(key);
    return item && item.type === 'boolean' && !item.legacyEmployeeField;
  });
  const employeeLabel = employeeDisplayName;
  const selectedEmployees = (employees || []).filter((emp) => employeeIds.has(emp.id));
  const employeeSearchResults = employeeQuery.trim()
    ? (employees || []).filter((emp) => !employeeIds.has(emp.id) && employeeLabel(emp).toLowerCase().includes(employeeQuery.trim().toLowerCase()))
    : (employees || []).filter((emp) => !employeeIds.has(emp.id));
  const addEmployee = (id) => setEmployeeIds((prev) => new Set(prev).add(id));
  const removeEmployee = (id) => setEmployeeIds((prev) => { const next = new Set(prev); next.delete(id); return next; });

  const handleSave = async () => {
    if (!name.trim()) {
      setError('יש להזין שם לשורה');
      return;
    }
    if (keys.length === 0) {
      setError(`יש לצרף לפחות ${itemNoun} אחד לשורה`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEditingRealGroup ? `/api/admin/permissions/page-groups/${group.id}` : '/api/admin/permissions/page-groups';
      const res = await fetch(url, {
        method: isEditingRealGroup ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, catalogGroup, keys, access, employeeIds: eligibleForEmployeeAccess ? [...employeeIds] : undefined }),
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

  const handleDisband = async () => {
    if (!(await window.customConfirm(`לפרק את השורה? ה${itemNounPlural} ישארו עם ההרשאה הנוכחית שלהם, כל אחד בשורה נפרדת.`))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/permissions/page-groups/${group.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בפירוק');
      onSaved();
      onClose();
    } catch (e) {
      setError(e.message || 'שגיאה בפירוק');
    } finally {
      setSaving(false);
    }
  };

  const content = (
    <div
      className="modal-backdrop"
      onClick={() => !saving && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div className="modal animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ width: '90%', maxWidth: '560px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-head">
          <strong>
            <svg className="icon"><use href="#i-shield" /></svg>
            {isEditingRealGroup ? 'עריכת שורת הרשאה' : 'שורת הרשאה חדשה'}
          </strong>
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={onClose} title="סגירה" aria-label="סגירה">
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>

        <div className="modal-body" style={{ overflowY: 'auto' }}>
          {error && <div className="callout callout-error" style={{ marginBottom: '14px' }}>{error}</div>}

          <div className="field">
            <label>שם השורה</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="לדוגמה: דפי ניהול מלאי" disabled={saving} />
          </div>

          <div className="field">
            <label>{itemNounPlural} מקושרים</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {keys.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>לא צורפו {itemNounPlural} עדיין</span>}
              {keys.map((key) => {
                const item = itemFor(key);
                return (
                  <span key={key} className="chip">
                    {labelFor(key)}
                    {item?.route && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); window.open(item.route, '_blank', 'noopener'); }}
                        title="פתיחת העמוד בכרטיסייה חדשה"
                        aria-label="פתיחת העמוד בכרטיסייה חדשה"
                        style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                      >
                        <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-external-link" /></svg>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeKey(key)}
                      disabled={saving}
                      title={`הסר ${itemNoun}`}
                      aria-label={`הסר ${itemNoun}`}
                      style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                    >
                      <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-x" /></svg>
                    </button>
                  </span>
                );
              })}
            </div>
            {availableToAdd.length > 0 ? (
              <GroupPagePicker items={availableToAdd} onAdd={addKey} />
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>כל ה{itemNounPlural} כבר משובצים לשורה זו</span>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>{itemNoun} שמצורף לשורה מאמץ את רמת ההרשאה הנוכחית שלה. {itemNoun} שכבר שייך לשורה אחרת יעבור לכאן.</div>
          </div>

          <div className="field">
            <label>רמת הרשאה</label>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px' }}>חל בבת אחת על כל ה{itemNounPlural} המקושרים לשורה.</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {departments.map((dept) => (
                <div key={dept.roleId} className="select-row">
                  <span style={{ flex: 1 }}>{dept.name}</span>
                  <div className={access[dept.roleId] ? 'switch on' : 'switch'} onClick={() => !saving && toggleAccess(dept.roleId)} />
                </div>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>עובדים ספציפיים עם גישה</label>
            {eligibleForEmployeeAccess ? (
              <>
                <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px' }}>
                  חריגה מעבר למחלקה — עובד שנבחר כאן יקבל גישה ל{itemNounPlural} של השורה גם אם המחלקה שלו כבויה למעלה. זה גם יופיע ב&quot;הרשאות ספציפיות&quot; בכרטיס העובד שלו.
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                  {selectedEmployees.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>לא נבחרו עובדים ספציפיים</span>}
                  {selectedEmployees.map((emp) => (
                    <EmployeeTag key={emp.id} employee={emp} onRemove={() => removeEmployee(emp.id)} disabled={saving} />
                  ))}
                </div>
                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ padding: '6px', borderBottom: '1px solid var(--border)' }}>
                    <input
                      className="input"
                      style={{ height: '34px' }}
                      value={employeeQuery}
                      onChange={(e) => setEmployeeQuery(e.target.value)}
                      placeholder="חיפוש עובד..."
                      disabled={saving}
                    />
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto' }}>
                    {employeeSearchResults.length === 0 && (
                      <div style={{ padding: '10px 12px', fontSize: '12.5px', color: 'var(--text-3)' }}>לא נמצאו תוצאות</div>
                    )}
                    {employeeSearchResults.map((emp) => (
                      <div key={emp.id} className="combobox-option" onClick={() => !saving && addEmployee(emp.id)}>
                        <span style={{ flex: 1 }}>{employeeLabel(emp)} {emp.department?.name ? `— ${emp.department.name}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                אין ב{itemNounPlural} המקושרים אף פריט שתומך בהרשאה פרטנית לעובד (רק פריטים מסוג boolean, שאינם מנוהלים דרך כרטיס העובד עצמו).
              </div>
            )}
          </div>
        </div>

        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          {isEditingRealGroup ? (
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--danger)' }} onClick={handleDisband} disabled={saving}>
              <svg className="icon"><use href="#i-trash" /></svg>פרק שורה
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>ביטול</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <span className="spinner" /> : <svg className="icon"><use href="#i-check" /></svg>}
              שמירה
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null;
}
