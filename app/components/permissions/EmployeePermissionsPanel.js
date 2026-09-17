'use client';

import { useState, useEffect, useCallback } from 'react';
import { PERMISSION_CATALOG } from '@/lib/permissionsMetadata';

// Shared "הרשאות ספציפיות" panel — one employee's effective value per catalog key,
// with a control to override the department default. Used both embedded in an
// employee's own card (app/employees/[id]/page.js) and from the employee picker on
// /admin/permissions (app/admin/permissions/PermissionsClient.js) — one component so
// the two surfaces the request asked for ("גם דרך דף הניהול וגם דרך כרטיס העובד")
// can never drift apart.
//
// `linkToCard` renders a "לכרטיס העובד" link next to legacy-field items (AI/error
// reports) instead of a disabled control — only makes sense when this panel is NOT
// already embedded inside that same card (i.e. from the admin page).
export default function EmployeePermissionsPanel({ employeeId, linkToCard = false }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [noteDrafts, setNoteDrafts] = useState({});

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/permissions/employees/${employeeId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת ההרשאות');
      setItems(data.items);
    } catch (e) {
      setError(e.message || 'שגיאה בטעינת ההרשאות');
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const saveOverride = async (key, value) => {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/permissions/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, note: noteDrafts[key] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      await load();
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת ההרשאה');
    } finally {
      setSavingKey(null);
    }
  };

  const clearOverride = async (key) => {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/permissions/employees/${employeeId}?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה באיפוס ההרשאה');
      await load();
    } catch (e) {
      alert(e.message || 'שגיאה באיפוס ההרשאה');
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) return <div style={{ padding: '12px 0' }}><span className="spinner" /> טוען הרשאות...</div>;
  if (error) return <div className="callout callout-error">{error}</div>;
  if (!items) return null;

  const byKey = new Map(items.map((it) => [it.key, it]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {PERMISSION_CATALOG.map((catalogItem) => {
        const row = byKey.get(catalogItem.key);
        if (!row) return null;
        const isLegacy = !!catalogItem.legacyEmployeeField;
        const hasOverride = !!row.override;
        const isSaving = savingKey === catalogItem.key;

        return (
          <div key={catalogItem.key} className="card card-pad" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '13.5px' }}>{catalogItem.label}</strong>
                {!catalogItem.enforced && (
                  <span className="badge" style={{ background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))' }}>מתועד בלבד — עדיין לא מיושם בקוד</span>
                )}
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>{catalogItem.description}</p>
              <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-3)' }}>
                ברירת מחדל לפי מחלקה: <strong>{formatValue(catalogItem, row.departmentDefault)}</strong>
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
              {isLegacy ? (
                linkToCard ? (
                  <a className="btn btn-secondary btn-sm" href={`/employees/${employeeId}`}>עריכה בכרטיס העובד</a>
                ) : (
                  <span className="badge">{formatValue(catalogItem, row.effective)} · נקבע בכרטיס העובד</span>
                )
              ) : catalogItem.type === 'boolean' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {hasOverride && (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isSaving} onClick={() => clearOverride(catalogItem.key)} title="אפס לברירת המחדל של המחלקה">
                      איפוס
                    </button>
                  )}
                  <div
                    className={row.effective ? 'switch on' : 'switch'}
                    onClick={() => !isSaving && saveOverride(catalogItem.key, !row.effective)}
                    title={hasOverride ? 'הרשאה פרטנית לעובד זה' : 'לחיצה תיצור הרשאה פרטנית לעובד זה'}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    className="input"
                    type="number"
                    style={{ width: '90px' }}
                    defaultValue={row.effective}
                    disabled={isSaving}
                    onBlur={(e) => {
                      const n = parseInt(e.target.value, 10);
                      if (!isNaN(n) && n !== row.effective) saveOverride(catalogItem.key, n);
                    }}
                  />
                  {hasOverride && (
                    <button type="button" className="btn btn-ghost btn-sm" disabled={isSaving} onClick={() => clearOverride(catalogItem.key)} title="אפס לברירת המחדל של המחלקה">
                      איפוס
                    </button>
                  )}
                </div>
              )}
              {hasOverride && row.override?.note && (
                <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{row.override.note}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(item, value) {
  if (item.type === 'boolean') return value ? 'מופעל' : 'כבוי';
  return value ?? '—';
}
