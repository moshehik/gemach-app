'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, CreditCard, ArrowRight, Users, Info, Package, RefreshCcw, CreditCard as PaymentIcon, History, Printer, Mail, FileText, ClipboardList } from 'lucide-react';
import OrderGeneralDetails from '../../../components/orders/OrderGeneralDetails';
import ActiveEmployeesModal from '../../../components/orders/ActiveEmployeesModal';
import OrderItemsManager from '../../../components/orders/OrderItemsManager';
import OrderRentalsManager from '../../../components/orders/OrderRentalsManager';
import OrderPaymentsManager from '../../../components/orders/OrderPaymentsManager';
import { calculateOrderStatus, getStatusColor, calculatePaymentStatus, getPaymentStatusColor } from '../../../lib/orderStatus';
import HistoryViewer from '../../../components/HistoryViewer';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { addHistory } from '../../../lib/historyManager';

export default function OrderDetailsPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  
  const [order, setOrder] = useState(null);
  const initialLockChecked = useRef(false);
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [items, setItems] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [inventoryCache, setInventoryCache] = useState(null);
  
  // Custom Email Prompt State
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailTypePending, setEmailTypePending] = useState(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState('details'); // details, items, rentals, payments, history
  const [debtApproved, setDebtApproved] = useState(false); // Track manager approval to skip exit warning
  const isManualRef = useRef(false); // prevent observer overriding scroll

  // Scrollspy observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isManualRef.current) return; // skip if user clicked tab
        const visibleEntries = entries.filter(e => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // find the one taking up the most space or the first one
          const mostVisible = visibleEntries.reduce((prev, current) => 
            (prev.intersectionRatio > current.intersectionRatio) ? prev : current
          );
          if (mostVisible.target.id) {
            setActiveTab(prev => {
              if (prev !== mostVisible.target.id) return mostVisible.target.id;
              return prev;
            });
          }
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.2, 0.5, 1] }
    );

    const tabIds = ['details', 'items', 'rentals', 'payments', 'history'];
    tabIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  // Fetch Order
  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setOrder(data);
        if (!initialLockChecked.current) {
          if (data.eventDate && new Date(data.eventDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0)) {
             setIsPastEvent(true);
          }
          initialLockChecked.current = true;
        }
        setItems(data.items || []);
        setObligations(data.obligations || []);
        setPayments(data.payments || []);
        setRefunds(data.refunds || []);
        setLoading(false);
        
        // Add to history
        addHistory({ 
          type: 'order', 
          id: data.orderId, 
          name: `הזמנה #${data.orderId}`, 
          subtext: data.customer ? `${data.customer.firstName} ${data.customer.lastName}` : '' 
        });
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!order) return;
    const hasDates = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
    if (hasDates) {
      const queryParams = new URLSearchParams({
        isAbroad: order.isAbroad || false,
        isWeekdayEvent: order.isWeekdayEvent || false,
        excludeOrderId: order.orderId
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
        })
        .catch(err => console.error('Failed to preload inventory cache', err));
    }
  }, [order?.eventDate, order?.fromDate, order?.toDate, order?.isAbroad, order?.isWeekdayEvent, order?.orderId]);

  const totalRequired = obligations.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0);
  const totalPaid = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);

  // Prevent closing window if there is a debt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (totalRequired - totalPaid > 0 && !debtApproved) {
        e.preventDefault();
        e.returnValue = 'קיימת יתרת חוב בהזמנה! אנא דאג לתשלום או אישור מנהל.';
        return 'קיימת יתרת חוב בהזמנה! אנא דאג לתשלום או אישור מנהל.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [totalRequired, totalPaid, debtApproved]);

  // Save changes
  const handleSave = async (overrideOrder = null) => {
    setSaving(true);
    setSaveMessage('');

    const currentOrder = overrideOrder || order;
    if (!currentOrder) {
      setSaving(false);
      alert('שגיאה: נתוני ההזמנה לא טוענו כראוי');
      return;
    }

    // VALIDATE REPAIRS
    for (const item of items) {
      if (!item.isDeleted) {
        const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
        if (hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
          setSaving(false);
          alert('חובה להזין פירוט תיקון עבור כל פריט שיש לו תיקון מסומן (צוואר, שרוול או אורך).');
          return;
        }
      }
    }
    
    // FULL ORDER INVENTORY VALIDATION
    const activeItems = (items || []).filter(i => !i.isDeleted);
    const hasDates = (currentOrder.isAbroad || currentOrder.isWeekdayEvent) ? (currentOrder.fromDate && currentOrder.toDate) : currentOrder.eventDate;

    if (activeItems.length > 0 && !hasDates) {
      setSaving(false);
      alert(currentOrder.isAbroad || currentOrder.isWeekdayEvent 
        ? 'חובה להזין תאריכי התחלה וסיום (אירוע חו"ל/מיוחד) עבור הזמנה הכוללת פריטים.' 
        : 'חובה לבחור תאריך אירוע עבור הזמנה הכוללת פריטים.');
      return;
    }

    if (activeItems.length > 0 && hasDates) {
      try {
        const validateRes = await fetch('/api/orders/validate-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: activeItems, 
            eventDate: currentOrder.eventDate,
            isAbroad: currentOrder.isAbroad,
            isWeekdayEvent: currentOrder.isWeekdayEvent,
            fromDate: currentOrder.fromDate,
            toDate: currentOrder.toDate,
            orderId: currentOrder.orderId 
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
    }

    let debtApprovedBy = null;
    // CHECK DEBT AND REQUIRE APPROVAL TO SAVE
    if (totalRequired - totalPaid > 0) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. שמירת השינויים דורשת הרשאת עובד או מנהל. אנא בחר משתמש והזן סיסמה:", 'עובד');
      if (!authResult || !authResult.pin) {
        setSaving(false);
        // Returning quietly here made the Save button look broken - nothing happened and
        // nothing explained why.
        setSaveMessage('השמירה בוטלה: נדרש אישור עובד או מנהל בגלל יתרת חוב.');
        return;
      }
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'עובד' })
        });
        const data = await res.json();
        if (!data.success) {
          setSaving(false);
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
        debtApprovedBy = authResult.employeeId;
        setDebtApproved(true);
      } catch (err) {
        setSaving(false);
        alert('שגיאה באימות קוד עובד/מנהל.');
        return;
      }
    }

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrder.orderId,
          customerId: currentOrder.customerId,
          eventDate: currentOrder.eventDate,
          eventDateHebrew: currentOrder.eventDateHebrew,
          returnDate: currentOrder.returnDate,
          isAbroad: currentOrder.isAbroad,
          isWeekdayEvent: currentOrder.isWeekdayEvent,
          fromDate: currentOrder.fromDate,
          toDate: currentOrder.toDate,
          notes: currentOrder.notes,
          status: currentOrder.status,
          hasSignedRegulations: currentOrder.hasSignedRegulations,
          updatedAt: currentOrder.updatedAt,
          items: items,
          obligations: obligations,
          payments: payments,
          debtApprovedBy: debtApprovedBy,
          totalAmount: (() => {
            const itemsSum = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);
            const obligationsSum = obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
            return itemsSum > 0 ? itemsSum : (obligationsSum > 0 ? obligationsSum : (currentOrder.totalAmount || 0));
          })()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error((errorData && errorData.message) ? errorData.message : 'Failed to save');
      }
      
      const updatedOrder = await res.json();
      setOrder(updatedOrder);
      setItems(updatedOrder.items || []);
      setObligations(updatedOrder.obligations || []);
      setPayments(updatedOrder.payments || []);
      setRefunds(updatedOrder.refunds || []);
      
      setSaveMessage('השינויים נשמרו בהצלחה!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage(err.message || 'שגיאה בשמירת הנתונים.');
    } finally {
      setSaving(false);
    }
  };

  const handleOrderUpdate = (updatedOrder) => {
    setOrder(updatedOrder);
    setItems(updatedOrder.items || []);
    setObligations(updatedOrder.obligations || []);
    setPayments(updatedOrder.payments || []);
    setRefunds(updatedOrder.refunds || []);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', cursor: 'default', userSelect: 'none' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', pointerEvents: 'none' }} />
      <h2 style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>טוען נתוני הזמנה...</h2>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
  
  if (!order) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', color: 'var(--text-muted)' }}>הזמנה לא נמצאה.</div>;

  const totalPayable = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);

  const paymentStatus = calculatePaymentStatus(totalRequired, totalPaid);
  const paymentColor = getPaymentStatusColor(paymentStatus);

  const createdDate = order.orderDate || order.createdAt;

  const handleExit = async () => {
    if (totalRequired - totalPaid > 0 && !debtApproved) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. יציאה דורשת הרשאת עובד או מנהל. אנא בחר משתמש והזן סיסמה:", 'עובד');
      if (!authResult || !authResult.pin) {
        return;
      }
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'עובד' })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
        setDebtApproved(true);
      } catch (err) {
        alert('שגיאה באימות קוד עובד/מנהל.');
        return;
      }
    }
    router.back();
  };

  const isLocked = isPastEvent && !isUnlocked;

  const handleUnlock = async () => {
    const authResult = await window.customAuthPrompt("הזמנה זו נעולה כי תאריך האירוע עבר. נדרש אישור מנהל לעריכה. אנא בחר מנהל והזן סיסמה:", 'מנהל');
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
      setIsUnlocked(true);
    } catch (err) {
      alert('שגיאה באימות קוד מנהל.');
    }
  };

  const tabs = [
    { id: 'details', label: 'פרטים כלליים', icon: Info, color: '#3b82f6' },
    { id: 'items', label: 'פריטים', icon: Package, color: '#8b5cf6' },
    { id: 'rentals', label: 'השכרות והחזרות', icon: RefreshCcw, color: '#10b981' },
    { id: 'payments', label: 'תשלומים', icon: PaymentIcon, color: '#f59e0b' },
    { id: 'history', label: 'היסטוריה', icon: History, color: '#64748b' }
  ];

  const handlePrintOrder = () => {
    if (order.hasSignedRegulations) {
      setShowPrintMenu(!showPrintMenu);
      return;
    }
    
    setShowRegulationsModal(true);
  };

  const handleSendEmail = async (type, forcedEmail = null) => {
    setShowPrintMenu(false);
    
    let targetEmail = forcedEmail || order.customer?.email;
    
    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailTypePending(type);
      setEmailInput('');
      setShowEmailPrompt(true);
      return;
    }
    
    setSaveMessage('שולח מייל...');
    try {
      const res = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type: type })
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('המייל נשלח בהצלחה!');
      } else {
        setSaveMessage('שגיאה: ' + (data.error || 'השליחה נכשלה'));
      }
    } catch (err) {
      setSaveMessage('שגיאה בשליחת המייל');
    }
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleEmailSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      alert('כתובת המייל שהוזנה אינה תקינה.');
      return;
    }
    
    const validEmail = emailInput.trim();
    setShowEmailPrompt(false);
    
    // Save to customer
    if (order.customer?.id) {
      try {
        const res = await fetch(`/api/customers/${order.customer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...order.customer, email: validEmail })
        });
        if (res.ok) {
          setOrder(prev => ({
            ...prev,
            customer: { ...prev.customer, email: validEmail }
          }));
        }
      } catch (e) {
        console.error('Failed to update customer email:', e);
      }
    }
    
    // Continue with sending
    handleSendEmail(emailTypePending, validEmail);
  };

  const activeTabIndex = tabs.findIndex(t => t.id === activeTab);
  const activeTabDetails = tabs[activeTabIndex];

  return (
    <main data-agy-id="[id]_page_main_1" style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', fontFamily: 'var(--font-primary, system-ui)' }}>
      
      {/* Header Sticky Bar */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        background: (totalRequired - totalPaid > 0) ? 'rgba(254, 226, 226, 0.95)' : 'rgba(255, 255, 255, 0.95)', 
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '16px', 
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', 
        border: '1px solid rgba(255,255,255,0.4)',
        marginBottom: '2rem',
        position: 'sticky',
        top: '1rem',
        zIndex: 100,
        transition: 'background-color 0.3s ease',
        overflow: 'visible'
      }}>
        {/* Top Header Information */}
        <div style={{
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '1.5rem 2rem 1rem 2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, color: '#1e293b', fontSize: '1.8rem', fontWeight: '800' }}>
                כרטיס הזמנה #{order.orderId}
              </h1>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ 
                  fontSize: '0.9rem', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: '600',
                  background: getStatusColor(calculateOrderStatus(order)).bg,
                  color: getStatusColor(calculateOrderStatus(order)).text,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {calculateOrderStatus(order)}
                </span>
                <span style={{ 
                  fontSize: '0.9rem', padding: '0.3rem 1rem', borderRadius: '20px', fontWeight: '600',
                  background: paymentColor.bg,
                  color: paymentColor.text,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                }}>
                  {paymentStatus}
                </span>
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.9rem' }}>
              <div style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: '500' }}>לקוח:</span> 
                <strong style={{ color: '#0f172a' }}>{order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לא נבחר'}</strong>
                {order.customer?.phone1 && <span style={{ direction: 'ltr', color: '#64748b' }}>({order.customer.phone1})</span>}
              </div>
              
              <div style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: '500' }}>תאריך אירוע:</span> 
                <strong style={{ color: '#0f172a' }}>
                  {order.eventDateHebrew || (order.eventDate ? getHebrewDateString(order.eventDate) : 'לא צוין')}
                </strong>
              </div>

              {(order.fromDate || order.toDate || order.returnDate) && (
                <div style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontWeight: '500' }}>לקיחה:</span> 
                  <strong style={{ color: '#0f172a' }}>{order.fromDate ? new Date(order.fromDate).toLocaleDateString('he-IL') : '-'}</strong>
                  <span style={{ margin: '0 0.2rem' }}>|</span>
                  <span style={{ fontWeight: '500' }}>החזרה:</span> 
                  <strong style={{ color: '#0f172a' }}>{order.toDate || order.returnDate ? new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL') : '-'}</strong>
                </div>
              )}

              <div style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontWeight: '500' }}>קופאי:</span> 
                <strong style={{ color: '#0f172a' }}>
                  {order.employee ? `${order.employee.firstName || ''} ${order.employee.lastName || ''}`.trim() : 'לא ידוע'}
                </strong>
              </div>

            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginRight: 'auto' }}>
            {saveMessage && <span style={{ color: saveMessage.includes('שגיאה') ? '#ef4444' : '#10b981', fontWeight: 'bold', background: saveMessage.includes('שגיאה') ? '#fee2e2' : '#d1fae5', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>{saveMessage}</span>}
            
            <button data-element-name="כפתור_page_1" data-agy-id="[id]_page_button_2" 
              onClick={handleSave} 
              disabled={saving || isLocked}
              title={isLocked ? "הזמנה נעולה" : "שמור שינויים"}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.65rem 1.2rem', 
                background: '#2563eb', 
                color: 'white', 
                border: 'none', 
                borderRadius: '10px', 
                cursor: (saving || isLocked) ? 'not-allowed' : 'pointer',
                opacity: (saving || isLocked) ? 0.7 : 1,
                fontWeight: '600',
                fontSize: '0.95rem',
                transition: 'all 0.2s ease',
                transform: saving ? 'scale(0.98)' : 'scale(1)'
              }}
              onMouseOver={(e) => { if (!saving && !isLocked) e.currentTarget.style.backgroundColor = '#1d4ed8'; }}
              onMouseOut={(e) => { if (!saving && !isLocked) e.currentTarget.style.backgroundColor = '#2563eb'; }}
            >
              {saving ? <div className="spinner" style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Save data-element-name="רכיב_page_2" size={18} />}
              שמור
            </button>
            
            <button data-element-name="כפתור_page_3" data-agy-id="[id]_page_button_3" 
              onClick={() => setShowEmployeesModal(true)}
              title="עובדים פעילים"
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.65rem 1rem', background: '#fff7ed', color: '#ea580c', border: 'none', 
                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600',
                fontSize: '0.95rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffedd5'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff7ed'}
            >
              <Users data-element-name="רכיב_page_4" size={18} />
            </button>

            <button data-element-name="כפתור_page_5" data-agy-id="[id]_page_button_4" 
              onClick={() => setActiveTab('payments')}
              title={`מעבר לתשלום (₪${totalRequired - totalPaid})`}
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.65rem 1rem', background: '#f0fdf4', color: '#16a34a', border: 'none', 
                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600',
                fontSize: '0.95rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
            >
              <CreditCard data-element-name="רכיב_page_6" size={18} />
            </button>

            <div style={{ position: 'relative' }}>
              <button data-element-name="כפתור_page_7" data-agy-id="[id]_page_button_print" 
                onClick={handlePrintOrder}
                title="הדפסת הזמנה"
                style={{ 
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  padding: '0.65rem 1rem', background: '#f3e8ff', color: '#7e22ce', border: 'none', 
                  borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600',
                  fontSize: '0.95rem'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e9d5ff'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f3e8ff'}
              >
                <Printer data-element-name="רכיב_page_8" size={18} />
              </button>
              {showPrintMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem', background: 'white', border: 'none', borderRadius: '10px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05)', zIndex: 1050, minWidth: '160px', overflow: 'hidden', padding: '0.3rem 0' }}>
                  <div data-element-name="לחיץ_page_9" 
                    onClick={() => { setShowPrintMenu(false); window.open(`/print/order?orderId=${order.orderId}&type=order`, '_blank'); }}
                    style={{ padding: '0.7rem 1rem', cursor: 'pointer', fontWeight: '600', color: '#475569', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <FileText data-element-name="רכיב_page_10" size={16} /> הזמנה
                  </div>
                  <div data-element-name="לחיץ_page_11" 
                    onClick={() => { setShowPrintMenu(false); window.open(`/print/order?orderId=${order.orderId}&type=rental`, '_blank'); }}
                    style={{ padding: '0.7rem 1rem', cursor: 'pointer', fontWeight: '600', color: '#475569', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <ClipboardList data-element-name="רכיב_page_12" size={16} /> השכרה
                  </div>
                  <div data-element-name="לחיץ_page_13" 
                    onClick={() => handleSendEmail('order')}
                    style={{ padding: '0.7rem 1rem', cursor: 'pointer', fontWeight: '600', color: '#475569', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Mail data-element-name="רכיב_page_14" size={16} /> מייל הזמנה
                  </div>
                  <div data-element-name="לחיץ_page_15" 
                    onClick={() => handleSendEmail('rental')}
                    style={{ padding: '0.7rem 1rem', cursor: 'pointer', fontWeight: '600', color: '#475569', transition: 'background-color 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.9rem' }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Mail data-element-name="רכיב_page_16" size={16} /> מייל השכרה
                  </div>
                </div>
              )}
            </div>

            <button data-element-name="כפתור_page_17" data-agy-id="[id]_page_button_5" 
              onClick={handleExit}
              title="חזרה"
              style={{ 
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                padding: '0.65rem 1rem', background: '#f1f5f9', color: '#475569', border: 'none', 
                borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s ease', fontWeight: '600',
                fontSize: '0.95rem'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            >
              <ArrowRight data-element-name="רכיב_page_18" size={18} />
              חזור
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ position: 'relative', background: 'rgba(241, 245, 249, 0.4)', borderTop: '1px solid #e2e8f0', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px', overflow: 'hidden' }}>
          <div style={{ display: 'flex', padding: '0 1rem' }}>
            {tabs.map((tab, idx) => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button data-element-name="כפתור_page_19" data-agy-id="[id]_page_button_6"
                  key={tab.id}
                  onClick={() => {
                    isManualRef.current = true;
                    setActiveTab(tab.id);
                    const el = document.getElementById(tab.id);
                    if (el) {
                      const y = el.getBoundingClientRect().top + window.scrollY - 150; // offset for sticky header
                      window.scrollTo({ top: y, behavior: 'smooth' });
                    }
                    setTimeout(() => { isManualRef.current = false; }, 1000); // re-enable observer
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '1rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? tab.color : '#64748b',
                    transition: 'color 0.3s ease',
                    position: 'relative'
                  }}
                >
                  <TabIcon data-element-name="רכיב_page_20" size={18} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* Animated Indicator Line */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: `${(activeTabIndex * 100) / tabs.length}%`,
            width: `${100 / tabs.length}%`,
            height: '4px',
            backgroundColor: activeTabDetails.color,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            borderRadius: '4px 4px 0 0'
          }} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Main Content Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Protected Section (Locked if past event) */}
          <div style={{ position: 'relative' }}>
            {isLocked && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.4)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', backdropFilter: 'blur(2px)', borderRadius: '16px' }}>
                <button data-element-name="כפתור_page_21" data-agy-id="[id]_page_button_7" 
                  onClick={handleUnlock}
                  style={{ position: 'sticky', top: '150px', marginTop: '2rem', padding: '1rem 2.5rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)' }}
                >
                  🔒 הזמנה נעולה - לחץ לשחרור בעזרת סיסמת מנהל
                </button>
              </div>
            )}
            <div className="animate-fade-in" style={{ opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              <div id="details">
                <OrderGeneralDetails data-element-name="רכיב_page_22" order={order} items={items} onOrderChange={setOrder} onSaveRequest={handleSave} />
              </div>

              <div id="items">
                <OrderItemsManager data-element-name="רכיב_page_23" 
                  orderId={order.orderId}
                  order={order}
                  items={items} 
                  onItemsChange={setItems} 
                  onOrderUpdated={handleOrderUpdate}
                  inventoryCache={inventoryCache}
                />
              </div>

              <div id="rentals">
                <OrderRentalsManager data-element-name="רכיב_page_24" 
                  items={items} 
                  onItemsChange={setItems}
                  order={order}
                  totalRequired={totalRequired}
                  totalPaid={totalPaid}
                />
              </div>

              <div id="payments">
                <OrderPaymentsManager data-element-name="רכיב_page_25" 
                  orderId={order.orderId}
                  items={items}
                  order={order}
                  obligations={obligations} 
                  payments={payments} 
                  refunds={refunds}
                  onObligationsChange={setObligations} 
                  onPaymentsChange={setPayments} 
                  onRefundsChange={setRefunds}
                  totalRequired={totalRequired} 
                  totalPaid={totalPaid} 
                  customer={order.customer}
                  onOrderUpdated={handleOrderUpdate}
                />
              </div>

              <div id="history">
                <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
                  <HistoryViewer data-element-name="רכיב_page_26" entityType="Order" entityId={order.orderId} />
                </div>
              </div>

            </div>
          </div>
        </div>

      </div>

      <ActiveEmployeesModal data-element-name="רכיב_page_27" 
        orderId={order.orderId}
        isOpen={showEmployeesModal}
        onClose={() => setShowEmployeesModal(false)}
      />

      {/* Regulations Modal */}
      {showRegulationsModal && typeof document !== 'undefined' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="animate-slide-in" style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            <h2 style={{ color: 'var(--primary-color)', marginTop: 0, marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>חתימה על תקנון</h2>
            <p style={{ fontSize: '1.1rem', marginBottom: '2rem', color: 'var(--text-main)' }}>האם הלקוח חתם על התקנון?</p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button data-element-name="כפתור_page_28" 
                onClick={() => {
                  const updatedOrder = { ...order, hasSignedRegulations: true };
                  setOrder(updatedOrder);
                  handleSave(updatedOrder);
                  setShowRegulationsModal(false);
                  setShowPrintMenu(true);
                }}
                className="btn btn-primary"
                style={{ padding: '0.8rem 2rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}
              >
                כן, חתם
              </button>
              <button data-element-name="כפתור_page_29" 
                onClick={() => setShowRegulationsModal(false)}
                className="btn btn-outline"
                style={{ padding: '0.8rem 2rem', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold' }}
              >
                לא (ביטול)
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Email Prompt Modal */}
      {showEmailPrompt && typeof document !== 'undefined' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }}>
          <div className="animate-slide-in" style={{ background: 'white', padding: '2.5rem', borderRadius: '20px', width: '100%', maxWidth: '420px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)', border: '1px solid #e2e8f0', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', background: '#eff6ff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Mail data-element-name="רכיב_page_30" size={30} color="#3b82f6" />
            </div>
            <h2 style={{ color: '#1e293b', marginTop: 0, marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: '800' }}>כתובת מייל חסרה</h2>
            <p style={{ fontSize: '1rem', marginBottom: '2rem', color: '#64748b', lineHeight: '1.5' }}>
              ללקוח זה לא מעודכנת כתובת מייל במערכת. אנא הזן כתובת מייל עדכנית לשליחת הדוח (תישמר אוטומטית בכרטיס הלקוח).
            </p>
            <input data-element-name="שדה_page_31" 
              type="email" 
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@gmail.com"
              dir="ltr"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEmailSubmit();
              }}
              style={{ width: '100%', padding: '0.8rem 1rem', fontSize: '1.1rem', borderRadius: '10px', border: '2px solid #cbd5e1', marginBottom: '1.5rem', textAlign: 'left', outline: 'none', transition: 'border-color 0.2s' }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button data-element-name="כפתור_page_32" 
                onClick={handleEmailSubmit}
                style={{ flex: 1, padding: '0.8rem 1.5rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', background: '#3b82f6', color: 'white', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s', boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)' }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#3b82f6'}
              >
                שמור ושלח
              </button>
              <button data-element-name="כפתור_page_33" 
                onClick={() => setShowEmailPrompt(false)}
                style={{ flex: 1, padding: '0.8rem 1.5rem', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', background: '#f1f5f9', color: '#475569', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseOver={(e) => e.target.style.backgroundColor = '#e2e8f0'}
                onMouseOut={(e) => e.target.style.backgroundColor = '#f1f5f9'}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
