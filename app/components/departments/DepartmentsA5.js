'use client';

// ניהול המחלקות החדש (/admin/departments) - אותו קונספט בדיוק כמו רשימות העובדים / הדגמים / ההזמנות (העיצוב המאושר, ערכת a5-list): כותרת עם חץ חזרה,
// חיפוש חצי רוחב מתחת לכותרת + לחצן "סינון" אחד, סרגל תוצאות דביק (שורות / טבלה, מיון, עימוד, XL / הורדה / הדפסה), שורות 21px/14px עם זוגות אייקון + ערך
// (אפס / ריק לא מוצג), חץ פרטים מהירים. מחלקות הן רשימה קטנה (עשרות) - הסינון / המיון / העימוד בדפדפן. כל היכולות של הדף הישן נשמרו: יצירה (מספר + שם),
// שינוי שם, מחיקה (חסומה לתפקידי מערכת 1 / 2 ולמחלקה עם עובדים - השרת הוא הסמכות והודעותיו מוצגות), ספירת עובדים משויכים. אין חיפוש חכם ושאלות סטטיסטיקה
// (אין להם שרת למחלקות). יצירה / שינוי שם / מחיקה = חלונות כהים (בלי alert / confirm). פירוט: docs/a5-staff-models/departments-notes.md.

import '@/design-system/components.css';
import './departments.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PageVariantToggle from '../variant/PageVariantToggle';
import { runPrint } from '../a5-print/runPrint';
import { A5List, A5ListPage, A5Page, Dlg, DlgBadge, Ic, runListExport, useA5 } from '../a5-list';
import {
  DEFAULT_SORT, DELETE_TIPS, FILTERS, SHEET_TITLE, SORTS, activeNamesByRole, deleteBlock, deleteBlockedMessage, deptIcon, deptPairs, deptRow, departmentsExcelRows, hayOf,
  nextRoleId, validateCreate, validateRename,
} from './departmentsLogic';

// מדריך האתר: guide="dpt" מצמיד data-guide-id (dpt.back / dpt.search / dpt.filter / dpt.sort / dpt.view / dpt.export-* ...) - lib/aiGuide/areas/admin.targets.js
const SLOT_ID = 'a5l-search-dpt';

function Pair({ p, hl }) {
  const body = p.bdi ? <bdi>{hl(p.text)}</bdi> : p.bold ? <b><bdi>{p.text}</bdi></b> : p.text;
  return <span className="lni" data-tip={p.tip}><Ic id={p.icon} />{body}</span>;
}

async function readJson(res) {
  try { return await res.json(); } catch { return {}; }
}

