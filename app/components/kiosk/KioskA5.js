'use client';

// KioskA5 - עמדת הלקוח (/customer-interface) בעיצוב A5 המאושר (תצוגות-עיצוב/עמדת-לקוח.html), על רכיבי פלטת הרכיבים (design-system/).
// הגרסה הישנה ("אטלייה חמה", ka-*) מוקפאת ב-app/customer-interface/LegacyKioskPage.js; הבחירה ביניהן ב-KioskSwitch (הגדרה ui_variant_kiosk).
//
// סקין + מבנה, לא שכתוב לוגיקה: כל הפונקציונליות של העמדה הישנה נשארה - נעילה / מסך מלא / אישור עובד, חיפוש וסינון דגמים, לוח עברי,
// חלון ההזמנות לדגם, הדפסה (קטלוג ודגם בודד), העוזר החכם, כל הגדרות kiosk_* ו-hide_dress_images. מה שנוסף: מסך פתיחה, 3 שלבים (תאריך / דגם ומידה /
// תוצאות) והמסך "מילוי פרטים אישיים" (KioskRegistration, רכיב משותף). ההחלטות שעדיין פתוחות אצל הבעלים: docs ברשימת ההחלטות של הדף (R/S/J/P).
//
// השורש: A5Page (.gm-ds.gm-a5.gm-ks.home-bg.dlg-dark) - טוסט, טולטיפ וחלונות כהים (Dlg) מהערכה המשותפת של מסכי A5.

import './kiosk-a5.css';
import '@/design-system/components.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HDate } from '@hebcal/core';
import { getHebrewDateString } from '@/lib/hebrewDate';
import { calculatePaymentStatus, getPaymentStatusColor } from '@/lib/orderStatus';
import { modelMatchesQuery } from '@/lib/kioskModelSearch';
import { A5Page, Dlg, DlgBadge, useA5 } from '../a5-list/A5Ui';
import KioskCalendar from './KioskCalendar';
import KioskRegistration from './KioskRegistration';
import { KIcon, KioskThumbImg } from './KioskParts';
import {
  escHtml, formatHebrewDate, getModelDisplayName, modelHasRealName, modelInitials, tileColor, getModelSizeInfo, buildSizeChipData, parshaFooter,
} from './kioskLogic';

const HERO_TEXT = '3 שלבים לוודא שהשמלה תוכל להיות שלך';
const SPLASH_LINE = 'יחד נזמין את שמלת החלומות שלב אחרי שלב :)';
const INITIAL_AI_CHATS = {
  1: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }],
  2: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים, להציג תפוסה מלאה ולענות על שאלות. במה אפשר לעזור?' }],
};
const IDLE_MS = 60000; // S02: חזרה למסך הפתיחה אחרי דקה בלי מגע (במסך נעול בלבד)
const ARROW = <path d="M26 10H6M14 3L6 10l8 7" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />;

// הקלדה אות-אות (hero ומסך הפתיחה בדגימה). active=false מאפס.
function useTypewriter(text, active, { delay = 0, speed = 45, resetKey = 0 } = {}) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    if (!active) return undefined;
    let i = 0;
    let t;
    const tick = () => { i += 1; setN(i); if (i < text.length) t = setTimeout(tick, speed); };
    t = setTimeout(tick, delay);
    return () => clearTimeout(t);
  }, [text, active, delay, speed, resetKey]);
  return { shown: text.slice(0, n), done: n >= text.length };
}

// מסך פתיחה חגיגי (S01-S03): ברכה, קונפטי, כפתור התחלה. שם הארגון מההגדרות (gmach_name), לא קבוע בקוד (J12).
function Splash({ off, orgName, registrationOn, onStart, onRegister, replayKey }) {
  const line = useTypewriter(SPLASH_LINE, !off, { delay: 1850, speed: 45, resetKey: replayKey });
  // קונפטי אקראי: נוצר אחרי הטעינה בלבד (Math.random אינו טהור בזמן רינדור, ובשרת אין קונפטי)
  const [bits, setBits] = useState([]);
  useEffect(() => {
    setBits(Array.from({ length: 46 }, () => ({
      left: `${(Math.random() * 100).toFixed(1)}%`,
      size: `${(4 + Math.random() * 6).toFixed(1)}px`,
      drift: `${(Math.random() * 80 - 40).toFixed(0)}px`,
      dur: `${(7 + Math.random() * 5).toFixed(2)}s`,
      delay: `${(Math.random() * 4).toFixed(2)}s`,
    })));
  }, []);
  const sparks = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < 20; i++) {
      const s = document.createElement('span');
      s.className = 'ks-spark';
      const angle = Math.random() * Math.PI * 2;
      const dist = 36 + Math.random() * 70;
      s.style.left = `${cx}px`;
      s.style.top = `${cy}px`;
      s.style.setProperty('--sx', `${(Math.cos(angle) * dist).toFixed(1)}px`);
      s.style.setProperty('--sy', `${(Math.sin(angle) * dist).toFixed(1)}px`);
      s.style.animationDelay = `${(Math.random() * 0.08).toFixed(2)}s`;
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 900);
    }
  };
  return (
    <div className={`splash${off ? ' off' : ''}`} id="splash" aria-hidden={off ? 'true' : undefined} inert={off} data-agy-id="kiosk_splash">
      <div className="confetti" aria-hidden="true">
        {bits.map((b, i) => (
          <span key={i} className="conf-bit" style={{ left: b.left, width: b.size, height: b.size, '--drift': b.drift, animationDuration: b.dur, animationDelay: b.delay }} />
        ))}
      </div>
      <div className="splash-in" key={replayKey}>
        {orgName ? <span className="hello-pre">{orgName} מברך אותך בברכת-</span> : null}
        <b id="helloB">מזל טוב!</b>
        <span className={`typeline${line.shown ? ' show' : ''}`}><span>{line.shown}</span><span className={`caret${line.done ? ' done' : ''}`} /></span>
        <button type="button" className="btn primary lg" id="startBtn" data-agy-id="kiosk_start_btn" onClick={(e) => { sparks(e); onStart(); }}>
          בואי נתחיל
          <svg className="ic arrow-ico" viewBox="0 0 28 20" style={{ width: 34, height: 24 }} aria-hidden="true">{ARROW}</svg>
        </button>
        {registrationOn ? (
          <button type="button" className="ks-splash-reg" data-agy-id="kiosk_splash_register_btn" onClick={onRegister}>
            <KIcon id="user" size="sm" />מילוי פרטים אישיים
          </button>
        ) : null}
      </div>
    </div>
  );
}

function CtxLine({ stage, dateText, sizes, models, search, showDateCol, onGoto }) {
  const links = stage === 3;
  const linkArrow = <svg className="ic sm" style={{ transform: 'rotate(180deg)' }} aria-hidden="true" focusable="false"><use href="#gmi-back" /></svg>;
  const cols = [];
  if (dateText && showDateCol) {
    cols.push(
      <div className="ctx-col" key="d">
        <span className="ctx-pill">תאריך: {dateText}</span>
        {links ? <button type="button" className="ctx-link" data-guide-id="kiosk.step-date" data-goto="1" onClick={() => onGoto(1)}>שינוי תאריך{linkArrow}</button> : null}
      </div>
    );
  }
  if (sizes.length || models.length || search) {
    cols.push(
      <div className="ctx-col" key="m">
        <div className="ctx-pill-row">
          {sizes.length ? <span className="ctx-pill">מידה: {sizes.join(', ')}</span> : null}
          {models.length ? <span className="ctx-pill">דגם: {models.join(', ')}</span> : null}
          {search ? <span className="ctx-pill">חיפוש: {search}</span> : null}
        </div>
        {links ? <button type="button" className="ctx-link" data-goto="2" onClick={() => onGoto(2)}>שינוי דגם/מידה{linkArrow}</button> : null}
      </div>
    );
  }
  return <div className="ctxline" id="ctxLine">{cols}</div>;
}

export default function KioskA5({ initialSettings = null }) {
  return (
    <A5Page name="gm-ks">
      <KioskInner initialSettings={initialSettings} />
    </A5Page>
  );
}

