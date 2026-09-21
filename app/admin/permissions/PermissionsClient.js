'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PERMISSION_CATALOG } from '@/lib/permissionsMetadata';
import PermissionRowWizard from '@/app/components/permissions/PermissionRowWizard';
import EmployeeTag from '@/app/components/permissions/EmployeeTag';
import ItemLabel from '@/app/components/permissions/ItemInfo';

export default function PermissionsClient() {
  const [departments, setDepartments] = useState(null);
  const [groups, setGroups] = useState([]);
  const [orgSettings, setOrgSettings] = useState({});
  const [personalOverrides, setPersonalOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [employees, setEmployees] = useState([]);
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
      setOrgSettings(data.orgSettings || {});
      setPersonalOverrides(data.personalOverrides || []);
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

  // Pages such as refunds / dress catalog / monthly board are open or closed by default according to an
  // org-level setting - the wizard's "מותר כיום" badges must use THIS organisation's real default.
  const catalog = useMemo(
    () => PERMISSION_CATALOG.map((item) => ({ ...item, defaultForRoleId: (roleId) => item.defaultForRoleId(roleId, orgSettings) })),
    [orgSettings]
  );

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
        catalog={catalog}
        groups={groups}
        departments={departments}
        employees={employees}
        onNew={() => setModal({ group: null })}
        onEdit={(group) => setModal({ group })}
      />

      <NumericValuesCard catalog={catalog} departments={departments} onSaved={load} />

      <PersonalOverridesCard catalog={catalog} overrides={personalOverrides} />

      {modal && (
        <PermissionRowWizard
          group={modal.group}
          catalog={catalog}
          allGroups={groups}
          departments={departments}
          employees={employees}
          onClose={() => setModal(null)}
          onSaved={load}
        />
      )}
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

// The other half of the picture: exceptions set from an employee's own card ("הרשאות ספציפיות"),
// which are not part of any row above. Read-only here - each line links to the card that owns it.
function PersonalOverridesCard({ catalog, overrides }) {
  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="section-title" style={{ margin: 0 }}>חריגות אישיות מכרטיס העובד</h2>
        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>
          הרשאות שנקבעו לעובד ספציפי ישירות בכרטיס שלו ולא דרך שורה. הן קודמות לשורת המחלקה (מותר או חסום), ואת השינוי בהן עושים בכרטיס העובד.
        </p>
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: '180px' }}>עובד</th>
                <th style={{ minWidth: '240px' }}>עמוד / פיצ&apos;ר</th>
                <th style={{ minWidth: '120px' }}>הרשאה</th>
                <th style={{ width: '54px' }} />
              </tr>
            </thead>
            <tbody>
              {overrides.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px' }}>אין חריגות אישיות.</td>
                </tr>
              )}
              {overrides.map((entry) => {
                const item = catalog.find((i) => i.key === entry.key);
                return (
                  <tr key={`${entry.employeeId}:${entry.key}`}>
                    <td><EmployeeTag employee={entry.employee} /></td>
                    <td><ItemLabel item={item} fallbackKey={entry.key} /></td>
                    <td>
                      {item?.type === 'number'
                        ? <span className="badge badge-neutral">{entry.value}</span>
                        : entry.value
                          ? <span className="badge badge-success">מותר</span>
                          : <span className="badge badge-danger">חסום</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <a className="btn btn-ghost btn-icon-only btn-sm" href={`/employees/${entry.employeeId}`} title="לכרטיס העובד" aria-label="לכרטיס העובד">
                        <svg className="icon"><use href="#i-edit" /></svg>
                      </a>
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

// Number items (e.g. max rows to export without a manager) have no yes/no, so a permission row can't
// carry them - this is their department-level editor. An employee's own value is set on the card and
// listed in the table below.
function NumericValuesCard({ catalog, departments, onSaved }) {
  const numeric = catalog.filter((item) => item.type === 'number');
  const [busyKey, setBusyKey] = useState(null);
  if (numeric.length === 0) return null;

  const save = async (roleId, key, value) => {
    setBusyKey(`${roleId}:${key}`);
    try {
      const res = await fetch('/api/admin/permissions/department-values', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      await onSaved();
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת הערך');
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div className="card-pad" style={{ borderBottom: '1px solid var(--border)' }}>
        <h2 className="section-title" style={{ margin: 0 }}>ערכים מספריים לפי מחלקה</h2>
        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>
          פריטים שהם מספר ולא כן/לא, ולכן לא נכנסים לשורות הרשאה. לעובד ספציפי קובעים ערך בכרטיס שלו.
        </p>
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th style={{ minWidth: '260px' }}>פריט</th>
                {departments.map((d) => <th key={d.roleId}>{d.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {numeric.map((item) => (
                <tr key={item.key}>
                  <td><ItemLabel item={item} /></td>
                  {departments.map((d) => {
                    const cell = d.values[item.key];
                    const busy = busyKey === `${d.roleId}:${item.key}`;
                    return (
                      <td key={d.roleId}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            style={{ width: '90px' }}
                            defaultValue={cell.value}
                            key={`${d.roleId}-${cell.value}`}
                            disabled={busy}
                            onBlur={(e) => {
                              const n = parseInt(e.target.value, 10);
                              if (!isNaN(n) && n !== cell.value) save(d.roleId, item.key, n);
                            }}
                          />
                          {cell.isExplicit && (
                            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => save(d.roleId, item.key, null)} title="אפס לברירת המחדל">איפוס</button>
                          )}
                        </div>
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
  );
}
