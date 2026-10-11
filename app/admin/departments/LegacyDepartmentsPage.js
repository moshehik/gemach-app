'use client';

import { useState, useEffect } from 'react';

// roleId 1 (מנהל) ו-2 (מתכנת) הם תפקידי מערכת שמנגנון ההרשאות (lib/auth.js)
// מסתמך עליהם - השרת חוסם את מחיקתם, וכאן רק משקפים זאת בממשק.
const SYSTEM_ROLE_IDS = [1, 2];

export default function DepartmentsAdminPage() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newDept, setNewDept] = useState({ roleId: '', name: '' });
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editName, setEditName] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/departments');
      if (res.status === 401) {
        setUnauthorized(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת המחלקות');
      setDepartments(data);
    } catch (e) {
      setLoadError(e.message || 'שגיאה בטעינת המחלקות');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const startAdd = () => {
    const maxRoleId = departments.reduce((max, d) => Math.max(max, d.roleId), -1);
    setNewDept({ roleId: String(maxRoleId + 1), name: '' });
    setIsAdding(true);
    setEditingRoleId(null);
  };

  const saveNew = async () => {
    if (!newDept.name.trim()) {
      alert('חובה להזין שם מחלקה');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: newDept.roleId, name: newDept.name })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה ביצירת המחלקה');
        return;
      }
      setIsAdding(false);
      setNewDept({ roleId: '', name: '' });
      await load();
    } catch (e) {
      alert('שגיאת תקשורת ביצירת המחלקה');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (dept) => {
    setEditingRoleId(dept.roleId);
    setEditName(dept.name);
    setIsAdding(false);
  };

  const saveEdit = async () => {
    if (!editName.trim()) {
      alert('חובה להזין שם מחלקה');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/departments/${editingRoleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName })
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה בעדכון המחלקה');
        return;
      }
      setEditingRoleId(null);
      setEditName('');
      await load();
    } catch (e) {
      alert('שגיאת תקשורת בעדכון המחלקה');
    } finally {
      setSaving(false);
    }
  };

  const deleteDept = async (dept) => {
    const confirmed = await window.customConfirm(
      `האם למחוק את המחלקה "${dept.name}" (מספר ${dept.roleId})? מחיקה אפשרית רק כשאין עובדים משויכים למחלקה.`
    );
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/departments/${dept.roleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה במחיקת המחלקה');
        return;
      }
      await load();
    } catch (e) {
      alert('שגיאת תקשורת במחיקת המחלקה');
    }
  };

  if (unauthorized) {
    return (
      <div className="card card-pad" style={{ maxWidth: '520px', margin: '40px auto', textAlign: 'center' }}>
        <svg className="icon" style={{ width: '34px', height: '34px', color: 'var(--danger)', margin: '0 auto 10px' }}><use href="#i-lock" /></svg>
        <h2 style={{ marginTop: 0 }}>נדרשת התחברות</h2>
        <p className="page-desc">מסך ניהול המחלקות זמין למשתמשים מחוברים בלבד.</p>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>ניהול מחלקות</h1>
          <p className="page-desc">יצירה, שינוי שם ומחיקה של מחלקות (תפקידי עובדים). מספר המחלקה נשמר בכרטיס העובד.</p>
        </div>
        <div className="page-actions">
          <button data-element-name="כפתור_departments_add" type="button" className="btn btn-primary" onClick={startAdd} disabled={isAdding || loading}>
            <svg className="icon"><use href="#i-plus" /></svg>הוסף מחלקה
          </button>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '16px', background: 'var(--info-tint)', borderColor: 'color-mix(in srgb, var(--info) 25%, transparent)' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <svg className="icon" style={{ color: 'var(--info)', flexShrink: 0, marginTop: '2px' }}><use href="#i-info" /></svg>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>
            מחלקות 1 (מנהל) ו-2 (מתכנת) הן <strong>תפקידי מערכת</strong>: מנגנון ההרשאות מזהה מנהלים ומתכנתים לפי המספרים האלה, ולכן לא ניתן למחוק אותן.
            <br />
            שימו לב: הגדרות מערכת ששומרות מחלקות לפי שם (למשל &quot;מחלקות מורשות&quot; במסך ההגדרות) אינן מתעדכנות אוטומטית בשינוי שם מחלקה - יש לעדכן אותן ידנית לאחר שינוי שם.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>מספר מחלקה</th>
                  <th>שם מחלקה</th>
                  <th style={{ width: '150px' }}>עובדים משויכים</th>
                  <th style={{ width: '160px', textAlign: 'center' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr style={{ background: 'var(--surface-alt)' }}>
                    <td>
                      <input data-element-name="שדה_departments_new_roleId" className="input" type="number" min="0" value={newDept.roleId}
                        onChange={(e) => setNewDept(prev => ({ ...prev, roleId: e.target.value }))} />
                    </td>
                    <td>
                      <input data-element-name="שדה_departments_new_name" className="input" type="text" autoFocus placeholder="שם המחלקה..." value={newDept.name}
                        onChange={(e) => setNewDept(prev => ({ ...prev, name: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveNew(); } }} />
                    </td>
                    <td className="cell-muted">-</td>
                    <td className="row-actions" style={{ justifyContent: 'center' }}>
                      <button data-element-name="כפתור_departments_new_save" type="button" onClick={saveNew} className="btn btn-primary btn-sm" disabled={saving}>שמור</button>
                      <button data-element-name="כפתור_departments_new_cancel" type="button" onClick={() => setIsAdding(false)} className="btn btn-secondary btn-sm">בטל</button>
                    </td>
                  </tr>
                )}

                {departments.map(dept => {
                  const isSystem = SYSTEM_ROLE_IDS.includes(dept.roleId);
                  const employeeCount = dept._count?.employees ?? 0;
                  return (
                    <tr key={dept.roleId}>
                      <td className="cell-primary" style={{ fontVariantNumeric: 'tabular-nums' }}>{dept.roleId}</td>
                      <td>
                        {editingRoleId === dept.roleId ? (
                          <input data-element-name="שדה_departments_edit_name" className="input" type="text" autoFocus value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } }} />
                        ) : (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                            <span className="cell-primary">{dept.name}</span>
                            {isSystem && (
                              <span className="badge" style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)' }}>תפקיד מערכת</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className={employeeCount > 0 ? undefined : 'cell-muted'}>
                        {employeeCount > 0 ? `${employeeCount} עובדים` : 'אין'}
                      </td>
                      <td className="row-actions" style={{ justifyContent: 'center' }}>
                        {editingRoleId === dept.roleId ? (
                          <>
                            <button data-element-name="כפתור_departments_edit_save" type="button" onClick={saveEdit} className="btn btn-primary btn-sm" disabled={saving}>שמור</button>
                            <button data-element-name="כפתור_departments_edit_cancel" type="button" onClick={() => setEditingRoleId(null)} className="btn btn-secondary btn-sm">בטל</button>
                          </>
                        ) : (
                          <>
                            <button data-element-name="כפתור_departments_edit" type="button" onClick={() => startEdit(dept)} className="btn btn-ghost btn-icon-only btn-sm" title="שינוי שם">
                              <svg className="icon"><use href="#i-edit" /></svg>
                            </button>
                            <button data-element-name="כפתור_departments_delete" type="button" onClick={() => deleteDept(dept)}
                              className="btn btn-ghost btn-icon-only btn-sm"
                              style={{ color: isSystem || employeeCount > 0 ? 'var(--text-3)' : 'var(--danger)' }}
                              disabled={isSystem}
                              title={isSystem
                                ? 'תפקיד מערכת - לא ניתן למחיקה'
                                : employeeCount > 0
                                  ? 'יש עובדים משויכים - המחיקה תיחסם'
                                  : 'מחק מחלקה'}>
                              <svg className="icon"><use href="#i-trash" /></svg>
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!loading && !loadError && departments.length === 0 && !isAdding && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-3)' }}>
                      אין מחלקות במערכת. לחצו על &quot;הוסף מחלקה&quot; כדי ליצור את הראשונה.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}>
                      <span className="spinner" /> טוען מחלקות...
                    </td>
                  </tr>
                )}

                {loadError && !loading && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--danger)' }}>
                      {loadError}
                      <div style={{ marginTop: '10px' }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                          <svg className="icon"><use href="#i-refresh" /></svg>נסה שוב
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
