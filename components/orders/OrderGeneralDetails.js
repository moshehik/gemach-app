'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ExternalLink, RefreshCw, Edit2, Check, CalendarClock } from 'lucide-react';
import HebrewDatePicker from '../HebrewDatePicker';
import HebrewDateRangePicker from '../HebrewDateRangePicker';
import CustomerSelector from '../CustomerSelector';
import { getHebrewDateString } from '../../lib/hebrewDate';

export default function OrderGeneralDetails({ order, onOrderChange, items = [], onSaveRequest }) {
  
  const [simulationModalData, setSimulationModalData] = useState(null);

  const handleChange = (field, value) => {
    onOrderChange({ ...order, [field]: value });
  };

  const validateAndChangeDate = async (fieldOrUpdates, valueIfField) => {
    const isMulti = typeof fieldOrUpdates === 'object';
    const updates = isMulti ? fieldOrUpdates : { [fieldOrUpdates]: valueIfField };

    if (updates.eventDate !== undefined && !updates.eventDateHebrew) {
      updates.eventDateHebrew = updates.eventDate ? getHebrewDateString(updates.eventDate) : null;
    }

    const proposedOrder = {
      ...order,
      ...updates
    };

    // Update local state immediately - don't auto-save to prevent race conditions
    // where the parent component's order state may be stale
    onOrderChange(proposedOrder);
  };

  const applyCustomSpacing = async (spacing) => {
    const prevSpacing = (order.customSpacing !== null && order.customSpacing !== undefined) ? order.customSpacing : 3;
    const newSpacing = (spacing !== null && spacing !== undefined) ? spacing : 3;
    
    const requiresAuth = newSpacing < 3 && newSpacing < prevSpacing;

    if (requiresAuth) {
      const authResult = await window.customAuthPrompt("שינוי ציפוף ימים מותאם אישית דורש הרשאת מנהל. אנא בחר מנהל והזן סיסמה:", 'מנהל');
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

    if (simulationModalData) {
      // We are applying this from the simulation modal
      const { updates } = simulationModalData;
      
      // Update both the customSpacing and the date fields
      const newOrder = { ...order, customSpacing: spacing, ...updates };
      onOrderChange(newOrder);
      setSimulationModalData(null);
      if (onSaveRequest) setTimeout(() => onSaveRequest(newOrder), 0);
    } else {
      // Just setting custom spacing directly
      validateAndChangeDate('customSpacing', spacing);
    }
  };

  // Editing orderDate shifts the REFUND_DAYS_FROM_ORDER window in computeOrderObligations
  // (lib/pricingEngine.js), so - unlike every other 'מנהל' PIN-gate in this file - it's
  // restricted to roleId 2 ("מתכנת") specifically, excluding managers.
  const requestOrderDateEdit = async () => {
    const authResult = await window.customAuthPrompt(
      'עריכת תאריך ההזמנה משפיעה על חישובי זיכוי בביטול ומוגבלת למתכנת. אנא בחר משתמש והזן סיסמה:',
      'מתכנת'
    );
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מתכנת' })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
        return;
      }
    } catch (err) {
      alert('שגיאה באימות קוד מתכנת.');
      return;
    }
    setIsEditingOrderDate(true);
  };

  const handleOrderDateChange = (date) => {
    setIsEditingOrderDate(false);
    const newOrder = { ...order, orderDate: date };
    onOrderChange(newOrder);
    if (onSaveRequest) onSaveRequest(newOrder);
  };

  const [isExpanded, setIsExpanded] = useState(true);
  const customerName = order?.customer ? [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ') : 'לא נבחר לקוח';
  const eventDateStr = (order?.isWeekdayEvent || order?.isAbroad) ? 'אירוע חו"ל' : (order?.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.eventDate)})` : 'ללא תאריך אירוע');
  const summaryText = `לקוח: ${customerName} | אירוע: ${eventDateStr}`;

  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [isEditingOrderDetails, setIsEditingOrderDetails] = useState(!order?.eventDate);
  const [customerMode, setCustomerMode] = useState('existing');
  const [newCustomer, setNewCustomer] = useState({ firstName: '', lastName: '', phone1: '', email: '', city: '', street: '', houseNum: '' });
  const [isEditingOrderDate, setIsEditingOrderDate] = useState(false);
  const orderDateStr = order?.orderDate ? `${new Date(order.orderDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.orderDate)})` : 'לא ידוע';

  const handleSaveNewCustomer = async () => {
    if (!newCustomer.firstName || !newCustomer.lastName || !newCustomer.phone1 || !newCustomer.email) {
       alert('יש למלא שם פרטי, משפחה, טלפון ודוא"ל');
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
        <>
          {(!isEditingCustomer && !isEditingOrderDetails) ? (
            <div style={{ padding: '1.2rem 1.5rem', background: 'linear-gradient(to bottom right, #ffffff, #f8fafc)', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 10px rgba(0,0,0,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', flex: 1 }}>
                
                {/* Customer Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                     <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb', fontWeight: 'bold', fontSize: '1rem' }}>
                        {order.customer ? (order.customer.firstName?.[0] || '') + (order.customer.lastName?.[0] || '') : '?'}
                     </div>
                     <span style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>{customerName}</span>
                     {order.customer?.id && (
                        <Link href={`/customers/${order.customer.id}`} target="_blank" title="מעבר לכרטיס לקוח" style={{ color: '#2563eb', display: 'inline-flex', marginLeft: '0.5rem', background: '#eff6ff', padding: '0.4rem', borderRadius: '6px', transition: 'all 0.2s' }}>
                          <ExternalLink size={16}/>
                        </Link>
                     )}
                  </div>
                  
                  {order.customer?.phone1 && (
                    <div style={{ color: '#475569', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: '#94a3b8' }}>📱</span>
                      <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '500' }}>{order.customer.phone1}</span>
                    </div>
                  )}
                  {order.customer?.phone2 && (
                    <div style={{ color: '#475569', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: '#94a3b8' }}>☎️</span>
                      <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: '500' }}>{order.customer.phone2}</span>
                    </div>
                  )}
                  
                  <div 
                    onClick={(e) => {
                      e.stopPropagation();
                      const newValue = !order.hasSignedRegulations;
                      handleChange('hasSignedRegulations', newValue);
                      if (onSaveRequest) onSaveRequest({ ...order, hasSignedRegulations: newValue });
                    }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                      padding: '0.4rem 0.8rem', background: order.hasSignedRegulations ? '#dcfce7' : '#f8fafc',
                      borderRadius: '8px', border: `1px solid ${order.hasSignedRegulations ? '#86efac' : '#e2e8f0'}`,
                      color: order.hasSignedRegulations ? '#166534' : '#475569', fontWeight: '600', fontSize: '0.95rem',
                      transition: 'all 0.2s', marginLeft: 'auto'
                    }}
                  >
                    <input 
                      type="checkbox" 
                      checked={!!order.hasSignedRegulations} 
                      onChange={() => {}}
                      style={{ cursor: 'pointer', accentColor: '#16a34a', margin: 0, transform: 'scale(1.1)' }}
                    />
                    <span>חתם על תקנון השכרה</span>
                  </div>
                </div>

                {/* Event Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#fce7f3', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#db2777', fontSize: '1rem' }}>
                      📅
                    </div>
                    <span style={{ fontSize: '1.15rem', fontWeight: '700', color: '#0f172a' }}>{eventDateStr}</span>
                  </div>

                  <div style={{ color: '#475569', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                    <strong style={{ color: '#64748b' }}>תאריך הזמנה:</strong>
                    {isEditingOrderDate ? (
                      <div style={{ minWidth: '180px' }}>
                        <HebrewDatePicker value={order.orderDate} onChange={handleOrderDateChange} />
                      </div>
                    ) : (
                      <span>{orderDateStr}</span>
                    )}
                    <button
                      type="button"
                      title="ערוך תאריך הזמנה (מתכנת בלבד)"
                      onClick={requestOrderDateEdit}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '0.3rem', cursor: 'pointer', color: '#475569' }}
                    >
                      <CalendarClock size={15} />
                    </button>
                  </div>

                  {(order.isWeekdayEvent || order.isAbroad) && (
                    <div style={{ color: '#475569', fontSize: '1.05rem', display: 'flex', gap: '1.5rem', alignItems: 'center', background: '#f1f5f9', padding: '0.4rem 1rem', borderRadius: '8px' }}>
                      <span><strong style={{ color: '#64748b' }}>לקיחה:</strong> {order.fromDate ? `${new Date(order.fromDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.fromDate)})` : 'לא נבחר'}</span>
                      <span style={{ color: '#cbd5e1' }}>|</span>
                      <span><strong style={{ color: '#64748b' }}>החזרה:</strong> {order.toDate || order.returnDate ? `${new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.toDate || order.returnDate)})` : 'לא נבחר'}</span>
                    </div>
                  )}
                  
                  {order.notes && (
                    <div style={{ color: '#475569', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fffbeb', padding: '0.4rem 1rem', borderRadius: '8px', border: '1px solid #fef3c7', maxWidth: '500px' }}>
                      <strong style={{ color: '#d97706' }}>הערות:</strong>
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{order.notes}</span>
                    </div>
                  )}
                </div>
                
              </div>

              {/* Edit Buttons */}
              <div style={{ display: 'flex', gap: '0.8rem', flexDirection: 'column', minWidth: '140px' }}>
                <button type="button" onClick={() => setIsEditingCustomer(true)} style={{ width: '100%', fontSize: '0.9rem', background: 'white', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <RefreshCw size={16} /> ערוך לקוח
                </button>
                <button type="button" onClick={() => setIsEditingOrderDetails(true)} style={{ width: '100%', fontSize: '0.9rem', background: 'white', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                  <Edit2 size={16} /> ערוך אירוע
                </button>
              </div>
            </div>
          ) : (
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
                <Link href={`/customers/${order.customer.id}`} target="_blank" title="מעבר לכרטיס" style={{ fontSize: '0.9rem', color: '#2563eb', textDecoration: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#eff6ff', padding: '0.6rem', borderRadius: '8px', border: '1px solid #bfdbfe', transition: 'all 0.2s' }}>
                  <ExternalLink size={18} />
                </Link>
              )}
              <button data-agy-id="ordergeneraldetails_button_1" type="button" title="החלף לקוח" onClick={() => setIsEditingCustomer(!isEditingCustomer)} style={{ fontSize: '0.9rem', background: 'white', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                <RefreshCw size={18} />
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
              <div style={{ flex: '1 1 100%', marginTop: '0.5rem' }}>
                <div 
                  onClick={(e) => {
                    e.stopPropagation();
                    const newValue = !order.hasSignedRegulations;
                    handleChange('hasSignedRegulations', newValue);
                    if (onSaveRequest) onSaveRequest({ ...order, hasSignedRegulations: newValue });
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.8rem', cursor: 'pointer',
                    padding: '0.6rem 1.2rem', background: order.hasSignedRegulations ? '#dcfce7' : '#f8fafc',
                    borderRadius: '10px', border: `1px solid ${order.hasSignedRegulations ? '#86efac' : '#e2e8f0'}`,
                    color: order.hasSignedRegulations ? '#166534' : '#475569', fontWeight: '700',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.02)', transition: 'all 0.2s'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={!!order.hasSignedRegulations} 
                    onChange={() => {}} // handled by parent div
                    style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: '#16a34a', margin: 0 }}
                  />
                  <span>חתם על תקנון השכרה</span>
                  {order.hasSignedRegulations && <Check size={18} color="#166534" style={{ marginRight: 'auto' }} />}
                </div>
              </div>
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
                  <div><label style={labelStyle}>שם פרטי *</label><input data-agy-id="ordergeneraldetails_input_4" type="text" style={inputStyle} value={newCustomer.firstName} onChange={e => setNewCustomer({...newCustomer, firstName: e.target.value})} /></div>
                  <div><label style={labelStyle}>שם משפחה *</label><input data-agy-id="ordergeneraldetails_input_5" type="text" style={inputStyle} value={newCustomer.lastName} onChange={e => setNewCustomer({...newCustomer, lastName: e.target.value})} /></div>
                  <div><label style={labelStyle}>טלפון *</label><input data-agy-id="ordergeneraldetails_input_6" type="text" style={inputStyle} value={newCustomer.phone1} onChange={e => setNewCustomer({...newCustomer, phone1: e.target.value})} /></div>
                  <div>
                    <label style={labelStyle}>דוא"ל *</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <input type="email" style={inputStyle} value={newCustomer.email || ''} onChange={e => setNewCustomer({...newCustomer, email: e.target.value})} />
                      {(!newCustomer.email || !newCustomer.email.includes('@')) && (
                        <button 
                          type="button"
                          onClick={() => {
                            const currentEmail = newCustomer.email || '';
                            setNewCustomer(prev => ({ ...prev, email: currentEmail + '@gmail.com' }));
                          }}
                          style={{
                            padding: '0.3rem 0.6rem',
                            fontSize: '0.85rem',
                            background: '#2563eb',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            transition: 'opacity 0.2s',
                            alignSelf: 'flex-start'
                          }}
                          onMouseOver={(e) => e.target.style.opacity = '0.8'}
                          onMouseOut={(e) => e.target.style.opacity = '1'}
                        >
                          השלם ל- @gmail.com
                        </button>
                      )}
                    </div>
                  </div>
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
              <button data-agy-id="ordergeneraldetails_button_9" type="button" title={isEditingOrderDetails ? "סיים עריכה" : "ערוך פרטים"} onClick={() => setIsEditingOrderDetails(!isEditingOrderDetails)} style={{ fontSize: '0.9rem', background: 'white', padding: '0.6rem', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: '600', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {isEditingOrderDetails ? <Check size={18} /> : <Edit2 size={18} />}
              </button>
            </div>
          </div>

          {!isEditingOrderDetails ? (
            <div style={{ display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
              {(!order.isWeekdayEvent && !order.isAbroad) ? (
                <div>
                  <span style={{...labelStyle, color: '#64748b'}}>תאריך אירוע:</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
                    {order.eventDate ? `${new Date(order.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.eventDate)})` : 'לא נבחר'}
                  </div>
                </div>
              ) : (
                <div>
                  <span style={{...labelStyle, color: '#64748b'}}>סוג אירוע:</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
                    אירוע חו"ל
                  </div>
                </div>
              )}
              {(order.isWeekdayEvent || order.isAbroad) ? (
                <>
                  <div>
                    <span style={{...labelStyle, color: '#64748b'}}>לקיחה:</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: '700' }}>
                        {(order.fromDate || order.eventDate) ? `${new Date(order.fromDate || order.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.fromDate || order.eventDate)})` : 'לא נבחר'}
                      </div>
                      {(order.fromDate || order.eventDate) && (
                        <input type="time" 
                          value={new Date(order.fromDate || order.eventDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} 
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            if (!hours || !minutes) return;
                            const newDate = new Date(order.fromDate || order.eventDate);
                            newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                            validateAndChangeDate({ fromDate: newDate.toISOString() });
                          }}
                          style={{ padding: '0.2rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', cursor: 'pointer' }}
                        />
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{...labelStyle, color: '#64748b'}}>החזרה:</span>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <div style={{ fontSize: '1.2rem', color: '#0f172a', fontWeight: '700' }}>
                        {(order.toDate || order.returnDate) ? `${new Date(order.toDate || order.returnDate).toLocaleDateString('he-IL')} (${getHebrewDateString(order.toDate || order.returnDate)})` : 'לא נבחר'}
                      </div>
                      {(order.toDate || order.returnDate) && (
                        <input type="time" 
                          value={new Date(order.toDate || order.returnDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} 
                          onChange={(e) => {
                            const [hours, minutes] = e.target.value.split(':');
                            if (!hours || !minutes) return;
                            const newDate = new Date(order.toDate || order.returnDate);
                            newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                            validateAndChangeDate({ toDate: newDate.toISOString() });
                          }}
                          style={{ padding: '0.2rem', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '1rem', cursor: 'pointer' }}
                        />
                      )}
                    </div>
                  </div>
                </>
              ) : null}
              <div style={{ flex: '1 1 100%', marginTop: '0.5rem' }}>
                <span style={{...labelStyle, color: '#64748b'}}>הערות להזמנה:</span>
                <div style={{ fontSize: '1rem', color: '#334155', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
                  {order.notes || 'אין הערות'}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: '#f8fafc', padding: '1.5rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              {/* Event Type */}
              <div style={groupStyle}>
                <label style={labelStyle}>סוג אירוע:</label>
                <div style={{ display: 'flex', gap: '0.8rem', background: '#f1f5f9', padding: '0.4rem', borderRadius: '12px' }}>
                  {[
                    { id: 'regular', label: 'אירוע רגיל' },
                    { id: 'abroad', label: 'אירוע חו"ל' }
                  ].map(type => {
                    const isSelected =
                      (type.id === 'regular' && !order.isAbroad && !order.isWeekdayEvent) ||
                      (type.id === 'abroad' && (order.isAbroad || order.isWeekdayEvent));
                    return (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          const isAbroad = type.id === 'abroad';
                          const isWeekdayEvent = false;
                          if (isAbroad) {
                            // When switching to abroad/weekday, clear eventDate since we'll use date range
                            validateAndChangeDate({ isAbroad, isWeekdayEvent, eventDate: null, eventDateHebrew: null });
                          } else {
                            // When switching to regular event, clear the date range but keep eventDate.
                            // Also clear returnDate - it was set to the abroad range's end date and would
                            // otherwise keep marking the item occupied through that stale date.
                            validateAndChangeDate({ isAbroad: false, isWeekdayEvent: false, fromDate: null, toDate: null, returnDate: null });
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '0.6rem 1rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: isSelected ? 'white' : 'transparent',
                          color: isSelected ? '#0f172a' : '#64748b',
                          fontWeight: '700',
                          fontSize: '0.95rem',
                          boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                      >
                        {type.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              {(!order.isWeekdayEvent && !order.isAbroad) && (
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
              )}

              {/* Custom Duration / Abroad or Weekday */}
              {(order.isAbroad || order.isWeekdayEvent) && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', border: '1px solid #bfdbfe', padding: '1.5rem', borderRadius: '12px', marginTop: '1rem', background: '#eff6ff' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{...labelStyle, color: '#1e3a8a', marginBottom: '0.5rem'}}>טווח תאריכים (לקיחה והחזרה):</label>
                      <HebrewDateRangePicker 
                        startDate={order.fromDate} 
                        endDate={order.toDate || order.returnDate} 
                        onChange={(start, end) => {
                          const updates = { 
                            fromDate: start, 
                            toDate: end, 
                            returnDate: end 
                          };
                          if (order.isWeekdayEvent || order.isAbroad) {
                            updates.eventDate = start;
                          }
                          validateAndChangeDate(updates);
                        }} 
                      />
                      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem', justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                        {order.fromDate && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: '#1e3a8a', fontWeight: 'bold' }}>שעת לקיחה:</span>
                            <input type="time" 
                              value={new Date(order.fromDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} 
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(':');
                                if (!hours || !minutes) return;
                                const newDate = new Date(order.fromDate);
                                newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                                validateAndChangeDate({ fromDate: newDate.toISOString() });
                              }}
                              style={{ padding: '0.3rem', borderRadius: '6px', border: '1px solid #bfdbfe', background: 'white' }}
                            />
                          </div>
                        )}
                        {(order.toDate || order.returnDate) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: '#1e3a8a', fontWeight: 'bold' }}>שעת החזרה:</span>
                            <input type="time" 
                              value={new Date(order.toDate || order.returnDate).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })} 
                              onChange={(e) => {
                                const [hours, minutes] = e.target.value.split(':');
                                if (!hours || !minutes) return;
                                const newDate = new Date(order.toDate || order.returnDate);
                                newDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
                                validateAndChangeDate({ toDate: newDate.toISOString(), returnDate: newDate.toISOString() });
                              }}
                              style={{ padding: '0.3rem', borderRadius: '6px', border: '1px solid #bfdbfe', background: 'white' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {order.eventDate && order.fromDate && (order.toDate || order.returnDate) && !order.isWeekdayEvent && !order.isAbroad && 
                     (new Date(order.eventDate) < new Date(order.fromDate) || new Date(order.eventDate) > new Date(order.toDate || order.returnDate)) && (
                      <div style={{ gridColumn: '1 / -1', color: '#b91c1c', background: '#fef2f2', padding: '1rem', borderRadius: '8px', fontWeight: 'bold', fontSize: '0.95rem', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>⚠️</span> שימו לב: תאריך האירוע חייב להיות בין תאריך הלקיחה לתאריך החזרה!
                      </div>
                    )}
                  </div>
                </div>
              )}

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

              {/* Custom Spacing UI */}
              <div style={{ marginTop: '1rem', background: '#fffbeb', border: '1px solid #fde68a', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ ...labelStyle, color: '#92400e', marginBottom: 0 }}>ציפוף ימים מיוחד:</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select
                      value={order.customSpacing !== null && order.customSpacing !== undefined ? order.customSpacing : ''}
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        if (val !== order.customSpacing) {
                          applyCustomSpacing(val);
                        }
                      }}
                      style={{ ...inputStyle, width: '150px', backgroundColor: 'white', borderColor: '#fcd34d', fontWeight: 'bold' }}
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
                <p style={{ fontSize: '0.85rem', color: '#b45309', margin: '0.5rem 0 0 0' }}>* בחירת ציפוף מיוחד תצבע את ההזמנה בצהוב ותשפיע על בדיקת המלאי להזמנה זו בלבד (דורש הרשאת מנהל).</p>
              </div>

            </div>
          )}

        </div>
            </div>
          )}
        </>
      )}

      {/* Simulation Modal */}
      {simulationModalData && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '90%', maxWidth: '650px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <h3 style={{ margin: '0 0 1.5rem 0', color: '#1e293b', fontSize: '1.4rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>חוסר במלאי עבור התאריך המבוקש</h3>
            
            <p style={{ color: '#475569', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
              שימו לב, אין מספיק מלאי להזמנה זו בציפוף הימים הרגיל. להלן מצב המלאי עבור כל פריט חסר בכל אחד מפוערי הציפוף האפשריים:
            </p>

            <div style={{ maxHeight: '350px', overflowY: 'auto', marginBottom: '1.5rem' }}>
              {simulationModalData.errors.map((err, idx) => (
                <div key={idx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1.1rem', color: '#0f172a', marginBottom: '0.5rem' }}>
                    {err.dressName} (מידה: {err.sizeText}) - נדרש: {err.requested}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', background: '#fee2e2', borderRadius: '6px', color: '#991b1b' }}>
                      <span>ציפוף רגיל:</span>
                      <strong>זמין: {err.available}</strong>
                    </div>
                    
                    {[3, 2, 1, 0].map(spacing => {
                      const simData = simulationModalData.simulation[spacing];
                      if (!simData) return null;
                      const sizeError = simData.errors.find(e => e.dressModelId === err.dressModelId && e.sizeText === err.sizeText);
                      const isSufficient = !sizeError; // If there's no error for this size, it means requested <= available!
                      // If there is an error, available is sizeError.available, otherwise it's at least requested
                      const availableQty = sizeError ? sizeError.available : `מספיק (${err.requested}+)`;
                      
                      return (
                        <div key={spacing} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: isSufficient ? '#dcfce7' : '#f1f5f9', borderRadius: '6px', color: isSufficient ? '#166534' : '#475569', border: isSufficient ? '1px solid #bbf7d0' : 'none' }}>
                          <span>בציפוף של {spacing} ימים:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <strong>זמין: {availableQty}</strong>
                            {isSufficient && simData.valid && (
                              <button
                                onClick={() => applyCustomSpacing(spacing)}
                                style={{ background: '#22c55e', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                              >
                                החל ציפוף זה 🔒
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '2px solid #f1f5f9', paddingTop: '1.5rem' }}>
              <button 
                onClick={() => setSimulationModalData(null)}
                style={{ padding: '0.8rem 1.5rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ביטול שינוי התאריך
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
