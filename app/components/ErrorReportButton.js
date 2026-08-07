'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'new' or 'thread'
  const [userText, setUserText] = useState('');
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [reports, setReports] = useState([]);
  const [isProgrammer, setIsProgrammer] = useState(false);

  const [selectedReport, setSelectedReport] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // אין משתמש מחובר (עמדת לקוחות, דפי הדפסה) - הבקשה תמיד תחזיר 401, אז אחרי
  // הפעם הראשונה מפסיקים לגמרי כדי לא להציף את הקונסול כל 30 שניות.
  const authFailedRef = useRef(false);

  useEffect(() => {
    let intervalId;
    if (mounted && !isOpen) {
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
  }

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
      lastButtons: window.__lastButtons || [],
    };

    try {
      const res = await fetch('/api/error-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
        body: JSON.stringify({ reportId: selectedReport.id, text: replyText }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReplyText('');
        setSelectedReport(prev => ({ ...prev, replies: [...prev.replies, data.reply] }));
        fetchReports();
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
${report.lastButtons ? (Array.isArray(JSON.parse(report.lastButtons)) ? JSON.parse(report.lastButtons).map((b, i) => `${i + 1}. ${b}`).join('\n') : report.lastButtons) : 'אין מידע'}
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
    if ((isProgrammer && !report.isReadByProgrammer) || (!isProgrammer && !report.isReadByUser)) {
      setReports(prev => prev.map(r => r.id === report.id ? {
        ...r,
        isReadByProgrammer: isProgrammer ? true : r.isReadByProgrammer,
        isReadByUser: !isProgrammer ? true : r.isReadByUser,
      } : r));
    }
  };

  const unreadCount = reports.filter(r => (isProgrammer && !r.isReadByProgrammer) || (!isProgrammer && !r.isReadByUser)).length;

  return (
    <>
      <button
        type="button"
        className="icon-btn"
        onClick={() => { setIsOpen(true); setActiveTab('list'); fetchReports(); }}
        title="מערכת דיווחי שגיאות"
      >
        <svg className="icon"><use href="#i-alert-circle" /></svg>
        {unreadCount > 0 && <span className="dot" />}
      </button>

      {isOpen && mounted && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999999 }}>
          <div className="modal" style={{ maxWidth: 600, width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong><svg className="icon"><use href="#i-info" /></svg> מערכת תמיכה ושגיאות</strong>
              <div style={{ display: 'flex', gap: 6 }}>
                {activeTab === 'list' && (
                  <button type="button" className="btn btn-secondary btn-icon-only btn-sm" title="רענן" onClick={fetchReports}>
                    <svg className="icon"><use href="#i-refresh" /></svg>
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setIsOpen(false)}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </div>
            </div>

            {activeTab !== 'thread' && (
              <div className="tabs" style={{ margin: '0 22px' }}>
                <button type="button" className={`tab${activeTab === 'list' ? ' active' : ''}`} onClick={() => setActiveTab('list')}>
                  פניות שלי {isProgrammer ? '(כל הדיווחים)' : ''}
                </button>
                <button type="button" className={`tab${activeTab === 'new' ? ' active' : ''}`} onClick={() => setActiveTab('new')}>
                  דיווח על תקלה חדשה
                </button>
              </div>
            )}

            {activeTab === 'thread' && selectedReport && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveTab('list'); fetchReports(); }}>חזור לרשימה</button>
                  {isProgrammer && (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyDetails(selectedReport)}>
                      <svg className="icon"><use href="#i-link" /></svg>
                      העתק פרטי מערכת
                    </button>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="card card-pad" style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: 'var(--text-3)', fontSize: 12.5 }}>
                      <svg className="icon"><use href="#i-user" /></svg>
                      <strong>{selectedReport.employee ? selectedReport.employee.firstName + ' ' + selectedReport.employee.lastName : 'משתמש'}</strong>
                      <span>{getHebrewDateString(selectedReport.createdAt)} {new Date(selectedReport.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{selectedReport.userText}</p>
                  </div>

                  {selectedReport.replies && selectedReport.replies.map(reply => {
                    const isMe = (isProgrammer && reply.isProgrammer) || (!isProgrammer && !reply.isProgrammer);
                    return (
                      <div
                        key={reply.id}
                        className="card card-pad"
                        style={{
                          background: reply.isProgrammer ? 'var(--primary-tint)' : 'var(--surface)',
                          alignSelf: isMe ? 'flex-end' : 'flex-start',
                          maxWidth: '85%',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, color: reply.isProgrammer ? 'var(--primary-solid)' : 'var(--text-3)', fontSize: 12.5 }}>
                          <svg className="icon"><use href="#i-user" /></svg>
                          <strong>{reply.isProgrammer ? 'מתכנת מערכת' : (reply.employee ? reply.employee.firstName + ' ' + reply.employee.lastName : 'משתמש')}</strong>
                          <span>{getHebrewDateString(reply.createdAt)} {new Date(reply.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{reply.text}</p>
                      </div>
                    );
                  })}
                </div>

                <form onSubmit={handleReply} style={{ padding: 16, borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
                  <input
                    type="text"
                    className="input"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="הקלד תגובה..."
                    required
                  />
                  <button type="submit" className="btn btn-primary btn-icon-only" disabled={isReplying}>
                    <svg className="icon"><use href="#i-arrow-end" /></svg>
                  </button>
                </form>
              </div>
            )}

            {activeTab === 'list' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {reports.length === 0 ? (
                  <div className="empty-state">
                    <svg className="icon"><use href="#i-message" /></svg>
                    <p>אין דיווחים קיימים</p>
                  </div>
                ) : (
                  reports.map(report => {
                    const isUnread = (isProgrammer && !report.isReadByProgrammer) || (!isProgrammer && !report.isReadByUser);
                    return (
                      <div
                        key={report.id}
                        className="list-card"
                        onClick={() => openThread(report)}
                        style={{ cursor: 'pointer', flexDirection: 'column', alignItems: 'stretch', background: isUnread ? 'var(--primary-tint)' : 'var(--surface)' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            {isUnread && <span className="dot-badge" />}
                            {report.employee ? report.employee.firstName + ' ' + report.employee.lastName : 'משתמש'}
                          </strong>
                          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                            {getHebrewDateString(report.updatedAt)} {new Date(report.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 8px', color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{report.userText}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
                          <svg className="icon"><use href="#i-message" /></svg>
                          <span>{report.replies?.length || 0} תגובות</span>
                          {isProgrammer && <span>· מסך: {report.title || 'לא ידוע'}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {activeTab === 'new' && (
              <form onSubmit={handleSubmit} style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14, flex: 1, overflowY: 'auto' }}>
                <div className="callout callout-info">
                  <svg className="icon"><use href="#i-info" /></svg>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text)', marginBottom: 4 }}>הנתונים הבאים יישלחו למתכנת אוטומטית ברקע:</strong>
                    שעת הדיווח, כתובת המסך (URL), שם המסך, ו-5 הלחצנים האחרונים עליהם לחצת לפני שדיווחת.
                  </div>
                </div>

                <div className="field">
                  <label>תאר את התקלה בצורה המפורטת ביותר (מה ניסית לעשות, ומה קרה?):</label>
                  <textarea
                    className="textarea"
                    value={userText}
                    onChange={e => setUserText(e.target.value)}
                    placeholder="לדוגמה: לחצתי על כפתור השמירה, הופיעה שגיאה אדומה והדף קפא..."
                    style={{ height: 140 }}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 'auto', paddingTop: 10 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setActiveTab('list')}>ביטול</button>
                  <button type="submit" className="btn btn-primary">
                    <svg className="icon"><use href="#i-arrow-end" /></svg>
                    שליחה למתכנת
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}

      {toast && mounted && createPortal(
        <div className={`toast ${toast.type}`} style={{ position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)', zIndex: 9999999 }}>
          {toast.message}
        </div>,
        document.body
      )}
    </>
  );
}
