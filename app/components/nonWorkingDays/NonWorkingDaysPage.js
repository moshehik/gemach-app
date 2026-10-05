'use client';

// "ימי אי-פעילות" (/non-working-days) - עיצוב מאושר: תצוגות-עיצוב/סיימתי-לעבוד/ימי-אי-פעילות.html (1.10.2026), רכיבי פלטה
// בלבד (design-system/COMPONENTS.md) בתוך .gm-ds.gm-nw (בלי .gm-home - הבלוק של דף הבית דורס כפתורים/שדות). הלוח החודשי
// (hc / lz-day של הלו״ז) מימין, ומשמאלו עמודת צד כהה שתמיד גלויה, כמו "סיכום" בכרטיס הזמנה (NWD-01): סיכום + שינויים שלא
// נשמרו, סימון ימים, רשימת הימים שסומנו, ותאריכים עבריים קבועים.
//
// תשובות הבעלים 1.10.2026 (15/15) + הפירושים (scratch/schedule-build/DECISIONS-ימי-אי-פעילות.md "החלטות שפורשו"):
//   NWD-02/Q02/Q03  שישי, שבת, חג, ערב חג (כולל הושענא רבה וערב שביעי של פסח) וחול המועד סגורים אוטומטית - מהכלל
//                   האחיד ב-lib/businessDays.js, לא מחושב כאן. NWD-Q04: אי אפשר לפתוח יום סגור.
//   NWD-03/Q07      סימון יום או טווח (Shift + לחיצה, או "מתאריך" / "עד תאריך"), עם הערה. ימים סגורים ושעברו מדולגים (פירוש 5);
//                   NW-I5: רק מספר הימים בטווח ("N ימים נבחרו"), בלי שום פירוט ובלי מספר נוסף בלחצן.
//   NWD-04          כל שינוי הוא טיוטה עד "שמור"; "בטל שינויים" זורק אותה; ביטול לכל שורה.
//   NWD-05 / NW-I2 / NW-I4  אין חלונות אישור להסרה: הסרת יום שמור או תאריך עברי קבוע שמור היא טיוטה (שורה "יוסר" בשינויים שלא נשמרו,
//                   ורק "שמור" אחד מחיל). חלון כהה (#dlg בפורטל לשורש הדף) נשאר רק להתנגשות שמירה (מישהו אחר שמר בינתיים).
//   NWD-Q05         ימים שעברו נעולים (בממשק). NWD-Q06: אזהרה בלבד על פעילות רשומה - ההזמנות לא משתנות.
//   NWD-Q08         עורך מי שהשרת אומר canEdit (הנהלה ראשית / feature:non_working_days_manage); אחרים - צפייה בלבד (פירוש 9).
// הלוגיקה הטהורה (מודל, הפרש, ניתוח בחירה, תאריכים עבריים): lib/nonWorkingDaysPage.js. בממשק - תאריכים עבריים בלבד.
// שמירה: POST /api/settings עם המפתח non_working_days_extra בלבד (גרסה 2) - כל גמ"ח כותב ל-DB שלו.
import '@/design-system/components.css';
import './non-working-days.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Ic, HomeSprite } from '../home/HomeParts';
import FixedDatePicker from './FixedDatePicker';
import usePageTooltip from '../profile/usePageTooltip';
import { useA5Shell } from '../menu/A5ShellContext';
import { validateNonWorkingDaysSettingValue } from '@/lib/businessDays';
import { getIsraelDateKey } from '@/lib/hebrewDate';
import {
  heb, hLong, hDate, hShort, hMonthTitle, monthStartOf, monthGrid, nextMonthStart, prevMonthStart, keysBetween, WEEKDAYS_SHORT,
  autoReason, closedReason, fixedOn, fixedLabel, nextOccurrence, modelFromSetting, cloneModel, serializeModel, sameMeaning,
  diffModels, undoGroup, analyseSelection, markDays, unmarkDays, setNote, addFixed, removeFixed, hasFixed,
  SHORT_YEAR_MONTHS, DAY30_NOTE, ADAR1_NOTE, ADAR_NOTE, gematria, plural, activityText, sumActivity, NOTE_MAX,
  draftStorageKey, buildDraft, parseDraft, restoreDraftModel,
} from '@/lib/nonWorkingDaysPage';

const TOAST_MS = 3600;
const NOTE_HINT = 'ההערה גלויה לכל העובדים המחוברים למערכת (ולא לגולשים בלי התחברות): בלי שמות, טלפונים או סיבות אישיות.';

async function getJson(url) {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((d && d.error) || 'שגיאה בטעינת הנתונים'); e.status = r.status; throw e; }
  return d;
}

// Escape סוגר, Tab נשאר בתוך החלון, והפוקוס חוזר בסגירה ללחצן שפתח (כמו AttendanceDialogs.js)
function useDialogKeys(open, dlgRef, onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const opener = typeof document !== 'undefined' ? document.activeElement : null;
    const t = setTimeout(() => { const b = dlgRef.current && dlgRef.current.querySelector('[data-yes], .btn'); if (b) b.focus(); }, 80);
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current(); return; }
      if (e.key !== 'Tab' || !dlgRef.current) return;
      const els = [...dlgRef.current.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (!dlgRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      try { if (opener && opener.focus && document.contains(opener)) opener.focus(); } catch { /* */ }
    };
  }, [open, dlgRef]);
}

