'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HebrewDatePicker from '../../../components/HebrewDatePicker';
import CustomerSelector from '../../../components/CustomerSelector';
import OrderModelSelector from '../../../components/orders/OrderModelSelector';

export default function NewOrderPage() {
  const router = useRouter();
  
  const [step, setStep] = useState(1);
  const [customerMode, setCustomerMode] = useState('existing'); // 'existing' or 'new'
  
  const [order, setOrder] = useState({
    customerId: '',
    selectedCustomer: null,
    eventDate: '',
    eventDateHebrew: '',
    returnDate: '',
    isAbroad: false,
    fromDate: '',
    toDate: '',
    notes: '',
    items: [],
  });
  
  // We no longer fetch all customers and dresses up front
  // state left for legacy reasons if needed but effectively unused
  
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
  
  const [calculatedData, setCalculatedData] = useState({ totalAmount: 0, items: [] });
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [newCustomer, setNewCustomer] = useState({
    firstName: '', lastName: '', phone1: '', email: '', city: ''
  });

  const [duplicateCustomer, setDuplicateCustomer] = useState(null);

  const [payment, setPayment] = useState({
    amount: '',
    method: 'אשראי', // default
    notes: ''
  });

  const [settings, setSettings] = useState({});

  const [showCreditModal, setShowCreditModal] = useState(false);
  const [creditCardData, setCreditCardData] = useState({
    cardNumber: '',
    tokef: '', // MMYY
    installments: 1,
    notes: '',
    amount: ''
  });
  const [isProcessingCredit, setIsProcessingCredit] = useState(false);
  const [creditError, setCreditError] = useState('');
  const [creditProcessedConfirmation, setCreditProcessedConfirmation] = useState(null);

  const handleProcessCreditCard = async () => {
    if (!creditCardData.cardNumber || !creditCardData.tokef || !creditCardData.amount) {
       setCreditError('אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).');
       return;
    }

    setIsProcessingCredit(true);
    setCreditError('');
    
    try {
      const cust = order.selectedCustomer || newCustomer;
      const fullAddress = cust.city || '';
      
      const response = await fetch('/api/nedarim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: `${cust.firstName || ''} ${cust.lastName || ''}`.trim(),
          phone: cust.phone1 || '',
          address: fullAddress,
          cardNumber: creditCardData.cardNumber,
          tokef: creditCardData.tokef,
          amount: parseFloat(creditCardData.amount),
          installments: parseInt(creditCardData.installments) || 1,
          notes: creditCardData.notes
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        const conf = data.confirmation || 'בוצע';
        setCreditProcessedConfirmation(conf);
        setShowCreditModal(false);
        // Directly proceed to save after successful charge
        executeSaveOrder(conf);
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
    // Fetch settings
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          const settingsObj = data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
          setSettings(settingsObj);
        } else {
          setSettings(data || {});
        }
      })
      .catch(err => console.error(err));
  }, []);

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

  // When eventDate or dressModelId changes, fetch available sizes
  useEffect(() => {
    // Determine if we have enough dates to check
    const hasDates = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
    
    if (hasDates && newItem.dressModelId) {
      setLoadingSizes(true);
      
      const queryParams = new URLSearchParams({
        dressModelId: newItem.dressModelId,
        isAbroad: order.isAbroad || false
      });
      
      if (order.eventDate) queryParams.append('eventDate', order.eventDate);
      if (order.isAbroad) {
        if (order.fromDate) queryParams.append('fromDate', order.fromDate);
        if (order.toDate) queryParams.append('toDate', order.toDate);
      }

      fetch(`/api/orders/availability?${queryParams.toString()}`)
        .then(res => res.json())
        .then(data => {
          setOrder(currOrder => {
            const localCartMap = {};
            currOrder.items.forEach(item => {
               if (item.dressModelId === newItem.dressModelId) {
                  if (!localCartMap[item.sizeText]) localCartMap[item.sizeText] = 0;
                  localCartMap[item.sizeText]++;
               }
            });
            const adjustedData = (data || []).map(s => {
               const inCart = localCartMap[s.sizeText] || 0;
               return { ...s, availableQuantity: Math.max(0, s.availableQuantity - inCart) };
            });
            setAvailableSizes(adjustedData);
            return currOrder;
          });
          setNewItem(prev => ({ ...prev, sizeText: '', sampleItemId: '', basePrice: 0, finalPrice: 0 }));
          setLoadingSizes(false);
        })
        .catch(() => setLoadingSizes(false));
    } else {
      setAvailableSizes([]);
    }
  }, [order.eventDate, order.fromDate, order.toDate, order.isAbroad, newItem.dressModelId]);

  // When size is selected, fetch price
  useEffect(() => {
    if (newItem.dressModelId && newItem.sizeText) {
      fetch(`/api/orders/pricing?dressModelId=${newItem.dressModelId}&sizeText=${newItem.sizeText}&eventDate=${order.eventDate || ''}`)
        .then(res => res.json())
        .then(data => {
          setNewItem(prev => ({
            ...prev,
            basePrice: data.basePrice,
            finalPrice: data.basePrice // Init final price with base price
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

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    if (name === 'sizeText') {
      // Find the selected size to get the sampleItemId
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
    
    // Decrement available quantity in the UI
    setAvailableSizes(prev => prev.map(s => {
      if (s.sizeText === newItem.sizeText) {
        return { ...s, availableQuantity: Math.max(0, s.availableQuantity - 1) };
      }
      return s;
    }));
    
    // Reset form
    setNewItem({
      dressModelId: '',
      sizeText: '',
      sampleItemId: '',
      quantity: 1,
      basePrice: 0,
      finalPrice: 0,
      repairs: '',
      dressName: ''
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
        isAbroad: order.isAbroad
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
  }, [order.items, order.eventDate, order.isAbroad]);

  const totalAmount = calculatedData.totalAmount;

  // Auto-update payment amount to total amount when items change, if payment amount hasn't been manually set yet
  useEffect(() => {
    if (totalAmount > 0 && payment.amount === '') {
      setPayment(prev => ({ ...prev, amount: totalAmount }));
    }
  }, [totalAmount]);

  const saveOrder = async () => {
    if (!order.customerId) return alert('יש לבחור לקוח');
    if (!order.eventDate) return alert('יש לבחור תאריך אירוע');
    if (order.items.length === 0) return alert('יש לבחור לפחות פריט אחד');

    if (payment.amount && parseFloat(payment.amount) > 0) {
      if (payment.method === 'אשראי' && !creditProcessedConfirmation) {
        // Open Nedarim modal to process before saving
        setCreditCardData({
          cardNumber: '',
          tokef: '',
          installments: 1,
          notes: '',
          amount: payment.amount
        });
        setCreditError('');
        setShowCreditModal(true);
        return; // Stop saving, wait for credit modal
      } else if (payment.method !== 'אשראי') {
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

    executeSaveOrder(creditProcessedConfirmation);
  };

  const executeSaveOrder = async (creditConfirmation = null) => {
    setSaving(true);
    
    // FULL ORDER INVENTORY VALIDATION
    try {
      const validateRes = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: order.items,
          eventDate: order.eventDate,
          isAbroad: order.isAbroad,
          fromDate: order.fromDate,
          toDate: order.toDate
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
      // Proceed on error or halt? Let's halt to be safe.
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
        payment: {
          ...payment,
          amount: parseFloat(payment.amount) || 0,
          notes: creditConfirmation ? `אישור נדרים: ${creditConfirmation} | ${payment.notes}` : payment.notes
        }
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

  const selectedCustomerName = order.selectedCustomer ? `${order.selectedCustomer.firstName} ${order.selectedCustomer.lastName}` : 'לא נבחר';

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
      
      <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
        
        {step === 1 && (
          <div className="fade-in" style={{ maxWidth: '650px', margin: '4rem auto', background: 'var(--card-bg)', padding: '3rem', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', alignItems: 'center' }}>
               <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem' }}>שלב 1: מי הלקוח?</h2>
               <span style={{ background: '#e3f2fd', color: '#1976d2', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold' }}>1 מתוך 3</span>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2.5rem' }}>
              <button 
                onClick={() => setCustomerMode('existing')}
                style={{ flex: 1, padding: '1.2rem', background: customerMode === 'existing' ? 'var(--primary-color)' : 'var(--element-bg)', color: customerMode === 'existing' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: 'all 0.2s', boxShadow: customerMode === 'existing' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}
              >
                לקוח קיים במערכת
              </button>
              <button 
                onClick={() => setCustomerMode('new')}
                style={{ flex: 1, padding: '1.2rem', background: customerMode === 'new' ? 'var(--primary-color)' : 'var(--element-bg)', color: customerMode === 'new' ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', transition: 'all 0.2s', boxShadow: customerMode === 'new' ? '0 4px 12px rgba(0,0,0,0.1)' : 'none' }}
              >
                יצירת לקוח חדש
              </button>
            </div>

            {customerMode === 'existing' ? (
              <div className="fade-in">
                <label style={{ display: 'block', marginBottom: '1rem', fontWeight: 'bold', fontSize: '1.1rem', color: '#444' }}>חיפוש ובחירת לקוח</label>
                <CustomerSelector 
                  value={order.selectedCustomer}
                  onChange={(c) => setOrder(prev => ({ ...prev, customerId: c.id, selectedCustomer: c }))}
                  placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                />
                
                <button 
                  onClick={proceedToStep2}
                  disabled={!order.customerId}
                  style={{ width: '100%', marginTop: '3rem', padding: '1.2rem', background: order.customerId ? 'var(--primary-color)' : 'var(--element-bg)', color: order.customerId ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', cursor: order.customerId ? 'pointer' : 'not-allowed', transition: 'all 0.3s', boxShadow: order.customerId ? '0 8px 24px rgba(0,0,0,0.15)' : 'none' }}
                >
                  המשך לשלב הבא ⬅
                </button>
              </div>
            ) : (
              <div className="fade-in">
                 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>שם פרטי *</label>
                    <input type="text" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({...prev, firstName: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1.05rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>שם משפחה *</label>
                    <input type="text" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({...prev, lastName: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1.05rem' }} />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>טלפון נייד *</label>
                    <input type="text" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({...prev, phone1: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1.05rem' }} />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>אימייל</label>
                    <input type="email" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({...prev, email: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1.05rem' }} />
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>עיר מגורים</label>
                  <input type="text" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({...prev, city: e.target.value}))} style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1.05rem' }} />
                </div>
                
                <button 
                  onClick={() => handleSaveNewCustomerAndProceed()}
                  style={{ width: '100%', marginTop: '2rem', padding: '1.2rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
                >
                  שמור לקוח והמשך ⬅
                </button>
              </div>
            )}
            
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
               <Link href="/orders" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '1.05rem' }}>ביטול וחזרה לרשימת ההזמנות</Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', background: 'var(--card-bg)', padding: '1.5rem 2rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <h1 style={{ color: 'var(--primary-color)', fontSize: '2.2rem', margin: 0 }}>פרטי ההזמנה</h1>
                  <span style={{ background: '#e3f2fd', color: '#1976d2', padding: '0.3rem 0.8rem', borderRadius: '20px', fontSize: '0.9rem', fontWeight: 'bold' }}>2 מתוך 3</span>
                </div>
                <div style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', fontSize: '1.1rem' }}>
                  <span>לקוח נבחר: <strong>{selectedCustomerName}</strong></span>
                  <span style={{ color: '#ccc' }}>|</span>
                  <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', color: '#1976d2', textDecoration: 'underline', cursor: 'pointer', padding: 0, fontSize: '1rem' }}>החלף לקוח</button>
                </div>
              </div>
              <Link href="/orders" style={{ textDecoration: 'none', color: 'var(--text-muted)', fontWeight: 'bold' }}>ביטול</Link>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Right Side - General Details */}
              <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', height: 'fit-content' }}>
                <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem', fontSize: '1.5rem' }}>תאריכים והערות</h2>

                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', color: '#444' }}>תאריך אירוע *</label>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <HebrewDatePicker 
                        value={order.eventDate} 
                        onChange={(date) => handleOrderChange({ target: { name: 'eventDate', value: date }})} 
                      />
                    </div>
                  </div>
                </div>



                <div style={{ marginBottom: '1.5rem', background: '#f8f9fa', padding: '1rem', borderRadius: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontWeight: 'bold', color: '#444' }}>
                    <input 
                      type="checkbox" 
                      name="isAbroad" 
                      checked={order.isAbroad} 
                      onChange={handleOrderChange} 
                      style={{ width: '22px', height: '22px', accentColor: 'var(--primary-color)' }} 
                    />
                    אירוע חו"ל (תפוסה מותאמת אישית)
                  </label>
                  
                  {order.isAbroad && (
                    <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>מתאריך</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <HebrewDatePicker 
                              value={order.fromDate} 
                              onChange={(date) => handleOrderChange({ target: { name: 'fromDate', value: date }})} 
                            />
                          </div>
                        </div>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>עד תאריך</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <div style={{ flex: 1 }}>
                            <HebrewDatePicker 
                              value={order.toDate} 
                              onChange={(date) => handleOrderChange({ target: { name: 'toDate', value: date }})} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.75rem', fontWeight: 'bold', color: '#444' }}>הערות להזמנה</label>
                  <textarea 
                    name="notes" 
                    value={order.notes} 
                    onChange={handleOrderChange}
                    placeholder="הערות מיוחדות, בקשות..."
                    style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', minHeight: '120px', fontSize: '1rem', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
              </div>

              {/* Left Side - Items and Subform */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                
                <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                  <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem', fontSize: '1.5rem' }}>בחירת פריטים</h2>
                  
                  {!order.eventDate ? (
                    <div style={{ padding: '2.5rem', textAlign: 'center', color: '#d32f2f', background: '#ffebee', borderRadius: '12px', fontSize: '1.1rem', fontWeight: 'bold', border: '1px dashed #ef5350' }}>
                      יש לבחור תחילה תאריך אירוע כדי לוודא מלאי זמין!
                    </div>
                  ) : (
                    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      
                      {/* Row 1: Model & Size */}
                      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div style={{ flex: 2, minWidth: '250px' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>דגם שמלה</label>
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
                            placeholder="חפש דגם..."
                          />
                        </div>

                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>
                            מידה {loadingSizes && <span style={{fontSize:'0.85rem', color:'var(--primary-color)', fontWeight: 'normal'}}>(טוען...)</span>}
                          </label>
                          <select 
                            name="sizeText" 
                            value={newItem.sizeText} 
                            onChange={handleNewItemChange}
                            disabled={!newItem.dressModelId || availableSizes.length === 0}
                            style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1rem', background: (!newItem.dressModelId || availableSizes.length === 0) ? '#f5f5f5' : 'var(--card-bg)', appearance: 'auto' }}
                          >
                            <option value="">בחר מידה פנויה...</option>
                            {availableSizes.map(s => (
                              <option key={s.sizeText} value={s.sizeText}>
                                מידה: {s.sizeText} (פנויות: {s.availableQuantity} מתוך {s.totalInStock})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Row 2: Alterations */}
                      <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', background: '#f8f9fa', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e9ecef', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input 
                            type="checkbox" 
                            name="neckAlteration"
                            checked={newItem.neckAlteration || false} 
                            onChange={(e) => handleNewItemChange({ target: { name: 'neckAlteration', value: e.target.checked }})}
                            style={{ width: '22px', height: '22px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                          />
                          <label style={{ fontWeight: 'bold', color: '#444', cursor: 'pointer', fontSize: '1.05rem' }} onClick={() => handleNewItemChange({ target: { name: 'neckAlteration', value: !newItem.neckAlteration }})}>תיקון צוואר</label>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input 
                            type="checkbox" 
                            name="sleeveAlteration"
                            checked={newItem.sleeveAlteration || false} 
                            onChange={(e) => handleNewItemChange({ target: { name: 'sleeveAlteration', value: e.target.checked }})}
                            style={{ width: '22px', height: '22px', accentColor: 'var(--primary-color)', cursor: 'pointer' }}
                          />
                          <label style={{ fontWeight: 'bold', color: '#444', cursor: 'pointer', fontSize: '1.05rem' }} onClick={() => handleNewItemChange({ target: { name: 'sleeveAlteration', value: !newItem.sleeveAlteration }})}>תיקון שרוול</label>
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', borderRight: '2px solid #dee2e6', paddingRight: '2rem', marginRight: '1rem', minWidth: '200px' }}>
                          <label style={{ fontWeight: 'bold', color: '#444', whiteSpace: 'nowrap', fontSize: '1.05rem' }}>תיקון אורך:</label>
                          <input 
                            type="number" 
                            name="lengthAlteration"
                            value={newItem.lengthAlteration || ''} 
                            onChange={handleNewItemChange}
                            placeholder="מספר ס״מ..."
                            style={{ width: '130px', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--element-border)', fontSize: '1rem', textAlign: 'center' }}
                          />
                        </div>
                      </div>

                      {/* Row 3: Repairs */}
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>פירוט תיקונים נוספים</label>
                        <input 
                          type="text" 
                          name="repairs" 
                          value={newItem.repairs} 
                          onChange={handleNewItemChange}
                          placeholder="הערות נוספות לתופרת..."
                          style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1rem' }}
                        />
                      </div>

                      {/* Row 4: Button */}
                      <div style={{ marginTop: '0.5rem' }}>
                        <button 
                          type="button" 
                          onClick={addItemToOrder}
                          style={{ width: '100%', padding: '1.2rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', transition: 'all 0.2s', boxShadow: '0 4px 15px rgba(46,125,50,0.2)' }}
                          onMouseOver={(e) => { e.target.style.background = '#1b5e20'; e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 6px 20px rgba(46,125,50,0.3)'; }}
                          onMouseOut={(e) => { e.target.style.background = '#2e7d32'; e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 15px rgba(46,125,50,0.2)'; }}
                        >
                          + הוסף להזמנה
                        </button>
                      </div>

                    </div>
                  )}
                </div>

                <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', flex: 1 }}>
                  <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', borderBottom: '2px solid #f0f0f0', paddingBottom: '1rem', fontSize: '1.5rem' }}>סיכום פריטים</h2>
                  
                  {order.items.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem 1rem', background: '#f8f9fa', borderRadius: '12px', border: '1px dashed var(--element-border)' }}>
                      טרם נבחרו פריטים להזמנה זו.
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid #ddd', color: 'var(--text-muted)', fontSize: '0.95rem' }}>
                            <th style={{ padding: '1rem 0.5rem' }}>דגם</th>
                            <th style={{ padding: '1rem 0.5rem' }}>מידה</th>
                            <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>צוואר</th>
                            <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>שרוול</th>
                            <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>אורך</th>
                            <th style={{ padding: '1rem 0.5rem' }}>פירוט תיקונים</th>
                            <th style={{ padding: '1rem 0.5rem' }}>מחיר</th>
                            <th style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>הסר</th>
                          </tr>
                        </thead>
                        <tbody>
                          {order.items.map((item, idx) => {
                            const calcItem = calculatedData.items[idx];
                            const displayPrice = calcItem ? calcItem.calculatedPrice : item.finalPrice;
                            const isDiscounted = calcItem ? calcItem.isDiscountedSet : false;
                            const dressName = item.dressName || 'דגם לא ידוע';
                            return (
                              <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0', transition: 'background 0.2s' }} onMouseOver={(e) => e.currentTarget.style.background = 'var(--element-bg)'} onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                                  {dressName}
                                  {isDiscounted && <span style={{ color: '#e53935', fontSize: '0.85rem', marginRight: '0.5rem' }}>(חינם בסט)</span>}
                                </td>
                                <td style={{ padding: '1rem 0.5rem', fontWeight: 'bold' }}>
                                  <span style={{ background: 'var(--element-bg)', padding: '0.25rem 0.5rem', borderRadius: '6px' }}>{item.sizeText}</span>
                                </td>
                                <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                  {item.neckAlteration ? '✔️' : '-'}
                                </td>
                                <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                  {item.sleeveAlteration ? '✔️' : '-'}
                                </td>
                                <td style={{ padding: '1rem 0.5rem', textAlign: 'center', color: 'var(--text-main)' }}>
                                  {item.lengthAlteration || '-'}
                                </td>
                                <td style={{ padding: '1rem 0.5rem', color: 'var(--text-main)', fontSize: '0.95rem' }}>
                                  {item.repairs || '-'}
                                </td>
                                <td style={{ padding: '1rem 0.5rem', color: '#2e7d32', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                  ₪{displayPrice}
                                  {calculating && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>...מחשב</span>}
                                </td>
                                <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                                  <button onClick={() => removeItem(idx)} style={{ background: '#ffebee', color: '#e53935', border: '1px solid #ffcdd2', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', transition: 'all 0.2s' }} onMouseOver={(e) => { e.currentTarget.style.background = '#e53935'; e.currentTarget.style.color = 'white'; }} onMouseOut={(e) => { e.currentTarget.style.background = '#ffebee'; e.currentTarget.style.color = '#e53935'; }}>
                                    X
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan="6" style={{ padding: '1.5rem 0.5rem 0 0.5rem', fontSize: '1.3rem', fontWeight: 'bold', color: 'var(--text-main)' }}>סה"כ לתשלום:</td>
                            <td colSpan="2" style={{ padding: '1.5rem 0.5rem 0 0.5rem', fontSize: '1.8rem', fontWeight: 'bold', color: '#2e7d32' }}>₪{totalAmount}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <button 
                    onClick={() => setStep(1)}
                    style={{ padding: '1.5rem 2rem', background: 'var(--card-bg)', color: 'var(--text-muted)', border: '2px solid #ddd', borderRadius: '16px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseOver={(e) => e.target.style.background = 'var(--element-bg)'}
                    onMouseOut={(e) => e.target.style.background = 'var(--input-bg)'}
                  >
                    חזור לשלב קודם
                  </button>
                  <button 
                    onClick={() => setStep(3)}
                    disabled={order.items.length === 0}
                    style={{ flex: 1, padding: '1.5rem', background: (order.items.length === 0) ? 'var(--element-bg)' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '16px', fontSize: '1.5rem', fontWeight: 'bold', cursor: (order.items.length === 0) ? 'not-allowed' : 'pointer', boxShadow: (order.items.length === 0) ? 'none' : '0 8px 24px rgba(0,0,0,0.15)', transition: 'background 0.3s' }}
                  >
                    המשך לתשלום ⬅
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="fade-in" style={{ maxWidth: '650px', margin: '4rem auto', background: 'var(--card-bg)', padding: '3rem', borderRadius: '16px', boxShadow: '0 10px 40px rgba(0,0,0,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', alignItems: 'center' }}>
               <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '2rem' }}>שלב 3: תשלום</h2>
               <span style={{ background: '#e3f2fd', color: '#1976d2', padding: '0.4rem 1rem', borderRadius: '20px', fontSize: '1rem', fontWeight: 'bold' }}>3 מתוך 3</span>
            </div>
            
            <div style={{ marginBottom: '2rem', padding: '1.5rem', background: '#f8f9fa', borderRadius: '12px', textAlign: 'center', border: '2px solid var(--element-border)' }}>
              <div style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem' }}>סה"כ לתשלום עבור ההזמנה</div>
              <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2e7d32' }}>₪{totalAmount}</div>
            </div>

            <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>סכום לתשלום כעת (₪)</label>
                <input 
                  type="number" 
                  value={payment.amount} 
                  onChange={e => setPayment(prev => ({...prev, amount: e.target.value}))} 
                  style={{ width: '100%', padding: '1.2rem', borderRadius: '12px', border: '2px solid var(--element-border)', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-main)' }} 
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>אופן תשלום</label>
                <select 
                  value={payment.method} 
                  onChange={e => setPayment(prev => ({...prev, method: e.target.value}))} 
                  style={{ width: '100%', padding: '1.2rem', borderRadius: '12px', border: '1px solid var(--element-border)', fontSize: '1.1rem' }}
                >
                  <option value="אשראי">אשראי</option>
                  <option value="מזומן">מזומן</option>
                  <option value="העברה בנקאית">העברה בנקאית</option>
                  <option value="צ'ק">צ'ק</option>
                  <option value="אפליקציית תשלום">אפליקציית תשלום (ביט/פייבוקס)</option>
                  <option value="אחר">אחר</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold', color: '#444' }}>הערות לתשלום</label>
                <input 
                  type="text" 
                  value={payment.notes} 
                  onChange={e => setPayment(prev => ({...prev, notes: e.target.value}))} 
                  placeholder="מספר אישור, פרטי הבנק, וכדומה..."
                  style={{ width: '100%', padding: '1rem', borderRadius: '10px', border: '1px solid var(--element-border)', fontSize: '1rem' }} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button 
                onClick={() => setStep(2)}
                style={{ padding: '1.2rem 2rem', background: 'var(--card-bg)', color: 'var(--text-muted)', border: '2px solid #ddd', borderRadius: '12px', fontSize: '1.2rem', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                חזור
              </button>
              <button 
                onClick={saveOrder}
                disabled={saving}
                style={{ flex: 1, padding: '1.2rem', background: saving ? 'var(--element-bg)' : 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.3rem', fontWeight: 'bold', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : '0 8px 24px rgba(0,0,0,0.15)', transition: 'all 0.3s' }}
              >
                {saving ? 'שומר במערכת...' : 'סיום ושמירת כרטיס הזמנה ✔'}
              </button>
            </div>
          </div>
        )}

        {duplicateCustomer && (
          <div className="modal-overlay" style={{ zIndex: 1000, position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div className="modal-content fade-in" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', maxWidth: '500px', width: '100%', direction: 'rtl', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
              <h3 style={{ color: '#d32f2f', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', margin: '0 0 1rem 0' }}>
                <span>⚠️</span> לקוח קיים במערכת
              </h3>
              <div style={{ background: '#f8f9fa', padding: '1.5rem', borderRadius: '12px', marginBottom: '1.5rem', border: '1px solid #eee' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.2rem', color: 'var(--text-main)' }}>
                    {duplicateCustomer.firstName} {duplicateCustomer.lastName}
                  </p>
                  <Link href={`/customers/${duplicateCustomer.id}`} target="_blank" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: '#e3f2fd', color: '#1976d2', borderRadius: '50%', textDecoration: 'none', transition: 'all 0.2s', boxShadow: '0 2px 5px rgba(25,118,210,0.2)' }} title="פתיחת כרטיס לקוח בטאב חדש">
                    ↗
                  </Link>
                </div>
                <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text-muted)', fontSize: '1.1rem' }}>📞 {duplicateCustomer.phone1} {duplicateCustomer.phone2 ? `| ${duplicateCustomer.phone2}` : ''}</p>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '1.1rem' }}>📍 {duplicateCustomer.city || 'עיר לא צוינה'}</p>
              </div>
              <p style={{ marginBottom: '1.5rem', fontWeight: 'bold', fontSize: '1.1rem', color: '#444' }}>הלקוח שהזנת זוהה במערכת על פי מספר הטלפון. האם תרצה להשתמש בלקוח הקיים עבור הזמנה זו?</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button onClick={() => handleUseExistingCustomer(duplicateCustomer)} style={{ flex: 1, padding: '1rem', borderRadius: '10px', background: 'var(--primary-color)', color: 'white', fontWeight: 'bold', fontSize: '1.1rem', border: 'none', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                  כן, השתמש בלקוח הקיים
                </button>
                <button onClick={() => handleSaveNewCustomerAndProceed(true)} style={{ flex: 1, padding: '1rem', borderRadius: '10px', background: 'var(--card-bg)', color: '#d32f2f', border: '2px solid #d32f2f', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                  לא, צור לקוח חדש בכל זאת
                </button>
              </div>
              <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                <button onClick={() => setDuplicateCustomer(null)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', textDecoration: 'underline', cursor: 'pointer', fontSize: '1rem' }}>
                  ביטול וחזרה לעריכה
                </button>
              </div>
            </div>
          </div>
        )}

        {showCreditModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl' }}>
            <div className="fade-in" style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '8px', width: '400px', maxWidth: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
              <h2 style={{ marginTop: 0, color: '#1976d2', borderBottom: '2px solid #eee', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                סליקת כרטיס אשראי (נדרים פלוס)
              </h2>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>שם לקוח:</label>
                <input type="text" readOnly value={`${(order.selectedCustomer || newCustomer)?.firstName || ''} ${(order.selectedCustomer || newCustomer)?.lastName || ''}`} style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ddd', background: 'var(--element-bg)' }} />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>סכום לחיוב (₪):</label>
                <input 
                  type="number" 
                  value={creditCardData.amount} 
                  onChange={e => setCreditCardData({...creditCardData, amount: e.target.value})}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} 
                />
              </div>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>מספר כרטיס אשראי:</label>
                <input 
                  type="text" 
                  value={creditCardData.cardNumber} 
                  onChange={e => setCreditCardData({...creditCardData, cardNumber: e.target.value})}
                  placeholder="הכנס מספר כרטיס ללא רווחים"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)', direction: 'ltr', textAlign: 'left' }} 
                />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תוקף (MMYY):</label>
                  <input 
                    type="text" 
                    value={creditCardData.tokef} 
                    onChange={e => setCreditCardData({...creditCardData, tokef: e.target.value})}
                    placeholder="למשל 1225"
                    maxLength="4"
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)', direction: 'ltr', textAlign: 'left' }} 
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תשלומים:</label>
                  <input 
                    type="number" 
                    min="1" max="36"
                    value={creditCardData.installments} 
                    onChange={e => setCreditCardData({...creditCardData, installments: e.target.value})}
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} 
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>הערות:</label>
                <input 
                  type="text" 
                  value={creditCardData.notes} 
                  onChange={e => setCreditCardData({...creditCardData, notes: e.target.value})}
                  placeholder="הערות לחיוב"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--element-border)' }} 
                />
              </div>

              {creditError && (
                <div style={{ padding: '0.8rem', background: '#ffebee', color: '#c62828', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  {creditError}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button 
                  onClick={() => setShowCreditModal(false)} 
                  disabled={isProcessingCredit}
                  style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--text-main)', border: '1px solid var(--element-border)', borderRadius: '4px', cursor: 'pointer' }}
                >
                  ביטול
                </button>
                <button 
                  onClick={handleProcessCreditCard} 
                  disabled={isProcessingCredit}
                  style={{ padding: '0.5rem 1.5rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '4px', cursor: isProcessingCredit ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                  {isProcessingCredit ? 'מעבד...' : 'חייב וסגור הזמנה'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
