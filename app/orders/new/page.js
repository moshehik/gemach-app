'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarSearch, Edit2, Trash2, ArrowLeft, ArrowRight, Plus, Check, UserPlus, CreditCard, ShieldCheck, RefreshCw, ExternalLink, AlertTriangle, X, ChevronDown } from 'lucide-react';
import HebrewDatePicker from '../../../components/HebrewDatePicker';
import HebrewDateRangePicker from '../../../components/HebrewDateRangePicker';
import CustomerSelector from '../../../components/CustomerSelector';
import OrderModelSelector from '../../../components/orders/OrderModelSelector';
import ItemCapacityModal from '../../../components/orders/ItemCapacityModal';
import NewOrderShell from '../../../components/orders/new/NewOrderShell';
import newOrderCss from '../../../components/orders/new/newOrderStyles';
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
  const [inventoryCache, setInventoryCache] = useState(null);
  const [loadingPreload, setLoadingPreload] = useState(false);
  
  const [calculatedData, setCalculatedData] = useState({ totalAmount: 0, items: [] });
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newCustomer, setNewCustomer] = useState({
    firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: ''
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
          if (settingsObj.ALLOWED_PAYMENT_METHODS) {
            const opts = settingsObj.ALLOWED_PAYMENT_METHODS.split(',').map(s => s.trim()).filter(Boolean);
            if (opts.length > 0) {
              setPayment(prev => ({...prev, method: opts[0]}));
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

  const handleSaveNewCustomerAndProceed = async (skipDuplicateCheck = false) => {
    const configuredMandatory = (settings.mandatory_fields || '')
      .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

    const missingFields = Object.keys(CUSTOMER_FIELD_ALIASES).filter((key) => {
      const alwaysRequired = key === 'firstName' || key === 'lastName' || key === 'phone1';
      const isRequired = alwaysRequired || CUSTOMER_FIELD_ALIASES[key].some(alias => configuredMandatory.includes(alias.toLowerCase()));
      return isRequired && !String(newCustomer[key] || '').trim();
    });

    if (missingFields.length > 0) {
       alert(`יש למלא: ${missingFields.map(k => CUSTOMER_FIELD_LABELS[k]).join(', ')}`);
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

  const handleUseExistingCustomer = (existingCustomer) => {
    setOrder(prev => ({ ...prev, customerId: existingCustomer.id, selectedCustomer: existingCustomer }));
    setStep(2);
    setDuplicateCustomer(null);
  };

  const proceedToStep2 = () => {
    if (!order.customerId) {
       alert('יש לבחור לקוח');
       return;
    }
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

    if ((newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration) && (!newItem.repairs || !newItem.repairs.trim())) {
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
  // וגם קטן ממה שנבחר עד כה דורש אישור מנהל.
  const handleSpacingChange = async (val) => {
    const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : 3;
    const newSpacing = (val !== null && val !== undefined) ? val : 3;

    if (newSpacing < 3 && newSpacing < prevSpacing) {
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
      <style>{newOrderCss}</style>

      <NewOrderShell
        step={step}
        steps={stepsMeta}
        onStepChange={handleStepChange}
        draftOrderId={draftOrderId}
        itemsCount={activeItems.length}
        repairsTotal={repairsTotal}
        totalAmount={totalAmount}
        calculating={calculating}
        topBar={
          <>
            {flash && (
              <span className={`noc-flash ${flash.type === 'err' ? 'err' : ''}`}>
                <ShieldCheck size={14} /> {flash.text}
              </span>
            )}
            {draftOrderId && (
              <a className="noc-ghost" href={`/orders/${draftOrderId}`} target="_blank" rel="noopener noreferrer" title="פתח את הטיוטה בכרטיסייה נפרדת">
                <ExternalLink size={15} /> טיוטה #{draftOrderId}
              </a>
            )}
            <button type="button" className="noc-ghost" onClick={handleExit} disabled={busy} title="יציאה מהמסך">
              <X size={16} />
            </button>
          </>
        }
        footer={
          <>
            {step > 1 && (
              <button type="button" className="noc-ghost" onClick={() => setStep(step - 1)} disabled={busy}>
                <ArrowRight size={16} /> חזור
              </button>
            )}
            {step === 1 && (
              <button type="button" className="noc-ghost" onClick={handleExit} disabled={busy}>ביטול</button>
            )}
            <span className="noc-spacer" />
            {step === 1 && (
              <button type="button" className="noc-btn gold" onClick={proceedToStep2} disabled={!order.customerId}>
                המשך <ArrowLeft size={16} />
              </button>
            )}
            {step === 2 && (
              <button type="button" className="noc-btn gold" onClick={() => setStep(3)} disabled={!datesFilled}>
                המשך לבחירת פריטים <ArrowLeft size={16} />
              </button>
            )}
            {step === 3 && (
              <button type="button" className="noc-btn gold" onClick={() => setStep(4)} disabled={activeItems.length === 0}>
                המשך לסיכום <ArrowLeft size={16} />
              </button>
            )}
            {step === 4 && (
              <button type="button" className="noc-btn gold" onClick={() => setStep(5)}>
                המשך לתשלום <ArrowLeft size={16} />
              </button>
            )}
            {step === 5 && (
              <button type="button" className="noc-btn ok" onClick={saveOrder} disabled={busy} aria-busy={saving}>
                {saving ? <><span className="noc-spin sm" /> שומר...</> : <><ShieldCheck size={16} /> סיום ויצירת ההזמנה</>}
              </button>
            )}
          </>
        }
      >
        {/* ==================== שלב 1 · לקוח ==================== */}
        {step === 1 && (
          <div className="noc-scroll">
            <div className="noc-mid">
              <div className="noc-ask">
                <h2>מי הלקוח?</h2>
                <p>חיפוש לפי טלפון, בחירה מהרשימה, או יצירת כרטיס לקוח חדש.</p>
              </div>

              <div className="noc-switch">
                <button
                  type="button"
                  className={searchMode === 'phone' ? 'on' : ''}
                  onClick={() => { setSearchMode('phone'); setFoundCustomerFromPhone(null); }}
                >לפי טלפון</button>
                <button
                  type="button"
                  className={searchMode === 'name' ? 'on' : ''}
                  onClick={() => setSearchMode('name')}
                >מהרשימה</button>
                <button
                  type="button"
                  className={searchMode === 'new' ? 'on' : ''}
                  onClick={() => setSearchMode('new')}
                >לקוח חדש</button>
              </div>

              {searchMode === 'phone' && !foundCustomerFromPhone && (
                <div className="noc-card">
                  <label className="noc-lbl" htmlFor="cust-phone">מספר טלפון <span className="req">*</span></label>
                  <input
                    id="cust-phone"
                    type="tel"
                    dir="ltr"
                    className="noc-big-input"
                    value={phoneSearchInput}
                    onChange={e => setPhoneSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                    placeholder="05..."
                    autoFocus
                  />
                  <button
                    type="button"
                    className="noc-btn gold wide"
                    style={{ marginTop: '14px' }}
                    onClick={handleCheckPhone}
                    disabled={isCheckingPhone}
                  >
                    {isCheckingPhone ? <><span className="noc-spin sm" /> מחפש...</> : <>בדיקה והמשך <ArrowLeft size={16} /></>}
                  </button>
                  <p className="noc-hint" style={{ textAlign: 'center', marginTop: '12px' }}>
                    מספר שלא קיים במערכת יפתח כרטיס לקוח חדש עם המספר שהוזן.
                  </p>
                </div>
              )}

              {searchMode === 'phone' && foundCustomerFromPhone && (
                <div className="noc-card">
                  <h3 style={{ fontSize: '1.3rem' }}>{getCustomerFullName(foundCustomerFromPhone)}</h3>
                  <p className="noc-hint" style={{ marginTop: '6px' }}>
                    {foundCustomerFromPhone.phone1}
                    {foundCustomerFromPhone.city ? ` · ${foundCustomerFromPhone.city}` : ''}
                    {foundCustomerFromPhone.street ? `, ${foundCustomerFromPhone.street} ${foundCustomerFromPhone.houseNum || ''}` : ''}
                  </p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                    <button type="button" className="noc-btn gold" style={{ flex: 1, minWidth: '160px' }} onClick={() => handleUseExistingCustomer(foundCustomerFromPhone)}>
                      <Check size={16} /> כן, זה הלקוח
                    </button>
                    <button
                      type="button"
                      className="noc-btn line"
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
                <div className="noc-card">
                  <label className="noc-lbl">חיפוש לפי שם, טלפון או עיר</label>
                  <CustomerSelector
                    value={order.selectedCustomer}
                    onChange={(c) => setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }))}
                    placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                  />
                  {order.selectedCustomer && (
                    <div className="noc-row" style={{ marginTop: '14px' }}>
                      <span className="noc-k">נבחר</span>
                      <span className="noc-v"><strong>{selectedCustomerName}</strong> <small>{order.selectedCustomer.phone1 || ''}</small></span>
                    </div>
                  )}
                </div>
              )}

              {searchMode === 'new' && (
                <div className="noc-card">
                  <div className="noc-fields">
                    <div>
                      <label className="noc-lbl" htmlFor="cust-firstName">שם פרטי <span className="req">*</span></label>
                      <input id="cust-firstName" type="text" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({ ...prev, firstName: e.target.value }))} />
                    </div>
                    <div>
                      <label className="noc-lbl" htmlFor="cust-lastName">שם משפחה <span className="req">*</span></label>
                      <input id="cust-lastName" type="text" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({ ...prev, lastName: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ marginTop: '13px' }}>
                    <label className="noc-lbl" htmlFor="cust-phone1">טלפון נייד <span className="req">*</span></label>
                    <input id="cust-phone1" type="tel" dir="ltr" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({ ...prev, phone1: e.target.value }))} />
                  </div>

                  <NocCollapsible title="פרטים נוספים (לא חובה)">
                    <div className="noc-fields">
                      <div>
                        <label className="noc-lbl" htmlFor="cust-email">אימייל</label>
                        <input id="cust-email" type="email" dir="ltr" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({ ...prev, email: e.target.value }))} placeholder="לשליחת ההזמנה במייל" />
                      </div>
                      <div>
                        <label className="noc-lbl" htmlFor="cust-city">עיר מגורים</label>
                        <input id="cust-city" type="text" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({ ...prev, city: e.target.value }))} />
                      </div>
                      <div>
                        <label className="noc-lbl" htmlFor="cust-street">רחוב</label>
                        <input id="cust-street" type="text" value={newCustomer.street || ''} onChange={e => setNewCustomer(prev => ({ ...prev, street: e.target.value }))} />
                      </div>
                      <div>
                        <label className="noc-lbl" htmlFor="cust-house">מספר בית</label>
                        <input id="cust-house" type="text" value={newCustomer.houseNum || ''} onChange={e => setNewCustomer(prev => ({ ...prev, houseNum: e.target.value }))} />
                      </div>
                    </div>
                  </NocCollapsible>

                  <button type="button" className="noc-btn gold wide" style={{ marginTop: '16px' }} onClick={() => handleSaveNewCustomerAndProceed()}>
                    <UserPlus size={16} /> שמור לקוח והמשך
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== שלב 2 · תאריכים ==================== */}
        {step === 2 && (
          <div className="noc-scroll">
            <div className="noc-mid">
              <div className="noc-ask">
                <h2>מתי האירוע?</h2>
                <p>התאריך קובע את חישוב המלאי ואת מועדי הלקיחה וההחזרה.</p>
              </div>

              <div className="noc-pick" style={{ marginBottom: '16px' }}>
                <label className={!order.isAbroad ? 'on' : ''} onClick={() => handleDateChangeWithValidation('isAbroad', false)}>
                  <div className="noc-pick-t">אירוע רגיל</div>
                  <div className="noc-pick-d">תאריך אירוע אחד</div>
                </label>
                <label className={order.isAbroad ? 'on' : ''} onClick={() => handleDateChangeWithValidation('isAbroad', true)}>
                  <div className="noc-pick-t">חו"ל / תפוסה ארוכה</div>
                  <div className="noc-pick-d">טווח תאריכים מלא</div>
                </label>
              </div>

              <div className="noc-card">
                {!order.isAbroad ? (
                  <div>
                    <label className="noc-lbl">תאריך אירוע <span className="req">*</span></label>
                    <HebrewDatePicker value={order.eventDate} onChange={(date) => handleDateChangeWithValidation('eventDate', date)} />
                  </div>
                ) : (
                  <div>
                    <label className="noc-lbl">טווח תאריכים (מתאריך עד תאריך) <span className="req">*</span></label>
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
                  <label className="noc-lbl" htmlFor="order-notes">הערות כלליות להזמנה</label>
                  <textarea
                    id="order-notes"
                    name="notes"
                    rows={2}
                    value={order.notes}
                    onChange={handleOrderChange}
                    placeholder="בקשות מיוחדות, סיכומים עם הלקוח..."
                  />

                  <label className="noc-lbl" style={{ marginTop: '16px' }}>ריווח ימים בין השכרות</label>
                  <div className="noc-chips">
                    {[
                      { val: null, label: 'רגיל' },
                      { val: 0, label: 'ללא' },
                      { val: 1, label: 'יום' },
                      { val: 2, label: 'יומיים' },
                      { val: 3, label: '3 ימים' },
                      { val: 4, label: '4 ימים' }
                    ].map(opt => (
                      <button
                        key={String(opt.val)}
                        type="button"
                        className={`noc-chip ${order.customSpacing === opt.val ? 'on' : ''}`}
                        onClick={() => handleSpacingChange(opt.val)}
                      >{opt.label}</button>
                    ))}
                  </div>
                  <p className={`noc-hint ${(order.customSpacing !== null && order.customSpacing !== undefined && order.customSpacing < 3) ? 'warn' : ''}`} style={{ marginTop: '10px' }}>
                    {(order.customSpacing === null || order.customSpacing === undefined)
                      ? 'ברירת המחדל של המערכת.'
                      : order.customSpacing < 3
                        ? 'ציפוף מיוחד — משפיע על בדיקת המלאי להזמנה זו בלבד, מסמן את ההזמנה ודורש אישור מנהל.'
                        : 'ריווח מורחב — פחות זמינות לשאר ההזמנות.'}
                  </p>
                </NocCollapsible>
              </div>
            </div>
          </div>
        )}

        {/* ==================== שלב 3 · פריטים ==================== */}
        {step === 3 && (
          <div className="noc-scroll">
            <div className="noc-ask">
              <h2>אילו פריטים?</h2>
              <p>בחירת דגם ומידה — הסל והמחיר מתעדכנים בזמן אמת.</p>
            </div>

            <div className="noc-split">
              {/* --- הוספת פריט --- */}
              <div className="noc-card">
                <label className="noc-lbl" htmlFor="item-model">דגם <span className="req">*</span></label>
                <OrderModelSelector
                  inputId="item-model"
                  value={{ name: newItem.dressName }}
                  onChange={(model) => {
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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                  <label className="noc-lbl" style={{ margin: 0 }}>
                    מידה <span className="req">*</span>
                    {loadingSizes && <span style={{ fontWeight: 400 }}> (בודק זמינות...)</span>}
                  </label>
                  <button
                    type="button"
                    className="noc-mini"
                    onClick={refreshInventory}
                    disabled={loadingPreload || loadingSizes}
                    title="רענן זמינות מלאי"
                    aria-label="רענן זמינות מלאי"
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>

                <div className="noc-sizes" style={{ marginTop: '8px' }}>
                  {availableSizes.length === 0 ? (
                    <p className="noc-hint">
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
                          className={`noc-size ${isSelected ? 'on' : ''}`}
                          disabled={!isAvailable}
                          aria-pressed={isSelected}
                          title={tooltipText}
                          onClick={() => handleNewItemChange({ target: { name: 'sizeText', value: s.sizeText } })}
                        >
                          <span className="noc-sz">{s.sizeText}</span>
                          <span className="noc-av">
                            {!isAvailable ? 'אזל' : s.withCustomSpacing ? (
                              <>
                                {normalAvail} פנויות
                                {s.withCustomSpacing.gain > 0 && <span className="noc-gain"> +{s.withCustomSpacing.gain}</span>}
                              </>
                            ) : `${normalAvail} פנויות`}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <NocCollapsible
                  title="תיקונים לפריט"
                  badge={alterationsChosen ? alterationsSummary : null}
                  openWhen={alterationsChosen}
                >
                  <div className="noc-chips">
                    <button
                      type="button"
                      aria-pressed={!!newItem.neckAlteration}
                      className={`noc-chip ${newItem.neckAlteration ? 'on' : ''}`}
                      onClick={() => handleNewItemChange({ target: { name: 'neckAlteration', value: !newItem.neckAlteration } })}
                    >צוואר</button>
                    <button
                      type="button"
                      aria-pressed={!!newItem.sleeveAlteration}
                      className={`noc-chip ${newItem.sleeveAlteration ? 'on' : ''}`}
                      onClick={() => handleNewItemChange({ target: { name: 'sleeveAlteration', value: !newItem.sleeveAlteration } })}
                    >שרוול</button>
                    <span className="noc-chip-len">
                      אורך
                      <input
                        type="number"
                        name="lengthAlteration"
                        value={newItem.lengthAlteration || ''}
                        onChange={handleNewItemChange}
                        placeholder="ס״מ"
                        aria-label="קיצור אורך בסנטימטרים"
                      />
                      ס״מ
                    </span>
                  </div>

                  <div style={{ marginTop: '14px' }}>
                    <label className="noc-lbl" htmlFor="item-repairs">
                      פירוט לתופרת {alterationsChosen && <span className="req">* (חובה)</span>}
                    </label>
                    <input
                      id="item-repairs"
                      type="text"
                      name="repairs"
                      value={newItem.repairs || ''}
                      onChange={handleNewItemChange}
                      placeholder="מה בדיוק לתקן..."
                      style={{ borderColor: (alterationsChosen && !(newItem.repairs || '').trim()) ? 'var(--noc-alert)' : undefined }}
                    />
                  </div>
                </NocCollapsible>

                <button
                  type="button"
                  className="noc-btn gold wide"
                  style={{ marginTop: '16px' }}
                  onClick={addItemToOrder}
                  disabled={!newItem.sampleItemId || !newItem.sizeText}
                >
                  <Plus size={16} /> הוסף לסל
                </button>
              </div>

              {/* --- הסל --- */}
              <div className="noc-card">
                <div className="noc-cap">
                  <span>בסל{activeItems.length ? ` · ${activeItems.length}` : ''}</span>
                  {calculating && <span className="noc-hint">מחשב מחירים...</span>}
                </div>

                {order.items.length === 0 ? (
                  <div className="noc-empty">טרם הוספת פריטים להזמנה</div>
                ) : (
                  <>
                    <div className="noc-list" role="region" aria-label="פריטים בסל" tabIndex={0}>
                      {order.items.map((item, idx) => (
                        <div key={idx} className="noc-item">
                          <span className="noc-it-main">
                            <span className="noc-nm">{item.dressName || 'דגם לא ידוע'}</span>
                            <span className="noc-meta">מידה {item.sizeText} · {describeAlterations(item)}</span>
                          </span>
                          <span className="noc-pr">
                            ₪{(calculatedData.items[idx] ? calculatedData.items[idx].calculatedPrice : item.finalPrice) || 0}
                          </span>
                          <span className="noc-acts">
                            <button type="button" className="noc-mini" title="בדוק תפוסה לתאריך האירוע" aria-label="בדוק תפוסה" onClick={() => setCapacityModalItem(item)}>
                              <CalendarSearch size={15} />
                            </button>
                            <button type="button" className="noc-mini" title="ערוך פריט" aria-label="ערוך פריט" onClick={() => editItem(idx)}>
                              <Edit2 size={15} />
                            </button>
                            <button type="button" className="noc-mini del" title="הסר פריט" aria-label="הסר פריט" onClick={() => removeItem(idx)}>
                              <Trash2 size={15} />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="noc-row total">
                      <span className="noc-k">סה"כ</span>
                      <span style={{ flex: 1 }} />
                      <span className="noc-amt">₪{(totalAmount || 0).toLocaleString('he-IL')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== שלב 4 · סיכום ==================== */}
        {step === 4 && (
          <div className="noc-scroll">
            <div style={{ maxWidth: '720px', margin: '0 auto' }}>
              <div className="noc-ask">
                <h2>הכול נכון?</h2>
                <p>בדיקה אחרונה של פרטי ההזמנה לפני מעבר לתשלום.</p>
              </div>

              <div className="noc-card">
                <div className="noc-cap">
                  <span>פרטי ההזמנה</span>
                  <button type="button" className="noc-link" onClick={() => setStep(1)}>עריכה</button>
                </div>
                <div className="noc-row"><span className="noc-k">לקוח</span><span className="noc-v">{selectedCustomerName} <small>{order.selectedCustomer?.phone1 || ''}</small></span></div>
                <div className="noc-row"><span className="noc-k">סוג אירוע</span><span className="noc-v">{order.isAbroad ? 'אירוע חו"ל / תפוסה ארוכה' : 'אירוע רגיל'}</span></div>
                <div className="noc-row">
                  <span className="noc-k">תאריכים</span>
                  <span className="noc-v">
                    {order.isAbroad
                      ? <>{`מ-${getHebrewDateString(order.fromDate)} עד ${getHebrewDateString(order.toDate)}`} <small>{`(${order.fromDate} - ${order.toDate})`}</small></>
                      : <>{getHebrewDateString(order.eventDate)} <small>{`(${order.eventDate})`}</small></>}
                  </span>
                </div>
                <div className="noc-row"><span className="noc-k">ריווח ימים</span><span className="noc-v">{spacingLabel}</span></div>
                {order.notes && <div className="noc-row"><span className="noc-k">הערות</span><span className="noc-v">{order.notes}</span></div>}
              </div>

              <div className="noc-card">
                <div className="noc-cap">
                  <span>פריטים ({order.items.length})</span>
                  <button type="button" className="noc-link" onClick={() => setStep(3)}>עריכה</button>
                </div>

                <div className="noc-list tall" role="region" aria-label="רשימת פריטים בהזמנה" tabIndex={0}>
                  {order.items.map((item, idx) => {
                    const calcItem = calculatedData.items[idx];
                    const displayPrice = calcItem ? calcItem.calculatedPrice : item.finalPrice;
                    const repairsCost = calcItem && calcItem.repairsCost ? calcItem.repairsCost : 0;
                    return (
                      <div key={idx} className="noc-item">
                        <span className="noc-it-main">
                          <span className="noc-nm">{item.dressName} · מידה {item.sizeText}</span>
                          <span className="noc-meta">
                            תיקונים: {describeAlterations(item)}
                            {repairsCost > 0 && <span style={{ color: '#a9702a' }}> (+₪{repairsCost})</span>}
                          </span>
                        </span>
                        <span className="noc-pr">₪{displayPrice || 0}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="noc-row total">
                  <span className="noc-k">סה"כ לתשלום</span>
                  <span style={{ flex: 1 }} />
                  <span className="noc-amt">₪{(totalAmount || 0).toLocaleString('he-IL')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== שלב 5 · תשלום ==================== */}
        {step === 5 && (
          <div className="noc-scroll">
            <div className="noc-ask">
              <h2>תשלום וסיום</h2>
              <p>אפשר לפצל למספר אמצעי תשלום, או לסיים עם יתרה פתוחה באישור מנהל.</p>
            </div>

            <div className="noc-split">
              <div className="noc-card">
                <form onSubmit={(e) => { e.preventDefault(); handleAddPaymentClick(); }}>
                  <label className="noc-lbl" htmlFor="pay-amount">סכום לתשלום כעת (₪)</label>
                  <input
                    id="pay-amount"
                    type="number"
                    className="noc-big-input"
                    value={payment.amount}
                    onChange={e => setPayment(prev => ({ ...prev, amount: e.target.value }))}
                  />

                  <label className="noc-lbl" style={{ marginTop: '14px' }} htmlFor="pay-method">אופן תשלום</label>
                  <select id="pay-method" value={payment.method} onChange={e => setPayment(prev => ({ ...prev, method: e.target.value }))}>
                    {paymentMethodOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>

                  <NocCollapsible title="הערה לתשלום" badge={payment.notes ? 'יש הערה' : null}>
                    <input
                      type="text"
                      value={payment.notes}
                      onChange={e => setPayment(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="מספר אישור, פרטי הבנק, שם המשלם..."
                    />
                  </NocCollapsible>

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
                    <button type="submit" className="noc-btn line" style={{ flex: 1, minWidth: '150px' }} disabled={busy}>
                      <Plus size={16} /> פצל / הוסף תשלום
                    </button>
                    {settings.nedarim_plus_enabled !== 'false' && (
                      <button
                        type="button"
                        className="noc-btn gold"
                        style={{ flex: 1, minWidth: '150px' }}
                        disabled={busy}
                        onClick={() => {
                          setCreditCardData({ cardNumber: '', tokef: '', installments: 1, notes: payment.notes, amount: payment.amount });
                          setCreditError('');
                          setShowCreditModal(true);
                        }}
                      >
                        <CreditCard size={16} /> חיוב אשראי
                      </button>
                    )}
                  </div>
                </form>
              </div>

              <div>
                <div className="noc-card tight">
                  <div className="noc-row"><span className="noc-k">סה"כ חיובים</span><span style={{ flex: 1 }} /><span className="noc-amt">₪{(totalAmount || 0).toLocaleString('he-IL')}</span></div>
                  <div className="noc-row"><span className="noc-k">שולם</span><span style={{ flex: 1 }} /><span className="noc-amt" style={{ color: 'var(--noc-ok)' }}>₪{totalPaid.toLocaleString('he-IL')}</span></div>
                  <div className="noc-row"><span className="noc-k">יתרה</span><span style={{ flex: 1 }} /><span className="noc-amt" style={{ color: remaining > 0 ? 'var(--noc-alert)' : 'var(--noc-ok)' }}>₪{remaining.toLocaleString('he-IL')}</span></div>
                </div>

                <div className="noc-card tight" style={{ marginTop: '16px' }}>
                  <div className="noc-cap"><span>תשלומים שנרשמו</span></div>
                  {paymentsList.length === 0 ? (
                    <div className="noc-empty">טרם נרשמו תשלומים</div>
                  ) : (
                    <div className="noc-list">
                      {paymentsList.map((p, idx) => (
                        <div key={idx} className="noc-item">
                          <span className="noc-it-main">
                            <span className="noc-nm">{p.method}</span>
                            {p.notes && <span className="noc-meta">{p.notes}</span>}
                          </span>
                          <span className="noc-pr">₪{Number(p.amount).toLocaleString('he-IL')}</span>
                          <span className="noc-acts">
                            <button
                              type="button"
                              className="noc-mini del"
                              disabled={isChargedPayment(p)}
                              title={isChargedPayment(p) ? 'חיוב אשראי שכבר בוצע — לא ניתן להסרה' : 'הסר תשלום'}
                              aria-label="הסר תשלום"
                              onClick={() => removePayment(idx)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {remaining > 0 && (
                    <p className="noc-hint warn" style={{ marginTop: '12px' }}>
                      נותרה יתרה של ₪{remaining.toLocaleString('he-IL')}. סיום ההזמנה ללא תשלום מלא אפשרי רק באמצעות "יציאה באישור מנהל".
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

      <div className="noc">
        {showExitConfirm && (
          <div className="noc-ov" onClick={(e) => { if (e.target === e.currentTarget) setShowExitConfirm(false); }}>
            <div className="noc-box" role="dialog" aria-modal="true">
              <h3>יציאה מההזמנה</h3>
              <p>
                {draftOrderId
                  ? `ההזמנה שמורה כטיוטה #${draftOrderId} עם ${activeItems.length} פריטים, ואפשר להמשיך אותה מרשימת ההזמנות.`
                  : 'ההזמנה עדיין לא נשמרה. יציאה עכשיו תמחק את מה שהוזן במסך.'}
              </p>
              <div className="noc-box-acts">
                <button type="button" className="noc-btn line" onClick={() => setShowExitConfirm(false)}>המשך בהזמנה</button>
                <button type="button" className="noc-btn gold" onClick={() => router.push('/orders')}>
                  {draftOrderId ? 'צא — הטיוטה נשמרה' : 'צא בלי לשמור'}
                </button>
              </div>
            </div>
          </div>
        )}

        {duplicateCustomer && (
          <div className="noc-ov">
            <div className="noc-box" role="dialog" aria-modal="true" aria-labelledby="dup-title">
              <h3 id="dup-title" style={{ color: 'var(--noc-alert)' }}>
                <AlertTriangle size={18} style={{ verticalAlign: '-3px', marginLeft: '6px' }} /> לקוח קיים במערכת
              </h3>
              <p>הלקוח שהוזן זוהה במערכת לפי מספר הטלפון. אפשר להשתמש בכרטיס הקיים, או ליצור כרטיס נוסף.</p>
              <div className="noc-card tight" style={{ marginBottom: '20px' }}>
                <div className="noc-row"><span className="noc-k">שם</span><span className="noc-v"><strong>{getCustomerFullName(duplicateCustomer)}</strong></span></div>
                <div className="noc-row"><span className="noc-k">טלפון</span><span className="noc-v" dir="ltr" style={{ textAlign: 'right' }}>{duplicateCustomer.phone1}{duplicateCustomer.phone2 ? ` | ${duplicateCustomer.phone2}` : ''}</span></div>
                <div className="noc-row"><span className="noc-k">עיר</span><span className="noc-v">{duplicateCustomer.city || 'לא צוינה'}</span></div>
              </div>
              <div className="noc-box-acts">
                <button type="button" className="noc-ghost danger" onClick={() => handleSaveNewCustomerAndProceed(true)}>צור לקוח חדש בכל זאת</button>
                <span style={{ flex: 1 }} />
                <button type="button" className="noc-btn gold" onClick={() => handleUseExistingCustomer(duplicateCustomer)}>השתמש בלקוח הקיים</button>
              </div>
            </div>
          </div>
        )}

        {duplicateOrderWarning && (
          <div className="noc-ov">
            <div className="noc-box" role="dialog" aria-modal="true" aria-labelledby="dup-order-title">
              <h3 id="dup-order-title" style={{ color: 'var(--noc-alert)' }}>
                <AlertTriangle size={18} style={{ verticalAlign: '-3px', marginLeft: '6px' }} /> הזמנה זו כבר נשמרה
              </h3>
              <p>
                כבר קיימת הזמנה שמורה עבור אותו לקוח ואותו תאריך — הזמנה מס' {duplicateOrderWarning.existingOrderId}.
                כדאי לבדוק אותה לפני שממשיכים, כדי לא ליצור הזמנה כפולה.
              </p>
              <a
                href={`/orders/${duplicateOrderWarning.existingOrderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="noc-btn line"
                style={{ textDecoration: 'none', marginBottom: '20px' }}
              >
                <ExternalLink size={16} /> פתח את הזמנה #{duplicateOrderWarning.existingOrderId}
              </a>
              <div className="noc-box-acts">
                <button type="button" className="noc-ghost danger" onClick={handleConfirmDuplicateSave}>שמור בכל זאת כהזמנה נפרדת</button>
                <span style={{ flex: 1 }} />
                <button type="button" className="noc-btn gold" onClick={handleCancelDuplicateSave}>אבדוק את הקיימת</button>
              </div>
            </div>
          </div>
        )}

        {showCreditModal && (
          <div className="noc-ov" onClick={() => !isProcessingCredit && setShowCreditModal(false)}>
            <div className="noc-box wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="credit-title">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                <h3 id="credit-title" style={{ margin: 0 }}>חיוב באשראי (נדרים פלוס)</h3>
                <button
                  type="button"
                  className="noc-btn line"
                  style={{ padding: '7px 12px', fontSize: '0.85rem' }}
                  title="העברת כרטיס מהירה בקורא מגנטי"
                  onClick={() => { setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}
                >העברה מהירה</button>
              </div>

              {creditError && (
                <div className="noc-note-box err" style={{ marginBottom: '16px' }}>
                  <AlertTriangle size={16} /> <span>{creditError}</span>
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleProcessCreditCard(); }}>
                <label className="noc-lbl" htmlFor="cc-number">מספר כרטיס אשראי (או העברה בקורא)</label>
                <input
                  id="cc-number"
                  type="text"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  value={creditCardData.cardNumber}
                  onChange={handleCardNumberChange}
                  placeholder="0000 0000 0000 0000"
                  maxLength="19"
                  dir="ltr"
                  style={{ textAlign: 'left', letterSpacing: '2px', fontSize: '1.1rem' }}
                />

                <div className="noc-fields" style={{ marginTop: '13px' }}>
                  <div>
                    <label className="noc-lbl" htmlFor="cc-exp">תוקף (MM/YY)</label>
                    <input id="cc-exp" type="text" autoComplete="cc-exp" value={creditCardData.tokef} onChange={handleTokefChange} placeholder="12/25" maxLength="5" dir="ltr" style={{ textAlign: 'left', letterSpacing: '2px' }} />
                  </div>
                  <div>
                    <label className="noc-lbl" htmlFor="cc-amount">סכום לחיוב (₪)</label>
                    <input id="cc-amount" type="number" value={creditCardData.amount} onChange={e => setCreditCardData(prev => ({ ...prev, amount: e.target.value }))} style={{ fontWeight: 700, textAlign: 'center' }} />
                  </div>
                  <div>
                    <label className="noc-lbl" htmlFor="cc-installments">תשלומים</label>
                    <input id="cc-installments" type="number" min="1" max="12" value={creditCardData.installments} onChange={e => setCreditCardData(prev => ({ ...prev, installments: e.target.value }))} style={{ textAlign: 'center' }} />
                  </div>
                  <div>
                    <label className="noc-lbl" htmlFor="cc-notes">הערות לנדרים</label>
                    <input id="cc-notes" type="text" value={creditCardData.notes} onChange={e => setCreditCardData(prev => ({ ...prev, notes: e.target.value }))} />
                  </div>
                </div>

                <div className="noc-box-acts" style={{ marginTop: '20px' }}>
                  <button type="button" className="noc-btn line" onClick={() => setShowCreditModal(false)} disabled={isProcessingCredit}>ביטול</button>
                  <button type="submit" className="noc-btn gold" disabled={isProcessingCredit} aria-busy={isProcessingCredit}>
                    {isProcessingCredit ? <><span className="noc-spin sm" /> מבצע חיוב...</> : <><CreditCard size={16} /> בצע חיוב ושמור הזמנה</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showQuickSwipeModal && (
          <div className="noc-ov" onClick={() => setShowQuickSwipeModal(false)}>
            <div className="noc-box" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="swipe-title" style={{ textAlign: 'center' }}>
              <div className="noc-spin" />
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
              <div className="noc-box-acts" style={{ justifyContent: 'center' }}>
                <button type="button" className="noc-btn line" onClick={() => setShowQuickSwipeModal(false)}>ביטול</button>
              </div>
            </div>
          </div>
        )}

        {/* חסימת המסך בזמן חיוב/שמירה, כדי שאיש לא ילחץ פעמיים או ינווט באמצע */}
        {busy && (
          <div className="noc-ov" role="alertdialog" aria-live="assertive" aria-busy="true" aria-label="פעולה מתבצעת" style={{ zIndex: 1600 }}>
            <div className="noc-box" style={{ maxWidth: '320px', textAlign: 'center' }}>
              <div className="noc-spin" />
              <h3>{isProcessingCredit ? 'מבצע חיוב מול נדרים פלוס' : 'יוצר את ההזמנה'}</h3>
              <p style={{ margin: '8px 0 0' }}>
                {isProcessingCredit
                  ? 'אין לסגור את החלון עד לקבלת אישור מחברת האשראי.'
                  : 'מאמת זמינות מלאי, רושם פריטים ומחשב חיובים. נא לא לסגור את החלון.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * מגירה מתקפלת — כל מה שאינו חובה במסך יושב בתוכה, כדי שכל שלב יציג
 * רק את השדות שבאמת נדרשים כדי להתקדם.
 */
function NocCollapsible({ title, badge, defaultOpen = false, openWhen = false, children }) {
  const [open, setOpen] = useState(defaultOpen || openWhen);
  // עריכת פריט קיים ממלאת שדות שיושבים בתוך המגירה — היא נפתחת כדי שלא יעלמו מהעין.
  useEffect(() => {
    if (openWhen) setOpen(true);
  }, [openWhen]);
  return (
    <div className={`noc-more ${open ? 'open' : ''}`}>
      <button type="button" className="noc-more-t" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {title}
        {!open && badge ? <span className="noc-more-badge">{badge}</span> : null}
        <ChevronDown size={14} />
      </button>
      <div className="noc-more-c">{children}</div>
    </div>
  );
}
