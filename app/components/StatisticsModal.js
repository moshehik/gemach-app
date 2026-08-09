'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FormattedMessage from '../../components/FormattedMessage';
import { X, Send, MessageSquare, BarChart3 } from 'lucide-react';

export default function StatisticsModal({ isOpen, onClose, contextQuery, pageContext, position }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const chatEndRef = useRef(null);

  const sessionsStorageKey = `ai_statistics_chat_sessions_${pageContext || 'general'}`;

  const getGreeting = () => `שלום! אני עוזר הסטטיסטיקה של ${pageContext === 'orders' ? 'ההזמנות' : pageContext === 'customers' ? 'הלקוחות' : 'המערכת'}. שאל אותי שאלות על הנתונים (למשל: 'כמה הזמנות יש החודש?' או 'מה פילוח הלקוחות לפי ערים?').`;

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ role: 'assistant', content: getGreeting() }]);
      setActiveSessionId(null);

      let sessions = [];
      try {
        const saved = localStorage.getItem(sessionsStorageKey);
        if (saved) sessions = JSON.parse(saved);
      } catch (e) {}
      setChatSessions(sessions);
    }
  }, [isOpen, messages.length, pageContext]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const startNewChat = () => {
    if (messages.length > 1) {
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem(sessionsStorageKey, JSON.stringify(updatedSessions));
    }
    setMessages([{ role: 'assistant', content: getGreeting() }]);
    setActiveSessionId(null);
    setShowHistory(false);
  };

  const clearChat = async () => {
    if (await window.customConfirm('האם אתה בטוח שברצונך למחוק את השיחה הנוכחית?')) {
      setMessages([{ role: 'assistant', content: getGreeting() }]);
      setActiveSessionId(null);
      setShowHistory(false);
    }
  };

  const loadSession = (session) => {
    if (messages.length > 1 && !chatSessions.find(s => s.id === session.id)) {
      // eslint-disable-next-line react-hooks/purity -- runs inside the loadSession click handler, never during render
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem(sessionsStorageKey, JSON.stringify(updatedSessions));
    }
    setMessages(session.messages);
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
      
      const res = await fetch('/api/ai/statistics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMsg, 
          history: historyContext,
          contextQuery,
          pageContext
        }),
      });

      const data = await res.json();
      
      const assistantMessage = res.ok 
        ? { role: 'assistant', content: data.response }
        : { role: 'assistant', content: 'מצטער, חלה שגיאה בהפקת הסטטיסטיקה.' };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      try {
        const syncRes = await fetch('/api/ai/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: activeSessionId,
            context: `דוח AI - ${pageContext}`,
            messages: finalMessages
          })
        });
        const syncData = await syncRes.json();
        if (syncData.success && syncData.session && !activeSessionId) {
          setActiveSessionId(syncData.session.id);
        }
      } catch (err) {
        console.error('Failed to sync session', err);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const overlayStyle = {
    position: 'fixed',
    inset: 0,
    zIndex: 1100,
    display: 'flex',
    alignItems: position ? 'flex-start' : 'center',
    justifyContent: position ? 'flex-start' : 'center',
  };

  const modalStyle = {
    width: '90%',
    maxWidth: '600px',
    height: '80vh',
    maxHeight: '600px',
    display: 'flex',
    flexDirection: 'column',
    ...(position ? {
      position: 'absolute',
      margin: 0,
      top: `${Math.min(position.y, window.innerHeight - 620)}px`,
      // For RTL layout, clientX is from the left. But we might want it aligned. Let's just use left.
      // But if it overflows the right edge, we adjust it.
      left: `${Math.min(Math.max(20, position.x - 300), window.innerWidth - 620)}px`,
    } : {
      position: 'relative'
    })
  };

  const content = (
    <div className="modal-backdrop" onClick={onClose} style={overlayStyle}>
      <div className="modal animate-fade-in" onClick={e => e.stopPropagation()} style={modalStyle}>
        {/* Header */}
        <div className="modal-head">
          <strong>
            <BarChart3 className="icon" />
            סטטיסטיקות מתקדמות AI
          </strong>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={() => setShowHistory(!showHistory)}
              style={{ color: showHistory ? 'var(--accent)' : undefined }}
              title="היסטוריה"
              aria-label="היסטוריה"
            >
              <svg className="icon"><use href="#i-history" /></svg>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={startNewChat}
              title="חדש"
              aria-label="חדש"
            >
              <svg className="icon"><use href="#i-plus" /></svg>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={clearChat}
              title="מחק"
              aria-label="מחק"
            >
              <svg className="icon"><use href="#i-trash" /></svg>
            </button>
            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={onClose} title="סגירה" aria-label="סגירה">
              <X className="icon" />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
          {showHistory ? (
            <div style={{ padding: '10px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text)', fontSize: '1.1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>היסטוריית שיחות</h3>
              {messages.length > 1 && (
                <div
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
                    <div
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
                <div key={idx} className={`bubble ${msg.role}`} style={{ whiteSpace: 'pre-wrap' }}>
                  <FormattedMessage content={msg.content} />
                </div>
              ))}
              {loading && (
                <div className="bubble assistant" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div className="typing-indicator"><span></span><span></span><span></span></div>
                  מנתח נתונים...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="modal-foot" style={{ justifyContent: 'stretch' }}>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '8px', flex: 1 }}>
            <div className="input-icon-wrap" style={{ flex: 1 }}>
              <MessageSquare className="icon" />
              <input
                type="text"
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="שאל שאלה על הנתונים..."
                disabled={loading}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-icon-only" disabled={loading || !input.trim()} title="שליחה">
              <Send className="icon" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
