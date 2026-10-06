'use client';

// מסכי ההגדרות בעיצוב "סימולציה" — תצוגות-עיצוב/הגדרות-סימולציה.html (נבחר ע"י הבעלים 4.10.2026; "טבלה" נדחה).
// שלושה מסכים, רכיב אחד:
//   view='sys'   /admin/settings       הגדרות מערכת (הנהלה ראשית / מתכנת)   — GET/POST /api/settings, קטגוריות שאינן של המתכנת
//   view='site'  /admin/site-settings  הגדרות אתר (מתכנת)                   — אותו API, קטגוריות המתכנת + מצב המסד + צריכת Neon
//   view='names' /admin/labels         שינוי שמות (מתכנת)                   — GET/POST /api/settings/labels (LabelsContext)
// התנהגות זהה לישן (SettingsClient.js / LegacyLabelsPage.js): אותם מפתחות, אותו גוף שמירה ({ items:[{key,value}] } רק של מה שהשתנה),
// אותה ולידציה (app/lib/settingsValidation.js), אותו אישור הנהלה בלי סשן (employeeId + pin אחרי 401), אותו ניקוי מטמונים.
// המבנה (לשוניות/סעיפים/תוויות/פקדים) — lib/settingsSimLayout.js. הנחות לגבי שאלות פתוחות: scratch/settings-build/ASSUMPTIONS.md.
// כל רכיב כאן מהפלטה (design-system/COMPONENTS.md) או מבלוק "settings" של העיצוב (settings-sim.css, בהיקף .gm-ds.gm-st).

import '@/design-system/components.css';
import './settings-sim.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { HomeSprite } from '../home/HomeParts';
import PageVariantToggle from '../variant/PageVariantToggle';
import usePageTooltip from '../profile/usePageTooltip';
import { useLabels } from '../LabelsContext';
import { cacheNamespace, invalidateSettings } from '@/app/lib/pageCache';
import { SECRET_SETTING_KEYS, SECRET_MASK, SECRET_CLEAR_MARKER } from '@/app/lib/secretSettingKeys';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { describeLogoResult, readLogoUploadResponse } from '@/lib/logoFormat';
import { prepareLogoFile } from '@/lib/logoClientPrep';
import {
  buildViewModel, NAMES_TABS, DEFAULT_LABELS, applyChange, revertChange, pruneUnchanged, buildPayload,
  firstValidationError, validationError, shownValue, cutTxt, rowMatches, normSearch, tabForDeepLink,
} from '@/lib/settingsSimLayout';
import SettingRow from './SettingRow';
import { Ic, ConfirmDialog, UnsavedDialog, AuthDialog, Toast } from './SettingsDialogs';

const TITLES = { sys: 'הגדרות מערכת', site: 'הגדרות אתר', names: 'שינוי שמות' };
const SEARCH_PH = { sys: 'חיפוש הגדרה', site: 'חיפוש הגדרה', names: 'חיפוש כיתוב' };
const COUNT_WORD = { sys: 'הגדרות', site: 'הגדרות', names: 'כיתובים' };
const simCache = cacheNamespace('settings-sim');
const deptsCache = cacheNamespace('departments');

/* ---------------------------------------------------------------- בלוקים מיוחדים */

function Banner({ kind = 'info', icon, heading, text, onClose }) {
  return (
    <div className="nb-w in">
      <section className={`nb nb-${kind}`} role="status">
        <div className="nb-main">
          <div className="nb-head">
            <span aria-hidden="true" className="nb-ic"><Ic id={icon || (kind === 'success' ? 'check' : 'alert')} plain /></span>
            <div className="nb-msg"><b>{heading}</b>{text ? <span>{text}</span> : null}</div>
            {onClose ? (
              <button type="button" className="nb-x" aria-label="סגור" data-ico="x" data-tip="סגור" onClick={onClose}><Ic id="x" plain /></button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({ sec, children, extra }) {
  return (
    <section className="st-sec st-card" data-sec={sec.id}>
      <h2 className="adm-h">
        <span className="adm-hi"><Ic id={sec.icon} /></span>{sec.title}
        {extra ? <span className="st-hr">{extra}</span> : null}
      </h2>
      <div className="card adm-rows">
        <div className="list">{children}</div>
      </div>
    </section>
  );
}

/** קבצי מיתוג — העלאת הלוגו הראשי (POST /api/upload-logo, כמו בלשונית "תצוגה" בישן). */
function LogoBlock({ onDone, onError }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const [stamp, setStamp] = useState(null);
  useEffect(() => { try { setStamp(window.localStorage.getItem('logo_timestamp')); } catch { /* */ } }, []);
  const upload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', await prepareLogoFile(file));
      const res = await fetch('/api/upload-logo', { method: 'POST', body: fd });
      const { ok, data, error } = await readLogoUploadResponse(res);
      if (!ok) throw new Error(error);
      try { window.localStorage.setItem('logo_timestamp', data.timestamp); } catch { /* */ }
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: data.timestamp }));
      setStamp(String(data.timestamp));
      onDone('הלוגו עודכן', `הלוגו החדש מוצג בראש העמודים ובהדפסות. ${describeLogoResult(data)}`.trim());
    } catch (err) {
      onError(err.message || 'שגיאה בהעלאת הלוגו');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="st-files">
        <div className="mfile on" role="img" aria-label="לוגו ראשי של הגמ״ח">
          <span className="mft"><Ic id="file" /></span>
          <span className="mfx"><b>לוגו ראשי</b><small>{stamp ? 'הועלה לוגו מותאם' : 'PNG / JPG'}</small></span>
          <a className="mfe" href={`/api/logo${stamp ? `?v=${encodeURIComponent(stamp)}` : ''}`} target="_blank" rel="noopener noreferrer" aria-label="תצוגה מקדימה של הלוגו" data-tip="תצוגה"><Ic id="eye" plain /></a>
        </div>
      </div>
      <div className="row wrap">
        <button type="button" className="ibtn" aria-label="העלאת לוגו" data-tip="העלאת לוגו" data-ico="plus" onClick={() => inputRef.current && inputRef.current.click()} disabled={busy} data-element-name="כפתור_settings_logo">
          {busy ? <span className="st-spin" aria-hidden="true" /> : <Ic id="plus" plain />}
        </button>
        <small className="faint">{busy ? 'מעלה…' : 'קובץ תמונה (PNG/JPG) שיופיע בראש עמודי המערכת ובהדפסות'}</small>
        <input ref={inputRef} type="file" accept="image/*" onChange={upload} hidden />
      </div>
    </>
  );
}

