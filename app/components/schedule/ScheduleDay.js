'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ScheduleIcon, { LocalSprite } from './ScheduleIcon';
import StageRail from './StageRail';
import StageSection from './StageSection';
import HebrewDayPicker from './HebrewDayPicker';
import ScheduleSkeleton from './ScheduleSkeleton';
import { addDays, hebrewLong, toKey } from './hebrewCalendar';
import { STAGE_ORDER } from './scheduleMeta';
import { fetchSharedJson, TTL } from '@/lib/apiCache';

// דף "לו״ז יומי" - קריאה בלבד (V1). מקור העיצוב: תצוגות-עיצוב/לוז-יומי.html. הנתונים: GET /api/schedule
// (docs/schedule-page-logic-spec.md). אין סימון "בוצע", אין הדפסה/ייצוא, אין הגדרות שלבים, אין ברקוד.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readUrlState() {
  try {
    const p = new URLSearchParams(window.location.search);
    const d = p.get('date');
    return { date: d && DATE_RE.test(d) ? d : null, branch: p.get('branch') || '' };
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

function safeHebrewLong(key) {
  try { return hebrewLong(key); } catch { return key; }
}

const ERROR_TEXT = {
  401: 'יש להתחבר מחדש כדי לצפות בלו״ז.',
  403: 'אין הרשאה לצפות בלו״ז היומי.',
};

export default function ScheduleDay() {
  const [date, setDate] = useState(null); // null = "היום" לפי השרת (שעון ישראל)
  const [branch, setBranch] = useState('');
  const [filter, setFilter] = useState(null);
  const [view, setView] = useState('rows');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);
  const [branches, setBranches] = useState([]);
  const [ready, setReady] = useState(false);
  // "היום" לפי השרת (שעון ישראל) - נשמר גם כשהטעינה נכשלת, כדי שבורר התאריך ימשיך לעבוד;
  // localToday = גיבוי מהדפדפן (רק עד שיש תשובה ראשונה, מחושב אחרי הטעינה כדי לא ליצור הבדל ב-hydration)
  const [clock, setClock] = useState(null);
  const [localToday, setLocalToday] = useState(null);
  const reqId = useRef(0);

  // מצב התחלתי מהכתובת (?date=&branch=) ומהעדפת התצוגה (שורות/טבלה) של המשתמשת בדפדפן הזה
  useEffect(() => {
    const u = readUrlState();
    if (u.date) setDate(u.date);
    if (u.branch) setBranch(u.branch);
    try {
      if (localStorage.getItem('lz_view') === 'table') setView('table');
    } catch { /* אחסון חסום - ברירת מחדל שורות */ }
    setLocalToday(toKey(new Date()));
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return undefined;
    const id = ++reqId.current;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    if (date) qs.set('date', date);
    if (branch) qs.set('branch', branch);
    fetch('/api/schedule' + (qs.toString() ? '?' + qs.toString() : ''), { signal: ctrl.signal, credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch { /* לא JSON */ }
        if (id !== reqId.current) return;
        if (!res.ok) {
          // אחרי שגיאה לא משאירים את נתוני היום הקודם (כותרת, ציר ומונים) - הם היו מטעים
          setData(null);
          setError({ status: res.status, message: ERROR_TEXT[res.status] || (body && body.error) || 'שגיאה בטעינת הלו״ז היומי' });
          setLoading(false);
          return;
        }
        setData(body);
        if (body && body.today) setClock({ today: body.today, tomorrow: body.tomorrow });
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

  // רשימת הסניפים (branch_list) - רק כשהארגון עובד עם סניפים
  const branchesEnabled = !!(data && data.settings && data.settings.branchesEnabled);
  useEffect(() => {
    if (!branchesEnabled) return undefined;
    let alive = true;
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((rows) => {
        if (!alive || !Array.isArray(rows)) return;
        const row = rows.find((r) => r.key === 'branch_list');
        const list = String((row && row.value) || '').split(',').map((s) => s.trim()).filter(Boolean);
        setBranches(list);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [branchesEnabled]);

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
  const shownDate = data ? data.date : date;
  const flags = data ? data.dayFlags : null;
  // בורר התאריך חייב להישאר זמין גם בשגיאה (למשל ?date= לא תקין) כדי שיהיה אפשר לבחור יום אחר
  const pickerDate = (data && data.date) || date || localToday;
  const pickerToday = (clock && clock.today) || localToday;
  const pickerTomorrow = (clock && clock.tomorrow) || (pickerToday ? addDays(pickerToday, 1) : null);

  return (
    <div className="gm-ds gm-home gm-lz home-bg">
      <LocalSprite />
      <div className="app lz-app">
        <div className="topbar">
          <div className="ttl">
            <h1 className="pg-ttl">
              <small>{shownDate ? hebrewLong(shownDate) : ' '}</small>
              <bdi>לוח זמנים</bdi>
            </h1>
            {pickerDate && pickerToday ? <HebrewDayPicker date={pickerDate} today={pickerToday} tomorrow={pickerTomorrow} onChange={changeDate} /> : null}
          </div>
        </div>

        <div className="lz-layout">
          <StageRail data={data} loading={loading} filter={filter} onFilter={setFilter} />
          <div className="lz-main">
            <div className="hres-bar lz-hb" id="hb">
              <div className={'vsw' + (view === 'table' ? ' t' : '')} role="group" aria-label="מצב תצוגה">
                <span className="vknob" aria-hidden="true" />
                <button type="button" className={'vopt' + (view === 'rows' ? ' on' : '')} aria-label="תצוגת שורות" aria-pressed={view === 'rows'} title="שורות" onClick={() => changeView('rows')}>
                  <ScheduleIcon name="rows" />
                </button>
                <button type="button" className={'vopt' + (view === 'table' ? ' on' : '')} aria-label="תצוגת טבלה" aria-pressed={view === 'table'} title="טבלה" onClick={() => changeView('table')}>
                  <ScheduleIcon name="table" />
                </button>
              </div>
              {/* TODO(ימים לא עובדים): כשהכלל המאוחד "יום לא עובד" ימומש (lib/businessDays.js, ענף non-working-days),
                  ה-API יחזיר דגל אחד (למשל dayFlags.isNonWorking + סיבה, כולל ימים שהבעלים סימן) והדף יציג אותו
                  במקום שתי התגיות הבאות. הדף לא מחשב חגים/ימים לא עובדים בעצמו - רק מציג דגלים מה-API. */}
              {flags && flags.isChag ? <span className="chip st-today"><ScheduleIcon name="gift" />חג או ערב חג - יום לא עובד</span> : null}
              {flags && flags.isFridayOrShabbat ? <span className="chip st-today"><ScheduleIcon name="cal" />{(data.weekday || 'שישי / שבת') + ' - יום לא עובד'}</span> : null}
              {branchesEnabled && branches.length ? (
                <div className="lz-dtools">
                  <BranchSeg branches={branches} value={branch} onChange={changeBranch} />
                </div>
              ) : null}
            </div>
            <p className="lz-note">
              <ScheduleIcon name="info" className="sm" />
              <span>תצוגה לקריאה בלבד. סימון &quot;בוצע&quot; יתווסף בגרסה הבאה. התראת &quot;באיחור&quot; מוצגת רק בימים שכבר עברו.</span>
            </p>

            {data && data.truncated ? (
              <div className="lz-banner" role="alert">
                <ScheduleIcon name="alert" />
                <span>נטענו רק חלק מההזמנות של התקופה, ייתכן שחלק מהשורות חסרות. כדאי לצמצם לפי סניף או לפנות למנהל המערכת.</span>
              </div>
            ) : null}

            <div id="stages">
              {error ? (
                <div className="empty" role="alert">
                  <ScheduleIcon name={error.status === 403 || error.status === 401 ? 'lock' : 'alert'} className="lg" />
                  <div className="lz-empty-t">{error.message}</div>
                  {error.status !== 403 && error.status !== 401 ? (
                    <button type="button" className="btn lz-retry" onClick={() => setTick((t) => t + 1)}>
                      <ScheduleIcon name="refresh" className="sm" />נסו שוב
                    </button>
                  ) : null}
                </div>
              ) : loading || !data ? (
                <ScheduleSkeleton />
              ) : visible.length ? (
                visible.map((s) => (
                  <StageSection key={s.key} stage={s} view={view} pickupHours={data.settings && data.settings.pickupHours} />
                ))
              ) : (
                <div className="empty" role="status">
                  <ScheduleIcon name="cal" className="lg" />
                  <div className="lz-empty-t">{allTotal === 0 ? 'אין פעולות מתוכננות ביום הזה' : 'אין פריטים בשלב שנבחר'}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// סינון סניף (בורר 40/41: pill.seg) - סינון תצוגה בלבד, לא אכיפה (החלטה B2: אין שיוך עובדת לסניף)
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
