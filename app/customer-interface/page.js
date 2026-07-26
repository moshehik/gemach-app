'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HDate, Sedra, Locale, HebrewCalendar } from '@hebcal/core';
import { getHebrewDateString, getHebrewMonthYear } from '@/lib/hebrewDate';
import { RefreshCw, Printer, Lock, Maximize, Bot, Mic, History, Shirt, Crown, Star, Sparkles, Scissors, Gem, Heart, ShoppingBag, Feather, Palette, Camera, Tag, Gift, Sun, Moon, Music, Smile, Search, Calendar, Loader2, LogOut } from 'lucide-react';
import { useLabels } from '@/app/components/LabelsContext';
import HebrewDatePicker from '@/components/HebrewDatePicker';

export default function CustomerInventoryViewer() {
  const { getLabel } = useLabels();
  const router = useRouter();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState(1);
  const [search, setSearch] = useState('');
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
  const [aiMessages, setAiMessages] = useState([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }]);
  const [aiLoading, setAiLoading] = useState(false);
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
    setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }]);
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
    
    const newMessages = [...aiMessages, userMsg];
    setAiMessages(newMessages);
    setAiLoading(true);

    try {
      const historyContext = newMessages.map(m => ({ role: m.role, content: m.content }));
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMsg.content, 
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך למסור מידע ניהולי או חסוי. בנוסף - אם הלקוח מבקש מידע לגבי תאריך מסוים (למשל י"ב ניסן, או תאריך לועזי), חשב את התאריך המדויק הלועזי והוסף בסוף התשובה שלך בדיוק את התגית הבאה: [DATE:YYYY-MM-DD]. השתמש בשנה הנוכחית אם לא צוינה שנה.`
        }),
      });
      const data = await res.json();
      
      const assistantMsg = res.ok 
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'שגיאה בחיבור למערכת ה-AI.' };
      
      setAiMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת.' }]);
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
  }, [selectedDate]); // Re-fetch on date change

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

  // Aggregate item quantities
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
             return order.items.some(item => 
               item.dressId === model.id && 
               item.description?.includes(`מידה: ${sizeName}`)
             );
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

  const filteredDresses = useMemo(() => {
    let list = dresses.filter(d => {
      const term = search.toLowerCase();
      return (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString().includes(term));
    });
    
    list.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return sortAsc ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
    return list;
  }, [dresses, search, sortAsc]);

  const grandTotalItems = useMemo(() => {
    return filteredDresses.reduce((sum, model) => {
      const { qOther } = getModelQuantities(model);
      return sum + qOther;
    }, 0);
  }, [filteredDresses]);

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

  const currentMonthYear = (() => {
    return getHebrewMonthYear(selectedDate);
  })();

  const toggleListen = (e) => {
    if (e) e.preventDefault();
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("הדפדפן שלך אינו תומך בהקלטת קול.");
      return;
    }
    
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'he-IL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setAiInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.start();
  };

  // Calculate totals for sizes footer
  let sizesCount = 0;
  let itemsInSizesCount = 0;
  if (selectedModel) {
    const { qOther } = getModelQuantities(selectedModel);
    itemsInSizesCount = qOther;
    const sizesSet = new Set();
    selectedModel.items.forEach(i => {
      if (!i.inRepair && !i.notInUse && i.quantity > 0) sizesSet.add(i.sizeText || 'כללי');
    });
    sizesCount = sizesSet.size;
  }


  return (
    <div style={{ fontSize: '16px', minHeight: '100vh', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)', fontFamily: 'system-ui, -apple-system, sans-serif' }} className="customer-inventory-modern">
      <style dangerouslySetInnerHTML={{__html: `
          
        `}} />
      {isLocked && (
        <style dangerouslySetInnerHTML={{__html: `
          .navbar { display: none !important; }
          .customer-inventory-modern { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; overflow-y: auto; }
        `}} />
      )}

      <style dangerouslySetInnerHTML={{__html: `
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

        /* Stage 1: Hero Search */
        .hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          background: linear-gradient(135deg, #2563eb 0%, #9333ea 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 1rem;
          text-align: center;
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
        .dress-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.08);
          border-color: #bfdbfe;
        }
        
        .dress-image-placeholder {
          height: 160px;
          background: linear-gradient(45deg, #f1f5f9, #e2e8f0);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #94a3b8;
        }
        
        .dress-content {
          padding: 20px;
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
      `}} />

      {/* Top Bar Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '20px 40px', width: '100%' }}>
        <button className="header-btn" onClick={() => router.push('/')} title="חזור למערכת" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', padding: 0, color: '#ef4444' }}><LogOut size={22} /></button>
        <div style={{ display: 'flex', gap: '12px' }}>
        <button className="header-btn" onClick={() => setStage(1)} title="חיפוש חדש" style={{ display: stage === 2 ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', padding: 0 }}><Search size={22} /></button>
        <button className="header-btn" onClick={fetchInventory} title="רענון מלאי" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', padding: 0 }}><RefreshCw size={22} /></button>
        {isLocked ? (
          <button className="header-btn" style={{ background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', padding: 0 }} onClick={() => setShowUnlockModal(true)} title="שחרור מסך"><Lock size={22} /></button>
        ) : (
          <button className="header-btn" onClick={() => {
            setIsLocked(true);
            if (document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(err => console.warn(err));
            }
          }} title="תפיסת מסך ללקוח" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', padding: 0 }}><Maximize size={22} /></button>
        )}
      </div>
      </div>

      {/* Stage 1: Search & Date Selection */}
      {stage === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '70vh', padding: '0 24px', animation: 'fadeIn 0.5s ease-out' }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h1 className="hero-title">מה תחפשי היום?</h1>
            <p style={{ fontSize: '1.2rem', color: '#64748b' }}>הזני סגנון, מידה או פשוט בחרי תאריך מהיומן</p>
          </div>

          <div className="ai-search-container" style={{ marginBottom: '4rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Chat History Above Input */}
            {aiMessages.length > 1 && (
              <div style={{ padding: '20px', background: 'white', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', color: '#1e293b', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', color: '#8b5cf6', fontWeight: 'bold' }}>
                  <Sparkles size={18} /> העוזר החכם
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {aiMessages.slice(1).map((msg, idx) => {
                    let displayContent = msg.content;
                    let isoDateMatch = null;
                    if (typeof displayContent === 'string') {
                      const regex = /\[DATE:(\d{4}-\d{2}-\d{2})\]/;
                      const match = displayContent.match(regex);
                      if (match) {
                        isoDateMatch = match[1];
                        displayContent = displayContent.replace(regex, '').trim();
                      }
                    }
                    
                    return (
                      <div key={idx} style={{ 
                        alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                        background: msg.role === 'user' ? '#3b82f6' : '#f8fafc',
                        color: msg.role === 'user' ? 'white' : '#1e293b',
                        padding: '12px 16px', borderRadius: '12px', maxWidth: '85%'
                      }}>
                        <div>{displayContent}</div>
                        {msg.role === 'assistant' && isoDateMatch && (
                          <button 
                            onClick={() => {
                              setSelectedDate(new Date(`${isoDateMatch}T12:00:00`));
                              setStage(2);
                            }}
                            style={{ marginTop: '12px', background: '#ec4899', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold' }}
                          >
                            👉 הצג מלאי לתאריך {getHebrewDateString(new Date(`${isoDateMatch}T12:00:00`))}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
                {aiLoading && <div style={{ textAlign: 'center', marginTop: '1rem', color: '#8b5cf6', fontSize: '0.9rem' }}>מקליד...</div>}
              </div>
            )}

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

              {aiMessages.length > 1 && (
                <button 
                  onClick={() => setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }])}
                  title="נקה צ'אט"
                  style={{ 
                    background: '#fef2f2', color: '#ef4444', border: '1px solid #fecaca', 
                    borderRadius: '999px', height: '64px', padding: '0 24px', 
                    cursor: 'pointer', display: 'flex', alignItems: 'center', 
                    justifyContent: 'center', fontWeight: 'bold', whiteSpace: 'nowrap',
                    boxShadow: '0 4px 15px rgba(239, 68, 68, 0.1)'
                  }}
                >
                  חיפוש חדש
                </button>
              )}
            </div>
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
          <div className="glass-panel" style={{ padding: '24px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: '800', color: '#1e293b', margin: '0 0 8px 0' }}>קטלוג שמלות זמינות</h2>
              <div style={{ color: '#64748b', fontSize: '1.1rem' }}>
                לתאריך: <strong style={{ color: '#3b82f6' }}>{getHebrewDateString(new Date(selectedDate))}</strong> ({(new Date(selectedDate)).toLocaleDateString('he-IL')})
              </div>
            </div>
            
            {/* Embedded Calendar Mini */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '12px 24px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => setStage(1)}>
              <Calendar size={24} color="#64748b" />
              <span style={{ fontWeight: '600', color: '#475569' }}>שנה תאריך</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '16px' }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
              <Search size={20} color="#94a3b8" style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="text" 
                placeholder="חיפוש מודל חופשי (למשל: תחרה, 42)..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', padding: '14px 44px 14px 14px', borderRadius: '14px', border: '1px solid #cbd5e1', fontSize: '1rem', outline: 'none', transition: 'border-color 0.2s' }}
                onFocus={e => e.currentTarget.style.borderColor = '#3b82f6'}
                onBlur={e => e.currentTarget.style.borderColor = '#cbd5e1'}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', color: '#64748b' }}>
              <Loader2 size={48} className="animate-spin" style={{ color: '#3b82f6', marginBottom: '16px' }} />
              <span style={{ fontSize: '1.2rem' }}>טוען נתונים...</span>
            </div>
          ) : (
            <div className="modern-grid">
              {dresses.filter(d => {
                const term = search.toLowerCase();
                return (d.name || '').toLowerCase().includes(term) || (d.barcodePrefix && d.barcodePrefix.toString().includes(term));
              }).map(model => {
                
                // Group sizes
                const sizeMap = new Map();
                model.items?.forEach(item => {
                  if (item.notInUse || item.isDeleted) return;
                  const st = item.sizeText || 'כללי';
                  if (!sizeMap.has(st)) sizeMap.set(st, { available: 0, total: 0 });
                  const info = sizeMap.get(st);
                  info.total += 1;
                  if (item.quantity > 0) info.available += 1;
                });
                
                const sizesArray = Array.from(sizeMap.entries()).sort((a,b) => String(a[0]).localeCompare(String(b[0]), undefined, {numeric: true}));

                return (
                  <div key={model.id} className="dress-card" onClick={() => {
                    setSelectedModel(model);
                    setShowOrdersModal(true);
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
                            <div key={sName} className={`size-pill ${sData.available > 0 ? 'available' : ''}`} title={`${sData.available} פנויות מתוך ${sData.total}`}>
                              מידה {sName} ({sData.available})
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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
                      <div style={{ background: order.status === 'סגור' ? '#f1f5f9' : '#dbeafe', color: order.status === 'סגור' ? '#475569' : '#1e40af', padding: '6px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold' }}>
                        {order.status || 'פעיל'}
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
