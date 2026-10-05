'use client';

// "לוח חודשי" (/board) - העיצוב המאושר: תצוגות-עיצוב/סיימתי-לעבוד/לוח-חודשי.html, עם תשובות הבעלים (4.10.2026,
// scratch/board-build/answers-board.json). רכיבי פלטה בלבד (design-system/COMPONENTS.md) + רכיבי הלו״ז (schedule.css), בתוך
// .gm-ds.gm-lz.gm-bd (השורש נושא גם gm-lz כי העיצוב של הלוח הוא המשך של דף הלו״ז: lz-app, lz-bar, הציר, שורות lz-r).
//
// מה שנשאר מהדף הקודם (אותם חוזים): טעינת החודש העברי ±14 יום מ-GET /api/orders (buildBoardMonthParams - אותו מפתח מטמון
// כמו ה-prefetch; ההזמנות משמשות רק לסימן "איחור החזרה"), מטמון SWR (pageCache 'board'), ביטול הבקשה הקודמת במעבר חודש,
// ניווט חודשים, החודש העברי בכותרת, אות היום, סימון היום, פרשה וחגים, איחור החזרה
// (סימן + מסגרת אדומה), מצב "טוען נתונים...", ההגדרות late_return_*.
// מה הוסר (החלטות הבעלים): תיבת החיפוש הרגיל (5.10.2026, "לא לקפוץ לחודש ההזמנה" - ההזמנות נטענות תמיד בלי search), אשף הדפסת הכנה (E07), חיפוש חכם (E02), סטטיסטיקה (E03), חיפוש גלובלי (E04), חיפוש מתקדם
// (E05), מקרא סטטוס (E06), מונה/הדפסה בתא (E09), תאריך לועזי (E11), תווית "תפעול" (S12), "ללו״ז של היום" (S05), ימי חודש
// סמוך (S08), שורות סיכום ברשימה (S11); ובתשובות ההבהרה (BD-O4 / BD-O5 / BD-O6 / BD-O7): בתא וברשימה רק מוני השלבים.
// BD-O3 (הבעלים, 5.10.2026): חלון "הזמנות ליום" נמחק לגמרי - כל לחיצה על יום (עכבר, Enter) = דף הלו״ז של אותו יום
// (/schedule?date=), בלי חלון ובלי חלופה לפי הרשאה: דף הלו״ז מציג בעצמו "אין הרשאה". יחד איתו נמחקו מהלוח תפריט ההזמנה,
// חלונית הפרטים וחלון ההשכרה והחזרה (נגישים רק דרכו; החלון הקיים נשאר ב-/orders ו-/rentals).
// שינוי עיצוב אחד של הבעלים (5.10.2026, אחרי "לוח חודשי מעולה ומאושר"): בתצוגת השורות (הרשימה) כל יום נראה ופועל כמו שורה בתוצאות החיפוש
// של דף הבית (HomeResults.js: card.res-one > .list > a.li.rlink.lrow) והאייקונים עם המספרים בתוך השורה; הגריד לא השתנה. הכללים של השורה
// מועתקים מ-components.css (כללי ".res-one .li" של דף הבית) ל-board.css עם .gm-bd, והבדיקה ב-test_board_page.mjs מוודאת שהם זהים.
// מה נוסף: "החודש הנוכחי" בגובה מתג התצוגה (S04), מתג לוח / רשימה + רשימה אוטומטית בנייד (S03), מסנן 8 השלבים (S01), בורר 13 חודשים (S07, E08), חצי המקלדת (S09), לחיצה על יום = הלו״ז היומי (S06), מוני שלבים בכל תא באותו
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
import {
  buildMonthGrid, groupOrdersByDate, monthRangeKeys, monthStageTotals, sameMonth, shiftMonth,
} from './boardLogic';
import PageVariantToggle from '../variant/PageVariantToggle';
import { BoardStageFilter, DayList, Ic, LateContext, MonthGrid, MonthHead } from './BoardParts';
import { NON_WORKING_DAYS_SETTING_KEY, parseNonWorkingDaysSetting } from '@/lib/businessDays';
import { getIsraelTodayDate } from '@/lib/hebrewDate';

// מטמון SWR משותף - ר' app/lib/pageCache.js. 'board' = ההזמנות (אותו namespace ומפתח כמו ה-prefetch ב-prefetchRoutes.js);
// 'board-stages' = מוני השלבים לחודש.
// CPU phase 1B: הלוח החדש טוען את GET /api/board/orders (רק מה שסימן האיחור צריך) ושומר ב-namespace נפרד - 'board' נשאר של הלוח הישן
// (LegacyBoardPage.js + ה-prefetch ב-prefetchRoutes.js), שמצפה לצורת התשובה המלאה של /api/orders.
const boardCache = cacheNamespace('board-slim');
const stagesCache = cacheNamespace('board-stages');
const MOBILE_MQ = '(max-width:720px)';
const STAGES_DEBOUNCE_MS = 300;

