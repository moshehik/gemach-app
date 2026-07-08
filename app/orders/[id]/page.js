'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, CreditCard, ArrowRight } from 'lucide-react';
import OrderGeneralDetails from '../../../components/orders/OrderGeneralDetails';
import OrderItemsManager from '../../../components/orders/OrderItemsManager';
import OrderPaymentsManager from '../../../components/orders/OrderPaymentsManager';
import { calculateOrderStatus, getStatusColor } from '../../../lib/orderStatus';
import HistoryViewer from '../../../components/HistoryViewer';
import { getHebrewDateString } from '../../../lib/hebrewDate';

export default function OrderDetailsPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

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
        setItems(data.items || []);
        setObligations(data.obligations || []);
        setPayments(data.payments || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  // Save changes
  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    
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
    // We only need to validate if the order is active, or if we are actively restoring items.
    // If order.isDeleted is true, we probably shouldn't block saving UNLESS we are toggling it to false (which currently isn't done here directly, but just in case)
    try {
      const validateRes = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items, // pass the current state of items
          eventDate: order.eventDate,
          isWeekdayEvent: order.isWeekdayEvent,
          isAbroad: order.isAbroad,
          fromDate: order.fromDate,
          toDate: order.toDate,
          orderId: order.orderId // Ignore this order's existing bookings
        })
      });
      
      const validateData = await validateRes.json();
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
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...order,
          items: items,
          obligations: obligations,
          payments: payments,
          totalAmount: items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0)
        })
      });

      if (!res.ok) throw new Error('Failed to save');
      
      const updatedOrder = await res.json();
      setOrder(updatedOrder);
      setItems(updatedOrder.items || []);
      setObligations(updatedOrder.obligations || []);
      setPayments(updatedOrder.payments || []);
      
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
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <h2 style={{ marginTop: '1rem', color: '#555' }}>טוען נתוני הזמנה...</h2>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
  
  if (!order) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', color: '#888' }}>הזמנה לא נמצאה.</div>;

  const totalPayable = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);

  // Replicate Access DB logic for "שולם"
  const totalRequired = obligations.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0);
  const totalPaid = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
  const isPaid = obligations.length > 0 && totalRequired === totalPaid;
  const statusDisplay = isPaid ? 'שולם' : (totalPaid > 0 ? 'חלקי' : 'פתוח');

  const createdDate = order.orderDate || order.createdAt;

  const handleExit = async () => {
    if (totalRequired - totalPaid > 0) {
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
      } catch (err) {
        alert('שגיאה באימות קוד עובד/מנהל.');
        return;
      }
    }
    router.back();
  };

  const isPastEvent = order?.eventDate && new Date(order.eventDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
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

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', direction: 'rtl', fontFamily: 'var(--font-primary, system-ui)' }}>
      
      {/* Header Sticky Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: 'rgba(255, 255, 255, 0.9)', 
        backdropFilter: 'blur(10px)',
        padding: '1.5rem 2rem', 
        borderRadius: '16px', 
        boxShadow: '0 4px 20px rgba(0,0,0,0.05)', 
        marginBottom: '2rem',
        position: 'sticky',
        top: '1rem',
        zIndex: 100
      }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            כרטיס הזמנה #{order.orderId}
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ 
                fontSize: '1rem', padding: '0.4rem 1rem', borderRadius: '20px', 
                background: getStatusColor(calculateOrderStatus(order)).bg,
                color: getStatusColor(calculateOrderStatus(order)).text
              }}>
                {calculateOrderStatus(order)}
              </span>
              <span style={{ 
                fontSize: '1rem', padding: '0.4rem 1rem', borderRadius: '20px', 
                background: isPaid ? '#c8e6c9' : statusDisplay === 'חלקי' ? '#fff9c4' : '#ffebee',
                color: isPaid ? '#2e7d32' : statusDisplay === 'חלקי' ? '#f57f17' : '#c62828'
              }}>
                {statusDisplay}
              </span>
            </div>
          </h1>
          <div style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.9rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span>לקוח: <strong style={{ color: '#333' }}>{order.customer ? `${order.customer.firstName || ''} ${order.customer.lastName || ''}`.trim() : 'לא נבחר'}</strong></span>
            {order.customer?.phone1 && <span>טלפון: <span style={{ direction: 'ltr', display: 'inline-block' }}>{order.customer.phone1}</span></span>}
            <span>תאריך אירוע: <strong style={{ color: '#333' }}>{order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'} {order.eventDate ? `(${getHebrewDateString(order.eventDate)})` : ''}</strong></span>
            <span>נוצר ב: {createdDate ? new Date(createdDate).toLocaleDateString('he-IL') : 'לא ידוע'} {createdDate ? `(${getHebrewDateString(createdDate)})` : ''}</span>
            <span style={{ borderRight: '1px solid #ccc', paddingRight: '1rem' }}>חובת תשלום: ₪{totalRequired} | שולם: ₪{totalPaid}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {saveMessage && <span style={{ color: saveMessage.includes('שגיאה') ? '#d32f2f' : '#388e3c', fontWeight: 'bold' }}>{saveMessage}</span>}
          
          <button 
            onClick={handleSave} 
            disabled={saving || isLocked}
            title={isLocked ? "הזמנה נעולה" : "שמור שינויים"}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.8rem', 
              background: 'var(--primary-color, #1976d2)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: (saving || isLocked) ? 'not-allowed' : 'pointer',
              opacity: (saving || isLocked) ? 0.7 : 1,
              boxShadow: '0 4px 6px rgba(25, 118, 210, 0.2)',
              transition: 'all 0.2s'
            }}
          >
            {saving ? <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Save size={24} />}
          </button>
          
          <button 
            onClick={() => document.getElementById('payments-section')?.scrollIntoView({ behavior: 'smooth' })}
            title={`מעבר לתשלום (₪${totalRequired - totalPaid})`}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.8rem', background: '#e8f5e9', color: '#2e7d32', border: '1px solid #c8e6c9', 
              borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            <CreditCard size={24} />
          </button>

          <button 
            onClick={handleExit}
            title="חזרה"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0.8rem', background: '#f5f5f5', color: '#333', border: '1px solid #ddd', 
              borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' 
            }}
          >
            <ArrowRight size={24} />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Protected Section (Locked if past event) */}
        <div style={{ position: 'relative' }}>
          {isLocked && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.4)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', backdropFilter: 'blur(1px)', borderRadius: '12px' }}>
              <button 
                onClick={handleUnlock}
                style={{ padding: '1rem 2rem', background: '#d32f2f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}
              >
                🔒 הזמנה נעולה - לחץ לשחרור בעזרת סיסמת מנהל
              </button>
            </div>
          )}
          <div style={{ opacity: isLocked ? 0.7 : 1, pointerEvents: isLocked ? 'none' : 'auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <OrderGeneralDetails order={order} onOrderChange={setOrder} />

            <OrderItemsManager 
              orderId={order.orderId}
              order={order}
              items={items} 
              onItemsChange={setItems} 
              onOrderUpdated={handleOrderUpdate}
            />
          </div>
        </div>

        {/* Payments and Obligations Manager Component */}
        <div id="payments-section">
          <OrderPaymentsManager 
            orderId={order.orderId}
            obligations={obligations} 
            payments={payments} 
            onObligationsChange={setObligations} 
            onPaymentsChange={setPayments} 
            totalRequired={totalRequired} 
            totalPaid={totalPaid} 
            customer={order.customer}
          />
        </div>

        {/* History Viewer */}
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
           <HistoryViewer entityType="Order" entityId={order.orderId} />
        </div>

      </div>
    </main>
  );
}
