'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HDate, gematriya, Sedra, Locale } from '@hebcal/core';
import { getHebrewDateString, HEBREW_DAYS } from '@/lib/hebrewDate';
import { getDressThumbUrl } from '@/app/lib/dressImageUrl';
import './kiosk.css';

// תמונת דגם בתאים הקטנים (טבלה 44px / שורות 80px): מנסים קודם את קובץ
// ה-thumb (קיים רק להעלאות חדשות — ראה app/lib/dressImageUrl.js), ועם onError
// נופלים חזרה לתמונה המלאה. loading="lazy" כדי שגלילה בקטלוג לא תוריד את
// כל התמונות מראש.
function KioskThumbImg({ model }) {
  const thumbSrc = getDressThumbUrl(model.imageUrl);
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

// עיגול פרופיל לדגם: תמונה אם קיימת (ומותרת), אחרת אותיות הדגם —
// אות ראשונה משתי המילים הראשונות, או שתי האותיות הראשונות בשם של מילה אחת.
function ModelAvatar({ model, size, showImage }) {
  const name = (model.name || '').trim();
  const parts = name.split(/\s+/).filter(Boolean);
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`
    : (name.slice(0, 2) || '?');
  return (
    <div className={`ka-avatar ${size}`} title={name}>
      {showImage && model.imageUrl ? <KioskThumbImg model={model} /> : <span>{initials}</span>}
    </div>
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

// לוח שנה עברי מוטמע (inline) של מסך הלקוח — עיצוב 1:1 מהמוקאפ (אטלייה חמה),
// במקום הפופאפ של HebrewDatePicker. הבחירה מתעדכנת מיידית (selects/גריד);
// המעבר לשלב 2 נעשה רק בכפתור "הצג מלאי".
function AtelierCalendar({ selectedDate, onSelect }) {
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

  // תאי הגריד: זנב החודש הקודם (מעומעם) + החודש + ראש החודש הבא להשלמת שבוע
  const cells = useMemo(() => {
    const out = [];
    try {
      const first = new HDate(1, viewMonth, viewYear);
      const firstDow = first.greg().getDay();
      for (let i = firstDow; i > 0; i--) {
        out.push({ hd: first.subtract(i, 'd'), muted: true });
      }
      for (let d = 1; d <= daysInMonth; d++) {
        out.push({ hd: new HDate(d, viewMonth, viewYear), muted: false });
      }
      let tail = new HDate(daysInMonth, viewMonth, viewYear);
      while (out.length % 7 !== 0) {
        tail = tail.add(1, 'd');
        out.push({ hd: tail, muted: true });
      }
    } catch (e) {}
    return out;
  }, [viewMonth, viewYear, daysInMonth]);

  return (
    <>
      <div className="ka-hebrew-selects">
        <div>
          <label>יום</label>
          <select data-agy-id="kiosk_cal_day_select" value={selHd.getDate()}
            onChange={e => changeSelection(parseInt(e.target.value), selHd.getMonth(), selHd.getFullYear())}>
            {Array.from({ length: HDate.daysInMonth(selHd.getMonth(), selHd.getFullYear()) }, (_, i) => i + 1).map(d => (
              <option key={d} value={d}>{HEBREW_DAYS[d]}</option>
            ))}
          </select>
        </div>
        <div>
          <label>חודש</label>
          <select data-agy-id="kiosk_cal_month_select" value={selHd.getMonth()}
            onChange={e => changeSelection(selHd.getDate(), parseInt(e.target.value), selHd.getFullYear())}>
            {getMonthsForYear(selHd.getFullYear()).map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label>שנה</label>
          <select data-agy-id="kiosk_cal_year_select" value={selHd.getFullYear()}
            onChange={e => changeSelection(selHd.getDate(), selHd.getMonth(), parseInt(e.target.value))}>
            {yearOptions.map(y => (
              <option key={y} value={y}>{gematriya(y)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="ka-calendar">
        <div className="ka-cal-head">
          <button type="button" className="ka-icon-btn" title="חודש קודם" onClick={prevMonth}>
            <svg className="icon"><use href="#i-chevron-end" /></svg>
          </button>
          <span>{monthLabel} {gematriya(viewYear)}</span>
          <button type="button" className="ka-icon-btn" title="חודש הבא" onClick={nextMonth}>
            <svg className="icon"><use href="#i-chevron-start" /></svg>
          </button>
        </div>
        <div className="ka-cal-weekdays">
          <span>א</span><span>ב</span><span>ג</span><span>ד</span><span>ה</span><span>ו</span><span>ש</span>
        </div>
        <div className="ka-cal-grid">
          {cells.map(({ hd, muted }, idx) => {
            const abs = hd.abs();
            const isSelected = abs === selAbs;
            const isToday = todayAbs !== null && abs === todayAbs;
            return (
              <button
                key={idx}
                type="button"
                className={`ka-cal-day${muted ? ' muted' : ''}${isSelected ? ' selected' : ''}${isToday && !isSelected ? ' today' : ''}`}
                onClick={muted ? undefined : () => applyHdate(hd)}
                tabIndex={muted ? -1 : 0}
              >
                <span>{HEBREW_DAYS[hd.getDate()]}</span>
                <span className="g">{hd.greg().getDate()}</span>
              </button>
            );
          })}
        </div>
        <div className="ka-cal-foot">
          <button type="button" data-agy-id="kiosk_cal_today_btn" onClick={() => applyHdate(new HDate())}>
            <svg className="icon"><use href="#i-home" /></svg>היום
          </button>
          <span className="ka-parsha">{footStr}</span>
          <button type="button" data-agy-id="kiosk_cal_clear_btn" onClick={() => applyHdate(new HDate())}>
            <svg className="icon"><use href="#i-x" /></svg>ניקוי
          </button>
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
  const [zoomLevel, setZoomLevel] = useState(1);
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

  // Sidebar filters (stage 2)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [priceCategories, setPriceCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSizes, setSelectedSizes] = useState([]);
  // What a successful employee login in the unlock modal should do:
  // 'unlock' releases the kiosk lock; 'print' only authorizes a one-off print and keeps the lock.
  const [unlockIntent, setUnlockIntent] = useState('unlock');
  // True during an employee-authorized print from a locked kiosk, so the
  // fullscreen exit caused by the print popup doesn't re-open the unlock modal.
  const suppressRelockRef = useRef(false);

  const aiEnabled = settings.hide_ai_features !== 'true' && settings.enable_ai_specific_employees !== 'true';

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

  // רקע "נייר חם" של האטלייה על כל אזור התוכן (העמוד עצמו מוגבל ברוחב) —
  // ראה body.katelier-bg בקובץ kiosk.css. מוסר אוטומטית בעזיבת המסך.
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
    fetch(`/api/dresses${dateQuery}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDresses(data);
        } else if (data && Array.isArray(data.data)) {
          setDresses(data.data);
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
          handleCatalogPrint();
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
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
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

  const handleCatalogPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("נא לאפשר חלונות קופצים (Pop-ups) כדי להדפיס");
      return;
    }

    const dateStr = getHebrewDateString(selectedDate);

    let tableRows = '';
    displayDresses.forEach(model => {
      const sizeMap = new Map();
      let totalItems = 0;
      let totalAvailable = 0;
      model.items?.forEach(item => {
        if (item.notInUse || item.isDeleted || item.isUnusable) return;
        const st = item.sizeText || 'כללי';
        if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
        const info = sizeMap.get(st);
        info.total += 1;
        totalItems += 1;
        if (item.quantity > 0) {
          info.available += 1;
          totalAvailable += 1;
        }
      });

      const sizesArray = Array.from(sizeMap.entries()).sort((a, b) => String(a[0]).localeCompare(String(b[0]), undefined, { numeric: true }));
      let sizesHtml = sizesArray.map(([sName, sData]) => {
        const isAvail = sData.available > 0;
        return `<span style="display:inline-block; margin:2px; padding:4px 8px; border-radius:6px; font-size:13px; border:1px solid ${isAvail ? '#555' : '#ccc'}; color:${isAvail ? '#000' : '#999'}; ${isAvail ? 'font-weight:bold;' : ''}">${sName} (${sData.available}/${sData.total})</span>`;
      }).join('');

      tableRows += `
        <tr>
          <td style="font-weight:bold;">${model.name || ''}</td>
          <td>${model.barcodePrefix || model.id || ''}</td>
          <td style="font-weight:bold;">${totalAvailable} מתוך ${totalItems}</td>
          <td>${sizesHtml || 'אין מלאי'}</td>
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
          <p>תאריך אירוע מבוקש: ${dateStr} | סינון: ${search ? `"${search}"` : 'ללא סינון'}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">שם הדגם</th>
              <th style="width: 15%;">קידומת ברקוד</th>
              <th style="width: 15%;">זמינים / סה"כ</th>
              <th style="width: 45%;">פירוט מידות וזמינות</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="summary">
          סה"כ דגמים מוצגים: ${displayDresses.length}
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
      <div key={idx} className={`ka-bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
        <div>{displayContent}</div>
        {msg.role === 'assistant' && isoDateMatch && !filterMatchStr && (
          <div>
            <button
              type="button"
              className="ka-quick-chip"
              onClick={(e) => {
                e.preventDefault();
                setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                setStage(2);
              }}
            >
              <svg className="icon"><use href="#i-calendar" /></svg>
              הצג מלאי לתאריך {getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))}
            </button>
          </div>
        )}
        {msg.role === 'assistant' && filterMatchStr && (
          <div>
            <button
              type="button"
              className="ka-quick-chip"
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
              <svg className="icon"><use href="#i-search" /></svg>
              סנן והצג: {filterMatchStr} {isoDateMatch ? `(לתאריך ${getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))})` : ''}
            </button>
          </div>
        )}
      </div>
    );
  };

  // כרטיס הצ'אט המלא של העוזר החכם (משותף לשלב 1 ולשלב 2)
  const renderAiChatCard = (onClose) => (
    <div className="ka-card ka-card-pad ai-feature-element" style={{ width: '100%' }}>
      <div className="ka-assist-head">
        <div className="ka-assist-title">
          <div className="ka-glow"><svg className="icon"><use href="#i-star" /></svg></div>
          העוזר החכם
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button data-agy-id="new_ai_chat_btn" type="button" className="ka-icon-btn" title="שיחה חדשה"
            onClick={() => setAiChats(prev => ({
              ...prev,
              [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }]
            }))}>
            <svg className="icon"><use href="#i-plus" /></svg>
          </button>
          {onClose && (
            <button data-agy-id="close_ai_chat_btn" type="button" className="ka-icon-btn" title="סגור" onClick={onClose}>
              <svg className="icon"><use href="#i-x" /></svg>
            </button>
          )}
        </div>
      </div>

      <div className="ka-chat-thread">
        {aiMessages.slice(1).map(renderAiBubble)}
        {aiLoading && (
          <div className="ka-bubble assistant" style={{ padding: 0 }}>
            <div className="ka-typing"><span></span><span></span><span></span></div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <form onSubmit={handleAiSubmit} className="ka-assist-input-row">
        <input
          data-agy-id="ai_chat_input"
          type="text"
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          disabled={aiLoading}
          placeholder="מה תרצה לחפש?"
        />
        <button data-agy-id="ai_chat_submit_btn" type="submit" className="ka-icon-btn primary" disabled={aiLoading || !aiInput.trim()} title="שלח">
          {aiLoading ? <span className="ka-spinner sm" style={{ borderTopColor: '#fff' }} /> : <svg className="icon"><use href="#ka-i-send" /></svg>}
        </button>
      </form>
    </div>
  );

  return (
    <div data-agy-id="customer_inventory_main_container" className="katelier">

      {/* אייקונים שקיימים במוקאפ אך לא בספרייט הגלובלי (IconSprite.js) */}
      <svg style={{ display: 'none' }} aria-hidden="true">
        <symbol id="ka-i-send" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-6z" /></symbol>
        <symbol id="ka-i-table" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M3 16h18M10 4v16" /></symbol>
        <symbol id="ka-i-filter" viewBox="0 0 24 24"><path d="M4 5h16l-6 8v6l-4 2v-8z" /></symbol>
      </svg>

      {/* Topbar: brand + 2-step stepper (row1, always shown); row2 (results
          toolbar) only renders on stage 2 — a purely visual layer over the
          existing `stage` state. */}
      <div className="ka-topbar">
        <div className="ka-topbar-row1">
          <div className="ka-brand">
            <div className="ka-brand-mark"><svg className="icon"><use href="#i-bag" /></svg></div>
            <div>עמדת לקוחות</div>
          </div>
          <div className="ka-stepper">
            <button type="button" className={`ka-step-btn${stage > 1 ? ' done' : ''}${stage === 1 ? ' current' : ''}`} onClick={() => setStage(1)}>
              <span className="num">
                {stage > 1 ? <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-check-circle" /></svg> : '1'}
              </span>
              שלב 1 · בחירת תאריך
            </button>
            <div className="ka-step-sep" />
            <button type="button" className={`ka-step-btn${stage === 2 ? ' current' : ''}`} onClick={() => setStage(2)}>
              <span className="num">2</span>
              שלב 2 · קטלוג ותוצאות
            </button>
          </div>
        </div>

        {stage === 2 && (
          <div className="ka-topbar-row2">
            <h2 className="ka-results-title">
              <svg className="icon"><use href="#i-bag" /></svg>
              קטלוג שמלות זמינות
            </h2>
            <span className="ka-date-chip">
              <svg className="icon" style={{ width: '14px', height: '14px' }}><use href="#i-calendar" /></svg>
              {getHebrewDateString(new Date(selectedDate))} ({(new Date(selectedDate)).toLocaleDateString('he-IL')})
            </span>
            <span data-agy-id="catalog_results_count" className="ka-count-line">
              {displayDresses.length} דגמים · <span className="good">{grandTotalItems} פנויות</span>
            </span>

            {aiEnabled && (
              isAiChatVisible ? (
                <button data-agy-id="catalog_close_ai_btn" type="button" className="ai-feature-element ka-ask-active"
                  onClick={() => setIsAiChatVisible(false)}>
                  <svg className="icon"><use href="#i-star" /></svg>
                  העוזר החכם פעיל - לחץ לסגירה
                </button>
              ) : (
                <form onSubmit={handleAiSubmit} className="ai-feature-element ka-ai-ask">
                  <svg className="icon"><use href="#i-star" /></svg>
                  <input
                    data-agy-id="catalog_ai_input"
                    type="text"
                    placeholder="שאל את ה-AI..."
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                  />
                </form>
              ))}

            <button data-agy-id="toggle_sidebar_btn" type="button" className="ka-btn-soft"
              onClick={() => setSidebarOpen(o => !o)}>
              <svg className="icon"><use href="#ka-i-filter" /></svg>
              סינון ותצוגה
              {(search || selectedCategories.length > 0 || selectedSizes.length > 0) && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--terracotta)', display: 'inline-block' }} />}
            </button>

            <div className="ka-action-cluster">
              <button data-agy-id="exit_to_system_btn" type="button" className="ka-icon-btn"
                onClick={() => { if (isLocked) { setUnlockIntent('unlock'); setShowUnlockModal(true); return; } router.push('/'); }} title="חזור למערכת">
                <svg className="icon"><use href="#i-logout" /></svg>
              </button>
              <button data-agy-id="new_search_btn" type="button" className="ka-icon-btn" onClick={() => setStage(1)} title="חיפוש חדש">
                <svg className="icon"><use href="#i-search" /></svg>
              </button>
              <button data-agy-id="refresh_inventory_btn" type="button" className="ka-icon-btn" onClick={fetchInventory} title="רענון מלאי">
                <svg className="icon"><use href="#i-refresh" /></svg>
              </button>
              <button data-agy-id="print_catalog_btn" type="button" className="ka-icon-btn"
                onClick={() => { if (isLocked) { setUnlockIntent('print'); setShowUnlockModal(true); return; } handleCatalogPrint(); }}
                title={isLocked ? 'הדפסה (באישור עובד)' : 'הדפסה'}>
                <svg className="icon"><use href="#i-printer" /></svg>
              </button>
              {isLocked ? (
                <button data-agy-id="unlock_screen_btn" type="button" className="ka-icon-btn danger"
                  onClick={() => { setUnlockIntent('unlock'); setShowUnlockModal(true); }} title="שחרור מסך">
                  <svg className="icon"><use href="#i-lock" /></svg>
                </button>
              ) : (
                <button data-agy-id="lock_screen_btn" type="button" className="ka-icon-btn danger" onClick={() => {
                  // The orders modal links into staff order pages — never leave it up on a locked kiosk.
                  setShowOrdersModal(false);
                  setIsLocked(true);
                  if (document.documentElement.requestFullscreen) {
                    document.documentElement.requestFullscreen().catch(err => console.warn(err));
                  }
                }} title="נעילת מסך ללקוח — מעבר למסך מלא, יציאה (Esc) דורשת אישור עובד מחדש">
                  <svg className="icon"><use href="#i-lock" /></svg>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Stage 1: Search & Date Selection */}
      {stage === 1 && (
        <section>
          <div className="ka-hero">
            <h2>מה תחפש היום?</h2>
            <p className="ka-lead">הזן סגנון, מידה או פשוט בחר תאריך מהיומן</p>
          </div>

          {aiEnabled && aiMessages.length <= 1 && (
            <div className="ai-feature-element ka-search-pill">
              <svg className="icon"><use href="#i-search" /></svg>
              <form onSubmit={handleAiSubmit}>
                <input
                  data-agy-id="hero_ai_search_input"
                  type="text"
                  placeholder="לדוגמה: שמלה שחורה מידה 12..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  disabled={aiLoading}
                />
                <button data-agy-id="hero_ai_search_btn" type="submit" className="ka-icon-btn primary" disabled={aiLoading} title="שלח">
                  {aiLoading ? <span className="ka-spinner sm" style={{ borderTopColor: '#fff' }} /> : <svg className="icon"><use href="#i-star" /></svg>}
                </button>
              </form>
            </div>
          )}

          <div className="ka-stack">
            {aiEnabled && aiMessages.length > 1 && renderAiChatCard(null)}

            <div className="ka-card ka-card-pad">
              <div className="ka-date-title">
                <svg className="icon"><use href="#i-calendar" /></svg>
                מתי האירוע שלכם?
              </div>

              <AtelierCalendar
                selectedDate={selectedDate}
                onSelect={(d) => setSelectedDate(d)}
              />

              <div className="ka-cta-row">
                <button
                  data-agy-id="show_inventory_btn"
                  type="button"
                  className="ka-btn-cta"
                  onClick={() => setStage(2)}
                >
                  הצג מלאי
                  <svg className="icon"><use href="#i-star" /></svg>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Stage 2: Inventory Grid */}
      {stage === 2 && (
        <section>
          {aiEnabled && isAiChatVisible && (
            <div style={{ marginBottom: '20px' }}>
              {renderAiChatCard(() => setIsAiChatVisible(false))}
            </div>
          )}

          <div className={`ka-layout${sidebarOpen ? '' : ' no-panel'}`}>

            {/* Sidebar: filters & display settings */}
            {sidebarOpen && (
              <aside data-agy-id="catalog_sidebar" className="ka-filter-panel">

                <div className="ka-filter-group">
                  <h4><svg className="icon"><use href="#i-search" /></svg>חיפוש</h4>
                  <input
                    data-agy-id="catalog_search_input"
                    type="text"
                    placeholder="שם דגם, מספר, או מידה..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                  <div className="ka-filter-hint">
                    אפשר לחפש שם שמלה, מספר קטלוגי, או לכתוב "מידה 40"
                  </div>
                </div>

                {priceCategories.length > 0 && (
                  <div className="ka-filter-group">
                    <h4><svg className="icon"><use href="#i-tag" /></svg>קטגוריה</h4>
                    {priceCategories.map(cat => {
                      const count = categoryCounts[cat] || 0;
                      const checked = selectedCategories.includes(cat);
                      return (
                        <label key={cat} data-agy-id={`category_filter_${cat}`} className="ka-check-row" style={{ opacity: count === 0 && !checked ? 0.5 : 1 }}>
                          <span className="ka-check-row-inner">
                            <input type="checkbox" checked={checked}
                              onChange={() => setSelectedCategories(prev => checked ? prev.filter(c => c !== cat) : [...prev, cat])} />
                            <span>{cat}</span>
                          </span>
                          <span className="count">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {sizeChipData.length > 0 && (
                  <div className="ka-filter-group">
                    <h4><svg className="icon"><use href="#i-box" /></svg>סינון מהיר לפי מידה</h4>
                    <div className="ka-size-chip-grid">
                      {sizeChipData.map(([sz, count]) => {
                        const active = selectedSizes.includes(sz);
                        return (
                          <div key={sz} data-agy-id={`size_chip_${sz}`}
                            className={`ka-size-chip${active ? ' active' : ''}${count === 0 ? ' zero' : ''}`}
                            onClick={() => setSelectedSizes(prev => active ? prev.filter(s => s !== sz) : [...prev, sz])}>
                            <strong>{sz}</strong>
                            <div className="count">{count}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div data-agy-id="toggle_zero_sizes_div" className="ka-switch-row" onClick={() => setShowZeroSizes(!showZeroSizes)}>
                  <div className={`ka-switch${showZeroSizes ? ' on' : ''}`} />
                  הצג גם מידות ללא מלאי פנוי
                </div>

                <div className="ka-filter-group">
                  <h4><svg className="icon"><use href="#i-grid" /></svg>צורת תצוגה</h4>
                  <div className="ka-view-toggle">
                    {[
                      { key: 'grid', label: 'כרטיסים גדולים', iconId: 'i-grid', agyId: 'view_grid_btn' },
                      { key: 'rows', label: 'רשימה מפורטת', iconId: 'i-list', agyId: 'view_rows_btn' },
                      { key: 'table', label: 'טבלה קומפקטית', iconId: 'ka-i-table', agyId: 'view_table_btn' },
                    ].map(({ key, label, iconId, agyId }) => (
                      <button key={key} data-agy-id={agyId} type="button" title={label}
                        className={viewMode === key ? 'active' : ''}
                        onClick={() => setViewMode(key)}>
                        <svg className="icon"><use href={`#${iconId}`} /></svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ka-slider-field">
                  <div className="s-head"><span>גודל תצוגה</span><span>{Math.round(zoomLevel * 100)}%</span></div>
                  <input
                    data-agy-id="zoom_range_input"
                    type="range"
                    min="0.5" max="1.5" step="0.1"
                    value={zoomLevel}
                    onChange={e => setZoomLevel(parseFloat(e.target.value))}
                  />
                  <div className="s-ticks">
                    <span>קטן</span><span>גדול</span>
                  </div>
                </div>

                <button data-agy-id="clear_all_filters_btn" type="button" className="ka-btn-clear"
                  onClick={() => { setSearch(''); setSelectedCategories([]); setSelectedSizes([]); }}>
                  <svg className="icon"><use href="#i-x" /></svg>
                  נקה את כל הסינונים
                </button>
              </aside>
            )}

            {/* Catalog content */}
            <div style={{ minWidth: 0 }}>
              {loading ? (
                <div className="ka-state-box">
                  <div className="ka-spinner" />
                  <p>טוען נתונים...</p>
                </div>
              ) : displayDresses.length === 0 ? (
                <div className="ka-state-box">
                  <svg className="icon"><use href="#i-search" /></svg>
                  <h4>לא נמצאו דגמים מתאימים</h4>
                  <p>נסו לנקות את החיפוש או את סינון הקטגוריה</p>
                  <button data-agy-id="empty_state_clear_btn" type="button" className="ka-btn-mini"
                    onClick={() => { setSearch(''); setSelectedCategories([]); setSelectedSizes([]); }}>
                    נקה סינון ונסה שוב
                  </button>
                </div>
              ) : viewMode === 'table' ? (
                <div className="ka-table-wrap" style={{ zoom: zoomLevel }}>
                  <table className="ka-data">
                    <thead>
                      <tr>
                        <th></th>
                        <th>שם דגם</th>
                        <th>מק״ט</th>
                        <th>קטגוריה</th>
                        <th>סה״כ פנוי</th>
                        <th>פירוט לפי מידה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayDresses.map(model => {
                        const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                        const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);
                        return (
                          <tr key={model.id} onClick={() => handleModelDoubleClick(model)} style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                            <td style={{ width: '58px' }}>
                              <ModelAvatar model={model} size="sm" showImage={settings.hide_dress_images !== 'true'} />
                            </td>
                            <td className="ka-cell-primary">{model.name}</td>
                            <td className="ka-cell-muted">{model.barcodePrefix ? `#${model.barcodePrefix}` : '—'}</td>
                            <td>
                              {model.priceCategory ? <span className="ka-badge ka-badge-neutral">{model.priceCategory}</span> : '—'}
                            </td>
                            <td style={{ fontWeight: 800, color: totalAvailable > 0 ? 'var(--sage)' : 'var(--brick)' }}>{totalAvailable}/{totalUnits}</td>
                            <td>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                {visibleSizesArr.length === 0 ? (
                                  <span style={{ color: 'var(--ink-faint)', fontSize: '12.5px' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי'}</span>
                                ) : visibleSizesArr.map(([sName, sData]) => (
                                  <span key={sName}
                                    className={`ka-size-pill ${sData.available > 0 ? 'avail' : 'out'}`}
                                    onClick={(e) => { e.stopPropagation(); handleModelDoubleClick(model, sName); }}
                                    title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                    style={{ cursor: isLocked ? 'default' : 'pointer' }}>
                                    {sName} · {sData.available}/{sData.total}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : viewMode === 'rows' ? (
                <div className="ka-results-list" style={{ zoom: zoomLevel }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div key={model.id} className="ka-dress-row" style={{ cursor: isLocked ? 'default' : 'pointer' }}
                        onClick={() => handleModelDoubleClick(model)}>
                        <ModelAvatar model={model} size="md" showImage={settings.hide_dress_images !== 'true'} />
                        <div className="ka-rmeta">
                          <h3>
                            {model.name}
                            {model.barcodePrefix && <span className="ka-badge ka-badge-neutral">#{model.barcodePrefix}</span>}
                            {model.priceCategory && model.priceCategory !== 'כללי' && <span className="ka-badge ka-badge-primary">{model.priceCategory}</span>}
                          </h3>
                          <div className="ka-dress-code">{model.barcodePrefix ? `#${model.barcodePrefix}` : ''}{model.priceCategory ? ` · ${model.priceCategory}` : ''}</div>
                        </div>

                        <div className={`ka-avail-line ${totalAvailable > 0 ? 'ok' : 'bad'}`}>
                          <svg className="icon"><use href={totalAvailable > 0 ? '#i-check-circle' : '#i-alert-tri'} /></svg>
                          {totalAvailable > 0 ? `${totalAvailable} יחידות פנויות מתוך ${totalUnits}` : 'אין יחידות פנויות לתאריך זה'}
                        </div>

                        <div className="ka-size-row">
                          {visibleSizesArr.length === 0 ? (
                            <span style={{ color: 'var(--ink-faint)', fontSize: '12.5px' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי לתאריך זה'}</span>
                          ) : (
                            visibleSizesArr.map(([sName, sData]) => (
                              <span
                                key={sName}
                                className={`ka-size-pill ${sData.available > 0 ? 'avail' : 'out'}`}
                                title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModelDoubleClick(model, sName);
                                }}
                                style={{ cursor: isLocked ? 'default' : 'pointer' }}
                              >
                                {sName} · {sData.available}/{sData.total}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ka-results-grid" style={{ zoom: zoomLevel }}>
                  {displayDresses.map(model => {
                    const { sizesArray, totalAvailable, totalUnits } = getModelSizeInfo(model);
                    const visibleSizesArr = showZeroSizes ? sizesArray : sizesArray.filter(([, d]) => d.available > 0);

                    return (
                      <div key={model.id} className="ka-dress-card" style={{ cursor: isLocked ? 'default' : 'pointer' }} onClick={() => {
                        handleModelDoubleClick(model);
                      }}>
                        <ModelAvatar model={model} size="lg" showImage={settings.hide_dress_images !== 'true'} />

                        <h3>
                          {model.name}
                          {model.priceCategory && model.priceCategory !== 'כללי' && <span className="ka-badge ka-badge-primary">{model.priceCategory}</span>}
                        </h3>
                        <div className="ka-dress-code">{model.barcodePrefix ? `#${model.barcodePrefix}` : '—'}{model.priceCategory ? ` · ${model.priceCategory}` : ''}</div>

                        <div className={`ka-avail-line ${totalAvailable > 0 ? 'ok' : 'bad'}`}>
                          <svg className="icon"><use href={totalAvailable > 0 ? '#i-check-circle' : '#i-alert-tri'} /></svg>
                          {totalAvailable > 0 ? `${totalAvailable} יחידות פנויות מתוך ${totalUnits}` : 'אין יחידות פנויות לתאריך זה'}
                        </div>

                        <div className="ka-size-row">
                          {visibleSizesArr.length === 0 ? (
                            <span style={{ color: 'var(--ink-faint)', fontSize: '12.5px' }}>{sizesArray.length === 0 ? 'אין מידות רשומות' : 'אין מלאי פנוי לתאריך זה'}</span>
                          ) : (
                            visibleSizesArr.map(([sName, sData]) => (
                              <span
                                key={sName}
                                className={`ka-size-pill ${sData.available > 0 ? 'avail' : 'out'}`}
                                title={`מידה ${sName}: ${sData.available} פנויות מתוך ${sData.total}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleModelDoubleClick(model, sName);
                                }}
                                style={{ cursor: isLocked ? 'default' : 'pointer' }}
                              >
                                {sName} · {sData.available}/{sData.total}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Unlock modal */}
      {showUnlockModal && (
        <div className="ka-modal-backdrop">
          <form onSubmit={handleUnlock} autoComplete="off" className="ka-modal">
            <div className="ka-modal-head">
              <span className="ka-modal-head-title">
                <svg className="icon"><use href="#i-lock" /></svg>
                {unlockIntent === 'print' ? 'אישור עובד להדפסה' : 'שחרור מסך מנעילה'}
              </span>
            </div>
            <div className="ka-modal-body">
              <div className="ka-field">
                <label>בחר עובד:</label>
                <select data-agy-id="unlock_employee_select" value={unlockEmployee} onChange={e => setUnlockEmployee(e.target.value)}>
                  <option value="">-- בחר --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              <div className="ka-field">
                <label>קוד גישה:</label>
                <div className="ka-pin-field">
                  <svg className="icon lead-icon"><use href="#i-lock" /></svg>
                  <input data-agy-id="unlock_password_input" type={showUnlockPassword ? 'text' : 'password'} autoComplete="off"
                    placeholder="••••••"
                    value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} />
                  <button type="button" className="toggle-eye" title={showUnlockPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                    onClick={() => setShowUnlockPassword(v => !v)}>
                    <svg className="icon"><use href="#i-eye" /></svg>
                  </button>
                </div>
              </div>
              {unlockError && <div className="ka-error">{unlockError}</div>}
            </div>
            <div className="ka-modal-foot">
              <button data-agy-id="cancel_unlock_btn" type="button" className="ka-btn ka-btn-ghost"
                onClick={() => { setShowUnlockModal(false); setUnlockIntent('unlock'); setShowUnlockPassword(false); }}>ביטול</button>
              <button data-agy-id="submit_unlock_btn" type="submit" className="ka-btn ka-btn-primary" disabled={unlockLoading}>
                {unlockLoading ? 'בודק...' : (unlockIntent === 'print' ? 'אשר והדפס' : 'שחרר')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Orders-for-model modal */}
      {showOrdersModal && (
        <div className="ka-modal-backdrop" style={{ zIndex: 10000 }}>
          <div className="ka-modal wide">
            <div className="ka-modal-head">
              <span className="ka-modal-head-title">
                <svg className="icon"><use href="#i-bag" /></svg>
                הזמנות - {ordersModalModel?.name} {ordersModalSize ? `(מידה ${ordersModalSize})` : ''}
              </span>
              <button data-agy-id="close_orders_modal_btn" type="button" className="ka-icon-btn" style={{ width: '32px', height: '32px' }} title="סגירה" onClick={() => setShowOrdersModal(false)}>
                <svg className="icon" style={{ width: '15px', height: '15px' }}><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="ka-modal-body">
              <div className="ka-modal-hint">טווח: שבוע לפני ואחרי תאריך האירוע</div>
              {ordersModalLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', padding: '20px 0', color: 'var(--ink-soft)' }}>
                  <span className="ka-spinner sm" />טוען נתונים...
                </div>
              ) : ordersModalOrders.length === 0 ? (
                <div style={{ color: 'var(--ink-faint)', textAlign: 'center', padding: '30px 0', fontSize: '13px' }}>לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר.</div>
              ) : (
                <div>
                  {ordersModalOrders.map(order => (
                    <div key={order.orderId} className="ka-order-row">
                      <div className="om">
                        <strong>הזמנה #{order.orderId} - {order.customer?.firstName} {order.customer?.lastName}</strong>
                        <span>תאריך אירוע: {new Date(order.eventDate).toLocaleDateString('he-IL')}</span>
                      </div>
                      <span className={`ka-badge ${order.status === 'סגור' ? 'ka-badge-neutral' : 'ka-badge-primary'}`}>
                        {order.status || 'פעיל'}
                      </span>
                      <a
                        href={`/orders/${order.orderId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="פתח הזמנה"
                        className="ka-link-btn"
                      >
                        <svg className="icon"><use href="#i-link" /></svg>
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
