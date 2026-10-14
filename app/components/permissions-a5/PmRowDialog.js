'use client';

// חלון עריכת / יצירת שורת הרשאה (חלון צף של הפלטה, .dlg.mailwin) - מחליף את אשף 5 השלבים הישן (app/components/permissions/PermissionRowWizard.js) באותה לוגיקה בדיוק:
//   1 שם -> 2 עמודים ופיצ'רים -> 3 מחלקות -> 4 עובדים ספציפיים -> 5 אישור. שלבים 1-2 חייבים להיות תקינים כדי להתקדם; בעריכה כל השלבים פתוחים מיד.
// אותו API: POST /api/admin/permissions/page-groups, PUT / DELETE .../page-groups/<id> ({ name, keys, access, employeeIds }); שגיאות השרת (למשל 409 "חסימה אישית") מוצגות כמו שהן.
// תוספות: בחירת פריטים בלחיצה אחת (סימון / ביטול) עם חיפוש וסינון עמודים / פיצ'רים, מחלקות עם מתגים ושבב "מותר כיום", אישור לפני סגירה עם שינויים שלא נשמרו.
import { useMemo, useState } from 'react';
import { useNoFill } from '@/lib/autofillGuard';
import { ConfirmDlg, Dlg } from '../a5-list/A5Ui';
import { Ic } from '../settings-sim/SettingsDialogs';
import { EmployeeChip, ItemChip, ItemLabel } from './PmParts';
import { STEPS, defaultsFor, employeeName, itemMatches, rowsByKey, summarizeGroup, validateStep } from './pmLogic';

const FILTERS = [['all', 'הכל'], ['pages', 'עמודים'], ['features', 'פיצ\'רים']];

