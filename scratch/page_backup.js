'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import HebrewDatePicker from '../../../components/HebrewDatePicker';

export default function NewOrderPage() {
  const router = useRouter();
  
  const [order, setOrder] = useState({
    customerId: '',
    eventDate: '',
    returnDate: '',
    isWeekdayEvent: true,
    notes: '',
    items: [],
  });
  
  const [customers, setCustomers] = useState([]);
  const [dressModels, setDressModels] = useState([]);
  
  const [newItem, setNewItem] = useState({
    dressModelId: '',
    sizeText: '',
    sampleItemId: '',
    quantity: 1,
    basePrice: 0,
    finalPrice: 0,
    repairs: ''
  });
  
  const [availableSizes, setAvailableSizes] = useState([]);
  const [loadingSizes, setLoadingSizes] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch customers
    fetch('/api/customers?limit=1000')
      .then(res => res.json())
      .then(data => setCustomers(data.data || []));
      
    // Fetch dress models
    fetch('/api/dresses?limit=1000')
      .then(res => res.json())
      .then(data => setDressModels(Array.isArray(data) ? data : (data.data || [])));
  }, []);

  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '', lastName: '', phone1: '', email: '', city: ''
  });

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone1) {
       alert('יש למלא שם פרטי, משפחה וטלפון');
       return;
    }
    try {
      const res = await fetch('/api/customers', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(newCustomer)
      });
      if (res.ok) {
         const saved = await res.json();
         setCustomers(prev => [saved, ...prev]);
         setOrder(prev => ({ ...prev, customerId: saved.id }));
         setShowNewCustomerModal(false);
         setNewCustomer({ firstName: '', lastName: '', phone1: '', email: '', city: '' });
      } else {
         alert('שגיאה בשמירת לקוח');
      }
    } catch (e) {
      alert('שגיאה בשמירת לקוח');
    }
  };

  // When eventDate or dressModelId changes, fetch available sizes
  useEffect(() => {
    if (order.eventDate && newItem.dressModelId) {
      setLoadingSizes(true);
      fetch(`/api/orders/availability?dressModelId=${newItem.dressModelId}&eventDate=${order.eventDate}`)
        .then(res => res.json())
        .then(data => {
          setAvailableSizes(data || []);
          setNewItem(prev => ({ ...prev, sizeText: '', sampleItemId: '', basePrice: 0, finalPrice: 0 }));
          setLoadingSizes(false);
        })
        .catch(() => setLoadingSizes(false));
    } else {
      setAvailableSizes([]);
    }
  }, [order.eventDate, newItem.dressModelId]);

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
      alert('יש לבחור מידה זמינה');
      return;
    }
    
    setOrder(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem }]
    }));
    
    // Reset form
    setNewItem({
      dressModelId: '',
      sizeText: '',
      sampleItemId: '',
      quantity: 1,
      basePrice: 0,
      finalPrice: 0,
      repairs: ''
    });
  };

  const removeItem = (index) => {
    setOrder(prev => {
      const updated = [...prev.items];
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
  };

  const totalAmount = order.items.reduce((sum, item) => sum + parseFloat(item.finalPrice || 0), 0);

  const saveOrder = async () => {
    if (!order.customerId) return alert('יש לבחור לקוח');
    if (!order.eventDate) return alert('יש לבחור תאריך אירוע');
    if (order.items.length === 0) return alert('יש לבחור לפחות פריט אחד');

    setSaving(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...order,
          totalAmount
        })
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

  return (
    <>
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto', direction: 'rtl' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary-color)', fontSize: '2.5rem' }}>כרטיס הזמנה חדשה</h1>
        <Link href="/orders" style={{ textDecoration: 'none', color: 'var(--text-muted)' }}>חזרה לרשימה</Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Right Side - General Details */}
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>פרטי אירוע</h2>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>לקוח *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <select 
                name="customerId" 
                value={order.customerId} 
                onChange={handleOrderChange}
                style={{ flex: 1, padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}
              >
                <option value="">בחר לקוח...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.firstName} {c.lastName} ({c.phone1})</option>
                ))}
              </select>
              <button 
                type="button" 
                onClick={() => setShowNewCustomerModal(true)}
                style={{ padding: '0 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                + לקוח חדש
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תאריך אירוע *</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="date" 
                name="eventDate" 
                value={order.eventDate} 
                onChange={handleOrderChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', flex: 1 }}
              />
              <div style={{ flex: 1 }}>
                <HebrewDatePicker 
                  value={order.eventDate} 
                  onChange={(date) => handleOrderChange({ target: { name: 'eventDate', value: date }})} 
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>תאריך החזרה משוער</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="date" 
                name="returnDate" 
                value={order.returnDate} 
                onChange={handleOrderChange}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', flex: 1 }}
              />
              <div style={{ flex: 1 }}>
                <HebrewDatePicker 
                  value={order.returnDate} 
                  onChange={(date) => handleOrderChange({ target: { name: 'returnDate', value: date }})} 
                />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
             <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
               <input 
                 type="checkbox" 
                 name="isWeekdayEvent" 
                 checked={order.isWeekdayEvent} 
                 onChange={handleOrderChange} 
                 style={{ width: '20px', height: '20px' }} 
               />
               אירוע חול (לא חג)
             </label>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>הערות להזמנה</label>
            <textarea 
              name="notes" 
              value={order.notes} 
              onChange={handleOrderChange}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', minHeight: '80px' }}
            />
          </div>
        </div>

        {/* Left Side - Items and Subform */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>בחירת פריטים</h2>
            
            {!order.eventDate ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#e53935', background: '#ffebee', borderRadius: '8px' }}>
                יש לבחור תאריך אירוע לפני בחירת פריטים כדי לוודא זמינות מלאי מדויקת!
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', alignItems: 'end' }}>
                
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>דגם שמלה</label>
                  <select 
                    name="dressModelId" 
                    value={newItem.dressModelId} 
                    onChange={handleNewItemChange}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}
                  >
                    <option value="">בחר דגם...</option>
                    {dressModels.map(m => (
                      <option key={m.id} value={m.id}>{m.name} - קטגוריה: {m.priceCategory || 'כללי'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                    מידה {loadingSizes && <span style={{fontSize:'0.8rem', color:'gray'}}>(טוען מלאי...)</span>}
                  </label>
                  <select 
                    name="sizeText" 
                    value={newItem.sizeText} 
                    onChange={handleNewItemChange}
                    disabled={!newItem.dressModelId || availableSizes.length === 0}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}
                  >
                    <option value="">בחר מידה פנויה...</option>
                    {availableSizes.map(s => (
                      <option key={s.sizeText} value={s.sizeText}>
                        מידה: {s.sizeText} (פנויות: {s.availableQuantity} מתוך {s.totalInStock})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>צוואר</label>
                    <input 
                      type="checkbox" 
                      name="neckAlteration"
                      checked={newItem.neckAlteration || false} 
                      onChange={(e) => handleNewItemChange({ target: { name: 'neckAlteration', value: e.target.checked }})}
                      style={{ transform: 'scale(1.5)', margin: '0.5rem' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', textAlign: 'center' }}>שרוול</label>
                    <input 
                      type="checkbox" 
                      name="sleeveAlteration"
                      checked={newItem.sleeveAlteration || false} 
                      onChange={(e) => handleNewItemChange({ target: { name: 'sleeveAlteration', value: e.target.checked }})}
                      style={{ transform: 'scale(1.5)', margin: '0.5rem' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>תיקון אורך</label>
                    <input 
                      type="text" 
                      name="lengthAlteration"
                      value={newItem.lengthAlteration || ''} 
                      onChange={handleNewItemChange}
                      placeholder="-"
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem' }}>פירוט תיקונים נוספים</label>
                  <input 
                    type="text" 
                    name="repairs" 
                    value={newItem.repairs} 
                    onChange={handleNewItemChange}
                    placeholder="הערות..."
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '1rem', gridColumn: '1 / -1' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem' }}>מחיר סופי (₪)</label>
                    <input 
                      type="number" 
                      name="finalPrice" 
                      value={newItem.finalPrice} 
                      onChange={handleNewItemChange}
                      style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc', fontWeight: 'bold' }}
                    />
                  </div>
                  <button 
                    type="button" 
                    onClick={addItemToOrder}
                    style={{ padding: '0.75rem 1.5rem', background: '#2e7d32', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', height: '48px' }}
                  >
                    הוסף להזמנה
                  </button>
                </div>

              </div>
            )}
          </div>

          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)', flex: 1 }}>
            <h2 style={{ marginBottom: '1.5rem', color: 'var(--secondary-color)', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>פירוט ההזמנה</h2>
            
            {order.items.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>לא נבחרו פריטים.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #ddd', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '1rem' }}>דגם</th>
                    <th style={{ padding: '1rem' }}>מידה</th>
                    <th style={{ padding: '1rem' }}>תיקונים</th>
                    <th style={{ padding: '1rem' }}>מחיר</th>
                    <th style={{ padding: '1rem' }}>הסר</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item, idx) => {
                    const dressName = dressModels.find(m => m.id === parseInt(item.dressModelId))?.name || 'דגם לא ידוע';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td style={{ padding: '1rem' }}>{dressName}</td>
                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>{item.sizeText}</td>
                        <td style={{ padding: '1rem' }}>{item.repairs}</td>
                        <td style={{ padding: '1rem', color: '#2e7d32', fontWeight: 'bold' }}>₪{item.finalPrice}</td>
                        <td style={{ padding: '1rem' }}>
                          <button onClick={() => removeItem(idx)} style={{ background: '#e53935', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>
                            X
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan="3" style={{ padding: '1rem', fontSize: '1.2rem', fontWeight: 'bold' }}>סה"כ לתשלום:</td>
                    <td colSpan="2" style={{ padding: '1rem', fontSize: '1.5rem', fontWeight: 'bold', color: '#2e7d32' }}>₪{totalAmount}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>

          <button 
            onClick={saveOrder}
            disabled={saving || order.items.length === 0}
            style={{ width: '100%', padding: '1.5rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1.5rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: 'var(--shadow-md)' }}
          >
            {saving ? 'שומר הזמנה...' : 'שמור כרטיס הזמנה'}
          </button>
        </div>
      </div>
    </main>

    {showNewCustomerModal && (
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl' }}>
        <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px' }}>
          <h2 style={{ marginBottom: '1.5rem', color: 'var(--primary-color)' }}>לקוח חדש</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>שם פרטי *</label>
              <input type="text" value={newCustomer.firstName} onChange={e => setNewCustomer(prev => ({...prev, firstName: e.target.value}))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>שם משפחה *</label>
              <input type="text" value={newCustomer.lastName} onChange={e => setNewCustomer(prev => ({...prev, lastName: e.target.value}))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>טלפון *</label>
              <input type="text" value={newCustomer.phone1} onChange={e => setNewCustomer(prev => ({...prev, phone1: e.target.value}))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>אימייל</label>
              <input type="email" value={newCustomer.email} onChange={e => setNewCustomer(prev => ({...prev, email: e.target.value}))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
            </div>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>עיר</label>
            <input type="text" value={newCustomer.city} onChange={e => setNewCustomer(prev => ({...prev, city: e.target.value}))} style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #ccc' }} />
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button onClick={() => setShowNewCustomerModal(false)} style={{ padding: '0.75rem 1.5rem', background: '#f1f3f5', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>ביטול</button>
            <button onClick={handleSaveNewCustomer} style={{ padding: '0.75rem 1.5rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>שמור לקוח</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

