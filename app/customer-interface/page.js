'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HDate, Sedra, Locale, HebrewCalendar } from '@hebcal/core';
import { getHebrewDateString, getHebrewMonthYear } from '@/lib/hebrewDate';
import { RefreshCw, Printer, Lock, Maximize, Bot, Mic, History, Shirt, Crown, Star, Sparkles, Scissors, Gem, Heart, ShoppingBag, Feather, Palette, Camera, Tag, Gift, Sun, Moon, Music, Smile, Search, Calendar, Loader2, LogOut, Plus, Send, ExternalLink, LayoutGrid, List } from 'lucide-react';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDatePicker from '@/components/HebrewDatePicker';

export default function CustomerInventoryViewer() {
  const { getLabel } = useLabels();
  const router = useRouter();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(1);
  const [search, setSearch] = useState('');
  const [showZeroSizes, setShowZeroSizes] = useState(false);
  const [viewMode, setViewMode] = useState('grid');
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedModel, setSelectedModel] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [unlockEmployee, setUnlockEmployee] = useState('');
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [showOrdersModal, setShowOrdersModal] = useState(false);
  const [ordersModalModel, setOrdersModalModel] = useState(null);
  const [ordersModalSize, setOrdersModalSize] = useState(null);
  const [ordersModalLoading, setOrdersModalLoading] = useState(false);
  const [ordersModalOrders, setOrdersModalOrders] = useState([]);

  // AI Chat State
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiChats, setAiChats] = useState({
    1: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }],
    2: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים, להציג תפוסה מלאה ולענות על שאלות. במה אפשר לעזור?' }]
  });
  const aiMessages = aiChats[stage] || [];
  const [aiLoading, setAiLoading] = useState(false);
  const [isAiChatVisible, setIsAiChatVisible] = useState(false);
  useEffect(() => { setIsAiChatVisible(false); }, [stage]); // Close chat on stage change
  const [isListening, setIsListening] = useState(false);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const [aiChatSessions, setAiChatSessions] = useState([]);
  
  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    const savedSessions = localStorage.getItem('ai_customer_chat_sessions');
    if (savedSessions) {
      try {
        setAiChatSessions(JSON.parse(savedSessions));
      } catch (e) {}
    }

    const saved = localStorage.getItem('ai_customer_chat');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) setAiMessages(parsed);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (aiMessages.length > 0) {
      localStorage.setItem('ai_customer_chat', JSON.stringify(aiMessages));
    }
  }, [aiMessages]);

  const startNewAiChat = () => {
    if (aiMessages.length > 1) {
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...aiMessages] };
      const updatedSessions = [newSession, ...aiChatSessions].slice(0, 10);
      setAiChatSessions(updatedSessions);
      localStorage.setItem('ai_customer_chat_sessions', JSON.stringify(updatedSessions));
    }
    setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }] }));
    setShowAiHistory(false);
  };

  const loadAiSession = (session) => {
    if (aiMessages.length > 1 && !aiChatSessions.find(s => s.id === session.id)) {
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...aiMessages] };
      const updatedSessions = [newSession, ...aiChatSessions].slice(0, 10);
      setAiChatSessions(updatedSessions);
      localStorage.setItem('ai_customer_chat_sessions', JSON.stringify(updatedSessions));
    }
    setAiMessages(session.messages);
    setShowAiHistory(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiChatOpen]);

  const handleAiSubmit = async (e) => {
    e.preventDefault();
    if(!aiInput.trim() || aiLoading) return;
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
      
      setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage]||[]), assistantMsg] }));
    } catch (err) {
      setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage]||[]), { role: 'assistant', content: 'שגיאת תקשורת.' }] }));
    } finally {
      setAiLoading(false);
    }
  };

  const fetchInventory = () => {
    setLoading(true);
    setSelectedModel(null);
    const dateQuery = selectedDate ? `?eventDate=${selectedDate.toISOString()}` : '';
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
        setIsLocked(false);
        setShowUnlockModal(false);
        setUnlockPassword('');
        setUnlockEmployee('');
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(err => console.warn(err));
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

  const getModelQuantities = (model) => {
    let qOther = 0;
    if (model.items && Array.isArray(model.items)) {
      model.items.forEach(item => {
        if (item.inRepair || item.notInUse || item.quantity <= 0) return;
        qOther += item.quantity || 1;
      });
    }
    return { qOther };
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
      const res = await fetch(`/api/orders?itemDetails=${encodeURIComponent(model.name)}&eventDateFrom=${fromDate.toISOString()}&eventDateTo=${toDate.toISOString()}&filterStatus=all`);
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
    } catch(e) {
      console.error(e);
    } finally {
      setOrdersModalLoading(false);
    }
  };

  const displayDresses = useMemo(() => {
    let list = dresses.filter(d => {
      const term = search.toLowerCase();
      if (!term) return true;
      const matchName = (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString().includes(term));
      if (matchName) return true;
      if (d.items) {
        return d.items.some(item => (item.sizeText || 'כללי').toLowerCase().includes(term));
      }
      return false;
    });
    
    list.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    return list;
  }, [dresses, search, sortAsc]);

  const grandTotalItems = useMemo(() => {
    return displayDresses.reduce((sum, model) => {
      const { qOther } = getModelQuantities(model);
      return sum + qOther;
    }, 0);
  }, [displayDresses]);

  // Calendar Helpers
  const changeMonth = (delta) => {
    try {
      const hCurrent = new HDate(selectedDate);
      const current15 = new HDate(15, hCurrent.getMonth(), hCurrent.getFullYear());
      const nextMonthHDate = new HDate(current15.abs() + (30 * delta));
      const newMonthFirstDay = new HDate(1, nextMonthHDate.getMonth(), nextMonthHDate.getFullYear());
      setSelectedDate(newMonthFirstDay.greg());
    } catch(e) {
      const d = new Date(selectedDate);
      d.setMonth(d.getMonth() + delta);
      setSelectedDate(d);
    }
  };
  
  const changeDay = (delta) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const renderCalendar = () => {
    let hCurrent;
    try {
      hCurrent = new HDate(selectedDate);
    } catch(e) {
      hCurrent = new HDate(new Date());
    }
    const hYear = hCurrent.getFullYear();
    const hMonth = hCurrent.getMonth();
    
    const firstDayHDate = new HDate(1, hMonth, hYear);
    const firstDayOfWeek = firstDayHDate.getDay(); 
    const daysInHebMonth = hCurrent.daysInMonth();
    
    const weeks = [];
    let currentWeek = [];
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push(null);
    }
    
    for (let day = 1; day <= daysInHebMonth; day++) {
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push(day);
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) currentWeek.push(null);
      weeks.push(currentWeek);
    }
    
    return (
      <table className="cal-table">
        <thead>
          <tr>
            {["א","ב","ג","ד","ה","ו","שבת"].map(d => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j} className="empty"></td>;
                
                const cellHDate = new HDate(day, hMonth, hYear);
                const cellGreg = cellHDate.greg();
                
                const isSelected = cellGreg.toDateString() === selectedDate.toDateString();
                const isToday = cellGreg.toDateString() === new Date().toDateString();
                
                let hebrewDayStr = day;
                try {
                  hebrewDayStr = cellHDate.renderGematriya().split(' ')[0];
                } catch(e) {}
                
                let parashaText = '';
                if (j === 6) {
                  try {
                    const s = new Sedra(hYear, true);
                    const p = s.lookup(cellHDate);
                    if (p && p.parsha && p.parsha.length > 0) {
                      parashaText = p.parsha.map(name => Locale.gettext(name, 'he')).join('-');
                    }
                  } catch(e) {}
                }

                let holidays = [];
                try {
                  const evs = HebrewCalendar.getHolidaysOnDate(cellHDate, true) || [];
                  holidays = evs.filter(e => {
                    const flags = e.getFlags();
                    const name = e.render('he');
                    if (flags & 8192) return false; // Exclude Modern Holidays (Jabotinsky, etc)
                    if (name.includes('בנות') || name.includes('מעשר בהמה') || name.includes('סליחות')) return false; 
                    return (flags & 1) || (flags & 524288) || (flags & 2097152) || (flags & 16384) || (flags & 256);
                  }).map(e => e.render('he'));
                } catch (e) {}

                return (
                  <td 
                    key={j} 
                    className={`${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => setSelectedDate(cellGreg)}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center', alignItems: 'center', lineHeight: '1.2' }}>
                      <span style={{ fontSize: '10px', color: '#9ca3af' }}>{cellGreg.getDate()}/{cellGreg.getMonth() + 1}</span>
                      <span style={{ fontWeight: 'bold' }}>{hebrewDayStr}</span>
                      {parashaText && <span style={{ fontSize: '10px', color: '#8b5cf6', marginTop: '2px', fontWeight: 'normal' }}>{parashaText}</span>}
                      {holidays.map((h, idx) => (
                        <span key={idx} style={{ fontSize: '9px', color: '#ec4899', marginTop: '1px', fontWeight: 'normal' }}>{h}</span>
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const renderSizes = () => {
    if (!selectedModel) {
      return <div className="empty-state">בחר דגם לצפייה במידות</div>;
    }

    const sizesMap = {};
    let totalSizesItems = 0;

    if (selectedModel.items) {
      selectedModel.items.forEach(item => {
        if (item.inRepair || item.notInUse) return;
        const size = item.sizeText || 'כללי';
        if (!sizesMap[size]) {
          sizesMap[size] = { name: size, qOther: 0 };
        }
        const qty = item.quantity || 0;
        
        if (qty > 0) {
          totalSizesItems += qty;
          sizesMap[size].qOther += qty;
        }
      });
    }

    const sizesArr = Object.values(sizesMap).sort((a, b) => {
      const na = parseFloat(a.name);
      const nb = parseFloat(b.name);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.name.localeCompare(b.name);
    });

    if (sizesArr.length === 0) {
      return <div className="empty-state">אין נתונים לדגם זה</div>;
    }

    return (
      <div className="sizes-grid" data-total-items={totalSizesItems} data-total-sizes={sizesArr.length}>
        {sizesArr.map(item => (
          <div key={item.name} className="size-badge animate-fade-in" onDoubleClick={() => handleModelDoubleClick(selectedModel, item.name)}>
            <div className="size-name">{item.name}</div>
            <div style={{ position: 'relative' }}>
              {item.qOther > 0 ? (
                <div className="size-qty">{item.qOther}</div>
              ) : (
                <div className="size-qty zero">-</div>
              )}
              {!isLocked && (
                <div 
                  title="הזמנות של המידה (לחץ כאן או לחיצה כפולה)"
                  onClick={(e) => { e.stopPropagation(); handleModelDoubleClick(selectedModel, item.name); }}
                  style={{ 
                    position: 'absolute', top: '-6px', right: '-6px',
                    color: '#ffffff', background: '#3b82f6', cursor: 'pointer', padding: '3px',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)', zIndex: 10,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.15)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                >
                  <History size={10} strokeWidth={3} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handlePrint = () => {
    if (!selectedModel) {
      alert("נא לבחור דגם");
      return;
    }
    window.print();
  };

  const handleCatalogPrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("נא לאפשר חלונות קופצים (Pop-ups) כדי להדפיס");
      return;
    }

    const dateStr = getHebrewDateString(selectedDate);
    const filterText = search ? ` - סינון: ${search}` : '';
    
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
      
      const sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));
      let sizesHtml = sizesArray.map(([sName, sData]) => {
        const isAvail = sData.available > 0;
        return `<span style="display:inline-block; margin:2px; padding:4px 8px; border-radius:6px; font-size:13px; border:1px solid ${isAvail ? '#86efac' : '#cbd5e1'}; background:${isAvail ? '#dcfce7' : '#e2e8f0'}; color:${isAvail ? '#166534' : '#475569'}; ${isAvail ? 'font-weight:bold;' : ''}">${sName} (${sData.available}/${sData.total})</span>`;
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
          body { font-family: system-ui, -apple-system, sans-serif; color: #1e293b; padding: 20px; margin: 0; background: white; }
          .report-header { text-align: center; border-bottom: 2px solid #3b82f6; padding-bottom: 15px; margin-bottom: 25px; }
          .report-header h1 { margin: 0 0 10px 0; font-size: 26px; color: #0f172a; }
          .report-header p { margin: 0; font-size: 16px; color: #475569; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 12px 16px; text-align: right; }
          th { background: #f8fafc; font-weight: bold; color: #334155; font-size: 15px; border-bottom: 2px solid #cbd5e1; }
          tr:nth-child(even) { background: #f8fafc; }
          .summary { font-size: 16px; font-weight: bold; margin-top: 20px; text-align: right; padding-top: 15px; border-top: 2px solid #e2e8f0; }
          @media print {
            body { padding: 0; }
            table { box-shadow: none; }
            th { background: #f1f5f9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
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

  return (
    <div className="layout-container" style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', fontFamily: 'system-ui, -apple-system, sans-serif', position: 'relative', direction: 'rtl' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-5px); } 100% { transform: translateY(0px); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* Glassmorphism Classes */
        .glass-panel {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 24px;
          border: 1px solid rgba(255, 255, 255, 0.5);
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.05);
        }
        
        .header-btn {
          background: rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(200, 200, 200, 0.4);
          border-radius: 14px;
          color: #475569;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .header-btn:hover {
          background: #ffffff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
          color: #3b82f6;
        }
        .header-btn:active { transform: scale(0.95); }

        /* Stage 1: Hero Search */
        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          text-align: center;
          animation: float 6s ease-in-out infinite;
        }

        .ai-search-container {
          position: relative;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
        }
        
        .ai-search-input {
          width: 100%;
          padding: 24px 32px;
          font-size: 1.25rem;
          border-radius: 999px;
          border: 2px solid transparent;
          background: white;
          box-shadow: 0 10px 30px rgba(0,0,0,0.08);
          outline: none;
          transition: all 0.3s;
          padding-right: 70px;
        }
        .ai-search-input:focus {
          border-color: #a855f7;
          box-shadow: 0 10px 40px rgba(168, 85, 247, 0.2);
        }
        
        .ai-search-btn {
          position: absolute;
          right: 12px;
          top: 12px;
          bottom: 12px;
          background: linear-gradient(135deg, #a855f7, #6366f1);
          color: white;
          border: none;
          border-radius: 999px;
          width: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .ai-search-btn:hover {
          transform: scale(1.05);
        }

        /* Stage 2: Results Grid */
        .modern-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
          padding: 24px 0;
        }

        .modern-rows {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 24px 0;
        }
        
        .dress-card {
          background: white;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.03);
          border: 1px solid #f1f5f9;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          position: relative;
        }
        .modern-rows .dress-card {
          display: flex;
          flex-direction: row;
          align-items: stretch;
        }

        .dress-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border-color: #bfdbfe;
        }
        .modern-rows .dress-card:hover {
          transform: translateY(-4px);
        }
        
        .dress-image-placeholder {
          height: 160px;
          background: linear-gradient(45deg, #f1f5f9, #e2e8f0);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
        }
        .modern-rows .dress-image-placeholder {
          width: 160px;
          height: auto;
          min-height: 120px;
          flex-shrink: 0;
        }
        
        .dress-content {
          padding: 20px;
        }
        .modern-rows .dress-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 16px 24px;
        }
        .dress-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
          margin-bottom: 4px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dress-subtitle {
          color: #64748b;
          font-size: 0.9rem;
          margin-bottom: 16px;
        }
        
        .sizes-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .size-pill {
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 0.85rem;
          font-weight: 600;
          background: #f1f5f9;
          color: #64748b;
        }
        .size-pill.available {
          background: #dcfce7;
          color: #166534;
        }
        
        /* Layout */
        .layout-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1600px;
          margin: 0 auto;
          padding: 24px;
        }
        
        /* Calendar */
        .cal-table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: center; }
        .cal-table th { color: #64748b; font-size: 13px; font-weight: 600; padding: 12px 0; }
        .cal-table td { height: 50px; cursor: pointer; border-radius: 12px; transition: all 0.2s; margin: 2px; }
        .cal-table td:hover { background: #f1f5f9; }
        .cal-table td.selected { background: #3b82f6; color: white; font-weight: bold; box-shadow: 0 4px 12px rgba(59,130,246,0.3); }
        .cal-table td.today { border: 2px solid #3b82f6; }
        
        .model-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .model-card:hover {
          transform: translateY(-4px) scale(1.01);
          box-shadow: 0 20px 40px -10px rgba(0,0,0,0.1);
        }
        
        .size-badge {
          transition: all 0.2s ease;
        }
        .size-badge:hover {
          transform: translateY(-2px);
          filter: brightness(0.95);
        }
      `}} />
      
      {/* Stage 1: Search & Date Selection */}
      {stage === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '0 24px', animation: 'fadeIn 0.5s ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 className="hero-title">מה תחפש היום?</h1>
            <p style={{ fontSize: '1.2rem', color: '#64748b' }}>הזן סגנון, מידה או פשוט בחר תאריך מהיומן</p>
          </div>

          <div className="ai-search-container" style={{ marginBottom: '4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Chat History Above Input */}
            {aiMessages.length > 1 && (
              <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '24px', boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', color: '#1e293b', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid rgba(0,0,0,0.05)', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(168,85,247,0.3)' }}>
                      <Sparkles size={16} />
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>העוזר החכם</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }] }))} title="שיחה חדשה" style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => {e.currentTarget.style.background='#e2e8f0'; e.currentTarget.style.color='#3b82f6'; e.currentTarget.style.transform='rotate(90deg)';}} onMouseOut={e => {e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#64748b'; e.currentTarget.style.transform='rotate(0deg)';}}><Plus size={18} /></button>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aiMessages.slice(1).map((msg, idx) => {
                    let displayContent = msg.content;
                    let isoDateMatch = null;
                    let filterMatchStr = null;
                    if (typeof displayContent === 'string') {
                      const dateRegex = /\[DATE:(\d{4}-\d{2}-\d{2})\]/;
                      const dateMatch = displayContent.match(dateRegex);
                      if (dateMatch) {
                        isoDateMatch = dateMatch[1];
                      }
                      
                      const filterRegex = /\[FILTER:(.*?)\]/;
                      const filterMatch = displayContent.match(filterRegex);
                      if (filterMatch) {
                        filterMatchStr = filterMatch[1].trim();
                      }
                      
                      displayContent = displayContent.replace(/\[DATE:\d{4}-\d{2}-\d{2}\]/g, '').replace(/\[FILTER:(.*?)\]/g, '').trim();
                    }
                    
                    return (
                      <div key={idx} style={{ 
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        background: msg.role === 'user' ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'white',
                        color: msg.role === 'user' ? 'white' : '#1e293b',
                        padding: '14px 18px', 
                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                        maxWidth: '85%',
                        boxShadow: msg.role === 'user' ? '0 4px 15px rgba(168,85,247,0.3)' : '0 4px 15px rgba(0,0,0,0.04)',
                        border: msg.role === 'user' ? 'none' : '1px solid #f1f5f9',
                        lineHeight: '1.5'
                      }}>
                        <div>{displayContent}</div>
                        {msg.role === 'assistant' && isoDateMatch && !filterMatchStr && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                              setStage(2);
                            }}
                            style={{ marginTop: '12px', background: '#f8fafc', color: '#ec4899', border: '1px solid #fce7f3', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(236,72,153,0.1)' }}
                            onMouseOver={e => { e.currentTarget.style.background = '#fdf2f8'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(236,72,153,0.2)'; }}
                            onMouseOut={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.boxShadow = '0 2px 5px rgba(236,72,153,0.1)'; }}
                          >
                            👉 הצג מלאי לתאריך {getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))}
                          </button>
                        )}
                        {msg.role === 'assistant' && filterMatchStr && (
                          <button 
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSearch(filterMatchStr);
                              if (isoDateMatch) {
                                setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                              }
                              setStage(2);
                            }} 
                            style={{ marginTop: '12px', background: '#f8fafc', color: '#3b82f6', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                            onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)'}
                            onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'}
                          >
                            <Search size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                            סנן והצג: {filterMatchStr} {isoDateMatch ? `(לתאריך ${getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))})` : ''}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1rem', alignSelf: 'flex-start', background: 'white', padding: '16px 20px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                )}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '24px', display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px', borderRadius: '999px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="מה תרצה לחפש?"
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '999px', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.05rem', color: '#1e293b' }}
                  />
                  <button type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                    <Send size={18} style={{ transform: 'rotate(-45deg)', marginLeft: '4px' }} />
                  </button>
                </form>
            </div>
          )}

            {aiMessages.length <= 1 && (
            <div style={{ position: 'relative', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <form onSubmit={handleAiSubmit} style={{ position: 'relative', flex: 1 }}>
                <input 
                  type="text" 
                  className="ai-search-input" 
                  placeholder="לדוגמה: שמלה שחורה מידה 12..."
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  disabled={aiLoading}
                  style={{ width: '100%', margin: 0 }}
                />
                <button type="submit" className="ai-search-btn" disabled={aiLoading}>
                  {aiLoading ? <Loader2 size={24} className="animate-spin" /> : <Sparkles size={24} />}
                </button>
              </form>
            </div>
          )}
          </div>

          <div className="glass-panel" style={{ padding: '32px', width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#1e293b', margin: '0 0 24px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={24} color="#3b82f6" /> בחירת תאריך לאירוע
            </h3>
            <HebrewDatePicker
              selectedDate={selectedDate}
              onChange={(d) => { setSelectedDate(new Date(d)); setStage(2); }}
            />
            <button 
              onClick={() => setStage(2)}
              style={{ marginTop: '32px', padding: '16px 48px', background: '#3b82f6', color: 'white', fontSize: '1.1rem', fontWeight: 'bold', borderRadius: '999px', border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)', transition: 'all 0.2s' }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              הצג מלאי פנוי לתאריך
            </button>
          </div>
        </div>
      )}

      {/* Stage 2: Inventory Grid */}
      {stage === 2 && (
        <div className="layout-container" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          
          
          {/* Header Row */}
          <div style={{ 
            background: 'linear-gradient(135deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%)', 
            backdropFilter: 'blur(20px)',
            borderRadius: '24px', 
            padding: '24px 32px', 
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(255,255,255,0.6)', 
            marginBottom: '24px' 
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '20px', borderBottom: '1px solid rgba(226,232,240,0.8)', paddingBottom: '20px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
                  <h2 style={{ fontSize: '2.2rem', fontWeight: '800', margin: 0, background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    קטלוג שמלות זמינות
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.6)', padding: '6px', borderRadius: '16px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                    <button className="header-btn" onClick={() => router.push('/')} title="חזור למערכת" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#ef4444', background: '#fee2e2', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><LogOut size={18} /></button>
                    <button className="header-btn" onClick={() => setStage(1)} title="חיפוש חדש" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#3b82f6', background: '#dbeafe', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Search size={18} /></button>
                    <button className="header-btn" onClick={fetchInventory} title="רענון מלאי" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#10b981', background: '#d1fae5', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><RefreshCw size={18} /></button>
                    <button className="header-btn" onClick={handleCatalogPrint} title="הדפסה" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#8b5cf6', background: '#ede9fe', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Printer size={18} /></button>
                    {isLocked ? (
                      <button className="header-btn" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, borderRadius: '12px', border: 'none', cursor: 'pointer', boxShadow: '0 4px 10px rgba(239,68,68,0.3)' }} onClick={() => setShowUnlockModal(true)} title="שחרור מסך"><Lock size={18} /></button>
                    ) : (
                      <button className="header-btn" onClick={() => {
                        setIsLocked(true);
                        if (document.documentElement.requestFullscreen) {
                          document.documentElement.requestFullscreen().catch(err => console.warn(err));
                        }
                      }} title="תפיסת מסך ללקוח" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', padding: 0, color: '#f59e0b', background: '#fef3c7', borderRadius: '12px', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}><Maximize size={18} /></button>
                    )}
                  </div>
                </div>
                <div style={{ color: '#64748b', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={20} color="#94a3b8" />
                  לתאריך: <strong style={{ color: '#3b82f6', background: '#eff6ff', padding: '4px 12px', borderRadius: '999px', fontSize: '1rem' }}>{getHebrewDateString(new Date(selectedDate))}</strong> <span style={{opacity: 0.7}}>({(new Date(selectedDate)).toLocaleDateString('he-IL')})</span>
                </div>
              </div>
              
              
            </div>

            {/* Filter Tools */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 280px' }}>
                <Search size={20} color="#94a3b8" style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  type="text" 
                  placeholder="חיפוש מודל (שם, תחרה, 42)..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '16px 48px 16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'rgba(255,255,255,0.8)', fontSize: '1.05rem', outline: 'none', transition: 'all 0.3s', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)' }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(59,130,246,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.01)'; }}
                />
              </div>

              {isAiChatVisible ? (
                <div style={{ position: 'relative', flex: '1 1 280px', display: 'flex', alignItems: 'center' }}>
                  <button onClick={() => setIsAiChatVisible(false)} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', color: '#a855f7', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'all 0.3s' }}>
                    <Sparkles size={20} />
                    העוזר החכם פעיל - לחץ לסגירה
                  </button>
                </div>
              ) : (
                <div style={{ position: 'relative', flex: '1 1 280px' }}>
                  <form onSubmit={handleAiSubmit} style={{ margin: 0, width: '100%' }}>
                    <Sparkles size={20} color="#a855f7" style={{ position: 'absolute', right: '18px', top: '50%', transform: 'translateY(-50%)' }} />
                    <input 
                      type="text" 
                      placeholder="שאל את ה-AI..."
                      value={aiInput}
                      onChange={e => setAiInput(e.target.value)}
                      disabled={aiLoading}
                      style={{ width: '100%', padding: '16px 48px 16px 20px', borderRadius: '16px', border: '2px solid transparent', background: 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9))', fontSize: '1.05rem', outline: 'none', transition: 'all 0.3s' }}
                      onFocus={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#a855f7'; e.currentTarget.style.boxShadow = '0 0 0 4px rgba(168,85,247,0.1)'; }}
                      onBlur={e => { if(!aiInput) { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(248,250,252,0.9), rgba(241,245,249,0.9))'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.boxShadow = 'none'; } }}
                    />
                  </form>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'white', padding: '12px 24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: '#475569' }}>זום</span>
                <input 
                  type="range" 
                  min="0.5" max="1.5" step="0.1" 
                  value={zoomLevel} 
                  onChange={e => setZoomLevel(parseFloat(e.target.value))} 
                  style={{ cursor: 'pointer', accentColor: '#3b82f6', width: '100px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'white', padding: '6px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <button 
                  onClick={() => setViewMode('grid')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', border: 'none', borderRadius: '12px', background: viewMode === 'grid' ? '#eff6ff' : 'transparent', color: viewMode === 'grid' ? '#3b82f6' : '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
                  title="תצוגת ריבועים"
                >
                  <LayoutGrid size={20} />
                </button>
                <button 
                  onClick={() => setViewMode('rows')}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', border: 'none', borderRadius: '12px', background: viewMode === 'rows' ? '#eff6ff' : 'transparent', color: viewMode === 'rows' ? '#3b82f6' : '#94a3b8', cursor: 'pointer', transition: 'all 0.2s' }}
                  title="תצוגת שורות"
                >
                  <List size={20} />
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none', background: showZeroSizes ? '#eff6ff' : 'white', padding: '14px 24px', borderRadius: '16px', border: `1px solid ${showZeroSizes ? '#bfdbfe' : '#e2e8f0'}`, transition: 'all 0.3s' }} onClick={() => setShowZeroSizes(!showZeroSizes)}>
                <div style={{ width: '44px', height: '24px', background: showZeroSizes ? '#3b82f6' : '#cbd5e1', borderRadius: '999px', position: 'relative', transition: 'background 0.3s' }}>
                  <div style={{ width: '20px', height: '20px', background: 'white', borderRadius: '50%', position: 'absolute', top: '2px', left: showZeroSizes ? '22px' : '2px', transition: 'left 0.3s', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} />
                </div>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: showZeroSizes ? '#1d4ed8' : '#64748b' }}>
                  הצג תפוסה מלאה
                </span>
              </div>
            </div>
          </div>
          
          {isAiChatVisible && stage === 2 && (
            <div style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(12px)', padding: '24px', borderRadius: '24px', marginTop: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)', maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
               <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', paddingBottom: '16px', color: '#8b5cf6', fontWeight: 'bold', justifyContent: 'space-between', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', padding: '8px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(168,85,247,0.3)' }}>
                      <Sparkles size={16} />
                    </div>
                    <span style={{ fontSize: '1.1rem', color: '#1e293b' }}>העוזר החכם</span>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }] }))} title="שיחה חדשה" style={{ background: '#f1f5f9', border: 'none', color: '#64748b', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }} onMouseOver={e => {e.currentTarget.style.background='#e2e8f0'; e.currentTarget.style.color='#3b82f6'; e.currentTarget.style.transform='rotate(90deg)';}} onMouseOut={e => {e.currentTarget.style.background='#f1f5f9'; e.currentTarget.style.color='#64748b'; e.currentTarget.style.transform='rotate(0deg)';}}><Plus size={18} /></button>
                    <button onClick={() => setIsAiChatVisible(false)} title="סגור" style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', fontWeight: 'bold' }} onMouseOver={e => {e.currentTarget.style.background='#fecaca'; e.currentTarget.style.transform='scale(1.1)';}} onMouseOut={e => {e.currentTarget.style.background='#fee2e2'; e.currentTarget.style.transform='scale(1)';}}>X</button>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aiMessages.slice(1).map((msg, idx) => (
                    <div key={idx} style={{ 
                      alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      background: msg.role === 'user' ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'white',
                      color: msg.role === 'user' ? 'white' : '#1e293b',
                      padding: '14px 18px', 
                      borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px', 
                      maxWidth: '85%',
                      boxShadow: msg.role === 'user' ? '0 4px 15px rgba(168,85,247,0.3)' : '0 4px 15px rgba(0,0,0,0.04)',
                      border: msg.role === 'user' ? 'none' : '1px solid #f1f5f9',
                      lineHeight: '1.5'
                    }}>
                      <div>
                        {msg.content.replace(/\[FILTER:(.*?)\]/g, '').replace(/\[DATE:\d{4}-\d{2}-\d{2}\]/g, '').trim()}
                      </div>
                      {(() => {
                        const match = msg.content.match(/\[FILTER:(.*?)\]/);
                        if (match && match[1]) {
                          return (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setSearch(match[1].trim());
                                e.currentTarget.style.transform = 'scale(0.95)';
                                setTimeout(() => { if (e.currentTarget) e.currentTarget.style.transform = 'scale(1)'; }, 150);
                              }} 
                              style={{ marginTop: '12px', background: msg.role === 'user' ? 'rgba(255,255,255,0.2)' : '#f8fafc', border: msg.role === 'user' ? '1px solid rgba(255,255,255,0.4)' : '1px solid #e2e8f0', color: msg.role === 'user' ? 'white' : '#3b82f6', padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' }}
                              onMouseOver={e => e.currentTarget.style.boxShadow = '0 4px 10px rgba(0,0,0,0.1)'}
                              onMouseOut={e => e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.05)'}
                            >
                              <Search size={14} style={{ marginRight: '6px', marginLeft: '6px' }} />
                              סנן דגמים: {match[1]}
                            </button>
                          )
                        }
                        return null;
                      })()}
                    </div>
                  ))}
                </div>
                {aiLoading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '1rem', alignSelf: 'flex-start', background: 'white', padding: '16px 20px', borderRadius: '20px 20px 20px 4px', boxShadow: '0 4px 15px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                    <div className="typing-dot" style={{ animationDelay: '0s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.2s' }}></div>
                    <div className="typing-dot" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                )}
                
                <form onSubmit={handleAiSubmit} style={{ marginTop: '24px', display: 'flex', gap: '12px', background: '#f8fafc', padding: '8px', borderRadius: '999px', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <input 
                    type="text" 
                    value={aiInput}
                    onChange={e => setAiInput(e.target.value)}
                    disabled={aiLoading}
                    placeholder="מה תרצה לדעת?"
                    style={{ flex: 1, padding: '10px 20px', borderRadius: '999px', border: 'none', outline: 'none', background: 'transparent', fontSize: '1.05rem', color: '#1e293b' }}
                  />
                  <button type="submit" disabled={aiLoading || !aiInput.trim()} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', color: 'white', border: 'none', width: '44px', height: '44px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.6 : 1, transition: 'all 0.3s', boxShadow: '0 4px 15px rgba(168,85,247,0.4)' }} onMouseOver={e => e.currentTarget.style.transform='scale(1.05)'} onMouseOut={e => e.currentTarget.style.transform='scale(1)'}>
                    <Send size={18} style={{ transform: 'rotate(-45deg)', marginLeft: '4px' }} />
                  </button>
                </form>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: '#64748b' }}>
              <Loader2 size={48} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '16px' }} />
              <span style={{ fontSize: '1.2rem' }}>טוען נתונים...</span>
            </div>
          ) : (
            <>
              <div className={`modern-${viewMode}`} style={{ zoom: zoomLevel }}>
                {displayDresses.map(model => {
                
                // Group sizes
                const sizeMap = new Map();
                model.items?.forEach(item => {
                  if (item.notInUse || item.isDeleted || item.isUnusable) return;
                  const st = item.sizeText || 'כללי';
                  if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
                  const info = sizeMap.get(st);
                  info.total += 1;
                  if (item.quantity > 0) info.available += 1;
                });
                
                const sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));

                return (
                  <div key={model.id} className="dress-card" onClick={() => {
                    handleModelDoubleClick(model);
                  }}>
                    <div className="dress-image-placeholder">
                      {model.imageUrl ? (
                        <img src={model.imageUrl} alt={model.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Shirt size={48} opacity={0.5} />
                      )}
                    </div>
                    <div className="dress-content">
                      <div className="dress-title">{model.name}</div>
                      <div className="dress-subtitle">קידומת ברקוד: {model.barcodePrefix || model.id}</div>
                      
                      <div className="sizes-row">
                        {sizesArray.length === 0 ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>אין מידות רשומות</span>
                        ) : (
                          sizesArray.map(([sName, sData]) => (
                            <div 
                              key={sName} 
                              className={`size-pill ${sData.available > 0 ? 'available' : ''}`} 
                              title={`${sData.available} מתוך ${sData.total}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleModelDoubleClick(model, sName);
                              }}
                              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px' }}
                            >
                              <span style={{ fontSize: '1.2rem', fontWeight: '800', color: sData.available > 0 ? '#14532d' : '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{sName}</span>
                              <span style={{ whiteSpace: 'nowrap', fontWeight: 'bold', fontSize: '0.85rem', background: sData.available > 0 ? '#bbf7d0' : '#e2e8f0', color: sData.available > 0 ? '#166534' : '#64748b', padding: '2px 8px', borderRadius: '12px' }}>{sData.available}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Modals from old interface */}
      {showUnlockModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <form onSubmit={handleUnlock} style={{ background: 'white', padding: '32px', borderRadius: '24px', width: '400px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <h3 style={{ margin: '0 0 24px 0', fontSize: '1.5rem', textAlign: 'center', color: '#1e293b' }}>שחרור מסך מנעילה</h3>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>בחר עובד:</label>
              <select value={unlockEmployee} onChange={e => setUnlockEmployee(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <option value="">-- בחר --</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                ))}
              </select>
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>קוד גישה:</label>
              <input type="password" value={unlockPassword} onChange={e => setUnlockPassword(e.target.value)} style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1' }} />
            </div>
            {unlockError && <div style={{ color: '#ef4444', marginBottom: '16px', textAlign: 'center' }}>{unlockError}</div>}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button type="button" onClick={() => setShowUnlockModal(false)} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer' }}>ביטול</button>
              <button type="submit" disabled={unlockLoading} style={{ flex: 1, padding: '12px', borderRadius: '12px', border: 'none', background: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
                {unlockLoading ? 'בודק...' : 'שחרר'}
              </button>
            </div>
          </form>
        </div>
      )}

      {showOrdersModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(15, 23, 42, 0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', borderRadius: '24px', width: '600px', maxWidth: '90%', maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f8fafc' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '20px', color: '#0f172a', fontWeight: 'bold' }}>
                  הזמנות - {ordersModalModel?.name} {ordersModalSize ? `(מידה ${ordersModalSize})` : ''}
                </h3>
                <span style={{ fontSize: '13px', color: '#64748b' }}>טווח: שבוע לפני ואחרי תאריך האירוע</span>
              </div>
              <button onClick={() => setShowOrdersModal(false)} style={{ background: '#e2e8f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>X</button>
            </div>
            <div style={{ padding: '24px', overflowY: 'auto', flexGrow: 1 }}>
              {ordersModalLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>טוען נתונים...</div>
              ) : ordersModalOrders.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>לא נמצאו הזמנות לדגם זה בטווח התאריכים הנבחר.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {ordersModalOrders.map(order => (
                    <div key={order.orderId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#ffffff' }}>
                      <div>
                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>
                          הזמנה #{order.orderId} - {order.customer?.firstName} {order.customer?.lastName}
                        </div>
                        <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                          תאריך אירוע: {new Date(order.eventDate).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: order.status === 'סגור' ? '#f1f5f9' : '#dbeafe', color: order.status === 'סגור' ? '#475569' : '#1e40af', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold' }}>
                          {order.status || 'פעיל'}
                        </div>
                        <a 
                          href={`/orders/${order.orderId}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          title="פתח הזמנה"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', background: '#eff6ff', color: '#3b82f6', borderRadius: '12px', border: '1px solid #bfdbfe', cursor: 'pointer', transition: 'all 0.2s' }}
                          onMouseOver={e => { e.currentTarget.style.background = '#dbeafe'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                          onMouseOut={e => { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                          <ExternalLink size={18} />
                        </a>
                      </div>
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
