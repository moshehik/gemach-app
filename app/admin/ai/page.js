'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function AIPage() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTableModal, setShowTableModal] = useState(false);
  const [modalTableData, setModalTableData] = useState(null);

  const chatEndRef = useRef(null);

  const startNewChat = () => {
    const newId = Date.now().toString();
    const newThread = {
      id: newId,
      title: 'שיחה חדשה',
      messages: [{ role: 'assistant', content: 'שלום! אני מערכת ה-AI של הגמ"ח. כיצד אוכל לעזור לך היום?' }]
    };
    setThreads(prev => [newThread, ...prev]);
    setActiveThreadId(newId);
  };

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('ai_chat_threads');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.length > 0) {
          setThreads(parsed);
          setActiveThreadId(parsed[0].id);
        } else {
          startNewChat();
        }
      } catch (e) {
        startNewChat();
      }
    } else {
      startNewChat();
    }
  }, []);

  // Save to local storage when threads change
  useEffect(() => {
    if (threads.length > 0) {
      localStorage.setItem('ai_chat_threads', JSON.stringify(threads));
    }
  }, [threads]);

  // Scroll to bottom when messages change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threads, activeThreadId]);

  const activeThread = threads.find(t => t.id === activeThreadId) || { messages: [] };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessageContent = input.trim();
    setInput('');

    const currentThreadId = activeThreadId;
    const currentThread = threads.find(t => t.id === currentThreadId);
    if (!currentThread) return;

    const userMessage = { role: 'user', content: userMessageContent };

    // Update thread with user message
    setThreads(prev => prev.map(t => {
      if (t.id === currentThreadId) {
        // Auto-title on first user message
        const title = t.messages.length === 1 ? userMessageContent.slice(0, 30) + '...' : t.title;
        return { ...t, title, messages: [...t.messages, userMessage] };
      }
      return t;
    }));

    setLoading(true);

    try {
      const historyContext = currentThread.messages.map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMessageContent,
          history: historyContext,
          context: `התאריך היום הוא: ${new Date().toLocaleDateString('he-IL')}. אתה נמצא בממשק המנהל, ענה על כל שאלה סטטיסטית, פיננסית או ניהולית שהמנהל מבקש, כולל נתונים מדויקים מהמסד.`
        }),
      });

      const data = await res.json();

      const assistantMessage = res.ok
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: 'מצטער, חלה שגיאה בחיבור למערכת ה-AI.' };

      // Append strictly to the thread that initiated the request
      setThreads(prev => prev.map(t => {
        if (t.id === currentThreadId) {
          return { ...t, messages: [...t.messages, assistantMessage] };
        }
        return t;
      }));

    } catch (error) {
      setThreads(prev => prev.map(t => {
        if (t.id === currentThreadId) {
          return { ...t, messages: [...t.messages, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }] };
        }
        return t;
      }));
    } finally {
      setLoading(false);
    }
  };

  const deleteThread = (e, id) => {
    e.stopPropagation();
    const newThreads = threads.filter(t => t.id !== id);
    setThreads(newThreads);
    if (activeThreadId === id) {
      setActiveThreadId(newThreads.length > 0 ? newThreads[0].id : null);
      if (newThreads.length === 0) startNewChat();
    }
  };

  const renderTable = (tableData) => {
    if (!tableData || tableData.length === 0) return null;

    return (
      <div style={{ marginTop: '10px' }}>
        <button data-element-name="כפתור_page_1"
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => { setModalTableData(tableData); setShowTableModal(true); }}
        >
          <svg className="icon"><use href="#i-grid" /></svg>
          תצוגת נתונים
        </button>
      </div>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>עוזר AI למנהל</h1>
          <div className="page-desc">שאל שאלות על נתוני המערכת בשפה חופשית</div>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', overflow: 'hidden', height: '70vh' }}>

        {/* Threads sidebar */}
        <div style={{ width: '260px', flex: '0 0 auto', borderInlineStart: '1px solid var(--border)', background: 'var(--surface-alt)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <button data-element-name="כפתור_page_2"
              type="button"
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={startNewChat}
            >
              <svg className="icon"><use href="#i-plus" /></svg>
              שיחה חדשה
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {threads.map(t => (
              <div data-element-name="לחיץ_page_3"
                key={t.id}
                className="list-card"
                style={{
                  cursor: 'pointer',
                  ...(activeThreadId === t.id ? { background: 'var(--primary-tint)', borderColor: 'var(--primary-tint-2)' } : {})
                }}
                onClick={() => setActiveThreadId(t.id)}
              >
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}>
                  {t.title}
                </span>
                <button data-element-name="כפתור_page_4"
                  type="button"
                  className="icon-btn btn-sm"
                  title="מחק שיחה"
                  onClick={(e) => deleteThread(e, t.id)}
                >
                  <svg className="icon"><use href="#i-trash" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="chat-thread" style={{ flex: 1, overflowY: 'auto', padding: '20px', marginBottom: 0 }}>
            {activeThread.messages.map((msg, idx) => (
              <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
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

          <form onSubmit={sendMessage} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '16px', borderTop: '1px solid var(--border)', background: 'var(--surface-alt)' }}>
            <label htmlFor="admin-ai-message" style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>שאלה ל-AI</label>
            <input data-element-name="שדה_page_6"
              id="admin-ai-message"
              type="text"
              autoFocus
              className="input"
              style={{ flex: 1 }}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="שאל אותי על סטטיסטיקות או מידע מהמערכת (לדוגמה: כמה הזמנות יש בשנת 2024?)..."
              disabled={!activeThreadId}
            />
            <button data-element-name="כפתור_page_5"
              type="submit"
              className="btn btn-primary btn-icon-only"
              title="שלח"
              disabled={loading || !activeThreadId}
            >
              <svg className="icon"><use href="#i-arrow-end" /></svg>
            </button>
          </form>
        </div>

      </div>

      {/* Table Modal */}
      {showTableModal && modalTableData && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowTableModal(false)}>
          <div className="modal" style={{ maxWidth: '1100px', width: '90%', margin: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <strong>תצוגת נתונים ({modalTableData.length} שורות)</strong>
              <button data-element-name="כפתור_page_7"
                type="button"
                className="icon-btn btn-sm"
                title="סגירה"
                onClick={() => setShowTableModal(false)}
              >
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body" style={{ overflow: 'auto' }}>
              <div className="table-wrap">
                <table className="data">
                  <thead>
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
        </div>,
        document.body
      )}
    </>
  );
}
