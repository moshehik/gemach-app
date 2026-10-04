'use client';

// "לוח חודשי" (/board) - העיצוב המאושר: תצוגות-עיצוב/סיימתי-לעבוד/לוח-חודשי.html, עם תשובות הבעלים (4.10.2026,
// scratch/board-build/answers-board.json). רכיבי פלטה בלבד (design-system/COMPONENTS.md) + רכיבי הלו״ז (schedule.css), בתוך
// .gm-ds.gm-lz.gm-bd (השורש נושא גם gm-lz כי העיצוב של הלוח הוא המשך של דף הלו״ז: lz-app, lz-bar, הציר, שורות lz-r).
//
// מה נשאר מהדף הקודם (אותם חוזים): טעינת החודש העברי ±14 יום מ-GET /api/orders (buildBoardMonthParams - אותו מפתח מטמון
// כמו ה-prefetch), מטמון SWR (pageCache 'board'), ביטול הבקשה הקודמת במעבר חודש, חיפוש רגיל (search לשרת, Enter, ניקוי),
// ניווט חודשים, החודש העברי בכותרת, אות היום, סימון היום, פרשה וחגים, איחור החזרה, חלון "הזמנות ליום" עם סינון, כרטיס
// הזמנה, חלונית פרטים, תפריט פעולות (כרטיס הזמנה / לקוח / השכרה), חלון השכרה והחזרה מלא (onUpdate = טעינה מחדש),
// ההגדרות enable_alterations / hide_custom_spacing / enable_batch_print_prep, מצב "טוען נתונים...".
// מה הוסר (החלטות הבעלים): אשף הדפסת הכנה (E07), חיפוש חכם (E02), סטטיסטיקה (E03), חיפוש גלובלי (E04), חיפוש מתקדם
// (E05), מקרא סטטוס (E06), מונה/הדפסה בתא (E09; אייקון "מורחב" נשאר מעל 2 הזמנות - JDG-3), תאריך לועזי (E11), תווית
// "תפעול" (S12), "ללו״ז של היום" (S05), ימי חודש סמוך (S08), שורות סיכום ברשימה (S11).
// מה נוסף: "החודש הנוכחי" בגובה מתג התצוגה (S04), מתג לוח / רשימה + רשימה אוטומטית בנייד (S03), מסנן 8 השלבים בשורת
// החיפוש (S01), בורר 13 חודשים (S07, E08), חצי המקלדת (S09), לחיצה על יום = הלו״ז היומי (S06), מוני שלבים בכל תא באותו
// גוון (S02) וסימן התראה (S10) - הנתונים מ-GET /api/board/stages (אותו חישוב כמו /schedule, lib/schedule/range.js).

import '@/design-system/components.css';
import '@/app/schedule/schedule.css';
import './board.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cacheNamespace } from '@/app/lib/pageCache';
import { buildBoardMonthParams } from '@/app/lib/prefetchRoutes';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import usePageTooltip from '../profile/usePageTooltip';
import { LocalSprite } from '../schedule/ScheduleIcon';
import { LzPortalRoot } from '../schedule/LzPortal';
import { MarkToast } from '../schedule/MarkDialogs';
import {
  buildMonthGrid, groupOrdersByDate, monthRangeKeys, monthStageTotals, sameMonth, shiftMonth,
} from './boardLogic';
import { ActionMenu, BoardSearchBar, DayList, Ic, InfoHint, LateContext, MonthGrid, MonthHead } from './BoardParts';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting } from '@/lib/businessDays';
import BoardDayDialog from './BoardDayDialog';
import BoardRentalModal from './BoardRentalModal';
import { useBoardDialogs } from './BoardDialogs';

// מטמון SWR משותף - ר' app/lib/pageCache.js. 'board' = ההזמנות (אותו namespace ומפתח כמו ה-prefetch ב-prefetchRoutes.js);
// 'board-stages' = מוני השלבים לחודש.
const boardCache = cacheNamespace('board');
const stagesCache = cacheNamespace('board-stages');
const MOBILE_MQ = '(max-width:720px)';
const TOAST_MS = 3200;
const STAGES_DEBOUNCE_MS = 300;

