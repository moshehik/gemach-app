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

  const doReportIssue = async (itemId, issueType, note = null) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/returns/report-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId: itemId, issueType, note })
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
    const note = window.customPrompt
      ? await window.customPrompt('האם אתה בטוח? ניתן להוסיף הערה על הבעיה (אופציונלי) - תתווסף גם הערה אוטומטית בכרטיס הלקוח:', '', 'text')
      : (window.confirm('האם אתה בטוח? תוסף הערה אוטומטית בכרטיס הלקוח.') ? '' : null);
    if (note === null) return;
    const success = await doReportIssue(itemId, issueType, note);
    if (success) alert('הערה נוספה בהצלחה.');
  };

  // הפוך של reportIssue(..., 'returned-bad') — מחזיר פריט שסומן "לא תקין" בחזרה למצב "תקין".
  const markReturnGoodAgain = async (itemId) => {
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
    // ההערה נאספת כאן, ברגע הסימון "לא תקין" עצמו - לא רק בשלב נפרד אחרי (כמו ב"דווח על
    // בעיה" למעלה) - כדי לתעד מיד מה בדיוק לא תקין, למשל דבר שלא ענו עליו קודם.
    const note = window.customPrompt
      ? await window.customPrompt(`לסמן את "${item.description}" כהוחזר לא תקין? ניתן להוסיף הערה על הבעיה (אופציונלי):`, '', 'text')
      : (window.confirm(`לסמן את "${item.description}" כהוחזר לא תקין?`) ? '' : null);
    if (note === null) return;
    await handleReturnScan(item.barcode);
    await doReportIssue(item.id, 'returned-bad', note);
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
    <div className="modal-backdrop" onDoubleClick={attemptCloseCard} style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="modal animate-fade-in" onClick={e => e.stopPropagation()} style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: 0 }}>

        {loading || !selectedOrder ? (
          <div className="modal-body">
            <div className="loading-inline" style={{ padding: '3rem 1rem' }}>
              <span className="spinner lg" />
              <span>טוען נתוני השכרה...</span>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-head">
              <strong>
                <svg className="icon"><use href="#i-box" /></svg>
                השכרה והחזרה — הזמנה #{selectedOrder.orderId}
                <span className="badge" style={{ background: overallStatusColor.bg, color: overallStatusColor.text, marginInlineStart: '6px' }}>
                  <svg className="icon"><use href="#i-clock" /></svg>
                  {overallStatus}
                </span>
              </strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {(isProcessing || isConfirming || isBusy) && (
                  <span className="spinner" aria-label="מעבד..." />
                )}
                <a
                  href={`/orders/${selectedOrder.orderId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-icon-only btn-sm"
                  title="פתח כרטיס הזמנה בטאב חדש"
                >
                  <svg className="icon"><use href="#i-arrow-end" /></svg>
                </a>
                <OrderPrintMenu
                  order={selectedOrder}
                  onOrderUpdate={(patch) => setSelectedOrder(prev => prev ? { ...prev, ...patch } : prev)}
                  triggerClassName="btn btn-ghost btn-icon-only btn-sm"
                  triggerTitle="הדפסה ומייל"
                  preConfirm={handlePrintPreConfirm}
                />
                <button data-agy-id="rentalreturnmodal_button_1" type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={attemptCloseCard} title="סגור חלון" aria-label="סגור חלון">
                  <svg className="icon"><use href="#i-x" /></svg>
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center', marginBottom: '16px', color: 'var(--text-2)', fontSize: '13px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg className="icon"><use href="#i-user" /></svg>
                  <strong style={{ color: 'var(--text)' }}>{selectedOrder.customer ? `${selectedOrder.customer.firstName || ''} ${selectedOrder.customer.lastName || ''}` : 'לא צוין לקוח'}</strong>
                </span>
                {selectedOrder.customer?.phone1 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg className="icon"><use href="#i-phone" /></svg>
                    <span style={{ direction: 'ltr' }}>{selectedOrder.customer.phone1}</span>
                  </span>
                )}
                {selectedOrder.eventDate && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg className="icon"><use href="#i-calendar" /></svg>
                    <span>
                      {(selectedOrder.isAbroad || selectedOrder.isWeekdayEvent)
                        ? (selectedOrder.fromDate ? `${getHebrewDateString(selectedOrder.fromDate)} — ${getHebrewDateString(selectedOrder.toDate || selectedOrder.returnDate)}` : 'אירוע חו"ל')
                        : (selectedOrder.eventDateHebrew || getHebrewDateString(selectedOrder.eventDate))}
                    </span>
                  </span>
                )}
              </div>

              <form data-agy-id="rentalreturnmodal_form_2" className="field" onSubmit={handleGlobalBarcodeScan} style={{ marginBottom: '16px' }}>
                <div className="input-icon-wrap">
                  <svg className="icon"><use href="#i-tag" /></svg>
                  <input data-agy-id="rentalreturnmodal_input_3"
                    ref={modalBarcodeRef}
                    type="text"
                    className="input"
                    value={modalBarcode}
                    onChange={(e) => setModalBarcode(e.target.value.replace(/\s+/g, ''))}
                    placeholder="סריקה מהירה — השכרה / החזרה"
                    disabled={isProcessing}
                  />
                </div>
                <button data-agy-id="rentalreturnmodal_button_4" type="submit" className="hidden" style={{ display: 'none' }}>סרוק</button>
              </form>

              {(selectedOrder.orderNotes || selectedOrder.notes) && (
                <div className="callout callout-warning" style={{ marginBottom: '16px' }}>
                  <svg className="icon"><use href="#i-alert-tri" /></svg>
                  <div><strong>הערות להזמנה: </strong>{selectedOrder.orderNotes || selectedOrder.notes}</div>
                </div>
              )}

              {pendingCount > 0 && (
                <div className="callout callout-warning" style={{ marginBottom: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <svg className="icon"><use href="#i-alert-tri" /></svg>
                    {pendingCount} פריטים נסרקו וממתינים לאישור השכרה
                  </span>
                  <button data-agy-id="rentalreturnmodal_button_8" type="button" className="btn btn-primary btn-sm" onClick={confirmRental} disabled={isConfirming || isBusy}>
                    {isConfirming ? 'מאשר...' : `אשר הכל (${pendingCount})`}
                  </button>
                </div>
              )}

              {activeItems.length === 0 ? (
                <div className="empty-state">
                  <svg className="icon"><use href="#i-box" /></svg>
                  <p>אין פריטים בהזמנה זו</p>
                </div>
              ) : (
                <div className="table-wrap">
                  <div className="table-scroll">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>פריט</th>
                          {enableAlterations && <th>תיקונים</th>}
                          <th style={{ textAlign: 'center' }}>סטטוס</th>
                          <th>פעולות</th>
                          <th style={{ textAlign: 'center' }}>פרטים</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeItems.map(item => {
                          const status = getItemStatus(item);
                          const isRenting = rentingItemId === item.id;
                          return (
                            <tr key={item.id}>
                              <td className="cell-primary">
                                {item.description}
                                <div className="cell-muted" style={{ fontWeight: 400, fontSize: '11.5px', marginTop: '2px' }}>
                                  {getLabel('item_size', 'מידה')}: {item.sizeText || '-'}
                                  {item.barcode && <> · {getLabel('item_barcode', 'ברקוד')}: {item.barcode}</>}
                                  {item.isTaken && <> · לקיחה: {item.takenDate ? getHebrewDateString(item.takenDate) : 'לא ידוע'}</>}
                                  {item.isReturned && <> · הוחזר: {item.returnDate ? getHebrewDateString(item.returnDate) : 'לא ידוע'}</>}
                                </div>
                              </td>
                              {enableAlterations && (
                                <td>
                                  {(item.alterationDetails || item.repairs) ? (
                                    <span className="chip" style={{ cursor: 'pointer' }} title="יש תיקונים - לחצו על פרטים לצפייה" onClick={() => showItemDetails(item)}>
                                      <svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-scissors" /></svg>
                                      תיקונים
                                    </span>
                                  ) : (
                                    <span className="chip" style={{ opacity: 0.7 }}>ללא תיקונים</span>
                                  )}
                                </td>
                              )}
                              <td style={{ textAlign: 'center' }}>
                                <span className={`badge badge-${status.tone}`}>{status.text}</span>
                              </td>
                              <td>
                                <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                                  {!item.barcode && !item.isTaken && (
                                    isRenting ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <input data-agy-id="rentalreturnmodal_input_14"
                                          type="text"
                                          className="input"
                                          autoFocus
                                          placeholder="סרוק ברקוד"
                                          style={{ width: '140px', direction: 'ltr' }}
                                          value={inlineBarcode[item.id] || ''}
                                          onChange={(e) => setInlineBarcode(prev => ({ ...prev, [item.id]: e.target.value.replace(/\s+/g, '') }))}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmInlineRent(item); } }}
                                        />
                                        <button data-agy-id="rentalreturnmodal_button_15" type="button" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => confirmInlineRent(item)}>אשר</button>
                                        <button data-agy-id="rentalreturnmodal_button_16" type="button" className="btn btn-ghost btn-icon-only btn-sm" disabled={isBusy} onClick={() => setRentingItemId(null)}>
                                          <svg className="icon"><use href="#i-x" /></svg>
                                        </button>
                                      </div>
                                    ) : (
                                      <button data-agy-id="rentalreturnmodal_button_17" type="button" className="btn btn-primary btn-sm" onClick={() => setRentingItemId(item.id)}>
                                        <svg className="icon"><use href="#i-box" /></svg> השכרה
                                      </button>
                                    )
                                  )}

                                  {item.barcode && !item.isTaken && (
                                    <span className="hint">ממתין לאישור השכרה</span>
                                  )}

                                  {item.isTaken && (
                                    <>
                                      <div className="toggle-btn-group" title="מצב הפריט בהחזרה">
                                        <button data-agy-id="rentalreturnmodal_button_18"
                                          type="button"
                                          className={item.isReturned && item.returnedOk ? 'on' : ''}
                                          onClick={() => handleMarkReturnGood(item)}
                                          disabled={item.isReturned || isBusy}
                                          title="החזרה תקינה"
                                        >
                                          <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-check-circle" /></svg>
                                        </button>
                                        <button data-agy-id="rentalreturnmodal_button_19"
                                          type="button"
                                          className={item.isReturned && !item.returnedOk ? 'off' : ''}
                                          onClick={() => handleMarkReturnBad(item)}
                                          disabled={item.isReturned || isBusy}
                                          title="לא תקין"
                                        >
                                          <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-alert-tri" /></svg>
                                        </button>
                                      </div>
                                      {!item.isReturned && (
                                        <button data-agy-id="rentalreturnmodal_button_11" type="button" className="btn btn-danger-ghost btn-sm" disabled={isBusy} onClick={() => undoRental(item.id)}>
                                          <svg className="icon"><use href="#i-refresh" /></svg> ביטול השכרה
                                        </button>
                                      )}
                                      {item.isReturned && (
                                        <>
                                          <button data-agy-id="rentalreturnmodal_button_12" type="button" className="btn btn-danger-ghost btn-sm" disabled={isBusy} onClick={() => undoReturn(item.id)}>
                                            <svg className="icon"><use href="#i-refresh" /></svg> ביטול החזרה
                                          </button>
                                          {item.returnedOk ? (
                                            <button data-agy-id="rentalreturnmodal_button_13" type="button" className="btn btn-danger-ghost btn-sm" disabled={isBusy} onClick={() => reportIssue(item.id, 'returned-bad')}>
                                              <svg className="icon"><use href="#i-alert-tri" /></svg> דווח על בעיה
                                            </button>
                                          ) : (
                                            <button data-agy-id="rentalreturnmodal_button_20" type="button" className="btn btn-secondary btn-sm" disabled={isBusy} onClick={() => markReturnGoodAgain(item.id)}>
                                              <svg className="icon"><use href="#i-check-circle" /></svg> סמן כתקין
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                              <td>
                                <div className="row-actions" style={{ justifyContent: 'center' }}>
                                  <button data-agy-id="rentalreturnmodal_button_10" type="button" className="btn btn-ghost btn-icon-only btn-sm" title="פרטים נוספים והיסטוריה" onClick={() => showItemDetails(item)}>
                                    <svg className="icon"><use href="#i-info" /></svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-foot">
              <button data-agy-id="rentalreturnmodal_button_7" type="button" className="btn btn-danger-ghost" onClick={handleHeaderCancel}>בטל שינויים וסגור</button>
              <button data-agy-id="rentalreturnmodal_button_6" type="button" className="btn btn-primary" onClick={handleHeaderSave} disabled={isConfirming}>
                <svg className="icon"><use href="#i-check" /></svg> שמור וסגור
              </button>
            </div>
          </>
        )}
      </div>
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
              <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', marginBottom: '18px' }}>
                <div className="kpi-card">
                  <div className="kpi-label">תאריך אירוע</div>
                  <div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{selectedOrder?.eventDate ? getHebrewDateString(selectedOrder.eventDate) : '-'}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">תאריך לקיחה</div>
                  <div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{itemDetails.item.takenDate ? `${getHebrewDateString(itemDetails.item.takenDate)} ${new Date(itemDetails.item.takenDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : (itemDetails.item.isTaken ? 'לא ידוע' : '-')}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">תאריך החזרה</div>
                  <div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{itemDetails.item.returnDate ? `${getHebrewDateString(itemDetails.item.returnDate)} ${new Date(itemDetails.item.returnDate).toLocaleTimeString('he-IL', {hour: '2-digit', minute: '2-digit'})}` : (itemDetails.item.isReturned ? 'לא ידוע' : '-')}</div>
                </div>
                <div className="kpi-card">
                  <div className="kpi-label">חזר תקין?</div>
                  <div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{itemDetails.item.isReturned ? (itemDetails.item.returnedOk ? 'כן' : 'לא') : '-'}</div>
                </div>
                {enableAlterations && (
                  <div className="kpi-card" style={{ gridColumn: '1 / -1' }}>
                    <div className="kpi-label">מחרוזת תיקונים</div>
                    <div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{itemDetails.item.alterationDetails || itemDetails.item.repairs || '-'}</div>
                  </div>
                )}
              </div>

              <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text)', margin: '0 0 10px', paddingBottom: '8px', borderBottom: '1px solid var(--border)' }}>היסטוריית פעולות</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {itemDetails.history && itemDetails.history.length === 0 ? (
                  <p style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: '13px' }}>אין היסטוריה לפריט זה</p>
                ) : (
                  itemDetails.history && itemDetails.history.map(log => (
                    <div key={log.id} style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px' }}>
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
                          <div className="kpi-card" style={{ padding: '10px 12px' }}><div className="kpi-label">אורך</div><div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{opt.lengthAlteration || 'ללא'}</div></div>
                          <div className="kpi-card" style={{ padding: '10px 12px' }}><div className="kpi-label">צוואר</div><div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{opt.neckAlteration || 'ללא'}</div></div>
                          <div className="kpi-card" style={{ padding: '10px 12px' }}><div className="kpi-label">שרוול</div><div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{opt.sleeveAlteration || 'ללא'}</div></div>
                          <div className="kpi-card" style={{ padding: '10px 12px', gridColumn: '1 / -1' }}><div className="kpi-label">פירוט</div><div className="kpi-value" style={{ fontSize: '13px', fontWeight: 600 }}>{opt.alterationDetails || 'אין פירוט נוסף'}</div></div>
                        </>
                      ) : (
                        <div className="kpi-card" style={{ padding: '10px 12px' }}>פריט מס' {idx + 1} במערכת</div>
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
