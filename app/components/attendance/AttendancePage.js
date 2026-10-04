'use client';

// "סיכום נוכחות" — עיצוב מאושר: תצוגות-עיצוב/סיכום-נוכחות.html (4.10.2026, "מעולה ומוכן"), רכיבי פלטה בלבד, בתוך .gm-ds.gm-at
// (כמו הלו״ז, בדיקת המלאי והפרופיל). מחליף את לשונית "נוכחות" ב-/employees ואת הדוח החודשי /employees/report (AT-02), ומשמש
// גם את "השעות שלי" (/my-hours). שלוש תצוגות (go() בעיצוב):
//   month  - הנהלה: טבלת סיכום חודשית לכל העובדים (שם / ס״ה שעות / כמות ימים / תקלות / ס״ה / נסיעות / פעולות), מיון, שורת סה״כ,
//            פתיחת שורה = משמרות העובד. "השעות שלי": הכרטיס של העובד המחובר בלבד, בלי שכר.
//   byemp  - "לפי עובד": שורה לכל חודש מכל הנתונים (AT-14), 20 בעמוד, שורת סה״כ לכל התקופה; עיפרון / לחיצה = עריכת החודש (AT-15).
//   emp    - "נוכחות עובד": עריכת השורות של עובד אחד לחודש אחד (AttendanceEdit.js).
// הנתונים: GET /api/attendance-sheet (lib/attendance/server.js); ההרשאות נאכפות בשרת (lib/attendance/access.js) - הדף רק מציג
// את מה שמותר: XL ושכר להנהלה בלבד (JDG-04 / AT-10), עובד רגיל רואה ועורך רק את עצמו (AT-12 / AT-13).
// החלטות הבעלים (AT-01..AT-16) והקבועים שלהן: lib/attendance/summary.js; פירוט: scratch/attendance-build/NOTES.md.
import '@/design-system/components.css';
import './attendance.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeSprite } from '../home/HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import PageVariantToggle from '../variant/PageVariantToggle';
import { Ic, ToolButtons, Combo, SortTh, decorateButtons } from './parts';
import { hLong as hFullDay } from '@/lib/schedule/print/format';
import AttendanceEdit from './AttendanceEdit';
import AttendanceWizard, { PreviewOverlay } from './AttendanceWizard';
import { ConfirmDialog, HistoryDialog, Toast, TOAST_MS } from './AttendanceDialogs';
import {
  MONTHS, defaultPeriod, israelToday, isSameMonth, shiftMonth, monthLabel, hebSpan, hm, money, monthRows, sortRows, sumRows,
  paginate, BYEMP_PAGE_SIZE, initials, hDayShort, weekdayShort, israelTime, isIncomplete, aggregate,
} from '@/lib/attendance/summary';

async function getJson(url, signal) {
  const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal });
  const d = await r.json().catch(() => null);
  if (!r.ok) { const e = new Error((d && d.error) || 'שגיאה בטעינת הנתונים'); e.status = r.status; throw e; }
  return d;
}

const COLS = [['name', 'שם'], ['minutes', 'ס״ה שעות'], ['days', 'כמות ימים'], ['issues', 'תקלות'], ['pay', 'ס״ה'], ['travels', 'נסיעות']];
const Iss = ({ n }) => (n ? <span className="at-iss">{n}<Ic id="alert" /></span> : <span className="at-none">-</span>);
const Money = ({ v }) => <span className="at-money">{money(v)}</span>;
const Skel = ({ n, cols = 7 }) => <tbody>{Array.from({ length: n }, (_, i) => <tr key={i} className="at-skel"><td colSpan={cols}><i /></td></tr>)}</tbody>;

