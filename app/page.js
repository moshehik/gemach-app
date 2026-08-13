'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { HDate } from '@hebcal/core';
import { fetchJson, getSettingsCached } from '@/app/lib/pageCache';

// Hrefs among QUICK_LINKS below that mirror a gated item in navConfig.js's sidebar
// (same rules RootLayout computes server-side: showAdminTab-equivalent for the
// revenue dashboard, hideInternalMessaging for messages) - unlike the sidebar,
// this card grid had no gating at all, so every employee saw links straight to
// revenue data and (when the org disabled messaging) the messages page anyway.
const QUICK_LINK_VISIBILITY = {
  '/dashboard': 'manager',
  '/messages': 'messagingEnabled',
};

// דפים שהוצאו מהתפריט הצדדי (2026-08-08, צומצם ל-11 הפריטים שהיו בתפריט
// הראשי הישן) אבל אינם קשורי-ניהול — קיצורי דרך אליהם כאן במקום זאת, בטקסט/
// אייקון החדשים כמו ב-navConfig.js. תתי-הדפים של אזור הניהול עברו ל-/admin.
const QUICK_LINKS = [
  { href: '/dashboard', label: 'לוח בקרה', icon: 'i-grid' },
  { href: '/orders/new', label: 'הזמנה חדשה', icon: 'i-plus' },
  { href: '/dashboard/pricelist', label: 'מחירון', icon: 'i-coin' },
  { href: '/employees/report', label: 'דוח נוכחות', icon: 'i-activity' },
  { href: '/messages', label: 'הודעות', icon: 'i-message' },
  { href: '/profile', label: 'הפרופיל שלי', icon: 'i-user' },
  { href: '/punch-clock', label: 'שעון נוכחות', icon: 'i-clock' },
  { href: '/display-settings', label: 'עיצוב ותצוגה', icon: 'i-settings' },
];

