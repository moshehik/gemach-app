'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import ScheduleIcon, { LocalSprite } from './ScheduleIcon';
import { useA5Shell } from '@/app/components/menu/A5ShellContext';
import StageRail from './StageRail';
import StageSection from './StageSection';
import UpdatedSection from './UpdatedSection';
import ScrollTopButton from './ScrollTopButton';
import HebrewDayPicker from './HebrewDayPicker';
import ScheduleSkeleton from './ScheduleSkeleton';
import { PageTools } from './ScheduleToolbarSlots';
import PrintWizard from './print/PrintWizard';
import { addDays, israelTodayKey, isDateToken as isToken, parseDateParam, resolveDateParam } from './hebrewCalendar';
import { STAGE_ORDER, STAGE_META } from './scheduleMeta';
import { useStageMarks } from './useStageMarks';
import { MarkToast, ConfirmDialog, DetailRows, confirmEffect } from './MarkDialogs';
import { LzPortalRoot } from './LzPortal';
import BarcodeDialog from './BarcodeDialog';
import { classifyScan, decideStageScan } from '@/lib/schedule/scanDispatch';

// דף "לו״ז יומי". המראה = העיצוב המאושר (תצוגות-עיצוב/לוז-יומי.html, ה-HTML בשורות 1627-1642): כותרת "לוח זמנים" +
// אייקון בורר היום; כלי XL/הורדה/הדפסה בקצה השמאלי של שורת הכותרת; ציר השלבים מימין; בעמודת התוכן מתג שורות/טבלה
// ואז מקטעי השלבים. אין בדף שום טקסט שהעיצוב או הבעלים לא הגדירו (החלטות 4.10.2026: שבב "יום לא עובד" ליד המתג,
// "N התראות" בכותרת שלב). הנתונים: GET /api/schedule (docs/schedule-page-logic-spec.md).
//
// סימון "בוצע" (מחובר): marks = useStageMarks({ data, setData }) - עדכון אופטימי, POST /api/schedule/marks, החזרה לאחור
//   בשגיאה, טוסט (MarkDialogs.js). עובר ל-StageSection כאובייקט אחד; החוזה המלא בראש StageSection.js / StageRow.js /
//   MarkControls.js: onMarkDone(stage, row, { done, outcome: 'ok'|'not_ok' }), doneState(stage, row), onMarkAll(stage).
// חיבורים לסוכנים האחרים (props בלבד; ה-markup לא משתנה):
//   onScan(code) לשורת הברקוד (ר' StageRail.js). ברירת המחדל (ברקוד בלו״ז, docs/schedule-barcode-plan.md): קוד שלב מהדף המודפס (PRP-40113 / ALL-PRP-...)
//   = "בוצע" באותה שורה / שלב (או חלונית הברקוד כשחסר ברקוד); ברקוד שמלה = נרשם להזמנה הפעילה (החלונית הפתוחה / ההזמנה שנסרקה אחרונה).
//   ?scan=<קוד> בכתובת (למשל מהחיפוש המהיר) מריץ את אותה פעולה אחרי טעינת היום.
//   הדפסה/הורדה/XL: onExport / onDownload / onPrint / onSettings ({ stageKey, mode }) (ר' ScheduleToolbarSlots.js).
//   ברירת המחדל (בלי props מבחוץ): שלושת הלחצנים - בכותרת הדף (PageTools) ובכותרת כל שלב (SectionTools) - פותחים את
//   אשף ההדפסות/ההורדות (./print/PrintWizard.js): הדפסה -> מצב הדפסה, הורדה -> מצב הורדה, XL -> מצב הורדה עם Excel.
//   מכותרת שלב האשף נפתח על הלשונית של אותו שלב עם דפי השלב בלבד מסומנים (initialTab); מכותרת הדף - "כל דפי היום".
//   הרשאות (JDG-04, מאושר): עובדת בלי "הכל בוצע" ובלי XL - canMarkAll / canExport. "הכל בוצע": ההרשאה מהשרת
//   (data.marks.canMarkAll, MARK_ALL_PERMISSION ב-lib/schedule/marks.js) גוברת; XL: ברירת המחדל settings.includeInternalNotes
//   = הנהלה ראשית / מנהלת סניף / מתכנת (INTERNAL_NOTES_ROLE_IDS ב-lib/schedule/index.js).

