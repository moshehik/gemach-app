'use client';

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { verifyPin } from './mocAuth';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { V3Page, Card, Btn, IconBtn, Chip, Field, Row, Rows, Tip, Dialog, Empty, Banner, Icon } from '../../../app/v3/ui/components';

/** סכום עם סימן: שלילי = "-₪X" (תמיד בתוך <bdi> בתצוגה, כדי שהסימן לא יתהפך ב-RTL). */
const fmtMoney = (n) => (n < 0 ? `-₪${Math.abs(n)}` : `₪${n}`);

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
    <div className="v3-cluster">
      <Chip variant={countdown.urgent ? 'attn' : 'gold'} icon="clock">
        זיכוי <bdi>₪{amount}</bdi> על פריט חדש · עוד <bdi>{countdown.text}</bdi>
      </Chip>
      <Tip>אפשר לנצל את הסכום כזיכוי אוטומטי אם יתווסף להזמנה פריט חלופי, עד שהזמן שהוגדר נגמר.</Tip>
    </div>
  );
}

/** אריח בטאב תשלומים שמסכם זיכוי ביטול זמין לניצול, אם יש כזה כרגע בהזמנה. */
function CreditWindowTile({ deadline, amount }) {
  const countdown = useCountdown(deadline);
  if (!countdown) return null;
  return (
    <div className={`v3-note ${countdown.urgent ? 'v3-note--attn' : ''}`} role="status">
      <Icon name="clock" size="lg" />
      <div className="v3-stack">
        <b className="v3-h2">
          זיכוי ביטול לניצול <Tip>סכום שאפשר לנצל כזיכוי אוטומטי אם יתווסף להזמנה פריט חלופי, עד שהזמן נגמר.</Tip>
        </b>
        <span className="v3-big"><bdi>₪{amount}</bdi></span>
        <span className="v3-text-sm">נשארו <bdi>{countdown.text}</bdi></span>
      </div>
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
const ModernPaymentsManager = forwardRef(function ModernPaymentsManager({ orderId, items = [], order = {}, obligations = [], payments = [], refunds = [], onObligationsChange, onPaymentsChange, onRefundsChange, totalRequired, totalPaid, customer = {}, onOrderUpdated, onSignRegulations, isLivePreviewing = false }, ref) {
  const [newObligation, setNewObligation] = useState({ description: '', amount: '' });

  const [showCreditModal, setShowCreditModal] = useState(false);
  // חתימה על התקנון נבדקה עד כה רק לפני הדפסה/מייל (ר' OrderPrintMenu) - הלקוח לא תמיד
  // מדפיס, כך שהחתימה הייתה עלולה להידלג לגמרי. נשאלת כאן גם לפני תשלום בפועל, כדי
  // שהיא תישאל בוודאות בשלב כלשהו של סגירת ההזמנה.
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [confirmingSigned, setConfirmingSigned] = useState(false);
  const [showQuickSwipeModal, setShowQuickSwipeModal] = useState(false);
  const [swipeInput, setSwipeInput] = useState('');
  const [showAddChargeModal, setShowAddChargeModal] = useState(false);
  const [showRefundModal, setShowRefundModal] = useState(false);
  // "תשלום נוסף" (למשל מזומן) על הזמנה קיימת שכבר יש לה היסטוריית תשלומים - מאחורי הגדרת
  // allow_additional_payment_on_order (כבוי כברירת מחדל, מופעל רק בנווה יעקב). לא כרוך
  // בחישוב חיוב/חוב חדש - רק רישום Payment נוסף על היתרה הקיימת, דרך אותו POST /api/payments
  // ששמור כבר עובד עבור חיוב אשראי מיידי למעלה.
  const [showAdditionalPaymentModal, setShowAdditionalPaymentModal] = useState(false);
  const [additionalPaymentData, setAdditionalPaymentData] = useState({ amount: '', paymentMethod: 'מזומן', notes: '' });
  const [additionalPaymentError, setAdditionalPaymentError] = useState('');
  const [refundData, setRefundData] = useState({
    amount: '', reason: '', bankName: '', bankBranch: '', bankAccount: '', bankAccountName: '', paymentDetails: '', email: ''
  });
  // חלון פרטי בנק עבור זיכוי שנוצר אוטומטית (syncPendingCreditRefund בצד השרת, למשל
  // כשמבטלים פריט ונוצרת יתרת זכות) - בניגוד ל-refundData/showRefundModal למעלה, זה לא
  // יוצר בקשת זיכוי חדשה אלא רק משלים פרטי בנק לזיכוי שכבר קיים (PUT, לא POST).
  const [showAutoRefundBankModal, setShowAutoRefundBankModal] = useState(false);
  const [autoRefundTarget, setAutoRefundTarget] = useState(null);
  const [autoRefundBankData, setAutoRefundBankData] = useState({ bankName: '', bankBranch: '', bankAccount: '', bankAccountName: '' });
  const [isSavingAutoRefundBank, setIsSavingAutoRefundBank] = useState(false);
  const [creditCardData, setCreditCardData] = useState({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: '' });
  const creditAmountRef = useRef(null);
  const creditCardNumberRef = useRef(null);
  const creditTokefRef = useRef(null);
  const creditInstallmentsRef = useRef(null);
  const creditNotesRef = useRef(null);
  /** Enter עובר לשדה הבא בטופס האשראי (לא שולח את הטופס באמצע מילוי) - ר' nextRef. */
  const focusNextOnEnter = (e, nextRef) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    nextRef?.current?.focus();
  };
  const [isProcessing, setIsProcessing] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [settings, setSettings] = useState({});
  // עד שההגדרות נטענו לא מציגים תג/אריח זיכוי בכלל - אחרת ברירת המחדל (כשהגדרה חסרה) הייתה
  // מהבהבת לרגע גם בגמח שכיבה את הזיכוי.
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [selectedPaymentDetails, setSelectedPaymentDetails] = useState(null);
  const [selectedObligationDetails, setSelectedObligationDetails] = useState(null);
  const [mounted, setMounted] = useState(false);
  // חלוניות v3 במקום window.customConfirm / alert (אותה זרימת await): confirmState מחזיק את ה-resolve של ההבטחה.
  const [confirmState, setConfirmState] = useState(null);
  const askConfirm = (opts) => new Promise(resolve => setConfirmState({ ...opts, resolve }));
  const settleConfirm = (answer) => {
    const current = confirmState;
    setConfirmState(null);
    current?.resolve(answer);
  };
  const [messageState, setMessageState] = useState(null);
  const showMessage = (text, kind = 'info') => setMessageState({ text, kind });
  const [isRecalculating, setIsRecalculating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (Array.isArray(data)) {
          setSettings(data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
          setSettingsLoaded(true);
        } else if (data && !data.error) {
          setSettings(data);
          setSettingsLoaded(true);
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
    if (!(await askConfirm({ title: 'מחיקת חיוב', sub: 'החיוב יימחק מההזמנה כשתשמרו אותה.', icon: 'trash', confirmLabel: 'מחיקה' }))) return;
    const updated = [...obligations];
    if (updated[idx].id) updated[idx].isDeleted = true;
    else updated.splice(idx, 1);
    onObligationsChange(updated);
  };

  const removePayment = async (idx) => {
    if (!(await askConfirm({ title: 'מחיקת תשלום', sub: 'התשלום יימחק מההזמנה כשתשמרו אותה.', icon: 'trash', confirmLabel: 'מחיקה' }))) return;
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
      showMessage('הזינו סכום זיכוי גדול מאפס.', 'warn');
      return;
    }
    if (!refundData.bankName?.trim() || !refundData.bankBranch?.trim()) {
      showMessage('חובה למלא בנק וסניף כדי לפתוח זיכוי.', 'warn');
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

      showMessage('בקשת הזיכוי נפתחה. אפשר לעקוב אחריה כאן, ברשימת הזיכויים הממתינים, או במסך הזיכויים.', 'success');
      setShowRefundModal(false);

      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) onOrderUpdated(await orderRes.json());
      }
    } catch (err) {
      showMessage(err.message || 'לא הצלחנו לפתוח את הזיכוי.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpenAdditionalPaymentModal = () => {
    setAdditionalPaymentData({ amount: '', paymentMethod: additionalPaymentMethodOptions[0] || 'מזומן', notes: '' });
    setAdditionalPaymentError('');
    setShowAdditionalPaymentModal(true);
  };

  /** רישום תשלום נוסף (למשל מזומן) על הזמנה קיימת - לא קשור לחישוב חיוב/חוב מחדש, רק
   * Payment חדש דרך אותו נתיב POST /api/payments שכבר משמש לשמירת חיוב אשראי מיידי
   * למעלה בקובץ. נשמר ישירות בשרת (לא רק ב-state המקומי) כי כסף אמיתי כבר עבר ידיים -
   * אותו טיעון כמו handleProcessCreditCard. */
  const submitAdditionalPayment = async () => {
    const amount = parseFloat(additionalPaymentData.amount);
    if (!amount || amount <= 0) {
      setAdditionalPaymentError('הזינו סכום תשלום גדול מאפס.');
      return;
    }
    setIsProcessing(true);
    setAdditionalPaymentError('');
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId,
          amount,
          paymentMethod: additionalPaymentData.paymentMethod || 'מזומן',
          notes: additionalPaymentData.notes || ''
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'לא הצלחנו לשמור את התשלום.');
      onPaymentsChange([...payments, data]);
      setShowAdditionalPaymentModal(false);
    } catch (err) {
      setAdditionalPaymentError(err.message || 'לא הצלחנו לשמור את התשלום.');
    } finally {
      setIsProcessing(false);
    }
  };

  const approveRefund = async (refundId) => {
    if (!(await askConfirm({ title: 'אישור ביצוע הזיכוי', sub: 'האישור יוצר בהזמנה תשלום הפוך, ולא ניתן לבטל אותו כאן.', icon: 'check-circle', confirmLabel: 'אישור הזיכוי' }))) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/refunds/${refundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true })
      });
      if (!res.ok) throw new Error('Failed to approve refund');
      showMessage('הזיכוי אושר ונרשם בהזמנה.', 'success');

      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) onOrderUpdated(await orderRes.json());
      } else if (onRefundsChange) {
        onRefundsChange(refunds.filter(r => r.id !== refundId));
      }
    } catch (err) {
      showMessage(err.message || 'לא הצלחנו לאשר את הזיכוי.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  /** מחשב מחדש את חיובי ההזמנה הזו בלבד (משתמש באותה לוגיקה כמו רשימת חישוב מחדש
   * באדמין - /api/admin/recalculations - רק לפריט בודד, ישירות מטאב התשלומים). */
  const handleRecalculate = async () => {
    if (!(await askConfirm({ title: 'חישוב מחדש', sub: 'חיובי ההזמנה יחושבו שוב לפי הכללים העדכניים. סכומים קיימים עשויים להשתנות.', icon: 'refresh', confirmLabel: 'חשבו מחדש' }))) return;
    setIsRecalculating(true);
    try {
      const res = await fetch('/api/admin/recalculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [orderId] })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'החישוב מחדש נכשל.');
      if (data.errors?.length) throw new Error(data.errors[0].error || 'החישוב מחדש נכשל.');

      if (onOrderUpdated) {
        const orderRes = await fetch(`/api/orders/${orderId}`);
        if (orderRes.ok) onOrderUpdated(await orderRes.json());
      }
      showMessage('החיובים חושבו מחדש.', 'success');
    } catch (err) {
      showMessage(err.message || 'החישוב מחדש נכשל.', 'error');
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

  const openCreditModalNow = () => {
    setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: '', amount: Math.max(0, totalRequired - totalPaid).toString() });
    setCreditError('');
    setShowCreditModal(true);
  };

  const handleOpenCreditModal = () => {
    // מוגן גם כאן (לא רק בהסתרת הכפתור למטה) - נקודת הכניסה השנייה לחלון הזה היא
    // אייקון החוב בטופ-בר (handleWalletClick ב-app/orders/[id]/page.js) שקורא ל-
    // openCreditModal() החשוף דרך ref בלי לדעת את ההגדרות בכלל; בלי השמירה כאן, גמ"ח
    // שכיבה את נדרים פלוס עדיין רואה את חלון החיוב באשראי נפתח מהאייקון (והיה נכשל
    // רק בשליחה, מול השרת ב-app/api/nedarim/route.js).
    if (settings.nedarim_plus_enabled === 'false') return;
    if (!order.hasSignedRegulations) {
      setShowRegulationsModal(true);
      return;
    }
    openCreditModalNow();
  };

  const confirmSignedThenOpenCredit = async () => {
    setConfirmingSigned(true);
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasSignedRegulations: true })
      });
      if (res.ok) {
        onSignRegulations?.();
        setShowRegulationsModal(false);
        openCreditModalNow();
      } else {
        showMessage('לא הצלחנו לשמור את אישור החתימה.', 'error');
      }
    } catch (e) {
      showMessage('אין תקשורת עם השרת, אישור החתימה לא נשמר.', 'error');
    } finally {
      setConfirmingSigned(false);
    }
  };

  /** פותח את חלון "פרטי בנק לזיכוי" עבור זיכוי קיים (ידני - כפתור בשורת הטבלה, או
   * אוטומטי - ר' openPendingAutoRefundBankModal למטה) - תמיד ממלא-מראש מהזיכוי עצמו אם
   * כבר יש בו משהו, אחרת מפרטי הבנק השמורים בכרטיס הלקוח (בדיוק כמו handleOpenRefundModal
   * למעלה, רק שכאן משלימים זיכוי קיים ולא יוצרים חדש). */
  const openAutoRefundBankModal = (refund) => {
    setAutoRefundTarget(refund.id);
    setAutoRefundBankData({
      bankName: refund.bankName || customer?.bankName || '',
      bankBranch: refund.bankBranch || customer?.bankBranch || '',
      bankAccount: refund.bankAccount || customer?.bankAccount || '',
      bankAccountName: refund.bankAccountName || customer?.bankAccountName || ''
    });
    setShowAutoRefundBankModal(true);
  };

  const submitAutoRefundBank = async () => {
    if (!autoRefundBankData.bankName?.trim() || !autoRefundBankData.bankBranch?.trim()) {
      showMessage('חובה למלא בנק וסניף כדי לפתוח זיכוי.', 'warn');
      return;
    }
    setIsSavingAutoRefundBank(true);
    try {
      const res = await fetch(`/api/refunds/${autoRefundTarget}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoRefundBankData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'לא הצלחנו לשמור את פרטי הבנק.');
      if (onRefundsChange) {
        onRefundsChange(refunds.map(r => (r.id === autoRefundTarget ? { ...r, ...autoRefundBankData } : r)));
      }
      setShowAutoRefundBankModal(false);
    } catch (err) {
      showMessage(err.message || 'לא הצלחנו לשמור את פרטי הבנק.', 'error');
    } finally {
      setIsSavingAutoRefundBank(false);
    }
  };

  // handleOpenCreditModal/openAutoRefundBankModal חייבים להיות מוגדרים לפני ה-hook הזה (ולא
  // רק לפני שימוש בפועל בזמן ריצה) - ESLint react-hooks/immutability דורש סדר הצהרה תואם
  // סדר שימוש בקוד המקור.
  useImperativeHandle(ref, () => ({
    openCreditModal: () => handleOpenCreditModal(),
    // נקרא מ-app/orders/[id]/page.js מיד אחרי שמירת הזמנה שיצרה/משאירה זיכוי אוטומטי בלי
    // פרטי בנק (דיווח c22b7de5: "אין לי מקום להזין פרטי בנק במיידי, צריך לפתוח מייד עם
    // ביטול השמלה") - מחזיר true אם באמת פתח משהו, כדי שהקורא ידע אם צריך גם להחליף טאב.
    openPendingAutoRefundBankModal: () => {
      const pending = refunds.find(r => !r.isDeleted && !r.isExecuted && r.isAutoGenerated
        && (!r.bankName?.trim() || !r.bankBranch?.trim()));
      if (!pending) return false;
      openAutoRefundBankModal(pending);
      return true;
    },
    // נקראים מ-app/orders/[id]/page.js (handleOpenManualPaymentCredit) - הכפתור המאוחד
    // בטאב "פרטים כלליים" כש-consolidate_manual_payment_credit_ui מופעל (נווה יעקב).
    // אותם חלונות בדיוק כמו הכפתורים הרגילים למטה - האישור (feature:manual_payment_credit_add)
    // כבר קרה לפני שהקורא מגיע לכאן, אין צורך לחזור ולבדוק.
    openAdditionalPaymentModal: () => handleOpenAdditionalPaymentModal(),
    openRefundModal: () => handleOpenRefundModal()
  }));

  /** מעקף אשראי מלא מתוך האתר - רושם תשלום אשראי כאילו שולם, מבלי לפנות למסוף נדרים פלוס בכלל.
   * מוגבל למתכנת בלבד (verifyPin ברמת 'מתכנת'), עבור מצבים כמו תקלת סליקה. */
  const handleBypassCreditPayment = async () => {
    const amount = parseFloat(creditCardData.amount);
    if (!amount || amount <= 0) {
      setCreditError('הזינו סכום לפני המעקף.');
      return;
    }
    const balance = totalRequired - totalPaid;
    if (amount > balance) {
      setCreditError(`אי אפשר לחייב יותר מהיתרה (₪${balance}).`);
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
      setCreditError('יש למלא מספר כרטיס, תוקף וסכום.');
      return;
    }

    const paymentAmount = parseFloat(creditCardData.amount);
    const balance = totalRequired - totalPaid;
    if (paymentAmount > balance) {
      setCreditError(`אי אפשר לחייב יותר מהיתרה (₪${balance}).`);
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
          showMessage(`הכרטיס חויב ב-₪${added.amount}, אבל התשלום לא נשמר בשרת. לחצו עכשיו על "שמור" כדי לרשום אותו בהזמנה. אם גם השמירה נכשלת, תעדו את התשלום ידנית ופנו לתמיכה, כדי שלא יישאר חיוב בלי רישום.`, 'warn');
        }
      } else {
        setCreditError(data.error || 'החיוב נכשל.');
      }
    } catch (err) {
      setCreditError('אין תקשורת עם הסליקה. בדקו אם הכרטיס חויב לפני שמנסים שוב.');
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
  // תמחור לפי עיר (delivery_price_by_city) קודם - אותה עדיפות בדיוק כמו applyDeliveryCharge
  // האוטומטי ב-lib/pricingEngine.js - אחרת הכפתור הידני כאן תמיד חייב לפי delivery_price
  // השטוח בלי קשר לעיר המשלוח שהוגדרה בהזמנה (ר' דיווח "תמיד 50 ש\"ח").
  const deliveryPrice = (() => {
    if (order.deliveryCity) {
      try {
        const cityMap = JSON.parse(settings.delivery_price_by_city || '{}');
        const cityPrice = parseFloat(cityMap[order.deliveryCity]);
        if (!isNaN(cityPrice) && cityPrice > 0) return cityPrice;
      } catch {}
    }
    const parsedDeliveryPrice = parseFloat(settings.delivery_price);
    return isNaN(parsedDeliveryPrice) || parsedDeliveryPrice <= 0 ? 50 : parsedDeliveryPrice;
  })();

  // ה-obligation האוטומטי של משלוח (applyDeliveryCharge, lib/pricingEngine.js) נשמר
  // בתור "משלוח <כיוון> - <עיר>", לא בדיוק "משלוח הלוך"/"משלוח חזור" - השוואת שוויון
  // מדויקת לא זיהתה חיוב אוטומטי קיים, ואפשרה להוסיף גם חיוב ידני זהה על גביו (חיוב
  // כפול), ר' דיווח org2 64260eba. בודקים לפי מילת הכיוון בתוך התיאור במקום שוויון מלא.
  const hasActiveObligationWithDescription = (description) => {
    const direction = description.replace('משלוח ', '');
    return obligations.some(o => !o.isDeleted && o.description?.includes('משלוח') && o.description?.includes(direction));
  };

  // אופציות "אופן תשלום" לתשלום נוסף ידני - מבוסס על אותה הגדרת ALLOWED_PAYMENT_METHODS
  // כמו אשף ההזמנה החדשה (ר' computePaymentMethodOptions ב-app/orders/new/page.js), בלי
  // אשראי - לתשלום בכרטיס יש כבר את הכפתור הייעודי (נדרים פלוס) למעלה בטאב הזה.
  const additionalPaymentMethodOptions = (() => {
    const raw = settings.ALLOWED_PAYMENT_METHODS
      ? settings.ALLOWED_PAYMENT_METHODS.split(',').map(s => s.trim()).filter(Boolean)
      : ['מזומן', 'העברה בנקאית', "צ'ק"];
    const withoutCredit = raw.filter(opt => !opt.includes('אשראי'));
    return withoutCredit.length > 0 ? withoutCredit : ['מזומן'];
  })();

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
  // חלון "זיכוי דמי ביטול על פריט חלופי" בדקות - רק CANCELLATION_CREDIT_MINUTES, בלי שום קשר
  // לחלון "ביטול מיידי" (זה נקבע בשרת בלבד). כמו במנוע החישוב: הגדרה חסרה = 15 דקות;
  // הגדרה שקיימת אך 0, ריקה, שלילית או לא מספר = הזיכוי כבוי - אין תג ואין אריח.
  const creditWindowMinutes = (() => {
    if (!settingsLoaded) return null;
    const raw = settings.CANCELLATION_CREDIT_MINUTES;
    const minutes = raw === undefined || raw === null ? 15 : parseFloat(raw);
    return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
  })();

  const getCancellationCreditInfo = (obs) => {
    if (!obs.orderItemId || !obs.description?.startsWith('דמי ביטול')) return null;
    const consumed = activeObligations
      .filter(o => o.orderItemId === obs.orderItemId && o.description?.startsWith('זיכוי דמי ביטול'))
      .reduce((sum, o) => sum + Math.abs(o.amount || 0), 0);
    const remaining = obs.amount - consumed;
    if (remaining <= 0) return null;
    const sourceItem = items.find(i => i.id === obs.orderItemId);
    if (!sourceItem?.deletedAt) return null;
    if (creditWindowMinutes === null) return null;
    const minutes = creditWindowMinutes;
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

  // תצוגה בלבד: אחוז התשלום לפס ההתקדמות (נגזר מאותם totalRequired/totalPaid שההורה מעביר).
  const paidPct = totalRequired > 0 ? Math.min(100, Math.max(0, Math.round(((totalPaid || 0) / totalRequired) * 100))) : 0;
  const statusKind = balance > 0 ? 'debt' : balance < 0 ? 'credit' : 'paid';
  const cleanItemTag = (text) => (text || '').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '');
  const submitRefundOnEnter = (e) => { if (e.key === 'Enter' && !isProcessing) { e.preventDefault(); submitRefund(); } };
  const submitAdditionalOnEnter = (e) => { if (e.key === 'Enter' && !isProcessing) { e.preventDefault(); submitAdditionalPayment(); } };
  const messageMeta = {
    success: { title: 'בוצע', icon: 'check-circle' },
    error: { title: 'משהו השתבש', icon: 'alert-circle' },
    warn: { title: 'שימו לב', icon: 'alert-tri' },
    info: { title: 'הודעה', icon: 'info' }
  }[messageState?.kind || 'info'];

  return (
    <V3Page page={false} sprite={false} className="v3-panel">
      {/* ===== זיכוי ביטול לניצול (ספירה לאחור) ===== */}
      {nearestCreditWindow && <CreditWindowTile deadline={nearestCreditWindow.deadline} amount={nearestCreditWindow.amount} />}

      {/* ===== מצב תשלום ===== */}
      <Card icon="wallet" title="מצב תשלום">
        <div className="v3-balance">
          <div className={`v3-status v3-status--${statusKind}`}>
            <Icon name={statusKind === 'debt' ? 'alert-tri' : statusKind === 'credit' ? 'coin' : 'check-circle'} size="lg" />
            <div>
              <small>{statusKind === 'credit' ? 'יתרת זכות ללקוח' : statusKind === 'paid' ? 'ההזמנה שולמה במלואה' : 'נשאר לתשלום'}</small>
              <div className="v3-status__n"><bdi>₪{Math.abs(balance).toLocaleString('he-IL')}</bdi></div>
            </div>
          </div>
          {isLivePreviewing && (
            <div className="v3-cluster v3-faint v3-text-sm" role="status">
              <span className="v3-spin" aria-hidden="true" />
              מעדכנים את החישוב ברקע
              <Tip>הסכומים מתעדכנים לפי שינויים שעדיין לא נשמרו בהזמנה.</Tip>
            </div>
          )}
          <div>
            <div className="v3-cluster v3-text-sm v3-muted">
              <span>שולם <bdi>₪{(totalPaid || 0).toLocaleString('he-IL')}</bdi></span>
              <span aria-hidden="true">·</span>
              <span>מתוך <bdi>₪{(totalRequired || 0).toLocaleString('he-IL')}</bdi></span>
            </div>
            <div className="v3-progress" role="progressbar" aria-label="התקדמות התשלום" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPct}>
              <i style={{ width: `${paidPct}%` }} />
            </div>
          </div>
          <Rows>
            <Row label="סה״כ לתשלום" icon="receipt"><bdi>₪{(totalRequired || 0).toLocaleString('he-IL')}</bdi></Row>
            <Row label="שולם עד כה" icon="coin"><bdi>₪{(totalPaid || 0).toLocaleString('he-IL')}</bdi></Row>
          </Rows>
          {settings.nedarim_plus_enabled !== 'false' && (
            <div className="v3-cluster">
              <Btn variant={balance > 0 ? 'primary' : 'secondary'} size="lg" icon="card" onClick={handleOpenCreditModal}>
                {balance > 0 ? <>תשלום באשראי <bdi>₪{balance.toLocaleString('he-IL')}</bdi></> : 'תשלום באשראי'}
              </Btn>
              <Tip>החיוב נשלח מיד לנדרים פלוס ונשמר בהזמנה, בלי לחכות ללחיצה על שמירה.</Tip>
            </div>
          )}
        </div>
      </Card>

      {/* ===== חיובים ===== */}
      <Card icon="receipt" title="חיובים" tip="חיובי מחירון, כולל ביטולים והחלפות, מתעדכנים לבד. אין צורך להוסיף אותם ידנית.">
        {activeObligations.length > 0 ? (
          <div className="v3-list">
            {sortedObligations.map((obs, idx) => {
              const descText = cleanItemTag(obs.productName || obs.description || '').trim() || (obs.isManual ? 'חיוב ידני' : 'חיוב מחירון');
              // חיוב שלילי הוא זיכוי/ביטול - הסימן בתוך <bdi> כדי שלא יוצג הפוך בהקשר RTL
              const isCredit = obs.amount < 0;
              const creditInfo = getCancellationCreditInfo(obs);
              const iconId = getObligationIcon(obs);
              const isPending = obs.isNew || obs.isPreview;
              return (
                <div key={idx} className={`v3-li ${isPending ? 'v3-li--pending' : ''}`}>
                  <div className="v3-li__ic"><Icon name={iconId} /></div>
                  <div className="v3-li__body">
                    <span className="v3-li__title">{descText}</span>
                    <span className="v3-li__sub"><bdi>{fmtDate(obs.createdAt)}</bdi>{isPending && ' · ממתין לשמירה'}</span>
                    <div className={`v3-li__amt ${isCredit ? 'v3-li__amt--credit' : ''}`}><bdi>{fmtMoney(obs.amount)}</bdi></div>
                    {creditInfo && <CancellationCreditBadge deadline={creditInfo.deadline} amount={creditInfo.remaining} />}
                  </div>
                  <div className="v3-cluster">
                    <IconBtn variant="quiet" size="sm" icon="info" label="פרטי החיוב" onClick={() => setSelectedObligationDetails(obs)} />
                    {obs.isManual !== false && (
                      <IconBtn variant="quiet" size="sm" icon="trash" label="מחיקת החיוב" onClick={() => removeObligation(obligations.indexOf(obs))} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="receipt" title="אין חיובים בהזמנה" />
        )}
        {enableDeliveries && (
          <div className="v3-cluster">
            <Btn
              size="sm"
              icon="box"
              disabled={hasActiveObligationWithDescription('משלוח הלוך')}
              onClick={() => addDeliveryObligation('משלוח הלוך')}
              title={hasActiveObligationWithDescription('משלוח הלוך') ? undefined : `חיוב משלוח הלוך, ₪${deliveryPrice}`}
            >
              חיוב משלוח הלוך
            </Btn>
            {hasActiveObligationWithDescription('משלוח הלוך') && <Tip>כבר יש בהזמנה חיוב משלוח הלוך פעיל.</Tip>}
            <Btn
              size="sm"
              icon="box"
              disabled={hasActiveObligationWithDescription('משלוח חזור')}
              onClick={() => addDeliveryObligation('משלוח חזור')}
              title={hasActiveObligationWithDescription('משלוח חזור') ? undefined : `חיוב משלוח חזור, ₪${deliveryPrice}`}
            >
              חיוב משלוח חזור
            </Btn>
            {hasActiveObligationWithDescription('משלוח חזור') && <Tip>כבר יש בהזמנה חיוב משלוח חזור פעיל.</Tip>}
          </div>
        )}
      </Card>

      {/* ===== תשלומים שהתקבלו ===== */}
      <Card icon="card" title="תשלומים שהתקבלו">
        {activePayments.length > 0 ? (
          <div className="v3-list">
            {sortedPayments.map((p, idx) => {
              // תשלום שלילי הוא החזר שנרשם כתנועה שלילית - אותו טיפול בסימן וב-bdi
              const isCreditPayment = p.amount < 0;
              return (
                <div key={idx} className={`v3-li ${p.isNew ? 'v3-li--pending' : ''}`}>
                  <div className="v3-li__ic"><Icon name={(p.paymentMethod || '').includes('אשראי') ? 'card' : 'coin'} /></div>
                  <div className="v3-li__body">
                    <span className="v3-li__title">{p.paymentMethod || '-'}</span>
                    <span className="v3-li__sub"><bdi>{fmtDate(p.paymentDate)}</bdi>{p.isNew && ' · ממתין לשמירה'}</span>
                    <div className={`v3-li__amt ${isCreditPayment ? 'v3-li__amt--credit' : ''}`}><bdi>{fmtMoney(p.amount)}</bdi></div>
                  </div>
                  <div className="v3-cluster">
                    <IconBtn variant="quiet" size="sm" icon="info" label="פרטי התשלום" onClick={() => setSelectedPaymentDetails(p)} />
                    <IconBtn variant="quiet" size="sm" icon="trash" label="מחיקת התשלום" onClick={() => removePayment(payments.indexOf(p))} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="coin" title="עדיין לא התקבלו תשלומים" />
        )}
      </Card>

      {/* ===== זיכויים ממתינים ===== */}
      <Card icon="refresh" title="זיכויים ממתינים" tip="בקשות זיכוי שנפתחו וממתינות לאישור ביצוע. האישור יוצר בהזמנה תשלום הפוך.">
        {pendingRefunds.length > 0 ? (
          <div className="v3-list">
            {pendingRefunds.map((r, idx) => {
              const bankMissing = !r.bankName?.trim() || !r.bankBranch?.trim();
              return (
                <div key={idx} className="v3-li">
                  <div className="v3-li__ic"><Icon name="refresh" /></div>
                  <div className="v3-li__body">
                    <span className="v3-li__title">{r.reason || 'לא צוינה סיבה'}</span>
                    <span className="v3-li__sub"><bdi>{fmtDate(r.createdAt)}</bdi></span>
                    <div className="v3-li__amt v3-li__amt--credit"><bdi>₪{r.amount}</bdi></div>
                    {bankMissing && <Chip variant="attn" icon="alert-circle">חסרים פרטי בנק</Chip>}
                  </div>
                  <div className="v3-cluster">
                    <Btn size="sm" icon="edit" onClick={() => openAutoRefundBankModal(r)}>
                      {bankMissing ? 'הוספת פרטי בנק' : 'עדכון פרטי בנק'}
                    </Btn>
                    <Btn variant="primary" size="sm" icon="check" loading={isProcessing} onClick={() => approveRefund(r.id)}>
                      אישור ביצוע
                    </Btn>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty icon="refresh" title="אין זיכויים ממתינים" text="בקשת זיכוי חדשה תופיע כאן עד שתאושר." />
        )}
      </Card>

      {/* ===== פעולות ידניות ===== */}
      <details className="v3-collapse">
        <summary>
          <Icon name="settings" />
          פעולות ידניות
          <Icon name="chevron-down" className="v3-collapse__chev" />
        </summary>
        <div className="v3-collapse__in">
          <span className="v3-faint v3-text-sm">
            לרוב אין בזה צורך <Tip>חיובים וזיכויים נוצרים לבד מהפעולות בהזמנה. כאן רק למקרים חריגים.</Tip>
          </span>
          <div className="v3-cluster">
            <Btn icon="plus" onClick={() => setShowAddChargeModal(true)}>הוספת חיוב</Btn>
            <Tip>לחיוב חריג בלבד. חיובי מחירון רגילים, כולל ביטולים והחלפות, מתעדכנים לבד.</Tip>
          </div>
          {/* "תשלום נוסף" ו"בקשת זיכוי" מוסתרים כש-consolidate_manual_payment_credit_ui מופעל (נווה יעקב):
              הכפתור המאוחד עובר ל"פרטים כלליים" ודורש שם קוד מאשר. */}
          {settings.consolidate_manual_payment_credit_ui !== 'true' && (
            <>
              {settings.allow_additional_payment_on_order === 'true' && (
                <div className="v3-cluster">
                  <Btn icon="coin" onClick={handleOpenAdditionalPaymentModal}>תשלום נוסף</Btn>
                  <Tip>רישום תשלום שהתקבל מחוץ לאשראי, למשל מזומן. נשמר מיד, בלי לחכות לשמירת ההזמנה.</Tip>
                </div>
              )}
              <div className="v3-cluster">
                <Btn icon="refresh" onClick={handleOpenRefundModal}>בקשת זיכוי ללקוח</Btn>
                <Tip>לזיכוי חריג בלבד. זיכוי על ביטול או החלפה נוצר לבד.</Tip>
              </div>
            </>
          )}
          <div className="v3-cluster">
            <Btn icon="refresh" loading={isRecalculating} onClick={handleRecalculate}>חישוב מחדש</Btn>
            <Tip>מחשב שוב את כל חיובי ההזמנה לפי הכללים העדכניים. סכומים קיימים עשויים להשתנות.</Tip>
          </div>
        </div>
      </details>

      {mounted && (
        <>
          {/* ===== חתימה על תקנון (נשאל גם כאן, לפני תשלום) ===== */}
          <Dialog
            open={showRegulationsModal}
            onClose={() => { if (!confirmingSigned) setShowRegulationsModal(false); }}
            variant="confirm"
            mode="dark"
            icon="edit"
            badgeKind="write"
            title="חתימה על התקנון"
            sub="לפני קבלת תשלום צריך לוודא שהלקוח חתם על התקנון. הוא חתם?"
            actions={
              <>
                <Btn variant="primary" icon="check" loading={confirmingSigned} onClick={confirmSignedThenOpenCredit}>כן, חתם</Btn>
                <Btn variant="quiet" disabled={confirmingSigned} onClick={() => setShowRegulationsModal(false)}>עדיין לא</Btn>
              </>
            }
          />

          {/* ===== העברת כרטיס מהירה (קורא מגנטי) - אין סגירה בלחיצה על הרקע ===== */}
          <Dialog
            open={showQuickSwipeModal}
            onClose={() => setShowQuickSwipeModal(false)}
            closeOnScrim={false}
            variant="confirm"
            mode="light"
            icon="tag"
            badgeKind="tilt"
            title="העבירו את הכרטיס"
            sub="העבירו את הכרטיס בקורא המגנטי. מספר הכרטיס והתוקף יתמלאו לבד."
            actions={<Btn variant="quiet" onClick={() => setShowQuickSwipeModal(false)}>ביטול</Btn>}
          >
            <input
              autoFocus
              data-autofocus=""
              aria-label="קלט מהקורא המגנטי"
              type="text"
              value={swipeInput}
              onChange={handleSwipeInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              onBlur={(e) => { if (showQuickSwipeModal) setTimeout(() => e.target?.focus(), 100); }}
              style={{ opacity: 0, position: 'absolute', top: '-1000px' }}
            />
          </Dialog>

          {/* ===== תשלום באשראי (נדרים פלוס) - אין סגירה בלחיצה על הרקע, כדי לא לאבד פרטי כרטיס ===== */}
          <Dialog
            open={showCreditModal}
            onClose={() => setShowCreditModal(false)}
            closeOnScrim={false}
            variant="form"
            icon="card"
            title="תשלום באשראי"
            sub="החיוב נשלח לנדרים פלוס ונשמר בהזמנה מיד."
            actions={
              <>
                <Btn variant="primary" icon="card" loading={isProcessing} onClick={handleProcessCreditCard}>
                  {isProcessing ? 'מחייב…' : 'חיוב הכרטיס'}
                </Btn>
                <Btn variant="quiet" disabled={isProcessing} onClick={() => setShowCreditModal(false)}>ביטול</Btn>
                <Btn
                  variant="quiet"
                  size="sm"
                  iconEnd="arrow-start"
                  disabled={isProcessing}
                  onClick={handleBypassCreditPayment}
                  style={{ marginInlineStart: 'auto' }}
                >
                  מעקף מתכנת
                </Btn>
                <Tip>רושם את התשלום ידנית, כאילו שולם, בלי לפנות לנדרים פלוס. מיועד לתקלת סליקה, ודורש סיסמת מתכנת.</Tip>
              </>
            }
          >
            <div className="v3-cluster">
              <Btn
                size="sm"
                icon="activity"
                onClick={(e) => { e.preventDefault(); setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}
              >
                העברה בקורא מגנטי
              </Btn>
            </div>
            <Field label="לקוח">
              <input type="text" readOnly value={`${customer?.firstName || ''} ${customer?.lastName || ''}`} />
            </Field>
            <Field label="סכום לחיוב (₪)">
              <input
                ref={creditAmountRef}
                type="number"
                dir="ltr"
                value={creditCardData.amount}
                onChange={e => setCreditCardData({ ...creditCardData, amount: e.target.value })}
                onKeyDown={(e) => focusNextOnEnter(e, creditCardNumberRef)}
              />
            </Field>
            <Field label="מספר כרטיס">
              <input
                ref={creditCardNumberRef}
                type="text"
                dir="ltr"
                inputMode="numeric"
                value={creditCardData.cardNumber}
                onChange={handleCardNumberChange}
                onKeyDown={(e) => focusNextOnEnter(e, creditTokefRef)}
                placeholder="0000 0000 0000 0000"
                maxLength={19}
              />
            </Field>
            <Field label="תוקף (MM/YY)">
              <input
                ref={creditTokefRef}
                type="text"
                dir="ltr"
                inputMode="numeric"
                value={creditCardData.tokef}
                onChange={handleTokefChange}
                onKeyDown={(e) => focusNextOnEnter(e, creditInstallmentsRef)}
                placeholder="12/28"
                maxLength={5}
              />
            </Field>
            <Field label="מספר תשלומים">
              <input
                ref={creditInstallmentsRef}
                type="number"
                dir="ltr"
                min={1}
                max={36}
                value={creditCardData.installments}
                onChange={e => setCreditCardData({ ...creditCardData, installments: e.target.value })}
                onKeyDown={(e) => focusNextOnEnter(e, creditNotesRef)}
              />
            </Field>
            <Field label="הערה">
              <input
                ref={creditNotesRef}
                type="text"
                value={creditCardData.notes}
                onChange={e => setCreditCardData({ ...creditCardData, notes: e.target.value })}
                onKeyDown={(e) => { if (e.key === 'Enter' && !isProcessing) { e.preventDefault(); handleProcessCreditCard(); } }}
                placeholder="הערה לחיוב"
              />
            </Field>
            {creditError && <Banner kind="alert" text={creditError} />}
          </Dialog>

          {/* ===== הוספת חיוב ידני ===== */}
          <Dialog
            open={showAddChargeModal}
            onClose={() => setShowAddChargeModal(false)}
            variant="form"
            icon="plus"
            title="הוספת חיוב"
            sub="החיוב יירשם בהזמנה כשתשמרו אותה."
            actions={
              <>
                <Btn variant="primary" disabled={!newObligation.description || !newObligation.amount} onClick={addObligation}>שמירת החיוב</Btn>
                <Btn variant="quiet" onClick={() => setShowAddChargeModal(false)}>ביטול</Btn>
              </>
            }
          >
            <Field label="על מה החיוב">
              <input
                type="text"
                placeholder="למשל: שמלה נוספת"
                value={newObligation.description}
                onChange={e => setNewObligation({ ...newObligation, description: e.target.value })}
              />
            </Field>
            <Field label="סכום (₪)">
              <input
                type="number"
                dir="ltr"
                placeholder="0"
                value={newObligation.amount}
                onChange={e => setNewObligation({ ...newObligation, amount: e.target.value })}
              />
            </Field>
          </Dialog>

          {/* ===== פרטי תשלום ===== */}
          <Dialog
            open={!!selectedPaymentDetails}
            onClose={() => setSelectedPaymentDetails(null)}
            variant="sheet"
            mode="light"
            icon="coin"
            title="פרטי התשלום"
            actions={<Btn onClick={() => setSelectedPaymentDetails(null)}>סגירה</Btn>}
          >
            {selectedPaymentDetails && (
              <Rows>
                <Row label="אופן תשלום">{selectedPaymentDetails.paymentMethod || '-'}</Row>
                <Row label="סכום"><bdi>{fmtMoney(selectedPaymentDetails.amount)}</bdi></Row>
                <Row label="תאריך">
                  <bdi>{getHebrewDateString(selectedPaymentDetails.paymentDate)}, {new Date(selectedPaymentDetails.paymentDate).toLocaleTimeString('he-IL')}</bdi>
                </Row>
                <Row label="פירוט מהסליקה" tip="הערות ופרטים שנשמרו עם התשלום, כולל תשובת נדרים פלוס.">
                  {(() => {
                    const notes = selectedPaymentDetails.notes;
                    if (!notes) return <span className="v3-faint">אין פירוט</span>;
                    try {
                      if (typeof notes === 'string' && notes.trim().startsWith('{')) {
                        const parsed = JSON.parse(notes);
                        return (
                          <Rows>
                            {Object.entries(parsed).map(([k, v]) => (
                              <Row key={k} label={k}><bdi dir="ltr">{String(v)}</bdi></Row>
                            ))}
                          </Rows>
                        );
                      }
                    } catch (e) { }
                    return <div style={{ whiteSpace: 'pre-wrap' }}>{typeof notes === 'string' ? notes.split(' | ').join('\n') : String(notes)}</div>;
                  })()}
                </Row>
              </Rows>
            )}
          </Dialog>

          {/* ===== פרטי חיוב ===== */}
          <Dialog
            open={!!selectedObligationDetails}
            onClose={() => setSelectedObligationDetails(null)}
            variant="sheet"
            mode="light"
            icon="receipt"
            title="פרטי החיוב"
            actions={<Btn onClick={() => setSelectedObligationDetails(null)}>סגירה</Btn>}
          >
            {selectedObligationDetails && (
              <Rows>
                <Row label="סוג החיוב">
                  {selectedObligationDetails.isManual === false
                    ? (cleanItemTag(selectedObligationDetails.productName) || 'חיוב אוטומטי')
                    : (cleanItemTag(selectedObligationDetails.description) || 'חיוב ידני')}
                </Row>
                <Row label="סכום"><bdi>{fmtMoney(selectedObligationDetails.amount)}</bdi></Row>
                <Row label="תאריך">
                  <bdi>{getHebrewDateString(selectedObligationDetails.createdAt || new Date())}, {new Date(selectedObligationDetails.createdAt || new Date()).toLocaleTimeString('he-IL')}</bdi>
                </Row>
                <Row label="פירוט">{cleanItemTag(selectedObligationDetails.description) || 'ללא תיאור'}</Row>
                {selectedObligationDetails.priceCategory && <Row label="קטגוריה במחירון">{selectedObligationDetails.priceCategory}</Row>}
                {selectedObligationDetails.priceDescription && <Row label="תיאור במחירון">{selectedObligationDetails.priceDescription}</Row>}
              </Rows>
            )}
          </Dialog>

          {/* ===== בקשת זיכוי ===== */}
          <Dialog
            open={showRefundModal}
            onClose={() => setShowRefundModal(false)}
            variant="form"
            icon="refresh"
            title="בקשת זיכוי ללקוח"
            sub="הבקשה נשמרת מיד ותמתין לאישור ביצוע."
            onKeyDown={(e) => { if (e.key === 'Enter' && !isProcessing) { e.preventDefault(); submitRefund(); } }}
            actions={
              <>
                <Btn variant="primary" loading={isProcessing} onClick={submitRefund}>
                  {isProcessing ? 'שולח…' : 'פתיחת הבקשה'}
                </Btn>
                <Btn variant="quiet" onClick={() => setShowRefundModal(false)}>ביטול</Btn>
              </>
            }
          >
            <Field label="סכום לזיכוי (₪)" required>
              <input type="number" dir="ltr" value={refundData.amount} onChange={e => setRefundData({ ...refundData, amount: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
            <Field label="סיבה או הערה">
              <input type="text" value={refundData.reason} onChange={e => setRefundData({ ...refundData, reason: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
            <Field label="בנק" required>
              <input type="text" value={refundData.bankName} onChange={e => setRefundData({ ...refundData, bankName: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
            <Field label="סניף" required>
              <input type="text" dir="ltr" value={refundData.bankBranch} onChange={e => setRefundData({ ...refundData, bankBranch: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
            <Field label="מספר חשבון">
              <input type="text" dir="ltr" value={refundData.bankAccount} onChange={e => setRefundData({ ...refundData, bankAccount: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
            <Field label="שם בעל החשבון">
              <input type="text" value={refundData.bankAccountName} onChange={e => setRefundData({ ...refundData, bankAccountName: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
            <Field label="אמצעי התשלום המקורי" tip="נלקח אוטומטית מהתשלום האחרון בהזמנה.">
              <input type="text" readOnly value={refundData.paymentDetails} />
            </Field>
            <Field label="מייל הלקוח" tip="לשליחת אישור הזיכוי.">
              <input type="email" dir="ltr" value={refundData.email} onChange={e => setRefundData({ ...refundData, email: e.target.value })} onKeyDown={submitRefundOnEnter} />
            </Field>
          </Dialog>

          {/* ===== פרטי בנק לזיכוי קיים (רק משלימים פרטי בנק) ===== */}
          <Dialog
            open={showAutoRefundBankModal}
            onClose={() => { if (!isSavingAutoRefundBank) setShowAutoRefundBankModal(false); }}
            variant="form"
            icon="edit"
            title="פרטי בנק לזיכוי"
            sub="ללקוח נוצרה יתרת זכות. הזינו או אשרו את פרטי הבנק להעברת הזיכוי."
            onKeyDown={(e) => { if (e.key === 'Enter' && !isSavingAutoRefundBank) { e.preventDefault(); submitAutoRefundBank(); } }}
            actions={
              <>
                <Btn variant="primary" loading={isSavingAutoRefundBank} onClick={submitAutoRefundBank}>
                  {isSavingAutoRefundBank ? 'שומר…' : 'שמירת פרטי הבנק'}
                </Btn>
                <Btn variant="quiet" disabled={isSavingAutoRefundBank} onClick={() => setShowAutoRefundBankModal(false)}>אמלא מאוחר יותר</Btn>
              </>
            }
          >
            <Field label="בנק" required>
              <input type="text" autoFocus data-autofocus="" value={autoRefundBankData.bankName} onChange={e => setAutoRefundBankData({ ...autoRefundBankData, bankName: e.target.value })} />
            </Field>
            <Field label="סניף" required>
              <input type="text" dir="ltr" value={autoRefundBankData.bankBranch} onChange={e => setAutoRefundBankData({ ...autoRefundBankData, bankBranch: e.target.value })} />
            </Field>
            <Field label="מספר חשבון">
              <input type="text" dir="ltr" value={autoRefundBankData.bankAccount} onChange={e => setAutoRefundBankData({ ...autoRefundBankData, bankAccount: e.target.value })} />
            </Field>
            <Field label="שם בעל החשבון">
              <input type="text" value={autoRefundBankData.bankAccountName} onChange={e => setAutoRefundBankData({ ...autoRefundBankData, bankAccountName: e.target.value })} />
            </Field>
          </Dialog>

          {/* ===== תשלום נוסף (מזומן/אחר) - מאחורי allow_additional_payment_on_order ===== */}
          <Dialog
            open={showAdditionalPaymentModal}
            onClose={() => { if (!isProcessing) setShowAdditionalPaymentModal(false); }}
            variant="form"
            icon="coin"
            title="תשלום נוסף"
            sub="התשלום נשמר מיד בהזמנה."
            onKeyDown={(e) => { if (e.key === 'Enter' && !isProcessing) { e.preventDefault(); submitAdditionalPayment(); } }}
            actions={
              <>
                <Btn variant="primary" loading={isProcessing} disabled={!additionalPaymentData.amount} onClick={submitAdditionalPayment}>
                  {isProcessing ? 'שומר…' : 'שמירת התשלום'}
                </Btn>
                <Btn variant="quiet" disabled={isProcessing} onClick={() => setShowAdditionalPaymentModal(false)}>ביטול</Btn>
              </>
            }
          >
            <Field
              label="אופן תשלום"
              as="select"
              value={additionalPaymentData.paymentMethod}
              onChange={e => setAdditionalPaymentData({ ...additionalPaymentData, paymentMethod: e.target.value })}
            >
              {additionalPaymentMethodOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Field>
            <Field label="סכום (₪)">
              <input
                type="number"
                dir="ltr"
                placeholder="0"
                value={additionalPaymentData.amount}
                onChange={e => setAdditionalPaymentData({ ...additionalPaymentData, amount: e.target.value })}
                onKeyDown={submitAdditionalOnEnter}
              />
            </Field>
            <Field label="הערה">
              <input
                type="text"
                value={additionalPaymentData.notes}
                onChange={e => setAdditionalPaymentData({ ...additionalPaymentData, notes: e.target.value })}
                onKeyDown={submitAdditionalOnEnter}
                placeholder="הערה לתשלום"
              />
            </Field>
            {additionalPaymentError && <Banner kind="alert" text={additionalPaymentError} />}
          </Dialog>

          {/* ===== אישור פעולה (במקום window.customConfirm) ===== */}
          <Dialog
            open={!!confirmState}
            onClose={() => settleConfirm(false)}
            nested
            variant="confirm"
            mode="dark"
            icon={confirmState?.icon || 'info'}
            title={confirmState?.title}
            sub={confirmState?.sub}
            actions={
              <>
                <Btn variant="primary" onClick={() => settleConfirm(true)}>{confirmState?.confirmLabel || 'אישור'}</Btn>
                <Btn variant="quiet" onClick={() => settleConfirm(false)}>ביטול</Btn>
              </>
            }
          />

          {/* ===== הודעה (במקום alert) ===== */}
          <Dialog
            open={!!messageState}
            onClose={() => setMessageState(null)}
            nested
            variant="confirm"
            mode="dark"
            icon={messageMeta.icon}
            title={messageMeta.title}
            sub={messageState?.text}
            actions={<Btn variant="primary" onClick={() => setMessageState(null)}>הבנתי</Btn>}
          />
        </>
      )}
    </V3Page>
  );
});

export default ModernPaymentsManager;
