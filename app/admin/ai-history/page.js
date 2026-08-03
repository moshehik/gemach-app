'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Bot, Calendar, User, Search, RefreshCw, Eye } from 'lucide-react';
import { createPortal } from 'react-dom';
import FormattedMessage from '../../../components/FormattedMessage';

export default function AiHistoryPage() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedSession, setSelectedSession] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/sessions?page=${page}&limit=50`);
      const data = await res.json();
      if (data.success) {
        setSessions(data.data || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [page]);

  const viewSession = (session) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const getContextColor = (context) => {
    if (!context) return '#64748b';
    if (context.includes('דוח AI') || context.includes('סטטיסטיקה')) return '#8b5cf6';
    if (context.includes('דשבורד') || context.includes('בית')) return '#3b82f6';
    if (context.includes('לקוחות')) return '#06b6d4';
    if (context.includes('עובדים')) return '#10b981';
    if (context.includes('הזמנות')) return '#f59e0b';
    return '#64748b';
  };

  return (
    <div className="container animate-fade-in page-shell">
      <div className="page-scroll">
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <Link data-element-name="רכיב_page_1" href="/admin" className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px', textDecoration: 'none' }}>
          <ArrowLeft data-element-name="רכיב_page_2" size={18} /> חזרה
        </Link>
        <h1 style={{ margin: 0, color: 'var(--primary-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bot data-element-name="רכיב_page_3" size={28} /> היסטוריית שיחות AI
        </h1>
        <div style={{ flex: 1 }}></div>
        <button data-element-name="כפתור_page_4" onClick={fetchSessions} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}>
          <RefreshCw data-element-name="רכיב_page_5" size={18} /> רענן
        </button>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'visible' }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--text-main)' }}>סה"כ שיחות: {total}</h3>
        </div>

        <div style={{ overflow: 'visible' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
            <thead>
              <tr style={{ background: 'var(--element-bg)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>תאריך התחלה</th>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>הקשר (עמוד)</th>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>עובד</th>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>הודעות</th>
                <th style={{ padding: '0.4rem 0.5rem', fontWeight: '600' }}>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                    <Loader2 data-element-name="רכיב_page_6" size={32} className="animate-spin" color="var(--primary-color)" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    לא נמצאו שיחות
                  </td>
                </tr>
              ) : (
                sessions.map(session => {
                  let msgCount = 0;
                  try {
                    msgCount = JSON.parse(session.messagesJson).length;
                  } catch(e) {}
                  
                  return (
                    <tr key={session.id} style={{ borderBottom: '1px solid #f1f5f9' }} className="table-row-hover">
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Calendar data-element-name="רכיב_page_7" size={16} color="var(--text-muted)" />
                          {new Date(session.startedAt).toLocaleString('he-IL')}
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <span style={{ 
                          background: `${getContextColor(session.context)}15`, 
                          color: getContextColor(session.context), 
                          padding: '0.25rem 0.75rem', 
                          borderRadius: '16px', 
                          fontWeight: '500',
                          fontSize: '0.85rem'
                        }}>
                          {session.context}
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <User data-element-name="רכיב_page_8" size={16} color="var(--text-muted)" />
                          {session.employee ? `${session.employee.firstName} ${session.employee.lastName || ''}` : 'לא ידוע'}
                        </div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <div style={{ fontWeight: 'bold' }}>{msgCount} הודעות</div>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <button data-element-name="כפתור_page_9" 
                          onClick={() => viewSession(session)}
                          style={{ 
                            background: '#eff6ff', 
                            color: '#3b82f6', 
                            border: '1px solid #bfdbfe', 
                            borderRadius: '6px', 
                            padding: '0.4rem 0.8rem', 
                            cursor: 'pointer', 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '0.5rem',
                            fontWeight: '500'
                          }}
                        >
                          <Eye data-element-name="רכיב_page_10" size={16} /> צפה בשיחה
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>
      </div>

      {/* סיכום הרשומות ועימוד — מוצמד תמיד לתחתית המסך */}
      <div className="page-footer-bar">
        <div className="page-footer-summary">סה"כ שורות מוצגות: {loading ? '...' : sessions.length} מתוך {total}</div>

        {totalPages > 1 && (
          <div className="page-footer-pager">
            <button data-element-name="כפתור_page_11" disabled={page === 1} onClick={() => setPage(page - 1)} className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>הקודם</button>
            <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', fontWeight: 'bold', gap: '0.5rem' }}>עמוד <input data-element-name="שדה_page_12" type="number" min={1} max={totalPages || 1} value={page} onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }} style={{ width: '60px', padding: '0.3rem', textAlign: 'center', borderRadius: '6px', border: '1px solid var(--element-border)' }} /> מתוך {totalPages}</span>
            <button data-element-name="כפתור_page_13" disabled={page === totalPages} onClick={() => setPage(page + 1)} className="btn btn-outline" style={{ padding: '0.5rem 1rem', borderRadius: '8px' }}>הבא</button>
          </div>
        )}
      </div>

      {isModalOpen && selectedSession && typeof document !== 'undefined' && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100,
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          padding: '2rem'
        }}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: '800px',
            maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }} className="animate-fade-in">
            <div style={{ 
              padding: '1.5rem', borderBottom: '1px solid var(--border-color)', 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(to right, #1e293b, #334155)', color: 'white'
            }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Bot data-element-name="רכיב_page_14" size={24} color="#38bdf8" />
                  תיעוד שיחת AI
                </h2>
                <div style={{ fontSize: '0.9rem', color: '#cbd5e1', marginTop: '0.5rem' }}>
                  עובד: {selectedSession.employee ? `${selectedSession.employee.firstName} ${selectedSession.employee.lastName || ''}` : 'לא ידוע'} | 
                  הקשר: {selectedSession.context} | 
                  תאריך: {new Date(selectedSession.startedAt).toLocaleString('he-IL')}
                </div>
              </div>
              <button data-element-name="כפתור_page_15" onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem' }}>
                <ArrowLeft data-element-name="רכיב_page_16" size={24} />
              </button>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc' }}>
              {(() => {
                let msgs = [];
                try {
                  msgs = JSON.parse(selectedSession.messagesJson);
                } catch(e) {}
                
                return msgs.map((msg, idx) => (
                  <div key={idx} style={{ 
                    display: 'flex', 
                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: '1rem'
                  }}>
                    {msg.role !== 'user' && (
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6', flexShrink: 0 }}>
                        <Bot data-element-name="רכיב_page_17" size={20} />
                      </div>
                    )}
                    <div style={{ 
                      maxWidth: '75%', 
                      padding: '1rem 1.25rem', 
                      borderRadius: '16px',
                      borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                      borderTopLeftRadius: msg.role !== 'user' ? '4px' : '16px',
                      background: msg.role === 'user' ? '#3b82f6' : 'white',
                      color: msg.role === 'user' ? 'white' : '#1e293b',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                      lineHeight: '1.6',
                      whiteSpace: 'pre-wrap',
                      border: msg.role !== 'user' ? '1px solid #e2e8f0' : 'none',
                      fontSize: '1.05rem'
                    }}>
                      <FormattedMessage data-element-name="רכיב_page_18" content={msg.content} />
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
