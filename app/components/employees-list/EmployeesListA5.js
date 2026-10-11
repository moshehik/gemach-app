'use client';

// רשימת העובדים החדשה (/employees, לשונית "רשימת עובדים") - העיצוב המאושר: תצוגות-עיצוב/עובדים-ודגמים/employees.html
// (scratch/emp-models-build/employees.js + employees.app.html), על ערכת הרשימות app/components/a5-list.
// כל התכונות של הרשימה הישנה נשמרו: חיפוש חכם AI (/api/ai/smart-search, pageContext 'employees'), שאלות סטטיסטיקה (StatisticsModal),
// "עובד חדש", מיון, סינון פעילים / לא פעילים, לחיצה על שורה -> כרטיס העובד (/employees/<id>). חדש מהעיצוב: סימון "מחובר" ומפתח "יש לעדכן
// סיסמה", כניסה אחרונה, סינון לפי מחלקה, עימוד 50, ייצוא XL / הורדה / הדפסה.
// מקורות הנתונים: /api/employees?all=true (כמו הישן) + /api/employees/presence (חדש: "מחובר" + "כניסה אחרונה" מתוך משמרות; ר' הערה בנתיב).
// ייצוא: Excel = קובץ xlsx אמיתי (runListExport). הדפסה והורדת PDF = התצוגה המקדימה המעוצבת של app/components/a5-print (מסמך 'employees-list'): בדיוק הרשימה שעל המסך
// (אחרי חיפוש + סינון + מיון), בלי נתונים כפולים ובלי נתונים לא רלוונטיים; ה-PDF נוצר בשרת מאותם גיליונות.

import '@/design-system/components.css';
import './employees-list.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import StatisticsModal from '../StatisticsModal';
import PageVariantToggle from '../variant/PageVariantToggle';
import { runPrint } from '../a5-print/runPrint';
import {
  A5List, A5Page, A5SearchSlot, Ic, dayTitle, relDay, runListExport, timeHM, useA5,
} from '../a5-list';
import {
  STATUS_OPTIONS, deptNamesByRole, deptOptions, employeeHay, employeeRow, shiftText,
} from './employeesLogic';

const SLOT_ID = 'a5l-search-emp';
const PRESENCE_POLL_MS = 60000;

function lastTxt(r) {
  if (!r.last) return null;
  return <>{relDay(r.last)} · <bdi>{timeHM(r.last)}</bdi></>;
}
const lastPlain = (r) => (r.last ? `${relDay(r.last)} ${timeHM(r.last)}` : '');

function ConnMark({ r }) {
  return (
    <span className="conn" data-tip={`מחובר עכשיו · במשמרת ${shiftText(r.shiftMin)} שעות`}>
      <span className="cico"><Ic id="online" /></span><span className="ctx">מחובר</span>
    </span>
  );
}