/** חלון אישור כהה (חלון 18/20 בפלטה: scrim > dlg#dlg, dbadge, h2, .sub, .dbtns) - בפורטל לשורש הדף (.gm-ds.dlg-dark) */
function ConfirmDialog({ portal, dlg, onClose }) {
  const dlgRef = useRef(null);
  const [on, setOn] = useState(false);
  useDialogKeys(!!dlg, dlgRef, onClose);
  useEffect(() => {
    if (!dlg) { setOn(false); return undefined; }
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setOn(true)));
    return () => cancelAnimationFrame(r);
  }, [dlg]);
  if (!dlg || !portal) return null;
  const icon = dlg.icon || 'check';
  return createPortal(
    <div className={'scrim' + (on ? ' on' : '')} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dlg lz-cf" id="dlg" role="dialog" aria-modal="true" aria-labelledby="nw-dlg-t" ref={dlgRef}>
        <div className="dbadge" aria-hidden="true" data-k={icon === 'trash' ? 'lid' : icon === 'check' ? 'breathe' : 'float'}><Ic id={icon} /></div>
        <h2 id="nw-dlg-t">{dlg.title}</h2>
        {dlg.sub ? <div className="sub">{dlg.sub}</div> : null}
        <div className="dbtns">
          <button type="button" className="btn primary lg block" data-yes onClick={() => { onClose(); dlg.onYes && dlg.onYes(); }}><Ic id={dlg.yesIcon || icon} />{dlg.yes || 'אישור'}</button>
          {dlg.alt ? <button type="button" className="btn block" onClick={() => { onClose(); dlg.onAlt && dlg.onAlt(); }}><Ic id={dlg.altIcon || 'check'} size="sm" />{dlg.alt}</button> : null}
          <button type="button" className="btn ghost block" onClick={onClose}><Ic id="x" size="sm" />{dlg.no || 'ביטול'}</button>
        </div>
      </div>
    </div>,
    portal,
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  return (
    <div id="toast" className="info pulse on" role="status" aria-live="polite" key={toast.n}>
      <span className="tb"><Ic id={toast.icon || 'check'} /></span>
      <div><b>{toast.title}</b><small>{toast.sub || ''}</small></div>
      <button type="button" className="tclose" aria-label="סגירה" onClick={onClose}><Ic id="x" /></button>
    </div>
  );
}

function Warn({ title, detail, alert }) {
  return (
    <div className="cl-wrn">
      <section className="nb nb-warning open" role={alert ? 'alert' : 'status'} aria-live={alert ? 'assertive' : 'polite'}>
        <div className="nb-main"><div className="nb-head">
          <span className="nb-ic" aria-hidden="true"><Ic id="alert" /></span>
          <div className="nb-msg"><b>{title}</b><span>{detail}</span></div>
        </div></div>
      </section>
    </div>
  );
}

/** טיוטה שלא נשמרה מהביקור הקודם (localStorage): שחזר / מחק - לא חוסם, כמו הבאנר בכרטיס ההזמנה */
function DraftBanner({ draft, onRestore, onDiscard }) {
  const when = hDate(getIsraelDateKey(new Date(draft.savedAt))) + ' · ' + new Date(draft.savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="cl-wrn cl-draft" id="nw-draft">
      <section className="nb nb-warning open" role="status" aria-live="polite">
        <div className="nb-main">
          <div className="nb-head">
            <span className="nb-ic" aria-hidden="true"><Ic id="pencil" /></span>
            <div className="nb-msg">
              <b>נמצאו שינויים שלא נשמרו</b>
              <span>{plural(draft.count, 'שינוי אחד', 'שינויים')} · נשמרו כטיוטה ב-{when}.{draft.stale ? ' הרשימה השמורה השתנתה מאז, ולכן אחרי השחזור חלק מהשורות יופיעו כ"יוסר": בדקו ברשימת השינויים לפני שמירה.' : ''}</span>
            </div>
          </div>
          <div className="nb-acts">
            <button type="button" className="btn primary sm" data-act="draft-restore" onClick={onRestore}><Ic id="undo" size="sm" />שחזר</button>
            <button type="button" className="btn ghost sm" data-act="draft-discard" onClick={onDiscard}><Ic id="trash" size="sm" />מחק טיוטה</button>
          </div>
        </div>
      </section>
    </div>
  );
}

const rangeLabel = (keys) => (keys.length === 1 ? hLong(keys[0]) : hDate(keys[0]) + ' – ' + hDate(keys[keys.length - 1]));

/* ---------- הלוח החודשי ---------- */
function DayCell({ k, inMonth, today, saved, work, selSet, anchors, onPick }) {
  const h = heb(k);
  const a = autoReason(k);
  const past = k < today;
  const fv = a ? null : fixedOn(work.fixed, k);
  const fs = a ? null : fixedOn(saved.fixed, k);
  const m = work.marks.has(k);
  const ms = saved.marks.has(k);
  const man = !a && !fv && m;
  const pendAdd = (man && !ms) || (!!fv && !fs);
  const pendRm = !a && !fv && !m && (ms || !!fs);
  const sel = selSet.has(k);
  const note = m ? work.marks.get(k) : '';
  const cls = 'hc-d lz-day' + (k === today ? ' today' : '') + (inMonth ? '' : ' dim') + (a ? ' cl-auto' : '') + (fv ? ' cl-fx' : '')
    + (man ? ' cl-man' : '') + (pendAdd ? ' cl-pend' : '') + (pendRm ? ' cl-rmv' : '') + (sel ? ' cl-sel' : '') + (sel && anchors.has(k) ? ' cl-end' : '') + (past ? ' cl-past' : '');
  let status = 'פעיל';
  if (a) status = 'סגור: ' + a.txt;
  else if (fv) status = 'סגור כל שנה לפי תאריך עברי קבוע: ' + fixedLabel(fv) + (pendAdd ? ' (לא נשמר)' : '');
  else if (man) status = 'אין פעילות (סומן ידנית)' + (note ? ': ' + note : '') + (pendAdd ? ' (לא נשמר)' : '');
  else if (pendRm) status = 'פעיל (הסימון יוסר אחרי שמירה)';
  return (
    <button type="button" className={cls} data-d={k} aria-pressed={sel} aria-label={hLong(k) + ' · ' + status} onClick={(e) => onPick(k, e.shiftKey)}>
      <span className="lz-dh"><b>{h ? h.dl : ''}</b>{h && h.d === 1 ? <em>{h.m}</em> : null}{a || fv ? <span className="cl-lk" aria-hidden="true"><Ic id="lock" size="sm" /></span> : null}</span>
      {a ? <span className="cl-r"><span className="tx">{a.txt}</span></span> : null}
      {!a && fv ? <><span className="cl-r"><span className="tx">כל שנה: {fixedLabel(fv)}</span></span>{pendAdd ? <span className="cl-m"><small className="cl-pd">לא נשמר</small></span> : null}</> : null}
      {man ? (
        <span className="cl-m">
          <b><Ic id="pencil" size="sm" /><span className="tx">אין פעילות</span></b>
          {note ? <small>{note}</small> : null}
          {pendAdd ? <small className="cl-pd">לא נשמר</small> : null}
        </span>
      ) : null}
      {pendRm ? <span className="cl-r cl-rm"><span className="tx">יוסר אחרי שמירה</span></span> : null}
    </button>
  );
}

