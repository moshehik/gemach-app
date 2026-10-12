'use client';

// StationAnalyticsPage - "המרות בעמדה הציבורית" (/station-analytics): כמה נכנסו לעמדה הציבורית, כמה מילאו פרטים וכמה נפתחה להן הזמנה (בקשת הבעלים, נושא 13).
// עיצוב: מסך הגדרות/ניהול A5 (באנר בראש, סרגל ניווט בצד ימין, כרטיסים) - אותו שלד ואותו CSS של מסכי ההגדרות (settings-sim.css, היקף .gm-ds.gm-st) + station-analytics.css
// לרכיבי הגרפים בלבד. רכיבים: הפלטה (design-system/); הגרפים אינם בפלטה (ר' StationCharts.js). תאריכים: עבריים בלבד.
// נתונים: GET /api/admin/station-analytics (מצטבר, בלי PII) + GET /api/admin/station-analytics/registrations (שם פרטי + אות, רק עם הרשאת לקוחות).
// ההגדרות המלאות של כל מדד ("הזמנה נפתחה" / "הזמנה אושרה" וכו'): docs/station-analytics.md.

import '@/design-system/components.css';
import '../settings-sim/settings-sim.css';
import './station-analytics.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { HomeSprite } from '../home/HomeParts';
import usePageTooltip from '../profile/usePageTooltip';
import { A5PortalRoot } from '../a5-list/A5Ui';
import { hDateShort, dayTitle, relDay, timeHM } from '../a5-list/dates';
import RangeDialog from '../admin-lists/RangeDialog';
import { getIsraelTodayKey } from '@/lib/hebrewDate';
import { VIEW_CHANNEL_LABELS, DEFAULT_WINDOW_DAYS } from '@/lib/stationAnalytics/constants';
import { Ic } from '../settings-sim/SettingsDialogs';
import { StatTile, FunnelBars, DayColumns, RateLine, DataTable } from './StationCharts';
import { fmtInt, fmtPct, presetRange } from './chartLogic';

const PRESETS = [
  { id: 'today', label: 'היום' },
  { id: '7', label: '7 ימים' },
  { id: '30', label: '30 ימים' },
  { id: 'custom', label: 'טווח בלוח' },
];
const CHANNELS = [
  { id: 'public', label: VIEW_CHANNEL_LABELS.public },
  { id: 'kiosk', label: VIEW_CHANNEL_LABELS.kiosk },
  { id: 'all', label: VIEW_CHANNEL_LABELS.all },
];
const WINDOW_OPTIONS = [7, 14, 21, 30, 45, 60];
const SECTIONS = [
  { id: 'sa-sum', label: 'סיכום להיום', icon: 'sig' },
  { id: 'sa-funnel', label: 'משפך ההמרה', icon: 'list' },
  { id: 'sa-daily', label: 'לאורך זמן', icon: 'cal' },
  { id: 'sa-regs', label: 'הרישומים', icon: 'users' },
];
const PARENT_LABELS = { visits: 'הנכנסים', availability: 'מי שבדקו זמינות', formStart: 'מי שפתחו את הטופס', registered: 'מי שמילאו פרטים', opened: 'מי שנפתחה להן הזמנה' };
const VERIFY_LABEL = { pending: 'ממתינה לאימות', repeat: 'רישום חוזר, ממתינה לאימות', verified: 'אומתה' };

function Banner({ kind = 'info', icon, heading, text, children }) {
  return (
    <div className="nb-w in">
      <section className={`nb nb-${kind}`} role="status">
        <div className="nb-main">
          <div className="nb-head">
            <span aria-hidden="true" className="nb-ic"><Ic id={icon || (kind === 'success' ? 'check' : 'alert')} plain /></span>
            <div className="nb-msg"><b>{heading}</b>{text ? <span>{text}</span> : null}</div>
            {children}
          </div>
        </div>
      </section>
    </div>
  );
}

