'use client';

// חלון "בדוק תפוסה" של אשף "הזמנה חדשה" (A5) בפלטה - R22 (הבעלים: "להוסיף מתג רשימה / לוח"): שני החלונות הישנים
// (components/orders/ItemCapacityModal.js - מהסל, components/CapacitySearchModal.js - "רגע, בדקת מלאי?") נבנו מחדש כחלון #dlg2 כהה
// (כמו capacityDlg / capacitySearchDlg בעיצוב המאושר תצוגות-עיצוב/הזמנה-חדשה.html), עם מתג רשימה / לוח (הלוח = הלוח העברי של האשף, .hc).
// אותם נתונים, אותן נקודות קצה ואותה התנהגות כמו בישן: GET /api/inventory/capacity (+ models / sizes), היסטוריית חיפושים ב-localStorage,
// אותן הודעות שגיאה. הלוגיקה הטהורה ב-noCapacityLogic.js (נבדקת מול הישן ב-scripts/new-order-tests/capacity.test.mjs).
// החלון נטען ב-portal לשורש הדף (NoPortal) בתוך DialogFrame - הוא לא חלון עם תשובה (ask) אלא מצב של הבקר (capacityItem / showCapacitySearch).
import { useEffect, useMemo, useRef, useState } from 'react';
import { getIsraelTodayKey } from '../../../lib/hebrewDate';
import { Ic, Note, SegPill } from './NoUi';
import NoHebrewCalendar, { holidaysOn, parshaOn } from './NoHebrewCalendar';
import { DialogFrame } from './NoDialogs';
import * as C from './noCapacityLogic';
import { dow, hebrewLong, hebrewMonthTitle, hebrewParts, WEEKDAYS_SHORT, addDays, monthLength } from '../schedule/hebrewCalendar';

const shortHeb = (key) => { if (!key) return ''; const h = hebrewParts(key); return `${h.dl} ${h.m}`; };
const hebWithYear = (key) => { if (!key) return ''; const h = hebrewParts(key); return `${h.dl} ${h.m} ${h.y}`; };
const orderLink = (o) => `/orders/${o.orderId}`;
const openOrder = (o) => { try { window.open(orderLink(o), '_blank', 'noopener,noreferrer'); } catch { /* */ } };

const VIEW_OPTIONS = [
  { v: 'list', label: 'תצוגת רשימה', icon: 'list', tip: 'רשימת ההזמנות התופסות' },
  { v: 'board', label: 'תצוגת לוח', icon: 'cal', tip: 'לוח חודשי עברי עם התפוסה בכל יום' },
];

// ---------- סיכום: במלאי / בתפוסה / רזרבה (.glance כמו בעיצוב) ----------
function Glance({ results, occLabel, reserveLabel }) {
  return (
    <div className="glance no-cap-glance">
      <span className="gl" tabIndex={0}><Ic n="box" /><span className="gv">במלאי {results.inStock}</span></span>
      <span className="gl" tabIndex={0}><Ic n="cal" /><span className="gv">{occLabel} {results.occupiedCount}</span></span>
      <span className={`gl ${results.reserve > 0 ? 'ok' : 'no'}`} tabIndex={0}><Ic n="check" /><span className="gv">{reserveLabel} {results.reserve}</span></span>
    </div>
  );
}

