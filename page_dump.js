'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles, X, Loader2, ArrowLeft, CreditCard, Banknote, User, ShoppingBag, Shirt } from 'lucide-react';
import Link from 'next/link';
import AISearchBar from './components/AISearchBar';

export default function HomeDashboard() {
  const router = useRouter();
  
  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  
  // AI Chat state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState('');

  // Dashboard state
  const [debts, setDebts] = useState([]);
  const [recentPayments, setRecentPayments] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch('/api/dashboard/debts');
        if (res.ok) {
          const data = await res.json();
          setDebts(data.debts || []);
          setRecentPayments(data.recentPayments || []);
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
    setAiResponse('');
    try {
      const res = await fetch(`/api/global-search?q=${encodeURIComponent(searchInput)}`);
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleAiSearch = async (query) => {
    setAiLoading(true);
    setSearchResults(null);
    setAiResponse('');
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: query, context: 'User is searching from the general system home dashboard.' })
      });
      const result = await res.json();
      if (res.ok) {
        setAiResponse(result.response);
      } else {
        setAiResponse('שגיאה בחיפוש חכם.');
      }
    } catch (e) {
      console.error(e);
      setAiResponse('שגיאת תקשורת.');
    } finally {
      setAiLoading(false);
    }
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearchResults(null);
    setAiResponse('');
  };

  return (
    <main className="container animate-fade-in" style={{ paddingTop: '2rem', paddingBottom: '4rem' }}>
      
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
            onAiSearch={handleAiSearch}
            loading={loadingSearch || aiLoading}
          />
        </div>
      </div>

      {/* AI Response Area */}
      {aiResponse && (
        <div className="animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto 3rem auto', background: 'linear-gradient(135deg, #fdf2f8, #f5f3ff)', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(236, 72, 153, 0.1)', border: '1px solid #fbcfe8' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ec4899', marginBottom: '1rem', fontWeight: 'bold' }}>
            <Sparkles size={24} />
            <span style={{ fontSize: '1.2rem' }}>תשובת המערכת:</span>
          </div>
          <div style={{ fontSize: '1.1rem', lineHeight: '1.6', color: '#374151' }}>
            {aiResponse.split('\n').map((line, i) => <p key={i} style={{ margin: '0.5rem 0' }}>{line}</p>)}
          </div>
        </div>
      )}

      {/* Global Search Results Area */}
      {searchResults && !aiResponse && (
        <div className="animate-fade-in" style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-color)' }}>תוצאות חיפוש ל: "{searchInput}"</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            
            {/* Customers */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', marginBottom: '1rem' }}>
                <User size={20} /> לקוחות קשורים ({searchResults.customers?.length || 0})
              </h3>
              {searchResults.customers?.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {searchResults.customers.map(c => (
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
              ) : <div style={{ color: '#9ca3af' }}>לא נמצאו לקוחות</div>}
            </div>

            {/* Orders */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', marginBottom: '1rem' }}>
                <ShoppingBag size={20} /> הזמנות קשורות ({searchResults.orders?.length || 0})
              </h3>
              {searchResults.orders?.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {searchResults.orders.map(o => (
                    <li key={o.id} style={{ borderBottom: '1px solid #f3f4f6', padding: '0.75rem 0' }}>
                      <Link href={`/orders/${o.orderId}`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 'bold' }}>הזמנה #{o.orderId}</div>
                          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{o.firstName} {o.lastName} • ₪{o.totalAmount}</div>
                        </div>
                        <ArrowLeft size={16} color="#9ca3af" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : <div style={{ color: '#9ca3af' }}>לא נמצאו הזמנות</div>}
            </div>

            {/* Rentals */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', marginBottom: '1rem' }}>
                <Shirt size={20} /> השכרות קשורות ({searchResults.rentals?.length || 0})
              </h3>
              {searchResults.rentals?.length > 0 ? (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {searchResults.rentals.map(r => (
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
              ) : <div style={{ color: '#9ca3af' }}>לא נמצאו השכרות</div>}
            </div>

          </div>
        </div>
      )}

      {/* Main Dashboard Widgets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem' }}>
        
        {/* Debts Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '400px' }}>
          <div style={{ background: '#fef2f2', padding: '1.5rem', borderBottom: '1px solid #fee2e2', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#ef4444', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><CreditCard size={20} /></div>
            <h2 style={{ margin: 0, color: '#b91c1c', fontSize: '1.25rem' }}>חובות פתוחים</h2>
          </div>
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
                <span>אין חובות פתוחים במערכת 🎉</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Payments Widget */}
        <div style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '400px' }}>
          <div style={{ background: '#ecfdf5', padding: '1.5rem', borderBottom: '1px solid #d1fae5', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#10b981', color: 'white', padding: '0.5rem', borderRadius: '8px' }}><Banknote size={20} /></div>
            <h2 style={{ margin: 0, color: '#047857', fontSize: '1.25rem' }}>תשלומים אחרונים</h2>
          </div>
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
        </div>

      </div>
    </main>
  );
}
