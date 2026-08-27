'use client';

import React, { useState, useEffect, useRef } from 'react';
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
    : ['אשראי (דרך נדרים פלוס)', 'יציאה באישור מנהל'];
  if (settingsObj.nedarim_plus_enabled !== 'false') return raw;
  const withoutCredit = raw.filter(opt => !(opt.includes('אשראי') && !opt.includes('חיצונית')));
  return withoutCredit.length > 0 ? withoutCredit : ['יציאה באישור מנהל'];
};

export default function NewOrderPage() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);

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
  const [foundCustomerFromPhone, setFoundCustomerFromPhone] = useState(null);
  
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
  });
  
  const [newItem, setNewItem] = useState({
    dressModelId: '',
    sizeText: '',
    sampleItemId: '',
    quantity: 1,
    basePrice: 0,
    finalPrice: 0,
    repairs: '',
    dressName: ''
  });
  
  const [availableSizes, setAvailableSizes] = useState([]);
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
    firstName: '', lastName: '', phone1: '', phone2: '', email: '', city: '', street: '', houseNum: ''
  });

  const [duplicateCustomer, setDuplicateCustomer] = useState(null);

  const [paymentsList, setPaymentsList] = useState([]);

  const [payment, setPayment] = useState({
    amount: '',
    method: 'אשראי',
    notes: ''
  });

  const [settings, setSettings] = useState({});

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
       setCreditError('אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).');
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
          alert('תשלום חלקי עבר בהצלחה. יש להשלים את יתרת התשלום (או לצאת באישור מנהל) כדי לסיים את ההזמנה.');
        }
      } else {
        setCreditError(data.error || 'שגיאה בחיוב הכרטיס');
      }
    } catch (err) {
      setCreditError('שגיאת תקשורת בחיוב הכרטיס');
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

  const paymentMethodOptions = computePaymentMethodOptions(settings);

  const handleCheckPhone = async () => {
    if (!phoneSearchInput || phoneSearchInput.trim().length < 9) {
      alert('נא להזין מספר טלפון תקין');
      return;
    }
    
    setIsCheckingPhone(true);
    try {
      const res = await fetch(`/api/customers?search=${encodeURIComponent(phoneSearchInput.trim())}&limit=1`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        setFoundCustomerFromPhone(data.data[0]);
      } else {
        setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
        setFoundCustomerFromPhone(null);
        setSearchMode('new');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאה בחיפוש הלקוח');
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
    firstName: 'שם פרטי', lastName: 'שם משפחה', phone1: 'טלפון', email: 'אימייל', city: 'עיר', street: 'רחוב', houseNum: 'מספר בית'
  };

  // משותף בין טופס "לקוח חדש" (חסימה קשיחה) לבין אישור התאמת לקוח קיים
  // (חסימה רכה עם אפשרות לדלג באישור מפורש) — כדי ששני המסלולים יבדקו בדיוק אותם שדות.
  const getMissingMandatoryCustomerFields = (customerObj) => {
    const configuredMandatory = (settings.mandatory_fields || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    return Object.keys(CUSTOMER_FIELD_ALIASES).filter((key) => {
      const alwaysRequired = key === 'firstName' || key === 'lastName' || key === 'phone1';
      const isRequired = alwaysRequired || CUSTOMER_FIELD_ALIASES[key].some(alias => configuredMandatory.includes(alias.toLowerCase()));
      return isRequired && !String(customerObj[key] || '').trim();
    });
  };

  const handleSaveNewCustomerAndProceed = async (skipDuplicateCheck = false) => {
    const missingFields = getMissingMandatoryCustomerFields(newCustomer);

    if (missingFields.length > 0) {
       alert(`יש למלא: ${missingFields.map(k => CUSTOMER_FIELD_LABELS[k]).join(', ')}`);
       return;
    }

    if (!newCustomer.phone2.trim() && !newCustomer.email.trim()) {
       alert('כל הזמנה מחייבת 2 אמצעי תקשורת: יש למלא טלפון נוסף או כתובת מייל.');
       return;
    }

    if (skipDuplicateCheck !== true) {
      try {
        const res = await fetch(`/api/customers?phone=${encodeURIComponent(newCustomer.phone1)}&limit=1`);
        const data = await res.json();
        if (data.data && data.data.length > 0) {
          setDuplicateCustomer(data.data[0]);
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
         setDuplicateCustomer(null);
      } else {
         const errorMsg = data.error || 'שגיאה בשמירת לקוח';
         alert(`שגיאה בשמירת לקוח: ${errorMsg}`);
      }
    } catch (e) {
      alert(`שגיאה בשמירת לקוח: ${e.message}`);
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
      `לקוח זה חסום מהזמנות חדשות${customer.blockedReason ? ` (${customer.blockedReason})` : ''}.\nלעקוף את החסימה ולהמשיך בכל זאת? נדרש אישור הנהלה ראשית.`,
      'הנהלה ראשית'
    );
    return !!authResult;
  };

  // לחיצה על "כן, זה הלקוח" נתנה להמשיך גם כשחסרים פרטי חובה אצל הלקוח שנמצא.
  // עכשיו, אם חסר משהו, מבקשים אישור מפורש לדלג במקום להמשיך בשקט.
  const handleUseExistingCustomer = async (existingCustomer) => {
    if (!await confirmBlockedCustomerOverride(existingCustomer)) return;

    const missingFields = getMissingMandatoryCustomerFields(existingCustomer);
    const missingContactMethod = !String(existingCustomer.phone2 || '').trim() && !String(existingCustomer.email || '').trim();

    if (missingFields.length > 0 || missingContactMethod) {
      const missingParts = [
        ...missingFields.map(k => CUSTOMER_FIELD_LABELS[k]),
        ...(missingContactMethod ? ['אמצעי תקשורת נוסף (טלפון 2 או אימייל)'] : [])
      ];
      const confirmed = await window.customConfirm(
        `ללקוח זה חסרים פרטי חובה: ${missingParts.join(', ')}.\nהאם לאשר חריגה ולהמשיך בכל זאת בלי להשלים את הפרטים?`
      );
      if (!confirmed) return;
    }

    setOrder(prev => ({ ...prev, customerId: existingCustomer.id, selectedCustomer: existingCustomer }));
    setStep(2);
    setDuplicateCustomer(null);
  };

  const proceedToStep2 = async () => {
    if (!order.customerId) {
       alert('יש לבחור לקוח');
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
          return { ...prev, sizeText: '', sampleItemId: '', basePrice: 0, finalPrice: 0 };
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

  useEffect(() => {
    if (newItem.dressModelId && newItem.sizeText) {
      fetch(`/api/orders/pricing?dressModelId=${newItem.dressModelId}&sizeText=${newItem.sizeText}&eventDate=${order.eventDate || ''}`)
        .then(res => res.json())
        .then(data => {
          setNewItem(prev => ({
            ...prev,
            basePrice: data.basePrice,
            finalPrice: data.basePrice
          }));
        });
    }
  }, [newItem.sizeText, newItem.dressModelId, order.eventDate]);

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
        alert('שגיאה: תאריך החזרה (עד תאריך) אינו יכול להיות לפני תאריך ההתחלה (מתאריך)!');
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
          alert(`שגיאה בבדיקת מלאי: ${validateData.error}`);
          return;
        }
        if (!validateData.valid) {
          const errorLines = validateData.errors.map(e => {
            const msg = `- ${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`;
            return e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg;
          }).join('\n');
          const customSpacingNote = validateData.errors.some(e => e.isCustomSpacingIssue)
            ? '\n\n💡 הערה: כמה מהבעיות קשורות לציפוף מיוחד. אם אתה בוטל בציפוף, נסה לבחור ציפוף קטן יותר.'
            : '';
          alert(`לא ניתן לשנות את התאריך עקב חוסר במלאי לפריטים הקיימים בהזמנה:\n\n${errorLines}${customSpacingNote}`);
          return;
        }
      } catch (err) {
        console.error('Validation fetch error', err);
        alert('שגיאה בבדיקת המלאי מול השרת.');
        return; 
      }
    }
    
    setOrder(proposedOrder);
  };

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    if (name === 'sizeText') {
      const selectedSize = availableSizes.find(s => s.sizeText === value);
      setNewItem(prev => ({
        ...prev,
        sizeText: value,
        sampleItemId: selectedSize ? selectedSize.sampleItemId : ''
      }));
    } else {
      setNewItem(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const addItemToOrder = () => {
    if (!newItem.sampleItemId || !newItem.sizeText) {
      alert('יש לבחור דגם ומידה לפני ההוספה');
      return;
    }

    // כשהתיקונים כבויים בהגדרות (settings.enable_alterations) שדות התיקון עצמם מוסתרים למטה
    // (ר' עטיפת ה-NocCollapsible "תיקונים לפריט"), אז הם תמיד ריקים - אבל השארת הבדיקה בכל
    // מקרה עקבית עם התבנית ב-ModernItemsManager.handleConfirmItem
    if (settings.enable_alterations !== 'false' && (newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration) && (!newItem.repairs || !newItem.repairs.trim())) {
      alert('יש להזין פרטי תיקון (בהערות לתיקון) מכיוון שסימנת שנדרש תיקון (צוואר, שרוול, או אורך).');
      return;
    }

    const selectedSizeInfo = availableSizes.find(s => s.sizeText === newItem.sizeText);
    if (!selectedSizeInfo || selectedSizeInfo.availableQuantity <= 0) {
      alert('המידה שנבחרה אזלה מהמלאי לתאריך זה.');
      return;
    }

    const maxItems = parseInt(settings.max_items_per_order);
    if (!isNaN(maxItems) && maxItems > 0 && order.items.length >= maxItems) {
      alert(`הגבלת מערכת: לא ניתן להוסיף יותר מ-${maxItems} פריטים להזמנה.`);
      return;
    }
    
    setOrder(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem }]
    }));
    
    setAvailableSizes(prev => prev.map(s => {
      if (s.sizeText === newItem.sizeText) {
        return { ...s, availableQuantity: Math.max(0, s.availableQuantity - 1) };
      }
      return s;
    }));
    
    setNewItem({
      dressModelId: '',
      sizeText: '',
      sampleItemId: '',
      quantity: 1,
      basePrice: 0,
      finalPrice: 0,
      repairs: '',
      dressName: '',
      neckAlteration: false,
      sleeveAlteration: false,
      lengthAlteration: ''
    });
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
      sizeText: itemToEdit.sizeText || '',
      sampleItemId: itemToEdit.sampleItemId || '',
      quantity: itemToEdit.quantity || 1,
      basePrice: itemToEdit.basePrice || 0,
      finalPrice: itemToEdit.finalPrice || 0,
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
        isWeekdayEvent: order.isWeekdayEvent
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
  }, [order.items, order.eventDate, order.isAbroad, order.isWeekdayEvent]);

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
    if (!order.customerId) return alert('יש לבחור לקוח');
    if (!String(order.selectedCustomer?.phone1 || '').trim() && !String(order.selectedCustomer?.phone2 || '').trim()) {
      return alert('לא ניתן לסגור הזמנה ללקוח ללא מספר טלפון. יש להשלים מספר טלפון בכרטיס הלקוח.');
    }
    if (!hasDates) return alert(order.isAbroad || order.isWeekdayEvent ? 'יש לבחור תאריכים עבור אירוע חו"ל/מיוחד' : 'יש לבחור תאריך אירוע');
    if (order.items.length === 0) return alert('יש לבחור לפחות פריט אחד');

    // חוסם שמירת הזמנה לתאריך שעבר בלי אישור מנהל, כדי למנוע הזמנות שנשמרות בטעות
    // לתאריך שכבר חלף. נבדק לפני חיוב אשראי/תשלום כדי לא לגבות כסף על הזמנה שתיחסם.
    const relevantDate = (order.isAbroad || order.isWeekdayEvent) ? order.fromDate : order.eventDate;
    if (relevantDate && new Date(relevantDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0)) {
      const auth = await verifyPin('התאריך שנבחר להזמנה זו הוא תאריך שעבר. שמירת הזמנה לתאריך שעבר דורשת אישור מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
      if (!auth) return;
    }

    const pAmount = parseFloat(payment.amount) || 0;
    const totalPaidSoFar = paymentsList.reduce((acc, p) => acc + parseFloat(p.amount || 0), 0);
    const totalWithCurrent = totalPaidSoFar + pAmount;

    if (payment.method !== 'יציאה באישור מנהל') {
      if (totalWithCurrent < totalAmount) {
        alert('לא ניתן לסיים הזמנה לפני תשלום מלא. אנא הוסף את התשלום החסר, או בחר "יציאה באישור מנהל". כדי לפצל, השתמש בכפתור "פצל / הוסף תשלום זה".');
        return;
      }
    }

    if (pAmount > 0) {
      if (payment.method.includes('אשראי') && !payment.method.includes('חיצונית') && !creditProcessedConfirmation) {
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
      } else if (!(payment.method.includes('אשראי') && !payment.method.includes('חיצונית'))) {
        const level = settings.PAYMENT_APPROVAL_LEVEL || 'כולם';
        if (level === 'מנהל' || level === 'עובד') {
          const authResult = await window.customAuthPrompt(`פעולה זו דורשת הרשאת ${level}. אנא בחר משתמש והזן סיסמה:`, level);
          if (!authResult || !authResult.pin) {
            alert('אישור תשלום בוטל.');
            return;
          }
          
          try {
            const res = await fetch('/api/auth/verify-pin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: level })
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
    }

    let finalPayments = [...paymentsList];
    if (payment.method === 'יציאה באישור מנהל') {
      finalPayments.push({ ...payment, amount: 0, notes: `יציאה באישור מנהל (סכום מבוקש: ₪${payment.amount}) | ${payment.notes}` });
    } else if (pAmount > 0) {
      finalPayments.push({ ...payment, amount: pAmount });
    }
    executeSaveOrderForList(finalPayments);
  };

  const handleAddPaymentClick = () => {
    const pAmount = parseFloat(payment.amount) || 0;
    if (pAmount <= 0) return alert('יש להזין סכום גדול מ-0');

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
          const msg = `- ${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`;
          return e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg;
        }).join('\n');
        const customSpacingNote = data.validationErrors.some(e => e.isCustomSpacingIssue)
          ? '\n\n💡 הערה: כמה מהבעיות קשורות לציפוף מיוחד. אם אתה בוטל בציפוף, נסה לבחור ציפוף קטן יותר.'
          : '';
        alert(`לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים:\n\n${errorLines}${customSpacingNote}`);
        return;
      }
      if (!res.ok) {
        const errorMessage = data.error || 'Failed to save order';
        const details = data.details ? ` (${data.details})` : '';
        throw new Error(errorMessage + details);
      }
      // The order is saved even when the pricing engine failed afterwards - show what went
      // wrong but still open it, so nobody saves a second copy thinking the first was lost.
      if (data.warning) alert(data.warning);
      router.push(`/orders/${data.orderId}`);
    } catch (error) {
      console.error(error);
      alert(`שגיאה בשמירת הזמנה: ${error.message}`);
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
      lockedReason: 'יש לבחור לקוח תחילה',
      value: datesFilled ? eventDateLabel : ''
    },
    {
      id: 3, label: 'פריטים', enabled: canNavigateToStep(3),
      lockedReason: 'יש למלא תאריכים תחילה',
      value: activeItems.length ? `${activeItems.length} פריטים · ₪${(totalAmount || 0).toLocaleString('he-IL')}` : ''
    },
    {
      id: 4, label: 'סיכום', enabled: canNavigateToStep(4),
      lockedReason: 'יש להוסיף לפחות פריט אחד להזמנה',
      value: activeItems.length ? '' : 'בדיקה אחרונה'
    },
    {
      id: 5, label: 'תשלום', enabled: canNavigateToStep(5),
      lockedReason: 'יש להוסיף לפחות פריט אחד להזמנה',
      value: totalPaid > 0 ? `שולם ₪${totalPaid.toLocaleString('he-IL')}` : 'רישום תשלום וסיום'
    }
  ];

  const handleStepChange = (target) => {
    if (canNavigateToStep(target)) {
      setStep(target);
      return;
    }
    const meta = stepsMeta.find(s => s.id === target);
    if (meta && meta.lockedReason) alert(meta.lockedReason);
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

    const authResult = await window.customAuthPrompt('שינוי ציפוף ימים מיוחד להזמנה דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:', 'מנהל');
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מנהל' })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
        return;
      }
    } catch (err) {
      alert('שגיאה באימות קוד מנהל.');
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

  return (
    <>
      <NewOrderShell
        step={step}
        steps={stepsMeta}
        onStepChange={handleStepChange}
        flash={flash}
        topBar={
          <>
            {draftOrderId && (
              <a className="btn btn-ghost" href={`/orders/${draftOrderId}`} target="_blank" rel="noopener noreferrer" title="פתח את הטיוטה בכרטיסייה נפרדת">
                <svg className="icon"><use href="#i-link" /></svg> טיוטה #{draftOrderId}
              </a>
            )}
            <button type="button" className="btn btn-ghost btn-icon-only" onClick={handleExit} disabled={busy} title="יציאה מהמסך" aria-label="יציאה מהמסך">
              <svg className="icon"><use href="#i-x" /></svg>
            </button>
          </>
        }
        footer={
          <>
            {step > 1 && (
              <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)} disabled={busy}>
                <svg className="icon"><use href="#i-chevron-end" /></svg> חזור
              </button>
            )}
            {step === 1 && (
              <button type="button" className="btn btn-ghost" onClick={handleExit} disabled={busy}>ביטול</button>
            )}
            <span style={{ flex: 1 }} />
            {step === 1 && (
              <button type="button" className="btn btn-primary" onClick={proceedToStep2} disabled={!order.customerId}>
                המשך <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            )}
            {step === 2 && (
              <button type="button" className="btn btn-primary" onClick={() => setStep(3)} disabled={!datesFilled}>
                המשך לבחירת פריטים <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            )}
            {step === 3 && (
              <button type="button" className="btn btn-primary" onClick={() => setStep(4)} disabled={activeItems.length === 0}>
                המשך לסיכום <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            )}
            {step === 4 && (
              <button type="button" className="btn btn-primary" onClick={() => setStep(5)}>
                המשך לתשלום <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            )}
            {step === 5 && (
              <button type="button" className="btn btn-primary" onClick={saveOrder} disabled={busy} aria-busy={saving}>
                {saving ? <><span className="spinner" /> שומר...</> : <><svg className="icon"><use href="#i-check" /></svg> סיום ויצירת ההזמנה</>}
              </button>
            )}
          </>
        }
      >
        {/* ==================== שלב 1 · לקוח ==================== */}
        {step === 1 && (
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <h2>מי הלקוח?</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>חיפוש לפי טלפון, בחירה מהרשימה, או יצירת כרטיס לקוח חדש.</p>

            <div className="tabs">
              <button
                type="button"
                className={searchMode === 'phone' ? 'tab active' : 'tab'}
                style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }}
                onClick={() => { setSearchMode('phone'); setFoundCustomerFromPhone(null); }}
              >
                <svg className="icon"><use href="#i-phone" /></svg> לפי טלפון
              </button>
              <button
                type="button"
                className={searchMode === 'name' ? 'tab active' : 'tab'}
                style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }}
                onClick={() => setSearchMode('name')}
              >
                <svg className="icon"><use href="#i-search" /></svg> מהרשימה
              </button>
              <button
                type="button"
                className={searchMode === 'new' ? 'tab active' : 'tab'}
                style={{ background: 'none', borderTop: 'none', borderInlineStart: 'none', borderInlineEnd: 'none', font: 'inherit', cursor: 'pointer' }}
                onClick={() => setSearchMode('new')}
              >
                <svg className="icon"><use href="#i-user" /></svg> לקוח חדש
              </button>
            </div>

            {searchMode === 'phone' && !foundCustomerFromPhone && (
              <div className="card card-pad">
                <div className="field">
                  <label htmlFor="cust-phone">מספר טלפון <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    id="cust-phone"
                    type="tel"
                    dir="ltr"
                    className="input"
                    value={phoneSearchInput}
                    onChange={e => setPhoneSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                    placeholder="05..."
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={handleCheckPhone}
                  disabled={isCheckingPhone}
                >
                  {isCheckingPhone ? <><span className="spinner" /> מחפש...</> : <><svg className="icon"><use href="#i-search" /></svg> בדיקה והמשך</>}
                </button>
                <p className="field hint" style={{ margin: '14px 0 0', textAlign: 'center' }}>
                  מספר שלא קיים במערכת יפתח כרטיס לקוח חדש עם המספר שהוזן.
                </p>
              </div>
            )}

            {searchMode === 'phone' && foundCustomerFromPhone && (
              <div className="card card-pad">
                <div className="card-title-row" style={{ marginBottom: '14px' }}>
                  <div className="avatar">
                    {`${(foundCustomerFromPhone.firstName || '')[0] || ''}${(foundCustomerFromPhone.lastName || '')[0] || ''}`}
                  </div>
                  <div>
                    <strong style={{ fontSize: '15px' }}>
                      {getCustomerFullName(foundCustomerFromPhone)}
                      {foundCustomerFromPhone.isBlocked && (
                        <span className="badge badge-danger" style={{ marginInlineStart: '8px', fontSize: '11px' }}>לקוח חסום</span>
                      )}
                    </strong>
                    <p className="hint" style={{ color: 'var(--text-3)', margin: '2px 0 0' }}>
                      {foundCustomerFromPhone.phone1}
                      {foundCustomerFromPhone.phone2 ? ` · ${foundCustomerFromPhone.phone2}` : ''}
                      {foundCustomerFromPhone.email ? ` · ${foundCustomerFromPhone.email}` : ''}
                      {foundCustomerFromPhone.city ? ` · ${foundCustomerFromPhone.city}` : ''}
                      {foundCustomerFromPhone.street ? `, ${foundCustomerFromPhone.street} ${foundCustomerFromPhone.houseNum || ''}` : ''}
                    </p>
                  </div>
                </div>
                {!foundCustomerFromPhone.phone2 && !foundCustomerFromPhone.email && (
                  <p className="hint" style={{ color: 'var(--warning)', margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg className="icon" style={{ width: '14px', height: '14px' }}><use href="#i-alert-circle" /></svg>
                    חסר אמצעי תקשורת נוסף (טלפון 2 או אימייל) — כל הזמנה מחייבת 2 אמצעים.
                    {' '}
                    <a href={`/customers/${foundCustomerFromPhone.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                      עריכת פרטי לקוח
                    </a>
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary" style={{ flex: 1, minWidth: '160px' }} onClick={() => handleUseExistingCustomer(foundCustomerFromPhone)}>
                    <svg className="icon"><use href="#i-check" /></svg> כן, זה הלקוח
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
                      setFoundCustomerFromPhone(null);
                      setSearchMode('new');
                    }}
                  >לקוח אחר</button>
                </div>
              </div>
            )}

            {searchMode === 'name' && (
              <div className="card card-pad">
                <div className="field">
                  <label>חיפוש לפי שם, טלפון או עיר</label>
                  <CustomerSelector
                    value={order.selectedCustomer}
                    onChange={(c) => {
                      if (!c) { setOrder(prev => ({ ...prev, customerId: '', selectedCustomer: null })); return; }
                      setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }));
                    }}
                    placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                  />
                </div>
                {order.selectedCustomer && (
                  <div style={{ padding: '12px 4px 4px', borderTop: '1px solid var(--border)', marginTop: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="hint" style={{ color: 'var(--text-3)' }}>נבחר</span>
                      <strong>
                        {selectedCustomerName} <span className="hint" style={{ color: 'var(--text-3)', fontWeight: 600 }}>{order.selectedCustomer.phone1 || ''}</span>
                        {order.selectedCustomer.isBlocked && (
                          <span className="badge badge-danger" style={{ marginInlineStart: '8px', fontSize: '11px' }}>לקוח חסום</span>
                        )}
                      </strong>
                    </div>
                    {(order.selectedCustomer.phone2 || order.selectedCustomer.email) && (
                      <p className="hint" style={{ color: 'var(--text-3)', textAlign: 'end', margin: '2px 0 0' }}>
                        {[order.selectedCustomer.phone2, order.selectedCustomer.email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {!order.selectedCustomer.phone2 && !order.selectedCustomer.email && (
                      <p className="hint" style={{ color: 'var(--warning)', textAlign: 'end', margin: '4px 0 0' }}>
                        חסר אמצעי תקשורת נוסף —{' '}
                        <a href={`/customers/${order.selectedCustomer.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 700 }}>
                          עריכת פרטי לקוח
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {searchMode === 'new' && (
              <div className="card card-pad">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="cust-firstName">שם פרטי <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input id="cust-firstName" className="input" type="text" autoComplete="new-password" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({ ...prev, firstName: e.target.value }))} />
                  </div>
                  <div className="field">
                    <label htmlFor="cust-lastName">שם משפחה <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input id="cust-lastName" className="input" type="text" autoComplete="new-password" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({ ...prev, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="cust-phone1">טלפון <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input id="cust-phone1" className="input" type="tel" dir="ltr" autoComplete="new-password" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({ ...prev, phone1: e.target.value }))} placeholder="נייד או קווי" />
                </div>

                <p className="hint" style={{ margin: '0 0 6px', color: 'var(--text-2)' }}>
                  כל הזמנה מחייבת 2 אמצעי תקשורת — יש למלא לפחות אחד מהשניים:
                </p>
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="cust-phone2">טלפון נוסף <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input id="cust-phone2" className="input" type="tel" dir="ltr" autoComplete="new-password" value={newCustomer.phone2} onChange={e => setNewCustomer(prev => ({ ...prev, phone2: e.target.value }))} placeholder="נייד או קווי" />
                  </div>
                  <div className="field">
                    <label htmlFor="cust-email">אימייל <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input id="cust-email" className="input" type="email" dir="ltr" autoComplete="new-password" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} placeholder="לשליחת ההזמנה במייל" style={{ flex: 1 }} />
                      {newCustomer.email && !newCustomer.email.includes('@') && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ flexShrink: 0 }}
                          onClick={() => setNewCustomer(prev => ({ ...prev, email: `${prev.email}@gmail.com` }))}
                        >
                          השלם ל- @gmail.com
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <NocCollapsible title="פרטים נוספים">
                  <div className="form-grid">
                    <div className="field">
                      <label htmlFor="cust-city">עיר מגורים</label>
                      <input id="cust-city" className="input" type="text" autoComplete="new-password" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({ ...prev, city: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="cust-street">רחוב</label>
                      <input id="cust-street" className="input" type="text" autoComplete="new-password" value={newCustomer.street || ''} onChange={e => setNewCustomer(prev => ({ ...prev, street: e.target.value }))} />
                    </div>
                    <div className="field">
                      <label htmlFor="cust-house">מספר בית</label>
                      <input id="cust-house" className="input" type="text" autoComplete="new-password" value={newCustomer.houseNum || ''} onChange={e => setNewCustomer(prev => ({ ...prev, houseNum: e.target.value }))} />
                    </div>
                  </div>
                </NocCollapsible>

                <button type="button" className="btn btn-primary" style={{ width: '100%', marginTop: '16px' }} onClick={() => handleSaveNewCustomerAndProceed()}>
                  <svg className="icon"><use href="#i-check" /></svg> שמור לקוח והמשך
                </button>
              </div>
            )}
          </div>
        )}

        {/* ==================== שלב 2 · תאריכים ==================== */}
        {step === 2 && (
          <div style={{ maxWidth: '520px', margin: '0 auto' }}>
            <h2>מתי האירוע?</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>התאריך קובע את חישוב המלאי ואת מועדי הלקיחה וההחזרה.</p>

            <div className="pill-tabs" style={{ marginBottom: '14px' }}>
              <button
                type="button"
                className={`pill-tab${!order.isAbroad ? ' active' : ''}`}
                aria-pressed={!order.isAbroad}
                onClick={() => handleDateChangeWithValidation('isAbroad', false)}
              >אירוע רגיל</button>
              <button
                type="button"
                className={`pill-tab${order.isAbroad ? ' active' : ''}`}
                aria-pressed={!!order.isAbroad}
                onClick={() => handleDateChangeWithValidation('isAbroad', true)}
              >חו&quot;ל / תפוסה ארוכה</button>
            </div>

            <div className="card card-pad">
              {!order.isAbroad ? (
                <div className="field">
                  <label>תאריך אירוע <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <HebrewDatePicker value={order.eventDate} onChange={(date) => handleDateChangeWithValidation('eventDate', date)} />
                </div>
              ) : (
                <div className="field">
                  <label>טווח תאריכים (מתאריך עד תאריך) <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <HebrewDateRangePicker
                    startDate={order.fromDate}
                    endDate={order.toDate}
                    onChange={(start, end) => handleDateChangeWithValidation({ fromDate: start, toDate: end })}
                  />
                </div>
              )}

              <NocCollapsible
                title="הערות וריווח ימים"
                badge={(order.customSpacing !== null && order.customSpacing !== undefined) ? spacingLabel : (order.notes ? 'יש הערה' : null)}
              >
                <div className="field">
                  <label htmlFor="order-notes">הערות כלליות להזמנה</label>
                  <textarea
                    id="order-notes"
                    name="notes"
                    className="textarea"
                    rows={2}
                    value={order.notes}
                    onChange={handleOrderChange}
                    placeholder="בקשות מיוחדות, סיכומים עם הלקוח..."
                  />
                </div>

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>ריווח ימים בין השכרות</label>
                  <div className="pill-tabs">
                    {[
                      { val: null, label: 'רגיל' },
                      { val: 0, label: 'ללא' },
                      { val: 1, label: 'יום' },
                      { val: 2, label: 'יומיים' },
                      { val: 3, label: '3 ימים' },
                      { val: 4, label: '4 ימים' }
                    ].map(opt => {
                      const on = order.customSpacing === opt.val;
                      return (
                        <button
                          key={String(opt.val)}
                          type="button"
                          className={`pill-tab${on ? ' active' : ''}`}
                          aria-pressed={on}
                          onClick={() => handleSpacingChange(opt.val)}
                        >{opt.label}</button>
                      );
                    })}
                  </div>
                  <p className="hint" style={{ marginTop: '8px', color: (order.customSpacing !== null && order.customSpacing !== undefined && order.customSpacing < 3) ? 'var(--warning)' : 'var(--text-3)' }}>
                    {(order.customSpacing === null || order.customSpacing === undefined)
                      ? 'ברירת המחדל של המערכת.'
                      : order.customSpacing < 3
                        ? 'ציפוף מיוחד — משפיע על בדיקת המלאי להזמנה זו בלבד, מסמן את ההזמנה ודורש אישור מנהל.'
                        : 'ריווח מורחב — פחות זמינות לשאר ההזמנות.'}
                  </p>
                </div>
              </NocCollapsible>
            </div>
          </div>
        )}

        {/* ==================== שלב 3 · פריטים ==================== */}
        {step === 3 && (
          <div>
            <h2>אילו פריטים?</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>בחירת דגם ומידה — הסל והמחיר מתעדכנים בזמן אמת.</p>

            <div className="two-col">
              {/* --- הוספת פריט --- */}
              <div className="card card-pad">
                <div className="card-title-row" style={{ marginBottom: '14px' }}>
                  <svg className="icon"><use href="#i-bag" /></svg>
                  <h3 style={{ margin: 0 }}>הוספת פריט</h3>
                </div>

                <div className="field">
                  <label htmlFor="item-model">דגם <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <OrderModelSelector
                    inputId="item-model"
                    value={{ name: newItem.dressName }}
                    onChange={(model) => {
                      if (!model || !model.id) {
                        setNewItem(prev => ({
                          ...prev,
                          dressModelId: '',
                          dressName: '',
                          sizeText: '',
                          sampleItemId: '',
                          basePrice: 0,
                          finalPrice: 0
                        }));
                        return;
                      }
                      setNewItem(prev => ({
                        ...prev,
                        dressModelId: model.id,
                        dressName: model.name,
                        sizeText: '',
                        sampleItemId: '',
                        basePrice: 0,
                        finalPrice: 0
                      }));
                    }}
                    placeholder="חפש דגם פריט..."
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-2)' }}>
                    מידה <span style={{ color: 'var(--danger)' }}>*</span>
                    {loadingSizes && <span style={{ fontWeight: 400 }}> (בודק זמינות...)</span>}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon-only btn-sm"
                    onClick={refreshInventory}
                    disabled={loadingPreload || loadingSizes}
                    title="רענן זמינות מלאי"
                    aria-label="רענן זמינות מלאי"
                  >
                    <svg className="icon"><use href="#i-refresh" /></svg>
                  </button>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px', minHeight: '38px', alignItems: 'center' }}>
                  {availableSizes.length === 0 ? (
                    <p className="hint">
                      {newItem.dressModelId ? 'אין מידות זמינות לתאריך זה.' : 'בחר דגם כדי לראות מידות זמינות.'}
                    </p>
                  ) : (
                    availableSizes.map(s => {
                      const normalAvail = s.withNormalBuffer?.availableQuantity ?? s.availableQuantity ?? 0;
                      const customAvail = s.withCustomSpacing?.availableQuantity;
                      const selectedAvail = s.withCustomSpacing ? customAvail : normalAvail;
                      const isAvailable = selectedAvail > 0;
                      const isSelected = newItem.sizeText === s.sizeText;
                      const tooltipText = s.withCustomSpacing
                        ? `רגיל: ${normalAvail} | ציפוף: ${customAvail}${s.withCustomSpacing.gain > 0 ? ` (+${s.withCustomSpacing.gain})` : ''}`
                        : `זמין: ${normalAvail}`;

                      return (
                        <button
                          key={s.sizeText}
                          type="button"
                          className={`pill-tab${isSelected ? ' active' : ''}`}
                          disabled={!isAvailable}
                          aria-pressed={isSelected}
                          title={tooltipText}
                          style={!isAvailable ? { opacity: 0.45, textDecoration: 'line-through' } : undefined}
                          onClick={() => handleNewItemChange({ target: { name: 'sizeText', value: s.sizeText } })}
                        >
                          {s.sizeText}{' '}
                          <span style={{ opacity: 0.75, fontWeight: 600 }}>
                            {!isAvailable ? '· אזל' : `· ${normalAvail} פנויות`}
                          </span>
                          {isAvailable && s.withCustomSpacing && s.withCustomSpacing.gain > 0 && (
                            <span style={{ color: 'var(--success)', fontWeight: 800 }}> +{s.withCustomSpacing.gain}</span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

                {settings.enable_alterations !== 'false' && (
                  <NocCollapsible
                    title="תיקונים לפריט"
                    badge={alterationsChosen ? alterationsSummary : null}
                    openWhen={alterationsChosen}
                  >
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        aria-pressed={!!newItem.neckAlteration}
                        className={`pill-tab${newItem.neckAlteration ? ' active' : ''}`}
                        onClick={() => handleNewItemChange({ target: { name: 'neckAlteration', value: !newItem.neckAlteration } })}
                      >
                        <svg className="icon"><use href="#i-scissors" /></svg> צוואר
                      </button>
                      <button
                        type="button"
                        aria-pressed={!!newItem.sleeveAlteration}
                        className={`pill-tab${newItem.sleeveAlteration ? ' active' : ''}`}
                        onClick={() => handleNewItemChange({ target: { name: 'sleeveAlteration', value: !newItem.sleeveAlteration } })}
                      >
                        <svg className="icon"><use href="#i-scissors" /></svg> שרוול
                      </button>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-2)' }}>
                        אורך
                        <input
                          type="text"
                          inputMode="decimal"
                          name="lengthAlteration"
                          className="input"
                          style={{ width: '70px', padding: '6px 8px' }}
                          value={newItem.lengthAlteration || ''}
                          onChange={handleNewItemChange}
                          placeholder="ס״מ"
                          aria-label="קיצור אורך בסנטימטרים"
                        />
                        ס״מ
                      </span>
                    </div>

                    <div className="field" style={{ marginTop: '14px', marginBottom: 0 }}>
                      <label htmlFor="item-repairs">
                        פירוט לתופרת {alterationsChosen && <span style={{ color: 'var(--danger)' }}>* (חובה)</span>}
                      </label>
                      <input
                        id="item-repairs"
                        type="text"
                        name="repairs"
                        autoComplete="new-password"
                        className="input"
                        value={newItem.repairs || ''}
                        onChange={handleNewItemChange}
                        placeholder="מה בדיוק לתקן..."
                        style={{ borderColor: (alterationsChosen && !(newItem.repairs || '').trim()) ? 'var(--danger)' : undefined }}
                      />
                    </div>
                  </NocCollapsible>
                )}

                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: '16px' }}
                  onClick={addItemToOrder}
                  disabled={!newItem.sampleItemId || !newItem.sizeText}
                >
                  <svg className="icon"><use href="#i-plus" /></svg> הוסף לסל
                </button>
              </div>

              {/* --- הסל --- */}
              <div className="card card-pad">
                <div className="card-title-row" style={{ justifyContent: 'space-between', marginBottom: '12px', display: 'flex' }}>
                  <div className="card-title-row">
                    <svg className="icon"><use href="#i-receipt" /></svg>
                    <h3 style={{ margin: 0 }}>בסל{activeItems.length ? ` · ${activeItems.length}` : ''}</h3>
                  </div>
                  {calculating && (
                    <span className="hint" style={{ color: 'var(--text-3)' }}>
                      <span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px', verticalAlign: '-2px' }} /> מחשב מחירים...
                    </span>
                  )}
                </div>

                {order.items.length === 0 ? (
                  <div className="empty-state">
                    <svg className="icon"><use href="#i-bag" /></svg>
                    <p>טרם הוספת פריטים להזמנה</p>
                  </div>
                ) : (
                  <>
                    <div role="region" aria-label="פריטים בסל" tabIndex={0}>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="list-card">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{item.dressName || 'דגם לא ידוע'}</div>
                            <div className="hint" style={{ color: 'var(--text-3)' }}>מידה {item.sizeText}{settings.enable_alterations !== 'false' ? ` · ${describeAlterations(item)}` : ''}</div>
                          </div>
                          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>
                            ₪{(calculatedData.items[idx] ? calculatedData.items[idx].calculatedPrice : item.finalPrice) || 0}
                          </strong>
                          <div className="row-actions">
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="בדוק תפוסה לתאריך האירוע" aria-label="בדוק תפוסה" onClick={() => setCapacityModalItem(item)}>
                              <svg className="icon"><use href="#i-calendar" /></svg>
                            </button>
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="ערוך פריט" aria-label="ערוך פריט" onClick={() => editItem(idx)}>
                              <svg className="icon"><use href="#i-edit" /></svg>
                            </button>
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="הסר פריט" aria-label="הסר פריט" style={{ color: 'var(--danger)' }} onClick={async () => { if (await window.customConfirm('האם אתה בטוח שברצונך להסיר את הפריט מהסל?')) removeItem(idx); }}>
                              <svg className="icon"><use href="#i-trash" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 4px 4px', borderTop: '1px solid var(--border)', marginTop: '10px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13.5px' }}>סה&quot;כ</span>
                      <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--primary-solid)', fontVariantNumeric: 'tabular-nums' }}>
                        ₪{(totalAmount || 0).toLocaleString('he-IL')}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== שלב 4 · סיכום ==================== */}
        {step === 4 && (
          <div style={{ maxWidth: '640px', margin: '0 auto' }}>
            <h2>הכול נכון?</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>בדיקה אחרונה של פרטי ההזמנה לפני מעבר לתשלום.</p>

            <div className="card card-pad" style={{ marginBottom: '16px' }}>
              <div className="card-title-row" style={{ justifyContent: 'space-between', display: 'flex', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>פרטי ההזמנה</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>עריכה</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <span className="hint" style={{ color: 'var(--text-3)' }}>לקוח</span>
                <strong>{selectedCustomerName} <span className="hint" style={{ color: 'var(--text-3)', fontWeight: 600 }}>{order.selectedCustomer?.phone1 || ''}</span></strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <span className="hint" style={{ color: 'var(--text-3)' }}>סוג אירוע</span>
                <strong>{order.isAbroad ? 'אירוע חו"ל / תפוסה ארוכה' : 'אירוע רגיל'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <span className="hint" style={{ color: 'var(--text-3)' }}>תאריכים</span>
                <strong>
                  {order.isAbroad
                    ? `מ-${getHebrewDateString(order.fromDate)} עד ${getHebrewDateString(order.toDate)}`
                    : getHebrewDateString(order.eventDate)}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 4px', borderBottom: '1px solid var(--border)' }}>
                <span className="hint" style={{ color: 'var(--text-3)' }}>ריווח ימים</span>
                <strong>{spacingLabel}</strong>
              </div>
              {order.notes && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', padding: '8px 4px 4px' }}>
                  <span className="hint" style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>הערות</span>
                  <strong style={{ textAlign: 'left' }}>{order.notes}</strong>
                </div>
              )}
            </div>

            <div className="card card-pad">
              <div className="card-title-row" style={{ justifyContent: 'space-between', display: 'flex', marginBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>פריטים ({order.items.length})</h3>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(3)}>עריכה</button>
              </div>

              <div style={{ maxHeight: '42vh', overflowY: 'auto' }} role="region" aria-label="רשימת פריטים בהזמנה" tabIndex={0}>
                {order.items.map((item, idx) => {
                  const calcItem = calculatedData.items[idx];
                  const displayPrice = calcItem ? calcItem.calculatedPrice : item.finalPrice;
                  const repairsCost = calcItem && calcItem.repairsCost ? calcItem.repairsCost : 0;
                  return (
                    <div key={idx} className="list-card">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{item.dressName} · מידה {item.sizeText}</div>
                        {settings.enable_alterations !== 'false' && (
                          <div className="hint" style={{ color: 'var(--text-3)' }}>
                            תיקונים: {describeAlterations(item)}
                            {repairsCost > 0 && <span style={{ color: 'var(--warning)' }}> (+₪{repairsCost})</span>}
                          </div>
                        )}
                      </div>
                      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>₪{displayPrice || 0}</strong>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 4px 4px', borderTop: '1px solid var(--border)', marginTop: '10px' }}>
                <span style={{ fontWeight: 700, fontSize: '13.5px' }}>סה&quot;כ לתשלום</span>
                <span style={{ fontWeight: 800, fontSize: '18px', color: 'var(--primary-solid)', fontVariantNumeric: 'tabular-nums' }}>
                  ₪{(totalAmount || 0).toLocaleString('he-IL')}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ==================== שלב 5 · תשלום ==================== */}
        {step === 5 && (
          <div>
            <h2>תשלום וסיום</h2>
            <p className="page-desc" style={{ margin: '-4px 0 18px' }}>אפשר לפצל למספר אמצעי תשלום, או לסיים עם יתרה פתוחה באישור מנהל.</p>

            <div className="two-col">
              <div className="card card-pad">
                <form onSubmit={(e) => { e.preventDefault(); handleAddPaymentClick(); }}>
                  <div className="field">
                    <label htmlFor="pay-amount">סכום לתשלום כעת (₪)</label>
                    <input
                      id="pay-amount"
                      type="number"
                      className="input"
                      value={payment.amount}
                      onChange={e => setPayment(prev => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="pay-method">אופן תשלום</label>
                    <select id="pay-method" className="select" value={payment.method} onChange={e => setPayment(prev => ({ ...prev, method: e.target.value }))}>
                      {paymentMethodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>

                  <NocCollapsible title="הערה לתשלום" badge={payment.notes ? 'יש הערה' : null}>
                    <input
                      type="text"
                      className="input"
                      value={payment.notes}
                      onChange={e => setPayment(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="מספר אישור, פרטי הבנק, שם המשלם..."
                    />
                  </NocCollapsible>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn btn-secondary" style={{ flex: 1, minWidth: '150px' }} disabled={busy}>
                      <svg className="icon"><use href="#i-plus" /></svg> פצל / הוסף תשלום
                    </button>
                    {settings.nedarim_plus_enabled !== 'false' && (
                      <button
                        type="button"
                        className="btn btn-primary"
                        style={{ flex: 1, minWidth: '150px' }}
                        disabled={busy}
                        onClick={() => {
                          setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: payment.notes, amount: payment.amount });
                          setCreditError('');
                          setShowCreditModal(true);
                        }}
                      >
                        <svg className="icon"><use href="#i-card" /></svg> חיוב אשראי
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div>
                <div className="card card-pad" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}>
                    <span className="hint" style={{ color: 'var(--text-3)' }}>סה&quot;כ חיובים</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums' }}>₪{(totalAmount || 0).toLocaleString('he-IL')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}>
                    <span className="hint" style={{ color: 'var(--text-3)' }}>שולם</span>
                    <strong style={{ color: 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>₪{totalPaid.toLocaleString('he-IL')}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}>
                    <span className="hint" style={{ color: 'var(--text-3)' }}>יתרה</span>
                    <strong style={{ color: remaining > 0 ? 'var(--danger)' : 'var(--success)', fontVariantNumeric: 'tabular-nums' }}>₪{remaining.toLocaleString('he-IL')}</strong>
                  </div>
                </div>

                <div className="card card-pad">
                  <div className="card-title-row" style={{ marginBottom: '10px' }}>
                    <svg className="icon"><use href="#i-receipt" /></svg>
                    <h3 style={{ margin: 0 }}>תשלומים שנרשמו</h3>
                  </div>
                  {paymentsList.length === 0 ? (
                    <div className="empty-state">
                      <svg className="icon"><use href="#i-wallet" /></svg>
                      <p>טרם נרשמו תשלומים</p>
                    </div>
                  ) : (
                    <div>
                      {paymentsList.map((p, idx) => (
                        <div key={idx} className="list-card">
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{p.method}</div>
                            {p.notes && <div className="hint" style={{ color: 'var(--text-3)' }}>{p.notes}</div>}
                          </div>
                          <strong style={{ fontVariantNumeric: 'tabular-nums' }}>₪{Number(p.amount).toLocaleString('he-IL')}</strong>
                          <div className="row-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon-only btn-sm"
                              disabled={isChargedPayment(p)}
                              title={isChargedPayment(p) ? 'חיוב אשראי שכבר בוצע — לא ניתן להסרה' : 'הסר תשלום'}
                              aria-label="הסר תשלום"
                              style={{ color: 'var(--danger)' }}
                              onClick={() => removePayment(idx)}
                            >
                              <svg className="icon"><use href="#i-trash" /></svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {remaining > 0 && (
                    <p className="field hint" style={{ margin: '12px 0 0', color: 'var(--warning)' }}>
                      נותרה יתרה של ₪{remaining.toLocaleString('he-IL')}. סיום ההזמנה ללא תשלום מלא אפשרי רק באמצעות &quot;יציאה באישור מנהל&quot;.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </NewOrderShell>

      {/* ==================== מודלים ==================== */}
      {capacityModalItem && (
        <ItemCapacityModal
          item={capacityModalItem}
          order={order}
          isOpen={true}
          onClose={() => setCapacityModalItem(null)}
        />
      )}

      {pendingSpacingChange !== null && !showSpacingCapacitySearch && (
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setPendingSpacingChange(null); }}
        >
          <div className="modal" style={{ maxWidth: '420px' }} role="dialog" aria-modal="true">
            <div className="modal-head">
              <strong>רגע, בדקת מלאי?</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה" onClick={() => setPendingSpacingChange(null)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: '0 0 12px', color: 'var(--text-2)', fontSize: '13.5px' }}>
                ציפוף מיוחד משפיע על בדיקת המלאי להזמנה זו בלבד, ומסמן את ההזמנה לאישור מנהל.
              </p>
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowSpacingCapacitySearch(true)}>
                פתח חיפוש תפוסה מהיר
                <svg className="icon"><use href="#i-chevron-start" /></svg>
              </button>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setPendingSpacingChange(null)}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={confirmSpacingChange}>כן, המשך</button>
            </div>
          </div>
        </div>
      )}

      {showSpacingCapacitySearch && (
        <CapacitySearchModal
          isOpen={showSpacingCapacitySearch}
          onClose={() => setShowSpacingCapacitySearch(false)}
        />
      )}

      {showExitConfirm && (
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowExitConfirm(false); }}
        >
          <div className="modal" style={{ maxWidth: '420px' }} role="dialog" aria-modal="true">
            <div className="modal-head">
              <strong>יציאה מההזמנה</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה" onClick={() => setShowExitConfirm(false)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <p style={{ margin: 0, color: 'var(--text-2)', fontSize: '13.5px' }}>
                {draftOrderId
                  ? `ההזמנה שמורה כטיוטה #${draftOrderId} עם ${activeItems.length} פריטים, ואפשר להמשיך אותה מרשימת ההזמנות.`
                  : 'ההזמנה עדיין לא נשמרה. יציאה עכשיו תמחק את מה שהוזן במסך.'}
              </p>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowExitConfirm(false)}>המשך בהזמנה</button>
              <button type="button" className="btn btn-primary" onClick={() => router.push('/orders')}>
                {draftOrderId ? 'צא — הטיוטה נשמרה' : 'צא בלי לשמור'}
              </button>
            </div>
          </div>
        </div>
      )}

      {duplicateCustomer && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="dup-title">
            <div className="modal-icon-circle" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>
              <svg className="icon"><use href="#i-alert-tri" /></svg>
            </div>
            <h3 id="dup-title">לקוח קיים במערכת</h3>
            <p>הלקוח שהוזן זוהה במערכת לפי מספר הטלפון. אפשר להשתמש בכרטיס הקיים, או ליצור כרטיס נוסף.</p>
            <div className="card card-pad" style={{ textAlign: 'start', marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}>
                <span className="hint" style={{ color: 'var(--text-3)' }}>שם</span>
                <strong>
                  {getCustomerFullName(duplicateCustomer)}
                  {duplicateCustomer.isBlocked && (
                    <span className="badge badge-danger" style={{ marginInlineStart: '8px', fontSize: '11px' }}>לקוח חסום</span>
                  )}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}><span className="hint" style={{ color: 'var(--text-3)' }}>טלפון</span><span dir="ltr">{duplicateCustomer.phone1}{duplicateCustomer.phone2 ? ` | ${duplicateCustomer.phone2}` : ''}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px' }}><span className="hint" style={{ color: 'var(--text-3)' }}>עיר</span><span>{duplicateCustomer.city || 'לא צוינה'}</span></div>
            </div>
            <div className="confirm-actions">
              <button type="button" className="btn btn-danger-ghost" onClick={() => handleSaveNewCustomerAndProceed(true)}>צור לקוח חדש בכל זאת</button>
              <button type="button" className="btn btn-primary" onClick={() => handleUseExistingCustomer(duplicateCustomer)}>השתמש בלקוח הקיים</button>
            </div>
          </div>
        </div>
      )}

      {duplicateOrderWarning && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="dup-order-title">
            <div className="modal-icon-circle" style={{ background: 'var(--danger-tint)', color: 'var(--danger)' }}>
              <svg className="icon"><use href="#i-alert-tri" /></svg>
            </div>
            <h3 id="dup-order-title">הזמנה זו כבר נשמרה</h3>
            <p>
              כבר קיימת הזמנה שמורה עבור אותו לקוח ואותו תאריך — הזמנה מס&apos; {duplicateOrderWarning.existingOrderId}.
              כדאי לבדוק אותה לפני שממשיכים, כדי לא ליצור הזמנה כפולה.
            </p>
            <a
              href={`/orders/${duplicateOrderWarning.existingOrderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
              style={{ marginBottom: '20px' }}
            >
              <svg className="icon"><use href="#i-link" /></svg> פתח את הזמנה #{duplicateOrderWarning.existingOrderId}
            </a>
            <div className="confirm-actions">
              <button type="button" className="btn btn-danger-ghost" onClick={handleConfirmDuplicateSave}>שמור בכל זאת כהזמנה נפרדת</button>
              <button type="button" className="btn btn-primary" onClick={handleCancelDuplicateSave}>אבדוק את הקיימת</button>
            </div>
          </div>
        </div>
      )}

      {showCreditModal && (
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => !isProcessingCredit && setShowCreditModal(false)}
        >
          <div className="modal" style={{ maxWidth: '520px' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="credit-title">
            <div className="modal-head">
              <strong id="credit-title"><svg className="icon"><use href="#i-card" /></svg> חיוב באשראי (נדרים פלוס)</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="סגירה" aria-label="סגירה" onClick={() => setShowCreditModal(false)} disabled={isProcessingCredit}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginBottom: '18px' }}
                title="העברת כרטיס מהירה בקורא מגנטי"
                onClick={() => { setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}
              >
                <svg className="icon"><use href="#i-refresh" /></svg> העברה מהירה
              </button>

              {creditError && (
                <div className="callout callout-danger" style={{ marginBottom: '16px' }}>
                  <svg className="icon"><use href="#i-alert-circle" /></svg> <span>{creditError}</span>
                </div>
              )}

              <form id="credit-charge-form" onSubmit={(e) => { e.preventDefault(); handleProcessCreditCard(); }}>
                <div className="field">
                  <label htmlFor="cc-number">מספר כרטיס אשראי (או העברה בקורא)</label>
                  <input
                    id="cc-number"
                    type="text"
                    className="input"
                    inputMode="numeric"
                    autoComplete="cc-number"
                    value={creditCardData.cardNumber}
                    onChange={handleCardNumberChange}
                    placeholder="0000 0000 0000 0000"
                    maxLength="19"
                    dir="ltr"
                    style={{ textAlign: 'left', letterSpacing: '2px' }}
                  />
                </div>

                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="cc-exp">תוקף (MM/YY)</label>
                    <input id="cc-exp" type="text" className="input" autoComplete="cc-exp" value={creditCardData.tokef} onChange={handleTokefChange} placeholder="12/25" maxLength="5" dir="ltr" style={{ textAlign: 'left', letterSpacing: '2px' }} />
                  </div>
                  <div className="field">
                    <label htmlFor="cc-amount">סכום לחיוב (₪)</label>
                    <input id="cc-amount" type="number" className="input" value={creditCardData.amount} onChange={e => setCreditCardData(prev => ({ ...prev, amount: e.target.value }))} style={{ fontWeight: 700, textAlign: 'center' }} />
                  </div>
                  <div className="field">
                    <label htmlFor="cc-installments">תשלומים</label>
                    <input id="cc-installments" type="number" className="input" min="1" max="12" value={creditCardData.installments} onChange={e => setCreditCardData(prev => ({ ...prev, installments: e.target.value }))} style={{ textAlign: 'center' }} />
                  </div>
                  <div className="field">
                    <label htmlFor="cc-notes">הערות לנדרים</label>
                    <input id="cc-notes" type="text" className="input" value={creditCardData.notes} onChange={e => setCreditCardData(prev => ({ ...prev, notes: e.target.value }))} />
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setShowCreditModal(false)} disabled={isProcessingCredit}>ביטול</button>
              <button type="submit" form="credit-charge-form" className="btn btn-primary" disabled={isProcessingCredit} aria-busy={isProcessingCredit}>
                {isProcessingCredit ? <><span className="spinner" /> מבצע חיוב...</> : <><svg className="icon"><use href="#i-card" /></svg> בצע חיוב ושמור הזמנה</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showQuickSwipeModal && (
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 1500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowQuickSwipeModal(false)}
        >
          <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="swipe-title">
            <span className="spinner lg" style={{ margin: '0 auto 16px' }} />
            <h3 id="swipe-title">העברת כרטיס מהירה</h3>
            <p>אנא העבר כעת את כרטיס האשראי בקורא המגנטי. פרטי הכרטיס ייקלטו אוטומטית.</p>
            <input
              autoFocus
              type="text"
              value={swipeInput}
              onChange={handleSwipeInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
              onBlur={(e) => { if (showQuickSwipeModal) setTimeout(() => e.target?.focus(), 100); }}
              style={{ opacity: 0, position: 'absolute', top: '-1000px' }}
              aria-label="קלט קורא כרטיסים"
            />
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setShowQuickSwipeModal(false)}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* חסימת המסך בזמן חיוב/שמירה, כדי שאיש לא ילחץ פעמיים או ינווט באמצע */}
      {busy && (
        <div
          className="modal-backdrop"
          role="alertdialog"
          aria-live="assertive"
          aria-busy="true"
          aria-label="פעולה מתבצעת"
          style={{ position: 'fixed', inset: 0, zIndex: 1600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="modal confirm-modal" style={{ maxWidth: '320px' }}>
            <span className="spinner lg" style={{ margin: '0 auto 16px' }} />
            <h3>{isProcessingCredit ? 'מבצע חיוב מול נדרים פלוס' : 'יוצר את ההזמנה'}</h3>
            <p style={{ margin: '8px 0 0' }}>
              {isProcessingCredit
                ? 'אין לסגור את החלון עד לקבלת אישור מחברת האשראי.'
                : 'מאמת זמינות מלאי, רושם פריטים ומחשב חיובים. נא לא לסגור את החלון.'}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * מגירה מתקפלת — כל מה שאינו חובה במסך יושב בתוכה, כדי שכל שלב יציג
 * רק את השדות שבאמת נדרשים כדי להתקדם (details/summary בשפת "אריג").
 */
function NocCollapsible({ title, badge, defaultOpen = false, openWhen = false, children }) {
  const [open, setOpen] = useState(defaultOpen || openWhen);
  // עריכת פריט קיים ממלאת שדות שיושבים בתוך המגירה — היא נפתחת כדי שלא יעלמו מהעין.
  useEffect(() => {
    if (openWhen) setOpen(true);
  }, [openWhen]);
  return (
    <details className="faq-item" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        {title}
        {!open && badge ? <span className="badge badge-primary">{badge}</span> : null}
        <svg className="icon"><use href="#i-chevron-down" /></svg>
      </summary>
      <div className="faq-body">{children}</div>
    </details>
  );
}
