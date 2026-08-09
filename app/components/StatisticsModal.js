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
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ 
        role: 'assistant', 
        content: `שלום! אני עוזר הסטטיסטיקה של ${pageContext === 'orders' ? 'ההזמנות' : pageContext === 'customers' ? 'הלקוחות' : 'המערכת'}. שאל אותי שאלות על הנתונים (למשל: 'כמה הזמנות יש החודש?' או 'מה פילוח הלקוחות לפי ערים?').` 
      }]);
      setActiveSessionId(null);
    }
  }, [isOpen, messages.length, pageContext]);

  useEffect(() => {
    if (isOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

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
          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={onClose} title="סגירה" aria-label="סגירה">
            <X className="icon" />
          </button>
        </div>

        {/* Chat Area */}
        <div className="modal-body" style={{ flex: 1, overflowY: 'auto' }}>
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
