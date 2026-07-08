'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, X, Loader2, ArrowLeft, CreditCard, Banknote, User, ShoppingBag, Shirt, Download, PlusCircle, Maximize2, Minimize2, CheckCircle, Clock, XCircle, Check, Send, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import AISearchBar from './components/AISearchBar';
import QuickPaymentModal from './components/QuickPaymentModal';
import * as XLSX from 'xlsx';

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
  
  // AI Chat state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiReplyInput, setAiReplyInput] = useState('');

  // Dashboard state
  const [debts, setDebts] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentRentals, setRecentRentals] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  
  const [debtsExpanded, setDebtsExpanded] = useState(true);
  const [paymentsExpanded, setPaymentsExpanded] = useState(true);
  const [ordersExpanded, setOrdersExpanded] = useState(true);
  const [rentalsExpanded, setRentalsExpanded] = useState(true);
  const [quickPaymentOpen, setQuickPaymentOpen] = useState(false);

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

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard/debts');
        if (res.ok) {
          const data = await res.json();
          setDebts(data.debts || []);
          setRecentPayments(data.recentPayments || []);
          setRecentOrders(data.recentOrders || []);
          setRecentRentals(data.recentRentals || []);
        }
      } catch (err) {
        console.error('Failed to fetch dashboard', err);
      } finally {
        setLoadingDashboard(false);
      }
    }
    fetchDashboard();
  }, []);

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
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "נתונים");
    XLSX.writeFile(wb, filename + '.xlsx');
  };

  const renderStatusIcon = (status) => {
    switch(status) {
      case 'הוחזר': return <CheckCircle size={16} color="#10b981" title="הוחזר" />;
      case 'מושכר': return <Shirt size={16} color="#f59e0b" title="מושכר" />;
      case 'בוטל': return <XCircle size={16} color="#ef4444" title="בוטל" />;
      case 'שולם': return <Check size={16} color="#3b82f6" title="שולם" />;
      default: return <Clock size={16} color="#6b7280" title={status || 'פעיל'} />;
    }
  };

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem', paddingBottom: aiMessages.length > 0 ? '120px' : '4rem', position: 'relative' }}>
      
      {/* Header & Search */}
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', color: 'var(--primary-color)', marginBottom: '1.5rem', fontWeight: '800' }}>
          ברוכים הבאים למערכת ניהול הגמ"ח
        </h1>
        <div style={{ maxWidth: '800px', margin: '0 auto', background: 'white', padding: '1rem', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <AISearchBar 
            placeholder="חיפוש גלובלי (לקוח, טלפון, עיר, מספר הזמנה)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onSearch={handleGlobalSearch}
            onClear={clearSearch}
            onAiSearch={(q) => handleAiSearch(q, false)}
            loading={loadingSearch || (aiLoading && aiMessages.length === 0)}
          />
          {recentSearches.length > 0 && !searchInput && (
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>חיפושים אחרונים:</span>
              {recentSearches.map((s, idx) => (
                <button 
                  key={idx} 
                  onClick={() => {
                    setSearchInput(s);
                    // trigger search in the next render cycle or call handleGlobalSearch directly by passing it
                    // The simplest is to just set it and let user click search, or trigger it manually
                    setTimeout(() => {
                      document.querySelector('form')?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                    }, 100);
                  }}
                  style={{ background: '#f3f4f6', border: 'none', padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.85rem', color: '#4b5563', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseOver={e => e.currentTarget.style.background = '#e5e7eb'}
                  onMouseOut={e => e.currentTarget.style.background = '#f3f4f6'}
                >
                  <Search size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Response Area */}
      {aiMessages.length > 0 && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto 3rem auto', background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.1)', border: '1px solid #fbcfe8', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '600px', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899', fontWeight: 'bold' }}>
              <Sparkles size={24} />
              <span style={{ fontSize: '1.2rem' }}>צ'אט חכם מבוסס AI:</span>
            </div>
            <button onClick={clearAiChat} title="נקה צ'אט" style={{ background: 'white', border: '1px solid #fbcfe8', borderRadius: '50%', padding: '0.5rem', cursor: 'pointer', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={18} />
            </button>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {aiMessages.map((msg, idx) => (
              <div key={idx} style={{ alignSelf: msg.role === 'user' ? 'flex-start' : 'flex-end', background: msg.role === 'user' ? 'white' : '#fce7f3', padding: '1rem 1.5rem', borderRadius: '12px', maxWidth: '85%', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', border: msg.role === 'user' ? '1px solid #e5e7eb' : '1px solid #fbcfe8' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.5rem', color: msg.role === 'user' ? '#4b5563' : '#ec4899' }}>
                  {msg.role === 'user' ? 'אתה:' : 'מערכת AI:'}
                </div>
                <div style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#374151', whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </div>
                {msg.data && msg.data.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <button onClick={() => exportTableToExcel(msg.data, 'AI_Export')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1rem' }}>
                      <Download size={16} /> הורד Excel
                    </button>
                    <div style={{ overflowX: 'auto', background: 'white', padding: '1rem', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ background: '#f3f4f6' }}>
                            {Object.keys(msg.data[0]).map(k => <th key={k} style={{ padding: '0.5rem', borderBottom: '1px solid #e5e7eb' }}>{k}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {msg.data.slice(0, 15).map((row, rIdx) => (
                            <tr key={rIdx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              {Object.values(row).map((val, vIdx) => <td key={vIdx} style={{ padding: '0.5rem' }}>{val}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {msg.data.length > 15 && <div style={{ textAlign: 'center', padding: '0.5rem', color: '#6b7280', fontStyle: 'italic' }}>מציג 15 תוצאות ראשונות (הורד קובץ לצפייה במלא)</div>}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {aiLoading && (
              <div style={{ alignSelf: 'flex-end', color: '#ec4899', fontStyle: 'italic', padding: '1rem' }}>
                <Loader2 className="animate-spin" size={20} style={{ display: 'inline', marginRight: '0.5rem' }} />
                ה-AI חושב...
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>
      )}

      {/* Floating Chat Input */}
      {aiMessages.length > 0 && (
        <div style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: '800px', background: 'white', padding: '0.75rem', borderRadius: '24px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)', border: '1px solid #fbcfe8', zIndex: 1000, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
           <input 
             type="text" 
             value={aiReplyInput} 
             onChange={(e) => setAiReplyInput(e.target.value)}
             onKeyDown={(e) => { if (e.key === 'Enter' && !aiLoading) handleAiSearch(aiReplyInput, true); }}
             placeholder="שאל שאלת המשך ל-AI..." 
             style={{ flex: 1, padding: '0.75rem 1.5rem', border: 'none', background: '#fdf2f8', borderRadius: '20px', fontSize: '1rem', color: '#ec4899', outline: 'none' }} 
             disabled={aiLoading}
           />
           <button onClick={() => handleAiSearch(aiReplyInput, true)} disabled={aiLoading || !aiReplyInput.trim()} style={{ background: aiLoading || !aiReplyInput.trim() ? '#f9a8d4' : '#ec4899', color: 'white', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: aiLoading || !aiReplyInput.trim() ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
             <Send size={20} />
           </button>
           <button onClick={clearAiChat} title="סגור צ'אט" style={{ background: '#f3f4f6', color: '#6b7280', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}>
             <X size={20} />
           </button>
        </div>
      )}

      {/* Global Search Results Area */}
      {searchResults && aiMessages.length === 0 && (
        <div className="animate-fade-in" style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-color)' }}>תוצאות חיפוש ל: "{searchInput}"</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* Customers */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', marginBottom: '1rem' }}>
                <User size={20} /> לקוחות ({searchResults.customers?.length || 0})
              </h3>
              {searchResults.customers?.length > 0 ? (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {searchResults.customers.slice(0, showMoreCustomers ? undefined : 5).map(c => (
                      <li key={c.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '0.75rem 0' }}>
                        <Link href={`/customers/${c.id}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{c.firstName} {c.lastName}</div>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{c.phone1} • {c.city}</div>
                          </div>
                          <ArrowLeft size={16} color="#9ca3af" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {searchResults.customers.length > 5 && (
                    <button onClick={() => setShowMoreCustomers(!showMoreCustomers)} style={{ width: '100%', background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer', fontWeight: '500' }}>
                      {showMoreCustomers ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : <div style={{ color: '#9ca3af' }}>לא נמצאו לקוחות</div>}
            </div>

            {/* Orders */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem' }}>
                <ShoppingBag size={20} /> הזמנות ({searchResults.orders?.length || 0})
              </h3>
              {searchResults.orders?.length > 0 ? (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {searchResults.orders.slice(0, showMoreOrders ? undefined : 5).map(o => (
                      <li key={o.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '0.75rem 0' }}>
                        <Link href={`/orders/${o.orderId}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#047857', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              {o.firstName} {o.lastName}
                              {renderStatusIcon(o.status)}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                              קוד: <strong>#{o.orderId}</strong> | אירוע: <strong>{o.eventDateHebrew || '-'}</strong>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.15rem' }}>
                              סה"כ: <strong>₪{o.totalAmount || 0}</strong> | פריטים: <strong>{o.itemCount || 0}</strong>
                            </div>
                          </div>
                          <ArrowLeft size={16} color="#9ca3af" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {searchResults.orders.length > 5 && (
                    <button onClick={() => setShowMoreOrders(!showMoreOrders)} style={{ width: '100%', background: '#ecfdf5', color: '#10b981', border: 'none', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer', fontWeight: '500' }}>
                      {showMoreOrders ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : <div style={{ color: '#9ca3af' }}>לא נמצאו הזמנות</div>}
            </div>

            {/* Rentals */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '1rem' }}>
                <Shirt size={20} /> השכרות ({searchResults.rentals?.length || 0})
              </h3>
              {searchResults.rentals?.length > 0 ? (
                <>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {searchResults.rentals.slice(0, showMoreRentals ? undefined : 5).map(r => (
                      <li key={r.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '0.75rem 0' }}>
                        <Link href={`/orders/${r.orderId}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontWeight: 'bold' }}>{r.catalogName || r.description}</div>
                            <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>ברקוד: {r.barcode || r.catalogBarcode} • מידה: {r.sizeText}</div>
                          </div>
                          <ArrowLeft size={16} color="#9ca3af" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {searchResults.rentals.length > 5 && (
                    <button onClick={() => setShowMoreRentals(!showMoreRentals)} style={{ width: '100%', background: '#fffbeb', color: '#f59e0b', border: 'none', padding: '0.5rem', borderRadius: '8px', marginTop: '1rem', cursor: 'pointer', fontWeight: '500' }}>
                      {showMoreRentals ? 'הצג פחות' : 'הצג עוד'}
                    </button>
                  )}
                </>
              ) : <div style={{ color: '#9ca3af' }}>לא נמצאו השכרות</div>}
            </div>

          </div>
        </div>
      )}

      {/* Main Dashboard Widgets */}
      {aiMessages.length === 0 && (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Debts Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: debtsExpanded ? '400px' : 'auto', transition: 'height 0.3s ease' }}>
          <div style={{ background: '#fef2f2', padding: '1.5rem', borderBottom: debtsExpanded ? '1px solid #fee2e2' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#ef4444', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><CreditCard size={20} /></div>
              <h2 style={{ margin: 0, color: '#b91c1c', fontSize: '1.25rem' }}>חובות פתוחים</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setQuickPaymentOpen(true)} title="תשלום מהיר" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                <PlusCircle size={24} />
              </button>
              <button onClick={() => setDebtsExpanded(!debtsExpanded)} title={debtsExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b91c1c', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(239, 68, 68, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {debtsExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {debtsExpanded && (
          <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
            {loadingDashboard ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" color="#ef4444" /></div>
            ) : debts.length > 0 ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ color: '#6b7280', fontSize: '0.9rem', borderBottom: '1px solid #e5e7eb' }}>
                    <th style={{ padding: '0.5rem' }}>הזמנה / לקוח</th>
                    <th style={{ padding: '0.5rem' }}>סה"כ</th>
                    <th style={{ padding: '0.5rem', color: '#ef4444' }}>יתרה לתשלום</th>
                    <th style={{ padding: '0.5rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {debts.map(debt => (
                    <tr key={debt.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div style={{ fontWeight: '500' }}>#{debt.orderId}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{debt.customer?.firstName} {debt.customer?.lastName}</div>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>₪{debt.totalAmount}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontWeight: 'bold', color: '#ef4444' }}>₪{debt.remaining}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <Link href={`/orders/${debt.orderId}`} className="btn btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', borderRadius: '12px' }}>לשלם</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af', flexDirection: 'column', gap: '1rem' }}>
                <CreditCard size={40} opacity={0.2} />
                <span>אין כרגע חובות פתוחים הממתינים לתשלום.</span>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Recent Payments Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: paymentsExpanded ? '400px' : 'auto', transition: 'height 0.3s ease' }}>
          <div style={{ background: '#ecfdf5', padding: '1.5rem', borderBottom: paymentsExpanded ? '1px solid #d1fae5' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#10b981', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><Banknote size={20} /></div>
              <h2 style={{ margin: 0, color: '#047857', fontSize: '1.25rem' }}>תשלומים אחרונים</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setPaymentsExpanded(!paymentsExpanded)} title={paymentsExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#047857', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(16, 185, 129, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {paymentsExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {paymentsExpanded && (
          <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
            {loadingDashboard ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" color="#10b981" /></div>
            ) : recentPayments.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentPayments.map(payment => (
                  <li key={payment.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: '#d1fae5', color: '#047857', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                        ₪
                      </div>
                      <div>
                        <div style={{ fontWeight: '500' }}>{payment.customer?.firstName} {payment.customer?.lastName}</div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          הזמנה #{payment.order?.orderId} • {new Date(payment.paymentDate).toLocaleDateString('he-IL')}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#10b981' }}>
                      ₪{payment.amount}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af', flexDirection: 'column', gap: '1rem' }}>
                <Banknote size={40} opacity={0.2} />
                <span>טרם התקבלו תשלומים.</span>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Recent Orders Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: ordersExpanded ? '400px' : 'auto', transition: 'height 0.3s ease' }}>
          <div style={{ background: '#eff6ff', padding: '1.5rem', borderBottom: ordersExpanded ? '1px solid #dbeafe' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#3b82f6', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><ShoppingBag size={20} /></div>
              <h2 style={{ margin: 0, color: '#1d4ed8', fontSize: '1.25rem' }}>הזמנות אחרונות</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setOrdersExpanded(!ordersExpanded)} title={ordersExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1d4ed8', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(59, 130, 246, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {ordersExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {ordersExpanded && (
          <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
            {loadingDashboard ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" color="#3b82f6" /></div>
            ) : recentOrders.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentOrders.map(order => (
                  <li key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: '#dbeafe', color: '#1d4ed8', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                        #{order.orderId}
                      </div>
                      <div>
                        <Link href={`/orders/${order.orderId}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: '500', textDecoration: 'none', color: 'inherit' }}>
                          {order.customer?.firstName} {order.customer?.lastName}
                        </Link>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                          הזמנה: {order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : '-'} • אירוע: {order.eventDateHebrew || '-'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                          פריטים: {order.items?.length || 0} • סטטוס: {order.status || 'פעיל'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#3b82f6' }}>
                        ₪{order.totalAmount || 0}
                      </div>
                      <Link href={`/orders/${order.orderId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', background: '#eff6ff', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="לפרטי ההזמנה">
                        <ExternalLink size={18} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af', flexDirection: 'column', gap: '1rem' }}>
                <ShoppingBag size={40} opacity={0.2} />
                <span>אין הזמנות אחרונות.</span>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Recent Rentals Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: rentalsExpanded ? '400px' : 'auto', transition: 'height 0.3s ease' }}>
          <div style={{ background: '#fffbeb', padding: '1.5rem', borderBottom: rentalsExpanded ? '1px solid #fef3c7' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ background: '#f59e0b', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><Shirt size={20} /></div>
              <h2 style={{ margin: 0, color: '#d97706', fontSize: '1.25rem' }}>השכרות אחרונות</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button onClick={() => setRentalsExpanded(!rentalsExpanded)} title={rentalsExpanded ? "כווץ" : "הרחב"} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d97706', display: 'flex', alignItems: 'center', padding: '0.2rem', borderRadius: '6px' }} onMouseOver={e=>e.currentTarget.style.background='rgba(245, 158, 11, 0.1)'} onMouseOut={e=>e.currentTarget.style.background='none'}>
                {rentalsExpanded ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            </div>
          </div>
          {rentalsExpanded && (
          <div style={{ padding: '1rem', overflowY: 'auto', flex: 1 }}>
            {loadingDashboard ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><Loader2 className="animate-spin" color="#f59e0b" /></div>
            ) : recentRentals.length > 0 ? (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentRentals.map(rental => (
                  <li key={rental.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0.5rem', borderBottom: '1px solid #f3f4f6' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ background: '#fef3c7', color: '#d97706', width: '40px', height: '40px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                        <Shirt size={20} />
                      </div>
                      <div>
                        <Link href={`/orders/${rental.order?.orderId}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: '500', textDecoration: 'none', color: 'inherit' }}>הזמנה #{rental.order?.orderId} • {rental.dressItem?.dress?.name || 'שמלה'}</Link>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.2rem' }}>
                           ברקוד: {rental.barcode || '-'} • מידה: {rental.sizeText || rental.dressItem?.sizeText || '-'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                           לקוח: {rental.order?.customer?.firstName} {rental.order?.customer?.lastName} • שעה: {rental.takenDate ? new Date(rental.takenDate).toLocaleString('he-IL', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit' }) : '-'} • עובד: {rental.employeeName || '-'}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {renderStatusIcon(rental.status)} {rental.status}
                      </div>
                      <Link href={`/orders/${rental.order?.orderId}`} target="_blank" rel="noopener noreferrer" style={{ color: '#d97706', background: '#fffbeb', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="לפרטי ההזמנה">
                        <ExternalLink size={18} />
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9ca3af', flexDirection: 'column', gap: '1rem' }}>
                <Shirt size={40} opacity={0.2} />
                <span>אין השכרות אחרונות.</span>
              </div>
            )}
          </div>
          )}
        </div>
        
      </div>
      )}

      {quickPaymentOpen && (
        <QuickPaymentModal 
          isOpen={quickPaymentOpen} 
          onClose={(success) => {
            setQuickPaymentOpen(false);
            if (success) {
              fetch('/api/dashboard/debts')
                .then(r => r.json())
                .then(data => {
                  setDebts(data.debts || []);
                  setRecentPayments(data.recentPayments || []);
                });
            }
          }} 
        />
      )}
    </main>
  );
}
