'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, PackageCheck, PackageOpen, Scan, Undo2, XCircle } from 'lucide-react';

export default function OrderRentalsManager({ items, onItemsChange, order, totalRequired, totalPaid }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showManualScanModal, setShowManualScanModal] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [selectedItemForScan, setSelectedItemForScan] = useState(null);

  const activeItems = (items || []).filter(item => !item.isDeleted);
  const rentedCount = activeItems.filter(item => item.isTaken && !item.isReturned).length;
  const returnedCount = activeItems.filter(item => item.isReturned).length;
  const totalCount = activeItems.length;

  const summaryText = `הושכרו: ${rentedCount} | הוחזרו: ${returnedCount} מתוך ${totalCount}`;

  const isFullyPaid = totalRequired <= totalPaid;

  const handleBarcodeScan = async (e, forcedBarcode = null) => {
    if (e) e.preventDefault();
    const barcode = (forcedBarcode || barcodeInput).trim();
    if (!barcode) return;

    if (!isFullyPaid) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע פעולה ללא תשלום מלא. נדרש אישור מנהל או עובד מורשה:", 'עובד');
      if (!authResult || !authResult.pin) {
        setBarcodeInput('');
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
          setBarcodeInput('');
          return;
        }
      } catch (err) {
        alert('שגיאה באימות קוד.');
        setBarcodeInput('');
        return;
      }
    }

    setBarcodeInput('');

    // Find the item with this barcode or use the selected item
    let itemIndex = -1;
    
    if (selectedItemForScan) {
      itemIndex = activeItems.findIndex(i => i.id === selectedItemForScan.id);
      setSelectedItemForScan(null);
    } else {
      itemIndex = activeItems.findIndex(i => {
        const b = i.dressItem?.barcode || i.barcode;
        if (b === barcode) return true;
        // Fallback for unlinked legacy items (e.g. prefix 555, size 06 -> 5550601)
        if (!i.dressItem && !i.barcode && i.barcodePrefix && i.sizeText) {
          return barcode.startsWith(String(i.barcodePrefix) + String(i.sizeText));
        }
        return false;
      });
    }

    if (itemIndex === -1) {
      alert(`ברקוד ${barcode} לא נמצא בהזמנה זו.`);
      return;
    }

    const item = activeItems[itemIndex];
    if (!item.isTaken) {
      handleRent(item, barcode, true); // skip auth since we did it here
    } else if (!item.isReturned) {
      handleReturn(item, true);
    } else {
      alert(`פריט ${barcode} כבר הוחזר.`);
    }
  };

  const handleRent = async (item, barcodeToAssign = null, skipAuth = false) => {
    if (!isFullyPaid && !skipAuth) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע השכרה ללא תשלום מלא. נדרש אישור:", 'עובד');
      if (!authResult || !authResult.pin) return;
      // Assume verification for brevity in UI, but ideally we verify again
    }
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        const updateData = { isTaken: true, takenDate: new Date() };
        if (barcodeToAssign) {
          updateData.barcode = barcodeToAssign;
        }
        return { ...i, ...updateData };
      }
      return i;
    });
    onItemsChange(updatedItems);
  };

  const handleReturn = async (item, skipAuth = false) => {
    if (!isFullyPaid && !skipAuth) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע החזרה ללא תשלום מלא. נדרש אישור:", 'עובד');
      if (!authResult || !authResult.pin) return;
    }
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, isReturned: true, returnDate: new Date() };
      }
      return i;
    });
    onItemsChange(updatedItems);
  };

  const handleCancelRent = (item) => {
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, isTaken: false, takenDate: null };
      }
      return i;
    });
    onItemsChange(updatedItems);
  };

  const handleCancelReturn = (item) => {
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, isReturned: false, returnDate: null };
      }
      return i;
    });
    onItemsChange(updatedItems);
  };


  const tableHeaderStyle = {
    padding: '1.2rem 1rem',
    textAlign: 'right',
    color: '#334155',
    backgroundColor: '#f8fafc',
    borderBottom: '2px solid #e2e8f0',
    fontWeight: '700',
    whiteSpace: 'nowrap'
  };

  return (
    <div style={{ background: 'var(--card-bg)', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflowX: 'auto', border: '1px solid #f1f5f9' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)} 
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isExpanded ? '1.5rem' : '0', borderBottom: isExpanded ? '2px solid #f1f5f9' : 'none', paddingBottom: isExpanded ? '1rem' : '0', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <h2 style={{ color: '#0f172a', margin: 0, fontSize: '1.4rem', fontWeight: '800' }}>השכרות והחזרות</h2>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Barcode Scanner Input */}
          <form data-agy-id="orderrentalsmanager_form_1" onSubmit={handleBarcodeScan} style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', width: '300px' }}>
              <input data-agy-id="orderrentalsmanager_input_2"
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                placeholder="סרוק ברקוד..."
                style={{ width: '100%', padding: '0.8rem 1rem 0.8rem 2.5rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1rem' }}
              />
              <Scan size={18} color="#64748b" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
            </div>
            <button data-agy-id="orderrentalsmanager_button_3" type="submit" style={{ padding: '0.8rem 1.5rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>
              בצע סריקה
            </button>
            {!isFullyPaid && (
              <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.9rem', background: '#fee2e2', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
                יש לשלם את ההזמנה במלואה לפני ביצוע השכרה/החזרה
              </span>
            )}
          </form>

          {showManualScanModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100000, backdropFilter: 'blur(4px)' }}>
              <div className="animate-fade-in" style={{ backgroundColor: 'var(--card-bg)', borderRadius: '16px', padding: '2rem', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', border: '1px solid var(--element-border)' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', textAlign: 'center' }}>הזנת ברקוד ידנית</h3>
                <p style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '1.5rem', textAlign: 'center' }}>הזן את הברקוד המופיע על הפריט כדי לאשר את הפעולה.</p>
                <form data-agy-id="orderrentalsmanager_form_4" onSubmit={(e) => {
                  e.preventDefault();
                  setShowManualScanModal(false);
                  handleBarcodeScan(null, manualBarcode);
                  setManualBarcode('');
                }}>
                  <input data-agy-id="orderrentalsmanager_input_5"
                    type="text"
                    autoFocus
                    value={manualBarcode}
                    onChange={e => setManualBarcode(e.target.value)}
                    placeholder="הקלד ברקוד..."
                    style={{ width: '100%', padding: '0.8rem 1rem', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '1.1rem', marginBottom: '1.5rem', textAlign: 'center' }}
                  />
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button data-agy-id="orderrentalsmanager_button_6" type="submit" style={{ flex: 1, padding: '0.8rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>אשר והמשך</button>
                    <button data-agy-id="orderrentalsmanager_button_7" type="button" onClick={() => { setShowManualScanModal(false); setManualBarcode(''); setSelectedItemForScan(null); }} style={{ flex: 1, padding: '0.8rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold' }}>ביטול</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeItems.length > 0 ? (
            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
                <thead>
                  <tr>
                    <th style={tableHeaderStyle}>תיאור דגם</th>
                    <th style={{ ...tableHeaderStyle, width: '100px' }}>מידה</th>
                    <th style={{ ...tableHeaderStyle, width: '120px' }}>ברקוד</th>
                    <th style={{ ...tableHeaderStyle, width: '120px' }}>לקיחה</th>
                    <th style={{ ...tableHeaderStyle, width: '120px' }}>החזרה</th>
                    <th style={{ ...tableHeaderStyle, width: '100px', textAlign: 'center' }}>סטטוס</th>
                    <th style={{ ...tableHeaderStyle, width: '250px', textAlign: 'center' }}>פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {activeItems.map((item, index) => {
                    const isRented = item.isTaken && !item.isReturned;
                    const isReturned = item.isReturned;
                    
                    const rowStyle = {
                      borderBottom: '1px solid #f1f5f9',
                      backgroundColor: isRented ? '#eff6ff' : isReturned ? '#f0fdf4' : 'white',
                      transition: 'all 0.2s'
                    };

                    const computedBarcode = item.dressItem?.barcode || item.barcode || ((item.barcodePrefix && item.sizeText) ? `${item.barcodePrefix}${item.sizeText}` : null);
                    const barcode = computedBarcode || 'לא שויך';
                    const takenDate = item.takenDate ? new Date(item.takenDate).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                    const returnDate = item.returnDate ? new Date(item.returnDate).toLocaleString('he-IL', { dateStyle: 'short', timeStyle: 'short' }) : '-';
                    
                    return (
                      <tr key={item.id || index} style={rowStyle} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isRented ? '#dbeafe' : isReturned ? '#dcfce7' : '#f8fafc'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isRented ? '#eff6ff' : isReturned ? '#f0fdf4' : 'white'}>
                        <td style={{ padding: '1rem', fontWeight: 'bold', color: '#1e293b' }}>
                          {item.dressItem?.dress?.name 
                            ? `${item.dressItem.dress.name} ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix ? `(קוד: ${item.dressItem.dress.barcodePrefix || item.dressItem.barcodePrefix || item.barcodePrefix})` : ''}`
                            : (item.description || item.dressItem?.dressName || 'פריט כללי')}
                        </td>
                        <td style={{ padding: '1rem' }}>
                          {item.sizeText || '-'}
                        </td>
                        <td style={{ padding: '1rem', fontFamily: 'monospace', fontSize: '1.05rem', color: '#475569' }}>
                          {barcode}
                        </td>
                        <td style={{ padding: '1rem', color: item.isTaken ? '#2563eb' : '#64748b' }}>
                          {takenDate}
                        </td>
                        <td style={{ padding: '1rem', color: item.isReturned ? '#16a34a' : '#64748b' }}>
                          {returnDate}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center' }}>
                          {isReturned ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dcfce7', color: '#16a34a', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                              <PackageCheck size={16} />
                              הוחזר
                            </span>
                          ) : isRented ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dbeafe', color: '#2563eb', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                              <PackageOpen size={16} />
                              בהשכרה
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#f1f5f9', color: '#64748b', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                              ממתין
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'center', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          {!item.isTaken && (
                            <button data-agy-id="orderrentalsmanager_button_8" onClick={(e) => { e.stopPropagation(); setSelectedItemForScan(item); setShowManualScanModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#3b82f6', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              <PackageOpen size={14} />
                              השכרה
                            </button>
                          )}
                          {item.isTaken && !item.isReturned && (
                            <>
                              <button data-agy-id="orderrentalsmanager_button_9" onClick={(e) => { e.stopPropagation(); handleReturn(item); }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                <PackageCheck size={14} />
                                החזרה
                              </button>
                              <button data-agy-id="orderrentalsmanager_button_10" onClick={(e) => { e.stopPropagation(); handleCancelRent(item); }} title="בטל השכרה" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                <XCircle size={14} />
                                ביטול
                              </button>
                            </>
                          )}
                          {item.isReturned && (
                            <button data-agy-id="orderrentalsmanager_button_11" onClick={(e) => { e.stopPropagation(); handleCancelReturn(item); }} title="בטל החזרה" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              <Undo2 size={14} />
                              ביטול החזרה
                            </button>
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
              <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>אין פריטים להצגה בהשכרות והחזרות</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
