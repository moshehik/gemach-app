'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScheduleIcon from '../ScheduleIcon';
import { STAGE_ORDER, STAGE_META } from '../scheduleMeta';
import { hebrewLong, hebrewParts } from '../hebrewCalendar';
import { PRINT_PAGES, defaultVersion, versionsParam } from '@/lib/schedule/print/registry';
import { downloadScheduleXlsx } from '@/lib/schedule/print/xlsx';
import { downloadPdf } from '@/app/lib/pdfClient';
import './PrintWizard.css';

// אשף "הדפסות והורדות" של הלו״ז (openWiz/wizRender/runWiz בתצוגה המאושרת תצוגות-עיצוב/לוז-יומי.html), בעיצוב כהה ובפריסה של
// חלון ההדפסה של Chrome: תצוגה מקדימה גדולה בצד שמאל, ובצד ימין עץ מתקפל - קטגוריות (שלבי היום, עם מונה) ובכל אחת הדפים שלה
// עם תיבת סימון (תיבת הקטגוריה מסמנת/מנקה את כל דפיה, ובסימון חלקי היא במצב ביניים) וגרסה (03, 07).
// הפעולה (הדפסה / הורדת PDF / ייצוא Excel) נקבעת ע"י הלחצן שנלחץ בדף הלו״ז ומגיעה כ-props - האשף לא שואל שוב.
//   הדפסה: חלון חדש /schedule/print/<keys>?date&branch&version - window.print() נפתח שם לבד.
//   PDF: POST /api/pdf במצב path על אותו דף הדפסה, דרך השער של lib/printAccess.js.
//   Excel: גיליון לכל דף, RTL; המגבלה נבדקת בשרת - מעל המגבלה נדרשת סיסמת מאשר/ת.
// quick: חלונית מהירה לשלב אחד (נפתחת מלחצני המקטע): רק דפי השלב ברשימה שטוחה, בלי עץ / תצוגה מקדימה / "כל דפי היום".
// props: quick (bool), mode ('print'|'download'), format ('xlsx'|'pdf', למצב הורדה; הלחצן "הורדה" בכותרת = PDF, "XL" = Excel),
//   canExport (false = בלי Excel, הורדה = PDF), initialTab (מפתח שלב: פותח את הקטגוריה שלו ובוחר רק את דפיו), date (YYYY-MM-DD),
//   branch, stageData (תשובת /api/schedule - למונים בלבד), onClose.
// תצוגה מקדימה: iframe של /schedule/print/<key>?preview=1 (המסמך בלבד; ה-layout הראשי לא מרנדר שם שום מעטפת - app/layout.js printBare),
//   נטען רק כשבוחרים דף ומוקטן ל-CSS לרוחב החלונית (כמו Chrome). במסך צר: מוסתרת מאחורי לחצן.
// הרשאות: GET /api/schedule/print?format=access מחזיר אילו דפים מותר להדפיס; דף אסור מוצג מנוטרל עם "אין הרשאה" ולא
//   נבחר (גם לא ב"כל דפי היום"). השרת בודק שוב ומדלג על דף אסור (meta.skipped) - האשף רק חוסך את הניסיון.
// נגישות: מלכודת פוקוס (Tab נשאר בחלון), החזרת הפוקוס לכפתור שפתח בסגירה; העץ הוא דפוס "גילוי" (לחצן עם aria-expanded לכל קטגוריה +
//   תיבות סימון מקוריות) - נגיש במקלדת בלי ניהול פוקוס מותאם; חיצים בין כפתורי הגרסה.
const PRINT_BASE = '/schedule/print/';
// רוחב הדף המודפס במסך (210 מ"מ = 794px + שוליים): ה-iframe לא נעשה צר מזה, ובחלונית צרה הוא מוקטן
const PREVIEW_MIN_W = 840;

function pagesByStage() {
  const map = {};
  for (const p of PRINT_PAGES) {
    const k = p.stages[0];
    (map[k] ||= []).push(p);
  }
  return map;
}

