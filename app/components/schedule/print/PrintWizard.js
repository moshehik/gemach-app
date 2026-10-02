'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScheduleIcon from '../ScheduleIcon';
import { STAGE_ORDER, STAGE_META } from '../scheduleMeta';
import { hebrewLong, hebrewParts } from '../hebrewCalendar';
import { PRINT_PAGES, defaultVersion, versionsParam } from '@/lib/schedule/print/registry';
import { downloadScheduleXlsx } from '@/lib/schedule/print/xlsx';
import { downloadPdf } from '@/app/lib/pdfClient';

// אשף "הדפסות והורדות" של הלו״ז (openWiz/wizRender/runWiz בתצוגה המאושרת תצוגות-עיצוב/לוז-יומי.html):
// מצב (הדפסה / הורדה) · לשוניות שלב · רשימת דפים עם מתג בחירה וגרסה (03, 07) · תצוגה מקדימה של הדף שבפוקוס
// (iframe של /schedule/print/<key>?preview=1, נטען רק כשבוחרים דף) · "הדפס/הורד נבחרים" ו"כל דפי היום".
//   הדפסה: חלון חדש /schedule/print/<keys>?date&branch&version - window.print() נפתח שם לבד.
//   הורדה: Excel (גיליון לכל דף, RTL; המגבלה נבדקת בשרת - מעל המגבלה נדרשת סיסמת מאשר/ת) או PDF (POST /api/pdf
//   במצב path על אותו דף הדפסה, דרך השער של lib/printAccess.js).
// props: mode ('print'|'download'), date (YYYY-MM-DD), branch, stageData (תשובת /api/schedule - למונים בלבד), onClose.
const PRINT_BASE = '/schedule/print/';

function pagesByStage() {
  const map = {};
  for (const p of PRINT_PAGES) {
    const k = p.stages[0];
    (map[k] ||= []).push(p);
  }
  return map;
}

