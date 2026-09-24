'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '@/components/HebrewDatePicker';
import HebrewDateRangePicker from '@/components/HebrewDateRangePicker';
import ExportButtons from '../../components/ExportButtons';
import useDebounce from '@/hooks/useDebounce';
import { getHebrewDateString, getHebrewWeekdayFullName } from '@/lib/hebrewDate';
import { V3Page, Btn, Card, Chip, Tag, Tabs, Seg, Tip, Dialog, Empty, Icon } from '@/app/v3/ui/components';
import { TipBtn } from '@/components/ops-v3/OpsKit';

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const addDaysToIso = (iso, days) => {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

// 'YYYY-MM-DD' -> local Date (same construction as addDaysToIso, avoids the
// UTC-parse shift of `new Date(iso)`), for formatting the range-table day headers.
const isoToLocalDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// עקבי עם הפורמט שכבר קיים ב-board/page.js למודל "הזמנות ליום X (תאריך עברי)" -
// כותרת יום בטבלת טווח היא תאריך לוח-שנה תפעולי (לא תאריך אירוע של הזמנה ספציפית),
// ולכן מוצג לועזי+עברי יחד, כמו שם, ולא רק eventDateHebrew כמו בעמודת הטבלה הרגילה.
const formatRangeDayHeader = (iso) => {
  const date = isoToLocalDate(iso);
  return `${date.toLocaleDateString('he-IL')} (${getHebrewDateString(date)})`;
};

// יום היציאה/האיסוף המחושב (dispatchDates מ-/api/deliveries, רק כש-deliveries_select_by_event_date
// דולקת - התאריך שנבחר במסך הוא אז תאריך האירוע, ולכן יום היציאה/האיסוף כבר לא משתמע מהבחירה).
// עקבי עם כותרת הדפסת המשלוחן ("משלוח יוצא/נאסף <יום שבוע>", lib/deliveryCourier.js).
const formatDispatchHint = (direction, iso) => {
  const date = isoToLocalDate(iso);
  return `${direction === 'out' ? 'יוצא' : 'נאסף'} ${getHebrewWeekdayFullName(date)} ${date.toLocaleDateString('he-IL')}`;
};

// תוויות/צבעים/אייקונים לכל כיוון משלוח - עקבי עם שפת ה-badge/dot-badge של design-system.css.
// הלוך (יוצא ללקוח) מקבל גוון warning (כמו "הושכר"/"בקרוב" - "עוד לא אצלנו"), חזור (חוזר מהלקוח)
// מקבל גוון info (כמו "הוחזר חלקי" - "בדרך חזרה") - בחירה עיצובית, אין רפרנס מדויק לכיוונים האלו.
// label = טקסט לייצוא (נשאר כפי שהוא); short/variant/icon = תצוגה בעמוד בלבד.
const DIRECTION_META = {
  out: { label: 'משלוח הלוך', short: 'הלוך', variant: 'attn', icon: 'truck' },
  return: { label: 'משלוח חזור', short: 'חזור', variant: 'soft', icon: 'box' },
};

export default function DeliveriesPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [directionFilter, setDirectionFilter] = useState('all'); // 'all' | 'out' | 'return'
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  // 18 - טבלת טווח (שבוע/שבועיים/חודש) + עבר, מותנה ב-delivery_table_range_enabled
  const [rangeMode, setRangeMode] = useState('day'); // day | week | 2weeks | month
  const [rangeEnabled, setRangeEnabled] = useState(false);
  const [rangeRows, setRangeRows] = useState({}); // date -> rows
  // deliveries_select_by_event_date - התאריך שנבחר הוא תאריך האירוע (ולא יום הוצאה/חזרה)
  const [byEventDate, setByEventDate] = useState(false);

  // הדפסת/שליחת נתונים למשלוחן + הדפסת נתונים לשקית (§C/§D/§E,
  // docs/deliveries-feature-plan-2026-09-16.md) - מודל בחירה נפרד מטבלת התצוגה
  // (תאריך/כיוון עצמאיים, לא קשורים לבחירה הנוכחית בעמוד).
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printAction, setPrintAction] = useState('courier-print'); // courier-print | courier-email | bag-label
  const [printDirection, setPrintDirection] = useState('both'); // out | return | both
  const [printFrom, setPrintFrom] = useState(selectedDate);
  const [printTo, setPrintTo] = useState(selectedDate);
  const [printBagDate, setPrintBagDate] = useState(selectedDate);
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState(null); // { ok, message }

  const openPrintModal = (action) => {
    setPrintAction(action);
    setPrintFrom(selectedDate);
    setPrintTo(selectedDate);
    setPrintBagDate(selectedDate);
    setEmailResult(null);
    setShowPrintModal(true);
  };

  const submitPrintModal = async () => {
    if (printAction === 'bag-label') {
      window.open(`/print/delivery-bag?date=${printBagDate}`, '_blank');
      setShowPrintModal(false);
      return;
    }
    if (printAction === 'courier-print') {
      window.open(`/print/delivery-courier?direction=${printDirection}&from=${printFrom}&to=${printTo}`, '_blank');
      setShowPrintModal(false);
      return;
    }
    // courier-email
    setEmailSending(true);
    setEmailResult(null);
    try {
      const res = await fetch('/api/deliveries/courier-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: printDirection, fromDate: printFrom, toDate: printTo })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שליחת המייל נכשלה');
      setEmailResult({ ok: true, message: `המייל נשלח אל ${data.sentTo}` });
    } catch (err) {
      setEmailResult({ ok: false, message: err.message || 'שליחת המייל נכשלה' });
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' }).then(r => r.json()).then(arr => {
      const v = Array.isArray(arr) ? arr.find(s => s.key === 'delivery_table_range_enabled')?.value : null;
      if (v === 'true') setRangeEnabled(true);
      if (Array.isArray(arr) && arr.find(s => s.key === 'deliveries_select_by_event_date')?.value === 'true') setByEventDate(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // 18 - אם range מופעל ובחירת טווח, טוען כמה ימים (כולל עבר)
    const days = rangeEnabled && rangeMode !== 'day'
      ? (rangeMode === 'week' ? 7 : rangeMode === '2weeks' ? 14 : 30)
      : 1;
    const dates = [];
    for (let i = 0; i < days; i++) dates.push(addDaysToIso(selectedDate, i));
    Promise.all(dates.map(d => fetch(`/api/deliveries?date=${d}`, { cache: 'no-store' }).then(res => res.json()).then(data => ({ date: d, rows: data.data || [] })).catch(() => ({ date: d, rows: [] }))))
      .then(all => {
        if (cancelled) return;
        const map = {};
        for (const a of all) map[a.date] = a.rows;
        setRangeRows(map);
        setRows(map[selectedDate] || []);
      })
      .catch(err => {
        console.error(err);
        if (!cancelled) setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedDate, rangeMode, rangeEnabled]);

  // סינון כיוון + חיפוש חופשי מתבצעים על התוצאה של יום אחד (מצומצמת מטבעה) - בלי צורך
  // בעוד קריאת שרת על כל הקלדה, בדומה לסינוני viewMode/search המקומיים בטאבים אחרים.
  const filteredRows = useMemo(() => {
    const term = debouncedSearch.trim().toLowerCase();
    return rows
      .filter(r => directionFilter === 'all' || r.directions.includes(directionFilter))
      .filter(r => {
        if (!term) return true;
        return (
          String(r.orderId).includes(term) ||
          (r.customerName || '').toLowerCase().includes(term) ||
          (r.customerPhone || '').includes(term) ||
          (r.customerPhone2 || '').includes(term) ||
          (r.address || '').toLowerCase().includes(term)
        );
      });
  }, [rows, directionFilter, debouncedSearch]);

  const visibleDirections = (row) => directionFilter === 'all' ? row.directions : row.directions.filter(d => d === directionFilter);

  // §B (docs/deliveries-feature-plan-2026-09-16.md) - פילוח משלוחים לפי עיר, "פיצ'ר קטן
  // שיעזור" לפי הניסוח המקורי (בהשראת הסטטיסטיקות של ה-AI). בתצוגת טווח מסתכל על כל הימים
  // שנטענו (כמו טבלת הטווח עצמה - בלי חיפוש חופשי, שם ה-18/17 המקורי לא מסנן לפי חיפוש
  // בטבלת הטווח); ביום בודד מסתכל בדיוק על filteredRows (כולל חיפוש), עקבי עם הטבלה הראשית.
  const cityBreakdown = useMemo(() => {
    const sourceRows = (rangeEnabled && rangeMode !== 'day')
      ? Object.values(rangeRows).flat().filter(r => directionFilter === 'all' || r.directions.includes(directionFilter))
      : filteredRows;
    const counts = {};
    for (const r of sourceRows) {
      const city = (r.city || '').trim() || 'לא ידוע';
      counts[city] = (counts[city] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rangeEnabled, rangeMode, rangeRows, filteredRows, directionFilter]);

  // שורת טבלה משותפת לטבלה הראשית (יום נבחר) ולטבלאות לכל יום בתצוגת טווח (18) -
  // כדי שתצוגת הטווח תציג טבלה אמיתית לכל יום (כל העמודות), לא רק רשימת טקסט
  // מצומצמת (עד 8 שורות, בלי כתובת/דגמים/חיוב) כמו קודם.
  const renderDeliveryRow = (row) => (
    <tr key={row.orderId}>
      <td>
        <div className="ops-cell-stack">
          <span className="ops-strong">{row.customerName}</span>
          <Link href={`/orders/${row.orderId}`} className="ops-link">הזמנה <bdi>#{row.orderId}</bdi></Link>
          {row.customerPhone && <span className="ops-ltr ops-muted">{row.customerPhone}</span>}
          {row.customerPhone2 && <span className="ops-ltr ops-muted">{row.customerPhone2}</span>}
        </div>
      </td>
      <td>{row.address || <span className="ops-muted">-</span>}</td>
      <td>{row.dressModelNames.length > 0 ? row.dressModelNames.join(', ') : <span className="ops-muted">-</span>}</td>
      <td className="ops-strong">{row.eventDateHebrew || '-'}</td>
      <td>
        <div className="ops-dirs">
          {visibleDirections(row).map(d => (
            <div key={d} className="ops-dir">
              <Tag variant={DIRECTION_META[d].variant} icon={DIRECTION_META[d].icon}>{DIRECTION_META[d].short}</Tag>
              {row.dispatchDates?.[d] && <span className="ops-muted v3-text-sm">{formatDispatchHint(d, row.dispatchDates[d])}</span>}
              {row.chargeExists[d] ? (
                <Chip variant="done" icon="check">חיוב נוצר</Chip>
              ) : (
                <span className="ops-muted v3-text-sm">עדיין בלי חיוב</span>
              )}
            </div>
          ))}
        </div>
      </td>
    </tr>
  );

  const tableHead = (
    <thead>
      <tr>
        <th scope="col">לקוח</th>
        <th scope="col">כתובת</th>
        <th scope="col">דגמים</th>
        <th scope="col">אירוע</th>
        <th scope="col">משלוח</th>
      </tr>
    </thead>
  );

  const goPrevDay = () => setSelectedDate(d => addDaysToIso(d, -1));
  const goNextDay = () => setSelectedDate(d => addDaysToIso(d, 1));
  const goToday = () => setSelectedDate(todayIso());

  const exportData = filteredRows.map(r => ({
    ...r,
    directionsLabel: visibleDirections(r).map(d => DIRECTION_META[d].label).join(' + '),
    dressModelsLabel: r.dressModelNames.join(' | '),
    dispatchLabel: r.dispatchDates ? visibleDirections(r).map(d => formatDispatchHint(d, r.dispatchDates[d])).join(' | ') : '',
    chargeStatusLabel: visibleDirections(r).map(d => `${DIRECTION_META[d].label}: ${r.chargeExists[d] ? 'נוצר חיוב' : 'טרם נוצר חיוב'}`).join(' | '),
  }));

  const directionTabs = [
    { key: 'all', label: 'הכל', icon: 'list' },
    { key: 'out', label: 'הלוך בלבד', icon: 'truck' },
    { key: 'return', label: 'חזור בלבד', icon: 'box' },
  ];
  const rangeTabs = [
    { key: 'day', label: 'יום' },
    { key: 'week', label: 'שבוע' },
    { key: '2weeks', label: 'שבועיים' },
    { key: 'month', label: 'חודש' },
  ];
  const printTabs = [
    { key: 'courier-print', label: 'הדפסה למשלוחן', icon: 'printer' },
    { key: 'courier-email', label: 'מייל למשלוחן', icon: 'mail' },
    { key: 'bag-label', label: 'נתוני שקית', icon: 'bag' },
  ];
  const printDirectionOptions = [
    { value: 'both', label: 'הלוך וחזור' },
    { value: 'out', label: 'הלוך' },
    { value: 'return', label: 'חזור' },
  ];
  const closePrintModal = () => { if (!emailSending) setShowPrintModal(false); };

  return (
    <V3Page>
      <div className="v3-pagehead ops-head">
        <div className="v3-pagehead__title ops-head__title">
          <h1 className="v3-h1"><Icon name="truck" />משלוחים</h1>
          <div className="v3-muted">רשומות: <bdi>{loading ? '...' : filteredRows.length}</bdi></div>
        </div>
        <div className="v3-pagehead__tools">
          <Btn variant="primary" icon="printer" onClick={() => openPrintModal('courier-print')}>הדפסה ושליחה</Btn>
          <ExportButtons
            data={exportData}
            filename="משלוחים"
            columns={[
              { key: 'orderId', label: 'קוד הזמנה' },
              { key: 'customerName', label: 'לקוח' },
              { key: 'customerPhone', label: 'טלפון 1' },
              { key: 'customerPhone2', label: 'טלפון 2' },
              { key: 'address', label: 'כתובת' },
              { key: 'eventDateHebrew', label: 'תאריך אירוע' },
              { key: 'dressModelsLabel', label: 'דגמים' },
              { key: 'directionsLabel', label: 'כיוון משלוח' },
              ...(byEventDate ? [{ key: 'dispatchLabel', label: 'יציאה/איסוף' }] : []),
              { key: 'chargeStatusLabel', label: 'סטטוס חיוב' },
            ]}
            iconOnly={true}
          />
        </div>
      </div>

      {/* ניווט תאריך: קודם/היום/הבא + בורר תאריך עברי מלא */}
      <div className="ops-toolbar ops-toolbar--center">
        <TipBtn icon="chevron-end" label="היום הקודם" onClick={goPrevDay} />
        <Btn variant="secondary" size="sm" onClick={goToday}>היום</Btn>
        <TipBtn icon="chevron-start" label="היום הבא" onClick={goNextDay} />
        <div className="ops-picker ops-picker--sm">
          <HebrewDatePicker value={selectedDate} onChange={setSelectedDate} />
        </div>
        {byEventDate && <Tip>התאריך שנבחר הוא תאריך האירוע: מוצגים משלוחים של הזמנות שהאירוע שלהן ביום הזה.</Tip>}
      </div>

      <div className="ops-toolbar">
        <div className="v3-search ops-search ops-search--max">
          <Icon name="search" />
          <input
            type="text"
            aria-label="חיפוש משלוח"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="הזמנה, לקוח, טלפון או כתובת"
          />
          <div className="ops-search__acts">
            {search && <TipBtn icon="x" label="ניקוי החיפוש" variant="quiet" size="sm" onClick={() => setSearch('')} />}
          </div>
        </div>
      </div>

      <div className="ops-section">
        <Tabs label="סינון לפי כיוון משלוח" items={directionTabs} value={directionFilter} onChange={setDirectionFilter} />
      </div>
      {rangeEnabled && (
        <div className="ops-section">
          <Tabs label="טווח תצוגה" items={rangeTabs} value={rangeMode} onChange={setRangeMode} />
        </div>
      )}

      {/* §B - פילוח משלוחים לפי עיר, למשל "ירושלים: 3 · קרית ספר: 2 · ביתר: 5" */}
      {!loading && cityBreakdown.length > 0 && (
        <Card icon="pin" title="לפי עיר" variant="quiet" className="ops-section">
          <div className="ops-chips">
            {cityBreakdown.map(([city, count]) => (
              <Chip key={city}>{city}: <bdi>{count}</bdi></Chip>
            ))}
          </div>
        </Card>
      )}

      {/* 18 - תצוגת טווח: טבלה מלאה (כל העמודות) לכל יום בטווח, כולל עבר */}
      {rangeEnabled && rangeMode !== 'day' && (
        <div className="ops-section">
          <h2 className="v3-h2 ops-range-title">משלוחים בטווח: {rangeMode === 'week' ? 'שבוע' : rangeMode === '2weeks' ? 'שבועיים' : 'חודש'}</h2>
          {Object.keys(rangeRows).sort().map(d => {
            const dayRows = (rangeRows[d] || []).filter(r => directionFilter === 'all' || r.directions.includes(directionFilter));
            if (dayRows.length === 0) return null;
            return (
              <Card key={d} level={3} icon="calendar" title={<>{byEventDate ? 'אירועים ב-' : ''}{formatRangeDayHeader(d)} · <bdi>{dayRows.length}</bdi> משלוחים</>} className="ops-section">
                <div className="v3-table__wrap">
                  <table className="v3-table">
                    {tableHead}
                    <tbody>
                      {dayRows.map(renderDeliveryRow)}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <div className="ops-tablecard">
        <div className="v3-table__wrap">
          <table className="v3-table">
            {tableHead}
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5"><div className="v3-empty" role="status"><span className="v3-spin" aria-hidden="true" /><span>טוען…</span></div></td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan="5">
                    <Empty
                      icon="truck"
                      title={byEventDate ? 'אין משלוחים לאירועים ביום הזה' : 'אין משלוחים ליום הזה'}
                      text={byEventDate ? 'לא נמצאו הזמנות עם משלוח שהאירוע שלהן בתאריך שנבחר.' : 'לא נמצאו הזמנות עם משלוח הלוך או חזור בתאריך שנבחר.'}
                    />
                  </td>
                </tr>
              ) : filteredRows.map(renderDeliveryRow)}
            </tbody>
          </table>
        </div>
        <div className="ops-foot">
          <span>רשומות: <bdi>{loading ? '...' : filteredRows.length}</bdi></span>
        </div>
      </div>

      {/* חלונית "הדפסה ושליחה" (§C/§D/§E) - 3 פעולות: הדפסה למשלוחן, שליחה במייל, נתוני שקית. יש בה שדות ← בהיר בלבד */}
      <Dialog
        open={showPrintModal}
        onClose={closePrintModal}
        closeOnScrim={!emailSending}
        variant="form"
        icon="printer"
        title="הדפסה ושליחה"
        actions={
          <>
            <Btn variant="primary" icon={printAction === 'courier-email' ? 'send' : 'printer'} loading={emailSending} onClick={submitPrintModal}>
              {printAction === 'courier-email' ? (emailSending ? 'שולח…' : 'שליחה') : 'הדפסה'}
            </Btn>
            <Btn variant="quiet" onClick={() => setShowPrintModal(false)} disabled={emailSending}>ביטול</Btn>
          </>
        }
      >
        <div className="ops-form-grid">
          <Tabs
            label="סוג פעולה"
            items={printTabs}
            value={printAction}
            onChange={(k) => { setPrintAction(k); setEmailResult(null); }}
          />

          {printAction === 'bag-label' ? (
            <div className="v3-field">
              <span className="v3-label">{byEventDate ? 'תאריך האירוע' : 'תאריך'} <Tip>נתוני שקית מודפסים למשלוחי הלוך בלבד.</Tip></span>
              <HebrewDatePicker value={printBagDate} onChange={setPrintBagDate} />
            </div>
          ) : (
            <>
              <div className="v3-field">
                <span className="v3-label">כיוון</span>
                <Seg label="כיוון משלוח" options={printDirectionOptions} value={printDirection} onChange={setPrintDirection} />
              </div>
              <div className="v3-field">
                <span className="v3-label">{byEventDate ? 'תאריכי האירוע' : 'תאריכים'}</span>
                <HebrewDateRangePicker startDate={printFrom} endDate={printTo} onChange={(start, end) => { setPrintFrom(start); setPrintTo(end); }} />
              </div>
            </>
          )}

          {emailResult && (
            <div className={`ops-result ${emailResult.ok ? 'ops-result--ok' : 'ops-result--bad'}`} role="status">
              <Icon name={emailResult.ok ? 'check-circle' : 'alert-circle'} />
              <span>{emailResult.message}</span>
            </div>
          )}
        </div>
      </Dialog>
    </V3Page>
  );
}
