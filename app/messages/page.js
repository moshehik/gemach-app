'use client';

import React, { useState, useEffect } from 'react';
import { Send, Inbox, Mail, Check, AlertCircle, Search, User, Archive, Tag, X, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MessagesPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming', 'outgoing', 'archived', 'compose'
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [archived, setArchived] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Compose state
  const [receiverId, setReceiverId] = useState('all');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);

  // Tagging state
  const [tagInputs, setTagInputs] = useState({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [notifRes, empRes] = await Promise.all([
        fetch('/api/notifications'),
        fetch('/api/employees')
      ]);
      
      const notifData = await notifRes.json();
      const empData = await empRes.json();

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
          content
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

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f8fafc' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '1.1rem' }}>טוען הודעות...</p>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { 100% { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  const renderTags = (notif) => {
    const tags = notif.personalTags || [];
    const inputVal = tagInputs[notif.id] || '';
    
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
        <Tag size={14} color="#64748b" />
        {tags.map((tag, idx) => (
          <span key={idx} style={{ background: '#e2e8f0', color: '#334155', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            {tag}
            <button onClick={() => removeTag(notif, tag)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#64748b' }} title="הסר תגית">
              <X size={12} />
            </button>
          </span>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '999px', padding: '0.1rem 0.5rem' }}>
          <input 
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
            style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.8rem', width: '80px', color: '#334155' }}
          />
          <button onClick={() => addTag(notif, inputVal)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#3b82f6' }} title="שמור תגית">
            <Plus size={14} />
          </button>
        </div>
      </div>
    );
  };

  const renderMessageCard = (notif, type) => {
    return (
      <div key={notif.id} style={{
        background: type === 'incoming' && !notif.isRead ? '#eff6ff' : '#f8fafc',
        border: `1px solid ${type === 'incoming' && !notif.isRead ? '#bfdbfe' : '#e2e8f0'}`,
        borderRadius: '16px',
        padding: '1.5rem',
        position: 'relative',
        transition: 'all 0.3s'
      }}>
        {type === 'incoming' && !notif.isRead && (
          <div style={{ position: 'absolute', top: '1.5rem', left: '1.5rem' }}>
            <button
              onClick={() => markAsRead(notif.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#dbeafe', color: '#2563eb', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
            >
              <Check size={14} /> סמן כנקרא
            </button>
          </div>
        )}
        <div style={{ position: 'absolute', top: '1.5rem', left: type === 'incoming' && !notif.isRead ? '7rem' : '1.5rem', display: 'flex', gap: '0.5rem' }}>
          {notif.isArchived ? (
            <button
              onClick={() => handleArchive(notif.id, false)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
              title="החזר מארכיון"
            >
              <Archive size={14} /> שחזר
            </button>
          ) : (
            <button
              onClick={() => handleArchive(notif.id, true)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '0.4rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer' }}
              title="העבר לארכיון"
            >
              <Archive size={14} /> ארכיון
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', paddingLeft: '6rem' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: notif.receiverId === null ? '#f59e0b' : '#3b82f6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 'bold' }}>
            {type === 'outgoing' ? <User size={24} /> : (notif.sender ? notif.sender.firstName.charAt(0) : 'מ')}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                {type === 'outgoing' ? 
                  `אל: ${notif.receiverId === null ? 'כל העובדים' : (notif.receiver ? `${notif.receiver.firstName} ${notif.receiver.lastName}` : 'לא ידוע')}` 
                  : 
                  (notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת הגמ"ח')}
              </h3>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                {new Date(notif.createdAt).toLocaleString('he-IL')}
              </span>
              {type === 'incoming' && notif.receiverId === null && (
                <span style={{ background: '#fef3c7', color: '#d97706', padding: '0.2rem 0.6rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 'bold' }}>הודעה לכולם</span>
              )}
            </div>
            <p style={{ margin: 0, color: '#334155', fontSize: '1rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
              {notif.content}
            </p>
            {renderTags(notif)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '2rem', direction: 'rtl', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Header Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '2rem', color: '#0f172a', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Mail size={32} color="#3b82f6" />
              מרכז הודעות
            </h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#64748b', fontSize: '1.1rem' }}>
              נהל את ההתראות וההודעות הפנימיות שלך
            </p>
          </div>
          <button 
            onClick={() => setActiveTab('compose')}
            style={{ 
              display: 'flex', alignItems: 'center', gap: '0.5rem', 
              background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', 
              color: 'white', border: 'none', padding: '0.75rem 1.5rem', 
              borderRadius: '12px', fontWeight: '600', fontSize: '1rem',
              cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s'
            }}
          >
            <Send size={18} />
            הודעה חדשה
          </button>
        </div>

        {/* Main Content Area */}
        <div style={{ background: 'white', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)', border: '1px solid rgba(255,255,255,0.5)', display: 'flex' }}>
          
          {/* Sidebar Tabs */}
          <div style={{ width: '250px', background: '#f8fafc', borderLeft: '1px solid #e2e8f0', padding: '1.5rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button
              onClick={() => setActiveTab('incoming')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', width: '100%',
                borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
                background: activeTab === 'incoming' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'incoming' ? '#0369a1' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              <Inbox size={20} />
              נכנסות
              {incoming.filter(n => !n.isRead).length > 0 && (
                <span style={{ background: '#ef4444', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', marginLeft: 'auto' }}>
                  {incoming.filter(n => !n.isRead).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('outgoing')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', width: '100%',
                borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
                background: activeTab === 'outgoing' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'outgoing' ? '#0369a1' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              <Send size={20} />
              יוצאות
            </button>

            <button
              onClick={() => setActiveTab('archived')}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem', width: '100%',
                borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize: '1rem',
                background: activeTab === 'archived' ? '#e0f2fe' : 'transparent',
                color: activeTab === 'archived' ? '#0369a1' : '#475569',
                transition: 'all 0.2s'
              }}
            >
              <Archive size={20} />
              ארכיון
              {archived.length > 0 && (
                <span style={{ background: '#94a3b8', color: 'white', padding: '0.1rem 0.5rem', borderRadius: '999px', fontSize: '0.75rem', marginLeft: 'auto' }}>
                  {archived.length}
                </span>
              )}
            </button>
          </div>

          {/* Content Pane */}
          <div style={{ flex: 1, padding: '2rem', minHeight: '500px' }}>
            
            {/* INCOMING TAB */}
            {activeTab === 'incoming' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: '0 0 1.5rem 0' }}>דואר נכנס</h2>
                {incoming.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                    <Inbox size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.1rem' }}>תיבת הדואר הנכנס ריקה</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {incoming.map(notif => renderMessageCard(notif, 'incoming'))}
                  </div>
                )}
              </div>
            )}

            {/* OUTGOING TAB */}
            {activeTab === 'outgoing' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: '0 0 1.5rem 0' }}>דואר יוצא</h2>
                {outgoing.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                    <Send size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.1rem' }}>לא שלחת הודעות עדיין</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {outgoing.map(notif => renderMessageCard(notif, 'outgoing'))}
                  </div>
                )}
              </div>
            )}

            {/* ARCHIVED TAB */}
            {activeTab === 'archived' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: '0 0 1.5rem 0' }}>ארכיון הודעות</h2>
                {archived.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '4rem 0', color: '#94a3b8' }}>
                    <Archive size={48} style={{ opacity: 0.2, margin: '0 auto 1rem' }} />
                    <p style={{ fontSize: '1.1rem' }}>אין הודעות בארכיון</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {archived.map(notif => renderMessageCard(notif, notif.direction || 'incoming'))}
                  </div>
                )}
              </div>
            )}

            {/* COMPOSE TAB */}
            {activeTab === 'compose' && (
              <div>
                <h2 style={{ fontSize: '1.5rem', color: '#0f172a', margin: '0 0 1.5rem 0' }}>כתיבת הודעה חדשה</h2>
                
                {error && (
                  <div style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem', borderRadius: '12px', border: '1px solid #fecaca', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={20} />
                    {error}
                  </div>
                )}

                {sendSuccess && (
                  <div style={{ background: '#f0fdf4', color: '#166534', padding: '1rem', borderRadius: '12px', border: '1px solid #bbf7d0', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Check size={20} />
                    ההודעה נשלחה בהצלחה!
                  </div>
                )}

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '2rem' }}>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>שלח אל:</label>
                    <select 
                      value={receiverId} 
                      onChange={e => setReceiverId(e.target.value)}
                      style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #cbd5e1', background: 'white', color: '#0f172a', fontSize: '1.1rem', outline: 'none', transition: 'border-color 0.2s' }}
                    >
                      <option value="all">🌟 כל העובדים במערכת (הודעה כללית)</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>
                          👤 {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '1rem', color: '#1e293b', fontWeight: '600' }}>תוכן ההודעה:</label>
                    <textarea
                      value={content}
                      onChange={e => setContent(e.target.value)}
                      placeholder="הקלד את הודעתך כאן..."
                      style={{ width: '100%', height: '200px', padding: '1rem', borderRadius: '12px', border: '2px solid #cbd5e1', background: 'white', color: '#0f172a', fontSize: '1.1rem', resize: 'none', outline: 'none', transition: 'border-color 0.2s' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={handleSend}
                      disabled={isSending}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '0.5rem', 
                        background: 'linear-gradient(135deg, #10b981, #059669)', 
                        color: 'white', border: 'none', padding: '1rem 2.5rem', 
                        borderRadius: '12px', fontWeight: '700', fontSize: '1.1rem',
                        cursor: isSending ? 'not-allowed' : 'pointer', opacity: isSending ? 0.7 : 1,
                        boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                    >
                      {isSending ? 'שולח...' : <><Send size={20} /> שלח הודעה</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
