'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLabels } from '@/app/components/LabelsContext';
import { X, Info, Save, Ban, Undo2, AlertTriangle, CheckCircle2, PackageX, PackageCheck, MoreVertical, Calendar, ScanLine, Loader2, Scissors, Pencil, User, Phone, Clock, SquareArrowOutUpRight } from 'lucide-react';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { addHistory } from '../../lib/historyManager';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import OrderPrintMenu from './OrderPrintMenu';

export default function RentalReturnModal({ orderId, onClose, onUpdate }) {
  const { getLabel } = useLabels();

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enableAlterations, setEnableAlterations] = useState(true);

  const [modalBarcode, setModalBarcode] = useState('');
  const modalBarcodeRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [duplicates, setDuplicates] = useState(null);
  const [itemDetails, setItemDetails] = useState(null);

  const [openMenuId, setOpenMenuId] = useState(null);
  const [rentingItemId, setRentingItemId] = useState(null);
  const [inlineBarcode, setInlineBarcode] = useState({});

  async function loadOrder(id) {
    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${id}`, { cache: 'default' });
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        addHistory({
          type: 'rental',
          id: data.orderId,
          name: `השכרה #${data.orderId}`,
          subtext: data.customer ? `${data.customer.firstName} ${data.customer.lastName}` : ''
        });
      } else {
        alert('שגיאה בטעינת פרטי הזמנה');
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert('שגיאת תקשורת');
    } finally {
      setLoading(false);
    }
  };

  // Fetch the order when orderId changes
  useEffect(() => {
    if (orderId) {
      loadOrder(orderId);
    }
  }, [orderId]);

  const refreshOrder = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedOrder(data);
        if (onUpdate) onUpdate(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Patch a single item's fields locally instead of re-fetching the whole order
  // (which also recomputes obligations and pulls the full price list) after
  // every scan/return - keeps the card responsive during a scanning session.
  const patchItem = (itemId, patch) => {
    setSelectedOrder(prev => {
      if (!prev) return prev;
      return { ...prev, items: prev.items.map(i => i.id === itemId ? { ...i, ...patch } : i) };
    });
  };

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        const altSetting = Array.isArray(data) ? data.find(s => s.key === 'enable_alterations') : null;
        if (altSetting && altSetting.value === 'false') {
          setEnableAlterations(false);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (selectedOrder && modalBarcodeRef.current) {
      modalBarcodeRef.current.focus({ preventScroll: true });
    }
  }, [selectedOrder, duplicates]);

  // Close any open item action-menu on outside click
  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e) => {
      if (!e.target.closest('.rrm-item-menu')) setOpenMenuId(null);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [openMenuId]);

  const activeItems = selectedOrder ? selectedOrder.items.filter(i => !i.isDeleted) : [];
  const pendingItems = activeItems.filter(i => i.barcode && !i.isTaken);
  const pendingCount = pendingItems.length;
  const hasUnsavedInput = Boolean(modalBarcode) || Object.values(inlineBarcode).some(v => v && v.trim());
  const hasUnsavedChanges = pendingCount > 0 || hasUnsavedInput;

  const overallStatus = selectedOrder ? calculateOrderStatus(selectedOrder) : '';
  const overallStatusColor = getStatusColor(overallStatus);

  const handleRentalScan = async (barcodeToScan, itemIdToForce = null) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/rentals/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: selectedOrder.orderId,
          barcode: barcodeToScan,
          ...(itemIdToForce && { itemIdToForce })
        })
      });
      const data = await res.json();

      if (res.ok) {
        if (data.duplicateAlterations) {
          setDuplicates(data.options);
        } else {
          patchItem(data.id, { barcode: data.barcode, isTaken: data.isTaken });
        }
      } else {
        if (data.unreturned) {
          if (await window.customConfirm(data.warning + '\nהאם ברצונך לסמן את הפריט כהוחזר עכשיו?')) {
            const putRes = await fetch('/api/rentals/scan', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ unreturnedItemId: data.unreturnedItemId })
            });
            if (putRes.ok) {
              handleRentalScan(barcodeToScan); // Retry scan
            }
          }
        } else {
          alert(data.error);
        }
      }
    } catch (err) {
      console.error(err);
      alert('שגיאת רשת');
    } finally {
      setIsBusy(false);
    }
  };

  const selectDuplicate = async (itemId) => {
    await handleRentalScan(modalBarcode, itemId);
    setDuplicates(null);
  };

  const handleReturnScan = async (barcode) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId, barcode })
      });
      const data = await res.json();

      if (res.ok) {
        patchItem(data.item.id, { isReturned: data.item.isReturned, returnedOk: data.item.returnedOk, returnDate: data.item.returnDate });
      } else {
        alert(data.error);
        // The item may already be up to date on the server (e.g. a previous click
        // already went through) - refresh so the card stops showing a stale status.
        await refreshOrder();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  // Single smart scan bar: detects whether the barcode belongs to an item
  // currently with the customer (return) or a still-unassigned item (rental).
  const handleGlobalBarcodeScan = async (e) => {
    e.preventDefault();
    if (!modalBarcode || isProcessing) return;

    setIsProcessing(true);
    const cleanBarcode = modalBarcode.replace(/\s+/g, '');

    try {
      const isAwaitingReturn = activeItems.some(i => i.barcode === cleanBarcode && i.isTaken && !i.isReturned);
      if (isAwaitingReturn) {
        await handleReturnScan(cleanBarcode);
      } else {
        await handleRentalScan(cleanBarcode);
      }
      setModalBarcode('');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmInlineRent = async (item) => {
    const barcode = (inlineBarcode[item.id] || '').replace(/\s+/g, '').trim();
    if (!barcode) {
      alert('חובה להזין ברקוד');
      return;
    }
    await handleRentalScan(barcode);
    setInlineBarcode(prev => ({ ...prev, [item.id]: '' }));
  };

  const confirmRental = async () => {
    try {
      const unscannedCount = selectedOrder.items.filter(i => !i.barcode && !i.isDeleted).length;
      if (unscannedCount > 0) {
        if (!await window.customConfirm(`לתשומת לב! לא נסרקו כל הפריטים (${unscannedCount} חסרים). להמשיך בכל זאת?`)) {
          return;
        }
      }

      setIsConfirming(true);
      const res = await fetch('/api/rentals/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: selectedOrder.orderId })
      });
      if (res.ok) {
        alert('השכרה אושרה בהצלחה!');
        onClose();
        if (onUpdate) onUpdate();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה באישור ההשכרה');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה בעת אישור ההשכרה');
    } finally {
      setIsConfirming(false);
    }
  };

  const discardPendingRentals = async () => {
    try {
      await fetch(`/api/rentals/confirm?orderId=${selectedOrder.orderId}`, { method: 'DELETE' });
    } catch (err) {
      console.error(err);
    }
  };

  const undoReturn = async (itemId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך לבטל את ההחזרה? הפריט יחזור להיות "אצל הלקוח".')) return;
    setIsBusy(true);
    try {
      const res = await fetch('/api/returns/scan', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshOrder();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const undoRental = async (itemId) => {
    if (!await window.customConfirm('האם אתה בטוח שברצונך לבטל את הלקיחה? (הפריט יחזור לממתינים)')) return;
    setIsBusy(true);
    try {
      const res = await fetch('/api/rentals/cancel', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId })
      });
      if (res.ok) {
        await refreshOrder();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה בביטול לקיחה');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const showItemDetails = async (item) => {
    setOpenMenuId(null);
    try {
      const res = await fetch(`/api/audit/order-item/${item.id}`);
      let history = [];
      if (res.ok) {
        history = await res.json();
      }
      setItemDetails({ item, history });
    } catch (err) {
      console.error(err);
      setItemDetails({ item, history: [] });
    }
  };

  const doReportIssue = async (itemId, issueType) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/returns/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId, issueType })
      });
      if (res.ok) {
        await refreshOrder();
        return true;
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה');
        return false;
      }
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const reportIssue = async (itemId, issueType) => {
    setOpenMenuId(null);
    if (!await window.customConfirm('האם אתה בטוח? תוסף הערה אוטומטית בכרטיס הלקוח.')) return;
    const success = await doReportIssue(itemId, issueType);
    if (success) alert('הערה נוספה בהצלחה.');
  };

  // הפוך של reportIssue(..., 'returned-bad') — מחזיר פריט שסומן "לא תקין" בחזרה למצב "תקין".
  const markReturnGoodAgain = async (itemId) => {
    setOpenMenuId(null);
    if (!await window.customConfirm('לסמן את הפריט בחזרה כ"הוחזר - תקין"?', 'עדכון מצב פריט')) return;
    setIsBusy(true);
    try {
      const res = await fetch('/api/rentals/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action: 'setReturnCondition', returnedOk: true })
      });
      if (res.ok) {
        await refreshOrder();
      } else {
        const data = await res.json();
        alert(data.error || 'שגיאה');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsBusy(false);
    }
  };

  const handleMarkReturnGood = async (item) => {
    if (item.isReturned) return;
    if (!await window.customConfirm(`לסמן את "${item.description}" כהוחזר תקין?`, 'אישור החזרה')) return;
    await handleReturnScan(item.barcode);
  };

  const handleMarkReturnBad = async (item) => {
    if (item.isReturned) return;
    if (!await window.customConfirm(`לסמן את "${item.description}" כהוחזר לא תקין?`, 'דיווח על פריט פגום')) return;
    await handleReturnScan(item.barcode);
    await doReportIssue(item.id, 'returned-bad');
  };

  const toggleItemMenu = (e, itemId) => {
    e.stopPropagation();
    setOpenMenuId(prev => prev === itemId ? null : itemId);
  };

  const handleHeaderSave = async () => {
    if (pendingCount === 0) {
      onClose();
      return;
    }
    if (!await window.customConfirm(`לאשר ${pendingCount} פריטים שנסרקו ולסגור את הכרטיס?`, 'שמירה וסגירה')) return;
    await confirmRental();
  };

  const handleHeaderCancel = async () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    const message = pendingCount > 0
      ? `לבטל ${pendingCount} סריקות שטרם אושרו ולסגור בלי לשמור?`
      : 'יש נתונים שהוזנו ולא נשמרו. לסגור בלי לשמור?';
    if (!await window.customConfirm(message, 'ביטול שינויים')) return;
    if (pendingCount > 0) await discardPendingRentals();
    onClose();
  };

  const attemptCloseCard = async () => {
    if (!hasUnsavedChanges) {
      onClose();
      return;
    }
    if (pendingCount === 0) {
      if (!await window.customConfirm('יש נתונים שהוזנו ולא נשמרו. לסגור בלי לשמור?', 'יציאה מהכרטיס')) return;
      onClose();
      return;
    }
    const wantsSave = await window.customConfirm(`יש ${pendingCount} פריטים שנסרקו ולא אושרו. לשמור אותם לפני היציאה?`, 'יציאה מהכרטיס');
    if (wantsSave) {
      await confirmRental();
      return;
    }
    const wantsDiscard = await window.customConfirm('למחוק את הסריקות הממתינות ולצאת בלי לשמור?', 'יציאה בלי לשמור');
    if (wantsDiscard) {
      await discardPendingRentals();
      onClose();
    }
  };

  const handlePrintPreConfirm = async () => {
    if (pendingCount === 0) return true;
    return window.customConfirm(
      `יש ${pendingCount} פריטים שנסרקו וטרם אושרו - הם לא יופיעו במסמך. להמשיך בכל זאת?`,
      'פריטים לא מאושרים'
    );
  };

  const getItemStatus = (item) => {
    if (item.isReturned) {
      return item.returnedOk
        ? { text: 'הוחזר', tone: 'success' }
        : { text: 'הוחזר - לא תקין', tone: 'danger' };
    }
    if (item.isTaken) {
      return { text: 'מושכר', tone: 'warning' };
    }
    if (item.barcode) {
      return { text: 'נסרק - ממתין לאישור', tone: 'warning' };
    }
    return { text: 'ממתין', tone: 'neutral' };
  };

  // Rendering
  const modalContent = (
    <div className="modal-overlay" onDoubleClick={attemptCloseCard} style={{ direction: 'rtl', zIndex: 1100, background: 'rgba(15, 23, 42, 0.25)', backdropFilter: 'none', WebkitBackdropFilter: 'none' }}>
      <div className="rrm-card" onClick={e => e.stopPropagation()}>

        {loading || !selectedOrder ? (
          <div className="rrm-loading">
            <div className="rrm-spinner"></div>
            <h2>טוען נתוני השכרה...</h2>
          </div>
        ) : (
          <>
            {/* Sidebar */}
            <aside className="rrm-sidebar">
              <div>
                <div className="rrm-sidebar-top-row">
                  <button data-agy-id="rentalreturnmodal_button_1" className="rrm-icon-btn-ghost" title="סגור חלון" onClick={attemptCloseCard}>
                    <X size={16} />
                  </button>
                  <div className="rrm-order-id-group">
                    <span className="rrm-order-num">הזמנה #{selectedOrder.orderId}</span>
                    <span className="rrm-v-divider" />
                    <span className="rrm-badge" style={{ background: overallStatusColor.bg, color: overallStatusColor.text }}>
                      <Clock size={13} /> {overallStatus}
                    </span>
                  </div>
                </div>

                <div className="rrm-sidebar-info-panel">
                  <div className="rrm-sip-row">
                    <User size={15} />
                    <strong>{selectedOrder.customer ? `${selectedOrder.customer.firstName || ''} ${selectedOrder.customer.lastName || ''}` : 'לא צוין לקוח'}</strong>
                  </div>
                  {selectedOrder.customer?.phone1 && (
                    <div className="rrm-sip-row">
                      <Phone size={15} />
                      <span style={{ direction: 'ltr' }}>{selectedOrder.customer.phone1}</span>
                    </div>
                  )}
                  {selectedOrder.eventDate && (
                    <div className="rrm-sip-row">
                      <Calendar size={15} />
                      <span>
                        {(selectedOrder.isAbroad || selectedOrder.isWeekdayEvent)
                          ? (selectedOrder.fromDate ? `${getHebrewDateString(selectedOrder.fromDate)} — ${getHebrewDateString(selectedOrder.toDate || selectedOrder.returnDate)}` : 'אירוע חו"ל')
                          : (selectedOrder.eventDateHebrew || getHebrewDateString(selectedOrder.eventDate))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <hr className="rrm-sidebar-divider" />
                <form data-agy-id="rentalreturnmodal_form_2" className="rrm-search-wrapper" style={{ marginTop: '16px' }} onSubmit={handleGlobalBarcodeScan}>
                  <ScanLine size={17} />
                  <input data-agy-id="rentalreturnmodal_input_3"
                    ref={modalBarcodeRef}
                    type="text"
                    className="rrm-search-input"
                    value={modalBarcode}
                    onChange={(e) => setModalBarcode(e.target.value.replace(/\s+/g, ''))}
                    placeholder="סריקה מהירה — השכרה / החזרה"
                    disabled={isProcessing}
                  />
                  <button data-agy-id="rentalreturnmodal_button_4" type="submit" className="hidden" style={{display: 'none'}}>סרוק</button>
                </form>
              </div>
            </aside>

            {/* Main */}
            <div className="rrm-main">
              <div className="rrm-main-header">
                <h3>השכרה והחזרה</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {(isProcessing || isConfirming || isBusy) && (
                    <Loader2 size={18} className="rrm-header-spinner" aria-label="מעבד..." />
                  )}
                  <a
                    href={`/orders/${selectedOrder.orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rrm-icon-btn"
                    title="פתח כרטיס הזמנה בטאב חדש"
                  >
                    <SquareArrowOutUpRight size={18} />
                  </a>
                  <OrderPrintMenu
                    order={selectedOrder}
                    onOrderUpdate={(patch) => setSelectedOrder(prev => prev ? { ...prev, ...patch } : prev)}
                    triggerClassName="rrm-icon-btn info"
                    triggerTitle="הדפסה ומייל"
                    preConfirm={handlePrintPreConfirm}
                  />
                  <button data-agy-id="rentalreturnmodal_button_6" className="rrm-icon-btn primary" onClick={handleHeaderSave} title="שמור וסגור" disabled={isConfirming}>
                    <Save size={18} />
                  </button>
                  <button data-agy-id="rentalreturnmodal_button_7" className="rrm-icon-btn danger" onClick={handleHeaderCancel} title="בטל שינויים שלא אושרו וסגור">
                    <Ban size={18} />
                  </button>
                </div>
              </div>

              {(selectedOrder.orderNotes || selectedOrder.notes) && (
                <div className="rrm-notes-banner">
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div><strong>הערות להזמנה: </strong>{selectedOrder.orderNotes || selectedOrder.notes}</div>
                </div>
              )}

              {pendingCount > 0 && (
                <div className="rrm-pending-banner">
                  <span>{pendingCount} פריטים נסרקו וממתינים לאישור השכרה</span>
                  <button data-agy-id="rentalreturnmodal_button_8" className="rrm-btn rrm-btn-primary" onClick={confirmRental} disabled={isConfirming || isBusy}>
                    {isConfirming ? 'מאשר...' : `אשר הכל (${pendingCount})`}
                  </button>
                </div>
              )}

              <ul className="rrm-item-list">
                {activeItems.map(item => {
                  const status = getItemStatus(item);
                  const isRenting = rentingItemId === item.id;
                  return (
                    <li key={item.id}>
                      <div className="rrm-item-details">
                        <div className="rrm-item-title">
                          {item.description}
                          <span className={`rrm-badge ${status.tone}`}>{status.text}</span>
                          {enableAlterations && item.repairs && (
                            <span className="rrm-repairs-icon" title="יש תיקונים - לחצו על פרטים לצפייה" onClick={() => showItemDetails(item)}>
                              <Scissors size={14} />
                            </span>
                          )}
                          <div className="rrm-item-menu" style={{ position: 'relative' }}>
                            <button data-agy-id="rentalreturnmodal_button_9" className="rrm-icon-btn" onClick={(e) => toggleItemMenu(e, item.id)}>
                              <MoreVertical size={18} />
                            </button>
                            {openMenuId === item.id && (
                              <div className="rrm-floating-menu">
                                <button data-agy-id="rentalreturnmodal_button_10" className="rrm-menu-item" onClick={() => showItemDetails(item)}><Info size={14} /> פרטים</button>
                                {item.isTaken && !item.isReturned && (
                                  <button data-agy-id="rentalreturnmodal_button_11" className="rrm-menu-item danger" disabled={isBusy} onClick={() => { setOpenMenuId(null); undoRental(item.id); }}><Undo2 size={14} /> ביטול השכרה</button>
                                )}
                                {item.isReturned && (
                                  <>
                                    <button data-agy-id="rentalreturnmodal_button_12" className="rrm-menu-item danger" disabled={isBusy} onClick={() => { setOpenMenuId(null); undoReturn(item.id); }}><Undo2 size={14} /> ביטול החזרה</button>
                                    {item.returnedOk ? (
                                      <button data-agy-id="rentalreturnmodal_button_13" className="rrm-menu-item danger" disabled={isBusy} onClick={() => reportIssue(item.id, 'returned-bad')}><PackageX size={14} /> דווח על בעיה</button>
                                    ) : (
                                      <button data-agy-id="rentalreturnmodal_button_20" className="rrm-menu-item" disabled={isBusy} onClick={() => markReturnGoodAgain(item.id)}><PackageCheck size={14} /> סמן כתקין</button>
                                    )}
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="rrm-item-sub">
                          {getLabel('item_size', 'מידה')}: {item.sizeText || '-'}
                          {item.barcode && <> · {getLabel('item_barcode', 'ברקוד')}: <span className="rrm-mono">{item.barcode}</span></>}
                        </div>
                        {(item.isTaken || item.isReturned) && (
                          <div className="rrm-item-dates">
                            {item.isTaken && <div><strong>לקיחה:</strong> {item.takenDate ? getHebrewDateString(item.takenDate) : 'לא ידוע'}</div>}
                            {item.isReturned && <div><strong>הוחזר:</strong> {item.returnDate ? getHebrewDateString(item.returnDate) : 'לא ידוע'}</div>}
                          </div>
                        )}
                      </div>

                      <div className="rrm-action-bar">
                        {!item.barcode && !item.isTaken && (
                          isRenting ? (
                            <div className="rrm-inline-barcode">
                              <input data-agy-id="rentalreturnmodal_input_14"
                                type="text"
                                autoFocus
                                placeholder="סרוק ברקוד"
                                value={inlineBarcode[item.id] || ''}
                                onChange={(e) => setInlineBarcode(prev => ({ ...prev, [item.id]: e.target.value.replace(/\s+/g, '') }))}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmInlineRent(item); } }}
                              />
                              <button data-agy-id="rentalreturnmodal_button_15" className="rrm-btn rrm-btn-primary rrm-btn-sm" disabled={isBusy} onClick={() => confirmInlineRent(item)}>אשר</button>
                              <button data-agy-id="rentalreturnmodal_button_16" className="rrm-icon-btn" disabled={isBusy} onClick={() => setRentingItemId(null)}><X size={16} /></button>
                            </div>
                          ) : (
                            <button data-agy-id="rentalreturnmodal_button_17" className="rrm-btn rrm-btn-primary" onClick={() => setRentingItemId(item.id)}>השכרה</button>
                          )
                        )}

                        {item.barcode && !item.isTaken && (
                          <span className="rrm-hint-text">ממתין לאישור השכרה</span>
                        )}

                        {item.isTaken && (
                          <div className={`rrm-return-banner ${item.isReturned ? 'readonly' : ''}`}>
                            <button data-agy-id="rentalreturnmodal_button_18"
                              className={`rrm-return-good ${item.isReturned && item.returnedOk ? 'active' : ''}`}
                              onClick={() => handleMarkReturnGood(item)}
                              disabled={item.isReturned || isBusy}
                            >
                              <CheckCircle2 size={14} /> החזרה תקינה
                            </button>
                            <div className="rrm-divider-v"></div>
                            <button data-agy-id="rentalreturnmodal_button_19"
                              className={`rrm-return-bad ${item.isReturned && !item.returnedOk ? 'active' : ''}`}
                              onClick={() => handleMarkReturnBad(item)}
                              disabled={item.isReturned || isBusy}
                            >
                              <AlertTriangle size={14} /> לא תקין
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {activeItems.length === 0 && (
                  <li className="rrm-empty-state">
                    <PackageCheck size={40} />
                    אין פריטים בהזמנה זו
                  </li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes rrm-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes rrm-slide-in {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rrm-spin {
          to { transform: rotate(360deg); }
        }
        .rrm-card {
          display: flex;
          background: #ffffff;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-lg, 0 25px 50px -12px rgba(0,0,0,0.25));
          width: 95%;
          max-width: 1000px;
          max-height: 90vh;
          border: 1px solid var(--element-border, #e2e8f0);
          animation: rrm-fade-in 0.2s ease-out forwards;
        }
        [data-theme="dark"] .rrm-card {
          background: #1e1e1e;
        }
        .rrm-loading {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 4rem 2rem; width: 100%;
        }
        .rrm-spinner {
          width: 48px; height: 48px; border: 4px solid var(--element-border, #e2e8f0);
          border-top: 4px solid var(--primary-color, #d4af37); border-radius: 50%;
          animation: rrm-spin 1s linear infinite; margin-bottom: 1.5rem;
        }
        .rrm-loading h2 { font-size: 1.25rem; font-weight: 600; color: var(--text-main); margin: 0; }

        .rrm-sidebar {
          width: 300px; min-width: 260px; flex-shrink: 0;
          background: linear-gradient(165deg, #d4af37 0%, #b5952f 100%);
          color: #fff; padding: 22px 20px; display: flex; flex-direction: column; justify-content: space-between;
          overflow-y: auto; overflow-x: hidden;
        }
        .rrm-sidebar-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: nowrap; min-width: 0; }
        .rrm-order-id-group { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-width: 0; overflow: hidden; }
        .rrm-order-num { font-weight: 700; font-size: 1rem; color: #fff; font-family: 'Playfair Display', serif; margin: 0; }
        .rrm-v-divider { width: 1px; height: 16px; background: rgba(255,255,255,0.3); display: inline-block; }
        .rrm-icon-btn-ghost {
          background: rgba(0,0,0,0.15); color: #fff; border: none; border-radius: 50%;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s; flex-shrink: 0;
        }
        .rrm-icon-btn-ghost:hover { background: rgba(0,0,0,0.3); }

        .rrm-sidebar-info-panel {
          background: rgba(255,255,255,0.1); border-radius: 12px; padding: 14px 16px;
          display: flex; flex-direction: column; gap: 11px;
        }
        .rrm-sip-row { display: flex; align-items: center; gap: 9px; font-size: 0.95rem; color: rgba(255,255,255,0.95); margin: 0; }
        .rrm-sip-row svg { opacity: 0.75; flex-shrink: 0; }
        .rrm-sip-row strong { font-weight: 700; font-size: 1.02rem; }

        .rrm-search-wrapper { position: relative; width: 100%; }
        .rrm-search-wrapper svg { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; }
        .rrm-search-input {
          width: 100%; padding: 11px 42px 11px 16px; border-radius: 20px; border: none; outline: none;
          background: #fff; color: #2c2c2c; font-size: 0.92rem; transition: all 0.2s;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.06); font-family: inherit;
        }
        .rrm-search-input:focus { box-shadow: inset 0 1px 3px rgba(0,0,0,0.06), 0 0 0 3px rgba(255,255,255,0.35); }
        .rrm-search-input::placeholder { color: #9c9c9c; }

        .rrm-sidebar-divider { border: none; border-top: 1px solid rgba(255,255,255,0.18); margin: 18px 0; }

        .rrm-main { padding: 24px 28px; width: 70%; overflow-y: auto; flex: 1; min-width: 0; }
        .rrm-main-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px; border-bottom: 2px solid var(--divider, #eee); padding-bottom: 14px;
        }
        .rrm-main-header h3 { margin: 0; font-family: 'Playfair Display', serif; font-size: 1.35rem; color: var(--text-main); }

        .rrm-icon-btn {
          background: transparent; border: none; border-radius: 8px; width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          color: var(--text-muted); transition: all 0.2s; padding: 0;
        }
        .rrm-icon-btn:hover { background: var(--element-bg, #f5f5f5); color: var(--text-main); }
        .rrm-icon-btn.primary { color: var(--primary-color); }
        .rrm-icon-btn.primary:hover { background: var(--primary-color); color: #fff; }
        .rrm-icon-btn.danger { color: var(--danger-text, #ef4444); }
        .rrm-icon-btn.danger:hover { background: var(--danger-bg, #fef2f2); }
        .rrm-icon-btn.info { color: #3b82f6; }
        .rrm-icon-btn.info:hover { background: #3b82f6; color: #fff; }
        .rrm-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .rrm-header-spinner { color: var(--primary-color, #d4af37); animation: rrm-spin 0.8s linear infinite; }

        .rrm-badge {
          padding: 4px 10px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; display: inline-flex;
          align-items: center; gap: 4px; white-space: nowrap;
        }
        .rrm-badge.success { background: var(--success-bg, #f0fdf4); color: var(--success-text, #22c55e); }
        .rrm-badge.warning { background: rgba(245, 158, 11, 0.14); color: var(--warning-color, #f59e0b); }
        .rrm-badge.danger { background: var(--danger-bg, #fef2f2); color: var(--danger-text, #ef4444); }
        .rrm-badge.neutral { background: var(--element-bg, #f0f0f0); color: var(--text-muted, #666); }

        .rrm-repairs-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
          color: var(--warning-color, #f59e0b); background: rgba(245, 158, 11, 0.12);
          transition: all 0.2s;
        }
        .rrm-repairs-icon:hover { background: rgba(245, 158, 11, 0.25); }

        .rrm-notes-banner {
          background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; gap: 10px;
          font-size: 0.9rem; color: var(--text-main);
        }

        .rrm-pending-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-weight: 600;
          color: var(--text-main); font-size: 0.92rem;
        }

        .rrm-item-list { list-style: none; padding: 0; margin: 0; }
        .rrm-item-list li {
          padding: 18px 0; border-bottom: 1px solid var(--divider, #eee);
          display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;
        }
        .rrm-item-list li:last-child { border-bottom: none; }
        .rrm-item-details { flex: 1; min-width: 240px; }
        .rrm-item-title {
          font-size: 1.05rem; font-weight: 600; margin-bottom: 6px; display: flex;
          align-items: center; gap: 10px; flex-wrap: wrap; color: var(--text-main);
        }
        .rrm-item-sub { font-size: 0.85rem; color: var(--text-muted); }
        .rrm-mono { font-family: monospace; font-weight: 600; color: var(--text-main); }
        .rrm-item-dates {
          font-size: 0.82rem; color: var(--text-muted); display: flex; gap: 16px; flex-wrap: wrap;
          background: var(--element-bg, #f5f5f5); padding: 8px 10px; border-radius: 6px; margin-top: 8px;
        }

        .rrm-action-bar { display: flex; align-items: center; }
        .rrm-hint-text { font-size: 0.85rem; color: var(--text-muted); font-style: italic; }

        .rrm-btn {
          padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-weight: 600;
          transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; font-size: 0.9rem;
        }
        .rrm-btn-primary { background: var(--primary-color); color: var(--btn-primary-text, #1e293b); }
        .rrm-btn-primary:hover { background: var(--primary-hover, #b5952f); }
        .rrm-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .rrm-btn-sm { padding: 6px 12px; font-size: 0.85rem; }

        .rrm-inline-barcode { display: flex; align-items: center; gap: 8px; }
        .rrm-inline-barcode input {
          padding: 6px 10px; border-radius: 6px; border: 1px solid var(--element-border, #ccc);
          width: 140px; direction: ltr; background: var(--input-bg, #fff); color: var(--text-main);
        }

        .rrm-return-banner {
          display: inline-flex; background: var(--element-bg, #f5f5f5); border-radius: 50px;
          padding: 4px; border: 1px solid var(--element-border, #e5e5e5);
        }
        .rrm-return-banner button {
          border: none; background: transparent; padding: 6px 14px; border-radius: 50px;
          font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s;
          display: flex; align-items: center; gap: 6px; color: var(--text-muted);
        }
        .rrm-return-good.active { background: var(--success-bg, #f0fdf4); color: var(--success-text, #22c55e); }
        .rrm-return-bad.active { background: var(--danger-bg, #fef2f2); color: var(--danger-text, #ef4444); }
        .rrm-return-banner button:not(:disabled):hover { color: var(--text-main); }
        .rrm-return-banner.readonly button { cursor: default; }
        .rrm-divider-v { width: 1px; background: var(--element-border, #ddd); margin: 6px 2px; }

        .rrm-item-menu .rrm-floating-menu {
          position: absolute; top: 100%; right: 0; background: var(--card-bg, #fff);
          border: 1px solid var(--element-border, #eee); border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15); display: flex; flex-direction: column;
          padding: 4px; z-index: 50; min-width: 160px; animation: rrm-slide-in 0.15s ease-out forwards;
        }
        .rrm-menu-item {
          background: transparent; border: none; width: 100%; text-align: right; padding: 8px 10px;
          font-size: 0.85rem; border-radius: 4px; cursor: pointer; color: var(--text-main);
          display: flex; align-items: center; gap: 6px;
        }
        .rrm-menu-item:hover { background: var(--element-bg, #f9f9f9); }
        .rrm-menu-item.danger { color: var(--danger-text, #ef4444); }
        .rrm-menu-item.danger:hover { background: var(--danger-bg, #fef2f2); }

        .rrm-empty-state {
          flex-direction: column; align-items: center; justify-content: center; gap: 10px;
          color: var(--text-muted); padding: 40px 0 !important; text-align: center;
        }

        @media (max-width: 720px) {
          .rrm-card { flex-direction: column; max-height: 95vh; }
          .rrm-sidebar, .rrm-main { width: 100%; }
        }
      `}} />
    </div>
  );

  const additionalModals = (
    <>
      {/* Item Details Modal */}
      {itemDetails && (
        <div className="modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '100%', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-slate-800">פרטי פריט: {itemDetails.item.barcode || itemDetails.item.description}</h3>
              <button data-agy-id="rentalreturnmodal_button_20" type="button" onClick={() => setItemDetails(null)} className="text-slate-400 hover:text-slate-600 bg-slate-200 hover:bg-slate-300 rounded-full p-1"><X size={20}/></button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">תאריך אירוע</div>
                  <div className="font-semibold text-slate-700">{selectedOrder?.eventDate ? `${new Date(selectedOrder.eventDate).toLocaleDateString('he-IL')} (${getHebrewDateString(selectedOrder.eventDate)})` : '-'}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">תאריך לקיחה</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.takenDate ? `${getHebrewDateString(itemDetails.item.takenDate)} ${new Date(itemDetails.item.takenDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : (itemDetails.item.isTaken ? 'לא ידוע' : '-')}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">תאריך החזרה</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.returnDate ? `${getHebrewDateString(itemDetails.item.returnDate)} ${new Date(itemDetails.item.returnDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : (itemDetails.item.isReturned ? 'לא ידוע' : '-')}</div>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">חזר תקין?</div>
                  <div className="font-semibold text-slate-700">{itemDetails.item.isReturned ? (itemDetails.item.returnedOk ? 'כן' : 'לא') : '-'}</div>
                </div>
                {enableAlterations && (
                  <div className="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="text-xs text-slate-500 mb-1">מחרוזת תיקונים</div>
                    <div className="font-semibold text-slate-700">{itemDetails.item.repairs || '-'}</div>
                  </div>
                )}
              </div>

              <h4 className="font-bold text-slate-700 mb-3 border-b border-slate-200 pb-2">היסטוריית פעולות</h4>
              <div className="space-y-3">
                {itemDetails.history && itemDetails.history.length === 0 ? (
                  <p className="text-slate-500 italic text-sm">אין היסטוריה לפריט זה</p>
                ) : (
                  itemDetails.history && itemDetails.history.map(log => (
                    <div key={log.id} className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded text-xs">{log.action}</span>
                        <span className="text-slate-500 text-xs">{new Date(log.createdAt).toLocaleString('he-IL')}</span>
                      </div>
                      <div className="text-slate-600 break-words font-mono text-xs bg-white p-2 rounded border border-slate-100" dir="ltr" style={{ textAlign: 'left' }}>
                        {log.changesJson}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Modal */}
      {duplicates && (
        <div className="modal-overlay" style={{ zIndex: 1300 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '100%', padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-6 py-5 border-b border-amber-200 text-center relative">
              <div className="absolute left-6 top-1/2 -translate-y-1/2">
                <AlertTriangle size={32} className="text-amber-500 opacity-20" />
              </div>
              <h2 className="text-xl font-bold text-amber-800 m-0 flex items-center justify-center gap-2">
                <AlertTriangle size={24} className="text-amber-500" />
                נמצאו מספר פריטים זהים
              </h2>
              <p className="text-amber-700 mt-2 text-sm">בחר לאיזה מהם לשייך את הברקוד שנסרק</p>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] bg-slate-50">
              <div className="grid gap-4">
                {duplicates.map((opt, idx) => (
                  <button data-agy-id="rentalreturnmodal_button_21"
                    type="button"
                    key={opt.id}
                    onClick={() => selectDuplicate(opt.id)}
                    className="flex items-center gap-4 p-4 bg-white border-2 border-slate-200 hover:border-blue-500 hover:shadow-md rounded-xl transition-all group text-right"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      {idx + 1}
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      {enableAlterations ? (
                        <>
                          <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">אורך:</strong> {opt.lengthAlteration || 'ללא'}</div>
                          <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">צוואר:</strong> {opt.neckAlteration || 'ללא'}</div>
                          <div className="bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">שרוול:</strong> {opt.sleeveAlteration || 'ללא'}</div>
                          <div className="col-span-3 bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100"><strong className="block text-xs text-slate-500">פירוט:</strong> {opt.alterationDetails || 'אין פירוט נוסף'}</div>
                        </>
                      ) : (
                        <div className="col-span-3 bg-slate-50 p-2 rounded text-sm text-slate-700 border border-slate-100">פריט מס' {idx + 1} במערכת</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-slate-100 p-4 flex justify-end border-t border-slate-200">
               <button data-agy-id="rentalreturnmodal_button_22" type="button" onClick={() => setDuplicates(null)} className="px-6 py-2 rounded-lg text-slate-600 font-semibold hover:bg-slate-200 transition-colors">ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(<>{modalContent}{additionalModals}</>, document.body) : <>{modalContent}{additionalModals}</>;
}
