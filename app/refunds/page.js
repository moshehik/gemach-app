'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Search, CheckCircle, XCircle, Download, CreditCard, Coins, Mail, Info, RotateCcw, ExternalLink, AlertCircle, Calendar, ArrowUpRight } from 'lucide-react';

const refundsCache = new Map();

export default function RefundsPage() {
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'executed'
  const [isProcessing, setIsProcessing] = useState(false);

  const [activeTab, setActiveTab] = useState('refunds'); // 'refunds' or 'debts'
  const [debts, setDebts] = useState([]);
  const [debtsLoading, setDebtsLoading] = useState(false);
  const [debtsSearchTerm, setDebtsSearchTerm] = useState('');

  async function fetchDebts() {
    setDebtsLoading(true);
    try {
      const res = await fetch('/api/orders?filterStatus=unpaid_all&page=1&limit=1000');
      const data = await res.json();
      if (data && Array.isArray(data.orders)) {
        setDebts(data.orders);
      }
    } catch (err) {
      console.error('Failed to fetch debts:', err);
    } finally {
      setDebtsLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'debts' && debts.length === 0) {
      fetchDebts();
    }
  }, [activeTab]);


  async function fetchRefunds(isPrefetch = false) {
    if (!isPrefetch) setLoading(true);
    
    // SWR Cache Hit
    if (!isPrefetch && refundsCache.has('refunds')) {
      setRefunds(refundsCache.get('refunds'));
      setLoading(false); // UI becomes interactive instantly
    }

    try {
      const res = await fetch('/api/refunds');
      const data = await res.json();
      if (Array.isArray(data)) {
        refundsCache.set('refunds', data); // Update Cache silently
        if (!isPrefetch) setRefunds(data);
      } else {
        if (!isPrefetch) setRefunds([]);
      }
    } catch (err) {
      console.error('Failed to fetch refunds:', err);
    } finally {
      if (!isPrefetch) setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, []);

  const executeRefund = async (id) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך לסמן זיכוי זה כ"בוצע"?\nפעולה זו תיצור תשלום הפכי (מינוס) בכרטיס ההזמנה המקושר.'))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true })
      });
      
      if (!res.ok) throw new Error('Failed to execute refund');
      
      const updatedRefund = await res.json();
      setRefunds(prev => prev.map(r => r.id === id ? { ...r, ...updatedRefund } : r));
      alert('הזיכוי סומן כבוצע בהצלחה והתעדכן בכרטיס ההזמנה.');
    } catch (err) {
      alert('שגיאה בביצוע הזיכוי: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const undoExecuteRefund = async (id) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך לבטל את אישור ביצוע הזיכוי?\nהפעולה תחזיר את הזיכוי לסטטוס ממתין ותמחק את תנועת ההחזר מכרטיס ההזמנה.'))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: false })
      });
      
      if (!res.ok) throw new Error('Failed to undo refund execution');
      
      const updatedRefund = await res.json();
      setRefunds(prev => prev.map(r => r.id === id ? { ...r, ...updatedRefund } : r));
      alert('ביצוע הזיכוי בוטל והתעדכן בכרטיס ההזמנה.');
    } catch (err) {
      alert('שגיאה בביטול ביצוע הזיכוי: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const cancelRefund = async (id) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך לבטל ולמחוק בקשת זיכוי זו לחלוטין?'))) {
      return;
    }

    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${id}`, {
        method: 'DELETE'
      });
      
      if (!res.ok) throw new Error('Failed to cancel refund');
      
      setRefunds(prev => prev.filter(r => r.id !== id));
      alert('בקשת הזיכוי בוטלה.');
    } catch (err) {
      alert('שגיאה בביטול הזיכוי: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['תאריך בקשה', 'לקוח', 'טלפון', 'מייל', 'מספר הזמנה', 'סכום לזיכוי', 'סיבה', 'בנק', 'סניף', 'חשבון', 'שם בעל החשבון', 'פרטי אשראי מקורי', 'סטטוס', 'תאריך ביצוע'];
    const csvData = [
      headers.join(','),
      ...filteredRefunds.map(r => {
        const customerName = r.customer ? `${r.customer.firstName || ''} ${r.customer.lastName || ''}`.trim() : '';
        const phone = r.customer?.phone1 || '';
        const email = r.email || r.customer?.email || '';
        const dateStr = new Date(r.createdAt).toLocaleDateString('he-IL');
        const execDateStr = r.isExecuted && r.executionDate ? new Date(r.executionDate).toLocaleDateString('he-IL') : '';
        const statusStr = r.isExecuted ? 'בוצע' : 'ממתין';
        
        return [
          dateStr,
          `"${customerName}"`,
          `"${phone}"`,
          `"${email}"`,
          r.orderId || '',
          r.amount || 0,
          `"${r.reason || ''}"`,
          `"${r.bankName || ''}"`,
          `"${r.bankBranch || ''}"`,
          `"${r.bankAccount || ''}"`,
          `"${r.bankAccountName || ''}"`,
          `"${r.paymentDetails || ''}"`,
          statusStr,
          execDateStr
        ].join(',');
      })
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `refunds_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredRefunds = refunds.filter(r => {
    const matchesSearch = 
      (r.customer?.firstName || '').includes(searchTerm) ||
      (r.customer?.lastName || '').includes(searchTerm) ||
      (r.customer?.phone1 || '').includes(searchTerm) ||
      (r.orderId?.toString() || '').includes(searchTerm) ||
      (r.amount?.toString() || '').includes(searchTerm);
      
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'pending') return matchesSearch && !r.isExecuted;
    if (filterStatus === 'executed') return matchesSearch && r.isExecuted;
    return matchesSearch;
  });

  const filteredDebts = debts.filter(d => {
    const matchesSearch = 
      (d.customer?.firstName || '').includes(debtsSearchTerm) ||
      (d.customer?.lastName || '').includes(debtsSearchTerm) ||
      (d.customer?.phone1 || '').includes(debtsSearchTerm) ||
      (d.orderId?.toString() || '').includes(debtsSearchTerm);
    return matchesSearch;
  });

  return (
    <main data-agy-id="refunds_page_main" className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '1400px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: activeTab === 'debts' ? '#e11d48' : 'var(--primary-color)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '2rem', fontWeight: 'bold' }}>
          {activeTab === 'refunds' ? <Coins data-element-name="רכיב_page_1" size={32} /> : <AlertCircle size={32} />}
          {activeTab === 'refunds' ? 'ניהול זיכויים' : 'ניהול חובות'}
        </h1>
      </div>


      <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e2e8f0', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('refunds')}
          style={{ 
            padding: '1rem 2rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'refunds' ? '3px solid var(--primary-color)' : '3px solid transparent',
            color: activeTab === 'refunds' ? 'var(--primary-color)' : '#64748b',
            fontWeight: activeTab === 'refunds' ? 'bold' : 'normal',
            fontSize: '1.1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <Coins size={20} />
          זיכויים
        </button>
        <button 
          onClick={() => setActiveTab('debts')}
          style={{ 
            padding: '1rem 2rem', 
            background: 'none', 
            border: 'none', 
            borderBottom: activeTab === 'debts' ? '3px solid #e11d48' : '3px solid transparent',
            color: activeTab === 'debts' ? '#e11d48' : '#64748b',
            fontWeight: activeTab === 'debts' ? 'bold' : 'normal',
            fontSize: '1.1rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s'
          }}
        >
          <AlertCircle size={20} />
          חובות פתוחים
        </button>
      </div>

      {activeTab === 'refunds' ? (
        <>
      <div style={{ background: 'var(--card-bg)', padding: '0.75rem 1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', border: '1px solid var(--border-color)' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '300px' }}>
          <Search data-element-name="רכיב_page_4" size={20} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input data-element-name="שדה_page_5" data-agy-id="refunds_search_input"
            type="text" 
            placeholder="חיפוש לפי שם לקוח, טלפון, הזמנה או סכום..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '0.8rem 2.8rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--element-border)', fontSize: '1rem' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '12px' }}>
            <button data-element-name="כפתור_page_6" data-agy-id="filter_all" onClick={() => setFilterStatus('all')} style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', border: filterStatus === 'all' ? 'none' : '1px solid transparent', background: filterStatus === 'all' ? 'linear-gradient(135deg, #4f46e5, #7c3aed)' : 'transparent', color: filterStatus === 'all' ? 'white' : '#64748b', fontWeight: filterStatus === 'all' ? '600' : '500', cursor: 'pointer', boxShadow: filterStatus === 'all' ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none', transition: 'all 0.3s ease', transform: filterStatus === 'all' ? 'translateY(-1px)' : 'none' }}>הכל</button>
            <button data-element-name="כפתור_page_7" data-agy-id="filter_pending" onClick={() => setFilterStatus('pending')} style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', border: filterStatus === 'pending' ? 'none' : '1px solid transparent', background: filterStatus === 'pending' ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'transparent', color: filterStatus === 'pending' ? 'white' : '#64748b', fontWeight: filterStatus === 'pending' ? '600' : '500', cursor: 'pointer', boxShadow: filterStatus === 'pending' ? '0 4px 12px rgba(245, 158, 11, 0.3)' : 'none', transition: 'all 0.3s ease', transform: filterStatus === 'pending' ? 'translateY(-1px)' : 'none' }}>ממתינים</button>
            <button data-element-name="כפתור_page_8" data-agy-id="filter_executed" onClick={() => setFilterStatus('executed')} style={{ padding: '0.6rem 1.5rem', borderRadius: '12px', border: filterStatus === 'executed' ? 'none' : '1px solid transparent', background: filterStatus === 'executed' ? 'linear-gradient(135deg, #10b981, #059669)' : 'transparent', color: filterStatus === 'executed' ? 'white' : '#64748b', fontWeight: filterStatus === 'executed' ? '600' : '500', cursor: 'pointer', boxShadow: filterStatus === 'executed' ? '0 4px 12px rgba(16, 185, 129, 0.3)' : 'none', transition: 'all 0.3s ease', transform: filterStatus === 'executed' ? 'translateY(-1px)' : 'none' }}>בוצעו</button>
          </div>
          
          <button data-element-name="כפתור_page_2" data-agy-id="refunds_export_btn" onClick={exportToCSV} className="btn-header-icon" title="ייצוא לאקסל">
            <Download data-element-name="רכיב_page_3" size={20} />
          </button>
        </div>
      </div>

      <div style={{ background: 'var(--card-bg)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', overflow: 'visible' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
             <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
             טוען נתונים...
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
            לא נמצאו זיכויים תואמים.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
              <thead>
                <tr style={{ background: 'var(--card-bg)', color: 'var(--text-main)', borderBottom: '2px solid var(--border-color)' }}>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>תאריך</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>לקוח</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>הזמנה</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>סכום</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>פרטי בנק</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>אשראי מקורי</th>
                  <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>סטטוס</th>
                  <th style={{ padding: '0.6rem 0.75rem', textAlign: 'center', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {filteredRefunds.map(refund => (
                  <tr key={refund.id} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <td style={{ padding: '0.4rem 0.5rem', color: '#64748b' }}>
                      <div style={{ fontWeight: '500', color: '#334155' }}>{new Date(refund.createdAt).toLocaleDateString('he-IL')}</div>
                      {refund.isExecuted && <div style={{ fontSize: '0.8rem' }}>בוצע: {new Date(refund.executionDate).toLocaleDateString('he-IL')}</div>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                        <Link data-element-name="רכיב_page_9" href={`/customers/${refund.customerId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                          {refund.customer ? `${refund.customer.firstName || ''} ${refund.customer.lastName || ''}`.trim() : 'לקוח לא ידוע'}
                        </Link>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{refund.customer?.phone1}</div>
                      {refund.email && <div style={{ fontSize: '0.85rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Mail data-element-name="רכיב_page_10" size={12}/> {refund.email}</div>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {refund.orderId ? (
                        <Link data-element-name="רכיב_page_11" href={`/orders/${refund.orderId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold', background: '#e0f2fe', padding: '0.4rem 0.8rem', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#bae6fd'} onMouseOut={(e) => e.currentTarget.style.background = '#e0f2fe'}>
                          #{refund.orderId}
                          <ArrowUpRight size={14} />
                        </Link>
                      ) : '-'}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: '#ef4444', fontSize: '1.1rem' }}>
                      ₪{refund.amount}
                      {refund.reason && <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 'normal' }}>{refund.reason}</div>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {refund.bankName || refund.bankAccount ? (
                        <div style={{ fontSize: '0.9rem', color: '#334155' }}>
                          <div>{refund.bankName || 'בנק חסר'} {refund.bankBranch ? `(סניף ${refund.bankBranch})` : ''}</div>
                          <div style={{ fontWeight: '600' }}>{refund.bankAccount || 'חשבון חסר'}</div>
                          {refund.bankAccountName && <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{refund.bankAccountName}</div>}
                        </div>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>לא הוזנו</span>
                      )}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      {refund.paymentDetails ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#334155', fontSize: '0.9rem' }}>
                          <CreditCard data-element-name="רכיב_page_12" size={14} /> {refund.paymentDetails}
                        </div>
                      ) : <span style={{ color: '#94a3b8' }}>-</span>}
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '20px',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        background: refund.isExecuted ? '#dcfce7' : '#fef08a',
                        color: refund.isExecuted ? '#166534' : '#854d0e'
                      }}>
                        {refund.isExecuted ? <CheckCircle data-element-name="רכיב_page_13" size={14}/> : <Info data-element-name="רכיב_page_14" size={14}/>}
                        {refund.isExecuted ? 'בוצע' : 'ממתין לביצוע'}
                      </span>
                    </td>
                    <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                        {!refund.isExecuted && (
                          <button data-element-name="כפתור_page_15" data-agy-id={`execute_btn_${refund.id}`}
                            onClick={() => executeRefund(refund.id)}
                            disabled={isProcessing}
                            title="סמן כבוצע"
                            style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#bbf7d0'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
                          >
                            <CheckCircle data-element-name="רכיב_page_16" size={18} />
                          </button>
                        )}
                        {refund.isExecuted && (
                          <button data-element-name="כפתור_page_undo" data-agy-id={`undo_execute_btn_${refund.id}`}
                            onClick={() => undoExecuteRefund(refund.id)}
                            disabled={isProcessing}
                            title="בטל ביצוע"
                            style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fde68a'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fef3c7'}
                          >
                            <RotateCcw data-element-name="רכיב_page_undo_icon" size={18} />
                          </button>
                        )}
                        <button data-element-name="כפתור_page_17" data-agy-id={`cancel_btn_${refund.id}`}
                          onClick={() => cancelRefund(refund.id)}
                          disabled={isProcessing}
                          title="בטל בקשה"
                          style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', padding: '0.5rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fecaca'}
                          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fee2e2'}
                        >
                          <XCircle data-element-name="רכיב_page_18" size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

        </>
      ) : (
        <>
          <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', boxShadow: 'var(--shadow-sm)', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '300px' }}>
              <Search size={20} style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text" 
                placeholder="חיפוש חוב לפי שם לקוח, טלפון, או הזמנה..." 
                value={debtsSearchTerm}
                onChange={(e) => setDebtsSearchTerm(e.target.value)}
                style={{ width: '100%', padding: '0.8rem 2.8rem 0.8rem 1rem', borderRadius: '12px', border: '1px solid var(--element-border)', fontSize: '1rem' }}
              />
            </div>
          </div>
          
          <div style={{ background: 'var(--card-bg)', borderRadius: '16px', boxShadow: 'var(--shadow-md)', overflow: 'visible' }}>
            {debtsLoading ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                 <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #e11d48', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }} />
                 טוען נתונים...
              </div>
            ) : filteredDebts.length === 0 ? (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '1.2rem' }}>
                לא נמצאו חובות תואמים.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--card-bg)', color: '#be123c', borderBottom: '2px solid #fecdd3' }}>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>תאריך אירוע</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>לקוח</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>הזמנה</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>סה"כ להזמנה</th>
                      <th style={{ padding: '0.6rem 0.75rem', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>שולם</th>
                      <th style={{ padding: '0.6rem 0.75rem', color: '#e11d48', position: 'sticky', top: 'var(--navbar-height, 72px)', zIndex: 25, background: 'var(--card-bg)', backdropFilter: 'blur(12px)', boxShadow: '0 4px 10px -2px rgba(0,0,0,0.06)' }}>יתרת חוב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebts.map(order => {
                      const debtAmount = order.totalAmount - order.totalPaid;
                      return (
                      <tr key={order.orderId} style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <td style={{ padding: '0.4rem 0.5rem', color: '#64748b' }}>
                          <div style={{ fontWeight: '500', color: '#334155' }}>{order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'ללא תאריך'}</div>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
                            <Link href={`/customers/${order.customerId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                              {order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לקוח לא ידוע'}
                            </Link>
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>{order.customer?.phone1}</div>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem' }}>
                          <Link href={`/orders/${order.orderId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#0ea5e9', textDecoration: 'none', fontWeight: 'bold', background: '#e0f2fe', padding: '0.4rem 0.8rem', borderRadius: '8px', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = '#bae6fd'} onMouseOut={(e) => e.currentTarget.style.background = '#e0f2fe'}>
                            #{order.orderId}
                            <ArrowUpRight size={14} />
                          </Link>
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: '#334155' }}>
                          ₪{order.totalAmount}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', color: '#16a34a' }}>
                          ₪{order.totalPaid}
                        </td>
                        <td style={{ padding: '0.4rem 0.5rem', fontWeight: 'bold', color: '#ef4444', fontSize: '1.1rem' }}>
                          ₪{debtAmount}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </main>
  );
}
