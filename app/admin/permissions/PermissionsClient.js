'use client';

import { useState, useEffect, useCallback } from 'react';
import { PERMISSION_CATALOG, getCatalogGroup } from '@/lib/permissionsMetadata';
import EmployeePermissionsPanel from '@/app/components/permissions/EmployeePermissionsPanel';
import PageGroupModal from '@/app/components/permissions/PageGroupModal';

const GROUP_LABELS = { pages: 'עמודי מערכת', features: 'פיצ\'רים' };
const PAGE_CATALOG = getCatalogGroup('pages');

export default function PermissionsClient() {
  const [departments, setDepartments] = useState(null);
  const [pageGroups, setPageGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingCell, setSavingCell] = useState(null); // `${roleId}:${key}`
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [modalGroup, setModalGroup] = useState(undefined); // undefined=closed, null=new row, object=editing

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/permissions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת ההרשאות');
      setDepartments(data.departments);
      setPageGroups(data.pageGroups || []);
    } catch (e) {
      setError(e.message || 'שגיאה בטעינת ההרשאות');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch('/api/employees?all=true')
      .then((r) => r.json())
      .then((list) => setEmployees(Array.isArray(list) ? list : []))
      .catch(() => setEmployees([]));
  }, [load]);

  const setCell = async (departmentId, key, value) => {
    const cellId = `${departmentId}:${key}`;
    setSavingCell(cellId);
    try {
      const res = await fetch(`/api/admin/permissions/departments/${departmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      await load();
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת ההרשאה');
    } finally {
      setSavingCell(null);
    }
  };

  const resetCell = async (departmentId, key) => {
    const cellId = `${departmentId}:${key}`;
    setSavingCell(cellId);
    try {
      const res = await fetch(`/api/admin/permissions/departments/${departmentId}?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה באיפוס');
      await load();
    } catch (e) {
      alert(e.message || 'שגיאה באיפוס ההרשאה');
    } finally {
      setSavingCell(null);
    }
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /> טוען מטריצת הרשאות...</div>;
  }
  if (error) {
    return (
      <div className="callout callout-error" style={{ margin: '20px 0' }}>
        {error}
        <div style={{ marginTop: '10px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
            <svg className="icon"><use href="#i-refresh" /></svg>נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>הרשאות</h1>
          <p className="page-desc">
            מקור אמת אחד לכל שאלה על הרשאות: לאיזה דפים ופיצ&apos;רים יש גישה לכל מחלקה, ואיזה חריגות פרטניות נקבעו לעובדים ספציפיים.
          </p>
        </div>
      </div>

      <div className="card card-pad" style={{ marginBottom: '16px', background: 'var(--info-tint)', borderColor: 'color-mix(in srgb, var(--info) 25%, transparent)' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
          <svg className="icon" style={{ color: 'var(--info)', flexShrink: 0, marginTop: '2px' }}><use href="#i-info" /></svg>
          <div style={{ fontSize: '13px', color: 'var(--text-2)', lineHeight: 1.7 }}>
            שורות עם התג &quot;מתועד בלבד&quot; משקפות את ההרשאה בפועל היום (roleId קשיח בקוד), אבל שינוי אותן כרגע <strong>לא</strong> משנה התנהגות אמיתית באפליקציה — רק שורות בלי התג הזה (בקבוצת &quot;פיצ&apos;רים&quot;) פעילות בקוד.
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <h2 className="section-title" style={{ margin: 0 }}>{GROUP_LABELS.pages}</h2>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalGroup(null)}>
            <svg className="icon"><use href="#i-plus" /></svg>שורת הרשאה חדשה
          </button>
        </div>
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ minWidth: '200px' }}>שם</th>
                  <th style={{ minWidth: '220px' }}>עמודים מקושרים</th>
                  <th style={{ minWidth: '180px' }}>מי מורשה</th>
                  <th style={{ width: '54px' }} />
                </tr>
              </thead>
              <tbody>
                {pageGroups.map((group) => {
                  const allowedDepts = departments.filter((d) => group.access[d.roleId]);
                  return (
                    <tr key={group.id}>
                      <td>
                        <span className="cell-primary">{group.name}</span>
                        {group.isAuto && group.description && (
                          <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{group.description}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {group.keys.map((key) => (
                            <span key={key} className="chip">{PAGE_CATALOG.find((item) => item.key === key)?.label || key}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        {allowedDepts.length === 0 ? (
                          <span className="badge badge-neutral">ללא הרשאה</span>
                        ) : allowedDepts.length === departments.length ? (
                          <span className="badge badge-success"><svg className="icon"><use href="#i-check" /></svg>כולם</span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {allowedDepts.map((d) => <span key={d.roleId} className="badge badge-primary">{d.name}</span>)}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setModalGroup(group)} title="ערוך שורה" aria-label="ערוך שורה">
                          <svg className="icon"><use href="#i-edit" /></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title" style={{ margin: 0 }}>{GROUP_LABELS.features}</h2>
        </div>
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>הרשאה</th>
                  {departments.map((dept) => (
                    <th key={dept.roleId} style={{ textAlign: 'center', minWidth: '110px' }}>{dept.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_CATALOG.filter((item) => item.group === 'features').map((item) => (
                  <tr key={item.key}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span className="cell-primary">{item.label}</span>
                        {!item.enforced && (
                          <span className="badge" style={{ background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))' }}>מתועד בלבד</span>
                        )}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-3)', marginTop: '2px' }}>{item.description}</div>
                    </td>
                    {departments.map((dept) => {
                      const cell = dept.values[item.key];
                      const cellId = `${dept.roleId}:${item.key}`;
                      const isSaving = savingCell === cellId;
                      return (
                        <td key={dept.roleId} className="perm-cell" style={{ textAlign: 'center' }}>
                          {item.type === 'boolean' ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <div
                                className={cell.value ? 'switch on' : 'switch'}
                                onClick={() => !isSaving && setCell(dept.roleId, item.key, !cell.value)}
                                style={cell.isExplicit ? { boxShadow: '0 0 0 2px var(--primary-tint)' } : undefined}
                                title={cell.isExplicit ? 'ערך מוגדר במפורש למחלקה זו' : 'ברירת מחדל (עדיין לא נקבע ערך מפורש)'}
                              />
                              {cell.isExplicit && (
                                <button type="button" className="btn btn-ghost btn-icon-only btn-sm perm-reset" disabled={isSaving} onClick={() => resetCell(dept.roleId, item.key)} title="אפס לברירת מחדל">
                                  <svg className="icon"><use href="#i-refresh" /></svg>
                                </button>
                              )}
                            </div>
                          ) : (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                className="input"
                                type="number"
                                style={{ width: '80px', textAlign: 'center', ...(cell.isExplicit ? { borderColor: 'var(--primary-solid)' } : {}) }}
                                defaultValue={cell.value}
                                disabled={isSaving}
                                onBlur={(e) => {
                                  const n = parseInt(e.target.value, 10);
                                  if (!isNaN(n) && n !== cell.value) setCell(dept.roleId, item.key, n);
                                }}
                              />
                              {cell.isExplicit && (
                                <button type="button" className="btn btn-ghost btn-icon-only btn-sm perm-reset" disabled={isSaving} onClick={() => resetCell(dept.roleId, item.key)} title="אפס לברירת מחדל">
                                  <svg className="icon"><use href="#i-refresh" /></svg>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalGroup !== undefined && (
        <PageGroupModal
          group={modalGroup}
          pageCatalog={PAGE_CATALOG}
          allGroups={pageGroups}
          departments={departments}
          onClose={() => setModalGroup(undefined)}
          onSaved={load}
        />
      )}

      <div className="card">
        <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="section-title" style={{ margin: 0 }}>הרשאה פרטנית לעובד</h2>
          <p className="page-desc" style={{ margin: '4px 0 0' }}>חריגה מברירת המחדל של המחלקה לעובד ספציפי — ניתן להגדיר גם מכרטיס העובד עצמו.</p>
        </div>
        <div className="card-pad">
          <select
            className="input"
            style={{ maxWidth: '360px' }}
            value={selectedEmployeeId}
            onChange={(e) => setSelectedEmployeeId(e.target.value)}
          >
            <option value="">בחר עובד...</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {[emp.lastName, emp.firstName].filter(Boolean).join(' ')} {emp.department?.name ? `— ${emp.department.name}` : ''}
              </option>
            ))}
          </select>

          {selectedEmployeeId && (
            <div style={{ marginTop: '16px' }}>
              <EmployeePermissionsPanel employeeId={selectedEmployeeId} linkToCard />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
