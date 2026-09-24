'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import HebrewDatePicker from '../../../components/HebrewDatePicker';
import HebrewDateRangePicker from '../../../components/HebrewDateRangePicker';
import CustomerSelector from '../../../components/CustomerSelector';
import OrderModelSelector from '../../../components/orders/OrderModelSelector';
import ItemCapacityModal from '../../../components/orders/ItemCapacityModal';
import CapacitySearchModal from '../../../components/CapacitySearchModal';
import NewOrderShell from '../../../components/orders/new/NewOrderShell';
import { calculateDynamicAvailability } from '../../../lib/clientInventory';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { verifyPin } from '../../../components/orders/modern/mocAuth';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { isDeliveryAddressRequired, isDeliveryCityRequired, validateDeliveryFields } from '../../../lib/deliveryValidation';
import { parseFieldGroups, getUnsatisfiedFieldGroups, unsatisfiedFieldGroupErrors, unsatisfiedFieldGroupShortLabels, isFieldRequiredByGroup } from '../../../lib/customerValidation';
import { resolveOrderRedirectHref } from '../../../lib/orderRedirectScreens';
import { Btn, IconBtn, Card, Field, Row, Rows, Tabs, Seg, Switch, Tip, Dialog, Banner, Empty, Icon, Tag, Badge } from '@/app/v3/ui/components';
import { enqueueNotice } from '@/app/v3/notify/store';

export const getCustomerFullName = (c) => {
  if (!c) return 'לא נבחר';
  const f = (c.firstName === 'null' || c.firstName === 'undefined' || !c.firstName) ? '' : c.firstName;
  const l = (c.lastName === 'null' || c.lastName === 'undefined' || !c.lastName) ? '' : c.lastName;
  return `${f} ${l}`.trim() || 'לקוח ללא שם';
};

// אופציות "אופן תשלום" לשלב התשלום של האשף - נגזר גם ברינדור (paymentMethodOptions למטה)
// וגם ברגע טעינת ההגדרות (כדי לסנכרן את payment.method ההתחלתי, ר' שם) כדי שלא יהיו שתי
// מימושים שעלולים לסטות זה מזה. כשסליקת נדרים פלוס כבויה בהגדרות (nedarim_plus_enabled),
// אסור להציע אופציה שתפעיל בפועל את זרימת החיוב בכרטיס - handleSaveAndPay/handleAddPaymentClick
// בודקים בדיוק את התנאי method.includes('אשראי') && !method.includes('חיצונית') כדי לפתוח את
// showCreditModal/processCredit, אז מסננים כל אופציה כזו (גם אם ALLOWED_PAYMENT_METHODS הוגדר
// ידנית עם אופציה כזו). תואם את הסתרת הכפתור המקביל ב-ModernPaymentsManager ואת הסתרת הכפתורים
// "תשלום"/"עבור לנדרים פלוס" בטופס כרטיס_הזמנה_תשלום בגמ"ח הישן.
const computePaymentMethodOptions = (settingsObj) => {
  const raw = settingsObj.ALLOWED_PAYMENT_METHODS
    ? settingsObj.ALLOWED_PAYMENT_METHODS.split(',').map(s => s.trim()).filter(Boolean)
    // "מזומן" (cash) היה חסר כליל מברירת המחדל הזו - כשאין שורת ALLOWED_PAYMENT_METHODS
    // ב-SystemSetting (למשל התקנה חדשה/ארגון נוסף) התפריט הציג רק "אשראי" ו"יציאה באישור
    // מנהל", בלי שום דרך לרשום תשלום במזומן. ראה דיווח לקוח: "בשדה אופן התשלום הוא מציג
    // יציאה באישור מנהל, זה צריך להיות מתוך רשימת בחירה אשראי או מזומן". תוקן כאן רק את
    // ברירת המחדל בקוד - אם קיימת שורה ב-DB (כמו בייצור הנוכחי) היא זו שקובעת בפועל, ראו
    // /admin/settings → תשלומים → "אפשרויות תשלום מורשות".
    : ['אשראי (דרך נדרים פלוס)', 'מזומן', 'יציאה באישור מנהל'];
  if (settingsObj.nedarim_plus_enabled !== 'false') return raw;
  const withoutCredit = raw.filter(opt => !(opt.includes('אשראי') && !opt.includes('חיצונית')));
  return withoutCredit.length > 0 ? withoutCredit : ['יציאה באישור מנהל'];
};

