'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, Loader2, BarChart3 } from 'lucide-react';

export default function StatisticsModal({ isOpen, onClose, contextQuery, pageContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([{ 
        role: 'assistant', 
        content: `שלום! אני עוזר הסטטיסטיקה של ${pageContext === 'orders' ? 'ההזמנות' : pageContext === 'customers' ? 'הלקוחות' : 'המערכת'}. שאל אותי שאלות על הנתונים (למשל: 'כמה הזמנות יש החודש?' או 'מה פילוח הלקוחות לפי ערים?').` 
      }]);
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

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת עם השרת.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div 
        className="modal-content animate-fade-in" 
        onClick={e => e.stopPropagation()} 
        style={{ 
          width: '90%', 
          maxWidth: '600px', 
          height: '80vh', 
          display: 'flex', 
          flexDirection: 'column', 
          padding: 0,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
        }}
      >
        {/* Header */}
        <div style={{ 
          padding: '1.2rem', 
          background: 'linear-gradient(135deg, #10b981, #059669)', 
          color: 'white', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', padding: '0.5rem', borderRadius: '50%' }}>
              <BarChart3 size={24} />
            </div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold' }}>סטטיסטיקות מתקדמות AI</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {messages.map((msg, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '0.5rem'
            }}>
              {msg.role === 'assistant' && (
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
                  <Bot size={18} />
                </div>
              )}
              <div style={{ 
                maxWidth: '75%', 
                padding: '0.8rem 1.2rem', 
                borderRadius: '16px',
                borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderTopLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                background: msg.role === 'user' ? '#10b981' : 'white',
                color: msg.role === 'user' ? 'white' : '#1e293b',
                boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap'
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', gap: '0.5rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}>
                <Bot size={18} />
              </div>
              <div style={{ padding: '0.8rem 1.2rem', borderRadius: '16px', borderTopLeftRadius: '4px', background: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b' }}>
                <Loader2 size={16} className="animate-spin" /> מנתח נתונים...
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '1rem', background: 'white', borderTop: '1px solid #e2e8f0' }}>
          <form onSubmit={sendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="שאל שאלה על הנתונים..."
              disabled={loading}
              style={{ 
                flex: 1, 
                padding: '0.8rem 1rem', 
                borderRadius: '24px', 
                border: '1px solid #cbd5e1',
                outline: 'none',
                fontSize: '1rem',
                backgroundColor: '#f8fafc'
              }}
            />
            <button 
              type="submit" 
              disabled={loading || !input.trim()}
              style={{ 
                width: '45px', 
                height: '45px', 
                borderRadius: '50%', 
                background: input.trim() && !loading ? '#10b981' : '#cbd5e1', 
                color: 'white', 
                border: 'none', 
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                transition: 'background 0.2s'
              }}
            >
              <Send size={20} style={{ transform: 'translateX(-2px)' }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
