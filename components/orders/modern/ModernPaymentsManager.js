'use client';

import { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { verifyPin } from './mocAuth';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';

/** מחשב את הזמן שנותר עד ל-deadline, מתעדכן כל שנייה. null כשהזמן פג. */
function useCountdown(deadline) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainingMs = deadline - now;
  if (remainingMs <= 0) return null;
  const totalSec = Math.floor(remainingMs / 1000);
  return {
    text: `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`,
    urgent: remainingMs <= 60000
  };
}

/**
 * תגית נספרת לאחור על שורת "דמי ביטול" - מציגה עד מתי ועל איזה סכום עדיין ניתן
 * לנצל זיכוי אוטומטי על פריט חלופי שנוסף לאותה הזמנה (ר' CANCELLATION_CREDIT_MINUTES
 * ולוגיקת הקרדיט ב-lib/pricingEngine.js). נעלמת מעצמה כשהזמן פג.
 */
function CancellationCreditBadge({ deadline, amount }) {
  const countdown = useCountdown(deadline);
  if (!countdown) return null;
  return (
    <div style={{ marginTop: '4px' }}>
      <span
        className={`badge ${countdown.urgent ? 'badge-danger' : 'badge-warning'}`}
        title="ניתן לנצל סכום זה כזיכוי אוטומטי אם יתווסף פריט חלופי לאותה הזמנה, עד לתום הזמן שנקבע בהגדרות"
      >
        <svg className="icon"><use href="#i-clock" /></svg>
        ניתן לזכות ₪{amount} על פריט חדש עוד {countdown.text}
      </span>
    </div>
  );
}

/** קובייה בטאב תשלומים שמסכמת זיכוי ביטול זמין לניצול, אם יש כזה כרגע בהזמנה. */
function CreditWindowTile({ deadline, amount }) {
  const countdown = useCountdown(deadline);
  if (!countdown) return null;
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <div className="kpi-icon" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>
          <svg className="icon"><use href="#i-clock" /></svg>
        </div>
      </div>
      <div className="kpi-label">זיכוי ביטול זמין לניצול</div>
      <div className="kpi-value">₪{amount}</div>
      <span className={`badge ${countdown.urgent ? 'badge-danger' : 'badge-warning'}`} style={{ marginTop: '6px' }}>
        <svg className="icon"><use href="#i-clock" /></svg> {countdown.text}
      </span>
    </div>
  );
}

/** אייקון (עמום, כמו בתבנית העיצוב) לפי סוג שורת החיוב - חיוב רגיל, זיכוי, דמי ביטול,
 * מימוש זיכוי, תיקון, חיוב ידני וכו'. */
function getObligationIcon(obs) {
  const desc = obs.description || '';
  if (desc.startsWith('דמי ביטול')) return 'i-x-circle';
  if (desc.startsWith('זיכוי דמי ביטול')) return 'i-coin';
  if (desc.startsWith('זיכוי בגין ביטול')) return 'i-refresh';
  if (desc.startsWith('חיוב מקורי')) return 'i-file';
  if (desc.startsWith('תיקון')) return 'i-scissors';
  if (obs.isManual !== false) return 'i-edit';
  return 'i-bag';
}

/**
 * טאב "תשלומים" בעיצוב "אריג" — פורט מלא של OrderPaymentsManager:
 * אריחי סיכום, חיובים (כולל ידניים), תשלומים דרך נדרים פלוס בלבד
 * (כולל העברה מהירה בקורא מגנטי), בקשות זיכוי וזיכויים ממתינים.
 * חשוף דרך ref: openCreditModal() — אייקון החוב בטופ-בר פותח את חלון נדרים.
 */
