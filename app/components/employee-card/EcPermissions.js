'use client';

// EcPermissions - "הרשאות ספציפיות" בכרטיס העובד החדש (EmployeePermissionsPanel בישן, אותה לוגיקה ואותם ה-API:
// GET / PUT / DELETE /api/admin/permissions/employees/<id>; נשמר מיד ולא דרך "שמור פרטים"). שינויים מול הישן:
//   * החלטת הבעלים EC-09: 7 קטגוריות מתקפלות (lib/employeeCardPermGroups.js) במקום 2 קבוצות. כותרת קטגוריה = שם בלבד (בלי הכיתוב
//     "מקופל" ובלי סוגריים); כשיש בה חריגות אישיות - שבב "N חריגות". כל 34 השורות והבקרות זהות לישן.
//   * markup מהעיצוב המאושר (.prow, .pr-*, מתג .sw, שבבים), חלון המידע הוא חלון כהה (#dlg) ולא popover, ובלי window.alert: שגיאות בטוסט.
import { useCallback, useEffect, useState } from 'react';
import { PERMISSION_CATALOG } from '@/lib/permissionsMetadata';
import { groupPermissionItems } from '@/lib/employeeCardPermGroups';
import { Ic, useEc } from './EcUi';

const fmtVal = (item, v) => (item.type === 'boolean' ? (v ? 'מופעל' : 'כבוי') : (v ?? '—'));

function PermRow({ catalogItem: item, row, busy, onSave, onClear, onInfo }) {
  const hasOverride = !!row.override;
  const listed = row.rows.filter((r) => r.employeeListed);
  let ctl;
  if (row.alwaysAllowed) {
    ctl = (
      <div className="r">
        {hasOverride ? <button type="button" className="btn ghost sm" data-ec="p-clear" disabled={busy} onClick={() => onClear(item.key)} title="חריגה ישנה שנשארה מלפני שהעובד הועבר להנהלה ראשית / מתכנת. אין לה השפעה, אפשר לנקות">נקה חריגה ישנה</button> : null}
        <span className="chip green"><Ic id="check" size="sm" />תמיד מורשה (הנהלה ראשית / מתכנת)</span>
      </div>
    );
  } else if (listed.length) {
    ctl = (
      <>
        <span className="chip green"><Ic id="check" size="sm" />מורשה דרך שורת הרשאה</span>
        <a href="/admin/permissions" className="pr-link" data-ec="p-link">{listed.map((r) => r.name).join(', ')} — עריכה במסך ההרשאות</a>
      </>
    );
  } else if (item.type === 'boolean') {
    ctl = (
      <div className="r">
        {hasOverride ? <button type="button" className="btn ghost sm" data-ec="p-clear" disabled={busy} onClick={() => onClear(item.key)} title="אפס לברירת המחדל של המחלקה">איפוס</button> : null}
        <label className="sw" title={hasOverride ? 'חריגה אישית לעובד זה' : 'לחיצה תיצור חריגה אישית לעובד זה'}>
          <input type="checkbox" data-pk={item.key} aria-label={item.label} checked={!!row.effective} disabled={busy} onChange={() => !busy && onSave(item.key, !row.effective)} /><i />
        </label>
      </div>
    );
  } else {
    ctl = (
      <div className="r">
        <input className="inp pr-num" type="number" data-pn={item.key} aria-label={item.label} defaultValue={row.effective} key={`${row.key}-${row.effective}`} disabled={busy}
          onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== row.effective) onSave(item.key, n); }} />
        {hasOverride ? <button type="button" className="btn ghost sm" data-ec="p-clear" disabled={busy} onClick={() => onClear(item.key)} title="אפס לברירת המחדל של המחלקה">איפוס</button> : null}
      </div>
    );
  }
  // שורות שמכילות את הפריט אבל לא מונות את העובד: עדיין קובעות את ברירת המחדל של המחלקה (רק כששורה מקבצת כמה פריטים)
  const other = row.rows.filter((r) => !listed.includes(r) && r.itemCount > 1);
  return (
    <div className={`prow${busy ? ' busy' : ''}`} data-row={item.key}>
      <div className="pr-t">
        <div className="pr-h">
          <strong>{item.route ? <a href={item.route} target="_blank" rel="noopener noreferrer" data-ec="p-route" title="פתיחת העמוד בטאב חדש">{item.label}</a> : <span>{item.label}</span>}</strong>
          <button type="button" className="pr-i" data-ec="p-info" onClick={() => onInfo(item)} title="מידע והסבר" aria-label={`מידע והסבר: ${item.label}`}><Ic id="info" /></button>
          {!item.enforced ? <span className="chip gold">לתיעוד בלבד — עדיין לא משנה את הגישה בפועל</span> : null}
          {hasOverride && !row.alwaysAllowed && listed.length === 0 ? <span className="chip rose">חריגה אישית</span> : null}
        </div>
        <p className="pr-d">{item.description}</p>
        <p className="pr-s">לפי המחלקה: <b>{fmtVal(item, row.departmentDefault)}</b>{other.length ? ` · מוגדר בשורות: ${other.map((r) => r.name).join(', ')}` : ''}</p>
      </div>
      <div className="pr-c">
        {ctl}
        {hasOverride && row.override.note && !row.override.fromRow ? <span className="pr-d">{row.override.note}</span> : null}
      </div>
    </div>
  );
}