// ---------- רשימה: הטבלה של הפלטה (.tblw > .rtbl) ----------
function OccupiedTable({ orders, actionHead, actionLabel, currentOrderId }) {
  return (
    <div className="tblw">
      <table className="rtbl">
        <thead><tr><th>תאריך אירוע</th><th>שם לקוח</th><th>כמות בתפוסה</th><th>{actionHead}</th></tr></thead>
        <tbody>
          {C.sortOccupied(orders).map((o) => {
            const key = C.dayKeyOf(o.eventDate);
            const isCurrent = currentOrderId != null && String(o.orderId) === String(currentOrderId);
            return (
              <tr key={o.id} className={isCurrent ? 'no-cap-cur' : undefined}>
                <td>
                  {key ? <>{shortHeb(key)} <span className="faint sm">{hebrewParts(key).y}</span></> : (o.eventDateHebrew || 'לא צוין')}
                  {isCurrent ? <> <span className="chip gold">הזמנה נוכחית</span></> : null}
                </td>
                <td>{o.customerName}</td>
                <td>{o.quantity}</td>
                <td><a className="btn sm" href={orderLink(o)} target="_blank" rel="noopener noreferrer"><Ic n="ext" c="sm" />{actionLabel}</a></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function NoneFree() {
  return (
    <div className="empty no-cap-free"><b>אין הזמנות תפוסות בטווח התאריכים</b><div>הפריט פנוי לחלוטין בתאריכים אלו.</div></div>
  );
}

// ---------- לוח: הלוח העברי של האשף (.hc) עם התפוסה בכל יום ----------
// כמו CapacityCalendar בישן: יום עם הזמנה (eventDate עד returnDate) צבוע ומציג "N תפוס"; יום מחוץ לטווח מעומעם; לחיצה על יום עם הזמנה אחת פותחת אותה
// (בכרטיס חדש); ביום עם כמה הזמנות - הרשימה מוצגת מתחת ללוח (בישן: רק בטולטיפ). חודש אחד בכל פעם, ניווט בין חודשי הטווח.
function OccupancyBoard({ fromKey, toKey, orders, startKey, today }) {
  const months = useMemo(() => C.boardMonths(fromKey, toKey), [fromKey, toKey]);
  // החודש שמכיל את תאריך ההתחלה (תאריך האירוע / תחילת הטווח); אחרת הראשון
  const initial = useMemo(() => {
    const k = startKey || fromKey;
    let at = 0;
    months.forEach((m, i) => { if (k >= m) at = i; });
    return at;
  }, [months, startKey, fromKey]);
  const [idx, setIdx] = useState(initial);
  const [picked, setPicked] = useState(null);
  const month = months[Math.min(idx, months.length - 1)];
  const cells = useMemo(() => {
    if (!month) return [];
    const out = [];
    const first = dow(month);
    for (let i = 0; i < first; i++) out.push({ empty: true, k: 'e' + i });
    for (let i = 0; i < monthLength(month); i++) {
      const d = addDays(month, i);
      const occ = C.occupancyOn(orders, d);
      out.push({ k: d, d, h: hebrewParts(d), hol: holidaysOn(d), parsha: parshaOn(d), occ, out: d < fromKey || d > toKey });
    }
    return out;
  }, [month, orders, fromKey, toKey]);
  if (!month) return null;
  const pickedCell = picked ? cells.find((c) => c.d === picked) : null;
  const onDay = (c) => {
    if (c.out || !c.occ.total) { setPicked(null); return; }
    if (c.occ.orders.length === 1) { setPicked(null); openOrder(c.occ.orders[0]); return; }
    setPicked(c.d === picked ? null : c.d);
  };
  const go = (n) => { setPicked(null); setIdx((i) => Math.max(0, Math.min(months.length - 1, i + n))); };
  return (
    <div>
      <div className="hc no-cap-board" data-start={month}>
        <div className="hc-h">
          <button type="button" className="hc-n" aria-label="החודש הקודם" disabled={idx <= 0} onClick={() => go(-1)}><Ic n="chev" c="sm" /></button>
          <b className="hc-t" aria-live="polite">{hebrewMonthTitle(month)}</b>
          <button type="button" className="hc-n hc-nn" aria-label="החודש הבא" disabled={idx >= months.length - 1} onClick={() => go(1)}><Ic n="chev" c="sm" /></button>
        </div>
        <div className="hc-w" aria-hidden="true">{WEEKDAYS_SHORT.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="hc-g" role="grid">
          {cells.map((c) => (c.empty ? <span key={c.k} className="hc-e" /> : (
            <button
              key={c.k}
              type="button"
              className={`hc-d${dow(c.d) === 6 ? ' sh' : ''}${c.hol.length ? ' hasH' : ''}${c.occ.total ? ' occ' : ''}${c.out ? ' out' : ''}${picked === c.d ? ' on' : ''}${c.d === today ? ' today' : ''}`}
              data-hd={c.d}
              aria-label={`${hebrewLong(c.d)}${c.occ.total ? ` - ${c.occ.total} בתפוסה` : ''}`}
              data-tip={c.occ.orders.length ? c.occ.orders.map((o) => `${o.customerName || 'לא ידוע'} (#${o.orderId})`).join(' · ') : undefined}
              disabled={c.out}
              onClick={() => onDay(c)}
            >
              <span className="hc-n1">{c.h.dl}</span>
              {c.hol.map((h) => <small key={h} className="hc-p hc-hol">{h}</small>)}
              {c.occ.total ? <small className="hc-p hc-occ">{c.occ.total} תפוס</small> : null}
            </button>
          )))}
        </div>
      </div>
      {pickedCell ? (
        <div className="chg no-cap-day" style={{ marginTop: 14 }}>
          {pickedCell.occ.orders.map((o) => (
            <div className="c" key={o.id}>
              <div className="ico rose no-chg-ico"><Ic n="user" c="sm" /></div>
              <div className="t">
                <b>{o.customerName || 'לא ידוע'}</b> <span className="chip red">{o.quantity}</span>
                <div className="faint sm">הזמנה #{o.orderId} · {hebWithYear(C.dayKeyOf(o.eventDate))}</div>
              </div>
              <a className="btn sm" href={orderLink(o)} target="_blank" rel="noopener noreferrer"><Ic n="ext" c="sm" />פתח</a>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------- כותרת + גוף משותפים לתוצאות ----------
function ResultsView({ results, view, setView, showToggle, range, startKey, today, actionHead, actionLabel, currentOrderId }) {
  return (
    <>
      {showToggle ? (
        <div className="row" style={{ justifyContent: 'center', margin: '4px 0 14px' }}>
          <SegPill id="capView" options={VIEW_OPTIONS} value={view} onChange={setView} label="תצוגת התוצאות" />
        </div>
      ) : null}
      {view === 'board' && range.fromDate
        ? <OccupancyBoard fromKey={range.fromDate} toKey={range.toDate} orders={results.occupiedOrders || []} startKey={startKey} today={today} />
        : null}
      {view === 'list'
        ? (results.occupiedCount > 0 ? <OccupiedTable orders={results.occupiedOrders || []} actionHead={actionHead} actionLabel={actionLabel} currentOrderId={currentOrderId} /> : <NoneFree />)
        : null}
    </>
  );
}

// ---------- בדוק תפוסה לפריט מהסל (ItemCapacityModal) ----------
export function ItemCapacityDialog({ item, order, currentOrderId, onClose }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('list');
  const [range, setRange] = useState({ fromDate: null, toDate: null });
  const today = useMemo(() => getIsraelTodayKey(), []);
  const eventKey = C.dayKeyOf(order && order.eventDate);

  useEffect(() => {
    let off = false;
    const pre = C.itemCapacityPrecheck(item, order);
    if (pre) { setError(pre); setResults(null); return undefined; }
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = C.itemCapacityRange(order.eventDate);
        setRange(r);
        let prefix = C.itemCapacityPrefix(item);
        const modelId = C.itemCapacityModelId(item);
        if (!prefix && modelId) {
          const mRes = await fetch('/api/inventory/models');
          const mData = await mRes.json();
          const model = mData.models && mData.models.find(m => m.id === modelId);
          if (model) prefix = model.barcodePrefix;
        }
        if (!prefix) throw new Error('לא נמצא קוד פריט');
        const res = await fetch(`/api/inventory/capacity?${C.capacityQuery({ barcodePrefix: prefix, size: C.itemCapacityActualSize(item), fromDate: r.fromDate, toDate: r.toDate })}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'שגיאה בטעינת נתונים');
        if (!off) setResults(data);
      } catch (err) {
        if (!off) setError(err.message);
      } finally {
        if (!off) setLoading(false);
      }
    })();
    return () => { off = true; };
  }, [item, order && order.eventDate]);

  const name = (item.dressItem && item.dressItem.dress && item.dressItem.dress.name) || item.description || 'פריט';
  return (
    <DialogFrame layer={2} cls="capwin" onBackdrop={onClose}>
      <h2>זמינות: {name} ({item.sizeText || item.size || 'ללא מידה'})</h2>
      <div className="sub">
        {eventKey ? <>תאריך אירוע: {hebrewLong(eventKey)} </> : null}
        <span className="faint">(מוצג טווח של חודש לפני ואחרי)</span>
      </div>
      {loading ? <div className="muted no-cap-load" role="status" aria-live="polite">טוען נתוני תפוסה...</div> : null}
      {error ? <Note>{error}</Note> : null}
      {results && !loading ? (
        <>
          <Glance results={results} occLabel="בתפוסה מתוכננת" reserveLabel="רזרבה זמינה" />
          <ResultsView results={results} view={view} setView={setView} showToggle={results.occupiedCount > 0} range={range} startKey={eventKey} today={today}
            actionHead="הזמנה" actionLabel="צפה בהזמנה" currentOrderId={currentOrderId} />
        </>
      ) : null}
      <div className="dbtns" style={{ marginTop: 16 }}>
        <button type="button" className="btn ghost block" data-autofocus onClick={onClose}><Ic n="x" c="sm" />סגירה</button>
      </div>
    </DialogFrame>
  );
}

// ---------- חיפוש תפוסה (CapacitySearchModal) ----------
function readHistory() {
  try { const v = JSON.parse(localStorage.getItem(C.CAPACITY_HISTORY_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

export function CapacitySearchDialog({ onClose }) {
  const today = useMemo(() => getIsraelTodayKey(), []);
  const [barcodePrefix, setBarcodePrefix] = useState('');
  const [size, setSize] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [resultRange, setResultRange] = useState({ fromDate: '', toDate: '' });
  const [error, setError] = useState('');
  const [view, setView] = useState('list');
  const [sizes, setSizes] = useState([]);
  const [models, setModels] = useState([]);
  const [modelQuery, setModelQuery] = useState('');
  const [showModelList, setShowModelList] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { setSearchHistory(readHistory()); }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/inventory/models?hasActiveItems=true');
        if (res.ok) { const data = await res.json(); setModels(data.models || []); }
      } catch (err) { console.error('Error fetching models', err); }
    })();
  }, []);

  useEffect(() => {
    if (!barcodePrefix) { setSizes([]); setSize(''); return; }
    (async () => {
      try {
        const res = await fetch(`/api/inventory/sizes?barcodePrefix=${barcodePrefix}`);
        if (res.ok) { const data = await res.json(); setSizes(data.sizes || []); }
      } catch (e) { console.error(e); }
    })();
  }, [barcodePrefix]);

  // כמו הישן: שדה החיפוש מסתנכרן כשהדגם נקבע ממקום אחר (היסטוריה), ומתרוקן כשאין דגם
  useEffect(() => {
    if (!barcodePrefix) { setModelQuery(''); return; }
    const m = models.find(mm => mm.barcodePrefix === barcodePrefix);
    if (m) setModelQuery(C.modelLabel(m));
  }, [barcodePrefix, models]);

  const filteredModels = useMemo(() => C.filterModels(models, modelQuery), [models, modelQuery]);

  const performSearch = async (searchParams = null) => {
    const pPrefix = searchParams ? searchParams.barcodePrefix : barcodePrefix;
    const pSize = searchParams ? searchParams.size : size;
    const pEmployeeCode = searchParams ? searchParams.employeeCode : employeeCode;
    const pCustomerName = searchParams ? searchParams.customerName : customerName;
    if (!pPrefix || !pSize) { setError(C.SEARCH_NEEDS_MODEL_AND_SIZE); return; }
    const r = C.resolveSearchRange(searchParams ? searchParams.fromDate : fromDate, searchParams ? searchParams.toDate : toDate, today);
    if (!searchParams) { if (!fromDate) setFromDate(r.fromDate); if (!toDate) setToDate(r.toDate); }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/capacity?${C.capacityQuery({ barcodePrefix: pPrefix, size: pSize, fromDate: r.fromDate, toDate: r.toDate })}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בחיפוש');
      setResults(data);
      setResultRange(r);
      const updated = C.pushHistory(readHistory(), C.buildHistoryEntry({ employeeCode: pEmployeeCode, customerName: pCustomerName, barcodePrefix: pPrefix, size: pSize, fromDate: r.fromDate, toDate: r.toDate }));
      try { localStorage.setItem(C.CAPACITY_HISTORY_KEY, JSON.stringify(updated)); } catch { /* */ }
      setSearchHistory(updated);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setBarcodePrefix(''); setModelQuery(''); setSize(''); setFromDate(''); setToDate(''); setEmployeeCode(''); setCustomerName('');
    setResults(null); setError(''); setShowCal(false);
  };

  const pickModel = (m) => { setBarcodePrefix(m.barcodePrefix); setModelQuery(C.modelLabel(m)); setSize(''); setShowModelList(false); };
  const clearModel = () => { setBarcodePrefix(''); setModelQuery(''); setSize(''); setShowModelList(true); requestAnimationFrame(() => inputRef.current && inputRef.current.focus()); };
  const rangeLabel = fromDate || toDate ? `${shortHeb(fromDate || today)} ← ${shortHeb(toDate || today)}` : null;

  return (
    <DialogFrame layer={2} cls="capwin" onBackdrop={onClose}>
      <h2>חיפוש תפוסה</h2>
      <div className="sub">בדיקת תפוסה של דגם ומידה בטווח תאריכים</div>
      <div className="row" style={{ justifyContent: 'center', marginBottom: 14 }}>
        <button type="button" className="btn sm" aria-expanded={showHistory} onClick={() => setShowHistory(!showHistory)}><Ic n="sn-history" c="sm" />{showHistory ? 'הסתר חיפושים קודמים' : 'חיפושים קודמים'}</button>
      </div>
      {showHistory ? (
        <div className="chg no-cap-hist" style={{ marginBottom: 16, maxHeight: 220, overflowY: 'auto' }}>
          {searchHistory.length === 0 ? <div className="muted sm" style={{ textAlign: 'center', padding: 14 }}>לא נמצאו חיפושים</div> : searchHistory.map((h) => {
            const modelName = (models.find(m => String(m.barcodePrefix) === String(h.barcodePrefix)) || {}).name || h.barcodePrefix;
            const when = new Date(h.timestamp);
            return (
              <div className="c" key={h.id}>
                <div className="ico rose no-chg-ico"><Ic n="sn-history" c="sm" /></div>
                <div className="t">
                  <b>{modelName}</b> <span className="chip">{h.size}</span>
                  <div className="faint sm">{h.fromDate || h.toDate ? <>{shortHeb(h.fromDate)} - {shortHeb(h.toDate)} · </> : null}{h.employeeCode ? <>עובד: {h.employeeCode} · </> : null}{shortHeb(C.dayKeyOf(when))}, {when.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                </div>
                <button type="button" className="btn sm" onClick={() => {
                  setEmployeeCode(h.employeeCode || ''); setCustomerName(h.customerName || ''); setBarcodePrefix(h.barcodePrefix || ''); setSize(h.size || '');
                  setFromDate(h.fromDate || ''); setToDate(h.toDate || ''); setShowHistory(false);
                  performSearch({ employeeCode: h.employeeCode || '', customerName: h.customerName || '', barcodePrefix: h.barcodePrefix || '', size: h.size || '', fromDate: h.fromDate || '', toDate: h.toDate || '' });
                }}><Ic n="check" c="sm" />בחר</button>
              </div>
            );
          })}
        </div>
      ) : null}
      <>
        <div className="mfld" style={{ position: 'relative' }}>
          <label className="lbl with-ic" htmlFor="noCapModel"><Ic n="dress" c="sm" />דגם</label>
          <div className="inpw">
            <input className="inp" id="noCapModel" ref={inputRef} placeholder="הקלד לחיפוש דגם..." autoComplete="off" role="combobox" aria-expanded={showModelList && !barcodePrefix} aria-controls="noCapModels"
              value={modelQuery}
              onChange={(e) => { setModelQuery(e.target.value); setShowModelList(true); if (barcodePrefix) { setBarcodePrefix(''); setSize(''); } }}
              onFocus={(e) => { setShowModelList(true); if (barcodePrefix) e.target.select(); }}
              onBlur={() => setShowModelList(false)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } }} data-autofocus />
            {barcodePrefix ? <button type="button" className="inpx" aria-label="נקה בחירה" data-tip="נקה בחירה" onClick={clearModel}><Ic n="x" c="sm" /></button> : null}
          </div>
          {showModelList && !barcodePrefix && filteredModels.length > 0 ? (
            <ul className="advlist advstatic no-cap-models" id="noCapModels" role="listbox" aria-label="דגמים">
              {filteredModels.map((m) => (
                <li key={m.id || m.barcodePrefix} role="option" aria-selected="false" className="advo" onMouseDown={(e) => { e.preventDefault(); pickModel(m); }}>
                  <span className="advo-t">{m.name}</span><span className="muted sm" style={{ marginInlineStart: 'auto' }}><bdi>{m.barcodePrefix}</bdi></span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="mfld" style={{ marginTop: 12 }}>
          <label className="lbl with-ic" htmlFor="noCapSize"><Ic n="tag" c="sm" />מידה</label>
          <div className="inpw">
            <select className="inp" id="noCapSize" value={size} onChange={(e) => setSize(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); performSearch(); } }} disabled={!barcodePrefix || sizes.length === 0}>
              <option value="">{!barcodePrefix ? 'בחר דגם תחילה' : (sizes.length === 0 ? 'אין מידות לדגם' : 'בחר מידה...')}</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="mfld" style={{ marginTop: 12 }}>
          <span className="lbl with-ic"><Ic n="cal" c="sm" />טווח תאריכים</span>
          <div className="row spread wrap" style={{ gap: 10 }}>
            <span className="muted sm">{rangeLabel || `${shortHeb(today)} ← ${shortHeb(C.searchRangeDefaults(today).toDate)} (ברירת מחדל: חצי שנה קדימה)`}</span>
            <button type="button" className="btn sm" aria-expanded={showCal} onClick={() => setShowCal(!showCal)}><Ic n="cal" c="sm" />{showCal ? 'סגירת הלוח' : 'שינוי טווח'}</button>
          </div>
          {showCal ? (
            <div style={{ marginTop: 10 }}>
              <NoHebrewCalendar mode="range" from={fromDate} to={toDate} today={today} onRange={(a, b) => { setFromDate(a); setToDate(b); setShowCal(false); }} />
              <div className="muted sm" style={{ marginTop: 6 }}>בחרו את היום הראשון ואחר כך את האחרון.</div>
            </div>
          ) : null}
        </div>
        {error ? <Note style={{ marginTop: 14 }}>{error}</Note> : null}
        {results ? (
          <div className="no-cap-res" style={{ marginTop: 14 }}>
            <Glance results={results} occLabel="בתפוסה" reserveLabel="רזרבה" />
            <ResultsView results={results} view={view} setView={setView} showToggle range={resultRange} startKey={resultRange.fromDate} today={today}
              actionHead="פעולות" actionLabel="פתח" currentOrderId={null} />
          </div>
        ) : null}
        <div className="dbtns" style={{ marginTop: 16 }}>
          <button type="button" className="btn primary lg block" disabled={loading} aria-busy={loading} onClick={() => performSearch()}><Ic n="search" />{loading ? 'מחפש...' : 'חפש'}</button>
          <button type="button" className="btn block" onClick={handleClear}><Ic n="eraser" c="sm" />נקה הכל</button>
          <button type="button" className="btn ghost block" onClick={onClose}><Ic n="x" c="sm" />סגירה</button>
        </div>
      </>
    </DialogFrame>
  );
}
