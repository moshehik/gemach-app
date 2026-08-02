'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HistoryViewer from '@/components/HistoryViewer';
import SendEmailModal from '@/components/SendEmailModal';
import { Copy, Mail } from 'lucide-react';
import { calculateOrderStatus, getStatusColor, calculatePaymentStatus, getPaymentStatusColor } from '@/lib/orderStatus';

export default function CustomerPage({ params }) {
  const router = useRouter();
  const { id } = use(params);
  const [customer, setCustomer] = useState(null);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  useEffect(() => {
    if (id === 'new') {
      setCustomer({ firstName: '', lastName: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: '', notes: '' });
      setLoading(false);
      return;
    }
    fetch(`/api/customers/${id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) router.push('/customers');
        else setCustomer(data);
        
        // Fetch refunds for customer
        return fetch(`/api/refunds?customerId=${id}`);
      })
      .then(res => res ? res.json() : [])
      .then(refundsData => {
        if (Array.isArray(refundsData)) setRefunds(refundsData);
        setLoading(false);
      });
  }, [id, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setCustomer(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    const url = id === 'new' ? '/api/customers' : `/api/customers/${id}`;
    const method = id === 'new' ? 'POST' : 'PUT';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customer)
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 409 && data.message) {
          alert(data.message);
          return;
        }
        throw new Error(data.message || 'שגיאה בשמירת נתונים');
      }

      if (id === 'new' && data.id) {
        router.push(`/customers/${data.id}`);
      } else {
        alert('הפרטים נשמרו בהצלחה!');
      }
    } catch (e) {
      alert(e.message || 'שגיאה בשמירת נתונים');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="container" style={{ padding: '2rem', textAlign: 'center' }}>טוען נתונים...</div>;
  if (!customer) return null;

  return (
    <main data-agy-id="customer_profile_main_container" className="container animate-fade-in" style={{ paddingTop: '2rem', maxWidth: '1000px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button data-element-name="כפתור_page_1" data-agy-id="customer_back_btn" type="button" onClick={() => router.back()} className="btn btn-outline" style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          →
        </button>
        <h1 style={{ color: 'var(--primary-color)', margin: 0 }}>
          {id === 'new' ? 'לקוח חדש' : `כרטיס לקוח: ${[customer.firstName, customer.lastName].filter(n => n && String(n).toLowerCase() !== 'null').join(' ')}`}
        </h1>
      </div>

      {id !== 'new' && (
        <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #eee', marginBottom: '2rem' }}>
          <button data-element-name="כפתור_page_2" 
            data-agy-id="customer_details_tab_btn"
            className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} 
            onClick={() => setActiveTab('details')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'details' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'details' ? 'bold' : 'normal', color: activeTab === 'details' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            פרטים אישיים
          </button>
          <button data-element-name="כפתור_page_3" 
            data-agy-id="customer_orders_tab_btn"
            className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`} 
            onClick={() => setActiveTab('orders')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'orders' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'orders' ? 'bold' : 'normal', color: activeTab === 'orders' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            הזמנות
          </button>
          <button data-element-name="כפתור_page_4" 
            data-agy-id="customer_payments_tab_btn"
            className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`} 
            onClick={() => setActiveTab('payments')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'payments' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'payments' ? 'bold' : 'normal', color: activeTab === 'payments' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            תשלומים
          </button>
          <button data-element-name="כפתור_page_5" 
            data-agy-id="customer_refunds_tab_btn"
            className={`tab-btn ${activeTab === 'refunds' ? 'active' : ''}`} 
            onClick={() => setActiveTab('refunds')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'refunds' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'refunds' ? 'bold' : 'normal', color: activeTab === 'refunds' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            זיכויים ופרטי בנק
          </button>
          <button data-element-name="כפתור_page_6" 
            data-agy-id="customer_history_tab_btn"
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} 
            onClick={() => setActiveTab('history')}
            style={{ padding: '0.75rem 1.5rem', background: 'none', border: 'none', borderBottom: activeTab === 'history' ? '3px solid var(--primary-color)' : '3px solid transparent', fontWeight: activeTab === 'history' ? 'bold' : 'normal', color: activeTab === 'history' ? 'var(--primary-color)' : 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem', transition: 'all 0.3s' }}
          >
            היסטוריה
          </button>
        </div>
      )}

      {activeTab === 'details' && (
        <form data-agy-id="customer_details_form" onSubmit={handleSave} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם פרטי *</label>
              <input data-element-name="שדה_page_7" data-agy-id="customer_firstname_input" type="text" name="firstName" value={customer.firstName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם משפחה *</label>
              <input data-element-name="שדה_page_8" data-agy-id="customer_lastname_input" type="text" name="lastName" value={customer.lastName || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נייד *</label>
              <input data-element-name="שדה_page_9" data-agy-id="customer_phone1_input" type="text" name="phone1" value={customer.phone1 || ''} onChange={handleChange} required style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>טלפון נוסף</label>
              <input data-element-name="שדה_page_10" data-agy-id="customer_phone2_input" type="text" name="phone2" value={customer.phone2 || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>דוא"ל</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input data-element-name="שדה_page_11" data-agy-id="customer_email_input" type="email" name="email" value={customer.email || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
                {customer.email && (
                  <>
                    <button data-element-name="כפתור_page_12" data-agy-id="copy_email_btn" type="button" onClick={() => navigator.clipboard.writeText(customer.email)} title="העתק כתובת מייל" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                      <Copy data-element-name="רכיב_page_13" size={20} />
                    </button>
                    <button data-element-name="כפתור_page_14" data-agy-id="send_email_btn" type="button" onClick={() => setEmailModalOpen(true)} title="שלח מייל" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-color)' }}>
                      <Mail data-element-name="רכיב_page_15" size={20} />
                    </button>
                  </>
                )}
              </div>
              {(!customer.email || !customer.email.includes('@')) && (
                <div style={{ marginTop: '0.5rem' }}>
                  <button data-element-name="כפתור_page_16"
                    data-agy-id="autocomplete_gmail_btn"
                    type="button"
                    onClick={() => {
                      const currentEmail = customer.email || '';
                      setCustomer(prev => ({ ...prev, email: currentEmail + '@gmail.com' }));
                    }}
                    style={{
                      padding: '0.3rem 0.6rem',
                      fontSize: '0.85rem',
                      background: 'var(--primary-color)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.opacity = '0.8'}
                    onMouseOut={(e) => e.target.style.opacity = '1'}
                  >
                    השלם ל- @gmail.com
                  </button>
                </div>
              )}
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>עיר</label>
              <input data-element-name="שדה_page_17" data-agy-id="customer_city_input" type="text" name="city" value={customer.city || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>רחוב</label>
              <input data-element-name="שדה_page_18" data-agy-id="customer_street_input" type="text" name="street" value={customer.street || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>מספר בית</label>
              <input data-element-name="שדה_page_19" data-agy-id="customer_housenum_input" type="number" name="houseNum" value={customer.houseNum || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
            </div>
          </div>
          
          <div className="form-group" style={{ marginTop: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>הערות</label>
            <textarea data-element-name="טקסט_page_20" data-agy-id="customer_notes_textarea" name="notes" value={customer.notes || ''} onChange={handleChange} rows={4} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', resize: 'vertical' }} />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
            <button data-element-name="כפתור_page_21" data-agy-id="save_customer_btn" type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.75rem 2rem', borderRadius: '24px', fontSize: '1.1rem' }}>
              {saving ? 'שומר...' : 'שמור פרטים'}
            </button>
          </div>
        </form>
      )}

      {activeTab === 'history' && id !== 'new' && (
        <HistoryViewer data-element-name="רכיב_page_22" entityType="Customer" entityId={id} />
      )}

      {activeTab === 'orders' && (
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          {customer.orders && customer.orders.length > 0 ? (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem' }}>קוד הזמנה</th>
                  <th style={{ padding: '1rem' }}>תאריך אירוע</th>
                  <th style={{ padding: '1rem' }}>סטטוס פריטים</th>
                  <th style={{ padding: '1rem' }}>סכום לחיוב</th>
                  <th style={{ padding: '1rem' }}>שולם</th>
                  <th style={{ padding: '1rem' }}>סטטוס תשלום</th>
                </tr>
              </thead>
              <tbody>
                {customer.orders.map(order => {
                  const calculatedTotalAmount = order.obligations?.length > 0
                    ? order.obligations.reduce((sum, o) => sum + (o.isDeleted ? 0 : o.amount), 0)
                    : (order.totalAmount || 0);
                  const totalPaid = order.payments?.reduce((sum, p) => sum + (p.isDeleted ? 0 : p.amount), 0) || 0;
                  const orderStatus = calculateOrderStatus(order);
                  const statusColors = getStatusColor(orderStatus);
                  const paymentStatus = calculatePaymentStatus(calculatedTotalAmount, totalPaid);
                  const paymentColors = getPaymentStatusColor(paymentStatus);

                  return (
                  <tr data-element-name="לחיץ_page_23" 
                    key={order.id} 
                    onClick={() => router.push(`/orders/${order.orderId}`)}
                    style={{ borderBottom: '1px solid #eee', cursor: 'pointer', transition: 'background-color 0.2s' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(212, 175, 55, 0.05)'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td style={{ padding: '1rem' }}><Link data-element-name="לחיץ_page_24" href={`/orders/${order.orderId}`} onClick={(e) => e.stopPropagation()} style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 'bold' }}>{order.orderId}</Link></td>
                    <td style={{ padding: '1rem' }}>{order.eventDateHebrew || (order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : (order.orderDate ? new Date(order.orderDate).toLocaleDateString('he-IL') : '-'))}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ background: statusColors.bg, color: statusColors.text, padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {orderStatus}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold' }}>₪{calculatedTotalAmount}</td>
                    <td style={{ padding: '1rem', color: totalPaid >= calculatedTotalAmount && calculatedTotalAmount > 0 ? '#166534' : (totalPaid < calculatedTotalAmount ? '#b91c1c' : 'inherit') }}>₪{totalPaid}</td>
                    <td style={{ padding: '1rem' }}>
                      <span style={{ background: paymentColors.bg, color: paymentColors.text, padding: '0.3rem 0.6rem', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {paymentStatus}
                      </span>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>אין הזמנות ללקוח זה.</div>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          {customer.payments && customer.payments.length > 0 ? (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '1rem' }}>תאריך</th>
                  <th style={{ padding: '1rem' }}>הזמנה מקושרת</th>
                  <th style={{ padding: '1rem' }}>אופן תשלום</th>
                  <th style={{ padding: '1rem' }}>סכום</th>
                  <th style={{ padding: '1rem' }}>הערות</th>
                </tr>
              </thead>
              <tbody>
                {customer.payments.map(payment => (
                  <tr key={payment.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '1rem' }}>{new Date(payment.paymentDate).toLocaleDateString('he-IL')}</td>
                    <td style={{ padding: '1rem' }}>{payment.orderId ? `הזמנה ${payment.orderId}` : '-'}</td>
                    <td style={{ padding: '1rem' }}>{payment.paymentMethod}</td>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>₪{payment.amount}</td>
                    <td style={{ padding: '1rem' }}>{payment.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>אין היסטוריית תשלומים ללקוח זה.</div>
          )}
        </div>
      )}

      {activeTab === 'refunds' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Bank Details Form */}
          <form data-agy-id="customer_bank_details_form" onSubmit={handleSave} style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--primary-color)' }}>פרטי חשבון בנק לזיכויים</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם בנק</label>
                <input data-element-name="שדה_page_25" data-agy-id="customer_bankName_input" type="text" name="bankName" value={customer.bankName || ''} onChange={handleChange} placeholder="למשל: לאומי" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>סניף</label>
                <input data-element-name="שדה_page_26" data-agy-id="customer_bankBranch_input" type="text" name="bankBranch" value={customer.bankBranch || ''} onChange={handleChange} placeholder="מספר סניף" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>מספר חשבון</label>
                <input data-element-name="שדה_page_27" data-agy-id="customer_bankAccount_input" type="text" name="bankAccount" value={customer.bankAccount || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
              </div>
              <div className="form-group">
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>שם בעל החשבון</label>
                <input data-element-name="שדה_page_28" data-agy-id="customer_bankAccountName_input" type="text" name="bankAccountName" value={customer.bankAccountName || ''} onChange={handleChange} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)' }} />
              </div>
            </div>
            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button data-element-name="כפתור_page_29" data-agy-id="save_bank_details_btn" type="submit" className="btn btn-primary" disabled={saving} style={{ padding: '0.5rem 1.5rem', borderRadius: '12px' }}>
                {saving ? 'שומר...' : 'שמור פרטי בנק'}
              </button>
            </div>
          </form>

          {/* Refunds Table */}
          <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: 'var(--primary-color)' }}>היסטוריית זיכויים</h3>
            {refunds.length > 0 ? (
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #ddd', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>תאריך בקשה</th>
                    <th style={{ padding: '1rem' }}>מס' הזמנה</th>
                    <th style={{ padding: '1rem' }}>סכום</th>
                    <th style={{ padding: '1rem' }}>סיבה</th>
                    <th style={{ padding: '1rem' }}>סטטוס</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(refund => (
                    <tr key={refund.id} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '1rem' }}>{new Date(refund.createdAt).toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '1rem' }}>
                        {refund.orderId ? (
                          <Link data-element-name="רכיב_page_30" href={`/orders/${refund.orderId}`} style={{ color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 'bold' }}>
                            {refund.orderId}
                          </Link>
                        ) : '-'}
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 'bold', color: '#ef4444' }}>₪{refund.amount}</td>
                      <td style={{ padding: '1rem' }}>{refund.reason || '-'}</td>
                      <td style={{ padding: '1rem' }}>
                        <span style={{
                          padding: '0.3rem 0.6rem',
                          borderRadius: '12px',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          background: refund.isExecuted ? '#dcfce7' : '#fef08a',
                          color: refund.isExecuted ? '#166534' : '#854d0e'
                        }}>
                          {refund.isExecuted ? 'בוצע (' + new Date(refund.executionDate).toLocaleDateString('he-IL') + ')' : 'ממתין לביצוע'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>אין זיכויים ללקוח זה.</div>
            )}
          </div>
        </div>
      )}

      {id !== 'new' && (
        <SendEmailModal data-element-name="רכיב_page_31" 
          isOpen={emailModalOpen} 
          onClose={() => setEmailModalOpen(false)} 
          defaultTo={customer.email} 
          customerId={id} 
        />
      )}
    </main>
  );
}