/** טבלת המשמרות שבפירוט השורה / בכרטיס "השעות שלי" (shiftsTable בעיצוב). AT-06: שעות h:mm. */
function ShiftsTable({ shifts, wages }) {
  return (
    <table className="at-sh">
      <thead><tr><th>תאריך</th><th>כניסה</th><th>יציאה</th><th>סה״כ שעות</th>{wages ? <th>סה״כ לתשלום</th> : null}</tr></thead>
      <tbody>
        {shifts.map((s) => {
          const exit = israelTime(s.exitTime);
          return (
            <tr key={s.id} className={isIncomplete(s) ? 'inc' : undefined}>
              <td><b>{hDayShort(s.dayKey)}</b><small>{weekdayShort(s.dayKey)}</small></td>
              <td className="num">{israelTime(s.entryTime) || '-'}</td>
              <td className={'num' + (exit ? '' : ' miss')}>{exit || 'חסר'}</td>
              <td className="num">{s.minutes ? hm(s.minutes) : '-'}</td>
              {wages ? <td className="num"><span className="num">{money(s.pay)}</span></td> : null}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/**
 * mode: 'manager' (/employees/attendance, /employees/<id>/attendance - השער של /employees) | 'self' (/my-hours).
 * initial: { view, empId, y, m } - מצב הפתיחה (מהנתיב / מה-query).
 */
export default function AttendancePage({ mode = 'manager', initial = {} }) {
  const self = mode === 'self';
  const router = useRouter();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  usePageTooltip(rootRef, ttRef, false);
  // data-ico / טולטיפ ללחצני אייקון / ia-ov - כמו tipify() + prep() בעיצוב (parts.js): על כל שינוי בעץ (גם בחלונות ובאשף, שמתרנדרים לבד)
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    let raf = 0;
    const run = () => { raf = 0; decorateButtons(root); };
    run();
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(run); });
    mo.observe(root, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, []);

  const today = useMemo(() => israelToday(), []);
  const start = useMemo(() => (Number.isInteger(initial.y) && Number.isInteger(initial.m) ? { y: initial.y, m: initial.m } : defaultPeriod()), [initial.y, initial.m]);
  const [view, setView] = useState(initial.view === 'emp' || initial.view === 'byemp' ? initial.view : 'month');
  const [back, setBack] = useState('month');
  const [per, setPer] = useState(start);
  const [empId, setEmpId] = useState(initial.empId || null);
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [open, setOpen] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [showDel, setShowDel] = useState(false);
  const [rev, setRev] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [unauth, setUnauth] = useState(false);
  const [monthD, setMonthD] = useState({ key: '', status: 'loading', data: null, error: null });
  const [byD, setByD] = useState({ key: '', status: 'loading', data: null, error: null });
  const [empD, setEmpD] = useState({ key: '', status: 'loading', data: null, error: null });
  const [empList, setEmpList] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [history, setHistory] = useState(null);
  const [wiz, setWiz] = useState(null);
  const [preview, setPreview] = useState(null);
  const toastTimer = useRef(null);

  const isMgr = !self && !!(viewer && viewer.isManager);
  const own = self || !isMgr;

  const say = useCallback((title, text = '', icon = 'check') => {
    setToast({ title, text, icon, n: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const confirm = useCallback((o) => new Promise((resolve) => setConfirmState({ ...o, resolve })), []);
  const confirmDone = (v) => { const c = confirmState; setConfirmState(null); if (c) c.resolve(v); };

  const fail = (setter, key) => (e) => {
    if (e && e.name === 'AbortError') return;
    if (e && e.status === 401) setUnauth(true);
    setter({ key, status: 'error', data: null, error: (e && e.message) || 'שגיאה' });
  };

  // ----- טעינת הנתונים לפי התצוגה -----
  const monthKey = `${self ? 'me' : 'all'}|${per.y}-${per.m}|${rev}`;
  useEffect(() => {
    if (view !== 'month') return undefined;
    const ctrl = new AbortController();
    setMonthD((d) => (d.key === monthKey ? d : { key: monthKey, status: 'loading', data: null, error: null }));
    const url = self ? `/api/attendance-sheet?scope=employee&y=${per.y}&m=${per.m}` : `/api/attendance-sheet?scope=month&y=${per.y}&m=${per.m}`;
    getJson(url, ctrl.signal).then((d) => { setViewer(d.viewer); setMonthD({ key: monthKey, status: 'ok', data: d, error: null }); }).catch(fail(setMonthD, monthKey));
    return () => ctrl.abort();
  }, [view, monthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // הנהלה בלי עובד נבחר ("לפי עובד" / עריכה): רשימת העובדים, והראשון בה
  useEffect(() => {
    if (self || view === 'month' || empList) return undefined;
    const ctrl = new AbortController();
    getJson('/api/attendance-sheet?scope=employees', ctrl.signal).then((d) => {
      setViewer(d.viewer);
      setEmpList(d.employees || []);
      if (!empId) {
        const first = (d.employees || []).find((e) => e.isActive) || (d.employees || [])[0];
        if (first) setEmpId(first.id);
      }
    }).catch((e) => { if (e && e.status === 401) setUnauth(true); });
    return () => ctrl.abort();
  }, [self, view, empList, empId]);

  const byKey = `${self ? 'me' : empId}|${rev}`;
  useEffect(() => {
    if (view !== 'byemp' || (!self && !empId)) return undefined;
    const ctrl = new AbortController();
    setByD((d) => (d.key === byKey ? d : { key: byKey, status: 'loading', data: null, error: null }));
    getJson('/api/attendance-sheet?scope=months' + (self ? '' : '&emp=' + encodeURIComponent(empId)), ctrl.signal)
      .then((d) => { setViewer(d.viewer); setByD({ key: byKey, status: 'ok', data: d, error: null }); }).catch(fail(setByD, byKey));
    return () => ctrl.abort();
  }, [view, byKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const empKey = `${self ? 'me' : empId}|${per.y}-${per.m}|${showDel ? 1 : 0}|${rev}`;
  useEffect(() => {
    if (view !== 'emp' || (!self && !empId)) return undefined;
    const ctrl = new AbortController();
    // אותו עובד ואותו חודש (רק "הצג מחוקות" / רענון אחרי שמירה): השורות הקיימות נשארות עד שהחדשות מגיעות; אחרת שלד טעינה
    const same = (a, b) => a.split('|').slice(0, 2).join('|') === b.split('|').slice(0, 2).join('|');
    setEmpD((d) => (d.key === empKey ? d : { key: empKey, status: 'loading', data: d.data && same(d.key, empKey) ? d.data : null, error: null }));
    getJson(`/api/attendance-sheet?scope=employee&y=${per.y}&m=${per.m}${showDel ? '&deleted=1' : ''}${self ? '' : '&emp=' + encodeURIComponent(empId)}`, ctrl.signal)
      .then((d) => { setViewer(d.viewer); setEmpD({ key: empKey, status: 'ok', data: d, error: null }); }).catch(fail(setEmpD, empKey));
    return () => ctrl.abort();
  }, [view, empKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- ניווט בין התצוגות (go() בעיצוב) -----
  const go = (v, o = {}) => {
    if (v === 'emp' || v === 'byemp') setBack(o.back || (view === 'emp' ? back : view));
    if (o.empId) setEmpId(o.empId);
    if (o.y !== undefined) setPer({ y: o.y, m: o.m });
    if (v === 'byemp' && (o.empId || view !== 'byemp')) setPage(1);
    setShowDel(false);
    setOpen(new Set());
    setView(v);
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  };
  const setMonth = (p) => { setPer(p); setOpen(new Set()); };
  const onBack = () => {
    if (view === 'emp') go(back === 'byemp' ? 'byemp' : 'month');
    else if (view === 'byemp') go('month');
    else if (self) router.back();
    else router.push('/employees');
  };
  const reload = () => setRev((r) => r + 1);

  // ----- נתונים מעובדים -----
  const rows = useMemo(() => (view === 'month' && !self && monthD.data ? monthRows(monthD.data.employees) : []), [view, self, monthD.data]);
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const T = useMemo(() => sumRows(rows), [rows]);
  const meShifts = self && monthD.data ? (monthD.data.shifts || []) : [];
  const meAgg = aggregate(meShifts);
  const empInfo = (view === 'byemp' ? byD.data && byD.data.employee : empD.data && empD.data.employee) || (empList || []).find((e) => e.id === empId) || null;
  const months = (byD.data && byD.data.months) || [];
  const paged = paginate(months, page, BYEMP_PAGE_SIZE);
  const MT = sumRows(months);
  const empShifts = (empD.data && empD.data.shifts) || [];

  const loading = view === 'month' ? monthD.status === 'loading' : view === 'byemp' ? byD.status === 'loading' : empD.status === 'loading';
  const noData = view === 'month' ? (self ? !meAgg.shiftCount : !rows.length) : view === 'byemp' ? !months.length : !aggregate(empShifts).shiftCount;
  const disTools = loading || noData;
  const isCur = isSameMonth(per, today);

  // ----- האשף / החלונית המהירה -----
  const openWiz = (wmode, wEmp, o = {}) => {
    const p = o.ym || per;
    setWiz({ mode: wmode, empId: wEmp || null, type: o.type || 'full', y: p.y, m: p.m, full: !!o.full });
  };
  const meInfo = self && monthD.data ? monthD.data.employee : null;

  // ----- כותרת -----
  const h1 = view === 'emp' ? 'נוכחות עובד' : self ? 'השעות שלי' : 'סיכום נוכחות';
  const nm = empInfo ? empInfo.name : '';
  const subT = view === 'emp' ? (nm ? nm + ' · ' : '') + monthLabel(per.y, per.m)
    : view === 'byemp' ? (nm ? nm + ' · ' : '') + 'כל החודשים'
      : self ? 'המשמרות והשעות שלך לפי חודש' : 'ריכוז שעות ומשמרות של כל העובדים לפי חודש';

  const years = useMemo(() => {
    const ys = [0, 1, 2, 3, 4].map((i) => today.y - i);
    if (!ys.includes(per.y)) ys.push(per.y);
    return ys.sort((a, b) => b - a);
  }, [today.y, per.y]);
  const empOptions = useMemo(() => {
    const list = (empList || []).filter((e) => e.isActive || e.id === empId);
    if (empId && !list.some((e) => e.id === empId) && empInfo) list.unshift(empInfo);
    return list.map((e) => [e.id, e.name]);
  }, [empList, empId, empInfo]);

  // ----- סרגל הסינון (renderBar) -----
  const bar = (
    <div className="at-fbar" id="atBar">
      {view !== 'emp' ? (
        <div className="at-vw">
          <span className="lbl">תצוגה</span>
          <div className="seg pill at-vseg" role="radiogroup" aria-label="תצוגה" style={{ '--n': 2, '--i': view === 'byemp' ? 1 : 0 }}>
            <span className="pth" aria-hidden="true" />
            <button type="button" role="radio" data-view="month" className={view === 'month' ? 'on' : ''} aria-checked={view === 'month'} onClick={() => go('month')}>לפי חודש</button>
            <button type="button" role="radio" data-view="byemp" className={view === 'byemp' ? 'on' : ''} aria-checked={view === 'byemp'} onClick={() => go('byemp', { back: 'month' })}>לפי עובד</button>
          </div>
        </div>
      ) : null}
      {view !== 'byemp' ? (
        <>
          <button type="button" className="ibtn" id="mPrev" aria-label="חודש קודם" data-tip="חודש קודם" onClick={() => setMonth(shiftMonth(per.y, per.m, -1))}><Ic id="arrr" /></button>
          <div className="at-f"><span className="lbl">חודש</span><Combo id="month" label="חודש" value={per.m} options={MONTHS.map((n, i) => [i, n])} onChange={(v) => setMonth({ y: per.y, m: +v })} /></div>
          <div className="at-f yr"><span className="lbl">שנה</span><Combo id="year" label="שנה" className="yr" value={per.y} options={years.map((y) => [y, String(y)])} onChange={(v) => setMonth({ y: +v, m: per.m })} /></div>
          <button type="button" className="ibtn" id="mNext" aria-label="חודש הבא" data-tip="חודש הבא" onClick={() => setMonth(shiftMonth(per.y, per.m, 1))}><Ic id="arrl" /></button>
          {isCur ? null : <button type="button" className="btn tgl" id="mNow" onClick={() => setMonth({ y: today.y, m: today.m })}>החודש</button>}
        </>
      ) : null}
      {view !== 'month' && isMgr ? (
        <div className="at-f"><span className="lbl">עובד</span><Combo id="emp" label="עובד" className="emp" value={empId || ''} options={empOptions} onChange={(v) => { setEmpId(String(v)); setPage(1); }} /></div>
      ) : null}
      {view === 'byemp' ? (
        <div className="at-per"><b>{nm}</b><small>{months.length ? monthLabel(months[months.length - 1].y, months[months.length - 1].m) + ' – ' + monthLabel(months[0].y, months[0].m) : ''}</small></div>
      ) : (
        <div className="at-per"><b>{monthLabel(per.y, per.m)}</b><small>{hebSpan(per.y, per.m)}</small></div>
      )}
    </div>
  );

  // ----- גוף: תצוגת חודש (הנהלה) -----
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const bodyMgr = () => {
    let tb;
    if (monthD.status === 'loading') tb = <Skel n={5} />;
    else if (monthD.status === 'error' || !rows.length) {
      tb = <tbody><tr><td colSpan={7}><div className="at-empty"><Ic id="cal" /><div>{monthD.status === 'error' ? monthD.error : 'לא נמצאו נתוני נוכחות לחודש זה.'}</div></div></td></tr></tbody>;
    } else {
      tb = (
        <tbody>
          {sorted.map((r) => {
            const op = open.has(r.id);
            return [
              <tr key={r.id} className={'at-r' + (r.issues ? ' flag' : '') + (op ? ' open' : '')} data-id={r.id} tabIndex={0} aria-expanded={op}
                onClick={(e) => { if (e.target.closest('.at-rt')) return; toggle(r.id); }}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.id); } }}>
                <td className="at-nmc" data-l="שם"><div className="at-nm">
                  <button type="button" className="at-ex" aria-label={(op ? 'סגירת' : 'פתיחת') + ' המשמרות של ' + r.name} data-tip="משמרות"><Ic id="chev" /></button>
                  <span className="at-av" aria-hidden="true">{initials(r)}</span>
                  <div><b>{r.name}</b><small>{r.dept}</small></div>
                </div></td>
                <td className="c" data-l="ס״ה שעות">{hm(r.minutes)}</td>
                <td className="c" data-l="כמות ימים">{r.days}</td>
                <td className="c" data-l="תקלות"><Iss n={r.issues} /></td>
                <td className="c" data-l="ס״ה"><Money v={r.pay} /></td>
                <td className="c" data-l="נסיעות">{r.travels ? 'כן' : 'לא'}</td>
                <td className="c at-act" data-l="פעולות"><span className="at-rt">
                  <button type="button" className="ibtn at-open" aria-label={'עריכת נוכחות ' + r.name} data-tip="עריכת נוכחות העובד" onClick={() => go('emp', { empId: r.id, back: 'month' })}><Ic id="pencil" size="sm" /></button>
                  <ToolButtons canXl tips={['ייצוא העובד לאקסל', 'הורדת דוח העובד (PDF)', 'הדפסת דוח העובד']} onPick={(md) => openWiz(md, r.id)} />
                </span></td>
              </tr>,
              op ? (
                <tr key={r.id + '-d'} className="at-det"><td colSpan={7}><div className="at-dw">
                  <div className="at-dh">
                    <h3>דוח נוכחות עובד: {r.name}</h3>
                    <span className="chip gray"><Ic id="clock" size="sm" />{monthLabel(per.y, per.m)}</span>
                    {r.dept ? <span className="chip gray">מחלקה: {r.dept}</span> : null}
                    <button type="button" className="btn primary" onClick={() => go('emp', { empId: r.id, back: 'month' })}><Ic id="pencil" size="sm" />עריכת נוכחות</button>
                    <button type="button" className="btn" onClick={() => go('byemp', { empId: r.id, back: 'month' })}><Ic id="list" size="sm" />כל החודשים</button>
                    <button type="button" className="btn" onClick={() => router.push('/employees/' + encodeURIComponent(r.id))}><Ic id="user" size="sm" />כרטיס העובד</button>
                  </div>
                  <ShiftsTable shifts={r.shifts} wages />
                  <div className="at-sum">
                    <span>סה״כ משמרות:<strong>{r.shiftCount}</strong></span>
                    <span>סה״כ שעות:<strong>{hm(r.minutes)}</strong></span>
                    <span>סה״כ לתשלום:<strong className="g"><span className="num">{money(r.pay)}</span></strong></span>
                  </div>
                </div></td></tr>
              ) : null,
            ];
          })}
        </tbody>
      );
    }
    const done = monthD.status === 'ok' && rows.length > 0;
    return (
      <section className="card at-card" aria-labelledby="atCt">
        <div className="card-h"><div className="ico rose"><Ic id="clock" size="lg" /></div><h2 id="atCt">סיכום חודשי · {monthLabel(per.y, per.m)}</h2></div>
        <div className="tblw">
          <table className="rtbl at-tbl">
            <thead><tr>{COLS.map(([k, l]) => <SortTh key={k} k={k} label={l} sort={sort} onSort={setSort} center={k !== 'name'} />)}<th className="c">פעולות</th></tr></thead>
            {tb}
            {done ? (
              <tfoot><tr>
                <td className="at-nmc at-x" data-l="סה״כ">סה״כ</td>
                <td className="c" data-l="ס״ה שעות">{hm(T.minutes)}</td>
                <td className="c" data-l="כמות ימים">{T.days}</td>
                <td className="c" data-l="תקלות">{T.issues ? <span className="at-iss">{T.issues}<Ic id="alert" /></span> : '-'}</td>
                <td className="c" data-l="ס״ה"><Money v={T.pay} /></td>
                <td className="c at-x" /><td className="c at-x" />
              </tr></tfoot>
            ) : null}
          </table>
        </div>
        {done ? <div className="at-foot"><span>סה״כ שורות מוצגות: <b>{rows.length}</b></span></div> : null}
      </section>
    );
  };

  // ----- גוף: "השעות שלי" (bodyMe) -----
  const bodyMe = () => {
    const e = meInfo || { name: '', firstName: '', lastName: '', dept: '' };
    let inner;
    if (monthD.status === 'loading') inner = <div className="tblw"><table className="at-sh"><tbody>{[1, 2, 3, 4].map((i) => <tr key={i} className="at-skel"><td><i /></td></tr>)}</tbody></table></div>;
    else if (!meAgg.shiftCount) inner = <div className="tblw"><div className="at-empty"><Ic id="cal" /><div>{monthD.status === 'error' ? monthD.error : 'אין משמרות בחודש זה'}</div></div></div>;
    else inner = <div className="tblw"><ShiftsTable shifts={meShifts.filter((s) => !s.isDeleted)} wages={false} /></div>;
    return (
      <section className="card at-card at-me" aria-label="השעות שלי">
        <div className="at-big">
          <span className="at-av" aria-hidden="true">{initials(e)}</span>
          <div><h2 style={{ margin: 0, fontSize: 20 }}>{e.name}</h2>{e.dept ? <div className="faint">מחלקה: {e.dept}</div> : null}</div>
          <button type="button" className="btn primary at-edit" disabled={!meInfo} onClick={() => go('emp', { back: 'month' })}><Ic id="pencil" size="sm" />עריכת הנוכחות שלי</button>
          {meAgg.shiftCount ? (
            <div className="at-tot"><b>{hm(meAgg.minutes)}</b><small>סה״כ החודש (שעות) · {meAgg.shiftCount} משמרות{meAgg.issues ? ' · ' + meAgg.issues + ' תקלות' : ''}</small></div>
          ) : null}
        </div>
        {inner}
      </section>
    );
  };

  // ----- גוף: "לפי עובד" (bodyBy) -----
  const bodyBy = () => {
    const wages = isMgr;
    const cols = wages ? 7 : 5;
    let tb;
    if (byD.status === 'loading' || (!self && !empId)) tb = <Skel n={6} cols={cols} />;
    else if (byD.status === 'error' || !months.length) {
      tb = <tbody><tr><td colSpan={cols}><div className="at-empty"><Ic id="cal" /><div>{byD.status === 'error' ? byD.error : 'לא נמצאו נתוני נוכחות לעובד זה.'}</div></div></td></tr></tbody>;
    } else {
      tb = (
        <tbody>
          {paged.items.map((r) => {
            const ym = { y: r.y, m: r.m };
            const lbl = monthLabel(r.y, r.m);
            const openMonth = () => go('emp', { y: r.y, m: r.m, back: 'byemp' });
            return (
              <tr key={r.key} className={'at-r at-mrow' + (r.issues ? ' flag' : '')} data-ym={r.y + '-' + r.m} tabIndex={0} aria-label={'פתיחת נוכחות ' + lbl + ' לעריכה'}
                onClick={(e) => { if (e.target.closest('.at-rt')) return; openMonth(); }}
                onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openMonth(); } }}>
                <td className="at-nmc" data-l="חודש"><div className="at-nm"><span className="at-av" aria-hidden="true"><Ic id="cal" /></span><div><b>{lbl}</b><small>{hebSpan(r.y, r.m)}</small></div></div></td>
                <td className="c" data-l="ס״ה שעות">{hm(r.minutes)}</td>
                <td className="c" data-l="כמות ימים">{r.days}</td>
                <td className="c" data-l="תקלות"><Iss n={r.issues} /></td>
                {wages ? <><td className="c" data-l="ס״ה"><Money v={r.pay} /></td><td className="c" data-l="נסיעות">{r.travels ? 'כן' : 'לא'}</td></> : null}
                <td className="c at-act" data-l="פעולות"><span className="at-rt">
                  <button type="button" className="ibtn at-open" aria-label={'עריכת נוכחות ' + lbl} data-tip="עריכת נוכחות החודש" onClick={openMonth}><Ic id="pencil" size="sm" /></button>
                  <ToolButtons canXl={wages} tips={['ייצוא החודש לאקסל', 'הורדת דוח החודש (PDF)', 'הדפסת דוח החודש']} onPick={(md) => openWiz(md, self ? 'me' : empId, { ym })} />
                </span></td>
              </tr>
            );
          })}
        </tbody>
      );
    }
    const done = byD.status === 'ok' && months.length > 0;
    return (
      <section className="card at-card" aria-labelledby="atCt">
        <div className="card-h"><div className="ico rose"><Ic id="clock" size="lg" /></div><h2 id="atCt">סיכום לפי עובד · {nm}</h2>{empInfo && empInfo.dept ? <span className="chip gray at-n">{empInfo.dept}</span> : null}</div>
        <div className="tblw">
          <table className="rtbl at-tbl">
            <thead><tr><th>חודש</th><th className="c">ס״ה שעות</th><th className="c">כמות ימים</th><th className="c">תקלות</th>{wages ? <><th className="c">ס״ה</th><th className="c">נסיעות</th></> : null}<th className="c">פעולות</th></tr></thead>
            {tb}
            {done ? (
              <tfoot><tr>
                <td className="at-nmc at-x" data-l="סה״כ לכל התקופה">סה״כ לכל התקופה</td>
                <td className="c" data-l="ס״ה שעות">{hm(MT.minutes)}</td>
                <td className="c" data-l="כמות ימים">{MT.days}</td>
                <td className="c" data-l="תקלות">{MT.issues ? <span className="at-iss">{MT.issues}<Ic id="alert" /></span> : '-'}</td>
                {wages ? <><td className="c" data-l="ס״ה"><Money v={MT.pay} /></td><td className="c at-x" /></> : null}
                <td className="c at-x" />
              </tr></tfoot>
            ) : null}
          </table>
        </div>
        {done && paged.pages > 1 ? (
          <div className="at-pg" role="navigation" aria-label="דפדוף בין עמודים">
            <button type="button" className="ibtn" data-pg="-1" aria-label="עמוד קודם" data-tip="עמוד קודם" disabled={paged.page <= 1} onClick={() => setPage(paged.page - 1)}><Ic id="arrr" /></button>
            <span className="at-pgt" aria-live="polite">עמוד {paged.page} מתוך {paged.pages}</span>
            <button type="button" className="ibtn" data-pg="1" aria-label="עמוד הבא" data-tip="עמוד הבא" disabled={paged.page >= paged.pages} onClick={() => setPage(paged.page + 1)}><Ic id="arrl" /></button>
          </div>
        ) : null}
        {done ? <div className="at-foot"><span>סה״כ שורות מוצגות: <b>{months.length}</b></span></div> : null}
      </section>
    );
  };

  // ----- גוף: "נוכחות עובד" -----
  const bodyEmp = () => {
    if (!empInfo && empD.status !== 'error') {
      return <section className="card dfields at-card"><div className="tblw"><table className="at-sh"><tbody>{[1, 2, 3].map((i) => <tr key={i} className="at-skel"><td><i /></td></tr>)}</tbody></table></div></section>;
    }
    if (empD.status === 'error' && !empD.data) {
      return <section className="card at-card"><div className="at-empty"><Ic id="alert" /><div>{empD.error}</div></div></section>;
    }
    return (
      <AttendanceEdit
        key={(empInfo && empInfo.id) + '|' + per.y + '-' + per.m}
        employee={empInfo}
        period={per}
        isMgr={isMgr}
        shifts={empShifts}
        loading={empD.status === 'loading' && !empD.data}
        showDel={showDel}
        onShowDel={setShowDel}
        onChanged={reload}
        say={say}
        confirm={confirm}
        onHistory={(s) => setHistory(s ? { shiftId: s.id, label: hFullDay(s.dayKey) } : { shiftId: null, label: '' })}
        todayKey={today.key}
      />
    );
  };

  // ----- כלי הכותרת (render()) -----
  let tools = null;
  if (view === 'emp') {
    tools = <ToolButtons canXl={isMgr} disabled={disTools} tips={['ייצוא העובד לאקסל', 'הורדת דוח העובד (PDF)', 'הדפסת דוח העובד']} onPick={(md) => openWiz(md, self ? 'me' : empId)} />;
  } else if (view === 'byemp') {
    tools = <ToolButtons canXl={isMgr} disabled={disTools || (!self && !empId)} tips={['ייצוא כל החודשים לאקסל', 'הורדת דוח כל החודשים (PDF)', 'הדפסת דוח כל החודשים']} onPick={(md) => openWiz(md, self ? 'me' : empId, { type: 'byemp', full: isMgr })} />;
  } else {
    tools = <ToolButtons canXl={isMgr} disabled={disTools} tips={['ייצוא לאקסל (XL)', 'הורדת PDF', 'הדפסת דוח']} onPick={(md) => openWiz(md, null)} />;
  }

  let body;
  if (unauth) {
    body = <section className="card at-card"><div className="at-empty"><Ic id="lock" /><div>יש להתחבר כדי לצפות בשעות העבודה שלך.</div></div></section>;
  } else {
    body = view === 'emp' ? bodyEmp() : view === 'byemp' ? bodyBy() : self ? bodyMe() : bodyMgr();
  }

  const wizOwnEmp = self ? (meInfo || (empD.data && empD.data.employee) || (byD.data && byD.data.employee)) : null;
  return (
    <div className="gm-ds gm-at home-bg dlg-dark" ref={rootRef} dir="rtl">
      <HomeSprite />
      <div className="app at" id="app">
        <div className="topbar">
          <button type="button" className="back" id="atBack" aria-label="חזרה" data-tip="חזרה" onClick={onBack}><Ic id="back" className="ia-ov" /></button>
          <div className="ttl"><div><h1 id="atH1">{h1}</h1><div className="faint at-sub" id="atSub">{subT}</div></div></div>
          <div className="tools lz-dtools" id="atTools">
            {unauth ? null : tools}
            {/* "חזרה לתצוגה הישנה" (4.10.2026): רק להנהלה ראשית / מתכנת, ורק בנתיבים שיש להם גרסה ישנה (לא ב-/employees/<id>/attendance) */}
            <PageVariantToggle screen="attendance" placement="header" systemTip />
          </div>
        </div>
        {unauth ? null : <section className="card at-bar" aria-label="סינון לפי תקופה">{bar}</section>}
        <div id="atBody">{body}</div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
      <div className="pl-tt" role="tooltip" ref={ttRef} />
      <ConfirmDialog open={!!confirmState} title={confirmState && confirmState.title} sub={confirmState && confirmState.sub} okLabel={confirmState && confirmState.okLabel} icon={confirmState && confirmState.icon} onYes={() => confirmDone(true)} onNo={() => confirmDone(false)} />
      <HistoryDialog
        open={!!history}
        employee={empInfo}
        shiftId={history && history.shiftId}
        shiftLabel={history && history.label}
        cardHref={isMgr && empInfo ? `/employees/${encodeURIComponent(empInfo.id)}?tab=history` : null}
        onClose={() => setHistory(null)}
      />
      {wiz ? (
        <AttendanceWizard
          params={{ ...wiz, empId: wiz.empId === 'me' ? (wizOwnEmp && wizOwnEmp.id) || 'me' : wiz.empId }}
          own={own}
          isMgr={isMgr}
          self={self}
          me={wizOwnEmp}
          onClose={() => setWiz(null)}
          onPreview={setPreview}
          say={say}
        />
      ) : null}
      <PreviewOverlay preview={preview} onClose={() => setPreview(null)} say={say} />
    </div>
  );
}