/** שורת "ניהול הרשאות" — החלטת הבעלים P008: שורת הגדרות בטאב תצוגה, ובמקום פקד — לחצן עם אייקון קישור חיצוני. */
function PermissionsRow() {
  return (
    <div className="li st-row st-ctlrow">
      <div className="ic-b"><Ic id="shield" /></div>
      <div className="t">
        <b className="st-lb">ניהול הרשאות (מחלקות ועובדים)</b>
        <small>קובע מי נכנס לאיזה עמוד ומי רשאי לאשר פעולות. נפתח בעמוד נפרד.</small>
      </div>
      <div className="st-ctl">
        <Link className="btn ghost sm" href="/admin/permissions" aria-label="פתיחת ניהול הרשאות (עמוד נפרד)" data-element-name="כפתור_settings_permissions">
          <Ic id="ext" />פתיחה
        </Link>
      </div>
    </div>
  );
}

/** סביבת עבודה = מסד הנתונים של האתר החי (GET/POST /api/admin/db-mode, כמו WebBackupModeToggle). מופעל מיד, אחרי אישור. */
function DbModeRow({ root, onToast, dirty, onSwitched }) {
  const [mode, setMode] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ask, setAsk] = useState(null);
  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch('/api/admin/db-mode', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setMode(json.mode);
    } catch (e) { setErr(e.message || 'שגיאה בטעינת מצב המסד'); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // ההגדרות שבמסך שייכות למסד הנוכחי — החלפת מסד עם שינויים ממתינים תשמור אותם על המסד הלא נכון (או תאבד אותם), לכן חסום
  const request = (next) => {
    if (mode === next) return;
    if (dirty) { setErr('יש שינויים שלא נשמרו. שמרו או בטלו אותם לפני החלפת סביבת העבודה.'); return; }
    setErr(null);
    setAsk(next);
  };
  const apply = async () => {
    const next = ask;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/db-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setMode(json.mode);
      onSwitched(); // ההגדרות שמוצגות נטענו מהמסד הקודם — טוענים מחדש מהמסד החדש
      onToast({ title: json.mode === 'test' ? 'האתר החי עבר למסד הבדיקות' : 'האתר החי חזר למסד הייצור', sub: 'השינוי חל על כל המשתמשים', icon: 'check' });
    } catch (e) { setErr(e.message || 'שגיאה בהחלפת המסד'); }
    finally { setBusy(false); setAsk(null); }
  };
  const idx = mode === 'test' ? 1 : 0;
  return (
    <>
      {mode === 'test' ? (
        <Banner kind="warning" heading="מצב בדיקות פעיל" text="כל המשתמשים באתר החי עובדים כרגע מול מסד הבדיקות (Test). שינויים לא נשמרים במסד האמיתי." />
      ) : null}
      <div className="li st-row st-ctlrow">
        <div className="ic-b"><Ic id="shield" /></div>
        <div className="t">
          <b className="st-lb">
            סביבת עבודה
            <button type="button" className="tip" aria-label="עזרה: סביבת עבודה" data-ico="info" data-tip="קובע לאיזה מסד נתונים מחובר האתר עבור כל מי שנכנס אליו כרגע — לא רק אליך. במצב בדיקות מוצג פס אדום מהבהב בראש המסך לכל המשתמשים."><Ic id="info" plain /></button>
          </b>
          <small>המעבר חל על כל השרת ולא רק על המשתמשת הנוכחית</small>
        </div>
        <div className="st-ctl">
          {mode === null && !err ? <small className="faint">טוען מצב נוכחי…</small> : (
            <div className="seg pill" role="radiogroup" aria-label="סביבת עבודה" style={{ '--n': 2, '--i': idx }}>
              <span className="pth" aria-hidden="true" />
              <button type="button" role="radio" aria-checked={mode === 'prod'} className={mode === 'prod' ? 'on' : undefined} disabled={busy} onClick={() => request('prod')}>ייצור</button>
              <button type="button" role="radio" aria-checked={mode === 'test'} className={mode === 'test' ? 'on' : undefined} disabled={busy} onClick={() => request('test')}>בדיקות</button>
            </div>
          )}
          {err ? <small className="st-err" role="alert">{err}</small> : null}
        </div>
      </div>
      <ConfirmDialog
        open={!!ask}
        root={root}
        busy={busy}
        heading={ask === 'test' ? 'להעביר את האתר החי למסד הבדיקות?' : 'להחזיר את האתר החי למסד הייצור?'}
        sub={ask === 'test'
          ? 'האתר החי יעבור להציג ולשמור נתונים על מסד הגיבוי (Test) לכל מי שנכנס אליו, עד שיוחזר ידנית.'
          : 'האתר החי יחזור להציג ולשמור על מסד הנתונים האמיתי (Prod) לכל מי שנכנס אליו.'}
        okLabel={ask === 'test' ? 'מעבר לבדיקות' : 'חזרה לייצור'}
        okIcon="refresh"
        icon="refresh"
        destructive
        onYes={apply}
        onNo={() => setAsk(null)}
      />
    </>
  );
}

