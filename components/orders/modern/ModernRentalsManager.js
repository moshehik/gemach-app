'use client';

import React, { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { getHebrewDateString } from '../../../lib/hebrewDate';

/**
 * טאב "השכרות והחזרות" בעיצוב "אריג" — פורט מלא של OrderRentalsManager:
 * סריקת ברקוד (כולל אימות מלאי, טיפול בפריט שלא הוחזר מהזמנה קודמת, ואישור עובד
 * כשההזמנה לא שולמה במלואה), השכרה עם הזנת ברקוד בשורה, החזרה וביטולים.
 * חשוף דרך ref: scan(barcode) — משמש את שדה "סריקה מהירה" בסיידבר.
 */
const ModernRentalsManager = forwardRef(function ModernRentalsManager({ items, onItemsChange, order, totalRequired, totalPaid }, ref) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [rentingItemId, setRentingItemId] = useState(null); // פריט שנפתחה לו שורת הזנת ברקוד
  const [inlineBarcode, setInlineBarcode] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null, actionType: null });
  const [itemChoiceModal, setItemChoiceModal] = useState({ isOpen: false, candidates: [], barcode: null });
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
    let matchedItem = null;
    let candidates = [];
    if (forcedItem) {
      matchedItem = activeItems.find(i => i.id === forcedItem.id) || null;
    } else {
      // התאמה מדויקת לפי ברקוד שכבר משוייך לפריט — חד-משמעית, אין צורך לבחור
      matchedItem = activeItems.find(i => {
        const b = i.barcode || i.dressItem?.barcode || i.dressItem?.dressBarcode;
        return b && b === barcode;
      }) || null;

      if (!matchedItem) {
        candidates = activeItems.filter(i => {
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

        if (candidates.length === 1) matchedItem = candidates[0];
      }
    }

    // כמה פריטים זהים (אותו דגם/מידה) תואמים — לשאול את המשתמש לאיזה מהם לשייך את הברקוד
    if (!matchedItem && candidates.length > 1) {
      setItemChoiceModal({ isOpen: true, candidates, barcode });
      return;
    }

    if (!matchedItem) {
      const detailsStr = dressInfo ? ` (דגם ${dressInfo.dressName || dressInfo.barcodePrefix || ''}, מידה ${dressInfo.sizeText || ''})` : '';
      alert(`ברקוד ${barcode}${detailsStr} לא נמצא בין הפריטים שטרם הושכרו בהזמנה זו.`);
      return;
    }

    if (!matchedItem.isTaken) {
      handleRent(matchedItem, barcode, true); // האימות בוצע כבר למעלה
    } else if (!matchedItem.isReturned) {
      handleReturn(matchedItem, true);
    } else {
      alert(`פריט ${barcode} כבר הוחזר.`);
    }
  };

  const chooseItemForBarcode = (item) => {
    const barcode = itemChoiceModal.barcode;
    setItemChoiceModal({ isOpen: false, candidates: [], barcode: null });
    handleRent(item, barcode, true); // האימות בוצע כבר למעלה, המשתמש רק בחר לאיזה פריט לשייך
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
        <div className="callout callout-warning" style={{ marginBottom: '16px' }}>
          <svg className="icon"><use href="#i-alert-tri" /></svg>
          <span><strong>הערות להזמנה: </strong>{order.notes}</span>
        </div>
      )}

      {!isFullyPaid && (
        <div className="callout callout-danger" style={{ marginBottom: '16px' }}>
          <svg className="icon"><use href="#i-alert-tri" /></svg>
          <span>יש לשלם את ההזמנה במלואה לפני ביצוע השכרה/החזרה — כל פעולה תדרוש אישור עובד/מנהל.</span>
        </div>
      )}

      {/* סריקה + סיכום */}
      <div className="toolbar">
        <form onSubmit={handleBarcodeScan} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div className="input-icon-wrap" style={{ width: '260px' }}>
            <svg className="icon"><use href="#i-tag" /></svg>
            <input
              type="text"
              className="input"
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="סרוק ברקוד — השכרה / החזרה"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">בצע סריקה</button>
        </form>
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>
          הושכרו: {rentedCount} · הוחזרו: {returnedCount} מתוך {activeItems.length}
        </span>
      </div>

      {activeItems.length > 0 ? (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>פריט</th>
                  <th>מידה / ברקוד</th>
                  <th style={{ textAlign: 'center', width: '110px' }}>סטטוס</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activeItems.map((item, index) => {
                  const isRented = item.isTaken && !item.isReturned;
                  const isReturned = item.isReturned;
                  const barcode = item.barcode || item.dressItem?.dressBarcode || null;
                  const taken = fmtDate(item.takenDate);
                  const returned = fmtDate(item.returnDate);
                  const isInlineRenting = rentingItemId === item.id;
  
                  return (
                    <tr key={item.id || index}>
                      <td className="cell-primary">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          {itemName(item)}
                          {itemHasRepairs(item) && (
                            <span title={`יש תיקונים${item.alterationDetails ? `: ${item.alterationDetails}` : ''}`} style={{ color: 'var(--warning)', display: 'inline-flex' }}>
                              <svg className="icon" style={{ width: '15px', height: '15px' }}><use href="#i-scissors" /></svg>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="cell-muted">
                        מידה: {item.sizeText || '-'}
                        {barcode && <> · <span style={{ fontFamily: 'Consolas, monospace', direction: 'ltr', display: 'inline-block' }}>{barcode}</span></>}
                        {taken && <div>לקיחה: {taken}</div>}
                        {returned && <div>החזרה: {returned}</div>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isReturned ? (
                          item.returnedOk === false ? (
                            <span className="badge badge-danger"><svg className="icon"><use href="#i-alert-tri" /></svg>הוחזר - לא תקין</span>
                          ) : (
                            <span className="badge badge-success"><svg className="icon"><use href="#i-check" /></svg>הוחזר - תקין</span>
                          )
                        ) : isRented ? (
                          <span className="badge badge-info"><svg className="icon"><use href="#i-box" /></svg>מושכר</span>
                        ) : (
                          <span className="badge badge-neutral">ממתין</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                          {!item.isTaken && !isInlineRenting && (
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => startInlineRent(item)}>
                              <svg className="icon"><use href="#i-box" /></svg>השכרה
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
                                className="input"
                                value={inlineBarcode}
                                onChange={(e) => setInlineBarcode(e.target.value)}
                                placeholder="סרוק ברקוד"
                                style={{ width: '140px', direction: 'ltr' }}
                              />
                              <button type="submit" className="btn btn-primary btn-sm">אשר</button>
                              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="ביטול"
                                onClick={() => { setRentingItemId(null); setInlineBarcode(''); }}>
                                <svg className="icon"><use href="#i-x" /></svg>
                              </button>
                            </form>
                          )}
  
                          {isRented && (
                            <>
                              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setConfirmModal({ isOpen: true, item, actionType: 'return' })}>
                                <svg className="icon"><use href="#i-check" /></svg>החזרה
                              </button>
                              <button type="button" className="btn btn-danger-ghost btn-sm" title="ביטול השכרה"
                                onClick={() => setConfirmModal({ isOpen: true, item, actionType: 'cancelRent' })}>
                                <svg className="icon"><use href="#i-x-circle" /></svg>ביטול השכרה
                              </button>
                            </>
                          )}
  
                          {isReturned && (
                            <button type="button" className="btn btn-danger-ghost btn-sm" title="ביטול החזרה"
                              onClick={() => setConfirmModal({ isOpen: true, item, actionType: 'cancelReturn' })}>
                              <svg className="icon"><use href="#i-refresh" /></svg>ביטול החזרה
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <div className="empty-state">
              <svg className="icon"><use href="#i-bag" /></svg>
              <h4>אין פריטים להצגה בהשכרות והחזרות</h4>
            </div>
          </div>
        </div>
      )}

      {/* מודל אישור החזרה/ביטולים */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal({ isOpen: false, item: null, actionType: null }); }}>
          <div className="modal confirm-modal" style={{ margin: 0 }}>
            <div className="modal-icon-circle" style={{
              background: confirmModal.actionType === 'return' ? 'var(--success-tint)' : 'var(--danger-tint)',
              color: confirmModal.actionType === 'return' ? 'var(--success)' : 'var(--danger)'
            }}>
              <svg className="icon"><use href={confirmModal.actionType === 'return' ? '#i-check' : '#i-x-circle'} /></svg>
            </div>
            <h3>
              {confirmModal.actionType === 'return' ? 'אישור החזרה' : confirmModal.actionType === 'cancelReturn' ? 'ביטול החזרה' : 'ביטול השכרה'}
            </h3>
            <p>
              האם אתה בטוח שברצונך {confirmModal.actionType === 'return' ? 'לבצע החזרה' : confirmModal.actionType === 'cancelReturn' ? 'לבטל את ההחזרה' : 'לבטל את ההשכרה'} של פריט זה?
              <br />
              <strong style={{ display: 'inline-block', marginTop: '8px', padding: '4px 10px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', fontFamily: 'Consolas, monospace', direction: 'ltr' }}>
                {confirmModal.item?.barcode || confirmModal.item?.dressItem?.dressBarcode || 'ללא ברקוד'}
              </strong>
            </p>
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmModal({ isOpen: false, item: null, actionType: null })}>חזור</button>
              <button
                type="button"
                className={`btn ${confirmModal.actionType === 'return' ? 'btn-primary' : 'btn-danger-ghost'}`}
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

      {/* מודל בחירת פריט — כשכמה פריטים זהים בהזמנה תואמים לברקוד שנסרק */}
      {itemChoiceModal.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setItemChoiceModal({ isOpen: false, candidates: [], barcode: null }); }}>
          <div className="modal" style={{ margin: 0 }}>
            <div className="modal-head">
              <strong><svg className="icon"><use href="#i-tag" /></svg>לאיזה פריט לשייך את הברקוד?</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setItemChoiceModal({ isOpen: false, candidates: [], barcode: null })}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="hint" style={{ color: 'var(--text-2)', lineHeight: 1.6 }}>
                נמצאו מספר פריטים זהים בהזמנה שמתאימים לברקוד שנסרק — יש לבחור לאיזה פריט לשייך אותו:
              </p>
              <p style={{ marginBottom: '16px' }}>
                <strong style={{ display: 'inline-block', padding: '4px 10px', background: 'var(--surface-alt)', borderRadius: 'var(--radius-sm)', fontFamily: 'Consolas, monospace', direction: 'ltr' }}>
                  {itemChoiceModal.barcode}
                </strong>
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {itemChoiceModal.candidates.map((item, idx) => (
                  <button
                    key={item.id || idx}
                    type="button"
                    className="list-card"
                    style={{ width: '100%', cursor: 'pointer', textAlign: 'start', font: 'inherit', color: 'inherit' }}
                    onClick={() => chooseItemForBarcode(item)}
                  >
                    <span className="kpi-icon" style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)' }}>
                      <svg className="icon"><use href="#i-box" /></svg>
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '13.5px' }}>{itemName(item)}</div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '3px', fontSize: '12px', color: 'var(--text-3)' }}>
                        <span>מידה {item.sizeText || '-'}</span>
                        <span className={`badge ${itemHasRepairs(item) ? 'badge-warning' : 'badge-neutral'}`}>
                          {itemHasRepairs(item) && <svg className="icon"><use href="#i-scissors" /></svg>}{itemHasRepairs(item) ? 'עם תיקון' : 'ללא תיקון'}
                        </span>
                      </div>
                    </span>
                    <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-chevron-start" /></svg>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setItemChoiceModal({ isOpen: false, candidates: [], barcode: null })}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default ModernRentalsManager;