function Seg({ label, options, value, onChange, idPrefix }) {
  const idx = Math.max(0, options.findIndex((o) => o.id === value));
  return (
    <div className="seg pill" role="radiogroup" aria-label={label} style={{ '--n': options.length, '--i': idx }}>
      <span className="pth" aria-hidden="true" />
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className={value === o.id ? 'on' : undefined} data-agy-id={`${idPrefix}_${o.id}`} onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

function ViewToggle({ value, onChange, label }) {
  return <Seg label={label} idPrefix="sa_view" value={value} onChange={onChange} options={[{ id: 'chart', label: 'גרף' }, { id: 'table', label: 'טבלה' }]} />;
}

function ChartCard({ title, sub, children }) {
  return (
    <div className="card sa-card">
      <div className="sa-card-h"><b>{title}</b>{sub ? <small>{sub}</small> : null}</div>
      {children}
    </div>
  );
}

function Section({ id, icon, title, extra, children }) {
  return (
    <section className="st-sec st-card" id={id} data-sec={id}>
      <h2 className="adm-h"><span className="adm-hi"><Ic id={icon} /></span>{title}{extra ? <span className="st-hr">{extra}</span> : null}</h2>
      {children}
    </section>
  );
}

function StatusChip({ kind, children }) {
  return <span className={`chip sa-chip ${kind}`}>{children}</span>;
}

/** preload = { data, list } - נתונים מוכנים לבדיקות רינדור בלי שרת (scripts/station-analytics-tests/ssr.test.mjs); בשימוש רגיל לא מועבר. */
export default function StationAnalyticsPage({ preload = null }) {
  const router = useRouter();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  const [portalRoot, setPortalRoot] = useState(null);
  const setRoot = useCallback((el) => { rootRef.current = el; setPortalRoot(el); }, []);
  usePageTooltip(rootRef, ttRef, false);

  const todayKey = useMemo(() => getIsraelTodayKey(), []);
  const [preset, setPreset] = useState('7');
  const [range, setRange] = useState(() => presetRange('7', todayKey));
  const [channel, setChannel] = useState('public');
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW_DAYS);
  const [tick, setTick] = useState(0);
  const [askRange, setAskRange] = useState(false);
  const [view, setView] = useState({ funnel: 'chart', daily: 'chart' });

  const [state, setState] = useState(() => (preload && preload.data ? { status: 'ok', data: preload.data, error: '' } : { status: 'loading', data: null, error: '' }));
  const [activeSec, setActiveSec] = useState('sa-sum');

  // ---- טעינת המדדים (שומרים את התצוגה הקודמת בזמן רענון - בלי הבהוב / קפיצת פריסה)
  useEffect(() => {
    const ac = new AbortController();
    const qs = new URLSearchParams({ from: range.from, to: range.to, channel, windowDays: String(windowDays) });
    if (tick > 0) qs.set('fresh', '1');
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading', error: '' }));
    fetch(`/api/admin/station-analytics?${qs}`, { signal: ac.signal, cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `שגיאה ${res.status}`);
        setState({ status: 'ok', data: body, error: '' });
      })
      .catch((e) => { if (e.name !== 'AbortError') setState((s) => ({ status: 'error', data: s.data, error: e.message || 'שגיאה בטעינת המדדים' })); });
    return () => ac.abort();
  }, [range.from, range.to, channel, windowDays, tick]);

  // ---- הרישומים של יום נבחר (ברירת מחדל: היום)
  const [listDay, setListDay] = useState(todayKey);
  const [list, setList] = useState(() => (preload && preload.list ? preload.list : { status: 'loading', rows: [], error: '' }));
  useEffect(() => {
    const ac = new AbortController();
    setList((l) => ({ ...l, status: 'loading', error: '' }));
    const qs = new URLSearchParams({ day: listDay, channel, windowDays: String(windowDays) });
    fetch(`/api/admin/station-analytics/registrations?${qs}`, { signal: ac.signal, cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (res.status === 403) { setList({ status: 'forbidden', rows: [], error: '' }); return; }
        if (!res.ok) throw new Error(body.error || `שגיאה ${res.status}`);
        setList({ status: body.status === 'no_table' ? 'no_table' : 'ok', rows: body.rows || [], error: '' });
      })
      .catch((e) => { if (e.name !== 'AbortError') setList({ status: 'error', rows: [], error: e.message || 'שגיאה בטעינת הרישומים' }); });
    return () => ac.abort();
  }, [listDay, channel, windowDays, tick]);

  // ---- הדגשת הקטע הנוכחי בסרגל
  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!els.length || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActiveSec(vis.target.id);
    }, { rootMargin: '-20% 0px -60% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [state.status === 'ok']);

  // הדף נגיש גם למי שאין לה גישה למסך הניהול (הרשאה אישית), לכן "חזרה" חוזרת למקום שממנו הגיעה, ובלי היסטוריה - לדף הבית
  const goBack = () => { if (typeof window !== 'undefined' && window.history.length > 1) router.back(); else router.push('/'); };

  const goSection = (id) => {
    const el = document.getElementById(id);
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveSec(id); }
  };

  const pickPreset = (id) => {
    if (id === 'custom') { setAskRange(true); return; }
    setPreset(id);
    setRange(presetRange(id, todayKey));
  };

  const d = state.data;
  const ok = d && d.status === 'ok';
  const noTable = d && d.status === 'no_table';
  const topMeasured = !!(ok && d.topMeasured);
  const hasData = !!(ok && (d.totals.registered > 0 || d.totals.visits > 0 || d.totals.availability > 0 || d.totals.formStart > 0));

  const dayItems = useMemo(() => (ok ? d.daily.map((r) => ({ day: r.day, label: relDay(r.day, todayKey) === 'היום' ? 'היום' : hDateShort(r.day), title: dayTitle(r.day) })) : []), [ok, d, todayKey]);
  const rangeText = ok ? (d.range.from === d.range.to ? dayTitle(d.range.from) : `${hDateShort(d.range.from)} עד ${hDateShort(d.range.to)}`) : '';

  const tableCols = [
    { key: 'day', label: 'יום' }, { key: 'visits', label: 'נכנסו' }, { key: 'availability', label: 'בדקו זמינות' }, { key: 'formStart', label: 'פתחו טופס' },
    { key: 'registered', label: 'מילאו פרטים' }, { key: 'verified', label: 'אומתו' }, { key: 'opened', label: 'נפתחה הזמנה' }, { key: 'approved', label: 'הזמנה אושרה או שולמה' },
  ];
  const tableRows = ok ? [...d.daily].reverse().map((r) => ({
    id: r.day,
    cells: { day: dayTitle(r.day), visits: topMeasured ? fmtInt(r.visits) : '—', availability: topMeasured ? fmtInt(r.availability) : '—', formStart: topMeasured ? fmtInt(r.formStart) : '—', registered: fmtInt(r.registered), verified: fmtInt(r.verified), opened: fmtInt(r.openedInWindow), approved: fmtInt(r.approvedInWindow) },
  })) : [];
  const funnelRows = ok ? d.funnel.map((s) => ({ id: s.key, cells: { stage: s.label, count: typeof s.count === 'number' ? fmtInt(s.count) : '—', parent: s.parent && s.rateFromParent !== null ? `${fmtPct(s.rateFromParent)} מתוך ${PARENT_LABELS[s.parent]}` : '—', visits: s.rateFromVisits !== null ? fmtPct(s.rateFromVisits) : '—' } })) : [];

  const cards = ok ? d.cards : null;

  return (
    <div className="gm-ds gm-st gm-sa home-bg dlg-dark" ref={setRoot} dir="rtl" data-agy-id="station_analytics_root">
      <HomeSprite />
      <A5PortalRoot.Provider value={portalRoot}>
        <div className="app st-view sa-view">
          <div className="st-banners">
            {ok && !d.linkEnabled ? (
              <Banner kind="info" icon="info" heading="הקישור הציבורי כבוי בארגון הזה" text={hasData ? 'מוצגים נתונים מהתקופה שבה הוא היה פתוח. אין איסוף חדש כל עוד הוא כבוי.' : 'כל עוד הוא כבוי אין מה למדוד. בהגדרות המערכת אפשר להפעיל אותו.'} />
            ) : null}
            {state.status === 'error' ? (
              <Banner kind="warning" icon="alert" heading="לא הצלחנו לטעון את המדדים" text={state.error}>
                <button type="button" className="btn ghost sm" onClick={() => setTick((n) => n + 1)}><Ic id="refresh" />נסו שוב</button>
              </Banner>
            ) : null}
          </div>

          <div className="topbar">
            <button type="button" className="back" aria-label="חזרה" data-tip="חזרה" data-element-name="כפתור_station_analytics_back" onClick={goBack}><Ic id="back" plain /></button>
            <div className="ttl">
              <h1 className="pg-ttl"><small>ניהול</small><bdi>המרות בעמדה הציבורית</bdi></h1>
            </div>
          </div>

          <div className="hf-bar adm-bar st-bar sa-bar" role="group" aria-label="סינון">
            <Seg label="תקופה" idPrefix="sa_preset" options={PRESETS} value={preset} onChange={pickPreset} />
            {preset === 'custom' ? (
              <button type="button" className="btn ghost sm sa-range" onClick={() => setAskRange(true)} data-agy-id="sa_range_btn">
                <Ic id="cal" /><bdi>{hDateShort(range.from)}</bdi> עד <bdi>{hDateShort(range.to)}</bdi>
              </button>
            ) : null}
            <Seg label="ערוץ" idPrefix="sa_channel" options={CHANNELS} value={channel} onChange={setChannel} />
            <label className="sa-win">
              <span>חלון המרה</span>
              <select className="inp st-sel" value={windowDays} onChange={(e) => setWindowDays(parseInt(e.target.value, 10))} aria-label="חלון ההמרה לסגירת הזמנה, בימים" data-agy-id="sa_window_select">
                {WINDOW_OPTIONS.map((n) => <option key={n} value={n}>{n} ימים</option>)}
              </select>
            </label>
            <button type="button" className="btn ghost sm sa-refresh" onClick={() => setTick((n) => n + 1)} disabled={state.status === 'loading' || state.status === 'refreshing'} data-agy-id="sa_refresh_btn"><Ic id="refresh" />רענון</button>
          </div>

          {state.status === 'loading' && !d ? (
            <div className="empty st-state" role="status"><span className="st-spin lg" aria-hidden="true" /><div>טוען מדדים…</div></div>
          ) : null}

          {noTable ? (
            <div className="empty st-state sa-note" role="status">
              <b>איסוף הנתונים עדיין לא הופעל בארגון הזה</b>
              <span>המסך מוכן, אבל טבלת האירועים עוד לא נוצרה במסד הנתונים. יש לפנות למתכנת כדי להפעיל אותה, ואז המדדים יתחילו להצטבר.</span>
            </div>
          ) : null}

          {ok && !d.linkEnabled && !hasData ? (
            <div className="empty st-state sa-note" role="status">
              <b>אין מדדים להציג</b>
              <span>העמדה הציבורית כבויה, ולכן לא נאסף שום מידע. כשתופעל, כאן יופיעו הכניסות, מילוי הפרטים וההזמנות.</span>
            </div>
          ) : null}

          {ok && (d.linkEnabled || hasData) ? (
            <div className={`layout sa-layout${state.status === 'refreshing' ? ' sa-busy' : ''}`}>
              <aside className="rail" aria-label="ניווט וההסבר על המדדים">
                <div className="st-sidenav">
                  <nav className="st-stabs" role="tablist" aria-label="קטעי המסך" aria-orientation="vertical">
                    {SECTIONS.map((s) => (
                      <button key={s.id} type="button" role="tab" aria-selected={activeSec === s.id} className={`st-stab${activeSec === s.id ? ' on' : ''}`} onClick={() => goSection(s.id)} data-agy-id={`sa_nav_${s.id}`}>
                        <span className="st-sic"><Ic id={s.icon} plain /></span>
                        <span className="st-slb">{s.label}</span>
                        <span className="st-sgo" aria-hidden="true"><Ic id="chev" plain /></span>
                      </button>
                    ))}
                  </nav>
                  <div className="sa-defs">
                    <div className="sa-defs-h"><Ic id="info" /><b>איך סופרים</b></div>
                    <dl>
                      <dt>נכנסו</dt><dd>כל כניסה לעמדה בקישור הכללי, פעם אחת ליום לכל מכשיר ולשונית. בלי שמות ובלי כתובות.</dd>
                      <dt>מילאו פרטים</dt><dd>לקוחות שהשלימו את הטופס, כל לקוחה פעם אחת. גם לקוחה קיימת שמילאה שוב. לקוחה שנמחקה לא נספרת.</dd>
                      <dt>אומתו</dt><dd>מי שהעובדת סימנה אצלה &quot;אומתה&quot; בכרטיס הלקוחה.</dd>
                      <dt>נפתחה הזמנה</dt><dd>הלקוחה בעמדה לא מזמינה בעצמה, והעובדת ממשיכה איתה להזמנה. נספרת הזמנה אמיתית שנפתחה אחרי המילוי, עד {d.range.windowDays} ימים (כולל יום המילוי), גם אם נשמרה בלי תשלום. טיוטה והזמנה מבוטלת אינן נספרות. זה המדד העיקרי.</dd>
                      <dt>הזמנה אושרה או שולמה</dt><dd>המדד המחמיר: אותה הזמנה, כשהשמלה כבר נתפסה סופית (שולם משהו, יציאה באישור מנהל, או שאין מה לשלם).</dd>
                    </dl>
                  </div>
                </div>
              </aside>

              <div className="st-main">
                {/* ------------------------------------------------ סיכום להיום */}
                <Section id="sa-sum" icon="sig" title="היום" extra={<small className="sa-sub">{dayTitle(todayKey)}</small>}>
                  <div className="sa-tiles" data-agy-id="sa_tiles">
                    <StatTile icon="eye" label="נכנסו לעמדה" value={cards.today.visits} yesterday={cards.yesterday.visits} weekAvg={cards.weekAvg && cards.weekAvg.visits} unmeasured={!topMeasured} />
                    <StatTile icon="user" label="מילאו פרטים" value={cards.today.registered} yesterday={cards.yesterday.registered} weekAvg={cards.weekAvg && cards.weekAvg.registered} />
                    <StatTile icon="cart" label="נפתחה הזמנה" value={cards.today.opened} yesterday={cards.yesterday.opened} weekAvg={cards.weekAvg && cards.weekAvg.opened} />
                    <StatTile icon="check" label="הזמנה אושרה או שולמה" value={cards.today.approved} yesterday={cards.yesterday.approved} weekAvg={cards.weekAvg && cards.weekAvg.approved} />
                    <StatTile icon="sig" label="אחוז מהנכנסים שמילאו פרטים" kind="rate" value={cards.today.visitToRegistered} yesterday={cards.yesterday.visitToRegistered} weekAvg={cards.weekAvg && cards.weekAvg.visitToRegistered} unmeasured={!topMeasured} />
                    <StatTile icon="sparkle" label="אחוז ממילאות הפרטים שנפתחה להן הזמנה" kind="rate" value={cards.today.registeredToOpened} yesterday={cards.yesterday.registeredToOpened} weekAvg={cards.weekAvg && cards.weekAvg.registeredToOpened}
                      extra={`בהגדרה המחמירה (אושרה או שולמה): ${fmtPct(cards.today.registeredToApproved)}`} />
                  </div>
                  <p className="st-note sa-foot">
                    {!topMeasured ? 'ההשוואה לאתמול ולממוצע השבועי חלה על הערוץ שנבחר. כניסות נמדדות רק בקישור הכללי. ' : ''}
                    &quot;נפתחה הזמנה&quot; של היום כולל רק הזמנות שנפתחו עד עכשיו. הערך עוד יכול לעלות עד {d.range.windowDays} ימים.
                  </p>
                </Section>

                {/* ------------------------------------------------ משפך */}
                <Section id="sa-funnel" icon="list" title="משפך ההמרה" extra={<ViewToggle label="תצוגת המשפך" value={view.funnel} onChange={(v) => setView((s) => ({ ...s, funnel: v }))} />}>
                  <ChartCard title={rangeText} sub={`ערוץ: ${VIEW_CHANNEL_LABELS[d.range.channel]} · חלון המרה ${d.range.windowDays} ימים`}>
                    {view.funnel === 'chart' ? <FunnelBars stages={d.funnel} parentLabels={PARENT_LABELS} hasData={hasData} /> : (
                      <DataTable caption="משפך ההמרה" columns={[{ key: 'stage', label: 'שלב' }, { key: 'count', label: 'כמה' }, { key: 'parent', label: 'מתוך השלב הקודם' }, { key: 'visits', label: 'מהנכנסים' }]} rows={funnelRows} />
                    )}
                    {!hasData ? <p className="st-note" role="status">עדיין אין נתונים בטווח הזה. ברגע שלקוחות ייכנסו למסך, יתחילו להופיע כאן מספרים.</p> : null}
                    <ul className="sa-notes">
                      {d.totals.windowStillOpen > 0 ? <li><Ic id="clock" />{fmtInt(d.totals.windowStillOpen)} מהנרשמות עדיין בתוך חלון ההמרה, ולכן &quot;נפתחה הזמנה&quot; עוד יכול לעלות.{d.rates.registeredToOpenedMatured !== null ? ` מבין מי שהחלון שלהן הסתיים: ${fmtPct(d.rates.registeredToOpenedMatured)} נפתחה להן הזמנה (${fmtInt(d.totals.openedInWindowMatured)} מתוך ${fmtInt(d.totals.maturedRegistered)}), ו-${fmtPct(d.rates.registeredToApprovedMatured)} אושרה או שולמה.` : ''}</li> : null}
                      {d.totals.openedNotApproved > 0 ? <li><Ic id="note" />{fmtInt(d.totals.openedNotApproved)} נפתחה להן הזמנה שעדיין לא אושרה או שולמה (נשמרה בלי תשלום ובלי אישור מנהל). הן נספרות ב&quot;נפתחה הזמנה&quot; ולא ב&quot;אושרה או שולמה&quot;.</li> : null}
                      {d.totals.droppedDeleted > 0 ? <li><Ic id="trash" />{fmtInt(d.totals.droppedDeleted)} רישומים של לקוחות שנמחקו לא נספרו.</li> : null}
                      {d.range.channel !== 'public' ? <li><Ic id="info" />נתוני הכניסות נאספים רק בקישור הכללי, ולכן שלבי הפתיחה לא מוצגים בערוץ הזה.</li> : null}
                      <li><Ic id="users" />חלוקה בטווח: קישור כללי <b>{fmtInt(d.totals.registeredByChannel.public)}</b>, עמדת חנות <b>{fmtInt(d.totals.registeredByChannel.kiosk)}</b> לקוחות.</li>
                    </ul>
                  </ChartCard>
                </Section>

                {/* ------------------------------------------------ לאורך זמן */}
                <Section id="sa-daily" icon="cal" title="לאורך זמן" extra={<ViewToggle label="תצוגת הגרפים" value={view.daily} onChange={(v) => setView((s) => ({ ...s, daily: v }))} />}>
                  {view.daily === 'table' ? (
                    <ChartCard title="נתונים יומיים" sub={rangeText}><DataTable caption="נתונים יומיים" columns={tableCols} rows={tableRows} /></ChartCard>
                  ) : (
                    <div className="sa-charts">
                      {topMeasured ? (
                        <ChartCard title="כניסות לעמדה בכל יום" sub="הציר מימין לשמאל: היום הראשון בטווח מימין">
                          <DayColumns days={dayItems} ariaLabel="כניסות לעמדה בכל יום" emptyText="אין כניסות בטווח הזה"
                            series={[{ key: 'visits', label: 'נכנסו', slot: 1, values: d.daily.map((r) => r.visits) }]} />
                        </ChartCard>
                      ) : null}
                      <ChartCard title="מילאו פרטים ונפתחה להן הזמנה בכל יום" sub="לחיצה על יום מציגה את הרישומים שלו בטבלה למטה. הזמנות שאושרו מופיעות בתצוגת הטבלה">
                        <DayColumns days={dayItems} ariaLabel="מילאו פרטים ונפתחה להן הזמנה בכל יום" emptyText="אין רישומים בטווח הזה" picked={listDay}
                          onPick={(day) => { setListDay(day); goSection('sa-regs'); }}
                          series={[
                            { key: 'registered', label: 'מילאו פרטים', slot: 2, values: d.daily.map((r) => r.registered) },
                            { key: 'opened', label: 'נפתחה הזמנה', slot: 1, values: d.daily.map((r) => r.openedInWindow) },
                          ]} />
                      </ChartCard>
                      {topMeasured ? (
                        <ChartCard title="אחוז מהנכנסים שמילאו פרטים" sub="ימים בלי כניסות נשארים ריקים">
                          <RateLine days={dayItems} label="נכנסו ומילאו פרטים" slot={2} ariaLabel="אחוז מהנכנסים שמילאו פרטים, בכל יום" emptyText="אין עדיין מספיק נתונים"
                            values={d.daily.map((r) => (r.visits > 0 ? r.registered / r.visits : null))} />
                        </ChartCard>
                      ) : null}
                    </div>
                  )}
                </Section>

                {/* ------------------------------------------------ הרישומים של יום */}
                <Section id="sa-regs" icon="users" title={listDay === todayKey ? 'הרישומים של היום' : 'הרישומים'} extra={<small className="sa-sub">{dayTitle(listDay)}</small>}>
                  <div className="card sa-card">
                    {list.status === 'loading' ? <div className="empty st-state" role="status"><span className="st-spin" aria-hidden="true" /><div>טוען רישומים…</div></div> : null}
                    {list.status === 'forbidden' ? <p className="st-note" role="status">הרשימה מוצגת רק למי שמורשה לצפות בפרטי לקוחות.</p> : null}
                    {list.status === 'error' ? <div className="empty st-state" role="alert"><b>{list.error}</b><button type="button" className="btn ghost sm" onClick={() => setTick((n) => n + 1)}><Ic id="refresh" />נסו שוב</button></div> : null}
                    {list.status === 'no_table' ? <p className="st-note" role="status">איסוף הנתונים עדיין לא הופעל.</p> : null}
                    {list.status === 'ok' && list.rows.length === 0 ? <div className="empty st-state" role="status"><b>אין רישומים ביום הזה</b><span>כשלקוחה תמלא את הפרטים בעמדה, היא תופיע כאן.</span></div> : null}
                    {list.status === 'ok' && list.rows.length > 0 ? (
                      <div className="tblw sa-tblw">
                        <table className="rtbl sa-table" data-agy-id="sa_regs_table">
                          <caption className="sr-only">הרישומים של {dayTitle(listDay)}</caption>
                          <thead><tr><th scope="col">שעה</th><th scope="col">שם</th><th scope="col">ערוץ</th><th scope="col">אימות</th><th scope="col">הזמנה</th></tr></thead>
                          <tbody>
                            {list.rows.map((r) => (
                              <tr key={r.customerId}>
                                <td dir="ltr"><bdi>{timeHM(r.at)}</bdi></td>
                                <td><bdi>{r.name}</bdi>{r.outcome && r.outcome !== 'created' ? <small className="sa-rep"> רישום חוזר</small> : null}</td>
                                <td>{r.channel === 'kiosk' ? 'עמדת חנות' : 'קישור כללי'}</td>
                                <td>{r.verification === 'verified' ? <StatusChip kind="green"><Ic id="userck" />{VERIFY_LABEL.verified}</StatusChip> : r.verification ? <StatusChip kind="amber">{VERIFY_LABEL[r.verification]}</StatusChip> : <span className="faint">—</span>}</td>
                                <td>{r.approved ? <StatusChip kind="green"><Ic id="check" />{r.approvedSameDay ? 'הזמנה אושרה היום' : 'הזמנה אושרה'}</StatusChip> : r.opened ? <StatusChip kind="amber">{r.openedSameDay ? 'נפתחה הזמנה היום, עוד לא אושרה' : 'נפתחה הזמנה, עוד לא אושרה'}</StatusChip> : <span className="faint">עדיין לא</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                    {listDay !== todayKey ? <div className="row"><button type="button" className="btn ghost sm" onClick={() => setListDay(todayKey)}><Ic id="back" size="sm" />חזרה להיום</button></div> : null}
                  </div>
                </Section>
              </div>
            </div>
          ) : null}
        </div>

        {askRange ? (
          <RangeDialog
            title="בחירת טווח"
            from={range.from}
            to={range.to}
            onCancel={() => setAskRange(false)}
            onDone={({ from, to }) => { setAskRange(false); setPreset('custom'); setRange({ from, to }); }}
          />
        ) : null}
      </A5PortalRoot.Provider>
      <div className="pl-tt" role="tooltip" ref={ttRef} />
    </div>
  );
}
