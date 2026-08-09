'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, X, Loader2, ArrowLeft, CreditCard, Banknote, User, ShoppingBag, Shirt, Download, PlusCircle, Maximize2, Minimize2, CheckCircle, Clock, XCircle, Check, Send, Trash2, ExternalLink, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import AISearchBar from './components/AISearchBar';
import * as XLSX from 'xlsx';
import { HDate } from '@hebcal/core';

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
            style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ec4899', color: 'white', padding: '2px 8px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', margin: '0 4px', fontSize: '0.9rem' }}
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
            style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#ec4899', color: 'white', padding: '2px 8px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', margin: '0 4px', fontSize: '0.9rem' }}
          >
            {part}
          </a>
        );
      }
      return <span key={i}>{part}</span>;
    });
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

  const exportTableToExcel = (data, filename) => {
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
    switch(status) {
      case 'הוחזר': return <CheckCircle data-element-name="רכיב_page_1" size={16} color="#10b981" title="הוחזר" />;
      case 'מושכר': return <Shirt data-element-name="רכיב_page_2" size={16} color="#f59e0b" title="מושכר" />;
      case 'בוטל': return <XCircle data-element-name="רכיב_page_3" size={16} color="#ef4444" title="בוטל" />;
      case 'שולם': return <Check data-element-name="רכיב_page_4" size={16} color="#3b82f6" title="שולם" />;
      default: return <Clock data-element-name="רכיב_page_5" size={16} color="#6b7280" title={status || 'פעיל'} />;
    }
  };

  const isInitialState = !searchResults && aiMessages.length === 0;

  return (
    <main className="container animate-fade-in" style={{ 
      paddingTop: isInitialState ? '25vh' : '2rem', 
      paddingBottom: aiMessages.length > 0 ? '120px' : '4rem', 
      position: 'relative',
      minHeight: '80vh',
      display: 'flex',
      flexDirection: 'column',
      transition: 'padding-top 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
    }}>
      
      {/* Header & Search */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--primary-color)', marginBottom: '1.5rem', fontWeight: '800' }}>
          ברוכים הבאים למערכת ניהול הגמ"ח
        </h1>
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'var(--card-bg)', padding: '1rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <AISearchBar data-element-name="רכיב_page_6" 
            placeholder="דוגמא משפחת כהן..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleGlobalSearch}
            onClear={clearSearch}
            onAiSearch={(q) => handleAiSearch(q, false)}
            loading={loadingSearch || (aiLoading && aiMessages.length === 0)}
          />
          {/* Recent searches section removed */}
        </div>
      </div>

      {/* AI Response Area */}
      {aiMessages.length > 0 && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto 3rem auto', background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.1)', border: '1px solid #fbcfe8', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899', fontWeight: 'bold' }}>
              <Sparkles data-element-name="רכיב_page_7" size={24} />
              <span style={{ fontSize: '1.2rem' }}>צ'אט חכם מבוסס AI:</span>
            </div>
            <button data-element-name="כפתור_page_8" onClick={clearAiChat} title="נקה צ'אט" style={{ background: 'var(--card-bg)', border: '1px solid #fbcfe8', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X data-element-name="רכיב_page_9" size={18} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {aiMessages.map((msg, idx) => (
              <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end', background: msg.role === 'user' ? 'var(--card-bg)' : '#fce7f3', padding: '1rem 1.5rem', borderRadius: '12px', maxWidth: '85%', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: msg.role === 'user' ? '1px solid var(--element-border)' : '1px solid #fbcfe8' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: msg.role === 'user' ? 'var(--text-main)' : '#ec4899' }}>
                  {msg.role === 'user' ? 'אתה:' : 'מערכת AI:'}
                </div>
                <div style={{ fontSize: '1.1rem', lineHeight: '1.6', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                  {parseMessageToLinks(msg.content)}
                </div>
                {msg.data && msg.data.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <button data-element-name="כפתור_page_10" onClick={() => exportTableToExcel(msg.data, 'AI_Export')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <Download data-element-name="רכיב_page_11" size={16} /> הורד Excel
                    </button>
                    <div style={{ overflowX: 'auto', background: 'var(--card-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: 'var(--element-bg)' }}>
                            {Object.keys(msg.data[0])
                              .filter(k => !k.startsWith('_action'))
                              .map(k => <th key={k} style={{ padding: '0.5rem', borderBottom: '1px solid var(--element-border)' }}>{k}</th>)}
                            {msg.data.some(r => r._actionUrl) && <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--element-border)' }}>פעולות</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.slice(0, 15).map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid var(--element-border)' }}>
                              {Object.entries(row)
                                .filter(([k]) => !k.startsWith('_action'))
                                .map(([k, val], vIdx) => <td key={vIdx} style={{ padding: '0.5rem' }}>{val}</td>)}
                              {msg.data.some(r => r._actionUrl) && (
                                <td style={{ padding: '0.5rem' }}>
                                  {row._actionUrl && row._actionLabel ? (
                                    <Link data-element-name="רכיב_page_12" href={row._actionUrl} target="_blank" style={{ background: '#ec4899', color: 'white', padding: '0.3rem 0.6rem', borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', display: 'inline-block' }}>
                                      {row._actionLabel}
                                    </Link>
                                  ) : null}
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {msg.data.length > 15 && <div style={{ textAlign: 'center', padding: '0.5rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>מציג 15 תוצאות ראשונות (הורד קובץ לצפייה במלא)</div>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div style={{ alignSelf: 'flex-end', color: '#ec4899', fontStyle: 'italic', padding: '1rem' }}>
                <Loader2 data-element-name="רכיב_page_13" className="animate-spin" size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ה-AI חושב...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* Floating Chat Input */}
      {aiMessages.length > 0 && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '800px', background: 'var(--card-bg)', padding: '0.75rem', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #fbcfe8', zIndex: 1000, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
           <input data-element-name="שדה_page_14" 
             type="text" 
             value={aiReplyInput} 
             onChange={(e) => setAiReplyInput(e.target.value)}
             onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) handleAiSearch(aiReplyInput, true); }}
             placeholder="שאל שאלת המשך ל-AI..." 
             style={{ flex: 1, padding: '0.75rem 1.5rem', border: 'none', background: '#fdf2f8', borderRadius: '20px', fontSize: '1rem', color: '#ec4899', outline: 'none' }} 
             disabled={aiLoading}
           />
           <button data-element-name="כפתור_page_15" onClick={() => handleAiSearch(aiReplyInput, true)} disabled={aiLoading || !aiReplyInput.trim()} style={{ background: aiLoading || !aiReplyInput.trim() ? '#f9a8d4' : '#ec4899', color: 'white', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: aiLoading || !aiReplyInput.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
             <Send data-element-name="רכיב_page_16" size={20} />
           </button>
           <button data-element-name="כפתור_page_17" onClick={clearAiChat} title="סגור צ'אט" style={{ background: 'var(--element-bg)', color: 'var(--text-muted)', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}>
             <X data-element-name="רכיב_page_18" size={20} />
           </button>
        </div>
      )}

      {/* Global Search Results Area */}
      {searchResults && aiMessages.length === 0 && (
        <div className="animate-fade-in" style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-main)' }}>תוצאות חיפוש ל: "{searchInput}"</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* Customers */}
            <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', marginBottom: '1rem' }}>
                <User data-element-name="רכיב_page_19" size={20} /> לקוחות ({searchResults.customers?.length || 0})
              </h3>
              {searchResults.customers?.length > 0 ? (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {searchResults.customers.slice(0, showMoreCustomers ? undefined : 5).map(c => (
                      <li key={c.id} style={{ borderBottom: '1px solid var(--element-border)', padding: '0.75rem 0' }}>
                        <Link data-element-name="רכיב_page_20" href={`/customers/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{c.firstName} {c.lastName}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.phone1} • {c.city}</div>
                          </div>
                          <ArrowLeft data-element-name="רכיב_page_21" size={16} color="#9ca3af" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {searchResults.customers.length > 5 && (
                    <button data-element-name="כפתור_page_22" onClick={() => setShowMoreCustomers(!showMoreCustomers)} style={{ width: '100%', background: 'var(--btn-light-blue-bg)', color: '#3b82f6', border: 'none', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer', fontWeight: '500' }}>
                      {showMoreCustomers ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : <div style={{ color: 'var(--text-muted)' }}>לא נמצאו לקוחות</div>}
            </div>

            {/* Orders */}
            <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem' }}>
                <ShoppingBag data-element-name="רכיב_page_23" size={20} /> הזמנות ({searchResults.orders?.length || 0})
              </h3>
              {searchResults.orders?.length > 0 ? (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {searchResults.orders.slice(0, showMoreOrders ? undefined : 5).map(o => (
                      <li key={o.id} style={{ borderBottom: '1px solid var(--element-border)', padding: '0.75rem 0' }}>
                        <Link data-element-name="רכיב_page_24" href={`/orders/${o.orderId}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {o.firstName} {o.lastName}
                              {renderStatusIcon(o.status)}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                              קוד: <strong>#{o.orderId}</strong> | אירוע: <strong>{o.eventDateHebrew || '-'}</strong>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              סה"כ: <strong>₪{o.totalAmount || 0}</strong> | פריטים: <strong>{o.itemCount || 0}</strong>
                            </div>
                          </div>
                          <ArrowLeft data-element-name="רכיב_page_25" size={16} color="#9ca3af" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {searchResults.orders.length > 5 && (
                    <button data-element-name="כפתור_page_26" onClick={() => setShowMoreOrders(!showMoreOrders)} style={{ width: '100%', background: 'var(--btn-light-green-bg)', color: '#10b981', border: 'none', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer', fontWeight: '500' }}>
                      {showMoreOrders ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : <div style={{ color: 'var(--text-muted)' }}>לא נמצאו הזמנות</div>}
            </div>

            {/* Rentals */}
            <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '1rem' }}>
                <Shirt data-element-name="רכיב_page_27" size={20} /> השכרות ({searchResults.rentals?.length || 0})
              </h3>
              {searchResults.rentals?.length > 0 ? (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {searchResults.rentals.slice(0, showMoreRentals ? undefined : 5).map(r => (
                      <li key={r.id} style={{ borderBottom: '1px solid var(--element-border)', padding: '0.75rem 0' }}>
                        <Link data-element-name="רכיב_page_28" href={`/orders/${r.orderId}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{r.catalogName || r.description}</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ברקוד: {r.barcode || r.catalogBarcode} • מידה: {r.sizeText}</div>
                          </div>
                          <ArrowLeft data-element-name="רכיב_page_29" size={16} color="#9ca3af" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {searchResults.rentals.length > 5 && (
                    <button data-element-name="כפתור_page_30" onClick={() => setShowMoreRentals(!showMoreRentals)} style={{ width: '100%', background: 'var(--element-bg)', color: '#f59e0b', border: 'none', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer', fontWeight: '500' }}>
                      {showMoreRentals ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : <div style={{ color: 'var(--text-muted)' }}>לא נמצאו השכרות</div>}
            </div>

          </div>
        </div>
      )}

      {/* Footer / Privacy Policy Link */}
      <div style={{ marginTop: 'auto', paddingTop: '3rem', textAlign: 'center', paddingBottom: '1rem' }}>
        <button data-element-name="כפתור_page_privacy_link" onClick={() => setShowPrivacyPolicy(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem' }}>
          מדיניות פרטיות
        </button>
      </div>

      {/* Privacy Policy Modal */}
      {showPrivacyPolicy && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="animate-fade-in" style={{ background: 'var(--card-bg)', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto', borderRadius: '16px', padding: '2rem', position: 'relative', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
            <button data-element-name="כפתור_page_close_privacy" onClick={() => setShowPrivacyPolicy(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X data-element-name="רכיב_page_x_privacy" size={24} />
            </button>
            <h2 style={{ color: 'var(--primary-color)', marginBottom: '1.5rem', textAlign: 'center' }}>מדיניות פרטיות</h2>
            <div style={{ lineHeight: '1.8', color: 'var(--text-color)' }}>
              <p>טקסט זמני למדיניות פרטיות.</p>
              <br/>
              <p>כאן יפורטו התנאים הנוגעים לאיסוף ושמירת מידע של משתמשים ולקוחות.</p>
              <p><strong>1. איסוף נתונים:</strong> המערכת שומרת פרטים אישיים בסיסיים כגון שם, טלפון וכתובת לצורך יצירת קשר בלבד ולמען תפעול תקין של הגמ"ח.</p>
              <p><strong>2. אבטחת מידע:</strong> אנו עושים מאמצים לשמור על בטיחות המידע ולא נעביר אותו לצד שלישי ללא אישור מפורש.</p>
              <br/>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>* ניתן לערוך טקסט זה בהמשך בקוד המערכת.</p>
            </div>
            <div style={{ textAlign: 'center', marginTop: '2rem' }}>
              <button data-element-name="כפתור_page_confirm_privacy" onClick={() => setShowPrivacyPolicy(false)} style={{ background: 'var(--primary-color)', color: 'white', border: 'none', padding: '0.75rem 2rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem', fontWeight: 'bold' }}>
                הבנתי
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