export default function HomeDashboard() {
  const router = useRouter();
  const chatEndRef = useRef(null);

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  // Show More states
  const [showMoreCustomers, setShowMoreCustomers] = useState(false);
  const [showMoreOrders, setShowMoreOrders] = useState(false);
  const [showMoreRentals, setShowMoreRentals] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);

  // AI Chat state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiReplyInput, setAiReplyInput] = useState('');

  // Dashboard state
  const [recentSearches, setRecentSearches] = useState([]);

  // Quick-link visibility: starts fail-closed (both gated links hidden) until we
  // know the employee's role and the messaging setting, so a non-manager never
  // even briefly sees a card pointing at revenue data.
  const [quickLinkFlags, setQuickLinkFlags] = useState({ manager: false, messagingEnabled: false });
  useEffect(() => {
    Promise.all([
      fetchJson('/api/me').catch(() => ({ success: false })),
      getSettingsCached().catch(() => []),
    ]).then(([me, settings]) => {
      const isManager = !!(me?.success && me.employee && (me.employee.roleId === 1 || me.employee.roleId === 2));
      const requireLoginSetting = Array.isArray(settings) ? settings.find(s => s.key === 'require_login') : null;
      const requireLogin = !!(requireLoginSetting && requireLoginSetting.value === 'true');
      const hideMessagingSetting = Array.isArray(settings) ? settings.find(s => s.key === 'hide_internal_messaging') : null;
      const hideMessaging = !!(hideMessagingSetting && hideMessagingSetting.value === 'true');
      setQuickLinkFlags({
        // Same rule as checkPageAccess(): a logged-in employee is judged by role
        // regardless of require_login; an anonymous visitor only passes while
        // require_login is off.
        manager: me?.success ? isManager : !requireLogin,
        messagingEnabled: !hideMessaging,
      });
    });
  }, []);
  const visibleQuickLinks = QUICK_LINKS.filter((link) => {
    const requirement = QUICK_LINK_VISIBILITY[link.href];
    if (!requirement) return true;
    return !!quickLinkFlags[requirement];
  });

  // מצב תצוגת סרגל החיפוש (חיפוש רגיל / חכם AI) — מחליף את הלוגיקה הפנימית שהייתה
  // חבויה בתוך רכיב AISearchBar הישן; ההתנהגות זהה, רק המבנה/הסגנון עברו לעיצוב החדש.
  const [aiInputMode, setAiInputMode] = useState(false);
  const [aiInputText, setAiInputText] = useState('');

  const parseMessageToLinks = (text) => {
    if (!text) return null;
    const parts = text.split(/(הזמנה\s*\d+|לקוח\s*[\w-]+)/g);
    return parts.map((part, i) => {
      let match = part.match(/הזמנה\s*(\d+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/orders/${match[1]}`}
            target="_blank"
            className="chip"
            style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)', border: 'none', fontWeight: 'bold', margin: '0 4px' }}
          >
            {part}
          </a>
        );
      }
      match = part.match(/לקוח\s*([\w-]+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/customers/${match[1]}`}
            target="_blank"
            className="chip"
            style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)', border: 'none', fontWeight: 'bold', margin: '0 4px' }}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const [copiedAiIdx, setCopiedAiIdx] = useState(null);
  const copyBubbleText = async (idx, text) => {
    try {
      await navigator.clipboard.writeText(text || '');
      setCopiedAiIdx(idx);
      setTimeout(() => setCopiedAiIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      // clipboard permission denied or unavailable — silently ignore
    }
  };

  useEffect(() => {
    // Load from local storage
    const savedSearchInput = sessionStorage.getItem('dashboardSearchInput');
    const savedSearchResults = sessionStorage.getItem('dashboardSearchResults');
    if (savedSearchInput) setSearchInput(savedSearchInput);
    if (savedSearchResults) setSearchResults(JSON.parse(savedSearchResults));

    const savedAi = localStorage.getItem('dashboardAiMessages');
    if (savedAi) {
      setAiMessages(JSON.parse(savedAi));
    }

    const savedRecentSearches = localStorage.getItem('dashboardRecentSearches');
    if (savedRecentSearches) {
      setRecentSearches(JSON.parse(savedRecentSearches));
    }
  }, []);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [aiMessages]);



  const handleGlobalSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) return;

    setLoadingSearch(true);
    setAiMessages([]);
    localStorage.removeItem('dashboardAiMessages');

    try {
      const res = await fetch(`/api/global-search?q=${encodeURIComponent(searchInput)}`);
      const data = await res.json();
      setSearchResults(data);
      sessionStorage.setItem('dashboardSearchInput', searchInput);
      sessionStorage.setItem('dashboardSearchResults', JSON.stringify(data));

      const newRecentSearches = [searchInput, ...recentSearches.filter(s => s !== searchInput)].slice(0, 5);
      setRecentSearches(newRecentSearches);
      localStorage.setItem('dashboardRecentSearches', JSON.stringify(newRecentSearches));

      setShowMoreCustomers(false);
      setShowMoreOrders(false);
      setShowMoreRentals(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleAiSearch = async (query, isReply = false) => {
    if (!query.trim()) return;
    setAiLoading(true);

    if (!isReply) {
      setSearchResults(null);
      sessionStorage.removeItem('dashboardSearchResults');
      sessionStorage.setItem('dashboardSearchInput', query.trim());
      setSearchInput(query.trim());
    }

    const newMessage = { role: 'user', content: query };
    const updatedMessages = isReply ? [...aiMessages, newMessage] : [newMessage];
    setAiMessages(updatedMessages);
    localStorage.setItem('dashboardAiMessages', JSON.stringify(updatedMessages));
    setAiReplyInput('');

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: query,
          context: 'User is in the general system home dashboard.',
          history: updatedMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
        })
      });
      const result = await res.json();
      if (res.ok) {
        const finalMessages = [...updatedMessages, { role: 'model', content: result.response, data: result.data }];
        setAiMessages(finalMessages);
        localStorage.setItem('dashboardAiMessages', JSON.stringify(finalMessages));
      } else {
        const errMessages = [...updatedMessages, { role: 'model', content: 'שגיאה בחיפוש חכם.' }];
        setAiMessages(errMessages);
      }
    } catch (e) {
      console.error(e);
      const errMessages = [...updatedMessages, { role: 'model', content: 'שגיאת תקשורת.' }];
      setAiMessages(errMessages);
    } finally {
      setAiLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchResults(null);
    setAiMessages([]);
    localStorage.removeItem('dashboardAiMessages');
    sessionStorage.removeItem('dashboardSearchInput');
    sessionStorage.removeItem('dashboardSearchResults');
  };

  const clearAiChat = () => {
    setAiMessages([]);
    localStorage.removeItem('dashboardAiMessages');
  };

  const exportTableToExcel = async (data, filename) => {
    // xlsx (~900KB) נטען דינמית רק בלחיצה על "הורד Excel" — לא חלק מה-bundle של דף הבית
    const XLSX = await import('xlsx');
    const cleanedData = data.map(row => {
      const cleanRow = { ...row };
      Object.keys(cleanRow).forEach(key => {
        if (key.startsWith('_action')) delete cleanRow[key];
      });
      return cleanRow;
    });
    const ws = XLSX.utils.json_to_sheet(cleanedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "נתונים");
    XLSX.writeFile(wb, filename + '.xlsx');
  };

  const renderStatusIcon = (status) => {
    const map = {
      'הוחזר': { icon: 'i-check-circle', color: 'var(--success)' },
      'מושכר': { icon: 'i-tag', color: 'var(--warning)' },
      'בוטל': { icon: 'i-x-circle', color: 'var(--danger)' },
      'שולם': { icon: 'i-check', color: 'var(--info)' },
    };
    const { icon, color } = map[status] || { icon: 'i-clock', color: 'var(--text-3)' };
    return (
      <span title={status || 'פעיל'} style={{ display: 'inline-flex', color, flex: '0 0 auto' }}>
        <svg className="icon" style={{ width: '14px', height: '14px' }}><use href={`#${icon}`} /></svg>
      </span>
    );
  };

  // מעבר בין מצב חיפוש רגיל למצב חיפוש חכם (AI) בסרגל החיפוש, תוך שמירה
  // על הטקסט שהוקלד בכל מצב כדי לא לאבד אותו במעבר ביניהם.
  const toggleAiInputMode = () => {
    if (!aiInputMode) {
      setAiInputText(searchInput || '');
    } else {
      setSearchInput(aiInputText || '');
    }
    setAiInputMode(v => !v);
  };

  const handleAiInputSubmit = (e) => {
    e.preventDefault();
    if (!aiInputText.trim()) return;
    handleAiSearch(aiInputText, false);
  };

  const isInitialState = !searchResults && aiMessages.length === 0;

  return (
    <div
      style={{
        paddingTop: isInitialState ? '16vh' : '4px',
        paddingBottom: aiMessages.length > 0 ? '110px' : '20px',
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        transition: 'padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    >

      {/* Header & Search */}
      <div style={{ marginBottom: '32px', textAlign: 'center' }}>
        <h1 style={{ marginBottom: '20px' }}>ברוכים הבאים למערכת ניהול הגמ&quot;ח</h1>
        <div className="card card-pad" style={{ maxWidth: '800px', margin: '0 auto' }}>
          {aiInputMode ? (
            <form onSubmit={handleAiInputSubmit} className="search-toolbar" style={{ maxWidth: 'none' }}>
              {(aiLoading && aiMessages.length === 0)
                ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
                : <svg className="icon" style={{ color: 'var(--primary-solid)' }}><use href="#i-star" /></svg>}
              <input
                type="text"
                value={aiInputText}
                onChange={(e) => setAiInputText(e.target.value)}
                placeholder="בקש מה-AI למצוא נתונים (למשל: 'הזמנות של משפחת שיינועטר')..."
                disabled={aiLoading}
              />
              <div className="search-toolbar-actions">
                {aiInputText && !aiLoading && (
                  <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה" onClick={() => setAiInputText('')}>
                    <svg className="icon"><use href="#i-x" /></svg>
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" style={{ color: 'var(--primary-solid)', background: 'var(--primary-tint)' }} onClick={toggleAiInputMode}>
                  <svg className="icon"><use href="#i-star" /></svg>
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={aiLoading}>
                  {aiLoading ? 'מייצר שאילתה...' : 'חפש בחכמה'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleGlobalSearch} className="search-toolbar" style={{ maxWidth: 'none' }}>
              {loadingSearch
                ? <span className="spinner" style={{ width: '15px', height: '15px', borderWidth: '2px' }} />
                : <svg className="icon"><use href="#i-search" /></svg>}
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="דוגמא משפחת כהן..."
                disabled={loadingSearch}
              />
              <div className="search-toolbar-actions">
                {searchInput && !loadingSearch && (
                  <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה חיפוש" onClick={clearSearch}>
                    <svg className="icon"><use href="#i-x" /></svg>
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="חיפוש חכם (AI)" onClick={toggleAiInputMode}>
                  <svg className="icon" style={{ color: 'var(--accent)' }}><use href="#i-star" /></svg>
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={loadingSearch}>חיפוש</button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Quick Links */}
      {isInitialState && (
        <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto 32px' }}>
          <div className="section-title">קישורים מהירים</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
            {visibleQuickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="list-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                <svg className="icon" style={{ color: 'var(--text-3)' }}><use href={`#${link.icon}`} /></svg>
                <span style={{ fontWeight: 600, fontSize: '13px' }}>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* AI Response Area */}
      {aiMessages.length > 0 && (
        <div className="card card-pad" style={{ maxWidth: '800px', width: '100%', margin: '0 auto 32px', borderColor: 'var(--primary-tint-2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <div className="card-title-row" style={{ color: 'var(--primary-solid)', fontWeight: 800 }}>
              <svg className="icon" style={{ color: 'var(--primary-solid)' }}><use href="#i-star" /></svg>
              <span style={{ fontSize: '1.05rem' }}>צ&apos;אט חכם מבוסס AI:</span>
            </div>
            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="נקה צ&apos;אט" onClick={clearAiChat}>
              <svg className="icon"><use href="#i-x" /></svg>
            </button>
          </div>

          <div className="chat-thread" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            {aiMessages.map((msg, idx) => (
              <div key={idx} className={`bubble ${msg.role === 'user' ? 'user' : 'assistant'}`}>
                <button
                  type="button"
                  className={`bubble-copy-btn${copiedAiIdx === idx ? ' copied' : ''}`}
                  title="העתק"
                  onClick={() => copyBubbleText(idx, msg.content)}
                >
                  <svg className="icon"><use href={`#${copiedAiIdx === idx ? 'i-check' : 'i-copy'}`} /></svg>
                </button>
                <div style={{ whiteSpace: 'pre-wrap' }}>{parseMessageToLinks(msg.content)}</div>
                {msg.data && msg.data.length > 0 && (
                  <div style={{ marginTop: '10px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ marginBottom: '10px' }} onClick={() => exportTableToExcel(msg.data, 'AI_Export')}>
                      <svg className="icon"><use href="#i-download" /></svg> הורד Excel
                    </button>
                    <div className="table-wrap">
                      <div className="table-scroll">
                      <table className="data">
                        <thead>
                          <tr>
                            {Object.keys(msg.data[0])
                              .filter(k => !k.startsWith('_action'))
                              .map(k => <th key={k}>{k}</th>)}
                            {msg.data.some(r => r._actionUrl) && <th>פעולות</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.slice(0, 15).map((row, rIdx) => (
                            <tr key={rIdx}>
                              {Object.entries(row)
                                .filter(([k]) => !k.startsWith('_action'))
                                .map(([k, val], vIdx) => <td key={vIdx}>{val}</td>)}
                              {msg.data.some(r => r._actionUrl) && (
                                <td>
                                  {row._actionUrl && row._actionLabel ? (
                                    <Link href={row._actionUrl} target="_blank" className="btn btn-secondary btn-sm">
                                      {row._actionLabel}
                                    </Link>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      </div>
                      {msg.data.length > 15 && (
                        <div style={{ textAlign: 'center', padding: '8px', color: 'var(--text-3)', fontStyle: 'italic' }}>
                          מציג 15 תוצאות ראשונות (הורד קובץ לצפייה במלא)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div className="bubble assistant" style={{ padding: 0 }}>
                <div className="typing-indicator"><span></span><span></span><span></span></div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* Floating Chat Input */}
      {aiMessages.length > 0 && (
        <div className="card" style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '800px', padding: '10px', borderRadius: 'var(--radius-full)', borderColor: 'var(--primary-tint-2)', boxShadow: 'var(--shadow-lg)', zIndex: 1000, display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="text"
            value={aiReplyInput}
            onChange={(e) => setAiReplyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) handleAiSearch(aiReplyInput, true); }}
            placeholder="שאל שאלת המשך ל-AI..."
            className="input"
            style={{ flex: 1, border: 'none', borderRadius: 'var(--radius-full)', background: 'var(--primary-tint)', color: 'var(--primary-solid)' }}
            disabled={aiLoading}
          />
          <button type="button" className="btn btn-primary btn-icon-only" title="שלח" onClick={() => handleAiSearch(aiReplyInput, true)} disabled={aiLoading || !aiReplyInput.trim()}>
            <svg className="icon"><use href="#i-chevron-start" /></svg>
          </button>
          <button type="button" className="btn btn-ghost btn-icon-only" title="סגור צ&apos;אט" onClick={clearAiChat}>
            <svg className="icon"><use href="#i-x" /></svg>
          </button>
        </div>
      )}

      {/* Global Search Results Area */}
      {searchResults && aiMessages.length === 0 && (
        <div>
          <div className="section-title">תוצאות חיפוש ל: &quot;{searchInput}&quot;</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>

            {/* Customers */}
            <div className="card card-pad">
              <div className="card-title-row" style={{ color: 'var(--info)', marginBottom: '12px', fontWeight: 800 }}>
                <svg className="icon" style={{ color: 'var(--info)' }}><use href="#i-user" /></svg>
                <span>לקוחות ({searchResults.customers?.length || 0})</span>
              </div>
              {searchResults.customers?.length > 0 ? (
                <>
                  <div>
                    {searchResults.customers.slice(0, showMoreCustomers ? undefined : 5).map(c => (
                      <Link key={c.id} href={`/customers/${c.id}`} className="list-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{c.firstName} {c.lastName}</div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-3)' }}>{c.phone1} • {c.city}</div>
                        </div>
                        <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-chevron-start" /></svg>
                      </Link>
                    ))}
                  </div>
                  {searchResults.customers.length > 5 && (
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowMoreCustomers(!showMoreCustomers)}>
                      {showMoreCustomers ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <svg className="icon"><use href="#i-search" /></svg>
                  <h4>לא נמצאו לקוחות</h4>
                </div>
              )}
            </div>

            {/* Orders */}
            <div className="card card-pad">
              <div className="card-title-row" style={{ color: 'var(--success)', marginBottom: '12px', fontWeight: 800 }}>
                <svg className="icon" style={{ color: 'var(--success)' }}><use href="#i-bag" /></svg>
                <span>הזמנות ({searchResults.orders?.length || 0})</span>
              </div>
              {searchResults.orders?.length > 0 ? (
                <>
                  <div>
                    {searchResults.orders.slice(0, showMoreOrders ? undefined : 5).map(o => (
                      <Link key={o.id} href={`/orders/${o.orderId}`} className="list-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {o.firstName} {o.lastName}
                            {renderStatusIcon(o.status)}
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '2px' }}>
                            קוד: <strong>#{o.orderId}</strong> | אירוע: <strong>{o.eventDateHebrew || '-'}</strong>
                          </div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-3)', marginTop: '1px' }}>
                            סה&quot;כ: <strong>₪{o.totalAmount || 0}</strong> | פריטים: <strong>{o.itemCount || 0}</strong>
                          </div>
                        </div>
                        <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-chevron-start" /></svg>
                      </Link>
                    ))}
                  </div>
                  {searchResults.orders.length > 5 && (
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowMoreOrders(!showMoreOrders)}>
                      {showMoreOrders ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <svg className="icon"><use href="#i-search" /></svg>
                  <h4>לא נמצאו הזמנות</h4>
                </div>
              )}
            </div>

            {/* Rentals */}
            <div className="card card-pad">
              <div className="card-title-row" style={{ color: 'var(--warning)', marginBottom: '12px', fontWeight: 800 }}>
                <svg className="icon" style={{ color: 'var(--warning)' }}><use href="#i-tag" /></svg>
                <span>השכרות ({searchResults.rentals?.length || 0})</span>
              </div>
              {searchResults.rentals?.length > 0 ? (
                <>
                  <div>
                    {searchResults.rentals.slice(0, showMoreRentals ? undefined : 5).map(r => (
                      <Link key={r.id} href={`/orders/${r.orderId}`} className="list-card" style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{r.catalogName || r.description}</div>
                          <div style={{ fontSize: '12.5px', color: 'var(--text-3)' }}>ברקוד: {r.barcode || r.catalogBarcode} • מידה: {r.sizeText}</div>
                        </div>
                        <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-chevron-start" /></svg>
                      </Link>
                    ))}
                  </div>
                  {searchResults.rentals.length > 5 && (
                    <button type="button" className="btn btn-secondary" style={{ width: '100%', marginTop: '10px' }} onClick={() => setShowMoreRentals(!showMoreRentals)}>
                      {showMoreRentals ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : (
                <div className="empty-state" style={{ padding: '24px' }}>
                  <svg className="icon"><use href="#i-search" /></svg>
                  <h4>לא נמצאו השכרות</h4>
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Footer / Privacy Policy Link */}
      <div style={{ marginTop: 'auto', paddingTop: '26px', textAlign: 'center' }}>
        <button type="button" className="btn btn-ghost btn-sm" style={{ textDecoration: 'underline', color: 'var(--text-3)' }} onClick={() => setShowPrivacyPolicy(true)}>
          מדיניות פרטיות
        </button>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && typeof document !== 'undefined' && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowPrivacyPolicy(false)}>
          <div className="modal" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <strong>מדיניות פרטיות</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" onClick={() => setShowPrivacyPolicy(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <p>טקסט זמני למדיניות פרטיות.</p>
              <br />
              <p>כאן יפורטו התנאים הנוגעים לאיסוף ושמירת מידע של משתמשים ולקוחות.</p>
              <p><strong>1. איסוף נתונים:</strong> המערכת שומרת פרטים אישיים בסיסיים כגון שם, טלפון וכתובת לצורך יצירת קשר בלבד ולמען תפעול תקין של הגמ&quot;ח.</p>
              <p><strong>2. אבטחת מידע:</strong> אנו עושים מאמצים לשמור על בטיחות המידע ולא נעביר אותו לצד שלישי ללא אישור מפורש.</p>
              <br />
              <p style={{ color: 'var(--text-3)', fontSize: '12.5px', fontStyle: 'italic' }}>* ניתן לערוך טקסט זה בהמשך בקוד המערכת.</p>
            </div>
            <div className="modal-foot" style={{ justifyContent: 'center' }}>
              <button type="button" className="btn btn-primary" onClick={() => setShowPrivacyPolicy(false)}>הבנתי</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