export default function BoardPage() {
  const router = useRouter();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  usePageTooltip(rootRef, ttRef, false);
  const [portalRoot, setPortalRoot] = useState(null);
  useEffect(() => { setPortalRoot(rootRef.current); }, []);

  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [orders, setOrders] = useState([]);
  // מתחיל כ-true כדי שהרינדור הראשון יציג "טוען נתונים..." ולא לוח ריק שנראה כאילו אין הזמנות (כמו קודם)
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [enableAlterations, setEnableAlterations] = useState(true);
  const [hideCustomSpacing, setHideCustomSpacing] = useState(false);
  const [enableBatchPrintPrep, setEnableBatchPrintPrep] = useState(false);
  // כלל איחור ההחזרה של הארגון - כמו הלו״ז וחלון ההשכרה (late_return_threshold_days, non_working_days_extra)
  const [lateCfg, setLateCfg] = useState({ threshold: 7, nonWorkingDays: null });
  const [view, setView] = useState('grid');
  const [stageSel, setStageSel] = useState([]);
  const [stagesData, setStagesData] = useState(null);
  const [dayDlg, setDayDlg] = useState(null); // { cell, orders }
  const [menu, setMenu] = useState(null); // { order, el }
  const [hint, setHint] = useState(null); // { order, el, pinned }
  const [rentalId, setRentalId] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const dialogs = useBoardDialogs();

  const say = useCallback((title, kind = 'ok') => {
    setToast({ title, text: '', kind, n: Date.now() });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // ההגדרות לפי ארגון (E20) - אותן שלוש כמו בדף הקודם
  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((data) => {
        const find = (k) => (Array.isArray(data) ? data.find((s) => s.key === k) : null);
        if (find('enable_alterations')?.value === 'false') setEnableAlterations(false);
        if (find('hide_custom_spacing')?.value === 'true') setHideCustomSpacing(true);
        if (find('enable_batch_print_prep')?.value === 'true') setEnableBatchPrintPrep(true);
        setLateCfg({ threshold: Number(find('late_return_threshold_days')?.value) || 7, nonWorkingDays: parseNonWorkingDaysSetting(find(NON_WORKING_DAYS_SETTING_KEY)?.value ?? null) });
      })
      .catch(() => {});
  }, []);

  // S03: בנייד הלוח עובר אוטומטית לתצוגת רשימה (כמו העיצוב: max-width 720px)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia(MOBILE_MQ);
    let last = mq.matches;
    if (last) setView('list');
    // רק מעבר אמיתי בין נייד למחשב מחליף תצוגה (בחירה ידנית של המשתמשת נשמרת בשינויי גובה / זום)
    const on = (e) => { if (e.matches === last) return; last = e.matches; setView(e.matches ? 'list' : 'grid'); };
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
  }, []);

  // ההזמנות של החודש המוצג - fetchOrdersForMonth של הדף הקודם: מטמון מיידי, ובקשה קודמת מבוטלת כשעוברים חודש
  const activeOrdersRequestRef = useRef(null);
  const fetchOrdersForMonth = useCallback(async () => {
    if (activeOrdersRequestRef.current) activeOrdersRequestRef.current.abort();
    const controller = new AbortController();
    activeOrdersRequestRef.current = controller;
    try {
      const queryParams = buildBoardMonthParams(selectedDate, { search });
      const cacheKey = queryParams.toString();
      if (boardCache.has(cacheKey)) {
        const cachedData = boardCache.get(cacheKey);
        if (cachedData.data) setOrders(cachedData.data);
        else if (cachedData.orders) setOrders(cachedData.orders);
      } else {
        setLoading(true);
      }
      const res = await fetch(`/api/orders?${queryParams.toString()}`, { signal: controller.signal });
      const data = await res.json();
      boardCache.set(cacheKey, data);
      if (data.data) setOrders(data.data);
      else if (data.orders) setOrders(data.orders);
    } catch (err) {
      if (err.name === 'AbortError') return; // בקשה של חודש קודם שבוטלה
    } finally {
      if (activeOrdersRequestRef.current === controller) {
        setLoading(false);
        activeOrdersRequestRef.current = null;
      }
    }
  }, [selectedDate, search]);
  useEffect(() => { fetchOrdersForMonth(); }, [fetchOrdersForMonth]);

  // מוני השלבים לחודש (S01/S02/S10). הבקשה יקרה (חישוב הלו״ז לכל יום בחודש), ולכן (ממצא הסקירה 2): מה שבמטמון מוצג מיד,
  // הבקשה עצמה יוצאת רק אחרי STAGES_DEBOUNCE_MS בלי מעבר חודש נוסף (דפדוף מהיר = בקשה אחת), בקשה קודמת מבוטלת, והשרת
  // שומר תשובה ל-45 שניות (lib/schedule/rangeCache.js). אחרי עדכון בחלון ההשכרה נטענות רק ההזמנות; המונים - כשהחלון נסגר
  // (fresh=1 עוקף את המטמון של השרת). כשל = הלוח בלי מונים (לא חוסם).
  const range = useMemo(() => monthRangeKeys(selectedDate), [selectedDate]);
  const activeStagesRef = useRef(null);
  const fetchStages = useCallback(async ({ fresh = false } = {}) => {
    if (activeStagesRef.current) activeStagesRef.current.abort();
    const controller = new AbortController();
    activeStagesRef.current = controller;
    const key = range.from + '_' + range.to;
    try {
      const res = await fetch(`/api/board/stages?from=${range.from}&to=${range.to}${fresh ? '&fresh=1' : ''}`, { signal: controller.signal, cache: 'no-store' });
      if (!res.ok) { if (activeStagesRef.current === controller) setStagesData((cur) => (stagesCache.has(key) ? cur : null)); return; }
      const data = await res.json();
      if (data && data.days) {
        stagesCache.set(key, data);
        if (activeStagesRef.current === controller) setStagesData(data);
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
    } finally {
      if (activeStagesRef.current === controller) activeStagesRef.current = null;
    }
  }, [range.from, range.to]);
  useEffect(() => {
    const key = range.from + '_' + range.to;
    if (stagesCache.has(key)) setStagesData(stagesCache.get(key));
    else setStagesData((cur) => (cur && cur.from === range.from ? cur : null));
    const t = setTimeout(() => fetchStages(), STAGES_DEBOUNCE_MS);
    return () => {
      clearTimeout(t);
      if (activeStagesRef.current) { activeStagesRef.current.abort(); activeStagesRef.current = null; }
    };
  }, [fetchStages, range.from, range.to]);

  const ordersByDate = useMemo(() => groupOrdersByDate(orders), [orders]);
  const today = useMemo(() => new Date(), []);
  const weeks = useMemo(() => buildMonthGrid(selectedDate, new Date()), [selectedDate]);
  const stages = stagesData ? stagesData.stages : [];
  const totals = useMemo(() => monthStageTotals(stagesData ? stagesData.days : null, stages), [stagesData, stages]);
  const isCurrentMonth = sameMonth(selectedDate, today);

  const changeMonth = useCallback((delta) => setSelectedDate((d) => shiftMonth(d, delta)), []);
  const anyOverlay = !!(dayDlg || menu || rentalId || dialogs.isOpen);

  // S09: חצי המקלדת מחליפים חודש (RTL: ימינה = הקודם, שמאלה = הבא), לא בתוך שדה ולא כשחלון פתוח
  useEffect(() => {
    const key = (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target;
      if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"],[role="listbox"],[role="menu"],.lz-pop')) return;
      if (anyOverlay) return;
      e.preventDefault();
      changeMonth(e.key === 'ArrowRight' ? -1 : 1);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [anyOverlay, changeMonth]);

  const handleSearch = () => setSearch(searchInput);
  const handleClearSearch = () => { setSearchInput(''); setSearch(''); };

  // S06: לחיצה על יום = הלו״ז היומי של אותו יום - רק כשהשרת אישר הרשאה ללו״ז (canOpenSchedule=true). לא ידוע (המונים עוד
  // לא נטענו / נכשלו) או בלי הרשאה = חלון "הזמנות ליום" (ממצא הסקירה 4: לא שולחים עובדת בלי הרשאה לדף "אין הרשאה").
  const openDay = useCallback((cell) => {
    if (!stagesData || stagesData.canOpenSchedule !== true) {
      setDayDlg({ cell, orders: ordersByDate[cell.key] || [] });
      return;
    }
    router.push('/schedule?date=' + cell.key);
  }, [router, stagesData, ordersByDate]);
  const expandDay = useCallback((cell) => setDayDlg({ cell, orders: ordersByDate[cell.key] || [] }), [ordersByDate]);
  const openMenu = useCallback((order, el) => { setHint(null); setMenu({ order, el }); }, []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const showHint = useCallback((order, el, pinned) => {
    setHint((cur) => {
      if (!order) return cur && cur.pinned ? cur : null;
      if (pinned && cur && cur.pinned && cur.order.orderId === order.orderId) return null;
      return { order, el, pinned: !!pinned };
    });
  }, []);
  useEffect(() => {
    if (!hint || !hint.pinned) return undefined;
    const down = (e) => { if (!e.target.closest || !e.target.closest('.bd-info,.bd-rt')) setHint(null); };
    const key = (e) => { if (e.key === 'Escape') { e.preventDefault(); setHint(null); } };
    document.addEventListener('mousedown', down);
    window.addEventListener('keydown', key, true);
    return () => { document.removeEventListener('mousedown', down); window.removeEventListener('keydown', key, true); };
  }, [hint]);

  // הדפסת פרוט ההזמנות ליום (רק בחלון היום, בארגון עם enable_batch_print_prep) - אותו נתיב כמו קודם, עם batch=1
  const printDayOrders = useCallback((list) => {
    if (!list || list.length === 0) return;
    const ids = list.map((o) => o.orderId).join(',');
    window.open(`/print/order?orderId=${ids}&type=order&batch=1`, '_blank');
  }, []);

  const toggleStage = (k) => setStageSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const rentalUi = useMemo(() => ({
    alert: (m) => say(String(m || ''), /שגיאה|חובה|יש ל|אינם|לא /.test(String(m || '')) ? 'error' : 'ok'),
    confirm: dialogs.confirm,
    prompt: (message, def) => dialogs.prompt(message, def),
  }), [say, dialogs.confirm, dialogs.prompt]);

  const head = <MonthHead date={selectedDate} today={today} onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)} onPick={(d) => setSelectedDate(d)} />;
  const common = {
    weeks, head, ordersByDate, stagesDays: stagesData ? stagesData.days : null, stages, selected: stageSel,
    onOpenDay: openDay, onOrder: openMenu, enableAlterations,
  };

  return (
    <LzPortalRoot.Provider value={portalRoot}>
    <LateContext.Provider value={lateCfg}>
      <div className="gm-ds gm-lz gm-bd home-bg dlg-dark" ref={rootRef} dir="rtl">
        <LocalSprite />
        <div className="app lz-app bd-app">
          <div className="topbar">
            <div className="ttl"><h1 className="pg-ttl"><bdi>לוח חודשי</bdi></h1></div>
          </div>

          <BoardSearchBar
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={handleSearch}
            onClear={handleClearSearch}
            stages={stages}
            totals={totals}
            selected={stageSel}
            onToggle={toggleStage}
            onShowAll={() => setStageSel([])}
            filterDisabled={!stages.length}
          />

          <div className="lz-bar" id="mBar">
            <div className="lz-quick">
              <button type="button" className={'btn tgl' + (isCurrentMonth ? ' on' : '')} id="mToday" aria-pressed={isCurrentMonth} onClick={() => setSelectedDate(new Date())}>החודש הנוכחי</button>
            </div>
            <div className={'vsw' + (view === 'list' ? ' t' : '')} id="mvsw" role="group" aria-label="מצב תצוגה">
              <span className="vknob" aria-hidden="true" />
              <button type="button" className={'vopt' + (view === 'grid' ? ' on' : '')} aria-label="תצוגת לוח" aria-pressed={view === 'grid'} data-tip="לוח חודשי" onClick={() => setView('grid')}><Ic name="cal" /></button>
              <button type="button" className={'vopt' + (view === 'list' ? ' on' : '')} aria-label="תצוגת רשימה" aria-pressed={view === 'list'} data-tip="רשימת ימים" onClick={() => setView('list')}><Ic name="rows" /></button>
            </div>
          </div>

          <div id="month">
            {loading ? (
              <div className="card bd-loading">
                <div className="empty" role="status"><span className="mspin" /><div className="bd-lt">טוען נתונים...</div></div>
              </div>
            ) : view === 'grid' ? (
              <MonthGrid {...common} onExpand={expandDay} />
            ) : (
              <DayList {...common} onHint={showHint} />
            )}
          </div>
        </div>

        {dayDlg ? (
          <BoardDayDialog
            day={dayDlg}
            enableAlterations={enableAlterations}
            enableBatchPrintPrep={enableBatchPrintPrep}
            onClose={() => { setDayDlg(null); setHint(null); }}
            onOrder={openMenu}
            onHint={showHint}
            onPrint={printDayOrders}
          />
        ) : null}

        <ActionMenu
          menu={menu}
          onClose={closeMenu}
          onOrderCard={(o) => { setMenu(null); router.push(`/orders/${o.orderId}`); }}
          onCustomerCard={(id) => { setMenu(null); router.push(`/customers/${id}`); }}
          onRental={(o) => { setMenu(null); setDayDlg(null); setHint(null); setRentalId(o.orderId); }}
        />
        <InfoHint hint={hint} enableAlterations={enableAlterations} hideCustomSpacing={hideCustomSpacing} />

        {rentalId ? (
          <BoardRentalModal orderId={rentalId} onClose={() => { setRentalId(null); fetchStages({ fresh: true }); }} onUpdate={fetchOrdersForMonth} ui={rentalUi} />
        ) : null}
        {dialogs.node}

        <MarkToast toast={toast} onClose={() => setToast(null)} />
        <div className="pl-tt" role="tooltip" id="bd-tt" ref={ttRef} />
      </div>
    </LateContext.Provider>
    </LzPortalRoot.Provider>
  );
}