const ModernPaymentsManager = forwardRef(function ModernPaymentsManager({ orderId, items = [], order = {}, obligations = [], payments = [], refunds = [], onObligationsChange, onPaymentsChange, onRefundsChange, totalRequired, totalPaid, customer = {}, onOrderUpdated, isLivePreviewing = false }, ref) {
  const [newObligation, setNewObligation] = useState({ description: '', amount: '' });

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showQuickSwipeModal, setShowQuickSwipeModal] = useState(false);
  const [swipeInput, setSwipeInput] = useState('');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
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
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (Array.isArray(data)) {
          setSettings(data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
        } else {
          setSettings(data || {});
        }
      })
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
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק חיוב זה?'))) return;
    const updated = [...obligations];
    if (updated[idx].id) updated[idx].isDeleted = true;
    else updated.splice(idx, 1);
    onObligationsChange(updated);
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

  /** מחשב מחדש את חיובי ההזמנה הזו בלבד (משתמש באותה לוגיקה כמו רשימת חישוב מחדש
   * באדמין - /api/admin/recalculations - רק לפריט בודד, ישירות מטאב התשלומים). */
  const handleRecalculate = async () => {
    if (!(await window.customConfirm('לחשב מחדש את כל חיובי ההזמנה הזו לפי הכללים העדכניים? פעולה זו עשויה לשנות סכומים קיימים.'))) return;
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/admin/recalculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [orderId] })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'שגיאה בחישוב מחדש');
      if (data.errors?.length) throw new Error(data.errors[0].error || 'שגיאה בחישוב מחדש');

      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) onOrderUpdated(await orderRes.json());
      }
      alert('החישוב עודכן בהצלחה.');
    } catch (err) {
      alert(err.message || 'שגיאה בחישוב מחדש');
    } finally {
      setIsRecalculating(false);
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
    // מוגן גם כאן (לא רק בהסתרת הכפתור למטה) - נקודת הכניסה השנייה לחלון הזה היא
    // אייקון החוב בטופ-בר (handleWalletClick ב-app/orders/[id]/page.js) שקורא ל-
    // openCreditModal() החשוף דרך ref בלי לדעת את ההגדרות בכלל; בלי השמירה כאן, גמ"ח
    // שכיבה את נדרים פלוס עדיין רואה את חלון החיוב באשראי נפתח מהאייקון (והיה נכשל
    // רק בשליחה, מול השרת ב-app/api/nedarim/route.js).
    if (settings.nedarim_plus_enabled === 'false') return;
    setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: Math.max(0, totalRequired - totalPaid).toString() });
    setCreditError('');
    setShowCreditModal(true);
  };

  // handleOpenCreditModal חייב להיות מוגדר לפני ה-hook הזה (ולא רק לפני שימוש בפועל בזמן
  // ריצה) - ESLint react-hooks/immutability דורש סדר הצהרה תואם סדר שימוש בקוד המקור.
  useImperativeHandle(ref, () => ({
    openCreditModal: () => handleOpenCreditModal()
  }));

  /** מעקף אשראי מלא מתוך האתר - רושם תשלום אשראי כאילו שולם, מבלי לפנות למסוף נדרים פלוס בכלל.
   * מוגבל למתכנת בלבד (verifyPin ברמת 'מתכנת'), עבור מצבים כמו תקלת סליקה. */
  const handleBypassCreditPayment = async () => {
    const amount = parseFloat(creditCardData.amount);
    if (!amount || amount <= 0) {
      setCreditError('אנא הזן סכום לפני מעקף.');
      return;
    }
    const balance = totalRequired - totalPaid;
    if (amount > balance) {
      setCreditError(`לא ניתן לשלם יותר מהיתרה הנדרשת (₪${balance}).`);
      return;
    }

    const auth = await verifyPin(
      'מעקף חיוב אשראי בפועל ורישום ידני כאילו שולם, ללא פנייה לנדרים פלוס - מוגבל למתכנת בלבד. אנא בחר משתמש והזן סיסמה:',
      'מתכנת'
    );
    if (!auth) return;

    setIsProcessing(true);
    setCreditError('');
    try {
      const notesObj = {
        'אישור': 'מעקף מתכנת - לא בוצע חיוב אשראי בפועל',
        'מזהה עובד מאשר': auth.employeeId
      };
      if (creditCardData.notes) notesObj['הערות משתמש'] = creditCardData.notes;

      const added = {
        isNew: true,
        paymentMethod: 'אשראי (מעקף מתכנת)',
        notes: JSON.stringify(notesObj),
        amount,
        paymentDate: new Date().toISOString()
      };
      onPaymentsChange([...payments, added]);
      setShowCreditModal(false);
    } finally {
      setIsProcessing(false);
    }
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

        // הכרטיס כבר חויב בפועל (כסף אמיתי זז) - חובה לשמור את התשלום בשרת מיד, לא רק
        // ב-state המקומי. אחרת קריסת טאב/נפילת רשת בין רגע החיוב לשמירה הידנית הבאה
        // משאירה חיוב אמיתי בלי שום רישום על ההזמנה. אותו endpoint שמשמש ליצירת תשלום
        // ידני (POST /api/payments) - אם ההזמנה עדיין "עגלה" הוא גם הופך אותה למוזמנת
        // לצמיתות, בדיוק כמו בשמירה הרגילה.
        let savedPayment = null;
        try {
          const saveRes = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId,
              amount: added.amount,
              paymentMethod: added.paymentMethod,
              notes: added.notes
            })
          });
          if (saveRes.ok) savedPayment = await saveRes.json();
        } catch (persistErr) {
          // saveRes נשאר null - מטופל למטה
        }

        if (savedPayment) {
          onPaymentsChange([...payments, savedPayment]);
          setShowCreditModal(false);
        } else {
          // החיוב הצליח אבל השמירה בשרת נכשלה - עדיין מוסיפים ל-state המקומי (יישמר
          // בשמירה הידנית הבאה), אבל חובה להתריע בקול רם: הכסף כבר נגבה מהלקוח.
          onPaymentsChange([...payments, added]);
          setShowCreditModal(false);
          alert(`שים לב: הכרטיס חויב בהצלחה בסך ₪${added.amount}, אך שמירת התשלום בשרת נכשלה. יש ללחוץ מיד על "שמור" כדי לתעד את התשלום בהזמנה. אם השמירה הידנית נכשלת גם היא - יש לתעד את התשלום באופן חריג ולפנות לתמיכה, כדי שלא יישאר חיוב בלי רישום.`);
        }
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
    const timeStr = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    return hebStr ? `${hebStr} · ${timeStr}` : timeStr;
  };

  // חיוב משלוח מהיר (חדש 2026-08): אותה מנגנון חיוב ידני שכבר קיים כאן (isNew + isManual, נשמר
  // רק כשההזמנה כולה נשמרת) - רק עם תיאור/סכום קבועים מראש. הגנה מפני כפילות: כפתור מוסתר/מנוטרל
  // אם כבר יש בפועל שורת חיוב פעילה (לא-מחוקה) עם אותו תיאור מדויק בהזמנה הזו.
  const enableDeliveries = settings.enable_deliveries === 'true';
  const parsedDeliveryPrice = parseFloat(settings.delivery_price);
  const deliveryPrice = isNaN(parsedDeliveryPrice) ? 50 : parsedDeliveryPrice;

  const hasActiveObligationWithDescription = (description) => obligations.some(o => !o.isDeleted && o.description === description);

  const addDeliveryObligation = (description) => {
    if (hasActiveObligationWithDescription(description)) return;
    const added = {
      isNew: true,
      description,
      amount: deliveryPrice,
      isManual: true,
      createdAt: new Date().toISOString()
    };
    onObligationsChange([...obligations, added]);
  };

  const activeObligations = obligations.filter(o => !o.isDeleted);
  const activePayments = payments.filter(p => !p.isDeleted);
  const pendingRefunds = refunds.filter(r => !r.isDeleted && !r.isExecuted);
  const balance = totalRequired - totalPaid;

  // חדש קודם, ישן אחר-כך — נוח יותר לראות מה קרה עכשיו בלי לגלול.
  const sortedObligations = [...activeObligations].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const sortedPayments = [...activePayments].sort((a, b) => new Date(b.paymentDate || 0) - new Date(a.paymentDate || 0));

  // הסכום שעדיין ניתן לנצל כזיכוי על פריט חלופי, ועד מתי - null אם השורה אינה שורת
  // דמי ביטול, כל הסכום כבר נוצל, שהזמן פג, או שאין deletedAt לפריט שמקורו בו.
  // הזיכוי עשוי להיות ממומש חלקית (למשל פריט חלופי ששווה פחות מדמי הביטול המלאים) -
  // במקרה כזה עדיין נשארת יתרה בת-מימוש כל עוד הטיימר לא פג.
  const getCancellationCreditInfo = (obs) => {
    if (!obs.orderItemId || !obs.description?.startsWith('דמי ביטול')) return null;
    const consumed = activeObligations
      .filter(o => o.orderItemId === obs.orderItemId && o.description?.startsWith('זיכוי דמי ביטול'))
      .reduce((sum, o) => sum + Math.abs(o.amount || 0), 0);
    const remaining = obs.amount - consumed;
    if (remaining <= 0) return null;
    const sourceItem = items.find(i => i.id === obs.orderItemId);
    if (!sourceItem?.deletedAt) return null;
    const minutes = parseFloat(settings.CANCELLATION_CREDIT_MINUTES);
    if (isNaN(minutes)) return null;
    const deadline = new Date(sourceItem.deletedAt).getTime() + minutes * 60000;
    return { deadline, remaining };
  };

  const activeCreditWindows = activeObligations.map(getCancellationCreditInfo).filter(Boolean);
  const nearestCreditWindow = activeCreditWindows.length
    ? {
        deadline: Math.min(...activeCreditWindows.map(c => c.deadline)),
        amount: activeCreditWindows.reduce((sum, c) => sum + c.remaining, 0)
      }
    : null;

  return (
    <>
      {/* אריחי סיכום */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-top">
            <div className="kpi-icon" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>
              <svg className="icon"><use href="#i-receipt" /></svg>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon-only btn-sm"
              onClick={handleRecalculate}
              disabled={isRecalculating}
              title="חשב מחדש את חיובי ההזמנה לפי הכללים העדכניים"
            >
              <svg className="icon" style={{ animation: isRecalculating ? 'spin 1s linear infinite' : 'none' }}><use href="#i-refresh" /></svg>
            </button>
          </div>
          <div className="kpi-label">
            סה"כ לתשלום
          </div>
          <div className="kpi-value">₪{(totalRequired || 0).toLocaleString('he-IL')}</div>
          {isLivePreviewing && (
            <div className="hint" style={{ color: 'var(--text-3)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }} title="מחשב מחדש ברקע לפי השינויים שעדיין לא נשמרו">
              <span className="spinner" style={{ width: '10px', height: '10px', borderWidth: '2px' }} />מחשב מחדש ברקע…
            </div>
          )}
        </div>
        <div className="kpi-card">
          <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}><svg className="icon"><use href="#i-coin" /></svg></div></div>
          <div className="kpi-label">שולם עד כה</div>
          <div className="kpi-value">₪{(totalPaid || 0).toLocaleString('he-IL')}</div>
        </div>
        {balance >= 0 ? (
          <div className="kpi-card">
            <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}><svg className="icon"><use href="#i-alert-tri" /></svg></div></div>
            <div className="kpi-label">יתרת חוב</div>
            <div className="kpi-value">₪{balance.toLocaleString('he-IL')}</div>
          </div>
        ) : (
          <div className="kpi-card">
            <div className="kpi-top"><div className="kpi-icon" style={{ background: 'var(--success-tint)', color: 'var(--success)' }}><svg className="icon"><use href="#i-coin" /></svg></div></div>
            <div className="kpi-label">יתרת זכות</div>
            <div className="kpi-value">₪{Math.abs(balance).toLocaleString('he-IL')}</div>
          </div>
        )}
        {nearestCreditWindow && <CreditWindowTile deadline={nearestCreditWindow.deadline} amount={nearestCreditWindow.amount} />}
      </div>

      {/* ===== חיובים ===== */}
      <div style={{ marginBottom: '22px' }}>
        <div className="toolbar">
          <h3 style={{ fontSize: '15px', color: 'var(--danger)' }}>חיובים</h3>
          <span className="spacer" />
          {enableDeliveries && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={hasActiveObligationWithDescription('משלוח הלוך')}
                onClick={() => addDeliveryObligation('משלוח הלוך')}
                title={hasActiveObligationWithDescription('משלוח הלוך') ? 'כבר קיים חיוב משלוח הלוך פעיל בהזמנה זו' : `הוספת חיוב משלוח הלוך בסך ₪${deliveryPrice}`}
              >
                <svg className="icon"><use href="#i-box" /></svg>הוסף חיוב משלוח הלוך
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={hasActiveObligationWithDescription('משלוח חזור')}
                onClick={() => addDeliveryObligation('משלוח חזור')}
                title={hasActiveObligationWithDescription('משלוח חזור') ? 'כבר קיים חיוב משלוח חזור פעיל בהזמנה זו' : `הוספת חיוב משלוח חזור בסך ₪${deliveryPrice}`}
              >
                <svg className="icon"><use href="#i-box" /></svg>הוסף חיוב משלוח חזור
              </button>
            </>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddChargeModal(true)}>
            <svg className="icon"><use href="#i-plus" /></svg>הוסף חיוב
          </button>
        </div>
        {activeObligations.length > 0 ? (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr><th>תיאור</th><th>תאריך</th><th>סכום</th><th style={{ width: '80px' }}></th></tr>
                </thead>
                <tbody>
                  {sortedObligations.map((obs, idx) => {
                    const descText = (obs.productName || obs.description || '').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '').trim() || (obs.isManual ? 'חיוב ידני' : 'חיוב מחירון');
                    // חיוב שלילי הוא זיכוי/ביטול — הסימן וכיוון ה-LTR נדרשים במפורש, אחרת אלגוריתם
                    // הכיווניות של הדפדפן מציג "₪-45" הפוך בתוך הקשר RTL
                    const isCredit = obs.amount < 0;
                    const creditInfo = getCancellationCreditInfo(obs);
                    const iconId = getObligationIcon(obs);
                    return (
                      <tr key={idx}>
                        <td className="cell-primary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <svg className="icon" style={{ width: '14px', height: '14px', color: 'var(--text-3)' }}><use href={`#${iconId}`} /></svg>
                            {descText}
                          </div>
                          {creditInfo && <CancellationCreditBadge deadline={creditInfo.deadline} amount={creditInfo.remaining} />}
                        </td>
                        <td className="cell-muted">{fmtDate(obs.createdAt)}</td>
                        <td style={{ fontWeight: 700, color: isCredit ? 'var(--success)' : 'var(--danger)', direction: 'ltr', textAlign: 'left' }}>
                          {isCredit ? `-₪${Math.abs(obs.amount)}` : `₪${obs.amount}`}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="פרטים נוספים" onClick={() => setSelectedObligationDetails(obs)}>
                              <svg className="icon"><use href="#i-info" /></svg>
                            </button>
                            {obs.isManual !== false && (
                              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="מחק" onClick={() => removeObligation(obligations.indexOf(obs))}>
                                <svg className="icon"><use href="#i-trash" /></svg>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <div className="empty-state">
                <svg className="icon"><use href="#i-receipt" /></svg>
                <h4>אין חיובים מתועדים</h4>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== תשלומים ===== */}
      <div style={{ marginBottom: '22px' }}>
        <div className="toolbar">
          <h3 style={{ fontSize: '15px', color: 'var(--success)' }}>תשלומים</h3>
          <span className="spacer" />
          {settings.nedarim_plus_enabled !== 'false' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreditModal} title="תשלום בכרטיס אשראי (נדרים פלוס)">
              <svg className="icon"><use href="#i-card" /></svg>תשלום בכרטיס אשראי (נדרים פלוס)
            </button>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleOpenRefundModal} title="בקשת זיכוי ללקוח">
            <svg className="icon"><use href="#i-refresh" /></svg>בקשת זיכוי ללקוח
          </button>
        </div>
        {activePayments.length > 0 ? (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr><th>אופן</th><th>תאריך</th><th>סכום</th><th style={{ width: '80px' }}></th></tr>
                </thead>
                <tbody>
                  {sortedPayments.map((p, idx) => {
                    // תשלום שלילי הוא זיכוי/החזר שנרשם כתנועה שלילית — אותו טיפול סימן/כיווניות
                    // כמו בטבלת החיובים, כדי שלא יוצג "₪-45" (סימן במקום הלא נכון) בהקשר RTL
                    const isCreditPayment = p.amount < 0;
                    return (
                      <tr key={idx}>
                        <td className="cell-primary">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <svg className="icon" style={{ width: '14px', height: '14px', color: 'var(--text-3)' }}><use href="#i-coin" /></svg>
                            {p.paymentMethod || '-'}
                          </div>
                        </td>
                        <td className="cell-muted">{fmtDate(p.paymentDate)}</td>
                        <td style={{ fontWeight: 700, color: isCreditPayment ? 'var(--info)' : 'var(--success)', direction: 'ltr', textAlign: 'left' }}>
                          {isCreditPayment ? `-₪${Math.abs(p.amount)}` : `₪${p.amount}`}
                        </td>
                        <td>
                          <div className="row-actions">
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="פרטים נוספים" onClick={() => setSelectedPaymentDetails(p)}>
                              <svg className="icon"><use href="#i-info" /></svg>
                            </button>
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="מחק" onClick={() => removePayment(payments.indexOf(p))}>
                              <svg className="icon"><use href="#i-trash" /></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <div className="empty-state">
                <svg className="icon"><use href="#i-coin" /></svg>
                <h4>לא בוצעו תשלומים</h4>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== זיכויים ממתינים ===== */}
      <div>
        <div className="toolbar">
          <h3 style={{ fontSize: '15px', color: 'var(--info)' }}>זיכויים ממתינים</h3>
        </div>
        {pendingRefunds.length > 0 ? (
          <div className="table-wrap">
            <div className="table-scroll">
              <table className="data">
                <thead>
                  <tr><th>פרטים / סיבה</th><th>תאריך בקשה</th><th>סכום</th><th style={{ width: '110px' }}></th></tr>
                </thead>
                <tbody>
                  {pendingRefunds.map((r, idx) => (
                    <tr key={idx}>
                      <td className="cell-primary">{r.reason || 'ללא סיבה'}</td>
                      <td className="cell-muted">{fmtDate(r.createdAt)}</td>
                      <td style={{ fontWeight: 700, color: 'var(--info)', direction: 'ltr', textAlign: 'left' }}>₪{r.amount}</td>
                      <td>
                        <button type="button" className="btn btn-primary btn-sm" disabled={isProcessing} onClick={() => approveRefund(r.id)}>
                          {isProcessing ? <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} /> : 'אשר ביצוע'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <div className="table-scroll">
              <div className="empty-state">
                <svg className="icon"><use href="#i-refresh" /></svg>
                <h4>אין זיכויים ממתינים</h4>
                <p>בקשות זיכוי שנוצרו יופיעו כאן וימתינו לאישור ביצוע.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ===== מודל העברה מהירה (קורא מגנטי) ===== */}
      {mounted && showQuickSwipeModal && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal confirm-modal" style={{ margin: 0 }}>
            <div className="modal-icon-circle" style={{ background: 'var(--warning-tint)', color: 'var(--warning)' }}>
              <svg className="icon"><use href="#i-tag" /></svg>
            </div>
            <h3>העברת כרטיס מהירה</h3>
            <p>אנא העבר כעת את כרטיס האשראי בקורא המגנטי...</p>
            <input
              autoFocus
              type="text"
              value={swipeInput}
              onChange={handleSwipeInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              onBlur={(e) => { if (showQuickSwipeModal) setTimeout(() => e.target?.focus(), 100); }}
              style={{ opacity: 0, position: 'absolute', top: '-1000px' }}
            />
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowQuickSwipeModal(false)}>ביטול חלון מהיר</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל סליקת אשראי (נדרים פלוס) ===== */}
      {mounted && showCreditModal && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ margin: 0 }}>
            <div className="modal-head">
              <strong>תשלום בכרטיס אשראי (נדרים פלוס)</strong>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button type="button" className="btn btn-secondary btn-sm" title="העברת כרטיס מהירה בקורא מגנטי"
                  onClick={(e) => { e.preventDefault(); setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}>
                  <svg className="icon"><use href="#i-activity" /></svg>העברה מהירה
                </button>
                <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setShowCreditModal(false)}>
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </div>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>שם לקוח</label>
                <input type="text" className="input" readOnly value={`${customer?.firstName || ''} ${customer?.lastName || ''}`} style={{ background: 'var(--surface-alt)' }} />
              </div>

              <div className="field">
                <label>סכום לחיוב (₪)</label>
                <input type="number" className="input" value={creditCardData.amount}
                  onChange={e => setCreditCardData({ ...creditCardData, amount: e.target.value })}
                  style={{ fontWeight: 700 }} />
              </div>

              <div className="field">
                <label>מספר כרטיס אשראי</label>
                <input type="text" className="input" value={creditCardData.cardNumber} onChange={handleCardNumberChange}
                  placeholder="0000 0000 0000 0000" maxLength={19}
                  style={{ direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} />
              </div>

              <div className="form-grid">
                <div className="field">
                  <label>תוקף (MM/YY)</label>
                  <input type="text" className="input" value={creditCardData.tokef} onChange={handleTokefChange}
                    placeholder="12/28" maxLength={5} style={{ direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} />
                </div>
                <div className="field">
                  <label>תשלומים</label>
                  <input type="number" className="input" min={1} max={36} value={creditCardData.installments}
                    onChange={e => setCreditCardData({ ...creditCardData, installments: e.target.value })} />
                </div>
              </div>

              <div className="field" style={{ marginBottom: creditError ? '14px' : 0 }}>
                <label>הערות</label>
                <input type="text" className="input" value={creditCardData.notes}
                  onChange={e => setCreditCardData({ ...creditCardData, notes: e.target.value })}
                  placeholder="הערות לחיוב" />
              </div>

              {creditError && (
                <div className="callout callout-danger">
                  <svg className="icon"><use href="#i-alert-tri" /></svg>
                  <span>{creditError}</span>
                </div>
              )}
            </div>
            <div className="modal-foot">
              <button
                type="button"
                className="btn btn-ghost btn-icon-only"
                title="מעקף מתכנת: רישום ידני כאילו שולם, ללא חיוב אשראי בפועל (מוגבל למתכנת)"
                disabled={isProcessing}
                onClick={handleBypassCreditPayment}
                style={{ color: 'var(--warning)', marginInlineEnd: 'auto' }}
              >
                <svg className="icon"><use href="#i-arrow-end" /></svg>
              </button>
              <button type="button" className="btn btn-secondary" disabled={isProcessing} onClick={() => setShowCreditModal(false)}>ביטול</button>
              <button type="button" className="btn btn-primary" disabled={isProcessing} onClick={handleProcessCreditCard}>
                {isProcessing ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> מעבד...</> : 'בצע חיוב'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל הוספת חיוב ידני ===== */}
      {mounted && showAddChargeModal && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setShowAddChargeModal(false); }}>
          <div className="modal" style={{ margin: 0 }}>
            <div className="modal-head">
              <strong>הוספת חיוב ידני</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setShowAddChargeModal(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>תיאור החיוב</label>
                <input type="text" className="input" placeholder="לדוגמא: שמלה נוספת" value={newObligation.description}
                  onChange={e => setNewObligation({ ...newObligation, description: e.target.value })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>סכום (₪)</label>
                <input type="number" className="input" placeholder="0" value={newObligation.amount}
                  onChange={e => setNewObligation({ ...newObligation, amount: e.target.value })}
                  style={{ fontWeight: 700 }} />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddChargeModal(false)}>ביטול</button>
              <button type="button" className="btn btn-primary" disabled={!newObligation.description || !newObligation.amount} onClick={addObligation}>שמור חיוב</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל פרטי תשלום ===== */}
      {mounted && selectedPaymentDetails && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedPaymentDetails(null); }}>
          <div className="modal" style={{ margin: 0, maxWidth: '620px', width: '95%' }}>
            <div className="modal-head">
              <strong>פרטי תשלום מלאים</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setSelectedPaymentDetails(null)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>אופן תשלום</label>
                  <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{selectedPaymentDetails.paymentMethod || '-'}</div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>סכום</label>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: selectedPaymentDetails.amount < 0 ? 'var(--info)' : 'var(--success)', direction: 'ltr', textAlign: 'right' }}>
                    {selectedPaymentDetails.amount < 0 ? `-₪${Math.abs(selectedPaymentDetails.amount)}` : `₪${selectedPaymentDetails.amount}`}
                  </div>
                </div>
              </div>
              <div className="field">
                <label>תאריך</label>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {getHebrewDateString(selectedPaymentDetails.paymentDate)}, {new Date(selectedPaymentDetails.paymentDate).toLocaleTimeString('he-IL')}
                </div>
              </div>

              <span className="hint" style={{ color: 'var(--text-2)', fontWeight: 700 }}>הערות ופירוט (נדרים פלוס / אחר)</span>
              <div className="card" style={{ marginTop: '8px', padding: '12px 14px', maxHeight: '280px', overflowY: 'auto' }}>
                {(() => {
                  const notes = selectedPaymentDetails.notes;
                  if (!notes) return <span className="hint" style={{ color: 'var(--text-3)' }}>אין הערות</span>;
                  try {
                    if (typeof notes === 'string' && notes.trim().startsWith('{')) {
                      const parsed = JSON.parse(notes);
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {Object.entries(parsed).map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingBottom: '6px', gap: '8px' }}>
                              <strong style={{ width: '140px', flexShrink: 0, fontSize: '0.88rem', color: 'var(--text-3)' }}>{k}:</strong>
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
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedPaymentDetails(null)}>סגור</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל פרטי חיוב ===== */}
      {mounted && selectedObligationDetails && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedObligationDetails(null); }}>
          <div className="modal" style={{ margin: 0, maxWidth: '620px', width: '95%' }}>
            <div className="modal-head">
              <strong>פרטי חיוב</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setSelectedObligationDetails(null)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>סוג חיוב</label>
                  <div style={{ fontWeight: 700, fontSize: '13.5px' }}>
                    {selectedObligationDetails.isManual === false
                      ? (selectedObligationDetails.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב אוטומטי')
                      : (selectedObligationDetails.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'חיוב ידני')}
                  </div>
                </div>
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>סכום</label>
                  <div style={{ fontWeight: 700, fontSize: '13.5px', color: selectedObligationDetails.amount < 0 ? 'var(--success)' : 'var(--danger)', direction: 'ltr', textAlign: 'right' }}>
                    {selectedObligationDetails.amount < 0 ? `-₪${Math.abs(selectedObligationDetails.amount)}` : `₪${selectedObligationDetails.amount}`}
                  </div>
                </div>
              </div>
              <div className="field">
                <label>תאריך</label>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {getHebrewDateString(selectedObligationDetails.createdAt || new Date())}, {new Date(selectedObligationDetails.createdAt || new Date()).toLocaleTimeString('he-IL')}
                </div>
              </div>

              <span className="hint" style={{ color: 'var(--text-2)', fontWeight: 700 }}>תיאור מפורט</span>
              <div className="card" style={{ marginTop: '8px', padding: '14px 16px', fontSize: '13px', lineHeight: 1.7 }}>
                <div><strong>פירוט:</strong> {selectedObligationDetails.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || 'ללא תיאור'}</div>
                {selectedObligationDetails.priceCategory && (
                  <div style={{ marginTop: '8px' }}><strong>קטגוריה (מחירון):</strong> {selectedObligationDetails.priceCategory}</div>
                )}
                {selectedObligationDetails.priceDescription && (
                  <div style={{ marginTop: '8px' }}><strong>תיאור (מחירון):</strong> {selectedObligationDetails.priceDescription}</div>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedObligationDetails(null)}>סגור</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ===== מודל בקשת זיכוי ===== */}
      {mounted && showRefundModal && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={(e) => { if (e.target === e.currentTarget) setShowRefundModal(false); }}>
          <div className="modal" style={{ margin: 0, maxWidth: '620px', width: '95%' }}>
            <div className="modal-head">
              <strong>יצירת בקשת זיכוי</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setShowRefundModal(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>סכום לזיכוי (₪) *</label>
                <input type="number" className="input" value={refundData.amount} onChange={e => setRefundData({ ...refundData, amount: e.target.value })} style={{ fontWeight: 700 }} />
              </div>

              <div className="field">
                <label>סיבה לזיכוי / הערות</label>
                <input type="text" className="input" value={refundData.reason} onChange={e => setRefundData({ ...refundData, reason: e.target.value })} />
              </div>

              <span className="hint" style={{ display: 'block', fontSize: '13px', color: 'var(--text)', fontWeight: 700, marginBottom: '8px' }}>פרטי בנק לזיכוי</span>
              <div className="form-grid">
                <div className="field"><label>בנק</label><input type="text" className="input" value={refundData.bankName} onChange={e => setRefundData({ ...refundData, bankName: e.target.value })} /></div>
                <div className="field"><label>סניף</label><input type="text" className="input" value={refundData.bankBranch} onChange={e => setRefundData({ ...refundData, bankBranch: e.target.value })} /></div>
              </div>
              <div className="form-grid">
                <div className="field"><label>מספר חשבון</label><input type="text" className="input" value={refundData.bankAccount} onChange={e => setRefundData({ ...refundData, bankAccount: e.target.value })} /></div>
                <div className="field"><label>שם בעל החשבון</label><input type="text" className="input" value={refundData.bankAccountName} onChange={e => setRefundData({ ...refundData, bankAccountName: e.target.value })} /></div>
              </div>

              <div className="field">
                <label>אמצעי תשלום לזיכוי (נלקח אוטומטית מתשלום אחרון)</label>
                <input type="text" className="input" readOnly value={refundData.paymentDetails} style={{ background: 'var(--surface-alt)' }} title="שדה זה מתמלא אוטומטית מהתשלום האחרון במערכת" />
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>מייל לקוח (לשליחת אישור זיכוי)</label>
                <input type="email" className="input" value={refundData.email} onChange={e => setRefundData({ ...refundData, email: e.target.value })} style={{ direction: 'ltr' }} />
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowRefundModal(false)}>ביטול</button>
              <button type="button" className="btn btn-primary" disabled={isProcessing} onClick={submitRefund}>
                {isProcessing ? <><span className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} /> מעבד...</> : 'צור בקשת זיכוי'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
});

export default ModernPaymentsManager;