// ?date= מקבל גם מילת יחס (הקישורים "היום"/"מחר" בתפריט, lib/menu/buildMenuTree.js): מפוענחת כאן לפי "היום" הישראלי של
// השרת (data.today) ולא ברגע בניית התפריט - כך "היום" נכון גם אחרי חצות בלי טעינה מחדש (סקירה 2.10, C). רשימה סגורה
// (parseDateParam / resolveDateParam ב-hebrewCalendar.js, נבדקות ב-scripts/schedule-tests/dates.test.mjs).
const resolveDate = (date, clock) => resolveDateParam(date, clock && clock.today);

function readUrlState() {
  try {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('date');
    return { date: parseDateParam(d), branch: p.get('branch') || '' };
  } catch {
    return { date: null, branch: '' };
  }
}

function writeUrlState(date, branch) {
  try {
    const p = new URLSearchParams();
    if (date) p.set('date', date);
    if (branch) p.set('branch', branch);
    const qs = p.toString();
    window.history.replaceState(null, '', window.location.pathname + (qs ? '?' + qs : ''));
  } catch { /* history לא זמין - לא קריטי */ }
}

const ERROR_TEXT = {
  401: 'יש להתחבר מחדש כדי לצפות בלו״ז.',
  403: 'אין הרשאה לצפות בלו״ז היומי.',
};

// הטולטיפ של המערכת (.pl-tt, טולטיפ 1-6 בפלטה; #tt בעיצוב): ריחוף/מיקוד על [data-tip]. במעטפת החדשה המעטפת
// מטפלת בזה לכל התוכן; בלעדיה (מעטפת legacy / AppShell) הדף מטפל בעצמו - אותו דפוס כמו בדף בדיקת המלאי.
function usePageTooltip(rootRef, ttRef, shellHandlesHover) {
  useEffect(() => {
    const root = rootRef.current;
    const tt = ttRef.current;
    if (!root || !tt || shellHandlesHover) return undefined;
    let cur = null;
    let linked = null; // הרכיב שקיבל מאיתנו aria-describedby (קוראי מסך מקריאים את הטולטיפ; סקירה, NIT)
    const unlink = () => { if (linked) { linked.removeAttribute('aria-describedby'); linked = null; } };
    const hide = () => { tt.classList.remove('on'); cur = null; unlink(); };
    const show = (el) => {
      unlink();
      cur = el;
      tt.textContent = el.getAttribute('data-tip');
      if (tt.id && !el.hasAttribute('aria-describedby')) { el.setAttribute('aria-describedby', tt.id); linked = el; }
      tt.classList.add('on');
      const r = el.getBoundingClientRect();
      const w = tt.offsetWidth;
      const h = tt.offsetHeight;
      let x = r.left + r.width / 2 - w / 2;
      x = Math.max(10, Math.min(window.innerWidth - w - 10, x));
      let y = r.top - h - 10;
      if (y < 8) y = r.bottom + 10;
      tt.style.left = `${x}px`;
      tt.style.top = `${y}px`;
    };
    const over = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t !== cur) show(t); else if (!t && cur) hide(); };
    const out = (e) => { if (e.target.closest && e.target.closest('[data-tip]')) hide(); };
    const fin = (e) => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t && t.matches(':focus-visible')) show(t); };
    const key = (e) => { if (e.key === 'Escape' && cur) hide(); };
    root.addEventListener('mouseover', over);
    root.addEventListener('mouseout', out);
    root.addEventListener('focusin', fin);
    root.addEventListener('focusout', out);
    document.addEventListener('keydown', key);
    window.addEventListener('scroll', hide, { passive: true });
    return () => {
      root.removeEventListener('mouseover', over);
      root.removeEventListener('mouseout', out);
      root.removeEventListener('focusin', fin);
      root.removeEventListener('focusout', out);
      document.removeEventListener('keydown', key);
      window.removeEventListener('scroll', hide);
      unlink();
    };
  }, [rootRef, ttRef, shellHandlesHover]);
}

