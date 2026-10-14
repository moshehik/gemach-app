'use client';

// הרשאות (/admin/permissions) בעיצוב "הגדרות מערכת" + "מרכז המיילים": אותה מעטפת (.gm-ds.gm-st), עמודת לשוניות כחולה בצד ימין, כותרת עם חזרה ושבבי מצב,
// שורת חיפוש, סעיפים עם שורות של הפלטה (.li.st-row), וחלון צף (.dlg.mailwin) לעריכת שורה. אותם API ואותה התנהגות כמו הדף הישן (app/admin/permissions/PermissionsClient.js):
//   GET /api/admin/permissions (מחלקות + ערכים בפועל, שורות, הגדרות ארגון, חריגות אישיות) · GET /api/employees?all=true
//   POST / PUT / DELETE /api/admin/permissions/page-groups[/<id>] (PmRowDialog) · PUT /api/admin/permissions/department-values (ערכים מספריים)
// לשוניות: שורות הרשאה (הרשימה + יצירה / עריכה) · מה מותר למי (מטריצה: פריט x מחלקה, מחושבת מהערכים בפועל) · ערכים מספריים · חריגות אישיות (מכרטיס העובד, לקריאה בלבד).
// לוגיקה טהורה: pmLogic.js. רכיבים: PmParts.js, PmRowDialog.js. CSS: permissions-a5.css (בהיקף .gm-ds.gm-st .pm-*).

import '@/design-system/components.css';
import '../settings-sim/settings-sim.css';
import './permissions-a5.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { PERMISSION_CATALOG } from '@/lib/permissionsMetadata';
import { HomeSprite } from '../home/HomeParts';
import PageVariantToggle from '../variant/PageVariantToggle';
import usePageTooltip from '../profile/usePageTooltip';
import { A5PortalRoot } from '../a5-list/A5Ui';
import { Ic, Toast } from '../settings-sim/SettingsDialogs';
import { EmployeeChip, ItemChip, ItemLabel } from './PmParts';
import PmRowDialog from './PmRowDialog';
import {
  docOnlyCount, groupMatches, itemOf, matrixCell, matrixItems, rowsByKey, SOURCE_TEXT, summarizeGroup, whoText, withOrgDefaults,
} from './pmLogic';

const TABS = [
  { id: 'rows', label: 'שורות הרשאה', icon: 'shield' },
  { id: 'matrix', label: 'מה מותר למי', icon: 'table' },
  { id: 'numeric', label: 'ערכים מספריים', icon: 'sliders' },
  { id: 'overrides', label: 'חריגות אישיות', icon: 'userck' },
];
const MATRIX_FILTERS = [['all', 'הכל'], ['pages', 'עמודים'], ['features', 'פיצ\'רים']];

