'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import HebrewDatePicker from '../HebrewDatePicker';
import CustomerSelector from '../CustomerSelector';

export default function OrderGeneralDetails({ order, onOrderChange }) {
  
  const handleChange = (field, value) => {
    onOrderChange({ ...order, [field]: value });
  };

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone1: '', email: '', city: '' });

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
         handleChange('customerId', saved.id);
         handleChange('customer', saved);
         setIsEditingCustomer(false);
      } else {
         alert('שגיאה בשמירת לקוח');
      }
    } catch (e) {
      alert('שגיאה בשמירת לקוח');
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.8rem',
    borderRadius: '8px',
    border: '1px solid #e0e0e0',
    backgroundColor: '#fbfbfb',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.4rem',
    fontWeight: '600',
    color: '#444',
    fontSize: '0.95rem'
  };

  const groupStyle = {
    marginBottom: '1rem'
  };

  // Helper to format date for input type="date"
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    return isNaN(d) ? '' : d.toISOString().split('T')[0];
  };

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: 'var(--shadow-sm)' }}>
      <h2 style={{ borderBottom: '2px solid #eee', paddingBottom: '0.5rem', marginBottom: '1.5rem', color: 'var(--secondary-color)' }}>
        פרטים כלליים
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        
        {/* Customer Information */}
        <div style={{ gridColumn: 'span 2', padding: '1rem', background: '#f5f7fa', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: '600', color: '#444', fontSize: '1.1rem' }}>פרטי לקוח</span>
            <div style={{ display: 'flex', gap: '1rem' }}>
              {order.customer?.id && (
                <Link href={`/customers/${order.customer.id}`} target="_blank" style={{ fontSize: '0.95rem', color: 'var(--primary-color)', textDecoration: 'none', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc' }}>
                  <span>✏️</span> מעבר לכרטיס לקוח
                </Link>
              )}
              <button type="button" onClick={() => setIsEditingCustomer(!isEditingCustomer)} style={{ fontSize: '0.95rem', background: 'white', padding: '0.4rem 0.8rem', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', fontWeight: 'bold' }}>
                🔄 החלף לקוח
              </button>
            </div>
          </div>
          
          {!isEditingCustomer ? (
            <div style={{ display: 'flex', gap: '2rem' }}>
              <div>
                <span style={labelStyle}>שם:</span>
                <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                  {order.customer ? `${order.customer.firstName} ${order.customer.lastName}` : 'לא ידוע'}
                </div>
              </div>
              {order.customer?.phone1 && (
                <div>
                  <span style={labelStyle}>טלפון 1:</span>
                  <div style={{ direction: 'ltr', textAlign: 'right' }}>{order.customer.phone1}</div>
                </div>
              )}
              {order.customer?.phone2 && (
                <div>
                  <span style={labelStyle}>טלפון 2:</span>
                  <div style={{ direction: 'ltr', textAlign: 'right' }}>{order.customer.phone2}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '8px', border: '1px solid #ddd' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button type="button" onClick={() => setCustomerMode('existing')} style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: customerMode === 'existing' ? 'var(--primary-color)' : 'white', color: customerMode === 'existing' ? 'white' : '#333', fontWeight: 'bold', cursor: 'pointer' }}>בחר לקוח קיים</button>
                <button type="button" onClick={() => setCustomerMode('new')} style={{ flex: 1, padding: '0.8rem', borderRadius: '6px', border: '1px solid #ccc', background: customerMode === 'new' ? 'var(--primary-color)' : 'white', color: customerMode === 'new' ? 'white' : '#333', fontWeight: 'bold', cursor: 'pointer' }}>צור לקוח חדש</button>
              </div>
              
              {customerMode === 'existing' ? (
                <div>
                  <label style={labelStyle}>חיפוש לקוח:</label>
                  <CustomerSelector 
                    value={order.customer}
                    onChange={(c) => {
                       handleChange('customerId', c.id);
                       handleChange('customer', c);
                       setIsEditingCustomer(false);
                    }}
                    placeholder="חפש לקוח לפי שם, טלפון, עיר..."
                  />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div><label style={labelStyle}>שם פרטי</label><input type="text" style={inputStyle} value={newCustomer.firstName} onChange={e => setNewCustomer({...newCustomer, firstName: e.target.value})} /></div>
                  <div><label style={labelStyle}>שם משפחה</label><input type="text" style={inputStyle} value={newCustomer.lastName} onChange={e => setNewCustomer({...newCustomer, lastName: e.target.value})} /></div>
                  <div><label style={labelStyle}>טלפון</label><input type="text" style={inputStyle} value={newCustomer.phone1} onChange={e => setNewCustomer({...newCustomer, phone1: e.target.value})} /></div>
                  <div><label style={labelStyle}>עיר</label><input type="text" style={inputStyle} value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} /></div>
                  <div style={{ gridColumn: 'span 2' }}>
                     <button type="button" onClick={handleSaveNewCustomer} style={{ width: '100%', padding: '0.8rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>שמור ובחר לקוח</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dates */}
        <div style={groupStyle}>
          <label style={labelStyle}>תאריך אירוע:</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '150px' }}>
              <HebrewDatePicker 
                value={order.eventDate} 
                onChange={(date) => handleChange('eventDate', date)} 
              />
            </div>
          </div>
        </div>

        {/* Custom Duration / Abroad */}
        <div style={{ gridColumn: 'span 2', paddingTop: '1rem' }}>
          <div style={{ ...groupStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input 
              type="checkbox" 
              id="isAbroad"
              checked={order.isAbroad ?? false} 
              onChange={(e) => handleChange('isAbroad', e.target.checked)}
              style={{ transform: 'scale(1.5)', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
            />
            <label htmlFor="isAbroad" style={{ fontWeight: '600', color: '#444', cursor: 'pointer' }}>אירוע חו"ל (תפוסה מותאמת אישית)</label>
          </div>

          {order.isAbroad && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', border: '1px solid #ddd', padding: '1.5rem', borderRadius: '8px', marginTop: '0.5rem', background: '#fcfcfc' }}>
              <div>
                <label style={labelStyle}>מתאריך (לקיחה):</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <HebrewDatePicker 
                      value={order.fromDate} 
                      onChange={(date) => handleChange('fromDate', date)} 
                    />
                  </div>
                </div>
              </div>
              <div>
                <label style={labelStyle}>עד תאריך (החזרה):</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <HebrewDatePicker 
                      value={order.toDate || order.returnDate} 
                      onChange={(date) => handleChange('toDate', date)} 
                    />
                  </div>
                </div>
              </div>
              {order.eventDate && order.fromDate && order.toDate && 
               (new Date(order.eventDate) < new Date(order.fromDate) || new Date(order.eventDate) > new Date(order.toDate)) && (
                <div style={{ gridColumn: 'span 2', color: '#d32f2f', background: '#ffebee', padding: '10px', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.9rem', border: '1px solid #ffcdd2' }}>
                  ⚠️ שימו לב: תאריך האירוע חייב להיות בין תאריך הלקיחה לתאריך החזרה!
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>הערות להזמנה:</label>
          <textarea 
            value={order.notes || ''} 
            onChange={(e) => handleChange('notes', e.target.value)}
            style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
            placeholder="הערות כלליות לגבי ההזמנה..."
          />
        </div>

      </div>
    </div>
  );
}
