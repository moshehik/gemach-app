'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import FormattedMessage from '../../components/FormattedMessage';
import { downloadRowsAsXlsx } from '../../lib/xlsxExport';
// 2026-10-11: החלון בעיצוב הכהה של פלטת האתר (אותו #dlg / #scrim כמו חלוניות עוזר ה-AI): .gm-ds.gm-no.dlg-dark ב-portal ל-body, כך שהוא כהה בכל
// הדפים שמארחים אותו (חדשים וישנים). אין lucide ואין customConfirm / alert של הדפדפן - אישור המחיקה והודעת השגיאה הם חלוניות כהות (שכבה 2).
import '@/design-system/components.css';
import './new-order/css/new-order-font.css';
import './new-order/css/new-order.css';
import './ai-widget/ai-dialogs.css';
import './statistics-modal.css';
import { ConfirmDialog, DialogFrame, MessageDialog } from './new-order/NoDialogs';
import { Ic } from './new-order/NoUi';
import { MenuSprite } from './menu/menuParts';

// שורות הנתונים שהסוכן מחזיר (רשימת הזמנות/לקוחות וכו') - מוצגות כטבלה מתחת לתשובה.
// עד 2026-09-20 הסוכן החזיר טקסט בלבד, והמשתמשת שאלה "איפה הרשימה?" וביקשה הורדה לאקסל.
const stripRows = (msgs) => msgs.map(({ role, content }) => ({ role, content }));

function formatCell(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'כן' : 'לא';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' });
  }
  return String(v);
}

