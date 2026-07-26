'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, X, MessageSquare, Maximize2, Minimize2, MessageSquarePlus, Mic, History } from 'lucide-react';
import { usePathname } from 'next/navigation';

export default function AIFloatingWidget() {
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
    const parts = text.split(/(׳”׳–׳׳ ׳”\s*\d+|׳׳§׳•׳—\s*[\w-]+)/g);
    return parts.map((part, i) => {
      let match = part.match(/׳”׳–׳׳ ׳”\s*(\d+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/orders/${match[1]}`}
            target="_blank"
            style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ec4899', color: 'white', padding: '2px 8px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', margin: '0 4px', fontSize: '0.9rem' }}
          >
            {part}
          </a>
        );
      }
      match = part.match(/׳׳§׳•׳—\s*([\w-]+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/customers/${match[1]}`}
            target="_blank"
            style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ec4899', color: 'white', padding: '2px 8px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', margin: '0 4px', fontSize: '0.9rem' }}
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
    setMessages([{ role: 'assistant', content: '׳©׳׳•׳! ׳׳ ׳™ ׳¢׳•׳–׳¨ ׳”-AI. ׳›׳™׳¦׳“ ׳׳•׳›׳ ׳׳¢׳–׳•׳¨ ׳׳ ׳׳׳¦׳•׳ ׳ ׳×׳•׳ ׳™׳ ׳‘׳׳¢׳¨׳›׳×?' }]);
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
    setMessages([{ role: 'assistant', content: '׳©׳׳•׳! ׳׳ ׳™ ׳¢׳•׳–׳¨ ׳”-AI. ׳›׳™׳¦׳“ ׳׳•׳›׳ ׳׳¢׳–׳•׳¨ ׳׳ ׳׳׳¦׳•׳ ׳ ׳×׳•׳ ׳™׳ ׳‘׳׳¢׳¨׳›׳×?' }]);
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
        if (orderIdMatch) currentContext = `׳”׳׳§׳•׳— ׳ ׳׳¦׳ ׳›׳¢׳× ׳‘׳׳¡׳ ׳›׳¨׳˜׳™׳¡ ׳”׳–׳׳ ׳” ׳׳¡' ${orderIdMatch[1]}. `;
      }
      
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          prompt: userMsg, 
          history: historyContext,
          context: `׳”׳×׳׳¨׳™׳ ׳”׳™׳•׳ ׳”׳•׳: ${new Date().toLocaleDateString('he-IL')}. ${currentContext}׳׳×׳” ׳¢׳•׳–׳¨ ׳•׳™׳¨׳˜׳•׳׳׳™ ׳¢׳‘׳•׳¨ ׳¢׳•׳‘׳“׳™ ׳”׳’׳"׳—. ׳׳•׳×׳¨ ׳׳ ׳׳¡׳₪׳§ ׳ ׳×׳•׳ ׳™׳ ׳¢׳ ׳׳§׳•׳—׳•׳×, ׳”׳–׳׳ ׳•׳×, ׳₪׳¨׳™׳˜׳™׳ ׳•׳׳׳׳™ ׳›׳“׳™ ׳׳¢׳–׳•׳¨ ׳‘׳©׳™׳¨׳•׳× ׳׳§׳•׳—׳•׳×. ׳׳¡׳•׳¨ ׳׳ ׳׳—׳©׳•׳£ ׳׳™׳“׳¢ ׳¢׳ ׳¢׳•׳‘׳“׳™׳ ׳׳—׳¨׳™׳, ׳׳©׳׳¨׳•׳× ׳׳• ׳”׳¨׳©׳׳•׳×. ׳׳¡׳•׳¨ ׳׳ ׳׳”׳¦׳™׳’ ׳¡׳˜׳˜׳™׳¡׳˜׳™׳§׳•׳× ׳›׳׳׳™׳•׳×, ׳¡׳™׳›׳•׳׳™ ׳¨׳•׳•׳—׳™׳, ׳“׳•׳—׳•׳× ׳׳• ׳₪׳™׳׳•׳—׳™׳ ׳ ׳™׳”׳•׳׳™׳™׳ ׳׳×׳§׳“׳׳™׳ (׳׳ ׳”׳¢׳•׳‘׳“ ׳׳‘׳§׳© ׳¡׳˜׳˜׳™׳¡׳˜׳™׳§׳•׳× ׳›׳׳׳•, ׳׳׳•׳¨ ׳׳• ׳©׳–׳” ׳–׳׳™׳ ׳¨׳§ ׳‘׳׳׳©׳§ ׳׳ ׳”׳).`
        }),
      });

      const data = await res.json();
      
      const assistantMessage = res.ok 
        ? { role: 'assistant', content: data.response, tableData: data.tableData }
        : { role: 'assistant', content: '׳׳¦׳˜׳¢׳¨, ׳—׳׳” ׳©׳’׳™׳׳” ׳‘׳—׳™׳‘׳•׳¨ ׳׳׳¢׳¨׳›׳× ׳”-AI.' };

      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);
      
      // Sync to DB
      try {
        let currentContext = '׳›׳׳׳™';
        if (pathname.includes('/orders/')) currentContext = '׳”׳–׳׳ ׳•׳×';
        else if (pathname.includes('/customers/')) currentContext = '׳׳§׳•׳—׳•׳×';
        else if (pathname.includes('/employees/')) currentContext = '׳¢׳•׳‘׳“׳™׳';
        else if (pathname.includes('/dashboard')) currentContext = '׳“׳©׳‘׳•׳¨׳“';

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
        console.error('Failed to sync session', err);
      }

    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: '׳©׳’׳™׳׳× ׳×׳§׳©׳•׳¨׳× ׳¢׳ ׳”׳©׳¨׳×.' }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (await window.customConfirm('׳”׳׳ ׳׳×׳” ׳‘׳˜׳•׳— ׳©׳‘׳¨׳¦׳•׳ ׳ ׳׳ ׳§׳•׳× ׳׳× ׳—׳׳•׳ ׳”׳©׳™׳—׳”?')) {
      startNewChat();
    }
  };

  const renderTable = (tableData) => {
    if (!tableData || tableData.length === 0) return null;
    return (
      <div style={{ marginTop: '0.5rem' }}>
        <button 
          type="button"
          onClick={() => { setModalTableData(tableData); setShowTableModal(true); }}
          style={{
            padding: '0.4rem 0.8rem',
            backgroundColor: '#059669',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem'
          }}
        >
          <span>נ“</span> ׳”׳¦׳’ ׳˜׳‘׳׳”
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
      alert("׳”׳“׳₪׳“׳₪׳ ׳©׳׳ ׳׳™׳ ׳• ׳×׳•׳׳ ׳‘׳”׳§׳׳˜׳× ׳§׳•׳.");
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
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: [...messages] };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem('ai_employee_chat_sessions', JSON.stringify(updatedSessions));
    }
    setMessages(session.messages);
    setShowHistory(false);
  };

  if (pathname === '/customer-interface') {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed',
          bottom: '80px',
          left: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '30px',
          backgroundColor: 'var(--primary-color, #4338ca)',
          color: 'white',
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          cursor: 'pointer',
          zIndex: 900,
          transition: 'transform 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        title="׳¢׳•׳–׳¨ AI"
      >
        <Bot size={32} />
      </button>
    );
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        bottom: '80px',
        left: '20px',
        width: isExpanded ? '600px' : '380px',
        height: isExpanded ? '80vh' : '550px',
        maxWidth: 'calc(100vw - 40px)',
        maxHeight: 'calc(100vh - 40px)',
        backgroundColor: 'var(--card-bg)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 900,
        overflow: 'hidden',
        border: '1px solid var(--element-border)',
        transition: 'all 0.3s ease'
      }}>
        {/* Header */}
        <div style={{
          backgroundColor: 'var(--primary-color, #4338ca)',
          color: 'white',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={20} />
            <span style={{ fontWeight: 'bold' }}>׳¢׳•׳–׳¨ AI</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => setShowHistory(!showHistory)} style={{ background: 'none', border: 'none', color: showHistory ? '#fcd34d' : 'white', cursor: 'pointer', opacity: 0.9 }} title="׳”׳™׳¡׳˜׳•׳¨׳™׳™׳× ׳©׳™׳—׳•׳×">
              <History size={18} />
            </button>
            <button onClick={clearChat} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title="׳©׳™׳—׳” ׳—׳“׳©׳”">
              <MessageSquarePlus size={18} />
            </button>
            <button onClick={() => setIsExpanded(!isExpanded)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title={isExpanded ? '׳”׳§׳˜׳' : '׳”׳’׳“׳'}>
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.8 }} title="׳¡׳’׳•׳¨">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', backgroundColor: 'var(--element-bg)', position: 'relative' }}>
          {showHistory ? (
            <div style={{ padding: '10px' }}>
              <h3 style={{ marginTop: 0, color: 'var(--text-main)', fontSize: '1.1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '8px' }}>׳”׳™׳¡׳˜׳•׳¨׳™׳™׳× ׳©׳™׳—׳•׳×</h3>
              {messages.length > 1 && (
                <div 
                  onClick={() => setShowHistory(false)}
                  style={{
                    padding: '12px', backgroundColor: '#ecfdf5', border: '1px solid #10b981',
                    borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px',
                    marginBottom: '10px'
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: '#065f46', fontSize: '0.9rem' }}>׳©׳™׳—׳” ׳ ׳•׳›׳—׳™׳× (׳₪׳¢׳™׳׳”)</span>
                  <span style={{ color: '#047857', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {messages[1].content}
                  </span>
                </div>
              )}
              {chatSessions.length === 0 && messages.length <= 1 ? (
                <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '10px' }}>׳׳™׳ ׳”׳™׳¡׳˜׳•׳¨׳™׳™׳× ׳©׳™׳—׳•׳× ׳©׳׳•׳¨׳”.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                  {chatSessions.map((session) => (
                    <div 
                      key={session.id} 
                      onClick={() => loadSession(session)}
                      style={{
                        padding: '12px', backgroundColor: 'var(--card-bg)', border: '1px solid var(--element-border)',
                        borderRadius: '8px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '4px'
                      }}
                      onMouseOver={e => e.currentTarget.style.borderColor = '#6366f1'}
                      onMouseOut={e => e.currentTarget.style.borderColor = '#e5e7eb'}
                    >
                      <span style={{ fontWeight: 'bold', color: '#1f2937', fontSize: '0.9rem' }}>{session.date}</span>
                      <span style={{ color: '#6b7280', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {session.messages.length > 1 ? session.messages[1].content : '׳©׳™׳—׳” ׳¨׳™׳§׳”'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => (
                <div key={idx} style={{
                  alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end',
                  backgroundColor: msg.role === 'user' ? 'var(--primary-color, #4338ca)' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1f2937',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  maxWidth: '85%',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderBottomRightRadius: msg.role === 'user' ? '0' : '12px',
                  borderBottomLeftRadius: msg.role === 'assistant' ? '0' : '12px',
                  fontSize: '0.95rem',
                  lineHeight: '1.4'
                }}>
                  <div style={{ whiteSpace: 'pre-wrap' }}><FormattedMessage content={msg.content} /></div>
                  {msg.tableData && renderTable(msg.tableData)}
                </div>
              ))}
              {loading && (
                <div style={{
                  alignSelf: 'flex-end',
                  backgroundColor: 'var(--card-bg)',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  borderBottomLeftRadius: '0',
                  fontStyle: 'italic',
                  color: '#6b7280',
                  fontSize: '0.9rem',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                }}>
                  ׳׳¢׳‘׳“ ׳ ׳×׳•׳ ׳™׳...
                </div>
              )}
              <div ref={chatEndRef} />
            </>
          )}
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} style={{
          display: 'flex',
          padding: '12px',
          borderTop: '1px solid #e5e7eb',
          backgroundColor: 'var(--card-bg)',
          gap: '8px'
        }}>
          <button 
            type="button" 
            onClick={toggleListen}
            style={{
              background: isListening ? '#ef4444' : 'var(--element-bg)', 
              color: isListening ? 'white' : 'var(--text-main)', 
              border: 'none', borderRadius: '50%', width: '42px', height: '42px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
              animation: isListening ? 'pulse 1.5s infinite' : 'none'
            }}
            title="׳”׳§׳׳˜ ׳”׳•׳“׳¢׳”"
          >
            <Mic size={20} />
          </button>
          <input 
            type="text" 
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="׳©׳׳ ׳©׳׳׳”..."
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: '20px',
              border: '1px solid #d1d5db',
              outline: 'none',
              fontSize: '0.95rem',
              fontFamily: 'inherit'
            }}
          />
          <button 
            type="submit" 
            disabled={loading}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '21px',
              border: 'none',
              backgroundColor: 'var(--primary-color, #4338ca)',
              color: 'white',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              opacity: loading ? 0.7 : 1
            }}>
            <MessageSquare size={18} />
          </button>
        </form>
      </div>

      {/* Table Modal */}
      {showTableModal && modalTableData && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 100000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '12px',
            padding: '20px',
            width: '90%',
            maxWidth: '900px',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--primary-color)' }}>׳ ׳×׳•׳ ׳™׳ ({modalTableData.length} ׳©׳•׳¨׳•׳×)</h3>
              <button 
                onClick={() => setShowTableModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, borderRadius: '6px', border: '1px solid var(--element-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--element-bg)', zIndex: 1 }}>
                  <tr>
                    {Object.keys(modalTableData[0]).map(h => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'right', borderBottom: '2px solid #e5e7eb', color: 'var(--text-main)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {modalTableData.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: i % 2 === 0 ? 'var(--card-bg)' : 'var(--element-bg)' }}>
                      {Object.keys(modalTableData[0]).map(h => (
                        <td key={h} style={{ padding: '8px 12px', color: '#1f2937' }}>{row[h]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
