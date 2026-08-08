'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function AIFloatingWidget({ hideAIFeatures = false }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showTableModal, setShowTableModal] = useState(false);
  const [modalTableData, setModalTableData] = useState(null);

  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);

  const recognitionRef = useRef(null);
  const chatEndRef = useRef(null);

  const parseMessageToLinks = (text) => {
    if (!text) return null;
    const parts = text.split(/(הזמנה\s*\d+|לקוח\s*[\w-]+)/g);
    return parts.map((part, i) => {
      let match = part.match(/הזמנה\s*(\d+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/orders/${match[1]}`}
            target="_blank"
            className="chip"
            style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)', border: 'none', fontWeight: 'bold', margin: '0 4px' }}
          >
            {part}
          </a>
        );
      }
      match = part.match(/לקוח\s*([\w-]+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/customers/${match[1]}`}
            target="_blank"
            className="chip"
            style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)', border: 'none', fontWeight: 'bold', margin: '0 4px' }}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  useEffect(() => {
    const savedSessions = localStorage.getItem('ai_employee_chat_sessions');
    let sessions = [];
    if (savedSessions) {
      try {
        sessions = JSON.parse(savedSessions);
      } catch (e) {}
    }

    const saved = localStorage.getItem('ai_employee_chat');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 1) {
          const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...parsed] };
          sessions = [newSession, ...sessions].slice(0, 10);
          localStorage.setItem('ai_employee_chat_sessions', JSON.stringify(sessions));
        }
      } catch (e) {}
    }

    setChatSessions(sessions);
    setMessages([{ role: 'assistant', content: 'שלום! אני עוזר ה-AI. כיצד אוכל לעזור לך למצוא נתונים במערכת?' }]);
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('ai_employee_chat', JSON.stringify(messages));
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const startNewChat = () => {
    if (messages.length > 1) {
      // Save current to sessions before clearing
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem('ai_employee_chat_sessions', JSON.stringify(updatedSessions));
    }
    setMessages([{ role: 'assistant', content: 'שלום! אני עוזר ה-AI. כיצד אוכל לעזור לך למצוא נתונים במערכת?' }]);
    setActiveSessionId(null);
    setShowHistory(false);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const historyContext = newMessages.map(m => ({ role: m.role, content: m.content }));

      let currentContext = '';
      if (pathname.includes('/orders/')) {
        const orderIdMatch = pathname.match(/\/orders\/(\d+|-)/);
        if (orderIdMatch) currentContext = `הלקוח נמצא כעת במסך כרטיס הזמנה מס' ${orderIdMatch[1]}. `;
      }

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg,
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. ${currentContext}אתה עוזר וירטואלי עבור עובדי הגמ"ח. מותר לך לספק נתונים על לקוחות, הזמנות, פריטים ומלאי כדי לעזור בשירות לקוחות. אסור לך לחשוף מידע על עובדים אחרים, משמרות או הרשאות. אסור לך להציג סטטיסטיקות כלליות, סיכומי רווחים, דוחות או פילוחים ניהוליים מתקדמים (אם העובד מבקש סטטיסטיקות כאלו, אמור לו שזה זמין רק בממשק מנהל).`
        }),
      });

      const data = await res.json();

      const assistantMessage = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'מצטער, חלה שגיאה בחיבור למערכת ה-AI.' };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Sync to DB
      try {
        let currentContext = 'כללי';
        if (pathname.includes('/orders/')) currentContext = 'הזמנות';
        else if (pathname.includes('/customers/')) currentContext = 'לקוחות';
        else if (pathname.includes('/employees/')) currentContext = 'עובדים';
        else if (pathname.includes('/dashboard')) currentContext = 'דשבורד';

        const syncRes = await fetch('/api/ai/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            context: currentContext,
            messages: finalMessages
          })
        });
        const syncData = await syncRes.json();
        if (syncData.success && syncData.session && !activeSessionId) {
          setActiveSessionId(syncData.session.id);
        }
      } catch (err) {
        console.warn('Failed to sync session:', err?.message || err);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (await window.customConfirm('האם אתה בטוח שברצונך לנקות את חלון השיחה?')) {
      startNewChat();
    }
  };

  const renderTable = (tableData) => {
    if (!tableData || tableData.length === 0) return null;
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button data-element-name="כפתור_AIFloatingWidget_1"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setModalTableData(tableData); setShowTableModal(true); }}
        >
          <svg className="icon"><use href="#i-grid" /></svg>
          הצג טבלה
        </button>
      </div>
    );
  };

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
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
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

  const loadSession = (session) => {
    if (messages.length > 1 && !chatSessions.find(s => s.id === session.id)) {
      // eslint-disable-next-line react-hooks/purity -- runs inside the loadSession click handler, never during render
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem('ai_employee_chat_sessions', JSON.stringify(updatedSessions));
    }
    setMessages(session.messages);
    setShowHistory(false);
  };

  if (pathname === '/customer-interface' || hideAIFeatures) {
    return null;
  }

  if (!isOpen) {
    return (
      <button data-element-name="כפתור_AIFloatingWidget_2"
        type="button"
        className="print-hide"
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          insetInlineEnd: '20px',
          width: '44px',
          height: '44px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--primary-solid)',
          color: 'var(--text-on-primary)',
          border: 'none',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 900,
          transition: 'transform 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        title="עוזר AI"
      >
        <svg data-element-name="רכיב_AIFloatingWidget_3" className="icon" style={{ width: '22px', height: '22px' }}>
          <use href="#i-star" />
        </svg>
      </button>
    );
  }

  return (
    <>
      <div className="print-hide card" style={{
        position: 'fixed',
        bottom: '80px',
        insetInlineEnd: '20px',
        width: isExpanded ? '600px' : '380px',
        height: isExpanded ? '80vh' : '550px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 40px)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 900,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        transition: 'all 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'var(--primary-solid)',
          color: 'var(--text-on-primary)',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg data-element-name="רכיב_AIFloatingWidget_4" className="icon" style={{ width: '20px', height: '20px' }}>
              <use href="#i-star" />
            </svg>
            <span style={{ fontWeight: 'bold' }}>עוזר AI</span>
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button data-element-name="כפתור_AIFloatingWidget_5"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => setShowHistory(!showHistory)}
              style={{ color: showHistory ? 'var(--accent)' : 'var(--text-on-primary)' }}
              title="היסטוריית שיחות"
            >
              <svg data-element-name="רכיב_AIFloatingWidget_6" className="icon"><use href="#i-history" /></svg>
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_7"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={clearChat}
              style={{ color: 'var(--text-on-primary)' }}
              title="שיחה חדשה"
            >
              <svg data-element-name="רכיב_AIFloatingWidget_8" className="icon"><use href="#i-plus" /></svg>
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_9"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => setIsExpanded(!isExpanded)}
              style={{ color: 'var(--text-on-primary)' }}
              title={isExpanded ? 'הקטן' : 'הגדל'}
            >
              {isExpanded ? (
                <svg data-element-name="רכיב_AIFloatingWidget_10" className="icon" style={{ transform: 'rotate(180deg)' }}><use href="#i-expand" /></svg>
              ) : (
                <svg data-element-name="רכיב_AIFloatingWidget_11" className="icon"><use href="#i-expand" /></svg>
              )}
            </button>
            <button data-element-name="כפתור_AIFloatingWidget_12"
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => setIsOpen(false)}
              style={{ color: 'var(--text-on-primary)' }}
              title="סגור"
            >
              <svg data-element-name="רכיב_AIFloatingWidget_13" className="icon"><use href="#i-x" /></svg>
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', backgroundColor: 'var(--surface-alt)', position: 'relative' }}>
          {showHistory ? (
            <div style={{ padding: '10px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text)', fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>היסטוריית שיחות</h3>
              {messages.length > 1 && (
                <div data-element-name="לחיץ_AIFloatingWidget_14"
                  onClick={() => setShowHistory(false)}
                  className="list-card"
                  style={{
                    background: 'var(--success-tint)', borderColor: 'var(--success)',
                    cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', gap: '4px',
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: 'var(--success)', fontSize: '0.9rem' }}>שיחה נוכחית (פעילה)</span>
                  <span style={{ color: 'var(--success)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {messages[1].content}
                  </span>
                </div>
              )}
              {chatSessions.length === 0 && messages.length <= 1 ? (
                <div style={{ color: 'var(--text-3)', fontSize: '0.9rem', marginTop: '10px' }}>אין היסטוריית שיחות שמורה.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {chatSessions.map((session) => (
                    <div data-element-name="לחיץ_AIFloatingWidget_15"
                      key={session.id}
                      onClick={() => loadSession(session)}
                      className="list-card"
                      style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'var(--text)', fontSize: '0.9rem' }}>{session.date}</span>
                      <span style={{ color: 'var(--text-3)', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.messages.length > 1 ? session.messages[1].content : 'שיחה ריקה'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="chat-thread">
              {messages.map((msg, idx) => (
                <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{parseMessageToLinks(msg.content)}</div>
                  {msg.tableData && renderTable(msg.tableData)}
                </div>
              ))}
              {loading && (
                <div className="bubble assistant" style={{ padding: 0 }}>
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} style={{
          display: 'flex',
          padding: '12px',
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          gap: '8px'
        }}>
          <button data-element-name="כפתור_AIFloatingWidget_16"
            type="button"
            onClick={toggleListen}
            className="icon-btn"
            style={{
              background: isListening ? 'var(--danger-solid)' : 'var(--surface-alt)',
              color: isListening ? 'var(--text-on-primary)' : 'var(--text)',
              borderColor: isListening ? 'var(--danger-solid)' : 'var(--border)',
              animation: isListening ? 'pulse 1.5s infinite' : 'none'
            }}
            title="הקלט הודעה"
          >
            <svg data-element-name="רכיב_AIFloatingWidget_17" className="icon"><use href="#i-mic" /></svg>
          </button>
          <input data-element-name="שדה_AIFloatingWidget_18"
            type="text"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל שאלה..."
            className="input"
            style={{ flex: 1, borderRadius: 'var(--radius-full)' }}
          />
          <button data-element-name="כפתור_AIFloatingWidget_19"
            type="submit"
            disabled={loading}
            className="btn btn-primary btn-icon-only"
            style={{ borderRadius: '50%' }}
          >
            <svg data-element-name="רכיב_AIFloatingWidget_20" className="icon"><use href="#i-chevron-start" /></svg>
          </button>
        </form>
      </div>

      {/* Table Modal */}
      {showTableModal && modalTableData && (
        <div className="modal-backdrop" style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal" style={{ maxWidth: 900, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-grid" /></svg>
                נתונים ({modalTableData.length} שורות)
              </strong>
              <button data-element-name="כפתור_AIFloatingWidget_21"
                type="button"
                className="btn btn-ghost btn-icon-only btn-sm"
                onClick={() => setShowTableModal(false)}
              >
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div style={{ padding: '18px 22px', overflow: 'auto', flex: 1 }}>
              <div className="table-wrap">
                <table className="data">
                  <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                    <tr>
                      {Object.keys(modalTableData[0]).map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modalTableData.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(modalTableData[0]).map(h => (
                          <td key={h}>{row[h]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
