'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Edit2, Check } from 'lucide-react';
import HebrewDatePicker from '../HebrewDatePicker';
import CustomerSelector from '../CustomerSelector';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function OrderGeneralDetails({ order, onOrderChange, items = [], onSaveRequest }) {
  
  const handleChange = (field, value) => {
    onOrderChange({ ...order, [field]: value });
  };

  const validateAndChangeDate = async (field, value) => {
    const currentItems = items && items.length > 0 ? items : (order.items || []);
    const activeItems = currentItems.filter(i => !i.isDeleted);
    
    const proposedOrder = {
      ...order,
      [field]: value
    };

    if (activeItems.length === 0) {
      handleChange(field, value);
      if (['isAbroad', 'eventDate', 'fromDate', 'toDate', 'returnDate'].includes(field)) {
        if (onSaveRequest) setTimeout(() => onSaveRequest(proposedOrder), 0);
      }
      return;
    }

    // Skip validation if it's an abroad event but dates aren't fully entered yet
    if (proposedOrder.isAbroad && (!proposedOrder.fromDate || !proposedOrder.toDate)) {
      handleChange(field, value);
      if (['isAbroad', 'eventDate', 'fromDate', 'toDate', 'returnDate'].includes(field)) {
        if (onSaveRequest) setTimeout(() => onSaveRequest(proposedOrder), 0);
      }
      return;
    }

    try {
      const validateRes = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: activeItems,
          eventDate: proposedOrder.eventDate,
          isAbroad: proposedOrder.isAbroad,
          fromDate: proposedOrder.fromDate,
          toDate: proposedOrder.toDate,
          orderId: proposedOrder.orderId
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
      
      handleChange(field, value);
      if (['isAbroad', 'eventDate', 'fromDate', 'toDate', 'returnDate'].includes(field)) {
        if (onSaveRequest) setTimeout(() => onSaveRequest(proposedOrder), 0);
      }
    } catch (err) {
      console.error('Validation fetch error', err);
      alert('שגיאה בבדיקת המלאי מול השרת.');
    }
  };

  const [isExpanded, setIsExpanded] = useState(true);
  const customerName = order?.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') : 'לא נבחר לקוח';
  const eventDateStr = order?.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.eventDate)})` : 'ללא תאריך אירוע';
  const summaryText = `לקוח: ${customerName} | אירוע: ${eventDateStr}`;

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [isEditingOrderDetails, setIsEditingOrderDetails] = useState(!order?.eventDate);
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '' });

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
    border: '1px solid var(--element-border)',
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
    <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
          cursor: 'pointer',
          borderBottom: isExpanded ? '2px solid #f1f5f9' : 'none',
          paddingBottom: isExpanded ? '1rem' : '0',
          marginBottom: isExpanded ? '2rem' : '0'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, color: '#0f172a', fontSize: '1.4rem', fontWeight: '800' }}>
            פרטים כלליים
          </h2>
          {!isExpanded && (
            <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#cbd5e1' }}>|</span> {summaryText}
            </span>
          )}
        </div>
        <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '50%', padding: '0.5rem', transition: 'all 0.2s' }}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'stretch' }}>
          
          {/* Customer Information */}
          <div style={{ flex: '1 1 300px', padding: '1rem 1.5rem', background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 'bold', fontSize: '1.2rem' }}>
                {order.customer ? (order.customer.firstName?.[0] || '') + (order.customer.lastName?.[0] || '') : '?'}
              </div>
              <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '1.2rem' }}>פרטי לקוח</span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              {order.customer?.id && (
                <Link href={`/customers/${order.customer.id}`} target="_blank" style={{ fontSize: '0.9rem', color: '#2563eb', textDecoration: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#eff6ff', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #bfdbfe', transition: 'all 0.2s' }}>
                  <ExternalLink size={16} /> מעבר לכרטיס
                </Link>
              )}
              <button data-agy-id="ordergeneraldetails_button_1" type="button" onClick={() => setIsEditingCustomer(!isEditingCustomer)} style={{ fontSize: '0.9rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <RefreshCw size={16} /> החלף לקוח
              </button>
            </div>
          </div>
          
          {!isEditingCustomer ? (
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{...labelStyle, color: '#64748b'}}>שם:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
                  {order.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') : 'לא ידוע'}
                </div>
              </div>
              {order.customer?.phone1 && (
                <div>
                  <span style={{...labelStyle, color: '#64748b'}}>טלפון 1:</span>
                  <div style={{ fontSize: '1.1rem', direction: 'ltr', textAlign: 'right', color: '#334155', fontWeight: '500' }}>{order.customer.phone1}</div>
                </div>
              )}
              {order.customer?.phone2 && (
                <div>
                  <span style={{...labelStyle, color: '#64748b'}}>טלפון 2:</span>
                  <div style={{ fontSize: '1.1rem', direction: 'ltr', textAlign: 'right', color: '#334155', fontWeight: '500' }}>{order.customer.phone2}</div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                <button data-agy-id="ordergeneraldetails_button_2" type="button" onClick={() => setCustomerMode('existing')} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid', borderColor: customerMode === 'existing' ? '#2563eb' : '#cbd5e1', background: customerMode === 'existing' ? '#eff6ff' : 'white', color: customerMode === 'existing' ? '#1d4ed8' : '#475569', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>בחר לקוח קיים</button>
                <button data-agy-id="ordergeneraldetails_button_3" type="button" onClick={() => setCustomerMode('new')} style={{ flex: 1, padding: '0.8rem', borderRadius: '8px', border: '1px solid', borderColor: customerMode === 'new' ? '#2563eb' : '#cbd5e1', background: customerMode === 'new' ? '#eff6ff' : 'white', color: customerMode === 'new' ? '#1d4ed8' : '#475569', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s' }}>צור לקוח חדש</button>
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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                  <div><label style={labelStyle}>שם פרטי</label><input data-agy-id="ordergeneraldetails_input_4" type="text" style={inputStyle} value={newCustomer.firstName} onChange={e => setNewCustomer({...newCustomer, firstName: e.target.value})} /></div>
                  <div><label style={labelStyle}>שם משפחה</label><input data-agy-id="ordergeneraldetails_input_5" type="text" style={inputStyle} value={newCustomer.lastName} onChange={e => setNewCustomer({...newCustomer, lastName: e.target.value})} /></div>
                  <div><label style={labelStyle}>טלפון</label><input data-agy-id="ordergeneraldetails_input_6" type="text" style={inputStyle} value={newCustomer.phone1} onChange={e => setNewCustomer({...newCustomer, phone1: e.target.value})} /></div>
                  <div><label style={labelStyle}>עיר</label><input data-agy-id="ordergeneraldetails_input_7" type="text" style={inputStyle} value={newCustomer.city} onChange={e => setNewCustomer({...newCustomer, city: e.target.value})} /></div>
                  <div><label style={labelStyle}>רחוב</label><input data-agy-id="ordergeneraldetails_input_new_1" type="text" style={inputStyle} value={newCustomer.street} onChange={e => setNewCustomer({...newCustomer, street: e.target.value})} /></div>
                  <div><label style={labelStyle}>בית</label><input data-agy-id="ordergeneraldetails_input_new_2" type="text" style={inputStyle} value={newCustomer.houseNum} onChange={e => setNewCustomer({...newCustomer, houseNum: e.target.value})} /></div>
                  <div style={{ gridColumn: '1 / -1', marginTop: '0.5rem' }}>
                     <button data-agy-id="ordergeneraldetails_button_8" type="button" onClick={handleSaveNewCustomer} style={{ width: '100%', padding: '0.8rem', background: 'linear-gradient(to right, #2563eb, #3b82f6)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(37,99,235,0.2)' }}>שמור ובחר לקוח</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Column for Dates and Notes */}
        <div style={{ flex: '1 1 400px', padding: '1rem 1.5rem', background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontWeight: 'bold', fontSize: '1.2rem' }}>
                📅
              </div>
              <span style={{ fontWeight: '700', color: '#1e293b', fontSize: '1.2rem' }}>פרטי אירוע והערות</span>
            </div>
            
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap' }}>
              <button data-agy-id="ordergeneraldetails_button_9" type="button" onClick={() => setIsEditingOrderDetails(!isEditingOrderDetails)} style={{ fontSize: '0.9rem', background: 'white', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {isEditingOrderDetails ? <><Check size={16} /> סיים עריכה</> : <><Edit2 size={16} /> ערוך פרטים</>}
              </button>
            </div>
          </div>

          {!isEditingOrderDetails ? (
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
              <div>
                <span style={{...labelStyle, color: '#64748b'}}>תאריך אירוע:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
                  {order.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.eventDate)})` : 'לא נבחר'}
                </div>
              </div>
              <>
                <div>
                  <span style={{...labelStyle, color: '#64748b'}}>לקיחה:</span>
                  <div style={{ fontSize: '1.1rem', color: '#334155', fontWeight: '500' }}>{order.fromDate ? new Date(order.fromDate).toLocaleDateString('he-IL') : '-'}</div>
                </div>
                <div>
                  <span style={{...labelStyle, color: '#64748b'}}>החזרה:</span>
                  <div style={{ fontSize: '1.1rem', color: '#334155', fontWeight: '500' }}>{order.toDate || order.returnDate ? new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL') : '-'}</div>
                </div>
                {order.isWeekdayEvent && (
                  <div>
                    <span style={{...labelStyle, color: '#64748b'}}>סוג אירוע:</span>
                    <div style={{ fontSize: '1.1rem', color: '#334155', fontWeight: '500' }}>אירוע חול</div>
                  </div>
                )}
              </>
              <div style={{ flex: '1 1 100%', marginTop: '0.5rem' }}>
                <span style={{...labelStyle, color: '#64748b'}}>הערות להזמנה:</span>
                <div style={{ fontSize: '1rem', color: '#334155', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                  {order.notes || 'אין הערות'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {/* Dates */}
              <div style={groupStyle}>
                <label style={labelStyle}>תאריך אירוע:</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <HebrewDatePicker 
                      value={order.eventDate} 
                      onChange={(date) => validateAndChangeDate('eventDate', date)} 
                    />
                  </div>
                </div>
              </div>

              {/* Custom Duration / Abroad */}
              <div>
                <div style={{ ...groupStyle, display: 'inline-flex', alignItems: 'center', gap: '0.8rem', background: 'white', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer' }} onClick={() => validateAndChangeDate('isAbroad', !order.isAbroad)}>
                  <input data-agy-id="ordergeneraldetails_input_10" 
                    type="checkbox" 
                    id="isAbroad"
                    checked={order.isAbroad ?? false} 
                    onChange={(e) => validateAndChangeDate('isAbroad', e.target.checked)}
                    onClick={e => e.stopPropagation()}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <label htmlFor="isAbroad" style={{ fontWeight: '700', color: '#334155', cursor: 'pointer', margin: 0 }}>אירוע חו"ל (תפוסה מותאמת אישית)</label>
                </div>
                
                <div style={{ ...groupStyle, display: 'inline-flex', alignItems: 'center', gap: '0.8rem', background: 'white', padding: '0.8rem 1.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', cursor: 'pointer', marginRight: '1rem' }} onClick={() => validateAndChangeDate('isWeekdayEvent', !order.isWeekdayEvent)}>
                  <input 
                    type="checkbox" 
                    id="isWeekdayEvent"
                    checked={order.isWeekdayEvent ?? false} 
                    onChange={(e) => validateAndChangeDate('isWeekdayEvent', e.target.checked)}
                    onClick={e => e.stopPropagation()}
                    style={{ transform: 'scale(1.2)', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                  <label htmlFor="isWeekdayEvent" style={{ fontWeight: '700', color: '#334155', cursor: 'pointer', margin: 0 }}>אירוע חול</label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', border: '1px solid #bfdbfe', padding: '1.5rem', borderRadius: '12px', marginTop: '1rem', background: '#eff6ff' }}>
                  <div>
                    <label style={{...labelStyle, color: '#1e3a8a'}}>מתאריך (לקיחה):</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <HebrewDatePicker 
                          value={order.fromDate} 
                          onChange={(date) => validateAndChangeDate('fromDate', date)} 
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label style={{...labelStyle, color: '#1e3a8a'}}>עד תאריך (החזרה):</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <div style={{ flex: 1 }}>
                        <HebrewDatePicker 
                          value={order.toDate || order.returnDate} 
                          onChange={(date) => validateAndChangeDate('toDate', date)} 
                        />
                      </div>
                    </div>
                  </div>
                  {order.eventDate && order.fromDate && (order.toDate || order.returnDate) && 
                   (new Date(order.eventDate) < new Date(order.fromDate) || new Date(order.eventDate) > new Date(order.toDate || order.returnDate)) && (
                    <div style={{ gridColumn: '1 / -1', color: '#b91c1c', background: '#fef2f2', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>⚠️</span> שימו לב: תאריך האירוע חייב להיות בין תאריך הלקיחה לתאריך החזרה!
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <label style={labelStyle}>הערות להזמנה:</label>
                <textarea data-agy-id="ordergeneraldetails_textarea_11" 
                  value={order.notes || ''} 
                  onChange={(e) => handleChange('notes', e.target.value)}
                  style={{ ...inputStyle, minHeight: '100px', resize: 'vertical', background: 'white' }}
                  placeholder="הערות כלליות לגבי ההזמנה..."
                />
              </div>
            </div>
          )}

        </div>
        </div>
      )}
    </div>
  );
}