export default function BoardPage() {
  const router = useRouter();
  const rootRef = useRef(null);
  const ttRef = useRef(null);
  usePageTooltip(rootRef, ttRef, false);

  const [selectedDate, setSelectedDate] = useState(() => getIsraelTodayDate());
  const [orders, setOrders] = useState([]);
  // מתחיל כ-true כדי שהרינדור הראשון יציג "טוען נתונים..." ולא לוח ריק שנראה כאילו אין הזמנות (כמו קודם)
  const [loading, setLoading] = useState(true);
  // כלל איחור ההחזרה של הארגון - כמו הלו״ז וחלון ההשכרה (late_return_threshold_days, non_working_days_extra)
  const [lateCfg, setLateCfg] = useState({ threshold: 7, nonWorkingDays: null });
  const [view, setView] = useState('grid');
  const [stageSel, setStageSel] = useState([]);
  const [stagesData, setStagesData] = useState(null);

  // ההגדרות לפי ארגון (E20) - כלל איחור ההחזרה (late_return_threshold_days, non_working_days_extra)
  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then((data) => {
        const find = (k) => (Array.isArray(data) ? data.find((s) => s.key === k) : null);
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
      const queryParams = buildBoardMonthParams(selectedDate);
      const cacheKey = queryParams.toString();
      if (boardCache.has(cacheKey)) {
        const cachedData = boardCache.get(cacheKey);
        if (cachedData.data) setOrders(cachedData.data);
        else if (cachedData.orders) setOrders(cachedData.orders);
      } else {
        setLoading(true);
      }
      const res = await fetch(`/api/board/orders?${queryParams.toString()}`, { signal: controller.signal });
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
  }, [selectedDate]);
  useEffect(() => { fetchOrdersForMonth(); }, [fetchOrdersForMonth]);

  // מוני השלבים לחודש (S01/S02/S10). הבקשה יקרה (חישוב הלו״ז לכל יום בחודש), ולכן (ממצא הסקירה 2): מה שבמטמון מוצג מיד,
  // הבקשה עצמה יוצאת רק אחרי STAGES_DEBOUNCE_MS בלי מעבר חודש נוסף (דפדוף מהיר = בקשה אחת), בקשה קודמת מבוטלת, והשרת
  // שומר תשובה ל-45 שניות (lib/schedule/rangeCache.js). כשל = הלוח בלי מונים (לא חוסם).
  const range = useMemo(() => monthRangeKeys(selectedDate), [selectedDate]);
  const activeStagesRef = useRef(null);
  const fetchStages = useCallback(async () => {
    if (activeStagesRef.current) activeStagesRef.current.abort();
    const controller = new AbortController();
    activeStagesRef.current = controller;
    const key = range.from + '_' + range.to;
    try {
      const res = await fetch(`/api/board/stages?from=${range.from}&to=${range.to}`, { signal: controller.signal, cache: 'no-store' });
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
  // "היום" לפי שעון ישראל (לא שעון המכשיר): מסגרת היום בגריד, "החודש הנוכחי" והחודש שנפתח בכניסה
  const today = useMemo(() => getIsraelTodayDate(), []);
  const weeks = useMemo(() => buildMonthGrid(selectedDate, today), [selectedDate, today]);
  const stages = stagesData ? stagesData.stages : [];
  const totals = useMemo(() => monthStageTotals(stagesData ? stagesData.days : null, stages), [stagesData, stages]);
  const isCurrentMonth = sameMonth(selectedDate, today);

  const changeMonth = useCallback((delta) => setSelectedDate((d) => shiftMonth(d, delta)), []);

  // S09: חצי המקלדת מחליפים חודש (RTL: ימינה = הקודם, שמאלה = הבא), לא בתוך שדה
  useEffect(() => {
    const key = (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target;
      if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"],[role="listbox"],[role="menu"],.lz-pop')) return;
      e.preventDefault();
      changeMonth(e.key === 'ArrowRight' ? -1 : 1);
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [changeMonth]);

  // S06 + BD-O3: כל לחיצה על יום (עכבר על התא, Enter על הקישור) = דף הלו״ז של אותו יום. בלי חלון ובלי חלופה לפי הרשאה -
  // עובדת בלי page:schedule רואה את חלון "אין הרשאה" של דף הלו״ז עצמו (app/schedule/layout.js).
  const openDay = useCallback((cell) => { router.push('/schedule?date=' + cell.key); }, [router]);

  const toggleStage = (k) => setStageSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const head = <MonthHead date={selectedDate} today={today} onPrev={() => changeMonth(-1)} onNext={() => changeMonth(1)} onPick={(d) => setSelectedDate(d)} />;
  const common = {
    weeks, head, ordersByDate, stagesDays: stagesData ? stagesData.days : null, stages, selected: stageSel,
    onOpenDay: openDay,
  };

  return (
    <LateContext.Provider value={lateCfg}>
      <div className="gm-ds gm-lz gm-bd home-bg dlg-dark" ref={rootRef} dir="rtl">
        <LocalSprite />
        <div className="app lz-app bd-app">
          <div className="topbar">
            <div className="ttl"><h1 className="pg-ttl"><bdi>לוח חודשי</bdi></h1></div>
            {/* "חזרה ללוח הישן": רק להנהלה ראשית / מתכנת (הרשומה ב-lib/uiVariantScreens.js); הטולטיפ - usePageTooltip (data-tip) */}
            <PageVariantToggle screen="board" placement="header" systemTip />
          </div>

          <BoardStageFilter
            stages={stages}
            totals={totals}
            selected={stageSel}
            onToggle={toggleStage}
            onShowAll={() => setStageSel([])}
            filterDisabled={!stages.length}
          />

          <div className="lz-bar" id="mBar">
            {/* החלטת הבעלים 5.10.2026: "החודש הנוכחי" מופיע רק כשמוצג חודש אחר; בחודש הנוכחי הוא מוסתר */}
            {!isCurrentMonth && (
              <div className="lz-quick">
                <button type="button" className="btn tgl" id="mToday" onClick={() => setSelectedDate(getIsraelTodayDate())}>החודש הנוכחי</button>
              </div>
            )}
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
              <MonthGrid {...common} />
            ) : (
              <DayList {...common} />
            )}
          </div>
        </div>

        <div className="pl-tt" role="tooltip" id="bd-tt" ref={ttRef} />
      </div>
    </LateContext.Provider>
  );
}
