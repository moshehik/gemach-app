'use client';

// "הדפסות והורדות" של סיכום הנוכחות (openWiz / wizRender / runWiz בעיצוב המאושר, באותם כללי .lz-w* של הלו״ז):
//   האשף המלא (לחצני הכותרת): פעולה (הדפסה / הורדה PDF / XL), חודש, סוג דוח (הנהלה: דוח מלא לכל עובד / טבלת סיכום בלבד /
//   לפי עובד - כל החודשים), רשימת עובדים עם מתגים, תצוגה מקדימה חיה, "הדפס/הורד נבחרים" ו"כל העובדים" (= כל העובדים ברצף,
//   כל עובד בגיליון משלו - AT-02).
//   החלונית המהירה (לחצני השורה): פעולה אחת לפי האיקון שנלחץ, לעובד אחד.
// הדפסה / PDF -> תצוגה מקדימה במסך מלא (הדף האמיתי /attendance/print ב-iframe), ומשם "הדפס" (חלון ההדפסה של הדפדפן על אותו דף)
// או "הורד PDF" (POST /api/pdf במצב path - AT-07; אם השרת נכשל: טוסט + הדפסה רגילה שממנה אפשר לשמור PDF).
// XL (הנהלה בלבד - JDG-04; AT-08: בלי מגבלת שורות ובלי סיסמה): המטען של דף ההדפסה -> קובץ xlsx מימין לשמאל, גיליון לכל עובד.
// עובד רגיל: רק הדוח של עצמו, הדפסה + PDF, בלי XL ובלי שכר (AT-10) - השרת אוכף (lib/attendance/access.js).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ic } from './parts';
import { monthLabel, hebSpan, shiftMonth, hm, initials as initialsOf } from '@/lib/attendance/summary';
import { TYPE_LABEL, payloadToSheets, fileBase } from '@/lib/attendance/print';
import { downloadScheduleXlsx } from '@/lib/schedule/print/xlsx';
import { downloadPdf } from '@/app/lib/pdfClient';

const MODE_LBL = { print: 'הדפסה', dl: 'הורדה (PDF)', xl: 'XL' };
const TYPES = ['full', 'summary', 'byemp'];

export function printUrl({ type, ids, y, m, wages0, extra = '' }) {
  const u = new URLSearchParams({ type });
  if (ids && ids.length) u.set('ids', ids.join(','));
  if (type !== 'byemp' && y !== undefined && y !== null) { u.set('y', String(y)); u.set('m', String(m)); }
  if (wages0) u.set('wages', '0');
  return '/attendance/print?' + u.toString() + extra;
}

async function getJson(url) {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error((d && d.error) || 'שגיאה בטעינת הנתונים');
  return d;
}

/**
 * props: params { mode:'print'|'dl'|'xl', empId|null, type, y, m, full }, own (עובד רגיל / "השעות שלי"), isMgr, self (מצב "השעות שלי"),
 * me { id, name } (own), onClose, onPreview({ url, mode, title }), say(title, text, icon)
 */