function KioskInner({ initialSettings }) {
  const a5 = useA5();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [stage, setStage] = useState(1);
  const [mode, setMode] = useState('flow'); // 'flow' | 'register'
  const [settings, setSettings] = useState(() => initialSettings || { hide_dress_images: 'false' });
  const [settingsReady, setSettingsReady] = useState(!!initialSettings);

  // סינון ותצוגה
  const [search, setSearch] = useState('');
  const [modelQuery, setModelQuery] = useState(''); // שדה "חיפוש דגם" הקטן (kiosk_model_search)
  const [modelChips, setModelChips] = useState([]); // שלב 2: מספרי דגם (אפשר כמה)
  const [modelInput, setModelInput] = useState('');
  const [showZeroSizes, setShowZeroSizes] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false); // פאנל הסינון סגור כברירת מחדל (דיווח 267e5bbb)
  const [priceCategories, setPriceCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  const [zoomPopoverOpen, setZoomPopoverOpen] = useState(false);
  const zoomPopoverRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return 1;
    try {
      const saved = parseFloat(localStorage.getItem('ka_zoom_level'));
      return !Number.isNaN(saved) && saved >= 0.5 && saved <= 1.5 ? saved : 1;
    } catch (e) { return 1; }
  });
  const [selectedDate, setSelectedDate] = useState(null); // Date | null - נבחר בלוח; בלי בחירה נטען המלאי להיום (כמו בעמדה הישנה)

  // נעילה ואישור עובד
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [unlockEmployee, setUnlockEmployee] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);
  // 'unlock' משחרר את הנעילה; 'print' מאשר הדפסה חד-פעמית והמסך נשאר נעול
  const [unlockIntent, setUnlockIntent] = useState('unlock');
  // true בזמן הדפסה מאושרת-עובד ממסך נעול: היציאה ממסך מלא שחלון ההדפסה גורם לה לא פותחת שוב את חלון השחרור
  const suppressRelockRef = useRef(false);
  // דגם שמחכה להדפסה אחרי אישור עובד (כפתור המדפסת שליד דגם בודד במסך נעול); null = כל הקטלוג המסונן
  const printModelRef = useRef(null);

  // חלון ההזמנות לדגם
  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalModel, setOrdersModalModel] = useState(null);
  const [ordersModalSize, setOrdersModalSize] = useState(null);
  const [ordersModalLoading, setOrdersModalLoading] = useState(false);
  const [ordersModalOrders, setOrdersModalOrders] = useState([]);

  // מסך פתיחה
  const [splashOn, setSplashOn] = useState(true);
  const [splashKey, setSplashKey] = useState(0);
  const [regKey, setRegKey] = useState(0);

  // העוזר החכם (הלוגיקה בהמשך הקובץ); המצב מוצהר כאן כי אפקט הסרק מנקה אותו
  const [aiInput, setAiInput] = useState('');
  const [aiChats, setAiChats] = useState(INITIAL_AI_CHATS);

  const aiEnabled = settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true';
  const kioskSelfServiceOn = settings.kiosk_customer_self_service === 'true';
  // kiosk_sticky_date_bar (דיווחים ea8a2ed1, b2bda17b, 998381ee, 59ffb080) ו-kiosk_model_search (7983b79d, b2cf3796, e6f564d6), נווה יעקב:
  // ברירת מחדל (השורה חסרה / false) = המסך כמו שהיה.
  const stickyDate = settings.kiosk_sticky_date_bar === 'true';
  const modelSearchOn = settings.kiosk_model_search === 'true';
  const sizeQtyContrast = settings.kiosk_size_qty_contrast === 'true';
  const splashEnabled = settings.kiosk_splash_screen !== 'false';
  const orgName = String(settings.gmach_name || '').trim();

  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const eventDate = selectedDate || today;
  const dateText = selectedDate ? formatHebrewDate(selectedDate) : '';

  useEffect(() => {
    if (initialSettings) return;
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        const obj = { hide_dress_images: 'false' };
        if (Array.isArray(data)) data.forEach((s) => { if (s.key) obj[s.key] = s.value; });
        setSettings(obj);
        setSettingsReady(true);
      })
      .catch((e) => { console.error(e); setSettingsReady(true); });
  }, [initialSettings]);

  // ההגדרה כבויה אחרי שנטענה: בלי מסך פתיחה
  useEffect(() => { if (settingsReady && !splashEnabled) setSplashOn(false); }, [settingsReady, splashEnabled]);

  useEffect(() => {
    if (isLocked) document.body.classList.add('hide-global-nav');
    else document.body.classList.remove('hide-global-nav');
    return () => document.body.classList.remove('hide-global-nav');
  }, [isLocked]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      // לא נוגעים בחלון שכבר פתוח (היה דורס כוונת 'print' באמצע הקלדה) ולא פותחים אותו בגלל היציאה ממסך מלא שההדפסה עצמה גרמה לה
      if (isLocked && !document.fullscreenElement && !showUnlockModal && !suppressRelockRef.current) {
        setUnlockIntent('unlock');
        setShowUnlockModal(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isLocked, showUnlockModal]);

  // קליק ימני ("Inspect" / "View source") חסום כל עוד המסך נעול
  useEffect(() => {
    const handleContextMenu = (e) => { if (isLocked) e.preventDefault(); };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [isLocked]);

  // סרק (S02): במסך נעול, אחרי דקה בלי מגע חוזרים למסך הפתיחה, וטופס הרישום (פרטים אישיים) מתנקה כדי שלא יישאר מול הלקוחה הבאה
  const idleRef = useRef(null);
  useEffect(() => {
    if (!isLocked || !splashEnabled) return undefined;
    const arm = () => {
      clearTimeout(idleRef.current);
      idleRef.current = setTimeout(() => {
        // לקוחה חדשה מתחילה מחדש: כל הבחירות, החיפושים, שיחת ה-AI והפרטים שהוקלדו בטופס מתנקים (הנעילה נשארת)
        setRegKey((k) => k + 1);
        setMode('flow');
        setStage(1);
        setSelectedDate(null);
        setSelectedSizes([]);
        setModelChips([]);
        setModelInput('');
        setSearch('');
        setModelQuery('');
        setSelectedCategories([]);
        setShowZeroSizes(false);
        setSidebarOpen(false);
        setAiInput('');
        setAiChats(INITIAL_AI_CHATS);
        try { localStorage.removeItem('ai_customer_chat'); } catch (e) { /* בלי אחסון */ }
        setSplashKey((k) => k + 1);
        setSplashOn(true);
      }, IDLE_MS);
    };
    const evs = ['click', 'touchstart', 'mousemove', 'keydown', 'scroll'];
    evs.forEach((ev) => document.addEventListener(ev, arm, { passive: true }));
    arm();
    return () => { evs.forEach((ev) => document.removeEventListener(ev, arm)); clearTimeout(idleRef.current); };
  }, [isLocked, splashEnabled]);

  useEffect(() => {
    if (!zoomPopoverOpen) return undefined;
    const onDown = (e) => { if (zoomPopoverRef.current && !zoomPopoverRef.current.contains(e.target)) setZoomPopoverOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [zoomPopoverOpen]);

  // ---------------------------------------------------------------- העוזר החכם ----------------------------------------------------------------
  const chatKey = stage === 3 ? 2 : 1;
  const aiMessages = aiChats[chatKey] || [];
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);
  useEffect(() => { setIsAiChatVisible(false); }, [stage]);
  const chatEndRef = useRef(null);
  useEffect(() => {
    if (aiMessages.length > 0) {
      try { localStorage.setItem('ai_customer_chat', JSON.stringify(aiMessages)); } catch (e) { /* בלי אחסון */ }
    }
  }, [aiMessages]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [aiMessages]);

  const goResults = useCallback(() => { setMode('flow'); setStage(3); }, []);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: 'user', content: aiInput.trim() };
    setAiInput('');
    const newMessages = [...(aiChats[chatKey] || []), userMsg];
    setAiChats((prev) => ({ ...prev, [chatKey]: newMessages }));
    setIsAiChatVisible(true);
    setAiLoading(true);
    try {
      const historyContext = newMessages.map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך בשום אופן למסור מידע ניהולי (כמו סטטיסטיקות, רווחים, הכנסות, נתוני עובדים או מידע על לקוחות אחרים). אם הלקוח שואל שאלות לא קשורות או מבקש מידע חסוי, התנצל בנימוס ואמור שאין לך הרשאה לספק מידע זה ושהנך כאן רק לעזור בכל הקשור להזמנות השמלות של הלקוח.\nטיפ חכם: אם אתה ממליץ על דגם מסוים או מידה מסוימת, באפשרותך להוסיף בסוף התשובה שלך את התגית [FILTER:term] כאשר term הוא מילת החיפוש (למשל [FILTER:תחרה] או [FILTER:42]). המערכת תהפוך את זה לכפתור סינון עבור הלקוח.`,
        }),
      });
      const data = await res.json();
      const assistantMsg = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'שגיאה בחיבור למערכת ה-AI.' };
      setAiChats((prev) => ({ ...prev, [chatKey]: [...(prev[chatKey] || []), assistantMsg] }));
    } catch (err) {
      setAiChats((prev) => ({ ...prev, [chatKey]: [...(prev[chatKey] || []), { role: 'assistant', content: 'שגיאת תקשורת.' }] }));
    } finally {
      setAiLoading(false);
    }
  };

  // ------------------------------------------------------------------ נתונים ------------------------------------------------------------------
  const fetchInventory = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    const dateQuery = `?eventDate=${eventDate.toISOString()}&limit=10000`;
    // filterStatus=active (אותה לוגיקה של לשונית "פעיל" בקטלוג הניהול) מוציא דגמים מחוקים / שיצאו / שכל הפריטים שלהם notInUse, ודגם פעיל שהמלאי שלו אפס
    // עדיין מוצג (דיווח c11ef570). fields=kiosk (CPU phase 1B): פריטים מקובצים לפי (מידה, isUnusable, זמין) עם count, בלי ~13K שורות פריט.
    fetch(`/api/dresses${dateQuery}&filterStatus=active&fields=kiosk`)
      .then((res) => res.json())
      .then((data) => {
        // דגמים ללא אף פריט בכלל (שרידי יבוא ריקים) לא מוצגים - דיווח a0ecee8c/90472699; הבדיקה כאן היא הגנה כפולה בצד הלקוח
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : null);
        if (list) setDresses(list.filter((d) => !d.exitDateFromRepo && d.items && d.items.length > 0));
        else setLoadError(true); // N01: שגיאת שרת / התחברות מוצגת כשגיאה ולא כ"אין תוצאות" (הצעה, ממתינה לאישור הבעלים)
        setLoading(false);
      })
      .catch((e) => { console.error(e); setLoadError(true); setLoading(false); });
  }, [eventDate]);

  useEffect(() => { fetchInventory(); }, [fetchInventory]);

  useEffect(() => {
    fetch('/api/employees?slim=1').then((res) => res.json()).then((data) => { if (Array.isArray(data)) setEmployees(data); })
      .catch((err) => console.error('Failed to load employees:', err));
  }, []);
  useEffect(() => {
    fetch('/api/pricelists/categories').then((res) => res.json()).then((data) => { if (Array.isArray(data)) setPriceCategories(data); })
      .catch((err) => console.error('Failed to load price categories:', err));
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockEmployee) { setUnlockError('נא לבחור עובד'); return; }
    setUnlockError('');
    setUnlockLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: unlockEmployee, password: unlockPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShowUnlockModal(false);
        setUnlockPassword('');
        setUnlockEmployee('');
        setShowUnlockPassword(false);
        if (unlockIntent === 'print') {
          // העובד אישר הדפסה בלבד - המסך נשאר נעול
          setUnlockIntent('unlock');
          suppressRelockRef.current = true;
          handleCatalogPrint(printModelRef.current ? [printModelRef.current] : undefined);
          printModelRef.current = null;
          setTimeout(() => {
            suppressRelockRef.current = false;
            // ניסיון לשחזר מסך מלא אחרי שחלון ההדפסה נסגר; אם הדפדפן דוחה (אין מחוות משתמש) יציאה הבאה ממסך מלא תפתח שוב את חלון השחרור כרגיל
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
            }
          }, 2500);
        } else {
          setIsLocked(false);
          if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch((err) => console.warn(err));
        }
      } else {
        setUnlockError(data.message || 'שם עובד או סיסמא שגויים');
      }
    } catch (err) {
      setUnlockError('שגיאת תקשורת');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleModelDoubleClick = async (model, sizeName = null) => {
    if (isLocked) return;
    const fromDate = new Date(eventDate);
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date(eventDate);
    toDate.setDate(toDate.getDate() + 7);
    setOrdersModalModel(model);
    setOrdersModalSize(sizeName);
    setOrdersModalLoading(true);
    setOrdersModalOrders([]);
    setShowOrdersModal(true);
    try {
      const barcodePrefixParam = model.barcodePrefix ? `&modelBarcodePrefix=${encodeURIComponent(model.barcodePrefix)}` : '';
      const res = await fetch(`/api/orders?itemDetails=${encodeURIComponent(model.name)}${barcodePrefixParam}&eventDateFrom=${fromDate.toISOString()}&eventDateTo=${toDate.toISOString()}&filterStatus=all`);
      const data = await res.json();
      if (res.ok) {
        let filtered = data.data || [];
        if (sizeName) {
          filtered = filtered.filter((order) => order.items.some((item) => {
            const matchModel = item.dressId === model.id || (item.description && item.description.includes(model.name));
            const matchSize = item.description && (item.description.includes(`מידה: ${sizeName}`) || item.description.includes(sizeName));
            return matchModel && matchSize;
          }));
        }
        setOrdersModalOrders(filtered);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setOrdersModalLoading(false);
    }
  };

  const displayDresses = useMemo(() => {
    const list = dresses.filter((d) => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(d.priceCategory)) return false;
      if (modelSearchOn && !modelMatchesQuery(d, modelQuery)) return false;
      if (modelChips.length > 0 && !modelChips.some((c) => modelMatchesQuery(d, c))) return false;
      if (selectedSizes.length > 0) {
        const hasSelectedSize = d.items?.some((item) => {
          if (item.notInUse || item.isDeleted || item.isUnusable) return false;
          return selectedSizes.includes((item.sizeText || 'כללי').trim());
        });
        if (!hasSelectedSize) return false;
      }
      const term = search.trim().toLowerCase();
      if (!term) return true;
      // חיפוש מידה מפורש ("מידה 40"): התאמה מדויקת, בלי פריטים לא-בשימוש / מחוקים - כדי שריבועי המידה לא יביאו "140" / "40-42"
      const sizeMatch = term.match(/^מידה\s*(.+)$/);
      if (sizeMatch) {
        const cleanTerm = sizeMatch[1].trim();
        if (d.items) {
          return d.items.some((item) => {
            if (item.notInUse || item.isDeleted || item.isUnusable) return false;
            return (item.sizeText || 'כללי').trim().toLowerCase() === cleanTerm;
          });
        }
        return false;
      }
      const matchName = (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString() === term);
      if (matchName) return true;
      if (d.items) return d.items.some((item) => (item.sizeText || 'כללי').toLowerCase().includes(term));
      return false;
    });
    list.sort((a, b) => getModelDisplayName(a).toLowerCase().localeCompare(getModelDisplayName(b).toLowerCase(), undefined, { numeric: true }));
    return list;
  }, [dresses, search, selectedCategories, selectedSizes, modelQuery, modelSearchOn, modelChips]);

  const sizeChipData = useMemo(() => buildSizeChipData(dresses), [dresses]);
  const categoryCounts = useMemo(() => {
    const counts = {};
    dresses.forEach((d) => { if (d.priceCategory) counts[d.priceCategory] = (counts[d.priceCategory] || 0) + 1; });
    return counts;
  }, [dresses]);
  // נספר באותם כללים של כרטיסי הדגם ושל ההדפסה, כך שהמספר בסרגל לעולם לא סותר את מה שהכרטיסים מראים
  const grandTotalItems = useMemo(() => displayDresses.reduce((sum, m) => sum + getModelSizeInfo(m).totalAvailable, 0), [displayDresses]);
  const filtersActive = !!(search || selectedCategories.length > 0 || selectedSizes.length > 0 || modelChips.length > 0);

  const clearFilters = () => { setSearch(''); setModelQuery(''); setSelectedCategories([]); setSelectedSizes([]); setModelChips([]); setModelInput(''); };

  // modelsToPrint - אופציונלי: דגם בודד (כפתור המדפסת שליד כל דגם) במקום כל הקטלוג המסונן - דיווח 1c6a2c23.
  function handleCatalogPrint(modelsToPrint) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      a5.say('כדי להדפיס יש לאפשר חלונות קופצים', 'warn', 'אפשר חלונות קופצים (Pop-ups) בדפדפן ונסה שוב.');
      return;
    }
    const modelsForReport = modelsToPrint || displayDresses;
    const dateStr = getHebrewDateString(eventDate);
    let tableRows = '';
    modelsForReport.forEach((model) => {
      const sizeMap = new Map();
      let totalAvailable = 0;
      model.items?.forEach((item) => {
        if (item.notInUse || item.isDeleted || item.isUnusable) return;
        const st = item.sizeText || 'כללי';
        if (!sizeMap.has(st)) sizeMap.set(st, { available: 0 });
        const info = sizeMap.get(st);
        if (item.quantity > 0) {
          const n = item.count || 1;
          info.available += n;
          totalAvailable += n;
        }
      });
      const sizesArray = Array.from(sizeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
      const sizesHtml = sizesArray.map(([sName, sData]) => {
        const isAvail = sData.available > 0;
        return `<span style="display:inline-block; margin:2px; padding:4px 8px; border-radius:6px; font-size:13px; border:1px solid ${isAvail ? '#555' : '#ccc'}; color:${isAvail ? '#000' : '#999'}; ${isAvail ? 'font-weight:bold;' : ''}">${escHtml(sName)} (${sData.available})</span>`;
      }).join('');
      tableRows += `
        <tr>
          <td style="font-weight:bold;">${escHtml(getModelDisplayName(model))}</td>
          <td>${escHtml(model.barcodePrefix || model.id || '')}</td>
          <td style="font-weight:bold;">${totalAvailable}</td>
          <td style="direction:ltr; text-align:right;">${sizesHtml || 'אין מלאי'}</td>
        </tr>
      `;
    });
    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>דוח מלאי - ${dateStr}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: system-ui, -apple-system, sans-serif; color: #000; padding: 20px; margin: 0; background: #fff; }
          .bsd { text-align: right; font-weight: bold; font-size: 13px; margin-bottom: 6px; }
          .report-header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 15px; margin-bottom: 25px; }
          .report-header h1 { margin: 0 0 10px 0; font-size: 26px; color: #000; }
          .report-header p { margin: 0; font-size: 16px; color: #555; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #bbb; padding: 12px 16px; text-align: right; }
          th { background: #f1f5f9; font-weight: bold; color: #000; font-size: 15px; border-bottom: 2px solid #999; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          tbody tr:nth-child(even) { background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          thead { display: table-header-group; }
          tr { break-inside: avoid; page-break-inside: avoid; }
          .summary { font-size: 16px; font-weight: bold; margin-top: 20px; text-align: right; padding-top: 15px; border-top: 2px solid #999; break-inside: avoid; page-break-inside: avoid; }
          @media print {
            body { padding: 0; }
            table { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="bsd">בס"ד</div>
        <div class="report-header">
          <h1>דוח זמינות דגמים - גמ"ח שמלות</h1>
          <p>תאריך אירוע מבוקש: ${dateStr} | סינון: ${modelsToPrint ? escHtml(getModelDisplayName(modelsToPrint[0])) : (search ? `"${escHtml(search)}"` : 'ללא סינון')}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">שם הדגם</th>
              <th style="width: 15%;">קידומת ברקוד</th>
              <th style="width: 15%;">כמות זמינה</th>
              <th style="width: 45%;">פירוט מידות וזמינות</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="summary">
          סה"כ דגמים מוצגים: ${modelsForReport.length}
        </div>
        <script>
          window.onload = () => {
            setTimeout(() => {
              window.print();
              window.close();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }

  const askPrint = (model) => {
    if (isLocked) { printModelRef.current = model || null; setUnlockIntent('print'); setShowUnlockModal(true); return; }
    handleCatalogPrint(model ? [model] : undefined);
  };

  // "חזרה למערכת": ניווט מלא (לא router.push). העמדה מרונדרת בלי שלד האתר (app/layout.js, lib/shellBare.js) וה-layout לא מרונדר מחדש בניווט רך, ולכן רק טעינה
  // מלאה של דף הבית מחזירה את תפריט הצוות. (במסך נעול הלחצן פותח את חלון אישור העובד - ר' ה-onClick.)
  const exitToSystem = () => { window.location.assign('/'); };

  const lockScreen = () => {
    // חלון ההזמנות מקשר לדפי הצוות - לעולם לא משאירים אותו פתוח על עמדה נעולה
    setShowOrdersModal(false);
    setIsLocked(true);
    if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch((err) => console.warn(err));
  };

  // ------------------------------------------------------------------ ניווט ------------------------------------------------------------------
  const goStage = (n) => {
    setMode('flow');
    setStage(n);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const commitModelInput = () => {
    const v = modelInput.trim();
    if (v && !modelChips.includes(v)) setModelChips((p) => [...p, v]);
    setModelInput('');
    return v;
  };
  const toResults = () => {
    const v = modelInput.trim();
    if (v && !modelChips.includes(v)) setModelChips((p) => [...p, v]);
    setModelInput('');
    goStage(3);
  };
  const startFlow = () => { setSplashOn(false); setMode('flow'); setStage(1); };
  const startRegister = () => { setSplashOn(false); setRegKey((k) => k + 1); setMode('register'); };

  // טקסטים מוקלדים (hero): מתחילים כשמסך הפתיחה נסגר
  const heroActive = !splashOn && mode === 'flow';
  const hero = useTypewriter(HERO_TEXT, heroActive, { delay: 400, speed: 70 });

  // ------------------------------------------------------------------ תצוגה ------------------------------------------------------------------
  const showImages = settings.hide_dress_images !== 'true';

  const renderAiBubble = (msg, idx) => {
    let displayContent = msg.content;
    let isoDateMatch = null;
    let filterMatchStr = null;
    if (typeof displayContent === 'string') {
      const dateMatch = displayContent.match(/\[DATE:(\d{4}-\d{2}-\d{2})\]/);
      if (dateMatch) isoDateMatch = dateMatch[1];
      const filterMatch = displayContent.match(/\[FILTER:(.*?)\]/);
      if (filterMatch) filterMatchStr = filterMatch[1].trim();
      displayContent = displayContent.replace(/\[DATE:\d{4}-\d{2}-\d{2}\]/g, '').replace(/\[FILTER:(.*?)\]/g, '').trim();
    }
    const me = msg.role === 'user';
    return (
      <div key={idx} className={`bub ${me ? 'me' : 'bot'}`}>
        <span className="who"><KIcon id={me ? 'user' : 'sparkle'} size="sm" />{me ? 'אני' : 'תשובה'}</span>
        <p>{displayContent}</p>
        {!me && isoDateMatch && !filterMatchStr && (
          <div className="bub-acts">
            <button type="button" className="lrow" onClick={(e) => { e.preventDefault(); setSelectedDate(new Date(`${isoDateMatch}T12:00:00`)); goResults(); }}>
              <KIcon id="cal" size="sm" />הצג מלאי לתאריך {formatHebrewDate(new Date(`${isoDateMatch}T12:00:00`))}
            </button>
          </div>
        )}
        {!me && filterMatchStr && (
          <div className="bub-acts">
            <button type="button" className="lrow" onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSearch(filterMatchStr);
              if (isoDateMatch) setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
              goResults();
            }}>
              <KIcon id="search" size="sm" />סנן והצג: {filterMatchStr} {isoDateMatch ? `(לתאריך ${formatHebrewDate(new Date(`${isoDateMatch}T12:00:00`))})` : ''}
            </button>
          </div>
        )}
      </div>
    );
  };

  // כרטיס השיחה של העוזר החכם (משותף לשלב 1 ולתוצאות). העוטף display:contents עם gm-ds gm-home נותן את כללי הבועות של הפלטה (.gm-ds.gm-home .bub)
  const renderAiChatCard = (onClose) => (
    <div className="gm-ds gm-home" style={{ display: 'contents' }}>
      <div className="card res-one advp aiw ai-feature-element ks-ai-card">
        <div className="card-h">
          {onClose ? <button type="button" className="ibtn" aria-label="סגירת השיחה" data-agy-id="close_ai_chat_btn" onClick={onClose}><KIcon id="x" size="sm" /></button> : null}
          <h2>העוזר החכם</h2>
          <button type="button" className="ibtn" aria-label="שיחה חדשה" data-agy-id="new_ai_chat_btn"
            onClick={() => setAiChats((prev) => ({ ...prev, [chatKey]: [{ role: 'assistant', content: chatKey === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }] }))}>
            <KIcon id="plus" size="sm" />
          </button>
        </div>
        <div className="chat" aria-live="polite">
          {aiMessages.slice(1).map(renderAiBubble)}
          {aiLoading && <div className="typing" role="status" aria-label="העוזר החכם כותב תשובה"><span /><span /><span /></div>}
          <div ref={chatEndRef} />
        </div>
        <form className="fu fu-in" onSubmit={handleAiSubmit} aria-label="שאלה לעוזר החכם">
          <div className="scan">
            <label className="sr-only" htmlFor="ks-ai-q">שאלה לעוזר החכם</label>
            <input id="ks-ai-q" data-agy-id="ai_chat_input" value={aiInput} onChange={(e) => setAiInput(e.target.value)} disabled={aiLoading} placeholder="מה תרצי לחפש?" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other" />
            <button type="submit" className="btn primary" aria-label="שליחה" data-agy-id="ai_chat_submit_btn" disabled={aiLoading || !aiInput.trim()}><KIcon id="send" /></button>
          </div>
        </form>
      </div>
    </div>
  );

  // קטעי מידות לאריח / שורה: מידות עם מלאי בלבד (R31), או כולן עם קו חוצה כשהמתג "הצג גם מידות ללא מלאי פנוי" דלוק
  const renderSizeChips = (model, sizesArray) => {
    const visible = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);
    if (visible.length === 0) {
      return <span className="ks-nosz">{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי לתאריך זה'}</span>;
    }
    return visible.map(([sName, sData]) => (
      <span key={sName}
        className={`msz ${sData.available > 0 ? 'ok' : 'none'}${selectedSizes.includes(String(sName).trim()) ? ' hl' : ''}`}
        title={`מידה ${sName}: ${sData.available} פנויות`}
        style={{ cursor: isLocked ? 'default' : 'pointer' }}
        onClick={(e) => { e.stopPropagation(); handleModelDoubleClick(model, sName); }}>
        {sizeQtyContrast ? (<><span className="ks-sz">{sName}</span><span className="ks-qty">{sData.available}</span></>) : (<>{sName}{sData.available > 0 ? ` · ${sData.available}` : ''}</>)}
      </span>
    ));
  };

  const modelTitle = (model) => (model.barcodePrefix ? `דגם ${model.barcodePrefix}` : getModelDisplayName(model));
  const renderThumb = (model, cls) => (
    <div className={cls} style={{ background: tileColor(model) }} title={getModelDisplayName(model)}>
      {showImages && model.imageUrl ? <KioskThumbImg model={model} /> : <KIcon id="dress" size="lg" />}
    </div>
  );
  const renderAvail = (totalAvailable) => (
    <div className={`ks-avail ${totalAvailable > 0 ? 'ok' : 'bad'}`}>
      <KIcon id={totalAvailable > 0 ? 'check' : 'alert'} size="sm" />
      {totalAvailable > 0 ? `${totalAvailable} יחידות פנויות` : 'אין יחידות פנויות לתאריך זה'}
    </div>
  );
  const printBtn = (model) => (
    <button type="button" className="ibtn ks-tile-print" aria-label="הדפסת הדגם הזה בלבד" data-tip="הדפסת הדגם הזה בלבד" data-agy-id="print_model_btn"
      onClick={(e) => { e.stopPropagation(); askPrint(model); }}>
      <KIcon id="print" size="sm" />
    </button>
  );

  const renderResults = () => {
    if (loading) {
      return <div className="empty ks-state" role="status"><b>טוען נתונים...</b></div>;
    }
    if (loadError) {
      return (
        <div className="empty ks-state" role="alert" data-agy-id="kiosk_load_error">
          <b>לא הצלחנו לטעון את המלאי</b>
          <span>בדקי את החיבור ונסי שוב.</span>
          <button type="button" className="btn primary" data-agy-id="kiosk_retry_btn" onClick={fetchInventory}><KIcon id="refresh" size="sm" />נסו שוב</button>
        </div>
      );
    }
    if (displayDresses.length === 0) {
      return (
        <div className="empty ks-state" data-agy-id="kiosk_no_results">
          <b>אוי לא, אין את הדגמים שחיפשת :(</b>
          <span>נסי לנקות את החיפוש או את הסינון.</span>
          <button type="button" className="btn" data-agy-id="empty_state_clear_btn" onClick={clearFilters}><KIcon id="x" size="sm" />נקה סינון ונסה שוב</button>
        </div>
      );
    }
    if (viewMode === 'table') {
      return (
        <div className="ks-table-wrap" style={{ zoom: zoomLevel }}>
          <table className="rtbl ks-table">
            <thead>
              <tr><th></th><th>שם דגם</th><th>מק״ט</th><th>קטגוריה</th><th>סה״כ פנוי</th><th>פירוט לפי מידה</th></tr>
            </thead>
            <tbody>
              {displayDresses.map((model) => {
                const { sizesArray, totalAvailable } = getModelSizeInfo(model);
                return (
                  <tr key={model.id} onClick={() => handleModelDoubleClick(model)} style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                    <td className="ks-td-th">{renderThumb(model, 'ks-mini')}</td>
                    <td className="ks-td-name">{modelHasRealName(model) ? getModelDisplayName(model) : modelTitle(model)}</td>
                    <td>{model.barcodePrefix ? `#${model.barcodePrefix}` : '—'}</td>
                    <td>{model.priceCategory ? <span className="chip gray">{model.priceCategory}</span> : '—'}</td>
                    <td><b className={totalAvailable > 0 ? 'ks-ok' : 'ks-bad'}>{totalAvailable}</b></td>
                    <td><div className="msizes">{renderSizeChips(model, sizesArray)}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
    }
    if (viewMode === 'rows') {
      return (
        <div className="ks-rows" style={{ zoom: zoomLevel }}>
          {displayDresses.map((model) => {
            const { sizesArray, totalAvailable } = getModelSizeInfo(model);
            return (
              <div key={model.id} className="ks-row" style={{ cursor: isLocked ? 'default' : 'pointer' }} onClick={() => handleModelDoubleClick(model)}>
                {renderThumb(model, 'ks-mini')}
                <div className="ks-rmeta">
                  <b className="mname">{modelTitle(model)}</b>
                  {modelHasRealName(model) ? <span className="muted sm">{getModelDisplayName(model)}</span> : null}
                  {model.priceCategory && model.priceCategory !== 'כללי' ? <span className="chip gray">{model.priceCategory}</span> : null}
                </div>
                {renderAvail(totalAvailable)}
                <div className="msizes">{renderSizeChips(model, sizesArray)}</div>
                {printBtn(model)}
              </div>
            );
          })}
        </div>
      );
    }
    return (
      <div id="resTiles" style={{ zoom: zoomLevel }}>
        {displayDresses.map((model) => {
          const { sizesArray, totalAvailable } = getModelSizeInfo(model);
          return (
            <div key={model.id} className="tile" style={{ cursor: isLocked ? 'default' : 'pointer' }} onClick={() => handleModelDoubleClick(model)}>
              {printBtn(model)}
              {renderThumb(model, 'thumb2')}
              <div className="mname">{modelTitle(model)}</div>
              {modelHasRealName(model) || (model.priceCategory && model.priceCategory !== 'כללי') ? (
                <div className="muted sm ks-sub2">
                  {modelHasRealName(model) ? getModelDisplayName(model) : null}
                  {model.priceCategory && model.priceCategory !== 'כללי' ? <span className="chip gray">{model.priceCategory}</span> : null}
                </div>
              ) : null}
              {renderAvail(totalAvailable)}
              <div className="msizes">{renderSizeChips(model, sizesArray)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  const modelSearchBox = modelSearchOn ? (
    <div className="ks-msearch" data-guide-id="kiosk.model-search" data-agy-id="kiosk_model_search">
      <KIcon id="search" size="sm" />
      <input data-agy-id="kiosk_model_search_input" type="text" inputMode="search" autoComplete="off" aria-label="חיפוש דגם" placeholder="חיפוש דגם"
        value={modelQuery} onChange={(e) => setModelQuery(e.target.value)} />
      {modelQuery ? (
        <button type="button" className="ibtn" aria-label="ניקוי" onClick={() => setModelQuery('')}><KIcon id="x" size="sm" /></button>
      ) : null}
    </div>
  ) : null;

  const registrationOn = kioskSelfServiceOn;
  const dateForParsha = selectedDate ? new HDate(selectedDate) : null;

  return (
    <div className="app kiosk ks-root" data-agy-id="customer_inventory_main_container" data-stage={mode === 'register' ? 'register' : stage}>
      {splashEnabled ? (
        <Splash off={!splashOn} orgName={orgName} registrationOn={registrationOn} onStart={startFlow} onRegister={startRegister} replayKey={splashKey} />
      ) : null}

      {mode === 'register' ? (
        <KioskRegistration key={regKey} mode="station" settings={settings} onBack={() => setMode('flow')} onDone={() => { setMode('flow'); setStage(1); if (splashEnabled) { setSplashKey((k) => k + 1); setSplashOn(true); } }} />
      ) : (
        <>
          <h1 className={`kiosk-hero-title${stage === 3 ? ' compact' : ''}`}><span>{hero.shown}</span><span className={`caret${hero.done ? ' done' : ''}`} /></h1>
          <CtxLine stage={stage} dateText={dateText} showDateCol={!(stage === 3 && stickyDate)} sizes={selectedSizes} models={modelChips} search={search.trim()} onGoto={goStage} />

          {/* שלב 1: תאריך האירוע */}
          {stage === 1 && (
            <div className="panel on" id="p1">
              <div id="p1Card" className="ks-p1">
                <div className="ks-stephead" data-guide-id="kiosk.date-title">
                  <span className="step-eyebrow">שלב <span className="ks-snum">1</span></span>
                  <h2 className="kiosk-headline">סמני בלוח שלפנייך את תאריך האירוע</h2>
                  <svg className="step-down-arrow" viewBox="0 0 28 26" style={{ width: 36, height: 32, color: 'var(--gm-gold-d)' }} aria-hidden="true"><path d="M14 2v18M6 14l8 8 8-8" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>

                {aiEnabled && aiMessages.length <= 1 && (
                  <form className="ks-aipill ai-feature-element" onSubmit={(e) => { handleAiSubmit(e); }} aria-label="חיפוש חכם">
                    <span className="ks-aipill-ico"><KIcon id="sparkle" size="sm" /></span>
                    <input data-agy-id="hero_ai_search_input" type="text" placeholder="לדוגמה: שמלה שחורה מידה 12..." value={aiInput} onChange={(e) => setAiInput(e.target.value)} disabled={aiLoading} autoComplete="off" />
                    <button type="submit" className="ibtn" aria-label="שליחה" data-agy-id="hero_ai_search_btn" disabled={aiLoading}><KIcon id="send" size="sm" /></button>
                  </form>
                )}
                {aiEnabled && aiMessages.length > 1 && <div className="ks-aiwrap">{renderAiChatCard(null)}</div>}

                <KioskCalendar selectedDate={selectedDate} onSelect={(d) => setSelectedDate(d)} />

                <div className="ks-datesum" id="dateSummary" aria-live="polite">
                  {selectedDate ? (
                    <>
                      <span><span className="ds-label">נבחר:</span> <span className="ds-date">{dateText}</span></span>
                      {dateForParsha && parshaFooter(dateForParsha) ? <small className="ks-parsha">{parshaFooter(dateForParsha)}</small> : null}
                    </>
                  ) : null}
                </div>
                <div className="row ks-center">
                  <button type="button" className="btn primary" id="toStep2" data-guide-id="kiosk.step-next" data-agy-id="kiosk_to_step2_btn" disabled={!selectedDate} onClick={() => goStage(2)}>
                    לשלב הבא<svg className="ic" viewBox="0 0 28 20" style={{ width: 22, height: 16 }} aria-hidden="true">{ARROW}</svg>
                  </button>
                </div>

                {registrationOn && (
                  <div className="ks-cta" data-agy-id="kiosk_self_registration_cta">
                    <span className="ks-cta-ico"><KIcon id="user" /></span>
                    <div className="ks-cta-txt"><b>מילוי פרטים אישיים</b><span>ממלאים פעם אחת, והעובדת תמשיך איתך להזמנה.</span></div>
                    <button type="button" className="btn" data-guide-id="kiosk.register" data-agy-id="kiosk_open_register_btn" onClick={() => { setRegKey((k) => k + 1); setMode('register'); }}>
                      <KIcon id="pencil" size="sm" />למילוי הפרטים
                    </button>
                  </div>
                )}
                {/* 33 - הזמנה עצמית: עדיין stub מכוון - תלוי בהחלטות עסקיות שטרם נענו (אישור אוטומטי מול טיוטה לאישור צוות, תשלום מראש) - ראה KIOSK.md/CLAUDE.md. */}
                {kioskSelfServiceOn && (
                  <div className="ks-cta ks-cta-stub" data-agy-id="kiosk_self_order_stub_card">
                    <span className="ks-cta-ico"><KIcon id="bag" /></span>
                    <div className="ks-cta-txt"><b>הזמנה עצמאית</b><span>בקרוב תוכלי להזמין שמלה ישירות מכאן, בלי להמתין לצוות.</span></div>
                    <button data-agy-id="self_order_stub_btn" type="button" className="btn" disabled title="הזמנה עצמאית תיפתח בקרוב">הזמנה עצמאית תיפתח בקרוב</button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* שלב 2: דגם ומידה */}
          {stage === 2 && (
            <div className="panel on" id="p2">
              <div className="ks-p2" data-guide-id="kiosk.model-size">
                <div className="ks-stephead">
                  <span className="step-eyebrow">שלב <span className="ks-snum">2</span></span>
                  <h2 className="kiosk-headline">צייני את הדגם והמידה של השמלה</h2>
                </div>
                <div className="field">
                  <label className="lbl ks-biglbl" htmlFor="modelIn"><KIcon id="scan" className="model-ico" />מספר דגם</label>
                  <div className="inpw ks-inpw">
                    <input className="inp" id="modelIn" data-agy-id="kiosk_model_input" placeholder="לדוגמה: 4512" autoComplete="off" data-lpignore="true" data-1p-ignore data-form-type="other"
                      value={modelInput} onChange={(e) => setModelInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (modelInput.trim()) commitModelInput(); else toResults(); } }} />
                    <button type="button" className="ibtn ks-add" aria-label="הוספת הדגם" data-agy-id="kiosk_model_add_btn" onClick={commitModelInput} disabled={!modelInput.trim()}><KIcon id="plus" size="sm" /></button>
                  </div>
                  <div className="mlist" id="modelChips">
                    {modelChips.map((m) => (
                      <span className="mchip" key={m}>דגם {m}<button type="button" aria-label={`הסרת דגם ${m}`} onClick={() => setModelChips((p) => p.filter((x) => x !== m))}><KIcon id="x" size="sm" /></button></span>
                    ))}
                  </div>
                </div>
                <div className="field ks-sizesfield">
                  <label className="lbl ks-biglbl"><KIcon id="tag" className="tag-ico" />מידה <span className="ks-lblnote">(ניתן לבחור כמה)</span></label>
                  <div className="sizes" id="sizePick">
                    {loading && sizeChipData.length === 0 ? <span className="ks-nosz">טוען מידות...</span> : null}
                    {sizeChipData.map(([sz]) => {
                      const on = selectedSizes.includes(sz);
                      return (
                        <button type="button" key={sz} data-size={sz} className={on ? 'on' : ''} aria-pressed={on} data-agy-id={`size_chip_${sz}`}
                          onClick={() => setSelectedSizes((prev) => (on ? prev.filter((s) => s !== sz) : [...prev, sz]))}>{sz}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="row spread wrap ks-p2-actions">
                  <button type="button" className="btn ghost" id="back1From2" data-agy-id="kiosk_back_to_step1_btn" onClick={() => goStage(1)}><KIcon id="back" size="sm" />חזרה לתאריך</button>
                  <button type="button" className="btn primary" id="toStep3" data-guide-id="kiosk.to-results" data-agy-id="kiosk_to_results_btn" onClick={toResults}>
                    הצג תוצאות<svg className="ic" viewBox="0 0 28 20" style={{ width: 22, height: 16 }} aria-hidden="true">{ARROW}</svg>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* שלב 3: תוצאות */}
          {stage === 3 && (
            <div className="panel on" id="p3">
              {stickyDate && (
                <div className="ks-datebar" data-agy-id="kiosk_sticky_date_bar">
                  <KIcon id="cal" />
                  <div className="ks-datebar-main">
                    <span className="ks-datebar-label">התאריך שבחרת לבדיקת המלאי</span>
                    <span className="ks-datebar-date">{formatHebrewDate(eventDate)}</span>
                  </div>
                  <span className="ks-datebar-dow">{eventDate.toLocaleDateString('he-IL', { weekday: 'long' })}</span>
                  <button type="button" className="btn sm" data-guide-id="kiosk.step-date" data-agy-id="kiosk_change_date_btn" onClick={() => goStage(1)}><KIcon id="cal" size="sm" />שינוי תאריך</button>
                  {modelSearchBox}
                </div>
              )}

              <div className="ks-toolbar" id="rvG_tb">
                <h2 className="ks-tb-title"><KIcon id="bag" />קטלוג שמלות זמינות</h2>
                <span className="ks-count" data-agy-id="catalog_results_count">{displayDresses.length} דגמים · <b className="good">{grandTotalItems} פנויות</b></span>
                {!stickyDate && modelSearchBox}
                <div className="ks-tb-spacer" />
                {aiEnabled && (isAiChatVisible ? (
                  <button type="button" className="btn ai-feature-element ks-ask-active" data-agy-id="catalog_close_ai_btn" onClick={() => setIsAiChatVisible(false)}>
                    <KIcon id="sparkle" size="sm" />העוזר החכם פעיל - לחצי לסגירה
                  </button>
                ) : (
                  <form className="ks-aipill ks-aipill-sm ai-feature-element" onSubmit={handleAiSubmit} aria-label="שאלה לעוזר החכם">
                    <span className="ks-aipill-ico"><KIcon id="sparkle" size="sm" /></span>
                    <input data-agy-id="catalog_ai_input" type="text" aria-label="שאלי את העוזר החכם" value={aiInput} onChange={(e) => setAiInput(e.target.value)} disabled={aiLoading} autoComplete="off" />
                  </form>
                ))}
                <button type="button" className="btn" data-guide-id="kiosk.filter-btn" data-agy-id="toggle_sidebar_btn" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((o) => !o)}>
                  <KIcon id="sliders" size="sm" />סינון ותצוגה{filtersActive ? <span className="ks-dot" aria-label="יש סינון פעיל" /> : null}
                </button>
                <div className="ks-zoomwrap" ref={zoomPopoverRef}>
                  <button type="button" className="ibtn" aria-label="גודל תצוגה" data-tip="גודל תצוגה" data-agy-id="zoom_toggle_btn" onClick={() => setZoomPopoverOpen((o) => !o)}><KIcon id="search" size="sm" /></button>
                  {zoomPopoverOpen && (
                    <div className="ks-zoompop">
                      <div className="ks-zoomhead"><span>גודל תצוגה</span><b>{Math.round(zoomLevel * 100)}%</b></div>
                      <input data-agy-id="zoom_range_input" type="range" min="0.5" max="1.5" step="0.1" value={zoomLevel}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setZoomLevel(val);
                          try { localStorage.setItem('ka_zoom_level', String(val)); } catch (err) { /* בלי אחסון */ }
                        }} />
                      <div className="ks-zoomticks"><span>קטן</span><span>גדול</span></div>
                    </div>
                  )}
                </div>
                <div className="ks-cluster">
                  <button type="button" className="ibtn" aria-label="חזרה למערכת" data-tip="חזרה למערכת" data-guide-id="kiosk.exit" data-agy-id="exit_to_system_btn"
                    onClick={() => { if (isLocked) { setUnlockIntent('unlock'); setShowUnlockModal(true); return; } exitToSystem(); }}><KIcon id="logout" size="sm" /></button>
                  <button type="button" className="ibtn" aria-label="חיפוש חדש" data-tip="חיפוש חדש" data-agy-id="new_search_btn" onClick={() => goStage(1)}><KIcon id="search" size="sm" /></button>
                  <button type="button" className="ibtn" aria-label="רענון מלאי" data-tip="רענון מלאי" data-guide-id="kiosk.refresh" data-agy-id="refresh_inventory_btn" onClick={fetchInventory}><KIcon id="refresh" size="sm" /></button>
                  <button type="button" className="ibtn" aria-label={isLocked ? 'הדפסה (באישור עובד)' : 'הדפסה'} data-tip={isLocked ? 'הדפסה (באישור עובד)' : 'הדפסה'} data-guide-id="kiosk.print" data-agy-id="print_catalog_btn" onClick={() => askPrint(null)}><KIcon id="print" size="sm" /></button>
                  {isLocked ? (
                    <button type="button" className="ibtn ks-lock" aria-label="שחרור מסך" data-tip="שחרור מסך" data-agy-id="unlock_screen_btn" onClick={() => { setUnlockIntent('unlock'); setShowUnlockModal(true); }}><KIcon id="lock" size="sm" /></button>
                  ) : (
                    <button type="button" className="ibtn ks-lock" aria-label="נעילת מסך ללקוח" data-tip="נעילת מסך ללקוח - מעבר למסך מלא, יציאה (Esc) דורשת אישור עובד" data-guide-id="kiosk.lock" data-agy-id="lock_screen_btn" onClick={lockScreen}><KIcon id="lock" size="sm" /></button>
                  )}
                </div>
              </div>

              {aiEnabled && isAiChatVisible && <div className="ks-aiwrap">{renderAiChatCard(() => setIsAiChatVisible(false))}</div>}

              {sidebarOpen && (
                <aside className="ks-filter" data-guide-id="kiosk.filters" data-agy-id="catalog_sidebar">
                  <div className="ks-fgroup ks-fsearch">
                    <label className="lbl" htmlFor="ks-f-search"><KIcon id="search" size="sm" />חיפוש</label>
                    <input id="ks-f-search" className="inp" data-agy-id="catalog_search_input" type="text" placeholder="שם דגם, מספר, או מידה..." value={search} onChange={(e) => setSearch(e.target.value)} />
                    <small className="ks-hint">אפשר לחפש שם שמלה, מספר קטלוגי, או לכתוב "מידה 40"</small>
                  </div>
                  {priceCategories.length > 0 && (
                    <div className="ks-fgroup">
                      <span className="lbl"><KIcon id="tag" size="sm" />קטגוריה</span>
                      <div className="ks-checks">
                        {priceCategories.map((cat) => {
                          const count = categoryCounts[cat] || 0;
                          const checked = selectedCategories.includes(cat);
                          return (
                            <label key={cat} data-agy-id={`category_filter_${cat}`} className="ks-check" style={{ opacity: count === 0 && !checked ? 0.5 : 1 }}>
                              <input type="checkbox" checked={checked} onChange={() => setSelectedCategories((prev) => (checked ? prev.filter((c) => c !== cat) : [...prev, cat]))} />
                              <span>{cat}</span><em>{count}</em>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {sizeChipData.length > 0 && (
                    <div className="ks-fgroup">
                      <span className="lbl"><KIcon id="box" size="sm" />סינון מהיר לפי מידה</span>
                      <div className="sizes">
                        {sizeChipData.map(([sz, count]) => {
                          const active = selectedSizes.includes(sz);
                          return (
                            <button type="button" key={sz} className={active ? 'on' : ''} aria-pressed={active} data-agy-id={`size_filter_${sz}`}
                              onClick={() => setSelectedSizes((prev) => (active ? prev.filter((s) => s !== sz) : [...prev, sz]))}>
                              {sz}<em className="ks-cnt">{count}</em>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="ks-fgroup ks-fbottom">
                    <div className="trow ks-zero" data-agy-id="toggle_zero_sizes_div">
                      <label className="sw"><input type="checkbox" aria-label="הצג גם מידות ללא מלאי פנוי" checked={showZeroSizes} onChange={(e) => setShowZeroSizes(e.target.checked)} /><i /></label>
                      <b>הצג גם מידות ללא מלאי פנוי</b>
                    </div>
                    <div className="ks-views" role="group" aria-label="צורת תצוגה">
                      {[
                        { key: 'grid', label: 'כרטיסים גדולים', icon: 'dress', agy: 'view_grid_btn' },
                        { key: 'rows', label: 'רשימה מפורטת', icon: 'rows', agy: 'view_rows_btn' },
                        { key: 'table', label: 'טבלה קומפקטית', icon: 'table', agy: 'view_table_btn' },
                      ].map(({ key, label, icon, agy }) => (
                        <button key={key} type="button" className={`btn tgl${viewMode === key ? ' on' : ''}`} aria-pressed={viewMode === key} data-agy-id={agy} data-tip={label} aria-label={label} onClick={() => setViewMode(key)}>
                          <KIcon id={icon} size="sm" />
                        </button>
                      ))}
                    </div>
                    <button type="button" className="btn ghost" data-agy-id="clear_all_filters_btn" onClick={clearFilters}><KIcon id="x" size="sm" />נקה את כל הסינונים</button>
                  </div>
                </aside>
              )}

              {sizeQtyContrast && !loading && displayDresses.length > 0 && (
                <div className="ks-sq-legend"><span className="ks-qty">1</span>המספר בעיגול הירוק הוא כמה שמלות פנויות באותה מידה</div>
              )}
              <div className="ks-results">{renderResults()}</div>
            </div>
          )}
        </>
      )}

      {/* חלון שחרור / אישור עובד */}
      {showUnlockModal && (
        <Dlg labelledBy="ks-unlock-t" className="ks-unlock" focusSel="select, input"
          onClose={() => { setShowUnlockModal(false); setUnlockIntent('unlock'); setShowUnlockPassword(false); }}>
          <DlgBadge icon="lock" />
          <h2 id="ks-unlock-t">{unlockIntent === 'print' ? 'אישור עובד להדפסה' : 'שחרור מסך מנעילה'}</h2>
          <div className="sub">{unlockIntent === 'print' ? 'להדפסה נדרש אישור עובד. המסך יישאר נעול.' : 'לשחרור המסך נדרשת התחברות עובד.'}</div>
          <form onSubmit={handleUnlock} autoComplete="off" className="ks-unlock-form">
            <div className="field">
              <label className="lbl" htmlFor="ks-u-emp">בחר עובד</label>
              <select id="ks-u-emp" className="inp" data-agy-id="unlock_employee_select" value={unlockEmployee} onChange={(e) => setUnlockEmployee(e.target.value)}>
                <option value="">-- בחר --</option>
                {employees.map((emp) => (<option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>))}
              </select>
            </div>
            <div className="field">
              <label className="lbl" htmlFor="ks-u-pw">קוד גישה</label>
              <div className="inpw ks-inpw">
                <input id="ks-u-pw" className="inp" data-agy-id="unlock_password_input" type={showUnlockPassword ? 'text' : 'password'} autoComplete="off" placeholder="••••••"
                  value={unlockPassword} onChange={(e) => setUnlockPassword(e.target.value)} />
                <button type="button" className="ibtn ks-add" aria-label={showUnlockPassword ? 'הסתר סיסמה' : 'הצג סיסמה'} onClick={() => setShowUnlockPassword((v) => !v)}><KIcon id="eye" size="sm" /></button>
              </div>
            </div>
            {unlockError ? <div className="errline on" role="alert">{unlockError}</div> : null}
            <div className="dbtns">
              <button type="submit" className="btn primary lg block" data-agy-id="submit_unlock_btn" disabled={unlockLoading}>
                <KIcon id={unlockIntent === 'print' ? 'print' : 'lock'} />{unlockLoading ? 'בודק...' : (unlockIntent === 'print' ? 'אשר והדפס' : 'שחרר')}
              </button>
              <button type="button" className="btn ghost block" data-agy-id="cancel_unlock_btn"
                onClick={() => { setShowUnlockModal(false); setUnlockIntent('unlock'); setShowUnlockPassword(false); }}><KIcon id="back" size="sm" />ביטול</button>
            </div>
          </form>
        </Dlg>
      )}

      {/* חלון ההזמנות לדגם (R32: מוצג רק כשהמסך לא נעול; ההחלטה אם להשאיר אותו בעמדה פתוחה אצל הבעלים) */}
      {showOrdersModal && (
        <Dlg labelledBy="ks-orders-t" className="ks-orders" onClose={() => setShowOrdersModal(false)} focusSel=".btn.primary">
          <DlgBadge icon="bag" />
          <h2 id="ks-orders-t">הזמנות - {ordersModalModel ? getModelDisplayName(ordersModalModel) : ''} {ordersModalSize ? `(מידה ${ordersModalSize})` : ''}</h2>
          <div className="sub">טווח: שבוע לפני ואחרי תאריך האירוע</div>
          <div className="ks-orders-body">
            {ordersModalLoading ? (
              <p className="ks-doc-msg">טוען נתונים...</p>
            ) : ordersModalOrders.length === 0 ? (
              <p className="ks-doc-msg">לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר.</p>
            ) : ordersModalOrders.map((order) => {
              // order.status מ-/api/orders הוא שדה DB גולמי שכמעט תמיד ריק; מציגים סטטוס תשלום אמיתי מ-totalAmount/totalPaid כמו app/orders/page.js
              const paymentStatus = calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0);
              const paymentColor = getPaymentStatusColor(paymentStatus);
              return (
                <div key={order.orderId} className="ks-order-row">
                  <div className="om">
                    <strong>הזמנה #{order.orderId} - {order.customer?.firstName} {order.customer?.lastName}</strong>
                    <span>תאריך אירוע: {new Date(order.eventDate).toLocaleDateString('he-IL')}</span>
                  </div>
                  <span className="ks-pay" style={{ background: paymentColor.bg, color: paymentColor.text }}>{paymentStatus}</span>
                  <a href={`/orders/${order.orderId}`} target="_blank" rel="noopener noreferrer" title="פתח הזמנה" className="ibtn" aria-label="פתח הזמנה"><KIcon id="ext" size="sm" /></a>
                </div>
              );
            })}
          </div>
          <div className="dbtns">
            <button type="button" className="btn primary lg block" data-agy-id="close_orders_modal_btn" onClick={() => setShowOrdersModal(false)}><KIcon id="check" />סגירה</button>
          </div>
        </Dlg>
      )}
    </div>
  );
}