function downloadCsv(rows) {
  const cols = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
  const esc = (v) => `"${formatCell(v).replace(/"/g, '""')}"`;
  const csv = [cols.map(c => `"${c.replace(/"/g, '""')}"`).join(',')]
    .concat(rows.map(r => cols.map(c => esc(r[c])).join(','))).join('\r\n');
  // BOM כדי שאקסל יקרא עברית נכון
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `נתונים-${new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function downloadXlsx(rows, onError) {
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  return downloadRowsAsXlsx(rows, `נתונים-${day}`, { sheetName: 'נתונים' })
    .catch(() => { if (onError) onError('לא הצלחתי ליצור את קובץ האקסל. אפשר להוריד CSV במקום.'); });
}

function ResultTable({ rows, onError }) {
  const cols = Object.keys(rows[0]).filter(k => !k.startsWith('_'));
  const hasAction = rows.some(r => r._actionUrl);
  const shown = rows.slice(0, 100);
  return (
    <div className="stm-res">
      <div className="stm-tbl">
        <table className="rtbl">
          <thead>
            <tr>
              {cols.map(c => <th key={c}>{c}</th>)}
              {hasAction && <th />}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {cols.map(c => <td key={c}>{formatCell(r[c])}</td>)}
                {hasAction && <td>{r._actionUrl ? <a href={r._actionUrl} target="_blank" rel="noreferrer">{r._actionLabel || 'פתיחה'}</a> : null}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stm-res-f">
        <span>{rows.length} שורות{rows.length > shown.length ? ` (מוצגות ${shown.length} הראשונות)` : ''}</span>
        <button type="button" className="btn sm" data-guide-id="stat.ai-xlsx" onClick={() => downloadXlsx(rows, onError)}><Ic n="download" c="sm" />הורדה לאקסל (XLSX)</button>
        <button type="button" className="btn ghost sm" onClick={() => downloadCsv(rows)}>CSV</button>
      </div>
    </div>
  );
}

export default function StatisticsModal({ isOpen, onClose, contextQuery, pageContext, position }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [notice, setNotice] = useState(null);
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
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: stripRows(messages) };
      const updatedSessions = [newSession, ...chatSessions].slice(0, 10);
      setChatSessions(updatedSessions);
      localStorage.setItem(sessionsStorageKey, JSON.stringify(updatedSessions));
    }
    setMessages([{ role: 'assistant', content: getGreeting() }]);
    setActiveSessionId(null);
    setShowHistory(false);
  };

  // אישור מחיקה: חלון כהה (שכבה 2) במקום window.customConfirm
  const clearChat = () => setConfirmClear(true);
  const closeClearConfirm = (yes) => {
    setConfirmClear(false);
    if (yes === true) {
      setMessages([{ role: 'assistant', content: getGreeting() }]);
      setActiveSessionId(null);
      setShowHistory(false);
    }
  };

  const loadSession = (session) => {
    if (messages.length > 1 && !chatSessions.find(s => s.id === session.id)) {
      // eslint-disable-next-line react-hooks/purity -- runs inside the loadSession click handler, never during render
      const newSession = { id: Date.now(), date: new Date().toLocaleString('he-IL'), messages: stripRows(messages) };
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
        ? { role: 'assistant', content: data.response, rows: Array.isArray(data.data) && data.data.length > 0 ? data.data : undefined }
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
            messages: stripRows(finalMessages)
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

  // Escape: סוגר קודם את חלון האישור/ההודעה (שכבה 2), ואחר כך את החלון
  const escRef = useRef(null);
  useEffect(() => { escRef.current = () => { if (confirmClear) setConfirmClear(false); else if (notice) setNotice(null); else onClose(); }; });
  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (escRef.current) escRef.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen]);

  if (!isOpen) return null;

  // position נשמר ב-API (קוראים ישנים מעבירים אותו) אבל החלון הכהה תמיד ממורכז, כמו כל חלוניות האתר.
  const content = (
    <div className="gm-ds gm-no dlg-dark ai-dlg-root stm-root" dir="rtl">
      <MenuSprite />
      <DialogFrame layer={1} cls="stm-dlg" onBackdrop={onClose}>
        <div className="stm-tools">
          <button type="button" className={`btn ghost sm icon${showHistory ? ' on' : ''}`} onClick={() => setShowHistory(!showHistory)} title="היסטוריה" aria-label="היסטוריה" data-guide-id="stat.ai-history" aria-pressed={showHistory}><Ic n="sn-history" /></button>
          <button type="button" className="btn ghost sm icon" onClick={startNewChat} title="שיחה חדשה" aria-label="שיחה חדשה" data-guide-id="stat.ai-new-chat"><Ic n="plus" /></button>
          <button type="button" className="btn ghost sm icon" onClick={clearChat} title="מחיקת השיחה" aria-label="מחיקת השיחה"><Ic n="trash" /></button>
          <button type="button" className="btn ghost sm icon" onClick={onClose} title="סגירה" aria-label="סגירה"><Ic n="x" /></button>
        </div>
        <div className="dbadge" aria-hidden="true"><Ic n="sn-chart" /></div>
        <h2 data-guide-id="stat.ai-modal">סטטיסטיקות מתקדמות AI</h2>

        <div className="stm-body">
          {showHistory ? (
            <div className="stm-hist">
              <h3>היסטוריית שיחות</h3>
              {messages.length > 1 && (
                <button type="button" onClick={() => setShowHistory(false)} className="stm-card cur">
                  <b>שיחה נוכחית (פעילה)</b>
                  <span>{messages[1].content}</span>
                </button>
              )}
              {chatSessions.length === 0 && messages.length <= 1 ? (
                <div className="stm-empty">אין היסטוריית שיחות שמורה.</div>
              ) : (
                chatSessions.map((session) => (
                  <button type="button" key={session.id} onClick={() => loadSession(session)} className="stm-card">
                    <b>{session.date}</b>
                    <span>{session.messages.length > 1 ? session.messages[1].content : 'שיחה ריקה'}</span>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="stm-thread">
              {messages.map((msg, idx) => (
                <div key={idx} className={`stm-b ${msg.role}`}>
                  <FormattedMessage content={msg.content} />
                  {msg.rows && <ResultTable rows={msg.rows} onError={(t) => setNotice(t)} />}
                </div>
              ))}
              {loading && (
                <div className="stm-b assistant stm-typing">
                  <span className="stm-dots"><i /><i /><i /></span>
                  מנתח נתונים...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        <form className="stm-form" onSubmit={sendMessage}>
          <input
            type="text"
            className="inp"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="שאל שאלה על הנתונים..."
            aria-label="שאלה על הנתונים" data-guide-id="stat.ai-input"
            disabled={loading}
            data-autofocus
          />
          <button type="submit" className="btn primary icon" disabled={loading || !input.trim()} title="שליחה" aria-label="שליחה"><Ic n="send" /></button>
        </form>
      </DialogFrame>
      {confirmClear ? (
        <DialogFrame layer={2} onBackdrop={() => setConfirmClear(false)}>
          <ConfirmDialog title="מחיקת השיחה" message="האם אתה בטוח שברצונך למחוק את השיחה הנוכחית?" ok="מחק שיחה" cancel="ביטול" close={closeClearConfirm} />
        </DialogFrame>
      ) : null}
      {notice ? (
        <DialogFrame layer={2} onBackdrop={() => setNotice(null)}>
          <MessageDialog title="הודעה" message={notice} close={() => setNotice(null)} />
        </DialogFrame>
      ) : null}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}