/** צריכת Neon — ארבע שורות לקריאה בלבד (החלטה C2 א'), מ-/api/admin/neon-usage. התקופה בתאריך עברי. */
function NeonRows() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/admin/neon-usage', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `שגיאה ${res.status}`);
      setData(json);
    } catch (e) { setErr(e.message || 'שגיאה בטעינת נתוני הצריכה'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const heb = (iso) => { try { return iso ? getHebrewDateString(new Date(iso)) : '-'; } catch { return '-'; } };
  const rows = data ? [
    { id: 'compute', icon: 'gear', label: 'מחשוב (CU-שעות)', value: data.usage.computeCuHours, sub: `${data.usage.activeHours} שעות פעילות בפועל` },
    { id: 'storage', icon: 'file', label: 'אחסון (GB)', value: data.usage.storageGb, sub: `$${data.pricing.storageGbMonth} לג'יגה-חודש` },
    { id: 'transfer', icon: 'arrlr', label: 'תעבורת רשת (GB)', value: data.usage.transferGb, sub: `${data.usage.writtenGb} GB נכתבו` },
    { id: 'cost', icon: 'cash', label: 'אומדן עלות עד כה ($)', value: data.cost.costSoFar, sub: `תחזית לחודש מלא: ~$${data.cost.projectedMonthly}` },
  ] : [];
  return (
    <>
      <div className="li st-row st-ctlrow">
        <div className="ic-b"><Ic id="cal" /></div>
        <div className="t">
          <b className="st-lb">תקופת חיוב</b>
          <small>
            {loading ? 'טוען נתוני צריכה מ-Neon…' : err ? err : `פרויקט ${data.project.name} · ${heb(data.period.start)} - ${heb(data.period.end)} (עברו ${data.period.elapsedDays} מתוך ${data.period.totalDays} ימים)`}
          </small>
        </div>
        <div className="st-ctl">
          <button type="button" className="btn ghost sm" onClick={load} disabled={loading} data-element-name="כפתור_settings_neon_refresh"><Ic id="refresh" />{err ? 'נסה שוב' : 'רענון'}</button>
        </div>
      </div>
      {rows.map((r) => (
        <div className="li st-row st-ctlrow" key={r.id}>
          <div className="ic-b"><Ic id={r.icon} /></div>
          <div className="t"><b className="st-lb">{r.label}</b><small>{r.sub}</small></div>
          <div className="st-ctl"><input className="inp" type="text" value={String(r.value)} disabled readOnly dir="ltr" aria-label={r.label} /></div>
        </div>
      ))}
    </>
  );
}

/* ---------------------------------------------------------------- הדף */

export default function SettingsSimPage({ view = 'sys' }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const qRef = useRef(null);
  const [portalRoot, setPortalRoot] = useState(null);
  useEffect(() => { setPortalRoot(rootRef.current); }, []);
  usePageTooltip(rootRef, ttRef, false);

  const isNames = view === 'names';
  const { labels: ctxLabels, updateLabels } = useLabels();

  /* ----- נתונים */
  const [settings, setSettings] = useState(() => (simCache.has(view) ? simCache.get(view) : null));
  const [loadError, setLoadError] = useState(null);
  const [departments, setDepartments] = useState(() => (deptsCache.has('depts') ? deptsCache.get('depts') : null));

  const load = useCallback(async () => {
    if (isNames) return;
    setLoadError(null);
    try {
      // fresh=1: עוקף את מטמון השרת (30 שנ') - מסך העריכה חייב להציג בדיוק מה ששמור, גם אם השמירה נעשתה באינסטנס אחר
      const res = await fetch('/api/settings?fresh=1', { cache: 'no-store' });
      if (!res.ok) throw new Error('שגיאה בטעינת ההגדרות');
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('שגיאה בטעינת ההגדרות');
      simCache.set(view, data);
      setSettings(data);
    } catch (e) {
      setLoadError(e.message || 'שגיאה בטעינת ההגדרות');
    }
  }, [isNames, view]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (view !== 'sys') return undefined;
    let alive = true;
    fetch('/api/departments')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive && Array.isArray(d)) { setDepartments(d); deptsCache.set('depts', d); } else if (alive) setDepartments((x) => x || []); })
      .catch(() => { if (alive) setDepartments((x) => x || []); });
    return () => { alive = false; };
  }, [view]);

  /* ----- המודל */
  const model = useMemo(() => {
    if (isNames) {
      const base = { ...DEFAULT_LABELS, ...(ctxLabels || {}) };
      return {
        view,
        tabs: NAMES_TABS.map((t) => ({
          ...t,
          sections: [{ id: t.id, title: t.label, icon: t.icon, rows: t.keys.map((k) => ({ key: k, label: DEFAULT_LABELS[k] || k, note: '', sub: k, icon: 'pencil', ctl: 'label', value: base[k] || '' })) }],
          count: t.keys.length,
        })),
      };
    }
    return settings ? buildViewModel(view, settings) : null;
  }, [isNames, view, settings, ctxLabels]);

  const rowsByKey = useMemo(() => {
    const m = new Map();
    if (model) for (const t of model.tabs) for (const s of t.sections) for (const r of s.rows) m.set(r.key, { row: r, tab: t.id, section: s });
    return m;
  }, [model]);
  const originals = useMemo(() => {
    const o = {};
    if (isNames) { const base = { ...DEFAULT_LABELS, ...(ctxLabels || {}) }; Object.keys(base).forEach((k) => { o[k] = base[k]; }); }
    else if (settings) settings.forEach((s) => { o[s.key] = s.value === null || s.value === undefined ? '' : String(s.value); });
    return o;
  }, [isNames, settings, ctxLabels]);

  /* ----- שינויים */
  const [modified, setModified] = useState({});
  const [resetAll, setResetAll] = useState(false); // "שחזר ברירת מחדל" בשינוי שמות: כמו setLocalLabels({...DEFAULT_LABELS}) בישן
  const changedKeys = useMemo(() => Object.keys(modified).filter((k) => rowsByKey.has(k)), [modified, rowsByKey]);
  const dirty = Object.keys(modified).length > 0 || resetAll;
  const rawOf = (key) => (modified[key] !== undefined ? modified[key] : (originals[key] ?? ''));

  const change = useCallback((key, value) => {
    setModified((m) => pruneUnchanged(applyChange(m, key, value), originals));
  }, [originals]);
  const undoOne = (key) => setModified((m) => revertChange(m, key));

  const changeItems = useMemo(() => changedKeys.map((k) => {
    const { row } = rowsByKey.get(k);
    const from = isNames ? (originals[k] || 'ריק') : shownValue(row, originals[k] ?? '');
    const to = isNames ? (modified[k] || 'ריק') : shownValue(row, modified[k]);
    return { key: k, label: row.label, icon: row.icon, from, to };
  }), [changedKeys, rowsByKey, originals, modified, isNames]);

  const hasErrors = !isNames && !!firstValidationError(modified);

  /* ----- לשוניות, חיפוש, קישור עמוק */
  const [tab, setTab] = useState(null);
  const [query, setQuery] = useState('');
  const [flash, setFlash] = useState(null);
  const tabs = model ? model.tabs : [];
  const activeTab = tabs.some((t) => t.id === tab) ? tab : (tabs[0] && tabs[0].id);

  const deepDone = useRef(false);
  useEffect(() => {
    if (!model || deepDone.current) return;
    deepDone.current = true;
    const t = tabForDeepLink(model, searchParams.get('tab'), searchParams.get('highlight'));
    if (t) setTab(t);
    const hl = searchParams.get('highlight');
    if (hl && rowsByKey.has(hl)) {
      setTimeout(() => {
        const el = document.getElementById(`setting-row-${hl}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setFlash(hl);
        setTimeout(() => setFlash(null), 2600);
      }, 120);
    }
  }, [model, searchParams, rowsByKey]);

  const q = normSearch(query);
  const hits = useMemo(() => {
    const per = {};
    let total = 0;
    for (const t of tabs) {
      let n = 0;
      for (const s of t.sections) for (const r of s.rows) if (rowMatches(r, s.title, q)) n++;
      per[t.id] = n;
      total += n;
    }
    return { per, total };
  }, [tabs, q]);
  // חיפוש: אם בלשונית הפעילה אין תוצאות — עוברים ללשונית הראשונה שיש בה (כמו refreshSearch בעיצוב)
  useEffect(() => {
    if (!q || !activeTab) return;
    if (!hits.per[activeTab]) {
      const first = tabs.find((t) => hits.per[t.id]);
      if (first) setTab(first.id);
    }
  }, [q, hits, activeTab, tabs]);
  const tabChanged = (tid) => changedKeys.filter((k) => rowsByKey.get(k).tab === tid).length;

  /* ----- באנרים / טוסט */
  const [savedBanner, setSavedBanner] = useState(null);
  const [errorBanner, setErrorBanner] = useState(null);
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);
  useEffect(() => {
    if (!savedBanner) return undefined;
    const t = setTimeout(() => setSavedBanner(null), 8000);
    return () => clearTimeout(t);
  }, [savedBanner]);

  /* ----- שמירה */
  const [saving, setSaving] = useState(false);
  const [auth, setAuth] = useState(null); // { error }
  const [askDiscard, setAskDiscard] = useState(false);
  const [askReset, setAskReset] = useState(false);
  const [leave, setLeave] = useState(null); // { kind: 'link' | 'pop', href }
  const afterSaveRef = useRef(null);

  const finishSaved = (n) => {
    setModified({});
    setResetAll(false);
    setErrorBanner(null);
    setSavedBanner({ n });
    const next = afterSaveRef.current;
    afterSaveRef.current = null;
    if (next) next();
  };

  const postSettings = async (extra) => {
    const payload = buildPayload(modified);
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload, ...(extra || {}) }),
    });
    return res;
  };

  const applySaved = () => {
    // כמו הישן: מעדכנים את השורות בערכים החדשים (סוד: הסימון "מוגדר" במקום הטקסט), ומנקים את המטמונים המשותפים
    setSettings((prev) => {
      const next = (prev || []).map((s) => {
        if (modified[s.key] === undefined) return s;
        const v = modified[s.key];
        return { ...s, value: SECRET_SETTING_KEYS.includes(s.key) ? (v && v !== SECRET_CLEAR_MARKER ? SECRET_MASK : '') : v };
      });
      simCache.set(view, next);
      return next;
    });
    cacheNamespace('settings-page-general').clear();
    cacheNamespace('settings-page-developer').clear();
    invalidateSettings();
  };

  const serverError = async (res) => {
    const d = await res.json().catch(() => null);
    if (d && d.error && /:/.test(d.error)) {
      const [k, ...rest] = d.error.split(':');
      const r = rowsByKey.get(k.trim());
      return `${r ? r.row.label : k.trim()}: ${rest.join(':').trim()}`;
    }
    if (res.status === 401) return 'אין הרשאה לשמור: נדרשת הנהלה ראשית או מתכנת.';
    return 'שגיאה בשמירת ההגדרות. ההגדרות לא נשמרו — נסו שוב.';
  };

  const save = async () => {
    // כל יציאה מוקדמת מנקה את ה"המשך אחרי שמירה" — אחרת הוא נשאר תלוי ויופעל בשמירה מאוחרת לא קשורה
    if (!dirty || saving) { afterSaveRef.current = null; return; }
    if (isNames) return saveLabels();
    const bad = firstValidationError(modified);
    if (bad) {
      afterSaveRef.current = null;
      const r = rowsByKey.get(bad.key);
      setErrorBanner({ title: 'יש לתקן ערך לא תקין לפני השמירה', text: `${r ? r.row.label : bad.key}: ${bad.error}` });
      if (r) setTab(r.tab);
      return;
    }
    setSaving(true);
    setErrorBanner(null);
    const n = changedKeys.length || Object.keys(modified).length;
    try {
      const res = await postSettings();
      if (res.status === 401) { setAuth({ error: null }); setSaving(false); return; }
      if (!res.ok) throw new Error(await serverError(res));
      applySaved();
      finishSaved(n);
    } catch (e) {
      setErrorBanner({ title: 'השמירה נכשלה', text: e.message || 'שגיאה בשמירת ההגדרות' });
      afterSaveRef.current = null;
    } finally {
      setSaving(false);
    }
  };

  const saveWithAuth = async ({ employeeId, pin }) => {
    setSaving(true);
    try {
      const res = await postSettings({ employeeId, pin });
      if (res.status === 401) { setAuth({ error: 'הסיסמה שגויה או שהעובד שנבחר אינו הנהלה ראשית / מתכנת.' }); return; }
      if (!res.ok) { setAuth(null); throw new Error(await serverError(res)); }
      setAuth(null);
      const n = changedKeys.length || Object.keys(modified).length;
      applySaved();
      finishSaved(n);
    } catch (e) {
      setErrorBanner({ title: 'השמירה נכשלה', text: e.message || 'שגיאה בשמירת ההגדרות' });
      afterSaveRef.current = null;
    } finally {
      setSaving(false);
    }
  };

  const saveLabels = async () => {
    setSaving(true);
    setErrorBanner(null);
    // אותו גוף כמו הישן: האובייקט המלא (ברירות מחדל + הכיתובים השמורים + השינויים); אחרי "שחזר ברירת מחדל" — ברירות המחדל בלבד
    const base = resetAll ? { ...DEFAULT_LABELS } : { ...DEFAULT_LABELS, ...(ctxLabels || {}) };
    const full = { ...base, ...modified };
    const n = changedKeys.length || Object.keys(DEFAULT_LABELS).length;
    try {
      const res = await fetch('/api/settings/labels', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(full) });
      if (!res.ok) throw new Error(res.status === 401 ? 'אין הרשאה לשמור כיתובים.' : 'שגיאה בשמירת הכיתובים. הכיתובים לא נשמרו — נסו שוב.');
      updateLabels(full);
      finishSaved(n);
    } catch (e) {
      setErrorBanner({ title: 'השמירה נכשלה', text: e.message });
      afterSaveRef.current = null;
    } finally {
      setSaving(false);
    }
  };

  const discard = () => { setModified({}); setResetAll(false); setAskDiscard(false); setToast({ title: 'השינויים בוטלו', sub: 'ההגדרות חזרו לערכים השמורים', icon: 'undo' }); };

  /* ----- יציאה עם שינויים: חלון "שינויים שלא נשמרו" לכל דרך יציאה, ואזהרת דפדפן בסגירה.
     דרכי היציאה: קישור פנימי (<a>), לחצן חזרה/קדימה של הדפדפן (popstate), ו-router.push/replace שנקרא מרכיב אחר (תפריט, חיפוש...).
     בנוסף window.__gmDirty — מתג החלפת הווריאנט (lib/pageVariantToggle.js) קורא אותו. */
  const dirtyRef = useRef(false);
  const guardRef = useRef({ sentinel: false });
  useEffect(() => {
    dirtyRef.current = dirty;
    try { window.__gmDirty = dirty; } catch { /* */ }
  }, [dirty]);
  useEffect(() => () => { try { window.__gmDirty = false; } catch { /* */ } }, []);

  // לחצן חזרה: בזמן שיש שינויים נוסף רשומת היסטוריה זהה ("שומר"), ולכן חזרה נוחתת על אותו עמוד ואפשר להציג את החלון
  const pushSentinel = () => { try { window.history.pushState(window.history.state, '', window.location.href); guardRef.current.sentinel = true; } catch { /* */ } };
  useEffect(() => { if (dirty && !guardRef.current.sentinel) pushSentinel(); }, [dirty]);
  useEffect(() => {
    const onPop = () => {
      const g = guardRef.current;
      if (!g.sentinel) return;
      if (dirtyRef.current) { pushSentinel(); setLeave({ kind: 'pop', href: null }); } // חזרנו לרשומה המקורית: מחזירים שומר מיד ושואלים
      else { g.sentinel = false; window.history.back(); } // אין שינויים: צורכים את הרשומה הנוספת שלנו וממשיכים אחורה
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const onClick = (e) => {
      if (!dirtyRef.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target.closest && e.target.closest('a[href]');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.getAttribute('href'), window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setLeave({ kind: 'link', href: url.pathname + url.search + url.hash });
    };
    const onBefore = (e) => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    document.addEventListener('click', onClick, true);
    window.addEventListener('beforeunload', onBefore);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('beforeunload', onBefore); };
  }, []);

  // router.push / replace שנקראים מרכיבים אחרים (התפריט, חיפוש, תפריט המשתמש...): עוטפים את אובייקט הנתב (גם window.next.router) בזמן שהדף פתוח
  useEffect(() => {
    const restore = [];
    const targets = new Set([router, typeof window !== 'undefined' && window.next ? window.next.router : null].filter(Boolean));
    for (const r of targets) {
      for (const m of ['push', 'replace']) {
        const orig = r[m];
        if (typeof orig !== 'function') continue;
        const wrapped = function guarded(href, ...rest) {
          if (dirtyRef.current && typeof href === 'string') {
            let url = null;
            try { url = new URL(href, window.location.href); } catch { /* */ }
            if (url && url.origin === window.location.origin && (url.pathname !== window.location.pathname || url.search !== window.location.search)) {
              setLeave({ kind: 'link', href: url.pathname + url.search + url.hash });
              return undefined;
            }
          }
          return orig.call(this, href, ...rest);
        };
        try { r[m] = wrapped; restore.push(() => { if (r[m] === wrapped) r[m] = orig; }); } catch { /* אובייקט נתב קפוא */ }
      }
    }
    return () => restore.forEach((f) => f());
  }, [router]);

  const go = (href) => { dirtyRef.current = false; router.push(href); };
  // המשך אחרי שמירה / יציאה בלי שמירה: קישור/push → ניווט; חזרה בדפדפן → שתי רשומות אחורה (השומר המחודש + העמוד עצמו)
  const goLeave = (l) => {
    if (l.kind === 'pop') { guardRef.current.sentinel = false; dirtyRef.current = false; window.history.go(-2); } else go(l.href);
  };

  /* ----- מצבי טעינה / שגיאה */
  const loading = !isNames && !settings && !loadError;

  /* ----- רינדור */
  const title = TITLES[view] || TITLES.sys;
  const rowHidden = (r, s) => !!q && !rowMatches(r, s.title, q);
  const visibleTab = tabs.find((t) => t.id === activeTab);
  const panelId = `p-${view}-${activeTab}`; // רק הפאנל הפעיל קיים ב-DOM, לכן רק ללשונית הפעילה aria-controls
  // ניווט במקלדת בין לשוניות (role=tab): חצים (בסרגל האנכי ובשורה האופקית, RTL), Home / End. הפוקוס עובר והלשונית נפתחת.
  const onTabKey = (e) => {
    const k = e.key;
    const n = tabs.length;
    const i = tabs.findIndex((t) => t.id === activeTab);
    let to = -1;
    if (k === 'ArrowDown' || k === 'ArrowLeft') to = (i + 1) % n;
    else if (k === 'ArrowUp' || k === 'ArrowRight') to = (i - 1 + n) % n;
    else if (k === 'Home') to = 0;
    else if (k === 'End') to = n - 1;
    if (to < 0 || !n) return;
    e.preventDefault();
    const id = tabs[to].id;
    setTab(id);
    const btn = e.currentTarget.querySelector(`[data-tab="${id}"]`);
    if (btn) btn.focus();
  };
  const nChanged = changedKeys.length + (resetAll && !changedKeys.length ? 1 : 0);

  const renderRow = (r, s) => {
    if (r.ctl === 'label') return null;
    return (
      <SettingRow
        key={r.key}
        row={r}
        raw={rawOf(r.key)}
        saved={originals[r.key] ?? ''}
        dirty={modified[r.key] !== undefined}
        onChange={(v) => change(r.key, v)}
        departments={departments}
        highlighted={flash === r.key}
        portalRoot={portalRoot}
        hidden={rowHidden(r, s)}
      />
    );
  };

  const renderSection = (s) => {
    const shownRows = s.rows.filter((r) => !rowHidden(r, s));
    if (q && !shownRows.length) return null;
    if (isNames) {
      return (
        <section className="st-sec st-card" data-sec={s.id} key={s.id}>
          <h2 className="adm-h"><span className="adm-hi"><Ic id={s.icon} /></span>{s.title}</h2>
          <div className="card adm-rows">
            <div className="tblw">
              <table className="rtbl">
                <thead><tr><th>ברירת מחדל</th><th>כיתוב חדש</th><th className="tc"><span className="sr-only">חזרה לברירת מחדל</span></th></tr></thead>
                <tbody>
                  {s.rows.map((r) => {
                    const v = resetAll && modified[r.key] === undefined ? DEFAULT_LABELS[r.key] : rawOf(r.key);
                    const isDirty = modified[r.key] !== undefined;
                    return (
                      <tr className={`st-row${isDirty ? ' st-dirty' : ''}`} key={r.key} id={`setting-row-${r.key}`} hidden={rowHidden(r, s) || undefined}>
                        <td className="st-def"><b className="st-lb">{r.label}{isDirty ? <span className="chip gold st-chg">שונה</span> : null}</b><small className="faint" dir="ltr">{r.key}</small></td>
                        <td>
                          <input className="inp" type="text" value={v || ''} aria-label={`כיתוב חדש עבור ${r.label}`} autoComplete="off" onChange={(e) => change(r.key, e.target.value)} data-element-name={`שדה_labels_${r.key}`} />
                        </td>
                        <td className="tc">
                          <button type="button" className="ibtn" aria-label={`חזרה לברירת מחדל: ${r.label}`} data-tip="חזרה לברירת מחדל" data-ico="undo" onClick={() => change(r.key, DEFAULT_LABELS[r.key] || '')}>
                            <Ic id="undo" plain />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      );
    }
    let special = null;
    if (s.special === 'logo') special = <LogoBlock onDone={(t, sub) => setToast({ title: t, sub, icon: 'check' })} onError={(m) => setErrorBanner({ title: 'העלאת הלוגו נכשלה', text: m })} />;
    if (s.special === 'permissions') special = <PermissionsRow />;
    if (s.special === 'dbmode') special = <DbModeRow root={portalRoot} onToast={setToast} dirty={dirty} onSwitched={() => { simCache.clear(); load(); }} />;
    if (s.special === 'neon') special = <NeonRows />;
    if (q && special && !shownRows.length) return null;
    return (
      <Section sec={s} key={s.id}>
        {s.special === 'logo' ? <div className="st-list-extra">{special}</div> : special}
        {s.rows.map((r) => renderRow(r, s))}
      </Section>
    );
  };

  return (
    <div className="gm-ds gm-st home-bg dlg-dark" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="app st-view" data-view={view}>
        <div className="st-banners">
          {view === 'site' ? <Banner kind="warning" heading="אזור למתכנת בלבד" text="שינויים כאן משפיעים על כל המשתמשות והסניפים. אם משהו לא ברור, אל תשנו." /> : null}
          {errorBanner ? <Banner kind="warning" icon="alert" heading={errorBanner.title} text={errorBanner.text} onClose={() => setErrorBanner(null)} /> : null}
          {savedBanner ? (
            <Banner kind="success" heading={isNames ? 'הכיתובים נשמרו' : 'ההגדרות נשמרו'} text={`${savedBanner.n === 1 ? 'שינוי אחד נקלט' : `${savedBanner.n} שינויים נקלטו`} במערכת · נשמר עכשיו`} onClose={() => setSavedBanner(null)} />
          ) : null}
        </div>

        <div className="topbar">
          <Link className="back" href="/admin" aria-label="חזרה למסך ניהול" data-tip="חזרה למסך ניהול" data-element-name="כפתור_settings_back"><Ic id="back" plain /></Link>
          <div className="ttl">
            <h1 className="pg-ttl"><small>הגדרות</small><bdi>{title}</bdi></h1>
            <div className="row wrap st-chips">
              {view === 'site' ? (
                <>
                  <Link className="btn ghost sm" href="/admin/site-settings/email-logs" data-element-name="כפתור_settings_email_logs"><Ic id="mail" />יומן מיילים</Link>
                  <span className="chip gold">מתכנת בלבד</span>
                </>
              ) : null}
              {isNames ? (
                <button type="button" className="btn ghost sm" onClick={() => setAskReset(true)} data-element-name="כפתור_labels_reset"><Ic id="undo" />שחזר ברירת מחדל</button>
              ) : null}
            </div>
          </div>
          {/* "חזרה להגדרות הישנות": רק להנהלה ראשית / מתכנת (useCanSelfSwitch); מכבד window.__gmDirty (אישור לפני מעבר עם שינויים) */}
          <PageVariantToggle screen="settings" placement="header" systemTip />
        </div>

        <div className="hf-bar adm-bar st-bar">
          <div className="hf-s">
            <Ic id="search" />
            <input
              ref={qRef}
              type="search"
              className="st-q"
              autoComplete="off"
              placeholder={SEARCH_PH[view]}
              aria-label={SEARCH_PH[view]}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Escape' && query) { e.preventDefault(); setQuery(''); } }}
              data-element-name="שדה_settings_search"
              data-lpignore="true"
              data-1p-ignore
              data-form-type="other"
            />
            <button type="button" className={`hf-cl st-x${query ? ' on' : ''}`} aria-label="ניקוי חיפוש" data-ico="x" data-tip="ניקוי חיפוש" onClick={() => { setQuery(''); if (qRef.current) qRef.current.focus(); }}>
              <Ic id="x" plain />
            </button>
          </div>
          {q ? <span className="hres-n adm-cnt st-count">{COUNT_WORD[view]} <b>{hits.total}</b></span> : null}
        </div>

        {loading ? (
          <div className="empty st-state" role="status"><span className="st-spin lg" aria-hidden="true" /><div>טוען הגדרות…</div></div>
        ) : loadError ? (
          <div className="empty st-state" role="alert">
            <Ic id="alert" size="lg" />
            <div><b>לא הצלחנו לטעון את ההגדרות</b><br /><small>{loadError}</small></div>
            <button type="button" className="btn ghost sm" onClick={load}><Ic id="refresh" />נסו שוב</button>
          </div>
        ) : (
          <div className="layout">
            <aside className="rail" aria-label="מקטעים ושינויים לשמירה">
              <div className="st-sidenav">
                <nav className="st-stabs" role="tablist" aria-label={title} aria-orientation="vertical" onKeyDown={onTabKey}>
                  {tabs.map((t) => {
                    const on = t.id === activeTab;
                    const cnt = q ? hits.per[t.id] : tabChanged(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`st-stab${on ? ' on' : ''}${t.dim ? ' st-dim' : ''}`}
                        role="tab"
                        aria-selected={on}
                        aria-current={on ? 'page' : undefined}
                        aria-controls={on ? panelId : undefined}
                        tabIndex={on ? 0 : -1}
                        data-tab={t.id}
                        onClick={() => setTab(t.id)}
                        data-element-name={`כפתור_settings_tab_${t.id}`}
                      >
                        <span className="st-sic"><Ic id={t.icon} plain /></span>
                        <span className="st-slb">{t.label}</span>
                        {cnt ? <span className={`sn-badge cnt st-cnt${q ? '' : ' st-cnt-chg'}`}>{cnt}</span> : null}
                        <span className="st-sgo" aria-hidden="true"><Ic id="chev" plain /></span>
                      </button>
                    );
                  })}
                </nav>
                {/* הפאנל ופס השמירה תמיד ב-DOM (hidden כשאין שינויים), כמו בעיצוב: בנייד הסרגל התחתון מוסתר לפי .rail:has(.st-saverow[hidden]) */}
                <div className="st-chgs" hidden={!dirty}>
                    <div className="st-chgh"><Ic id="note" /><b>שינויים לשמירה</b><span className="badge st-chgn">{nChanged}</span></div>
                    <div className="cart-list st-chglist">
                      {resetAll ? (
                        <div className="cl">
                          <div className="cl-i"><Ic id="undo" /></div>
                          <div className="cl-t"><span>שוחזרו <b>כל הכיתובים</b></span><small>לברירת המחדל</small></div>
                          <button type="button" className="cl-u" aria-label="ביטול השחזור" data-tip="ביטול השינוי" onClick={() => { setResetAll(false); setModified({}); }}><Ic id="bk" plain /></button>
                        </div>
                      ) : null}
                      {changeItems.map((it) => (
                        <div className="cl" key={it.key}>
                          <div className="cl-i"><Ic id={it.icon} /></div>
                          <div className="cl-t"><span>שונה <b>{it.label}</b></span><small><bdi>{cutTxt(it.from)}</bdi> ← <bdi>{cutTxt(it.to)}</bdi></small></div>
                          <button type="button" className="cl-u" aria-label={`ביטול השינוי: ${it.label}`} data-tip="ביטול השינוי" onClick={() => undoOne(it.key)}><Ic id="bk" plain /></button>
                        </div>
                      ))}
                    </div>
                    <div className="cart-actions st-chgact">
                      <button type="button" className="btn primary lg block" data-act="save" onClick={save} disabled={saving || hasErrors} data-element-name="כפתור_settings_save">
                        <Ic id="check" />{saving ? 'שומר…' : hasErrors ? 'יש לתקן שגיאות' : 'שמירת השינויים'}
                      </button>
                      <button type="button" className="btn ghost block sec" data-act="discard" onClick={() => setAskDiscard(true)} disabled={saving} data-element-name="כפתור_settings_discard">
                        <Ic id="undo" />ביטול השינויים
                      </button>
                    </div>
                  </div>
                <div className="st-saverow" hidden={!dirty}>
                    <button type="button" className="st-saveicon" data-act="save" onClick={save} aria-label="שמירת השינויים" data-tip={hasErrors ? 'יש לתקן שגיאות' : 'שמירת השינויים'} disabled={saving || hasErrors}>
                      <span className="sn-badge st-pendcnt">{nChanged}</span><Ic id="check" plain />
                    </button>
                    <button type="button" className="st-discardicon" data-act="discard" onClick={() => setAskDiscard(true)} aria-label="ביטול השינויים" data-tip="ביטול השינויים" disabled={saving}>
                      <Ic id="undo" plain />
                    </button>
                  </div>
              </div>
            </aside>

            <div className="st-main">
              <div className="st-toptabs">
                <nav className="tabs" role="tablist" aria-label="מקטעי הגדרות" onKeyDown={onTabKey}>
                  {tabs.map((t) => {
                    const on = t.id === activeTab;
                    const cnt = q ? hits.per[t.id] : tabChanged(t.id);
                    return (
                      <button key={t.id} type="button" className={`tab${on ? ' on' : ''}`} role="tab" data-ico={t.top} aria-selected={on} aria-controls={on ? panelId : undefined} tabIndex={on ? 0 : -1} data-tab={t.id} onClick={() => setTab(t.id)}>
                        <span className="tico"><Ic id={t.top} plain />{cnt ? <span className="cnt st-cnt">{cnt}</span> : null}</span>{t.label}
                      </button>
                    );
                  })}
                </nav>
              </div>
              {visibleTab ? (
                <section className={`panel on${visibleTab.dim ? ' st-dim' : ''}`} id={panelId} role="tabpanel" aria-label={visibleTab.label} data-panel={visibleTab.id}>
                  {visibleTab.sections.map(renderSection)}
                  {visibleTab.id === 'unused' && !q ? (
                    <p className="st-note">המפתחות בלשונית הזו אינם נקראים היום בשום קוד פעיל (נבדק מול הקוד; הערות ותיעוד לא נחשבים). חלקם עברו למסך ההרשאות. הם נשמרים לתיעוד בלבד.</p>
                  ) : null}
                </section>
              ) : null}
              {q && hits.total === 0 ? (
                <div className="empty st-empty"><Ic id="search" size="lg" /><div>לא נמצאו {isNames ? 'כיתובים' : 'הגדרות'} התואמות לחיפוש</div></div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={askDiscard}
        root={portalRoot}
        heading="ביטול כל השינויים?"
        sub={isNames ? 'הכיתובים יחזרו לערכים השמורים.' : 'ההגדרות יחזרו לערכים השמורים.'}
        okLabel="בטל שינויים"
        okIcon="undo"
        icon="undo"
        k="tilt"
        destructive
        onYes={discard}
        onNo={() => setAskDiscard(false)}
      />
      <ConfirmDialog
        open={askReset}
        root={portalRoot}
        heading="לשחזר את כל הכיתובים?"
        sub="כל הכיתובים יחזרו לערכי ברירת המחדל המקוריים. השינוי ייקלט רק אחרי שמירה."
        okLabel="שחזר ברירת מחדל"
        okIcon="undo"
        icon="undo"
        k="tilt"
        destructive
        onYes={() => {
          setAskReset(false);
          setResetAll(true);
          const next = {};
          for (const k of Object.keys(DEFAULT_LABELS)) if ((originals[k] ?? '') !== DEFAULT_LABELS[k]) next[k] = DEFAULT_LABELS[k];
          setModified(next);
        }}
        onNo={() => setAskReset(false)}
      />
      <UnsavedDialog
        open={!!leave}
        root={portalRoot}
        items={resetAll && !changeItems.length ? [{ key: '__reset', label: 'כל הכיתובים', icon: 'undo', from: 'כיתובים שמורים', to: 'ברירת מחדל' }] : changeItems}
        busy={saving}
        onSave={() => { const l = leave; afterSaveRef.current = () => goLeave(l); setLeave(null); save(); }}
        onLeave={() => { const l = leave; setLeave(null); setModified({}); setResetAll(false); goLeave(l); }}
        onStay={() => setLeave(null)}
      />
      <AuthDialog
        open={!!auth}
        root={portalRoot}
        error={auth && auth.error}
        busy={saving}
        onSubmit={saveWithAuth}
        onCancel={() => { setAuth(null); afterSaveRef.current = null; setErrorBanner({ title: 'השמירה בוטלה', text: 'נדרש אישור הנהלה ראשית / מתכנת.' }); }}
      />
      <Toast toast={toast} onClose={closeToast} />
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
