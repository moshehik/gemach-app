'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HDate } from '@hebcal/core';
import { fetchJson, getSettingsCached } from '@/app/lib/pageCache';
import SettingQuickPanel from './components/SettingQuickPanel';
import { CopyChip, splitCopyable, renderCopyable } from './components/CopyableText';
import { V3Page, Card, Btn, IconBtn, Tip, Empty, Dialog, Table } from '@/app/v3/ui/components';
import Icon from '@/app/v3/ui/Icon';

// מפריד תגיות [OPEN_SETTING:key] שה-AI מוסיף (app/api/ai/route.js, ACTION:
// SETTINGS_GUIDE) מתוך טקסט התשובה - מחזיר את הטקסט לתצוגה בלי התגיות, ואת
// רשימת המפתחות שיש להציג עבורם כפתור "פתח הגדרה". זהה במכוון לפונקציה המקבילה
// ב-AIFloatingWidget.js - שני מקומות נפרדים שמציגים תשובות מאותו /api/ai.
function extractOpenSettingKeys(content) {
  if (typeof content !== 'string') return { displayText: content, keys: [] };
  const keys = [];
  const tagRegex = /\[OPEN_SETTING:([a-zA-Z0-9_]+)\]/g;
  let match;
  while ((match = tagRegex.exec(content)) !== null) {
    keys.push(match[1]);
  }
  const displayText = content.replace(tagRegex, '').trim();
  return { displayText, keys };
}

// Hrefs among QUICK_LINKS below that mirror a gated item in navConfig.js's sidebar
// (same rules RootLayout computes server-side: showAdminTab-equivalent for the
// revenue dashboard, hideInternalMessaging for messages) - unlike the sidebar,
// this card grid had no gating at all, so every employee saw links straight to
// revenue data and (when the org disabled messaging) the messages page anyway.
// '/dashboard' (revenue), '/dashboard/pricelist' and '/employees/report' are
// הנהלה ראשית-only screens (roleId 0/2) since 2026-08-24 - a regular branch
// מנהל (roleId 1) no longer has access, so these cards must match.
const QUICK_LINK_VISIBILITY = {
  '/dashboard': 'headManagement',
  '/dashboard/pricelist': 'headManagement',
  '/employees/report': 'headManagement',
  '/messages': 'messagingEnabled',
};