function EmployeesList() {
  const router = useRouter();
  const a5 = useA5();
  const [raw, setRaw] = useState(null); // רשימת עובדים מהשרת
  const [aiRows, setAiRows] = useState(null); // תוצאות חיפוש חכם (מחליפות את הרשימה עד איפוס)
  const [aiBusy, setAiBusy] = useState(false);
  const [presence, setPresence] = useState({});
  const [loadErr, setLoadErr] = useState('');
  const [stats, setStats] = useState(false);
  const [aiHidden, setAiHidden] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(() => {
    setLoadErr('');
    fetchSharedJson('/api/employees?all=true', { ttl: TTL.STATIC })
      .then((d) => setRaw(Array.isArray(d) ? d : []))
      .catch(() => { setLoadErr('טעינת רשימת העובדים נכשלה'); setRaw([]); });
  }, []);
  useEffect(() => { load(); }, [load]);

  // נוכחות: "מחובר" + "כניסה אחרונה". נטען פעם אחת ומתרענן כל דקה כשהלשונית גלויה
  useEffect(() => {
    let off = false;
    const pull = () => {
      fetch('/api/employees/presence', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!off && d && d.items) setPresence(d.items); }).catch(() => {});
    };
    pull();
    const t = setInterval(() => { if (document.visibilityState === 'visible') pull(); }, PRESENCE_POLL_MS);
    return () => { off = true; clearInterval(t); };
  }, []);

  useEffect(() => { setAiHidden(document.body.classList.contains('hide-ai-features')); }, []);

  const byRole = useMemo(() => deptNamesByRole(raw || []), [raw]);
  const rows = useMemo(() => (aiRows || raw || []).map((e) => employeeRow(e, presence, byRole)), [aiRows, raw, presence, byRole]);
  const filters = useMemo(() => [
    { key: 'dept', label: 'מחלקה', icon: 'building', def: [], options: deptOptions(rows) },
    { key: 'status', label: 'סטטוס', icon: 'userck', def: ['active'], options: STATUS_OPTIONS },
  ], [rows]);

  const sorts = useMemo(() => [
    { k: 'name', l: 'שם מלא', i: 'user', get: (r) => r.full },
    { k: 'code', l: 'קוד עובד', i: 'hash', get: (r) => (/^\d+$/.test(r.code) ? Number(r.code) : r.code) },
    { k: 'dept', l: 'מחלקה', i: 'building', get: (r) => r.dept },
    { k: 'last', l: 'כניסה אחרונה', i: 'clock', get: (r) => r.ts },
    { k: 'phone', l: 'טלפון', i: 'phone', get: (r) => r.phone },
    { k: 'mail', l: 'מייל', i: 'mail', get: (r) => r.email },
    { k: 'status', l: 'סטטוס', i: 'userck', get: (r) => (r.active ? 0 : 1) },
  ], []);

  // חיפוש חכם: כמו הישן - POST /api/ai/smart-search; שגיאה בטוסט (לא alert)
  const ai = useMemo(() => ({
    loading: aiBusy,
    onSubmit: async (prompt) => {
      setAiBusy(true);
      try {
        const res = await fetch('/api/ai/smart-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, pageContext: 'employees' }) });
        const result = await res.json().catch(() => ({}));
        if (res.ok) setAiRows(result.data || []); else a5.say(result.error || 'שגיאה בחיפוש החכם', 'error');
      } catch { a5.say('שגיאת תקשורת', 'error'); } finally { setAiBusy(false); }
    },
    onReset: () => setAiRows(null),
  }), [aiBusy, a5]);

  const open = (r) => router.push(`/employees/${r.id}`);
  const goCardFor = (r, msg) => { if (msg) a5.say(msg, 'info'); router.push(`/employees/${r.id}`); };

  const rowMain = (r, c) => {
    const ico = !r.active ? 'ban' : r.conn ? 'userck' : 'user';
    const lt = lastTxt(r);
    return (
      <>
        <div className="ic-b sq"><Ic id={ico} /></div>
        <div className="t"><b>{c.hl(r.full)}</b><span className="ln mi">
          <span className="lni"><Ic id="building" />{r.dept}</span>
          <span className={`lni${lt ? '' : ' zero'}`}><Ic id="clock" />כניסה אחרונה · {lt || 'אין כניסות'}</span>
          {r.phone ? <span className="lni"><Ic id="phone" /><bdi>{c.hl(r.phone)}</bdi></span> : null}
          {r.email ? <span className="lni mail"><Ic id="mail" /><bdi>{c.hl(r.email)}</bdi></span> : null}
        </span></div>
        {r.pwd || r.conn ? <span className="mk">{r.pwd ? <span className="pwd" data-tip="הסיסמה ישנה — יש לעדכן בכרטיס העובד"><Ic id="key" /></span> : null}{r.conn ? <ConnMark r={r} /> : null}</span> : null}
      </>
    );
  };

  const detail = (r) => {
    const row = (k, v) => <div className="hv-r"><small>{k}</small><b><span>{v}</span></b></div>;
    return (
      <>
        {row('קוד עובד', <bdi>{r.code}</bdi>)}
        {row('מחלקה', r.dept)}
        {r.phone ? row('טלפון', <bdi>{r.phone}</bdi>) : null}
        {r.email ? row('מייל', <bdi>{r.email}</bdi>) : null}
        {row('כניסה אחרונה', r.last ? <>{dayTitle(r.last)} · <bdi>{timeHM(r.last)}</bdi></> : 'אין כניסות רשומות')}
        {r.conn ? row('משמרת', <><span className="cdot-inl" />מחובר · במשמרת <bdi>{shiftText(r.shiftMin)}</bdi> שעות</>) : null}
        {row('סטטוס', r.active ? 'פעיל' : 'לא פעיל')}
        {r.pwd ? row('סיסמה', <><Ic id="key" size="sm" />הסיסמה ישנה — יש לעדכן</>) : null}
        <div className="hv-r hv-act"><small>פעולות</small><b className="hv-btns">
          <button type="button" className="btn sm" onClick={() => open(r)}><Ic id="user" size="sm" />כרטיס עובד</button>
          <button type="button" className="btn sm" onClick={() => router.push(`/employees/attendance?view=emp&emp=${encodeURIComponent(r.id)}`)}><Ic id="clock" size="sm" />נוכחות החודש</button>
          {r.pwd ? <button type="button" className="btn sm" onClick={() => goCardFor(r, 'איפוס סיסמה נעשה בכרטיס העובד, באימות מנהל')}><Ic id="key" size="sm" />איפוס סיסמה</button> : null}
          <button type="button" className="ibtn" aria-label="שליחת מייל" data-tip="שליחת מייל" onClick={() => goCardFor(r, 'שליחת מייל נעשית מכרטיס העובד')}><Ic id="mail" size="sm" /></button>
          <button type="button" className="ibtn" aria-label="הדפסת כרטיס" data-tip="הדפסת כרטיס עובד" onClick={() => a5.say('הדפסת כרטיס העובד', 'info', 'תתווסף בשלב ההדפסות')}><Ic id="print" size="sm" /></button>
        </b></div>
      </>
    );
  };

  const columns = [
    { k: 'code', t: 'קוד', cell: (r) => <bdi>{r.code}</bdi> },
    { k: 'name', t: 'שם מלא', cell: (r, c) => <span className="tcn"><Ic id={!r.active ? 'ban' : r.conn ? 'userck' : 'user'} /><b>{c.hl(r.full)}</b>{r.pwd ? <span className="pwd" data-tip="יש לעדכן סיסמה"><Ic id="key" /></span> : null}{r.conn ? <ConnMark r={r} /> : null}</span> },
    { k: 'dept', t: 'מחלקה', cell: (r) => <><Ic id="building" />{r.dept}</> },
    { k: 'last', t: 'כניסה אחרונה', cell: (r) => <><Ic id="clock" />{lastTxt(r) || 'אין כניסות'}</> },
    { k: 'phone', t: 'טלפון', cell: (r, c) => (r.phone ? <><Ic id="phone" /><bdi>{c.hl(r.phone)}</bdi></> : '') },
    { k: 'mail', t: 'מייל', cell: (r, c) => (r.email ? <><Ic id="mail" /><bdi>{c.hl(r.email)}</bdi></> : '') },
    { k: 'status', t: 'סטטוס', cell: (r) => (r.active ? 'פעיל' : 'לא פעיל') },
  ];

  // הדפסה / הורדת PDF: התצוגה המקדימה המעוצבת (שורות = כל הרשימה אחרי חיפוש + סינון + מיון; filters לתיאור הסינון הפעיל בכותרת)
  const printDoc = (kind) => (list, state) => runPrint({ doc: 'employees-list', kind, say: a5.say, data: { rows: list, state, filters } });
  const onExport = (kind, list, state, info) => {
    runListExport({
      kind, say: a5.say, title: 'רשימת עובדים', subtitle: info.filterText, base: 'עובדים',
      head: ['קוד', 'שם מלא', 'מחלקה', 'כניסה אחרונה', 'טלפון', 'מייל', 'סטטוס'],
      rows: list.map((r) => [r.code, r.full, r.dept, lastPlain(r), r.phone, r.email, r.active ? 'פעיל' : 'לא פעיל']),
    });
  };

  return (
    <>
      <div className="app" id="app">
        <div className="topbar">
          <button type="button" className="back" id="empBack" aria-label="חזרה למרכז הניהול" data-tip="חזרה למרכז הניהול" onClick={() => router.push('/admin')}><Ic id="back" /></button>
          <div className="ttl"><h1><small>ניהול</small>עובדים ונוכחות</h1></div>
          <div className="a5-tools"><PageVariantToggle screen="employees_list" placement="header" systemTip /></div>
        </div>
        <A5SearchSlot id={SLOT_ID} />
        <div className="layout one">
          <main className="main">
            <nav className="tabs" id="tabs" role="tablist" aria-label="עובדים">
              <button type="button" className="tab on" role="tab" aria-selected="true" data-tab="list"><span className="tico"><Ic id="users" /></span>רשימת עובדים</button>
              <button type="button" className="tab" role="tab" aria-selected="false" data-tab="att" onClick={() => router.push('/employees/attendance')}><span className="tico"><Ic id="clock" /></span>נוכחות</button>
            </nav>
            <section className="panel on" id="p-list" role="tabpanel">
              <div className="card hist">
                <div className="card-h"><div className="ico gold"><Ic id="users" size="lg" /></div><h2>רשימת עובדים</h2>
                  <button type="button" className="btn navy" id="btnNew" onClick={() => router.push('/employees/new')}><Ic id="plus" />עובד חדש</button></div>
                <A5List
                  ref={listRef}
                  items={rows}
                  getId={(r) => r.id}
                  texts={{ placeholder: 'חיפוש עובד (שם, טלפון, קוד, מייל)…', aiPlaceholder: 'בקשו מה-AI למצוא עובדים (למשל: מי נכנס השבוע בלי לצאת)…', countLabel: 'עובדים', emptyText: 'לא נמצאו עובדים התואמים את החיפוש' }}
                  hay={employeeHay}
                  filters={filters}
                  sorts={sorts}
                  defaultSort={{ k: 'name', dir: 1 }}
                  rowClass={(r) => (r.active ? '' : 'off')}
                  rowMain={rowMain}
                  detail={detail}
                  columns={columns}
                  onOpen={open}
                  searchSlot={SLOT_ID}
                  ai={aiHidden ? null : ai}
                  onStats={aiHidden ? null : () => setStats(true)}
                  exportSpec={{ what: 'רשימת העובדים', onExport, onPrint: printDoc('print'), onDownload: printDoc('download') }}
                  loading={raw === null}
                  error={loadErr}
                  onRetry={load}
                />
              </div>
            </section>
          </main>
        </div>
      </div>
      {stats ? <StatisticsModal isOpen onClose={() => setStats(false)} pageContext="employees" position={null} /> : null}
    </>
  );
}

export default function EmployeesListA5() {
  return <A5Page name="gm-emp"><EmployeesList /></A5Page>;
}