export default function PrintWizard({ mode: initialMode = 'print', format: initialFormat = 'xlsx', initialTab = null, quick = false, canExport = true, date, branch = '', stageData = null, onClose }) {
  const byStage = useMemo(() => pagesByStage(), []);
  const stageKeys = STAGE_ORDER.filter((k) => byStage[k] && byStage[k].length);
  const counts = useMemo(() => {
    const c = {};
    for (const s of (stageData && stageData.stages) || []) c[s.key] = s.counts ? s.counts.total : 0;
    return c;
  }, [stageData]);

  // הפעולה נקבעת ע"י מי שפתח את האשף (אין בורר פעולה / קובץ בחלון).
  // canExport=false (עובדת, JDG-04 - אותו דגל שמסתיר את לחצן ה-XL): בלי Excel, הורדה = PDF בלבד (השרת אוכף גם הוא)
  const mode = initialMode === 'download' ? 'download' : 'print';
  const format = initialFormat === 'pdf' || !canExport ? 'pdf' : 'xlsx';
  const startTab = initialTab && stageKeys.includes(initialTab) ? initialTab : 'all';
  const isQuick = quick && startTab !== 'all';
  // ברירת מחדל: הדפים הבנויים של שלבים שיש בהם פריטים היום (נפתח משלב מסוים -> רק דפי השלב); דפים אסורים יוצאים
  // מהבחירה כשתשובת ההרשאות מגיעה (ר' forbidden למטה)
  const [sel, setSel] = useState(() => {
    const s = {};
    for (const p of PRINT_PAGES) s[p.key] = p.status === 'ready' && (startTab === 'all' ? (counts[p.stages[0]] || 0) > 0 : p.stages[0] === startTab);
    return s;
  });
  // null = עדיין לא ידוע (הכל פתוח; השרת בודק בכל מקרה), אחרת Set של מפתחות אסורים
  const [forbidden, setForbidden] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/schedule/print?format=access', { credentials: 'same-origin', cache: 'no-store', signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d || !Array.isArray(d.forbidden)) return;
        const f = new Set(d.forbidden);
        setForbidden(f);
        if (f.size) setSel((s) => { const n = { ...s }; for (const k of f) n[k] = false; return n; });
      })
      .catch(() => { /* השרת עדיין מדלג על דף אסור */ });
    return () => ctrl.abort();
  }, []);
  const usable = useCallback((p) => p.status === 'ready' && !(forbidden && forbidden.has(p.key)), [forbidden]);
  const [versions, setVersions] = useState(() => {
    const v = {};
    for (const p of PRINT_PAGES) if (p.versions) v[p.key] = defaultVersion(p);
    return v;
  });
  const [focus, setFocus] = useState(null);
  // קטגוריות פתוחות בעץ: נפתחת הקטגוריה הראשונה שיש בה דף מסומן (או קטגוריית השלב), ובלחיצה על דף נפתחת הקטגוריה שלו
  const [open, setOpen] = useState(() => {
    if (startTab !== 'all') return new Set([startTab]);
    const first = stageKeys.find((k) => byStage[k].some((p) => sel[p.key]));
    return new Set(first ? [first] : stageKeys.slice(0, 1));
  });
  const [showPrev, setShowPrev] = useState(false); // במסך צר: התצוגה המקדימה מאחורי לחצן
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { kind:'info'|'err'|'ok', text }
  const [pinNeeded, setPinNeeded] = useState(null); // { total, limit, keys }
  const [pin, setPin] = useState('');
  const dlgRef = useRef(null);
  const prevRef = useRef(null);

  useEffect(() => {
    // הפוקוס חוזר בסגירה לאלמנט שפתח את האשף (כפתור בסרגל / בשלב)
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return; }
      const dlg = dlgRef.current;
      if (!dlg) return;
      if (e.key === 'Tab') {
        // מלכודת פוקוס: Tab / Shift+Tab מסתובבים בתוך החלון
        const els = [...dlg.querySelectorAll('button, input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])')].filter((el) => !el.disabled && el.offsetParent !== null);
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (!dlg.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        return;
      }
      // חיצים בין כפתורי הגרסה של אותו דף (RTL: שמאלה = הבא)
      const tgt = e.target;
      const role = tgt && tgt.getAttribute ? tgt.getAttribute('role') : null;
      if (role === 'radio' && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key) && dlg.contains(tgt)) {
        const group = [...tgt.parentElement.children].filter((el) => el.getAttribute('role') === role && !el.disabled);
        const i = group.indexOf(tgt);
        if (i < 0 || group.length < 2) return;
        const next = e.key === 'Home' ? 0 : e.key === 'End' ? group.length - 1
          : (e.key === 'ArrowLeft' || e.key === 'ArrowDown') ? (i + 1) % group.length : (i - 1 + group.length) % group.length;
        e.preventDefault();
        group[next].focus();
        group[next].click();
      }
    };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => { try { dlgRef.current && dlgRef.current.querySelector('button') && dlgRef.current.querySelector('button').focus(); } catch { /* */ } }, 50);
    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(t);
      try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ }
    };
  }, [onClose]);

  // החלונית המהירה: דפי השלב בלבד; האשף המלא: כל הדפים בעץ
  const listed = useMemo(() => PRINT_PAGES.filter((p) => !isQuick || p.stages[0] === startTab), [isQuick, startTab]);
  const selected = PRINT_PAGES.filter((p) => sel[p.key] && usable(p));
  // התצוגה המקדימה נטענת רק לדף שהמשתמש/ת בחר/ה (לחיצה על שורה / תיבה / גרסה) - לא אוטומטית בפתיחה:
  // כל טעינה של ה-iframe היא getScheduleDay מלא בשרת
  const focused = isQuick ? null : (PRINT_PAGES.find((p) => p.key === focus && usable(p)) || null);

  const qs = useCallback((keys) => {
    const u = new URLSearchParams();
    if (date) u.set('date', date);
    if (branch) u.set('branch', branch);
    const vp = versionsParam(Object.fromEntries(keys.filter((k) => versions[k]).map((k) => [k, versions[k]])));
    if (vp) u.set('version', vp);
    return u.toString();
  }, [date, branch, versions]);

  const printUrl = useCallback((keys, extra = '') => PRINT_BASE + keys.join(',') + '?' + qs(keys) + extra, [qs]);

  const setAll = (on) => setSel((s) => { const n = { ...s }; for (const p of listed) if (usable(p)) n[p.key] = on; return n; });
  const setStage = (k, on) => setSel((s) => { const n = { ...s }; for (const p of byStage[k]) if (usable(p)) n[p.key] = on; return n; });
  const toggleOpen = (k) => setOpen((o) => { const n = new Set(o); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const focusPage = (p) => {
    setFocus(p.key);
    setOpen((o) => (o.has(p.stages[0]) ? o : new Set(o).add(p.stages[0])));
  };

  const run = async (pages) => {
    const how = mode === 'print' ? 'print' : format;
    const keys = pages.map((p) => p.key);
    if (!keys.length) return;
    setMsg(null);
    if (how === 'print') {
      const w = window.open(printUrl(keys), '_blank');
      if (!w) setMsg({ kind: 'err', text: 'הדפדפן חסם את חלון ההדפסה. אפשרו חלונות קופצים לאתר ונסו שוב.' });
      else onClose();
      return;
    }
    setBusy(true);
    try {
      if (how === 'pdf') {
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
    const notices = Array.isArray(data.notices) ? data.notices : [];
    const ok = await downloadScheduleXlsx(data.sheets, `luz-${date || 'today'}`, notices);
    if (!ok) { setMsg({ kind: 'err', text: 'אין נתונים לייצוא' }); return; }
    // קובץ חלקי (קיצוץ / דף שדולג) - ההודעה מופיעה גם כאן וגם בגיליון "הערות" שבקובץ
    setMsg(notices.length
      ? { kind: 'info', text: `קובץ ה-Excel ירד (${data.sheets.length} גיליונות, ${data.total} שורות) - שימו לב: ${notices.join(' ')}` }
      : { kind: 'ok', text: `קובץ ה-Excel ירד: ${data.sheets.length} גיליונות, ${data.total} שורות.` });
  }

  const n = selected.length;
  const allDay = PRINT_PAGES.filter((p) => usable(p) && (counts[p.stages[0]] || 0) > 0);
  const goLabel = mode === 'print' ? `הדפס נבחרים (${n})` : format === 'pdf' ? `הורד PDF (${n})` : `הורד Excel (${n})`;
  const stageLabel = isQuick ? STAGE_META[startTab].label : '';
  const allLabel = mode === 'print' ? 'הדפס את כל דפי היום' : 'הורד את כל דפי היום';
  const dayTitle = date ? (() => { const h = hebrewParts(date); return h.dl + ' ' + h.m; })() : '';
  const actionTitle = mode === 'print' ? 'הדפסה' : format === 'pdf' ? 'הורדת PDF' : 'ייצוא Excel';
  const actionVerb = mode === 'print' ? 'ולהדפיס' : 'ולהוריד';

  const pageRow = (p) => {
    const k = p.stages[0];
    const built = p.status === 'ready';
    const denied = built && !!(forbidden && forbidden.has(p.key));
    const ready = built && !denied;
    const isFoc = !!focused && focused.key === p.key;
    const text = <PageText p={p} count={counts[k] || 0} built={built} denied={denied} />;
    return (
      <li key={p.key} className={'lz-pg' + (isFoc ? ' foc' : '') + (ready ? '' : ' lz-wtodo')} title={denied ? 'אין לך הרשאה להדפיס את הדף הזה' : undefined}>
        <TriCheck label={p.label} disabled={!ready} checked={!!sel[p.key] && ready} onChange={(on) => { setSel((s) => ({ ...s, [p.key]: on })); if (!isQuick) focusPage(p); }} />
        <div className="lz-pgt">
          {isQuick || !ready ? (
            <div className="lz-pgb lz-pgb-static">{text}</div>
          ) : (
            <button type="button" className="lz-pgb" aria-pressed={isFoc} aria-label={'תצוגה מקדימה: ' + p.label} onClick={() => focusPage(p)}>{text}</button>
          )}
          {p.versions && ready ? (
            <div className="seg pill lz-wver" role="radiogroup" aria-label={'גרסה: ' + p.label} style={{ '--n': p.versions.length, '--i': Math.max(0, p.versions.findIndex((v) => v.k === versions[p.key])) }}>
              <span className="pth" aria-hidden="true" />
              {p.versions.map((v) => (
                <button key={v.k} type="button" role="radio" aria-checked={versions[p.key] === v.k} className={versions[p.key] === v.k ? 'on' : ''} onClick={() => { setVersions((o) => ({ ...o, [p.key]: v.k })); if (!isQuick) focusPage(p); }}>{v.label}</button>
              ))}
            </div>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <div className="scrim on lz-wscrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={'dlg lz-wiz' + (isQuick ? ' lz-quick' : ' lz-full')} id="dlg" role="dialog" aria-modal="true" aria-labelledby="lz-wiz-title" ref={dlgRef}>
        {isQuick ? (
          <>
            <div className="dbadge" aria-hidden="true"><ScheduleIcon name={mode === 'print' ? 'print' : 'ext'} /></div>
            <h2 id="lz-wiz-title">{actionTitle + ' · ' + stageLabel}</h2>
            <div className="sub">{date ? hebrewLong(date) + ' · ' : ''}בחרו דפים מהשלב</div>
          </>
        ) : (
          <div className="lz-wh">
            <div className="lz-wbadge" aria-hidden="true"><ScheduleIcon name={mode === 'print' ? 'print' : 'ext'} /></div>
            <div className="lz-wht">
              <h2 id="lz-wiz-title">{actionTitle + ' · דפי הלו״ז' + (dayTitle ? ' · ' + dayTitle : '')}</h2>
              <div className="lz-wsub">{date ? hebrewLong(date) + ' · ' : ''}בחרו דפים {actionVerb}</div>
            </div>
          </div>
        )}

        <div className="lz-wb">
          <div className="lz-wl">
            <div className="lz-wall">
              <button type="button" className="lz-wallb" onClick={() => setAll(true)}>סמן הכל</button>
              <button type="button" className="lz-wallb" onClick={() => setAll(false)}>נקה בחירה</button>
              <span className="lz-wsel" aria-live="polite">{n ? `${n} נבחרו` : 'לא נבחרו דפים'}</span>
            </div>
            {isQuick ? (
              <ul className="lz-pgs lz-flat" aria-label="דפים להדפסה">{listed.map(pageRow)}</ul>
            ) : (
              <ul className="lz-tree" aria-label="דפים לפי שלב">
                {stageKeys.map((k) => {
                  const pages = byStage[k];
                  const usablePages = pages.filter(usable);
                  const onCount = usablePages.filter((p) => sel[p.key]).length;
                  const isOpen = open.has(k);
                  return (
                    <li key={k} className={'lz-cat' + (isOpen ? ' open' : '')}>
                      <div className="lz-cath">
                        <TriCheck label={'כל דפי ' + STAGE_META[k].label} disabled={!usablePages.length} checked={!!usablePages.length && onCount === usablePages.length} indeterminate={onCount > 0 && onCount < usablePages.length} onChange={(on) => setStage(k, on)} />
                        <button type="button" className="lz-catb" aria-expanded={isOpen} aria-controls={'lz-grp-' + k} onClick={() => toggleOpen(k)}>
                          <span className="lz-catic"><ScheduleIcon name={STAGE_META[k].icon} /></span>
                          <span className="lz-catn">{STAGE_META[k].label}</span>
                          <span className="lz-chip" title="פריטים היום">{counts[k] || 0}</span>
                          <span className="lz-cats">{onCount}/{pages.length}</span>
                          <ScheduleIcon name="chev" className="lz-chv" />
                        </button>
                      </div>
                      <ul id={'lz-grp-' + k} className="lz-pgs" hidden={!isOpen}>{pages.map(pageRow)}</ul>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          {isQuick ? null : (
            <div className={'lz-wp' + (showPrev ? ' lz-wp-on' : '')} ref={prevRef}>
              <div className="lz-wph">{focused ? 'תצוגה מקדימה · ' + focused.label : 'תצוגה מקדימה'}</div>
              <PreviewFrame
                key={focused ? focused.key + (versions[focused.key] || '') + (date || '') + branch : 'none'}
                title={focused ? 'תצוגה מקדימה: ' + focused.label : ''}
                src={focused ? printUrl([focused.key], '&preview=1') : null}
                visible={showPrev}
              />
            </div>
          )}
        </div>
        {isQuick ? null : (
          <button type="button" className="lz-wptog" aria-pressed={showPrev} onClick={() => { setShowPrev((v) => !v); if (!showPrev) setTimeout(() => { try { prevRef.current && prevRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch { /* */ } }, 60); }}>
            <ScheduleIcon name="eye" className="sm" />{showPrev ? 'הסתר תצוגה מקדימה' : 'הצג תצוגה מקדימה'}
          </button>
        )}

        {msg ? <div className={'lz-wmsg ' + msg.kind} role={msg.kind === 'err' ? 'alert' : 'status'}>{msg.text}</div> : null}
        {pinNeeded && mode === 'download' && format === 'xlsx' ? (
          <div className="lz-wpin">
            <label htmlFor="lz-wpin-in">סיסמת מאשר/ת לייצוא מעל המגבלה</label>
            <input id="lz-wpin-in" className="inp" type="password" autoComplete="off" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pin && !busy) run(PRINT_PAGES.filter((p) => pinNeeded.keys.includes(p.key))); }} />
            <button type="button" className="btn" disabled={!pin || busy} onClick={() => run(PRINT_PAGES.filter((p) => pinNeeded.keys.includes(p.key)))}>אישור וייצוא</button>
          </div>
        ) : null}

        <div className="dbtns mact lz-wf">
          <button type="button" className="btn primary lg" disabled={!n || busy} onClick={() => run(selected)}>
            <ScheduleIcon name={mode === 'print' ? 'print' : format === 'pdf' ? 'ext' : 'table'} />{busy ? 'מכין…' : goLabel}
          </button>
          {isQuick ? null : <button type="button" className="btn" disabled={!allDay.length || busy} onClick={() => run(allDay)}>{allLabel}</button>}
          <button type="button" className="btn ghost" onClick={onClose}>סגירה<ScheduleIcon name="x" className="sm" /></button>
        </div>
      </div>
    </div>
  );
}

function PageText({ p, count, built, denied }) {
  return (
    <>
      <b>{p.label}{!built ? <span className="lz-chip lz-wchip">בבנייה</span> : denied ? <span className="lz-chip lz-wchip">אין הרשאה</span> : null}</b>
      <small>{p.desc} · {count} פריטים{p.barcode ? ' · עם ברקוד' : ''}</small>
    </>
  );
}

// תיבת סימון מקורית (נגישה במקלדת / בקורא מסך); indeterminate הוא מאפיין DOM ולכן נקבע ב-ref
function TriCheck({ checked, indeterminate = false, disabled = false, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = !!indeterminate && !checked; }, [indeterminate, checked]);
  return <input ref={ref} type="checkbox" className="lz-cb" aria-label={label} disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} />;
}

// תצוגה מקדימה כמו של Chrome: המסמך המודפס בלבד, מוקטן (CSS transform) כשהחלונית צרה מרוחב הדף. כל המדידות פיזיות (left/top) - בלי תלות ב-RTL.
function PreviewFrame({ src, title, visible = true }) {
  const boxRef = useRef(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return undefined;
    // מדידה ראשונית מיידית (ResizeObserver לא תמיד יורה מיד, למשל כשהחלון לא מצויר) ואחריה מעקב אחרי שינויי גודל
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.floor(r.width);
      const h = Math.floor(r.height);
      setBox((b) => (w === b.w && h === b.h ? b : { w, h }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [visible]);
  const scale = box.w ? Math.min(1, box.w / PREVIEW_MIN_W) : 1;
  const iw = box.w >= PREVIEW_MIN_W ? box.w : PREVIEW_MIN_W;
  const ih = box.h / scale;
  return (
    <div className="lz-wps" ref={boxRef}>
      {src && box.w > 0 && box.h > 0 ? (
        <iframe className="lz-wpf" title={title} src={src} style={{ width: iw, height: ih, transform: 'scale(' + scale + ')' }} />
      ) : !src ? <p className="lz-wpe">בחרו דף ברשימה כדי לראות אותו כפי שיודפס</p> : null}
    </div>
  );
}