export default function EcPermissions({ employeeId, refreshKey = 0 }) {
  const ec = useEc();
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);
  const [open, setOpen] = useState({}); // קטגוריה פתוחה: { [id]: true } (ברירת מחדל: הכול מקופל)

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- טעינה ראשונית + רענון אחרי שמירת פרטים (שינוי מחלקה משנה את ברירות המחדל)
  useEffect(() => { load(); }, [load, refreshKey]);

  const saveOverride = async (key, value) => {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/permissions/employees/${employeeId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
    } catch (e) {
      ec.say(e.message || 'שגיאה בשמירת ההרשאה', 'error');
    } finally {
      setSavingKey(null);
      await load(); // גם אחרי סירוב: טאב אחר יכול היה לשנות את השורה
    }
  };

  const clearOverride = async (key) => {
    setSavingKey(key);
    try {
      const res = await fetch(`/api/admin/permissions/employees/${employeeId}?key=${encodeURIComponent(key)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה באיפוס ההרשאה');
    } catch (e) {
      ec.say(e.message || 'שגיאה באיפוס ההרשאה', 'error');
    } finally {
      setSavingKey(null);
      await load();
    }
  };

  let body;
  if (loading && !items) body = <div className="pr-load"><span className="spin" />טוען הרשאות...</div>;
  else if (error) body = <div className="status debt" role="alert"><Ic id="alert" size="lg" /><div><div className="n" style={{ fontSize: 18 }}>{error === 'שגיאה בטעינת ההרשאות' ? error : error}</div></div></div>;
  else if (!items) body = null;
  else {
    const byKey = new Map(items.map((it) => [it.key, it]));
    const visible = PERMISSION_CATALOG.filter((item) => byKey.has(item.key) && !byKey.get(item.key).locked);
    const groups = groupPermissionItems(visible);
    body = (
      <div className="pr-groups" style={{ opacity: loading ? 0.6 : 1 }}>
        {groups.map((g) => {
          const exc = g.items.filter((it) => byKey.get(it.key).override && !byKey.get(it.key).alwaysAllowed).length;
          return (
            <details key={g.id} className="coll pr-cat" open={!!open[g.id]} data-cat={g.id}
              onToggle={(e) => { const o = e.currentTarget.open; setOpen((p) => (p[g.id] === o ? p : { ...p, [g.id]: o })); }}>
              <summary><Ic id={g.icon} />{g.title}{exc ? <span className="chip rose" style={{ marginInlineStart: 4 }}>{exc === 1 ? 'חריגה אחת' : `${exc} חריגות`}</span> : null}<Ic id="chev" className="chev" /></summary>
              <div className="in pr-g">
                {g.items.map((item) => (
                  <PermRow key={item.key} catalogItem={item} row={byKey.get(item.key)} busy={savingKey === item.key} onSave={saveOverride} onClear={clearOverride} onInfo={ec.info} />
                ))}
              </div>
            </details>
          );
        })}
      </div>
    );
  }
  return body;
}