export default function PrintWizard({ mode: initialMode = 'print', date, branch = '', stageData = null, onClose }) {
  const byStage = useMemo(() => pagesByStage(), []);
  const stageKeys = STAGE_ORDER.filter((k) => byStage[k] && byStage[k].length);
  const counts = useMemo(() => {
    const c = {};
    for (const s of (stageData && stageData.stages) || []) c[s.key] = s.counts ? s.counts.total : 0;
    return c;
  }, [stageData]);

  const [mode, setMode] = useState(initialMode === 'download' ? 'download' : 'print');
  const [format, setFormat] = useState('xlsx');
  const [tab, setTab] = useState('all');
  const [sel, setSel] = useState(() => {
    const s = {};
    for (const p of PRINT_PAGES) s[p.key] = p.status === 'ready' && (counts[p.stages[0]] || 0) > 0;
    return s;
  });
  const [versions, setVersions] = useState(() => {
    const v = {};
    for (const p of PRINT_PAGES) if (p.versions) v[p.key] = defaultVersion(p);
    return v;
  });
  const [focus, setFocus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'info'|'err'|'ok', text }
  const [pinNeeded, setPinNeeded] = useState(null); // { total, limit, keys }
  const [pin, setPin] = useState('');
  const dlgRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => { try { dlgRef.current && dlgRef.current.querySelector('button') && dlgRef.current.querySelector('button').focus(); } catch { /* */ } }, 50);
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); };
  }, [onClose]);

  const listed = useMemo(() => PRINT_PAGES.filter((p) => tab === 'all' || p.stages[0] === tab), [tab]);
  const selected = PRINT_PAGES.filter((p) => sel[p.key] && p.status === 'ready');
  const focused = PRINT_PAGES.find((p) => p.key === focus && p.status === 'ready') || selected.find((p) => tab === 'all' || p.stages[0] === tab) || listed.find((p) => p.status === 'ready') || null;

  const qs = useCallback((keys) => {
    const u = new URLSearchParams();
    if (date) u.set('date', date);
    if (branch) u.set('branch', branch);
    const vp = versionsParam(Object.fromEntries(keys.filter((k) => versions[k]).map((k) => [k, versions[k]])));
    if (vp) u.set('version', vp);
    return u.toString();
  }, [date, branch, versions]);

  const printUrl = useCallback((keys, extra = '') => PRINT_BASE + keys.join(',') + '?' + qs(keys) + extra, [qs]);

  const setAll = (on) => setSel((s) => { const n = { ...s }; for (const p of listed) if (p.status === 'ready') n[p.key] = on; return n; });

  const run = async (pages) => {
    const keys = pages.map((p) => p.key);
    if (!keys.length) return;
    setMsg(null);
    if (mode === 'print') {
      const w = window.open(printUrl(keys), '_blank');
      if (!w) setMsg({ kind: 'err', text: 'הדפדפן חסם את חלון ההדפסה. אפשרו חלונות קופצים לאתר ונסו שוב.' });
      else onClose();
      return;
    }
    setBusy(true);
    try {
      if (format === 'pdf') {
        await downloadPdf({ path: printUrl(keys, '&downloadPdf=true'), filename: `luz-${date || 'today'}` }, `luz-${date || 'today'}.pdf`);
        setMsg({ kind: 'ok', text: `קובץ ה-PDF ירד (${keys.length} דפים).` });
      } else {
        await exportXlsx(keys, pin);
      }
    } catch (e) {
      setMsg({ kind: 'err', text: (e && e.message) || 'ההורדה נכשלה' });
    } finally {
      setBusy(false);
    }
  };

  async function exportXlsx(keys, approvalPin) {
    const body = { page: keys.join(','), date: date || undefined, branch: branch || undefined, format: 'rows' };
    const vp = versionsParam(Object.fromEntries(keys.filter((k) => versions[k]).map((k) => [k, versions[k]])));
    if (vp) body.version = vp;
    if (approvalPin) body.approvalPin = approvalPin;
    const res = await fetch('/api/schedule/print', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(body) });
    let data = null;
    try { data = await res.json(); } catch { /* לא JSON */ }
    if (res.status === 403 && data && data.code === 'EXPORT_LIMIT') {
      setPinNeeded({ total: data.total, limit: data.limit, keys });
      setMsg({ kind: 'info', text: approvalPin ? data.error : `הייצוא כולל ${data.total} שורות, מעל המגבלה (${data.limit}). להמשך נדרשת סיסמה של מי שמורשה לאשר ייצוא.` });
      return;
    }
    if (!res.ok) throw new Error((data && data.error) || 'שגיאה בהכנת הייצוא');
    setPinNeeded(null);
    setPin('');
    const ok = await downloadScheduleXlsx(data.sheets, `luz-${date || 'today'}`);
    setMsg(ok ? { kind: 'ok', text: `קובץ ה-Excel ירד: ${data.sheets.length} גיליונות, ${data.total} שורות.` } : { kind: 'err', text: 'אין נתונים לייצוא' });
  }

  const n = selected.length;
  const allDay = PRINT_PAGES.filter((p) => p.status === 'ready' && (counts[p.stages[0]] || 0) > 0);
  const goLabel = mode === 'print' ? `הדפס נבחרים (${n})` : format === 'pdf' ? `הורד PDF (${n})` : `הורד Excel (${n})`;
  const allLabel = mode === 'print' ? 'הדפס את כל דפי היום' : 'הורד את כל דפי היום';
  const dayTitle = date ? (() => { const h = hebrewParts(date); return h.dl + ' ' + h.m; })() : '';

  return (
    <div className="scrim on lz-wscrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg lz-wiz" role="dialog" aria-modal="true" aria-labelledby="lz-wiz-title" ref={dlgRef}>
        <div className="dbadge" aria-hidden="true"><ScheduleIcon name={mode === 'print' ? 'print' : 'ext'} /></div>
        <h2 id="lz-wiz-title">הדפסות והורדות{dayTitle ? ' · ' + dayTitle : ''}</h2>
        <div className="sub">{date ? hebrewLong(date) + ' · ' : ''}בחרו דפים, ואז הדפיסו או הורידו</div>

        <div className="lz-wm">
          <div className="seg pill" role="radiogroup" aria-label="סוג הפעולה" style={{ '--n': 2, '--i': mode === 'print' ? 0 : 1 }}>
            <span className="pth" aria-hidden="true" />
            <button type="button" role="radio" aria-checked={mode === 'print'} className={mode === 'print' ? 'on' : ''} onClick={() => { setMode('print'); setMsg(null); }}>הדפסה</button>
            <button type="button" role="radio" aria-checked={mode === 'download'} className={mode === 'download' ? 'on' : ''} onClick={() => { setMode('download'); setMsg(null); }}>הורדה</button>
          </div>
        </div>
        {mode === 'download' ? (
          <div className="lz-wm lz-wfmt">
            <span className="lz-wfl">קובץ:</span>
            <div className="seg pill" role="radiogroup" aria-label="סוג הקובץ" style={{ '--n': 2, '--i': format === 'xlsx' ? 0 : 1 }}>
              <span className="pth" aria-hidden="true" />
              <button type="button" role="radio" aria-checked={format === 'xlsx'} className={format === 'xlsx' ? 'on' : ''} onClick={() => setFormat('xlsx')}>Excel</button>
              <button type="button" role="radio" aria-checked={format === 'pdf'} className={format === 'pdf' ? 'on' : ''} onClick={() => setFormat('pdf')}>PDF</button>
            </div>
          </div>
        ) : null}

        <nav className="tabs lz-wt" role="tablist" aria-label="שלב">
          <button type="button" role="tab" aria-selected={tab === 'all'} className={'tab' + (tab === 'all' ? ' on' : '')} onClick={() => { setTab('all'); setFocus(null); }}>
            <span className="tico"><ScheduleIcon name="list" /></span>כל דפי היום
          </button>
          {stageKeys.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={'tab' + (tab === k ? ' on' : '')} onClick={() => { setTab(k); setFocus(null); }}>
              <span className="tico"><ScheduleIcon name={STAGE_META[k].icon} />{counts[k] ? <span className="cnt">{counts[k]}</span> : null}</span>{STAGE_META[k].label}
            </button>
          ))}
        </nav>

        <div className="lz-wb">
          <div className="lz-wl">
            <div className="lz-wall">
              <button type="button" className="hf-allb" onClick={() => setAll(true)}>סמן הכל</button>
              <button type="button" className="hf-allb" onClick={() => setAll(false)}>נקה בחירה</button>
            </div>
            {listed.map((p, i) => {
              const k = p.stages[0];
              const showHead = tab === 'all' && (i === 0 || listed[i - 1].stages[0] !== k);
              const ready = p.status === 'ready';
              return (
                <PageRowGroup key={p.key} showHead={showHead} stageKey={k} count={counts[k] || 0}>
                  <div className={'li lz-wr' + (focused && focused.key === p.key ? ' foc' : '') + (ready ? '' : ' lz-wtodo')} onClick={() => ready && setFocus(p.key)}>
                    <div className="ic-b"><ScheduleIcon name={STAGE_META[k].icon} /></div>
                    <div className="t">
                      <b>{p.label}{ready ? null : <span className="chip gray lz-wchip">בבנייה</span>}</b>
                      <small>{p.desc} · {counts[k] || 0} פריטים{p.barcode ? ' · עם ברקוד' : ''}</small>
                      {p.versions && ready ? (
                        <div className="seg pill lz-wver" role="radiogroup" aria-label={'גרסה: ' + p.label} style={{ '--n': p.versions.length, '--i': Math.max(0, p.versions.findIndex((v) => v.k === versions[p.key])) }} onClick={(e) => e.stopPropagation()}>
                          <span className="pth" aria-hidden="true" />
                          {p.versions.map((v) => (
                            <button key={v.k} type="button" role="radio" aria-checked={versions[p.key] === v.k} className={versions[p.key] === v.k ? 'on' : ''} onClick={() => { setVersions((o) => ({ ...o, [p.key]: v.k })); setFocus(p.key); }}>{v.label}</button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <label className="sw" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={p.label} disabled={!ready} checked={!!sel[p.key] && ready} onChange={(e) => { setSel((s) => ({ ...s, [p.key]: e.target.checked })); setFocus(p.key); }} />
                      <i />
                    </label>
                  </div>
                </PageRowGroup>
              );
            })}
          </div>
          <div className="lz-wp">
            <div className="lz-wph">{focused ? 'תצוגה מקדימה · ' + focused.label : 'בחרו דף לתצוגה מקדימה'}</div>
            <div className="lz-wps">
              {focused ? (
                <iframe
                  key={focused.key + (versions[focused.key] || '') + (date || '') + branch}
                  className="lz-wpf"
                  title={'תצוגה מקדימה: ' + focused.label}
                  src={printUrl([focused.key], '&preview=1')}
                />
              ) : null}
            </div>
          </div>
        </div>

        {msg ? <div className={'lz-wmsg ' + msg.kind} role={msg.kind === 'err' ? 'alert' : 'status'}>{msg.text}</div> : null}
        {pinNeeded && mode === 'download' && format === 'xlsx' ? (
          <div className="lz-wpin">
            <label htmlFor="lz-wpin-in">סיסמת מאשר/ת לייצוא מעל המגבלה</label>
            <input id="lz-wpin-in" className="inp" type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pin) run(PRINT_PAGES.filter((p) => pinNeeded.keys.includes(p.key))); }} />
            <button type="button" className="btn" disabled={!pin || busy} onClick={() => run(PRINT_PAGES.filter((p) => pinNeeded.keys.includes(p.key)))}>אישור וייצוא</button>
          </div>
        ) : null}

        <div className="dbtns mact lz-wf">
          <button type="button" className="btn primary lg" disabled={!n || busy} onClick={() => run(selected)}>
            <ScheduleIcon name={mode === 'print' ? 'print' : format === 'pdf' ? 'ext' : 'table'} />{busy ? 'מכין…' : goLabel}
          </button>
          <button type="button" className="btn" disabled={!allDay.length || busy} onClick={() => run(allDay)}>{allLabel}</button>
          <button type="button" className="btn ghost" onClick={onClose}>סגירה<ScheduleIcon name="x" className="sm" /></button>
        </div>
      </div>
    </div>
  );
}

function PageRowGroup({ showHead, stageKey, count, children }) {
  return (
    <>
      {showHead ? (
        <div className="sec-h lz-sh"><ScheduleIcon name={STAGE_META[stageKey].icon} className="sm" />{STAGE_META[stageKey].label}<span className="chip gray">{count}</span></div>
      ) : null}
      {children}
    </>
  );
}
