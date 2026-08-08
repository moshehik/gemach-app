'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLabels } from '@/app/components/LabelsContext';
import { getHebrewDateString } from '../../lib/hebrewDate';
import { addHistory } from '../../lib/historyManager';
import { calculateOrderStatus, getStatusColor } from '../../lib/orderStatus';
import OrderPrintMenu from './OrderPrintMenu';
import { fetchSharedJson, TTL } from '../../lib/apiCache';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../HistoryViewer';

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
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
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
    if (isBusy) return;
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

  // תצוגת ערך בהיסטוריית הפריט: תאריכים תמיד בלוח עברי בלבד (ללא תאריך לועזי),
  // בוליאנים ככן/לא, ושאר הערכים כפי שהם.
  const formatHistoryValue = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    if (typeof val === 'boolean') return val ? 'כן' : 'לא';
    if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
        return `${getHebrewDateString(d)} ${time}`;
      }
    }
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  // הופך את ה-changesJson הגולמי (JSON טכני עם שמות שדות באנגלית) לשורת "צ'יפים"
  // קריאה בעברית: שם שדה מתורגם + ערך ישן (מחוק) → ערך חדש.
  const renderHistoryChanges = (changesJson) => {
    let changes;
    try {
      changes = typeof changesJson === 'string' ? JSON.parse(changesJson) : changesJson;
    } catch (e) {
      return <div style={{ fontSize: '11px', color: 'var(--text-3)', fontFamily: 'monospace', wordBreak: 'break-word' }} dir="ltr">{String(changesJson)}</div>;
    }
    if (!changes || typeof changes !== 'object') return null;

    const keys = Object.keys(changes).filter(key => {
      const c = changes[key];
      if (c && typeof c === 'object' && ('from' in c || 'to' in c)) {
        return String(c.from) !== String(c.to);
      }
      return c !== null && c !== undefined && c !== '';
    });
    if (keys.length === 0) return <div style={{ fontSize: '11px', color: 'var(--text-3)', fontStyle: 'italic' }}>אין שינויים מהותיים</div>;

    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {keys.map(key => {
          const label = FIELD_TRANSLATIONS[key] || key;
          const c = changes[key];
          const isDiff = c && typeof c === 'object' && ('from' in c || 'to' in c);
          const hasFrom = isDiff && c.from !== null && c.from !== undefined && c.from !== '';
          return (
            <span key={key} className="chip">
              <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>{label}:</span>
              {isDiff ? (
                <>
                  {hasFrom && <span style={{ textDecoration: 'line-through', color: 'var(--danger)' }}>{formatHistoryValue(c.from)}</span>}
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>{formatHistoryValue(c.to)}</span>
                </>
              ) : (
                <span style={{ color: 'var(--text)', fontWeight: 700 }}>{formatHistoryValue(c)}</span>
              )}
            </span>
          );
        })}
      </div>
    );
  };

  // Rendering
  const modalContent = (
    <div className="modal-backdrop" onDoubleClick={attemptCloseCard} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', direction: 'rtl' }}>
      <div className="rrm-card" onClick={e => e.stopPropagation()}>

        {loading || !selectedOrder ? (
          <div className="rrm-loading">
            <span className="spinner lg" />
            <h2>טוען נתוני השכרה...</h2>
          </div>
        ) : (
          <>
            {/* Sidebar */}
            <aside className="rrm-sidebar">
              <div>
                <div className="rrm-sidebar-top-row">
                  <button data-agy-id="rentalreturnmodal_button_1" className="rrm-icon-btn-ghost" title="סגור חלון" onClick={attemptCloseCard}>
                    <svg className="icon"><use href="#i-x" /></svg>
                  </button>
                  <div className="rrm-order-id-group">
                    <span className="rrm-order-num">הזמנה #{selectedOrder.orderId}</span>
                    <span className="rrm-v-divider" />
                    <span className="badge" style={{ background: overallStatusColor.bg, color: overallStatusColor.text }}>
                      <svg className="icon"><use href="#i-clock" /></svg>
                      {overallStatus}
                    </span>
                  </div>
                </div>

                <div className="rrm-sidebar-info-panel">
                  <div className="rrm-sip-row">
                    <svg className="icon"><use href="#i-user" /></svg>
                    <strong>{selectedOrder.customer ? `${selectedOrder.customer.firstName || ''} ${selectedOrder.customer.lastName || ''}` : 'לא צוין לקוח'}</strong>
                  </div>
                  {selectedOrder.customer?.phone1 && (
                    <div className="rrm-sip-row">
                      <svg className="icon"><use href="#i-phone" /></svg>
                      <span style={{ direction: 'ltr' }}>{selectedOrder.customer.phone1}</span>
                    </div>
                  )}
                  {selectedOrder.eventDate && (
                    <div className="rrm-sip-row">
                      <svg className="icon"><use href="#i-calendar" /></svg>
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
                  <svg className="icon"><use href="#i-tag" /></svg>
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
                    <span className="spinner" aria-label="מעבד..." />
                  )}
                  <a
                    href={`/orders/${selectedOrder.orderId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rrm-icon-btn"
                    title="פתח כרטיס הזמנה בטאב חדש"
                  >
                    <svg className="icon"><use href="#i-arrow-end" /></svg>
                  </a>
                  <OrderPrintMenu
                    order={selectedOrder}
                    onOrderUpdate={(patch) => setSelectedOrder(prev => prev ? { ...prev, ...patch } : prev)}
                    triggerClassName="rrm-icon-btn info"
                    triggerTitle="הדפסה ומייל"
                    preConfirm={handlePrintPreConfirm}
                  />
                  <button data-agy-id="rentalreturnmodal_button_6" className="rrm-icon-btn primary" onClick={handleHeaderSave} title="שמור וסגור" disabled={isConfirming}>
                    <svg className="icon"><use href="#i-check" /></svg>
                  </button>
                  <button data-agy-id="rentalreturnmodal_button_7" className="rrm-icon-btn danger" onClick={handleHeaderCancel} title="בטל שינויים שלא אושרו וסגור">
                    <svg className="icon"><use href="#i-x-circle" /></svg>
                  </button>
                </div>
              </div>

              {(selectedOrder.orderNotes || selectedOrder.notes) && (
                <div className="callout callout-warning" style={{ marginBottom: '16px' }}>
                  <svg className="icon"><use href="#i-alert-tri" /></svg>
                  <div><strong>הערות להזמנה: </strong>{selectedOrder.orderNotes || selectedOrder.notes}</div>
                </div>
              )}

              {pendingCount > 0 && (
                <div className="rrm-pending-banner">
                  <span>{pendingCount} פריטים נסרקו וממתינים לאישור השכרה</span>
                  <button data-agy-id="rentalreturnmodal_button_8" className="btn btn-primary btn-sm" onClick={confirmRental} disabled={isConfirming || isBusy}>
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
                          <span className={`badge badge-${status.tone}`}>{status.text}</span>
                          {enableAlterations && (item.alterationDetails || item.repairs) && (
                            <span className="rrm-repairs-icon" title="יש תיקונים - לחצו על פרטים לצפייה" onClick={() => showItemDetails(item)}>
                              <svg className="icon"><use href="#i-scissors" /></svg>
                            </span>
                          )}
                          <div className="rrm-item-menu" style={{ position: 'relative' }}>
                            <button data-agy-id="rentalreturnmodal_button_9" className="rrm-icon-btn" onClick={(e) => toggleItemMenu(e, item.id)}>
                              <svg className="icon"><use href="#i-more" /></svg>
                            </button>
                            {openMenuId === item.id && (
                              <div className="rrm-floating-menu">
                                <button data-agy-id="rentalreturnmodal_button_10" className="rrm-menu-item" onClick={() => showItemDetails(item)}>
                                  <svg className="icon"><use href="#i-info" /></svg> פרטים
                                </button>
                                {item.isTaken && !item.isReturned && (
                                  <button data-agy-id="rentalreturnmodal_button_11" className="rrm-menu-item danger" disabled={isBusy} onClick={() => { setOpenMenuId(null); undoRental(item.id); }}>
                                    <svg className="icon"><use href="#i-refresh" /></svg> ביטול השכרה
                                  </button>
                                )}
                                {item.isReturned && (
                                  <>
                                    <button data-agy-id="rentalreturnmodal_button_12" className="rrm-menu-item danger" disabled={isBusy} onClick={() => { setOpenMenuId(null); undoReturn(item.id); }}>
                                      <svg className="icon"><use href="#i-refresh" /></svg> ביטול החזרה
                                    </button>
                                    {item.returnedOk ? (
                                      <button data-agy-id="rentalreturnmodal_button_13" className="rrm-menu-item danger" disabled={isBusy} onClick={() => reportIssue(item.id, 'returned-bad')}>
                                        <svg className="icon"><use href="#i-alert-tri" /></svg> דווח על בעיה
                                      </button>
                                    ) : (
                                      <button data-agy-id="rentalreturnmodal_button_20" className="rrm-menu-item" disabled={isBusy} onClick={() => markReturnGoodAgain(item.id)}>
                                        <svg className="icon"><use href="#i-check-circle" /></svg> סמן כתקין
                                      </button>
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
                          {item.isTaken && <> · <strong>לקיחה:</strong> {item.takenDate ? getHebrewDateString(item.takenDate) : 'לא ידוע'}</>}
                          {item.isReturned && <> · <strong>הוחזר:</strong> {item.returnDate ? getHebrewDateString(item.returnDate) : 'לא ידוע'}</>}
                        </div>
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
                              <button data-agy-id="rentalreturnmodal_button_15" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => confirmInlineRent(item)}>אשר</button>
                              <button data-agy-id="rentalreturnmodal_button_16" className="rrm-icon-btn" disabled={isBusy} onClick={() => setRentingItemId(null)}>
                                <svg className="icon"><use href="#i-x" /></svg>
                              </button>
                            </div>
                          ) : (
                            <button data-agy-id="rentalreturnmodal_button_17" className="btn btn-primary btn-sm" onClick={() => setRentingItemId(item.id)}>השכרה</button>
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
                              <svg className="icon"><use href="#i-check-circle" /></svg> החזרה תקינה
                            </button>
                            <div className="rrm-divider-v"></div>
                            <button data-agy-id="rentalreturnmodal_button_19"
                              className={`rrm-return-bad ${item.isReturned && !item.returnedOk ? 'active' : ''}`}
                              onClick={() => handleMarkReturnBad(item)}
                              disabled={item.isReturned || isBusy}
                            >
                              <svg className="icon"><use href="#i-alert-tri" /></svg> לא תקין
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
                {activeItems.length === 0 && (
                  <li className="empty-state">
                    <svg className="icon"><use href="#i-box" /></svg>
                    <p>אין פריטים בהזמנה זו</p>
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
        .rrm-card {
          display: flex;
          background: var(--surface);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-lg);
          width: 95%;
          max-width: 1000px;
          max-height: 90vh;
          border: 1px solid var(--border);
          animation: rrm-fade-in 0.2s ease-out forwards;
        }
        .rrm-loading {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 4rem 2rem; width: 100%; gap: 1.5rem;
        }
        .rrm-loading h2 { font-size: 1.25rem; font-weight: 600; color: var(--text); margin: 0; }

        .rrm-sidebar {
          width: 300px; min-width: 260px; flex-shrink: 0;
          background: linear-gradient(165deg, var(--primary) 0%, var(--primary-hover) 100%);
          color: var(--text-on-primary); padding: 22px 20px; display: flex; flex-direction: column; justify-content: space-between;
          overflow-y: auto; overflow-x: hidden;
        }
        .rrm-sidebar-top-row { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; flex-wrap: nowrap; min-width: 0; }
        .rrm-order-id-group { display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; min-width: 0; overflow: hidden; }
        .rrm-order-num { font-weight: 700; font-size: 1rem; color: var(--text-on-primary); font-family: var(--font-heading); margin: 0; }
        .rrm-v-divider { width: 1px; height: 16px; background: color-mix(in srgb, var(--text-on-primary) 30%, transparent); display: inline-block; }
        .rrm-icon-btn-ghost {
          background: color-mix(in srgb, black 15%, transparent); color: var(--text-on-primary); border: none; border-radius: 50%;
          width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: background 0.2s; flex-shrink: 0;
        }
        .rrm-icon-btn-ghost .icon { width: 16px; height: 16px; }
        .rrm-icon-btn-ghost:hover { background: color-mix(in srgb, black 30%, transparent); }

        .rrm-sidebar-info-panel {
          background: color-mix(in srgb, var(--text-on-primary) 10%, transparent); border-radius: var(--radius-md); padding: 14px 16px;
          display: flex; flex-direction: column; gap: 11px;
        }
        .rrm-sip-row { display: flex; align-items: center; gap: 9px; font-size: 0.95rem; color: color-mix(in srgb, var(--text-on-primary) 95%, transparent); margin: 0; }
        .rrm-sip-row .icon { width: 15px; height: 15px; opacity: 0.75; flex-shrink: 0; }
        .rrm-sip-row strong { font-weight: 700; font-size: 1.02rem; }

        .rrm-search-wrapper { position: relative; width: 100%; }
        .rrm-search-wrapper .icon { position: absolute; inset-inline-end: 12px; top: 50%; transform: translateY(-50%); width: 17px; height: 17px; color: var(--text-3); pointer-events: none; }
        .rrm-search-input {
          width: 100%; padding: 11px 42px 11px 16px; border-radius: var(--radius-full); border: none; outline: none;
          background: var(--surface); color: var(--text); font-size: 0.92rem; transition: all 0.2s;
          box-shadow: inset 0 1px 3px color-mix(in srgb, black 6%, transparent); font-family: inherit;
        }
        .rrm-search-input:focus { box-shadow: inset 0 1px 3px color-mix(in srgb, black 6%, transparent), 0 0 0 3px color-mix(in srgb, var(--text-on-primary) 35%, transparent); }
        .rrm-search-input::placeholder { color: var(--text-3); }

        .rrm-sidebar-divider { border: none; border-top: 1px solid color-mix(in srgb, var(--text-on-primary) 18%, transparent); margin: 18px 0; }

        .rrm-main { padding: 24px 28px; width: 70%; overflow-y: auto; flex: 1; min-width: 0; }
        .rrm-main-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 16px; border-bottom: 2px solid var(--border); padding-bottom: 14px;
        }
        .rrm-main-header h3 { margin: 0; font-family: var(--font-heading); font-size: 1.35rem; color: var(--text); }

        .rrm-icon-btn {
          background: transparent; border: none; border-radius: var(--radius-sm); width: 34px; height: 34px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
          color: var(--text-2); transition: all 0.2s; padding: 0;
        }
        .rrm-icon-btn .icon { width: 18px; height: 18px; }
        .rrm-icon-btn:hover { background: var(--surface-alt); color: var(--text); }
        .rrm-icon-btn.primary { color: var(--primary-solid); }
        .rrm-icon-btn.primary:hover { background: var(--primary-solid); color: var(--text-on-primary); }
        .rrm-icon-btn.danger { color: var(--danger); }
        .rrm-icon-btn.danger:hover { background: var(--danger-tint); }
        .rrm-icon-btn.info { color: var(--info); }
        .rrm-icon-btn.info:hover { background: var(--info); color: var(--text-on-primary); }
        .rrm-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .rrm-repairs-icon {
          display: inline-flex; align-items: center; justify-content: center;
          width: 24px; height: 24px; border-radius: 50%; cursor: pointer;
          color: var(--warning); background: var(--warning-tint);
          transition: all 0.2s;
        }
        .rrm-repairs-icon .icon { width: 14px; height: 14px; }
        .rrm-repairs-icon:hover { background: color-mix(in srgb, var(--warning) 20%, transparent); }

        .rrm-pending-banner {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          background: var(--warning-tint); border: 1px solid color-mix(in srgb, var(--warning) 30%, transparent);
          border-radius: var(--radius-md); padding: 12px 16px; margin-bottom: 16px; font-weight: 600;
          color: var(--text); font-size: 0.92rem;
        }

        .rrm-item-list { list-style: none; padding: 0; margin: 0; }
        .rrm-item-list li {
          padding: 18px 0; border-bottom: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap;
        }
        .rrm-item-list li:last-child { border-bottom: none; }
        .rrm-item-details { flex: 1; min-width: 240px; }
        .rrm-item-title {
          font-size: 1.05rem; font-weight: 600; margin-bottom: 6px; display: flex;
          align-items: center; gap: 10px; flex-wrap: wrap; color: var(--text);
        }
        .rrm-item-sub { font-size: 0.85rem; color: var(--text-2); }
        .rrm-mono { font-family: monospace; font-weight: 600; color: var(--text); }

        .rrm-action-bar { display: flex; align-items: center; }
        .rrm-hint-text { font-size: 0.85rem; color: var(--text-2); font-style: italic; }

        .rrm-inline-barcode { display: flex; align-items: center; gap: 8px; }
        .rrm-inline-barcode input {
          padding: 6px 10px; border-radius: var(--radius-sm); border: 1px solid var(--border-strong);
          width: 140px; direction: ltr; background: var(--surface); color: var(--text);
        }

        .rrm-return-banner {
          display: inline-flex; background: var(--surface-alt); border-radius: var(--radius-full);
          padding: 4px; border: 1px solid var(--border);
        }
        .rrm-return-banner button {
          border: none; background: transparent; padding: 6px 14px; border-radius: var(--radius-full);
          font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: 0.2s;
          display: flex; align-items: center; gap: 6px; color: var(--text-2);
        }
        .rrm-return-banner .icon { width: 14px; height: 14px; }
        .rrm-return-good.active { background: var(--success-tint); color: var(--success); }
        .rrm-return-bad.active { background: var(--danger-tint); color: var(--danger); }
        .rrm-return-banner button:not(:disabled):hover { color: var(--text); }
        .rrm-return-banner.readonly button { cursor: default; }
        .rrm-divider-v { width: 1px; background: var(--border); margin: 6px 2px; }

        .rrm-item-menu .rrm-floating-menu {
          position: absolute; top: 100%; inset-inline-end: 0; background: var(--surface);
          border: 1px solid var(--border); border-radius: var(--radius-md);
          box-shadow: var(--shadow-md); display: flex; flex-direction: column;
          padding: 4px; z-index: 50; min-width: 160px; animation: rrm-slide-in 0.15s ease-out forwards;
        }
        .rrm-menu-item {
          background: transparent; border: none; width: 100%; text-align: start; padding: 8px 10px;
          font-size: 0.85rem; border-radius: var(--radius-sm); cursor: pointer; color: var(--text);
          display: flex; align-items: center; gap: 6px;
        }
        .rrm-menu-item .icon { width: 14px; height: 14px; }
        .rrm-menu-item:hover { background: var(--surface-alt); }
        .rrm-menu-item.danger { color: var(--danger); }
        .rrm-menu-item.danger:hover { background: var(--danger-tint); }

        .rrm-detail-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 20px; }
        .rrm-detail-box { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 12px; display: flex; flex-direction: column; gap: 2px; }
        .rrm-detail-label { font-size: 11px; color: var(--text-3); }
        .rrm-detail-value { font-weight: 600; color: var(--text); font-size: 13px; }
        .rrm-detail-section-title { font-size: 13.5px; font-weight: 700; color: var(--text); margin: 0 0 10px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .rrm-history-item { background: var(--surface-alt); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 10px 12px; font-size: 13px; }

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
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ maxWidth: '520px', width: '100%', margin: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-tag" /></svg>
                פרטי פריט: {itemDetails.item.barcode || itemDetails.item.description}
              </strong>
              <button data-agy-id="rentalreturnmodal_button_20" type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setItemDetails(null)} title="סגירה">
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div className="rrm-detail-grid">
                <div className="rrm-detail-box">
                  <div className="rrm-detail-label">תאריך אירוע</div>
                  <div className="rrm-detail-value">{selectedOrder?.eventDate ? getHebrewDateString(selectedOrder.eventDate) : '-'}</div>
                </div>
                <div className="rrm-detail-box">
                  <div className="rrm-detail-label">תאריך לקיחה</div>
                  <div className="rrm-detail-value">{itemDetails.item.takenDate ? `${getHebrewDateString(itemDetails.item.takenDate)} ${new Date(itemDetails.item.takenDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : (itemDetails.item.isTaken ? 'לא ידוע' : '-')}</div>
                </div>
                <div className="rrm-detail-box">
                  <div className="rrm-detail-label">תאריך החזרה</div>
                  <div className="rrm-detail-value">{itemDetails.item.returnDate ? `${getHebrewDateString(itemDetails.item.returnDate)} ${new Date(itemDetails.item.returnDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : (itemDetails.item.isReturned ? 'לא ידוע' : '-')}</div>
                </div>
                <div className="rrm-detail-box">
                  <div className="rrm-detail-label">חזר תקין?</div>
                  <div className="rrm-detail-value">{itemDetails.item.isReturned ? (itemDetails.item.returnedOk ? 'כן' : 'לא') : '-'}</div>
                </div>
                {enableAlterations && (
                  <div className="rrm-detail-box" style={{ gridColumn: '1 / -1' }}>
                    <div className="rrm-detail-label">מחרוזת תיקונים</div>
                    <div className="rrm-detail-value">{itemDetails.item.alterationDetails || itemDetails.item.repairs || '-'}</div>
                  </div>
                )}
              </div>

              <h4 className="rrm-detail-section-title">היסטוריית פעולות</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {itemDetails.history && itemDetails.history.length === 0 ? (
                  <p style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: '13px' }}>אין היסטוריה לפריט זה</p>
                ) : (
                  itemDetails.history && itemDetails.history.map(log => (
                    <div key={log.id} className="rrm-history-item">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <span className="badge badge-info">{ACTION_TRANSLATIONS[log.action] || log.action}</span>
                        <span style={{ color: 'var(--text-3)', fontSize: '11.5px' }}>{getHebrewDateString(log.createdAt)} {new Date(log.createdAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      {renderHistoryChanges(log.changesJson)}
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
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ maxWidth: '640px', width: '100%', margin: 0, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-alert-tri" /></svg>
                נמצאו מספר פריטים זהים
              </strong>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <p style={{ color: 'var(--text-2)', fontSize: '13px', marginTop: 0 }}>בחר לאיזה מהם לשייך את הברקוד שנסרק</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {duplicates.map((opt, idx) => (
                  <button data-agy-id="rentalreturnmodal_button_21"
                    type="button"
                    key={opt.id}
                    onClick={() => selectDuplicate(opt.id)}
                    className="list-card"
                    style={{ width: '100%', textAlign: 'start', cursor: 'pointer', font: 'inherit', appearance: 'none', WebkitAppearance: 'none' }}
                  >
                    <div className="avatar">{idx + 1}</div>
                    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: enableAlterations ? 'repeat(3, 1fr)' : '1fr', gap: '8px' }}>
                      {enableAlterations ? (
                        <>
                          <div className="rrm-detail-box"><span className="rrm-detail-label">אורך</span><span className="rrm-detail-value">{opt.lengthAlteration || 'ללא'}</span></div>
                          <div className="rrm-detail-box"><span className="rrm-detail-label">צוואר</span><span className="rrm-detail-value">{opt.neckAlteration || 'ללא'}</span></div>
                          <div className="rrm-detail-box"><span className="rrm-detail-label">שרוול</span><span className="rrm-detail-value">{opt.sleeveAlteration || 'ללא'}</span></div>
                          <div className="rrm-detail-box" style={{ gridColumn: '1 / -1' }}><span className="rrm-detail-label">פירוט</span><span className="rrm-detail-value">{opt.alterationDetails || 'אין פירוט נוסף'}</span></div>
                        </>
                      ) : (
                        <div className="rrm-detail-box">פריט מס' {idx + 1} במערכת</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-foot">
              <button data-agy-id="rentalreturnmodal_button_22" type="button" className="btn btn-secondary" onClick={() => setDuplicates(null)}>ביטול</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined' ? createPortal(<>{modalContent}{additionalModals}</>, document.body) : <>{modalContent}{additionalModals}</>;
}