// הציר (fit בעיצוב, שורות 2154-2171): במסך רחב מתחיל בגובה האייקון של המקטע הראשון (--rail-off), ואם הוא גבוה
// מהמסך הוא נצמד עם top שלילי כך שתחתיתו נראית (--rail-top) - בלי גלילה פנימית. נמדד מחדש בכל שינוי תוכן/גודל.
function useRailFit(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(min-width:1024px)');
    let raf = 0;
    const fit = () => {
      raf = 0;
      const rail = root.querySelector('.lz-rail');
      const lay = root.querySelector('.lz-layout');
      const side = rail && rail.querySelector('.st-sidenav');
      if (!rail || !lay) return;
      if (!side || !mq.matches) { rail.style.removeProperty('--rail-off'); rail.style.removeProperty('--rail-top'); return; }
      const ic = root.querySelector('#stages .lz-sec .adm-hi');
      if (ic) rail.style.setProperty('--rail-off', Math.max(0, Math.round(ic.getBoundingClientRect().top - lay.getBoundingClientRect().top)) + 'px');
      else rail.style.removeProperty('--rail-off');
      const snav = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--gm-snav-h') || getComputedStyle(root).getPropertyValue('--snav-h'), 10) || 64;
      rail.style.setProperty('--rail-top', Math.min(snav + 12, Math.round(window.innerHeight - side.offsetHeight - 12)) + 'px');
    };
    const sched = () => { if (!raf) raf = window.requestAnimationFrame(fit); };
    const mo = new MutationObserver(sched);
    mo.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', sched);
    mq.addEventListener && mq.addEventListener('change', sched);
    fit();
    return () => { mo.disconnect(); window.removeEventListener('resize', sched); mq.removeEventListener && mq.removeEventListener('change', sched); if (raf) window.cancelAnimationFrame(raf); };
  }, [rootRef]);
}

