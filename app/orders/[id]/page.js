'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, CreditCard, ArrowRight, Users } from 'lucide-react';
import OrderGeneralDetails from '../../../components/orders/OrderGeneralDetails';
import ActiveEmployeesModal from '../../../components/orders/ActiveEmployeesModal';
import OrderItemsManager from '../../../components/orders/OrderItemsManager';
import OrderRentalsManager from '../../../components/orders/OrderRentalsManager';
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
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);

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

  const totalRequired = obligations.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0);
  const totalPaid = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);

  // Prevent closing window if there is a debt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (totalRequired - totalPaid > 0) {
        e.preventDefault();
        e.returnValue = 'קיימת יתרת חוב בהזמנה! אנא דאג לתשלום או אישור מנהל.';
        return 'קיימת יתרת חוב בהזמנה! אנא דאג לתשלום או אישור מנהל.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [totalRequired, totalPaid]);

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
    try {
      const validateRes = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items, 
          eventDate: order.eventDate,
          isAbroad: order.isAbroad,
          fromDate: order.fromDate,
          toDate: order.toDate,
          orderId: order.orderId 
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

    let debtApprovedBy = null;
    // CHECK DEBT AND REQUIRE APPROVAL TO SAVE
    if (totalRequired - totalPaid > 0) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. שמירת השינויים דורשת הרשאת עובד או מנהל. אנא בחר משתמש והזן סיסמה:", 'עובד');
      if (!authResult || !authResult.pin) {
        setSaving(false);
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
          ...order,
          items: items,
          obligations: obligations,
          payments: payments,
          debtApprovedBy: debtApprovedBy,
          totalAmount: items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0)
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', cursor: 'default', userSelect: 'none' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', pointerEvents: 'none' }} />
      <h2 style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>טוען נתוני הזמנה...</h2>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
  
  if (!order) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', color: 'var(--text-muted)' }}>הזמנה לא נמצאה.</div>;

  const totalPayable = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);

  // Replicate Access DB logic for "שולם"
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
    <main style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto', direction: 'rtl', fontFamily: 'var(--font-primary, system-ui)' }}>
      
      {/* Header Sticky Bar */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        background: (totalRequired - totalPaid > 0) ? 'rgba(254, 226, 226, 0.95)' : 'rgba(255, 255, 255, 0.85)', 
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '1.5rem 2rem', 
        borderRadius: '16px', 
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)', 
        border: '1px solid rgba(255,255,255,0.4)',
        marginBottom: '2rem',
        position: 'sticky',
        top: '1rem',
        zIndex: 100,
        flexWrap: 'wrap',
        gap: '1rem',
        transition: 'background-color 0.3s ease'
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
                background: isPaid ? '#dcfce7' : statusDisplay === 'חלקי' ? '#fef08a' : '#fee2e2',
                color: isPaid ? '#166534' : statusDisplay === 'חלקי' ? '#854d0e' : '#991b1b',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}>
                {statusDisplay}
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
                {order.eventDate ? new Date(order.eventDate).toLocaleDateString('he-IL') : 'לא צוין'} 
                {order.eventDate ? ` (${getHebrewDateString(order.eventDate)})` : ''}
              </strong>
            </div>

            <div style={{ background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ fontWeight: '500' }}>נוצר:</span> 
              <span>{createdDate ? new Date(createdDate).toLocaleDateString('he-IL') : 'לא ידוע'}</span>
            </div>

            <div style={{ background: isPaid ? '#dcfce7' : '#fee2e2', padding: '0.4rem 0.8rem', borderRadius: '8px', color: isPaid ? '#166534' : '#991b1b', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '600' }}>
              <span>חוב: ₪{totalRequired}</span> | <span>שולם: ₪{totalPaid}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
          {saveMessage && <span style={{ color: saveMessage.includes('שגיאה') ? '#ef4444' : '#10b981', fontWeight: 'bold', background: saveMessage.includes('שגיאה') ? '#fee2e2' : '#d1fae5', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>{saveMessage}</span>}
          
          <button 
            onClick={handleSave} 
            disabled={saving || isLocked}
            title={isLocked ? "הזמנה נעולה" : "שמור שינויים"}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.7rem 1.2rem', 
              background: 'linear-gradient(135deg, #2563eb, #3b82f6)', 
              color: 'white', 
              border: 'none', 
              borderRadius: '10px', 
              cursor: (saving || isLocked) ? 'not-allowed' : 'pointer',
              opacity: (saving || isLocked) ? 0.7 : 1,
              fontWeight: '600',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
              transition: 'all 0.2s',
              transform: saving ? 'scale(0.98)' : 'scale(1)'
            }}
          >
            {saving ? <div className="spinner" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /> : <Save size={20} />}
            שמור
          </button>
          
          <button 
            onClick={() => setShowEmployeesModal(true)}
            title="עובדים פעילים"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.7rem 1rem', background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', 
              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '600'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ffedd5'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#fff7ed'}
          >
            <Users size={20} />
          </button>

          <button 
            onClick={() => document.getElementById('payments-section')?.scrollIntoView({ behavior: 'smooth' })}
            title={`מעבר לתשלום (₪${totalRequired - totalPaid})`}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.7rem 1rem', background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', 
              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '600'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dcfce7'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f0fdf4'}
          >
            <CreditCard size={20} />
          </button>

          <button 
            onClick={handleExit}
            title="חזרה"
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              padding: '0.7rem 1rem', background: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', 
              borderRadius: '10px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: '600'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
          >
            <ArrowRight size={20} />
            חזור
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        
        {/* Main Content Area (Left/Right side depending on RTL) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Protected Section (Locked if past event) */}
          <div style={{ position: 'relative' }}>
            {isLocked && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.4)', zIndex: 10, display: 'flex', justifyContent: 'center', alignItems: 'flex-start', backdropFilter: 'blur(2px)', borderRadius: '16px' }}>
                <button 
                  onClick={handleUnlock}
                  style={{ position: 'sticky', top: '150px', marginTop: '2rem', padding: '1rem 2.5rem', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 8px 16px rgba(220, 38, 38, 0.3)' }}
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

              <OrderRentalsManager items={items} />
            </div>
          </div>
        </div>

        {/* Sidebar Area */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
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
          <div style={{ background: 'var(--card-bg)', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
            <HistoryViewer entityType="Order" entityId={order.orderId} />
          </div>
        </div>

      </div>

      <ActiveEmployeesModal 
        orderId={order.orderId}
        isOpen={showEmployeesModal}
        onClose={() => setShowEmployeesModal(false)}
      />
    </main>
  );
}