// חלון "מחלקה חדשה" / "שינוי שם": שגיאות (גם של השרת, כמו "כבר קיימת מחלקה בשם...") מוצגות בתוך החלון
function DeptForm({ mode, row, defaultRoleId, onClose, onSaved }) {
  const create = mode === 'create';
  const [name, setName] = useState(create ? '' : row.name);
  const [roleId, setRoleId] = useState(String(defaultRoleId));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    const v = create ? validateCreate({ roleId, name }) : validateRename(name);
    if (!v.ok) { setErr(v.error); return; }
    setBusy(true); setErr('');
    try {
      const res = create
        ? await fetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId: v.roleId, name: v.name }) })
        : await fetch(`/api/departments/${row.roleId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: v.name }) });
      const data = await readJson(res);
      if (!res.ok) { setErr(data.error || (create ? 'שגיאה ביצירת המחלקה' : 'שגיאה בעדכון המחלקה')); setBusy(false); return; }
      onSaved(create ? 'created' : 'renamed', v.name);
    } catch {
      setErr(create ? 'שגיאת תקשורת ביצירת המחלקה' : 'שגיאת תקשורת בעדכון המחלקה');
      setBusy(false);
    }
  };
  const onKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } };

  return (
    <Dlg labelledBy="dpt-form-t" onClose={busy ? undefined : onClose} focusSel="input[data-autofocus]">
      <DlgBadge icon={create ? 'plus' : 'pencil'} />
      <h2 id="dpt-form-t">{create ? 'מחלקה חדשה' : 'שינוי שם מחלקה'}</h2>
      {create ? null : <div className="sub">מחלקה מספר <bdi>{row.roleId}</bdi> · הגדרות ששומרות מחלקות לפי שם (למשל ״מחלקות מורשות״) לא יתעדכנו אוטומטית</div>}
      <div className="dpt-fields">
        {create ? (
          <div className="field">
            <label className="lbl" htmlFor="dptRole">מספר מחלקה</label>
            <div className="inpw"><Ic id="hash" size="sm" />
              <input className="inp" id="dptRole" type="number" min="0" inputMode="numeric" value={roleId} autoComplete="off" onChange={(e) => { setRoleId(e.target.value); setErr(''); }} onKeyDown={onKey} />
            </div>
          </div>
        ) : null}
        <div className="field">
          <label className="lbl" htmlFor="dptName">שם המחלקה</label>
          <div className="inpw"><Ic id="building" size="sm" />
            <input className="inp" id="dptName" type="text" value={name} autoComplete="off" placeholder="שם המחלקה…" data-autofocus="true" onChange={(e) => { setName(e.target.value); setErr(''); }} onKeyDown={onKey} />
          </div>
        </div>
      </div>
      <div className="dpt-err" role="alert" aria-live="polite">{err ? <><Ic id="alert" size="sm" />{err}</> : null}</div>
      <div className="dbtns">
        <button type="button" className="btn primary lg block" disabled={busy} onClick={submit}><Ic id="check" />{create ? 'יצירת המחלקה' : 'שמירת השם'}</button>
        <button type="button" className="btn ghost block" disabled={busy} onClick={onClose}><Ic id="back" size="sm" />ביטול</button>
      </div>
    </Dlg>
  );
}

function Departments() {
  const router = useRouter();
  const a5 = useA5();
  const [raw, setRaw] = useState(null); // מחלקות גולמיות מהשרת | null בטעינה ראשונה
  const [byRole, setByRole] = useState(null); // roleId -> שמות העובדים הפעילים (נטען אחרי הרשימה, לא חוסם אותה)
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // { mode, row? }

  const load = useCallback(async () => {
    setError('');
    // שמות העובדים רק לפירוט / הדפסה - נטענים במקביל ולא מעכבים את הרשימה; כשל שלהם לא חוסם אותה
    const empP = fetch('/api/employees?slim=1', { cache: 'no-store' })
      .then(async (r) => (r.ok ? readJson(r) : []))
      .then((j) => setByRole(activeNamesByRole(Array.isArray(j) ? j : [])))
      .catch(() => {});
    try {
      const dRes = await fetch('/api/departments', { cache: 'no-store' });
      if (dRes.status === 401) { setError('נדרשת התחברות - מסך ניהול המחלקות זמין למשתמשים מחוברים בלבד'); setRaw((x) => x || []); return; }
      const dData = await readJson(dRes);
      if (!dRes.ok) throw new Error(dData.error || 'שגיאה בטעינת המחלקות');
      setRaw(Array.isArray(dData) ? dData : []);
    } catch (e) {
      setError((e && e.message) || 'שגיאה בטעינת המחלקות');
      setRaw((x) => x || []);
    }
    await empP;
  }, []);
  useEffect(() => { load(); }, [load]);

  const depts = raw;
  const rows = useMemo(() => (raw || []).map((d) => deptRow(d, byRole)), [raw, byRole]);
  const defaultRoleId = useMemo(() => nextRoleId(rows), [rows]);

  const saved = (kind, name) => {
    setForm(null);
    a5.say(kind === 'created' ? 'המחלקה נוצרה' : 'שם המחלקה עודכן', 'ok', name);
    load();
  };

  const remove = async (r) => {
    if (deleteBlock(r)) { a5.say('אי אפשר למחוק את המחלקה', 'warn', deleteBlockedMessage(r)); return; }
    const ok = await a5.confirm({
      title: `למחוק את המחלקה ״${r.name}״?`, sub: `מחלקה מספר ${r.roleId} · מחיקה אפשרית רק כשאין עובדים משויכים למחלקה`, okLabel: 'מחיקת המחלקה', icon: 'trash',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/departments/${r.roleId}`, { method: 'DELETE' });
      const data = await readJson(res);
      if (!res.ok) { a5.say('המחיקה נכשלה', 'error', data.error || 'שגיאה במחיקת המחלקה'); load(); return; }
      a5.say('המחלקה נמחקה', 'ok', r.name);
      load();
    } catch {
      a5.say('המחיקה נכשלה', 'error', 'שגיאת תקשורת במחיקת המחלקה');
    }
  };

  const rowMain = (r, c) => (
    <>
      <div className="ic-b sq"><Ic id={deptIcon(r.name)} /></div>
      <div className="t"><b>{c.hl(r.name)}</b><span className="ln mi">
        {deptPairs(r).map((p) => <Pair key={p.key} p={p} hl={c.hl} />)}
      </span></div>
    </>
  );

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b>{v}</b></div>;
    const block = deleteBlock(r);
    const who = !r.namesKnown ? (r.employees > 0 ? String(r.employees) : '')
      : r.names.length ? `${r.names.join(' · ')}${r.inactive > 0 ? ` · ועוד ${r.inactive} לא פעילים` : ''}`
        : (r.employees > 0 ? `${r.employees} עובדים לא פעילים` : '');
    return (
      <>
        {row('מספר מחלקה', <bdi>{r.roleId}</bdi>)}
        {row('סוג', r.system ? 'תפקיד מערכת' : 'מחלקה רגילה')}
        {who ? row(r.employees === 1 ? 'עובד משויך' : 'עובדים משויכים', who) : null}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn primary sm" onClick={() => setForm({ mode: 'rename', row: r })}><Ic id="pencil" size="sm" />שינוי שם</button>
          <span className="dpt-dis" data-tip={DELETE_TIPS[block || 'none']}>
            <button type="button" className="btn sm" disabled={block === 'system'} aria-label="מחיקת המחלקה" onClick={() => remove(r)}><Ic id="trash" size="sm" />מחיקה</button>
          </span>
        </b></div>
      </>
    );
  };

  const numCell = (get) => ({ tdClass: (r) => `num${get(r) ? '' : ' zero'}`, cell: (r) => (get(r) || '') });
  const columns = [
    { k: 'roleId', t: 'מס׳ מחלקה', cell: (r, c) => <bdi>{c.hl(String(r.roleId))}</bdi> },
    { k: 'name', t: 'שם מחלקה', cell: (r, c) => <span className="tcn"><Ic id={deptIcon(r.name)} /><b>{c.hl(r.name)}</b></span> },
    { k: 'employees', t: 'עובדים', ...numCell((r) => r.employees) },
    { k: 'type', t: 'סוג', cell: (r) => (r.system ? <><Ic id="lock" />תפקיד מערכת</> : '') },
  ];

  const printDoc = (kind) => (list, state) => runPrint({ doc: 'departments-employees', kind, say: a5.say, data: { rows: list, state, filters: FILTERS } });
  const onExcel = (list, _state, info) => {
    const flat = departmentsExcelRows(list);
    runListExport({ kind: 'excel', say: a5.say, title: SHEET_TITLE, subtitle: info.filterText, base: 'מחלקות', head: flat.head, rows: flat.rows });
  };

  return (
    <>
      <A5ListPage
        guide="dpt" title="מחלקות" backId="dptBack" onBack={() => router.push('/admin')}
        tools={<PageVariantToggle screen="departments" placement="header" systemTip />}
        slotId={SLOT_ID} cardIcon="building" cardTitle="ניהול מחלקות"
        cardAction={<button type="button" className="btn navy" id="btnNew" data-guide-id="dpt.new" disabled={depts === null || !!(error && !rows.length)} data-tip="מספר המחלקה נשמר בכרטיס העובד" onClick={() => setForm({ mode: 'create' })}><Ic id="plus" />מחלקה חדשה</button>}
      >
        <A5List
          guide="dpt"
          items={rows}
          getId={(r) => r.roleId}
          texts={{ placeholder: 'חיפוש מחלקה (שם או מספר)…', countLabel: 'מחלקות', emptyText: depts && !depts.length ? 'אין מחלקות במערכת' : 'לא נמצאו מחלקות התואמות את החיפוש' }}
          hay={hayOf}
          filters={FILTERS}
          sorts={SORTS}
          defaultSort={DEFAULT_SORT}
          rowMain={rowMain}
          detail={detail}
          columns={columns}
          searchSlot={SLOT_ID}
          exportSpec={{ what: 'רשימת המחלקות', onExcel, onPrint: printDoc('print'), onDownload: printDoc('download') }}
          loading={depts === null}
          error={error}
          onRetry={load}
        />
      </A5ListPage>
      {form ? (
        <DeptForm mode={form.mode} row={form.row} defaultRoleId={defaultRoleId} onClose={() => setForm(null)} onSaved={saved} />
      ) : null}
    </>
  );
}

export default function DepartmentsA5() {
  return <A5Page name="gm-dpt"><Departments /></A5Page>;
}
