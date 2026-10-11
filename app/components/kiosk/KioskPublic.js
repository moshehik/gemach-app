'use client';

// KioskPublic - המסלול הציבורי של עמדת הלקוח (/station): קישור כללי שלקוחות פותחות מהטלפון, בלי התחברות ובלי שלד האתר.
// עיצוב: דף נחיתה (כמו /landing) על בסיס העיצוב המאושר של העמדה (תצוגות-עיצוב/עמדת-לקוח.html): רקע הפרחים, נייבי וזהב, פונט הכותרות.
// מקור הנתונים - ה-API הציבורי בלבד (מחויב בהגדרות kiosk_public_link_enabled / _show_inventory / _show_registration):
//   config   נטען בשרת (app/station/page.js, אותו חוזה כמו GET /api/public-kiosk/config) ומגיע כ-prop
//   GET /api/public-kiosk/models   קטלוג (ועם eventDate - גם זמינות לפי מידה, כמות מוגבלת ל-5)
//   POST /api/public-kiosk/register   דרך KioskRegistration mode="public" (submitRegistration, channel:'public')
// לא נקראים כאן /api/dresses, /api/settings, /api/employees (הם מחייבים התחברות), ואין נעילה / מסך מלא / "חזרה למערכת" / קוד עובד / AI:
// כל אלה שייכים לעמדת החנות בלבד (KioskA5).

import './kiosk-a5.css';
import '@/design-system/components.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { A5Page } from '../a5-list/A5Ui';
import { modelMatchesQuery } from '@/lib/kioskModelSearch';
import KioskCalendar from './KioskCalendar';
import KioskRegistration from './KioskRegistration';
import { KIcon, KioskThumbImg } from './KioskParts';
import { formatHebrewDate, parshaFooter, tileColor } from './kioskLogic';
import { HDate } from '@hebcal/core';

const PAGE_SIZE = 60;
const QTY_CAP = 5; // כמו QTY_CAP ב-lib/publicKiosk/catalog.js: "5" = חמש ומעלה

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function Unavailable() {
  return (
    <div className="kp-unavail" role="status" data-agy-id="station_unavailable">
      <span className="kp-bubble"><KIcon id="lock" size="lg" /></span>
      <h1 className="kp-title">העמדה אינה זמינה</h1>
      <p className="kp-lead">העמדה סגורה כרגע. אפשר לפנות אלינו בטלפון או להגיע לחנות.</p>
    </div>
  );
}

