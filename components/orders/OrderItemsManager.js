'use client';

import React, { useState } from 'react';
import OrderModelSelector from './OrderModelSelector';
import OrderSizeSelector from './OrderSizeSelector';

export default function OrderItemsManager({ orderId, order, items, onItemsChange, onOrderUpdated }) {
  const [showDeleted, setShowDeleted] = useState(false);
  const [detailsModalItem, setDetailsModalItem] = useState(null);
  const [savingItemIndex, setSavingItemIndex] = useState(null);
  const [settings, setSettings] = useState({});

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
          isWeekdayEvent: order.isWeekdayEvent,
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
            isWeekdayEvent: order.isWeekdayEvent,
            isAbroad: order.isAbroad,
            fromDate: order.fromDate,
            toDate: order.toDate,
            orderId: order.orderId
          })
        });
        const validateData = await validateRes.json();
        if (!validateData.valid) {
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
    onItemsChange([...items, newItem]);
  };

  const visibleItems = showDeleted ? items : items.filter(item => !item.isDeleted);

  const tableHeaderStyle = {
    padding: '1rem',
    textAlign: 'right',
    color: '#475569',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: '600',
    whiteSpace: 'nowrap'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    textAlign: 'center',
    transition: 'border-color 0.2s',
    outline: 'none'
  };

  return (
    <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)', overflowX: 'auto', border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '2px solid #f1f5f9', paddingBottom: '1rem' }}>
        <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>פירוט פריטים</h2>
        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem', color: '#475569', background: '#f8fafc', padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <input 
            type="checkbox" 
            checked={showDeleted} 
            onChange={(e) => setShowDeleted(e.target.checked)} 
            style={{ marginLeft: '0.5rem', width: '1rem', height: '1rem' }}
          />
          הצג מחוקים
        </label>
      </div>
      
      {items && items.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, width: '40px' }}>מחק</th>
              <th style={tableHeaderStyle}>תיאור דגם</th>
              <th style={{ ...tableHeaderStyle, width: '150px' }}>מידה</th>
              <th style={{ ...tableHeaderStyle, width: '60px' }}>צוואר</th>
              <th style={{ ...tableHeaderStyle, width: '60px' }}>שרוול</th>
              <th style={{ ...tableHeaderStyle, width: '60px' }}>אורך</th>
              <th style={tableHeaderStyle}>פירוט תיקונים</th>
              <th style={{ ...tableHeaderStyle, width: '80px' }}>בוצע תיקון?</th>
              <th style={{ ...tableHeaderStyle, width: '40px' }}>פרטים</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, originalIndex) => {
              if (!showDeleted && item.isDeleted) return null;
              
              const isDeletedRow = item.isDeleted;
              const isRented = item.isTaken && !item.isReturned;
              const isReturned = item.isReturned;
              
              const rowStyle = {
                borderBottom: '1px solid #f5f5f5',
                opacity: isDeletedRow ? 0.5 : 1,
                backgroundColor: isDeletedRow ? '#fafafa' : isRented ? '#e3f2fd' : isReturned ? '#e8f5e9' : 'transparent',
                transition: 'all 0.2s',
                fontWeight: isRented ? 'bold' : 'normal'
              };

              return (
                <tr key={item.id || originalIndex} style={rowStyle} onMouseEnter={(e) => !isDeletedRow && (e.currentTarget.style.backgroundColor = '#f9fcff')} onMouseLeave={(e) => !isDeletedRow && (e.currentTarget.style.backgroundColor = isRented ? '#e3f2fd' : isReturned ? '#e8f5e9' : 'transparent')}>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <button 
                      onClick={() => toggleDeleted(originalIndex)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem',
                        color: isDeletedRow ? '#999' : '#e53935'
                      }}
                      title={isDeletedRow ? 'שחזר פריט' : 'מחק פריט'}
                    >
                      {isDeletedRow ? '↺' : '×'}
                    </button>
                  </td>
                  <td style={{ padding: '0.5rem', fontWeight: 'bold', color: '#333' }}>
                    {item.isNew ? (
                      <OrderModelSelector 
                        value={item} 
                        onChange={(model) => handleModelChange(originalIndex, model)} 
                      />
                    ) : (
                      item.dressItem?.dress?.name || item.description || 'פריט כללי'
                    )}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
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
                        style={{ ...inputStyle, backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                      />
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={item.neckAlteration === 1 || item.neckAlteration === true} 
                      onChange={(e) => handleItemChange(originalIndex, 'neckAlteration', e.target.checked ? 1 : 0)}
                      disabled={!item.isNew}
                      style={{ transform: 'scale(1.5)', cursor: !item.isNew ? 'not-allowed' : 'pointer', opacity: !item.isNew ? 0.6 : 1 }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={item.sleeveAlteration === 1 || item.sleeveAlteration === true} 
                      onChange={(e) => handleItemChange(originalIndex, 'sleeveAlteration', e.target.checked ? 1 : 0)}
                      disabled={!item.isNew}
                      style={{ transform: 'scale(1.5)', cursor: !item.isNew ? 'not-allowed' : 'pointer', opacity: !item.isNew ? 0.6 : 1 }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input 
                      type="number" 
                      value={item.lengthAlteration || ''} 
                      onChange={(e) => handleItemChange(originalIndex, 'lengthAlteration', e.target.value)}
                      disabled={!item.isNew}
                      style={{ ...inputStyle, backgroundColor: !item.isNew ? '#f5f5f5' : 'white', cursor: !item.isNew ? 'not-allowed' : 'text' }}
                      placeholder="-"
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <input 
                      type="text" 
                      value={item.alterationDetails || item.repairs || ''} 
                      onChange={(e) => handleItemChange(originalIndex, 'alterationDetails', e.target.value)}
                      style={{ ...inputStyle, textAlign: 'right' }}
                      placeholder="הערות לתיקון..."
                    />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <input 
                      type="checkbox" 
                      checked={item.alterationDone || false} 
                      onChange={(e) => handleItemChange(originalIndex, 'alterationDone', e.target.checked)}
                      style={{ transform: 'scale(1.5)', cursor: 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    {item.isNew ? (
                      <button 
                        onClick={() => handleConfirmItem(originalIndex)}
                        disabled={savingItemIndex === originalIndex}
                        style={{ 
                          background: '#4caf50', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px',
                          cursor: savingItemIndex === originalIndex ? 'not-allowed' : 'pointer', 
                          padding: '0.4rem 0.8rem',
                          fontWeight: 'bold',
                          opacity: savingItemIndex === originalIndex ? 0.7 : 1
                        }}
                        title="אישור ושמירת פריט"
                      >
                        {savingItemIndex === originalIndex ? '⏳' : '✔️'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => setDetailsModalItem(item)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.4rem', color: '#1976d2' }}
                        title="פרטים נוספים"
                      >
                        ℹ️
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>אין פריטים בהזמנה זו.</div>
      )}
      
      {detailsModalItem && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl' }}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h3 style={{ marginTop: 0, color: 'var(--primary-color)', borderBottom: '2px solid #eee', paddingBottom: '0.5rem' }}>פרטים נוספים לפריט</h3>
            
            <div style={{ margin: '1.5rem 0' }}>
              <p style={{ fontWeight: 'bold' }}>תאריך הוספה:</p>
              <p style={{ marginBottom: '1rem', color: '#555' }}>
                {new Date(detailsModalItem.createdAt || new Date()).toLocaleDateString('he-IL')} {new Date(detailsModalItem.createdAt || new Date()).toLocaleTimeString('he-IL')}
              </p>
              
              <p style={{ fontWeight: 'bold' }}>היסטוריית שינויים:</p>
              <div style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '8px', color: '#666', minHeight: '80px', maxHeight: '150px', overflowY: 'auto' }}>
                {detailsModalItem.auditLogs && detailsModalItem.auditLogs.length > 0 ? (
                  detailsModalItem.auditLogs.map((log, idx) => (
                    <div key={idx} style={{ marginBottom: '0.5rem', borderBottom: '1px solid #ddd', paddingBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', color: '#999' }}>{new Date(log.createdAt).toLocaleString('he-IL')}</span><br/>
                      {log.action}: {log.changesJson}
                    </div>
                  ))
                ) : (
                  "אין היסטוריית שינויים להצגה"
                )}
              </div>
            </div>
            
            <div style={{ textAlign: 'left' }}>
              <button 
                onClick={() => setDetailsModalItem(null)}
                style={{ padding: '0.6rem 1.5rem', background: '#e0e0e0', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'right' }}>
        <button
          onClick={handleAddItem}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '1rem',
            boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
          title="הוסף פריט חדש"
        >
          <span style={{ fontSize: '1.2rem' }}>+</span> הוסף פריט
        </button>
      </div>
    </div>
  );
}
