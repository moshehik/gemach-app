'use client';

import { useState, useEffect } from 'react';
import { Trash2, Info, ChevronDown, ChevronUp } from 'lucide-react';

export default function OrderPaymentsManager({ orderId, obligations = [], payments = [], onObligationsChange, onPaymentsChange, totalRequired, totalPaid, customer = {} }) {
  const [newObligation, setNewObligation] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ paymentMethod: 'מזומן', notes: '', amount: '' });
  
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
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
  const [selectedObligationDetails, setSelectedObligationDetails] = useState(null);

  useEffect(() => {
    setNewPayment(prev => {
      if (!prev.amount || parseFloat(prev.amount) === 0 || parseFloat(prev.amount) > Math.max(0, totalRequired - totalPaid)) {
        return { ...prev, amount: Math.max(0, totalRequired - totalPaid).toString() };
      }
      return prev;
    });
  }, [totalRequired, totalPaid]);

  const [isExpanded, setIsExpanded] = useState(true);
  const summaryText = `סה״כ חוב: ₪${totalRequired} | שולם: ₪${totalPaid} | יתרה: ₪${Math.max(0, totalRequired - totalPaid)}`;

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
    setShowAddChargeModal(false);
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
    <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          cursor: 'pointer',
          borderBottom: isExpanded ? '2px solid #f1f5f9' : 'none',
          paddingBottom: isExpanded ? '1rem' : '0',
          marginBottom: isExpanded ? '1.5rem' : '0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: '800' }}>
            תשלומים וחובות
          </h2>
          {!isExpanded && (
            <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#cbd5e1' }}>|</span> {summaryText}
            </span>
          )}
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '50%', padding: '0.5rem', transition: 'all 0.2s' }}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Obligations */}
        <div style={{ background: '#fef2f2', padding: '1.5rem', borderRadius: '12px', border: '1px solid #fee2e2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#b91c1c', margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>חיובים</h3>
            <span style={{ background: '#f87171', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>₪{totalRequired}</span>
          </div>
          
          {activeObligations.length > 0 ? (
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #fca5a5', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #fca5a5', background: '#fef2f2', color: '#7f1d1d' }}>
                    <th style={{ padding: '0.8rem' }}>תיאור</th>
                    <th style={{ padding: '0.8rem' }}>תאריך</th>
                    <th style={{ padding: '0.8rem' }}>סכום</th>
                    <th style={{ padding: '0.8rem', width: '60px' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {activeObligations.map((obs, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #fee2e2', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#fef2f2'} onMouseOut={e => e.currentTarget.style.backgroundColor='white'}>
                      <td style={{ padding: '0.8rem', color: '#450a0a', fontWeight: '500' }}>{obs.isManual === false ? (obs.productName || 'חיוב אוטומטי') : (obs.description || 'חיוב ידני')}</td>
                      <td style={{ padding: '0.8rem', color: '#991b1b', fontSize: '0.85em' }}>{new Date(obs.createdAt).toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold', color: '#b91c1c' }}>₪{obs.amount}</td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => setSelectedObligationDetails(obs)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }} title="פרטים נוספים">
                          <Info size={16} />
                        </button>
                        {obs.isManual !== false && (
                          <button onClick={() => removeObligation(obligations.indexOf(obs))} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '6px' }} title="מחק">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#991b1b', padding: '1rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px dashed #fca5a5', marginBottom: '1.5rem' }}>אין חיובים מתועדים.</div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button 
              onClick={() => setShowAddChargeModal(true)} 
              style={{ 
                padding: '0.6rem 1.5rem', 
                background: '#ef4444', 
                color: 'white', 
                border: 'none', 
                borderRadius: '24px', 
                cursor: 'pointer', 
                fontWeight: 'bold', 
                transition: 'all 0.2s', 
                display: 'inline-flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                boxShadow: '0 4px 6px rgba(239, 68, 68, 0.2)'
              }} 
              onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(239, 68, 68, 0.3)'; }} 
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(239, 68, 68, 0.2)'; }}
            >
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>+</span> הוסף חיוב
            </button>
          </div>
        </div>

        {/* Payments */}
        <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: '12px', border: '1px solid #dcfce7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ color: '#166534', margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>תשלומים</h3>
            <span style={{ background: '#4ade80', color: 'white', padding: '0.2rem 0.8rem', borderRadius: '20px', fontWeight: 'bold', fontSize: '1.1rem' }}>₪{totalPaid}</span>
          </div>
          
          {activePayments.length > 0 ? (
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #86efac', marginBottom: '1.5rem' }}>
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #86efac', background: '#f0fdf4', color: '#14532d' }}>
                    <th style={{ padding: '0.8rem' }}>אופן</th>
                    <th style={{ padding: '0.8rem' }}>תאריך</th>
                    <th style={{ padding: '0.8rem' }}>סכום</th>
                    <th style={{ padding: '0.8rem', width: '60px' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {activePayments.map((p, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #dcfce7', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#f0fdf4'} onMouseOut={e => e.currentTarget.style.backgroundColor='white'}>
                      <td style={{ padding: '0.8rem', color: '#064e3b', fontWeight: '500' }}>{p.paymentMethod || '-'}</td>
                      <td style={{ padding: '0.8rem', color: '#166534', fontSize: '0.85em' }}>{new Date(p.paymentDate).toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold', color: '#16a34a' }}>₪{p.amount}</td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button onClick={() => setSelectedPaymentDetails(p)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }} title="פרטים נוספים">
                          <Info size={16} />
                        </button>
                        <button onClick={() => removePayment(payments.indexOf(p))} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }} title="מחק">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ color: '#166534', padding: '1rem', textAlign: 'center', background: 'white', borderRadius: '8px', border: '1px dashed #86efac', marginBottom: '1.5rem' }}>לא בוצעו תשלומים.</div>
          )}

          <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #dcfce7' }}>
              <select 
                value={newPayment.paymentMethod} 
                onChange={e => setNewPayment({...newPayment, paymentMethod: e.target.value})}
                style={{ flex: '1', minWidth: '130px', padding: '0.7rem', borderRadius: '8px', border: '1px solid #86efac', outline: 'none', background: 'white', cursor: 'pointer' }}
              >
                <option value="מזומן">מזומן</option>
                <option value="אשראי">אשראי</option>
                <option value="העברה בנקאית">העברה בנקאית</option>
                <option value="המחאה">המחאה</option>
                <option value="אחר">אחר</option>
              </select>
              <input 
                type="number" 
                placeholder="₪ סכום" 
                value={newPayment.amount} 
                onChange={e => setNewPayment({...newPayment, amount: e.target.value})}
                style={{ flex: '1', minWidth: '100px', padding: '0.7rem', borderRadius: '8px', border: '1px solid #86efac', outline: 'none' }}
              />
            <input 
              type="text" 
              placeholder="הערות (אופציונלי)" 
              value={newPayment.notes} 
              onChange={e => setNewPayment({...newPayment, notes: e.target.value})}
              style={{ flex: '2', minWidth: '150px', padding: '0.7rem', borderRadius: '8px', border: '1px solid #86efac', outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', flex: '1 0 auto', minWidth: '220px' }}>
              <button onClick={addPayment} style={{ flex: 1, padding: '0.7rem 1rem', background: '#22c55e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#16a34a'} onMouseOut={e => e.currentTarget.style.backgroundColor='#22c55e'}>
                <span>+</span> הוסף תשלום
              </button>
              <button 
                onClick={handleOpenCreditModal} 
                style={{ flex: 1, padding: '0.7rem 1rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', transition: 'opacity 0.2s' }}
                onMouseOver={e => e.currentTarget.style.opacity=0.9} onMouseOut={e => e.currentTarget.style.opacity=1}
                title="תשלום בכרטיס אשראי (נדרים פלוס)"
              >
                💳 סליקת אשראי
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {showCreditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '450px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h2 style={{ margin: '0 0 1.5rem 0', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
              סליקת כרטיס אשראי
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>שם לקוח:</label>
                <input type="text" readOnly value={`${customer?.firstName || ''} ${customer?.lastName || ''}`} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>סכום לחיוב (₪):</label>
                <input 
                  type="number" 
                  value={creditCardData.amount} 
                  onChange={e => setCreditCardData({...creditCardData, amount: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', fontWeight: 'bold', fontSize: '1.1rem' }} 
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>מספר כרטיס אשראי:</label>
                <input 
                  type="text" 
                  value={creditCardData.cardNumber} 
                  onChange={e => setCreditCardData({...creditCardData, cardNumber: e.target.value})}
                  placeholder="הכנס מספר כרטיס ללא רווחים"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} 
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>תוקף (MMYY):</label>
                  <input 
                    type="text" 
                    value={creditCardData.tokef} 
                    onChange={e => setCreditCardData({...creditCardData, tokef: e.target.value})}
                    placeholder="1225"
                    maxLength="4"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>תשלומים:</label>
                  <input 
                    type="number" 
                    min="1" max="36"
                    value={creditCardData.installments} 
                    onChange={e => setCreditCardData({...creditCardData, installments: e.target.value})}
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                  />
                </div>
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>הערות:</label>
                <input 
                  type="text" 
                  value={creditCardData.notes} 
                  onChange={e => setCreditCardData({...creditCardData, notes: e.target.value})}
                  placeholder="הערות לחיוב"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} 
                />
              </div>
            </div>

            {creditError && (
              <div style={{ padding: '1rem', background: '#fef2f2', color: '#b91c1c', borderRadius: '8px', marginTop: '1.5rem', fontSize: '0.95rem', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>⚠️</span> {creditError}
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button 
                onClick={() => setShowCreditModal(false)} 
                disabled={isProcessing}
                style={{ padding: '0.8rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                ביטול
              </button>
              <button 
                onClick={handleProcessCreditCard} 
                disabled={isProcessing}
                style={{ padding: '0.8rem 2rem', background: 'linear-gradient(to right, #16a34a, #22c55e)', color: 'white', border: 'none', borderRadius: '8px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isProcessing ? 0.7 : 1, boxShadow: '0 4px 6px rgba(22, 163, 74, 0.2)' }}
              >
                {isProcessing ? 'מעבד...' : 'חייב כרטיס'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedPaymentDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                פרטי תשלום מלאים
              </h2>
              <button onClick={() => setSelectedPaymentDetails(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>אופן תשלום</span>
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '1.1rem' }}>{selectedPaymentDetails.paymentMethod || '-'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>סכום</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '1.2rem', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>₪{selectedPaymentDetails.amount}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>תאריך</span>
                <span style={{ color: '#334155', fontWeight: '500' }}>{new Date(selectedPaymentDetails.paymentDate).toLocaleString('he-IL')}</span>
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.1rem', color: '#334155' }}>הערות ופירוט (נדרים פלוס / אחר)</h3>
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0' }}>
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
                              <span style={{ flex: 1, color: '#1e293b', wordBreak: 'break-word', fontSize: '0.95rem', direction: 'ltr', textAlign: 'right', fontWeight: '500' }}>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) {}
                  
                  return <div style={{ whiteSpace: 'pre-wrap', color: '#1e293b', lineHeight: '1.6' }}>{typeof notes === 'string' ? notes.split(' | ').join('\n') : String(notes)}</div>;
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                onClick={() => setSelectedPaymentDetails(null)} 
                style={{ padding: '0.8rem 2rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedObligationDetails && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                פרטי חיוב
              </h2>
              <button onClick={() => setSelectedObligationDetails(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>סוג חיוב</span>
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '1.1rem' }}>{selectedObligationDetails.isManual === false ? (selectedObligationDetails.productName || 'חיוב אוטומטי') : 'חיוב ידני'}</span>
              </div>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>סכום</span>
                <span style={{ fontWeight: 'bold', color: '#dc2626', fontSize: '1.2rem', background: '#fef2f2', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>₪{selectedObligationDetails.amount}</span>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>תאריך</span>
                <span style={{ color: '#334155', fontWeight: '500' }}>{new Date(selectedObligationDetails.createdAt || new Date()).toLocaleString('he-IL')}</span>
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 0.8rem 0', fontSize: '1.1rem', color: '#334155' }}>תיאור מפורט</h3>
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', color: '#1e293b', lineHeight: '1.6', whiteSpace: 'pre-wrap', border: '1px solid #e2e8f0' }}>
                <div><span style={{fontWeight:'600', color:'#475569'}}>פירוט:</span> <span style={{fontWeight:'500'}}>{selectedObligationDetails.description || 'ללא תיאור'}</span></div>
                {selectedObligationDetails.priceCategory && (
                   <div style={{marginTop:'0.8rem'}}><span style={{fontWeight:'600', color:'#475569'}}>קטגוריה (מחירון):</span> <span style={{fontWeight:'500'}}>{selectedObligationDetails.priceCategory}</span></div>
                )}
                {selectedObligationDetails.priceDescription && (
                   <div style={{marginTop:'0.8rem'}}><span style={{fontWeight:'600', color:'#475569'}}>תיאור (מחירון):</span> <span style={{fontWeight:'500'}}>{selectedObligationDetails.priceDescription}</span></div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button 
                onClick={() => setSelectedObligationDetails(null)} 
                style={{ padding: '0.8rem 2rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddChargeModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '400px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                הוספת חיוב ידני
              </h2>
              <button onClick={() => setShowAddChargeModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>תיאור החיוב:</label>
                <input 
                  type="text" 
                  placeholder="לדוגמא: שמלה נוספת" 
                  value={newObligation.description} 
                  onChange={e => setNewObligation({...newObligation, description: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', outline: 'none' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>סכום (₪):</label>
                <input 
                  type="number" 
                  placeholder="0" 
                  value={newObligation.amount} 
                  onChange={e => setNewObligation({...newObligation, amount: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', outline: 'none', fontSize: '1.1rem', fontWeight: 'bold', color: '#b91c1c' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button 
                onClick={() => setShowAddChargeModal(false)} 
                style={{ padding: '0.8rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                ביטול
              </button>
              <button 
                onClick={addObligation} 
                disabled={!newObligation.description || !newObligation.amount}
                style={{ padding: '0.8rem 2rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: (!newObligation.description || !newObligation.amount) ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'opacity 0.2s', opacity: (!newObligation.description || !newObligation.amount) ? 0.6 : 1 }}
              >
                שמור חיוב
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