export default function NewOrderPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);

  // ===== v3: הודעות (במקום alert), אישור יציאה (במקום window.confirm), חזרה-לסיכום אחרי עריכה =====
  // כל הקריאות מחזירות Promise שנפתר בסגירת החלונית, כך שזרימת ה-await נשארת כמו ב-alert/confirm המובנים.
  const [alertQueue, setAlertQueue] = useState([]);
  const showAlert = (message) => new Promise((resolve) => {
    setAlertQueue(q => [...q, { message: String(message ?? ''), resolve }]);
  });
  const [leaveAsk, setLeaveAsk] = useState(null);
  const leaveAskPendingRef = useRef(false);
  const [returnToSummary, setReturnToSummary] = useState(false);
  const editingStepRef = useRef(1);

  const canNavigateToStep = (targetStep) => {
    if (targetStep === 1) return true;
    if (targetStep === 2) return !!order.customerId;
    if (targetStep === 3) {
      const datesFilled = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
      return !!order.customerId && !!datesFilled;
    }
    if (targetStep === 4) {
      const datesFilled = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
      return !!order.customerId && !!datesFilled && order.items.length > 0;
    }
    if (targetStep === 5) {
      const datesFilled = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
      return !!order.customerId && !!datesFilled && order.items.length > 0;
    }
    return false;
  };
  const [searchMode, setSearchMode] = useState('phone'); // 'phone' | 'name' | 'new'
  const [phoneSearchInput, setPhoneSearchInput] = useState('');
  const [isCheckingPhone, setIsCheckingPhone] = useState(false);
  const [foundCustomersFromPhone, setFoundCustomersFromPhone] = useState([]);

  const [order, setOrder] = useState({
    customerId: '',
    selectedCustomer: null,
    eventDate: '',
    eventDateHebrew: '',
    returnDate: '',
    isAbroad: false,
    isWeekdayEvent: false,
    fromDate: '',
    toDate: '',
    notes: '',
    items: [],
    customSpacing: null,
    // 15 + 13/34 - משלוח, טלפוני וסניף (נשמרים ל-Order, מותנים ב-toggle בהמשך המסך)
    isDelivery: false,
    deliveryDirection: 'הלוך-חזור',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryOneDayBefore: false,
    isPhoneOrder: false,
    branch: '',
    pickupBranch: '',
    // 3 - פרטי הוראת קבע להזמנה זו כשנבחר לקוח קיים (בניגוד ל-newCustomer.hok* למטה,
    // שמשמש רק בזרימת יצירת לקוח חדש ונשמר על גבי Customer) - נשמר על Order.hokDetails (JSON).
    hokBankName: '',
    hokBankBranch: '',
    hokBankAccount: '',
    hokConsent: false,
  });
  
  const [newItem, setNewItem] = useState({
    dressModelId: '',
    selectedSizes: [],
    quantity: 1,
    repairs: '',
    dressName: ''
  });
  
  const [availableSizes, setAvailableSizes] = useState([]);
  const [customerLocations, setCustomerLocations] = useState({ cities: [], streets: [] });
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [capacityModalItem, setCapacityModalItem] = useState(null);
  const [pendingSpacingChange, setPendingSpacingChange] = useState(null);
  const [showSpacingCapacitySearch, setShowSpacingCapacitySearch] = useState(false);
  const [inventoryCache, setInventoryCache] = useState(null);
  const [loadingPreload, setLoadingPreload] = useState(false);
  
  const [calculatedData, setCalculatedData] = useState({ totalAmount: 0, items: [] });
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newCustomer, setNewCustomer] = useState({
    firstName: '', lastName: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: '', marketingConsent: false, zeout: ''
  });

  const [duplicateCustomers, setDuplicateCustomers] = useState([]);

  const [paymentsList, setPaymentsList] = useState([]);

  const [payment, setPayment] = useState({
    amount: '',
    method: 'אשראי',
    notes: ''
  });

  const [settings, setSettings] = useState({});

  // ערי המשלוח לבחירה בשדה "עיר משלוח" - מתוך מפתחות ה-JSON של delivery_price_by_city
  // (הערים שבאמת מוגדר להן מחיר משלוח), ולא מתוך כל ערי הלקוחות הכלליות - ר' דיווח
  // org2 9090b43a. נופל חזרה לרשימת ערי הלקוחות אם ההגדרה עוד לא הוגדרת/ריקה, כדי
  // שהשדה לא יישאר בלי הצעות כלל לפני שממלאים את טבלת המחירים.
  const deliveryCityOptions = useMemo(() => {
    try {
      const priceMap = JSON.parse(settings.delivery_price_by_city || '{}');
      const cities = Object.keys(priceMap);
      if (cities.length) return cities;
    } catch {
      // JSON לא תקין בהגדרה - נופל לרשימת ערי הלקוחות
    }
    return customerLocations.cities;
  }, [settings.delivery_price_by_city, customerLocations.cities]);

  // ערי המשלוח שיש להן מחיר מוגדר בפועל (delivery_price_by_city) - להבדיל מ-deliveryCityOptions
  // (שנופל חזרה לכל ערי הלקוחות כשהטבלה ריקה) - זו הרשימה שקובעת אם עיר המגורים של
  // הלקוח "ידועה" לצורך isDeliveryCityRequired.
  const deliveryPriceCities = useMemo(() => {
    try {
      return Object.keys(JSON.parse(settings.delivery_price_by_city || '{}'));
    } catch {
      return [];
    }
  }, [settings.delivery_price_by_city]);

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [showQuickSwipeModal, setShowQuickSwipeModal] = useState(false);
  const [swipeInput, setSwipeInput] = useState('');
  const [creditCardData, setCreditCardData] = useState({
    cardNumber: '',
    tokef: '',
    installments: 1,
    notes: '',
    amount: ''
  });
  const [isProcessingCredit, setIsProcessingCredit] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [creditProcessedConfirmation, setCreditProcessedConfirmation] = useState(null);

  // The order number Nedarim Plus was told about. It is claimed from the server before the
  // first charge (the order itself does not exist yet at that point) and handed back on save,
  // so the saved order carries the same number that appears on the charge.
  const [reservedOrderId, setReservedOrderId] = useState(null);

  // Everything on this screen lived in React state until the final save, so closing it at the
  // payment step threw the whole order away and released nothing - it had never reached the
  // database to begin with. The cart is now autosaved as a 'טיוטה' order the moment it has
  // items, which puts it in the orders list with its 15-minute hold counting down.
  const [draftOrderId, setDraftOrderId] = useState(null);
  // Also kept in a ref: the autosave runs from a timer, and the inventory lookups need the id
  // at the moment they fire rather than the one their closure captured.
  const draftOrderIdRef = useRef(null);
  // Drafts are saved one at a time. Two creates in flight together would each allocate their
  // own order number and leave the screen with two rows.
  const draftQueueRef = useRef(Promise.resolve());
  // Set while the real save runs, so no autosave writes over the order behind it.
  const draftSealedRef = useRef(false);

  // Set when POST /api/orders reports a real order already exists for this customer/date, so
  // the cashier can look at it before deciding whether to save a separate one anyway.
  const [duplicateOrderWarning, setDuplicateOrderWarning] = useState(null);
  // The payments list the blocked save was about to submit, kept so "save anyway" can retry
  // the exact same save instead of asking the cashier to redo the payment step.
  const pendingSavePaymentsRef = useRef(null);

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
       setCreditError('מלאו מספר כרטיס, תוקף וסכום לחיוב.');
       return;
    }

    const paymentAmount = parseFloat(creditCardData.amount);
    setIsProcessingCredit(true);
    setCreditError('');
    
    try {
      const cust = order.selectedCustomer || newCustomer;
      // Nedarim Plus gets the whole address, not just the city - same as the payments screen
      // of an existing order (components/orders/OrderPaymentsManager.js).
      const fullAddress = [cust.street || '', cust.houseNum || '', cust.city || ''].filter(Boolean).join(' ');

      // Claim the real order number before charging - it is written into the Nedarim Plus
      // comment and cannot be corrected there afterwards. If the draft was already saved it
      // owns a number and there is nothing to reserve; the order is saved onto that same row.
      // If the reservation fails we still charge (the customer is standing at the counter) and
      // fall back to the old wording.
      let orderNumberForCharge = draftOrderIdRef.current || reservedOrderId;
      if (!orderNumberForCharge) {
        try {
          const reserveRes = await fetch('/api/orders/reserve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerId: order.customerId || null })
          });
          const reserveData = await reserveRes.json();
          if (reserveRes.ok && reserveData.orderId) {
            orderNumberForCharge = reserveData.orderId;
            setReservedOrderId(reserveData.orderId);
            // Point the autosave at the placeholder too, so the draft fills that row in rather
            // than claiming a second number alongside the one that just went out on the charge.
            draftOrderIdRef.current = reserveData.orderId;
            setDraftOrderId(reserveData.orderId);
          }
        } catch (reserveErr) {
          console.error('Failed to reserve order number for Nedarim charge', reserveErr);
        }
      }

      const response = await fetch('/api/nedarim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: getCustomerFullName(cust),
          phone: cust.phone1 || '',
          address: fullAddress,
          cardNumber: creditCardData.cardNumber.replace(/\s/g, ''),
          tokef: creditCardData.tokef.replace(/\//g, ''),
          amount: paymentAmount,
          installments: parseInt(creditCardData.installments) || 1,
          notes: [creditCardData.notes, `באמצעות תכנת הגמח; מס הזמנה: ${orderNumberForCharge || 'חדשה'}`].filter(Boolean).join(' - '),
          zeout: cust.idNumber || cust.zeout || '',
          email: cust.email || ''
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const conf = data.confirmation || 'בוצע';
        setShowCreditModal(false);
        
        const newPayment = {
          amount: paymentAmount,
          method: payment.method,
          notes: conf ? `אישור נדרים: ${conf} | ${creditCardData.notes}` : creditCardData.notes
        };
        const updatedList = [...paymentsList, newPayment];
        setPaymentsList(updatedList);
        
        const newTotalPaid = updatedList.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
        if (newTotalPaid >= totalAmount) {
          executeSaveOrderForList(updatedList);
        } else {
          await showAlert('חלק מהסכום חויב בהצלחה. השלימו את היתרה, או בחרו "יציאה באישור מנהל", כדי לסיים.');
        }
      } else {
        setCreditError(data.error || 'החיוב נכשל.');
      }
    } catch (err) {
      setCreditError('תקלת תקשורת בחיוב. בדקו אם החיוב עבר לפני ניסיון נוסף.');
    } finally {
      setIsProcessingCredit(false);
    }
  };

  useEffect(() => {
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (Array.isArray(data)) {
          const settingsObj = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(settingsObj);
          // מסונכרן דרך computePaymentMethodOptions (ולא רק כש-ALLOWED_PAYMENT_METHODS מוגדר
          // ידנית כמו קודם) - כדי ש-payment.method ההתחלתי ('אשראי', ר' useState למעלה) לא
          // יישאר תקוע על ברירת המחדל הזו כשנדרים פלוס כבוי וה-select מציג אופציה אחרת
          // לחלוטין: <select value={payment.method}> לא היה מעדכן את ה-state בעצמו, אז
          // handleSaveAndPay עדיין היה רואה method.includes('אשראי') ופותח את חלון האשראי
          // המושבת גם בלי לגעת בתפריט בכלל.
          const opts = computePaymentMethodOptions(settingsObj);
          if (opts.length > 0) {
            setPayment(prev => ({ ...prev, method: opts[0] }));
          }
        } else {
          setSettings(data || {});
        }
      })
      .catch(err => console.error(err));
  }, []);

  // 13 - זיהוי סניף ביצוע: העובדת מתלוננת שהיא צריכה לבחור סניף מחדש בכל הזמנה -
  // ממלאים ברירת מחדל מהסניף האחרון שנבחר בדפדפן הזה (נשמר ב-onChange של ה-select
  // למטה), כדי שלא תצטרך לבחור שוב כל פעם; עדיין ניתן לשינוי לכל הזמנה בנפרד.
  useEffect(() => {
    if (settings.track_branch_on_order !== 'true') return;
    let remembered = '';
    try { remembered = localStorage.getItem('gemach_last_order_branch') || ''; } catch {}
    if (!remembered) return;
    setOrder(prev => (prev.branch || prev.isPhoneOrder) ? prev : { ...prev, branch: remembered });
  }, [settings.track_branch_on_order]);

  useEffect(() => {
    fetchSharedJson('/api/customers/locations', { ttl: TTL.REFERENCE })
      .then(data => setCustomerLocations({ cities: data?.cities || [], streets: data?.streets || [] }))
      .catch(err => console.error(err));
  }, []);

  const paymentMethodOptions = computePaymentMethodOptions(settings);

  const newCustomerFormRef = useRef(null);
  // Enter עובר לשדה הבא בטופס לקוח חדש, ובשדה האחרון שולח בפועל - במקום לנסות לשלוח
  // מכל שדה בנפרד (מה שנכשל כשעדיין חסרים שדות אחרים, אותה בעיה שתוקנה במודל
  // האשראי למעלה). לא נוגע בתיבות סימון, כדי לא לשנות את הסימון שלהן בטעות (ר' דיווח e8ff9855).
  const handleNewCustomerFieldEnter = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const container = newCustomerFormRef.current;
    if (!container) return;
    const focusable = Array.from(container.querySelectorAll('input, select, textarea, button'))
      .filter(el => !el.disabled && el.type !== 'checkbox' && el.offsetParent !== null);
    const next = focusable[focusable.indexOf(e.target) + 1];
    if (next) {
      next.focus();
      if (typeof next.select === 'function') next.select();
    } else {
      handleSaveNewCustomerAndProceed();
    }
  };

  const handleCheckPhone = async () => {
    if (!phoneSearchInput || phoneSearchInput.trim().length < 9) {
      await showAlert('הזינו מספר טלפון תקין (לפחות 9 ספרות).');
      return;
    }
    
    setIsCheckingPhone(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(phoneSearchInput.trim())}&limit=20`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setFoundCustomersFromPhone(data.data);
      } else {
        setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
        setFoundCustomersFromPhone([]);
        setSearchMode('new');
      }
    } catch (e) {
      console.error(e);
      await showAlert('חיפוש הלקוח נכשל. נסו שוב.');
    } finally {
      setIsCheckingPhone(false);
    }
  };

  // מפתחות השדות הזמינים בטופס הלקוח המהיר כאן, מול הכינויים שנשמרים בהגדרת mandatory_fields
  // (אותם כינויים שמוצגים ב-CustomerFieldsCheckboxPicker במסך ההגדרות).
  const CUSTOMER_FIELD_ALIASES = {
    firstName: ['firstname', 'שם פרטי', 'שם_פרטי'],
    lastName: ['lastname', 'שם משפחה', 'שם_משפחה'],
    phone1: ['phone1', 'טלפון ראשי (נייד)', 'טלפון_1'],
    email: ['email', 'אימייל'],
    city: ['city', 'עיר'],
    street: ['street', 'רחוב'],
    houseNum: ['housenum', 'מספר בית', 'מספר_בית']
  };
  const CUSTOMER_FIELD_LABELS = {
    firstName: 'שם פרטי', lastName: 'שם משפחה', phone1: 'טלפון', email: 'אימייל', city: 'עיר', street: 'רחוב', houseNum: 'מספר בית', marketingConsent: 'אישור דיוור'
  };

  // האם `key` מסומן כ"שדה חובה" ב-CustomerFieldsCheckboxPicker (הגדרת mandatory_fields) -
  // נשען ישירות כדי שגם כוכביות ה-* על אימייל/עיר/רחוב/מס' בית יסכימו עם מה שבאמת נאכף
  // (getMissingMandatoryCustomerFields למטה), לא רק עם המתגים הייעודיים require_customer_email
  // / require_full_address (דיווח: אפשר לסמן "אימייל" חובה בהגדרות הכלליות בלי שתופיע כוכבית).
  const isFieldMandatoryFromPicker = (key) => {
    const configuredMandatory = (settings.mandatory_fields || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return (CUSTOMER_FIELD_ALIASES[key] || []).some(alias => configuredMandatory.includes(alias.toLowerCase()));
  };

  // משותף בין טופס "לקוח חדש" (חסימה קשיחה) לבין אישור התאמת לקוח קיים
  // (חסימה רכה עם אפשרות לדלג באישור מפורש) — כדי ששני המסלולים יבדקו בדיוק אותם שדות.
  // בקשה 4: חובה גם מייל + כתובת מלאה + אישור דיוורים כאשר ההגדרות המתאימות מופעלות.
  const getMissingMandatoryCustomerFields = (customerObj) => {
    const baseMissing = Object.keys(CUSTOMER_FIELD_ALIASES).filter((key) => {
      const alwaysRequired = key === 'firstName' || key === 'lastName' || key === 'phone1';
      const isRequired = alwaysRequired || isFieldMandatoryFromPicker(key);
      return isRequired && !String(customerObj[key] || '').trim();
    });
    // 4: אכיפה נוספת לפי מתגי חובה ייעודיים (לא רק mandatory_fields)
    const extra = [];
    if (settings.require_customer_email === 'true' && !String(customerObj.email || '').trim()) extra.push('email');
    if (settings.require_full_address === 'true') {
      if (!String(customerObj.city || '').trim()) extra.push('city');
      if (!String(customerObj.street || '').trim()) extra.push('street');
      if (!String(customerObj.houseNum || '').trim()) extra.push('houseNum');
    }
    if (settings.hide_marketing_consent_field !== 'true' && settings.require_marketing_consent === 'true' && !customerObj.marketingConsent) extra.push('marketingConsent');
    // איחוד ללא כפילויות
    const all = [...baseMissing, ...extra.filter(k => !baseMissing.includes(k))];
    return all;
  };

  const handleSaveNewCustomerAndProceed = async (skipDuplicateCheck = false) => {
    const missingFields = getMissingMandatoryCustomerFields(newCustomer);

    if (missingFields.length > 0) {
       await showAlert(`חסרים פרטים: ${missingFields.map(k => CUSTOMER_FIELD_LABELS[k]).join(', ')}`);
       return;
    }

    // require_customer_id_number - חובה רק ביצירת לקוח חדש כאן (לא חלק מ-
    // getMissingMandatoryCustomerFields, כי אותה פונקציה משמשת גם את
    // handleUseExistingCustomer לבדיקת לקוח קיים שנבחר - אין לאכוף רטרואקטיבית ת"ז
    // חסרה על לקוחות ותיקים. הגדרה ייעודית לגמח נווה יעקב בלבד).
    if (settings.require_customer_id_number === 'true' && !String(newCustomer.zeout || '').trim()) {
       await showAlert('חסרה תעודת זהות.');
       return;
    }

    const newCustomerGroupErrors = unsatisfiedFieldGroupErrors(newCustomer, parseFieldGroups(settings.mandatory_field_groups));
    if (newCustomerGroupErrors.length > 0) {
       // כל הזמנה מחייבת 2 אמצעי תקשורת (טלפון נוסף או אימייל) - אך לפי בקשת ההנהלה
       // אין לחסום סופית, אלא לאפשר עקיפה עם אישור מנהל בפועל (PIN), כמו בלקוח קיים.
       const auth = await verifyPin(`${newCustomerGroupErrors.join('. ')} — חסר בכרטיס הלקוח. להמשך בלי להשלים נדרש אישור מנהל.`, 'feature:missing_contact_approval');
       if (!auth) return;
    }

    if (skipDuplicateCheck !== true) {
      try {
        const res = await fetch(`/api/customers?phone=${encodeURIComponent(newCustomer.phone1)}&limit=20`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          setDuplicateCustomers(data.data);
          return;
        }
      } catch (e) {
        // ignore and proceed
      }
    }

    try {
      const res = await fetch('/api/customers', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newCustomer)
      });
      const data = await res.json();
      if (res.ok) {
         setOrder(prev => ({ ...prev, customerId: data.id, selectedCustomer: data }));
         setStep(2);
         setDuplicateCustomers([]);
      } else {
         const errorMsg = data.error || 'שגיאה בשמירת לקוח';
         await showAlert(`שמירת הלקוח נכשלה: ${errorMsg}`);
      }
    } catch (e) {
      await showAlert(`שמירת הלקוח נכשלה: ${e.message}`);
    }
  };

  // לקוח חסום (Customer.isBlocked) - חוסם לגמרי את ההמשך אלא אם עובד בדרג "הנהלה
  // ראשית" מאשר עם PIN (ר' requiredLevel === 'הנהלה ראשית' ב-verify-pin/route.js).
  // מוחזק כאן, לא ב-handleUseExistingCustomer בלבד, כי יש עוד נתיב שמאשר לקוח קיים
  // בלי לעבור דרכה - חיפוש-שם דרך CustomerSelector, ששם customerId ישירות ורק
  // proceedToStep2 (כפתור "המשך") הוא נקודת המעבר המשותפת שלו.
  const confirmBlockedCustomerOverride = async (customer) => {
    if (!customer || !customer.isBlocked) return true;
    const authResult = await verifyPin(
      `הלקוח חסום להזמנות חדשות${customer.blockedReason ? ` (${customer.blockedReason})` : ''}.\nלעקיפת החסימה נדרש אישור הנהלה ראשית.`,
      'הנהלה ראשית'
    );
    return !!authResult;
  };

  // לחיצה על "כן, זה הלקוח" נתנה להמשיך גם כשחסרים פרטי חובה אצל הלקוח שנמצא.
  // עכשיו, אם חסר משהו, מבקשים אישור מפורש לדלג במקום להמשיך בשקט.
  const authBusyRef = useRef(false);
  const handleUseExistingCustomer = async (existingCustomer) => {
    // v3: בזמן חלונית אישור מנהל (PopupProvider) Esc לא סוגר את חלונית הלקוח הכפול שמתחתיה
    authBusyRef.current = true;
    try { await handleUseExistingCustomerInner(existingCustomer); } finally { authBusyRef.current = false; }
  };
  const handleUseExistingCustomerInner = async (existingCustomer) => {
    if (!await confirmBlockedCustomerOverride(existingCustomer)) return;

    const missingFields = getMissingMandatoryCustomerFields(existingCustomer);
    const fieldGroups = parseFieldGroups(settings.mandatory_field_groups);
    const missingGroupLabels = unsatisfiedFieldGroupShortLabels(existingCustomer, fieldGroups);
    const missingContactMethod = missingGroupLabels.length > 0;

    if (missingFields.length > 0 || missingContactMethod) {
      const missingParts = [
        ...missingFields.map(k => CUSTOMER_FIELD_LABELS[k]),
        ...missingGroupLabels
      ];
      // בקשה 4: אכיפה קשיחה - גם לא באישור מנהל. כבוי = ההתנהגות הקודמת (אישור חריגה)
      // תוקן: קודם זו הייתה נקודת-מבוי-סתום (הודעה בלבד, בלי שום דרך להמשיך) - עכשיו
      // הכרטיס/החלונית שממנה נלחץ הכפתור הזה תמיד מציגים קישור "עריכת פרטי לקוח"
      // (נפתח בכרטיסייה נפרדת) וכפתור ביטול/"לקוח אחר" לחזרה, ר' הכרטיס שמוצג לצד
      // חיפוש טלפון וחלונית "לקוח קיים במערכת" למטה.
      if (settings.strict_mandatory_fields === 'true') {
        await showAlert(`אי אפשר להמשיך: בכרטיס הלקוח חסר ${missingParts.join(', ')}. אפשר להשלים דרך "עריכת הלקוח" ולנסות שוב, או לבחור לקוח אחר.`);
        return;
      }
      // חסר אמצעי תקשורת נוסף (טלפון 2/אימייל) דורש אישור מנהל בפועל (לא רק אישור
      // חריגה של עובד רגיל) - לפי בקשת ההנהלה: 2 אמצעי תקשורת נדרשים, ורק מנהל יכול
      // לעקוף כשחסר. שאר השדות החסרים (לא קשורים לאמצעי תקשורת) ממשיכים באישור חריגה רגיל.
      if (missingContactMethod) {
        const auth = await verifyPin(
          `בכרטיס הלקוח חסר: ${missingParts.join(', ')}.\nלהמשך בלי אמצעי תקשורת נוסף נדרש אישור מנהל.\nאפשר גם לבטל ולהשלים את הפרטים דרך "עריכת הלקוח".`,
          'feature:missing_contact_approval'
        );
        if (!auth) return;
      } else {
        const confirmed = await window.customConfirm(
          `בכרטיס הלקוח חסר: ${missingParts.join(', ')}.\nלהמשיך בלי להשלים את הפרטים?`
        );
        if (!confirmed) return;
      }
    }

    setOrder(prev => ({ ...prev, customerId: existingCustomer.id, selectedCustomer: existingCustomer }));
    setStep(2);
    setDuplicateCustomers([]);
  };

  const proceedToStep2 = async () => {
    if (!order.customerId) {
       await showAlert('בחרו לקוח כדי להמשיך.');
       return;
    }
    if (!await confirmBlockedCustomerOverride(order.selectedCustomer)) return;
    setStep(2);
  };

  useEffect(() => {
    const hasDates = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
    if (hasDates) {
      setLoadingPreload(true);
      const queryParams = new URLSearchParams({
        isAbroad: order.isAbroad || false
      });
      if (order.eventDate) queryParams.append('eventDate', order.eventDate);
      if (order.fromDate) queryParams.append('fromDate', order.fromDate);
      if (order.toDate) queryParams.append('toDate', order.toDate);
      // The draft holds this screen's own items. Left in, they would be counted twice - once
      // in the server's bookings and again when calculateDynamicAvailability subtracts the
      // cart - and the sizes already chosen would show as unavailable. Read from the ref so a
      // draft appearing does not refetch the cache and wipe the size being picked.
      if (draftOrderIdRef.current) queryParams.append('excludeOrderId', draftOrderIdRef.current);

      fetch(`/api/inventory/preload?${queryParams.toString()}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load cache');
          return res.json();
        })
        .then(data => {
          setInventoryCache(data);
          setLoadingPreload(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingPreload(false);
        });
    } else {
      setInventoryCache(null);
    }
  }, [order.eventDate, order.fromDate, order.toDate, order.isAbroad]);

  const refreshInventory = () => {
    const hasDates = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
    if (hasDates) {
      setLoadingPreload(true);
      const queryParams = new URLSearchParams({
        isAbroad: order.isAbroad || false
      });
      if (order.eventDate) queryParams.append('eventDate', order.eventDate);
      if (order.fromDate) queryParams.append('fromDate', order.fromDate);
      if (order.toDate) queryParams.append('toDate', order.toDate);
      if (draftOrderIdRef.current) queryParams.append('excludeOrderId', draftOrderIdRef.current);

      queryParams.append('_t', new Date().getTime());

      fetch(`/api/inventory/preload?${queryParams.toString()}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load cache');
          return res.json();
        })
        .then(data => {
          setInventoryCache(data);
          setLoadingPreload(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingPreload(false);
        });
    }
  };

  useEffect(() => {
    const hasDates = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
    
    if (hasDates && newItem.dressModelId && inventoryCache) {
      setLoadingSizes(true);
      try {
        const localAvailability = calculateDynamicAvailability(
          newItem.dressModelId,
          order.isAbroad ? order.fromDate : order.eventDate,
          order.isAbroad ? order.toDate : null,
          inventoryCache,
          order.items,
          order.customSpacing
        );
        setAvailableSizes(localAvailability);
        
        setNewItem(prev => {
          if (prev.preserveSize) {
            const { preserveSize, ...rest } = prev;
            return rest;
          }
          return { ...prev, selectedSizes: [] };
        });
      } catch (err) {
        console.error('Error calculating local availability:', err);
      } finally {
        setLoadingSizes(false);
      }
    } else {
      setAvailableSizes([]);
    }
  }, [order.eventDate, order.fromDate, order.toDate, order.isAbroad, order.customSpacing, newItem.dressModelId, inventoryCache, order.items]);

  const handleOrderChange = (e) => {
    const { name, value, type, checked } = e.target;
    setOrder(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleDateChangeWithValidation = async (fieldOrUpdates, valueIfField) => {
    const isMulti = typeof fieldOrUpdates === 'object';
    const updates = isMulti ? fieldOrUpdates : { [fieldOrUpdates]: valueIfField };

    if (order.isAbroad) {
      const fromDateVal = 'fromDate' in updates ? updates.fromDate : order.fromDate;
      const toDateVal = 'toDate' in updates ? updates.toDate : order.toDate;
      if (fromDateVal && toDateVal && new Date(toDateVal) < new Date(fromDateVal)) {
        await showAlert('תאריך הסיום מוקדם מתאריך ההתחלה.');
        return;
      }
    }

    let proposedOrder = {
      ...order,
      ...updates
    };
    
    if (proposedOrder.isAbroad && ('fromDate' in updates || 'isAbroad' in updates)) {
      const fromDateVal = 'fromDate' in updates ? updates.fromDate : proposedOrder.fromDate;
      if (fromDateVal) {
        proposedOrder.eventDate = fromDateVal; // Sync eventDate
      }
    }

    const activeItems = order.items.filter(i => !i.isDeleted);
    
    if (activeItems.length > 0) {
      try {
        const validateRes = await fetch('/api/orders/validate-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: activeItems,
            eventDate: proposedOrder.eventDate,
            isAbroad: proposedOrder.isAbroad,
            isWeekdayEvent: proposedOrder.isWeekdayEvent,
            fromDate: proposedOrder.fromDate,
            toDate: proposedOrder.toDate,
            customSpacing: proposedOrder.customSpacing,
            // Don't count the draft's own pending items against it.
            orderId: draftOrderIdRef.current
          })
        });
        
        const validateData = await validateRes.json();
        if (validateData.error) {
          await showAlert(`בדיקת המלאי נכשלה: ${validateData.error}`);
          return;
        }
        if (!validateData.valid) {
          const errorLines = validateData.errors.map(e => {
            const msg = `• ${e.dressName}, מידה ${e.sizeText}: חסרות ${e.requested - e.available} יחידות`;
            return e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg;
          }).join('\n');
          const customSpacingNote = validateData.errors.some(e => e.isCustomSpacingIssue)
            ? '\n\nחלק מהחוסרים נובעים מציפוף מיוחד. אפשר לנסות ציפוף קטן פחות.'
            : '';
          await showAlert(`אי אפשר לשנות את התאריך: חסר מלאי בפריטים שכבר בהזמנה.\n\n${errorLines}${customSpacingNote}`);
          return;
        }
      } catch (err) {
        console.error('Validation fetch error', err);
        await showAlert('לא הצלחנו לבדוק מלאי מול השרת.');
        return; 
      }
    }
    
    setOrder(proposedOrder);
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // דיווחים 2fdff71a/f63ed2a2 (נווה יעקב): לפני כן אפשר היה לבחור מידה אחת בלבד לפני
  // "הוספת פריט" - כדי להוסיף עוד מידה מאותו דגם צריך היה לבחור מחדש את הדגם מההתחלה.
  // עכשיו בוחרים דגם פעם אחת, מסמנים כמה מידות (טוגל), ולוחצים הוספה פעם אחת - ר'
  // addItemToOrder למטה שמוסיף שורת סל נפרדת לכל מידה מסומנת.
  const toggleSizeSelection = (sizeText) => {
    setNewItem(prev => ({
      ...prev,
      selectedSizes: prev.selectedSizes.includes(sizeText)
        ? prev.selectedSizes.filter(s => s !== sizeText)
        : [...prev.selectedSizes, sizeText]
    }));
  };

  const addItemToOrder = async () => {
    if (newItem.selectedSizes.length === 0) {
      await showAlert('בחרו דגם ומידה אחת לפחות.');
      return;
    }

    // כשהתיקונים כבויים בהגדרות (settings.enable_alterations) שדות התיקון עצמם מוסתרים למטה
    // (ר' עטיפת ה-NocCollapsible "תיקונים לפריט"), אז הם תמיד ריקים.
    // בעבר זה חסם לגמרי הוספה לסל אם סומן תיקון בלי הערות טקסט חופשי - הלקוח (הגמח הראשי)
    // דיווח שזה מונע ממנו להוסיף פריט עם תיקון לסל. במקום לחסום, ממלאים הערות ברירת מחדל
    // מהתיוג שכבר סומן (צוואר/שרוול/אורך) כדי שהתופרת עדיין תדע מה נדרש.
    const itemToAdd = { ...newItem };
    if (settings.enable_alterations !== 'false' && (itemToAdd.neckAlteration || itemToAdd.sleeveAlteration || itemToAdd.lengthAlteration) && (!itemToAdd.repairs || !itemToAdd.repairs.trim())) {
      itemToAdd.repairs = describeAlterations(itemToAdd);
    }

    // בדיקת זמינות אחרונה ברגע הלחיצה (לא רק ברגע הסימון) - המלאי המקומי (availableSizes)
    // כבר מתעדכן live בכל שינוי ל-order.items, אבל בין הסימון ללחיצה על "הוספה" יכול לעבור זמן.
    const unavailable = [];
    const validSizes = [];
    for (const sizeText of newItem.selectedSizes) {
      const info = availableSizes.find(s => s.sizeText === sizeText);
      if (!info || info.availableQuantity <= 0) {
        unavailable.push(sizeText);
      } else {
        validSizes.push({ sizeText, sampleItemId: info.sampleItemId });
      }
    }
    if (validSizes.length === 0) {
      await showAlert('המידות שנבחרו אזלו לתאריך הזה.');
      return;
    }

    const maxItems = parseInt(settings.max_items_per_order);
    if (!isNaN(maxItems) && maxItems > 0 && order.items.length + validSizes.length > maxItems) {
      await showAlert(`מגבלת המערכת: עד ${maxItems} פריטים בהזמנה (נבחרו ${validSizes.length} מידות, ובסל כבר ${order.items.length}).`);
      return;
    }

    // מחיר מובא בנפרד לכל מידה (calculatePrice מקבל dressModelId+sizeText+eventDate, כלומר
    // המחיר יכול להיות שונה בין מידות של אותו דגם) - אותה קריאת API שהייתה קיימת קודם
    // לתצוגה-מקדימה, רק עכשיו מבוצעת פעם אחת לכל מידה נבחרת ברגע ההוספה עצמה.
    const prices = await Promise.all(validSizes.map(({ sizeText }) =>
      fetch(`/api/orders/pricing?dressModelId=${newItem.dressModelId}&sizeText=${sizeText}&eventDate=${order.eventDate || ''}`)
        .then(res => res.json())
        .catch(() => ({ basePrice: 0 }))
    ));

    const itemsToAdd = validSizes.map(({ sizeText, sampleItemId }, idx) => ({
      dressModelId: newItem.dressModelId,
      dressName: newItem.dressName,
      sizeText,
      sampleItemId,
      quantity: 1,
      basePrice: prices[idx]?.basePrice || 0,
      finalPrice: prices[idx]?.basePrice || 0,
      repairs: newItem.repairs,
      neckAlteration: newItem.neckAlteration,
      sleeveAlteration: newItem.sleeveAlteration,
      lengthAlteration: newItem.lengthAlteration
    }));

    setOrder(prev => ({
      ...prev,
      items: [...prev.items, ...itemsToAdd]
    }));

    // דגם ושם הדגם נשארים כמו שהם - כך שאפשר לסמן עוד מידות מאותו דגם בלי לבחור אותו
    // מחדש; רק בבחירת דגם אחר (OrderModelSelector.onChange) הם מתאפסים.
    setNewItem(prev => ({
      ...prev,
      selectedSizes: [],
      repairs: '',
      neckAlteration: false,
      sleeveAlteration: false,
      lengthAlteration: ''
    }));

    if (unavailable.length > 0) {
      await showAlert(`לא נוספו כי אזלו מהמלאי: ${unavailable.join(', ')}`);
    }
  };

  const removeItem = (index) => {
    setOrder(prev => {
      const updated = [...prev.items];
      const removedItem = updated[index];
      
      if (removedItem && removedItem.dressModelId === newItem.dressModelId) {
        setAvailableSizes(sizes => sizes.map(s => {
          if (s.sizeText === removedItem.sizeText) {
            return { ...s, availableQuantity: s.availableQuantity + 1 };
          }
          return s;
        }));
      }
      
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
  };

  const editItem = (index) => {
    const itemToEdit = order.items[index];
    setNewItem({
      dressModelId: itemToEdit.dressModelId || '',
      selectedSizes: itemToEdit.sizeText ? [itemToEdit.sizeText] : [],
      quantity: itemToEdit.quantity || 1,
      repairs: itemToEdit.repairs || '',
      dressName: itemToEdit.dressName || '',
      neckAlteration: itemToEdit.neckAlteration || false,
      sleeveAlteration: itemToEdit.sleeveAlteration || false,
      lengthAlteration: itemToEdit.lengthAlteration || '',
      preserveSize: true
    });
    
    removeItem(index);
    window.scrollTo({ top: document.body.scrollHeight / 2, behavior: 'smooth' });
  };


  useEffect(() => {
    if (order.items.length === 0) {
      setCalculatedData({ totalAmount: 0, items: [] });
      return;
    }
    setCalculating(true);
    fetch('/api/orders/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: order.items,
        eventDate: order.eventDate,
        isAbroad: order.isAbroad,
        isWeekdayEvent: order.isWeekdayEvent,
        isDelivery: order.isDelivery,
        deliveryCity: order.deliveryCity,
        deliveryDirection: order.deliveryDirection
      })
    })
      .then(res => res.json())
      .then(data => {
        setCalculatedData({
          totalAmount: data.totalAmount || 0,
          items: data.calculatedItems || []
        });
        setCalculating(false);
      })
      .catch(() => setCalculating(false));
  }, [order.items, order.eventDate, order.isAbroad, order.isWeekdayEvent, order.isDelivery, order.deliveryCity, order.deliveryDirection]);

  const totalAmount = calculatedData.totalAmount;

  useEffect(() => {
    const totalPaid = paymentsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
    const remainder = Math.max(0, totalAmount - totalPaid);
    setPayment(prev => ({ ...prev, amount: remainder }));
  }, [totalAmount, paymentsList]);

  // Autosave the cart as a draft order. Debounced - a keystroke in the notes field should not
  // rewrite the order - and only once the order has enough of itself to be worth keeping: a
  // customer, dates and at least one item. A failure here is logged and otherwise ignored; the
  // draft is a safety net, and blocking the screen over it would be worse than losing it.
  useEffect(() => {
    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    const hasDates = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
    if (draftSealedRef.current || !order.customerId || !hasDates || activeItems.length === 0) return;

    const timer = setTimeout(() => {
      draftQueueRef.current = draftQueueRef.current.then(async () => {
        if (draftSealedRef.current) return;
        try {
          const res = await fetch('/api/orders/draft', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderId: draftOrderIdRef.current,
              customerId: order.customerId,
              eventDate: order.eventDate,
              eventDateHebrew: order.eventDateHebrew,
              returnDate: order.returnDate,
              isAbroad: order.isAbroad,
              isWeekdayEvent: order.isWeekdayEvent,
              fromDate: order.fromDate,
              toDate: order.toDate,
              notes: order.notes,
              customSpacing: order.customSpacing,
              totalAmount,
              items: activeItems
            })
          });
          const saved = await res.json();
          if (res.ok && saved?.orderId && !draftSealedRef.current) {
            draftOrderIdRef.current = saved.orderId;
            setDraftOrderId(saved.orderId);
          }
        } catch (err) {
          console.error('Draft autosave failed', err);
        }
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [order.customerId, order.eventDate, order.eventDateHebrew, order.returnDate, order.isAbroad,
      order.isWeekdayEvent, order.fromDate, order.toDate, order.notes, order.customSpacing,
      order.items, totalAmount]);

  // מגן מפני איבוד נתונים בלחיצת "אחורה" בדפדפן (דיווח לקוח: "כשעושים אחורה בדפדפן הוא
  // מוחק את כל מה שעשיתי"). ה-draft האוטומטי למעלה מתחיל רק אחרי שיש גם לקוח וגם תאריכים
  // וגם פריט אחד לפחות - עד אז (ולפני זה, בזמן הקלדת פרטי לקוח חדש) אין רשת ביטחון. ברגע
  // שיש נתון משמעותי ראשון דוחפים רשומת "עצירה" אחת להיסטוריה; לחיצת אחורה שמגיעה אליה
  // מבקשת אישור לפני שבאמת יוצאים (ואז חוזרים אחורה פעם נוספת כדי להגיע לעמוד האמיתי שלפני).
  const backGuardArmedRef = useRef(false);
  const hasStartedOrderRef = useRef(false);

  useEffect(() => {
    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    const hasNewCustomerInput = Object.values(newCustomer).some(v => typeof v === 'string' ? v.trim() : !!v);
    hasStartedOrderRef.current = !!(
      order.customerId ||
      activeItems.length > 0 ||
      hasNewCustomerInput ||
      (phoneSearchInput && phoneSearchInput.trim())
    );

    if (hasStartedOrderRef.current && !backGuardArmedRef.current) {
      backGuardArmedRef.current = true;
      window.history.pushState({ gemachOrderGuard: true }, '', window.location.href);
    }
  }, [order.customerId, order.items, newCustomer, phoneSearchInput]);

  useEffect(() => {
    const handlePopState = () => {
      if (!backGuardArmedRef.current || !hasStartedOrderRef.current) return;
      // v3: החלונית אסינכרונית (לא חוסמת כמו window.confirm), לכן קודם מחזירים את רשומת העצירה
      // ואז שואלים. אישור יציאה = חזרה של שתי רשומות (העצירה החדשה + העמוד הנוכחי), כמו history.back() המקורי.
      window.history.pushState({ gemachOrderGuard: true }, '', window.location.href);
      if (leaveAskPendingRef.current) return;
      leaveAskPendingRef.current = true;
      new Promise((resolve) => setLeaveAsk({ resolve })).then((leave) => {
        leaveAskPendingRef.current = false;
        if (!leave) return;
        backGuardArmedRef.current = false;
        window.history.go(-2);
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Escape closes whichever modal is on top. Skipped while a charge/save is in
  // flight so nobody dismisses a modal mid-transaction.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape' || isProcessingCredit || saving) return;
      if (showQuickSwipeModal) setShowQuickSwipeModal(false);
      else if (showCreditModal) setShowCreditModal(false);
      else if (capacityModalItem) setCapacityModalItem(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [showQuickSwipeModal, showCreditModal, capacityModalItem, isProcessingCredit, saving]);

  const saveOrder = async () => {
    const hasDates = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
    if (!order.customerId) return await showAlert('בחרו לקוח כדי להמשיך.');
    if (!String(order.selectedCustomer?.phone1 || '').trim() && !String(order.selectedCustomer?.phone2 || '').trim()) {
      return await showAlert('אי אפשר לשמור הזמנה ללקוח בלי טלפון. השלימו טלפון בכרטיס הלקוח.');
    }
    if (!hasDates) return await showAlert(order.isAbroad || order.isWeekdayEvent ? 'בחרו טווח תאריכים לאירוע.' : 'בחרו תאריך לאירוע.');
    if (order.items.length === 0) return await showAlert('הוסיפו פריט אחד לפחות.');
    // שדות חובה של משלוח (כתובת כשעיר המשלוח שונה מעיר הלקוח / עיר משלוח כשעיר הלקוח
    // לא ברשימת ערי המשלוח) - נאכף תמיד, לא רק כש-delivery_allow_address_override דולק
    // (אותה תנאי בדיוק כמו האינדיקציה החזותית deliveryAddressRequired/deliveryCityRequired
    // למעלה - ר' דיווחים org2 f82e76c1, 136f8d4b/5133e518).
    const deliveryError = validateDeliveryFields(order, order.selectedCustomer?.city, deliveryPriceCities);
    if (deliveryError) return await showAlert(deliveryError);

    // חוסם שמירת הזמנה לתאריך שעבר בלי אישור מנהל, כדי למנוע הזמנות שנשמרות בטעות
    // לתאריך שכבר חלף. נבדק לפני חיוב אשראי/תשלום כדי לא לגבות כסף על הזמנה שתיחסם.
    const relevantDate = (order.isAbroad || order.isWeekdayEvent) ? order.fromDate : order.eventDate;
    if (relevantDate && new Date(relevantDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
      const auth = await verifyPin('התאריך שנבחר כבר עבר. לשמירת הזמנה לתאריך שעבר נדרש אישור מנהל. בחרו מנהל והזינו סיסמה:', 'feature:past_date_order_approval');
      if (!auth) return;
    }

    const pAmount = parseFloat(payment.amount) || 0;
    const totalPaidSoFar = paymentsList.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
    const totalWithCurrent = totalPaidSoFar + pAmount;
    const isManagerExitPayment = payment.method === 'יציאה באישור מנהל';
    const isCreditCardPayment = payment.method.includes('אשראי') && !payment.method.includes('חיצונית');

    if (!isManagerExitPayment) {
      if (totalWithCurrent < totalAmount) {
        await showAlert('התשלום עדיין לא מלא. הוסיפו את הסכום החסר, או בחרו "יציאה באישור מנהל". לפיצול בין כמה אמצעי תשלום אפשר ללחוץ על "הוספת תשלום" כמה פעמים.');
        return;
      }
    }

    if (pAmount > 0 && isCreditCardPayment && !creditProcessedConfirmation) {
      setCreditCardData({
        cardNumber: '',
        tokef: '',
        installments: 1,
        notes: '',
        amount: payment.amount
      });
      setCreditError('');
      setShowCreditModal(true);
      return;
    }

    // בדיקת רמת אישור מנהל: חלה גם על תשלום רגיל (לא אשראי) עם סכום, וגם על "יציאה
    // באישור מנהל" - כולל המקרה הטבעי שבו הסכום נשאר 0 (יציאה בלי גביית תשלום כלל).
    // לפני התיקון הבדיקה הותנתה כולה ב-pAmount > 0, כך שיציאה בלי תשלום דילגה עליה בשקט.
    if (isManagerExitPayment || (pAmount > 0 && !isCreditCardPayment)) {
      const level = settings.PAYMENT_APPROVAL_LEVEL || 'כולם';
      if (level === 'מנהל' || level === 'עובד' || level === 'מנהל סניף ומעלה') {
        // 2026-09-22: ההגדרה קובעת אם החלונית מופיעה בכלל; מי שרשאי לאשר נקבע בהרשאה
        // feature:payment_exit_approval (ברירת המחדל נגזרת מרמת ההגדרה: עובד / מנהל / מנהל סניף ומעלה,
        // ושורת הרשאה ב-/admin/permissions גוברת) - הבורר וה-verify-pin מכריעים באותה הכרעה.
        const authResult = await window.customAuthPrompt('סיום ההזמנה בלי תשלום מלא דורש אישור מורשה. בחרו משתמש והזינו סיסמה:', 'feature:payment_exit_approval');
        if (!authResult || !authResult.pin) {
          await showAlert('האישור בוטל, ההזמנה לא נשמרה.');
          return;
        }

        try {
          const res = await fetch('/api/auth/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:payment_exit_approval' })
          });
          const data = await res.json();
          if (!data.success) {
            await showAlert(data.error || 'הסיסמה שגויה או שאין הרשאה.');
            return;
          }
        } catch (err) {
          await showAlert('אימות המנהל נכשל.');
          return;
        }
      }
    }

    let finalPayments = [...paymentsList];
    if (isManagerExitPayment) {
      finalPayments.push({ ...payment, amount: 0, notes: `יציאה באישור מנהל (סכום מבוקש: ₪${payment.amount}) | ${payment.notes}` });
    } else if (pAmount > 0) {
      finalPayments.push({ ...payment, amount: pAmount });
    }
    executeSaveOrderForList(finalPayments);
  };

  const handleAddPaymentClick = () => {
    const pAmount = parseFloat(payment.amount) || 0;
    if (pAmount <= 0) return showAlert('הזינו סכום גדול מ-0.');

    if (payment.method.includes('אשראי') && !payment.method.includes('חיצונית')) {
        setCreditCardData({
          cardNumber: '',
          tokef: '',
          installments: 1,
          notes: payment.notes,
          amount: payment.amount
        });
        setCreditError('');
        setShowCreditModal(true);
    } else {
        setPaymentsList(prev => [...prev, { amount: pAmount, method: payment.method, notes: payment.notes }]);
        setPayment(prev => ({ ...prev, notes: '' }));
    }
  };

  const executeSaveOrderForList = async (finalPaymentsList, force = false) => {
    pendingSavePaymentsRef.current = finalPaymentsList;
    setSaving(true);
    // Stop the autosave and let whatever it already started finish, so the real save is not
    // racing a draft write into the same row.
    draftSealedRef.current = true;
    await draftQueueRef.current;

    // The screen stays open when a save is refused, so hand it back to the autosave - the
    // draft has to keep holding the dresses while the user sorts the problem out.
    const abandonSave = () => {
      draftSealedRef.current = false;
      setSaving(false);
    };

    // Inventory is validated server-side inside POST /api/orders itself (same
    // validateOrderItemsAvailability call) - checking it again here first was a redundant
    // round-trip + DB query on every successful save. The itemized error message below is
    // built from the server's own validationErrors instead, so the UX is unchanged.
    try {
      const itemsToSave = order.items.map((item, idx) => {
        const calcItem = calculatedData.items[idx];
        return {
          ...item,
          finalPrice: calcItem ? calcItem.calculatedPrice : item.finalPrice
        };
      });

      // 3 - פרטי הוראת קבע שנאספו על המסך הזה: או מ-order.hok* (נבחר לקוח קיים, ר'
      // renderHokFieldsForExistingCustomer) או מ-newCustomer.hok* (נבחר "לקוח חדש" - נשמרים גם
      // על Customer דרך handleSaveNewCustomerAndProceed, אבל עד כה מעולם לא הגיעו לתוך ההזמנה
      // עצמה, והשאירו את Order.hokDetails מת לגמרי). undefined משמעו "לא לגעת בשדה" בשרת.
      let hokDetailsPayload;
      if (settings.hok_enabled === 'true') {
        if (order.hokBankName || order.hokBankBranch || order.hokBankAccount || order.hokConsent) {
          hokDetailsPayload = JSON.stringify({
            bankName: order.hokBankName || '',
            bankBranch: order.hokBankBranch || '',
            bankAccount: order.hokBankAccount || '',
            consent: !!order.hokConsent
          });
        } else if (newCustomer.hokBankName || newCustomer.hokBankBranch || newCustomer.hokBankAccount || newCustomer.hokConsent) {
          hokDetailsPayload = JSON.stringify({
            bankName: newCustomer.hokBankName || '',
            bankBranch: newCustomer.hokBankBranch || '',
            bankAccount: newCustomer.hokBankAccount || '',
            consent: !!newCustomer.hokConsent
          });
        }
      }

      const payload = {
        customerId: order.customerId,
        eventDate: order.eventDate,
        eventDateHebrew: order.eventDateHebrew,
        returnDate: order.returnDate,
        isAbroad: order.isAbroad,
        isWeekdayEvent: order.isWeekdayEvent,
        fromDate: order.fromDate,
        toDate: order.toDate,
        notes: order.notes,
        customSpacing: order.customSpacing,
        totalAmount,
        items: itemsToSave,
        // 15 + 13/34 - משלוח, טלפוני וסניף
        isDelivery: !!order.isDelivery,
        deliveryDirection: order.deliveryDirection || null,
        deliveryAddress: order.deliveryAddress || null,
        deliveryCity: order.deliveryCity || null,
        isPhoneOrder: !!order.isPhoneOrder,
        branch: order.branch || null,
        pickupBranch: order.pickupBranch || null,
        // 19 - משלוח יוצא יום לפני האירוע במקום יומיים, פר-הזמנה (ר' checkbox למטה ליד
        // delivery_one_day_before_option) - נצרך ב-GET /api/deliveries לחישוב תאריך היציאה בפועל.
        deliveryOneDayBefore: !!order.deliveryOneDayBefore,
        ...(hokDetailsPayload !== undefined ? { hokDetails: hokDetailsPayload } : {}),
        paymentsList: finalPaymentsList,
        // Set once a card was charged: the order must be saved under the number that already
        // went out with the charge, not under a freshly allocated one.
        reservedOrderId,
        // The row the autosave already wrote. The save fills it in instead of creating a
        // second order next to the draft it came from.
        draftOrderId: draftOrderIdRef.current,
        // Set once the cashier has seen the "already saved" warning and chose to save a
        // separate order anyway, so the server doesn't block the same save a second time.
        forceDuplicate: force
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.status === 409 && data.duplicateOrder) {
        // Left as an open, fillable draft/hold rather than abandoned - the cashier may still
        // want to complete this exact save after checking the existing order.
        abandonSave();
        setDuplicateOrderWarning({ existingOrderId: data.existingOrderId });
        return;
      }
      if (res.status === 409 && data.validationErrors) {
        abandonSave();
        const errorLines = data.validationErrors.map(e => {
          const msg = `• ${e.dressName}, מידה ${e.sizeText}: חסרות ${e.requested - e.available} יחידות`;
          return e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg;
        }).join('\n');
        const customSpacingNote = data.validationErrors.some(e => e.isCustomSpacingIssue)
          ? '\n\nחלק מהחוסרים נובעים מציפוף מיוחד. אפשר לנסות ציפוף קטן פחות.'
          : '';
        await showAlert(`ההזמנה לא נשמרה: חסר מלאי בתאריכים שנבחרו.\n\n${errorLines}${customSpacingNote}`);
        return;
      }
      if (!res.ok) {
        const errorMessage = data.error || 'Failed to save order';
        const details = data.details ? ` (${data.details})` : '';
        throw new Error(errorMessage + details);
      }
      // The order is saved even when the pricing engine failed afterwards - show what went
      // wrong but still open it, so nobody saves a second copy thinking the first was lost.
      if (data.warning) await showAlert(data.warning);
      // 4 - הדפסה אוטומטית עם סיום יצירת הזמנה, מותנה ב-auto_print_on_order_create
      // (כבוי כברירת מחדל = ההתנהגות הקודמת, לפי כלל ההגדרות עם שחזור). אותו נתיב הדפסה
      // בדיוק כמו כפתור "הדפסה ומייל" -> "הזמנה" (OrderPrintMenu.js openPrint('order')).
      if (settings.auto_print_on_order_create === 'true' && data.orderId) {
        window.open(`/print/order?orderId=${data.orderId}&type=order`, '_blank');
      }
      // 42 - מסך יעד אחרי יצירת הזמנה, מותנה ב-order_new_redirect_screen (ברירת מחדל
      // "order" = ההתנהגות הקודמת, כרטיס ההזמנה שזה עתה נוצרה).
      const redirectHref = resolveOrderRedirectHref(settings.order_new_redirect_screen || 'order', {
        orderId: data.orderId,
        customerId: data.customerId,
      });
      // v3 (R20): התראה מעוצבת שנשמרת בפעמון - אחרי הנתיב המוצלח, לפני הניווט; כשל בה לא משפיע על הניווט.
      try {
        enqueueNotice({
          kind: 'success',
          title: 'ההזמנה נוצרה',
          text: `הזמנה #${data.orderId} · ${getCustomerFullName(order.selectedCustomer)}`,
          href: redirectHref === `/orders/${data.orderId}` ? null : (data.orderId ? `/orders/${data.orderId}` : null),
          persistToBell: true,
          dedupeKey: `order-created-${data.orderId}`
        });
      } catch (noticeErr) {
        console.error('order-created notice failed', noticeErr);
      }
      router.push(redirectHref);
    } catch (error) {
      console.error(error);
      await showAlert(`שמירת ההזמנה נכשלה: ${error.message}`);
      abandonSave();
    }
  };

  const handleConfirmDuplicateSave = () => {
    const paymentsList = pendingSavePaymentsRef.current;
    setDuplicateOrderWarning(null);
    executeSaveOrderForList(paymentsList, true);
  };

  const handleCancelDuplicateSave = () => {
    setDuplicateOrderWarning(null);
  };

  const selectedCustomerName = getCustomerFullName(order.selectedCustomer);

  // ===== מצב תצוגה של המסך החדש (הודעות, אישור יציאה) =====
  const [flash, setFlash] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const lastFlashedDraftRef = useRef(null);

  // חיווי שקט על שמירת הטיוטה — בלי זה האוטו-סייב לא נראה בשום מקום במסך.
  useEffect(() => {
    if (draftOrderId && lastFlashedDraftRef.current !== draftOrderId) {
      lastFlashedDraftRef.current = draftOrderId;
      setFlash({ type: 'ok', text: `נשמרה טיוטה #${draftOrderId}` });
    }
  }, [draftOrderId]);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 2800);
    return () => clearTimeout(timer);
  }, [flash]);

  const activeItems = (order.items || []).filter(i => !i.isDeleted);
  const datesFilled = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
  // f82e76c1 - כתובת משלוח הופכת לשדה חובה כשעיר המשלוח שונה מעיר הלקוח (כלומר לא מסתפקים
  // בכתובת המגורים הרגילה שלו) - כדי שלא יישלח משלוח בלי כתובת מדויקת ליעד אחר.
  const deliveryAddressRequired = isDeliveryAddressRequired(order, order.selectedCustomer?.city);
  const deliveryCityRequired = isDeliveryCityRequired(order, order.selectedCustomer?.city, deliveryPriceCities);
  const totalPaid = paymentsList.reduce((acc, p) => acc + (parseFloat(p.amount) || 0), 0);
  const remaining = Math.max(0, totalAmount - totalPaid);
  const repairsTotal = (calculatedData.items || []).reduce((acc, i) => acc + (parseFloat(i.repairsCost) || 0), 0);

  const eventDateLabel = order.isAbroad
    ? (order.fromDate && order.toDate ? `${getHebrewDateString(order.fromDate)} — ${getHebrewDateString(order.toDate)}` : '')
    : (order.eventDate ? getHebrewDateString(order.eventDate) : '');

  const spacingLabel = (order.customSpacing === null || order.customSpacing === undefined)
    ? 'רגיל (לפי המערכת)'
    : (order.customSpacing === 0 ? 'ללא רווח כלל' : order.customSpacing === 1 ? 'יום רווח אחד' : `${order.customSpacing} ימי רווח`);

  const alterationsChosen = !!(newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration);
  const alterationsSummary = [
    newItem.neckAlteration && 'צוואר',
    newItem.sleeveAlteration && 'שרוול',
    newItem.lengthAlteration && `אורך ${newItem.lengthAlteration}`
  ].filter(Boolean).join(', ');

  const describeAlterations = (item) => [
    item.neckAlteration && 'צוואר',
    item.sleeveAlteration && 'שרוול',
    item.lengthAlteration && `אורך (${item.lengthAlteration})`
  ].filter(Boolean).join(', ') || 'ללא תיקונים';

  const stepsMeta = [
    {
      id: 1, label: 'לקוח', enabled: true,
      value: order.customerId ? selectedCustomerName : ''
    },
    {
      id: 2, label: 'תאריכים', enabled: canNavigateToStep(2),
      lockedReason: 'קודם בוחרים לקוח.',
      value: datesFilled ? eventDateLabel : ''
    },
    {
      id: 3, label: 'פריטים', enabled: canNavigateToStep(3),
      lockedReason: 'קודם ממלאים תאריך.',
      value: activeItems.length ? `${activeItems.length} פריטים · ₪${(totalAmount || 0).toLocaleString('he-IL')}` : ''
    },
    {
      id: 4, label: 'סיכום', enabled: canNavigateToStep(4),
      lockedReason: 'קודם מוסיפים פריט אחד לפחות.',
      value: activeItems.length ? '' : 'בדיקה סופית'
    },
    {
      id: 5, label: 'תשלום', enabled: canNavigateToStep(5),
      lockedReason: 'קודם מוסיפים פריט אחד לפחות.',
      value: totalPaid > 0 ? `שולם ₪${totalPaid.toLocaleString('he-IL')}` : ''
    }
  ];

  const handleStepChange = (target) => {
    if (canNavigateToStep(target)) {
      setStep(target);
      return;
    }
    const meta = stepsMeta.find(s => s.id === target);
    if (meta && meta.lockedReason) showAlert(meta.lockedReason);
  };

  // ציפוף ימים מותאם — אותה בקרה של המסך הקודם: ציפוף קטן מברירת המחדל (3)
  // וגם קטן ממה שנבחר עד כה דורש אישור מנהל. המסך "רגע, בדקת מלאי?" (מודל
  // מותאם ולא customConfirm הגנרי) כדי לאפשר חץ שפותח את חיפוש התפוסה המהיר
  // בלי לצאת מזרימת ההזמנה.
  const handleSpacingChange = (val) => {
    const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : 3;
    const newSpacing = (val !== null && val !== undefined) ? val : 3;

    if (newSpacing < 3 && newSpacing < prevSpacing) {
      setPendingSpacingChange(val);
      return;
    }

    handleDateChangeWithValidation('customSpacing', val);
  };

  const confirmSpacingChange = async () => {
    const val = pendingSpacingChange;
    setPendingSpacingChange(null);

    const authResult = await window.customAuthPrompt('ציפוף ימים מיוחד דורש אישור מנהל. בחרו מנהל והזינו סיסמה:', 'feature:special_spacing_approval');
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:special_spacing_approval' })
      });
      const data = await res.json();
      if (!data.success) {
        await showAlert(data.error || 'הסיסמה שגויה או שאין הרשאה מספקת.');
        return;
      }
    } catch (err) {
      await showAlert('אימות המנהל נכשל.');
      return;
    }

    handleDateChangeWithValidation('customSpacing', val);
  };

  // תשלום שכבר חויב בפועל (נדרים) לא נמחק מכאן — מחיקה שלו הייתה מוחקת את
  // הרישום היחיד של חיוב אמיתי שכבר יצא לחברת האשראי.
  const isChargedPayment = (p) => (p.notes || '').includes('אישור נדרים');

  const removePayment = (index) => {
    const target = paymentsList[index];
    if (!target || isChargedPayment(target)) return;
    setPaymentsList(prev => prev.filter((_, i) => i !== index));
  };

  const handleExit = () => {
    if (activeItems.length > 0 || order.customerId) {
      setShowExitConfirm(true);
      return;
    }
    router.push('/orders');
  };

  const busy = saving || isProcessingCredit;

  // v3: אחרי "עריכה" מהסיכום — ברגע שהמשתמש מתקדם מהשלב שנערך חוזרים ישר לסיכום (STEPPER-PATTERNS #8).
  // ניווט בלבד; אין נגיעה במצב ההזמנה. שער השלבים (canNavigateToStep) נשאר כפי שהוא.
  useEffect(() => {
    if (!returnToSummary) return;
    if (step === 4) { setReturnToSummary(false); return; }
    if (step === 2 && editingStepRef.current === 1) { editingStepRef.current = 2; return; } // אחרי עריכת לקוח עוברים דרך שלב התאריכים (שדות משלוח)
    if (step > editingStepRef.current && canNavigateToStep(4)) {
      setReturnToSummary(false);
      setStep(4);
    }
  }, [step, returnToSummary]);

  // 3 - פרטי הוראת קבע כשנבחר לקוח קיים (טלפון/חיפוש-שם) - אותם שדות/תוויות בדיוק
  // כמו ב"פרטים נוספים" של לקוח חדש (ר' newCustomer.hok* למטה), רק ששומרים אותם על
  // order.hok* ומשגרים אותם כ-Order.hokDetails (JSON) בשמירה - ר' handleSaveNewCustomerAndProceed
  // מול payload ב-executeSaveOrderForList.
  const renderHokFieldsForExistingCustomer = () => {
    if (settings.hok_enabled !== 'true') return null;
    return (
      <Card variant="quiet" icon="card" title="הוראת קבע" level={3}>
        <div className="v3-stack">
          <Field label="בנק"><input type="text" value={order.hokBankName || ''} onChange={e => setOrder(prev => ({ ...prev, hokBankName: e.target.value }))} /></Field>
          <Field label="סניף"><input type="text" value={order.hokBankBranch || ''} onChange={e => setOrder(prev => ({ ...prev, hokBankBranch: e.target.value }))} /></Field>
          <Field label="חשבון"><input type="text" dir="ltr" value={order.hokBankAccount || ''} onChange={e => setOrder(prev => ({ ...prev, hokBankAccount: e.target.value }))} /></Field>
          <Switch checked={!!order.hokConsent} onChange={(v) => setOrder(prev => ({ ...prev, hokConsent: v }))} label="מאשרים גבייה אוטומטית בהוראת קבע במקרה של איחור או נזק" />
        </div>
      </Card>
    );
  };

  // ===== שלב האשף — עזרים של תצוגה בלבד (R8: אין שינוי לוגיקה) =====
  const narrow = { maxWidth: 'var(--v3-dlg-w)', marginInline: 'auto' };
  const fieldGroups = parseFieldGroups(settings.mandatory_field_groups);
  const missingPartsOf = (c) => [
    ...getMissingMandatoryCustomerFields(c).map(k => CUSTOMER_FIELD_LABELS[k]),
    ...unsatisfiedFieldGroupShortLabels(c, fieldGroups)
  ];
  const goEditFromSummary = (target) => {
    editingStepRef.current = target;
    setReturnToSummary(true);
    setStep(target);
  };
  const isMissingCity = deliveryCityRequired && !String(order.deliveryCity || '').trim();
  const isMissingAddress = deliveryAddressRequired && !String(order.deliveryAddress || '').trim();
  const step2Blocker = !datesFilled ? 'בחרו תאריך לאירוע כדי להמשיך.' : validateDeliveryFields(order, order.selectedCustomer?.city, deliveryPriceCities);

  // כרטיס שורות של לקוח (שורה לכל נתון, R15)
  const renderCustomerRows = (c) => (
    <Rows>
      <Row label="טלפון" icon="phone"><bdi dir="ltr">{c.phone1}</bdi></Row>
      {c.phone2 ? <Row label="טלפון נוסף" icon="phone"><bdi dir="ltr">{c.phone2}</bdi></Row> : null}
      {c.email ? <Row label="אימייל" icon="mail"><bdi dir="ltr">{c.email}</bdi></Row> : null}
      {c.city ? <Row label="כתובת" icon="pin">{c.city}{c.street ? `, ${c.street} ${c.houseNum || ''}` : ''}</Row> : null}
    </Rows>
  );

  const renderMissingBanner = (c, withLink = true) => {
    const parts = missingPartsOf(c);
    if (parts.length === 0) return null;
    return (
      <Banner
        kind="warning"
        title={`בכרטיס הלקוח חסר: ${parts.join(', ')}`}
        text={withLink ? (
          <a href={`/customers/${c.id}`} target="_blank" rel="noreferrer">השלמת פרטים בכרטיס הלקוח (נפתח בלשונית חדשה)</a>
        ) : undefined}
      />
    );
  };

  const nextLabelFor = (base) => (returnToSummary ? 'שמירה וחזרה לסיכום' : base);

  let nextBtn = null;
  if (step === 1) {
    nextBtn = { label: nextLabelFor('להמשך: תאריכים'), onClick: proceedToStep2, disabled: !order.customerId, tip: 'בחרו לקוח כדי להמשיך.' };
  } else if (step === 2) {
    nextBtn = { label: nextLabelFor('להמשך: פריטים'), onClick: () => setStep(3), disabled: !datesFilled || !!validateDeliveryFields(order, order.selectedCustomer?.city, deliveryPriceCities), tip: step2Blocker || 'בחרו תאריך כדי להמשיך.' };
  } else if (step === 3) {
    nextBtn = { label: nextLabelFor('להמשך: סיכום'), onClick: () => setStep(4), disabled: activeItems.length === 0, tip: 'הוסיפו פריט אחד לפחות כדי להמשיך.' };
  } else if (step === 4) {
    nextBtn = { label: 'להמשך: תשלום', onClick: () => setStep(5) };
  }
  const backLabels = { 2: 'חזרה ללקוח', 3: 'חזרה לתאריכים', 4: 'חזרה לפריטים', 5: 'חזרה לסיכום' };
  const alertHead = alertQueue[0] || null;

  return (
    <>
      <NewOrderShell
        step={step}
        steps={stepsMeta}
        onStepChange={(id) => { setReturnToSummary(false); handleStepChange(id); }}
        flash={flash}
        topBar={
          <>
            {draftOrderId && (
              <Btn variant="quiet" icon="link" href={`/orders/${draftOrderId}`} target="_blank" rel="noopener noreferrer" title="פתיחת הטיוטה בלשונית חדשה">
                <span>טיוטה <bdi>#{draftOrderId}</bdi></span>
              </Btn>
            )}
            <IconBtn variant="quiet" icon="x" label="יציאה מהמסך" title="יציאה מהמסך" onClick={handleExit} disabled={busy} />
          </>
        }
        footer={
          <>
            <div className="v3-cluster">
              {step === 5 ? (
                <Btn variant="primary" size="lg" icon="check" onClick={saveOrder} disabled={busy} loading={saving}>
                  {saving ? 'שומר...' : 'סיום ויצירת ההזמנה'}
                </Btn>
              ) : (
                <>
                  <Btn variant="primary" size="lg" iconEnd="next" onClick={nextBtn.onClick} disabled={nextBtn.disabled}>{nextBtn.label}</Btn>
                  {nextBtn.disabled && nextBtn.tip && <Tip label="למה אי אפשר להמשיך?">{nextBtn.tip}</Tip>}
                </>
              )}
            </div>
            {step === 1 ? (
              <Btn variant="quiet" icon="x" onClick={handleExit} disabled={busy}>ביטול</Btn>
            ) : (
              <Btn variant="quiet" icon="back" onClick={() => { setReturnToSummary(false); setStep(step - 1); }} disabled={busy}>{backLabels[step]}</Btn>
            )}
          </>
        }
      >
        {/* ==================== שלב 1 · לקוח ==================== */}
        {step === 1 && (
          <div className="v3-stack" style={narrow}>
            <h2 className="v3-h1">עבור מי ההזמנה?</h2>

            <Tabs
              label="דרך לבחירת לקוח"
              value={searchMode}
              onChange={(k) => { if (k === 'phone') { setSearchMode('phone'); setFoundCustomersFromPhone([]); } else setSearchMode(k); }}
              items={[
                { key: 'phone', label: 'לפי טלפון', icon: 'phone' },
                { key: 'name', label: 'מהרשימה', icon: 'search' },
                { key: 'new', label: 'לקוח חדש', icon: 'user' }
              ]}
            />

            {searchMode === 'phone' && foundCustomersFromPhone.length === 0 && (
              <Card icon="phone" title="חיפוש לפי טלפון" tip="מספר שלא קיים במערכת פותח כרטיס לקוח חדש עם המספר שהוזן.">
                <div className="v3-stack">
                  <Field id="cust-phone" label={<>מספר טלפון <Req /></>}>
                    <input
                      type="text"
                      inputMode="tel"
                      dir="ltr"
                      autoComplete="off"
                      value={phoneSearchInput}
                      onChange={e => setPhoneSearchInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                      placeholder="05..."
                      autoFocus
                    />
                  </Field>
                  <Btn variant="primary" icon="search" block onClick={handleCheckPhone} loading={isCheckingPhone}>
                    {isCheckingPhone ? 'מחפש...' : 'חיפוש לקוח'}
                  </Btn>
                </div>
              </Card>
            )}

            {searchMode === 'phone' && foundCustomersFromPhone.length > 0 && (
              <div className="v3-stack">
                {foundCustomersFromPhone.length > 1 && (
                  <Banner kind="warning" title={`נמצאו ${foundCustomersFromPhone.length} לקוחות עם הטלפון הזה`} text="בחרו את הלקוח הנכון." />
                )}
                {foundCustomersFromPhone.map((foundCustomer) => (
                  <Card key={foundCustomer.id} variant="cust">
                    <div className="v3-stack">
                      <div className="v3-cluster">
                        <span className="v3-avatar" aria-hidden="true">
                          {`${(foundCustomer.firstName || '')[0] || ''}${(foundCustomer.lastName || '')[0] || ''}`}
                        </span>
                        <b className="v3-h2">{getCustomerFullName(foundCustomer)}</b>
                        {foundCustomer.isBlocked && <Tag variant="attn">לקוח חסום</Tag>}
                      </div>
                      {renderCustomerRows(foundCustomer)}
                      {renderMissingBanner(foundCustomer)}
                      {foundCustomersFromPhone.length === 1 && renderHokFieldsForExistingCustomer()}
                      <div className="v3-cluster">
                        <Btn variant="primary" icon="check" onClick={() => handleUseExistingCustomer(foundCustomer)}>זה הלקוח</Btn>
                        {(getMissingMandatoryCustomerFields(foundCustomer).length > 0 || getUnsatisfiedFieldGroups(foundCustomer, fieldGroups).length > 0) && (
                          <Btn icon="edit" href={`/customers/${foundCustomer.id}`} target="_blank" rel="noreferrer">עריכת הלקוח</Btn>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
                <Btn
                  block
                  icon="user"
                  onClick={() => {
                    setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
                    setFoundCustomersFromPhone([]);
                    setSearchMode('new');
                  }}
                >
                  אף אחד מהם — לקוח חדש
                </Btn>
              </div>
            )}

            {searchMode === 'name' && (
              <Card icon="search" title="בחירה מהרשימה">
                <div className="v3-stack">
                  <div className="v3-field">
                    <span className="v3-label">שם, טלפון או עיר</span>
                    <CustomerSelector
                      value={order.selectedCustomer}
                      onChange={(c) => {
                        if (!c) { setOrder(prev => ({ ...prev, customerId: '', selectedCustomer: null })); return; }
                        setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }));
                      }}
                      placeholder="חפשו לקוח לפי שם, טלפון או עיר..."
                    />
                  </div>
                  {order.selectedCustomer && (
                    <>
                      <Rows>
                        <Row label="הלקוח שנבחר" icon="user">
                          <span className="v3-cluster">
                            <b>{selectedCustomerName}</b>
                            {order.selectedCustomer.isBlocked && <Tag variant="attn">לקוח חסום</Tag>}
                          </span>
                        </Row>
                        <Row label="טלפון" icon="phone"><bdi dir="ltr">{order.selectedCustomer.phone1 || ''}</bdi></Row>
                        {order.selectedCustomer.phone2 ? <Row label="טלפון נוסף" icon="phone"><bdi dir="ltr">{order.selectedCustomer.phone2}</bdi></Row> : null}
                        {order.selectedCustomer.email ? <Row label="אימייל" icon="mail"><bdi dir="ltr">{order.selectedCustomer.email}</bdi></Row> : null}
                      </Rows>
                      <div className="v3-cluster">
                        <Btn size="sm" icon="edit" href={`/customers/${order.selectedCustomer.id}`} target="_blank" rel="noreferrer">עריכת הלקוח</Btn>
                      </div>
                      {renderMissingBanner(order.selectedCustomer)}
                    </>
                  )}
                  {order.selectedCustomer && renderHokFieldsForExistingCustomer()}
                </div>
              </Card>
            )}

            {searchMode === 'new' && (
              <Card icon="user" title="פרטי הלקוח החדש">
                <div className="v3-stack" ref={newCustomerFormRef}>
                  {phoneSearchInput.trim() && (
                    <Banner
                      kind="info"
                      title="לא נמצא לקוח עם הטלפון שהוזן"
                      text="ייתכן שהמספר שמור אחרת. כדאי לחפש לפי שם לפני פתיחת כרטיס חדש."
                      action={{ label: 'חיפוש לפי שם', onClick: () => setSearchMode('name') }}
                    />
                  )}
                  <Field id="cust-firstName" label={<>שם פרטי <Req /></>}>
                    <input type="text" autoComplete="new-password" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({ ...prev, firstName: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} />
                  </Field>
                  <Field id="cust-lastName" label={<>שם משפחה <Req /></>}>
                    <input type="text" autoComplete="new-password" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({ ...prev, lastName: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} />
                  </Field>
                  <Field id="cust-phone1" label={<>טלפון <Req /></>}>
                    <input type="tel" dir="ltr" autoComplete="new-password" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({ ...prev, phone1: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} placeholder="נייד או קווי" />
                  </Field>
                  <Field id="cust-phone2" label={<>טלפון נוסף {isFieldRequiredByGroup('phone2', newCustomer, fieldGroups) && <Req />}</>}>
                    <input type="tel" dir="ltr" autoComplete="new-password" value={newCustomer.phone2} onChange={e => setNewCustomer(prev => ({ ...prev, phone2: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} placeholder="נייד או קווי" />
                  </Field>
                  <Field id="cust-email" label={<>אימייל {(settings.require_customer_email === 'true' || isFieldMandatoryFromPicker('email') || isFieldRequiredByGroup('email', newCustomer, fieldGroups)) && <Req />}</>}>
                    <input type="email" dir="ltr" autoComplete="new-password" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} placeholder="לשליחת ההזמנה במייל" />
                  </Field>
                  {newCustomer.email && !newCustomer.email.includes('@') && (
                    <div className="v3-cluster">
                      <Btn size="sm" onClick={() => setNewCustomer(prev => ({ ...prev, email: `${prev.email}@gmail.com` }))}>
                        <bdi dir="ltr">@gmail.com</bdi> — השלמה
                      </Btn>
                    </div>
                  )}
                  {unsatisfiedFieldGroupErrors(newCustomer, fieldGroups).map((msg, i) => (
                    <div key={i} className="v3-hint">{msg}</div>
                  ))}

                  <NocCollapsible
                    title="פרטים נוספים"
                    openWhen={settings.require_full_address === 'true' || isFieldMandatoryFromPicker('city') || isFieldMandatoryFromPicker('street') || isFieldMandatoryFromPicker('houseNum') || (settings.hide_marketing_consent_field !== 'true' && settings.require_marketing_consent === 'true') || settings.require_customer_id_number === 'true'}
                  >
                    <Field id="cust-city" label={<>עיר מגורים {(settings.require_full_address === 'true' || isFieldMandatoryFromPicker('city')) && <Req />}</>}>
                      <input type="text" list="cust-city-list" autoComplete="new-password" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({ ...prev, city: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} />
                    </Field>
                    <datalist id="cust-city-list">
                      {customerLocations.cities.map(c => <option key={c} value={c} />)}
                    </datalist>
                    <Field id="cust-street" label={<>רחוב {(settings.require_full_address === 'true' || isFieldMandatoryFromPicker('street')) && <Req />}</>}>
                      <input type="text" list="cust-street-list" autoComplete="new-password" value={newCustomer.street || ''} onChange={e => setNewCustomer(prev => ({ ...prev, street: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} />
                    </Field>
                    <datalist id="cust-street-list">
                      {customerLocations.streets.map(s => <option key={s} value={s} />)}
                    </datalist>
                    <Field id="cust-house" label={<>מספר בית {(settings.require_full_address === 'true' || isFieldMandatoryFromPicker('houseNum')) && <Req />}</>}>
                      <input type="text" autoComplete="new-password" value={newCustomer.houseNum || ''} onChange={e => setNewCustomer(prev => ({ ...prev, houseNum: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} />
                    </Field>
                    <Field
                      id="cust-zeout"
                      label={<>תעודת זהות {settings.require_customer_id_number === 'true' ? <Req /> : (settings.require_id_for_edit_cancel === 'true' && <span className="v3-faint v3-text-sm">(נדרשת לעריכה או ביטול בהמשך)</span>)}</>}
                    >
                      <input type="text" dir="ltr" autoComplete="off" value={newCustomer.zeout || ''} onChange={e => setNewCustomer(prev => ({ ...prev, zeout: e.target.value }))} onKeyDown={handleNewCustomerFieldEnter} placeholder="ת״ז" required={settings.require_customer_id_number === 'true'} />
                    </Field>
                    {settings.hide_marketing_consent_field !== 'true' && (
                      <Switch
                        checked={!!newCustomer.marketingConsent}
                        onChange={(v) => setNewCustomer(prev => ({ ...prev, marketingConsent: v }))}
                        label={<>מסכימים לקבל עדכונים ודיוורים {settings.require_marketing_consent === 'true' && <Req />}</>}
                      />
                    )}
                    {settings.hok_enabled === 'true' && (
                      <Card variant="quiet" icon="card" title="הוראת קבע" level={3}>
                        <div className="v3-stack">
                          <Field label="בנק"><input type="text" value={newCustomer.hokBankName || ''} onChange={e => setNewCustomer(prev => ({ ...prev, hokBankName: e.target.value }))} /></Field>
                          <Field label="סניף"><input type="text" value={newCustomer.hokBankBranch || ''} onChange={e => setNewCustomer(prev => ({ ...prev, hokBankBranch: e.target.value }))} /></Field>
                          <Field label="חשבון"><input type="text" dir="ltr" value={newCustomer.hokBankAccount || ''} onChange={e => setNewCustomer(prev => ({ ...prev, hokBankAccount: e.target.value }))} /></Field>
                          <Switch checked={!!newCustomer.hokConsent} onChange={(v) => setNewCustomer(prev => ({ ...prev, hokConsent: v }))} label="מאשרים גבייה אוטומטית בהוראת קבע במקרה של איחור או נזק" />
                        </div>
                      </Card>
                    )}
                  </NocCollapsible>

                  <Btn variant="primary" icon="check" block onClick={() => handleSaveNewCustomerAndProceed()}>שמירת הלקוח והמשך</Btn>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ==================== שלב 2 · תאריכים ==================== */}
        {step === 2 && (
          <div className="v3-stack" style={narrow}>
            <h2 className="v3-h1">לאיזה תאריך?</h2>

            <Seg
              label="סוג האירוע"
              value={!!order.isAbroad}
              onChange={(v) => handleDateChangeWithValidation('isAbroad', v)}
              options={[
                { value: false, label: 'אירוע רגיל', icon: 'calendar' },
                { value: true, label: 'חו"ל / תפוסה ארוכה', icon: 'calendar' }
              ]}
            />

            <Card icon="calendar" title={!order.isAbroad ? 'תאריך האירוע' : 'טווח תאריכים'} tip={order.isAbroad ? 'בחרו את יום ההתחלה ואת יום הסיום של ההשכרה.' : undefined}>
              <div className="v3-stack">
                {!order.isAbroad ? (
                  <div className="v3-field">
                    <span className="v3-label">תאריך אירוע <Req /></span>
                    <HebrewDatePicker value={order.eventDate} onChange={(date) => handleDateChangeWithValidation('eventDate', date)} />
                  </div>
                ) : (
                  <div className="v3-field">
                    <span className="v3-label">מתאריך עד תאריך <Req /></span>
                    <HebrewDateRangePicker
                      startDate={order.fromDate}
                      endDate={order.toDate}
                      onChange={(start, end) => handleDateChangeWithValidation({ fromDate: start, toDate: end })}
                    />
                  </div>
                )}

                <NocCollapsible
                  title={settings.hide_custom_spacing === 'true' ? 'הערות' : 'הערות וריווח ימים'}
                  badge={settings.hide_custom_spacing === 'true' ? (order.notes ? 'יש הערה' : null) : ((order.customSpacing !== null && order.customSpacing !== undefined) ? spacingLabel : (order.notes ? 'יש הערה' : null))}
                >
                  <Field
                    id="order-notes"
                    as="textarea"
                    label="הערות להזמנה"
                    name="notes"
                    rows={2}
                    value={order.notes}
                    onChange={handleOrderChange}
                    placeholder="בקשות מיוחדות, מה סוכם עם הלקוח..."
                  />

                  {settings.hide_custom_spacing !== 'true' && (
                    <div className="v3-field">
                      <span className="v3-label">
                        ריווח ימים בין השכרות
                        <Tip>
                          {(order.customSpacing === null || order.customSpacing === undefined)
                            ? 'ברירת המחדל של המערכת.'
                            : order.customSpacing < 3
                              ? 'ציפוף מיוחד משפיע על בדיקת המלאי בהזמנה הזו בלבד, מסמן אותה ודורש אישור מנהל.'
                              : 'ריווח מורחב: פחות זמינות לשאר ההזמנות.'}
                        </Tip>
                      </span>
                      <Seg
                        label="ריווח ימים בין השכרות"
                        value={String(order.customSpacing ?? null)}
                        onChange={(v) => handleSpacingChange(v === 'null' ? null : Number(v))}
                        options={[
                          { value: 'null', label: 'רגיל' },
                          { value: '0', label: 'ללא' },
                          { value: '1', label: 'יום' },
                          { value: '2', label: 'יומיים' },
                          { value: '3', label: '3 ימים' },
                          { value: '4', label: '4 ימים' }
                        ]}
                      />
                      {order.customSpacing !== null && order.customSpacing !== undefined && order.customSpacing < 3 && (
                        <div className="v3-hint">נדרש אישור מנהל</div>
                      )}
                    </div>
                  )}
                </NocCollapsible>
              </div>
            </Card>

            {/* משלוח, טלפוני וסניף (מותנה בהגדרות) */}
            {(settings.phone_order_marker_enabled === 'true' || settings.track_branch_on_order === 'true' || settings.branches_enabled === 'true' || settings.delivery_show_in_order !== 'false') && (
              <Card icon="truck" title="משלוח, סניף וטלפוני">
                <div className="v3-stack">
                  {settings.phone_order_marker_enabled === 'true' && (
                    <Tip content="הזמנה טלפונית וסניף ביצוע לא מסומנים יחד: סימון אחד מנקה את השני.">
                      <span>
                        <Switch
                          checked={!!order.isPhoneOrder}
                          label="הזמנה טלפונית"
                          onChange={() => setOrder(prev => { const next = !prev.isPhoneOrder; return { ...prev, isPhoneOrder: next, branch: next ? '' : prev.branch }; })}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setOrder(prev => { const next = !prev.isPhoneOrder; return { ...prev, isPhoneOrder: next, branch: next ? '' : prev.branch }; }); } }}
                        />
                      </span>
                    </Tip>
                  )}
                  {settings.track_branch_on_order === 'true' && (
                    <Field
                      as="select"
                      label="סניף ביצוע"
                      value={order.branch || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setOrder(prev => ({ ...prev, branch: val, isPhoneOrder: val ? false : prev.isPhoneOrder }));
                        try { if (val) localStorage.setItem('gemach_last_order_branch', val); } catch {}
                      }}
                    >
                      <option value="">בחרו סניף...</option>
                      {String(settings.branch_list || '').split(',').map(s => s.trim()).filter(Boolean).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </Field>
                  )}
                  {settings.branches_enabled === 'true' && (
                    <Field
                      as="select"
                      label="סניף איסוף"
                      value={order.pickupBranch || ''}
                      onChange={e => setOrder(prev => ({ ...prev, pickupBranch: e.target.value }))}
                    >
                      <option value="">בחרו סניף...</option>
                      {String(settings.branch_list || '').split(',').map(s => s.trim()).filter(Boolean).map(b => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </Field>
                  )}

                  {settings.enable_deliveries === 'true' && (
                    <>
                      <Switch checked={!!order.isDelivery} onChange={(v) => setOrder(prev => ({ ...prev, isDelivery: v }))} label="הזמנת משלוח" />
                      {order.isDelivery && (
                        <>
                          <Field as="select" label="כיוון המשלוח" value={order.deliveryDirection} onChange={e => setOrder(prev => ({ ...prev, deliveryDirection: e.target.value }))}>
                            <option value="הלוך">הלוך</option>
                            <option value="חזור">חזור</option>
                            <option value="הלוך-חזור">הלוך וחזור</option>
                          </Field>
                          <Field
                            id="delivery-city"
                            as="select"
                            label={<>עיר משלוח {deliveryCityRequired && <Req />}</>}
                            tip="העיר קובעת את מחיר המשלוח."
                            value={order.deliveryCity || ''}
                            onChange={e => setOrder(prev => ({ ...prev, deliveryCity: e.target.value }))}
                            error={isMissingCity ? 'עיר המגורים של הלקוח לא ברשימת ערי המשלוח. בחרו עיר משלוח.' : undefined}
                          >
                            <option value="">בחרו עיר…</option>
                            {[...new Set([...(order.deliveryCity ? [order.deliveryCity] : []), ...deliveryCityOptions])].map(c => <option key={c} value={c}>{c}</option>)}
                          </Field>
                          {(settings.delivery_allow_address_override === 'true' || deliveryAddressRequired) && (
                            <Field
                              label={<>כתובת משלוח שונה {deliveryAddressRequired && <Req />}</>}
                              error={isMissingAddress ? 'עיר המשלוח שונה מעיר הלקוח. הזינו כתובת למשלוח.' : undefined}
                            >
                              <input type="text" value={order.deliveryAddress || ''} onChange={e => setOrder(prev => ({ ...prev, deliveryAddress: e.target.value }))} placeholder="כתובת למשלוח (אם שונה ממגורים)" />
                            </Field>
                          )}
                          {settings.delivery_one_day_before_option === 'true' && (
                            <Switch checked={!!order.deliveryOneDayBefore} onChange={(v) => setOrder(prev => ({ ...prev, deliveryOneDayBefore: v }))} label="המשלוח יוצא יום לפני האירוע (ולא יומיים)" />
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ==================== שלב 3 · פריטים ==================== */}
        {step === 3 && (
          <div className="v3-stack">
            <h2 className="v3-h1">מה מזמינים?</h2>

            <Card icon="bag" title="הוספת פריט">
              <div className="v3-stack">
                <div className="v3-field">
                  <label className="v3-label" htmlFor="item-model">דגם <Req /></label>
                  <OrderModelSelector
                    inputId="item-model"
                    hasActiveItems
                    value={{ name: newItem.dressName }}
                    onChange={(model) => {
                      if (!model || !model.id) {
                        setNewItem(prev => ({
                          ...prev,
                          dressModelId: '',
                          dressName: '',
                          selectedSizes: []
                        }));
                        return;
                      }
                      setNewItem(prev => ({
                        ...prev,
                        dressModelId: model.id,
                        dressName: model.name,
                        selectedSizes: []
                      }));
                    }}
                    placeholder="חפשו דגם לפי שם או ברקוד..."
                  />
                </div>

                <div className="v3-field">
                  <div className="v3-cluster" style={{ justifyContent: 'space-between' }}>
                    <span className="v3-label" style={{ marginBottom: 0 }}>
                      מידות <Req />
                      <Tip>אפשר לסמן כמה מידות יחד. כל מידה נוספת כפריט נפרד בסל.</Tip>
                      {loadingSizes && <span className="v3-faint v3-text-sm">בודק זמינות...</span>}
                    </span>
                    <IconBtn variant="quiet" size="sm" icon="refresh" label="רענון זמינות המלאי" title="רענון זמינות המלאי" onClick={refreshInventory} disabled={loadingPreload || loadingSizes} />
                  </div>
                  <div className="v3-options v3-options--grid" style={{ marginTop: 'var(--v3-sp-2)' }}>
                    {availableSizes.length === 0 ? (
                      <p className="v3-hint">
                        {newItem.dressModelId ? 'אין מידות פנויות לתאריך הזה.' : 'בחרו דגם כדי לראות מידות פנויות.'}
                      </p>
                    ) : (
                      availableSizes.map(s => {
                        const normalAvail = s.withNormalBuffer?.availableQuantity ?? s.availableQuantity ?? 0;
                        const customAvail = s.withCustomSpacing?.availableQuantity;
                        const selectedAvail = s.withCustomSpacing ? customAvail : normalAvail;
                        const isAvailable = selectedAvail > 0;
                        const isSelected = newItem.selectedSizes.includes(s.sizeText);
                        const tooltipText = s.withCustomSpacing
                          ? `רגיל: ${normalAvail} | ציפוף: ${customAvail}${s.withCustomSpacing.gain > 0 ? ` (+${s.withCustomSpacing.gain})` : ''}`
                          : `זמין: ${normalAvail}`;
                        return (
                          <button
                            key={s.sizeText}
                            type="button"
                            className="v3-option"
                            disabled={!isAvailable}
                            aria-pressed={isSelected}
                            title={tooltipText}
                            onClick={() => toggleSizeSelection(s.sizeText)}
                          >
                            <span>
                              <b>{s.sizeText}</b>
                              <small>{!isAvailable ? 'אזל' : <><bdi>{normalAvail}</bdi> פנויות</>}
                                {isAvailable && s.withCustomSpacing && s.withCustomSpacing.gain > 0 && <> · <bdi>+{s.withCustomSpacing.gain}</bdi> בציפוף</>}
                              </small>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                {settings.enable_alterations !== 'false' && (
                  <NocCollapsible
                    title="תיקונים לפריט"
                    badge={alterationsChosen ? alterationsSummary : null}
                    openWhen={alterationsChosen}
                  >
                    <div className="v3-options v3-options--grid">
                      <button type="button" className="v3-option" aria-pressed={!!newItem.neckAlteration} onClick={() => handleNewItemChange({ target: { name: 'neckAlteration', value: !newItem.neckAlteration } })}>
                        <Icon name="scissors" /> צוואר
                      </button>
                      <button type="button" className="v3-option" aria-pressed={!!newItem.sleeveAlteration} onClick={() => handleNewItemChange({ target: { name: 'sleeveAlteration', value: !newItem.sleeveAlteration } })}>
                        <Icon name="scissors" /> שרוול
                      </button>
                    </div>
                    <Field label="קיצור אורך (ס״מ)">
                      <input
                        type="text"
                        inputMode="decimal"
                        name="lengthAlteration"
                        autoComplete="new-password"
                        value={newItem.lengthAlteration || ''}
                        onChange={handleNewItemChange}
                        placeholder="ס״מ"
                        aria-label="קיצור אורך בסנטימטרים"
                      />
                    </Field>
                    <Field
                      id="item-repairs"
                      label={<>פירוט לתופרת {alterationsChosen && <Req />}</>}
                      error={(alterationsChosen && !(newItem.repairs || '').trim()) ? 'כדאי לפרט מה בדיוק לתקן' : undefined}
                    >
                      <input
                        type="text"
                        name="repairs"
                        autoComplete="new-password"
                        value={newItem.repairs || ''}
                        onChange={handleNewItemChange}
                        placeholder="מה בדיוק לתקן..."
                      />
                    </Field>
                  </NocCollapsible>
                )}

                <Btn variant="primary" icon="plus" block onClick={addItemToOrder} disabled={newItem.selectedSizes.length === 0}>
                  {newItem.selectedSizes.length > 1 ? `הוספת ${newItem.selectedSizes.length} פריטים לסל` : 'הוספה לסל'}
                </Btn>
              </div>
            </Card>

            <Card
              icon="receipt"
              title={`בסל${activeItems.length ? ` · ${activeItems.length}` : ''}`}
              actions={calculating ? (
                <span className="v3-faint v3-text-sm v3-cluster"><Icon name="loader" loop /> מחשב מחירים...</span>
              ) : undefined}
            >
              {order.items.length === 0 ? (
                <Empty icon="bag" title="הסל ריק" text="הוסיפו פריט כדי להמשיך." />
              ) : (
                <div className="v3-stack">
                  <div className="v3-stack" role="region" aria-label="פריטים בסל" tabIndex={0}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="v3-item">
                        <div className="v3-item__top" style={{ cursor: 'default' }}>
                          <span className="v3-item__thumb"><Icon name="shirt" /></span>
                          <div className="v3-item__info">
                            <span className="v3-item__model">{item.dressName || 'דגם לא ידוע'} <span className="v3-item__size">{item.sizeText}</span></span>
                            {settings.enable_alterations !== 'false' && <span className="v3-item__meta">{describeAlterations(item)}</span>}
                          </div>
                          <b className="v3-item__price"><bdi>₪{(calculatedData.items[idx] ? calculatedData.items[idx].calculatedPrice : item.finalPrice) || 0}</bdi></b>
                        </div>
                        <div className="v3-item__acts" style={{ paddingInline: 'var(--v3-sp-5)', paddingBottom: 'var(--v3-sp-4)' }}>
                          <IconBtn variant="quiet" size="sm" icon="calendar" label="בדיקת תפוסה" title="בדיקת תפוסה לתאריך האירוע" onClick={() => setCapacityModalItem(item)} />
                          <IconBtn variant="quiet" size="sm" icon="edit" label="עריכת פריט" title="עריכת פריט" onClick={() => editItem(idx)} />
                          <IconBtn variant="danger" size="sm" icon="trash" label="הסרת פריט" title="הסרת פריט" onClick={async () => { if (await window.customConfirm('להסיר את הפריט מהסל?')) removeItem(idx); }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="v3-cluster" style={{ justifyContent: 'space-between' }}>
                    <span className="v3-muted">סה&quot;כ</span>
                    <b className="v3-h2"><bdi>₪{(totalAmount || 0).toLocaleString('he-IL')}</bdi></b>
                  </div>
                </div>
              )}
            </Card>

            {/* אותו order.notes כמו בשלב 2 (id שונה) */}
            <Card icon="edit" title="הערות להזמנה">
              <Field
                id="order-notes-step3"
                as="textarea"
                aria-label="הערות להזמנה"
                name="notes"
                rows={2}
                value={order.notes}
                onChange={handleOrderChange}
                placeholder="בקשות מיוחדות, מה סוכם עם הלקוח..."
              />
            </Card>
          </div>
        )}

        {/* ==================== שלב 4 · סיכום ==================== */}
        {step === 4 && (
          <div className="v3-stack" style={{ maxWidth: 'var(--v3-dlg-w)', marginInline: 'auto' }}>
            <h2 className="v3-h1">בדיקה לפני תשלום</h2>

            <Card icon="user" title="לקוח" actions={<Btn variant="quiet" size="sm" icon="edit" onClick={() => goEditFromSummary(1)}>עריכה</Btn>}>
              <Rows>
                <Row label="שם" icon="user">{selectedCustomerName}</Row>
                <Row label="טלפון" icon="phone"><bdi dir="ltr">{order.selectedCustomer?.phone1 || ''}</bdi></Row>
              </Rows>
            </Card>

            <Card icon="calendar" title="תאריכים" actions={<Btn variant="quiet" size="sm" icon="edit" onClick={() => goEditFromSummary(2)}>עריכה</Btn>}>
              <Rows>
                {order.isAbroad ? (
                  <>
                    <Row label="מתאריך" icon="calendar">{getHebrewDateString(order.fromDate)}</Row>
                    <Row label="עד תאריך" icon="calendar">{getHebrewDateString(order.toDate)}</Row>
                  </>
                ) : (
                  <Row label="תאריך האירוע" icon="calendar">{getHebrewDateString(order.eventDate)}</Row>
                )}
                {settings.hide_custom_spacing !== 'true' && order.customSpacing !== null && order.customSpacing !== undefined && (
                  <Row label="ריווח ימים" icon="clock">{spacingLabel}</Row>
                )}
                {order.notes && <Row label="הערות" icon="edit">{order.notes}</Row>}
              </Rows>
            </Card>

            <Card icon="bag" title={`פריטים (${order.items.length})`} actions={<Btn variant="quiet" size="sm" icon="edit" onClick={() => goEditFromSummary(3)}>עריכה</Btn>}>
              <div className="v3-stack">
                <div className="v3-stack" style={{ maxHeight: '42vh', overflowY: 'auto' }} role="region" aria-label="רשימת פריטים בהזמנה" tabIndex={0}>
                  {order.items.map((item, idx) => {
                    const calcItem = calculatedData.items[idx];
                    const displayPrice = calcItem ? calcItem.calculatedPrice : item.finalPrice;
                    const repairsCost = calcItem && calcItem.repairsCost ? calcItem.repairsCost : 0;
                    return (
                      <div key={idx} className="v3-item">
                        <div className="v3-item__top" style={{ cursor: 'default' }}>
                          <span className="v3-item__thumb"><Icon name="shirt" /></span>
                          <div className="v3-item__info">
                            <span className="v3-item__model">{item.dressName} <span className="v3-item__size">{item.sizeText}</span></span>
                            {settings.enable_alterations !== 'false' && (
                              <span className="v3-item__meta">
                                תיקונים: {describeAlterations(item)}
                                {repairsCost > 0 && <> (+<bdi>₪{repairsCost}</bdi>)</>}
                              </span>
                            )}
                          </div>
                          <b className="v3-item__price"><bdi>₪{displayPrice || 0}</bdi></b>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="v3-cluster" style={{ justifyContent: 'space-between' }}>
                  <span className="v3-muted">סה&quot;כ לתשלום</span>
                  <b className="v3-h2"><bdi>₪{(totalAmount || 0).toLocaleString('he-IL')}</bdi></b>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ==================== שלב 5 · תשלום ==================== */}
        {step === 5 && (
          <div className="v3-stack" style={{ maxWidth: 'var(--v3-dlg-w)', marginInline: 'auto' }}>
            <h2 className="v3-h1">תשלום ושמירה</h2>

            <Card icon="receipt" title="מצב התשלום">
              <Rows>
                <Row label="סה&quot;כ לתשלום" icon="receipt"><bdi>₪{(totalAmount || 0).toLocaleString('he-IL')}</bdi></Row>
                <Row label="שולם" icon="check-circle"><bdi>₪{totalPaid.toLocaleString('he-IL')}</bdi></Row>
                <Row label="יתרה" icon="wallet"><b><bdi>₪{remaining.toLocaleString('he-IL')}</bdi></b></Row>
              </Rows>
              {remaining > 0 && (
                <div style={{ marginTop: 'var(--v3-sp-4)' }}>
                  <Banner
                    kind="warning"
                    title={`נותרה יתרה של ₪${remaining.toLocaleString('he-IL')}`}
                    text="אפשר לסיים בלי תשלום מלא רק דרך אופן התשלום ״יציאה באישור מנהל״. זה ידרוש קוד מנהל."
                  />
                </div>
              )}
            </Card>

            <Card icon="wallet" title="תשלום חדש">
              <form onSubmit={(e) => { e.preventDefault(); handleAddPaymentClick(); }}>
                <div className="v3-stack">
                  <Field id="pay-amount" label="סכום לתשלום עכשיו (₪)">
                    <input
                      type="number"
                      value={payment.amount}
                      onChange={e => setPayment(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </Field>
                  <Field id="pay-method" as="select" label="אופן תשלום" value={payment.method} onChange={e => setPayment(prev => ({ ...prev, method: e.target.value }))}>
                    {paymentMethodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </Field>
                  <NocCollapsible title="הערה לתשלום" badge={payment.notes ? 'יש הערה' : null}>
                    <Field>
                      <input
                        type="text"
                        aria-label="הערה לתשלום"
                        value={payment.notes}
                        onChange={e => setPayment(prev => ({ ...prev, notes: e.target.value }))}
                        placeholder="מספר אישור, פרטי בנק, שם המשלם..."
                      />
                    </Field>
                  </NocCollapsible>
                  <div className="v3-cluster">
                    <Btn type="submit" icon="plus" disabled={busy}>הוספת תשלום</Btn>
                    {settings.nedarim_plus_enabled !== 'false' && (
                      <Btn
                        variant="primary"
                        icon="card"
                        disabled={busy}
                        onClick={() => {
                          setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: payment.notes, amount: payment.amount });
                          setCreditError('');
                          setShowCreditModal(true);
                        }}
                      >
                        חיוב באשראי
                      </Btn>
                    )}
                  </div>
                </div>
              </form>
            </Card>

            <Card icon="receipt" title="תשלומים שנרשמו">
              {paymentsList.length === 0 ? (
                <Empty icon="wallet" title="עוד לא נרשמו תשלומים" />
              ) : (
                <div className="v3-stack">
                  {paymentsList.map((p, idx) => (
                    <div key={idx} className="v3-item">
                      <div className="v3-item__top" style={{ cursor: 'default' }}>
                        <span className="v3-item__thumb"><Icon name="coin" /></span>
                        <div className="v3-item__info">
                          <span className="v3-item__model">{p.method}</span>
                          {p.notes && <span className="v3-item__meta">{p.notes}</span>}
                        </div>
                        <b className="v3-item__price"><bdi>₪{Number(p.amount).toLocaleString('he-IL')}</bdi></b>
                        <IconBtn
                          variant="danger"
                          size="sm"
                          icon="trash"
                          label="הסרת תשלום"
                          disabled={isChargedPayment(p)}
                          title={isChargedPayment(p) ? 'החיוב כבר בוצע, אי אפשר להסיר אותו' : 'הסרת תשלום'}
                          onClick={() => removePayment(idx)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}
      </NewOrderShell>

      {/* ==================== חלוניות ==================== */}
      {capacityModalItem && (
        <ItemCapacityModal
          item={capacityModalItem}
          order={order}
          isOpen={true}
          onClose={() => setCapacityModalItem(null)}
        />
      )}

      <Dialog
        open={pendingSpacingChange !== null && !showSpacingCapacitySearch}
        onClose={() => setPendingSpacingChange(null)}
        variant="confirm"
        icon="alert-tri"
        title="לבדוק מלאי לפני ציפוף?"
        sub="ציפוף מיוחד משפיע על בדיקת המלאי בהזמנה הזו בלבד, ומסמן אותה לאישור מנהל."
        actions={
          <>
            <Btn variant="primary" onClick={confirmSpacingChange}>כן, להמשיך</Btn>
            <Btn iconEnd="next" onClick={() => setShowSpacingCapacitySearch(true)}>חיפוש תפוסה מהיר</Btn>
            <Btn variant="quiet" onClick={() => setPendingSpacingChange(null)}>ביטול</Btn>
          </>
        }
      />

      {showSpacingCapacitySearch && (
        <CapacitySearchModal
          isOpen={showSpacingCapacitySearch}
          onClose={() => setShowSpacingCapacitySearch(false)}
        />
      )}

      <Dialog
        open={showExitConfirm}
        onClose={() => setShowExitConfirm(false)}
        variant="confirm"
        icon="logout"
        title="לצאת מההזמנה?"
        sub={draftOrderId
          ? `ההזמנה נשמרה כטיוטה #${draftOrderId} עם ${activeItems.length} פריטים. אפשר להמשיך אותה מרשימת ההזמנות.`
          : 'ההזמנה עוד לא נשמרה. יציאה עכשיו תמחק את מה שהוזן.'}
        actions={
          <>
            <Btn variant="primary" onClick={() => setShowExitConfirm(false)}>להמשיך בהזמנה</Btn>
            <Btn variant="danger" onClick={() => router.push('/orders')}>{draftOrderId ? 'יציאה (הטיוטה שמורה)' : 'יציאה בלי לשמור'}</Btn>
          </>
        }
      />

      <Dialog
        open={duplicateCustomers.length > 0}
        onClose={() => { if (!authBusyRef.current) setDuplicateCustomers([]); }}
        variant="confirm"
        icon="alert-tri"
        title={duplicateCustomers.length > 1 ? 'יש כמה לקוחות עם הטלפון הזה' : 'הלקוח כבר קיים'}
        sub={duplicateCustomers.length > 1
          ? 'אפשר לבחור באחד הכרטיסים הקיימים, או לפתוח כרטיס נוסף.'
          : 'הטלפון שהוזן שייך ללקוח קיים. אפשר להשתמש בכרטיס שלו, או לפתוח כרטיס נוסף.'}
        actions={
          <>
            <Btn variant="quiet" onClick={() => setDuplicateCustomers([])}>ביטול</Btn>
            <Btn variant="danger" onClick={() => handleSaveNewCustomerAndProceed(true)}>ליצור לקוח חדש בכל זאת</Btn>
          </>
        }
      >
        <div className="v3-stack" style={{ marginBottom: 'var(--v3-sp-4)' }}>
          {duplicateCustomers.map((duplicateCustomer) => {
            const parts = missingPartsOf(duplicateCustomer);
            return (
              <Card key={duplicateCustomer.id} variant="quiet">
                <div className="v3-stack">
                  <Rows>
                    <Row label="שם" icon="user">
                      <span className="v3-cluster">{getCustomerFullName(duplicateCustomer)}{duplicateCustomer.isBlocked && <Tag variant="attn">לקוח חסום</Tag>}</span>
                    </Row>
                    <Row label="טלפון" icon="phone"><bdi dir="ltr">{duplicateCustomer.phone1}{duplicateCustomer.phone2 ? ` | ${duplicateCustomer.phone2}` : ''}</bdi></Row>
                    <Row label="עיר" icon="pin">{duplicateCustomer.city || 'לא צוינה'}</Row>
                  </Rows>
                  {parts.length > 0 && (
                    <Banner
                      kind="warning"
                      title={`חסר בכרטיס: ${parts.join(', ')}`}
                      text={<a href={`/customers/${duplicateCustomer.id}`} target="_blank" rel="noreferrer">עריכת פרטי הלקוח</a>}
                    />
                  )}
                  <Btn variant="primary" icon="check" onClick={() => handleUseExistingCustomer(duplicateCustomer)}>להשתמש בלקוח הזה</Btn>
                </div>
              </Card>
            );
          })}
        </div>
      </Dialog>

      <Dialog
        open={!!duplicateOrderWarning}
        onClose={() => {}}
        closeOnScrim={false}
        variant="confirm"
        icon="alert-tri"
        title="ההזמנה כבר נשמרה"
        sub={duplicateOrderWarning ? `יש כבר הזמנה לאותו לקוח ולאותו תאריך: מס' ${duplicateOrderWarning.existingOrderId}. כדאי לבדוק אותה לפני שיוצרים הזמנה כפולה.` : undefined}
        actions={
          <>
            <Btn variant="primary" onClick={handleCancelDuplicateSave}>לבדוק את ההזמנה הקיימת</Btn>
            <Btn variant="danger" onClick={handleConfirmDuplicateSave}>לשמור בכל זאת כהזמנה נפרדת</Btn>
          </>
        }
      >
        {duplicateOrderWarning && (
          <div className="v3-cluster" style={{ marginBottom: 'var(--v3-sp-4)' }}>
            <Btn icon="link" href={`/orders/${duplicateOrderWarning.existingOrderId}`} target="_blank" rel="noopener noreferrer">
              <span>פתיחת הזמנה <bdi>#{duplicateOrderWarning.existingOrderId}</bdi></span>
            </Btn>
          </div>
        )}
      </Dialog>

      <Dialog
        open={showCreditModal}
        onClose={() => { if (!isProcessingCredit && !saving) setShowCreditModal(false); }}
        variant="form"
        icon="card"
        title="חיוב באשראי (נדרים פלוס)"
        actions={
          <>
            <Btn variant="quiet" onClick={() => setShowCreditModal(false)} disabled={isProcessingCredit}>ביטול</Btn>
            <Btn type="submit" form="credit-charge-form" variant="primary" icon="card" loading={isProcessingCredit}>
              {isProcessingCredit ? 'מבצע חיוב...' : 'חיוב ושמירת ההזמנה'}
            </Btn>
          </>
        }
      >
        <div className="v3-stack">
          <div className="v3-cluster">
            <Btn size="sm" icon="refresh" title="העברת כרטיס מהירה בקורא מגנטי" onClick={() => { setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}>
              העברה בקורא
            </Btn>
            <Tip>מעבירים את הכרטיס בקורא המגנטי והפרטים נקלטים לבד.</Tip>
          </div>

          {creditError && <Banner kind="alert" text={creditError} />}

          <form id="credit-charge-form" onSubmit={(e) => { e.preventDefault(); handleProcessCreditCard(); }}>
            <div className="v3-stack">
              <Field id="cc-number" label="מספר כרטיס (או העברה בקורא)">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={creditCardData.cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                  dir="ltr"
                />
              </Field>
              <Field id="cc-exp" label="תוקף (MM/YY)">
                <input type="text" autoComplete="cc-exp" value={creditCardData.tokef} onChange={handleTokefChange} placeholder="12/25" maxLength="5" dir="ltr" />
              </Field>
              <Field id="cc-amount" label="סכום לחיוב (₪)">
                <input type="number" value={creditCardData.amount} onChange={e => setCreditCardData(prev => ({ ...prev, amount: e.target.value }))} />
              </Field>
              <Field id="cc-installments" label="מספר תשלומים">
                <input type="number" min="1" max="12" value={creditCardData.installments} onChange={e => setCreditCardData(prev => ({ ...prev, installments: e.target.value }))} />
              </Field>
              <Field id="cc-notes" label="הערה לנדרים">
                <input type="text" value={creditCardData.notes} onChange={e => setCreditCardData(prev => ({ ...prev, notes: e.target.value }))} />
              </Field>
            </div>
          </form>
        </div>
      </Dialog>

      <Dialog
        open={showQuickSwipeModal}
        onClose={() => { if (!isProcessingCredit && !saving) setShowQuickSwipeModal(false); }}
        variant="confirm"
        icon="card"
        title="מעבירים כרטיס"
        sub="העבירו עכשיו את כרטיס האשראי בקורא המגנטי. הפרטים ייקלטו אוטומטית."
        actions={<Btn variant="quiet" onClick={() => setShowQuickSwipeModal(false)}>ביטול</Btn>}
      >
        <div className="v3-cluster" style={{ justifyContent: 'center', marginBottom: 'var(--v3-sp-4)' }}>
          <Icon name="loader" size="xl" loop />
        </div>
        <input
          autoFocus
          data-autofocus=""
          type="text"
          value={swipeInput}
          onChange={handleSwipeInputChange}
          onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
          onBlur={(e) => { if (showQuickSwipeModal) setTimeout(() => e.target?.focus(), 100); }}
          style={{ opacity: 0, position: 'absolute', top: '-1000px' }}
          aria-label="קלט קורא כרטיסים"
        />
      </Dialog>

      {/* חסימת המסך בזמן חיוב/שמירה: לא ניתנת לסגירה */}
      <Dialog
        open={busy}
        onClose={() => {}}
        closeOnScrim={false}
        variant="confirm"
        icon="loader"
        aria-busy="true"
        aria-label="פעולה מתבצעת"
        title={isProcessingCredit ? 'מבצעים חיוב מול נדרים פלוס' : 'יוצרים את ההזמנה'}
        sub={isProcessingCredit
          ? 'לא סוגרים את החלון עד שמגיע אישור מחברת האשראי.'
          : 'בודקים מלאי, רושמים פריטים ומחשבים חיובים. לא סוגרים את החלון.'}
      />

      {/* אישור יציאה בכפתור "אחורה" של הדפדפן (היה window.confirm) */}
      <Dialog
        open={!!leaveAsk}
        onClose={() => { const r = leaveAsk; setLeaveAsk(null); r?.resolve(false); }}
        variant="confirm"
        icon="logout"
        title="לצאת בלי לשמור?"
        sub="הוזנו נתונים בהזמנה שעוד לא נשמרו. יציאה תמחק אותם."
        actions={
          <>
            <Btn variant="primary" onClick={() => { const r = leaveAsk; setLeaveAsk(null); r?.resolve(false); }}>להישאר בהזמנה</Btn>
            <Btn variant="danger" onClick={() => { const r = leaveAsk; setLeaveAsk(null); r?.resolve(true); }}>לצאת ולמחוק</Btn>
          </>
        }
      />

      {/* הודעות (היו alert מובנה) — נחסמות עד אישור, כמו קודם */}
      <Dialog
        open={!!alertHead}
        onClose={() => { const h = alertHead; setAlertQueue(q => q.slice(1)); h?.resolve(); }}
        variant="confirm"
        icon="alert-circle"
        title="שימו לב"
        sub={alertHead ? <span style={{ whiteSpace: 'pre-line' }}>{alertHead.message}</span> : undefined}
        actions={<Btn variant="primary" data-autofocus="" onClick={() => { const h = alertHead; setAlertQueue(q => q.slice(1)); h?.resolve(); }}>הבנתי</Btn>}
      />
    </>
  );
}

// כוכבית שדה חובה (תצוגה בלבד; אין required מקורי כדי לא לשנות התנהגות שליחה)
function Req() {
  return <span className="v3-req" aria-hidden="true">*</span>;
}

/**
 * מגירה מתקפלת — כל מה שאינו חובה במסך יושב בתוכה, כדי שכל שלב יציג
 * רק את השדות שבאמת נדרשים כדי להתקדם (details/summary בשפת v3).
 */
function NocCollapsible({ title, badge, defaultOpen = false, openWhen = false, children }) {
  const [open, setOpen] = useState(defaultOpen || openWhen);
  // עריכת פריט קיים ממלאת שדות שיושבים בתוך המגירה — היא נפתחת כדי שלא יעלמו מהעין.
  useEffect(() => {
    if (openWhen) setOpen(true);
  }, [openWhen]);
  return (
    <details className="v3-collapse" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {title}
        {!open && badge ? <Badge variant="gold">{badge}</Badge> : null}
        <Icon name="chevron-down" className="v3-collapse__chev" />
      </summary>
      <div className="v3-collapse__in">{children}</div>
    </details>
  );
}
