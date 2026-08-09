'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LifeBuoy, X, Send, MessageSquare, Copy, AlertCircle, Info, User, Check, RefreshCw } from 'lucide-react';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'new' or 'thread'
  const [userText, setUserText] = useState('');
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);
  
  const [reports, setReports] = useState([]);
  const [isProgrammer, setIsProgrammer] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [selectedReport, setSelectedReport] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // אין משתמש מחובר (עמדת לקוחות, דפי הדפסה) - הבקשה תמיד תחזיר 401, אז אחרי
  // הפעם הראשונה מפסיקים לגמרי כדי לא להציף את הקונסול כל 30 שניות. התחברות
  // ממילא טוענת את העמוד מחדש, כך שהרענון יחזור לפעול אחריה.
  const authFailedRef = useRef(false);

  // Auto-refresh interval
  useEffect(() => {
    let intervalId;
    if (mounted && !isOpen) {
      // Refresh badge every 30 seconds when closed
      intervalId = setInterval(fetchReports, 30000);
    }
    return () => clearInterval(intervalId);
  }, [mounted, isOpen]);

  useEffect(() => {
    setMounted(true);
    fetchReports();

    const handleGlobalClick = (e) => {
      let target = e.target;
      while (target && target !== document.body) {
        if (target.tagName === 'BUTTON' || target.getAttribute('role') === 'button' || (target.tagName === 'A' && (target.classList?.contains('btn') || target.classList?.contains('button')))) {
          let btnText = target.innerText || target.textContent || target.title || target.getAttribute('aria-label') || 'כפתור ללא טקסט';
          btnText = btnText.trim().substring(0, 50).replace(/\n/g, ' ');
          if (btnText) {
            window.__lastButtons = window.__lastButtons || [];
            window.__lastButtons.push(btnText);
            if (window.__lastButtons.length > 5) {
              window.__lastButtons.shift();
            }
          }
          break;
        }
        target = target.parentElement;
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);
  
  useEffect(() => {
    if (isOpen && activeTab === 'list') {
      fetchReports();
    }
  }, [isOpen, activeTab]);

  async function fetchReports() {
    if (authFailedRef.current) return;
    try {
      const res = await fetch('/api/error-report');
      if (res.status === 401) {
        authFailedRef.current = true;
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setReports(data.reports || []);
          setIsProgrammer(data.isProgrammer || false);
        }
      }
    } catch (err) {
      console.error('Error fetching reports:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userText.trim()) {
      showToast('יש להזין תיאור שגיאה', 'error');
      return;
    }

    showToast('שולח דיווח למתכנת, אנא המתן...', 'info');

    const payload = {
      userText,
      url: window.location.href,
      title: document.title,
      time: getHebrewDateString(new Date()) + ' ' + new Date().toLocaleTimeString('he-IL'),
      queryParams: window.location.search || 'אין',
      lastButtons: window.__lastButtons || []
    };

    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast('הדיווח נשלח בהצלחה למתכנת! תודה.', 'success');
        setUserText('');
        setActiveTab('list');
        fetchReports();
      } else {
        showToast(data.error || 'שגיאה בשליחת דיווח', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    }
  };
  
  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedReport) return;
    
    setIsReplying(true);
    try {
      const res = await fetch('/api/error-report/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportId: selectedReport.id,
          text: replyText
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReplyText('');
        // Update local state to show new reply instantly
        setSelectedReport(prev => ({
          ...prev,
          replies: [...prev.replies, data.reply]
        }));
        fetchReports(); // refresh list behind the scenes
      } else {
        showToast(data.error || 'שגיאה בשליחת תגובה', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
    } finally {
      setIsReplying(false);
    }
  };

  const copyDetails = (report) => {
    const details = `
מאת: ${report.employee ? report.employee.firstName + ' ' + report.employee.lastName : 'לא ידוע'}
זמן: ${report.time || (getHebrewDateString(report.createdAt) + ' ' + new Date(report.createdAt).toLocaleTimeString('he-IL'))}
חלון/דף: ${report.title || 'לא צוין'}
כתובת URL: ${report.url || 'לא צוין'}
שאילתות/פרמטרים: ${report.queryParams || 'אין'}
תיאור התקלה:
${report.userText}

לחצנים אחרונים:
${report.lastButtons ? (Array.isArray(JSON.parse(report.lastButtons)) ? JSON.parse(report.lastButtons).map((b,i)=>`${i+1}. ${b}`).join('\n') : report.lastButtons) : 'אין מידע'}
    `.trim();
    
    navigator.clipboard.writeText(details).then(() => {
      showToast('הפרטים הועתקו ללוח!', 'success');
    });
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };
  
  const openThread = (report) => {
    setSelectedReport(report);
    setActiveTab('thread');
    
    // Mark as read locally immediately if needed
    if ((isProgrammer && !report.isReadByProgrammer) || (!isProgrammer && !report.isReadByUser)) {
      setReports(prev => prev.map(r => r.id === report.id ? { 
        ...r, 
        isReadByProgrammer: isProgrammer ? true : r.isReadByProgrammer,
        isReadByUser: !isProgrammer ? true : r.isReadByUser
      } : r));
    }
  };
  
  const unreadCount = reports.filter(r => (isProgrammer && !r.isReadByProgrammer) || (!isProgrammer && !r.isReadByUser)).length;

  return (
    <>
      <button data-element-name="כפתור_ErrorReportButton_1" 
        onClick={() => {
          setIsOpen(true);
          setActiveTab('list');
          fetchReports();
        }}
        title="מערכת דיווחי שגיאות"
        className="icon-nav-link"
      >
        <LifeBuoy data-element-name="רכיב_ErrorReportButton_2" size={20} />
        {unreadCount > 0 && (
          <span className="nav-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 999999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          direction: 'rtl',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            background: 'var(--card-bg)',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '85vh',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#eef2ff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#4338ca', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
                  <LifeBuoy data-element-name="רכיב_ErrorReportButton_3" size={22} /> מערכת תמיכה ושגיאות
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {activeTab === 'list' && (
                  <button onClick={fetchReports} title="רענן" style={{ background: 'white', border: '1px solid #c7d2fe', borderRadius: '8px', padding: '0.4rem', cursor: 'pointer', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <RefreshCw size={16} />
                  </button>
                )}
                <button data-element-name="כפתור_ErrorReportButton_4" onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6366f1', display: 'flex', alignItems: 'center' }}>
                  <X data-element-name="רכיב_ErrorReportButton_5" size={24} />
                </button>
              </div>
            </div>
            
            {/* Header Tabs */}
            {activeTab !== 'thread' && (
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
                <button 
                  onClick={() => setActiveTab('list')}
                  style={{ flex: 1, padding: '1rem', background: activeTab === 'list' ? 'transparent' : 'var(--element-bg)', border: 'none', borderBottom: activeTab === 'list' ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === 'list' ? '#6366f1' : 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
                >
                  פניות שלי {isProgrammer ? '(כל הדיווחים)' : ''}
                </button>
                <button 
                  onClick={() => setActiveTab('new')}
                  style={{ flex: 1, padding: '1rem', background: activeTab === 'new' ? 'transparent' : 'var(--element-bg)', border: 'none', borderBottom: activeTab === 'new' ? '2px solid #6366f1' : '2px solid transparent', color: activeTab === 'new' ? '#6366f1' : 'var(--text-muted)', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}
                >
                  דיווח על תקלה חדשה
                </button>
              </div>
            )}
            
            {/* THREAD VIEW */}
            {activeTab === 'thread' && selectedReport && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '0.75rem 1.5rem', background: 'var(--element-bg)', borderBottom: '1px solid var(--element-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button onClick={() => { setActiveTab('list'); fetchReports(); }} style={{ background: 'var(--card-bg)', border: '1px solid var(--element-border)', padding: '0.3rem 0.8rem', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-muted)', fontWeight: '600', fontSize: '0.85rem' }}>
                    חזור לרשימה
                  </button>
                  {isProgrammer && (
                    <button onClick={() => copyDetails(selectedReport)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--element-bg)', border: '1px solid var(--element-border)', padding: '0.3rem 0.8rem', borderRadius: '8px', cursor: 'pointer', color: 'var(--text-main)', fontWeight: '600', fontSize: '0.85rem' }}>
                      <Copy size={14} /> העתק פרטי מערכת
                    </button>
                  )}
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--element-bg)' }}>
                  {/* Original Report */}
                  <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--element-border)', alignSelf: 'flex-start', maxWidth: '85%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <User size={14} /> <strong>{selectedReport.employee ? selectedReport.employee.firstName + ' ' + selectedReport.employee.lastName : 'משתמש'}</strong>
                      <span>•</span>
                      <span>{getHebrewDateString(selectedReport.createdAt)} {new Date(selectedReport.createdAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                      {selectedReport.userText}
                    </p>
                  </div>
                  
                  {/* Replies */}
                  {selectedReport.replies && selectedReport.replies.map(reply => {
                    const isMe = (isProgrammer && reply.isProgrammer) || (!isProgrammer && !reply.isProgrammer);
                    return (
                      <div key={reply.id} style={{ 
                        background: reply.isProgrammer ? '#eef2ff' : 'var(--card-bg)', 
                        padding: '1rem', 
                        borderRadius: '12px', 
                        border: `1px solid ${reply.isProgrammer ? '#c7d2fe' : 'var(--element-border)'}`, 
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '85%' 
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: reply.isProgrammer ? '#4338ca' : 'var(--text-muted)', fontSize: '0.85rem' }}>
                          <User size={14} /> <strong>{reply.isProgrammer ? 'מתכנת מערכת' : (reply.employee ? reply.employee.firstName + ' ' + reply.employee.lastName : 'משתמש')}</strong>
                          <span>•</span>
                          <span>{getHebrewDateString(reply.createdAt)} {new Date(reply.createdAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                          {reply.text}
                        </p>
                      </div>
                    );
                  })}
                </div>
                
                {/* Reply Form */}
                <form onSubmit={handleReply} style={{ padding: '1rem', background: 'var(--card-bg)', borderTop: '1px solid var(--element-border)', display: 'flex', gap: '0.75rem' }}>
                  <input 
                    type="text" 
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="הקלד תגובה..."
                    style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '999px', border: '1px solid var(--element-border)', outline: 'none', background: 'var(--element-bg)', fontSize: '0.95rem' }}
                    required
                  />
                  <button 
                    type="submit"
                    disabled={isReplying}
                    style={{ background: '#6366f1', color: 'white', border: 'none', width: '45px', height: '45px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: isReplying ? 'not-allowed' : 'pointer', opacity: isReplying ? 0.7 : 1 }}
                  >
                    <Send size={18} style={{ transform: 'rotate(180deg) translateX(2px)' }} />
                  </button>
                </form>
              </div>
            )}
            
            {/* LIST VIEW */}
            {activeTab === 'list' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--element-bg)' }}>
                {reports.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 0' }}>
                    <MessageSquare size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.1rem' }}>אין דיווחים קיימים</p>
                  </div>
                ) : (
                  reports.map(report => {
                    const isUnread = (isProgrammer && !report.isReadByProgrammer) || (!isProgrammer && !report.isReadByUser);
                    return (
                      <div key={report.id} onClick={() => openThread(report)} style={{
                        background: isUnread ? '#eef2ff' : 'var(--card-bg)',
                        border: `1px solid ${isUnread ? '#c7d2fe' : 'var(--element-border)'}`,
                        borderRadius: '12px',
                        padding: '1.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {isUnread && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6366f1', display: 'inline-block' }} />}
                            {report.employee ? report.employee.firstName + ' ' + report.employee.lastName : 'משתמש'}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {getHebrewDateString(report.updatedAt)} {new Date(report.updatedAt).toLocaleTimeString('he-IL', {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 0.75rem 0', color: 'var(--text-muted)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {report.userText}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <MessageSquare size={14} />
                          <span>{report.replies?.length || 0} תגובות</span>
                          {isProgrammer && (
                            <>
                              <span style={{ margin: '0 0.5rem' }}>|</span>
                              <span>מסך: {report.title || 'לא ידוע'}</span>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
            
            {/* NEW REPORT VIEW */}
            {activeTab === 'new' && (
              <form onSubmit={handleSubmit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', background: 'var(--element-bg)', flex: 1, overflowY: 'auto' }}>
                <div style={{ background: 'var(--card-bg)', padding: '1rem', borderRadius: '12px', border: '1px solid var(--element-border)', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                  <Info color="#6366f1" size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.25rem' }}>הנתונים הבאים יישלחו למתכנת אוטומטית ברקע:</strong>
                    שעת הדיווח, כתובת המסך (URL), שם המסך, ו-5 הלחצנים האחרונים עליהם לחצת לפני שדיווחת.
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem', color: 'var(--text-main)', fontWeight: '600' }}>
                    תאר את התקלה בצורה המפורטת ביותר (מה ניסית לעשות, ומה קרה?):
                  </label>
                  <textarea data-element-name="טקסט_ErrorReportButton_6"
                    value={userText}
                    onChange={e => setUserText(e.target.value)}
                    className="form-control"
                    placeholder="לדוגמה: לחצתי על כפתור השמירה, הופיעה שגיאה אדומה והדף קפא..."
                    style={{ width: '100%', height: '140px', padding: '1rem', borderRadius: '12px', border: '1px solid var(--element-border)', background: 'var(--card-bg)', color: 'var(--text-main)', resize: 'none', fontSize: '1rem' }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: 'auto', paddingTop: '1rem' }}>
                  <button data-element-name="כפתור_ErrorReportButton_7" 
                    type="button"
                    onClick={() => setActiveTab('list')}
                    style={{ background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--element-border)', padding: '0.6rem 1.25rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
                  >
                    ביטול
                  </button>
                  <button data-element-name="כפתור_ErrorReportButton_8" 
                    type="submit"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#6366f1', color: 'white', border: 'none', padding: '0.6rem 1.5rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)' }}
                  >
                    <Send data-element-name="רכיב_ErrorReportButton_9" size={16} /> שליחה למתכנת
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'success' ? '#10b981' : '#3b82f6',
          color: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontWeight: '500',
          direction: 'rtl',
          animation: 'fadeInDown 0.3s ease-out'
        }}>
          {toast.message}
        </div>,
        document.body
      )}
    </>
  );
}
