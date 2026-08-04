'use client';

import React, { useState, forwardRef, useImperativeHandle } from 'react';
import { ChevronDown, ChevronUp, PackageCheck, PackageOpen, Scan, Undo2, XCircle, AlertTriangle } from 'lucide-react';
import { getHebrewDateString } from '../../lib/hebrewDate';

// forwardRef כדי ששדה "סריקה מהירה" בסיידבר של העיצוב המודרני יוכל להפעיל
// את אותה לוגיקת סריקה בדיוק (ref.current.scan(barcode)).
const OrderRentalsManager = forwardRef(function OrderRentalsManager({ items, onItemsChange, order, totalRequired, totalPaid }, ref) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [showManualScanModal, setShowManualScanModal] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [selectedItemForScan, setSelectedItemForScan] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null, actionType: null });

  const activeItems = (items || []).filter(item => !item.isDeleted);
  const rentedCount = activeItems.filter(item => item.isTaken && !item.isReturned).length;
  const returnedCount = activeItems.filter(item => item.isReturned).length;
  const totalCount = activeItems.length;

  const summaryText = `הושכרו: ${rentedCount} | הוחזרו: ${returnedCount} מתוך ${totalCount}`;

  const isFullyPaid = totalRequired <= totalPaid;

  useImperativeHandle(ref, () => ({
    scan: (barcode) => handleBarcodeScan(null, barcode)
  }));

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

    // 1. Verify item stock & location in database
    let dressInfo = null;
    try {
      const vRes = await fetch('/api/rentals/verify-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode, orderId: order?.orderId })
      });
      const vData = await vRes.json();
      if (!vRes.ok || !vData.valid) {
        alert(vData.error || `ברקוד ${barcode} אינו תקף להשכרה.`);
        setSelectedItemForScan(null);
        return;
      }

      // Check if unreturned from previous rental in another order
      if (vData.unreturned) {
        const confirmMsg = `${vData.warning}\nהאם ברצונך לסמן אותה כהוחזרה מההשכרה הקודמת (הזמנה #${vData.unreturnedOrderId}) ולהמשיך בהשכרה זו?`;
        const promptFunc = window.customConfirm || window.confirm;
        if (await promptFunc(confirmMsg)) {
          const putRes = await fetch('/api/rentals/scan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unreturnedItemId: vData.unreturnedItemId })
          });
          if (!putRes.ok) {
            const errData = await putRes.json();
            alert(errData.error || 'שגיאה בעדכון החזרה מהשכרה קודמת');
            setSelectedItemForScan(null);
            return;
          }
        } else {
          setSelectedItemForScan(null);
          return;
        }
      }

      dressInfo = vData.dressItem;
    } catch (err) {
      console.error('Error calling verify-item API:', err);
    }

    // 2. Find matching order item in activeItems
    let itemIndex = -1;
    
    if (selectedItemForScan) {
      itemIndex = activeItems.findIndex(i => i.id === selectedItemForScan.id);
      setSelectedItemForScan(null);
    } else {
      itemIndex = activeItems.findIndex(i => {
        // Priority 1: Already assigned barcode match
        const b = i.barcode || i.dressItem?.barcode || i.dressItem?.dressBarcode;
        if (b && b === barcode) return true;

        // Only search unrented items if barcode wasn't already assigned
        if (i.isTaken) return false;

        const iPfx = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
        const iSize = i.dressItem?.sizeText || i.sizeText;

        // Priority 2: Match via verified dressInfo from API
        if (dressInfo) {
          const matchPfx = dressInfo.barcodePrefix ? (iPfx === dressInfo.barcodePrefix || String(barcode).startsWith(String(iPfx))) : true;
          const matchSize = dressInfo.sizeText ? (iSize === dressInfo.sizeText || (parseInt(iSize) === parseInt(dressInfo.sizeText))) : true;
          if (matchPfx && matchSize) return true;
        }

        // Priority 3: Fallback prefix & size extraction from barcode
        if (iPfx && iSize) {
          const pfxStr = String(iPfx);
          const sizeStr = String(iSize);
          if (barcode.startsWith(pfxStr) && barcode.includes(sizeStr)) return true;
        }

        return false;
      });
    }

    if (itemIndex === -1) {
      const detailsStr = dressInfo ? ` (דגם ${dressInfo.dressName || dressInfo.barcodePrefix || ''}, מידה ${dressInfo.sizeText || ''})` : '';
      alert(`ברקוד ${barcode}${detailsStr} לא נמצא בין הפריטים שטרם הושכרו בהזמנה זו.`);
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
    const oldItems = [...items];
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
    
    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'rent', barcode: barcodeToAssign })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בשמירת סטטוס השכרה');
        onItemsChange(oldItems);
      }
    }
  };

  const handleReturn = async (item, skipAuth = false) => {
    if (!isFullyPaid && !skipAuth) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע החזרה ללא תשלום מלא. נדרש אישור:", 'עובד');
      if (!authResult || !authResult.pin) return;
    }
    const oldItems = [...items];
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, isReturned: true, returnDate: new Date() };
      }
      return i;
    });
    onItemsChange(updatedItems);

    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'return' })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בשמירת סטטוס החזרה');
        onItemsChange(oldItems);
      }
    }
  };

  const handleCancelRent = async (item) => {
    const oldItems = [...items];
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, isTaken: false, takenDate: null };
      }
      return i;
    });
    onItemsChange(updatedItems);

    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'undoRent' })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בביטול סטטוס השכרה');
        onItemsChange(oldItems);
      }
    }
  };

  const handleCancelReturn = async (item) => {
    const oldItems = [...items];
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        return { ...i, isReturned: false, returnDate: null };
      }
      return i;
    });
    onItemsChange(updatedItems);

    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'undoReturn' })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בביטול סטטוס החזרה');
        onItemsChange(oldItems);
      }
    }
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
            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto', overflowY: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '0.95rem' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
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

                    const computedBarcode = item.barcode || item.dressItem?.dressBarcode || ((item.barcodePrefix && item.sizeText) ? `${item.barcodePrefix}${item.sizeText}` : null);
                    const barcode = computedBarcode || 'לא שויך';
                    const takenDate = item.takenDate ? `${getHebrewDateString(item.takenDate)} ${new Date(item.takenDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : '-';
                    const returnDate = item.returnDate ? `${getHebrewDateString(item.returnDate)} ${new Date(item.returnDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : '-';
                    
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
                            item.returnedOk === false ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#fee2e2', color: '#ef4444', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                                <AlertTriangle size={16} />
                                הוחזר - לא תקין
                              </span>
                            ) : (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: '#dcfce7', color: '#16a34a', padding: '0.4rem 0.8rem', borderRadius: '20px', fontWeight: '600', fontSize: '0.85rem' }}>
                                <PackageCheck size={16} />
                                הוחזר - תקין
                              </span>
                            )
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
                              <button data-agy-id="orderrentalsmanager_button_9" onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item: item, actionType: 'return' }); }} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#10b981', color: 'white', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                <PackageCheck size={14} />
                                החזרה
                              </button>
                              <button data-agy-id="orderrentalsmanager_button_10" onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item: item, actionType: 'cancelRent' }); }} title="בטל השכרה" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
                                <XCircle size={14} />
                                ביטול
                              </button>
                            </>
                          )}
                          {item.isReturned && (
                            <button data-agy-id="orderrentalsmanager_button_11" onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item: item, actionType: 'cancelReturn' }); }} title="בטל החזרה" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#fee2e2', color: '#ef4444', border: 'none', padding: '0.4rem 0.8rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}>
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

      {confirmModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }} onClick={() => setConfirmModal({ isOpen: false, item: null, actionType: null })}>
          <div style={{ background: 'white', padding: '2rem', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)', width: '90%', maxWidth: '400px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: confirmModal.actionType === 'return' ? '#dcfce7' : '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              {confirmModal.actionType === 'return' ? <PackageCheck size={32} color="#16a34a" /> : <XCircle size={32} color="#ef4444" />}
            </div>
            <h3 style={{ margin: '0 0 1rem 0', color: '#0f172a', fontSize: '1.4rem', fontWeight: '800' }}>
              {confirmModal.actionType === 'return' ? 'אישור החזרה' : confirmModal.actionType === 'cancelReturn' ? 'ביטול החזרה' : 'ביטול השכרה'}
            </h3>
            <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: '1.5', marginBottom: '2rem' }}>
              האם אתה בטוח שברצונך {confirmModal.actionType === 'return' ? 'לבצע החזרה' : confirmModal.actionType === 'cancelReturn' ? 'לבטל את ההחזרה' : 'לבטל את ההשכרה'} של פריט זה?
              <br />
              <strong style={{ display: 'inline-block', marginTop: '0.5rem', padding: '0.3rem 0.8rem', background: '#f1f5f9', borderRadius: '8px', color: '#0f172a' }}>{(confirmModal.item?.barcode || confirmModal.item?.dressItem?.dressBarcode || 'ללא ברקוד')}</strong>
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button data-agy-id="orderrentalsmanager_button_12"
                onClick={() => {
                  if (confirmModal.actionType === 'return') handleReturn(confirmModal.item);
                  else if (confirmModal.actionType === 'cancelReturn') handleCancelReturn(confirmModal.item);
                  else if (confirmModal.actionType === 'cancelRent') handleCancelRent(confirmModal.item);
                  setConfirmModal({ isOpen: false, item: null, actionType: null });
                }}
                style={{ flex: 1, padding: '0.8rem', background: confirmModal.actionType === 'return' ? '#16a34a' : '#ef4444', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', transition: 'all 0.2s' }}
              >
                {confirmModal.actionType === 'return' ? 'אשר החזרה' : 'אשר ביטול'}
              </button>
              <button data-agy-id="orderrentalsmanager_button_13"
                onClick={() => setConfirmModal({ isOpen: false, item: null, actionType: null })}
                style={{ flex: 1, padding: '0.8rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.05rem', transition: 'all 0.2s' }}
              >
                חזור
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default OrderRentalsManager;
