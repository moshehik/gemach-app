'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Loader2, Search } from 'lucide-react';

export default function QuickPaymentModal({ isOpen, onClose, initialOrderId = '' }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [orderData, setOrderData] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('אשראי');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSearch = async () => {
    if (!orderId) return;
    setSearching(true);
    setError('');
    setOrderData(null);
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (!res.ok) {
        throw new Error('הזמנה לא נמצאה');
      }
      const data = await res.json();
      
      const totalRequired = data.obligations?.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0) || 0;
      const totalPaid = data.payments?.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0) || 0;
      const remaining = totalRequired - totalPaid;
      
      setOrderData({
        ...data,
        totalRequired,
        totalPaid,
        remaining
      });
      if (remaining > 0) {
        setAmount(remaining.toString());
      }
    } catch (err) {
      setError(err.message || 'שגיאה בחיפוש הזמנה');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (initialOrderId) {
        setOrderId(initialOrderId);
        // small timeout to allow state to settle
        setTimeout(() => handleSearch(), 100);
      } else {
        setOrderId('');
        setOrderData(null);
        setAmount('');
        setPaymentMethod('אשראי');
        setNotes('');
        setError('');
        setSuccess('');
      }
    }
  }, [isOpen, initialOrderId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('אנא הזן סכום תקין');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderId,
          customerId: orderData?.customerId,
          amount: parseFloat(amount),
          paymentMethod,
          notes
        })
      });

      if (!res.ok) throw new Error('שגיאה בשמירת התשלום');
      
      setSuccess('התשלום נשמר בהצלחה!');
      setTimeout(() => {
        setSuccess('');
        onClose(true);
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '1rem' }}>
      <div className="animate-fade-in" style={{ background: 'var(--card-bg)', borderRadius: '16px', width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden', direction: 'rtl' }}>
        <div style={{ padding: '1.5rem', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: '#0f172a', fontSize: '1.25rem', fontWeight: '700' }}>קבלת תשלום מהיר</h3>
          <button onClick={() => onClose(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}><X size={24} /></button>
        </div>
        
        <div style={{ padding: '1.5rem' }}>
          {success ? (
            <div style={{ textAlign: 'center', color: '#16a34a', padding: '2rem 0' }}>
              <Check size={48} style={{ margin: '0 auto 1rem auto' }} />
              <h4 style={{ margin: 0, fontSize: '1.2rem' }}>{success}</h4>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#334155' }}>מספר הזמנה</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="number" 
                    value={orderId} 
                    onChange={(e) => setOrderId(e.target.value)} 
                    placeholder="הזן מס' הזמנה"
                    style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }} 
                  />
                  <button type="button" onClick={handleSearch} disabled={searching || !orderId} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '45px', padding: 0 }}>
                    {searching ? <Loader2 size={20} className="animate-spin" /> : <Search size={20} />}
                  </button>
                </div>
              </div>

              {error && <div style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.9rem' }}>{error}</div>}

              {orderData && (
                <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', marginBottom: '1.2rem', fontSize: '0.95rem', color: '#475569' }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '0.25rem', color: '#1e293b' }}>
                    לקוח: {orderData.customer?.firstName} {orderData.customer?.lastName}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                    <span>סה"כ לתשלום: ₪{orderData.totalRequired}</span>
                    <span>שולם: ₪{orderData.totalPaid}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontWeight: 'bold', color: orderData.remaining > 0 ? '#dc2626' : '#16a34a' }}>
                    <span>יתרת חוב:</span>
                    <span>₪{orderData.remaining}</span>
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#334155' }}>סכום תשלום (₪)</label>
                <input 
                  type="number" 
                  step="0.01"
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  required
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1.1rem', fontWeight: 'bold', color: '#0f172a' }} 
                />
              </div>

              <div style={{ marginBottom: '1.2rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#334155' }}>אופן תשלום</label>
                <select 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem', background: 'var(--card-bg)' }}
                >
                  <option value="אשראי">אשראי</option>
                  <option value="מזומן">מזומן</option>
                  <option value="העברה בנקאית">העברה בנקאית</option>
                  <option value="המחאה">המחאה</option>
                  <option value="אחר">אחר</option>
                </select>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#334155' }}>הערות</label>
                <input 
                  type="text" 
                  value={notes} 
                  onChange={(e) => setNotes(e.target.value)} 
                  style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '1rem' }} 
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                <button type="button" onClick={() => onClose(false)} style={{ flex: 1, padding: '0.75rem', background: 'var(--card-bg)', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}>
                  ביטול
                </button>
                <button type="submit" disabled={loading} style={{ flex: 2, padding: '0.75rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {loading ? <Loader2 className="animate-spin" /> : 'שמור תשלום'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
