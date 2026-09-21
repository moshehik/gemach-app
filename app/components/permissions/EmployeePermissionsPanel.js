'use client';

import { useState, useEffect, useCallback } from 'react';
import { PERMISSION_CATALOG } from '@/lib/permissionsMetadata';
import ItemLabel from './ItemInfo';

// "הרשאות ספציפיות" on an employee's own card (app/employees/[id]/page.js) - the card's side of
// /admin/permissions. Both read the same rows, and each item is owned by exactly one of them:
//   - listed for this employee in a permission row  -> owned by that row: read-only here, with a
//                                                       link to the central window;
//   - anything else                                 -> a personal exception, edited here and listed
//                                                       back on /admin/permissions;
//   - items the central window can't configure (locked pages) are not shown at all, and head
//     management / programmer show "always allowed" with no controls - same as the central window.
// Every item - AI and error reports included - goes through this one model (no special checkboxes).
export default function EmployeePermissionsPanel({ employeeId }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

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
        body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת ההרשאה');
    } finally {
      setSavingKey(null);
      await load(); // also after a refusal: another tab may have changed the row meanwhile
    }
  };

  const clearOverride = async (key) => {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/permissions/employees/${employeeId}?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה באיפוס ההרשאה');
    } catch (e) {
      alert(e.message || 'שגיאה באיפוס ההרשאה');
    } finally {
      setSavingKey(null);
      await load();
    }
  };

  if (loading && !items) return <div style={{ padding: '12px 0' }}><span className="spinner" /> טוען הרשאות...</div>;
  if (error) return <div className="callout callout-danger">{error}</div>;
  if (!items) return null;

  const byKey = new Map(items.map((it) => [it.key, it]));
  const visible = PERMISSION_CATALOG.filter((item) => byKey.has(item.key) && !byKey.get(item.key).locked);

  const renderGroup = (group, title) => {
    const groupItems = visible.filter((item) => item.group === group);
    if (!groupItems.length) return null;
    return (
      <div key={group}>
        <h3 style={{ margin: '4px 0 8px', fontSize: '13px', color: 'var(--text-2)' }}>{title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {groupItems.map((catalogItem) => (
            <PermissionLine
              key={catalogItem.key}
              catalogItem={catalogItem}
              row={byKey.get(catalogItem.key)}
              busy={savingKey === catalogItem.key}
              onSave={saveOverride}
              onClear={clearOverride}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', opacity: loading ? 0.6 : 1 }}>
      {renderGroup('pages', 'עמודים')}
      {renderGroup('features', "פיצ'רים")}
    </div>
  );
}

function PermissionLine({ catalogItem, row, busy, onSave, onClear }) {
  const hasOverride = !!row.override;
  const listedRows = row.rows.filter((r) => r.employeeListed);

  let control;
  if (row.alwaysAllowed) {
    control = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {hasOverride && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onClear(catalogItem.key)} title="חריגה ישנה שנשארה מלפני שהעובד הועבר להנהלה ראשית / מתכנת. אין לה השפעה, אפשר לנקות">
            נקה חריגה ישנה
          </button>
        )}
        <span className="badge badge-success">תמיד מורשה (הנהלה ראשית / מתכנת)</span>
      </div>
    );
  } else if (listedRows.length) {
    control = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
        <span className="badge badge-success">מורשה דרך שורת הרשאה</span>
        <a href="/admin/permissions" style={{ fontSize: '12px' }}>{listedRows.map((r) => r.name).join(', ')} — עריכה במסך ההרשאות</a>
      </div>
    );
  } else if (catalogItem.type === 'boolean') {
    control = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {hasOverride && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onClear(catalogItem.key)} title="אפס לברירת המחדל של המחלקה">
            איפוס
          </button>
        )}
        <div
          className={row.effective ? 'switch on' : 'switch'}
          onClick={() => !busy && onSave(catalogItem.key, !row.effective)}
          title={hasOverride ? 'חריגה אישית לעובד זה' : 'לחיצה תיצור חריגה אישית לעובד זה'}
        />
      </div>
    );
  } else {
    control = (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          className="input"
          type="number"
          style={{ width: '90px' }}
          defaultValue={row.effective}
          key={`${row.key}-${row.effective}`}
          disabled={busy}
          onBlur={(e) => {
            const n = parseInt(e.target.value, 10);
            if (!isNaN(n) && n !== row.effective) onSave(catalogItem.key, n);
          }}
        />
        {hasOverride && (
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => onClear(catalogItem.key)} title="אפס לברירת המחדל של המחלקה">
            איפוס
          </button>
        )}
      </div>
    );
  }

  // Rows that contain this item but don't list the employee: they still govern the department default.
  // Only worth naming when the row groups several items - a row that is just this item's own line adds nothing.
  const otherRows = row.rows.filter((r) => !listedRows.includes(r) && r.itemCount > 1);

  return (
    <div className="card card-pad" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '13.5px' }}><ItemLabel item={catalogItem} /></strong>
          {!catalogItem.enforced && (
            <span className="badge" style={{ background: 'var(--warning-tint)', color: 'var(--warning-solid, var(--warning))' }}>לתיעוד בלבד — עדיין לא משנה את הגישה בפועל</span>
          )}
          {hasOverride && !row.alwaysAllowed && listedRows.length === 0 && <span className="badge badge-primary">חריגה אישית</span>}
        </div>
        <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-3)' }}>{catalogItem.description}</p>
        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-3)' }}>
          לפי המחלקה: <strong>{formatValue(catalogItem, row.departmentDefault)}</strong>
          {otherRows.length > 0 && <> · מוגדר בשורות: {otherRows.map((r) => r.name).join(', ')}</>}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
        {control}
        {hasOverride && row.override?.note && !row.override.fromRow && (
          <span style={{ fontSize: '11.5px', color: 'var(--text-3)' }}>{row.override.note}</span>
        )}
      </div>
    </div>
  );
}

function formatValue(item, value) {
  if (item.type === 'boolean') return value ? 'מופעל' : 'כבוי';
  return value ?? '—';
}
