'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

// Floating panel for creating/editing one row of the pages table on
// /admin/permissions/PermissionsClient.js. A row bundles one or more
// PERMISSION_CATALOG ('pages') keys under one name; saving pushes the chosen
// department access to every attached key at once (app/api/admin/permissions/
// page-groups/**). `group` is null for a brand-new row, or the row being edited
// (including an `isAuto` single-page row being promoted into a named one).
export default function PageGroupModal({ group, pageCatalog, allGroups, departments, onClose, onSaved }) {
  const [name, setName] = useState(group?.name || '');
  const [keys, setKeys] = useState(group?.keys ? [...group.keys] : []);
  const [access, setAccess] = useState(() => {
    const initial = {};
    for (const dept of departments) initial[dept.roleId] = !!group?.access?.[dept.roleId];
    return initial;
  });
  const [addValue, setAddValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const isEditingRealGroup = !!group && !group.isAuto;

  const claimedByOtherGroups = new Set(
    (allGroups || [])
      .filter((g) => !g.isAuto && g.id !== group?.id)
      .flatMap((g) => g.keys)
  );
  const availableToAdd = pageCatalog.filter((item) => !keys.includes(item.key) && !claimedByOtherGroups.has(item.key));

  const addKey = (key) => {
    if (!key || keys.includes(key)) return;
    setKeys([...keys, key]);
    setAddValue('');
  };
  const removeKey = (key) => setKeys(keys.filter((k) => k !== key));
  const toggleAccess = (roleId) => setAccess((prev) => ({ ...prev, [roleId]: !prev[roleId] }));

  const labelFor = (key) => pageCatalog.find((item) => item.key === key)?.label || key;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('יש להזין שם לשורה');
      return;
    }
    if (keys.length === 0) {
      setError('יש לצרף לפחות עמוד אחד לשורה');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const url = isEditingRealGroup ? `/api/admin/permissions/page-groups/${group.id}` : '/api/admin/permissions/page-groups';
      const res = await fetch(url, {
        method: isEditingRealGroup ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, keys, access }),
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
    if (!(await window.customConfirm('לפרק את השורה? העמודים ישארו עם ההרשאה הנוכחית שלהם, כל אחד בשורה נפרדת.'))) return;
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
            <label>עמודים מקושרים</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
              {keys.length === 0 && <span style={{ fontSize: '13px', color: 'var(--text-3)' }}>לא צורפו עמודים עדיין</span>}
              {keys.map((key) => (
                <span key={key} className="chip">
                  {labelFor(key)}
                  <button
                    type="button"
                    onClick={() => removeKey(key)}
                    disabled={saving}
                    title="הסר עמוד"
                    aria-label="הסר עמוד"
                    style={{ display: 'inline-flex', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                  >
                    <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-x" /></svg>
                  </button>
                </span>
              ))}
            </div>
            {availableToAdd.length > 0 ? (
              <select
                className="input"
                value={addValue}
                onChange={(e) => addKey(e.target.value)}
                disabled={saving}
              >
                <option value="">+ הוסף עמוד לשורה...</option>
                {availableToAdd.map((item) => (
                  <option key={item.key} value={item.key}>{item.label}</option>
                ))}
              </select>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>כל העמודים כבר משובצים לשורה זו או לשורה אחרת</span>
            )}
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '4px' }}>עמוד שמצורף לשורה מאמץ את רמת ההרשאה הנוכחית שלה.</div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>רמת הרשאה</label>
            <div style={{ fontSize: '12px', color: 'var(--text-3)', marginBottom: '8px' }}>חל בבת אחת על כל העמודים המקושרים לשורה.</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {departments.map((dept) => (
                <div key={dept.roleId} className="select-row">
                  <span style={{ flex: 1 }}>{dept.name}</span>
                  <div className={access[dept.roleId] ? 'switch on' : 'switch'} onClick={() => !saving && toggleAccess(dept.roleId)} />
                </div>
              ))}
            </div>
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
