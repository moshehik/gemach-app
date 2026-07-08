'use client';

import { useState, useEffect } from 'react';
import { Trash2, Info } from 'lucide-react';

export default function OrderPaymentsManager({ orderId, obligations = [], payments = [], onObligationsChange, onPaymentsChange, totalRequired, totalPaid, customer = {} }) {
  const [newObligation, setNewObligation] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ paymentMethod: 'מזומן', notes: '', amount: '' });
  
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditCardData, setCreditCardData] = useState({
    cardNumber: '',
    tokef: '', // MMYY
    installments: 1,
    notes: '',
    amount: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [settings, setSettings] = useState({});
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error(err));
  }, []);

  const addObligation = () => {
    if (!newObligation.description || !newObligation.amount) return;
    const added = {
      isNew: true,
      description: newObligation.description,
      amount: parseFloat(newObligation.amount),
      isManual: true,
      createdAt: new Date().toISOString()
    };
    onObligationsChange([...obligations, added]);
    setNewObligation({ description: '', amount: '' });
  };

  const removeObligation = async (idx) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק חיוב זה?'))) {
      return;
    }
    const updated = [...obligations];
    if (updated[idx].id) {
      updated[idx].isDeleted = true;
    } else {
      updated.splice(idx, 1);
    }
    onObligationsChange(updated);
  };

  const addPayment = async () => {
    if (!newPayment.amount) return;

    const paymentAmount = parseFloat(newPayment.amount);
    const balance = totalRequired - totalPaid;
    
    if (paymentAmount > balance) {
      alert(`לא ניתן לשלם יותר מהיתרה הנדרשת (₪${balance}).`);
      return;
    }
    
    let isCodeRequired = false;
    if (newPayment.paymentMethod !== 'אשראי') {
      const level = settings.PAYMENT_APPROVAL_LEVEL || 'כולם';
      if (level === 'מנהל' || level === 'עובד') {
        isCodeRequired = true;
        const pin = await window.customPrompt(`פעולה זו דורשת הרשאת ${level}. אנא הזן סיסמת אישור:`, '', '', 'password');
        if (!pin) {
          alert('אישור תשלום בוטל.');
          return;
        }
        
        try {
          const res = await fetch('/api/auth/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin, requiredLevel: level })
          });
          const data = await res.json();
          if (!data.success) {
            alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
            return;
          }
        } catch (err) {
          alert('שגיאה באימות קוד מנהל.');
          return;
        }
      }
    }

    if (!isCodeRequired) {
      if (!(await window.customConfirm('האם אתה בטוח שברצונך להוסיף תשלום זה?'))) {
        return;
      }
    }

    const added = {
      isNew: true,
      paymentMethod: newPayment.paymentMethod,
      notes: newPayment.notes,
      amount: parseFloat(newPayment.amount),
      paymentDate: new Date().toISOString()
    };
    onPaymentsChange([...payments, added]);
    setNewPayment({ paymentMethod: 'מזומן', notes: '', amount: '' });
  };

  const removePayment = async (idx) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק תשלום זה?'))) {
      return;
    }
    const updated = [...payments];
    if (updated[idx].id) {
      updated[idx].isDeleted = true;
    } else {
      updated.splice(idx, 1);
    }
    onPaymentsChange(updated);
  };

  const handleOpenCreditModal = () => {
    setCreditCardData({
      cardNumber: '',
      tokef: '',
      installments: 1,
      notes: '',
      amount: Math.max(0, totalRequired - totalPaid).toString()
    });
    setCreditError('');
    setShowCreditModal(true);
  };

  const handleProcessCreditCard = async () => {
    if (!creditCardData.cardNumber || !creditCardData.tokef || !creditCardData.amount) {
       setCreditError('אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).');
       return;
    }

    const paymentAmount = parseFloat(creditCardData.amount);
    const balance = totalRequired - totalPaid;
    if (paymentAmount > balance) {
       setCreditError(`לא ניתן לשלם יותר מהיתרה הנדרשת (₪${balance}).`);
       return;
    }
    
    setIsProcessing(true);
    setCreditError('');
    
    try {
      const fullAddress = [customer.street || '', customer.houseNum || '', customer.city || ''].filter(Boolean).join(' ');
      const orderNote = orderId ? `הזמנה ${orderId}` : '';
      const finalNotes = [orderNote, creditCardData.notes].filter(Boolean).join(' - ');

      const response = await fetch('/api/nedarim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          phone: customer.phone1 || '',
          address: fullAddress,
          cardNumber: creditCardData.cardNumber,
          tokef: creditCardData.tokef,
          amount: parseFloat(creditCardData.amount),
          installments: parseInt(creditCardData.installments) || 1,
          notes: finalNotes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Automatically add the payment
        const added = {
          isNew: true,
          paymentMethod: 'אשראי',
          notes: `אישור: ${data.confirmation || 'בוצע'} | ${creditCardData.notes}`,
          amount: parseFloat(creditCardData.amount),
          paymentDate: new Date().toISOString()
        };
        onPaymentsChange([...payments, added]);
        setShowCreditModal(false);
      } else {
        setCreditError(data.error || 'שגיאה בחיוב הכרטיס');
      }
    } catch (err) {
      setCreditError('שגיאת תקשורת בחיוב הכרטיס');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatShortNotes = (notes) => {
    if (!notes) return '-';
    
    try {
      if (typeof notes === 'string' && notes.trim().startsWith('{')) {
        const parsed = JSON.parse(notes);
        if (parsed.Confirmation || parsed.TransactionId) {
          return `אישור: ${parsed.Confirmation || parsed.TransactionId}`;
        }
        return 'נתוני סליקה מורחבים (ראה פרטים)';
      }
    } catch (e) {}

    if (typeof notes === 'string') {
      const match = notes.match(/אישור:\s*([a-zA-Z0-9]+)/);
      if (match && match[1]) {
        return `אישור: ${match[1]}`;
      }
      if (notes.length > 35) {
        return notes.substring(0, 35) + '...';
      }
    }

    return notes;
  };

  const getFullPaymentDetails = (p) => {
    let formattedNotes = p.notes || 'אין';
    try {
      if (typeof p.notes === 'string' && p.notes.trim().startsWith('{')) {
        const parsed = JSON.parse(p.notes);
        formattedNotes = Object.entries(parsed)
          .map(([k, v]) => `${k}: ${v}`)
          .join('\n');
      } else {
        // If it's standard string with pipes, replace pipe with newline for better readability
        formattedNotes = p.notes.split(' | ').join('\n');
      }
    } catch (e) {}

    return `דיווח מלא על התשלום:\nאופן: ${p.paymentMethod || '-'}\nסכום: ₪${p.amount}\nתאריך: ${new Date(p.paymentDate).toLocaleString('he-IL')}\n\nהערות ופירוט מלא:\n${formattedNotes}`;
  };

  const activeObligations = obligations.filter(o => !o.isDeleted);
  const activePayments = payments.filter(p => !p.isDeleted);

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', border: '1px solid #e2e8f0' }}>
      <h2 style={{ color: '#0f172a', margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '700', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
        היסטוריית תשלומים וחובות
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Obligations */}
        <div>
          <h3 style={{ color: '#d32f2f', marginBottom: '1rem' }}>חיובים (₪{totalRequired})</h3>
          
          {activeObligations.length > 0 ? (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', color: '#666' }}>
                  <th style={{ padding: '0.5rem' }}>תיאור</th>
                  <th style={{ padding: '0.5rem' }}>תאריך</th>
                  <th style={{ padding: '0.5rem' }}>עובד</th>
                  <th style={{ padding: '0.5rem' }}>סכום</th>
                  <th style={{ padding: '0.5rem' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {activeObligations.map((obs, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.5rem' }}>{obs.description || 'חיוב'} {obs.isManual === false ? '(אוטומטי)' : ''}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.85em' }}>{new Date(obs.createdAt).toLocaleString('he-IL')}</td>
                    <td style={{ padding: '0.5rem' }}>{obs.employee?.firstName || 'מערכת'}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold' }}>₪{obs.amount}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {obs.isManual !== false && (
                        <button onClick={() => removeObligation(obligations.indexOf(obs))} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.2rem' }} title="מחק">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#888', padding: '1rem 0' }}>אין חיובים מתועדים.</div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <input 
              type="text" 
              placeholder="תיאור חיוב" 
              value={newObligation.description} 
              onChange={e => setNewObligation({...newObligation, description: e.target.value})}
              style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <input 
              type="number" 
              placeholder="סכום" 
              value={newObligation.amount} 
              onChange={e => setNewObligation({...newObligation, amount: e.target.value})}
              style={{ width: '90px', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <button onClick={addObligation} style={{ padding: '0.6rem 1.2rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#dc2626'} onMouseOut={e => e.currentTarget.style.backgroundColor='#ef4444'}>
              + הוסף שורה
            </button>
          </div>
        </div>

        {/* Payments */}
        <div>
          <h3 style={{ color: '#2e7d32', marginBottom: '1rem' }}>תשלומים שבוצעו (₪{totalPaid})</h3>
          
          {activePayments.length > 0 ? (
            <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem', marginBottom: '1rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #eee', color: '#666' }}>
                  <th style={{ padding: '0.5rem' }}>אופן תשלום</th>
                  <th style={{ padding: '0.5rem' }}>תאריך</th>
                  <th style={{ padding: '0.5rem' }}>עובד</th>
                  <th style={{ padding: '0.5rem' }}>הערות</th>
                  <th style={{ padding: '0.5rem' }}>סכום</th>
                  <th style={{ padding: '0.5rem' }}>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {activePayments.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f5f5f5' }}>
                    <td style={{ padding: '0.5rem' }}>{p.paymentMethod || '-'}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.85em' }}>{new Date(p.paymentDate).toLocaleString('he-IL')}</td>
                    <td style={{ padding: '0.5rem' }}>{p.employee?.firstName || 'מערכת'}</td>
                    <td style={{ padding: '0.5rem' }}>{formatShortNotes(p.notes)}</td>
                    <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#2e7d32' }}>₪{p.amount}</td>
                    <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => setSelectedPaymentDetails(p)} style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.2rem' }} title="פרטים נוספים">
                        <Info size={18} />
                      </button>
                      <button onClick={() => removePayment(payments.indexOf(p))} style={{ background: 'none', border: 'none', color: '#d32f2f', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.2rem' }} title="מחק">
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ color: '#888', padding: '1rem 0' }}>לא בוצעו תשלומים.</div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <select 
              value={newPayment.paymentMethod} 
              onChange={e => setNewPayment({...newPayment, paymentMethod: e.target.value})}
              style={{ padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'white' }}
            >
              <option value="מזומן">מזומן</option>
              <option value="אשראי">אשראי</option>
              <option value="העברה בנקאית">העברה בנקאית</option>
              <option value="המחאה">המחאה</option>
              <option value="אחר">אחר</option>
            </select>
            <input 
              type="text" 
              placeholder="הערות" 
              value={newPayment.notes} 
              onChange={e => setNewPayment({...newPayment, notes: e.target.value})}
              style={{ flex: 1, padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', minWidth: '100px' }}
            />
            <input 
              type="number" 
              placeholder="סכום" 
              value={newPayment.amount} 
              onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
              style={{ width: '90px', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }}
            />
            <button onClick={addPayment} style={{ padding: '0.6rem 1.2rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#16a34a'} onMouseOut={e => e.currentTarget.style.backgroundColor='#22c55e'}>
              + הוסף תשלום
            </button>
            <button 
              onClick={handleOpenCreditModal} 
              style={{ padding: '0.6rem 1.2rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '600', transition: 'background 0.2s' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor='#2563eb'} onMouseOut={e => e.currentTarget.style.backgroundColor='#3b82f6'}
              title="תשלום בכרטיס אשראי (נדרים פלוס)"
            >
              💳 סליקת אשראי
            </button>
          </div>
        </div>
      </div>

      {showCreditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '8px', width: '400px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, color: '#1976d2', borderBottom: '2px solid #eee', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
              סליקת כרטיס אשראי
            </h2>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם לקוח:</label>
              <input type="text" readOnly value={`${customer?.firstName || ''} ${customer?.lastName || ''}`} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: '#f5f5f5' }} />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>סכום לחיוב (₪):</label>
              <input 
                type="number" 
                value={creditCardData.amount} 
                onChange={e => setCreditCardData({...creditCardData, amount: e.target.value})}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>מספר כרטיס אשראי:</label>
              <input 
                type="text" 
                value={creditCardData.cardNumber} 
                onChange={e => setCreditCardData({...creditCardData, cardNumber: e.target.value})}
                placeholder="הכנס מספר כרטיס ללא רווחים"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', direction: 'ltr', textAlign: 'left' }} 
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תוקף (MMYY):</label>
                <input 
                  type="text" 
                  value={creditCardData.tokef} 
                  onChange={e => setCreditCardData({...creditCardData, tokef: e.target.value})}
                  placeholder="למשל 1225"
                  maxLength="4"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', direction: 'ltr', textAlign: 'left' }} 
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תשלומים:</label>
                <input 
                  type="number" 
                  min="1" max="36"
                  value={creditCardData.installments} 
                  onChange={e => setCreditCardData({...creditCardData, installments: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} 
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>הערות:</label>
              <input 
                type="text" 
                value={creditCardData.notes} 
                onChange={e => setCreditCardData({...creditCardData, notes: e.target.value})}
                placeholder="הערות לחיוב"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} 
              />
            </div>

            {creditError && (
              <div style={{ padding: '0.8rem', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {creditError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setShowCreditModal(false)} 
                disabled={isProcessing}
                style={{ padding: '0.5rem 1rem', background: 'transparent', color: '#666', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer' }}
              >
                ביטול
              </button>
              <button 
                onClick={handleProcessCreditCard} 
                disabled={isProcessing}
                style={{ padding: '0.5rem 1.5rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
              >
                {isProcessing ? 'מעבד...' : 'חייב כרטיס'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPaymentDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '500px', maxWidth: '90%', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                פרטי תשלום מלאים
              </h2>
              <button onClick={() => setSelectedPaymentDetails(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.2rem' }}>אופן תשלום</span>
                <span style={{ fontWeight: '600', color: '#334155' }}>{selectedPaymentDetails.paymentMethod || '-'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.2rem' }}>סכום</span>
                <span style={{ fontWeight: '600', color: '#16a34a', fontSize: '1.1rem' }}>₪{selectedPaymentDetails.amount}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.2rem' }}>תאריך</span>
                <span style={{ color: '#334155' }}>{new Date(selectedPaymentDetails.paymentDate).toLocaleString('he-IL')}</span>
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.1rem', color: '#334155' }}>הערות ופירוט (נדרים פלוס / אחר)</h3>
              <div style={{ background: '#f1f5f9', padding: '1rem', borderRadius: '8px', maxHeight: '350px', overflowY: 'auto' }}>
                {(() => {
                  const notes = selectedPaymentDetails.notes;
                  if (!notes) return <span style={{ color: '#94a3b8' }}>אין הערות</span>;
                  
                  try {
                    if (typeof notes === 'string' && notes.trim().startsWith('{')) {
                      const parsed = JSON.parse(notes);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                          {Object.entries(parsed).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                              <strong style={{ width: '150px', color: '#475569', fontSize: '0.9rem', flexShrink: 0 }}>{k}:</strong>
                              <span style={{ flex: 1, color: '#1e293b', wordBreak: 'break-word', fontSize: '0.95rem', direction: 'ltr', textAlign: 'right' }}>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {}
                  
                  return <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b', lineHeight: '1.5' }}>{typeof notes === 'string' ? notes.split(' | ').join('\n') : String(notes)}</div>;
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                onClick={() => setSelectedPaymentDetails(null)} 
                style={{ padding: '0.6rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