function MonthCalendar({ start, today, saved, work, sel, onPick, onNav }) {
  const selKeys = sel ? keysBetween(sel.a, sel.b) : [];
  const selSet = new Set(selKeys);
  const anchors = new Set(sel ? [sel.a, sel.b] : []);
  const cells = monthGrid(start);
  return (
    <div className="hc lz-hc">
      <div className="hc-h">
        <button type="button" className="hc-n" aria-label="החודש הקודם" data-tip="החודש הקודם" onClick={() => onNav(-1)}><Ic id="chev" size="sm" /></button>
        <span className="hc-t" style={{ cursor: 'default' }}>{hMonthTitle(start)}</span>
        <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" data-tip="החודש הבא" onClick={() => onNav(1)}><Ic id="chev" size="sm" /></button>
      </div>
      <div className="hc-w" aria-hidden="true">{WEEKDAYS_SHORT.map((x) => <span key={x}>{x}</span>)}</div>
      <div className="hc-g lz-g" role="group" aria-label={'ימי החודש ' + hMonthTitle(start)}>
        {cells.map((c) => <DayCell key={c.key} k={c.key} inMonth={c.inMonth} today={today} saved={saved} work={work} selSet={selSet} anchors={anchors} onPick={onPick} />)}
      </div>
    </div>
  );
}

