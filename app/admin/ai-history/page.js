'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

  // מיפוי הקשר (עמוד) אל מחלקת ה-badge של מערכת העיצוב "אריג" — אותם תנאים/סדר בדיוק
  // כמו הפונקציה המקורית (getContextColor), רק שבמקום צבע hex מוחזרת מחלקת badge.
  const getContextBadgeClass = (context) => {
    if (!context) return 'badge-neutral';
    if (context.includes('דוח AI') || context.includes('סטטיסטיקה')) return 'badge-primary';
    if (context.includes('דשבורד') || context.includes('בית')) return 'badge-primary';
    if (context.includes('לקוחות')) return 'badge-info';
    if (context.includes('עובדים')) return 'badge-success';
    if (context.includes('הזמנות')) return 'badge-warning';
    return 'badge-neutral';
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>היסטוריית שיחות AI</h1>
          <div className="page-desc">סה&quot;כ שיחות: {total}</div>
        </div>
        <div className="page-actions">
          <Link href="/admin" className="btn btn-secondary">
            <svg className="icon"><use href="#i-arrow-end" /></svg>
            חזרה
          </Link>
          <button type="button" onClick={fetchSessions} className="btn btn-secondary" title="רענן">
            <svg className="icon"><use href="#i-refresh" /></svg>
            רענן
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <div className="table-scroll">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך התחלה</th>
                <th>הקשר (עמוד)</th>
                <th>עובד</th>
                <th>הודעות</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem' }}>
                    <span className="spinner lg" style={{ margin: '0 auto' }} />
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-3)' }}>
                    לא נמצאו שיחות
                  </td>
                </tr>
              ) : (
                sessions.map(session => {
                  let msgCount = 0;
                  try {
                    msgCount = JSON.parse(session.messagesJson).length;
                  } catch (e) {}

                  return (
                    <tr key={session.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-calendar" /></svg>
                          {new Date(session.startedAt).toLocaleString('he-IL')}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${getContextBadgeClass(session.context)}`}>{session.context}</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-user" /></svg>
                          {session.employee ? `${session.employee.firstName} ${session.employee.lastName || ''}` : 'לא ידוע'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{msgCount} הודעות</td>
                      <td>
                        <button type="button" className="btn btn-secondary btn-sm" title="צפה בשיחה" onClick={() => viewSession(session)}>
                          <svg className="icon"><use href="#i-eye" /></svg>
                          צפה בשיחה
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="table-foot">
          <span>סה&quot;כ שורות מוצגות: {loading ? '...' : sessions.length} מתוך {total}</span>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)} title="עמוד קודם">
                <svg className="icon"><use href="#i-chevron-end" /></svg>
                הקודם
              </button>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label htmlFor="aiHistoryPageNum">עמוד</label>
                <input
                  id="aiHistoryPageNum"
                  type="number"
                  className="input"
                  min={1}
                  max={totalPages || 1}
                  value={page}
                  onChange={(e) => { const v = parseInt(e.target.value); if (v >= 1 && v <= totalPages) setPage(v); }}
                  style={{ width: '52px', padding: '4px 6px', textAlign: 'center', display: 'inline-block' }}
                />
                מתוך {totalPages}
              </span>
              <button type="button" className="btn btn-secondary btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)} title="עמוד הבא">
                הבא
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && selectedSession && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setIsModalOpen(false)}>
          <div className="modal" style={{ maxWidth: '640px', width: '100%', margin: 0 }} onClick={e => e.stopPropagation()}>
            <div className="modal-head">
              <div>
                <strong>
                  <svg className="icon"><use href="#i-star" /></svg>
                  תיעוד שיחת AI
                </strong>
                <div className="hint" style={{ color: 'var(--text-3)', marginTop: '6px' }}>
                  עובד: {selectedSession.employee ? `${selectedSession.employee.firstName} ${selectedSession.employee.lastName || ''}` : 'לא ידוע'} &nbsp;|&nbsp;
                  הקשר: {selectedSession.context} &nbsp;|&nbsp;
                  תאריך: {new Date(selectedSession.startedAt).toLocaleString('he-IL')}
                </div>
              </div>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setIsModalOpen(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <div className="chat-thread">
                {(() => {
                  let msgs = [];
                  try {
                    msgs = JSON.parse(selectedSession.messagesJson);
                  } catch (e) {}

                  return msgs.map((msg, idx) => (
                    msg.role === 'user' ? (
                      <div key={idx} className="bubble user">
                        <FormattedMessage content={msg.content} />
                      </div>
                    ) : (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', alignSelf: 'flex-start' }}>
                        <div className="avatar">
                          <svg className="icon"><use href="#i-star" /></svg>
                        </div>
                        <div className="bubble assistant">
                          <FormattedMessage content={msg.content} />
                        </div>
                      </div>
                    )
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
