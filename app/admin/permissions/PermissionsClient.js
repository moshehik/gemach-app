'use client';

import { useState, useEffect, useCallback } from 'react';
import { PERMISSION_CATALOG } from '@/lib/permissionsMetadata';
import EmployeePermissionsPanel from '@/app/components/permissions/EmployeePermissionsPanel';
import PermissionRowWizard from '@/app/components/permissions/PermissionRowWizard';
import EmployeeTag from '@/app/components/permissions/EmployeeTag';
import ItemLabel from '@/app/components/permissions/ItemInfo';

export default function PermissionsClient() {
  const [departments, setDepartments] = useState(null);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [modal, setModal] = useState(null); // null=closed, { group } — group is null for a new row

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/permissions');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת ההרשאות');
      setDepartments(data.departments);
      setGroups(data.groups || []);
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

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}><span className="spinner" /> טוען מטריצת הרשאות...</div>;
  }
  if (error) {
    return (
      <div className="callout callout-danger" style={{ margin: '20px 0' }}>
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
            הטבלה מציגה רק שורות שנוצרו במפורש (&quot;שורת הרשאה חדשה&quot;) — עמוד או פיצ&apos;ר חדש לא מופיע כאן אוטומטית. כל שורה יכולה לשלב עמודים ופיצ&apos;רים יחד.
            פריט עם התג &quot;לתיעוד בלבד&quot; נשמר לתיעוד בלבד — הגישה בפועל אליו נשארת כמו שהיא היום ושינוי כאן <strong>לא</strong> ישנה התנהגות אמיתית. פיצ&apos;רים ללא התג נאכפים בפועל מיד.
            פריט שמופיע בכמה שורות מודגש, והגישה אליו מותרת אם אחת מהשורות מתירה.
          </div>
        </div>
      </div>

      <PermissionGroupTable
        catalog={PERMISSION_CATALOG}
        groups={groups}
        departments={departments}
        employees={employees}
        onNew={() => setModal({ group: null })}
        onEdit={(group) => setModal({ group })}
      />

      {modal && (
        <PermissionRowWizard
          group={modal.group}
          catalog={PERMISSION_CATALOG}
          allGroups={groups}
          departments={departments}
          employees={employees}
          onClose={() => setModal(null)}
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

// The one table of permission rows — pages AND features together, each row a
// PermissionPageGroup (see that model's doc comment in prisma/schema.prisma): name /
// linked items / who's allowed / edit. Only explicitly created rows ever appear here.
function PermissionGroupTable({ catalog, groups, departments, employees, onNew, onEdit }) {
  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-pad" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h2 className="section-title" style={{ margin: 0 }}>שורות הרשאה</h2>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onNew}>
          <svg className="icon"><use href="#i-plus" /></svg>שורת הרשאה חדשה
        </button>
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: '200px' }}>שם</th>
                <th style={{ minWidth: '260px' }}>עמודים ופיצ&apos;רים</th>
                <th style={{ minWidth: '180px' }}>מי מורשה</th>
                <th style={{ width: '54px' }} />
              </tr>
            </thead>
            <tbody>
              {groups.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px' }}>
                    אין עדיין שורות. לחצו על &quot;שורת הרשאה חדשה&quot; כדי להתחיל.
                  </td>
                </tr>
              )}
              {groups.map((group) => {
                const allowedDepts = departments.filter((d) => group.access[d.roleId]);
                const allowedEmployees = (group.employeeAccess || []).map((id) => employees.find((e) => e.id === id)).filter(Boolean);
                return (
                  <tr key={group.id}>
                    <td>
                      <span className="cell-primary">{group.name}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {group.keys.map((key) => {
                          const item = catalog.find((i) => i.key === key);
                          const otherRows = groups.filter((g) => g.id !== group.id && g.keys.includes(key)).map((g) => g.name);
                          return (
                            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <span
                                className="chip"
                                title={otherRows.length ? `מופיע גם בשורה: ${otherRows.join(', ')} — אם אחת השורות מתירה, הגישה מותרת` : undefined}
                                style={otherRows.length ? { background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))', fontWeight: 700 } : undefined}
                              >
                                {otherRows.length > 0 && <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-link" /></svg>}
                                <ItemLabel item={item} fallbackKey={key} />
                              </span>
                              {item?.group === 'features' && <span className="badge badge-neutral" style={{ fontSize: '10px' }}>פיצ&apos;ר</span>}
                              {item && !item.enforced && (
                                <span className="badge" style={{ background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))', fontSize: '10px' }}>לתיעוד בלבד</span>
                              )}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                        {allowedDepts.length === 0 && allowedEmployees.length === 0 ? (
                          <span className="badge badge-neutral">ללא הרשאה</span>
                        ) : allowedDepts.length === departments.length ? (
                          <span className="badge badge-success"><svg className="icon"><use href="#i-check" /></svg>כולם</span>
                        ) : (
                          allowedDepts.map((d) => <span key={d.roleId} className="badge badge-primary">{d.name}</span>)
                        )}
                        {allowedEmployees.map((emp) => <EmployeeTag key={emp.id} employee={emp} />)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => onEdit(group)} title="ערוך שורה" aria-label="ערוך שורה">
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
  );
}