/* ---------- הדף ---------- */
export default function NonWorkingDaysPage() {
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const editorRef = useRef(null);
  const inA5Shell = useA5Shell();
  usePageTooltip(rootRef, ttRef, !!inA5Shell);
  const [portal, setPortal] = useState(null);
  useEffect(() => { setPortal(rootRef.current); }, []);

  const [load, setLoad] = useState({ loading: true, error: null });
  const [server, setServer] = useState(null); // { value, today, canEdit, name }
  const [saved, setSaved] = useState(null);
  const [work, setWork] = useState(null);
  const [start, setStart] = useState(null);
  const [sel, setSel] = useState(null); // { a, b }
  const [arm, setArm] = useState(null); // 'from' | 'to' | null
  const [noteText, setNoteText] = useState('');
  const [fx, setFx] = useState({ day: 26, month: 'Shvat', note: '' });
  const [dlg, setDlg] = useState(null);
  const [toast, setToast] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activity, setActivity] = useState({}); // key -> { events, deliveries }
  const [tick, setTick] = useState(0);
  const [pendingDraft, setPendingDraft] = useState(null); // טיוטה מהביקור הקודם שממתינה להחלטה (שחזר / מחק)
  const [saveError, setSaveError] = useState(null); // הודעת האימות / השרת האחרונה - נשארת על המסך (הטוסט נעלם אחרי 3.6 שנ')
  const draftCheckedRef = useRef(false);
  const hadDraftRef = useRef(false);
  const toastTimer = useRef(null);

  const say = useCallback((title, sub, icon) => {
    clearTimeout(toastTimer.current);
    setToast({ title, sub, icon, n: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // טעינה (וטעינה מחדש אחרי שמירה / "טען מחדש")
  useEffect(() => {
    let alive = true;
    setLoad({ loading: true, error: null });
    getJson('/api/non-working-days').then((d) => {
      if (!alive) return;
      const m = modelFromSetting(d.value || null);
      setServer(d);
      setSaved(m);
      setWork(cloneModel(m));
      setStart((s) => s || monthStartOf(d.today));
      // טיוטה מהביקור הקודם (רק בטעינה הראשונה, רק למי שרשאי לערוך): אם היא באמת שונה ממה שנשמר - באנר שחזר / מחק
      if (!draftCheckedRef.current) {
        draftCheckedRef.current = true;
        if (d.canEdit) {
          const key = draftStorageKey(d.userId);
          let raw = null;
          try { raw = localStorage.getItem(key); } catch { /* */ }
          const dr = parseDraft(raw);
          const model = dr ? restoreDraftModel(m, dr, d.today) : null;
          const n = model ? diffModels(m, model).length : 0;
          if (dr && n) setPendingDraft({ savedAt: dr.savedAt, model, count: n, stale: !sameMeaning(modelFromSetting(dr.base), m) });
          else if (raw !== null) { try { localStorage.removeItem(key); } catch { /* */ } }
        }
      }
      setLoad({ loading: false, error: null });
    }).catch((e) => { if (alive) setLoad({ loading: false, error: e }); });
    return () => { alive = false; };
  }, [tick]);

  const today = server ? server.today : null;
  const canEdit = !!(server && server.canEdit);
  const changes = useMemo(() => (saved && work ? diffModels(saved, work) : []), [saved, work]);
  const dirty = changes.length > 0;

  // אזהרת יציאה מהדף עם שינויים שלא נשמרו (תיבת הדפדפן עצמו - לא window.confirm)
  useEffect(() => {
    if (!dirty) return undefined;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  // טיוטה מקומית: נכתבת מיד עם כל שינוי (בלי השהיה - ניווט פנימי יכול לבוא מיד אחרי העריכה האחרונה), נמחקת כשהטיוטה שבה
  // חזרה להיות זהה לשמור (שמירה / "בטל שינויים"). כל עוד ממתינה טיוטה ישנה להחלטה לא נוגעים בה.
  const draftKey = server && canEdit ? draftStorageKey(server.userId) : null;
  useEffect(() => {
    if (!draftKey || !saved || !work || pendingDraft) return;
    try {
      if (dirty) { localStorage.setItem(draftKey, JSON.stringify(buildDraft(saved, work))); hadDraftRef.current = true; }
      else if (hadDraftRef.current) { localStorage.removeItem(draftKey); hadDraftRef.current = false; }
    } catch { /* אין localStorage (חלון פרטי / חסום): הטיוטה פשוט לא נשמרת */ }
  }, [draftKey, saved, work, dirty, pendingDraft]);
  const clearDraft = useCallback(() => {
    hadDraftRef.current = false;
    try { if (draftKey) localStorage.removeItem(draftKey); } catch { /* */ }
  }, [draftKey]);
  useEffect(() => { setSaveError(null); }, [work]);

  const selList = useMemo(() => (sel ? keysBetween(sel.a, sel.b) : []), [sel]);
  const ana = useMemo(() => (work && today ? analyseSelection(selList, work, today) : null), [selList, work, today]);

  // פעילות רשומה בימים שיסומנו + במופע הקרוב של התאריך הקבוע שבבורר (NWD-Q06: אזהרה בלבד). רק למי שרשאי לסמן.
  const fxNext = useMemo(() => (today ? nextOccurrence({ month: fx.month, day: fx.day }, today) : null), [fx.month, fx.day, today]);
  useEffect(() => {
    if (!canEdit || !today) return undefined;
    const want = [...(ana ? ana.cand : []), ...(fxNext ? [fxNext] : [])].filter((k) => !(k in activity));
    if (!want.length) return undefined;
    const sorted = [...want].sort();
    const from = sorted[0];
    const to = sorted[sorted.length - 1];
    const timer = setTimeout(() => {
      const range = keysBetween(from, to, 121);
      const ask = range.length > 120 ? [[from, from], [to, to]] : [[from, to]];
      Promise.all(ask.map(([f, t]) => getJson(`/api/non-working-days/activity?from=${f}&to=${t}`).then((d) => ({ d, f, t })))).then((res) => {
        setActivity((prev) => {
          const next = { ...prev };
          for (const { d, f, t } of res) for (const k of keysBetween(f, t, 121)) next[k] = (d.days && d.days[k]) || { events: 0, deliveries: 0 };
          return next;
        });
      }).catch(() => { /* אזהרה בלבד - בלי נתונים פשוט לא מציגים אותה */ });
    }, 250);
    return () => clearTimeout(timer);
  }, [ana, fxNext, canEdit, today, activity]);

  // הערה בשדה: ליום מסומן אחד - ההערה שלו; אחרת ריק
  const oneMarked = ana && selList.length === 1 && ana.marked.length === 1 && !ana.cand.length ? ana.marked[0] : null;
  // יום שמור שהסרתם בטיוטה וסימנתם שוב: שדה ההערה מתמלא בהערה השמורה (אחרת הסימון מחדש היה דורס אותה בהערה ריקה)
  const restoreNoteKey = saved && ana && selList.length === 1 && ana.cand.length === 1 && saved.marks.has(selList[0]) ? selList[0] : null;
  useEffect(() => {
    setNoteText(oneMarked && work ? work.marks.get(oneMarked) || '' : restoreNoteKey && saved ? saved.marks.get(restoreNoteKey) || '' : '');
  }, [oneMarked, restoreNoteKey, sel]);

  /* ---------- פעולות ---------- */
  const pick = useCallback((k, shift) => {
    if (arm && sel) {
      if (arm === 'from') setSel({ a: k, b: sel.b < k ? k : sel.b });
      else setSel(sel.a > k ? { a: k, b: sel.a } : { a: sel.a, b: k });
      setArm(null);
    } else if (shift && sel) setSel({ a: sel.a, b: k });
    else setSel({ a: k, b: k });
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width:1023px)').matches && editorRef.current) {
      setTimeout(() => { try { editorRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch { /* */ } }, 30);
    }
  }, [arm, sel]);

  const nav = useCallback((d) => setStart((s) => (d > 0 ? nextMonthStart(s) : prevMonthStart(s))), []);

  const stageMark = () => {
    if (!canEdit || !ana || !ana.cand.length) return;
    setWork((w) => markDays(w, ana.cand, noteText));
    say('נוסף לשינויים: אין פעילות', ana.cand.length === 1 ? hLong(ana.cand[0]) : rangeLabel(ana.cand) + ' · לא נשמר עד "שמור"', 'lock');
  };

  // NW-I2 (תשובת הבעלים): בלי חלון אישור. הסרה של יום שמור היא טיוטה: השורה נכנסת ל"שינויים שלא נשמרו" כ"יוסר", ורק "שמור" מחיל.
  const askRemove = (keysIn) => {
    if (!canEdit) return;
    const keys = keysIn.filter((k) => work.marks.has(k) && k >= today).sort();
    if (!keys.length) return;
    const hasSaved = keys.some((k) => saved.marks.has(k));
    setWork((w) => unmarkDays(w, keys));
    say(hasSaved ? 'הסימון יוסר אחרי שמירה' : 'הוסר מהשינויים', keys.length === 1 ? hLong(keys[0]) : rangeLabel(keys), 'check');
  };

  // NW-I4 (תשובת הבעלים): גם הסרת תאריך עברי קבוע שמור בלי חלון אישור: טיוטה "יוסר", ורק "שמור" מחיל
  const askRemoveFixed = (f) => {
    if (!canEdit) return;
    const wasSaved = hasFixed(saved, f);
    setWork((w) => removeFixed(w, f));
    say(wasSaved ? 'התאריך יוסר אחרי שמירה' : 'הוסר מהשינויים', fixedLabel(f), 'check');
  };

  const doAddFixed = () => {
    if (!canEdit) return;
    const cand = { month: fx.month, day: fx.day, note: fx.note };
    const r = addFixed(work, cand);
    if (r.duplicate) { say('התאריך כבר ברשימה', fixedLabel(cand), 'info'); return; }
    if (!r.added) return;
    setWork(r.work);
    setFx((s) => ({ ...s, note: '' }));
    say('נוסף לשינויים: ייסגר בכל שנה', fixedLabel(cand) + ' · לא נשמר עד "שמור"', 'cal');
  };

  const cancelAll = () => {
    if (!dirty) return;
    setWork(cloneModel(saved));
    say('השינויים בוטלו', 'חזרנו למה שנשמר', 'undo');
  };

  const postSave = async (value) => {
    const r = await fetch('/api/settings', {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ key: server.key, value, name: server.name }]),
    });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error((d && d.error) || (r.status === 401 ? 'אין הרשאה לשמור' : 'השמירה נכשלה'));
  };

  const save = async (force) => {
    if (!canEdit || !dirty || saving) return;
    const value = serializeModel(work);
    const bad = validateNonWorkingDaysSettingValue(value);
    if (bad) { setSaveError(bad); say('לא נשמר', bad, 'alert'); return; }
    setSaveError(null);
    setSaving(true);
    try {
      if (!force) {
        // מישהו אחר שמר בינתיים? לא דורסים בשקט
        const fresh = await getJson('/api/non-working-days');
        if (!sameMeaning(modelFromSetting(fresh.value || null), saved)) {
          setSaving(false);
          setDlg({
            icon: 'alert',
            title: 'הרשימה השתנתה בינתיים',
            sub: <>מישהו אחר שמר שינויים בימי אי-הפעילות אחרי שפתחתם את הדף.<br />&quot;טען מחדש&quot; מציג את הרשימה העדכנית (השינויים שלכם שלא נשמרו יימחקו). &quot;שמור בכל זאת&quot; מחליף את הרשימה ברשימה שלכם.</>,
            yes: 'טען מחדש', yesIcon: 'undo', onYes: () => { clearDraft(); setTick((t) => t + 1); },
            alt: 'שמור בכל זאת', altIcon: 'check', onAlt: () => save(true),
            no: 'ביטול',
          });
          return;
        }
      }
      await postSave(value);
      clearDraft();
      say('נשמר', 'ימי אי-הפעילות עודכנו', 'check');
      setTick((t) => t + 1);
    } catch (e) {
      setSaveError(e.message || 'השמירה נכשלה');
      say('לא נשמר', e.message || 'השמירה נכשלה', 'alert');
    } finally {
      setSaving(false);
    }
  };

  const onNoteChange = (v) => {
    setNoteText(v);
  };
  const commitOneNote = () => {
    if (!canEdit || !oneMarked) return;
    const cur = work.marks.get(oneMarked) || '';
    if (cur === noteText.trim()) return;
    setWork((w) => setNote(w, oneMarked, noteText));
    say('ההערה עודכנה (לא נשמרה)', hLong(oneMarked), 'pencil');
  };

  const restoreDraft = () => {
    if (!pendingDraft) return;
    setWork(pendingDraft.model);
    setPendingDraft(null);
    say('הטיוטה שוחזרה', 'השינויים עדיין לא נשמרו, עד "שמור"', 'undo');
  };
  const discardDraft = () => {
    clearDraft();
    setPendingDraft(null);
    say('הטיוטה נמחקה', 'נשארה הרשימה השמורה', 'trash');
  };

  /* ---------- רינדור ---------- */
  const ready = !load.loading && !load.error && saved && work && today && start;

  return (
    <div className="gm-ds gm-nw home-bg dlg-dark" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="app lz-app">
        <div className="topbar">
          <div className="ttl"><h1 className="pg-ttl"><small>ניהול</small><bdi>ימי אי-פעילות</bdi></h1></div>
          <div className="tools lz-dtools">{server && server.canBoard ? <Link className="btn sm" href="/board"><Ic id="cal" />ללוח החודשי</Link> : null}</div>
        </div>
        <div className="lz-bar">
          <div className="lz-quick cl-quick">
            <button type="button" className={'btn tgl' + (ready && start === monthStartOf(today) ? ' on' : '')} aria-pressed={!!(ready && start === monthStartOf(today))} disabled={!ready} onClick={() => setStart(monthStartOf(today))}>החודש הנוכחי</button>
          </div>
        </div>
        <p className="cl-expl"><Ic id="info" /><span><b>ימי אי-פעילות</b> הם ימים שהגמ״ח סגור בהם: אין בהם הכנה, איסוף ומשלוחים. הם מדולגים כשמחשבים תאריכי משלוח והכנה, לא נספרים בימי איחור בהחזרה, ומסומנים בלו״ז היומי. שישי, שבת, חגים, ערבי חג וחול המועד סגורים אוטומטית. אפשר להוסיף ימים נוספים, ותאריכים עבריים שנסגרים בכל שנה.</span></p>
        <div className="cl-legend" role="group" aria-label="מקרא">
          <span className="chip"><i className="cl-sw a" />סגור אוטומטית (שישי, שבת, חג, חול המועד)</span>
          <span className="chip"><i className="cl-sw m" />סומן ידנית: אין פעילות</span>
          <span className="chip"><i className="cl-sw f" />תאריך עברי קבוע (כל שנה)</span>
          <span className="chip"><i className="cl-sw p" />שינוי שלא נשמר</span>
          <span className="chip"><i className="cl-sw t" />היום</span>
        </div>

        {load.error ? (
          <div className="empty cl-err" role="alert">
            <Ic id={load.error.status === 401 || load.error.status === 403 ? 'shield' : 'alert'} size="lg" />
            <div>{load.error.message}</div>
            {load.error.status !== 401 && load.error.status !== 403 ? <button type="button" className="btn" onClick={() => setTick((t) => t + 1)}><Ic id="undo" size="sm" />נסו שוב</button> : null}
          </div>
        ) : !ready ? (
          <div className="empty cl-err" role="status"><Ic id="cal" size="lg" /><div>טוען נתונים...</div></div>
        ) : (
          <div className="cl-layout">
            <div id="nw-month">
              <MonthCalendar start={start} today={today} saved={saved} work={work} sel={sel} onPick={pick} onNav={nav} />
            </div>
            <div className="cl-side rail open">
              {canEdit ? <SummaryCard work={work} today={today} changes={changes} saving={saving} onUndo={(g) => setWork((w) => undoGroup(saved, w, g))} onSave={() => save(false)} onCancel={cancelAll} /> : null}
              {pendingDraft && canEdit ? <DraftBanner draft={pendingDraft} onRestore={restoreDraft} onDiscard={discardDraft} /> : null}
              {saveError ? <Warn alert title="לא נשמר" detail={saveError} /> : null}
              {saved.invalid > 0 ? (
                <Warn title="בהגדרה השמורה יש רשומות לא תקינות" detail={`${saved.invalid} רשומות לא נקראו (תאריך לא קיים, טווח הפוך, סימון "פתוח" ישן ועוד). הן לא חלות היום, ושמירה מהדף הזה תסיר אותן.`} />
              ) : null}
              <div ref={editorRef}>
                <div className="sr-only" role="status" aria-live="polite">{selList.length === 1 ? hLong(selList[0]) + ' · ' + statusOf(selList[0], work) : selList.length > 1 ? selList.length + ' ימים נבחרו' : ''}</div>
                <EditorCard
                  canEdit={canEdit} today={today} work={work} sel={sel} selList={selList} ana={ana} arm={arm} activity={activity}
                  noteText={noteText} onNoteChange={onNoteChange} onNoteCommit={commitOneNote} oneMarked={oneMarked}
                  onArm={(x) => setArm((a) => (a === x ? null : x))} onMark={stageMark} onRemoveSel={() => askRemove(ana ? ana.marked : [])}
                />
              </div>
              <MarkedList
                canEdit={canEdit} today={today} saved={saved} work={work}
                onPick={(k) => { setStart(monthStartOf(k)); setArm(null); setSel({ a: k, b: k }); }}
                onRemove={(k) => askRemove([k])}
                onRestore={(k) => setWork((w) => markDays(w, [k], saved.marks.get(k) || ''))}
              />
              <FixedCard
                canEdit={canEdit} today={today} saved={saved} work={work} fx={fx} setFx={setFx} fxNext={fxNext} activity={activity}
                onAdd={doAddFixed} onRemove={askRemoveFixed} onRestore={(f) => setWork((w) => ({ ...cloneModel(w), fixed: [...w.fixed, { ...f }] }))}
              />
            </div>
          </div>
        )}
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />
      <ConfirmDialog portal={portal} dlg={dlg} onClose={() => setDlg(null)} />
      <div className="pl-tt" role="tooltip" id="nw-tt" ref={ttRef} />
    </div>
  );
}

/* ---------- "סיכום" + שינויים שלא נשמרו (כמו כרטיס הזמנה) ---------- */
function groupRow(g) {
  let icon = 'plus';
  let title = null;
  let small = '';
  if (g.t === 'add') { icon = 'plus'; title = <><b>יסומן: אין פעילות</b> · {rangeLabel(g.keys)}</>; small = (g.keys.length > 1 ? g.keys.length + ' ימים' : '') + (g.note ? (g.keys.length > 1 ? ' · ' : '') + g.note : ''); }
  else if (g.t === 'rm') { icon = 'trash'; title = <><b>יוסר הסימון</b> · {rangeLabel(g.keys)}</>; small = g.keys.length > 1 ? g.keys.length + ' ימים' : ''; }
  else if (g.t === 'note') { icon = 'pencil'; title = <><b>הערה עודכנה</b> · {hDate(g.keys[0])}</>; small = g.note || 'ההערה נמחקה'; }
  else if (g.t === 'fxadd') { icon = 'plus'; title = <><b>ייסגר בכל שנה</b> · {fixedLabel(g.f)}</>; small = g.f.note || 'תאריך עברי קבוע'; }
  else if (g.t === 'fxrm') { icon = 'trash'; title = <><b>יוסר מהתאריכים הקבועים</b> · {fixedLabel(g.f)}</>; small = g.f.note || ''; }
  else if (g.t === 'fxnote') { icon = 'pencil'; title = <><b>הערה עודכנה</b> · {fixedLabel(g.f)}</>; small = g.f.note || 'ההערה נמחקה'; }
  return { icon, title, small };
}
const groupKey = (g) => g.t + ':' + (g.keys ? g.keys.join(',') : g.f.month + '|' + g.f.day);

function SummaryCard({ work, today, changes, saving, onUndo, onSave, onCancel }) {
  const nMarked = [...work.marks.keys()].filter((k) => k >= today).length;
  const nFx = work.fixed.length;
  const dirty = changes.length > 0;
  return (
    <div className="rcard cart" id="nw-sum">
      <div className="sec-h"><Ic id="list" size="sm" /><span>סיכום</span></div>
      <div className="glance">
        <span className="gl itm-c cl-wide" tabIndex={0}><Ic id="lock" /><span className="gv">{plural(nMarked, 'יום אחד מסומן', 'ימים מסומנים')}</span></span>
        <span className="gl itm-c cl-wide" tabIndex={0}><Ic id="cal" /><span className="gv">{plural(nFx, 'תאריך קבוע אחד', 'תאריכים קבועים')}</span></span>
        <span className={'gl cl-wide ' + (dirty ? 'cl-un' : 'cl-sv')} tabIndex={0}><Ic id={dirty ? 'alert' : 'check'} /><span className="gv">{dirty ? 'יש שינויים שלא נשמרו' : 'הכול שמור'}</span></span>
      </div>
      <div className="cart-h"><Ic id="list" size="sm" /><b>שינויים שלא נשמרו</b><span className="badge">{changes.length}</span></div>
      <div className="cart-body"><div className="cart-list">
        {dirty ? changes.map((g) => {
          const r = groupRow(g);
          return (
            <div className="cl enter" key={groupKey(g)}>
              <div className="cl-i"><Ic id={r.icon} /></div>
              <div className="cl-t"><span>{r.title}</span>{r.small ? <small>{r.small}</small> : null}</div>
              <button type="button" className="cl-u" aria-label="ביטול השינוי" data-tip="ביטול" onClick={() => onUndo(g)}><Ic id="bk" size="sm" /></button>
            </div>
          );
        }) : <div className="cart-empty"><Ic id="check" size="lg" /><span>אין שינויים</span></div>}
      </div></div>
      {dirty ? (
        <div className="cart-actions">
          <button type="button" className="btn primary lg block" disabled={saving} onClick={onSave}><Ic id="check" />{saving ? 'שומר...' : 'שמור'}</button>
          <button type="button" className="btn ghost block sec" data-act="discard" disabled={saving} onClick={onCancel}><Ic id="undo" size="sm" />בטל שינויים</button>
        </div>
      ) : null}
    </div>
  );
}

/* ---------- כרטיס הסימון ---------- */
function statusOf(k, work) {
  const a = autoReason(k);
  if (a) return 'סגור: ' + a.txt;
  const f = fixedOn(work.fixed, k);
  if (f) return 'סגור כל שנה: ' + fixedLabel(f);
  if (work.marks.has(k)) { const n = work.marks.get(k); return 'אין פעילות (סומן ידנית)' + (n ? ': ' + n : ''); }
  return 'פעיל כרגיל';
}

function EditorCard({ canEdit, today, work, sel, selList, ana, arm, activity, noteText, onNoteChange, onNoteCommit, oneMarked, onArm, onMark, onRemoveSel }) {
  const n = selList.length;
  if (!canEdit) {
    return (
      <div className="rcard">
        <div className="sec-h"><Ic id="lock" size="sm" /><span>צפייה בלבד</span></div>
        <p className="cl-p">סימון ימים דורש הרשאה (ברירת מחדל: הנהלה ראשית). אפשר לראות את הימים הסגורים בלוח ובעמודה הזו.</p>
        {n === 1 ? (
          <>
            <div className="cl-eh"><div className="cl-edt"><b>יום {heb(selList[0]).wd}</b><span>{hDate(selList[0])}</span></div></div>
            <p className="cl-p">{statusOf(selList[0], work)}.</p>
          </>
        ) : <div className="empty"><Ic id="cal" size="lg" /><div>בחרו יום בלוח כדי לראות את מצבו.</div></div>}
      </div>
    );
  }
  if (!n || !ana) {
    return (
      <div className="rcard">
        <div className="sec-h"><Ic id="pencil" size="sm" /><span>סימון ימים</span></div>
        <div className="empty"><Ic id="cal" size="lg" /><div>בחרו יום בלוח כדי לסמן אותו כיום בלי פעילות. לבחירת כמה ימים: Shift + לחיצה, או &quot;מתאריך&quot; ו&quot;עד תאריך&quot;.</div></div>
      </div>
    );
  }
  const a = sel.a < sel.b ? sel.a : sel.b;
  const b = sel.a < sel.b ? sel.b : sel.a;
  const act = sumActivity(ana.cand, activity);
  const one = n === 1 ? selList[0] : null;
  const cr = one ? closedReason(one, work.fixed) : null;
  let chip = null;
  if (one) {
    if (cr) chip = <span className="chip gray"><Ic id="lock" size="sm" />סגור</span>;
    else if (one < today) chip = <span className="chip gray">{work.marks.has(one) ? 'אין פעילות' : 'פעיל'}</span>;
    else if (work.marks.has(one)) chip = <span className="chip gold"><Ic id="pencil" size="sm" />אין פעילות</span>;
    else chip = <span className="chip gray">פעיל כרגיל</span>;
  }
  return (
    <div className="rcard">
      <div className="sec-h"><Ic id="pencil" size="sm" /><span>סימון ימים</span></div>
      {one ? (
        <div className="cl-eh"><div className="cl-edt"><b>יום {heb(one).wd}</b><span>{hDate(one)}</span></div>{chip}</div>
      ) : (
        <div className="cl-eh"><div className="cl-edt"><b>{n} ימים נבחרו</b><span>{hDate(a)} – {hDate(b)}</span></div></div>
      )}
      <div className="cl-rng">
        <div className="field"><span className="lbl" id="nw-from-l">מתאריך</span>
          <button type="button" className={'inp cl-fb' + (arm === 'from' ? ' armed' : '')} id="nw-from" aria-labelledby="nw-from-l nw-from" aria-pressed={arm === 'from'} onClick={() => onArm('from')}><Ic id="cal" size="sm" /><bdi>{hShort(a)}</bdi></button>
        </div>
        <div className="field"><span className="lbl" id="nw-to-l">עד תאריך</span>
          <button type="button" className={'inp cl-fb' + (arm === 'to' ? ' armed' : '')} id="nw-to" aria-labelledby="nw-to-l nw-to" aria-pressed={arm === 'to'} onClick={() => onArm('to')}><Ic id="cal" size="sm" /><bdi>{hShort(b)}</bdi></button>
        </div>
      </div>
      {one && cr && cr.k === 'fx' ? <p className="cl-p"><b>{cr.txt}.</b> הגמ״ח סגור ביום הזה לפי התאריך העברי הקבוע. להסרה: ברשימת התאריכים הקבועים למטה.</p> : null}
      {one && cr && cr.k !== 'fx' ? <p className="cl-p"><b>{cr.txt}.</b> הגמ״ח סגור ביום הזה תמיד, אין צורך לסמן אותו, ואי אפשר לסמן אותו כפתוח.</p> : null}
      {one && !cr && one < today ? <p className="cl-p">זה יום שכבר עבר, אי אפשר לשנות אותו.</p> : null}
      {n > 1 && !ana.cand.length && !ana.marked.length ? <p className="cl-p">בטווח הזה אין ימים שאפשר לסמן: הם סגורים בלאו הכי או שכבר עברו.</p> : null}
      {ana.cand.length && (act.ev || act.dl) ? (
        n === 1
          ? <Warn title="ביום הזה כבר רשומה פעילות" detail={activityText(act.ev, act.dl) + ' · ההזמנות עצמן לא ישתנו'} />
          : <Warn title="בטווח שבחרתם יש ימים עם פעילות רשומה" detail={plural(act.days.length, 'יום אחד', 'ימים') + ' · ' + activityText(act.ev, act.dl) + ' · ' + act.days.slice(0, 4).map(hShort).join(', ') + (act.days.length > 4 ? ' ועוד' : '') + ' · ההזמנות עצמן לא ישתנו'} />
      ) : null}
      {ana.cand.length || oneMarked ? (
        <>
          <div className="field">
            <label className="lbl" htmlFor="nw-note">הערה (לא חובה)</label>
            <div className="inpw">
              <input
                id="nw-note" className="inp" maxLength={NOTE_MAX} autoComplete="off" placeholder="למשל: סגור לרגל אירוע משפחתי"
                value={noteText} onChange={(e) => onNoteChange(e.target.value)}
                onBlur={() => { if (oneMarked) onNoteCommit(); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (ana.cand.length) onMark(); else { onNoteCommit(); e.currentTarget.blur(); } } }}
              />
            </div>
          </div>
          <p className="cl-note cl-note-hint">{NOTE_HINT}</p>
        </>
      ) : null}
      {ana.cand.length ? <button type="button" className="btn primary lg block" onClick={onMark}><Ic id="lock" />{n === 1 ? 'סמן: אין פעילות' : 'סמן'}</button> : null}
      {ana.marked.length ? <button type="button" className="btn ghost lg block" onClick={onRemoveSel}><Ic id="trash" />הסר סימון</button> : null}
      <p className="cl-note">{arm ? `לחצו על יום בלוח כדי לקבוע את ${arm === 'from' ? 'תאריך ההתחלה' : 'תאריך הסיום'}.` : 'הסימון נכנס לשינויים שלא נשמרו, ונשמר רק אחרי "שמור".'}</p>
    </div>
  );
}

