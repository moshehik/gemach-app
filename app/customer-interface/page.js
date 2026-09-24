'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { getHebrewDateString, HEBREW_DAYS } from '@/lib/hebrewDate';
import { getDressThumbUrl } from '@/app/lib/dressImageUrl';
import { calculatePaymentStatus } from '@/lib/orderStatus';
import { V3Page, Card, Btn, IconBtn, Chip, Badge, Field, Tip, Dialog, Empty, Icon } from '@/app/v3/ui/components';
import './kiosk.css';

// 32/33 - קיוסק לקוח: מותנה ב-kiosk_customer_self_service / kiosk_allow_self_order (כבוי = מוסתר/דורש התחברות)
// הבאנר נבדק בכניסה ומציג הודעה אם התכונה כבויה בהגדרות.

// תמונת דגם בתאים הקטנים (טבלה 44px / שורות 80px): מנסים קודם את קובץ
// ה-thumb (קיים רק להעלאות חדשות — ראה app/lib/dressImageUrl.js), ועם onError
// נופלים חזרה לתמונה המלאה. loading="lazy" כדי שגלילה בקטלוג לא תוריד את
// כל התמונות מראש.
function KioskThumbImg({ model }) {
  const thumbSrc = getDressThumbUrl(model);
  return (
    <img
      src={thumbSrc || model.imageUrl}
      alt={model.name}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const img = e.target;
        if (thumbSrc && !img.dataset.fellBack) {
          img.dataset.fellBack = '1';
          img.src = model.imageUrl;
        }
      }}
    />
  );
}

// כמה דגמים חדשים נשמרו עם השם הזמני "ללא שם" (עובד שהזין אותו כדי לעקוף אימות
// שדה-חובה בטרם החליט על שם אמיתי) - זה לא שם תיאורי, אז ללקוח עדיף להציג את
// מספר הדגם (כמו שכבר קורה לדגמים בלי שם תיאורי בכלל) מאשר את המחרוזת המילולית.
// שימי לב: \b ב-JS לא עובד על אותיות עברית (\w הוא ASCII בלבד) אז בדיקת regex עם \b
// אף פעם לא תואמת כאן - ר' דיווח dd108f1f/13ca5dae, הבדיקה הקודמת לא זיהתה כלום.
function getModelDisplayName(model) {
  const rawName = (model.name || '').trim();
  if (rawName && !rawName.startsWith('ללא שם')) return rawName;
  return model.barcodePrefix ? String(model.barcodePrefix) : rawName;
}

// דגמים בלי שם תיאורי אמיתי (getModelDisplayName מחזיר להם את מספר הדגם עצמו) מציגים
// בתצוגת "שורות" את אותו מספר פעמיים נוספות (תג "#מספר" בכותרת + שורת קוד נפרדת),
// בנוסף לעיגול שכבר מציג אותו — ר' דיווח ffa88595. חלק מהדגמים המיובאים מאקסס נשמרו
// עם model.name שהוא בדיוק מספר הדגם עצמו כמחרוזת (למשל name="316", barcodePrefix=316)
// - זה עדיין לא שם תיאורי אמיתי, למרות ש-rawName כאן לא ריק ולא מתחיל ב"ללא שם".
function modelHasRealName(model) {
  const rawName = (model.name || '').trim();
  if (!rawName || rawName.startsWith('ללא שם')) return false;
  if (model.barcodePrefix != null && rawName === String(model.barcodePrefix)) return false;
  return true;
}

