'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarSearch, Edit2, Trash2, ArrowLeft, ArrowRight, Plus, Check, UserPlus, Sparkles, CreditCard, ShieldCheck, RefreshCw } from 'lucide-react';
import HebrewDatePicker from '../../../components/HebrewDatePicker';
import HebrewDateRangePicker from '../../../components/HebrewDateRangePicker';
import CustomerSelector from '../../../components/CustomerSelector';
import OrderModelSelector from '../../../components/orders/OrderModelSelector';
import ItemCapacityModal from '../../../components/orders/ItemCapacityModal';
import { calculateDynamicAvailability } from '../../../lib/clientInventory';
import { getHebrewDateString } from '../../../lib/hebrewDate';

const STEP_LABELS = [
  { id: 1, label: 'לקוח' },
  { id: 2, label: 'תאריכים' },
  { id: 3, label: 'פריטים' },
  { id: 4, label: 'סיכום' },
  { id: 5, label: 'תשלום' },
];

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
    fetch('/api/settings')
      .then(res => res.json())
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

  const handleSaveNewCustomerAndProceed = async (skipDuplicateCheck = false) => {
    if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone1) {
       alert('יש למלא שם פרטי, משפחה וטלפון');
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

  const executeSaveOrderForList = async (finalPaymentsList) => {
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

    const activeItems = (order.items || []).filter(i => !i.isDeleted);
    const hasDates = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;

    if (activeItems.length > 0 && hasDates) {
      try {
        const validateRes = await fetch('/api/orders/validate-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: activeItems,
            eventDate: order.eventDate,
            isAbroad: order.isAbroad,
            isWeekdayEvent: order.isWeekdayEvent,
            fromDate: order.fromDate,
            toDate: order.toDate,
            customSpacing: order.customSpacing,
            // Don't count the draft's own pending items against it.
            orderId: draftOrderIdRef.current
          })
        });

        const validateData = await validateRes.json();
        if (validateData.error) {
          abandonSave();
          alert(`שגיאה: ${validateData.error}`);
          return;
        }
        if (!validateData.valid) {
          abandonSave();
          const errorLines = validateData.errors.map(e => {
            const msg = `- ${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`;
            return e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg;
          }).join('\n');
          const customSpacingNote = validateData.errors.some(e => e.isCustomSpacingIssue)
            ? '\n\n💡 הערה: כמה מהבעיות קשורות לציפוף מיוחד. אם אתה בוטל בציפוף, נסה לבחור ציפוף קטן יותר.'
            : '';
          alert(`לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים:\n\n${errorLines}${customSpacingNote}`);
          return;
        }
      } catch (err) {
        console.error('Validation fetch error', err);
        abandonSave();
        alert('שגיאה בבדיקת המלאי מול השרת.');
        return;
      }
    }

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
        draftOrderId: draftOrderIdRef.current
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
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

  const selectedCustomerName = getCustomerFullName(order.selectedCustomer);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
        
        body {
          font-family: 'Heebo', sans-serif;
          background-color: var(--bg-color);
        }

        /* Playfair Display is only loaded at 400/600 - asking for 700+ made the
           browser synthesize a smeared faux-bold on every heading. */
        h1, h2, h3, h4 {
          font-family: 'Playfair Display', serif;
          font-weight: 600;
          color: var(--text-main);
        }

        .link-button {
          background: none;
          border: none;
          color: var(--primary-hover);
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          padding: 0.5rem 0.75rem;
          border-radius: 8px;
          text-decoration: underline;
          transition: background 0.2s ease;
        }
        .link-button:hover { background: var(--primary-light); }
        .link-button:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .modern-main-container {
          background-image:
            radial-gradient(at 0% 0%, hsla(43, 65%, 90%, 0.3) 0px, transparent 50%),
            radial-gradient(at 100% 0%, hsla(0, 0%, 100%, 0.8) 0px, transparent 50%);
          min-height: 100vh;

          /* Single source of truth for the wizard's width, so the stepper and
             every step card line up on exactly the same edges. */
          --wizard-width: 980px;
          --node-size: 36px;
          --node-half: 18px;

          /* Semantic colours - theme aware, replacing the hardcoded slate/blue
             hexes that used to be sprinkled inline (they broke dark mode). */
          --surface-soft: var(--element-bg);
          --surface-raised: var(--input-bg);
          --ok: #059669;
          --ok-soft: rgba(5, 150, 105, 0.12);
          --danger: #dc2626;
          --danger-soft: rgba(220, 38, 38, 0.1);
          --warn: #d97706;
          --warn-soft: rgba(217, 119, 6, 0.12);
          --info: #2563eb;
          --info-soft: rgba(37, 99, 235, 0.1);
        }

        [data-theme="dark"] .modern-main-container {
          background-image:
            radial-gradient(at 0% 0%, hsla(43, 65%, 20%, 0.45) 0px, transparent 50%),
            radial-gradient(at 100% 0%, hsla(0, 0%, 15%, 1) 0px, transparent 50%);
          --ok: #34d399;
          --ok-soft: rgba(52, 211, 153, 0.16);
          --danger: #fca5a5;
          --danger-soft: rgba(252, 165, 165, 0.16);
          --warn: #fcd34d;
          --warn-soft: rgba(252, 211, 77, 0.16);
          --info: #93c5fd;
          --info-soft: rgba(147, 197, 253, 0.16);
        }

        /* Every step renders inside this wrapper so all five steps are exactly
           the same width - no jumping when moving between them. */
        .wizard-step {
          width: 100%;
          max-width: var(--wizard-width);
          margin: 0.5rem auto;
          box-sizing: border-box;
        }

        /* Explicit radius so the accent bar matches .glass-card's corners even on
           cards that can't use overflow:hidden (they contain popup dropdowns). */
        .card-accent {
          position: absolute;
          top: 0;
          inset-inline: 0;
          height: 4px;
          background: var(--primary-color);
          border-radius: 20px 20px 0 0;
        }

        /* Keeps forms at a readable measure inside the full-width step cards. */
        .step-inner {
          max-width: 680px;
          margin: 0 auto;
        }

        .field-label {
          display: block;
          margin-bottom: 0.35rem;
          font-weight: 700;
          color: var(--text-main);
          font-size: 0.95rem;
        }

        .soft-panel {
          background: var(--surface-soft);
          padding: 1rem;
          border-radius: 12px;
          border: 1px solid var(--border-color);
        }

        /* ---------- Buttons ---------- */
        .btn-secondary {
          background: var(--surface-raised);
          color: var(--text-muted);
          border: 1px solid var(--element-border);
          border-radius: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }
        .btn-secondary:hover:not(:disabled) {
          border-color: var(--primary-color);
          color: var(--text-main);
        }

        .btn-success {
          background: var(--ok);
          color: #fff;
          border: none;
          border-radius: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          box-shadow: 0 6px 15px var(--ok-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-success:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.05);
        }
        .btn-success:disabled {
          background: var(--element-bg);
          color: var(--text-muted);
          box-shadow: none;
          cursor: not-allowed;
        }

        .btn-soft {
          background: var(--primary-light);
          color: var(--primary-hover);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          font-weight: 700;
          font-size: 1.05rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-soft:hover:not(:disabled) {
          background: rgba(212, 175, 55, 0.28);
          border-color: var(--primary-color);
        }
        .btn-soft:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .btn-danger-outline {
          background: transparent;
          color: var(--danger);
          border: 1px solid var(--danger);
          border-radius: 12px;
          font-weight: 800;
          font-size: 1.05rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        .btn-danger-outline:hover:not(:disabled) { background: var(--danger-soft); }
        .btn-danger-outline:focus-visible {
          outline: 2px solid var(--danger);
          outline-offset: 2px;
        }

        /* ---------- Spinner / blocking overlay ---------- */
        @keyframes spin { to { transform: rotate(360deg); } }

        .spinner {
          width: 54px;
          height: 54px;
          border-radius: 50%;
          border: 4px solid var(--divider);
          border-top-color: var(--primary-color);
          animation: spin 0.8s linear infinite;
        }
        /* Inline (in-button) variant - inherits the button's text colour so it
           reads on the gold primary and the green success button alike. */
        .spinner.small {
          width: 18px;
          height: 18px;
          border-width: 3px;
          border-color: currentColor;
          border-top-color: transparent;
          opacity: 0.85;
        }

        .blocking-overlay {
          position: fixed;
          inset: 0;
          z-index: 2000;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          direction: rtl;
          animation: fadeIn 0.2s ease forwards;
        }
        .blocking-overlay__card {
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          padding: 2.2rem 2.6rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          max-width: 90vw;
        }

        /* ---------- Step 3 layout ---------- *
         * Explicit two-column grid instead of flex ratios: the columns are a
         * fixed fraction of the wizard width, so neither panel's content can
         * push the other one narrower (that was the "width jumps" bug).        */
        .step3-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
          gap: 1rem;
          align-items: start;
        }
        @media (max-width: 860px) {
          .step3-grid { grid-template-columns: minmax(0, 1fr); }
        }

        /* Toggles + length always share one row - "אורך" can't drop below. */
        .alterations-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(120px, 1.1fr);
          gap: 0.6rem;
          align-items: center;
        }

        .toggle-chip {
          padding: 0.45rem 0.6rem;
          border-radius: 10px;
          cursor: pointer;
          background: var(--surface-raised);
          color: var(--text-muted);
          border: 1px solid var(--element-border);
          font-weight: 700;
          font-size: 0.95rem;
          font-family: inherit;
          transition: all 0.2s ease;
          min-height: 40px;
        }
        .toggle-chip:hover { border-color: var(--primary-color); }
        .toggle-chip.on {
          background: var(--primary-color);
          color: var(--btn-primary-text);
          border-color: var(--primary-hover);
          box-shadow: var(--shadow-sm);
        }

        .length-field {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          min-width: 0;
        }
        .length-field label { flex-shrink: 0; }

        .icon-btn {
          background: var(--surface-soft);
          border: 1px solid var(--element-border);
          color: var(--primary-hover);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.3rem;
          border-radius: 6px;
          transition: all 0.2s ease;
        }
        .icon-btn:hover { background: var(--primary-light); border-color: var(--primary-color); }
        .icon-btn.warn { color: var(--warn); }
        .icon-btn.warn:hover { background: var(--warn-soft); border-color: var(--warn); }
        .icon-btn.danger { color: var(--danger); }
        .icon-btn.danger:hover { background: var(--danger-soft); border-color: var(--danger); }

        .size-card-interactive { font-family: inherit; }

        /* ---------- Shared modal shell ---------- */
        /* globals.css only locks body scroll for .modal-overlay/.popup-overlay,
           which these don't use - so lock it here too. */
        body:has(.modal-shell-overlay),
        body:has(.blocking-overlay) {
          overflow: hidden;
        }

        .modal-shell-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          background: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          animation: fadeIn 0.2s ease forwards;
        }
        .modal-shell {
          position: relative;
          direction: rtl;
          width: 100%;
          max-width: 520px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 1.75rem;
          background: var(--card-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          box-shadow: var(--shadow-lg);
          color: var(--text-main);
        }
        .modal-shell::before {
          content: '';
          position: absolute;
          inset-inline: 0;
          top: 0;
          height: 4px;
          background: var(--primary-color);
        }
        .modal-shell-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .modal-shell-header h3 { margin: 0; font-size: 1.35rem; font-weight: 600; }
        .modal-shell-close {
          flex: 0 0 auto;
          width: 40px;
          height: 40px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: 50%;
          font-size: 1.35rem;
          line-height: 1;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s ease;
        }
        .modal-shell-close:hover { background: var(--element-bg); color: var(--text-main); }
        .modal-shell-panel {
          background: var(--surface-soft);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1rem;
          margin-bottom: 1.25rem;
        }
        .modal-shell-footer { display: flex; flex-wrap: wrap; gap: 0.8rem; }
        .modal-shell-footer > * { flex: 1 1 180px; }
        @media (max-width: 480px) {
          .modal-shell { padding: 1.25rem; border-radius: 16px; }
        }

        /* ---------- Inputs ---------- */
        .wizard-input,
        .premium-input {
          width: 100%;
          padding: 0.75rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--element-border);
          background: var(--input-bg);
          color: var(--text-main);
          font-family: inherit;
          font-size: 1.05rem;
          outline: none;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .wizard-input:focus,
        .premium-input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-light);
        }
        .wizard-input.compact {
          padding: 0.6rem 0.75rem;
          font-size: 1rem;
        }
        .wizard-input::placeholder,
        .premium-input::placeholder { color: var(--text-muted); }

        .field-label.sub {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-muted);
        }

        /* Auto-fitting form grid - fields never squeeze into unreadable columns. */
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 0.8rem;
        }

        /* ---------- Focus visibility (the classes above all clear the outline) ---------- */
        .primary-button:focus-visible,
        .btn-secondary:focus-visible,
        .btn-success:focus-visible,
        .toggle-chip:focus-visible,
        .icon-btn:focus-visible,
        .size-card-interactive:focus-visible,
        .modal-shell-close:focus-visible,
        .radio-card:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
        }

        .glass-card {
          background: var(--card-bg);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          box-shadow: var(--shadow-lg);
          border: 1px solid var(--border-color);
          border-radius: 20px;
          transition: all 0.3s ease;
        }

        /* ---------- Stepper ---------- *
         * Laid out as a 5 equal-column grid so every step occupies exactly the
         * same width; the label sits in normal flow under its node (not absolute)
         * so labels can never collide with each other. The connector between two
         * nodes is drawn per-column, so it always meets the circles' centers no
         * matter how wide the container gets.                                    */
        .stepper-container {
          background: var(--card-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border-color);
          border-radius: 18px;
          padding: 1.1rem 1.25rem;
          box-shadow: var(--shadow-sm);
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          align-items: start;
          position: relative;
          width: 100%;
          max-width: var(--wizard-width);
          margin: 0 auto 1.25rem auto;
          box-sizing: border-box;
        }

        .step-item {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
          background: none;
          border: none;
          padding: 0;
          font-family: inherit;
          text-align: center;
        }

        /* Connector segment from this node back to the previous one (RTL: to the right) */
        .step-item:not(:first-child)::before,
        .step-item:not(:first-child)::after {
          content: '';
          position: absolute;
          top: var(--node-half);
          right: calc(50% + var(--node-half) + 6px);
          width: calc(100% - var(--node-size) - 12px);
          height: 3px;
          border-radius: 3px;
          transform: translateY(-50%);
        }
        .step-item:not(:first-child)::before {
          background: var(--divider);
        }
        .step-item:not(:first-child)::after {
          background: var(--primary-color);
          transform: translateY(-50%) scaleX(0);
          transform-origin: right center;
          transition: transform 0.45s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .step-item.reached:not(:first-child)::after {
          transform: translateY(-50%) scaleX(1);
        }

        .step-node {
          width: var(--node-size);
          height: var(--node-size);
          border-radius: 50%;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: var(--text-muted);
          position: relative;
          z-index: 2;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: var(--shadow-sm);
          font-size: 0.95rem;
          flex-shrink: 0;
        }

        .step-item.completed .step-node {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: var(--btn-primary-text);
        }

        .step-item.active .step-node {
          background: var(--primary-color);
          border-color: var(--primary-hover);
          color: var(--btn-primary-text);
          box-shadow: 0 0 0 4px var(--primary-light), var(--shadow-sm);
          transform: scale(1.08);
        }

        .step-item.clickable:hover:not(.active) .step-node {
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }
        .step-item:focus-visible {
          outline: none;
        }
        .step-item:focus-visible .step-node {
          box-shadow: 0 0 0 3px var(--primary-color);
        }

        .step-label {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-muted);
          line-height: 1.2;
          transition: color 0.3s ease;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .step-item.active .step-label {
          color: var(--text-main);
          font-weight: 800;
        }
        .step-item.completed .step-label {
          color: var(--text-main);
        }

        @media (max-width: 768px) {
          .stepper-container {
            padding: 0.9rem 0.6rem;
            --node-size: 32px;
            --node-half: 16px;
          }
          .step-node { font-size: 0.85rem; }
          .step-label { font-size: 0.72rem; }
        }

        @media (max-width: 420px) {
          .stepper-container {
            padding: 0.8rem 0.4rem;
            --node-size: 28px;
            --node-half: 14px;
          }
          .step-node { font-size: 0.8rem; }
          .step-label { font-size: 0.62rem; }
        }

        .cart-item-card {
          background: var(--card-bg);
          border-radius: 10px;
          padding: 0.5rem 0.8rem;
          margin-bottom: 0.5rem;
          border: 1px solid var(--border-color);
          box-shadow: var(--shadow-sm);
          animation: slideInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          transition: all 0.3s ease;
        }
        .cart-item-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
          border-color: var(--primary-color);
        }
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .primary-button {
          background: var(--primary-color);
          color: var(--btn-primary-text);
          border: none;
          border-radius: 12px;
          font-size: 1.05rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: var(--shadow-sm);
          outline: none;
        }
        .primary-button:hover:not(:disabled) {
          transform: translateY(-1px);
          background: var(--primary-hover);
        }
        .primary-button:active:not(:disabled) {
          transform: translateY(0);
        }
        .primary-button:disabled {
          background: var(--element-bg);
          border: 1px solid var(--element-border);
          box-shadow: none;
          cursor: not-allowed;
          color: var(--text-muted);
        }
        
        .radio-card {
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 0.6rem 1rem;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          align-items: center;
          gap: 1rem;
          background: var(--card-bg);
          position: relative;
          overflow: hidden;
        }
        .radio-card:hover {
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }
        .radio-card.active {
          border-color: var(--primary-color);
          background: var(--primary-light);
        }
        .radio-card.active::before {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 4px;
          height: 100%;
          background: var(--primary-color);
        }

        /* .premium-input is the older alias of .wizard-input - kept so existing
           markup keeps working, but defined once so the two can't drift apart. */

        /* custom styling for sizes */
        .size-card-interactive {
          padding: 0.35rem 0.6rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background: var(--card-bg);
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 65px;
          box-shadow: var(--shadow-sm);
        }
        .size-card-interactive:hover:not(.disabled) {
          border-color: var(--primary-color);
          transform: translateY(-1px);
        }
        .size-card-interactive.selected {
          border-color: var(--primary-color);
          background: var(--primary-light);
        }
        .size-card-interactive.disabled {
          border-color: var(--element-border);
          background: var(--element-bg);
          cursor: not-allowed;
          opacity: 0.5;
        }
      `}</style>
      
      <main className="modern-main-container" style={{ padding: '4.2rem 1.5rem 0.5rem 1.5rem', margin: '0 auto', direction: 'rtl', minHeight: 'calc(100vh - 4.5rem)', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>
        
        {/* Floating Stepper */}
        <nav className="stepper-container" aria-label="שלבי ההזמנה">
          {STEP_LABELS.map(({ id, label }) => {
            const isClickable = canNavigateToStep(id);
            const state = step === id ? 'active' : step > id ? 'completed' : '';
            return (
              <button
                type="button"
                key={id}
                className={`step-item ${state} ${step >= id ? 'reached' : ''} ${isClickable ? 'clickable' : ''}`}
                aria-current={step === id ? 'step' : undefined}
                onClick={() => {
                  if (isClickable) {
                    setStep(id);
                  } else {
                    if (id === 2 && !order.customerId) alert('יש לבחור לקוח תחילה');
                    else if (id === 3 && !(order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate)) alert('יש למלא תאריכים תחילה');
                    else if ((id === 4 || id === 5) && order.items.length === 0) alert('יש להוסיף לפחות פריט אחד להזמנה');
                  }
                }}
                style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
              >
                <span className="step-node">{step > id ? <Check size={16} strokeWidth={3} /> : id}</span>
                <span className="step-label">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Without this the autosave is invisible, and an employee who closes the screen has no
            way of knowing the order is waiting for them in the list. */}
        {draftOrderId && !saving && (
          <div className="fade-in" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', margin: '0 0 0.6rem 0', fontSize: '0.85rem', color: '#c2410c' }}>
            <ShieldCheck size={15} />
            <span>נשמר כטיוטה — הזמנה #{draftOrderId}. הפריטים שמורים למשך זמן מוגבל גם אם תסגור את המסך.</span>
          </div>
        )}

        {/* STEP 1: CUSTOMER */}
        {step === 1 && (
          <div className="fade-in glass-card wizard-step" style={{ padding: '1.2rem', position: 'relative' }}>
            <div className="card-accent"></div>
            <div className="step-inner">
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.4rem', fontWeight: 600 }}>מי הלקוח?</h2>

            {searchMode === 'phone' && !foundCustomerFromPhone && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '100%' }}>
                  <label className="field-label" htmlFor="cust-phone" style={{ fontSize: '1.05rem' }}>מספר הטלפון של הלקוח</label>
                  <input id="cust-phone" type="tel"
                    className="wizard-input"
                    value={phoneSearchInput}
                    onChange={e => setPhoneSearchInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                    placeholder="הזן מספר טלפון (05...)"
                    style={{ fontSize: '1.2rem', textAlign: 'center' }}
                  />
                </div>

                <button type="button" onClick={handleCheckPhone} disabled={isCheckingPhone} className="primary-button" style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  {isCheckingPhone ? 'מחפש...' : (
                    <>
                      <span>המשך</span>
                      <ArrowLeft size={18} />
                    </>
                  )}
                </button>

                <button type="button" onClick={() => setSearchMode('name')} className="btn-secondary" style={{ width: '100%', padding: '0.7rem', marginTop: '0.25rem' }}>
                  או חפש לקוח קיים מהרשימה
                </button>
              </div>
            )}

            {searchMode === 'phone' && foundCustomerFromPhone && (
              <div className="fade-in" style={{ textAlign: 'center', background: 'var(--primary-light)', padding: '1.5rem 1rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ width: '50px', height: '50px', background: 'var(--primary-color)', color: 'var(--btn-primary-text)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem auto', boxShadow: '0 5px 10px rgba(212, 175, 55, 0.25)' }}>
                  👋
                </div>
                <h3 style={{ fontSize: '1.35rem', color: 'var(--text-main)', marginBottom: '0.3rem', fontWeight: 600 }}>שלום {getCustomerFullName(foundCustomerFromPhone)}!</h3>
                <p style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '1.2rem' }}>מצאנו אותך במערכת (טלפון: {foundCustomerFromPhone.phone1}). האם זה אתה?</p>

                <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column' }}>
                  <button type="button" onClick={() => handleUseExistingCustomer(foundCustomerFromPhone)} className="primary-button" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                    <Check size={18} />
                    <span>כן, המשך להזמנה</span>
                  </button>
                  <button type="button" onClick={() => {
                      setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
                      setFoundCustomerFromPhone(null);
                      setSearchMode('new');
                    }}
                    className="btn-secondary"
                    style={{ padding: '0.75rem', fontSize: '1.05rem' }}
                  >
                    <span>לא, יצירת לקוח חדש</span>
                  </button>
                </div>
              </div>
            )}

            {searchMode === 'name' && (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <label className="field-label" style={{ marginBottom: 0, fontSize: '1.05rem' }}>חיפוש ובחירת לקוח מהרשימה</label>
                  <button type="button" onClick={() => setSearchMode('phone')} className="link-button">חזור להזנת טלפון</button>
                </div>
                <CustomerSelector 
                  value={order.selectedCustomer}
                  onChange={(c) => setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }))}
                  placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                />
                
                <button type="button" onClick={proceedToStep2} disabled={!order.customerId} className="primary-button" style={{ width: '100%', marginTop: '1.5rem', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <span>המשך לשלב הבא</span>
                  <ArrowLeft size={18} />
                </button>
              </div>
            )}

            {searchMode === 'new' && (
              <div className="fade-in">
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--divider)' }}>
                  <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.3rem', fontWeight: 600 }}>יצירת לקוח חדש</h3>
                  <button type="button" onClick={() => { setFoundCustomerFromPhone(null); setSearchMode('phone'); }} className="link-button">חזור</button>
                 </div>

                 <div className="form-grid">
                  <div>
                    <label className="field-label sub" htmlFor="cust-firstName">שם פרטי <span aria-hidden="true">*</span></label>
                    <input id="cust-firstName" type="text" required aria-required="true" className="wizard-input compact" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({...prev, firstName: e.target.value}))} />
                  </div>
                  <div>
                    <label className="field-label sub" htmlFor="cust-lastName">שם משפחה <span aria-hidden="true">*</span></label>
                    <input id="cust-lastName" type="text" required aria-required="true" className="wizard-input compact" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({...prev, lastName: e.target.value}))} />
                  </div>
                  <div>
                    <label className="field-label sub" htmlFor="cust-phone1">טלפון נייד <span aria-hidden="true">*</span></label>
                    <input id="cust-phone1" type="tel" required aria-required="true" className="wizard-input compact" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({...prev, phone1: e.target.value}))} />
                  </div>
                  <div>
                    <label className="field-label sub" htmlFor="cust-email">אימייל</label>
                    <input id="cust-email" type="email" className="wizard-input compact" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({...prev, email: e.target.value}))} />
                  </div>
                  <div>
                    <label className="field-label sub" htmlFor="cust-city">עיר מגורים</label>
                    <input id="cust-city" type="text" className="wizard-input compact" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({...prev, city: e.target.value}))} />
                  </div>
                  <div>
                    <label className="field-label sub" htmlFor="cust-street">רחוב</label>
                    <input id="cust-street" type="text" className="wizard-input compact" value={newCustomer.street || ''} onChange={e => setNewCustomer(prev => ({...prev, street: e.target.value}))} />
                  </div>
                  <div>
                    <label className="field-label sub" htmlFor="cust-house">בית</label>
                    <input id="cust-house" type="text" className="wizard-input compact" value={newCustomer.houseNum || ''} onChange={e => setNewCustomer(prev => ({...prev, houseNum: e.target.value}))} />
                  </div>
                </div>

                <button type="button" onClick={() => handleSaveNewCustomerAndProceed()} className="primary-button" style={{ width: '100%', marginTop: '1.2rem', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} />
                  <span>שמור לקוח והמשך</span>
                  <ArrowLeft size={18} />
                </button>
              </div>
            )}

            <div style={{ marginTop: '1.2rem', textAlign: 'center' }}>
               <Link href="/orders" className="link-button" style={{ color: 'var(--text-muted)', display: 'inline-block' }}>ביטול וחזרה לרשימת ההזמנות</Link>
            </div>
            </div>
          </div>
        )}

        {/* STEP 2: DATES */}
        {step === 2 && (
          <div className="fade-in glass-card wizard-step" style={{ padding: '1.2rem', position: 'relative' }}>
            <div className="card-accent"></div>
            <div className="step-inner">
            <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.4rem', fontWeight: 600 }}>תאריכי ההזמנה</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <label className={`radio-card ${!order.isAbroad ? 'active' : ''}`}>
                <input type="radio" name="orderType" checked={!order.isAbroad} onChange={() => handleDateChangeWithValidation('isAbroad', false)} style={{ accentColor: 'var(--primary-color)', transform: 'scale(1.1)' }} />
                <div>
                  <h3 style={{ margin: '0 0 0.1rem 0', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600 }}>אירוע רגיל</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>תאריך אירוע אחד</p>
                </div>
              </label>
              <label className={`radio-card ${order.isAbroad ? 'active' : ''}`}>
                <input type="radio" name="orderType" checked={!!order.isAbroad} onChange={() => handleDateChangeWithValidation('isAbroad', true)} style={{ accentColor: 'var(--primary-color)', transform: 'scale(1.1)' }} />
                <div>
                  <h3 style={{ margin: '0 0 0.1rem 0', color: 'var(--text-main)', fontSize: '1.1rem', fontWeight: 600 }}>אירוע חו"ל / תפוסה ארוכה</h3>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>הזנת טווח תאריכים</p>
                </div>
              </label>
            </div>

            <div style={{ background: 'var(--surface-soft)', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px dashed var(--border-color)', marginBottom: '1rem' }}>
              {/* Both branches use the same width so the card doesn't resize when
                  the event type is toggled. */}
              {!order.isAbroad ? (
                <div style={{ textAlign: 'center' }}>
                  <label className="field-label" style={{ fontSize: '1.05rem' }}>תאריך אירוע <span aria-hidden="true">*</span></label>
                  <div style={{ maxWidth: '420px', margin: '0 auto' }}>
                    <HebrewDatePicker value={order.eventDate} onChange={(date) => handleDateChangeWithValidation('eventDate', date)} />
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', maxWidth: '420px', margin: '0 auto' }}>
                  <label className="field-label" style={{ fontSize: '1.05rem', textAlign: 'center' }}>טווח תאריכים (מתאריך עד תאריך) <span aria-hidden="true">*</span></label>
                  <HebrewDateRangePicker
                    startDate={order.fromDate}
                    endDate={order.toDate}
                    onChange={(start, end) => handleDateChangeWithValidation({ fromDate: start, toDate: end })}
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label className="field-label" htmlFor="order-notes" style={{ fontSize: '1.05rem' }}>הערות כלליות להזמנה</label>
              <textarea
                id="order-notes"
                name="notes"
                className="wizard-input"
                value={order.notes}
                onChange={handleOrderChange}
                placeholder="הערות מיוחדות, בקשות שקשורות לתאריכים..."
                style={{ minHeight: '80px', resize: 'vertical', fontSize: '1rem' }}
              />
            </div>

            <div style={{ marginTop: '0.5rem', background: 'var(--banner-rentals-bg)', border: '1px solid var(--banner-rentals-border)', padding: '0.8rem 1.2rem', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label htmlFor="custom-spacing" style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '1.05rem', margin: 0 }}>ציפוף ימים מיוחד:</label>
                  <select
                    id="custom-spacing"
                    className="wizard-input"
                    value={order.customSpacing !== null && order.customSpacing !== undefined ? order.customSpacing : ''}
                    onChange={async (e) => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      
                      const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : 3;
                      const newSpacing = (val !== null && val !== undefined) ? val : 3;
                      
                      if (newSpacing < 3 && newSpacing < prevSpacing) {
                        const authResult = await window.customAuthPrompt("שינוי ציפוף ימים מיוחד להזמנה דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:", 'מנהל');
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
                    }}
                    style={{ fontWeight: 'bold', width: 'auto', minWidth: '200px' }}
                  >
                    <option value="">רגיל (לפי המערכת)</option>
                    <option value="1">1 יום רווח</option>
                    <option value="2">2 ימי רווח</option>
                    <option value="3">3 ימי רווח</option>
                    <option value="4">4 ימי רווח</option>
                    <option value="0">ללא רווח כלל (0)</option>
                  </select>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.4rem 0 0 0', fontWeight: '500' }}>* בחירת ציפוף מיוחד תשפיע על בדיקת המלאי להזמנה זו בלבד ותצבע את כרטיס ההזמנה בצהוב (דורש הרשאת מנהל).</p>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStep(1)} className="btn-secondary" style={{ padding: '0.8rem 1.5rem', fontSize: '1.05rem', flex: '0 0 auto', minWidth: '120px' }}>
                <ArrowRight size={18} />
                <span>חזור</span>
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={order.isAbroad ? (!order.fromDate || !order.toDate) : !order.eventDate}
                className="primary-button"
                style={{ flex: 1, minWidth: '200px', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>המשך לבחירת פריטים</span>
                <ArrowLeft size={18} />
              </button>
            </div>
            </div>
          </div>
        )}

        {/* STEP 3: ADD ITEMS (Side by Side) */}
        {step === 3 && (
          <div className="fade-in wizard-step step3-grid">

            {/* Add Item Form (Right Side) */}
            <div className="glass-card" style={{ padding: '1.2rem', position: 'relative', minWidth: 0 }}>
              <div className="card-accent"></div>
              <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.4rem', fontWeight: 600 }}>הוספת פריט חדש</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <label className="field-label" htmlFor="item-model">בחר דגם</label>
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
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <label className="field-label" style={{ marginBottom: 0 }}>בחר מידה {loadingSizes && <span style={{color: 'var(--text-muted)', fontWeight:'normal'}}>(בודק זמינות...)</span>}</label>
                    <button
                      onClick={refreshInventory}
                      disabled={loadingPreload || loadingSizes}
                      title="רענן זמינות מלאי"
                      aria-label="רענן זמינות מלאי"
                      style={{
                        background: 'none', border: 'none', cursor: (loadingPreload || loadingSizes) ? 'not-allowed' : 'pointer',
                        color: (loadingPreload || loadingSizes) ? 'var(--text-muted)' : 'var(--primary-color)',
                        display: 'flex', alignItems: 'center', padding: '0.2rem'
                      }}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '44px', alignItems: 'center' }}>
                    {availableSizes.length === 0 ? (
                      <div style={{ padding: '0.5rem 0.8rem', background: 'var(--surface-soft)', color: 'var(--text-muted)', borderRadius: '8px', border: '1px solid var(--border-color)', width: '100%', fontSize: '0.9rem' }}>
                        {newItem.dressModelId ? 'אין מידות זמינות לתאריך זה.' : 'בחר דגם כדי לראות מידות זמינות.'}
                      </div>
                    ) : (
                      availableSizes.map(s => {
                        const normalAvail = s.withNormalBuffer?.availableQuantity ?? s.availableQuantity ?? 0;
                        const customAvail = s.withCustomSpacing?.availableQuantity;
                        const selectedAvail = s.withCustomSpacing ? customAvail : normalAvail;
                        const isAvailable = selectedAvail > 0;
                        const isSelected = newItem.sizeText === s.sizeText;

                        // הצג טיפ עם שתי הכמויות
                        const tooltipText = s.withCustomSpacing
                          ? `רגיל: ${normalAvail} | ציפוף: ${customAvail}${s.withCustomSpacing.gain > 0 ? ` (+${s.withCustomSpacing.gain})` : ''}`
                          : `זמין: ${normalAvail}`;

                        return (
                          <button
                            type="button"
                            key={s.sizeText}
                            disabled={!isAvailable}
                            aria-pressed={isSelected}
                            title={tooltipText}
                            onClick={() => {
                              if (isAvailable) {
                                handleNewItemChange({ target: { name: 'sizeText', value: s.sizeText } });
                              }
                            }}
                            className={`size-card-interactive ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}`}
                          >
                            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: isAvailable ? 'var(--text-main)' : 'var(--danger)', lineHeight: '1.2' }}>{s.sizeText}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isAvailable ? 'var(--ok)' : 'var(--danger)', marginTop: '0.1rem' }}>
                              {isAvailable ? (
                                s.withCustomSpacing ? (
                                  <>
                                    <span>{normalAvail} רגיל</span>
                                    {s.withCustomSpacing.gain > 0 && <span style={{ marginLeft: '0.3rem', color: 'var(--success)' }}>+{s.withCustomSpacing.gain} ציפוף</span>}
                                  </>
                                ) : (
                                  `${normalAvail} פנויות`
                                )
                              ) : 'אזל'}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="soft-panel">
                  <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '1.05rem', color: 'var(--text-main)', fontWeight: 600 }}>תיקונים נדרשים</h4>
                  {/* Fixed 3-column grid: the two toggles and the length field always
                      share one row, so "אורך" can no longer drop to a line of its own. */}
                  <div className="alterations-row">
                    <button
                      type="button"
                      aria-pressed={!!newItem.neckAlteration}
                      onClick={() => handleNewItemChange({ target: { name: 'neckAlteration', value: !newItem.neckAlteration }})}
                      className={`toggle-chip ${newItem.neckAlteration ? 'on' : ''}`}
                    >
                      צוואר
                    </button>
                    <button
                      type="button"
                      aria-pressed={!!newItem.sleeveAlteration}
                      onClick={() => handleNewItemChange({ target: { name: 'sleeveAlteration', value: !newItem.sleeveAlteration }})}
                      className={`toggle-chip ${newItem.sleeveAlteration ? 'on' : ''}`}
                    >
                      שרוול
                    </button>
                    <div className="length-field">
                      <label htmlFor="item-length" style={{ fontWeight: '700', color: 'var(--text-muted)', fontSize: '0.95rem' }}>אורך:</label>
                      <input id="item-length" type="number" className="premium-input" value={newItem.lengthAlteration || ''} onChange={handleNewItemChange} name="lengthAlteration" placeholder="ס״מ" style={{ minWidth: 0, padding: '0.4rem', textAlign: 'center', fontSize: '0.95rem' }} />
                    </div>
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <label className="field-label" htmlFor="item-repairs" style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      הערות לתיקון {(newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration) && <span style={{color: 'var(--danger)'}}>* (חובה)</span>}
                    </label>
                    <input
                      id="item-repairs"
                      type="text"
                      className="premium-input"
                      name="repairs"
                      value={newItem.repairs || ''}
                      onChange={handleNewItemChange}
                      placeholder="פרטים נוספים לתופרת..."
                      style={{
                        padding: '0.6rem 0.8rem',
                        fontSize: '0.95rem',
                        borderColor: ((newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration) && (!newItem.repairs || !newItem.repairs.trim())) ? 'var(--danger)' : undefined
                      }}
                    />
                  </div>
                </div>

                <button 
                  onClick={addItemToOrder}
                  disabled={!newItem.sampleItemId || !newItem.sizeText}
                  className="primary-button"
                  style={{ 
                    width: '100%', 
                    padding: '0.6rem 1.2rem', 
                    fontSize: '1rem', 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '0.5rem'
                  }}
                >
                  <Plus size={18} />
                  <span>הוסף להזמנה</span>
                </button>
              </div>
            </div>

            {/* Live Cart (Left Side) */}
            <div className="glass-card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>הסל שלך</h3>

              {order.items.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1.5rem 1rem', background: 'var(--surface-soft)', borderRadius: '12px', border: '2px dashed var(--border-color)', fontWeight: '600', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  טרם הוספת פריטים להזמנה
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: 0 }}>
                  <div tabIndex={0} role="region" aria-label="פריטים בסל" style={{ overflowY: 'auto', maxHeight: 'min(46vh, 340px)', overscrollBehavior: 'contain', paddingInlineEnd: '0.35rem', margin: '0.2rem 0' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="cart-item-card" style={{ animationDelay: `${idx * 0.1}00ms` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: 'var(--text-main)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.dressName || 'דגם לא ידוע'}</div>
                          <div style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.05rem 0.4rem', borderRadius: '4px', fontWeight: '700', fontSize: '0.78rem', flexShrink: 0, whiteSpace: 'nowrap' }}>מידה {item.sizeText}</div>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          {[item.neckAlteration && 'צוואר', item.sleeveAlteration && 'שרוול', item.lengthAlteration && `אורך (${item.lengthAlteration})`].filter(Boolean).join(', ') || 'ללא תיקונים'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem' }}>
                          <div style={{ fontWeight: '800', color: 'var(--ok)', fontSize: '0.95rem' }}>
                            ₪{calculatedData.items[idx] ? calculatedData.items[idx].calculatedPrice : item.finalPrice}
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button type="button" className="icon-btn" onClick={(e) => { e.preventDefault(); setCapacityModalItem(item); }} title="בדוק תפוסה לתאריך אירוע" aria-label="בדוק תפוסה לתאריך אירוע">
                              <CalendarSearch size={14} strokeWidth={2.5} />
                            </button>
                            <button type="button" className="icon-btn warn" onClick={() => editItem(idx)} title="ערוך" aria-label="ערוך פריט">
                              <Edit2 size={14} strokeWidth={2.5} />
                            </button>
                            <button type="button" className="icon-btn danger" onClick={() => removeItem(idx)} title="מחק" aria-label="מחק פריט">
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--text-main)' }}>סה"כ:</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--ok)' }}>₪{totalAmount}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.8rem' }}>
                <button type="button" onClick={() => setStep(2)} className="btn-secondary" style={{ padding: '0.6rem', fontSize: '0.95rem', flex: 1 }}>
                  <ArrowRight size={16} />
                  <span>חזור</span>
                </button>
                <button type="button" onClick={() => setStep(4)} disabled={order.items.length === 0} className="primary-button" style={{ padding: '0.6rem', flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                  <span>המשך לסיכום</span>
                  <ArrowLeft size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUMMARY */}
        {step === 4 && (
          <div className="fade-in glass-card wizard-step" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
            <div className="card-accent"></div>
            <h2 style={{ marginBottom: '0.4rem', fontSize: '1.4rem', fontWeight: 600 }}>סיכום ההזמנה</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1rem' }}>אנא ודא שפרטי ההזמנה נכונים לפני מעבר לתשלום.</p>

            <div className="soft-panel" style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>לקוח:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: '800' }}>{selectedCustomerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>סוג אירוע:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: '800' }}>{order.isAbroad ? 'אירוע חו"ל / תפוסה ארוכה' : 'אירוע רגיל'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>תאריכים:</span>
                <span style={{ color: 'var(--text-main)', fontWeight: '800', textAlign: 'end' }}>
                  {order.isAbroad ? (
                    <>
                      {`מ-${getHebrewDateString(order.fromDate)} עד ${getHebrewDateString(order.toDate)} `}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'normal' }}>
                        {`(${order.fromDate} - ${order.toDate})`}
                      </span>
                    </>
                  ) : (
                    <>
                      {getHebrewDateString(order.eventDate) + ' '}
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 'normal' }}>
                        {`(${order.eventDate})`}
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <h3 style={{ color: 'var(--text-main)', fontSize: '1.2rem', marginBottom: '0.8rem', fontWeight: 600 }}>פירוט פריטים ({order.items.length})</h3>

              <div tabIndex={0} role="region" aria-label="רשימת פריטים בהזמנה" style={{ overflowY: 'auto', maxHeight: 'min(42vh, 340px)', overscrollBehavior: 'contain', paddingInlineEnd: '0.35rem', borderBottom: '1px solid var(--divider)' }}>
                {order.items.map((item, idx) => {
                   const calcItem = calculatedData.items[idx];
                   const displayPrice = calcItem ? calcItem.calculatedPrice : item.finalPrice;
                   const repairsCost = calcItem && calcItem.repairsCost ? calcItem.repairsCost : 0;
                   return (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0.5rem', borderBottom: '1px solid var(--divider)', alignItems: 'center' }}>
                       <div style={{ minWidth: 0 }}>
                         <div style={{ fontWeight: '800', color: 'var(--text-main)', fontSize: '1.05rem' }}>{item.dressName} <span style={{ background: 'var(--primary-light)', color: 'var(--primary-hover)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem', marginInlineStart: '0.5rem' }}>{item.sizeText}</span></div>
                         <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                            תיקונים: {[item.neckAlteration && 'צוואר', item.sleeveAlteration && 'שרוול', item.lengthAlteration && `אורך (${item.lengthAlteration})`].filter(Boolean).join(', ') || 'ללא'}
                            {repairsCost > 0 && <span style={{color: 'var(--warn)', marginInlineStart: '0.5rem'}} aria-label={`תוספת תיקונים ${repairsCost} שקלים`}>(+₪{repairsCost})</span>}
                         </div>
                       </div>
                       <div style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--ok)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                         ₪{displayPrice}
                       </div>
                     </div>
                   );
                })}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0.5rem 0', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: 'var(--text-main)' }}>סה"כ לתשלום:</span>
                <span style={{ fontSize: '1.7rem', fontWeight: '900', color: 'var(--ok)' }}>₪{totalAmount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStep(3)} className="btn-secondary" style={{ padding: '0.8rem 1.5rem', fontSize: '1.05rem', flex: '0 0 auto', minWidth: '150px' }}>
                <ArrowRight size={18} />
                <span>חזור לעריכה</span>
              </button>
              <button type="button" onClick={() => setStep(5)} className="primary-button" style={{ flex: 1, minWidth: '200px', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <span>המשך לתשלום אחרון</span>
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: PAYMENT & SAVE */}
        {step === 5 && (
          <div className="fade-in glass-card wizard-step" style={{ padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
            <div className="card-accent"></div>
            <h2 style={{ marginBottom: '0.4rem', fontSize: '1.4rem', fontWeight: 600 }}>תשלום וסיום הזמנה</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.2rem' }}>בחרו את אמצעי התשלום ובצעו רישום סופי.</p>

            {paymentsList.length > 0 && (
              <div className="soft-panel" style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ margin: '0 0 0.8rem 0', color: 'var(--text-main)', fontWeight: 600 }}>תשלומים שנוספו:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {paymentsList.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', padding: '0.5rem', background: 'var(--surface-raised)', borderRadius: '8px', border: '1px solid var(--element-border)' }}>
                      <span style={{ fontWeight: '700', color: 'var(--text-main)' }}>{p.method}</span>
                      <span style={{ fontWeight: '800', color: 'var(--ok)' }}>₪{p.amount} {p.notes ? `(${p.notes})` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); handleAddPaymentClick(); }}>
              <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1.5rem' }}>
                <div>
                  <label className="field-label" htmlFor="pay-amount">סכום לתשלום כעת (₪)</label>
                  <input
                    id="pay-amount"
                    type="number"
                    className="wizard-input"
                    value={payment.amount}
                    onChange={e => setPayment(prev => ({...prev, amount: e.target.value}))}
                    style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--ok)' }}
                  />
                </div>

                <div>
                  <label className="field-label" htmlFor="pay-method">אופן תשלום</label>
                  <select
                    id="pay-method"
                    className="wizard-input"
                    value={payment.method}
                    onChange={e => setPayment(prev => ({...prev, method: e.target.value}))}
                  >
                    {paymentMethodOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="field-label" htmlFor="pay-notes">הערות לתשלום</label>
                  <input
                    id="pay-notes"
                    type="text"
                    className="wizard-input"
                    value={payment.notes}
                    onChange={e => setPayment(prev => ({...prev, notes: e.target.value}))}
                    placeholder="מספר אישור, פרטי הבנק, וכדומה..."
                    style={{ fontSize: '1rem' }}
                  />
                </div>
              </div>

              <button type="submit" className="btn-soft" style={{ width: '100%', padding: '0.8rem', marginBottom: '1rem' }}>
                <Plus size={18} />
                <span>פצל / הוסף תשלום זה</span>
              </button>
            </form>

            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => setStep(4)} className="btn-secondary" style={{ padding: '0.8rem 1.5rem', fontSize: '1.05rem', flex: '0 0 auto', minWidth: '120px' }}>
                <ArrowRight size={18} />
                <span>חזור</span>
              </button>
              <button
                type="button"
                onClick={saveOrder}
                disabled={saving}
                aria-busy={saving}
                className="btn-success"
                style={{ flex: 1, minWidth: '220px', padding: '0.8rem', fontSize: '1.15rem' }}
              >
                {saving ? (
                  <>
                    <span className="spinner small" aria-hidden="true"></span>
                    <span>שומר...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>סיום ושמירת כרטיס הזמנה</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* MODALS */}
        {capacityModalItem && (
          <ItemCapacityModal 
            item={capacityModalItem} 
            order={order} 
            isOpen={true} 
            onClose={() => setCapacityModalItem(null)} 
          />
        )}

        {duplicateCustomer && (
          <div className="modal-shell-overlay">
            <div className="modal-shell fade-in" role="dialog" aria-modal="true" aria-labelledby="dup-title">
              <h3 id="dup-title" style={{ color: 'var(--danger)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.35rem', fontWeight: 600 }}>
                <span style={{ fontSize: '1.8rem' }}>⚠️</span> לקוח קיים במערכת
              </h3>
              <div className="modal-shell-panel">
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.25rem', color: 'var(--text-main)' }}>
                  {getCustomerFullName(duplicateCustomer)}
                </p>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '1.05rem' }}>📞 {duplicateCustomer.phone1} {duplicateCustomer.phone2 ? `| ${duplicateCustomer.phone2}` : ''}</p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.05rem' }}>📍 {duplicateCustomer.city || 'עיר לא צוינה'}</p>
              </div>
              <p style={{ marginBottom: '1.5rem', fontWeight: '600', fontSize: '1.05rem', color: 'var(--text-main)', lineHeight: '1.6' }}>הלקוח שהזנת זוהה במערכת על פי מספר הטלפון. האם תרצה להשתמש בלקוח הקיים עבור הזמנה זו?</p>
              <div className="modal-shell-footer">
                <button type="button" onClick={() => handleUseExistingCustomer(duplicateCustomer)} className="primary-button" style={{ padding: '0.9rem' }}>
                  כן, השתמש בלקוח הקיים
                </button>
                <button type="button" onClick={() => handleSaveNewCustomerAndProceed(true)} className="btn-danger-outline" style={{ padding: '0.9rem' }}>
                  לא, צור לקוח חדש כפול
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreditModal && (
          <div className="modal-shell-overlay" onClick={() => setShowCreditModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="modal-shell fade-in" role="dialog" aria-modal="true" aria-labelledby="credit-title">
              <div className="modal-shell-header">
                <h3 id="credit-title">חיוב באשראי (נדרים פלוס)</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }}
                    className="btn-soft"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.95rem', whiteSpace: 'nowrap' }}
                    title="העברת כרטיס מהירה בקורא מגנטי"
                    aria-label="העברת כרטיס מהירה בקורא מגנטי"
                  >
                    🧲 העברה מהירה
                  </button>
                  <button type="button" className="modal-shell-close" onClick={() => setShowCreditModal(false)} aria-label="סגור חלון">✕</button>
                </div>
              </div>

              {creditError && (
                <div style={{ background: 'var(--danger-soft)', color: 'var(--danger)', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem', fontWeight: '600', border: '1px solid var(--danger)' }}>
                  {creditError}
                </div>
              )}

              <form onSubmit={(e) => { e.preventDefault(); handleProcessCreditCard(); }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label className="field-label" htmlFor="cc-number">מספר כרטיס אשראי (או העברת קורא שפתיים)</label>
                    <input id="cc-number" type="text" className="wizard-input" inputMode="numeric" autoComplete="cc-number" value={creditCardData.cardNumber} onChange={handleCardNumberChange} placeholder="0000 0000 0000 0000" maxLength="19" style={{ fontSize: '1.2rem', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="field-label" htmlFor="cc-exp">תוקף (MM/YY)</label>
                      <input id="cc-exp" type="text" className="wizard-input" autoComplete="cc-exp" value={creditCardData.tokef} onChange={handleTokefChange} placeholder="12/25" maxLength="5" style={{ fontSize: '1.2rem', direction: 'ltr', textAlign: 'left', letterSpacing: '2px' }} />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="cc-amount">סכום לחיוב (₪)</label>
                      <input id="cc-amount" type="number" className="wizard-input" value={creditCardData.amount} onChange={e => setCreditCardData(prev => ({...prev, amount: e.target.value}))} style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--ok)', textAlign: 'center' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                    <div>
                      <label className="field-label" htmlFor="cc-installments">תשלומים</label>
                      <input id="cc-installments" type="number" className="wizard-input" value={creditCardData.installments} onChange={e => setCreditCardData(prev => ({...prev, installments: e.target.value}))} min="1" max="12" style={{ textAlign: 'center' }} />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="cc-notes">הערות לנדרים</label>
                      <input id="cc-notes" type="text" className="wizard-input" value={creditCardData.notes} onChange={e => setCreditCardData(prev => ({...prev, notes: e.target.value}))} />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isProcessingCredit}
                  aria-busy={isProcessingCredit}
                  className="primary-button"
                  style={{ width: '100%', padding: '1.1rem', fontSize: '1.2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem' }}
                >
                  {isProcessingCredit ? (
                    <>
                      <span className="spinner small" aria-hidden="true"></span>
                      <span>מבצע חיוב מול נדרים...</span>
                    </>
                  ) : 'בצע חיוב עכשיו ושמור הזמנה'}
                </button>
              </form>
            </div>
          </div>
        )}

        {showQuickSwipeModal && (
          <div className="modal-shell-overlay" onClick={() => setShowQuickSwipeModal(false)}>
            <div onClick={(e) => e.stopPropagation()} className="modal-shell fade-in" role="dialog" aria-modal="true" aria-labelledby="swipe-title" style={{ maxWidth: '450px', textAlign: 'center' }}>
              <button type="button" className="modal-shell-close" onClick={() => setShowQuickSwipeModal(false)} aria-label="סגור חלון" style={{ position: 'absolute', top: '10px', insetInlineEnd: '10px' }}>&times;</button>

              <div style={{ margin: '0.5rem auto 1.5rem', width: '90px', height: '90px', background: 'var(--primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(212,175,55,0.25)' }}>
                <span style={{ fontSize: '3.5rem' }}>🧲</span>
              </div>

              <h2 id="swipe-title" style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)', fontSize: '1.6rem', fontWeight: 600 }}>
                העברת כרטיס מהירה
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
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
                  type="button"
                  onClick={() => setShowQuickSwipeModal(false)}
                  className="btn-secondary"
                  style={{ padding: '0.8rem 2rem', fontSize: '1.05rem' }}
                >
                  ביטול חלון מהיר
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Blocking overlay while the order is being written / charged, so nobody
            clicks twice or navigates away mid-save. */}
        {(saving || isProcessingCredit) && (
          <div className="blocking-overlay" role="alertdialog" aria-live="assertive" aria-busy="true" aria-label="פעולה מתבצעת">
            <div className="blocking-overlay__card">
              <div className="spinner" aria-hidden="true"></div>
              <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                {isProcessingCredit ? 'מבצע חיוב מול נדרים פלוס...' : 'שומר את ההזמנה במערכת...'}
              </div>
              <div style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
                {isProcessingCredit ? 'אין לסגור את החלון עד לקבלת אישור מחברת האשראי.' : 'מאמת זמינות מלאי ורושם את הכרטיס. נא לא לסגור את החלון.'}
              </div>
            </div>
          </div>
        )}

      </main>
    </>
  );
}