/* ---------- רשימת הימים שסומנו ---------- */
function MarkedList({ canEdit, today, saved, work, onPick, onRemove, onRestore }) {
  const keys = [...new Set([...saved.marks.keys(), ...work.marks.keys()])].filter((k) => k >= today).sort();
  const cnt = keys.filter((k) => work.marks.has(k)).length;
  return (
    <div className="rcard">
      <div className="sec-h"><Ic id="lock" size="sm" /><span>ימים שסומנו</span><span className="cl-cnt">{cnt}</span></div>
      {!keys.length ? (
        <div className="empty"><Ic id="cal" size="lg" /><div>עוד לא סומנו ימים נוספים.</div><div className="cl-empty-sub">שישי, שבת, חגים, ערבי חג וחול המועד כבר מסומנים אוטומטית בלוח.</div></div>
      ) : (
        <div className="cart-list cl-scroll">
          {keys.map((k) => {
            const gone = !work.marks.has(k);
            const isNew = !saved.marks.has(k);
            const note = gone ? saved.marks.get(k) : work.marks.get(k);
            const d = heb(k);
            return (
              <div
                key={k} className={'cl cl-row' + (gone ? ' cl-gone' : '')} tabIndex={0} role="button" aria-label={'מעבר ליום ' + hLong(k)}
                onClick={() => onPick(k)} onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onPick(k); } }}
              >
                <div className="cl-i"><b>{d ? d.dl : ''}</b></div>
                <div className="cl-t">
                  <span><b>{hLong(k)}</b>{isNew && !gone ? <span className="chip gold">חדש · לא נשמר</span> : null}{gone ? <span className="chip">יוסר</span> : null}</span>
                  <small>{note || 'ללא הערה'}</small>
                </div>
                {canEdit ? (gone
                  ? <button type="button" className="cl-u" aria-label="החזרת הסימון" data-tip="החזרה" onClick={(e) => { e.stopPropagation(); onRestore(k); }}><Ic id="bk" size="sm" /></button>
                  : <button type="button" className="cl-u" aria-label={'הסרת הסימון מהיום ' + hDate(k)} data-tip="הסרה" onClick={(e) => { e.stopPropagation(); onRemove(k); }}><Ic id="trash" size="sm" /></button>) : null}
              </div>
            );
          })}
        </div>
      )}
      <p className="cl-note">הרשימה נשמרת לכל גמ״ח בנפרד.</p>
    </div>
  );
}