export default function ScheduleDay({
  onScan,
  onExport, onDownload, onPrint, onSettings,
  canMarkAll, canExport,
}) {
  const [date, setDate] = useState(null); // null = "היום" לפי השרת (שעון ישראל)
  const [branch, setBranch] = useState('');
  const [filter, setFilter] = useState(null);
  const [updatedCount, setUpdatedCount] = useState(null); // מונה "הזמנות שעודכנו" - null עד שהמקטע נטען (טעינה עצלה)
  const [view, setView] = useState('rows');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  // "היום" לפי השרת (שעון ישראל) - נשמר גם כשהטעינה נכשלת, כדי שבורר התאריך ימשיך לעבוד;
  // localToday = גיבוי מהדפדפן (רק עד שיש תשובה ראשונה, מחושב אחרי הטעינה כדי לא ליצור הבדל ב-hydration)
  const [clock, setClock] = useState(null);
  const [localToday, setLocalToday] = useState(null);
  const reqId = useRef(0);
  const clockRef = useRef(null); // שעון השרת לקריאה בתוך ה-effect בלי להוסיף אותו לתלויות (לא טוענים מחדש על כל תשובה)
  const retried = useRef(false);
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const inA5Shell = useA5Shell();
  usePageTooltip(rootRef, ttRef, !!inA5Shell);
  useRailFit(rootRef);
  // סימון "בוצע" (עדכון אופטימי, החזרה לאחור בשגיאה, טוסט) - הלוגיקה ב-useStageMarks.js
  const refreshDay = useCallback(() => setTick((t) => t + 1), []);
  // ברקוד בלו״ז: חלונית הברקוד נפתחת מלחצן "בוצע" (שורה שחסר בה ברקוד), מ-409 needBarcodes ומסריקת קוד שלב. dataRef: ה-callback לא תלוי בנתונים.
  const dataRef = useRef(null);
  const lastScanOrder = useRef(null);
  const bcTargetRef = useRef(null);
  const [bcTarget, setBcTarget] = useState(null);
  const [scanQueue, setScanQueue] = useState([]);
  const [scanAsk, setScanAsk] = useState(null); // { stage, row } | { all, stage }
  const openBarcodes = useCallback((stage, row) => {
    lastScanOrder.current = { orderId: row.orderId, stageKey: stage.key };
    setBcTarget({ orderId: row.orderId, stageKey: stage.key, stageLabel: stage.label, customerName: (row.customer && row.customer.name) || '', dayKey: dataRef.current ? dataRef.current.date : null });
  }, []);
  const marks = useStageMarks({ data, setData, refresh: refreshDay, onNeedBarcodes: openBarcodes });
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { bcTargetRef.current = bcTarget; }, [bcTarget]);
  const marksUi = useMemo(() => ({ ...marks, openBarcodes }), [marks, openBarcodes]);
  const closeBarcodes = useCallback((changed) => { lastScanOrder.current = null; setBcTarget(null); setScanQueue([]); if (changed) refreshDay(); }, [refreshDay]);
  const patchBarcodeInfo = marks.patchBarcodeInfo;
  const onBarcodeProgress = useCallback((info) => {
    if (!info || !info.summary) return;
    const s = info.summary;
    patchBarcodeInfo(info.stageKey, info.orderId, { gate: info.gate, when: info.when, required: s.required, registered: s.registered, taken: s.taken, missing: s.missing, complete: s.complete, allRequiredTaken: !!s.requiredAllTaken });
  }, [patchBarcodeInfo]);
  const markReady = useCallback(async (target) => {
    const d = dataRef.current;
    const stage = d && d.stages.find((s) => s.key === target.stageKey);
    const row = stage && stage.items.find((r) => r.orderId === target.orderId);
    if (!stage || !row) return false;
    return marks.onMarkDone(stage, row, { done: true });
  }, [marks]);
  const consumeScan = useCallback(() => setScanQueue((q) => q.slice(1)), []);
  const say = marks.say;
  const handleScan = useCallback((raw) => {
    const d = dataRef.current;
    const c = classifyScan(raw);
    if (c.kind === 'none') { say('הקוד לא מזוהה', c.reason === 'empty' ? 'לא נסרק קוד' : 'סרקו קוד הזמנה מהדף (למשל PRP-40113) או ברקוד שמלה', 'warn'); return; }
    if (c.kind === 'dress') {
      // ברקוד שמלה דורש שהזנת ברקוד בלו״ז מופעלת בהגדרות (settings.barcodeEntry נשלח רק אז); אחרת הודעה ברורה ולא רישום
      if (!(d && d.settings && d.settings.barcodeEntry)) { say('הזנת ברקוד אינה מופעלת בהגדרות', 'בגמ"ח הזה אפשר לסרוק כאן רק קודי שלב מהדף המודפס (למשל PRP-40113)', 'warn'); return; }
      if (bcTargetRef.current) { setScanQueue((q) => [...q, c.barcode]); return; }
      const last = lastScanOrder.current;
      const stage = last && d && d.stages.find((s) => s.key === last.stageKey);
      const row = stage && stage.items.find((r) => r.orderId === last.orderId);
      if (stage && row && row.barcodeInfo && !row.barcodeInfo.complete) { openBarcodes(stage, row); setScanQueue([c.barcode]); return; }
      say('אין הזמנה פעילה לברקוד', 'סרקו קודם את קוד ההזמנה מהדף המודפס (למשל PRP-40113), או לחצו "בוצע" בשורה', 'warn');
      return;
    }
    if (!d) return;
    if (c.kind === 'stage-day') {
      const stage = d.stages.find((s) => s.key === c.stageKey);
      if (c.dayKey !== d.date) { say('קוד של יום אחר', 'הקוד שנסרק שייך ליום ' + c.dayKey + ' - עברו ליום הזה בבורר התאריך', 'warn'); return; }
      if (!stage || stage.infoOnly) { say('השלב לא מוצג', 'אין שלב כזה ביום הזה', 'warn'); return; }
      if (!marks.canMarkAll) { say('אין הרשאה', 'אין הרשאה ל"הכל בוצע" - אפשר לסמן שורה-שורה', 'warn'); return; }
      setScanAsk({ all: true, stage });
      return;
    }
    const decided = decideStageScan(d, c.stageKey, c.orderId);
    if (decided.action === 'not-shown') { say('ההזמנה לא נמצאה', 'הזמנה #' + c.orderId + ' לא מופיעה בשלב הזה ביום המוצג', 'warn'); return; }
    if (decided.action === 'info-only') { say('שלב לידיעה בלבד', 'אין "בוצע" בשלב הזה', 'warn'); return; }
    if (!marks.canMark) { say('אין הרשאה לסמן', 'אין הרשאה לסמן "בוצע" - פנו להנהלה', 'warn'); return; }
    lastScanOrder.current = { orderId: c.orderId, stageKey: c.stageKey };
    if (decided.action === 'already') { say('כבר בוצע', decided.stage.label + ' · #' + c.orderId, 'warn'); return; }
    if (decided.action === 'barcodes') { openBarcodes(decided.stage, decided.row); return; }
    setScanAsk({ stage: decided.stage, row: decided.row });
  }, [say, marks.canMarkAll, marks.canMark, openBarcodes]);

  // ?scan=<קוד> (למשל מהחיפוש המהיר): אותה פעולה כמו סריקה בשורת הברקוד, אחרי שהיום נטען; הפרמטר מוסר מהכתובת
  const pendingScan = useRef(null);
  useEffect(() => {
    try { const s = new URLSearchParams(window.location.search).get('scan'); if (s) pendingScan.current = s; } catch { /* אין כתובת */ }
  }, []);
  useEffect(() => {
    if (!data || loading || !pendingScan.current) return;
    const code = pendingScan.current;
    pendingScan.current = null;
    try {
      const p = new URLSearchParams(window.location.search);
      p.delete('scan');
      window.history.replaceState(null, '', window.location.pathname + (p.toString() ? '?' + p.toString() : ''));
    } catch { /* לא קריטי */ }
    handleScan(code); // החלטת הבעלים 12.10.2026 (O11): קודי השלב פעילים בכל גמ"ח, גם בלי הגדרת ברקוד
  }, [data, loading, handleScan]);
  // שורש הדף לחלונות "בטוח?" (LzPortal.js) - כמו L.modal בעיצוב: scrim אח של .app ולא בתוך השורה
  const [portalRoot, setPortalRoot] = useState(null);
  useEffect(() => { setPortalRoot(rootRef.current); }, []);

  // מצב התחלתי מהכתובת (?date=&branch=) ומהעדפת התצוגה (שורות/טבלה) של המשתמשת בדפדפן הזה
  useEffect(() => {
    const u = readUrlState();
    if (u.date) setDate(u.date);
    if (u.branch) setBranch(u.branch);
    try {
      if (localStorage.getItem('lz_view') === 'table') setView('table');
    } catch { /* אחסון חסום - ברירת מחדל שורות */ }
    setLocalToday(israelTodayKey());
    setReady(true);
  }, []);

  // לחיצה על "היום"/"מחר" בתפריט כשכבר נמצאים בדף: Next מחליף את הכתובת (?date=today|tomorrow) אבל הרכיב נשאר טעון,
  // כך שהמצב ההתחלתי לא נקרא שוב - עוקבים אחרי ?date= (useSearchParams; Next מסנכרן אותו גם עם replaceState של הדף
  // עצמו, ואז הערך שווה למצב ואין שינוי). dateRef ולא date בתלויות: אחרת שינוי תאריך מהבורר, לפני שהכתובת מסונכרנת,
  // היה מחזיר את התאריך הישן.
  const searchParams = useSearchParams();
  const urlDate = searchParams ? searchParams.get('date') : null;
  const dateRef = useRef(null);
  useEffect(() => { dateRef.current = date; }, [date]);
  useEffect(() => {
    if (!ready) return;
    const d = parseDateParam(urlDate);
    if (d === dateRef.current) return;
    setDate(d);
    setFilter(null);
  }, [ready, urlDate]);

  useEffect(() => {
    if (!ready) return undefined;
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    // "היום" (מילת יחס) בלי שעון מהשרת: לא שולחים תאריך - השרת עונה ביום הישראלי שלו (המקור)
    const key = date === 'today' && !clockRef.current ? null : resolveDate(date, clockRef.current);
    if (key) qs.set('date', key);
    if (branch) qs.set('branch', branch);
    fetch('/api/schedule' + (qs.toString() ? '?' + qs.toString() : ''), { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        if (id !== reqId.current) return;
        if (!res.ok) {
          // אחרי שגיאה לא משאירים את נתוני היום הקודם (ציר ומונים) - הם היו מטעים
          setData(null);
          setError({ status: res.status, message: ERROR_TEXT[res.status] || (body && body.error) || 'שגיאה בטעינת הלו״ז היומי' });
          setLoading(false);
          return;
        }
        setData(body);
        if (body && body.today) {
          setClock({ today: body.today, tomorrow: body.tomorrow });
          clockRef.current = { today: body.today, tomorrow: body.tomorrow };
          // מילת יחס שפוענחה לפי שעון הדפדפן ויצאה שונה מהיום הישראלי של השרת (למשל שעון מחשב שגוי) - טעינה אחת מחדש
          if (isToken(date) && body.date !== resolveDate(date, clockRef.current) && !retried.current) { retried.current = true; setTick((t) => t + 1); }
        }
        setLoading(false);
      })
      .catch((e) => {
        if (e && e.name === 'AbortError') return;
        if (id !== reqId.current) return;
        setData(null);
        setError({ status: 0, message: 'לא ניתן לטעון את הלו״ז כרגע. בדקו את החיבור ונסו שוב.' });
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [ready, date, branch, tick]);

  // רשימת הסניפים (branch_list) מגיעה בתשובת /api/schedule (settings.branches) - רק כשהארגון עובד עם סניפים;
  // אין קריאה נפרדת ל-/api/settings רק בשבילה.
  const branchesEnabled = !!(data && data.settings && data.settings.branchesEnabled);
  const branches = (branchesEnabled && Array.isArray(data.settings.branches)) ? data.settings.branches : [];
  // הנהלה (JDG-04): "הכל בוצע" ו-XL. ברירת המחדל מהשרת; prop מפורש גובר.
  const mgmt = !!(data && data.settings && data.settings.includeInternalNotes);
  // "הכל בוצע": ההרשאה מהשרת (marks.canMarkAll); prop מפורש יכול רק לצמצם
  const allowMarkAll = canMarkAll === undefined ? marks.canMarkAll : (canMarkAll && marks.canMarkAll);
  const allowExport = canExport === undefined ? mgmt : canExport;

  const changeDate = useCallback((key) => {
    setDate(key);
    setFilter(null);
    writeUrlState(key, branch);
  }, [branch]);

  const changeBranch = useCallback((b) => {
    setBranch(b);
    writeUrlState(date, b);
  }, [date]);

  const changeView = useCallback((v) => {
    setView(v);
    try { localStorage.setItem('lz_view', v); } catch { /* לא קריטי */ }
  }, []);

  const stages = useMemo(() => {
    if (!data) return [];
    const byKey = {};
    data.stages.forEach((s) => { byKey[s.key] = s; });
    return STAGE_ORDER.map((k) => byKey[k]).filter((s) => s && s.enabled);
  }, [data]);

  const visible = stages.filter((s) => s.counts.total > 0 && (!filter || s.key === filter));
  const allTotal = stages.reduce((a, s) => a + s.counts.total, 0);
  // בורר התאריך חייב להישאר זמין גם בשגיאה (למשל ?date= לא תקין) כדי שיהיה אפשר לבחור יום אחר
  const pickerDate = (data && data.date) || resolveDate(date, clock) || localToday;
  const pickerToday = (clock && clock.today) || localToday;
  const pickerTomorrow = (clock && clock.tomorrow) || (pickerToday ? addDays(pickerToday, 1) : null);
  // אשף ההדפסות/ההורדות: { mode:'print'|'download', format:'xlsx'|'pdf', initialTab:stageKey|null } | null
  const [wiz, setWiz] = useState(null);
  const closeWiz = useCallback(() => setWiz(null), []);
  // לחצני הכותרת (בלי stageKey) = האשף המלא; לחצני המקטע (עם stageKey) = חלונית מהירה לדפי אותו שלב בלבד
  // הפעולה נקבעת כאן ולא באשף (אין בו בורר הדפסה/הורדה/קובץ): הדפסה = הדפסה, הורדה = PDF, XL = Excel (לחצן ה-XL מוסתר לעובדת, JDG-04)
  const openPrint = useCallback(({ stageKey } = {}) => setWiz({ mode: 'print', format: 'xlsx', initialTab: stageKey || null, quick: !!stageKey }), []);
  const openDownload = useCallback(({ stageKey } = {}) => setWiz({ mode: 'download', format: 'pdf', initialTab: stageKey || null, quick: !!stageKey }), []);
  const openExport = useCallback(({ stageKey } = {}) => setWiz({ mode: 'download', format: 'xlsx', initialTab: stageKey || null, quick: !!stageKey }), []);
  const tools = { onExport: onExport || openExport, onDownload: onDownload || openDownload, onPrint: onPrint || openPrint, canExport: allowExport };

  return (
    <LzPortalRoot.Provider value={portalRoot}>
    <div className="gm-ds gm-lz home-bg dlg-dark" ref={rootRef}>
      <LocalSprite />
      <div className="app lz-app">
        <div className="topbar">
          <div className="ttl">
            <h1 className="pg-ttl"><bdi>לוח זמנים</bdi></h1>
            {pickerDate && pickerToday ? <HebrewDayPicker date={pickerDate} today={pickerToday} tomorrow={pickerTomorrow} onChange={changeDate} /> : null}
          </div>
          <PageTools onExport={tools.onExport} onDownload={tools.onDownload} onPrint={tools.onPrint} onSettings={onSettings} canExport={allowExport} canSettings={mgmt} />
        </div>

        <div className="lz-layout">
          <StageRail data={data} loading={loading} filter={filter} onFilter={setFilter} onScan={onScan || handleScan} updatedCount={updatedCount} />
          <div className="lz-main">
            <div className="hres-bar lz-hb" id="hb">
              <div className={'vsw' + (view === 'table' ? ' t' : '')} id="vsw" role="group" aria-label="מצב תצוגה">
                <span className="vknob" aria-hidden="true" />
                <button type="button" className={'vopt' + (view === 'rows' ? ' on' : '')} aria-label="תצוגת שורות" aria-pressed={view === 'rows'} data-tip="שורות" onClick={() => changeView('rows')}>
                  <ScheduleIcon name="rows" />
                </button>
                <button type="button" className={'vopt' + (view === 'table' ? ' on' : '')} aria-label="תצוגת טבלה" aria-pressed={view === 'table'} data-tip="טבלה" onClick={() => changeView('table')}>
                  <ScheduleIcon name="table" />
                </button>
              </div>
              {/* שבב "יום לא עובד" (החלטת הבעלים 4.10.2026, SCH-CHIP-NWD = א'): ליד המתג, תגית 14 (chip gray) כמו
                  בתצוגה שאושרה. הקביעה מהשרת בלבד - data.nonWorkingDay מהכלל האחיד ב-lib/businessDays.js (שישי, שבת, חג,
                  ערב חג, ימים שהבעלים סימן; יום שהבעלים פתח - לא). הדף לא מחשב ימים בעצמו. */}
              {!loading && data && data.nonWorkingDay ? <span className="chip gray lz-offday">יום לא עובד</span> : null}
              {branchesEnabled && branches.length ? (
                <div className="lz-dtools">
                  <BranchSeg branches={branches} value={branch} onChange={changeBranch} />
                </div>
              ) : null}
            </div>

            {data && data.truncated ? (
              <div className="lz-banner" role="alert">
                <ScheduleIcon name="alert" />
                <span>נטענו רק חלק מההזמנות של התקופה, ייתכן שחלק מהשורות חסרות. כדאי לצמצם לפי סניף או לפנות למנהל המערכת.</span>
              </div>
            ) : null}

            <div id="stages">
              {error ? (
                <div className="empty" role="alert">
                  <ScheduleIcon name={error.status === 403 || error.status === 401 ? 'shield' : 'alert'} className="lg" />
                  <div className="lz-empty-t">{error.message}</div>
                  {error.status !== 403 && error.status !== 401 ? (
                    <button type="button" className="btn lz-retry" onClick={() => setTick((t) => t + 1)}>
                      <ScheduleIcon name="refresh" className="sm" />נסו שוב
                    </button>
                  ) : null}
                </div>
              ) : loading || !data ? (
                <ScheduleSkeleton />
              ) : (
                <>
                  {visible.length ? (
                    visible.map((s) => (
                      <StageSection
                        key={s.key}
                        stage={s}
                        view={view}
                        marks={marksUi}
                        canMarkAll={allowMarkAll}
                        dayLabel={data.dateHebrew}
                        {...tools}
                      />
                    ))
                  ) : filter === 'updated' ? null : (
                    <div className="empty" role="status">
                      <ScheduleIcon name="cal" className="lg" />
                      <div className="lz-empty-t">{allTotal === 0 ? 'אין פעולות מתוכננות ביום הזה' : 'אין פריטים שתואמים לסינון'}</div>
                    </div>
                  )}
                  <UpdatedSection key={data.date + '|' + branch} date={data.date} branch={branch} onCount={setUpdatedCount} hidden={!!filter && filter !== 'updated'} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* הטוסט אח של .app (#toast בעיצוב, שורה 1654) */}
      <MarkToast toast={marks.toast} onClose={marks.dismissToast} />
      <BarcodeDialog target={bcTarget} onClose={closeBarcodes} onProgress={onBarcodeProgress} onMarkReady={markReady} scanQueue={scanQueue} onScanConsumed={consumeScan} />
      {scanAsk && !scanAsk.all ? (
        <ConfirmDialog
          open
          icon="check"
          heading={'בטוח שהשלב "' + scanAsk.stage.label + '" בוצע?'}
          sub={'הזמנה #' + scanAsk.row.orderId + (scanAsk.row.customer && scanAsk.row.customer.name ? ' · ' + scanAsk.row.customer.name : '')}
          effect={confirmEffect(scanAsk.stage.key, { done: true, outcome: 'ok' }, scanAsk.row)}
          body={<DetailRows stage={{ key: scanAsk.stage.key, label: scanAsk.stage.label, icon: (STAGE_META[scanAsk.stage.key] || STAGE_META.order).icon }} row={scanAsk.row} dayLabel={data && data.dateHebrew} />}
          yes="כן, סמן כבוצע"
          onYes={() => { const a = scanAsk; setScanAsk(null); marks.onMarkDone(a.stage, a.row, { done: true, ...(a.stage.key === 'manret' || a.stage.key === 'dback' ? { outcome: 'ok' } : {}) }); }}
          onNo={() => setScanAsk(null)}
        />
      ) : null}
      {scanAsk && scanAsk.all ? (
        <ConfirmDialog
          open
          icon="check"
          heading={'בטוח שכל "' + scanAsk.stage.label + '" בוצע?'}
          sub={scanAsk.stage.items.filter((r) => r.done !== true).length + ' פריטים' + (data && data.dateHebrew ? ' ב' + data.dateHebrew : '') + ' יסומנו כבוצעו'}
          effect={confirmEffect(scanAsk.stage.key, { done: true, outcome: 'ok', all: true })}
          yes="כן, סמן הכל כבוצע"
          onYes={() => { const a = scanAsk; setScanAsk(null); marks.onMarkAll(a.stage); }}
          onNo={() => setScanAsk(null)}
        />
      ) : null}
      <ScrollTopButton />
      {/* האשף בתוך .gm-ds.gm-lz (ה-CSS שלו תחום לשם - print/PrintWizard.css); היום והסניף = מה שמוצג בדף */}
      {wiz ? (
        <PrintWizard
          key={(wiz.initialTab || 'all') + wiz.mode + wiz.format + (wiz.quick ? 'q' : '')}
          quick={!!wiz.quick}
          mode={wiz.mode}
          format={wiz.format}
          initialTab={wiz.initialTab}
          canExport={allowExport}
          date={(data && data.date) || pickerDate}
          branch={branch}
          stageData={data}
          onClose={closeWiz}
        />
      ) : null}
      <div className="pl-tt" role="tooltip" id="lz-tt" ref={ttRef} />
    </div>
    </LzPortalRoot.Provider>
  );
}

// סינון סניף (בורר 40/41: pill.seg) - סינון תצוגה בלבד, לא אכיפה (החלטה B2: אין שיוך עובדת לסניף). מוצג רק בארגון
// שעובד עם סניפים (branches_enabled). אין לו מקבילה בעיצוב - לאישור הבעלים (docs/ui-fidelity-schedule.md).
function BranchSeg({ branches, value, onChange }) {
  const opts = [{ v: '', label: 'כל הסניפים' }, ...branches.map((b) => ({ v: b, label: b }))];
  const idx = Math.max(0, opts.findIndex((o) => o.v === value));
  return (
    <div className="seg pill lz-branches" role="radiogroup" aria-label="סינון לפי סניף" style={{ '--n': opts.length, '--i': idx }}>
      <span className="pth" aria-hidden="true" />
      {opts.map((o) => (
        <button key={o.v || 'all'} type="button" role="radio" aria-checked={o.v === value} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
