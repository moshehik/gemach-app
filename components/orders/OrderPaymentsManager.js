'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Info, ChevronDown, ChevronUp, RefreshCcw } from 'lucide-react';

export default function OrderPaymentsManager({ orderId, items = [], order = {}, obligations = [], payments = [], refunds = [], onObligationsChange, onPaymentsChange, onRefundsChange, totalRequired, totalPaid, customer = {}, onOrderUpdated }) {
  const [newObligation, setNewObligation] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ paymentMethod: 'אשראי', notes: '', amount: '' });
  
  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showQuickSwipeModal, setShowQuickSwipeModal] = useState(false);
  const [swipeInput, setSwipeInput] = useState('');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundData, setRefundData] = useState({
    amount: '',
    reason: '',
    bankName: '',
    bankBranch: '',
    bankAccount: '',
    bankAccountName: '',
    paymentDetails: '',
    email: ''
  });
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
      .then(data => {
        if (Array.isArray(data)) {
          const settingsObj = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(settingsObj);
          if (settingsObj.ALLOWED_PAYMENT_METHODS) {
            const opts = settingsObj.ALLOWED_PAYMENT_METHODS.split(',').map(s => s.trim()).filter(Boolean);
            if (opts.length > 0) {
              setNewPayment(prev => ({...prev, paymentMethod: opts[0]}));
            }
          }
        } else {
          setSettings(data || {});
        }
      })
      .catch(err => console.error(err));
  }, []);

  const paymentMethodOptions = settings.ALLOWED_PAYMENT_METHODS 
    ? settings.ALLOWED_PAYMENT_METHODS.split(',').map(s => s.trim()).filter(Boolean) 
    : ['אשראי (דרך נדרים פלוס)', 'יציאה באישור מנהל'];

  const validateInventoryBeforePayment = async () => {
    if (!items || items.length === 0) return true;
    try {
      const res = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items,
          eventDate: order?.eventDate,
          isAbroad: order?.isAbroad,
          isWeekdayEvent: order?.isWeekdayEvent,
          fromDate: order?.fromDate,
          toDate: order?.toDate,
          orderId: order?.orderId
        })
      });
      const data = await res.json();
      if (!data.valid) {
        let msg = 'לא ניתן לבצע תשלום, חלק מהפריטים כבר אינם פנויים במלאי:\n';
        if (data.errors) {
          data.errors.forEach(e => {
            msg += `- ${e.dressName} (מידה: ${e.sizeText}): זמין ${e.available}, נדרש ${e.requested}\n`;
          });
        }
        alert(msg + '\nאנא הסר את הפריטים שתפסו או בחר מידות אחרות.');
        return false;
      }
      return true;
    } catch (e) {
      console.error(e);
      alert('שגיאה באימות מלאי מול השרת.');
      return false;
    }
  };

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

    const isValid = await validateInventoryBeforePayment();
    if (!isValid) return;

    const paymentAmount = parseFloat(newPayment.amount);
    const balance = totalRequired - totalPaid;
    
    if (paymentAmount > balance) {
      alert(`לא ניתן לשלם יותר מהיתרה הנדרשת (₪${balance}).`);
      return;
    }
    
    let isCodeRequired = false;
    if (!(newPayment.paymentMethod.includes('אשראי') && !newPayment.paymentMethod.includes('חיצונית'))) {
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
      notes: newPayment.paymentMethod === 'יציאה באישור מנהל' ? `אושר על סך ₪${newPayment.amount} ` + newPayment.notes : newPayment.notes,
      amount: newPayment.paymentMethod === 'יציאה באישור מנהל' ? 0 : paymentAmount,
      paymentDate: new Date().toISOString()
    };
    onPaymentsChange([...payments, added]);
    setNewPayment({ paymentMethod: 'אשראי', notes: '', amount: '' });
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

  const handleOpenRefundModal = () => {
    let paymentDetailsString = '';
    const validPayments = payments.filter(p => !p.isDeleted);
    if (validPayments.length > 0) {
      const sortedPayments = [...validPayments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
      const lastPayment = sortedPayments[0];
      
      let last4 = '';
      try {
        if (typeof lastPayment.notes === 'string') {
          const parsed = JSON.parse(lastPayment.notes);
          if (parsed.LastNum) last4 = parsed.LastNum;
          else if (parsed.CardNumber) last4 = String(parsed.CardNumber).slice(-4);
          else if (parsed.Card) last4 = String(parsed.Card).slice(-4);
          else {
             const match = lastPayment.notes.match(/"(?:LastNum|Card|CardNumber)"\s*:\s*"?\D*(\d{4})"?/i);
             if (match && match[1]) last4 = match[1];
          }
        }
      } catch(e) {
         const match = lastPayment.notes?.match(/(?:כרטיס|אשראי).*?(\d{4})/);
         if (match && match[1]) last4 = match[1];
      }
      
      paymentDetailsString = lastPayment.paymentMethod || '';
      if (last4) {
         paymentDetailsString += ` (ספרות: ${last4})`;
      } else if (lastPayment.paymentMethod && lastPayment.paymentMethod.includes('אשראי') && !last4) {
         const match4 = lastPayment.notes?.match(/\b(\d{4})\b/);
         if (match4) {
             paymentDetailsString += ` (ספרות: ${match4[1]})`;
         }
      }
    }

    setRefundData({
      amount: '',
      reason: '',
      bankName: customer?.bankName || '',
      bankBranch: customer?.bankBranch || '',
      bankAccount: customer?.bankAccount || '',
      bankAccountName: customer?.bankAccountName || '',
      paymentDetails: paymentDetailsString,
      email: customer?.email ? (customer.emailSuffix && !customer.email.includes('@') ? `${customer.email}${customer.emailSuffix.startsWith('@') ? '' : '@'}${customer.emailSuffix}` : customer.email) : ''
    });
    setShowRefundModal(true);
  };

  const submitRefund = async () => {
    if (!refundData.amount || parseFloat(refundData.amount) <= 0) {
      alert('יש להזין סכום חיובי לזיכוי');
      return;
    }
    
    setIsProcessing(true);
    try {
      const res = await fetch('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customer?.id,
          orderId,
          ...refundData
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create refund');
      
      alert('בקשת הזיכוי נוצרה בהצלחה. ניתן לנהל אותה במסמך הזיכויים הראשי או כאן בטאב תשלומים.');
      setShowRefundModal(false);
      
      // Re-fetch order to update refunds list
      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) {
          const updatedOrder = await orderRes.json();
          onOrderUpdated(updatedOrder);
        }
      }
    } catch (err) {
      alert(err.message || 'שגיאה ביצירת הזיכוי');
    } finally {
      setIsProcessing(false);
    }
  };

  const approveRefund = async (refundId) => {
    if (!(await window.customConfirm('האם לאשר ביצוע זיכוי זה? הפעולה תיצור תשלום הפכי להזמנה.'))) {
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${refundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true })
      });
      if (!res.ok) throw new Error('Failed to approve refund');
      alert('הזיכוי אושר ובוצע בהצלחה.');
      
      // Re-fetch order to update payments and refunds
      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) {
          const updatedOrder = await orderRes.json();
          onOrderUpdated(updatedOrder);
        }
      } else if (onRefundsChange) {
         onRefundsChange(refunds.filter(r => r.id !== refundId));
      }
    } catch (err) {
      alert(err.message || 'שגיאה באישור הזיכוי');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenQuickSwipeModal = () => {
    setSwipeInput('');
    setCreditCardData({
      cardNumber: '',
      tokef: '',
      installments: 1,
      notes: '',
      amount: Math.max(0, totalRequired - totalPaid).toString()
    });
    setCreditError('');
    setShowQuickSwipeModal(true);
  };

  const handleSwipeInputChange = (e) => {
    const val = e.target.value;
    setSwipeInput(val);
    
    let card = '';
    let tokef = '';
    
    if (val.includes('=')) {
      const parts = val.split('=');
      if (parts[1] && parts[1].length >= 4) {
        card = parts[0].replace(/[^0-9]/g, '');
        const expYY = parts[1].substring(0, 2);
        const expMM = parts[1].substring(2, 4);
        tokef = `${expMM}/${expYY}`;
        card = card.match(/.{1,4}/g)?.join(' ') || '';
      }
    } else if (val.includes('^')) {
      const parts = val.split('^');
      if (parts.length > 2 && parts[2] && parts[2].length >= 4) {
        card = parts[0].replace(/[^0-9]/g, '');
        const expYY = parts[2].substring(0, 2);
        const expMM = parts[2].substring(2, 4);
        tokef = `${expMM}/${expYY}`;
        card = card.match(/.{1,4}/g)?.join(' ') || '';
      }
    }
    
    if (card && tokef) {
      setCreditCardData(prev => ({
        ...prev,
        cardNumber: card,
        tokef: tokef
      }));
      setShowQuickSwipeModal(false);
      setTimeout(() => setShowCreditModal(true), 150);
    }
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

  const handleCardNumberChange = (e) => {
    const val = e.target.value;
    
    if (val.includes('=')) {
      const parts = val.split('=');
      const card = parts[0].replace(/[^0-9]/g, '');
      const expYY = parts[1].substring(0, 2);
      const expMM = parts[1].substring(2, 4);
      
      setCreditCardData(prev => ({
        ...prev,
        cardNumber: card.match(/.{1,4}/g)?.join(' ') || '',
        tokef: (expMM && expYY) ? `${expMM}/${expYY}` : prev.tokef
      }));
      return;
    }
    
    if (val.includes('^')) {
      const parts = val.split('^');
      const card = parts[0].replace(/[^0-9]/g, '');
      if (parts.length > 2) {
        const expYY = parts[2].substring(0, 2);
        const expMM = parts[2].substring(2, 4);
        setCreditCardData(prev => ({
          ...prev,
          cardNumber: card.match(/.{1,4}/g)?.join(' ') || '',
          tokef: (expMM && expYY) ? `${expMM}/${expYY}` : prev.tokef
        }));
        return;
      }
    }

    const raw = val.replace(/[^0-9]/g, '');
    setCreditCardData(prev => ({ ...prev, cardNumber: raw.match(/.{1,4}/g)?.join(' ') || '' }));
  };

  const handleTokefChange = (e) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    let formatted = raw;
    if (raw.length > 2) {
      formatted = `${raw.substring(0, 2)}/${raw.substring(2, 4)}`;
    }
    setCreditCardData(prev => ({ ...prev, tokef: formatted }));
  };

  const handleProcessCreditCard = async () => {
    if (!creditCardData.cardNumber || !creditCardData.tokef || !creditCardData.amount) {
       setCreditError('אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).');
       return;
    }

    const isValid = await validateInventoryBeforePayment();
    if (!isValid) return;

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
      
      const itemsDescription = obligations
        .filter(o => !o.isDeleted && o.isManual === false)
        .map(o => o.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, ''))
        .filter(Boolean)
        .join(', ');
      const fullItemsDesc = itemsDescription ? `(${itemsDescription})` : '';

      const orderNote = orderId ? `הזמנה ${orderId} ${fullItemsDesc}` : '';
      const automaticNote = `באמצעות תכנת הגמח; מס הזמנה: ${orderId || 'לא ידוע'}`;
      const finalNotes = [orderNote, creditCardData.notes, automaticNote].filter(Boolean).join(' - ');

      const response = await fetch('/api/nedarim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
          phone: customer.phone1 || '',
          address: fullAddress,
          cardNumber: creditCardData.cardNumber.replace(/\s/g, ''),
          tokef: creditCardData.tokef.replace(/\//g, ''),
          amount: parseFloat(creditCardData.amount),
          installments: parseInt(creditCardData.installments) || 1,
          notes: finalNotes,
          zeout: customer.idNumber || customer.zeout || '',
          email: customer.email || ''
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Automatically add the payment
        let parsedRaw = {
           'אישור': data.confirmation || 'בוצע'
        };
        try {
           if (data.rawResponse) parsedRaw = JSON.parse(data.rawResponse);
        } catch(e){}
        
        if (creditCardData.notes) {
           parsedRaw['הערות משתמש'] = creditCardData.notes;
        }

        const added = {
          isNew: true,
          paymentMethod: 'אשראי',
          notes: JSON.stringify(parsedRaw),
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
  const pendingRefunds = refunds.filter(r => !r.isDeleted && !r.isExecuted);

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
                      <td style={{ padding: '0.8rem', color: '#450a0a', fontWeight: '500' }}>{obs.isManual === false ? (obs.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב אוטומטי') : (obs.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב ידני')}</td>
                      <td style={{ padding: '0.8rem', color: '#991b1b', fontSize: '0.85em' }}>{obs.createdAt ? new Date(obs.createdAt).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold', color: '#b91c1c' }}>₪{obs.amount}</td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button data-agy-id="orderpaymentsmanager_button_1" onClick={() => setSelectedObligationDetails(obs)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }} title="פרטים נוספים">
                          <Info size={16} />
                        </button>
                        {obs.isManual !== false && (
                          <button data-agy-id="orderpaymentsmanager_button_2" onClick={() => removeObligation(obligations.indexOf(obs))} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.3rem', borderRadius: '6px' }} title="מחק">
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
            <button data-agy-id="orderpaymentsmanager_button_3" 
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
                      <td style={{ padding: '0.8rem', color: '#166534', fontSize: '0.85em' }}>{p.paymentDate ? new Date(p.paymentDate).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold', color: '#16a34a' }}>₪{p.amount}</td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button data-agy-id="orderpaymentsmanager_button_4" onClick={() => setSelectedPaymentDetails(p)} style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }} title="פרטים נוספים">
                          <Info size={16} />
                        </button>
                        <button data-agy-id="orderpaymentsmanager_button_5" onClick={() => removePayment(payments.indexOf(p))} style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '0.3rem', borderRadius: '6px' }} title="מחק">
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

          <div style={{ display: 'flex', gap: '0.5rem', flex: '1 0 auto', minWidth: '220px', flexWrap: 'wrap' }}>
              <button data-agy-id="orderpaymentsmanager_button_10" 
                onClick={handleOpenCreditModal} 
                style={{ flex: '1 1 auto', padding: '0.7rem 1rem', background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', transition: 'opacity 0.2s' }}
                onMouseOver={e => e.currentTarget.style.opacity=0.9} onMouseOut={e => e.currentTarget.style.opacity=1}
                title="תשלום בכרטיס אשראי (נדרים פלוס)"
              >
                💳 סליקת אשראי
              </button>

              <button data-agy-id="orderpaymentsmanager_button_refund" 
                onClick={handleOpenRefundModal} 
                style={{ flex: 1, padding: '0.7rem 1rem', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', transition: 'opacity 0.2s' }}
                onMouseOver={e => e.currentTarget.style.opacity=0.9} onMouseOut={e => e.currentTarget.style.opacity=1}
                title="בקשת זיכוי ללקוח"
              >
                <RefreshCcw size={18} /> יצירת זיכוי
              </button>
            </div>
          </div>

        {/* Pending Refunds */}
        {pendingRefunds.length > 0 && (
          <div style={{ background: '#eff6ff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ color: '#1e40af', margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>זיכויים ממתינים</h3>
            </div>
            
            <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden', border: '1px solid #93c5fd', marginBottom: '0.5rem' }}>
              <table style={{ width: '100%', textAlign: 'right', borderCollapse: 'collapse', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #93c5fd', background: '#eff6ff', color: '#1e3a8a' }}>
                    <th style={{ padding: '0.8rem' }}>פרטים / סיבה</th>
                    <th style={{ padding: '0.8rem' }}>תאריך בקשה</th>
                    <th style={{ padding: '0.8rem' }}>סכום</th>
                    <th style={{ padding: '0.8rem', width: '120px' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRefunds.map((r, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #bfdbfe', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#eff6ff'} onMouseOut={e => e.currentTarget.style.backgroundColor='white'}>
                      <td style={{ padding: '0.8rem', color: '#1e40af', fontWeight: '500' }}>{r.reason || 'ללא סיבה'}</td>
                      <td style={{ padding: '0.8rem', color: '#1d4ed8', fontSize: '0.85em' }}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL')}</td>
                      <td style={{ padding: '0.8rem', fontWeight: 'bold', color: '#2563eb' }}>₪{r.amount}</td>
                      <td style={{ padding: '0.8rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <button data-agy-id={`approve_refund_${idx}`} onClick={() => approveRefund(r.id)} style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#2563eb'} onMouseOut={e => e.currentTarget.style.backgroundColor='#3b82f6'}>
                          אשר ביצוע
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      {mounted && showQuickSwipeModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(8px)' }}>
          <div style={{ background: 'white', padding: '3rem', borderRadius: '24px', width: '450px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
            {/* Animated top border */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: 'linear-gradient(to right, #f59e0b, #d97706, #fbbf24)' }}></div>
            
            <button onClick={() => setShowQuickSwipeModal(false)} style={{ position: 'absolute', top: '15px', right: '20px', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>&times;</button>
            
            <div style={{ margin: '0 auto 1.5rem', width: '90px', height: '90px', background: '#fef3c7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(245,158,11,0.2)' }}>
              <span style={{ fontSize: '3.5rem' }}>🧲</span>
            </div>
            
            <h2 style={{ margin: '0 0 0.5rem 0', color: '#1e293b', fontSize: '1.8rem', fontWeight: '800' }}>
              העברת כרטיס מהירה
            </h2>
            <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '2rem' }}>
              אנא העבר כעת את כרטיס האשראי בקורא השפתיים...
            </p>
            
            <input 
              autoFocus 
              type="text" 
              value={swipeInput}
              onChange={handleSwipeInputChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.preventDefault();
              }}
              onBlur={(e) => {
                 if (showQuickSwipeModal) {
                    setTimeout(() => e.target?.focus(), 100);
                 }
              }}
              style={{ opacity: 0, position: 'absolute', top: '-1000px' }} 
            />
            
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <button 
                onClick={() => setShowQuickSwipeModal(false)} 
                style={{ padding: '0.8rem 2rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s', fontSize: '1.1rem' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                ביטול חלון מהיר
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && showCreditModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '450px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 1.5rem 0', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
              <h2 style={{ margin: 0, color: '#1e293b' }}>
                סליקת כרטיס אשראי
              </h2>
              <button data-agy-id="orderpaymentsmanager_button_quick_swipe" 
                onClick={(e) => { e.preventDefault(); setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }} 
                style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', transition: 'opacity 0.2s' }}
                onMouseOver={e => e.currentTarget.style.opacity=0.9} onMouseOut={e => e.currentTarget.style.opacity=1}
                title="העברת כרטיס מהירה בקורא מגנטי"
              >
                🧲 העברה מהירה
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>שם לקוח:</label>
                <input data-agy-id="orderpaymentsmanager_input_11" type="text" readOnly value={`${customer?.firstName || ''} ${customer?.lastName || ''}`} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }} />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>סכום לחיוב (₪):</label>
                <input data-agy-id="orderpaymentsmanager_input_12" 
                  type="number" 
                  value={creditCardData.amount} 
                  onChange={e => setCreditCardData({...creditCardData, amount: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #bfdbfe', background: '#eff6ff', color: '#1e40af', fontWeight: 'bold', fontSize: '1.1rem' }} 
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>מספר כרטיס אשראי:</label>
                <input data-agy-id="orderpaymentsmanager_input_13" 
                  type="text" 
                  value={creditCardData.cardNumber} 
                  onChange={handleCardNumberChange}
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} 
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>תוקף (MM/YY):</label>
                  <input data-agy-id="orderpaymentsmanager_input_14" 
                    type="text" 
                    value={creditCardData.tokef} 
                    onChange={handleTokefChange}
                    placeholder="12/25"
                    maxLength="5"
                    style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>תשלומים:</label>
                  <input data-agy-id="orderpaymentsmanager_input_15" 
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
                <input data-agy-id="orderpaymentsmanager_input_16" 
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
              <button data-agy-id="orderpaymentsmanager_button_17" 
                onClick={() => setShowCreditModal(false)} 
                disabled={isProcessing}
                style={{ padding: '0.8rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                ביטול
              </button>
              <button data-agy-id="orderpaymentsmanager_button_18" 
                onClick={handleProcessCreditCard} 
                disabled={isProcessing}
                style={{ padding: '0.8rem 2rem', background: 'linear-gradient(to right, #16a34a, #22c55e)', color: 'white', border: 'none', borderRadius: '8px', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', opacity: isProcessing ? 0.7 : 1, boxShadow: '0 4px 6px rgba(22, 163, 74, 0.2)' }}
              >
                {isProcessing ? 'מעבד...' : 'חייב כרטיס'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && selectedPaymentDetails && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                פרטי תשלום מלאים
              </h2>
              <button data-agy-id="orderpaymentsmanager_button_19" onClick={() => setSelectedPaymentDetails(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
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
              <button data-agy-id="orderpaymentsmanager_button_20" 
                onClick={() => setSelectedPaymentDetails(null)} 
                style={{ padding: '0.8rem 2rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                סגור
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && selectedObligationDetails && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                פרטי חיוב
              </h2>
              <button data-agy-id="orderpaymentsmanager_button_21" onClick={() => setSelectedObligationDetails(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#64748b', marginBottom: '0.3rem' }}>סוג חיוב</span>
                <span style={{ fontWeight: '600', color: '#334155', fontSize: '1.1rem' }}>{selectedObligationDetails.isManual === false ? (selectedObligationDetails.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב אוטומטי') : (selectedObligationDetails.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב ידני')}</span>
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
                <div><span style={{fontWeight:'600', color:'#475569'}}>פירוט:</span> <span style={{fontWeight:'500'}}>{selectedObligationDetails.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'ללא תיאור'}</span></div>
                {selectedObligationDetails.priceCategory && (
                   <div style={{marginTop:'0.8rem'}}><span style={{fontWeight:'600', color:'#475569'}}>קטגוריה (מחירון):</span> <span style={{fontWeight:'500'}}>{selectedObligationDetails.priceCategory}</span></div>
                )}
                {selectedObligationDetails.priceDescription && (
                   <div style={{marginTop:'0.8rem'}}><span style={{fontWeight:'600', color:'#475569'}}>תיאור (מחירון):</span> <span style={{fontWeight:'500'}}>{selectedObligationDetails.priceDescription}</span></div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button data-agy-id="orderpaymentsmanager_button_22" 
                onClick={() => setSelectedObligationDetails(null)} 
                style={{ padding: '0.8rem 2rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                סגור
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && showAddChargeModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '400px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>
                הוספת חיוב ידני
              </h2>
              <button data-agy-id="orderpaymentsmanager_button_23" onClick={() => setShowAddChargeModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>תיאור החיוב:</label>
                <input data-agy-id="orderpaymentsmanager_input_24" 
                  type="text" 
                  placeholder="לדוגמא: שמלה נוספת" 
                  value={newObligation.description} 
                  onChange={e => setNewObligation({...newObligation, description: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', outline: 'none' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>סכום (₪):</label>
                <input data-agy-id="orderpaymentsmanager_input_25" 
                  type="number" 
                  placeholder="0" 
                  value={newObligation.amount} 
                  onChange={e => setNewObligation({...newObligation, amount: e.target.value})}
                  style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #fca5a5', outline: 'none', fontSize: '1.1rem', fontWeight: 'bold', color: '#b91c1c' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button data-agy-id="orderpaymentsmanager_button_26" 
                onClick={() => setShowAddChargeModal(false)} 
                style={{ padding: '0.8rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', transition: 'background 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor='#e2e8f0'}
                onMouseOut={e => e.currentTarget.style.backgroundColor='#f1f5f9'}
              >
                ביטול
              </button>
              <button data-agy-id="orderpaymentsmanager_button_27" 
                onClick={addObligation} 
                disabled={!newObligation.description || !newObligation.amount}
                style={{ padding: '0.8rem 2rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: (!newObligation.description || !newObligation.amount) ? 'not-allowed' : 'pointer', fontWeight: 'bold', transition: 'opacity 0.2s', opacity: (!newObligation.description || !newObligation.amount) ? 0.6 : 1 }}
              >
                שמור חיוב
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && showRefundModal && createPortal(
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '500px', maxWidth: '90%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem' }}>יצירת בקשת זיכוי</h2>
              <button onClick={() => setShowRefundModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>סכום לזיכוי (₪) *</label>
                <input type="number" value={refundData.amount} onChange={e => setRefundData({...refundData, amount: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #c4b5fd', background: '#f5f3ff', color: '#6d28d9', fontWeight: 'bold', fontSize: '1.1rem' }} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#475569', fontSize: '0.9rem' }}>סיבה לזיכוי / הערות</label>
                <input type="text" value={refundData.reason} onChange={e => setRefundData({...refundData, reason: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              
              <div style={{ gridColumn: '1 / -1', marginTop: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>פרטי בנק לזיכוי</h4>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>בנק</label>
                <input type="text" value={refundData.bankName} onChange={e => setRefundData({...refundData, bankName: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>סניף</label>
                <input type="text" value={refundData.bankBranch} onChange={e => setRefundData({...refundData, bankBranch: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>מספר חשבון</label>
                <input type="text" value={refundData.bankAccount} onChange={e => setRefundData({...refundData, bankAccount: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>שם בעל החשבון</label>
                <input type="text" value={refundData.bankAccountName} onChange={e => setRefundData({...refundData, bankAccountName: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1' }} />
              </div>
              
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>אמצעי תשלום לזיכוי (נלקח אוטומטית מתשלום אחרון)</label>
                <input type="text" readOnly value={refundData.paymentDetails} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: '#f8fafc', color: '#64748b' }} title="שדה זה מתמלא אוטומטית מהתשלום האחרון במערכת" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem' }}>מייל לקוח (לשליחת אישור זיכוי)</label>
                <input type="email" value={refundData.email} onChange={e => setRefundData({...refundData, email: e.target.value})} style={{ width: '100%', padding: '0.8rem', borderRadius: '8px', border: '1px solid #cbd5e1', direction: 'ltr', textAlign: 'right' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
              <button onClick={() => setShowRefundModal(false)} style={{ padding: '0.8rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>ביטול</button>
              <button onClick={submitRefund} disabled={isProcessing} style={{ padding: '0.8rem 2rem', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                {isProcessing ? 'מעבד...' : 'צור בקשת זיכוי'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
