'use client';

import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import {
  ScanLine, PackageCheck, PackageOpen, Undo2, XCircle, X, Check, Scissors, AlertTriangle
} from 'lucide-react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

/**
 * טאב "השכרות והחזרות" בעיצוב המודרני — פורט מלא של OrderRentalsManager:
 * סריקת ברקוד (כולל אימות מלאי, טיפול בפריט שלא הוחזר מהזמנה קודמת, ואישור עובד
 * כשההזמנה לא שולמה במלואה), השכרה עם הזנת ברקוד בשורה, החזרה וביטולים.
 * חשוף דרך ref: scan(barcode) — משמש את שדה "סריקה מהירה" בסיידבר.
 */
const ModernRentalsManager = forwardRef(function ModernRentalsManager({ items, onItemsChange, order, totalRequired, totalPaid }, ref) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [rentingItemId, setRentingItemId] = useState(null); // פריט שנפתחה לו שורת הזנת ברקוד
  const [inlineBarcode, setInlineBarcode] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null, actionType: null });
  const inlineInputRef = useRef(null);

  useEffect(() => {
    if (rentingItemId && inlineInputRef.current) inlineInputRef.current.focus();
  }, [rentingItemId]);

  const activeItems = (items || []).filter(item => !item.isDeleted);
  const rentedCount = activeItems.filter(item => item.isTaken && !item.isReturned).length;
  const returnedCount = activeItems.filter(item => item.isReturned).length;

  const isFullyPaid = totalRequired <= totalPaid;

  useImperativeHandle(ref, () => ({
    scan: (barcode) => handleBarcodeScan(null, barcode)
  }));

  const handleBarcodeScan = async (e, forcedBarcode = null, forcedItem = null) => {
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

    // 1. אימות הפריט מול המלאי בשרת
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
        return;
      }

      // פריט שלא הוחזר מהשכרה קודמת בהזמנה אחרת
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
            return;
          }
        } else {
          return;
        }
      }

      dressInfo = vData.dressItem;
    } catch (err) {
      console.error('Error calling verify-item API:', err);
    }

    // 2. מציאת הפריט המתאים בהזמנה
    let itemIndex = -1;
    if (forcedItem) {
      itemIndex = activeItems.findIndex(i => i.id === forcedItem.id);
    } else {
      itemIndex = activeItems.findIndex(i => {
        const b = i.barcode || i.dressItem?.barcode || i.dressItem?.dressBarcode;
        if (b && b === barcode) return true;
        if (i.isTaken) return false;

        const iPfx = i.dressItem?.dress?.barcodePrefix || i.dressItem?.barcodePrefix || i.barcodePrefix;
        const iSize = i.dressItem?.sizeText || i.sizeText;

        if (dressInfo) {
          const matchPfx = dressInfo.barcodePrefix ? (iPfx === dressInfo.barcodePrefix || String(barcode).startsWith(String(iPfx))) : true;
          const matchSize = dressInfo.sizeText ? (iSize === dressInfo.sizeText || (parseInt(iSize) === parseInt(dressInfo.sizeText))) : true;
          if (matchPfx && matchSize) return true;
        }

        if (iPfx && iSize) {
          if (barcode.startsWith(String(iPfx)) && barcode.includes(String(iSize))) return true;
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
      handleRent(item, barcode, true); // האימות בוצע כבר למעלה
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
    }
    const oldItems = [...items];
    const updatedItems = items.map(i => {
      if (i.id === item.id) {
        const updateData = { isTaken: true, takenDate: new Date() };
        if (barcodeToAssign) updateData.barcode = barcodeToAssign;
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
    onItemsChange(items.map(i => i.id === item.id ? { ...i, isReturned: true, returnDate: new Date() } : i));

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
    onItemsChange(items.map(i => i.id === item.id ? { ...i, isTaken: false, takenDate: null } : i));
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
    onItemsChange(items.map(i => i.id === item.id ? { ...i, isReturned: false, returnDate: null } : i));
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

  const startInlineRent = (item) => {
    setRentingItemId(item.id);
    setInlineBarcode('');
  };

  const confirmInlineRent = async (item) => {
    const barcode = inlineBarcode.trim();
    if (!barcode) { alert('חובה להזין ברקוד'); return; }
    setRentingItemId(null);
    setInlineBarcode('');
    await handleBarcodeScan(null, barcode, item);
  };

  const itemName = (item) => item.dressItem?.dress?.name
    ? item.dressItem.dress.name
    : (item.description || item.dressItem?.dressName || 'פריט כללי');

  const itemHasRepairs = (item) =>
    item.neckAlteration === 1 || item.neckAlteration === true ||
    item.sleeveAlteration === 1 || item.sleeveAlteration === true ||
    (item.lengthAlteration && String(item.lengthAlteration).trim() !== '');

  const fmtDate = (d) => d ? `${getHebrewDateString(d)} ${new Date(d).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}` : null;

  return (
    <>
      {/* הערות ההזמנה — חשוב לראות בזמן מסירת השמלות */}
      {order?.notes && (
        <div className="moc-notes-banner">
          <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: '1px', color: 'var(--moc-warning-text)' }} />
          <div><strong>הערות להזמנה: </strong>{order.notes}</div>
        </div>
      )}

      {!isFullyPaid && (
        <div className="moc-pending-banner">
          <span>יש לשלם את ההזמנה במלואה לפני ביצוע השכרה/החזרה — כל פעולה תדרוש אישור עובד/מנהל.</span>
        </div>
      )}

      {/* סריקה + סיכום */}
      <div className="moc-section-head">
        <span className="moc-hint" style={{ marginLeft: 'auto' }}>
          הושכרו: {rentedCount} · הוחזרו: {returnedCount} מתוך {activeItems.length}
        </span>
        <form onSubmit={handleBarcodeScan} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '260px' }}>
            <input
              type="text"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="סרוק ברקוד — השכרה / החזרה"
              style={{ paddingLeft: '34px' }}
            />
            <ScanLine size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--moc-text-muted)' }} />
          </div>
          <button type="submit" className="moc-btn moc-btn-gold moc-btn-sm">בצע סריקה</button>
        </form>
      </div>

      {activeItems.length > 0 ? (
        <div className="moc-card-panel">
          {activeItems.map((item, index) => {
            const isRented = item.isTaken && !item.isReturned;
            const isReturned = item.isReturned;
            const barcode = item.barcode || item.dressItem?.dressBarcode || null;
            const taken = fmtDate(item.takenDate);
            const returned = fmtDate(item.returnDate);
            const isInlineRenting = rentingItemId === item.id;

            return (
              <div className="moc-rental-item" key={item.id || index}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <div className="moc-title-line">
                    {itemName(item)}
                    {isReturned ? (
                      <span className="moc-badge on-white success"><PackageCheck size={13} /> הוחזר</span>
                    ) : isRented ? (
                      <span className="moc-badge on-white info"><PackageOpen size={13} /> מושכר</span>
                    ) : (
                      <span className="moc-badge on-white neutral">ממתין</span>
                    )}
                    {itemHasRepairs(item) && (
                      <span title={`יש תיקונים${item.alterationDetails ? `: ${item.alterationDetails}` : ''}`} style={{ color: 'var(--moc-warning-text)', display: 'inline-flex' }}>
                        <Scissors size={15} />
                      </span>
                    )}
                  </div>
                  <div className="moc-sub-line">
                    מידה: {item.sizeText || '-'} · {barcode ? <>ברקוד: <span className="moc-mono">{barcode}</span></> : 'טרם נסרק ברקוד'}
                  </div>
                  {(taken || returned) && (
                    <div className="moc-dates-line">
                      {taken && <span><strong>לקיחה:</strong> {taken}</span>}
                      {returned && <span><strong>הוחזר:</strong> {returned}</span>}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {!item.isTaken && !isInlineRenting && (
                    <button className="moc-btn moc-btn-gold moc-btn-sm" onClick={() => startInlineRent(item)}>
                      <PackageOpen size={14} /> השכרה
                    </button>
                  )}

                  {isInlineRenting && (
                    <form
                      onSubmit={(e) => { e.preventDefault(); confirmInlineRent(item); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <input
                        ref={inlineInputRef}
                        type="text"
                        value={inlineBarcode}
                        onChange={(e) => setInlineBarcode(e.target.value)}
                        placeholder="סרוק ברקוד"
                        style={{ width: '140px', direction: 'ltr' }}
                      />
                      <button type="submit" className="moc-btn moc-btn-gold moc-btn-sm">אשר</button>
                      <button type="button" className="moc-icon-btn-plain" title="ביטול"
                        onClick={() => { setRentingItemId(null); setInlineBarcode(''); }}>
                        <X size={16} />
                      </button>
                    </form>
                  )}

                  {isRented && (
                    <>
                      <div className="moc-return-toggle">
                        <button className="good" onClick={() => setConfirmModal({ isOpen: true, item, actionType: 'return' })}>
                          <Check size={14} /> החזרה
                        </button>
                      </div>
                      <button className="moc-btn moc-btn-danger-soft moc-btn-sm" title="ביטול השכרה"
                        onClick={() => setConfirmModal({ isOpen: true, item, actionType: 'cancelRent' })}>
                        <XCircle size={14} /> ביטול השכרה
                      </button>
                    </>
                  )}

                  {isReturned && (
                    <button className="moc-btn moc-btn-danger-soft moc-btn-sm" title="ביטול החזרה"
                      onClick={() => setConfirmModal({ isOpen: true, item, actionType: 'cancelReturn' })}>
                      <Undo2 size={14} /> ביטול החזרה
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="moc-card-panel">
          <div className="moc-empty-state">אין פריטים להצגה בהשכרות והחזרות</div>
        </div>
      )}

      {/* מודל אישור החזרה/ביטולים */}
      {confirmModal.isOpen && (
        <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal({ isOpen: false, item: null, actionType: null }); }}>
          <div className="moc moc-modal-box" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '28px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                background: confirmModal.actionType === 'return' ? 'var(--moc-success-bg)' : 'var(--moc-danger-bg)',
                color: confirmModal.actionType === 'return' ? '#16a34a' : 'var(--moc-danger-text)'
              }}>
                {confirmModal.actionType === 'return' ? <PackageCheck size={26} /> : <XCircle size={26} />}
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>
                {confirmModal.actionType === 'return' ? 'אישור החזרה' : confirmModal.actionType === 'cancelReturn' ? 'ביטול החזרה' : 'ביטול השכרה'}
              </h3>
              <p style={{ color: 'var(--moc-text-muted)', margin: 0, lineHeight: 1.6 }}>
                האם אתה בטוח שברצונך {confirmModal.actionType === 'return' ? 'לבצע החזרה' : confirmModal.actionType === 'cancelReturn' ? 'לבטל את ההחזרה' : 'לבטל את ההשכרה'} של פריט זה?
                <br />
                <strong className="moc-mono" style={{ display: 'inline-block', marginTop: '8px', padding: '4px 10px', background: 'var(--moc-neutral-bg)', borderRadius: '8px' }}>
                  {confirmModal.item?.barcode || confirmModal.item?.dressItem?.dressBarcode || 'ללא ברקוד'}
                </strong>
              </p>
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button className="moc-btn moc-btn-outline" onClick={() => setConfirmModal({ isOpen: false, item: null, actionType: null })}>חזור</button>
              <button
                className={`moc-btn ${confirmModal.actionType === 'return' ? 'moc-btn-gold' : 'moc-btn-danger-soft'}`}
                onClick={() => {
                  const { item, actionType } = confirmModal;
                  setConfirmModal({ isOpen: false, item: null, actionType: null });
                  if (actionType === 'return') handleReturn(item);
                  else if (actionType === 'cancelReturn') handleCancelReturn(item);
                  else if (actionType === 'cancelRent') handleCancelRent(item);
                }}
              >
                {confirmModal.actionType === 'return' ? 'אשר החזרה' : 'אשר ביטול'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default ModernRentalsManager;
