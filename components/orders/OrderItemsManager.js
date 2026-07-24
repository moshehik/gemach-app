'use client';

import React, { useState } from 'react';
import OrderModelSelector from './OrderModelSelector';
import OrderSizeSelector from './OrderSizeSelector';
import { Info, Trash2, RotateCcw, CalendarSearch, ChevronDown, ChevronUp } from 'lucide-react';
import ItemCapacityModal from './ItemCapacityModal';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../HistoryViewer';

export default function OrderItemsManager({ orderId, order, items, onItemsChange, onOrderUpdated }) {
  const [showDeleted, setShowDeleted] = useState(false);
  const [detailsModalItem, setDetailsModalItem] = useState(null);
  const [capacityModalItem, setCapacityModalItem] = useState(null);
  const [savingItemIndex, setSavingItemIndex] = useState(null);
  const [settings, setSettings] = useState({});

  const [isExpanded, setIsExpanded] = useState(true);
  const activeItemsCount = items ? items.filter(i => !i.isDeleted).length : 0;
  const summaryText = `${activeItemsCount} פריטים פעילים בהזמנה`;

  React.useEffect(() => {
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
      .catch(console.error);
  }, []);

  const handleConfirmItem = async (index) => {
    const item = items[index];
    if (!item.dressModelId || !item.sizeText) {
      alert('יש לבחור דגם ומידה לפני האישור');
      return;
    }

    const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
    if (hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
      alert('חובה להזין פירוט תיקון כאשר נבחר תיקון');
      return;
    }

    setSavingItemIndex(index);
    try {
      // Validate inventory before saving single item
      const validateRes = await fetch('/api/orders/validate-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [item],
          eventDate: order.eventDate,
          isAbroad: order.isAbroad,
          fromDate: order.fromDate,
          toDate: order.toDate,
          orderId: order.orderId
        })
      });
      const validateData = await validateRes.json();
      if (!validateData.valid) {
        setSavingItemIndex(null);
        alert(`לא ניתן לשמור פריט עקב חוסר במלאי: חסרים ${validateData.errors[0].requested - validateData.errors[0].available} ממידה זו.`);
        return;
      }

      const res = await fetch(`/api/orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בשמירת הפריט');
      }
      
      if (onOrderUpdated) {
        onOrderUpdated(data);
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingItemIndex(null);
    }
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    onItemsChange(updatedItems);
  };

  const handleModelChange = (index, model) => {
    const updatedItems = [...items];
    updatedItems[index] = { 
      ...updatedItems[index], 
      dressModelId: model.id,
      barcodePrefix: model.barcodePrefix,
      description: model.name, // temporary for display before save
      sizeText: '' // clear size when model changes
    };
    onItemsChange(updatedItems);
  };

  const toggleDeleted = async (index) => {
    const isCurrentlyDeleted = items[index].isDeleted;
    if (isCurrentlyDeleted) { // trying to restore
      const maxItems = parseInt(settings.max_items_per_order);
      const activeCount = items.filter(i => !i.isDeleted).length;
      if (!isNaN(maxItems) && maxItems > 0 && activeCount >= maxItems) {
        alert(`הגבלת מערכת: לא ניתן לשחזר פריט. המקסימום המותר הוא ${maxItems} פריטים בהזמנה.`);
        return;
      }

      // Check stock before restoring
      try {
        const item = items[index];
        const validateRes = await fetch('/api/orders/validate-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: [item],
            eventDate: order.eventDate,
            isAbroad: order.isAbroad,
            fromDate: order.fromDate,
            toDate: order.toDate,
            orderId: order.orderId
          })
        });
        const validateData = await validateRes.json();
        
        if (validateData.error) {
          alert(`שגיאה בבדיקת המלאי: ${validateData.error}`);
          return;
        }
        
        if (!validateData.valid && validateData.errors && validateData.errors.length > 0) {
          alert(`לא ניתן לשחזר את הפריט עקב חוסר במלאי: חסרים ${validateData.errors[0].requested - validateData.errors[0].available} ממידה זו.`);
          return;
        }
      } catch (err) {
        console.error('Validation fetch error', err);
        alert('שגיאה בבדיקת המלאי מול השרת.');
        return;
      }
    }
    handleItemChange(index, 'isDeleted', !isCurrentlyDeleted);
  };

  const handleAddItem = () => {
    const maxItems = parseInt(settings.max_items_per_order);
    const activeCount = items.filter(i => !i.isDeleted).length;
    if (!isNaN(maxItems) && maxItems > 0 && activeCount >= maxItems) {
      alert(`הגבלת מערכת: לא ניתן להוסיף יותר מ-${maxItems} פריטים להזמנה.`);
      return;
    }

    const newItem = {
      isNew: true,
      description: '',
      sizeText: '',
      neckAlteration: 0,
      sleeveAlteration: 0,
      lengthAlteration: '',
      alterationDetails: '',
      alterationDone: false,
      finalPrice: 0,
      isDeleted: false,
      createdAt: new Date().toISOString()
    };
    onItemsChange([newItem, ...items]);
  };

  const showItemDetails = async (item) => {
    setDetailsModalItem({ ...item, auditLogs: null, loadingLogs: true });
    try {
      const res = await fetch(`/api/audit/order-item/${item.id}`);
      let logs = [];
      if (res.ok) {
        logs = await res.json();
      }
      setDetailsModalItem({ ...item, auditLogs: logs, loadingLogs: false });
    } catch (err) {
      console.error(err);
      setDetailsModalItem({ ...item, auditLogs: [], loadingLogs: false });
    }
  };

  const visibleItems = showDeleted ? items : items.filter(item => !item.isDeleted);

  const enableAlterations = settings.enable_alterations !== 'false';

  const tableHeaderStyle = {
    padding: '1.2rem 1rem',
    textAlign: 'right',
    color: '#334155',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: '700',
    whiteSpace: 'nowrap'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.6rem 0.8rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    textAlign: 'center',
    transition: 'all 0.2s',
    outline: 'none',
    backgroundColor: 'white'
  };

  return (
    <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflowX: 'auto', border: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '1.5rem' : '0', borderBottom: isExpanded ? '2px solid #f1f5f9' : 'none', paddingBottom: isExpanded ? '1rem' : '0' }}>
        <div 
          onClick={() => setIsExpanded(!isExpanded)} 
          style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', flex: 1, flexWrap: 'wrap' }}
        >
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>פירוט פריטים בהזמנה</h2>
          {!isExpanded && (
            <span style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: '500', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ color: '#cbd5e1' }}>|</span> {summaryText}
            </span>
          )}
          <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isExpanded && (
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem', color: '#475569', background: '#f8fafc', padding: '0.6rem 1.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', transition: 'all 0.2s', fontWeight: '600' }} onClick={(e) => e.stopPropagation()} onMouseOver={e => e.currentTarget.style.backgroundColor='#f1f5f9'} onMouseOut={e => e.currentTarget.style.backgroundColor='#f8fafc'}>
                <input 
                  type="checkbox" 
                  checked={showDeleted} 
                  onChange={(e) => setShowDeleted(e.target.checked)} 
                  style={{ marginLeft: '0.8rem', width: '1.2rem', height: '1.2rem', accentColor: '#3b82f6' }}
                />
                הצג פריטים מחוקים
              </label>
            )}
            <div style={{ color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', borderRadius: '50%', padding: '0.5rem', transition: 'all 0.2s' }}>
              {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <>
          {items && items.length > 0 ? (
        <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
            <thead>
              <tr>
                <th style={{ ...tableHeaderStyle, width: '40px', textAlign: 'center' }}>מחק</th>
                <th style={tableHeaderStyle}>תיאור דגם</th>
                <th style={{ ...tableHeaderStyle, width: '150px' }}>מידה</th>
                {enableAlterations && (
                  <>
                    <th style={{ ...tableHeaderStyle, width: '60px', textAlign: 'center' }}>צוואר</th>
                    <th style={{ ...tableHeaderStyle, width: '60px', textAlign: 'center' }}>שרוול</th>
                    <th style={{ ...tableHeaderStyle, width: '80px', textAlign: 'center' }}>אורך</th>
                    <th style={tableHeaderStyle}>פירוט תיקונים</th>
                    <th style={{ ...tableHeaderStyle, width: '80px', textAlign: 'center' }}>בוצע?</th>
                  </>
                )}
                <th style={{ ...tableHeaderStyle, width: '120px', textAlign: 'center' }}>פעולות נוספות</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, originalIndex) => {
                if (!showDeleted && item.isDeleted) return null;
                
                const isDeletedRow = item.isDeleted;
                const isRented = item.isTaken && !item.isReturned;
                const isReturned = item.isReturned;
                
                const rowStyle = {
                  borderBottom: '1px solid #f1f5f9',
                  opacity: isDeletedRow ? 0.6 : 1,
                  backgroundColor: isDeletedRow ? '#f8fafc' : isRented ? '#eff6ff' : isReturned ? '#f0fdf4' : 'white',
                  transition: 'all 0.2s',
                  fontWeight: isRented ? 'bold' : 'normal'
                };

                return (
                  <tr key={item.id || originalIndex} style={rowStyle} onMouseEnter={(e) => !isDeletedRow && (e.currentTarget.style.backgroundColor = isRented ? '#dbeafe' : isReturned ? '#dcfce7' : '#f8fafc')} onMouseLeave={(e) => !isDeletedRow && (e.currentTarget.style.backgroundColor = isRented ? '#eff6ff' : isReturned ? '#f0fdf4' : 'white')}>
                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleDeleted(originalIndex);
                        }}
                        style={{
                          background: isDeletedRow ? '#f1f5f9' : '#fef2f2', 
                          border: `1px solid ${isDeletedRow ? '#cbd5e1' : '#fecaca'}`,
                          cursor: 'pointer', 
                          color: isDeletedRow ? '#64748b' : '#ef4444',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0.5rem',
                          borderRadius: '8px',
                          transition: 'all 0.2s ease',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.backgroundColor = isDeletedRow ? '#e2e8f0' : '#fee2e2';
                          e.currentTarget.style.borderColor = isDeletedRow ? '#94a3b8' : '#fca5a5';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.backgroundColor = isDeletedRow ? '#f1f5f9' : '#fef2f2';
                          e.currentTarget.style.borderColor = isDeletedRow ? '#cbd5e1' : '#fecaca';
                        }}
                        title={isDeletedRow ? 'שחזר פריט' : 'מחק פריט'}
                      >
                        {isDeletedRow ? <RotateCcw size={18} strokeWidth={2.5} /> : <Trash2 size={18} strokeWidth={2.5} />}
                      </button>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                      {item.isNew ? (
                        <OrderModelSelector 
                          value={item} 
                          onChange={(model) => handleModelChange(originalIndex, model)} 
                        />
                      ) : (
                        item.dressItem?.dress?.name || item.description || 'פריט כללי'
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {item.isNew ? (
                        <OrderSizeSelector 
                          modelId={item.dressModelId} 
                          order={order}
                          value={item.sizeText} 
                          onChange={(val) => handleItemChange(originalIndex, 'sizeText', val)} 
                        />
                      ) : (
                        <input 
                          type="text" 
                          value={item.sizeText || ''} 
                          disabled
                          style={{ ...inputStyle, backgroundColor: '#f1f5f9', color: '#475569', cursor: 'not-allowed', borderColor: '#e2e8f0' }}
                        />
                      )}
                    </td>
                    {enableAlterations && (
                      <>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={item.neckAlteration === 1 || item.neckAlteration === true} 
                            onChange={(e) => handleItemChange(originalIndex, 'neckAlteration', e.target.checked ? 1 : 0)}
                            disabled={!item.isNew}
                            style={{ transform: 'scale(1.4)', cursor: !item.isNew ? 'not-allowed' : 'pointer', opacity: !item.isNew ? 0.6 : 1, accentColor: '#3b82f6' }}
                          />
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={item.sleeveAlteration === 1 || item.sleeveAlteration === true} 
                            onChange={(e) => handleItemChange(originalIndex, 'sleeveAlteration', e.target.checked ? 1 : 0)}
                            disabled={!item.isNew}
                            style={{ transform: 'scale(1.4)', cursor: !item.isNew ? 'not-allowed' : 'pointer', opacity: !item.isNew ? 0.6 : 1, accentColor: '#3b82f6' }}
                          />
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <input 
                            type="number" 
                            value={item.lengthAlteration || ''} 
                            onChange={(e) => handleItemChange(originalIndex, 'lengthAlteration', e.target.value)}
                            disabled={!item.isNew}
                            style={{ ...inputStyle, width: '60px', padding: '0.5rem', backgroundColor: !item.isNew ? '#f1f5f9' : 'white', cursor: !item.isNew ? 'not-allowed' : 'text' }}
                            placeholder="-"
                          />
                        </td>
                        <td style={{ padding: '1rem' }}>
                          <input 
                            type="text" 
                            value={item.alterationDetails || item.repairs || ''} 
                            onChange={(e) => handleItemChange(originalIndex, 'alterationDetails', e.target.value)}
                            style={{ ...inputStyle, textAlign: 'right' }}
                            placeholder="הערות לתיקון..."
                          />
                        </td>
                        <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                          <input 
                            type="checkbox" 
                            checked={item.alterationDone || false} 
                            onChange={(e) => handleItemChange(originalIndex, 'alterationDone', e.target.checked)}
                            style={{ transform: 'scale(1.4)', cursor: 'pointer', accentColor: '#10b981' }}
                          />
                        </td>
                      </>
                    )}
                    <td style={{ padding: '1rem 0.5rem', textAlign: 'center' }}>
                      {item.isNew ? (
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleConfirmItem(originalIndex);
                          }}
                          disabled={savingItemIndex === originalIndex}
                          style={{ 
                            background: 'linear-gradient(to right, #10b981, #22c55e)', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px',
                            cursor: savingItemIndex === originalIndex ? 'not-allowed' : 'pointer', 
                            padding: '0.6rem 1rem',
                            fontWeight: 'bold',
                            opacity: savingItemIndex === originalIndex ? 0.7 : 1,
                            width: '100%',
                            minWidth: '90px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.4rem',
                            boxShadow: savingItemIndex !== null ? 'none' : '0 4px 6px rgba(16, 185, 129, 0.2)',
                            transition: 'all 0.2s'
                          }}
                          title="אישור ושמירת פריט"
                        >
                          {savingItemIndex === originalIndex ? '⏳ שומר...' : '✔️ אישור'}
                        </button>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center' }}>
                          <button 
                            onClick={() => showItemDetails(item)}
                            style={{ 
                              background: '#eff6ff', 
                              border: '1px solid #bfdbfe',
                              cursor: 'pointer', 
                              color: '#2563eb',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.5rem',
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#dbeafe';
                              e.currentTarget.style.borderColor = '#93c5fd';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#eff6ff';
                              e.currentTarget.style.borderColor = '#bfdbfe';
                            }}
                            title="פרטים נוספים"
                          >
                            <Info size={18} strokeWidth={2.5} />
                          </button>
                          
                          <button 
                            onClick={() => setCapacityModalItem(item)}
                            style={{ 
                              background: '#fdf4ff', 
                              border: '1px solid #fbcfe8',
                              cursor: 'pointer', 
                              color: '#c026d3',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              padding: '0.5rem',
                              borderRadius: '8px',
                              transition: 'all 0.2s ease',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                            }}
                            onMouseOver={(e) => {
                              e.currentTarget.style.backgroundColor = '#fae8ff';
                              e.currentTarget.style.borderColor = '#f9a8d4';
                            }}
                            onMouseOut={(e) => {
                              e.currentTarget.style.backgroundColor = '#fdf4ff';
                              e.currentTarget.style.borderColor = '#fbcfe8';
                            }}
                            title="בדוק תפוסה לתאריך אירוע"
                          >
                            <CalendarSearch size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#64748b', padding: '3rem 0', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
          <div style={{ fontSize: '1.2rem', marginBottom: '0.5rem', color: '#94a3b8' }}>אין פריטים להזמנה זו</div>
          <div>לחץ על הכפתור למטה כדי להתחיל להוסיף פריטים</div>
        </div>
      )}
      
      {detailsModalItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: 'white', padding: '2.5rem', borderRadius: '16px', width: '90%', maxWidth: '550px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.4rem' }}>פרטים נוספים לפריט</h3>
              <button onClick={() => setDetailsModalItem(null)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#64748b' }}>&times;</button>
            </div>
            
            <div style={{ margin: '1.5rem 0' }}>
              <p style={{ fontWeight: 'bold', color: '#334155', marginBottom: '0.5rem' }}>פירוט חיובים לפריט זה:</p>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', color: '#1e293b', marginBottom: '1.5rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0' }}>
                {(() => {
                  const dressName = detailsModalItem.dressItem?.dress?.name || detailsModalItem.description;
                  if (!order || !order.obligations) return <span style={{ color: '#64748b' }}>לא נמצאו חיובים מפורטים</span>;
                  
                  // Filter obligations by the unique item ID that is now embedded in the description
                  const searchStr = `(פריט #${detailsModalItem.id})`;
                  const relatedObligations = order.obligations.filter(obs => 
                    obs.isManual === false && 
                    obs.description && 
                    obs.description.includes(searchStr) &&
                    obs.amount >= 0
                  );
                  
                  if (relatedObligations.length === 0) return <span style={{ color: '#64748b' }}>אין חיובים מפורטים לפריט זה</span>;
                  
                  return (
                    <table style={{ width: '100%', fontSize: '0.95rem', textAlign: 'right', borderCollapse: 'collapse' }}>
                      <tbody>
                        {relatedObligations.map((obs, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '0.6rem 0.2rem', fontWeight: '500' }}>{obs.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || (obs.description.includes('תיקון') ? 'תיקון' : 'חיוב')}</td>
                            <td style={{ padding: '0.6rem 0.2rem', color: '#64748b', fontSize: '0.85rem' }}>{obs.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '')}</td>
                            <td style={{ padding: '0.6rem 0.2rem', fontWeight: 'bold', color: '#16a34a' }}>₪{obs.amount}</td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 'bold', background: '#f1f5f9' }}>
                          <td colSpan="2" style={{ padding: '0.8rem 0.5rem', borderRadius: '0 8px 8px 0' }}>סה"כ לפריט</td>
                          <td style={{ padding: '0.8rem 0.5rem', color: '#16a34a', borderRadius: '8px 0 0 8px' }}>₪{relatedObligations.reduce((sum, obs) => sum + obs.amount, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <p style={{ margin: '0 0 0.2rem 0', color: '#64748b', fontSize: '0.85rem' }}>תאריך הוספה</p>
                  <p style={{ margin: 0, fontWeight: '600', color: '#1e293b' }}>
                    {new Date(detailsModalItem.createdAt || new Date()).toLocaleDateString('he-IL')} {new Date(detailsModalItem.createdAt || new Date()).toLocaleTimeString('he-IL')}
                  </p>
                </div>
              </div>
              
              <p style={{ fontWeight: 'bold', color: '#334155', marginBottom: '0.5rem' }}>היסטוריית שינויים:</p>
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '10px', color: '#1e293b', minHeight: '80px', maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0' }}>
                {detailsModalItem.loadingLogs ? (
                  <div style={{ textAlign: 'center', color: '#64748b', padding: '1rem' }}>טוען היסטוריה...</div>
                ) : detailsModalItem.auditLogs && detailsModalItem.auditLogs.length > 0 ? (
                  detailsModalItem.auditLogs.map((log, idx) => {
                    const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
                    let formattedChanges = null;
                    try {
                      const changes = typeof log.changesJson === 'string' ? JSON.parse(log.changesJson) : log.changesJson;
                      const items = [];
                      for (const [key, value] of Object.entries(changes)) {
                        if (value === null || value === undefined || value === '') continue;
                        if (key === 'id' || key === 'orderId' || key === 'dressItemId' || key === 'deletedAt' || key === 'barcode' || key === 'barcodePrefix') continue;
                        if (typeof value === 'boolean' && value === false && log.action === 'CREATE') continue; // Skip default falses in CREATE
                        
                        const label = FIELD_TRANSLATIONS[key] || key;
                        
                        if (value && typeof value === 'object' && ('from' in value || 'to' in value)) {
                           const fromStr = typeof value.from === 'boolean' ? (value.from ? 'כן' : 'לא') : String(value.from || '-');
                           const toStr = typeof value.to === 'boolean' ? (value.to ? 'כן' : 'לא') : String(value.to || '-');
                           if (fromStr === toStr) continue;
                           items.push(
                             <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', padding: '0.3rem 0' }}>
                               <strong style={{ color: '#475569', minWidth: '90px' }}>{label}:</strong>
                               <span style={{ textDecoration: 'line-through', color: '#dc2626', background: '#fee2e2', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.9rem' }}>{fromStr}</span>
                               <span style={{ color: '#94a3b8' }}>➜</span>
                               <span style={{ color: '#16a34a', fontWeight: 'bold', background: '#dcfce7', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.9rem' }}>{toStr}</span>
                             </div>
                           );
                        } else {
                           const valStr = typeof value === 'boolean' ? (value ? 'כן' : 'לא') : String(value);
                           items.push(
                             <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.95rem', padding: '0.3rem 0' }}>
                               <strong style={{ color: '#475569', minWidth: '90px' }}>{label}:</strong>
                               <span style={{ color: '#2563eb', fontWeight: '500', background: '#dbeafe', padding: '0.2rem 0.6rem', borderRadius: '6px', fontSize: '0.9rem' }}>{valStr}</span>
                             </div>
                           );
                        }
                      }
                      if (items.length > 0) {
                        formattedChanges = <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem', background: 'white', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>{items}</div>;
                      } else {
                        formattedChanges = <div style={{ fontSize: '0.9rem', color: '#64748b', fontStyle: 'italic', marginTop: '0.5rem' }}>אין שינויים רלוונטיים להצגה</div>;
                      }
                    } catch (e) {
                      formattedChanges = <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', wordBreak: 'break-all', marginTop: '0.5rem', background: '#f1f5f9', padding: '0.5rem', borderRadius: '6px' }}>{log.changesJson}</div>;
                    }
                    
                    return (
                      <div key={idx} style={{ marginBottom: '1.2rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', transition: 'background-color 0.2s', padding: '0.8rem', borderRadius: '8px' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f1f5f9'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '500' }}>
                            {new Date(log.createdAt).toLocaleDateString('he-IL')} 
                            <span style={{ color: '#cbd5e1', margin: '0 8px' }}>|</span> 
                            {new Intl.DateTimeFormat('he-IL-u-ca-hebrew', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(log.createdAt))}
                            <span style={{ color: '#cbd5e1', margin: '0 8px' }}>|</span>
                            {new Date(log.createdAt).toLocaleTimeString('he-IL', { timeStyle: 'short' })}
                          </span>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#334155', background: '#e2e8f0', padding: '4px 10px', borderRadius: '12px' }}>{actionLabel}</span>
                        </div>
                        {formattedChanges}
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#64748b', fontStyle: 'italic' }}>אין היסטוריית שינויים להצגה</div>
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'left', marginTop: '2rem' }}>
              <button 
                onClick={() => setDetailsModalItem(null)}
                style={{ padding: '0.8rem 2rem', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#cbd5e1'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e2e8f0'}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {capacityModalItem && (
        <ItemCapacityModal 
          item={capacityModalItem} 
          order={order} 
          isOpen={true} 
          onClose={() => setCapacityModalItem(null)} 
        />
      )}

      <div style={{ marginTop: '2rem', textAlign: 'right' }}>
        <button
          onClick={handleAddItem}
          style={{
            padding: '0.8rem 1.8rem',
            background: 'linear-gradient(to right, #2563eb, #3b82f6)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1.05rem',
            boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.6rem'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)';
          }}
          title="הוסף פריט חדש להזמנה"
        >
          <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> 
          <span>הוסף פריט חדש</span>
        </button>
      </div>
        </>
      )}
    </div>
  );
}
