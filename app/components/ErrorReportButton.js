'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function ErrorReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'archive' or 'new' or 'thread'
  const [userText, setUserText] = useState('');
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [reports, setReports] = useState([]);
  const [isProgrammer, setIsProgrammer] = useState(false);

  const [selectedReport, setSelectedReport] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // סימון אלמנט בעמוד — "מצב איתור": המודל נסגר זמנית, כל קליק בעמוד
  // נחסם ונאסף כתיאור האלמנט במקום להפעיל את הפעולה האמיתית שלו.
  const [isPicking, setIsPicking] = useState(false);
  const [pickedElements, setPickedElements] = useState([]);
  const [hoverRect, setHoverRect] = useState(null);
  const hoveredElRef = useRef(null);
  // 'new' = טופס דיווח חדש (pickedElements, כמו קודם), 'reply' = תגובה בתוך
  // שרשור קיים (מוסיף ישירות לטקסט התגובה) - כדי שאיתור אלמנטים יעבוד גם
  // כשעונים על דיווח פתוח, לא רק בהודעה הראשונה.
  const pickingContextRef = useRef('new');

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
    if (isOpen && (activeTab === 'list' || activeTab === 'archive')) {
      fetchReports();
    }
  }, [isOpen, activeTab]);

  const describeElement = (el) => {
    if (!el) return null;
    const tag = el.tagName ? el.tagName.toLowerCase() : 'אלמנט';
    const text = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60);
    const idPart = el.id ? `#${el.id}` : '';
    const classNames = (typeof el.className === 'string' ? el.className : '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
    const classPart = classNames.length ? `.${classNames.join('.')}` : '';
    const selector = `${tag}${idPart}${classPart}`;
    const label = text ? `${selector} — "${text}"` : selector;
    return { selector, text, label };
  };

  // מצב איתור אלמנט: המודל סגור בזמן שהמצב פעיל, כך שהמשתמש רואה ולוחץ על
  // העמוד האמיתי. הקליק נתפס בשלב ה-capture ונחסם כדי שלא יפעיל את האלמנט עצמו.
  useEffect(() => {
    if (!isPicking) return;

    const handleMove = (e) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (el && el !== hoveredElRef.current) {
        hoveredElRef.current = el;
        setHoverRect(el.getBoundingClientRect());
      }
    };
    const stopPicking = () => {
      setIsPicking(false);
      setIsOpen(true);
      // בתגובה לשרשור קיים נשארים על אותה חלונית 'thread' (selectedReport כבר
      // מוגדר); בדיווח חדש חוזרים לטופס 'new' כמו קודם.
      setActiveTab(pickingContextRef.current === 'reply' ? 'thread' : 'new');
      setHoverRect(null);
    };
    const handleClick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const el = hoveredElRef.current || e.target;
      const described = describeElement(el);
      if (described) {
        if (pickingContextRef.current === 'reply') {
          setReplyText(prev => `${prev ? prev + ' ' : ''}[אלמנט מסומן: ${described.label}]`);
        } else {
          setPickedElements(prev => [...prev, described]);
        }
      }
      stopPicking();
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        stopPicking();
      }
    };

    document.addEventListener('mousemove', handleMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKey, true);
    const prevCursor = document.body.style.cursor;
    document.body.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('mousemove', handleMove, true);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKey, true);
      document.body.style.cursor = prevCursor;
      hoveredElRef.current = null;
    };
  }, [isPicking]);

  const startPicking = (context = 'new') => {
    pickingContextRef.current = context;
    setIsOpen(false);
    setIsPicking(true);
  };

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

    const fullText = pickedElements.length > 0
      ? `${userText}\n\n[אלמנטים מסומנים:\n${pickedElements.map((el, i) => `${i + 1}. ${el.label}`).join('\n')}]`
      : userText;

    const payload = {
      userText: fullText,
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
        setPickedElements([]);
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

  const setReportStatus = async (report, status) => {
    try {
      const res = await fetch('/api/error-report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId: report.id, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setReports(prev => prev.map(r => r.id === report.id ? { ...r, status } : r));
        if (selectedReport?.id === report.id) {
          setSelectedReport(prev => ({ ...prev, status }));
        }
        showToast(status === 'ARCHIVED' ? 'הדיווח הועבר לארכיון' : 'הדיווח שוחזר מהארכיון', 'success');
      } else {
        showToast(data.error || 'שגיאה בעדכון הדיווח', 'error');
      }
    } catch (err) {
      showToast('שגיאת תקשורת', 'error');
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

  const unreadCount = reports.filter(r => r.status !== 'ARCHIVED' && ((isProgrammer && !r.isReadByProgrammer) || (!isProgrammer && !r.isReadByUser))).length;
  const openReports = reports.filter(r => r.status !== 'ARCHIVED');
  const archivedReports = reports.filter(r => r.status === 'ARCHIVED');

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
                <button type="button" className={`tab${activeTab === 'list' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('list')}>
                  פניות שלי {isProgrammer ? '(כל הדיווחים)' : ''}
                </button>
                <button type="button" className={`tab${activeTab === 'archive' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('archive')}>
                  <svg className="icon" style={{ width: 13, height: 13, verticalAlign: -2, marginInlineEnd: 4 }}><use href="#i-archive" /></svg>
                  ארכיון {archivedReports.length > 0 ? `(${archivedReports.length})` : ''}
                </button>
                <button type="button" className={`tab${activeTab === 'new' ? ' active' : ''}`} style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }} onClick={() => setActiveTab('new')}>
                  דיווח על תקלה חדשה
                </button>
              </div>
            )}

            {activeTab === 'thread' && selectedReport && (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                <div style={{ padding: '10px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveTab(selectedReport.status === 'ARCHIVED' ? 'archive' : 'list'); fetchReports(); }}>חזור לרשימה</button>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setReportStatus(selectedReport, selectedReport.status === 'ARCHIVED' ? 'OPEN' : 'ARCHIVED')}
                    >
                      <svg className="icon"><use href={selectedReport.status === 'ARCHIVED' ? '#i-refresh' : '#i-archive'} /></svg>
                      {selectedReport.status === 'ARCHIVED' ? 'שחזור מהארכיון' : 'העברה לארכיון'}
                    </button>
                    {isProgrammer && (
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => copyDetails(selectedReport)}>
                        <svg className="icon"><use href="#i-link" /></svg>
                        העתק פרטי מערכת
                      </button>
                    )}
                  </div>
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
                  <button
                    type="button"
                    className="btn btn-secondary btn-icon-only"
                    title="סמן אלמנט בעמוד וצרף לתגובה"
                    onClick={() => startPicking('reply')}
                  >
                    <svg className="icon"><use href="#i-pin" /></svg>
                  </button>
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

            {(activeTab === 'list' || activeTab === 'archive') && (
              <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(activeTab === 'archive' ? archivedReports : openReports).length === 0 ? (
                  <div className="empty-state">
                    <svg className="icon"><use href={activeTab === 'archive' ? '#i-archive' : '#i-message'} /></svg>
                    <p>{activeTab === 'archive' ? 'אין דיווחים בארכיון' : 'אין דיווחים קיימים'}</p>
                  </div>
                ) : (
                  (activeTab === 'archive' ? archivedReports : openReports).map(report => {
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                              {getHebrewDateString(report.updatedAt)} {new Date(report.updatedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon-only btn-sm"
                              title={activeTab === 'archive' ? 'שחזור מהארכיון' : 'העברה לארכיון'}
                              onClick={(e) => { e.stopPropagation(); setReportStatus(report, activeTab === 'archive' ? 'OPEN' : 'ARCHIVED'); }}
                            >
                              <svg className="icon"><use href={activeTab === 'archive' ? '#i-refresh' : '#i-archive'} /></svg>
                            </button>
                          </div>
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
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>סימון אלמנטים בעמוד (לא חובה)</label>

                  {pickedElements.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      {pickedElements.map((el, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--primary-tint)',
                            border: '1px solid var(--primary-tint-2)'
                          }}
                        >
                          <span
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 22, height: 22, borderRadius: '50%',
                              background: 'var(--primary-solid)', color: '#fff',
                              fontSize: 11.5, fontWeight: 700, flexShrink: 0
                            }}
                          >{idx + 1}</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13 }}>
                            {el.label}
                          </span>
                          <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setPickedElements(prev => prev.filter((_, i) => i !== idx))} title="הסר סימון זה">
                            <svg className="icon"><use href="#i-x" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => startPicking('new')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '12px 14px', cursor: 'pointer',
                      borderRadius: 'var(--radius-sm)',
                      border: '1.5px dashed var(--primary-tint-2)',
                      background: 'var(--primary-tint)',
                      color: 'var(--primary-solid)', fontWeight: 700, fontSize: 13.5
                    }}
                  >
                    <span
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'var(--primary-solid)', color: '#fff', flexShrink: 0
                      }}
                    >
                      <svg className="icon" style={{ width: 15, height: 15 }}><use href="#i-pin" /></svg>
                    </span>
                    {pickedElements.length > 0 ? 'סמן אלמנט נוסף' : 'סמן אלמנט בעמוד שקשור לתקלה'}
                  </button>
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
                  <button type="button" className="btn btn-secondary" onClick={() => { setActiveTab('list'); setPickedElements([]); }}>ביטול</button>
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

      {isPicking && mounted && createPortal(
        <>
          {hoverRect && (
            <div
              style={{
                position: 'fixed',
                top: hoverRect.top,
                left: hoverRect.left,
                width: hoverRect.width,
                height: hoverRect.height,
                border: '2px solid var(--primary-solid)',
                background: 'var(--primary-tint)',
                opacity: 0.55,
                borderRadius: 4,
                pointerEvents: 'none',
                zIndex: 999998
              }}
            />
          )}
          <div
            style={{
              position: 'fixed',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999999,
              background: 'var(--text)',
              color: 'var(--surface)',
              padding: '10px 18px',
              borderRadius: 999,
              fontSize: 13.5,
              fontWeight: 600,
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'none'
            }}
          >
            לחץ על האלמנט הרצוי בעמוד לסימונו · Esc לביטול
          </div>
        </>,
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