export default function AttendanceWizard({ params, own, isMgr, self, me, onClose, onPreview, say }) {
  const quick = !!params.empId && !params.full;
  const [mode, setMode] = useState(params.mode === 'xl' && (!isMgr || own) ? 'print' : params.mode);
  const [type, setType] = useState(params.type === 'byemp' ? 'byemp' : 'full');
  const [per, setPer] = useState({ y: params.y, m: params.m });
  const [sel, setSel] = useState({});
  const [focus, setFocus] = useState(params.empId || null);
  const [list, setList] = useState(null); // [{ id, name, firstName, lastName, dept, days, shiftCount, minutes, issues, months? }]
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const dlgRef = useRef(null);

  const modes = own || !isMgr ? ['print', 'dl'] : ['print', 'dl', 'xl'];
  const effType = own ? (type === 'byemp' ? 'byemp' : 'full') : type;

  // המועמדים לרשימה לפי סוג הדוח והחודש (present() בעיצוב): עובדים שיש להם נתונים
  useEffect(() => {
    let cancel = false;
    setList(null);
    setErr(null);
    const load = async () => {
      if (effType === 'byemp') {
        if (own) {
          const d = await getJson('/api/attendance-sheet?scope=months');
          const T = (d.months || []).reduce((a, mo) => ({ minutes: a.minutes + mo.minutes, days: a.days + mo.days, issues: a.issues + mo.issues }), { minutes: 0, days: 0, issues: 0 });
          return d.months && d.months.length ? [{ ...d.employee, ...T, months: d.months.length }] : [];
        }
        const d = await getJson('/api/attendance-sheet?scope=totals');
        return (d.employees || []).filter((e) => e.months > 0);
      }
      if (own) {
        const d = await getJson(`/api/attendance-sheet?scope=employee&y=${per.y}&m=${per.m}`);
        const act = (d.shifts || []).filter((s) => !s.isDeleted);
        if (!act.length) return [];
        const days = new Set(act.map((s) => s.dayKey)).size;
        return [{ ...d.employee, shiftCount: act.length, days, minutes: act.reduce((a, s) => a + (s.minutes || 0), 0), issues: act.filter((s) => !!s.entryTime !== !!s.exitTime).length }];
      }
      const d = await getJson(`/api/attendance-sheet?scope=month&y=${per.y}&m=${per.m}`);
      return (d.employees || []).map((e) => {
        const act = e.shifts || [];
        return { id: e.id, name: e.name, firstName: e.firstName, lastName: e.lastName, dept: e.dept, shiftCount: act.length, days: new Set(act.map((s) => s.dayKey)).size, minutes: act.reduce((a, s) => a + (s.minutes || 0), 0), issues: act.filter((s) => !!s.entryTime !== !!s.exitTime).length };
      }).filter((e) => e.shiftCount > 0);
    };
    load().then((rows) => {
      if (cancel) return;
      const shown = quick ? rows.filter((r) => r.id === params.empId) : rows;
      setList(shown);
      setSel(() => {
        const s = {};
        for (const r of shown) s[r.id] = quick || own ? true : params.full ? r.id === params.empId : true;
        return s;
      });
    }).catch((e) => { if (!cancel) { setErr(e.message); setList([]); } });
    return () => { cancel = true; };
  }, [effType, per.y, per.m, own, quick, params.empId, params.full]);

  // Escape סוגר, Tab נשאר בחלון, הפוקוס חוזר ללחצן שפתח
  useEffect(() => {
    const opener = document.activeElement;
    const t = setTimeout(() => { const b = dlgRef.current && dlgRef.current.querySelector('.lz-wf .btn.primary'); if (b) b.focus(); }, 60);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !dlgRef.current) return;
      const els = [...dlgRef.current.querySelectorAll('button,input,iframe,[tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const f = els[0];
      const l = els[els.length - 1];
      if (!dlgRef.current.contains(document.activeElement)) { e.preventDefault(); f.focus(); }
      else if (e.shiftKey && document.activeElement === f) { e.preventDefault(); l.focus(); }
      else if (!e.shiftKey && document.activeElement === l) { e.preventDefault(); f.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); document.removeEventListener('keydown', onKey); try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ } };
  }, [onClose]);

  const rows = list || [];
  const selIds = rows.filter((r) => sel[r.id]).map((r) => r.id);
  const allIds = rows.map((r) => r.id);
  const perLabel = effType === 'byemp' ? 'כל החודשים' : monthLabel(per.y, per.m);
  const badge = mode === 'print' ? 'print' : mode === 'dl' ? 'ext' : 'table';
  const focusId = focus && selIds.includes(focus) ? focus : selIds[0];
  const focusRow = rows.find((r) => r.id === focusId);

  const urlFor = useCallback((ids, extra = '') => printUrl({ type: effType, ids: own ? [] : ids, y: per.y, m: per.m, wages0: self, extra }), [effType, own, per.y, per.m, self]);

  const run = async (ids) => {
    if (!ids.length || busy) return;
    if (mode === 'xl') {
      setBusy(true);
      setMsg(null);
      try {
        const u = new URLSearchParams({ scope: 'print', type: effType, ids: ids.join(',') });
        if (effType !== 'byemp') { u.set('y', String(per.y)); u.set('m', String(per.m)); }
        const payload = await getJson('/api/attendance-sheet?' + u.toString());
        const sheets = payloadToSheets(payload);
        const name = fileBase(payload);
        const ok = await downloadScheduleXlsx(sheets, name);
        if (!ok) { setMsg({ kind: 'err', text: 'אין נתונים לייצוא' }); return; }
        say('קובץ ה-Excel ירד', name + '.xlsx', 'check');
        onClose();
      } catch (e) {
        setMsg({ kind: 'err', text: (e && e.message) || 'הייצוא נכשל' });
      } finally {
        setBusy(false);
      }
      return;
    }
    const title = (mode === 'dl' ? 'הורדת PDF' : 'הדפסה') + ' · ' + perLabel;
    onClose();
    onPreview({ url: urlFor(ids, '&preview=1'), mode: mode === 'dl' ? 'pdf' : 'print', title, file: fileName(effType, per, ids.length === 1 ? rows.find((r) => r.id === ids[0]) : null) });
  };

  const typeIdx = TYPES.indexOf(effType);
  const subLine = (r) => {
    if (effType === 'byemp') return 'כל החודשים · ' + (r.months || 0) + ' חודשים · ' + hm(r.minutes) + ' שעות';
    if (quick) return 'דוח נוכחות אישי · ' + r.shiftCount + ' משמרות · ' + hm(r.minutes) + ' שעות';
    return (effType === 'summary' ? 'שורה בטבלת הסיכום · ' : 'עמוד לעובד · ') + r.shiftCount + ' משמרות · ' + hm(r.minutes) + ' שעות';
  };
  const focusName = quick && rows[0] ? rows[0].name : (params.empId && focusRow ? focusRow.name : '');

  let title;
  let sub;
  if (quick) {
    title = (mode === 'print' ? 'הדפסה' : mode === 'dl' ? 'הורדת PDF' : 'ייצוא Excel') + ' · ' + (focusName || (own && me ? me.name : ''));
    sub = perLabel + ' · בחרו מה להפיק';
  } else {
    title = 'הדפסות והורדות · ' + perLabel;
    sub = own ? 'הדוח האישי שלך, אפשר להדפיס או להוריד כ-PDF' : 'בחרו עובדים, ואז הדפיסו, הורידו או ייצאו ל-XL';
  }
  const n = selIds.length;
  const goLabel = quick ? (mode === 'print' ? 'הדפס' : mode === 'dl' ? 'הורד PDF' : 'ייצוא ל-Excel')
    : (mode === 'print' ? 'הדפס נבחרים' : mode === 'dl' ? 'הורד PDF' : 'ייצוא ל-Excel') + ' (' + n + ')';
  const allLabel = mode === 'print' ? 'הדפס את כל העובדים' : mode === 'dl' ? 'הורד את כל העובדים' : 'ייצוא כל העובדים ל-XL';

  // תצוגה מקדימה (wizPreview): סיכום = כל הנבחרים בטבלה; אחרת העובד שבפוקוס
  const previewSrc = useMemo(() => {
    if (quick || !focusId) return null;
    return urlFor(effType === 'summary' ? selIds : [focusId], '&preview=1');
  }, [quick, focusId, effType, selIds.join(','), urlFor]); // eslint-disable-line react-hooks/exhaustive-deps
  const previewTitle = effType === 'summary' && !own ? 'טבלת סיכום' : focusRow ? (own ? 'הדוח האישי שלי' : focusRow.name) : '';

  return (
    <div className="scrim on" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'dlg lz-wiz' + (quick ? ' lz-quick' : '')} id="dlg" role="dialog" aria-modal="true" aria-labelledby="wzT" ref={dlgRef}>
        <div className="dbadge" aria-hidden="true"><Ic id={badge} /></div>
        <h2 id="wzT">{title}</h2>
        <div className="sub" id="wzS">{sub}</div>
        {quick ? null : (
          <div className="lz-wm">
            <div className="seg pill" id="wzMode" role="radiogroup" aria-label="סוג הפעולה" style={{ '--n': modes.length, '--i': Math.max(0, modes.indexOf(mode)) }}>
              <span className="pth" aria-hidden="true" />
              {modes.map((md) => <button key={md} type="button" role="radio" data-m={md} className={md === mode ? 'on' : ''} aria-checked={md === mode} onClick={() => { setMode(md); setMsg(null); }}>{MODE_LBL[md]}</button>)}
            </div>
          </div>
        )}
        {quick ? null : (
          <div className="lz-wm lz-wper" id="wzPer" hidden={effType === 'byemp'}>
            <button type="button" className="ibtn" data-wpm="-1" aria-label="חודש קודם" data-tip="חודש קודם" onClick={() => { setPer((p) => shiftMonth(p.y, p.m, -1)); setMsg(null); }}><Ic id="arrr" /></button>
            <div className="lz-wmo" id="wzMo"><b>{monthLabel(per.y, per.m)}</b><small>{hebSpan(per.y, per.m)}</small></div>
            <button type="button" className="ibtn" data-wpm="1" aria-label="חודש הבא" data-tip="חודש הבא" onClick={() => { setPer((p) => shiftMonth(p.y, p.m, 1)); setMsg(null); }}><Ic id="arrl" /></button>
          </div>
        )}
        {quick || own ? null : (
          <div className="lz-wm lz-wtyp">
            <span className="lz-wfl">סוג הדוח:</span>
            <div className="seg pill" id="wzType" role="radiogroup" aria-label="סוג הדוח" style={{ '--n': 3, '--i': typeIdx }}>
              <span className="pth" aria-hidden="true" />
              {TYPES.map((t) => <button key={t} type="button" role="radio" data-t={t} className={t === effType ? 'on' : ''} aria-checked={t === effType} onClick={() => { setType(t); setMsg(null); }}>{TYPE_LABEL[t]}</button>)}
            </div>
          </div>
        )}
        <div className="lz-wb">
          <div className="lz-wl" id="wzList">
            {quick || own ? null : (
              <div className="lz-wall">
                <button type="button" className="hf-allb" data-wall="1" onClick={() => setSel(Object.fromEntries(allIds.map((id) => [id, true])))}>סמן הכל</button>
                <button type="button" className="hf-allb" data-wall="0" onClick={() => setSel(Object.fromEntries(allIds.map((id) => [id, false])))}>נקה בחירה</button>
              </div>
            )}
            {list === null ? <div className="at-empty" style={{ padding: '24px 8px' }} role="status">טוען נתונים...</div> : null}
            {list !== null && !rows.length ? (
              <div className="at-empty" style={{ padding: '24px 8px' }}><Ic id="cal" /><div>{err || ('לא נמצאו נתוני נוכחות' + (effType === 'byemp' ? '.' : ' לחודש זה.'))}</div></div>
            ) : null}
            {rows.map((r) => (
              <div key={r.id} className={'li lz-wr' + (focus === r.id ? ' foc' : '')} data-wf={r.id} onClick={() => { if (!quick) setFocus(r.id); }}>
                <div className="ic-b" aria-hidden="true">{initialsOf(r)}</div>
                <div className="t">
                  <b>{own ? 'הדוח האישי שלי' : r.name}</b>
                  <small>{r.issues ? <span className="at-iss" style={{ padding: '0 8px', fontSize: 12 }}>{r.issues}<Ic id="alert" /></span> : null}{r.issues ? ' ' : ''}{subLine(r)}</small>
                </div>
                <label className="sw" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" data-wsel={r.id} aria-label={r.name} checked={!!sel[r.id]} onChange={(e) => { const v = e.target.checked; setSel((s) => ({ ...s, [r.id]: v })); setFocus(r.id); }} /><i />
                </label>
              </div>
            ))}
          </div>
          {quick ? null : (
            <div className="lz-wp">
              <div className="lz-wph" id="wzPh">{previewSrc ? 'תצוגה מקדימה · ' + previewTitle : 'בחרו עובד לתצוגה מקדימה'}</div>
              <div className="lz-wps" id="wzPrev">
                {previewSrc ? <iframe key={previewSrc} className="lz-wpf" title={'תצוגה מקדימה: ' + previewTitle} src={previewSrc} /> : null}
              </div>
            </div>
          )}
        </div>
        <div id="wzMsg">{msg ? <div className={'lz-wmsg ' + msg.kind} role="alert">{msg.text}</div> : null}</div>
        <div className="dbtns mact lz-wf">
          <button type="button" className="btn primary lg" id="wzGo" disabled={!n || busy} onClick={() => run(selIds)}><Ic id={badge} />{busy ? 'מכין…' : goLabel}</button>
          {quick ? null : <button type="button" className="btn" id="wzAll" hidden={own} disabled={!rows.length || busy} onClick={() => { setSel(Object.fromEntries(allIds.map((id) => [id, true]))); run(allIds); }}>{allLabel}</button>}
          <button type="button" className="btn ghost" data-wclose onClick={onClose}>סגירה<Ic id="x" size="sm" /></button>
        </div>
      </div>
    </div>
  );
}