export default function PmRowDialog({ group, initialKeys = [], catalog, allGroups, departments, employees, onClose, onSaved }) {
  const nf = useNoFill();
  const isEditing = !!group;
  const itemFor = (key) => catalog.find((i) => i.key === key) || null;

  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(isEditing ? STEPS.length - 1 : 0);
  const [name, setName] = useState(group ? group.name : '');
  const [keys, setKeys] = useState(() => (group ? [...group.keys] : [...initialKeys]));
  const [access, setAccess] = useState(() => {
    if (group) return Object.fromEntries(departments.map((d) => [d.roleId, !!(group.access && group.access[d.roleId])]));
    return defaultsFor(initialKeys.map(itemFor).filter(Boolean), departments);
  });
  const [accessTouched, setAccessTouched] = useState(isEditing);
  const [employeeIds, setEmployeeIds] = useState(() => new Set((group && group.employeeAccess) || []));
  const [itemQuery, setItemQuery] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [empQuery, setEmpQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'close' | 'delete'

  const initial = useMemo(() => JSON.stringify([name, [...keys].sort(), access, [...employeeIds].sort()]), []);
  const dirty = JSON.stringify([name, [...keys].sort(), access, [...employeeIds].sort()]) !== initial;
  const requestClose = () => { if (saving) return; if (dirty) setConfirm('close'); else onClose(); };

  const selectedItems = keys.map(itemFor).filter(Boolean);
  // מפתח -> שמות השורות האחרות שמכילות אותו (פריט יכול לשבת בכמה שורות: הגישה = האיחוד, מספיק ששורה אחת מתירה)
  const otherByKey = useMemo(() => {
    const m = new Map();
    for (const [k, gs] of rowsByKey((allGroups || []).filter((g) => !group || g.id !== group.id))) m.set(k, gs.map((g) => g.name));
    return m;
  }, [allGroups, group]);

  // פריטים מספריים אינם כן/לא ולכן לא נכנסים לשורה (יש להם לשונית משלהם); פריטים נעולים להנהלה ראשית - אין מה להגדיר
  const selectable = catalog.filter((i) => i.type === 'boolean' && !i.notConfigurable);
  const shownItems = selectable.filter((i) => (itemFilter === 'all' || i.group === itemFilter) && itemMatches(i, itemQuery));

  const toggleKey = (key) => {
    if (keys.includes(key)) { setKeys((prev) => prev.filter((k) => k !== key)); return; }
    // הפריט הראשון בשורה חדשה והמחלקות עוד לא נגעו בהן: מתחילים מברירת המחדל שלו, כדי ששמירה לא תשלול גישה קיימת בשקט
    if (!isEditing && !accessTouched && keys.length === 0) setAccess(defaultsFor([itemFor(key)].filter(Boolean), departments));
    setKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
  };
  const toggleAccess = (roleId) => { setAccessTouched(true); setAccess((p) => ({ ...p, [roleId]: !p[roleId] })); };
  const setAllAccess = (value) => { setAccessTouched(true); setAccess(Object.fromEntries(departments.map((d) => [d.roleId, value]))); };
  const resetAccess = () => { setAccessTouched(true); setAccess(defaultsFor(selectedItems, departments)); };

  const eligibleForEmployees = selectedItems.some((i) => i.type === 'boolean');
  const selectedEmployees = (employees || []).filter((e) => employeeIds.has(e.id));
  const empResults = (employees || []).filter((e) => {
    if (employeeIds.has(e.id)) return false;
    const q = empQuery.trim().toLowerCase();
    return !q || employeeName(e).toLowerCase().includes(q) || (e.department && e.department.name && e.department.name.toLowerCase().includes(q));
  });

  const goTo = (target) => {
    if (target > step) {
      for (let i = step; i < target; i++) {
        const problem = validateStep(i, { name, keys });
        if (problem) { setError(problem); setStep(i); return; }
      }
    }
    setError(null);
    setStep(target);
    setMaxStep((m) => Math.max(m, target));
  };

  const summary = summarizeGroup({ id: group ? group.id : '__new', keys, access, employeeAccess: eligibleForEmployees ? [...employeeIds] : [] }, catalog, [], departments, employees);
  const hasEnforced = selectedItems.some((i) => i.enforced);
  const sharedItems = selectedItems.filter((i) => otherByKey.has(i.key));

  const save = async () => {
    const problem = validateStep(0, { name, keys }) || validateStep(1, { name, keys });
    if (problem) { setError(problem); setStep(validateStep(0, { name, keys }) ? 0 : 1); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch(isEditing ? `/api/admin/permissions/page-groups/${group.id}` : '/api/admin/permissions/page-groups', {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, keys, access, employeeIds: eligibleForEmployees ? [...employeeIds] : [] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירה');
      onSaved(isEditing ? 'השורה עודכנה' : 'השורה נוצרה', name.trim());
    } catch (e) { setError(e.message || 'שגיאה בשמירה'); setSaving(false); }
  };

  const remove = async () => {
    setConfirm(null); setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/admin/permissions/page-groups/${group.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'שגיאה במחיקה');
      onSaved('השורה נמחקה', group.name);
    } catch (e) { setError(e.message || 'שגיאה במחיקה'); setSaving(false); }
  };

  const pickKey = (e, fn) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } };

  const renderStep = () => {
    if (step === 0) {
      return (
        <div className="mfld">
          <label className="lbl" htmlFor="pm-name"><Ic id="pencil" size="sm" />שם השורה</label>
          <input className="inp" id="pm-name" data-guide-id="perm.wiz-name" type="text" {...nf('name')} value={name} disabled={saving} placeholder="לדוגמה: מזכירות - דוחות כספיים"
            onChange={(e) => { setError(null); setName(e.target.value); }} onKeyDown={(e) => { if (e.key === 'Enter') goTo(1); }} />
          <span className="pm-hint">השם עוזר למצוא את השורה ברשימה. אותו עמוד או פיצ&apos;ר יכול לשבת בכמה שורות, והגישה בפועל היא האיחוד שלהן.</span>
        </div>
      );
    }
    if (step === 1) {
      return (
        <>
          <div className="mfld">
            <span className="lbl"><Ic id="shield" size="sm" />נבחרו לשורה <span className={`chip ${selectedItems.length ? 'gold' : 'gray'}`}>{selectedItems.length}</span></span>
            <div className="pm-chips pm-selected">
              {selectedItems.length === 0 ? <span className="pm-hint">עדיין לא נבחר דבר - סמנו פריטים ברשימה למטה</span> : null}
              {selectedItems.map((i) => <ItemChip key={i.key} item={i} alsoIn={otherByKey.get(i.key)} onRemove={() => toggleKey(i.key)} disabled={saving} />)}
            </div>
          </div>
          <div className="mfld">
            <label className="lbl" htmlFor="pm-iq"><Ic id="search" size="sm" />חיפוש עמוד או פיצ&apos;ר</label>
            <input className="inp" id="pm-iq" type="search" {...nf('search')} value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="הקלידו חלק משם או מתיאור" />
          </div>
          <div className="methods pm-seg" role="radiogroup" aria-label="סינון" style={{ '--n': FILTERS.length }}>
            {FILTERS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={itemFilter === k} className={itemFilter === k ? 'on' : ''} onClick={() => setItemFilter(k)}>{l}</button>)}
          </div>
          <div className="pm-picks" role="group" aria-label="עמודים ופיצ'רים">
            {shownItems.length === 0 ? <div className="pm-hint pm-none">לא נמצאו תוצאות</div> : null}
            {shownItems.map((item) => {
              const on = keys.includes(item.key);
              const also = otherByKey.get(item.key);
              return (
                <div key={item.key} role="checkbox" aria-checked={on} tabIndex={0} className={`pm-pick${on ? ' on' : ''}`} onClick={() => !saving && toggleKey(item.key)} onKeyDown={(e) => !saving && pickKey(e, () => toggleKey(item.key))}>
                  <span className="pm-pick-ic"><Ic id={item.group === 'pages' ? 'note' : 'sliders'} /></span>
                  <span className="pm-pick-x">
                    <b><ItemLabel item={item} /></b>
                    {item.description ? <small>{item.description}</small> : null}
                  </span>
                  {also ? <span className="chip amber" data-tip={`מופיע גם בשורה: ${also.join(', ')}`}>גם בשורה אחרת</span> : null}
                  {!item.enforced ? <span className="chip gray" data-tip="לא משנה את הגישה בפועל">לתיעוד בלבד</span> : null}
                  <span className="pm-pick-k" aria-hidden="true"><Ic id="check" plain /></span>
                </div>
              );
            })}
          </div>
        </>
      );
    }
    if (step === 2) {
      return (
        <div className="mfld">
          <span className="lbl"><Ic id="users" size="sm" />אילו מחלקות מורשות</span>
          <div className="pm-tools">
            <button type="button" className="btn sm" onClick={() => setAllAccess(true)} disabled={saving}><Ic id="check" size="sm" />סמן הכל</button>
            <button type="button" className="btn sm" onClick={() => setAllAccess(false)} disabled={saving}><Ic id="x" size="sm" />נקה הכל</button>
            <button type="button" className="btn ghost sm" onClick={resetAccess} disabled={saving || selectedItems.length === 0}><Ic id="refresh" size="sm" />אפס לברירת המחדל</button>
          </div>
          <div className="pm-depts">
            {departments.map((dept) => {
              const todayAllowed = selectedItems.length > 0 && selectedItems.every((i) => !!(i.defaultForRoleId && i.defaultForRoleId(dept.roleId)));
              return (
                <div key={dept.roleId} className={`pm-dept${access[dept.roleId] ? ' on' : ''}`}>
                  <b>{dept.name}</b>
                  {selectedItems.length > 0 ? <span className={`chip ${todayAllowed ? 'green' : 'gray'}`}>{todayAllowed ? 'מותר כיום' : 'לא מותר כיום'}</span> : null}
                  <label className="sw"><input type="checkbox" aria-label={`הרשאה למחלקה ${dept.name}`} checked={!!access[dept.roleId]} disabled={saving} onChange={() => toggleAccess(dept.roleId)} /><i /></label>
                </div>
              );
            })}
          </div>
          <span className="pm-hint">הנהלה ראשית ומתכנת מורשים תמיד לכל פריט, ולכן אין להם מתג.</span>
        </div>
      );
    }
    if (step === 3) {
      if (!eligibleForEmployees) {
        return <div className="pm-note"><Ic id="info" />פריט מספרי (כמו כמות שורות מרבית לייצוא) אינו כן/לא, ולכן אי אפשר לתת אותו לעובד ספציפי דרך שורה. את הערך שלו קובעים בכרטיס העובד או לפי מחלקה. אפשר להמשיך לשלב האישור.</div>;
      }
      return (
        <>
          <div className="mfld">
            <span className="lbl"><Ic id="userck" size="sm" />עובדים ספציפיים עם גישה (לא חובה)</span>
            <div className="pm-chips">
              {selectedEmployees.length === 0 ? <span className="pm-hint">לא נבחרו עובדים ספציפיים</span> : null}
              {selectedEmployees.map((e) => <EmployeeChip key={e.id} employee={e} disabled={saving} onRemove={() => setEmployeeIds((p) => { const n = new Set(p); n.delete(e.id); return n; })} />)}
            </div>
          </div>
          <div className="mfld">
            <label className="lbl" htmlFor="pm-eq"><Ic id="search" size="sm" />חיפוש עובד</label>
            <input className="inp" id="pm-eq" type="search" {...nf('search')} value={empQuery} onChange={(e) => setEmpQuery(e.target.value)} placeholder="שם או מחלקה" disabled={saving} />
          </div>
          <div className="pm-picks pm-emps">
            {empResults.length === 0 ? <div className="pm-hint pm-none">לא נמצאו תוצאות</div> : null}
            {empResults.slice(0, 60).map((e) => (
              <div key={e.id} role="button" tabIndex={0} className="pm-pick" onClick={() => !saving && setEmployeeIds((p) => new Set(p).add(e.id))} onKeyDown={(ev) => !saving && pickKey(ev, () => setEmployeeIds((p) => new Set(p).add(e.id)))}>
                <span className="pm-pick-ic"><Ic id="user" /></span>
                <span className="pm-pick-x"><b><bdi>{employeeName(e)}</bdi></b>{e.department && e.department.name ? <small>{e.department.name}</small> : null}</span>
                <span className="pm-pick-add" aria-hidden="true"><Ic id="plus" plain /></span>
              </div>
            ))}
            {empResults.length > 60 ? <div className="pm-hint pm-none">מוצגים 60 הראשונים - צמצמו בחיפוש</div> : null}
          </div>
        </>
      );
    }
    return (
      <div className="pm-sum">
        <div className="pm-sum-r"><small>שם השורה</small><b>{name.trim() || '—'}</b></div>
        <div className="pm-sum-r"><small>עמודים ופיצ&apos;רים ({selectedItems.length})</small><div className="pm-chips">{selectedItems.map((i) => <ItemChip key={i.key} item={i} alsoIn={otherByKey.get(i.key)} />)}</div></div>
        <div className="pm-sum-r"><small>מחלקות מורשות</small>
          <div className="pm-chips">
            {summary.allowedDepts.length === 0 ? <span className="chip gray">אף מחלקה</span> : summary.everyone ? <span className="chip green">כל המחלקות</span> : summary.allowedDepts.map((d) => <span key={d.roleId} className="chip blue">{d.name}</span>)}
          </div>
        </div>
        <div className="pm-sum-r"><small>עובדים ספציפיים</small>
          <div className="pm-chips">{eligibleForEmployees && selectedEmployees.length ? selectedEmployees.map((e) => <EmployeeChip key={e.id} employee={e} />) : <span className="pm-hint">ללא</span>}</div>
        </div>
        {hasEnforced && summary.nobody ? <div className="pm-warn bad" role="alert"><Ic id="alert" />לא נבחרה אף מחלקה ואף עובד - הפריטים שבשורה ייחסמו לכולם (חוץ מהנהלה ראשית ומתכנת).</div> : null}
        {sharedItems.length > 0 ? <div className="pm-warn"><Ic id="info" />{sharedItems.map((i) => i.label).join(', ')} מופיע גם בשורה אחרת - הגישה בפועל היא האיחוד של כל השורות (מותר אם אחת מהן מתירה).</div> : null}
        {selectedItems.some((i) => !i.enforced) ? <div className="pm-warn"><Ic id="info" />פריטים עם התג &quot;לתיעוד בלבד&quot; נשמרים לתיעוד: הגישה בפועל אליהם נשארת כמו היום.</div> : null}
      </div>
    );
  };

  const isLast = step === STEPS.length - 1;
  return (
    <>
      <Dlg className="mailwin pm-dlg" labelledBy="pm-dlg-t" onClose={requestClose} focusSel="#pm-name, .pm-seg button, .mx">
        <div className="pm-wiz" data-guide-id="perm.wizard">
          <div className="mh">
            <span className="mico"><Ic id="shield" size="lg" /></span>
            <h2 id="pm-dlg-t">{isEditing ? 'עריכת שורת הרשאה' : 'שורת הרשאה חדשה'}<small className="msub">שלב {step + 1} מתוך {STEPS.length} · {STEPS[step]}</small></h2>
            <button type="button" className="ibtn mx" aria-label="סגירה" data-tip="סגור" onClick={requestClose}><Ic id="x" size="sm" /></button>
          </div>
          <ol className="pm-steps" data-guide-id="perm.wiz-stepper" aria-label="שלבי האשף">
            {STEPS.map((label, index) => {
              const reachable = index <= maxStep;
              const done = index < step;
              return (
                <li key={label} className={`pm-st${index === step ? ' on' : ''}${done ? ' done' : ''}`}>
                  <button type="button" disabled={!reachable || saving} aria-current={index === step ? 'step' : undefined} data-tip={label} onClick={() => goTo(index)}>
                    <span className="pm-st-n">{done ? <Ic id="check" plain /> : index + 1}</span>
                    <span className="pm-st-l">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="pm-body">
            {error ? <div className="pm-warn bad" role="alert"><Ic id="alert" />{error}</div> : null}
            {renderStep()}
          </div>
          <div className="pm-foot">
            {isEditing ? <button type="button" className="btn ghost pm-del" onClick={() => setConfirm('delete')} disabled={saving}><Ic id="trash" size="sm" />מחק שורה</button> : <span />}
            <div className="pm-foot-r">
              {step === 0
                ? <button type="button" className="btn ghost" onClick={requestClose} disabled={saving}><Ic id="x" size="sm" />ביטול</button>
                : <button type="button" className="btn" onClick={() => goTo(step - 1)} disabled={saving}><Ic id="back" size="sm" />הקודם</button>}
              {isLast
                ? <button type="button" className="btn primary lg" onClick={save} disabled={saving}>{saving ? <><span className="mspin" />שומר...</> : <><Ic id="check" />{isEditing ? 'עדכון השורה' : 'יצירת השורה'}</>}</button>
                : <button type="button" className="btn primary" data-guide-id="perm.wiz-next" onClick={() => goTo(step + 1)} disabled={saving}>הבא<Ic id="arrl" size="sm" /></button>}
            </div>
          </div>
        </div>
      </Dlg>
      {confirm === 'delete' ? (
        <ConfirmDlg title={`למחוק את השורה "${group.name}"?`} sub="העמודים והפיצ'רים שבה יחזרו להרשאת ברירת המחדל שלהם (למעט אלה שמופיעים גם בשורה אחרת)." okLabel="מחיקת השורה" icon="trash" cancelLabel="חזרה" onYes={remove} onNo={() => setConfirm(null)} />
      ) : null}
      {confirm === 'close' ? (
        <ConfirmDlg title="לסגור בלי לשמור?" sub="השינויים שעשיתם בשורה לא יישמרו." okLabel="סגירה בלי לשמור" icon="alert" cancelLabel="חזרה לעריכה" onYes={onClose} onNo={() => setConfirm(null)} />
      ) : null}
    </>
  );
}