/* ---------- תאריכים עבריים קבועים ---------- */
function FixedCard({ canEdit, today, saved, work, fx, setFx, fxNext, activity, onAdd, onRemove, onRestore }) {
  const all = [...work.fixed, ...saved.fixed.filter((f) => !hasFixed(work, f))];
  const day = fx.day;
  const act = fxNext && activity[fxNext] ? activity[fxNext] : null;
  return (
    <div className="rcard" id="nw-fixed">
      <div className="sec-h"><Ic id="cal" size="sm" /><span>תאריכים עבריים קבועים</span><span className="cl-cnt">{work.fixed.length}</span></div>
      <p className="cl-p">תאריכים שנסגרים בכל שנה לפי התאריך העברי, בלי להגדיר אותם מחדש.</p>
      {!all.length ? <div className="empty"><Ic id="cal" size="lg" /><div>עוד לא הוגדרו תאריכים קבועים.</div></div> : (
        <div className="cart-list">
          {all.map((f) => {
            const gone = !hasFixed(work, f);
            const isNew = !hasFixed(saved, f);
            const nx = nextOccurrence(f, today);
            return (
              <div key={f.month + '|' + f.day} className={'cl cl-row cl-fxrow' + (gone ? ' cl-gone' : '')}>
                <div className="cl-i"><b>{gematria(f.day)}</b></div>
                <div className="cl-t">
                  <span><b>{fixedLabel(f)}</b>{isNew && !gone ? <span className="chip gold">חדש · לא נשמר</span> : null}{gone ? <span className="chip">יוסר</span> : null}</span>
                  <small>{nx ? 'הקרוב: ' + hLong(nx) : ''}{nx && f.note ? ' · ' : ''}{f.note || ''}</small>
                </div>
                {canEdit ? (gone
                  ? <button type="button" className="cl-u" aria-label="החזרת התאריך" data-tip="החזרה" onClick={() => onRestore(f)}><Ic id="bk" size="sm" /></button>
                  : <button type="button" className="cl-u" aria-label={'הסרת התאריך הקבוע ' + fixedLabel(f)} data-tip="הסרה" onClick={() => onRemove(f)}><Ic id="trash" size="sm" /></button>) : null}
              </div>
            );
          })}
        </div>
      )}
      {canEdit ? (
        <div className="cl-add">
          <span className="lbl">הוספת תאריך קבוע</span>
          <FixedDatePicker month={fx.month} day={day} onPick={(p) => setFx((s2) => ({ ...s2, day: p.day, month: p.month }))} />
          <div className="inpw"><input id="nw-fx-n" className="inp" maxLength={NOTE_MAX} autoComplete="off" placeholder="הערה (לא חובה)" value={fx.note} onChange={(e) => setFx((s) => ({ ...s, note: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAdd(); } }} /></div>
          <p className="cl-note cl-note-hint">{NOTE_HINT}</p>
          {day === 30 && SHORT_YEAR_MONTHS.includes(fx.month) ? <p className="cl-note cl-note-hint">{DAY30_NOTE}</p> : null}
          {fx.month === 'Adar I' ? <p className="cl-note cl-note-hint">{ADAR1_NOTE}</p> : null}
          {fx.month === 'Adar' ? <p className="cl-note cl-note-hint">{ADAR_NOTE}</p> : null}
          {fxNext && act && (act.events || act.deliveries) ? <Warn title="בתאריך הקרוב כבר רשומה פעילות" detail={hLong(fxNext) + ' · ' + activityText(act.events, act.deliveries) + ' · ההזמנות עצמן לא ישתנו'} /> : null}
          <button type="button" className="btn lg block" onClick={onAdd}><Ic id="plus" />הוסף ({fixedLabel({ month: fx.month, day })})</button>
        </div>
      ) : null}
    </div>
  );
}