function ModelTile({ model, inventory, hideImages }) {
  const title = model.code ? `דגם ${model.code}` : model.name;
  const sub = model.code && model.name && model.name !== model.code ? model.name : '';
  const showImg = !hideImages && model.imageUrl;
  return (
    <div className="tile kp-tile">
      <div className="thumb2" style={{ background: tileColor({ barcodePrefix: model.code, name: model.name }) }}>
        {showImg ? <KioskThumbImg model={model} /> : <KIcon id="dress" size="lg" />}
      </div>
      <div className="mname">{title}</div>
      {sub || model.priceCategory ? (
        <div className="muted sm ks-sub2">{sub}{model.priceCategory && model.priceCategory !== 'כללי' ? <span className="chip gray">{model.priceCategory}</span> : null}</div>
      ) : null}
      {inventory ? (
        <div className={`ks-avail ${model.inStock ? 'ok' : 'bad'}`}>
          <KIcon id={model.inStock ? 'check' : 'alert'} size="sm" />
          {model.inStock ? 'יש זמינות בתאריך שבחרת' : 'אין זמינות בתאריך שבחרת'}
        </div>
      ) : null}
      <div className="msizes">
        {model.sizes.length === 0 ? <span className="ks-nosz">אין מידות רשומות</span> : model.sizes.map((s) => {
          const has = inventory ? s.available : true;
          return (
            <span key={s.size} className={`msz ${has ? 'ok' : 'none'}`} title={inventory ? (has ? `מידה ${s.size}: זמינה` : `מידה ${s.size}: לא זמינה`) : `מידה ${s.size}`}>
              {s.size}{inventory && has ? ` · ${s.qty >= QTY_CAP ? `${QTY_CAP}+` : s.qty}` : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Catalog({ config, date, onChangeDate, onBack }) {
  const inventory = !!config.showInventory;
  const [state, setState] = useState({ status: 'loading', data: [], sizes: [], categories: [], message: '' });
  const [q, setQ] = useState('');
  const [sizes, setSizes] = useState([]);
  const [category, setCategory] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    const qs = inventory && date ? `?eventDate=${encodeURIComponent(dateKey(date))}` : '';
    fetch(`/api/public-kiosk/models${qs}`, { signal: ac.signal })
      .then(async (res) => {
        let body = null;
        try { body = await res.json(); } catch (e) { body = null; }
        if (!alive) return;
        if (res.ok && body && body.ok) {
          setState({ status: 'ok', data: body.data || [], sizes: body.sizes || [], categories: body.categories || [], message: '' });
        } else if (res.status === 404) {
          setState({ status: 'unavailable', data: [], sizes: [], categories: [], message: '' });
        } else if (res.status === 400 && body && body.code === 'bad_date') {
          setState({ status: 'bad_date', data: [], sizes: [], categories: [], message: 'כדי לבדוק זמינות צריך לבחור תאריך קרוב ועתידי.' });
        } else if (res.status === 429) {
          setState({ status: 'error', data: [], sizes: [], categories: [], message: 'יותר מדי בקשות. נסי שוב בעוד רגע.' });
        } else {
          setState({ status: 'error', data: [], sizes: [], categories: [], message: 'לא הצלחנו לטעון את הדגמים.' });
        }
      })
      .catch((e) => { if (alive && e.name !== 'AbortError') setState({ status: 'error', data: [], sizes: [], categories: [], message: 'לא הצלחנו לטעון את הדגמים.' }); });
    return () => { alive = false; ac.abort(); };
  }, [inventory, date, tick]);

  const list = useMemo(() => state.data.filter((m) => {
    if (category && m.priceCategory !== category) return false;
    if (sizes.length && !m.sizes.some((s) => sizes.includes(s.size) && (!inventory || s.available))) return false;
    return modelMatchesQuery({ name: m.name, barcodePrefix: m.code }, q);
  }), [state.data, q, sizes, category, inventory]);
  useEffect(() => { setLimit(PAGE_SIZE); }, [q, sizes, category]);

  const dateText = date ? formatHebrewDate(date) : '';
  const shown = list.slice(0, limit);

  return (
    <section className="kp-catalog" data-agy-id="station_catalog">
      <div className="kp-bar">
        <button type="button" className="btn ghost" data-agy-id="station_back_btn" onClick={onBack}><KIcon id="back" size="sm" />חזרה</button>
        {inventory && dateText ? (
          <button type="button" className="kp-datechip" data-agy-id="station_change_date_btn" onClick={onChangeDate}>
            <KIcon id="cal" size="sm" /><span>{dateText}</span><em>שינוי תאריך</em>
          </button>
        ) : null}
      </div>

      <div className="ks-card kp-filters">
        <div className="ks-msearch kp-search">
          <KIcon id="search" size="sm" />
          <input type="text" inputMode="search" autoComplete="off" aria-label="חיפוש דגם" placeholder="חיפוש לפי מספר דגם או שם" data-agy-id="station_search_input"
            value={q} onChange={(e) => setQ(e.target.value)} />
          {q ? <button type="button" className="ibtn" aria-label="ניקוי" onClick={() => setQ('')}><KIcon id="x" size="sm" /></button> : null}
        </div>
        {state.sizes.length > 0 ? (
          <div className="kp-chips">
            <span className="lbl"><KIcon id="tag" size="sm" />מידה</span>
            <div className="sizes">
              {state.sizes.map((z) => {
                const on = sizes.includes(z);
                return <button type="button" key={z} className={on ? 'on' : ''} aria-pressed={on} onClick={() => setSizes((p) => (on ? p.filter((x) => x !== z) : [...p, z]))}>{z}</button>;
              })}
            </div>
          </div>
        ) : null}
        {state.categories.length > 1 ? (
          <div className="kp-chips">
            <span className="lbl"><KIcon id="box" size="sm" />קטגוריה</span>
            <div className="sizes">
              <button type="button" className={!category ? 'on' : ''} aria-pressed={!category} onClick={() => setCategory('')}>הכול</button>
              {state.categories.map((c) => (
                <button type="button" key={c} className={category === c ? 'on' : ''} aria-pressed={category === c} onClick={() => setCategory(category === c ? '' : c)}>{c}</button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {state.status === 'loading' ? <div className="empty ks-state" role="status"><b>טוען דגמים...</b></div> : null}
      {state.status === 'unavailable' ? <Unavailable /> : null}
      {state.status === 'bad_date' || state.status === 'error' ? (
        <div className="empty ks-state" role="alert">
          <b>{state.message}</b>
          {state.status === 'bad_date' && inventory ? (
            <button type="button" className="btn primary" onClick={onChangeDate}><KIcon id="cal" size="sm" />בחירת תאריך</button>
          ) : (
            <button type="button" className="btn primary" onClick={() => setTick((n) => n + 1)}><KIcon id="refresh" size="sm" />נסו שוב</button>
          )}
        </div>
      ) : null}
      {state.status === 'ok' ? (
        <>
          <p className="kp-count" aria-live="polite">{list.length} דגמים{inventory && date ? ` · ${list.filter((m) => m.inStock).length} עם זמינות בתאריך` : ''}</p>
          {list.length === 0 ? (
            <div className="empty ks-state" data-agy-id="station_no_results">
              <b>אוי לא, אין את הדגמים שחיפשת :(</b>
              <span>נסי לשנות את החיפוש או את המידה.</span>
              <button type="button" className="btn" onClick={() => { setQ(''); setSizes([]); setCategory(''); }}><KIcon id="x" size="sm" />נקה סינון</button>
            </div>
          ) : (
            <div id="resTiles" className="kp-tiles">
              {shown.map((m, i) => <ModelTile key={`${m.code || ''}-${m.name}-${i}`} model={m} inventory={inventory && !!date} hideImages={!!config.hideImages} />)}
            </div>
          )}
          {list.length > shown.length ? (
            <div className="row ks-center"><button type="button" className="btn" data-agy-id="station_more_btn" onClick={() => setLimit((n) => n + PAGE_SIZE)}><KIcon id="plus" size="sm" />הצג עוד דגמים</button></div>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function DateStep({ date, onSelect, onNext, onBack }) {
  const parsha = date ? parshaFooter(new HDate(date)) : '';
  return (
    <section className="kp-date" data-agy-id="station_date">
      <div className="kp-bar"><button type="button" className="btn ghost" onClick={onBack}><KIcon id="back" size="sm" />חזרה</button></div>
      <div className="ks-stephead">
        <h2 className="kiosk-headline">מתי האירוע?</h2>
        <p className="kp-lead">בוחרות תאריך, ורואות אילו שמלות פנויות באותו יום.</p>
      </div>
      <div className="kp-calwrap"><KioskCalendar selectedDate={date} onSelect={onSelect} /></div>
      <div className="ks-datesum" aria-live="polite">
        {date ? (<><span><span className="ds-label">נבחר:</span> <span className="ds-date">{formatHebrewDate(date)}</span></span>{parsha ? <small className="ks-parsha">{parsha}</small> : null}</>) : null}
      </div>
      <div className="row ks-center">
        <button type="button" className="btn primary kp-go" data-agy-id="station_show_models_btn" disabled={!date} onClick={onNext}>
          הצגת השמלות<svg className="ic" viewBox="0 0 28 20" style={{ width: 22, height: 16 }} aria-hidden="true"><path d="M26 10H6M14 3L6 10l8 7" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </section>
  );
}

export default function KioskPublic({ config }) {
  return (
    <A5Page name="gm-ks gm-kp">
      <PublicInner config={config} />
    </A5Page>
  );
}

function PublicInner({ config }) {
  const enabled = !!(config && config.enabled);
  const showCatalog = enabled; // הקטלוג (בלי מלאי) פתוח כל עוד הקישור דלוק
  const showInventory = enabled && !!config.showInventory;
  const showRegistration = enabled && !!config.showRegistration;
  const [view, setView] = useState('home'); // home | date | catalog | register
  const [date, setDate] = useState(null);

  const go = useCallback((v) => {
    setView(v);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!enabled) return <div className="kp-page"><Unavailable /></div>;

  return (
    <div className="kp-page" data-agy-id="station_root" data-view={view}>
      {view === 'home' ? (
        <section className="kp-home">
          <div className="kp-hero">
            <h1 className="kp-title">ברוכות הבאות!</h1>
            <p className="kp-lead">בודקות אילו שמלות פנויות לאירוע, ומשאירות פרטים כדי שנמשיך משם להזמנה.</p>
            <span className="kp-rule" aria-hidden="true" />
          </div>
          <div className="kp-cards">
            {showCatalog ? (
              <button type="button" className="kp-card" data-agy-id="station_open_catalog_btn" onClick={() => go(showInventory ? 'date' : 'catalog')}>
                <span className="kp-bubble"><KIcon id="dress" size="lg" /></span>
                <b>{showInventory ? 'בדיקת זמינות שמלה' : 'הדגמים שלנו'}</b>
                <span>{showInventory ? 'בוחרות תאריך אירוע, ורואות אילו דגמים ומידות פנויים.' : 'מחפשות לפי מספר דגם, שם או מידה.'}</span>
                <em>להתחלה<KIcon id="back" size="sm" /></em>
              </button>
            ) : null}
            {showRegistration ? (
              <button type="button" className="kp-card" data-agy-id="station_open_register_btn" onClick={() => go('register')}>
                <span className="kp-bubble kp-bubble-rose"><KIcon id="user" size="lg" /></span>
                <b>מילוי פרטים אישיים</b>
                <span>ממלאות פעם אחת, והעובדת תמשיך איתך להזמנה.</span>
                <em>למילוי הפרטים<KIcon id="back" size="sm" /></em>
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {view === 'date' ? <DateStep date={date} onSelect={setDate} onNext={() => go('catalog')} onBack={() => go('home')} /> : null}
      {view === 'catalog' ? <Catalog config={config} date={showInventory ? date : null} onChangeDate={() => go('date')} onBack={() => go('home')} /> : null}
      {view === 'register' && showRegistration ? (
        <KioskRegistration mode="public" rules={config.registration || null} onBack={() => go('home')} onDone={() => go('home')} />
      ) : null}
    </div>
  );
}