// דפים שהוצאו מהתפריט הצדדי (2026-08-08, צומצם ל-11 הפריטים שהיו בתפריט
// הראשי הישן) אבל אינם קשורי-ניהול — קיצורי דרך אליהם כאן במקום זאת, בטקסט/
// אייקון החדשים כמו ב-navConfig.js. תתי-הדפים של אזור הניהול עברו ל-/admin.
// "הפרופיל שלי" ו"עיצוב ותצוגה" הוסרו מכאן (2026-09-09, בקשת משתמשת) - שני אלה
// כבר נגישים תמיד דרך תפריט המשתמש למעלה (UserMenu.js), אז הכרטיס כאן היה כפול.
const QUICK_LINKS = [
  { href: '/dashboard', label: 'לוח בקרה', icon: 'i-grid' },
  { href: '/dashboard/pricelist', label: 'מחירון', icon: 'i-coin' },
  { href: '/employees/report', label: 'דוח נוכחות', icon: 'i-activity' },
  { href: '/messages', label: 'הודעות', icon: 'i-message' },
  { href: '/punch-clock', label: 'שעון נוכחות', icon: 'i-clock' },
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
  const [quickLinkFlags, setQuickLinkFlags] = useState({ headManagement: false, messagingEnabled: false });
  const [welcomeTitle, setWelcomeTitle] = useState('ברוכים הבאים לגמ"ח');
  useEffect(() => {
    Promise.all([
      fetchJson('/api/me').catch(() => ({ success: false })),
      getSettingsCached().catch(() => []),
    ]).then(([me, settings]) => {
      const isHeadManagement = !!(me?.success && me.employee && (me.employee.roleId === 0 || me.employee.roleId === 2));
      const requireLoginSetting = Array.isArray(settings) ? settings.find(s => s.key === 'require_login') : null;
      const requireLogin = !!(requireLoginSetting && requireLoginSetting.value === 'true');
      const hideMessagingSetting = Array.isArray(settings) ? settings.find(s => s.key === 'hide_internal_messaging') : null;
      const hideMessaging = !!(hideMessagingSetting && hideMessagingSetting.value === 'true');
      const welcomeTitleSetting = Array.isArray(settings) ? settings.find(s => s.key === 'home_welcome_title') : null;
      if (welcomeTitleSetting?.value) setWelcomeTitle(welcomeTitleSetting.value);
      setQuickLinkFlags({
        // Same rule as checkPageAccess(): a logged-in employee is judged by role
        // regardless of require_login; an anonymous visitor only passes while
        // require_login is off.
        headManagement: me?.success ? isHeadManagement : !requireLogin,
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
  const [openSettingKey, setOpenSettingKey] = useState(null);

  // ניווט באותה כרטיסייה (SPA, ללא רענון מלא) בלחיצה רגילה - שומר על ctrl/cmd/shift/
  // middle-click כדי שמשתמש שרוצה בכוונה לפתוח בכרטיסייה חדשה עדיין יוכל (כמו Next Link).
  const navigateInApp = (e, href) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    router.push(href);
  };

  // אימייל/טלפון מפוצלים קודם לתגיות העתקה; רק הטקסט שביניהם עובר זיהוי קישורי הזמנה/לקוח.
  const parseMessageToLinks = (text) => {
    if (!text) return null;
    return splitCopyable(text).map((seg, s) =>
      seg.token
        ? <CopyChip key={s} value={seg.text.trim()} />
        : <span key={s}>{parseLinksOnly(seg.text)}</span>
    );
  };

  const parseLinksOnly = (text) => {
    const parts = text.split(/(הזמנה\s*\d+|לקוח\s*[\w-]+)/g);
    return parts.map((part, i) => {
      let match = part.match(/הזמנה\s*(\d+)/);
      if (match) {
        return (
          <a
            key={i}
            href={`/orders/${match[1]}`}
            onClick={(e) => navigateInApp(e, `/orders/${match[1]}`)}
            className="v3-chip v3-chip--info"
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
            onClick={(e) => navigateInApp(e, `/customers/${match[1]}`)}
            className="v3-chip v3-chip--info"
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

  // מופרד מ-handleGlobalSearch כדי שגם ה-useEffect שקורא ?q=... מ-URL (הגעה מ"הצג
  // את כל התוצאות" בסרגל העליון) יוכל להריץ חיפוש מיידית עם ערך מפורש, בלי לחכות
  // ל-state של searchInput להתעדכן קודם.
  const performGlobalSearch = async (queryText) => {
    if (!queryText || !queryText.trim()) return;

    setLoadingSearch(true);
    setAiMessages([]);
    localStorage.removeItem('dashboardAiMessages');

    try {
      const res = await fetch(`/api/global-search?q=${encodeURIComponent(queryText)}`);
      const data = await res.json();
      setSearchResults(data);
      sessionStorage.setItem('dashboardSearchInput', queryText);
      sessionStorage.setItem('dashboardSearchResults', JSON.stringify(data));

      const newRecentSearches = [queryText, ...recentSearches.filter(s => s !== queryText)].slice(0, 5);
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

  const handleGlobalSearch = (e) => {
    if (e) e.preventDefault();
    performGlobalSearch(searchInput);
  };

  useEffect(() => {
    // "הצג את כל התוצאות" מסרגל החיפוש העליון (TopbarSearch) מנווט לכאן עם ?q=...
    // כדי להציג את אותו חיפוש בעמוד מלא במקום בחלונית הקטנה שמוגבלת ל-15 תוצאות
    // (ר' item 7 בדיווח). אם יש q ב-URL הוא גובר על מה ששמור מסשן קודם.
    const params = new URLSearchParams(window.location.search);
    const qParam = params.get('q');
    if (qParam && qParam.trim()) {
      setSearchInput(qParam);
      performGlobalSearch(qParam);
      // מנקים מה-URL כדי שרענון/ניווט חזרה לא יריצו את החיפוש שוב מאליו
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

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
      'הוחזר': { icon: 'check-circle', color: 'var(--v3-navy)' },
      'מושכר': { icon: 'tag', color: 'var(--v3-gold-d)' },
      'בוטל': { icon: 'x-circle', color: 'var(--v3-rose-700)' },
      'שולם': { icon: 'check', color: 'var(--v3-navy-500)' },
    };
    const { icon, color } = map[status] || { icon: 'clock', color: 'var(--v3-ink-3)' };
    return (
      <span title={status || 'פעיל'} style={{ display: 'inline-flex', color, flex: '0 0 auto' }}>
        <Icon name={icon} size="sm" />
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
    <V3Page
      style={{
        paddingTop: isInitialState ? 'calc(var(--v3-sp-9) * 2)' : 'var(--v3-sp-1)',
        paddingBottom: aiMessages.length > 0 ? 'calc(var(--v3-sp-9) * 2)' : 'var(--v3-sp-5)',
        minHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        transition: 'padding-top var(--v3-dur-enter) var(--v3-ease)'
      }}
    >

      {/* Header & Search */}
      <div className="v3-stack" style={{ marginBottom: 'var(--v3-sp-6)', textAlign: 'center' }}>
        <h1 className="v3-h1">{welcomeTitle}</h1>
        <Card style={{ maxWidth: 'calc(var(--v3-container) * .65)', width: '100%', marginInline: 'auto' }}>
          {aiInputMode ? (
            <form onSubmit={handleAiInputSubmit} className="v3-stack">
              <div className="v3-search">
                <Icon name="sparkles" />
                <input
                  type="text"
                  value={aiInputText}
                  onChange={(e) => setAiInputText(e.target.value)}
                  placeholder="שאלו את ה-AI, למשל: הזמנות של משפחת שיינועטר"
                  aria-label="שאלה לחיפוש חכם"
                  disabled={aiLoading}
                />
              </div>
              <div className="v3-cluster">
                <Btn type="submit" variant="primary" icon="sparkles" loading={aiLoading}>
                  {aiLoading ? 'מחפש' : 'חיפוש חכם'}
                </Btn>
                {aiInputText && !aiLoading && (
                  <Btn variant="quiet" icon="x" onClick={() => setAiInputText('')}>ניקוי</Btn>
                )}
                <Btn variant="quiet" icon="search" onClick={toggleAiInputMode}>לחיפוש רגיל</Btn>
              </div>
            </form>
          ) : (
            <form onSubmit={handleGlobalSearch} className="v3-stack">
              <div className="v3-search">
                <Icon name="search" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="למשל: משפחת כהן"
                  aria-label="חיפוש"
                  disabled={loadingSearch}
                />
              </div>
              <div className="v3-cluster">
                <Btn type="submit" variant="primary" icon="search" loading={loadingSearch}>חיפוש</Btn>
                {searchInput && !loadingSearch && (
                  <Btn variant="quiet" icon="x" onClick={clearSearch}>ניקוי</Btn>
                )}
                <Btn variant="quiet" icon="sparkles" onClick={toggleAiInputMode}>חיפוש חכם</Btn>
                <Tip>חיפוש חכם מבין שאלות חופשיות ומחזיר טבלה או תשובה.</Tip>
              </div>
            </form>
          )}
        </Card>
      </div>

      {/* Quick Links */}
      {isInitialState && (
        <div className="v3-stack" style={{ maxWidth: 'calc(var(--v3-container) * .65)', width: '100%', marginInline: 'auto', marginBottom: 'var(--v3-sp-6)' }}>
          <h2 className="v3-h2">קיצורי דרך</h2>
          <div className="v3-cluster">
            {visibleQuickLinks.map((link) => (
              <Link key={link.href} href={link.href} className="v3-btn">
                <Icon name={link.icon} />
                <span>{link.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* AI Response Area */}
      {aiMessages.length > 0 && (
        <Card
          icon="sparkles"
          title="שיחה עם ה-AI"
          actions={<IconBtn icon="x" label="ניקוי השיחה" variant="quiet" onClick={clearAiChat} />}
          style={{ maxWidth: 'calc(var(--v3-container) * .65)', width: '100%', marginInline: 'auto', marginBottom: 'var(--v3-sp-6)' }}
        >
          <div className="v3-stack" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            {aiMessages.map((msg, idx) => {
              const { displayText, keys: openSettingKeys } = extractOpenSettingKeys(msg.content);
              const dataKeys = msg.data && msg.data.length > 0 ? Object.keys(msg.data[0]).filter(k => !k.startsWith('_action')) : [];
              const hasActions = !!(msg.data && msg.data.some(r => r._actionUrl));
              const tableColumns = [
                ...dataKeys.map(k => ({ key: k, header: k, render: (row) => renderCopyable(row[k]) })),
                ...(hasActions ? [{
                  key: '_actions',
                  header: 'פעולות',
                  render: (row) => (row._actionUrl && row._actionLabel ? (
                    <Link href={row._actionUrl} className="v3-btn v3-btn--sm">
                      {row._actionLabel}
                    </Link>
                  ) : null),
                }] : []),
              ];
              return (
                <div key={idx} className={msg.role === 'user' ? 'v3-card v3-card--info' : 'v3-card v3-card--quiet'}>
                  <div className="v3-stack">
                    <div className="v3-cluster">
                      <Icon name={msg.role === 'user' ? 'user' : 'sparkles'} size="sm" />
                      <b>{msg.role === 'user' ? 'אתם' : 'ה-AI'}</b>
                      <IconBtn
                        icon={copiedAiIdx === idx ? 'check' : 'copy'}
                        label="העתקת ההודעה"
                        variant="quiet"
                        size="sm"
                        aria-pressed={copiedAiIdx === idx}
                        onClick={() => copyBubbleText(idx, msg.content)}
                      />
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{parseMessageToLinks(displayText)}</div>
                    {openSettingKeys.length > 0 && (
                      <div className="v3-cluster">
                        {openSettingKeys.map(key => (
                          <Btn key={key} size="sm" icon="settings" onClick={() => setOpenSettingKey(key)}>
                            פתיחת ההגדרה
                          </Btn>
                        ))}
                      </div>
                    )}
                    {msg.data && msg.data.length > 0 && (
                      <div className="v3-stack">
                        <div className="v3-cluster">
                          <Btn size="sm" icon="download" onClick={() => exportTableToExcel(msg.data, 'AI_Export')}>ייצוא ל-Excel</Btn>
                        </div>
                        <Table
                          columns={tableColumns}
                          rows={msg.data.slice(0, 15).map((row, rIdx) => ({ ...row, __rowIdx: rIdx }))}
                          rowKey="__rowIdx"
                          caption="תוצאות השאילתה"
                        />
                        {msg.data.length > 15 && (
                          <span className="v3-faint v3-text-sm">מוצגות 15 השורות הראשונות. הקובץ המיוצא כולל הכול.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {aiLoading && (
              <div className="v3-cluster v3-muted" role="status">
                <span className="v3-spin" aria-hidden="true" />
                <span>ה-AI חושב</span>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </Card>
      )}

      {/* Floating Chat Input */}
      {aiMessages.length > 0 && (
        <div
          className="v3-card"
          style={{ position: 'fixed', bottom: 'var(--v3-sp-5)', insetInline: 0, marginInline: 'auto', width: '90%', maxWidth: 'calc(var(--v3-container) * .65)', zIndex: 'var(--v3-z-combo)', boxShadow: 'var(--v3-sh-pop)' }}
        >
          <div className="v3-cluster" style={{ flexWrap: 'nowrap' }}>
            <input
              type="text"
              value={aiReplyInput}
              onChange={(e) => setAiReplyInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) handleAiSearch(aiReplyInput, true); }}
              placeholder="שאלת המשך"
              aria-label="שאלת המשך ל-AI"
              className="v3-input"
              style={{ flex: 1, minWidth: 0 }}
              disabled={aiLoading}
            />
            <IconBtn variant="primary" icon="send" label="שליחה" onClick={() => handleAiSearch(aiReplyInput, true)} disabled={aiLoading || !aiReplyInput.trim()} />
            <IconBtn variant="quiet" icon="x" label="סגירת השיחה" onClick={clearAiChat} />
          </div>
        </div>
      )}

      {/* Global Search Results Area */}
      {searchResults && aiMessages.length === 0 && (
        <div className="v3-stack">
          <h2 className="v3-h2">תוצאות עבור &quot;{searchInput}&quot;</h2>

          {/* Customers */}
          <Card icon="user" title={<>לקוחות <bdi>({searchResults.customers?.length || 0})</bdi></>}>
            {searchResults.customers?.length > 0 ? (
              <div className="v3-stack">
                <div className="v3-list">
                  {searchResults.customers.slice(0, showMoreCustomers ? undefined : 5).map(c => (
                    <Link key={c.id} href={`/customers/${c.id}`} className="v3-link">
                      <span className="v3-link__ic"><Icon name="user" /></span>
                      <span className="v3-stack" style={{ flex: 1, gap: 0 }}>
                        <b>{c.firstName} {c.lastName}</b>
                        <span className="v3-faint v3-text-sm"><bdi>{c.phone1}</bdi></span>
                        <span className="v3-faint v3-text-sm">{c.city}</span>
                      </span>
                      <Icon name="next" size="sm" />
                    </Link>
                  ))}
                </div>
                {searchResults.customers.length > 5 && (
                  <Btn block onClick={() => setShowMoreCustomers(!showMoreCustomers)}>
                    {showMoreCustomers ? 'פחות' : 'עוד'}
                  </Btn>
                )}
              </div>
            ) : (
              <Empty icon="search" title="אין לקוחות תואמים" />
            )}
          </Card>

          {/* Orders */}
          <Card icon="bag" title={<>הזמנות <bdi>({searchResults.orders?.length || 0})</bdi></>}>
            {searchResults.orders?.length > 0 ? (
              <div className="v3-stack">
                <div className="v3-list">
                  {searchResults.orders.slice(0, showMoreOrders ? undefined : 5).map(o => (
                    <Link key={o.id} href={`/orders/${o.orderId}`} className="v3-link">
                      <span className="v3-link__ic"><Icon name="bag" /></span>
                      <span className="v3-stack" style={{ flex: 1, gap: 0 }}>
                        <b className="v3-cluster">
                          {o.firstName} {o.lastName}
                          {renderStatusIcon(o.status)}
                        </b>
                        <span className="v3-faint v3-text-sm">הזמנה <bdi>#{o.orderId}</bdi></span>
                        <span className="v3-faint v3-text-sm">אירוע: <bdi>{o.eventDateHebrew || '-'}</bdi></span>
                        <span className="v3-faint v3-text-sm">סכום: <bdi>₪{o.totalAmount || 0}</bdi></span>
                        <span className="v3-faint v3-text-sm">פריטים: <bdi>{o.itemCount || 0}</bdi></span>
                      </span>
                      <Icon name="next" size="sm" />
                    </Link>
                  ))}
                </div>
                {searchResults.orders.length > 5 && (
                  <Btn block onClick={() => setShowMoreOrders(!showMoreOrders)}>
                    {showMoreOrders ? 'פחות' : 'עוד'}
                  </Btn>
                )}
              </div>
            ) : (
              <Empty icon="search" title="אין הזמנות תואמות" />
            )}
          </Card>

          {/* Rentals */}
          <Card icon="tag" title={<>השכרות <bdi>({searchResults.rentals?.length || 0})</bdi></>}>
            {searchResults.rentals?.length > 0 ? (
              <div className="v3-stack">
                <div className="v3-list">
                  {searchResults.rentals.slice(0, showMoreRentals ? undefined : 5).map(r => (
                    <Link key={r.id} href={`/orders/${r.orderId}`} className="v3-link">
                      <span className="v3-link__ic"><Icon name="tag" /></span>
                      <span className="v3-stack" style={{ flex: 1, gap: 0 }}>
                        <b>{r.catalogName || r.description}</b>
                        <span className="v3-faint v3-text-sm">ברקוד: <bdi>{r.barcode || r.catalogBarcode}</bdi></span>
                        <span className="v3-faint v3-text-sm">מידה: <bdi>{r.sizeText}</bdi></span>
                      </span>
                      <Icon name="next" size="sm" />
                    </Link>
                  ))}
                </div>
                {searchResults.rentals.length > 5 && (
                  <Btn block onClick={() => setShowMoreRentals(!showMoreRentals)}>
                    {showMoreRentals ? 'פחות' : 'עוד'}
                  </Btn>
                )}
              </div>
            ) : (
              <Empty icon="search" title="אין השכרות תואמות" />
            )}
          </Card>
        </div>
      )}

      {/* Footer / Privacy Policy Link */}
      <div style={{ marginTop: 'auto', paddingTop: 'var(--v3-sp-5)', textAlign: 'center' }}>
        <Btn variant="quiet" size="sm" icon="shield" onClick={() => setShowPrivacyPolicy(true)}>
          פרטיות
        </Btn>
      </div>

      {/* Privacy Policy Modal */}
      <Dialog
        open={showPrivacyPolicy}
        onClose={() => setShowPrivacyPolicy(false)}
        variant="sheet"
        mode="light"
        icon="shield"
        title="פרטיות"
        actions={<Btn variant="primary" onClick={() => setShowPrivacyPolicy(false)}>הבנתי</Btn>}
      >
        <div className="v3-stack">
          <p>המערכת שומרת פרטי קשר בסיסיים של לקוחות ועובדים: שם, טלפון וכתובת. המידע משמש לתפעול הגמ&quot;ח בלבד.</p>
          <p>אנחנו שומרים על המידע, ולא מעבירים אותו לגורם חיצוני בלי אישור מפורש.</p>
        </div>
      </Dialog>

      {openSettingKey && (
        <SettingQuickPanel settingKey={openSettingKey} onClose={() => setOpenSettingKey(null)} />
      )}

    </V3Page>
  );
}