function fileName(type, per, row) {
  const base = type === 'byemp' ? 'נוכחות_כל_החודשים' : 'נוכחות_' + (per.m + 1) + '_' + per.y;
  return row ? base + '_' + row.name : base;
}

/**
 * התצוגה המקדימה במסך מלא (#pv בעיצוב): הדף האמיתי /attendance/print ב-iframe, "הדפס" / "הורד PDF", "סגירה".
 * מספר העמודים (#pvN) נמדד מהגיליונות שבתוך ה-iframe (A4 = 297 מ"מ) אחרי שהדף מסמן data-print-ready.
 */
export function PreviewOverlay({ preview, onClose, say }) {
  const frameRef = useRef(null);
  const goRef = useRef(null);
  const [pages, setPages] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!preview) return undefined;
    setPages(null);
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => goRef.current && goRef.current.focus(), 60);
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    let tries = 0;
    const iv = setInterval(() => {
      tries++;
      try {
        const doc = frameRef.current && frameRef.current.contentDocument;
        const ready = doc && doc.querySelector('[data-print-ready="true"]');
        if (ready || tries > 60) {
          clearInterval(iv);
          if (ready) {
            const mm = 96 / 25.4;
            const sheets = [...doc.querySelectorAll('.pp-sheet')];
            const z = parseFloat((doc.querySelector('.pp-paper') && doc.querySelector('.pp-paper').style.zoom) || '1') || 1;
            const n = sheets.reduce((a, s) => a + Math.max(1, Math.ceil((s.getBoundingClientRect().height / z - 2) / (297 * mm))), 0);
            setPages(n || null);
          }
        }
      } catch { clearInterval(iv); }
    }, 250);
    return () => { clearTimeout(t); clearInterval(iv); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [preview, onClose]);
  if (!preview) return null;
  const printNow = () => {
    try { frameRef.current.contentWindow.focus(); frameRef.current.contentWindow.print(); }
    catch { say('ההדפסה לא זמינה כאן', 'פתחו את הדף בחלון רגיל', 'alert'); }
  };
  const go = async () => {
    if (preview.mode === 'print') { printNow(); return; }
    if (busy) return;
    setBusy(true);
    try {
      const path = preview.url.replace('&preview=1', '') + '&downloadPdf=true';
      await downloadPdf({ path, filename: preview.file }, preview.file + '.pdf');
      say('קובץ ה-PDF ירד', preview.file + '.pdf', 'check');
      onClose();
    } catch (e) {
      // AT-07: PDF מהשרת, ואם הוא נכשל - הדפסה רגילה (בחלון ההדפסה אפשר לבחור "שמירה כ-PDF")
      say('לא ניתן להפיק PDF כרגע', 'נפתחת הדפסה רגילה - אפשר לשמור משם כ-PDF', 'alert');
      printNow();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="pv on" id="pv" role="dialog" aria-modal="true" aria-labelledby="pvT">
      <div className="pv-bar">
        <h2 id="pvT">{preview.title}</h2>
        {pages ? <span className="chip gray" id="pvN">{pages + (pages === 1 ? ' עמוד' : ' עמודים')}</span> : null}
        <span className="sp" />
        <button type="button" className="btn primary" id="pvGo" ref={goRef} disabled={busy} onClick={go}>
          <Ic id={preview.mode === 'pdf' ? 'ext' : 'print'} />{busy ? 'מכין…' : preview.mode === 'pdf' ? 'הורד PDF' : 'הדפס'}
        </button>
        <button type="button" className="btn ghost" id="pvClose" onClick={onClose}>סגירה<Ic id="x" size="sm" /></button>
      </div>
      <div className="pv-scroll pv-if" id="pvScroll">
        <iframe ref={frameRef} className="pv-frame" title={preview.title} src={preview.url} />
      </div>
    </div>
  );
}
