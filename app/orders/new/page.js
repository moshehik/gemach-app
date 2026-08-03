'use client';

import React, { useState, useEffect } from 'react';
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
      const datesFilled = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
      return !!order.customerId && !!datesFilled;
    }
    if (targetStep === 4) {
      const datesFilled = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
      return !!order.customerId && !!datesFilled && order.items.length > 0;
    }
    if (targetStep === 5) {
      const datesFilled = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
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
      const fullAddress = cust.city || '';
      
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
          notes: [creditCardData.notes, 'באמצעות תכנת הגמח; מס הזמנה: חדשה'].filter(Boolean).join(' - '),
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
      if (res.ok) {
         const saved = await res.json();
         setOrder(prev => ({ ...prev, customerId: saved.id, selectedCustomer: saved }));
         setStep(2);
         setDuplicateCustomer(null);
      } else {
         alert('שגיאה בשמירת לקוח');
      }
    } catch (e) {
      alert('שגיאה בשמירת לקוח');
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
          order.items
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
  }, [order.eventDate, order.fromDate, order.toDate, order.isAbroad, newItem.dressModelId, inventoryCache, order.items]);

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
            customSpacing: proposedOrder.customSpacing
          })
        });
        
        const validateData = await validateRes.json();
        if (validateData.error) {
          alert(`שגיאה בבדיקת מלאי: ${validateData.error}`);
          return;
        }
        if (!validateData.valid) {
          const errorLines = validateData.errors.map(e => 
            `- ${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`
          ).join('\n');
          alert(`לא ניתן לשנות את התאריך עקב חוסר במלאי לפריטים הקיימים בהזמנה:\n\n${errorLines}`);
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

  const saveOrder = async () => {
    if (!order.customerId) return alert('יש לבחור לקוח');
    if (!order.eventDate) return alert('יש לבחור תאריך אירוע');
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
    
    try {
      const validateRes = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: order.items,
          eventDate: order.eventDate,
          isAbroad: order.isAbroad,
          isWeekdayEvent: order.isWeekdayEvent,
          fromDate: order.fromDate,
          toDate: order.toDate,
          customSpacing: order.customSpacing
        })
      });
      
      const validateData = await validateRes.json();
      if (validateData.error) {
        setSaving(false);
        alert(`שגיאה: ${validateData.error}`);
        return;
      }
      if (!validateData.valid) {
        setSaving(false);
        const errorLines = validateData.errors.map(e => 
          `- ${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`
        ).join('\n');
        alert(`לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים:\n\n${errorLines}`);
        return;
      }
    } catch (err) {
      console.error('Validation fetch error', err);
      setSaving(false);
      alert('שגיאה בבדיקת המלאי מול השרת.');
      return;
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
        ...order,
        totalAmount,
        items: itemsToSave,
        paymentsList: finalPaymentsList
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error('Failed to save order');
      const data = await res.json();
      router.push(`/orders/${data.orderId}`);
    } catch (error) {
      console.error(error);
      alert('שגיאה בשמירת הזמנה');
      setSaving(false);
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

        h1, h2, h3, h4 {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          color: var(--text-main);
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

        .stepper-container {
          background: var(--card-bg);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 1.2rem 2rem 2.5rem 2rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
          max-width: 800px;
          margin: 0 auto 1.5rem auto;
        }
        
        .step-progress-line {
          position: absolute;
          top: 50%;
          left: 2rem;
          right: 2rem;
          height: 4px;
          background: var(--divider);
          transform: translateY(-50%);
          z-index: 1;
          border-radius: 10px;
          overflow: hidden;
        }

        .step-progress-fill {
          height: 100%;
          background: var(--primary-color);
          transition: width 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 0 6px var(--primary-color);
        }

        .step-node {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--card-bg);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          color: var(--text-muted);
          z-index: 2;
          position: relative;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: var(--shadow-sm);
          font-size: 0.95rem;
        }

        .step-node.completed {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: var(--btn-primary-text);
        }

        .step-node.active {
          background: var(--primary-color);
          border-color: var(--primary-hover);
          color: var(--btn-primary-text);
          box-shadow: 0 0 0 4px rgba(212, 175, 55, 0.2), var(--shadow-sm);
          transform: scale(1.06);
        }

        .step-label {
          position: absolute;
          top: 45px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.9rem;
          font-weight: 700;
          color: var(--text-muted);
          white-space: nowrap;
          transition: all 0.3s ease;
        }
        .step-node.active .step-label {
          color: var(--text-main);
          font-weight: 800;
        }
        .step-node.completed .step-label {
          color: var(--text-main);
        }

        .toggle-switch {
          appearance: none;
          width: 48px;
          height: 26px;
          background: var(--element-bg);
          border-radius: 26px;
          position: relative;
          cursor: pointer;
          transition: background 0.3s ease;
          outline: none;
          border: 1px solid var(--element-border);
        }
        .toggle-switch:checked {
          background: var(--primary-color);
          border-color: var(--primary-hover);
        }
        .toggle-switch::after {
          content: '';
          position: absolute;
          top: 2px;
          right: 2px;
          width: 20px;
          height: 20px;
          background: white;
          border-radius: 50%;
          box-shadow: 0 3px 6px rgba(0,0,0,0.15);
          transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .toggle-switch:checked::after {
          transform: translateX(-22px);
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
          border-radius: 16px;
          padding: 1.25rem;
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

        .premium-input {
          width: 100%;
          padding: 0.8rem 1rem;
          border-radius: 10px;
          border: 1px solid var(--border-color);
          font-size: 1rem;
          outline: none;
          transition: all 0.25s ease;
          background: var(--input-bg);
          color: var(--text-main);
          font-family: inherit;
        }
        .premium-input:focus {
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
        }
        .premium-input::placeholder {
          color: var(--text-muted);
        }

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
        <div className="stepper-container">
          <div className="step-progress-line">
            <div className="step-progress-fill" style={{ width: `${((step - 1) / 4) * 100}%` }}></div>
          </div>
          {[1, 2, 3, 4, 5].map((s) => {
            const isClickable = canNavigateToStep(s);
            return (
              <div 
                key={s} 
                className={`step-node ${step === s ? 'active' : step > s ? 'completed' : ''}`}
                onClick={() => {
                  if (isClickable) {
                    setStep(s);
                  } else {
                    if (s === 2 && !order.customerId) alert('יש לבחור לקוח תחילה');
                    else if (s === 3 && !(order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate)) alert('יש למלא תאריכים תחילה');
                    else if ((s === 4 || s === 5) && order.items.length === 0) alert('יש להוסיף לפחות פריט אחד להזמנה');
                  }
                }}
                style={{ cursor: isClickable ? 'pointer' : 'not-allowed' }}
              >
                {step > s ? '✓' : s}
                <span className="step-label">
                  {s === 1 && 'לקוח'}
                  {s === 2 && 'תאריכים'}
                  {s === 3 && 'פריטים'}
                  {s === 4 && 'סיכום'}
                  {s === 5 && 'תשלום'}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* STEP 1: CUSTOMER */}
        {step === 1 && (
          <div className="fade-in glass-card" style={{ maxWidth: '650px', margin: '0.5rem auto', padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '4px', background: 'var(--primary-color)' }}></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
               <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '800', letterSpacing: '-0.5px' }}>מי הלקוח?</h2>
            </div>

            {searchMode === 'phone' && !foundCustomerFromPhone && (
              <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '700', fontSize: '1.1rem', color: '#334155' }}>מספר הטלפון של הלקוח</label>
                  <input type="tel" 
                    value={phoneSearchInput} 
                    onChange={e => setPhoneSearchInput(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleCheckPhone()}
                    placeholder="הזן מספר טלפון (05...)"
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '10px', border: '2px solid #cbd5e1', fontSize: '1.2rem', textAlign: 'center', transition: 'all 0.3s', outline: 'none' }} 
                    onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                    onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                  />
                </div>
                
                <button onClick={handleCheckPhone} disabled={isCheckingPhone} className="primary-button" style={{ width: '100%', padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  {isCheckingPhone ? 'מחפש...' : (
                    <>
                      <span>המשך</span>
                      <ArrowLeft size={18} />
                    </>
                  )}
                </button>

                <div style={{ marginTop: '0.5rem', width: '100%', textAlign: 'center' }}>
                  <button onClick={() => setSearchMode('name')}
                    style={{ background: 'transparent', border: '2px solid #e2e8f0', padding: '0.7rem', width: '100%', borderRadius: '10px', fontSize: '1rem', fontWeight: '600', color: '#475569', cursor: 'pointer', transition: 'all 0.3s' }}
                    onMouseOver={(e) => {e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#cbd5e1';}}
                    onMouseOut={(e) => {e.target.style.background = 'transparent'; e.target.style.borderColor = '#e2e8f0';}}
                  >
                    או חפש לקוח קיים מהרשימה
                  </button>
                </div>
              </div>
            )}

            {searchMode === 'phone' && foundCustomerFromPhone && (
              <div className="fade-in" style={{ textAlign: 'center', background: 'linear-gradient(135deg, rgba(239, 246, 255, 0.8) 0%, rgba(255, 255, 255, 0.9) 100%)', padding: '1.5rem 1rem', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                <div style={{ width: '50px', height: '50px', background: 'linear-gradient(135deg, #2563eb, #4f46e5)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', margin: '0 auto 1rem auto', boxShadow: '0 5px 10px rgba(37, 99, 235, 0.2)' }}>
                  👋
                </div>
                <h3 style={{ fontSize: '1.4rem', color: '#1e293b', marginBottom: '0.3rem', fontWeight: '800' }}>שלום {getCustomerFullName(foundCustomerFromPhone)}!</h3>
                <p style={{ fontSize: '1rem', color: '#64748b', marginBottom: '1.2rem' }}>מצאנו אותך במערכת (טלפון: {foundCustomerFromPhone.phone1}). האם זה אתה?</p>
                
                <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column' }}>
                  <button onClick={() => handleUseExistingCustomer(foundCustomerFromPhone)} className="primary-button" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                    <Check size={18} />
                    <span>כן, המשך להזמנה</span>
                  </button>
                  <button onClick={() => {
                      setNewCustomer(prev => ({ ...prev, phone1: phoneSearchInput.trim() }));
                      setFoundCustomerFromPhone(null);
                      setSearchMode('new');
                    }}
                    style={{ padding: '0.75rem', background: 'white', color: '#64748b', border: '2px solid #cbd5e1', borderRadius: '10px', fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <span>לא, יצירת לקוח חדש</span>
                  </button>
                </div>
              </div>
            )}

            {searchMode === 'name' && (
              <div className="fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <label style={{ fontWeight: '700', fontSize: '1.05rem', color: '#334155' }}>חיפוש ובחירת לקוח מהרשימה</label>
                  <button onClick={() => setSearchMode('phone')} style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>חזור להזנת טלפון</button>
                </div>
                <CustomerSelector 
                  value={order.selectedCustomer}
                  onChange={(c) => setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }))}
                  placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                />
                
                <button onClick={proceedToStep2} disabled={!order.customerId} className="primary-button" style={{ width: '100%', marginTop: '1.5rem', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <span>המשך לשלב הבא</span>
                  <ArrowLeft size={18} />
                </button>
              </div>
            )}

            {searchMode === 'new' && (
              <div className="fade-in">
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '2px solid #f1f5f9' }}>
                  <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.3rem', fontWeight: '800' }}>יצירת לקוח חדש</h3>
                  <button onClick={() => { setFoundCustomerFromPhone(null); setSearchMode('phone'); }} style={{ background: 'none', border: 'none', color: '#2563eb', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.95rem', fontWeight: '600' }}>חזור</button>
                 </div>

                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>שם פרטי *</label>
                    <input type="text" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({...prev, firstName: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>שם משפחה *</label>
                    <input type="text" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({...prev, lastName: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>טלפון נייד *</label>
                    <input type="text" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({...prev, phone1: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>אימייל</label>
                    <input type="email" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({...prev, email: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.8rem', marginBottom: '0.8rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>עיר מגורים</label>
                    <input type="text" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({...prev, city: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>רחוב</label>
                    <input type="text" value={newCustomer.street || ''} onChange={e => setNewCustomer(prev => ({...prev, street: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>בית</label>
                    <input type="text" value={newCustomer.houseNum || ''} onChange={e => setNewCustomer(prev => ({...prev, houseNum: e.target.value}))} style={{ width: '100%', padding: '0.6rem', borderRadius: '8px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} />
                  </div>
                </div>
                
                <button onClick={() => handleSaveNewCustomerAndProceed()} className="primary-button" style={{ width: '100%', marginTop: '1.2rem', padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                  <UserPlus size={18} />
                  <span>שמור לקוח והמשך</span>
                  <ArrowLeft size={18} />
                </button>
              </div>
            )}
            
            <div style={{ marginTop: '1.2rem', textAlign: 'center' }}>
               <Link href="/orders" style={{ color: '#64748b', textDecoration: 'none', fontSize: '1rem', fontWeight: '600' }}>ביטול וחזרה לרשימת ההזמנות</Link>
            </div>
          </div>
        )}

        {/* STEP 2: DATES */}
        {step === 2 && (
          <div className="fade-in glass-card" style={{ maxWidth: '750px', margin: '0.5rem auto', padding: '1.2rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '4px', background: 'var(--primary-color)' }}></div>
            <h2 style={{ marginBottom: '0.8rem', fontSize: '1.4rem', fontWeight: '800' }}>תאריכי ההזמנה</h2>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div className={`radio-card ${!order.isAbroad ? 'active' : ''}`} onClick={() => handleDateChangeWithValidation('isAbroad', false)} style={{ padding: '0.6rem 1rem' }}>
                <input type="radio" checked={!order.isAbroad} readOnly style={{ accentColor: '#2563eb', transform: 'scale(1.1)' }} />
                <div>
                  <h3 style={{ margin: '0 0 0.1rem 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: '800' }}>אירוע רגיל</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>תאריך אירוע אחד</p>
                </div>
              </div>
              <div className={`radio-card ${order.isAbroad ? 'active' : ''}`} onClick={() => handleDateChangeWithValidation('isAbroad', true)} style={{ padding: '0.6rem 1rem' }}>
                <input type="radio" checked={order.isAbroad} readOnly style={{ accentColor: '#2563eb', transform: 'scale(1.1)' }} />
                <div>
                  <h3 style={{ margin: '0 0 0.1rem 0', color: '#1e293b', fontSize: '1.1rem', fontWeight: '800' }}>אירוע חו"ל / תפוסה ארוכה</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>הזנת טווח תאריכים</p>
                </div>
              </div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.5)', padding: '1rem 1.5rem', borderRadius: '16px', border: '1px dashed #cbd5e1', marginBottom: '1rem' }}>
              {!order.isAbroad ? (
                <div style={{ textAlign: 'center' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '800', color: '#1e293b', fontSize: '1.1rem' }}>תאריך אירוע *</label>
                  <div style={{ maxWidth: '300px', margin: '0 auto' }}>
                    <HebrewDatePicker value={order.eventDate} onChange={(date) => handleDateChangeWithValidation('eventDate', date)} />
                  </div>
                </div>
              ) : (
                <div style={{ width: '100%', maxWidth: '500px', margin: '0 auto' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '800', color: '#1e293b', fontSize: '1.05rem', textAlign: 'center' }}>טווח תאריכים (מתאריך עד תאריך) *</label>
                  <HebrewDateRangePicker 
                    startDate={order.fromDate} 
                    endDate={order.toDate} 
                    onChange={(start, end) => handleDateChangeWithValidation({ fromDate: start, toDate: end })} 
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: '700', color: '#334155', fontSize: '1.05rem' }}>הערות כלליות להזמנה</label>
              <textarea 
                name="notes" 
                value={order.notes} 
                onChange={handleOrderChange}
                placeholder="הערות מיוחדות, בקשות שקשורות לתאריכים..."
                style={{ width: '100%', padding: '0.8rem', borderRadius: '10px', border: '2px solid #e2e8f0', minHeight: '65px', height: '65px', fontSize: '1rem', fontFamily: 'inherit', resize: 'none', outline: 'none' }}
                onFocus={(e)=>e.target.style.borderColor='#2563eb'}
                onBlur={(e)=>e.target.style.borderColor='#e2e8f0'}
              />
            </div>

            <div style={{ marginTop: '0.5rem', background: '#fffbeb', border: '1px solid #fde68a', padding: '0.8rem 1.2rem', borderRadius: '12px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ fontWeight: '800', color: '#92400e', fontSize: '1.1rem', margin: 0 }}>ציפוף ימים מיוחד:</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={order.customSpacing !== null && order.customSpacing !== undefined ? order.customSpacing : ''}
                    onChange={async (e) => {
                      const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                      
                      if (val !== null && val !== '') {
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
                    style={{ padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #fcd34d', fontSize: '1rem', outline: 'none', backgroundColor: 'white', fontWeight: 'bold', width: '200px' }}
                  >
                    <option value="">רגיל (לפי המערכת)</option>
                    <option value="1">1 יום רווח</option>
                    <option value="2">2 ימי רווח</option>
                    <option value="3">3 ימי רווח</option>
                    <option value="4">4 ימי רווח</option>
                    <option value="0">ללא רווח כלל (0)</option>
                  </select>
                </div>
              </div>
              <p style={{ fontSize: '0.85rem', color: '#b45309', margin: '0.4rem 0 0 0', fontWeight: '500' }}>* בחירת ציפוף מיוחד תשפיע על בדיקת המלאי להזמנה זו בלבד ותצבע את כרטיס ההזמנה בצהוב (דורש הרשאת מנהל).</p>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => setStep(1)} style={{ padding: '0.8rem 1.5rem', background: 'white', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRight size={18} />
                <span>חזור</span>
              </button>
              <button 
                onClick={() => setStep(3)} 
                disabled={order.isAbroad ? (!order.fromDate || !order.toDate) : !order.eventDate} 
                className="primary-button" 
                style={{ flex: 1, padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                <span>המשך לבחירת פריטים</span>
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: ADD ITEMS (Side by Side) */}
        {step === 3 && (
          <div className="fade-in" style={{ display: 'flex', gap: '1rem', flexWrap: 'nowrap', alignItems: 'stretch', maxWidth: '950px', margin: '0.5rem auto' }}>
            
            {/* Add Item Form (Right Side) */}
            <div className="glass-card" style={{ flex: '1.2', maxWidth: '520px', minWidth: '320px', padding: '1.2rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '4px', background: 'var(--primary-color)' }}></div>
              <h2 style={{ margin: '0 0 0.8rem 0', fontSize: '1.3rem', fontWeight: '800' }}>הוספת פריט חדש</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#334155', fontSize: '0.95rem' }}>בחר דגם</label>
                  <OrderModelSelector 
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
                    <label style={{ fontWeight: '700', color: '#334155', fontSize: '0.95rem' }}>בחר מידה {loadingSizes && <span style={{color: '#2563eb', fontWeight:'normal'}}>(בודק זמינות...)</span>}</label>
                    <button 
                      onClick={refreshInventory}
                      disabled={loadingPreload || loadingSizes}
                      title="רענן זמינות מלאי"
                      style={{
                        background: 'none', border: 'none', cursor: (loadingPreload || loadingSizes) ? 'not-allowed' : 'pointer',
                        color: (loadingPreload || loadingSizes) ? '#94a3b8' : '#3b82f6',
                        display: 'flex', alignItems: 'center', padding: '0.2rem'
                      }}
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', minHeight: '44px', alignItems: 'center' }}>
                    {availableSizes.length === 0 ? (
                      <div style={{ padding: '0.5rem 0.8rem', background: '#f8fafc', color: '#94a3b8', borderRadius: '8px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.9rem' }}>
                        {newItem.dressModelId ? 'אין מידות זמינות לתאריך זה.' : 'בחר דגם כדי לראות מידות זמינות.'}
                      </div>
                    ) : (
                      availableSizes.map(s => {
                        const isAvailable = s.availableQuantity > 0;
                        const isSelected = newItem.sizeText === s.sizeText;
                        return (
                          <div key={s.sizeText} 
                            onClick={() => {
                              if (isAvailable) {
                                handleNewItemChange({ target: { name: 'sizeText', value: s.sizeText } });
                              }
                            }}
                            className={`size-card-interactive ${isSelected ? 'selected' : ''} ${!isAvailable ? 'disabled' : ''}`}
                          >
                            <span style={{ fontSize: '1.1rem', fontWeight: '800', color: isSelected ? '#3b82f6' : (isAvailable ? '#1e293b' : '#ef4444'), lineHeight: '1.2' }}>{s.sizeText}</span>
                            <span style={{ fontSize: '0.72rem', fontWeight: '700', color: isSelected ? '#2563eb' : (isAvailable ? '#10b981' : '#ef4444'), marginTop: '0.1rem' }}>
                              {isAvailable ? `${s.availableQuantity} פנויות` : 'אזל'}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ margin: '0 0 0.8rem 0', fontSize: '1.05rem', color: '#1e293b', fontWeight: '800' }}>תיקונים נדרשים</h4>
                  <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div 
                      onClick={() => handleNewItemChange({ target: { name: 'neckAlteration', value: !newItem.neckAlteration }})}
                      style={{ 
                        padding: '0.4rem 1.2rem', borderRadius: '8px', cursor: 'pointer', 
                        background: newItem.neckAlteration ? '#3b82f6' : '#fff', 
                        color: newItem.neckAlteration ? '#fff' : '#475569',
                        border: newItem.neckAlteration ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                        fontWeight: '700', fontSize: '0.95rem', transition: 'all 0.2s',
                        boxShadow: newItem.neckAlteration ? '0 2px 4px rgba(59,130,246,0.3)' : 'none'
                      }}
                    >
                      צוואר
                    </div>
                    <div 
                      onClick={() => handleNewItemChange({ target: { name: 'sleeveAlteration', value: !newItem.sleeveAlteration }})}
                      style={{ 
                        padding: '0.4rem 1.2rem', borderRadius: '8px', cursor: 'pointer', 
                        background: newItem.sleeveAlteration ? '#3b82f6' : '#fff', 
                        color: newItem.sleeveAlteration ? '#fff' : '#475569',
                        border: newItem.sleeveAlteration ? '1px solid #3b82f6' : '1px solid #cbd5e1',
                        fontWeight: '700', fontSize: '0.95rem', transition: 'all 0.2s',
                        boxShadow: newItem.sleeveAlteration ? '0 2px 4px rgba(59,130,246,0.3)' : 'none'
                      }}
                    >
                      שרוול
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginRight: '0.5rem' }}>
                      <label style={{ fontWeight: '700', color: '#475569', fontSize: '0.95rem' }}>אורך:</label>
                      <input type="number" className="premium-input" value={newItem.lengthAlteration || ''} onChange={handleNewItemChange} name="lengthAlteration" placeholder="ס״מ" style={{ width: '70px', padding: '0.4rem', textAlign: 'center', fontSize: '0.95rem', background: '#fff' }} />
                    </div>
                  </div>
                  
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#64748b', fontSize: '0.9rem' }}>
                      הערות לתיקון {(newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration) && <span style={{color: '#ef4444'}}>* (חובה)</span>}
                    </label>
                    <input 
                      type="text" 
                      className="premium-input" 
                      name="repairs" 
                      value={newItem.repairs || ''} 
                      onChange={handleNewItemChange} 
                      placeholder="פרטים נוספים לתופרת..." 
                      style={{ 
                        padding: '0.6rem 0.8rem', 
                        fontSize: '0.95rem', 
                        background: '#fff',
                        border: ((newItem.neckAlteration || newItem.sleeveAlteration || newItem.lengthAlteration) && (!newItem.repairs || !newItem.repairs.trim())) ? '1px solid #ef4444' : '1px solid #e2e8f0'
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
            <div className="glass-card" style={{ flex: '1', minWidth: '300px', padding: '1.2rem', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: '800', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.4rem' }}>הסל שלך</h3>
              
              {order.items.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#94a3b8', padding: '1.5rem 1rem', background: '#f8fafc', borderRadius: '12px', border: '2px dashed #e2e8f0', fontWeight: '600', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  טרם הוספת פריטים להזמנה
                </div>
              ) : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ overflowY: 'auto', maxHeight: '190px', paddingRight: '0.2rem', margin: '0.2rem 0' }}>
                    {order.items.map((item, idx) => (
                      <div key={idx} className="cart-item-card" style={{ animationDelay: `${idx * 0.1}00ms` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.15rem' }}>
                          <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#1e293b' }}>{item.dressName || 'דגם לא ידוע'}</div>
                          <div style={{ background: '#eff6ff', color: '#2563eb', padding: '0.05rem 0.4rem', borderRadius: '4px', fontWeight: '700', fontSize: '0.78rem' }}>מידה {item.sizeText}</div>
                        </div>
                        <div style={{ color: '#64748b', fontSize: '0.78rem', marginBottom: '0.25rem' }}>
                          {[item.neckAlteration && 'צוואר', item.sleeveAlteration && 'שרוול', item.lengthAlteration && `אורך (${item.lengthAlteration})`].filter(Boolean).join(', ') || 'ללא תיקונים'}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '0.35rem' }}>
                          <div style={{ fontWeight: '800', color: '#059669', fontSize: '0.95rem' }}>
                            ₪{calculatedData.items[idx] ? calculatedData.items[idx].calculatedPrice : item.finalPrice}
                          </div>
                          <div style={{ display: 'flex', gap: '0.3rem' }}>
                            <button onClick={(e) => { e.preventDefault(); setCapacityModalItem(item); }} style={{ background: '#fdf4ff', border: '1px solid #fbcfe8', cursor: 'pointer', color: '#c026d3', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px', transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fae8ff'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fdf4ff'; }} title="בדוק תפוסה לתאריך אירוע">
                              <CalendarSearch size={14} strokeWidth={2.5} />
                            </button>
                            <button onClick={() => editItem(idx)} style={{ background: '#fffbeb', border: '1px solid #fde68a', cursor: 'pointer', color: '#d97706', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px', transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fef3c7'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fffbeb'; }} title="ערוך">
                              <Edit2 size={14} strokeWidth={2.5} />
                            </button>
                            <button onClick={() => removeItem(idx)} style={{ background: '#fef2f2', border: '1px solid #fecaca', cursor: 'pointer', color: '#ef4444', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0.25rem', borderRadius: '4px', transition: 'all 0.2s ease' }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#fee2e2'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fef2f2'; }} title="מחק">
                              <Trash2 size={14} strokeWidth={2.5} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <div style={{ marginTop: '0.5rem', borderTop: '1px dashed var(--border-color)', paddingTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: '#1e293b' }}>סה"כ:</span>
                    <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#059669' }}>₪{totalAmount}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.8rem' }}>
                <button onClick={() => setStep(2)} style={{ padding: '0.6rem', background: 'white', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '0.95rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                  <ArrowRight size={16} />
                  <span>חזור</span>
                </button>
                <button onClick={() => setStep(4)} disabled={order.items.length === 0} className="primary-button" style={{ padding: '0.6rem', flex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontSize: '0.95rem' }}>
                  <span>המשך לסיכום</span>
                  <ArrowLeft size={16} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: SUMMARY */}
        {step === 4 && (
          <div className="fade-in glass-card" style={{ maxWidth: '700px', margin: '0.5rem auto', padding: '1.2rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '4px', background: 'var(--primary-color)' }}></div>
            <h2 style={{ marginBottom: '0.4rem', fontSize: '1.4rem', fontWeight: '800' }}>סיכום ההזמנה</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1rem' }}>אנא ודא שפרטי ההזמנה נכונים לפני מעבר לתשלום.</p>

            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>לקוח:</span>
                <span style={{ color: '#1e293b', fontWeight: '800' }}>{selectedCustomerName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>סוג אירוע:</span>
                <span style={{ color: '#1e293b', fontWeight: '800' }}>{order.isAbroad ? 'אירוע חו"ל / תפוסה ארוכה' : 'אירוע רגיל'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem' }}>
                <span style={{ color: '#64748b', fontWeight: '600' }}>תאריכים:</span>
                <span style={{ color: '#1e293b', fontWeight: '800', textAlign: 'left' }}>
                  {order.isAbroad ? (
                    <>
                      {`מ-${getHebrewDateString(order.fromDate)} עד ${getHebrewDateString(order.toDate)} `}
                      <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'normal' }}>
                        {`(${order.fromDate} - ${order.toDate})`}
                      </span>
                    </>
                  ) : (
                    <>
                      {getHebrewDateString(order.eventDate) + ' '}
                      <span style={{ color: '#64748b', fontSize: '0.85rem', fontWeight: 'normal' }}>
                        {`(${order.eventDate})`}
                      </span>
                    </>
                  )}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '1.2rem' }}>
              <h3 style={{ color: '#1e293b', fontSize: '1.2rem', marginBottom: '0.8rem', fontWeight: '800' }}>פירוט פריטים ({order.items.length})</h3>
              
              <div style={{ overflowY: 'auto', maxHeight: '150px', paddingRight: '0.2rem', borderBottom: '1px solid #cbd5e1' }}>
                {order.items.map((item, idx) => {
                   const calcItem = calculatedData.items[idx];
                   const displayPrice = calcItem ? calcItem.calculatedPrice : item.finalPrice;
                   const repairsCost = calcItem && calcItem.repairsCost ? calcItem.repairsCost : 0;
                   return (
                     <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0.5rem', borderBottom: '1px solid #e2e8f0', alignItems: 'center' }}>
                       <div>
                         <div style={{ fontWeight: '800', color: '#1e293b', fontSize: '1.05rem' }}>{item.dressName} <span style={{ background: '#eff6ff', color: '#2563eb', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem', marginRight: '0.5rem' }}>{item.sizeText}</span></div>
                         <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.2rem' }}>
                            תיקונים: {[item.neckAlteration && 'צוואר', item.sleeveAlteration && 'שרוול', item.lengthAlteration && `אורך (${item.lengthAlteration})`].filter(Boolean).join(', ') || 'ללא'}
                            {repairsCost > 0 && <span style={{color: '#f59e0b', marginRight: '0.5rem'}}>(+₪{repairsCost})</span>}
                         </div>
                       </div>
                       <div style={{ fontSize: '1.15rem', fontWeight: '800', color: '#059669' }}>
                         ₪{displayPrice}
                       </div>
                     </div>
                   );
                })}
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0.5rem 0', marginTop: '0.5rem' }}>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#1e293b' }}>סה"כ לתשלום:</span>
                <span style={{ fontSize: '1.7rem', fontWeight: '900', color: '#059669' }}>₪{totalAmount}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => setStep(3)} style={{ padding: '0.8rem 1.5rem', background: 'white', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRight size={18} />
                <span>חזור לעריכה</span>
              </button>
              <button onClick={() => setStep(5)} className="primary-button" style={{ flex: 1, padding: '0.8rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                <span>המשך לתשלום אחרון</span>
                <ArrowLeft size={18} />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: PAYMENT & SAVE */}
        {step === 5 && (
          <div className="fade-in glass-card" style={{ maxWidth: '600px', margin: '0.5rem auto', padding: '1.2rem', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '100%', height: '4px', background: 'var(--primary-color)' }}></div>
            <h2 style={{ marginBottom: '0.4rem', fontSize: '1.4rem', fontWeight: '800' }}>תשלום וסיום הזמנה</h2>
            <p style={{ color: '#64748b', fontSize: '1rem', marginBottom: '1.2rem' }}>בחרו את אמצעי התשלום ובצעו רישום סופי.</p>
            
            {paymentsList.length > 0 && (
              <div style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <h4 style={{ margin: '0 0 0.8rem 0', color: '#334155', fontWeight: '800' }}>תשלומים שנוספו:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {paymentsList.map((p, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: 'white', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <span style={{ fontWeight: '700', color: '#1e293b' }}>{p.method}</span>
                      <span style={{ fontWeight: '800', color: '#059669' }}>₪{p.amount} {p.notes ? `(${p.notes})` : ''}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div style={{ display: 'grid', gap: '0.8rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#334155', fontSize: '0.95rem' }}>סכום לתשלום כעת (₪)</label>
                <input 
                  type="number" 
                  value={payment.amount} 
                  onChange={e => setPayment(prev => ({...prev, amount: e.target.value}))} 
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1.25rem', fontWeight: '800', color: '#059669', outline: 'none' }} 
                  onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#334155', fontSize: '0.95rem' }}>אופן תשלום</label>
                <select 
                  value={payment.method} 
                  onChange={e => setPayment(prev => ({...prev, method: e.target.value}))} 
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1.05rem', outline: 'none', background: 'white' }}
                  onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'}
                >
                  {paymentMethodOptions.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.3rem', fontWeight: '700', color: '#334155', fontSize: '0.95rem' }}>הערות לתשלום</label>
                <input 
                  type="text" 
                  value={payment.notes} 
                  onChange={e => setPayment(prev => ({...prev, notes: e.target.value}))} 
                  placeholder="מספר אישור, פרטי הבנק, וכדומה..."
                  style={{ width: '100%', padding: '0.75rem 1rem', borderRadius: '10px', border: '2px solid #e2e8f0', fontSize: '1rem', outline: 'none' }} 
                  onFocus={(e)=>e.target.style.borderColor='#2563eb'} onBlur={(e)=>e.target.style.borderColor='#e2e8f0'}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem', marginBottom: '1rem' }}>
              <button onClick={handleAddPaymentClick} style={{ flex: 1, padding: '0.8rem', background: '#e0e7ff', color: '#3730a3', border: 'none', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor='#c7d2fe'} onMouseOut={e => e.currentTarget.style.backgroundColor='#e0e7ff'}>
                <Plus size={18} />
                <span>פצל / הוסף תשלום זה</span>
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button onClick={() => setStep(4)} style={{ padding: '0.8rem 1.5rem', background: 'white', color: '#64748b', border: '2px solid #e2e8f0', borderRadius: '12px', fontSize: '1.05rem', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ArrowRight size={18} />
                <span>חזור</span>
              </button>
              <button 
                onClick={saveOrder}
                disabled={saving}
                style={{ flex: 1, padding: '0.8rem', background: saving ? '#cbd5e1' : 'linear-gradient(135deg, #10b981, #059669)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.15rem', fontWeight: '800', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 6px 15px rgba(16, 185, 129, 0.2)', transition: 'all 0.3s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                {saving ? 'שומר במערכת ומאמת מלאי...' : (
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
          <div style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="fade-in" style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', maxWidth: '500px', width: '100%', direction: 'rtl', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <h3 style={{ color: '#dc2626', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.8rem', fontSize: '1.6rem', fontWeight: '800' }}>
                <span style={{ fontSize: '2rem' }}>⚠️</span> לקוח קיים במערכת
              </h3>
              <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '16px', marginBottom: '2rem', border: '1px solid #e2e8f0' }}>
                <p style={{ margin: '0 0 0.5rem 0', fontWeight: '800', fontSize: '1.4rem', color: '#1e293b' }}>
                  {getCustomerFullName(duplicateCustomer)}
                </p>
                <p style={{ margin: '0 0 0.5rem 0', color: '#64748b', fontSize: '1.1rem' }}>📞 {duplicateCustomer.phone1} {duplicateCustomer.phone2 ? `| ${duplicateCustomer.phone2}` : ''}</p>
                <p style={{ margin: 0, color: '#64748b', fontSize: '1.1rem' }}>📍 {duplicateCustomer.city || 'עיר לא צוינה'}</p>
              </div>
              <p style={{ marginBottom: '2rem', fontWeight: '600', fontSize: '1.1rem', color: '#334155', lineHeight: '1.6' }}>הלקוח שהזנת זוהה במערכת על פי מספר הטלפון. האם תרצה להשתמש בלקוח הקיים עבור הזמנה זו?</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => handleUseExistingCustomer(duplicateCustomer)} className="primary-button" style={{ flex: 1, padding: '1rem' }}>
                  כן, השתמש בלקוח הקיים
                </button>
                <button onClick={() => handleSaveNewCustomerAndProceed(true)} style={{ flex: 1, padding: '1rem', borderRadius: '12px', background: 'white', color: '#dc2626', border: '2px solid #fca5a5', fontWeight: '800', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  לא, צור לקוח חדש כפול
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreditModal && (
          <div onClick={() => setShowCreditModal(false)} style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} className="fade-in" style={{ background: 'white', padding: '2.5rem', borderRadius: '24px', maxWidth: '500px', width: '100%', direction: 'rtl', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.6rem', fontWeight: '800' }}>חיוב באשראי (נדרים פלוס)</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button 
                    onClick={(e) => { e.preventDefault(); setShowCreditModal(false); setShowQuickSwipeModal(true); setSwipeInput(''); setCreditError(''); }} 
                    style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', transition: 'opacity 0.2s' }}
                    onMouseOver={e => e.currentTarget.style.opacity=0.9} onMouseOut={e => e.currentTarget.style.opacity=1}
                    title="העברת כרטיס מהירה בקורא מגנטי"
                  >
                    🧲 העברה מהירה
                  </button>
                  <button onClick={() => setShowCreditModal(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
                </div>
              </div>
              
              {creditError && (
                <div style={{ background: '#fef2f2', color: '#dc2626', padding: '1rem', borderRadius: '12px', marginBottom: '1.5rem', fontWeight: '600', border: '1px solid #fecaca' }}>
                  {creditError}
                </div>
              )}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginBottom: '2rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#475569' }}>מספר כרטיס אשראי (או העברת קורא שפתיים)</label>
                  <input type="text" value={creditCardData.cardNumber} onChange={handleCardNumberChange} placeholder="0000 0000 0000 0000" maxLength="19" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.2rem', direction: 'ltr', textAlign: 'left', letterSpacing: '2px', outline: 'none' }} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#475569' }}>תוקף (MM/YY)</label>
                    <input type="text" value={creditCardData.tokef} onChange={handleTokefChange} placeholder="12/25" maxLength="5" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.2rem', direction: 'ltr', textAlign: 'left', letterSpacing: '2px', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#475569' }}>סכום לחיוב (₪)</label>
                    <input type="number" value={creditCardData.amount} onChange={e => setCreditCardData(prev => ({...prev, amount: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.2rem', fontWeight: '800', color: '#059669', textAlign: 'center', outline: 'none' }} />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#475569' }}>תשלומים</label>
                    <input type="number" value={creditCardData.installments} onChange={e => setCreditCardData(prev => ({...prev, installments: e.target.value}))} min="1" max="12" style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.1rem', textAlign: 'center', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '700', color: '#475569' }}>הערות לנדרים</label>
                    <input type="text" value={creditCardData.notes} onChange={e => setCreditCardData(prev => ({...prev, notes: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: '2px solid #e2e8f0', fontSize: '1.1rem', outline: 'none' }} />
                  </div>
                </div>
              </div>
              
              <button 
                onClick={handleProcessCreditCard}
                disabled={isProcessingCredit}
                style={{ width: '100%', padding: '1.2rem', background: isProcessingCredit ? '#cbd5e1' : '#2563eb', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.3rem', fontWeight: '800', cursor: isProcessingCredit ? 'wait' : 'pointer', transition: 'all 0.3s' }}
              >
                {isProcessingCredit ? 'מבצע חיוב מול נדרים...' : 'בצע חיוב עכשיו ושמור הזמנה'}
              </button>
            </div>
          </div>
        )}

        {showQuickSwipeModal && (
          <div onClick={() => setShowQuickSwipeModal(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(8px)' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: 'white', padding: '3rem', borderRadius: '24px', width: '450px', maxWidth: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
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
          </div>
        )}

      </main>
    </>
  );
}
