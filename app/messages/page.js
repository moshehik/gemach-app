'use client';

import React, { useState, useEffect } from 'react';
import { cacheNamespace, fetchJson } from '@/app/lib/pageCache';

// #24/#25 — הודעות "בין משמרות" ו"להנהלה" ממומשות כאן כשני טאבים ייעודיים,
// כשתיהן שידור-לכולם על גבי Notification.category ('shift_handover' / 'management').
// כל טאב מוצג רק כשה-SystemSetting המתאים מופעל (shift_handover_notes /
// management_messages, קטגוריה "הודעות" בהגדרות המערכת) — נאכף גם בשרת
// ב-POST /api/notifications וב-POST /api/notifications/handle.

// מטמון SWR משותף — ראה app/lib/pageCache.js. כניסה חוזרת לדף מציגה את
// הנתונים הקודמים מיידית, וה-fetch של הדף הופך לרענון שקט ברקע.
const messagesCache = cacheNamespace('messages');
const MESSAGES_CACHE_KEY = 'all';

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState('incoming'); // 'incoming', 'outgoing', 'archived', 'compose', 'shift', 'management'
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [archived, setArchived] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // #24/#25 — הודעות בין משמרות / להנהלה. כל אחת שידור-לכולם (receiverId=null),
  // מסוננות ע"י category מתוך אותה רשימת "notifications" גולמית מהשרת.
  const [shiftHandoverNotes, setShiftHandoverNotes] = useState([]);
  const [managementNotes, setManagementNotes] = useState([]);
  const [shiftHandoverEnabled, setShiftHandoverEnabled] = useState(false);
  const [managementMessagesEnabled, setManagementMessagesEnabled] = useState(false);
  const [shiftNoteText, setShiftNoteText] = useState('');
  const [managementNoteText, setManagementNoteText] = useState('');
  const [isSendingShiftNote, setIsSendingShiftNote] = useState(false);
  const [isSendingManagementNote, setIsSendingManagementNote] = useState(false);

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

  // מפרק תשובת שרת (או עותק שמור במטמון) לתוך ה-state — אותה לוגיקה בדיוק
  // שהייתה אינליין בתוך fetchData לפני חיבור הדף למטמון המשותף.
  const applyData = (notifData, empData, meData, settingsData) => {
    if (meData && meData.success && meData.employee) {
      setCurrentUser(meData.employee);
    }

    if (Array.isArray(settingsData)) {
      setShiftHandoverEnabled(settingsData.find(s => s.key === 'shift_handover_notes')?.value === 'true');
      setManagementMessagesEnabled(settingsData.find(s => s.key === 'management_messages')?.value === 'true');
    }

    if (notifData && notifData.success) {
      const inc = notifData.notifications || [];
      const out = notifData.outgoing || [];

      // #24/#25 — הודעות מסווגות הן שידור-לכולם, כך שהן תמיד מגיעות דרך "inc"
      // (receiverId=null) גם כשהמשתמש הנוכחי הוא השולח שלהן. מסננים אותן החוצה
      // מהזרם הכללי (נכנסות/יוצאות/ארכיון) כדי שלא ייכנסו לשם בכפילות, ומרכזים
      // כל אחת ברשימה הייעודית שלה, החדש ביותר קודם (כבר ממוין כך מהשרת).
      const generalInc = inc.filter(n => n.category !== 'shift_handover' && n.category !== 'management');
      const generalOut = out.filter(n => n.category !== 'shift_handover' && n.category !== 'management');

      setShiftHandoverNotes(inc.filter(n => n.category === 'shift_handover'));
      setManagementNotes(inc.filter(n => n.category === 'management'));

      const allArchived = [];
      const filteredInc = [];
      const filteredOut = [];

      generalInc.forEach(n => {
        if (n.isArchived) allArchived.push({ ...n, direction: 'incoming' });
        else filteredInc.push(n);
      });

      generalOut.forEach(n => {
        if (n.isArchived) allArchived.push({ ...n, direction: 'outgoing' });
        else filteredOut.push(n);
      });

      allArchived.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setIncoming(filteredInc);
      setOutgoing(filteredOut);
      setArchived(allArchived);
    }
    if (Array.isArray(empData)) {
      setEmployees(empData);
    } else if (empData && empData.success) {
      setEmployees(empData.employees || []);
    }
  };

  const fetchData = async () => {
    // SWR: אם יש עותק במטמון המשותף — מציגים אותו מיידית, וה-fetch שבהמשך
    // הופך לרענון שקט (בלי מסך טעינה). אחרת מתנהגים כמו קודם.
    const cached = messagesCache.get(MESSAGES_CACHE_KEY);
    if (cached) {
      applyData(cached.notifData, cached.empData, cached.meData, cached.settingsData);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      // fetchJson מאחד בקשות GET מקבילות לאותו URL (ראה pageCache.js)
      const [notifData, empData, meData, settingsData] = await Promise.all([
        fetchJson('/api/notifications', { cache: 'no-store' }),
        fetchJson('/api/employees', { cache: 'no-store' }),
        fetchJson('/api/me', { cache: 'no-store' }),
        fetchJson('/api/settings', { cache: 'no-store' })
      ]);

      messagesCache.set(MESSAGES_CACHE_KEY, { notifData, empData, meData, settingsData });
      applyData(notifData, empData, meData, settingsData);
    } catch (err) {
      setError('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const markAsRead = async (id) => {
    try {
      const res = await fetch('/api/notifications/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id })
      });
      if (res.ok) {
        const markRead = n => n.id === id ? { ...n, isRead: true } : n;
        setIncoming(prev => prev.map(markRead));
        setShiftHandoverNotes(prev => prev.map(markRead));
        setManagementNotes(prev => prev.map(markRead));
        // העדכון בוצע רק ב-state המקומי — מפנים את העותק במטמון כדי שכניסה
        // חוזרת לדף לא תציג לרגע את המצב הישן (לא-נקרא)
        messagesCache.delete(MESSAGES_CACHE_KEY);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // #24 — שליחת הודעת "בין משמרות" חדשה (שידור לכולם, category='shift_handover')
  const handleSendShiftNote = async () => {
    if (!shiftNoteText.trim()) return;
    setIsSendingShiftNote(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: 'all', title: 'הודעת משמרת', content: shiftNoteText, category: 'shift_handover' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setShiftNoteText('');
        messagesCache.delete(MESSAGES_CACHE_KEY);
        fetchData();
      } else {
        setError(data.error || 'שגיאה בשליחת ההודעה');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setIsSendingShiftNote(false);
    }
  };

  // #25 — שליחת הודעת "להנהלה" חדשה (שידור לכולם, category='management')
  const handleSendManagementNote = async () => {
    if (!managementNoteText.trim()) return;
    setIsSendingManagementNote(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: 'all', title: 'הודעה להנהלה', content: managementNoteText, category: 'management' })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManagementNoteText('');
        messagesCache.delete(MESSAGES_CACHE_KEY);
        fetchData();
      } else {
        setError(data.error || 'שגיאה בשליחת ההודעה');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
    } finally {
      setIsSendingManagementNote(false);
    }
  };

  // #25 — סימון/ביטול "טופל" ע"י הנהלה בלבד (השרת אוכף checkAuth('מנהל') שוב)
  const handleToggleHandled = async (id, handled) => {
    try {
      const res = await fetch('/api/notifications/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id, handled })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setManagementNotes(prev => prev.map(n => n.id === id ? { ...n, handledAt: data.notification.handledAt, handledBy: data.notification.handledBy } : n));
        messagesCache.delete(MESSAGES_CACHE_KEY);
      } else {
        setError(data.error || 'שגיאה בעדכון סטטוס טיפול');
      }
    } catch (err) {
      setError('שגיאת תקשורת');
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
        messagesCache.delete(MESSAGES_CACHE_KEY); // עדכון מקומי בלבד — ראה markAsRead
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
        messagesCache.delete(MESSAGES_CACHE_KEY); // עדכון מקומי בלבד — ראה markAsRead
      }
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        טוען הודעות...
      </div>
    );
  }

  // כפתור טאב: מאפס את סגנון ה-<button> הדפדפן המובנה (רקע/מסגרת),
  // ומשאיר את קו התחתית וצבע הפעיל להיקבע ע"י מחלקת ה-tab עצמה.
  const tabResetStyle = { background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' };
  const paneTitleStyle = { fontSize: '17px', marginBottom: '14px' };

  // #25 — הרשאת "מנהל" לסימון הודעות הנהלה כטופל: roleId 1 (מנהל) / 0 (הנהלה
  // ראשית) / 2 (מתכנת) — תואם ROLE_LEVELS['מנהל'] כפי שמוגדר ב-lib/auth.js.
  const isManagerRole = currentUser && [0, 1, 2].includes(currentUser.roleId);

  const formatNoteAuthor = (notif) => notif.sender ? `${notif.sender.firstName || ''} ${notif.sender.lastName || ''}`.trim() : 'מערכת הגמ"ח';

  const renderShiftNoteCard = (notif) => (
    <div key={notif.id} className="card card-pad" style={!notif.isRead ? { background: 'var(--primary-tint)', borderColor: 'var(--primary)' } : undefined}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div className="avatar">{formatNoteAuthor(notif).charAt(0) || 'מ'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h3 style={{ fontSize: '14.5px', margin: 0 }}>{formatNoteAuthor(notif)}</h3>
            <span className="hint" style={{ color: 'var(--text-3)' }}>{new Date(notif.createdAt).toLocaleString('he-IL')}</span>
            <div style={{ marginInlineStart: 'auto' }}>
              {notif.isRead ? (
                <span className="badge badge-success">
                  <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-check" /></svg>
                  אושרה קריאה
                </span>
              ) : (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => markAsRead(notif.id)}>
                  <svg className="icon"><use href="#i-check" /></svg>
                  אשר קריאה
                </button>
              )}
            </div>
          </div>
          <p style={{ margin: '10px 0 0', color: 'var(--text)', fontSize: '13.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{notif.content}</p>
        </div>
      </div>
    </div>
  );

  const renderManagementNoteCard = (notif) => {
    const isHandled = !!notif.handledAt;
    return (
      <div key={notif.id} className="card card-pad" style={isHandled ? undefined : { background: 'var(--warning-tint)', borderColor: 'var(--warning)' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div className="avatar">{formatNoteAuthor(notif).charAt(0) || 'מ'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '14.5px', margin: 0 }}>{formatNoteAuthor(notif)}</h3>
              <span className="hint" style={{ color: 'var(--text-3)' }}>{new Date(notif.createdAt).toLocaleString('he-IL')}</span>
              <div style={{ display: 'flex', gap: '6px', marginInlineStart: 'auto', flexWrap: 'wrap', alignItems: 'center' }}>
                {isHandled ? (
                  <span className="badge badge-success" title={notif.handledBy ? `טופל ע"י ${notif.handledBy.firstName || ''} ${notif.handledBy.lastName || ''}`.trim() : undefined}>
                    <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-check-circle" /></svg>
                    טופל
                  </span>
                ) : (
                  <span className="badge badge-warning">ממתין לטיפול</span>
                )}
                {isManagerRole && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleToggleHandled(notif.id, !isHandled)}
                    title={isHandled ? 'בטל סימון טופל' : 'סמן כטופל'}
                  >
                    {isHandled ? 'בטל טופל' : 'סמן כטופל'}
                  </button>
                )}
              </div>
            </div>
            <p style={{ margin: '10px 0 0', color: 'var(--text)', fontSize: '13.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{notif.content}</p>
          </div>
        </div>
      </div>
    );
  };

  const renderTags = (notif) => {
    const tags = notif.personalTags || [];
    const inputVal = tagInputs[notif.id] || '';

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '12px' }}>
        <svg className="icon" style={{ width: '13px', height: '13px', color: 'var(--text-3)' }}><use href="#i-tag" /></svg>
        {tags.map((tag, idx) => (
          <span key={idx} className="chip">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(notif, tag)}
              title="הסר תגית"
              style={{ background: 'none', border: 'none', padding: 0, marginInlineStart: '4px', cursor: 'pointer', color: 'var(--text-3)', display: 'inline-flex' }}
            >
              <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-x" /></svg>
            </button>
          </span>
        ))}
        <span className="chip" style={{ gap: '4px', paddingInlineEnd: '4px' }}>
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
            style={{ border: 'none', background: 'transparent', outline: 'none', font: 'inherit', fontSize: '12px', width: '70px', color: 'var(--text)' }}
          />
          <button
            type="button"
            onClick={() => addTag(notif, inputVal)}
            title="שמור תגית"
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--primary-solid)', display: 'inline-flex' }}
          >
            <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-plus" /></svg>
          </button>
        </span>
      </div>
    );
  };

  const renderMessageCard = (notif, type) => {
    const isUnread = type === 'incoming' && !notif.isRead;
    const isBroadcast = notif.receiverId === null;
    return (
      <div
        key={notif.id}
        className="card card-pad"
        style={isUnread ? { background: 'var(--primary-tint)', borderColor: 'var(--primary)' } : undefined}
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div className="avatar" style={isBroadcast ? { background: 'var(--warning-tint)', color: 'var(--warning)' } : undefined}>
            {type === 'outgoing'
              ? <svg className="icon"><use href="#i-user" /></svg>
              : (notif.sender ? notif.sender.firstName.charAt(0) : 'מ')}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: '14.5px', margin: 0 }}>
                {type === 'outgoing'
                  ? `אל: ${notif.receiverId === null ? 'כל העובדים' : (notif.receiver ? `${notif.receiver.firstName} ${notif.receiver.lastName}` : 'לא ידוע')}`
                  : (notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת הגמ"ח')}
              </h3>
              <span className="hint" style={{ color: 'var(--text-3)' }}>
                {new Date(notif.createdAt).toLocaleString('he-IL')}
              </span>
              {isBroadcast && <span className="badge badge-warning">הודעה לכולם</span>}

              <div style={{ display: 'flex', gap: '6px', marginInlineStart: 'auto', flexWrap: 'wrap' }}>
                {isUnread && (
                  <button type="button" className="btn btn-secondary btn-sm" title="סמן כנקרא" onClick={() => markAsRead(notif.id)}>
                    <svg className="icon"><use href="#i-check" /></svg>
                    סמן כנקרא
                  </button>
                )}
                {notif.isArchived ? (
                  <button type="button" className="btn btn-secondary btn-sm" title="החזר מארכיון" onClick={() => handleArchive(notif.id, false)}>
                    <svg className="icon"><use href="#i-refresh" /></svg>
                    שחזר
                  </button>
                ) : (
                  <button type="button" className="btn btn-secondary btn-sm" title="העבר לארכיון" onClick={() => handleArchive(notif.id, true)}>
                    <svg className="icon"><use href="#i-folder" /></svg>
                    ארכיון
                  </button>
                )}
              </div>
            </div>
            <p style={{ margin: '10px 0 0', color: 'var(--text)', fontSize: '13.5px', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
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

  return (
    <>
      <div className="page-head">
        <div>
          <h1>מרכז הודעות</h1>
          <div className="page-desc">נהל את ההתראות וההודעות הפנימיות שלך</div>
        </div>
      </div>

      <div className="tabs">
        <button type="button" className={activeTab === 'incoming' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('incoming')} title="דואר נכנס">
          <svg className="icon"><use href="#i-mail" /></svg>
          נכנסות
          {unreadCount > 0 && <span className="badge badge-danger" style={{ marginInlineStart: '4px' }}>{unreadCount}</span>}
        </button>
        <button type="button" className={activeTab === 'outgoing' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('outgoing')} title="דואר יוצא">
          <svg className="icon"><use href="#i-message" /></svg>
          יוצאות
          {outgoing.length > 0 && <span className="badge badge-neutral" style={{ marginInlineStart: '4px' }}>{outgoing.length}</span>}
        </button>
        <button type="button" className={activeTab === 'archived' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('archived')} title="ארכיון הודעות">
          <svg className="icon"><use href="#i-folder" /></svg>
          ארכיון
          {archived.length > 0 && <span className="badge badge-neutral" style={{ marginInlineStart: '4px' }}>{archived.length}</span>}
        </button>
        {shiftHandoverEnabled && (
          <button type="button" className={activeTab === 'shift' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('shift')} title="הודעות בין משמרות">
            <svg className="icon"><use href="#i-refresh" /></svg>
            בין משמרות
            {shiftHandoverNotes.filter(n => !n.isRead).length > 0 && <span className="badge badge-danger" style={{ marginInlineStart: '4px' }}>{shiftHandoverNotes.filter(n => !n.isRead).length}</span>}
          </button>
        )}
        {managementMessagesEnabled && (
          <button type="button" className={activeTab === 'management' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('management')} title="הודעות להנהלה">
            <svg className="icon"><use href="#i-alert-circle" /></svg>
            להנהלה
            {managementNotes.filter(n => !n.handledAt).length > 0 && <span className="badge badge-warning" style={{ marginInlineStart: '4px' }}>{managementNotes.filter(n => !n.handledAt).length}</span>}
          </button>
        )}
        <button type="button" className={activeTab === 'settings' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('settings')} title="הגדרות התראות">
          <svg className="icon"><use href="#i-settings" /></svg>
          הגדרות
        </button>
        <button type="button" className={activeTab === 'compose' ? 'tab active' : 'tab'} style={tabResetStyle} onClick={() => setActiveTab('compose')} title="הודעה חדשה">
          <svg className="icon"><use href="#i-plus" /></svg>
          הודעה חדשה
        </button>
      </div>

      {/* INCOMING TAB */}
      {activeTab === 'incoming' && (
        <div>
          <h2 style={paneTitleStyle}>דואר נכנס</h2>
          <div className="input-icon-wrap" style={{ maxWidth: '420px', marginBottom: '18px' }}>
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              className="input"
              placeholder="חיפוש בהודעות (תוכן, שולח, תגית)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {visibleIncoming.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-mail" /></svg>
              <p>{incoming.length === 0 ? 'תיבת הדואר הנכנס ריקה' : 'לא נמצאו הודעות תואמות לחיפוש'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visibleIncoming.map(notif => renderMessageCard(notif, 'incoming'))}
            </div>
          )}
        </div>
      )}

      {/* OUTGOING TAB */}
      {activeTab === 'outgoing' && (
        <div>
          <h2 style={paneTitleStyle}>דואר יוצא</h2>
          <div className="input-icon-wrap" style={{ maxWidth: '420px', marginBottom: '18px' }}>
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              className="input"
              placeholder="חיפוש בהודעות (תוכן, שולח, תגית)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {visibleOutgoing.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-message" /></svg>
              <p>{outgoing.length === 0 ? 'לא שלחת הודעות עדיין' : 'לא נמצאו הודעות תואמות לחיפוש'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {visibleOutgoing.map(notif => renderMessageCard(notif, 'outgoing'))}
            </div>
          )}
        </div>
      )}

      {/* #24 — SHIFT HANDOVER TAB: הודעות בין משמרות, שידור לכולם, "אשר קריאה" פר-עובד */}
      {activeTab === 'shift' && shiftHandoverEnabled && (
        <div>
          <h2 style={paneTitleStyle}>הודעות בין משמרות</h2>
          <div className="card card-pad" style={{ maxWidth: '560px', marginBottom: '20px' }}>
            <div className="field">
              <label htmlFor="shift-note-content">הודעה חדשה למשמרת הבאה:</label>
              <textarea
                id="shift-note-content"
                className="textarea"
                value={shiftNoteText}
                onChange={e => setShiftNoteText(e.target.value)}
                placeholder="לדוגמה: 3 שמלות בייבוש, אין להשכיר מידה 40 עד שיתייבשו..."
                style={{ minHeight: '90px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={handleSendShiftNote} disabled={isSendingShiftNote || !shiftNoteText.trim()}>
                {isSendingShiftNote ? 'שולח...' : (<><svg className="icon"><use href="#i-plus" /></svg>הוסף הודעה</>)}
              </button>
            </div>
          </div>

          {shiftHandoverNotes.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-refresh" /></svg>
              <p>אין הודעות בין משמרות כרגע</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {shiftHandoverNotes.map(renderShiftNoteCard)}
            </div>
          )}
        </div>
      )}

      {/* #25 — MANAGEMENT TAB: הודעות להנהלה, שידור לכולם, "סמן כטופל" למנהלים בלבד */}
      {activeTab === 'management' && managementMessagesEnabled && (
        <div>
          <h2 style={paneTitleStyle}>הודעות להנהלה</h2>
          <div className="card card-pad" style={{ maxWidth: '560px', marginBottom: '20px' }}>
            <div className="field">
              <label htmlFor="management-note-content">הודעה/שאלה חדשה להנהלה:</label>
              <textarea
                id="management-note-content"
                className="textarea"
                value={managementNoteText}
                onChange={e => setManagementNoteText(e.target.value)}
                placeholder="לדוגמה: לקוחה X התלוננה על Y / שאלת מדיניות..."
                style={{ minHeight: '90px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-primary" onClick={handleSendManagementNote} disabled={isSendingManagementNote || !managementNoteText.trim()}>
                {isSendingManagementNote ? 'שולח...' : (<><svg className="icon"><use href="#i-plus" /></svg>שלח להנהלה</>)}
              </button>
            </div>
          </div>

          {managementNotes.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              <p>אין הודעות להנהלה כרגע</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {managementNotes.map(renderManagementNoteCard)}
            </div>
          )}
        </div>
      )}

      {/* ARCHIVED TAB */}
      {activeTab === 'archived' && (
        <div>
          <h2 style={paneTitleStyle}>ארכיון הודעות</h2>
          <div className="input-icon-wrap" style={{ maxWidth: '420px', marginBottom: '18px' }}>
            <svg className="icon"><use href="#i-search" /></svg>
            <input
              type="text"
              className="input"
              placeholder="חיפוש בהודעות (תוכן, שולח, תגית)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {visibleArchived.length === 0 ? (
            <div className="empty-state">
              <svg className="icon"><use href="#i-folder" /></svg>
              <p>{archived.length === 0 ? 'אין הודעות בארכיון' : 'לא נמצאו הודעות תואמות לחיפוש'}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
            <div className="callout callout-danger" style={{ marginBottom: '20px', maxWidth: '560px' }}>
              <svg className="icon"><use href="#i-alert-circle" /></svg>
              {error}
            </div>
          )}

          {sendSuccess && (
            <div className="callout callout-success" style={{ marginBottom: '20px', maxWidth: '560px' }}>
              <svg className="icon"><use href="#i-check-circle" /></svg>
              ההודעה נשלחה בהצלחה!
            </div>
          )}

          <div className="card card-pad" style={{ maxWidth: '560px' }}>
            <div className="field">
              <label htmlFor="messages-receiver">שלח אל:</label>
              <select
                id="messages-receiver"
                className="select"
                value={receiverId}
                onChange={e => setReceiverId(e.target.value)}
              >
                <option value="all">כל העובדים במערכת (הודעה כללית)</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label htmlFor="messages-content">תוכן ההודעה:</label>
              <textarea
                id="messages-content"
                className="textarea"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="הקלד את הודעתך כאן..."
                style={{ minHeight: '150px' }}
              />
            </div>

            <div className="checkbox-row" style={{ marginBottom: '20px' }}>
              <input
                type="checkbox"
                id="messages-send-email"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary-solid)' }}
              />
              <label htmlFor="messages-send-email">שלח התראה גם למייל (לעובדים בעלי כתובת מייל מעודכנת)</label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
                disabled={isSending}
                title="שלח הודעה"
              >
                {isSending ? 'שולח...' : (<><svg className="icon"><use href="#i-mail" /></svg>שלח הודעה</>)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div>
          <h2 style={paneTitleStyle}>הגדרות התראות</h2>

          <div className="card card-pad" style={{ maxWidth: '560px' }}>
            <div className="card-title-row" style={{ marginBottom: '14px' }}>
              <svg className="icon"><use href="#i-mail" /></svg>
              <h3 style={{ margin: 0 }}>התראות במייל</h3>
            </div>

            {currentUser ? (
              <div>
                {currentUser.email ? (
                  <p style={{ color: 'var(--text-2)', fontSize: '13.5px', marginBottom: '18px' }}>
                    המייל המעודכן שלך במערכת הוא: <strong dir="ltr" style={{ color: 'var(--text)' }}>{currentUser.email}</strong>
                  </p>
                ) : (
                  <p style={{ color: 'var(--danger)', fontSize: '13.5px', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg className="icon"><use href="#i-alert-circle" /></svg>
                    לא מוגדרת עבורך כתובת מייל במערכת. אנא פנה למנהל לעדכון המייל.
                  </p>
                )}

                <div className="checkbox-row">
                  <input
                    type="checkbox"
                    id="messages-receive-alerts"
                    checked={currentUser.receiveEmailAlerts || false}
                    onChange={(e) => handleSaveSettings(e.target.checked)}
                    disabled={isSavingSettings || !currentUser.email}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-solid)' }}
                  />
                  <label htmlFor="messages-receive-alerts">קבל התראות למייל על הודעות חדשות</label>
                </div>
                {isSavingSettings && <span style={{ fontSize: '12.5px', color: 'var(--primary-solid)', marginTop: '8px', display: 'block' }}>שומר שינויים...</span>}
              </div>
            ) : (
              <p style={{ color: 'var(--text-2)' }}>טוען נתוני עובד...</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
