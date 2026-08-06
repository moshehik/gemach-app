'use client';

import React, { useState, useEffect } from 'react';
import { Send, Inbox, Mail, Check, AlertCircle, Search, User, Archive, Tag, X, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MessagesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming', 'outgoing', 'archived', 'compose'
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [archived, setArchived] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Compose state
  const [receiverId, setReceiverId] = useState('all');
  const [content, setContent] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Tagging state
  const [tagInputs, setTagInputs] = useState({});

  // סינון מקומי בלבד על הרשימות שכבר נטענו (ללא קריאות שרת נוספות)
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notifRes, empRes, meRes] = await Promise.all([
        fetch('/api/notifications'),
        fetch('/api/employees'),
        fetch('/api/me')
      ]);
      
      const notifData = await notifRes.json();
      const empData = await empRes.json();
      const meData = await meRes.json();

      if (meData.success && meData.employee) {
        setCurrentUser(meData.employee);
      }

      if (notifData.success) {
        const inc = notifData.notifications || [];
        const out = notifData.outgoing || [];
        
        const allArchived = [];
        const filteredInc = [];
        const filteredOut = [];

        inc.forEach(n => {
          if (n.isArchived) allArchived.push({ ...n, direction: 'incoming' });
          else filteredInc.push(n);
        });

        out.forEach(n => {
          if (n.isArchived) allArchived.push({ ...n, direction: 'outgoing' });
          else filteredOut.push(n);
        });
        
        allArchived.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

        setIncoming(filteredInc);
        setOutgoing(filteredOut);
        setArchived(allArchived);
      }
      if (Array.isArray(empData)) {
        setEmployees(empData);
      } else if (empData && empData.success) {
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      setError('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id })
      });
      if (res.ok) {
        setIncoming(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleArchive = async (id, archiveState) => {
    try {
      const res = await fetch('/api/notifications/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id, archive: archiveState })
      });
      if (res.ok) {
        // Refresh to easily re-categorize items across tabs
        fetchData();
      }
    } catch (err) {
      console.error('Error toggling archive:', err);
    }
  };

  const handleUpdateTags = async (notificationId, newTagsArray) => {
    try {
      const res = await fetch('/api/notifications/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, tags: newTagsArray })
      });
      if (res.ok) {
        const updateList = (list) => list.map(n => n.id === notificationId ? { ...n, personalTags: newTagsArray } : n);
        setIncoming(updateList);
        setOutgoing(updateList);
        setArchived(updateList);
      }
    } catch (err) {
      console.error('Error updating tags:', err);
    }
  };

  const addTag = (notif, newTag) => {
    if (!newTag.trim()) return;
    const currentTags = notif.personalTags || [];
    if (!currentTags.includes(newTag.trim())) {
      handleUpdateTags(notif.id, [...currentTags, newTag.trim()]);
    }
    setTagInputs(prev => ({ ...prev, [notif.id]: '' }));
  };

  const removeTag = (notif, tagToRemove) => {
    const currentTags = notif.personalTags || [];
    handleUpdateTags(notif.id, currentTags.filter(t => t !== tagToRemove));
  };

  const handleSend = async () => {
    if (!content.trim()) {
      setError('יש להזין תוכן להודעה');
      return;
    }
    
    setIsSending(true);
    setError('');
    
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          receiverId,
          title: 'הודעה חדשה',
          content,
          sendEmail
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setContent('');
        setReceiverId('all');
        setSendSuccess(true);
        setTimeout(() => setSendSuccess(false), 3000);
        fetchData(); // Refresh messages
        setActiveTab('outgoing');
      } else {
        setError(data.error || 'שגיאה בשליחת הודעה');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveSettings = async (receiveEmailAlerts) => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiveEmailAlerts })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCurrentUser(data.employee);
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', background: 'transparent' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid var(--element-border)', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: 'var(--text-muted)', fontSize: '1.05rem' }}>טוען הודעות...</p>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  const renderTags = (notif) => {
    const tags = notif.personalTags || [];
    const inputVal = tagInputs[notif.id] || '';
    
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
        <Tag data-element-name="רכיב_page_1" size={14} color="var(--text-muted)" />
        {tags.map((tag, idx) => (
          <span key={idx} style={{ background: 'var(--element-bg)', border: '1px solid var(--element-border)', color: 'var(--text-main)', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {tag}
            <button data-element-name="כפתור_page_2" onClick={() => removeTag(notif, tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }} title="הסר תגית">
              <X data-element-name="רכיב_page_3" size={12} />
            </button>
          </span>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--element-bg)', border: '1px solid var(--element-border)', borderRadius: '999px', padding: '0.1rem 0.5rem' }}>
          <input data-element-name="שדה_page_4" 
            type="text" 
            placeholder="הוסף תגית..." 
            value={inputVal}
            onChange={e => setTagInputs(prev => ({ ...prev, [notif.id]: e.target.value }))}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag(notif, inputVal);
              }
            }}
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', width: '80px', color: 'var(--text-main)' }}
          />
          <button data-element-name="כפתור_page_5" onClick={() => addTag(notif, inputVal)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--primary-color)' }} title="שמור תגית">
            <Plus data-element-name="רכיב_page_6" size={14} />
          </button>
        </div>
      </div>
    );
  };

  // כפתור פעולה קטן בתוך כרטיס הודעה — טבעת עדינה בגוני הקרם של המערכת
  const cardActionStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.35rem',
    background: 'transparent',
    color: 'var(--text-muted)',
    border: '1px solid var(--element-border)',
    padding: '0.32rem 0.7rem',
    borderRadius: '99px',
    fontSize: '0.78rem',
    fontWeight: '600',
    fontFamily: 'inherit',
    cursor: 'pointer'
  };

  const renderMessageCard = (notif, type) => {
    const isUnread = type === 'incoming' && !notif.isRead;
    return (
      <div key={notif.id} style={{
        background: isUnread ? 'var(--primary-light)' : 'var(--element-bg)',
        border: `1px solid ${isUnread ? 'var(--primary-color)' : 'var(--element-border)'}`,
        borderRadius: '16px',
        padding: '1.25rem 1.4rem',
        transition: 'all 0.3s'
      }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
          <div style={{ width: '44px', height: '44px', flex: 'none', borderRadius: '50%', background: notif.receiverId === null ? 'var(--warning-color)' : 'var(--primary-color)', color: notif.receiverId === null ? '#fff' : 'var(--btn-primary-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.15rem', fontWeight: 'bold' }}>
            {type === 'outgoing' ? <User data-element-name="רכיב_page_13" size={22} /> : (notif.sender ? notif.sender.firstName.charAt(0) : 'מ')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontFamily: "'Frank Ruhl Libre', serif", fontSize: '1.05rem', color: 'var(--text-main)' }}>
                {type === 'outgoing' ?
                  `אל: ${notif.receiverId === null ? 'כל העובדים' : (notif.receiver ? `${notif.receiver.firstName} ${notif.receiver.lastName}` : 'לא ידוע')}`
                  :
                  (notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת הגמ"ח')}
              </h3>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {new Date(notif.createdAt).toLocaleString('he-IL')}
              </span>
              {type === 'incoming' && notif.receiverId === null && (
                <span className="status-dot c-amber" style={{ fontSize: '0.78rem' }}>הודעה לכולם</span>
              )}

              <div style={{ display: 'flex', gap: '0.4rem', marginRight: 'auto', flexWrap: 'wrap' }}>
                {isUnread && (
                  <button data-element-name="כפתור_page_7"
                    onClick={() => markAsRead(notif.id)}
                    style={cardActionStyle}
                    title="סמן כנקרא"
                  >
                    <Check data-element-name="רכיב_page_8" size={14} /> סמן כנקרא
                  </button>
                )}
                {notif.isArchived ? (
                  <button data-element-name="כפתור_page_9"
                    onClick={() => handleArchive(notif.id, false)}
                    style={cardActionStyle}
                    title="החזר מארכיון"
                  >
                    <Archive data-element-name="רכיב_page_10" size={14} /> שחזר
                  </button>
                ) : (
                  <button data-element-name="כפתור_page_11"
                    onClick={() => handleArchive(notif.id, true)}
                    style={cardActionStyle}
                    title="העבר לארכיון"
                  >
                    <Archive data-element-name="רכיב_page_12" size={14} /> ארכיון
                  </button>
                )}
              </div>
            </div>
            <p style={{ margin: 0, color: 'var(--text-main)', fontSize: '0.98rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {notif.content}
            </p>
            {renderTags(notif)}
          </div>
        </div>
      </div>
    );
  };

  const searchQuery = searchTerm.trim().toLowerCase();
  const matchesSearch = (notif) => {
    if (!searchQuery) return true;
    const haystack = [
      notif.content,
      notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : '',
      notif.receiver ? `${notif.receiver.firstName} ${notif.receiver.lastName}` : '',
      ...(notif.personalTags || [])
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(searchQuery);
  };

  const visibleIncoming = incoming.filter(matchesSearch);
  const visibleOutgoing = outgoing.filter(matchesSearch);
  const visibleArchived = archived.filter(matchesSearch);
  const unreadCount = incoming.filter(n => !n.isRead).length;
  const isListTab = activeTab === 'incoming' || activeTab === 'outgoing' || activeTab === 'archived';

  const emptyStateStyle = { textAlign: 'center', padding: '4rem 0', color: 'var(--text-muted)' };
  const paneTitleStyle = { fontFamily: "'Frank Ruhl Libre', serif", fontSize: '1.2rem', color: 'var(--text-main)', margin: '0 0 1.25rem 0' };
  const panelStyle = { background: 'var(--element-bg)', border: '1px solid var(--element-border)', borderRadius: '18px', padding: '1.75rem' };
  const fieldLabelStyle = { display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: '600' };
  const fieldStyle = { width: '100%', padding: '0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--element-border)', background: 'var(--input-bg)', color: 'var(--text-main)', fontSize: '1rem', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' };

  return (
    <main data-agy-id="messages-page-container" className="container animate-fade-in page-shell" style={{ '--page-content-max': '1000px' }}>
      <div className="page-scroll">

        {/* סרגל אחד: כותרת + חיפוש + טאבים + פעולה ראשית */}
        <div className="toolbar-row">
          <Mail data-element-name="רכיב_page_14" size={22} style={{ flex: 'none', color: 'var(--primary-color)', marginInlineEnd: '-0.5rem' }} />
          <h1 className="toolbar-title">
            <strong>מרכז הודעות</strong>
            <small>נהל את ההתראות וההודעות הפנימיות שלך</small>
          </h1>

          {isListTab && (
            <div className="search-box-modern">
              <Search data-element-name="רכיב_page_search" size={16} />
              <input data-element-name="שדה_page_search"
                data-agy-id="messages-search-input"
                type="text"
                placeholder="חיפוש בהודעות (תוכן, שולח, תגית)..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          <div className="status-filters">
            <button data-element-name="כפתור_page_17"
              data-agy-id="tab-incoming"
              onClick={() => setActiveTab('incoming')}
              className={activeTab === 'incoming' ? 'status-filter active c-blue' : 'status-filter'}
              title="דואר נכנס"
            >
              <Inbox data-element-name="רכיב_page_18" size={16} />
              <span>נכנסות</span>
              {unreadCount > 0 && <b>{unreadCount}</b>}
            </button>

            <button data-element-name="כפתור_page_19"
              data-agy-id="tab-outgoing"
              onClick={() => setActiveTab('outgoing')}
              className={activeTab === 'outgoing' ? 'status-filter active c-green' : 'status-filter'}
              title="דואר יוצא"
            >
              <Send data-element-name="רכיב_page_20" size={16} />
              <span>יוצאות</span>
              {outgoing.length > 0 && <b>{outgoing.length}</b>}
            </button>

            <button data-element-name="כפתור_page_21"
              data-agy-id="tab-archived"
              onClick={() => setActiveTab('archived')}
              className={activeTab === 'archived' ? 'status-filter active c-gray' : 'status-filter'}
              title="ארכיון הודעות"
            >
              <Archive data-element-name="רכיב_page_22" size={16} />
              <span>ארכיון</span>
              {archived.length > 0 && <b>{archived.length}</b>}
            </button>

            <button data-element-name="כפתור_page_23"
              data-agy-id="tab-settings"
              onClick={() => setActiveTab('settings')}
              className={activeTab === 'settings' ? 'status-filter active c-purple' : 'status-filter'}
              title="הגדרות התראות"
            >
              <Settings data-element-name="רכיב_page_24" size={16} />
              <span>הגדרות</span>
            </button>
          </div>

          <div className="icon-toolbar">
            <button data-element-name="כפתור_page_15"
              data-agy-id="new-message-button"
              onClick={() => setActiveTab('compose')}
              className="icon-btn icon-btn-primary"
              title="הודעה חדשה"
            >
              <Send data-element-name="רכיב_page_16" size={18} />
              הודעה חדשה
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ background: 'var(--card-bg)', borderRadius: '18px', boxShadow: 'var(--shadow-md)', border: '1px solid var(--border-color)' }}>

          {/* Content Pane */}
          <div style={{ padding: '1.75rem', minHeight: '500px' }}>
            
            {/* INCOMING TAB */}
            {activeTab === 'incoming' && (
              <div>
                <h2 style={paneTitleStyle}>דואר נכנס</h2>
                {visibleIncoming.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <Inbox data-element-name="רכיב_page_25" size={48} style={{ opacity: 0.25, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.05rem' }}>{incoming.length === 0 ? 'תיבת הדואר הנכנס ריקה' : 'לא נמצאו הודעות תואמות לחיפוש'}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {visibleIncoming.map(notif => renderMessageCard(notif, 'incoming'))}
                  </div>
                )}
              </div>
            )}

            {/* OUTGOING TAB */}
            {activeTab === 'outgoing' && (
              <div>
                <h2 style={paneTitleStyle}>דואר יוצא</h2>
                {visibleOutgoing.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <Send data-element-name="רכיב_page_26" size={48} style={{ opacity: 0.25, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.05rem' }}>{outgoing.length === 0 ? 'לא שלחת הודעות עדיין' : 'לא נמצאו הודעות תואמות לחיפוש'}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {visibleOutgoing.map(notif => renderMessageCard(notif, 'outgoing'))}
                  </div>
                )}
              </div>
            )}

            {/* ARCHIVED TAB */}
            {activeTab === 'archived' && (
              <div>
                <h2 style={paneTitleStyle}>ארכיון הודעות</h2>
                {visibleArchived.length === 0 ? (
                  <div style={emptyStateStyle}>
                    <Archive data-element-name="רכיב_page_27" size={48} style={{ opacity: 0.25, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.05rem' }}>{archived.length === 0 ? 'אין הודעות בארכיון' : 'לא נמצאו הודעות תואמות לחיפוש'}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {visibleArchived.map(notif => renderMessageCard(notif, notif.direction || 'incoming'))}
                  </div>
                )}
              </div>
            )}

            {/* COMPOSE TAB */}
            {activeTab === 'compose' && (
              <div>
                <h2 style={paneTitleStyle}>כתיבת הודעה חדשה</h2>

                {error && (
                  <div style={{ background: 'var(--danger-bg)', color: 'var(--danger-text)', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid var(--danger-text)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle data-element-name="רכיב_page_28" size={20} />
                    {error}
                  </div>
                )}

                {sendSuccess && (
                  <div style={{ background: 'var(--success-bg)', color: 'var(--success-text)', padding: '0.9rem 1rem', borderRadius: '12px', border: '1px solid var(--success-text)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Check data-element-name="רכיב_page_29" size={20} />
                    ההודעה נשלחה בהצלחה!
                  </div>
                )}

                <div style={panelStyle}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={fieldLabelStyle}>שלח אל:</label>
                    <select data-element-name="בחירה_page_30"
                      data-agy-id="select-receiver"
                      value={receiverId}
                      onChange={e => setReceiverId(e.target.value)}
                      style={fieldStyle}
                    >
                      <option value="all">כל העובדים במערכת (הודעה כללית)</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={fieldLabelStyle}>תוכן ההודעה:</label>
                    <textarea data-element-name="טקסט_page_31"
                      data-agy-id="textarea-content"
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="הקלד את הודעתך כאן..."
                      style={{ ...fieldStyle, minHeight: '150px', resize: 'vertical' }}
                    />
                  </div>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '1.5rem', fontSize: '0.92rem', fontWeight: '500', color: 'var(--text-main)' }}>
                    <input data-element-name="שדה_page_32" data-agy-id="checkbox-send-email" type="checkbox" checked={sendEmail} onChange={e => setSendEmail(e.target.checked)} />
                    שלח התראה גם למייל (לעובדים בעלי כתובת מייל מעודכנת)
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button data-element-name="כפתור_page_33"
                      data-agy-id="send-message-button"
                      onClick={handleSend}
                      disabled={isSending}
                      className="btn btn-primary"
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.7rem 2rem', fontSize: '0.95rem',
                        cursor: isSending ? 'not-allowed' : 'pointer', opacity: isSending ? 0.7 : 1
                      }}
                    >
                      {isSending ? 'שולח...' : <><Send data-element-name="רכיב_page_34" size={18} /> שלח הודעה</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SETTINGS TAB */}
            {activeTab === 'settings' && (
              <div>
                <h2 style={paneTitleStyle}>הגדרות התראות</h2>

                <div style={panelStyle}>
                  <h3 style={{ fontFamily: "'Frank Ruhl Libre', serif", fontSize: '1.05rem', color: 'var(--text-main)', marginBottom: '1rem' }}>התראות במייל</h3>

                  {currentUser ? (
                    <div>
                      {currentUser.email ? (
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                          המייל המעודכן שלך במערכת הוא: <strong dir="ltr">{currentUser.email}</strong>
                        </p>
                      ) : (
                        <p style={{ color: 'var(--danger-text)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <AlertCircle data-element-name="רכיב_page_35" size={16} /> לא מוגדרת עבורך כתובת מייל במערכת. אנא פנה למנהל לעדכון המייל.
                        </p>
                      )}

                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-main)', opacity: isSavingSettings ? 0.7 : 1 }}>
                        <input data-element-name="שדה_page_36"
                          type="checkbox"
                          checked={currentUser.receiveEmailAlerts || false}
                          onChange={(e) => handleSaveSettings(e.target.checked)}
                          disabled={isSavingSettings || !currentUser.email}
                          style={{ width: '20px', height: '20px' }}
                        />
                        קבל התראות למייל על הודעות חדשות
                      </label>
                      {isSavingSettings && <span style={{ fontSize: '0.88rem', color: 'var(--primary-color)', marginTop: '0.5rem', display: 'block' }}>שומר שינויים...</span>}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)' }}>טוען נתוני עובד...</p>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
