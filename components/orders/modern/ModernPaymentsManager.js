'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Info, RefreshCcw, CreditCard, Plus, X, Zap } from 'lucide-react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

/**
 * טאב "תשלומים" בעיצוב המודרני — פורט מלא של OrderPaymentsManager:
 * אריחי סיכום, חיובים (כולל ידניים), תשלומים, סליקת אשראי דרך נדרים פלוס
 * (כולל העברה מהירה בקורא מגנטי), קבלת תשלום ידנית, בקשות זיכוי וזיכויים ממתינים.
 */
export default function ModernPaymentsManager({ orderId, items = [], order = {}, obligations = [], payments = [], refunds = [], onObligationsChange, onPaymentsChange, onRefundsChange, totalRequired, totalPaid, customer = {}, onOrderUpdated }) {
  const [newObligation, setNewObligation] = useState({ description: '', amount: '' });
  const [newPayment, setNewPayment] = useState({ paymentMethod: 'אשראי', notes: '', amount: '' });

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showQuickSwipeModal, setShowQuickSwipeModal] = useState(false);
  const [swipeInput, setSwipeInput] = useState('');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundData, setRefundData] = useState({
    amount: '', reason: '', bankName: '', bankBranch: '', bankAccount: '', bankAccountName: '', paymentDetails: '', email: ''
  });
  const [creditCardData, setCreditCardData] = useState({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: '' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [settings, setSettings] = useState({});
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);
  const [selectedObligationDetails, setSelectedObligationDetails] = useState(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    setNewPayment(prev => {
      if (!prev.amount || parseFloat(prev.amount) === 0 || parseFloat(prev.amount) > Math.max(0, totalRequired - totalPaid)) {
        return { ...prev, amount: Math.max(0, totalRequired - totalPaid).toString() };
      }
      return prev;
    });
  }, [totalRequired, totalPaid]);

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const settingsObj = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(settingsObj);
          if (settingsObj.ALLOWED_PAYMENT_METHODS) {
            const opts = settingsObj.ALLOWED_PAYMENT_METHODS.split(',').map(s => s.trim()).filter(Boolean);
            if (opts.length > 0) setNewPayment(prev => ({ ...prev, paymentMethod: opts[0] }));
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
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק חיוב זה?'))) return;
    const updated = [...obligations];
    if (updated[idx].id) updated[idx].isDeleted = true;
    else updated.splice(idx, 1);
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
      if (!(await window.customConfirm('האם אתה בטוח שברצונך להוסיף תשלום זה?'))) return;
    }

    const added = {
      isNew: true,
      paymentMethod: newPayment.paymentMethod,
      notes: newPayment.paymentMethod === 'יציאה באישור מנהל' ? `אושר על סך ₪${newPayment.amount} ` + newPayment.notes : newPayment.notes,
      amount: newPayment.paymentMethod === 'יציאה באישור מנהל' ? 0 : paymentAmount,
      paymentDate: new Date().toISOString()
    };
    onPaymentsChange([...payments, added]);
    setNewPayment({ paymentMethod: paymentMethodOptions[0] || 'אשראי', notes: '', amount: '' });
    setShowAddPaymentModal(false);
  };

  const removePayment = async (idx) => {
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק תשלום זה?'))) return;
    const updated = [...payments];
    if (updated[idx].id) updated[idx].isDeleted = true;
    else updated.splice(idx, 1);
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
      } catch (e) {
        const match = lastPayment.notes?.match(/(?:כרטיס|אשראי).*?(\d{4})/);
        if (match && match[1]) last4 = match[1];
      }

      paymentDetailsString = lastPayment.paymentMethod || '';
      if (last4) {
        paymentDetailsString += ` (ספרות: ${last4})`;
      } else if (lastPayment.paymentMethod && lastPayment.paymentMethod.includes('אשראי') && !last4) {
        const match4 = lastPayment.notes?.match(/\b(\d{4})\b/);
        if (match4) paymentDetailsString += ` (ספרות: ${match4[1]})`;
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
        body: JSON.stringify({ customerId: customer?.id, orderId, ...refundData })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create refund');

      alert('בקשת הזיכוי נוצרה בהצלחה. ניתן לנהל אותה במסמך הזיכויים הראשי או כאן בטאב תשלומים.');
      setShowRefundModal(false);

      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) onOrderUpdated(await orderRes.json());
      }
    } catch (err) {
      alert(err.message || 'שגיאה ביצירת הזיכוי');
    } finally {
      setIsProcessing(false);
    }
  };

  const approveRefund = async (refundId) => {
    if (!(await window.customConfirm('האם לאשר ביצוע זיכוי זה? הפעולה תיצור תשלום הפכי להזמנה.'))) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${refundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true })
      });
      if (!res.ok) throw new Error('Failed to approve refund');
      alert('הזיכוי אושר ובוצע בהצלחה.');

      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) onOrderUpdated(await orderRes.json());
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
    setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: Math.max(0, totalRequired - totalPaid).toString() });
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
      setCreditCardData(prev => ({ ...prev, cardNumber: card, tokef }));
      setShowQuickSwipeModal(false);
      setTimeout(() => setShowCreditModal(true), 150);
    }
  };

  const handleOpenCreditModal = () => {
    setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: Math.max(0, totalRequired - totalPaid).toString() });
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
    if (raw.length > 2) formatted = `${raw.substring(0, 2)}/${raw.substring(2, 4)}`;
    setCreditCardData(prev => ({ ...prev, tokef: formatted }));
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
        let parsedRaw = { 'אישור': data.confirmation || 'בוצע' };
        try {
          if (data.rawResponse) parsedRaw = JSON.parse(data.rawResponse);
        } catch (e) { }
        if (creditCardData.notes) parsedRaw['הערות משתמש'] = creditCardData.notes;

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

  const fmtDate = (d0) => {
    const d = d0 ? new Date(d0) : new Date();
    if (isNaN(d.getTime())) return '-';
    const hebStr = getHebrewDateString(d);
    return `${d.toLocaleDateString('he-IL')}${hebStr ? ` (${hebStr})` : ''}`;
  };

  const activeObligations = obligations.filter(o => !o.isDeleted);
  const activePayments = payments.filter(p => !p.isDeleted);
  const pendingRefunds = refunds.filter(r => !r.isDeleted && !r.isExecuted);
  const balance = totalRequired - totalPaid;

  return (
    <>
      {/* אריחי סיכום */}
      <div className="moc-pay-summary">
        <div className="moc-pay-tile total"><div className="moc-pt-lbl">סה"כ לתשלום</div><div className="moc-pt-amt">₪{(totalRequired || 0).toLocaleString('he-IL')}</div></div>
        <div className="moc-pay-tile paid"><div className="moc-pt-lbl">שולם עד כה</div><div className="moc-pt-amt">₪{(totalPaid || 0).toLocaleString('he-IL')}</div></div>
        {balance >= 0 ? (
          <div className="moc-pay-tile debt"><div className="moc-pt-lbl">יתרת חוב</div><div className="moc-pt-amt">₪{balance.toLocaleString('he-IL')}</div></div>
        ) : (
          <div className="moc-pay-tile credit"><div className="moc-pt-lbl">יתרת זכות</div><div className="moc-pt-amt">₪{Math.abs(balance).toLocaleString('he-IL')}</div></div>
        )}
      </div>

      {/* ===== חיובים ===== */}
      <div className="moc-section-block">
        <div className="moc-table-toolbar">
          <h3 style={{ color: '#b91c1c' }}>חיובים</h3>
          <button className="moc-btn moc-btn-outline moc-btn-sm" onClick={() => setShowAddChargeModal(true)}>
            <Plus size={14} /> הוסף חיוב
          </button>
        </div>
        <div className="moc-card-panel" style={{ padding: 0 }}>
          {activeObligations.length > 0 ? (
            <table className="moc-data-table">
              <thead>
                <tr><th>תיאור</th><th>תאריך</th><th>סכום</th><th style={{ width: '80px' }}>פעולות</th></tr>
              </thead>
              <tbody>
                {activeObligations.map((obs, idx) => {
                  const descText = (obs.productName || obs.description || '').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '').trim() || (obs.isManual ? 'חיוב ידני' : 'חיוב מחירון');
                  return (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{descText}</td>
                      <td className="moc-hint">{fmtDate(obs.createdAt)}</td>
                      <td style={{ fontWeight: 700, color: '#b91c1c' }}>₪{obs.amount}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="moc-icon-btn-plain" title="פרטים נוספים" onClick={() => setSelectedObligationDetails(obs)}>
                            <Info size={15} />
                          </button>
                          {obs.isManual !== false && (
                            <button className="moc-icon-btn-plain row-delete" title="מחק" onClick={() => removeObligation(obligations.indexOf(obs))}>
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="moc-empty-state" style={{ padding: '20px 0' }}>אין חיובים מתועדים</div>
          )}
        </div>
      </div>

      {/* ===== תשלומים ===== */}
      <div className="moc-section-block">
        <div className="moc-table-toolbar">
          <h3 style={{ color: '#166534' }}>תשלומים</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button className="moc-btn moc-btn-outline moc-btn-sm" onClick={handleOpenCreditModal} title="תשלום בכרטיס אשראי (נדרים פלוס)">
              <CreditCard size={15} /> תשלום בכרטיס אשראי (נדרים פלוס)
            </button>
            <button className="moc-btn moc-btn-outline moc-btn-sm" onClick={handleOpenRefundModal} title="בקשת זיכוי ללקוח">
              <RefreshCcw size={15} /> בקשת זיכוי ללקוח
            </button>
            <button className="moc-btn moc-btn-gold moc-btn-sm" onClick={() => setShowAddPaymentModal(true)}>
              <Plus size={15} /> הוסף קבלת תשלום
            </button>
          </div>
        </div>
        <div className="moc-card-panel" style={{ padding: 0 }}>
          {activePayments.length > 0 ? (
            <table className="moc-data-table">
              <thead>
                <tr><th>אופן</th><th>תאריך</th><th>סכום</th><th style={{ width: '80px' }}>פעולות</th></tr>
              </thead>
              <tbody>
                {activePayments.map((p, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{p.paymentMethod || '-'}</td>
                    <td className="moc-hint">{fmtDate(p.paymentDate)}</td>
                    <td style={{ fontWeight: 700, color: '#16a34a' }}>₪{p.amount}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="moc-icon-btn-plain" title="פרטים נוספים" onClick={() => setSelectedPaymentDetails(p)}>
                          <Info size={15} />
                        </button>
                        <button className="moc-icon-btn-plain row-delete" title="מחק" onClick={() => removePayment(payments.indexOf(p))}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="moc-empty-state" style={{ padding: '20px 0' }}>לא בוצעו תשלומים</div>
          )}
        </div>
      </div>

      {/* ===== זיכויים ממתינים ===== */}
      <div className="moc-section-block">
        <div className="moc-table-toolbar">
          <h3 style={{ color: '#1e40af' }}>זיכויים ממתינים</h3>
        </div>
        <div className="moc-card-panel" style={{ padding: pendingRefunds.length > 0 ? 0 : undefined }}>
          {pendingRefunds.length > 0 ? (
            <table className="moc-data-table">
              <thead>
                <tr><th>פרטים / סיבה</th><th>תאריך בקשה</th><th>סכום</th><th style={{ width: '110px' }}>פעולות</th></tr>
              </thead>
              <tbody>
                {pendingRefunds.map((r, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{r.reason || 'ללא סיבה'}</td>
                    <td className="moc-hint">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL')}</td>
                    <td style={{ fontWeight: 700, color: '#2563eb' }}>₪{r.amount}</td>
                    <td>
                      <button className="moc-btn moc-btn-gold moc-btn-sm" disabled={isProcessing} onClick={() => approveRefund(r.id)}>
                        אשר ביצוע
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="moc-empty-state" style={{ padding: '20px 0' }}>אין זיכויים ממתינים</div>
          )}
        </div>
      </div>

      {/* ===== מודל העברה מהירה (קורא מגנטי) ===== */}
      {mounted && showQuickSwipeModal && createPortal(
        <div className="moc moc-modal-overlay">
          <div className="moc-modal-box" style={{ maxWidth: '440px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '30px' }}>
              <div style={{ margin: '0 auto 16px', width: '84px', height: '84px', background: 'var(--moc-warning-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '3rem' }}>🧲</span>
              </div>
              <h3 style={{ margin: '0 0 8px', fontSize: '1.4rem' }}>העברת כרטיס מהירה</h3>
              <p style={{ color: 'var(--moc-text-muted)', marginTop: 0 }}>אנא העבר כעת את כרטיס האשראי בקורא המגנטי...</p>
              <input
                autoFocus
                type="text"
                value={swipeInput}
                onChange={handleSwipeInputChange}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                onBlur={(e) => { if (showQuickSwipeModal) setTimeout(() => e.target?.focus(), 100); }}
                style={{ opacity: 0, position: 'absolute', top: '-1000px' }}
              />
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button className="moc-btn moc-btn-outline" onClick={() => setShowQuickSwipeModal(false)}>ביטול חלון מהיר</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל סליקת אשראי (נדרים פלוס) ===== */}
      {mounted && showCreditModal && createPortal(
        <div className="moc moc-modal-overlay">
          <div className="moc-modal-box">
            <div className="moc-modal-head">
              <h3>תשלום בכרטיס אשראי (נדרים פלוס)</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button className="moc-btn moc-btn-outline moc-btn-sm" title="העברת כרטיס מהירה בקורא מגנטי"
                  onClick={(e) => { e.preventDefault(); setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}>
                  <Zap size={14} /> העברה מהירה
                </button>
                <button className="moc-close-x" onClick={() => setShowCreditModal(false)}><X size={15} /></button>
              </div>
            </div>
            <div className="moc-modal-body">
              <label className="moc-field-label">שם לקוח</label>
              <input type="text" readOnly value={`${customer?.firstName || ''} ${customer?.lastName || ''}`} style={{ marginBottom: '12px', background: 'var(--moc-neutral-bg)' }} />

              <label className="moc-field-label">סכום לחיוב (₪)</label>
              <input type="number" value={creditCardData.amount}
                onChange={e => setCreditCardData({ ...creditCardData, amount: e.target.value })}
                style={{ marginBottom: '12px', fontWeight: 700 }} />

              <label className="moc-field-label">מספר כרטיס אשראי</label>
              <input type="text" value={creditCardData.cardNumber} onChange={handleCardNumberChange}
                placeholder="0000 0000 0000 0000" maxLength={19}
                style={{ marginBottom: '12px', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} />

              <div className="moc-grid-2">
                <div>
                  <label className="moc-field-label">תוקף (MM/YY)</label>
                  <input type="text" value={creditCardData.tokef} onChange={handleTokefChange}
                    placeholder="12/28" maxLength={5} style={{ direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} />
                </div>
                <div>
                  <label className="moc-field-label">תשלומים</label>
                  <input type="number" min={1} max={36} value={creditCardData.installments}
                    onChange={e => setCreditCardData({ ...creditCardData, installments: e.target.value })} />
                </div>
              </div>

              <label className="moc-field-label" style={{ marginTop: '12px' }}>הערות</label>
              <input type="text" value={creditCardData.notes}
                onChange={e => setCreditCardData({ ...creditCardData, notes: e.target.value })}
                placeholder="הערות לחיוב" />

              {creditError && (
                <div style={{ padding: '10px 14px', background: 'var(--moc-danger-bg)', color: 'var(--moc-danger-text)', borderRadius: '8px', marginTop: '14px', fontSize: '0.92rem', fontWeight: 600 }}>
                  ⚠️ {creditError}
                </div>
              )}
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" disabled={isProcessing} onClick={() => setShowCreditModal(false)}>ביטול</button>
              <button className="moc-btn moc-btn-gold" disabled={isProcessing} onClick={handleProcessCreditCard}>
                {isProcessing ? 'מעבד...' : 'בצע חיוב'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל הוספת קבלת תשלום ===== */}
      {mounted && showAddPaymentModal && createPortal(
        <div className="moc moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddPaymentModal(false); }}>
          <div className="moc-modal-box">
            <div className="moc-modal-head">
              <h3>הוספת קבלת תשלום</h3>
              <button className="moc-close-x" onClick={() => setShowAddPaymentModal(false)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <label className="moc-field-label">אופן תשלום</label>
              <select value={newPayment.paymentMethod}
                onChange={e => setNewPayment({ ...newPayment, paymentMethod: e.target.value })}
                style={{ marginBottom: '12px' }}>
                {paymentMethodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>

              <label className="moc-field-label">סכום (₪)</label>
              <input type="number" value={newPayment.amount}
                onChange={e => setNewPayment({ ...newPayment, amount: e.target.value })}
                style={{ marginBottom: '12px', fontWeight: 700 }} />

              <label className="moc-field-label">הערות</label>
              <input type="text" value={newPayment.notes}
                onChange={e => setNewPayment({ ...newPayment, notes: e.target.value })}
                placeholder="הערות לתשלום" />
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setShowAddPaymentModal(false)}>ביטול</button>
              <button className="moc-btn moc-btn-gold" disabled={!newPayment.amount} onClick={addPayment}>הוסף תשלום</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל הוספת חיוב ידני ===== */}
      {mounted && showAddChargeModal && createPortal(
        <div className="moc moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddChargeModal(false); }}>
          <div className="moc-modal-box">
            <div className="moc-modal-head">
              <h3>הוספת חיוב ידני</h3>
              <button className="moc-close-x" onClick={() => setShowAddChargeModal(false)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <label className="moc-field-label">תיאור החיוב</label>
              <input type="text" placeholder="לדוגמא: שמלה נוספת" value={newObligation.description}
                onChange={e => setNewObligation({ ...newObligation, description: e.target.value })}
                style={{ marginBottom: '12px' }} />
              <label className="moc-field-label">סכום (₪)</label>
              <input type="number" placeholder="0" value={newObligation.amount}
                onChange={e => setNewObligation({ ...newObligation, amount: e.target.value })}
                style={{ fontWeight: 700 }} />
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setShowAddChargeModal(false)}>ביטול</button>
              <button className="moc-btn moc-btn-gold" disabled={!newObligation.description || !newObligation.amount} onClick={addObligation}>שמור חיוב</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל פרטי תשלום ===== */}
      {mounted && selectedPaymentDetails && createPortal(
        <div className="moc moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedPaymentDetails(null); }}>
          <div className="moc-modal-box wide">
            <div className="moc-modal-head">
              <h3>פרטי תשלום מלאים</h3>
              <button className="moc-close-x" onClick={() => setSelectedPaymentDetails(null)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <div className="moc-grid-2" style={{ marginBottom: '14px' }}>
                <div>
                  <span className="moc-field-label">אופן תשלום</span>
                  <div className="moc-field-value">{selectedPaymentDetails.paymentMethod || '-'}</div>
                </div>
                <div>
                  <span className="moc-field-label">סכום</span>
                  <div className="moc-field-value" style={{ color: '#16a34a' }}>₪{selectedPaymentDetails.amount}</div>
                </div>
              </div>
              <span className="moc-field-label">תאריך</span>
              <div className="moc-field-value" style={{ fontSize: '0.95rem', marginBottom: '14px' }}>
                {new Date(selectedPaymentDetails.paymentDate).toLocaleString('he-IL')}
              </div>

              <span className="moc-field-label">הערות ופירוט (נדרים פלוס / אחר)</span>
              <div className="moc-card-panel" style={{ padding: '12px 14px', maxHeight: '280px', overflowY: 'auto' }}>
                {(() => {
                  const notes = selectedPaymentDetails.notes;
                  if (!notes) return <span className="moc-hint">אין הערות</span>;
                  try {
                    if (typeof notes === 'string' && notes.trim().startsWith('{')) {
                      const parsed = JSON.parse(notes);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(parsed).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', borderBottom: '1px solid var(--moc-divider)', paddingBottom: '6px', gap: '8px' }}>
                              <strong style={{ width: '140px', flexShrink: 0, fontSize: '0.88rem', color: 'var(--moc-text-muted)' }}>{k}:</strong>
                              <span style={{ flex: 1, wordBreak: 'break-word', fontSize: '0.92rem', direction: 'ltr', textAlign: 'right', fontWeight: 500 }}>{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                  } catch (e) { }
                  return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{typeof notes === 'string' ? notes.split(' | ').join('\n') : String(notes)}</div>;
                })()}
              </div>
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setSelectedPaymentDetails(null)}>סגור</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל פרטי חיוב ===== */}
      {mounted && selectedObligationDetails && createPortal(
        <div className="moc moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelectedObligationDetails(null); }}>
          <div className="moc-modal-box wide">
            <div className="moc-modal-head">
              <h3>פרטי חיוב</h3>
              <button className="moc-close-x" onClick={() => setSelectedObligationDetails(null)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <div className="moc-grid-2" style={{ marginBottom: '14px' }}>
                <div>
                  <span className="moc-field-label">סוג חיוב</span>
                  <div className="moc-field-value">
                    {selectedObligationDetails.isManual === false
                      ? (selectedObligationDetails.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב אוטומטי')
                      : (selectedObligationDetails.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב ידני')}
                  </div>
                </div>
                <div>
                  <span className="moc-field-label">סכום</span>
                  <div className="moc-field-value" style={{ color: 'var(--moc-danger-text)' }}>₪{selectedObligationDetails.amount}</div>
                </div>
              </div>
              <span className="moc-field-label">תאריך</span>
              <div className="moc-field-value" style={{ fontSize: '0.95rem', marginBottom: '14px' }}>
                {new Date(selectedObligationDetails.createdAt || new Date()).toLocaleString('he-IL')}
              </div>

              <span className="moc-field-label">תיאור מפורט</span>
              <div className="moc-notes-box">
                <div><strong>פירוט:</strong> {selectedObligationDetails.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'ללא תיאור'}</div>
                {selectedObligationDetails.priceCategory && (
                  <div style={{ marginTop: '8px' }}><strong>קטגוריה (מחירון):</strong> {selectedObligationDetails.priceCategory}</div>
                )}
                {selectedObligationDetails.priceDescription && (
                  <div style={{ marginTop: '8px' }}><strong>תיאור (מחירון):</strong> {selectedObligationDetails.priceDescription}</div>
                )}
              </div>
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setSelectedObligationDetails(null)}>סגור</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל בקשת זיכוי ===== */}
      {mounted && showRefundModal && createPortal(
        <div className="moc moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowRefundModal(false); }}>
          <div className="moc-modal-box wide">
            <div className="moc-modal-head">
              <h3>יצירת בקשת זיכוי</h3>
              <button className="moc-close-x" onClick={() => setShowRefundModal(false)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <label className="moc-field-label">סכום לזיכוי (₪) *</label>
              <input type="number" value={refundData.amount} onChange={e => setRefundData({ ...refundData, amount: e.target.value })} style={{ marginBottom: '12px', fontWeight: 700 }} />

              <label className="moc-field-label">סיבה לזיכוי / הערות</label>
              <input type="text" value={refundData.reason} onChange={e => setRefundData({ ...refundData, reason: e.target.value })} style={{ marginBottom: '14px' }} />

              <span className="moc-field-label" style={{ fontSize: '0.95rem', color: 'var(--moc-text-main)', fontWeight: 700, marginBottom: '8px' }}>פרטי בנק לזיכוי</span>
              <div className="moc-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="moc-field-label">בנק</label><input type="text" value={refundData.bankName} onChange={e => setRefundData({ ...refundData, bankName: e.target.value })} /></div>
                <div><label className="moc-field-label">סניף</label><input type="text" value={refundData.bankBranch} onChange={e => setRefundData({ ...refundData, bankBranch: e.target.value })} /></div>
              </div>
              <div className="moc-grid-2" style={{ marginBottom: '12px' }}>
                <div><label className="moc-field-label">מספר חשבון</label><input type="text" value={refundData.bankAccount} onChange={e => setRefundData({ ...refundData, bankAccount: e.target.value })} /></div>
                <div><label className="moc-field-label">שם בעל החשבון</label><input type="text" value={refundData.bankAccountName} onChange={e => setRefundData({ ...refundData, bankAccountName: e.target.value })} /></div>
              </div>

              <label className="moc-field-label">אמצעי תשלום לזיכוי (נלקח אוטומטית מתשלום אחרון)</label>
              <input type="text" readOnly value={refundData.paymentDetails} style={{ marginBottom: '12px', background: 'var(--moc-neutral-bg)' }} title="שדה זה מתמלא אוטומטית מהתשלום האחרון במערכת" />

              <label className="moc-field-label">מייל לקוח (לשליחת אישור זיכוי)</label>
              <input type="email" value={refundData.email} onChange={e => setRefundData({ ...refundData, email: e.target.value })} style={{ direction: 'ltr' }} />
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setShowRefundModal(false)}>ביטול</button>
              <button className="moc-btn moc-btn-gold" disabled={isProcessing} onClick={submitRefund}>
                {isProcessing ? 'מעבד...' : 'צור בקשת זיכוי'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