// עיגול פרופיל לדגם: תמונה אם קיימת (ומותרת), אחרת אותיות הדגם —
// אות ראשונה משתי המילים הראשונות, או שתי האותיות הראשונות בשם של מילה אחת.
function ModelAvatar({ model, size, showImage }) {
  const name = getModelDisplayName(model);
  const parts = name.split(/\s+/).filter(Boolean);
  // הרבה דגמים (בעיקר מיובאים מאקסס) נקראים רק לפי הקוד המספרי שלהם (למשל "316"),
  // בלי שם תיאורי אמיתי - עבורם 2 תווים ראשונים חותכים ספרה וגורמים לבלבול (306
  // מוצג "30"), אז מילה בודדת שהיא מספר מלא מוצגת עד 3 ספרות במקום 2.
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`
    : (/^\d+$/.test(parts[0] || '') ? parts[0].slice(0, 3) : name.slice(0, 2)) || '?';
  return (
    <div className={`v3k-avatar v3k-avatar--${size}`} title={name}>
      {showImage && model.imageUrl ? <KioskThumbImg model={model} /> : <span>{initials}</span>}
    </div>
  );
}

// כפתור מידה (pill): מספר יחידות פנויות. לחיצה פותחת את חלונית ההזמנות לאותה מידה.
// כשהמסך נעול זה רק תווית (הלחיצה בכלל לא עושה דבר בנעילה - handleModelDoubleClick חוזר מיד).
function SizePill({ sName, available, locked, onPick }) {
  const cls = `v3k-pill ${available > 0 ? 'is-avail' : 'is-out'}`;
  const label = `מידה ${sName}: ${available} פנויות`;
  const inner = (
    <>
      <bdi>{sName}</bdi>
      <span className="v3k-pill__n"><bdi>{available}</bdi></span>
    </>
  );
  if (locked) return <span className={`${cls} is-static`} title={label}>{inner}</span>;
  return (
    <button type="button" className={cls} title={label} aria-label={label}
      onClick={(e) => { e.stopPropagation(); onPick(); }}>
      {inner}
    </button>
  );
}

const getMonthsForYear = (year) => {
  const isLeap = HDate.isLeapYear(year);
  return [
    { value: 7, label: 'תשרי' },
    { value: 8, label: 'חשוון' },
    { value: 9, label: 'כסלו' },
    { value: 10, label: 'טבת' },
    { value: 11, label: 'שבט' },
    { value: 12, label: isLeap ? "אדר א'" : 'אדר' },
    ...(isLeap ? [{ value: 13, label: "אדר ב'" }] : []),
    { value: 1, label: 'ניסן' },
    { value: 2, label: 'אייר' },
    { value: 3, label: 'סיוון' },
    { value: 4, label: 'תמוז' },
    { value: 5, label: 'אב' },
    { value: 6, label: 'אלול' },
  ];
};

// לוח שנה עברי מוטמע (inline) של מסך הלקוח, במקום הפופאפ של HebrewDatePicker.
// כל בחירה (selects / גריד / "היום") מעדכנת את התאריך וגם מעבירה לשלב 2 (onSelect בעמוד).
function KioskCalendar({ selectedDate, onSelect }) {
  const selHd = useMemo(() => {
    try {
      const d = new Date(selectedDate);
      return isNaN(d.getTime()) ? new HDate() : new HDate(d);
    } catch (e) {
      return new HDate();
    }
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(() => selHd.getFullYear());
  const [viewMonth, setViewMonth] = useState(() => selHd.getMonth());

  // כשמשנים בחירה (גם דרך ה-AI) — הלוח קופץ לחודש של התאריך הנבחר
  useEffect(() => {
    setViewYear(selHd.getFullYear());
    setViewMonth(selHd.getMonth());
  }, [selHd]);

  const months = getMonthsForYear(viewYear);
  const daysInMonth = HDate.daysInMonth(viewMonth, viewYear);
  const monthLabel = months.find(m => m.value === viewMonth)?.label || '';

  const todayAbs = useMemo(() => {
    try { return new HDate().abs(); } catch (e) { return null; }
  }, []);
  const selAbs = selHd.abs();

  const applyHdate = (hd) => {
    const g = hd.greg();
    g.setHours(0, 0, 0, 0);
    onSelect(g);
  };

  const changeSelection = (day, month, year) => {
    let mm = month;
    if (mm === 13 && !HDate.isLeapYear(year)) mm = 12;
    const dim = HDate.daysInMonth(mm, year);
    applyHdate(new HDate(Math.min(day, dim), mm, year));
  };

  const prevMonth = () => {
    const p = new HDate(1, viewMonth, viewYear).subtract(1, 'd');
    setViewMonth(p.getMonth());
    setViewYear(p.getFullYear());
  };
  const nextMonth = () => {
    const n = new HDate(1, viewMonth, viewYear).add(daysInMonth, 'd');
    setViewMonth(n.getMonth());
    setViewYear(n.getFullYear());
  };

  const yearOptions = useMemo(() => {
    const cur = new HDate().getFullYear();
    return Array.from({ length: 32 }, (_, i) => cur - 1 + i);
  }, []);

  // "י״ג באדר תשפ״ו — פרשת ויקהל" (פרשת השבוע של השבת הקרובה לתאריך הנבחר)
  const footStr = useMemo(() => {
    let s = getHebrewDateString(selectedDate) || '';
    try {
      const sat = selHd.onOrAfter(6);
      const sedra = new Sedra(sat.getFullYear(), true);
      const lookup = sedra.lookup(sat);
      const p = lookup && lookup.parsha
        ? lookup.parsha.map(x => Locale.gettext(x, 'he-x-NoNikud')).join('-')
        : '';
      if (p) s += ` — פרשת ${p}`;
    } catch (e) {}
    return s;
  }, [selectedDate, selHd]);

  // תאי הגריד לחודש נתון: זנב החודש הקודם (מעומעם) + החודש + ראש החודש הבא להשלמת שבוע
  const buildMonthCells = (month, year) => {
    const out = [];
    try {
      const dim = HDate.daysInMonth(month, year);
      const first = new HDate(1, month, year);
      const firstDow = first.greg().getDay();
      for (let i = firstDow; i > 0; i--) {
        out.push({ hd: first.subtract(i, 'd'), muted: true });
      }
      for (let d = 1; d <= dim; d++) {
        out.push({ hd: new HDate(d, month, year), muted: false });
      }
      let tail = new HDate(dim, month, year);
      while (out.length % 7 !== 0) {
        tail = tail.add(1, 'd');
        out.push({ hd: tail, muted: true });
      }
    } catch (e) {}
    return out;
  };

  // מציגים 3 חודשים רצופים (חודש נוכחי + 2 הבאים) כדי לראות תאריכים קרובים בלי לדפדף
  const monthsToShow = useMemo(() => {
    const list = [{ month: viewMonth, year: viewYear, label: monthLabel }];
    let cur = new HDate(1, viewMonth, viewYear);
    for (let i = 0; i < 2; i++) {
      cur = cur.add(HDate.daysInMonth(cur.getMonth(), cur.getFullYear()), 'd');
      const label = getMonthsForYear(cur.getFullYear()).find(m => m.value === cur.getMonth())?.label || '';
      list.push({ month: cur.getMonth(), year: cur.getFullYear(), label });
    }
    return list;
  }, [viewMonth, viewYear, monthLabel]);

  return (
    <>
      <div className="v3k-cal-selects">
        <Field as="select" label="יום" data-agy-id="kiosk_cal_day_select" value={selHd.getDate()}
          onChange={e => changeSelection(parseInt(e.target.value), selHd.getMonth(), selHd.getFullYear())}>
          {Array.from({ length: HDate.daysInMonth(selHd.getMonth(), selHd.getFullYear()) }, (_, i) => i + 1).map(d => (
            <option key={d} value={d}>{HEBREW_DAYS[d]}</option>
          ))}
        </Field>
        <Field as="select" label="חודש" data-agy-id="kiosk_cal_month_select" value={selHd.getMonth()}
          onChange={e => changeSelection(selHd.getDate(), parseInt(e.target.value), selHd.getFullYear())}>
          {getMonthsForYear(selHd.getFullYear()).map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Field>
        <Field as="select" label="שנה" data-agy-id="kiosk_cal_year_select" value={selHd.getFullYear()}
          onChange={e => changeSelection(selHd.getDate(), selHd.getMonth(), parseInt(e.target.value))}>
          {yearOptions.map(y => (
            <option key={y} value={y}>{gematriya(y)}</option>
          ))}
        </Field>
      </div>

      <div className="v3k-cal">
        <div className="v3k-cal__head">
          <IconBtn icon="chevron-end" label="לחודש הקודם" size="lg" onClick={prevMonth} />
          <span className="v3k-cal__range">{monthsToShow[0].label} {gematriya(monthsToShow[0].year)} - {monthsToShow[monthsToShow.length - 1].label} {gematriya(monthsToShow[monthsToShow.length - 1].year)}</span>
          <IconBtn icon="chevron-start" label="לחודש הבא" size="lg" onClick={nextMonth} />
        </div>
        <div className="v3k-cal__months">
          {monthsToShow.map(({ month, year, label }, mi) => (
            <div key={mi} className="v3k-cal__month">
              <div className="v3k-cal__month-label">{label} {gematriya(year)}</div>
              <div className="v3k-cal__weekdays" aria-hidden="true">
                <span>א</span><span>ב</span><span>ג</span><span>ד</span><span>ה</span><span>ו</span><span>ש</span>
              </div>
              <div className="v3k-cal__grid">
                {buildMonthCells(month, year).map(({ hd, muted }, idx) => {
                  const abs = hd.abs();
                  const isSelected = abs === selAbs;
                  const isToday = todayAbs !== null && abs === todayAbs;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`v3k-cal__day${muted ? ' is-muted' : ''}${isSelected ? ' is-selected' : ''}${isToday && !isSelected ? ' is-today' : ''}`}
                      onClick={muted ? undefined : () => applyHdate(hd)}
                      tabIndex={muted ? -1 : 0}
                      aria-pressed={muted ? undefined : isSelected}
                      aria-current={isToday ? 'date' : undefined}
                      aria-disabled={muted || undefined}
                      aria-label={`${HEBREW_DAYS[hd.getDate()]} (${hd.greg().toLocaleDateString('he-IL')})`}
                    >
                      <span>{HEBREW_DAYS[hd.getDate()]}</span>
                      <span className="g"><bdi>{hd.greg().getDate()}</bdi></span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="v3k-cal__foot">
          <span className="v3k-cal__parsha">{footStr}</span>
          <Btn variant="quiet" icon="calendar" data-agy-id="kiosk_cal_clear_btn" onClick={() => applyHdate(new HDate())}>היום</Btn>
        </div>
      </div>
    </>
  );
}

export default function CustomerInventoryViewer() {
  const router = useRouter();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(1);
  const [search, setSearch] = useState('');
  const [showZeroSizes, setShowZeroSizes] = useState(false);
  const [viewMode, setViewMode] = useState('rows');
  const [zoomPopoverOpen, setZoomPopoverOpen] = useState(false);
  const zoomPopoverRef = useRef(null);
  const [zoomLevel, setZoomLevel] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const saved = parseFloat(localStorage.getItem('ka_zoom_level'));
    return !isNaN(saved) && saved >= 0.5 && saved <= 1.5 ? saved : 1;
  });
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [unlockEmployee, setUnlockEmployee] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalModel, setOrdersModalModel] = useState(null);
  const [ordersModalSize, setOrdersModalSize] = useState(null);
  const [ordersModalLoading, setOrdersModalLoading] = useState(false);
  const [ordersModalOrders, setOrdersModalOrders] = useState([]);
  const [settings, setSettings] = useState({ hide_dress_images: 'false' });

  // 32 - טופס רישום עצמי ללקוח (מוצג רק כש-kiosk_customer_self_service דלוק, ראה
  // kioskSelfServiceOn למטה). קורא ל-POST /api/customers הקיים - אותו endpoint
  // שמשמש את "לקוח חדש" בהזמנה (app/orders/new/page.js), עם אותה ולידציה בדיוק.
  const [regForm, setRegForm] = useState({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '', marketingConsent: false });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState(null); // legacyId אחרי הצלחה

  // Sidebar filters (stage 2) - סגור כברירת מחדל (דיווח 267e5bbb): נפתח רק ביוזמת
  // הלקוחה דרך כפתור "סינון ותצוגה", לא אוטומטית בכל כניסה למסך.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [priceCategories, setPriceCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  // What a successful employee login in the unlock modal should do:
  // 'unlock' releases the kiosk lock; 'print' only authorizes a one-off print and keeps the lock.
  const [unlockIntent, setUnlockIntent] = useState('unlock');
  // True during an employee-authorized print from a locked kiosk, so the
  // fullscreen exit caused by the print popup doesn't re-open the unlock modal.
  const suppressRelockRef = useRef(false);
  // דגם ספציפי שמחכה להדפסה אחרי אישור עובד (כפתור המדפסת שליד דגם בודד, כשהמסך
  // נעול) - null = הדפסת כל הקטלוג המסונן, כמו כפתור המדפסת הראשי.
  const printModelRef = useRef(null);

  const aiEnabled = settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true';
  const kioskSelfServiceOn = settings.kiosk_customer_self_service === 'true';
  const kioskAllowOrder = settings.kiosk_allow_self_order === 'true';

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const settingsObj = { hide_dress_images: 'false' };
        if (Array.isArray(data)) {
          data.forEach(s => {
            if (s.key) settingsObj[s.key] = s.value;
          });
        }
        setSettings(settingsObj);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (isLocked) {
      document.body.classList.add('hide-global-nav');
    } else {
      document.body.classList.remove('hide-global-nav');
    }
    return () => document.body.classList.remove('hide-global-nav');
  }, [isLocked]);

  // רקע העמוד על כל אזור התוכן (העמוד עצמו מוגבל ברוחב) והסרת ה-padding של .content —
  // ראה body.katelier-bg בקובץ kiosk.css (שם המחלקה נשמר, הוא חלק מהחוזה). מוסר בעזיבת המסך.
  useEffect(() => {
    document.body.classList.add('katelier-bg');
    return () => document.body.classList.remove('katelier-bg');
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      // Don't touch the modal if it's already open (would overwrite a pending 'print'
      // intent mid-typing), and don't re-open it for the fullscreen exit that an
      // employee-authorized print itself causes (suppressRelockRef window).
      if (isLocked && !document.fullscreenElement && !showUnlockModal && !suppressRelockRef.current) {
        setUnlockIntent('unlock');
        setShowUnlockModal(true);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isLocked, showUnlockModal]);

  // Right-click context menu ("Inspect", "View source", etc.) is a bigger escape hole
  // than anything the header buttons offered, so block it entirely while the kiosk is locked.
  useEffect(() => {
    const handleContextMenu = (e) => {
      if (isLocked) e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [isLocked]);

  // AI Chat State
  const [aiInput, setAiInput] = useState('');
  const [aiChats, setAiChats] = useState({
    1: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }],
    2: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים, להציג תפוסה מלאה ולענות על שאלות. במה אפשר לעזור?' }]
  });
  const aiMessages = aiChats[stage] || [];
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);
  useEffect(() => { setIsAiChatVisible(false); }, [stage]); // Close chat on stage change

  useEffect(() => {
    if (!zoomPopoverOpen) return;
    const handleClickOutside = (e) => {
      if (zoomPopoverRef.current && !zoomPopoverRef.current.contains(e.target)) {
        setZoomPopoverOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [zoomPopoverOpen]);

  const chatEndRef = useRef(null);

  useEffect(() => {
    if (aiMessages.length > 0) {
      localStorage.setItem('ai_customer_chat', JSON.stringify(aiMessages));
    }
  }, [aiMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if (!aiInput.trim() || aiLoading) return;
    const userMsg = { role: 'user', content: aiInput.trim() };
    setAiInput('');

    const newMessages = [...(aiChats[stage] || []), userMsg];
    setAiChats(prev => ({ ...prev, [stage]: newMessages }));
    setIsAiChatVisible(true);
    setAiLoading(true);

    try {
      const historyContext = newMessages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך בשום אופן למסור מידע ניהולי (כמו סטטיסטיקות, רווחים, הכנסות, נתוני עובדים או מידע על לקוחות אחרים). אם הלקוח שואל שאלות לא קשורות או מבקש מידע חסוי, התנצל בנימוס ואמור שאין לך הרשאה לספק מידע זה ושהנך כאן רק לעזור בכל הקשור להזמנות השמלות של הלקוח.\nטיפ חכם: אם אתה ממליץ על דגם מסוים או מידה מסוימת, באפשרותך להוסיף בסוף התשובה שלך את התגית [FILTER:term] כאשר term הוא מילת החיפוש (למשל [FILTER:תחרה] או [FILTER:42]). המערכת תהפוך את זה לכפתור סינון עבור הלקוח.`
        }),
      });
      const data = await res.json();

      const assistantMsg = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'שגיאה בחיבור למערכת ה-AI.' };

      setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage] || []), assistantMsg] }));
    } catch (err) {
      setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage] || []), { role: 'assistant', content: 'שגיאת תקשורת.' }] }));
    } finally {
      setAiLoading(false);
    }
  };

  const fetchInventory = () => {
    setLoading(true);
    const dateQuery = selectedDate ? `?eventDate=${selectedDate.toISOString()}&limit=10000` : '?limit=10000';
    // filterStatus=active (same server-side logic the admin catalog's "פעיל" tab uses -
    // app/api/dresses/route.js) excludes isDeleted/exited models and models whose every
    // item is notInUse/deleted, so a fully-retired design (all items notInUse, e.g.
    // דיווח 9b7fe2af - models 316/333/417) never reaches the public kiosk - while a
    // model that still has real active items just booked out for this date is still
    // returned (מלאי אפס מדגם פעיל עדיין כן מוצג - דיווח c11ef570).
    fetch(`/api/dresses${dateQuery}&filterStatus=active`)
      .then(res => res.json())
      .then(data => {
        // דגמים ללא אף פריט בכלל (שרידי יבוא ריקים, לא "מלאי אפס") גם לא אמורים
        // להופיע - דיווח a0ecee8c/90472699 (כבר מסונן ע"י filterStatus=active למעלה,
        // הבדיקה כאן היא הגנה כפולה בצד הלקוח).
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.data) ? data.data : null);
        if (list) {
          setDresses(list.filter(d => !d.exitDateFromRepo && d.items && d.items.length > 0));
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedDate]);

  useEffect(() => {
    fetch('/api/employees')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setEmployees(data);
      })
      .catch(err => console.error('Failed to load employees:', err));
  }, []);

  useEffect(() => {
    fetch('/api/pricelists/categories')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setPriceCategories(data);
      })
      .catch(err => console.error('Failed to load price categories:', err));
  }, []);

  const handleUnlock = async (e) => {
    e.preventDefault();
    if (!unlockEmployee) {
      setUnlockError('נא לבחור עובד');
      return;
    }

    setUnlockError('');
    setUnlockLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: unlockEmployee, password: unlockPassword })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setShowUnlockModal(false);
        setUnlockPassword('');
        setUnlockEmployee('');
        setShowUnlockPassword(false);
        if (unlockIntent === 'print') {
          // Employee only authorized a print — the kiosk stays locked.
          setUnlockIntent('unlock');
          suppressRelockRef.current = true;
          handleCatalogPrint(printModelRef.current ? [printModelRef.current] : undefined);
          printModelRef.current = null;
          setTimeout(() => {
            suppressRelockRef.current = false;
            // Best effort to restore fullscreen after the print popup closed;
            // if the browser rejects it (no user gesture), the next fullscreen
            // exit event will still re-open the unlock modal as usual.
            if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {});
            }
          }, 2500);
        } else {
          setIsLocked(false);
          if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(err => console.warn(err));
          }
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

  // 32 - אותם שדות/כינויים/ולידציה בדיוק כמו getMissingMandatoryCustomerFields
  // ב-app/orders/new/page.js: שם פרטי/משפחה/טלפון תמיד חובה; מייל/כתובת מלאה/
  // אישור דיוור רק כשההגדרה המתאימה (require_customer_email / require_full_address /
  // require_marketing_consent) דלוקה. שדה חופשי mandatory_fields נבדק גם הוא, לאותה
  // אחידות עם טופס ההזמנה - גם אם strict_mandatory_fields כבוי (השרת הוא שאוכף strict).
  const CUSTOMER_FIELD_ALIASES = {
    firstName: ['firstname', 'שם פרטי', 'שם_פרטי'],
    lastName: ['lastname', 'שם משפחה', 'שם_משפחה'],
    phone1: ['phone1', 'טלפון ראשי (נייד)', 'טלפון_1'],
    email: ['email', 'אימייל'],
    city: ['city', 'עיר'],
    street: ['street', 'רחוב'],
    houseNum: ['housenum', 'מספר בית', 'מספר_בית']
  };
  const CUSTOMER_FIELD_LABELS = {
    firstName: 'שם פרטי', lastName: 'שם משפחה', phone1: 'טלפון', email: 'אימייל', city: 'עיר', street: 'רחוב', houseNum: 'מספר בית', marketingConsent: 'אישור דיוור'
  };
  const getMissingRegFields = (customerObj) => {
    const configuredMandatory = (settings.mandatory_fields || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const baseMissing = Object.keys(CUSTOMER_FIELD_ALIASES).filter((key) => {
      const alwaysRequired = key === 'firstName' || key === 'lastName' || key === 'phone1';
      const isRequired = alwaysRequired || CUSTOMER_FIELD_ALIASES[key].some(alias => configuredMandatory.includes(alias.toLowerCase()));
      return isRequired && !String(customerObj[key] || '').trim();
    });
    const extra = [];
    if (settings.require_customer_email === 'true' && !String(customerObj.email || '').trim()) extra.push('email');
    if (settings.require_full_address === 'true') {
      if (!String(customerObj.city || '').trim()) extra.push('city');
      if (!String(customerObj.street || '').trim()) extra.push('street');
      if (!String(customerObj.houseNum || '').trim()) extra.push('houseNum');
    }
    if (settings.hide_marketing_consent_field !== 'true' && settings.require_marketing_consent === 'true' && !customerObj.marketingConsent) extra.push('marketingConsent');
    return [...baseMissing, ...extra.filter(k => !baseMissing.includes(k))];
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setRegError('');
    const missing = getMissingRegFields(regForm);
    if (missing.length > 0) {
      setRegError(`שדות חובה חסרים: ${missing.map(k => CUSTOMER_FIELD_LABELS[k] || k).join(', ')}`);
      return;
    }
    setRegSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm)
      });
      const data = await res.json();
      if (res.ok) {
        setRegSuccess(data);
      } else if (res.status === 401) {
        // require_login דלוק ואין עובד מחובר במסך הזה כרגע - אותה מגבלה שכבר
        // חלה על כל שאר קריאות ה-API בעמדה הזו (מלאי/עובדים/קטגוריות).
        setRegError('הרישום דורש עובד מחובר במערכת. נא לפנות לצוות הגמ"ח.');
      } else {
        setRegError(data.error || 'שגיאה ברישום, נא לפנות לצוות הגמ"ח');
      }
    } catch (err) {
      console.error(err);
      setRegError('שגיאת תקשורת - נא לפנות לצוות הגמ"ח');
    } finally {
      setRegSubmitting(false);
    }
  };

  const handleModelDoubleClick = async (model, sizeName = null) => {
    if (isLocked) return;
    const fromDate = new Date(selectedDate);
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date(selectedDate);
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
          filtered = filtered.filter(order => {
            return order.items.some(item => {
              const matchModel = item.dressId === model.id || (item.description && item.description.includes(model.name));
              const matchSize = item.description && (item.description.includes(`מידה: ${sizeName}`) || item.description.includes(sizeName));
              return matchModel && matchSize;
            });
          });
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
    let list = dresses.filter(d => {
      if (selectedCategories.length > 0 && !selectedCategories.includes(d.priceCategory)) return false;

      if (selectedSizes.length > 0) {
        const hasSelectedSize = d.items?.some(item => {
          if (item.notInUse || item.isDeleted || item.isUnusable) return false;
          return selectedSizes.includes((item.sizeText || 'כללי').trim());
        });
        if (!hasSelectedSize) return false;
      }

      const term = search.trim().toLowerCase();
      if (!term) return true;

      // Handle explicit size search
      // Exact size match, excluding unusable items — so the sidebar size chips
      // ("מידה 40") never pull in "140" / "40-42" or deleted-item-only models.
      const sizeMatch = term.match(/^מידה\s*(.+)$/);
      if (sizeMatch) {
        const cleanTerm = sizeMatch[1].trim();
        if (d.items) {
          return d.items.some(item => {
            if (item.notInUse || item.isDeleted || item.isUnusable) return false;
            return (item.sizeText || 'כללי').trim().toLowerCase() === cleanTerm;
          });
        }
        return false;
      }

      const matchName = (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString() === term);
      if (matchName) return true;
      if (d.items) {
        return d.items.some(item => (item.sizeText || 'כללי').toLowerCase().includes(term));
      }
      return false;
    });

    list.sort((a, b) => {
      const nameA = getModelDisplayName(a).toLowerCase();
      const nameB = getModelDisplayName(b).toLowerCase();
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
    return list;
  }, [dresses, search, selectedCategories, selectedSizes]);

  // Distinct sizes across the whole (unfiltered) inventory, for the sidebar
  // quick-filter chips — each with the number of models carrying that size
  // (the count shown under the chip, as in the mockup).
  const sizeChipData = useMemo(() => {
    const map = new Map();
    dresses.forEach(d => {
      const seen = new Set();
      d.items?.forEach(item => {
        if (item.notInUse || item.isDeleted || item.isUnusable) return;
        const st = (item.sizeText || '').trim();
        if (st && !seen.has(st)) {
          seen.add(st);
          map.set(st, (map.get(st) || 0) + 1);
        }
      });
    });
    return Array.from(map.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
  }, [dresses]);

  const categoryCounts = useMemo(() => {
    const counts = {};
    dresses.forEach(d => {
      if (d.priceCategory) counts[d.priceCategory] = (counts[d.priceCategory] || 0) + 1;
    });
    return counts;
  }, [dresses]);

  // Per-model size/quantity breakdown, shared by all three views and the summary line.
  const getModelSizeInfo = (model) => {
    const sizeMap = new Map();
    model.items?.forEach(item => {
      if (item.notInUse || item.isDeleted || item.isUnusable) return;
      const st = item.sizeText || 'כללי';
      if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
      const info = sizeMap.get(st);
      info.total += 1;
      if (item.quantity > 0) info.available += 1;
    });
    const sizesArray = Array.from(sizeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
    const totalAvailable = sizesArray.reduce((s, [, d]) => s + d.available, 0);
    const totalUnits = sizesArray.reduce((s, [, d]) => s + d.total, 0);
    return { sizesArray, totalAvailable, totalUnits };
  };

  // Counted with the same rules as the card summaries and the print view (getModelSizeInfo),
  // so the header number can never contradict what the cards show.
  const grandTotalItems = useMemo(() => {
    return displayDresses.reduce((sum, model) => sum + getModelSizeInfo(model).totalAvailable, 0);
  }, [displayDresses]);

  // modelsToPrint - אופציונלי: להדפסת דגם בודד (כפתור המדפסת שליד כל דגם) במקום כל
  // הקטלוג המסונן (כפתור המדפסת הראשי בסרגל העליון) - דיווח 1c6a2c23.
  const handleCatalogPrint = (modelsToPrint) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("כדי להדפיס, צריך לאפשר חלונות קופצים בדפדפן");
      return;
    }

    const modelsForReport = modelsToPrint || displayDresses;
    const dateStr = getHebrewDateString(selectedDate);

    let tableRows = '';
    modelsForReport.forEach(model => {
      const sizeMap = new Map();
      let totalAvailable = 0;
      model.items?.forEach(item => {
        if (item.notInUse || item.isDeleted || item.isUnusable) return;
        const st = item.sizeText || 'כללי';
        if (!sizeMap.has(st)) sizeMap.set(st, { available: 0 });
        const info = sizeMap.get(st);
        if (item.quantity > 0) {
          info.available += 1;
          totalAvailable += 1;
        }
      });

      const sizesArray = Array.from(sizeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
      let sizesHtml = sizesArray.map(([sName, sData]) => {
        const isAvail = sData.available > 0;
        return `<span style="display:inline-block; margin:2px; padding:4px 8px; border-radius:6px; font-size:13px; border:1px solid ${isAvail ? '#555' : '#ccc'}; color:${isAvail ? '#000' : '#999'}; ${isAvail ? 'font-weight:bold;' : ''}">${sName} (${sData.available})</span>`;
      }).join('');

      tableRows += `
        <tr>
          <td style="font-weight:bold;">${getModelDisplayName(model)}</td>
          <td>${model.barcodePrefix || model.id || ''}</td>
          <td style="font-weight:bold;">${totalAvailable}</td>
          <td style="direction:ltr; text-align:right;">${sizesHtml || 'אין מלאי'}</td>
        </tr>
      `;
    });

    // חלון ההדפסה הוא מסמך נפרד (popup) שלא טוען את ה-CSS/tokens של האתר, ומיועד לנייר A4:
    // לכן הצבעים והגדלים בו קשיחים ונייטרליים-להדפסה בכוונה (חריג מכלל "בלי ערכים קשיחים", R2).
    // התוכן והמלל שלו הם חוזה (contracts/customer-interface.md §10) - לא משנים.
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
          <p>תאריך אירוע מבוקש: ${dateStr} | סינון: ${modelsToPrint ? getModelDisplayName(modelsToPrint[0]) : (search ? `"${search}"` : 'ללא סינון')}</p>
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
  };

  // בועת צ'אט אחת (משתמש/עוזר) + כפתורי הפעולה שה-AI מציע ([FILTER:]/[DATE:])
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

    return (
      <div key={idx} className={`v3k-bubble ${msg.role === 'user' ? 'is-user' : 'is-assistant'}`}>
        <div>{displayContent}</div>
        {msg.role === 'assistant' && isoDateMatch && !filterMatchStr && (
          <div className="v3k-bubble__acts">
            <Chip
              variant="info"
              icon="calendar"
              onClick={(e) => {
                e.preventDefault();
                setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                setStage(2);
              }}
            >
              הצגת שמלות לתאריך {getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))}
            </Chip>
          </div>
        )}
        {msg.role === 'assistant' && filterMatchStr && (
          <div className="v3k-bubble__acts">
            <Chip
              variant="info"
              icon="search"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setSearch(filterMatchStr);
                if (isoDateMatch) {
                  setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                }
                setStage(2);
              }}
            >
              הצגת התוצאות: {filterMatchStr} {isoDateMatch ? `(לתאריך ${getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))})` : ''}
            </Chip>
          </div>
        )}
      </div>
    );
  };

  // כרטיס הצ'אט המלא של העוזר החכם (משותף לשלב 1 ולשלב 2)
  const renderAiChatCard = (onClose) => (
    <Card
      className="ai-feature-element v3k-chat"
      icon="sparkles"
      title="העוזר החכם"
      tip="העוזר עוזר לחפש שמלות לפי תיאור. הוא לא מוסר מידע על לקוחות אחרים."
      actions={(
        <div className="v3-cluster">
          <IconBtn data-agy-id="new_ai_chat_btn" icon="plus" label="שיחה חדשה"
            onClick={() => setAiChats(prev => ({
              ...prev,
              [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }]
            }))} />
          {onClose && (
            <IconBtn data-agy-id="close_ai_chat_btn" icon="x" label="סגירת העוזר" onClick={onClose} />
          )}
        </div>
      )}
    >
      <div className="v3k-chat__thread" role="log" aria-live="polite">
        {aiMessages.slice(1).map(renderAiBubble)}
        {aiLoading && (
          <div className="v3k-bubble is-assistant">
            <div className="v3k-typing" aria-label="העוזר כותב"><span></span><span></span><span></span></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleAiSubmit} className="v3k-chat__form">
        <input
          data-agy-id="ai_chat_input"
          className="v3-input"
          type="text"
          aria-label="מה לחפש"
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          disabled={aiLoading}
          placeholder="כתבו כאן מה מחפשים"
        />
        <IconBtn data-agy-id="ai_chat_submit_btn" type="submit" variant="primary" icon="send" label="שליחה" loading={aiLoading} disabled={!aiInput.trim()} />
      </form>
    </Card>
  );

  // תיאור הדגם בשורה/כרטיס: תגיות (קידומת ברקוד וקטגוריה). ללא כפילות עם העיגול.
  const renderModelTags = (model) => (
    <div className="v3k-tags">
      {model.barcodePrefix && <Chip><bdi>#{model.barcodePrefix}</bdi></Chip>}
      {model.priceCategory && <Chip variant={model.priceCategory !== 'כללי' ? 'info' : undefined}>{model.priceCategory}</Chip>}
    </div>
  );

  const renderAvailability = (totalAvailable) => (
    <div className={`v3k-avail ${totalAvailable > 0 ? 'is-ok' : 'is-out'}`}>
      <Icon name={totalAvailable > 0 ? 'check-circle' : 'alert-tri'} />
      {totalAvailable > 0 ? <span><bdi>{totalAvailable}</bdi> פנויות</span> : <span>אין פנויות בתאריך הזה</span>}
    </div>
  );

  const renderSizePills = (model, sizesArray, visibleSizesArr) => (
    <div className="v3k-pills">
      {visibleSizesArr.length === 0 ? (
        <span className="v3k-pills__none">{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מידות פנויות'}</span>
      ) : (
        visibleSizesArr.map(([sName, sData]) => (
          <SizePill key={sName} sName={sName} available={sData.available} locked={isLocked}
            onPick={() => handleModelDoubleClick(model, sName)} />
        ))
      )}
    </div>
  );

  const renderPrintModelBtn = (model, className) => (
    <IconBtn icon="printer" label="הדפסת השמלה הזו" className={className}
      onClick={(e) => {
        e.stopPropagation();
        if (isLocked) { printModelRef.current = model; setUnlockIntent('print'); setShowUnlockModal(true); return; }
        handleCatalogPrint([model]);
      }} />
  );

  const clearFilters = () => { setSearch(''); setSelectedCategories([]); setSelectedSizes([]); };

  return (
    <V3Page page={false} data-agy-id="customer_inventory_main_container" className={`v3k${isLocked ? ' is-locked' : ''}`}>

      {/* סרגל עליון: מותג + שני השלבים. שורת הכלים של שלב 2 נמצאת מתחתיו. */}
      <header className="v3k-bar">
        <div className="v3k-brand">
          <span className="v3k-brand__mark"><Icon name="bag" size="lg" /></span>
          <span className="v3k-brand__text">
            <b>גמ"ח שמלות</b>
            <small>בוחרים שמלה לאירוע</small>
          </span>
        </div>
        <nav className="v3k-steps" aria-label="שלבי הבחירה">
          <button type="button" className={`v3k-step${stage === 1 ? ' is-current' : ''}${stage > 1 ? ' is-done' : ''}`}
            aria-current={stage === 1 ? 'step' : undefined} onClick={() => setStage(1)}>
            <span className="v3k-step__num">{stage > 1 ? <Icon name="check" size="sm" /> : '1'}</span>
            תאריך האירוע
          </button>
          <span className="v3k-step__sep" aria-hidden="true" />
          <button type="button" className={`v3k-step${stage === 2 ? ' is-current' : ''}`}
            aria-current={stage === 2 ? 'step' : undefined} onClick={() => setStage(2)}>
            <span className="v3k-step__num">2</span>
            השמלות הפנויות
          </button>
        </nav>
      </header>

      {stage === 2 && (
        <Card className="v3k-tools">
          <div className="v3k-tools__top">
            <h2 className="v3k-title"><Icon name="bag" size="lg" />השמלות הפנויות</h2>
            <Chip variant="info" icon="calendar">
              {getHebrewDateString(new Date(selectedDate))} (<bdi>{(new Date(selectedDate)).toLocaleDateString('he-IL')}</bdi>)
            </Chip>
            <span data-agy-id="catalog_results_count" className="v3k-count">
              <bdi>{displayDresses.length}</bdi> דגמים · <b><bdi>{grandTotalItems}</bdi> פנויות</b>
            </span>
          </div>

          <div className="v3k-tools__row">
            {aiEnabled && (
              isAiChatVisible ? (
                <Btn data-agy-id="catalog_close_ai_btn" size="lg" icon="sparkles" className="ai-feature-element v3k-ask-active"
                  onClick={() => setIsAiChatVisible(false)}>
                  העוזר החכם פעיל · לסגירה
                </Btn>
              ) : (
                <form onSubmit={handleAiSubmit} className="ai-feature-element v3k-ask">
                  <Icon name="sparkles" size="lg" />
                  <input
                    data-agy-id="catalog_ai_input"
                    type="text"
                    aria-label="שאלה לעוזר החכם"
                    placeholder="שואלים את העוזר החכם..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                  />
                  <IconBtn type="submit" variant="primary" icon="send" label="שליחה" disabled={aiLoading || !aiInput.trim()} />
                </form>
              ))}

            <Btn data-agy-id="toggle_sidebar_btn" size="lg" icon="category" aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen(o => !o)}>
              סינון ותצוגה
              {(search || selectedCategories.length > 0 || selectedSizes.length > 0) && (
                <Badge variant="gold" aria-label="יש סינון פעיל">{(search ? 1 : 0) + selectedCategories.length + selectedSizes.length}</Badge>
              )}
            </Btn>

            <div className="v3k-zoom" ref={zoomPopoverRef}>
              <Btn data-agy-id="zoom_toggle_btn" size="lg" icon="expand" aria-expanded={zoomPopoverOpen} aria-haspopup="true"
                onClick={() => setZoomPopoverOpen(o => !o)}>
                גודל התצוגה
              </Btn>
              {zoomPopoverOpen && (
                <div className="v3k-zoom__pop">
                  <div className="v3k-zoom__head"><label htmlFor="v3k-zoom-range">גודל התצוגה</label><b><bdi>{Math.round(zoomLevel * 100)}%</bdi></b></div>
                  <input
                    id="v3k-zoom-range"
                    className="v3k-range"
                    data-agy-id="zoom_range_input"
                    type="range"
                    min="0.5" max="1.5" step="0.1"
                    value={zoomLevel}
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setZoomLevel(val);
                      localStorage.setItem('ka_zoom_level', String(val));
                    }}
                  />
                  <div className="v3k-zoom__ticks"><span>קטן</span><span>גדול</span></div>
                </div>
              )}
            </div>
          </div>

          <div className="v3k-tools__row v3k-tools__row--end">
            <div className="v3k-actions">
              <Btn data-agy-id="new_search_btn" size="lg" icon="search" onClick={() => setStage(1)}>חיפוש חדש</Btn>
              <Btn data-agy-id="refresh_inventory_btn" size="lg" icon="refresh" onClick={fetchInventory}>רענון</Btn>
              <Btn data-agy-id="print_catalog_btn" size="lg" icon="printer"
                onClick={() => { if (isLocked) { setUnlockIntent('print'); setShowUnlockModal(true); return; } handleCatalogPrint(); }}>
                {isLocked ? 'הדפסה באישור עובד' : 'הדפסה'}
              </Btn>
            </div>
            <div className="v3k-staff">
              <span className="v3k-staff__label">לצוות
                <Tip label="מידע על כפתורי הצוות">
                  {isLocked
                    ? 'המסך נעול ללקוחה. כדי לצאת או לשחרר צריך אישור של עובד.'
                    : 'נעילת המסך עוברת למסך מלא. יציאה ממנו (Esc) מבקשת אישור עובד מחדש.'}
                </Tip>
              </span>
              <Btn data-agy-id="exit_to_system_btn" variant="quiet" size="lg" icon="logout"
                onClick={() => { if (isLocked) { setUnlockIntent('unlock'); setShowUnlockModal(true); return; } router.push('/'); }}>
                חזרה למערכת
              </Btn>
              {isLocked ? (
                <Btn data-agy-id="unlock_screen_btn" variant="danger" size="lg" icon="unlock"
                  onClick={() => { setUnlockIntent('unlock'); setShowUnlockModal(true); }}>
                  שחרור המסך
                </Btn>
              ) : (
                <Btn data-agy-id="lock_screen_btn" variant="danger" size="lg" icon="lock" onClick={() => {
                  // The orders modal links into staff order pages — never leave it up on a locked kiosk.
                  setShowOrdersModal(false);
                  setIsLocked(true);
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(err => console.warn(err));
                  }
                }}>
                  נעילת המסך
                </Btn>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* שלב 1: תאריך האירוע */}
      {stage === 1 && (
        <section className="v3k-stage">
          <div className="v3k-hello">
            <h1 className="v3-h1">נמצא יחד את השמלה שלכם
              <Tip label="איך זה עובד">בוחרים תאריך לאירוע ורואים מיד אילו שמלות פנויות ביום הזה.</Tip>
            </h1>
          </div>

          {aiEnabled && aiMessages.length <= 1 && (
            <div className="ai-feature-element v3k-hero-search">
              <Icon name="sparkles" size="lg" />
              <form onSubmit={handleAiSubmit}>
                <input
                  data-agy-id="hero_ai_search_input"
                  type="text"
                  aria-label="חיפוש חכם"
                  placeholder="לדוגמה: שמלה שחורה במידה 12"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  disabled={aiLoading}
                />
                <IconBtn data-agy-id="hero_ai_search_btn" type="submit" variant="primary" icon="send" label="שליחה" round loading={aiLoading} />
              </form>
            </div>
          )}

          <div className="v3k-stack">
            {aiEnabled && aiMessages.length > 1 && renderAiChatCard(null)}

            <Card icon="calendar" title="מתי האירוע?" tip="בוחרים יום בלוח או בתפריטים, וישר עוברים לראות אילו שמלות פנויות בתאריך הזה.">
              <KioskCalendar
                selectedDate={selectedDate}
                onSelect={(d) => {
                  setSelectedDate(d);
                  setStage(2);
                }}
              />
            </Card>

            {/* 32 - רישום עצמי: מוצג רק כשההגדרה "עמדת לקוח - רישום עצמי" דלוקה.
                קורא ל-POST /api/customers הקיים, עם אותה ולידציה כמו טופס "לקוח חדש"
                בהזמנה. read-only view (חיפוש/זמינות) נשאר כפי שהיה - הקטלוג בשלב 2. */}
            {kioskSelfServiceOn && (
              <Card data-agy-id="kiosk_self_registration_card" icon="user" title="הרשמה מהירה"
                tip='אפשר להירשם כלקוחה חדשה בגמ"ח, ואפשר גם לדלג ולהמשיך לבחור שמלה בלי להירשם.'>
                {regSuccess ? (
                  <div className="v3k-done">
                    <Icon name="check-circle" size="2xl" enter />
                    <b className="v3-h2">נרשמתם בהצלחה, תודה!</b>
                    <p>
                      {regSuccess.legacyId ? <>מספר הלקוחה שלכם: <bdi>{regSuccess.legacyId}</bdi>. </> : ''}
                      אפשר להמשיך לבחור שמלה.
                    </p>
                    <Btn size="lg" icon="plus" onClick={() => {
                      setRegSuccess(null);
                      setRegForm({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '', marketingConsent: false });
                    }}>
                      הרשמה נוספת
                    </Btn>
                  </div>
                ) : (
                  <form onSubmit={handleRegisterSubmit} className="v3k-form">
                    <div className="v3k-form__grid">
                      <Field label={<>שם פרטי<span className="v3-req" aria-hidden="true">*</span></>} data-agy-id="reg_firstName_input" type="text" value={regForm.firstName}
                        onChange={e => setRegForm(p => ({ ...p, firstName: e.target.value }))} />
                      <Field label={<>שם משפחה<span className="v3-req" aria-hidden="true">*</span></>} data-agy-id="reg_lastName_input" type="text" value={regForm.lastName}
                        onChange={e => setRegForm(p => ({ ...p, lastName: e.target.value }))} />
                    </div>

                    <Field label={<>טלפון<span className="v3-req" aria-hidden="true">*</span></>} data-agy-id="reg_phone1_input" type="tel" dir="ltr" placeholder="נייד או קווי" value={regForm.phone1}
                      onChange={e => setRegForm(p => ({ ...p, phone1: e.target.value }))} />

                    <Field label={<>אימייל{settings.require_customer_email === 'true' && <span className="v3-req" aria-hidden="true">*</span>}</>} data-agy-id="reg_email_input" type="email" dir="ltr" value={regForm.email}
                      onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} />

                    <div className="v3k-form__grid v3k-form__grid--3">
                      <Field label={<>עיר{settings.require_full_address === 'true' && <span className="v3-req" aria-hidden="true">*</span>}</>} data-agy-id="reg_city_input" type="text" value={regForm.city}
                        onChange={e => setRegForm(p => ({ ...p, city: e.target.value }))} />
                      <Field label={<>רחוב{settings.require_full_address === 'true' && <span className="v3-req" aria-hidden="true">*</span>}</>} data-agy-id="reg_street_input" type="text" value={regForm.street}
                        onChange={e => setRegForm(p => ({ ...p, street: e.target.value }))} />
                      <Field label={<>מספר בית{settings.require_full_address === 'true' && <span className="v3-req" aria-hidden="true">*</span>}</>} data-agy-id="reg_houseNum_input" type="text" value={regForm.houseNum}
                        onChange={e => setRegForm(p => ({ ...p, houseNum: e.target.value }))} />
                    </div>

                    {settings.hide_marketing_consent_field !== 'true' && (
                      <label className="v3k-consent">
                        <input data-agy-id="reg_marketing_consent_input" type="checkbox"
                          checked={regForm.marketingConsent}
                          onChange={e => setRegForm(p => ({ ...p, marketingConsent: e.target.checked }))} />
                        <span>מאשרים לקבל עדכונים והטבות{settings.require_marketing_consent === 'true' && <span className="v3-req" aria-hidden="true">*</span>}</span>
                      </label>
                    )}

                    {regError && <div className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{regError}</div>}

                    <Btn data-agy-id="reg_submit_btn" type="submit" variant="primary" size="lg" iconEnd="check-circle" loading={regSubmitting} block>
                      {regSubmitting ? 'שולחים...' : 'סיום ההרשמה'}
                    </Btn>
                  </form>
                )}
              </Card>
            )}

            {/* 33 - הזמנה עצמית: עדיין stub מכוון - תלוי בהחלטות עסקיות שטרם נענו
                (אישור אוטומטי מול טיוטה לאישור צוות, תשלום מראש) - ראה KIOSK.md/CLAUDE.md.
                לא לחבר יצירת הזמנה אמיתית כאן בלי מענה לשאלות האלה. */}
            {kioskSelfServiceOn && (
              <Card data-agy-id="kiosk_self_order_stub_card" variant="quiet" icon="bag" title="הזמנה עצמאית"
                tip="בקרוב אפשר יהיה להזמין שמלה ישירות מהמסך הזה, בלי לחכות לצוות.">
                <Btn data-agy-id="self_order_stub_btn" size="lg" block disabled>ההזמנה העצמאית תיפתח בקרוב</Btn>
              </Card>
            )}
          </div>
        </section>
      )}

      {/* שלב 2: קטלוג */}
      {stage === 2 && (
        <section className="v3k-stage">
          {aiEnabled && isAiChatVisible && (
            <div className="v3k-chat-wrap">
              {renderAiChatCard(() => setIsAiChatVisible(false))}
            </div>
          )}

          <div className={`v3k-layout${sidebarOpen ? '' : ' is-no-panel'}`}>

            {/* סינון והגדרות תצוגה */}
            {sidebarOpen && (
              <Card as="aside" data-agy-id="catalog_sidebar" className="v3k-filters" icon="category" title="סינון ותצוגה">

                <div className="v3k-group">
                  <h3 className="v3k-group__title"><Icon name="search" />חיפוש
                    <Tip label="איך מחפשים">אפשר לחפש שם של שמלה, מספר דגם, או לכתוב "מידה 40" כדי לראות רק את המידה הזו.</Tip>
                  </h3>
                  <div className="v3-search">
                    <Icon name="search" />
                    <input
                      data-agy-id="catalog_search_input"
                      type="text"
                      aria-label="חיפוש שמלה"
                      placeholder="שם שמלה, מספר או מידה"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    <button type="button" className={`v3-search__clear${search ? ' is-on' : ''}`} aria-label="ניקוי החיפוש"
                      tabIndex={search ? 0 : -1} onClick={() => setSearch('')}>
                      <Icon name="x" size="sm" />
                    </button>
                  </div>
                </div>

                {priceCategories.length > 0 && (
                  <div className="v3k-group">
                    <h3 className="v3k-group__title"><Icon name="tag" />קטגוריה</h3>
                    <div className="v3k-checks">
                      {priceCategories.map(cat => {
                        const count = categoryCounts[cat] || 0;
                        const checked = selectedCategories.includes(cat);
                        return (
                          <label key={cat} data-agy-id={`category_filter_${cat}`} className={`v3k-check${count === 0 && !checked ? ' is-dim' : ''}`}>
                            <input type="checkbox" className="v3-sr" checked={checked}
                              onChange={() => setSelectedCategories(prev => checked ? prev.filter(c => c !== cat) : [...prev, cat])} />
                            <span className={`v3-check${checked ? ' is-on' : ''}`} aria-hidden="true"><Icon name="check" anim={false} /></span>
                            <span className="v3k-check__name">{cat}</span>
                            <Badge variant="neutral"><bdi>{count}</bdi></Badge>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {sizeChipData.length > 0 && (
                  <div className="v3k-group">
                    <h3 className="v3k-group__title"><Icon name="box" />מידה
                      <Tip label="על המספרים">מתחת לכל מידה מופיע מספר הדגמים שיש בה.</Tip>
                    </h3>
                    <div className="v3k-sizes">
                      {sizeChipData.map(([sz, count]) => {
                        const active = selectedSizes.includes(sz);
                        return (
                          <button key={sz} type="button" data-agy-id={`size_chip_${sz}`} aria-pressed={active}
                            className={`v3k-size${active ? ' is-on' : ''}${count === 0 ? ' is-dim' : ''}`}
                            onClick={() => setSelectedSizes(prev => active ? prev.filter(s => s !== sz) : [...prev, sz])}>
                            <strong><bdi>{sz}</bdi></strong>
                            <span className="v3k-size__n"><bdi>{count}</bdi></span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div data-agy-id="toggle_zero_sizes_div" className="v3k-switch" role="switch" aria-checked={showZeroSizes} tabIndex={0}
                  onClick={() => setShowZeroSizes(!showZeroSizes)}
                  onKeyDown={e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setShowZeroSizes(!showZeroSizes); } }}>
                  <span className="v3-switch" aria-hidden="true">
                    <input type="checkbox" tabIndex={-1} checked={showZeroSizes} readOnly />
                    <i />
                  </span>
                  <span>להציג גם מידות שאזלו
                    <Tip label="על מידות שאזלו">מידות שאין מהן שום יחידה פנויה בתאריך שבחרתם.</Tip>
                  </span>
                </div>

                <div className="v3k-group">
                  <h3 className="v3k-group__title"><Icon name="grid" />איך להציג</h3>
                  <div className="v3-seg" role="group" aria-label="צורת תצוגה">
                    {[
                      { key: 'grid', label: 'כרטיסים', title: 'כרטיסים גדולים', icon: 'grid', agyId: 'view_grid_btn' },
                      { key: 'rows', label: 'רשימה', title: 'רשימה מפורטת', icon: 'list', agyId: 'view_rows_btn' },
                      { key: 'table', label: 'טבלה', title: 'טבלה קומפקטית', icon: 'database', agyId: 'view_table_btn' },
                    ].map(({ key, label, title, icon, agyId }) => (
                      <button key={key} data-agy-id={agyId} type="button" title={title} aria-pressed={viewMode === key}
                        className="v3-seg__btn v3k-seg-btn" onClick={() => setViewMode(key)}>
                        <Icon name={icon} />{label}
                      </button>
                    ))}
                  </div>
                </div>

                <Btn data-agy-id="clear_all_filters_btn" icon="x" size="lg" block onClick={clearFilters}>
                  ניקוי כל הסינונים
                </Btn>
              </Card>
            )}

            {/* תוצאות */}
            <div className="v3k-results">
              {loading ? (
                <div className="v3k-state" role="status">
                  <Icon name="loader" size="2xl" loop />
                  <p>רגע, טוענים את השמלות...</p>
                </div>
              ) : displayDresses.length === 0 ? (
                <Card variant="quiet" as="div">
                  <Empty icon="search" title="לא מצאנו שמלות מתאימות" text="אפשר לנסות חיפוש אחר, או לנקות את הסינון."
                    action={<Btn data-agy-id="empty_state_clear_btn" size="lg" onClick={clearFilters}>ניקוי הסינון</Btn>} />
                </Card>
              ) : viewMode === 'table' ? (
                <div className="v3-table__wrap v3k-table" style={{ zoom: zoomLevel }}>
                  <table className="v3-table">
                    <thead>
                      <tr>
                        <th><span className="v3-sr">תמונה</span></th>
                        <th>שם השמלה</th>
                        <th>מספר דגם</th>
                        <th>קטגוריה</th>
                        <th>פנויות</th>
                        <th>מידות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDresses.map(model => {
                        const { sizesArray, totalAvailable } = getModelSizeInfo(model);
                        const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);
                        return (
                          <tr key={model.id} onClick={() => handleModelDoubleClick(model)}>
                            <td className="v3k-table__img">
                              <ModelAvatar model={model} size="sm" showImage={settings.hide_dress_images !== 'true'} />
                            </td>
                            <td className="v3k-table__name">{getModelDisplayName(model)}</td>
                            <td className="v3k-table__muted">{model.barcodePrefix ? <bdi>#{model.barcodePrefix}</bdi> : '—'}</td>
                            <td>{model.priceCategory ? <Chip>{model.priceCategory}</Chip> : '—'}</td>
                            <td className={`v3k-table__avail ${totalAvailable > 0 ? 'is-ok' : 'is-out'}`}><bdi>{totalAvailable}</bdi></td>
                            <td>{renderSizePills(model, sizesArray, visibleSizesArr)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : viewMode === 'rows' ? (
                <div className="v3k-list" style={{ zoom: zoomLevel }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div key={model.id} className="v3k-row" onClick={() => handleModelDoubleClick(model)}>
                        <ModelAvatar model={model} size="md" showImage={settings.hide_dress_images !== 'true'} />
                        {modelHasRealName(model) ? (
                          <div className="v3k-row__meta">
                            <h3 className="v3k-name">{getModelDisplayName(model)}</h3>
                            {renderModelTags(model)}
                          </div>
                        ) : (
                          <div className="v3k-row__meta">{renderModelTags(model)}</div>
                        )}
                        {renderAvailability(totalAvailable)}
                        {renderPrintModelBtn(model, 'v3k-row__print')}
                        {renderSizePills(model, sizesArray, visibleSizesArr)}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="v3k-grid" style={{ zoom: zoomLevel }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div key={model.id} className="v3k-card" onClick={() => {
                        handleModelDoubleClick(model);
                      }}>
                        {renderPrintModelBtn(model, 'v3k-card__print')}
                        <ModelAvatar model={model} size="lg" showImage={settings.hide_dress_images !== 'true'} />
                        <h3 className="v3k-name">{getModelDisplayName(model)}</h3>
                        {renderModelTags(model)}
                        {renderAvailability(totalAvailable)}
                        {renderSizePills(model, sizesArray, visibleSizesArr)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* חלונית שחרור נעילה / אישור עובד להדפסה. יש בה שדות ← חלונית טופס, בהירה בלבד (R19).
          Esc ולחיצה על הרקע לא סוגרות אותה בכוונה (כמו במקור); רק "ביטול" סוגר, ואינו משחרר את הנעילה. */}
      <Dialog
        open={showUnlockModal}
        onClose={() => {}}
        closeOnScrim={false}
        variant="form"
        icon="lock"
        title={unlockIntent === 'print' ? 'אישור עובד להדפסה' : 'שחרור המסך'}
        sub={'לעובדי הגמ"ח בלבד'}
        initialFocus="[data-agy-id='unlock_employee_select']"
        actions={(
          <>
            <Btn data-agy-id="submit_unlock_btn" type="submit" form="v3k-unlock-form" variant="primary" size="lg" loading={unlockLoading}>
              {unlockLoading ? 'בודקים...' : (unlockIntent === 'print' ? 'אישור והדפסה' : 'שחרור')}
            </Btn>
            <Btn data-agy-id="cancel_unlock_btn" variant="quiet" size="lg"
              onClick={() => { setShowUnlockModal(false); setUnlockIntent('unlock'); setShowUnlockPassword(false); }}>
              ביטול
            </Btn>
          </>
        )}
      >
        <form id="v3k-unlock-form" onSubmit={handleUnlock} autoComplete="off" className="v3k-form">
          <Field as="select" label="שם העובד או העובדת" data-agy-id="unlock_employee_select" value={unlockEmployee} onChange={e => setUnlockEmployee(e.target.value)}>
            <option value="">בחרו שם</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
            ))}
          </Field>
          <div className="v3-field">
            <label className="v3-label" htmlFor="v3k-unlock-pass">קוד גישה</label>
            <div className="v3k-pin">
              <input id="v3k-unlock-pass" className="v3-input" data-agy-id="unlock_password_input" type={showUnlockPassword ? 'text' : 'password'} autoComplete="off"
                placeholder="••••••" aria-invalid={unlockError ? 'true' : undefined}
                value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
              <button type="button" className="v3k-pin__eye" aria-label={showUnlockPassword ? 'הסתרת הקוד' : 'הצגת הקוד'} aria-pressed={showUnlockPassword}
                onClick={() => setShowUnlockPassword(v => !v)}>
                <Icon name="eye" />
              </button>
            </div>
          </div>
          {unlockError && <div className="v3-error" role="alert"><Icon name="alert-circle" size="sm" />{unlockError}</div>}
        </form>
      </Dialog>

      {/* הזמנות לדגם: תצוגה בלבד (ללא הזנה) */}
      <Dialog
        open={showOrdersModal}
        onClose={() => setShowOrdersModal(false)}
        variant="sheet"
        icon="bag"
        title={`הזמנות של ${ordersModalModel ? getModelDisplayName(ordersModalModel) : ''}${ordersModalSize ? ` (מידה ${ordersModalSize})` : ''}`}
        sub="שבוע לפני ואחרי תאריך האירוע שבחרתם"
        actions={<Btn data-agy-id="close_orders_modal_btn" variant="quiet" size="lg" onClick={() => setShowOrdersModal(false)}>סגירה</Btn>}
      >
        {ordersModalLoading ? (
          <div className="v3k-state v3k-state--flat" role="status">
            <Icon name="loader" size="xl" loop />
            <p>טוענים...</p>
          </div>
        ) : ordersModalOrders.length === 0 ? (
          <p className="v3k-modal-empty">אין הזמנות לדגם הזה בטווח התאריכים.</p>
        ) : (
          <div className="v3-dlg-rows">
            {ordersModalOrders.map(order => {
              // order.status מ-/api/orders הוא שדה DB גולמי שכמעט תמיד ריק בפועל (הסטטוס
              // האמיתי מחושב דינמית) - מציגים במקום זאת סטטוס תשלום אמיתי מ-totalAmount/
              // totalPaid, באותה שיטה כמו app/orders/page.js.
              const paymentStatus = calculatePaymentStatus(order.totalAmount || 0, order.totalPaid || 0);
              // צבע הסטטוס: משפחות v3 במקום צבעי lib/orderStatus (שהם ערכי צבע של העיצוב הישן)
              const statusVariant = paymentStatus === 'שולם' ? 'done' : paymentStatus === 'ממתין לזיכוי' ? 'info' : 'attn';
              return (
                <div key={order.orderId} className="v3-dlg-row">
                  <div className="v3-dlg-row__t">
                    <b>הזמנה <bdi>#{order.orderId}</bdi> · {order.customer?.firstName} {order.customer?.lastName}</b>
                    <div className="v3-faint">תאריך האירוע: <bdi>{new Date(order.eventDate).toLocaleDateString('he-IL')}</bdi></div>
                  </div>
                  <Chip variant={statusVariant}>{paymentStatus}</Chip>
                  <IconBtn href={`/orders/${order.orderId}`} target="_blank" rel="noopener noreferrer" icon="external-link" label="פתיחת ההזמנה" />
                </div>
              );
            })}
          </div>
        )}
      </Dialog>
    </V3Page>
  );
}
