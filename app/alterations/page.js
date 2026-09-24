'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import PrintWizardModal from '../components/PrintWizardModal';
import HebrewDatePicker from '../../components/HebrewDatePicker';
import HebrewDateRangePicker from '../../components/HebrewDateRangePicker';
import { getHebrewDateString } from '../../lib/hebrewDate';
import ExportButtons from '../../components/ExportButtons';
import StatisticsModal from '../components/StatisticsModal';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildAlterationsListUrl } from '@/app/lib/prefetchRoutes';
import { V3Page, Btn, Chip, Tag, Tabs, Tip, Dialog, Empty, Banner, Icon } from '@/app/v3/ui/components';
import { TipBtn, SearchBar, useOpsDialogs, dlgMode } from '@/components/ops-v3/OpsKit';
import { enqueueNotice } from '@/app/v3/notify/store';

// מטמון SWR משותף — ראה app/lib/pageCache.js
const alterationsCache = cacheNamespace('alterations');

export default function AlterationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Pagination & Search
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const limit = 60;
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'done'

  // Print Wizard state
  const [isPrintWizardOpen, setIsPrintWizardOpen] = useState(false);
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQueryUsed, setAiQueryUsed] = useState('');
  const [isAiModeActive, setIsAiModeActive] = useState(false);
  const [mounted, setMounted] = useState(false);

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — תואם לתבנית שנקבעה ב-app/orders/page.js:
  // מחליף את הלוגיקה הפנימית שהייתה חבויה ברכיב AISearchBar הישן; ההתנהגות זהה (אותם
  // handleSearch/handleAiSearch/handleClearSearch למטה), רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  useEffect(() => setMounted(true), []);

  // v3: חלוניות אישור/הודעה במקום window.customConfirm / alert (אותו זרם await)
  const { ask, tell, node: dialogsNode } = useOpsDialogs();
  // התראה קלה אחרי הצלחה (NOTIFICATIONS-DESIGN §4, "משניים") — לא נשמרת בפעמון, ולא משפיעה על הזרימה
  const notifyOk = (title) => {
    try { enqueueNotice({ kind: 'success', title, persistToBell: false }); } catch { /* התראה היא בונוס בלבד */ }
  };

  const fetchAlterations = async (isPrefetch = false, targetPage = page) => {
    try {
      if (!isPrefetch) {
        setLoading(true);
        setError('');
      }

      const url = buildAlterationsListUrl({
        filterStatus, page: targetPage, limit, startDate, endDate, search
      });

      const cacheKey = url;

      // SWR: Instant Cache Hit
      if (!isPrefetch && alterationsCache.has(cacheKey)) {
        const cachedData = alterationsCache.get(cacheKey);
        setItems(cachedData.data || []);
        setTotalPages(cachedData.totalPages || 1);
        setTotalCount(cachedData.total || 0);
        setLoading(false); // UI becomes interactive instantly
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch alterations');
      const data = await res.json();

      // Update Cache silently
      alterationsCache.set(cacheKey, data);

      if (!isPrefetch && targetPage === page) {
        setItems(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
      }
    } catch (err) {
      if (!isPrefetch) setError(err.message);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlterations(false, page);

    // Background Prefetching for the next page
    const timer = setTimeout(() => {
      if (page < totalPages) {
        fetchAlterations(true, page + 1);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [startDate, endDate, filterStatus, page, search, totalPages]);

  const markDone = async (orderItemId) => {
    if (!(await ask({ title: 'לסמן את התיקון כבוצע?', okLabel: 'כן, בוצע', cancelLabel: 'לא עכשיו', icon: 'scissors' }))) return;
    try {
      const res = await fetch('/api/alterations/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId })
      });
      if (!res.ok) throw new Error('Failed to mark as done');

      // Remove from list if filterStatus is 'pending', else update state
      if (filterStatus === 'pending') {
        setItems(items.filter(item => item.id !== orderItemId));
      } else {
        setItems(items.map(item => item.id === orderItemId ? { ...item, alterationDone: true } : item));
      }
      notifyOk('התיקון סומן כבוצע');
    } catch (err) {
      tell({ title: 'העדכון נכשל', text: err.message, icon: 'alert-circle' });
    }
  };

  const markAllDone = async () => {
    if (!startDate) {
      tell({ title: 'חסר תאריך', text: 'בחרו תאריך התחלה כדי לסמן יום שלם כבוצע.', icon: 'calendar' });
      return;
    }
    const hebrewDateStr = startDate ? getHebrewDateString(startDate) : '';
    const displayDate = hebrewDateStr ? hebrewDateStr : startDate;
    if (!(await ask({ title: 'לסמן את כל התיקונים ליום הזה כבוצעו?', text: displayDate, okLabel: 'כן, הכול בוצע', cancelLabel: 'ביטול', icon: 'check-circle' }))) return;

    try {
      const res = await fetch('/api/alterations/mark-done', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: startDate })
      });
      if (!res.ok) throw new Error('Failed to mark all as done');
      fetchAlterations();
      notifyOk('כל תיקוני היום סומנו כבוצעו');
    } catch (err) {
      tell({ title: 'העדכון נכשל', text: err.message, icon: 'alert-circle' });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  const setQuickDate = (daysOffset) => {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    const dateStr = d.toISOString().split('T')[0];
    setStartDate(dateStr);
    setEndDate(dateStr);
  };

  const handleSearch = (e) => {
    if (e) e.preventDefault();
    setSearch(searchInput);
    setPage(1);
    setIsAiModeActive(false);
  };

  const handleAiSearch = async (query) => {
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, pageContext: 'alterations' })
      });
      const result = await res.json();
      if (res.ok) {
        setItems(result.data || []);
        setTotalCount(result.data?.length || 0);
        setTotalPages(1);
        setIsAiModeActive(true);
        setAiQueryUsed(result.query || '');
      } else {
        tell({ title: 'החיפוש החכם לא הצליח', text: result.error || undefined, icon: 'alert-circle' });
      }
    } catch (e) {
      console.error(e);
      tell({ title: 'אין תקשורת עם השרת', text: 'נסו שוב בעוד רגע.', icon: 'alert-circle' });
    } finally {
      setAiLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
    if (isAiModeActive) {
      setIsAiModeActive(false);
      fetchAlterations();
    }
  };

  // סרגל החיפוש: מצב רגיל מול מצב AI — מחליף את הלוגיקה הפנימית שהייתה ברכיב AISearchBar
  const toggleAiInputMode = () => {
    if (!aiInputMode) {
      setAiInputText(searchInput || '');
    } else {
      setSearchInput(aiInputText || '');
    }
    setAiInputMode(v => !v);
  };

  const handleAiInputSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;
    handleAiSearch(aiInputText);
  };

  const fetchForExport = async (exportLimit) => {
    try {
      const showOnlyPending = filterStatus === 'pending';
      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&page=1&limit=${exportLimit}&hideTakenReturned=true`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (search) url += `&search=${search}`;
      const res = await fetch(url);
      const data = await res.json();
      return (data.data || []).map(item => ({
        ...item,
        orderId: item.order?.orderId,
        customerName: `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`,
        dressName: item.dressItem?.dress?.name
          ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
          : (item.description || item.dressItem?.dressName),
        eventDate: item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-'),
        alterationStatus: item.alterationDone ? 'בוצע' : 'ממתין',
        neckAlterationText: item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : '',
        lengthAlterationText: item.lengthAlteration && String(item.lengthAlteration).trim() !== '' && item.lengthAlteration !== 'null' && item.lengthAlteration !== '0' ? item.lengthAlteration : '',
        sleeveAlterationText: item.sleeveAlteration > 0 ? `הארכה ${item.sleeveAlteration}` : '',
        alterationDetails: item.alterationDetails || ''
      }));
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  // Used by the print wizard's "הנתונים המוצגים כעת" (currently displayed data)
  // option: without this, PrintWizardModal had no getCurrentOrderIds prop to call
  // for this page, so "current" mode silently fell back to whatever startDate/
  // endDate happened to be set on the page (often empty, or a single filtered
  // day) instead of everything actually matching the active filters - producing
  // an empty or misleadingly narrow report. Mirrors getCurrentFilteredOrderIds
  // in app/orders/page.js.
  const getCurrentAlterationOrderIds = async () => {
    try {
      const showOnlyPending = filterStatus === 'pending';
      // Capped like fetchForExport/orders-page's getCurrentFilteredOrderIds - an
      // unfiltered "current" print can otherwise match tens of thousands of
      // OrderItem rows, and passing that many orderIds in a query string would
      // blow past any sane URL length limit.
      let url = `/api/alterations?showOnlyPending=${showOnlyPending}&page=1&limit=2000&hideTakenReturned=true`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      if (search) url += `&search=${search}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || []);
      return [...new Set(list.map(item => item.order?.orderId).filter(id => id != null))];
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  const exportRows = items.map(item => ({
    ...item,
    orderId: item.order?.orderId,
    customerName: `${item.order?.customer?.firstName || ''} ${item.order?.customer?.lastName || ''}`,
    dressName: item.dressItem?.dress?.name
      ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
      : (item.description || item.dressItem?.dressName),
    eventDate: item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-'),
    alterationStatus: item.alterationDone ? 'בוצע' : 'ממתין',
    neckAlterationText: item.neckAlteration > 0 ? `הצרה ${item.neckAlteration}` : '',
    lengthAlterationText: item.lengthAlteration && String(item.lengthAlteration).trim() !== '' && item.lengthAlteration !== 'null' && item.lengthAlteration !== '0' ? item.lengthAlteration : '',
    sleeveAlterationText: item.sleeveAlteration > 0 ? `הארכה ${item.sleeveAlteration}` : '',
    alterationDetails: item.alterationDetails || ''
  }));

  const statusTabs = [
    { key: 'all', label: 'הכל', icon: 'list' },
    { key: 'pending', label: 'ממתינים', icon: 'clock' },
    { key: 'done', label: 'בוצעו', icon: 'check-circle' },
  ];

  return (
    <V3Page>
      {dialogsNode}

      <div className="v3-pagehead ops-head">
        <div className="v3-pagehead__title ops-head__title">
          <h1 className="v3-h1"><Icon name="scissors" />תפירות ותיקונים</h1>
          <div className="v3-muted">תיקונים בסינון: <bdi>{totalCount}</bdi></div>
        </div>
        <div className="v3-pagehead__tools">
          <Btn variant="primary" icon="check-circle" onClick={markAllDone} disabled={!startDate}>סימון יום כבוצע</Btn>
          <Tip>מסמן כבוצעו את כל התיקונים של התאריך שנבחר בתחילת הטווח. יש לבחור תאריך קודם.</Tip>
          <TipBtn icon="printer" label="אשף הדפסה" onClick={() => setIsPrintWizardOpen(true)} />
          <TipBtn icon="info" label="מקרא" onClick={() => setIsLegendOpen(true)} />
          <ExportButtons
            data={exportRows}
            filename="תפירות"
            columns={[
              { key: 'orderId', label: 'קוד הזמנה' },
              { key: 'customerName', label: 'לקוח' },
              { key: 'dressName', label: 'שמלה' },
              { key: 'sizeText', label: 'מידה' },
              { key: 'eventDate', label: 'תאריך אירוע' },
              { key: 'neckAlterationText', label: 'תיקון צוואר' },
              { key: 'lengthAlterationText', label: 'תיקון אורך' },
              { key: 'sleeveAlterationText', label: 'תיקון שרוול' },
              { key: 'alterationDetails', label: 'תיאור תיקון' },
              { key: 'alterationStatus', label: 'סטטוס' }
            ]}
            iconOnly={true}
            onFetchData={fetchForExport}
          />
        </div>
      </div>

      <div className="ops-toolbar">
        <div className="v3-field ops-picker">
          <span className="v3-label">תאריכי אירוע <Tip>מסנן את הרשימה לפי טווח תאריכי האירוע של ההזמנה.</Tip></span>
          <HebrewDateRangePicker
            className="range-flat"
            startDate={startDate}
            endDate={endDate}
            onChange={(start, end) => {
              setStartDate(start);
              setEndDate(end);
            }}
            placeholderStart="מתאריך"
            placeholderEnd="עד תאריך"
          />
        </div>

        <SearchBar
          aiInputMode={aiInputMode}
          aiLoading={aiLoading}
          aiInputText={aiInputText}
          setAiInputText={setAiInputText}
          searchInput={searchInput}
          setSearchInput={setSearchInput}
          onSubmit={handleSearch}
          onSubmitAi={handleAiInputSubmit}
          onClear={handleClearSearch}
          onToggleAi={toggleAiInputMode}
          onStats={(e) => setShowStatistics({ x: e.clientX, y: e.clientY })}
          placeholder="הזמנה, לקוח או דגם"
          placeholderAi="תארו מה לחפש, והמערכת תמצא"
        />
      </div>

      <div className="ops-section">
        <Tabs
          label="סינון לפי מצב התיקון"
          items={statusTabs}
          value={filterStatus}
          onChange={(k) => { setFilterStatus(k); }}
        />
      </div>

      {loading ? (
        <div className="v3-empty" role="status">
          <span className="v3-spin" aria-hidden="true" />
          <span>טוען…</span>
        </div>
      ) : error ? (
        <Banner kind="alert" title="לא הצלחנו לטעון את הרשימה" text={error} />
      ) : (
        <div className="ops-tablecard">
          <div className="v3-table__wrap">
            <table className="v3-table ops-table">
              <thead>
                <tr>
                  <th scope="col">אירוע</th>
                  <th scope="col">לקוח</th>
                  <th scope="col">שמלה</th>
                  <th scope="col">תיקונים</th>
                  <th scope="col">מצב</th>
                  <th scope="col"><span className="v3-sr">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <Empty icon="search" title="אין תיקונים להצגה" text="נסו לשנות את הסינון או את החיפוש." />
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isDone = item.alterationDone;

                    return (
                      <tr key={item.id} className={isDone ? 'ops-row ops-row--done' : 'ops-row ops-row--pending'}>
                        <td className="ops-strong"><bdi>{item.order?.eventDateHebrew || (item.order?.eventDate ? getHebrewDateString(item.order.eventDate) : '-')}</bdi></td>
                        <td>{item.order?.customer?.firstName} {item.order?.customer?.lastName}</td>
                        <td>
                          <div className="ops-cell-stack">
                            <span>
                              {item.dressItem?.dress?.name
                                ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                                : (item.description || item.dressItem?.dressName)}
                            </span>
                            {(item.sizeText || item.size) ? <Chip icon="ruler">מידה <bdi>{item.sizeText || item.size}</bdi></Chip> : null}
                          </div>
                        </td>
                        <td>
                          <div className="ops-chips">
                            {item.neckAlteration > 0 && <Chip variant="info" icon="scissors">צוואר: הצרה <bdi>{item.neckAlteration}</bdi></Chip>}
                            {item.sleeveAlteration > 0 && <Chip variant="info" icon="scissors">שרוול: הארכה <bdi>{item.sleeveAlteration}</bdi></Chip>}
                            {item.lengthAlteration && <Chip variant="info" icon="scissors">אורך: <bdi>{item.lengthAlteration}</bdi></Chip>}
                            {item.alterationDetails && <Chip>{item.alterationDetails}</Chip>}
                            {!item.neckAlteration && !item.sleeveAlteration && !item.lengthAlteration && !item.alterationDetails && <span className="ops-muted">-</span>}
                          </div>
                        </td>
                        <td>
                          {isDone ? (
                            <Tag variant="done" icon="check-circle">בוצע</Tag>
                          ) : (
                            <Tag variant="attn" icon="clock">ממתין</Tag>
                          )}
                        </td>
                        <td>
                          <div className="ops-actions">
                            <Link
                              href={`/orders/${item.order?.orderId}`}
                              className="v3-btn v3-btn--quiet v3-btn--icon v3-btn--sm"
                              title="כרטיס הזמנה"
                              aria-label="כרטיס הזמנה"
                            >
                              <Icon name="file" />
                            </Link>
                            {isDone ? (
                              <button type="button" className="v3-btn v3-btn--quiet v3-btn--icon v3-btn--sm ops-hidden" tabIndex={-1} aria-hidden="true">
                                <Icon name="check-circle" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="v3-btn v3-btn--quiet v3-btn--icon v3-btn--sm"
                                onClick={() => markDone(item.id)}
                                title="סימון כבוצע"
                                aria-label="סימון כבוצע"
                              >
                                <Icon name="check-circle" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="ops-foot">
            <span>מוצגים בעמוד: <bdi>{items.length}</bdi> · סה&quot;כ תואמים: <bdi>{totalCount}</bdi></span>
            {totalPages > 1 && (
              <div className="ops-pager">
                <Btn variant="secondary" size="sm" icon="chevron-end" disabled={page <= 1} onClick={() => setPage(p => p - 1)} title="עמוד קודם">
                  הקודם
                </Btn>
                <span className="ops-pager__num">
                  <label className="v3-label" htmlFor="alterationsListPageNum">עמוד</label>
                  <input
                    id="alterationsListPageNum"
                    type="number"
                    className="v3-input"
                    min={1}
                    max={totalPages || 1}
                    value={page}
                    onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                  />
                  מתוך <bdi>{totalPages}</bdi>
                </span>
                <Btn variant="secondary" size="sm" iconEnd="chevron-start" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} title="עמוד הבא">
                  הבא
                </Btn>
              </div>
            )}
          </div>
        </div>
      )}

      {isPrintWizardOpen && (
        <PrintWizardModal
          onClose={() => setIsPrintWizardOpen(false)}
          defaultStartDate={startDate}
          defaultEndDate={endDate}
          getCurrentOrderIds={getCurrentAlterationOrderIds}
        />
      )}

      <Dialog
        open={isLegendOpen && mounted}
        onClose={() => setIsLegendOpen(false)}
        mode={dlgMode()}
        icon="info"
        title="מקרא"
        actions={<Btn variant="primary" onClick={() => setIsLegendOpen(false)}>הבנתי</Btn>}
      >
        <div className="v3-dlg-rows">
          <div className="v3-dlg-row">
            <span className="v3-dlg-row__ico"><Icon name="clock" /></span>
            <div className="v3-dlg-row__t"><b>ממתין</b><div className="v3-faint">התיקון עדיין לא בוצע. פס אפרסק בצד השורה.</div></div>
          </div>
          <div className="v3-dlg-row">
            <span className="v3-dlg-row__ico"><Icon name="check-circle" /></span>
            <div className="v3-dlg-row__t"><b>בוצע</b><div className="v3-faint">התיקון הושלם. פס כחול בצד השורה.</div></div>
          </div>
        </div>
      </Dialog>

      <StatisticsModal
        isOpen={!!showStatistics}
        onClose={() => setShowStatistics(false)}
        pageContext="alterations"
        contextQuery={aiQueryUsed}
        position={typeof showStatistics === 'object' ? showStatistics : null}
      />
    </V3Page>
  );
}
