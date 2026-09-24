'use client';

import React, { useState, useEffect } from 'react';
import { cacheNamespace, fetchJson } from '@/app/lib/pageCache';
import { V3Page, Card, Btn, IconBtn, Field, Chip, Tabs, Switch, Tip, Empty } from '@/app/v3/ui/components';
import Icon from '@/app/v3/ui/Icon';

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
      setError('הנתונים לא נטענו. נסו לרענן.');
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
        setError(data.error || 'ההודעה לא נשלחה. נסו שוב.');
      }
    } catch (err) {
      setError('אין תקשורת עם השרת. נסו שוב.');
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
        setError(data.error || 'ההודעה לא נשלחה. נסו שוב.');
      }
    } catch (err) {
      setError('אין תקשורת עם השרת. נסו שוב.');
    } finally {
      setIsSendingManagementNote(false);
    }
  };

  // #24/#25 — סימון/ביטול "טופל": הודעות הנהלה מוגבלות לתפקיד מנהל (השרת אוכף
  // checkAuth('מנהל') שוב), הודעות בין משמרות פתוחות לכל עובד מחובר.
  const handleToggleHandled = async (id, handled) => {
    try {
      const res = await fetch('/api/notifications/handle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id, handled })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const updateList = (list) => list.map(n => n.id === id ? { ...n, handledAt: data.notification.handledAt, handledBy: data.notification.handledBy } : n);
        setManagementNotes(updateList);
        setShiftHandoverNotes(updateList);
        messagesCache.delete(MESSAGES_CACHE_KEY);
      } else {
        setError(data.error || 'הסטטוס לא עודכן. נסו שוב.');
      }
    } catch (err) {
      setError('אין תקשורת עם השרת. נסו שוב.');
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
      setError('כתבו את תוכן ההודעה.');
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
        setError(data.error || 'ההודעה לא נשלחה. נסו שוב.');
      }
    } catch (err) {
      setError('אין תקשורת עם השרת. נסו שוב.');
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
      <V3Page>
        <div className="v3-empty" role="status">
          <span className="v3-spin" aria-hidden="true" />
          <span>טוען הודעות</span>
        </div>
      </V3Page>
    );
  }

  // #25 — הרשאת "מנהל" לסימון הודעות הנהלה כטופל: roleId 1 (מנהל) / 0 (הנהלה
  // ראשית) / 2 (מתכנת). תואם את הבדיקה המקומית ב-app/api/notifications/handle/route.js
  // (MANAGEMENT_ROLE_IDS) — לא ROLE_LEVELS['מנהל'] המשותף ב-lib/auth.js, שם [1,2] בלבד.
  const isManagerRole = currentUser && [0, 1, 2].includes(currentUser.roleId);

  const formatNoteAuthor = (notif) => notif.sender ? `${notif.sender.firstName || ''} ${notif.sender.lastName || ''}`.trim() : 'מערכת הגמ"ח';

  const handledByTitle = (notif) => (notif.handledBy ? `טופל ע"י ${notif.handledBy.firstName || ''} ${notif.handledBy.lastName || ''}`.trim() : undefined);

  const renderShiftNoteCard = (notif) => {
    const isHandled = !!notif.handledAt;
    return (
      <Card key={notif.id} variant={!notif.isRead ? 'info' : undefined}>
        <div className="v3-stack">
          <div className="v3-cluster">
            <span className="v3-avatar" aria-hidden="true">{formatNoteAuthor(notif).charAt(0) || 'מ'}</span>
            <b>{formatNoteAuthor(notif)}</b>
          </div>
          <span className="v3-faint v3-text-sm"><bdi>{new Date(notif.createdAt).toLocaleString('he-IL')}</bdi></span>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notif.content}</p>
          <div className="v3-cluster">
            {notif.isRead ? (
              <Chip variant="done" icon="check">נקראה</Chip>
            ) : (
              <Btn size="sm" icon="check" onClick={() => markAsRead(notif.id)}>קראתי</Btn>
            )}
            {isHandled ? (
              <Chip variant="done" icon="check-circle" title={handledByTitle(notif)}>טופלה</Chip>
            ) : (
              <Chip variant="attn">ממתינה לטיפול</Chip>
            )}
            <Btn size="sm" variant="quiet" onClick={() => handleToggleHandled(notif.id, !isHandled)}>
              {isHandled ? 'החזרה לטיפול' : 'סימון כטופלה'}
            </Btn>
          </div>
        </div>
      </Card>
    );
  };

  const renderManagementNoteCard = (notif) => {
    const isHandled = !!notif.handledAt;
    return (
      <Card key={notif.id} className={isHandled ? undefined : 'v3-note--attn'}>
        <div className="v3-stack">
          <div className="v3-cluster">
            <span className="v3-avatar" aria-hidden="true">{formatNoteAuthor(notif).charAt(0) || 'מ'}</span>
            <b>{formatNoteAuthor(notif)}</b>
          </div>
          <span className="v3-faint v3-text-sm"><bdi>{new Date(notif.createdAt).toLocaleString('he-IL')}</bdi></span>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notif.content}</p>
          <div className="v3-cluster">
            {isHandled ? (
              <Chip variant="done" icon="check-circle" title={handledByTitle(notif)}>טופלה</Chip>
            ) : (
              <Chip variant="attn">ממתינה לטיפול</Chip>
            )}
            {isManagerRole && (
              <Btn size="sm" variant="quiet" onClick={() => handleToggleHandled(notif.id, !isHandled)}>
                {isHandled ? 'החזרה לטיפול' : 'סימון כטופלה'}
              </Btn>
            )}
          </div>
        </div>
      </Card>
    );
  };

  const renderTags = (notif) => {
    const tags = notif.personalTags || [];
    const inputVal = tagInputs[notif.id] || '';

    return (
      <div className="v3-cluster">
        <Icon name="tag" size="sm" />
        {tags.map((tag, idx) => (
          <Chip key={idx}>
            {tag}
            <IconBtn icon="x" label="הסרת התגית" variant="quiet" size="sm" onClick={() => removeTag(notif, tag)} />
          </Chip>
        ))}
        <input
          type="text"
          className="v3-input"
          aria-label="תגית חדשה"
          placeholder="תגית חדשה"
          value={inputVal}
          onChange={e => setTagInputs(prev => ({ ...prev, [notif.id]: e.target.value }))}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(notif, inputVal);
            }
          }}
          style={{ flex: 1, minWidth: 0 }}
        />
        <IconBtn icon="plus" label="שמירת התגית" variant="quiet" size="sm" onClick={() => addTag(notif, inputVal)} />
      </div>
    );
  };

  const renderMessageCard = (notif, type) => {
    const isUnread = type === 'incoming' && !notif.isRead;
    const isBroadcast = notif.receiverId === null;
    return (
      <Card key={notif.id} variant={isUnread ? 'info' : undefined}>
        <div className="v3-stack">
          <div className="v3-cluster">
            <span className="v3-avatar" aria-hidden="true">
              {type === 'outgoing'
                ? <Icon name="user" size="xs" />
                : (notif.sender ? notif.sender.firstName.charAt(0) : 'מ')}
            </span>
            <b>
              {type === 'outgoing'
                ? `אל: ${notif.receiverId === null ? 'כל העובדים' : (notif.receiver ? `${notif.receiver.firstName} ${notif.receiver.lastName}` : 'לא ידוע')}`
                : (notif.sender ? `${notif.sender.firstName} ${notif.sender.lastName}` : 'מערכת הגמ"ח')}
            </b>
            {isBroadcast && <Chip variant="gold" icon="users">לכולם</Chip>}
          </div>
          <span className="v3-faint v3-text-sm"><bdi>{new Date(notif.createdAt).toLocaleString('he-IL')}</bdi></span>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{notif.content}</p>
          {renderTags(notif)}
          <div className="v3-cluster">
            {isUnread && (
              <Btn size="sm" icon="check" onClick={() => markAsRead(notif.id)}>סימון כנקראה</Btn>
            )}
            {notif.isArchived ? (
              <Btn size="sm" variant="quiet" icon="refresh" onClick={() => handleArchive(notif.id, false)}>החזרה לתיבה</Btn>
            ) : (
              <Btn size="sm" variant="quiet" icon="folder" onClick={() => handleArchive(notif.id, true)}>לארכיון</Btn>
            )}
          </div>
        </div>
      </Card>
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
  const unreadShiftCount = shiftHandoverNotes.filter(n => !n.isRead).length;
  const openManagementCount = managementNotes.filter(n => !n.handledAt).length;

  const tabItems = [
    { key: 'incoming', label: 'נכנסות', icon: 'mail', count: unreadCount > 0 ? unreadCount : undefined },
    { key: 'outgoing', label: 'יוצאות', icon: 'message', count: outgoing.length > 0 ? outgoing.length : undefined },
    { key: 'archived', label: 'ארכיון', icon: 'folder', count: archived.length > 0 ? archived.length : undefined },
    ...(shiftHandoverEnabled ? [{ key: 'shift', label: 'בין משמרות', icon: 'refresh', count: unreadShiftCount > 0 ? unreadShiftCount : undefined }] : []),
    ...(managementMessagesEnabled ? [{ key: 'management', label: 'להנהלה', icon: 'alert-circle', count: openManagementCount > 0 ? openManagementCount : undefined }] : []),
    { key: 'settings', label: 'הגדרות', icon: 'settings' },
    { key: 'compose', label: 'הודעה חדשה', icon: 'plus' },
  ];

  // שורת חיפוש משותפת (אותו state searchTerm בשלושת הטאבים)
  const searchField = (
    <Field
      label="חיפוש"
      tip="מחפש בתוכן, בשם השולח או המקבל ובתגיות."
      type="text"
      placeholder="מה לחפש?"
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
    />
  );

  return (
    <V3Page>
      <div className="v3-stack">
        <div className="v3-pagehead">
          <div className="v3-pagehead__title">
            <h1 className="v3-h1">הודעות</h1>
            <Tip>הודעות פנימיות בין העובדים, הודעות למשמרת הבאה ופניות להנהלה.</Tip>
          </div>
        </div>

        <Tabs items={tabItems} value={activeTab} onChange={setActiveTab} label="סוגי הודעות" />

        {/* INCOMING TAB */}
        {activeTab === 'incoming' && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-incoming">
            {searchField}
            {visibleIncoming.length === 0 ? (
              <Empty icon="mail" title={incoming.length === 0 ? 'אין הודעות חדשות' : 'לא נמצאו הודעות'} />
            ) : (
              visibleIncoming.map(notif => renderMessageCard(notif, 'incoming'))
            )}
          </div>
        )}

        {/* OUTGOING TAB */}
        {activeTab === 'outgoing' && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-outgoing">
            {searchField}
            {visibleOutgoing.length === 0 ? (
              <Empty icon="message" title={outgoing.length === 0 ? 'עוד לא שלחתם הודעות' : 'לא נמצאו הודעות'} />
            ) : (
              visibleOutgoing.map(notif => renderMessageCard(notif, 'outgoing'))
            )}
          </div>
        )}

        {/* #24 — SHIFT HANDOVER TAB: הודעות בין משמרות, שידור לכולם, "אשר קריאה" פר-עובד */}
        {activeTab === 'shift' && shiftHandoverEnabled && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-shift">
            <Card icon="refresh" title="הודעה למשמרת הבאה" tip="ההודעה מגיעה לכל העובדים.">
              <div className="v3-stack">
                <Field
                  as="textarea"
                  id="shift-note-content"
                  label="מה חשוב להעביר?"
                  value={shiftNoteText}
                  onChange={e => setShiftNoteText(e.target.value)}
                  placeholder="למשל: שלוש שמלות בייבוש, מידה 40 לא זמינה"
                />
                <div className="v3-cluster">
                  <Btn variant="primary" icon="plus" loading={isSendingShiftNote} disabled={!shiftNoteText.trim()} onClick={handleSendShiftNote}>
                    הוספה
                  </Btn>
                </div>
              </div>
            </Card>

            {shiftHandoverNotes.length === 0 ? (
              <Empty icon="refresh" title="אין הודעות למשמרת" />
            ) : (
              shiftHandoverNotes.map(renderShiftNoteCard)
            )}
          </div>
        )}

        {/* #25 — MANAGEMENT TAB: הודעות להנהלה, שידור לכולם, "סמן כטופל" למנהלים בלבד */}
        {activeTab === 'management' && managementMessagesEnabled && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-management">
            <Card icon="alert-circle" title="פנייה להנהלה" tip="רק מנהלים יכולים לסמן פנייה כטופלה.">
              <div className="v3-stack">
                <Field
                  as="textarea"
                  id="management-note-content"
                  label="מה תרצו להעביר להנהלה?"
                  value={managementNoteText}
                  onChange={e => setManagementNoteText(e.target.value)}
                  placeholder="למשל: שאלה על מדיניות, או תלונה של לקוחה"
                />
                <div className="v3-cluster">
                  <Btn variant="primary" icon="send" loading={isSendingManagementNote} disabled={!managementNoteText.trim()} onClick={handleSendManagementNote}>
                    שליחה
                  </Btn>
                </div>
              </div>
            </Card>

            {managementNotes.length === 0 ? (
              <Empty icon="alert-circle" title="אין פניות להנהלה" />
            ) : (
              managementNotes.map(renderManagementNoteCard)
            )}
          </div>
        )}

        {/* ARCHIVED TAB */}
        {activeTab === 'archived' && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-archived">
            {searchField}
            {visibleArchived.length === 0 ? (
              <Empty icon="folder" title={archived.length === 0 ? 'הארכיון ריק' : 'לא נמצאו הודעות'} />
            ) : (
              visibleArchived.map(notif => renderMessageCard(notif, notif.direction || 'incoming'))
            )}
          </div>
        )}

        {/* COMPOSE TAB */}
        {activeTab === 'compose' && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-compose">
            {error && (
              <div className="v3-banner v3-banner--alert" role="alert">
                <div className="v3-banner__main">
                  <span className="v3-banner__ic"><Icon name="alert-circle" /></span>
                  <div className="v3-banner__msg"><span>{error}</span></div>
                </div>
              </div>
            )}

            {sendSuccess && (
              <div className="v3-banner v3-banner--success" role="status">
                <div className="v3-banner__main">
                  <span className="v3-banner__ic"><Icon name="check-circle" /></span>
                  <div className="v3-banner__msg"><span>ההודעה נשלחה</span></div>
                </div>
              </div>
            )}

            <Card icon="send" title="הודעה חדשה">
              <div className="v3-stack">
                <Field
                  as="select"
                  id="messages-receiver"
                  label="למי לשלוח?"
                  value={receiverId}
                  onChange={e => setReceiverId(e.target.value)}
                >
                  <option value="all">כל העובדים</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </Field>

                <Field
                  as="textarea"
                  id="messages-content"
                  label="ההודעה"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="כתבו כאן"
                />

                <div className="v3-cluster">
                  <Switch
                    id="messages-send-email"
                    checked={sendEmail}
                    onChange={setSendEmail}
                    label="לשלוח גם במייל"
                  />
                  <Tip>המייל יישלח רק לעובדים שיש להם כתובת מייל מעודכנת.</Tip>
                </div>

                <div className="v3-cluster">
                  <Btn variant="primary" icon="send" loading={isSending} onClick={handleSend} title="שליחת ההודעה">
                    שליחה
                  </Btn>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="v3-stack" role="tabpanel" aria-labelledby="tab-settings">
            <Card icon="mail" title="התראות במייל">
              {currentUser ? (
                <div className="v3-stack">
                  {currentUser.email ? (
                    <div className="v3-stack">
                      <span className="v3-label">כתובת המייל שלך</span>
                      <b dir="ltr"><bdi>{currentUser.email}</bdi></b>
                    </div>
                  ) : (
                    <div className="v3-banner v3-banner--warning" role="status">
                      <div className="v3-banner__main">
                        <span className="v3-banner__ic"><Icon name="alert-tri" /></span>
                        <div className="v3-banner__msg"><span>אין כתובת מייל בחשבון שלך. כדי להוסיף אחת, פנו למנהל.</span></div>
                      </div>
                    </div>
                  )}

                  <Switch
                    id="messages-receive-alerts"
                    checked={currentUser.receiveEmailAlerts || false}
                    onChange={(checked) => handleSaveSettings(checked)}
                    disabled={isSavingSettings || !currentUser.email}
                    label="לקבל מייל על הודעות חדשות"
                  />
                  {isSavingSettings && (
                    <span className="v3-cluster v3-muted" role="status"><span className="v3-spin" aria-hidden="true" />שומר</span>
                  )}
                </div>
              ) : (
                <div className="v3-cluster v3-muted" role="status"><span className="v3-spin" aria-hidden="true" />טוען</div>
              )}
            </Card>
          </div>
        )}
      </div>
    </V3Page>
  );
}