function Banner({ kind = 'info', icon, heading, text, onClose }) {
  return (
    <div className="nb-w in">
      <section className={`nb nb-${kind}`} role="status">
        <div className="nb-main">
          <div className="nb-head">
            <span aria-hidden="true" className="nb-ic"><Ic id={icon || (kind === 'success' ? 'check' : 'alert')} plain /></span>
            <div className="nb-msg"><b>{heading}</b>{text ? <span>{text}</span> : null}</div>
            {onClose ? <button type="button" className="nb-x" aria-label="סגור" onClick={onClose}><Ic id="x" plain /></button> : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Empty({ icon = 'info', title, text, action }) {
  return (
    <div className="empty st-state pm-empty" role="status">
      <Ic id={icon} size="lg" />
      <div><b>{title}</b>{text ? <><br /><small>{text}</small></> : null}</div>
      {action}
    </div>
  );
}

export default function PermissionsA5() {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalRoot, setPortalRoot] = useState(null);
  useEffect(() => { setPortalRoot(rootRef.current); }, []);
  usePageTooltip(rootRef, ttRef, false);

  const [data, setData] = useState(null); // { departments, groups, orgSettings, personalOverrides }
  const [employees, setEmployees] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('rows');
  const [query, setQuery] = useState('');
  const [mFilter, setMFilter] = useState('all');
  const [onlyRestricted, setOnlyRestricted] = useState(false);
  const [showLocked, setShowLocked] = useState(false);
  const [dlg, setDlg] = useState(null); // { group, initialKeys }
  const [toast, setToast] = useState(null);
  const [banner, setBanner] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const res = await fetch('/api/admin/permissions', { cache: 'no-store' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'שגיאה בטעינת ההרשאות');
      setData({ departments: d.departments || [], groups: d.groups || [], orgSettings: d.orgSettings || {}, personalOverrides: d.personalOverrides || [] });
    } catch (e) { setLoadError(e.message || 'שגיאה בטעינת ההרשאות'); }
  }, []);
  useEffect(() => {
    load();
    fetch('/api/employees?all=true').then((r) => r.json()).then((l) => setEmployees(Array.isArray(l) ? l : [])).catch(() => setEmployees([]));
  }, [load]);
  useEffect(() => {
    try { const t = new URLSearchParams(window.location.search).get('tab'); if (TABS.some((x) => x.id === t)) setTab(t); } catch { /* */ }
  }, []);

  // ברירות המחדל של הפריטים תלויות בהגדרות הארגון (עמודים שנפתחים / נסגרים לפי הגדרה) - "מותר כיום" חייב להשתמש בהן
  const catalog = useMemo(() => withOrgDefaults(PERMISSION_CATALOG, data ? data.orgSettings : {}), [data]);
  const departments = data ? data.departments : [];
  const groups = data ? data.groups : [];
  const overrides = data ? data.personalOverrides : [];
  const rowMap = useMemo(() => rowsByKey(groups), [groups]);
  const numericItems = catalog.filter((i) => i.type === 'number');
  const lockedCount = catalog.filter((i) => i.type === 'boolean' && i.notConfigurable).length;
  const tabs = TABS.filter((t) => t.id !== 'numeric' || numericItems.length > 0);
  const activeTab = tabs.some((t) => t.id === tab) ? tab : 'rows';
  const counts = { rows: groups.length, overrides: overrides.length };

  const showToast = (title, sub) => setToast({ title, sub, icon: 'check' });
  const openRow = (group, initialKeys = []) => setDlg({ group, initialKeys });
  const afterSave = (title, name) => { setDlg(null); showToast(title, name); load(); };

  const q = query.trim();
  const shownGroups = groups.filter((g) => groupMatches(g, q, catalog, departments, employees));
  const mItems = matrixItems(catalog, { group: mFilter, q, onlyRestricted, showLocked, departments, rowMap });
  const shownOverrides = overrides.filter((o) => {
    if (!q) return true;
    const item = itemOf(catalog, o.key);
    const hay = `${item ? item.label : o.key} ${o.employee ? [o.employee.firstName, o.employee.lastName].join(' ') : ''}`.toLowerCase();
    return q.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
  });

  const saveNumeric = async (roleId, key, value) => {
    setBusyKey(`${roleId}:${key}`);
    try {
      const res = await fetch('/api/admin/permissions/department-values', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roleId, key, value }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'שגיאה בשמירה');
      showToast('הערך נשמר', value === null ? 'חזר לברירת המחדל' : String(value));
      await load();
    } catch (e) { setBanner({ title: 'שמירת הערך נכשלה', text: e.message || 'שגיאה בשמירת הערך' }); }
    setBusyKey(null);
  };

  /* ------------------------------ לשונית: שורות ------------------------------ */
  const renderRows = () => (
    <>
      <p className="ec-note pm-intro">
        מקור אמת אחד לכל שאלה על הרשאות: לאיזה עמודים ופיצ&apos;רים יש גישה לכל מחלקה, ואילו עובדים קיבלו גישה ספציפית. הרשימה מציגה רק שורות שנוצרו במפורש - עמוד או פיצ&apos;ר חדש לא מופיע כאן אוטומטית.
        פריט עם התג &quot;לתיעוד בלבד&quot; נשמר לתיעוד: הגישה אליו נשארת כמו היום. פיצ&apos;רים ללא התג נאכפים מיד.
      </p>
      <section className="st-sec st-card" data-guide-id="perm.table">
        <h2 className="adm-h">
          <span className="adm-hi"><Ic id="shield" /></span>שורות הרשאה
          <span className="st-hr">
            <button type="button" className="btn primary sm" data-guide-id="perm.new-row" onClick={() => openRow(null)}><Ic id="plus" />שורת הרשאה חדשה</button>
          </span>
        </h2>
        <div className="card adm-rows"><div className="list">
          {groups.length === 0 ? (
            <Empty icon="shield" title="אין עדיין שורות הרשאה" text="לחצו על ״שורת הרשאה חדשה״ כדי להתחיל." />
          ) : shownGroups.length === 0 ? (
            <Empty icon="search" title="לא נמצאו שורות התואמות לחיפוש" />
          ) : shownGroups.map((g) => {
            const s = summarizeGroup(g, catalog, groups, departments, employees);
            const otherNames = (key) => (rowMap.get(key) || []).filter((r) => r.id !== g.id).map((r) => r.name);
            return (
              <div className="li st-row st-ctlrow pm-row" key={g.id}>
                <div className="ic-b"><Ic id="shield" /></div>
                <div className="t">
                  <b className="st-lb">
                    <bdi>{g.name}</bdi>
                    <span className="chip gray st-chg">{s.items.length} פריטים</span>
                    {s.docOnly > 0 ? <span className="chip amber st-chg" data-tip="בשורה יש פריטים שנשמרים לתיעוד בלבד - הגישה בפועל אליהם לא משתנה">{s.docOnly} לתיעוד בלבד</span> : null}
                    {s.shared.length > 0 ? <span className="chip amber st-chg" data-tip="פריטים שמופיעים גם בשורה אחרת - הגישה היא האיחוד של השורות">{s.shared.length} משותפים</span> : null}
                  </b>
                  <div className="pm-chips">
                    {g.keys.map((key) => <ItemChip key={key} item={itemOf(catalog, key)} fallbackKey={key} alsoIn={otherNames(key)} />)}
                  </div>
                  <div className="pm-who">
                    <small>מי מורשה:</small>
                    {s.nobody ? <span className="chip gray">ללא הרשאה</span> : s.everyone ? <span className="chip green"><Ic id="check" plain />כולם</span> : s.allowedDepts.map((d) => <span key={d.roleId} className="chip blue">{d.name}</span>)}
                    {s.allowedEmployees.map((e) => <EmployeeChip key={e.id} employee={e} />)}
                  </div>
                </div>
                <div className="st-ctl">
                  <button type="button" className="btn ghost sm" data-guide-id="perm.row-edit" data-tip={`עריכת השורה - ${whoText(s)}`} onClick={() => openRow(g)}><Ic id="pencil" />עריכה</button>
                </div>
              </div>
            );
          })}
        </div></div>
      </section>
    </>
  );

  /* ------------------------------ לשונית: מטריצה ------------------------------ */
  const renderMatrix = () => {
    const mIdx = Math.max(0, MATRIX_FILTERS.findIndex(([k]) => k === mFilter));
    return (
      <>
        <p className="ec-note pm-intro">
          התמונה המלאה: לכל עמוד ופיצ&apos;ר - האם כל מחלקה רשאית אליו כרגע. הערכים הם מה שהמערכת באמת מיישמת (האיחוד של כל השורות שמכילות את הפריט, ואם אין שורה - ברירת המחדל).
          הנהלה ראשית ומתכנת מורשים תמיד לכל פריט. כדי לשנות - פתחו את השורה, או הוסיפו את הפריט לשורה חדשה.
        </p>
        <section className="st-sec st-card">
          <h2 className="adm-h"><span className="adm-hi"><Ic id="table" /></span>מה מותר למי</h2>
          <div className="pm-mtools">
            <div className="seg pill pm-mseg" role="radiogroup" aria-label="סינון לפי סוג" style={{ '--n': MATRIX_FILTERS.length, '--i': mIdx }}>
              <span className="pth" aria-hidden="true" />
              {MATRIX_FILTERS.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mFilter === k} className={mFilter === k ? 'on' : ''} onClick={() => setMFilter(k)}>{l}</button>)}
            </div>
            <label className="pm-only"><span className="sw"><input type="checkbox" checked={onlyRestricted} onChange={(e) => setOnlyRestricted(e.target.checked)} /><i /></span>רק פריטים שחסומים לחלק מהמחלקות</label>
            <label className="pm-only"><span className="sw"><input type="checkbox" checked={showLocked} onChange={(e) => setShowLocked(e.target.checked)} /><i /></span>הצג גם פריטים נעולים להנהלה ראשית ({lockedCount})</label>
            <span className="pm-legend"><span className="pm-ok"><Ic id="check" plain /></span> מותר <span className="pm-no"><Ic id="x" plain /></span> חסום</span>
          </div>
          {mItems.length === 0 ? (
            <div className="card adm-rows"><div className="list"><Empty icon="search" title="לא נמצאו פריטים" text={onlyRestricted ? 'אין פריטים שחסומים לחלק מהמחלקות בסינון הזה.' : undefined} /></div></div>
          ) : (
            <div className="card adm-rows pm-mcard"><div className="tblw pm-tblw">
              <table className="rtbl pm-mtbl">
                <thead>
                  <tr>
                    <th>פריט</th>
                    {departments.map((d) => <th key={d.roleId} className="tc">{d.name}</th>)}
                    <th>שורה</th>
                  </tr>
                </thead>
                <tbody>
                  {mItems.map((item) => {
                    const rows = rowMap.get(item.key) || [];
                    return (
                      <tr key={item.key}>
                        <td className="pm-mi">
                          <b><ItemLabel item={item} /></b>
                          <span className="pm-mi-b">
                            <span className={`chip ${item.group === 'features' ? 'teal' : 'blue'}`}>{item.group === 'features' ? 'פיצ\'ר' : 'עמוד'}</span>
                            {!item.enforced ? <span className="chip gray" data-tip="לא משנה את הגישה בפועל">לתיעוד בלבד</span> : null}
                          </span>
                        </td>
                        {departments.map((d) => {
                          const c = matrixCell(item, d, rows);
                          const tip = `${c.allowed ? 'מותר' : 'חסום'} · ${SOURCE_TEXT[c.source]}${c.rowNames.length ? `: ${c.rowNames.join(', ')}` : ''}`;
                          return (
                            <td key={d.roleId} className={`tc pm-cell ${c.allowed ? 'ok' : 'no'} src-${c.source}`} data-tip={tip}>
                              <span className="pm-dot" role="img" aria-label={tip}><Ic id={c.allowed ? 'check' : 'x'} plain /></span>
                            </td>
                          );
                        })}
                        <td className="pm-mr">
                          {rows.length ? rows.slice(0, 2).map((r) => <button key={r.id} type="button" className="chip gold pm-rowlink" data-tip="פתיחת השורה לעריכה" onClick={() => openRow(r)}><bdi>{r.name}</bdi></button>)
                            : item.notConfigurable ? <span className="chip gray" data-tip={item.notConfigurable}><Ic id="lock" plain />נעול</span>
                              : <button type="button" className="btn ghost sm" onClick={() => openRow(null, [item.key])}><Ic id="plus" size="sm" />שורה</button>}
                          {rows.length > 2 ? <span className="chip gray">+{rows.length - 2}</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div></div>
          )}
        </section>
      </>
    );
  };

  /* ------------------------------ לשונית: ערכים מספריים ------------------------------ */
  const renderNumeric = () => (
    <>
      <p className="ec-note pm-intro">פריטים שהם מספר ולא כן/לא, ולכן לא נכנסים לשורות הרשאה. לעובד ספציפי קובעים ערך בכרטיס שלו, והוא מופיע בלשונית &quot;חריגות אישיות&quot;.</p>
      <section className="st-sec st-card" data-guide-id="perm.numeric">
        <h2 className="adm-h"><span className="adm-hi"><Ic id="sliders" /></span>ערכים מספריים לפי מחלקה</h2>
        <div className="card adm-rows"><div className="tblw pm-tblw">
          <table className="rtbl">
            <thead><tr><th>פריט</th>{departments.map((d) => <th key={d.roleId}>{d.name}</th>)}</tr></thead>
            <tbody>
              {numericItems.map((item) => (
                <tr key={item.key}>
                  <td><b><ItemLabel item={item} /></b></td>
                  {departments.map((d) => {
                    const cell = d.values[item.key];
                    const busy = busyKey === `${d.roleId}:${item.key}`;
                    return (
                      <td key={d.roleId}>
                        <div className="pm-num">
                          <input
                            className="inp" type="number" min="0" aria-label={`${item.label} - ${d.name}`} disabled={busy}
                            defaultValue={cell.value} key={`${d.roleId}-${cell.value}`}
                            onBlur={(e) => { const n = parseInt(e.target.value, 10); if (!Number.isNaN(n) && n !== cell.value) saveNumeric(d.roleId, item.key, n); }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                          />
                          {cell.isExplicit ? <button type="button" className="ibtn" aria-label="איפוס לברירת המחדל" data-tip="איפוס לברירת המחדל" data-ico="undo" disabled={busy} onClick={() => saveNumeric(d.roleId, item.key, null)}><Ic id="undo" plain /></button> : null}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      </section>
    </>
  );

  /* ------------------------------ לשונית: חריגות אישיות ------------------------------ */
  const renderOverrides = () => (
    <>
      <p className="ec-note pm-intro">הרשאות שנקבעו לעובד ספציפי ישירות בכרטיס שלו ולא דרך שורה. הן קודמות לשורת המחלקה (מותר או חסום), ואת השינוי בהן עושים בכרטיס העובד.</p>
      <section className="st-sec st-card" data-guide-id="perm.overrides">
        <h2 className="adm-h"><span className="adm-hi"><Ic id="userck" /></span>חריגות אישיות מכרטיס העובד</h2>
        <div className="card adm-rows"><div className="list">
          {overrides.length === 0 ? <Empty icon="userck" title="אין חריגות אישיות" />
            : shownOverrides.length === 0 ? <Empty icon="search" title="לא נמצאו חריגות התואמות לחיפוש" />
              : shownOverrides.map((o) => {
                const item = itemOf(catalog, o.key);
                return (
                  <div className="li st-row st-ctlrow" key={`${o.employeeId}:${o.key}`}>
                    <div className="ic-b"><Ic id="user" /></div>
                    <div className="t">
                      <b className="st-lb"><EmployeeChip employee={o.employee} /></b>
                      <small><ItemLabel item={item} fallbackKey={o.key} /></small>
                    </div>
                    <div className="st-ctl">
                      {item && item.type === 'number' ? <span className="chip gray">{o.value}</span> : o.value ? <span className="chip green"><Ic id="check" plain />מותר</span> : <span className="chip rose"><Ic id="x" plain />חסום</span>}
                      <a className="btn ghost sm" href={`/employees/${o.employeeId}`} data-tip="לכרטיס העובד"><Ic id="pencil" />לכרטיס</a>
                    </div>
                  </div>
                );
              })}
        </div></div>
      </section>
    </>
  );

  const loading = !data && !loadError;
  const showSearch = activeTab !== 'numeric';
  const hits = activeTab === 'rows' ? shownGroups.length : activeTab === 'matrix' ? mItems.length : shownOverrides.length;

  return (
    <A5PortalRoot.Provider value={portalRoot}>
      <div className="gm-ds gm-st gm-pm home-bg dlg-dark" ref={rootRef} dir="rtl">
        <HomeSprite />
        <div className="app st-view" data-view="permissions">
          <div className="st-banners">
            {banner ? <Banner kind="warning" icon="alert" heading={banner.title} text={banner.text} onClose={() => setBanner(null)} /> : null}
          </div>

          <div className="topbar">
            <Link className="back" href="/admin" aria-label="חזרה למסך ניהול" data-tip="חזרה למסך ניהול"><Ic id="back" plain /></Link>
            <div className="ttl">
              <h1 className="pg-ttl"><small>ניהול</small><bdi>הרשאות</bdi></h1>
              {data ? (
                <div className="row wrap st-chips">
                  <span className="chip gold">{groups.length} שורות</span>
                  <span className="chip gray" data-tip="פריטים בקטלוג שנשמרים לתיעוד בלבד - הגישה בפועל אליהם לא משתנה מכאן">{docOnlyCount(catalog)} פריטים לתיעוד בלבד</span>
                  <span className="chip blue">{overrides.length} חריגות אישיות</span>
                </div>
              ) : null}
            </div>
            <PageVariantToggle screen="permissions" placement="header" systemTip />
          </div>

          {showSearch && data ? (
            <div className="hf-bar adm-bar st-bar">
              <div className="hf-s">
                <Ic id="search" />
                <input type="search" className="st-q" autoComplete="off" placeholder={activeTab === 'overrides' ? 'חיפוש חריגה (עובד או פריט)' : 'חיפוש שורה, עמוד, פיצ\'ר, מחלקה או עובד'} aria-label="חיפוש"
                  value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
                  data-lpignore="true" data-1p-ignore data-form-type="other" />
                <button type="button" className={`hf-cl st-x${query ? ' on' : ''}`} aria-label="ניקוי חיפוש" data-ico="x" data-tip="ניקוי חיפוש" onClick={() => setQuery('')}><Ic id="x" plain /></button>
              </div>
              {q ? <span className="hres-n adm-cnt st-count">תוצאות <b>{hits}</b></span> : null}
            </div>
          ) : null}

          {loading ? (
            <div className="empty st-state" role="status"><span className="st-spin lg" aria-hidden="true" /><div>טוען הרשאות…</div></div>
          ) : loadError ? (
            <div className="empty st-state" role="alert">
              <Ic id="alert" size="lg" />
              <div><b>לא הצלחנו לטעון את ההרשאות</b><br /><small>{loadError}</small></div>
              <button type="button" className="btn ghost sm" onClick={load}><Ic id="refresh" />נסו שוב</button>
            </div>
          ) : (
            <div className="layout">
              <aside className="rail" aria-label="לשוניות">
                <div className="st-sidenav">
                  <nav className="st-stabs" data-guide-id="perm.nav" role="tablist" aria-label="הרשאות" aria-orientation="vertical">
                    {tabs.map((t) => {
                      const on = t.id === activeTab;
                      return (
                        <button key={t.id} type="button" className={`st-stab${on ? ' on' : ''}`} role="tab" data-guide-id={`perm.tab-${t.id}`} aria-selected={on} aria-current={on ? 'page' : undefined} onClick={() => setTab(t.id)}>
                          <span className="st-sic"><Ic id={t.icon} plain /></span>
                          <span className="st-slb">{t.label}</span>
                          {counts[t.id] ? <span className="sn-badge cnt st-cnt">{counts[t.id]}</span> : null}
                          <span className="st-sgo" aria-hidden="true"><Ic id="chev" plain /></span>
                        </button>
                      );
                    })}
                  </nav>
                </div>
              </aside>
              <div className="st-main">
                <div className="st-toptabs">
                  <nav className="tabs" role="tablist" aria-label="הרשאות">
                    {tabs.map((t) => (
                      <button key={t.id} type="button" className={`tab${t.id === activeTab ? ' on' : ''}`} role="tab" data-guide-id={`perm.tab-${t.id}`} data-ico={t.icon} aria-selected={t.id === activeTab} onClick={() => setTab(t.id)}>
                        <span className="tico"><Ic id={t.icon} plain /></span>{t.label}
                      </button>
                    ))}
                  </nav>
                </div>
                <section className="panel on" role="tabpanel" aria-label={tabs.find((t) => t.id === activeTab).label}>
                  {activeTab === 'rows' ? renderRows() : null}
                  {activeTab === 'matrix' ? renderMatrix() : null}
                  {activeTab === 'numeric' ? renderNumeric() : null}
                  {activeTab === 'overrides' ? renderOverrides() : null}
                </section>
              </div>
            </div>
          )}
        </div>

        {dlg ? (
          <PmRowDialog
            key={dlg.group ? dlg.group.id : `new:${dlg.initialKeys.join(',')}`}
            group={dlg.group} initialKeys={dlg.initialKeys} catalog={catalog} allGroups={groups} departments={departments} employees={employees}
            onClose={() => setDlg(null)} onSaved={afterSave}
          />
        ) : null}
        <Toast toast={toast} onClose={closeToast} />
        <div className="pl-tt" role="tooltip" ref={ttRef} />
      </div>
    </A5PortalRoot.Provider>
  );
}
