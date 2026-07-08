'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { HDate } from '@hebcal/core';
import { getHebrewDateString, getHebrewMonthYear } from '@/lib/hebrewDate';
import { RefreshCw, Printer, Lock, Maximize, Bot, Mic, History } from 'lucide-react';

export default function CustomerInventoryViewer() {
  const router = useRouter();
  const [dresses, setDresses] = useState([]);
  const [loading, setLoading] = useState(true);
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
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ענה אך ורק לשאלות שקשורות להזמנות, מלאי, מחירים ותיקונים עבור לקוחות. אסור לך בשום אופן למסור מידע ניהולי (כמו סטטיסטיקות, רווחים, הכנסות, נתוני עובדים או מידע על לקוחות אחרים). אם הלקוח שואל שאלות לא קשורות או מבקש מידע חסוי, התנצל בנימוס ואמור שאין לך הרשאה לספק מידע זה ושהנך כאן רק לעזור בכל הקשור להזמנות השמלות של הלקוח.`
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
    
    // First day of Hebrew month
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
            {["א","ב","ג","ד","ה","ו","ש"].map(d => <th key={d}>{d}</th>)}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, i) => (
            <tr key={i}>
              {week.map((day, j) => {
                if (!day) return <td key={j}></td>;
                
                const cellHDate = new HDate(day, hMonth, hYear);
                const cellGreg = cellHDate.greg();
                
                const isSelected = cellGreg.toDateString() === selectedDate.toDateString();
                const isToday = cellGreg.toDateString() === new Date().toDateString();
                
                let hebrewDayStr = day;
                try {
                  hebrewDayStr = cellHDate.renderGematriya().split(' ')[0];
                } catch(e) {}
                
                return (
                  <td 
                    key={j} 
                    className={`${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                    onClick={() => setSelectedDate(cellGreg)}
                  >
                    <div style={{fontSize: '0.8em', color: '#999'}}>{cellGreg.getDate()}/{cellGreg.getMonth() + 1}</div>
                    <div>{hebrewDayStr}</div>
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
      return <div style={{padding:'20px', textAlign:'center', color:'#999'}}>בחר דגם לצפייה</div>;
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
      return <div style={{padding:'20px', textAlign:'center', color:'#999'}}>אין נתונים לדגם זה</div>;
    }

    return (
      <div className="sizes-container" data-total-items={totalSizesItems} data-total-sizes={sizesArr.length}>
        {sizesArr.map(item => (
          <div key={item.name} className="size-box animate-fade-in">
            <div className="size-title">{item.name}</div>
            <div className="qty-row">
              {item.qOther > 0 ? <div className="qty-dot q-dark" style={{width:'auto', padding:'0 10px', borderRadius:'15px'}}>{item.qOther}</div> : <div className="qty-dot q-zero">-</div>}
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
    <div style={{ fontSize: '16px', padding: '20px' }} className="customer-inventory">
      {isLocked && (
        <style dangerouslySetInnerHTML={{__html: `
          .navbar { display: none !important; }
          .customer-inventory { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 9999; margin: 0; border-radius: 0; overflow-y: auto; }
        `}} />
      )}
      {showUnlockModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl'
        }}>
          <div style={{
            background: 'white', padding: '30px', borderRadius: '12px', width: '400px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <h2 style={{ fontSize: '24px', marginBottom: '20px', textAlign: 'center', color: '#2c3e50' }}>שחרור מסך</h2>
            <form onSubmit={handleUnlock}>
              {unlockError && <div style={{ color: 'red', marginBottom: '10px', textAlign: 'center', fontSize: '14px' }}>{unlockError}</div>}
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#7f8c8d' }}>שם עובד</label>
                <select 
                  value={unlockEmployee}
                  onChange={(e) => setUnlockEmployee(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bdc3c7' }}
                >
                  <option value="">-- בחר עובד --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>
              
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '5px', color: '#7f8c8d' }}>סיסמא</label>
                <input 
                  type="password"
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #bdc3c7' }}
                  placeholder="הזן סיסמא..."
                />
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="submit" 
                  disabled={unlockLoading}
                  style={{ flex: 1, padding: '10px', background: '#3498db', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {unlockLoading ? 'בודק...' : 'שחרר'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setShowUnlockModal(false)}
                  style={{ flex: 1, padding: '10px', background: '#ecf0f1', color: '#7f8c8d', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  ביטול
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style dangerouslySetInnerHTML={{__html: `
        .customer-inventory { background-color: #f3f4f6; min-height: calc(100vh - 64px); display: flex; flex-direction: column; }
        
        .app-header { 
          background: linear-gradient(to left, #2c3e50, #3498db); 
          color: white; padding: 15px 20px; 
          border-radius: 12px;
          box-shadow: 0 4px 6px rgba(0,0,0,0.1); 
          margin-bottom: 20px;
          display: flex; align-items: center; justify-content: space-between; 
        }
        .header-title { font-size: 24px; font-weight: 300; }
        .header-btn { background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 8px 16px; border-radius: 20px; cursor: pointer; transition: all 0.3s; font-size: 15px; margin-left: 10px; }
        .header-btn:hover { background: white; color: #3498db; }
        
        .btn-primary { color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: bold; }
        .btn-primary:hover { opacity: 0.9; }

        .main-wrapper { flex-grow: 1; display: flex; gap: 20px; flex-wrap: wrap; }
        .col { display: flex; flex-direction: column; flex: 1; min-width: 300px; }
        .col.cal { flex: 0.75; }
        
        .card { background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; margin-bottom: 20px; }
        .card-header { padding: 15px; border-bottom: 1px solid #f0f0f0; font-size: 18px; font-weight: 600; background: #fbfbfb; color: #374151; display: flex; justify-content: space-between; align-items: center; }
        
        .card-body { padding: 0; overflow-y: auto; flex-grow: 1; min-height: 400px; max-height: calc(100vh - 300px); scrollbar-width: thin; }
        
        .card-footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 15px; font-size: 14px; font-weight: bold; color: #475569; display: flex; align-items: center; justify-content: space-between; }
        
        .date-navigator { display: flex; align-items: center; gap: 15px; color: #3498db; font-weight: bold; font-size: 20px; }
        .nav-arrow { cursor: pointer; user-select: none; width: 30px; height: 30px; line-height: 30px; text-align: center; border-radius: 50%; transition: background 0.2s; }
        .nav-arrow:hover { background: #e0f2fe; }
        .toolbar { display: flex; gap: 5px; align-items: center; }
        .search-input { padding: 6px 10px; border: 1px solid #ccc; border-radius: 15px; width: 140px; font-size: 14px; outline: none; }
        .btn-sort { background: white; border: 1px solid #ccc; cursor: pointer; padding: 6px 10px; border-radius: 4px; font-size: 14px; }
        
        .cal-nav { cursor: pointer; color: #3498db; font-weight: bold; font-size: 24px; padding: 0 10px; user-select: none; }
        .cal-table { width: 100%; border-collapse: collapse; text-align: center; }
        .cal-table th { color: #9ca3af; font-size: 14px; padding: 10px 0; border-bottom: 1px solid #eee; }
        .cal-table td { height: 55px; border-bottom: 1px solid #f9fafb; cursor: pointer; position: relative; font-size: 16px; }
        .cal-table td:hover { background: #f0f9ff; color: #0284c7; }
        .cal-table td.today { font-weight: bold; color: #3498db; }
        .cal-table td.selected { background: #3498db; color: white; border-radius: 8px; }
        
        .list-item { padding: 15px 20px; border-bottom: 1px solid #f3f4f6; cursor: pointer; display: flex; align-items: center; justify-content: space-between; transition: background 0.2s; }
        .list-item:hover { background: #f9fafb; }
        .list-item.active { background: #eff6ff; border-right: 6px solid #3498db; }
        .item-name { font-weight: 600; font-size: 18px; display: block; }
        
        .badges-group { display: flex; gap: 4px; justify-content: flex-end; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-weight: bold; font-size: 13px; color: white; text-align: center; }
        .badge.zero { background: #e5e7eb; color: #9ca3af; } 
        .b-dark { background-color: #4b5563; } 
        
        .sizes-container { padding: 15px; text-align: center; }
        .size-box { display: inline-block; background: white; border: 1px solid #e5e7eb; border-radius: 8px; width: 120px; margin: 10px; box-shadow: 0 3px 6px rgba(0,0,0,0.08); overflow: hidden; vertical-align: top; cursor: default; transition: transform 0.2s; }
        .size-box:hover { transform: scale(1.05); }
        .size-title { background: #f9fafb; padding: 10px 0; font-weight: bold; font-size: 18px; border-bottom: 1px solid #eee; color: #333; }
        .qty-row { display: flex; justify-content: center; padding: 12px 2px; gap: 6px; background: #fff; }
        .qty-dot { line-height: 30px; font-size: 14px; font-weight: bold; color: white; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); }
        .q-dark { background-color: #4b5563; }
        .q-zero { background-color: #e5e7eb; color: #ccc; box-shadow: none; width: 30px; height: 30px; border-radius: 50%; }

        .legend { font-size: 12px; display: flex; gap: 8px; margin-right: 10px; }
        .legend span { display: flex; align-items: center; gap: 3px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
        
        .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 32px; height: 32px; animation: spin 0.8s linear infinite; margin: 15px auto; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        .listening-pulse { animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.2); opacity: 0.8; } 100% { transform: scale(1); opacity: 1; } }

        @media print { 
          .navbar, .app-header, .main-wrapper { display: none !important; } 
          body { background: white; overflow: visible !important; height: auto; } 
          #printArea { display: block !important; padding: 20px; font-family: 'Segoe UI', serif; } 
        }
        #printArea { display: none; }
        .print-title { font-size: 28px; font-weight: bold; border-bottom: 2px solid #333; margin-bottom: 10px; }
        .print-sizes { display: flex; flex-wrap: wrap; gap: 20px; }
      `}} />

      {/* Hidden Print Area */}
      <div id="printArea">
        <div className="print-title" id="printModelTitle">דוח מלאי: {selectedModel?.name}</div>
        <div className="print-date" id="printDateStr">תאריך: {getHebrewDateString(selectedDate)}</div>
        <div id="printContent" className="print-sizes">
          {renderSizes()}
        </div>
      </div>

      {/* The App Header */}
      <div className="app-header">
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="header-btn" onClick={fetchInventory} title="רענון" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }}><RefreshCw size={20} /></button>
          <button className="header-btn" onClick={handlePrint} title="הדפס דוח" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }}><Printer size={20} /></button>
          {isLocked ? (
            <button className="header-btn" style={{ background: '#e74c3c', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }} onClick={() => setShowUnlockModal(true)} title="שחרור מסך"><Lock size={20} /></button>
          ) : (
            <button className="header-btn" onClick={() => {
              setIsLocked(true);
              if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen().catch(err => console.warn(err));
              }
            }} title="תפיסת מסך" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', padding: 0 }}><Maximize size={20} /></button>
          )}
        </div>
        <div 
          className="header-title" 
          onDoubleClick={() => {
            setIsLocked(false);
            if (document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen().catch(err => console.warn(err));
            }
          }} 
          title={isLocked ? "לחיצה כפולה לשחרור חירום" : ""}
          style={{ cursor: isLocked ? 'pointer' : 'default' }}
        >
          ניהול מלאי
        </div>
      </div>

      {/* Main Content Layout */}
      <div className="main-wrapper">
        {/* Right Column: Calendar */}
        <div className="col cal">
          <div className="card">
            <div className="card-header">
              <span className="cal-nav" onClick={() => changeMonth(-1)}>&gt;</span>
              <span className="cal-nav" onClick={() => changeMonth(1)}>&lt;</span>
              <span id="calTitle" style={{float: 'left', direction: 'ltr'}}>{currentMonthYear}</span>
            </div>
            <div className="card-body" id="calBody">
              {renderCalendar()}
              {loading && <div id="loadingSpinner" className="spinner" style={{display: 'block'}}></div>}
            </div>
          </div>
        </div>

        {/* Middle Column: Models List */}
        <div className="col">
          <div className="card">
            <div className="card-header">
              <div className="date-navigator">
                <span className="nav-arrow" onClick={() => changeDay(1)}>&gt;</span>
                <span id="headerDate">{getHebrewDateString(selectedDate)}</span>
                <span className="nav-arrow" onClick={() => changeDay(-1)}>&lt;</span>
              </div>
              <div className="toolbar">
                <input 
                  type="text" 
                  className="search-input" 
                  placeholder="חפש דגם..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <button className="btn-sort" id="btnSort" onClick={() => setSortAsc(!sortAsc)}>
                  {sortAsc ? 'א-ת' : 'ת-א'}
                </button>
              </div>
            </div>
            <div className="card-body" id="modelsList">
              {loading ? (
                <div style={{padding:'20px', textAlign:'center', color:'#999'}}>טוען נתונים...</div>
              ) : filteredDresses.length === 0 ? (
                <div style={{padding:'20px', textAlign:'center'}}>אין תוצאות</div>
              ) : (
                filteredDresses.map(model => {
                  const { qOther } = getModelQuantities(model);
                  const safeName = model.name;
                  
                  return (
                    <div 
                      key={model.id} 
                      className={`list-item ${selectedModel?.id === model.id ? 'active' : ''}`}
                      onClick={() => setSelectedModel(model)}
                    >
                      <div style={{flexGrow: 1}}>
                        <span className="item-name">{safeName}</span>
                        <span style={{fontSize:'12px', color:'#999'}}>{model.barcodePrefix || model.id}</span>
                      </div>
                      <div className="badges-group">
                        <span className={`badge ${qOther > 0 ? 'b-dark' : 'zero'}`} title="כמות כללית">{qOther}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="card-footer" id="modelsFooter">
              <span>סה״כ דגמים: {filteredDresses.length}</span>
              <span>פריטים: {grandTotalItems}</span>
            </div>
          </div>
        </div>

        {/* Left Column: Sizes */}
        <div className="col">
          <div className="card">
            <div className="card-header">
              <span>זמינות מידות</span>
              <div className="legend">
                <span><span className="legend-dot q-dark"></span>כמות כללית</span>
              </div>
            </div>
            <div className="card-body" id="sizesList">
              {renderSizes()}
            </div>
            <div className="card-footer" id="sizesFooter">
              <span>סה״כ מידות: {sizesCount}</span>
              <span>פריטים: {itemsInSizesCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating AI Button */}
      <button 
        onClick={() => setAiChatOpen(!aiChatOpen)}
        title="עוזר AI למלאי"
        style={{
          position: 'fixed', bottom: '30px', left: '30px', zIndex: 10000,
          width: '60px', height: '60px', borderRadius: '30px',
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: 'white', border: 'none',
          boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'transform 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Bot size={32} />
      </button>

      {/* AI Chat Pane */}
      {aiChatOpen && (
        <div style={{
          position: 'fixed', bottom: '100px', left: '30px', zIndex: 10000,
          width: '400px', height: '550px', backgroundColor: 'white',
          borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #e5e7eb'
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(to left, #6366f1, #8b5cf6)',
            color: 'white', padding: '15px 20px', fontWeight: 'bold',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Bot size={24} />
              <span>עוזר AI למלאי</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <button 
                onClick={() => setShowAiHistory(!showAiHistory)} 
                style={{ background: 'none', border: 'none', color: showAiHistory ? '#fcd34d' : 'white', cursor: 'pointer', fontSize: '18px' }}
                title="היסטוריית שיחות"
              >
                <History size={18} />
              </button>
              <button 
                onClick={startNewAiChat} 
                style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '15px', padding: '4px 10px', color: 'white', cursor: 'pointer', fontSize: '12px' }}
                title="התחל שיחה חדשה"
              >
                שיחה חדשה
              </button>
              <button onClick={() => setAiChatOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '20px' }}>×</button>
            </div>
          </div>
          
          {/* Messages */}
          <div style={{ flex: 1, padding: '15px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#f9fafb', position: 'relative' }}>
            {showAiHistory ? (
              <div style={{ padding: '5px' }}>
                <h3 style={{ marginTop: 0, color: '#374151', fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>היסטוריית שיחות</h3>
                {aiChatSessions.length === 0 ? (
                  <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '10px' }}>אין היסטוריית שיחות שמורה.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    {aiChatSessions.map((session) => (
                      <div 
                        key={session.id} 
                        onClick={() => loadAiSession(session)}
                        style={{
                          padding: '12px', backgroundColor: 'white', border: '1px solid #e5e7eb',
                          borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px'
                        }}
                        onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}
                        onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                      >
                        <span style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '0.9rem' }}>{session.date}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {session.messages.length > 1 ? session.messages[1].content : 'שיחה ריקה'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                {aiMessages.map((msg, idx) => (
                  <div key={idx} style={{
                    alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                    backgroundColor: msg.role === 'user' ? '#3b82f6' : 'white',
                    color: msg.role === 'user' ? 'white' : '#1f2937',
                    padding: '10px 15px', borderRadius: '12px', maxWidth: '90%',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                    borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '12px',
                    border: msg.role === 'assistant' ? '1px solid #e5e7eb' : 'none'
                  }}>
                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: '1.4' }}>{msg.content}</div>
                    {msg.tableData && msg.tableData.length > 0 && (
                       <div style={{ marginTop: '10px', overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse', backgroundColor: 'white' }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6' }}>
                                {Object.keys(msg.tableData[0]).map(h => <th key={h} style={{ padding: '6px', textAlign: 'right', borderBottom: '1px solid #e5e7eb' }}>{h}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.tableData.map((row, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                  {Object.keys(msg.tableData[0]).map(h => <td key={h} style={{ padding: '6px' }}>{row[h]}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                       </div>
                    )}
                  </div>
                ))}
                {aiLoading && (
                  <div style={{ alignSelf: 'flex-end', backgroundColor: 'white', padding: '10px 15px', borderRadius: '12px', borderBottomLeftRadius: '0', border: '1px solid #e5e7eb', fontSize: '14px', color: '#6b7280' }}>
                    <span className="spinner" style={{ width: '12px', height: '12px', margin: '0 0 0 8px', display: 'inline-block', verticalAlign: 'middle', borderTopColor: '#3b82f6', borderWidth: '2px' }}></span>
                    מעבד נתונים...
                  </div>
                )}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Input */}
          <form onSubmit={handleAiSubmit} style={{
            display: 'flex', padding: '10px', borderTop: '1px solid #e5e7eb', backgroundColor: 'white', gap: '8px'
          }}>
            <button 
              type="button" 
              onClick={toggleListen}
              style={{
                background: isListening ? '#ef4444' : '#f3f4f6', 
                color: isListening ? 'white' : '#4b5563', 
                border: 'none', borderRadius: '50%', width: '40px', height: '40px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0
              }}
              title="הקלט הודעה"
            >
              <Mic size={20} className={isListening ? 'listening-pulse' : ''} />
            </button>
            <input 
              type="text" autoFocus value={aiInput} onChange={e => setAiInput(e.target.value)}
              placeholder="שמלה שיש לתאריך X במידות בערך 4,6..."
              style={{ flex: 1, padding: '10px 15px', borderRadius: '20px', border: '1px solid #d1d5db', outline: 'none', fontSize: '14px' }}
            />
            <button type="submit" disabled={aiLoading || !aiInput.trim()} style={{
              background: '#3b82f6', color: 'white', border: 'none', borderRadius: '20px', padding: '0 15px',
              cursor: (aiLoading || !aiInput.trim()) ? 'default' : 'pointer', opacity: (aiLoading || !aiInput.trim()) ? 0.5 : 1,
              fontWeight: 'bold'
            }}>שלח</button>
          </form>
        </div>
      )}

    </div>
  );
}
