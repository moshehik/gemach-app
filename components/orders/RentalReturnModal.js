'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useLabels } from '@/app/components/LabelsContext';
import { getHebrewDateString } from '../../lib/hebrewDate';
import OrderPrintMenu from './OrderPrintMenu';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../HistoryViewer';
import { useRentalReturn, formatHistoryValue } from './useRentalReturn';

// הודעות החלון הזה כמו שהיו תמיד: alert של הדפדפן, window.customConfirm / window.customPrompt של PopupProvider.
// הלוגיקה עצמה ב-useRentalReturn.js (משותפת עם החלון בעיצוב החדש של הלוח החודשי, app/components/board/BoardRentalModal.js).
const LEGACY_UI = {
  alert: (message) => alert(message),
  confirm: (message, title) => window.customConfirm(message, title),
  prompt: async (message, defaultValue, type, opts = {}) => {
    if (window.customPrompt) return window.customPrompt(message, defaultValue, type);
    if (Object.prototype.hasOwnProperty.call(opts, 'fallbackConfirm')) return window.confirm(opts.fallbackConfirm) ? '' : null;
    return opts.fallback !== undefined ? opts.fallback : null;
  },
};

export default function RentalReturnModal({ orderId, onClose, onUpdate }) {
  const { getLabel } = useLabels();

  const {
    selectedOrder,
    setSelectedOrder,
    loading,
    enableAlterations,
    lateReturnThresholdDays,
    nonWorkingDays,
    modalBarcode,
    setModalBarcode,
    modalBarcodeRef,
    isProcessing,
    isConfirming,
    isBusy,
    duplicates,
    setDuplicates,
    itemDetails,
    setItemDetails,
    rentingItemId,
    setRentingItemId,
    inlineBarcode,
    setInlineBarcode,
    manualEntryItemId,
    setManualEntryItemId,
    manualBarcode1,
    setManualBarcode1,
    manualBarcode2,
    setManualBarcode2,
    manualSigned,
    setManualSigned,
    activeItems,
    pendingItems,
    pendingCount,
    hasUnsavedInput,
    hasUnsavedChanges,
    overallStatus,
    overallStatusColor,
    refreshOrder,
    patchItem,
    handleRentalScan,
    confirmManualEntry,
    cancelManualEntry,
    selectDuplicate,
    handleReturnScan,
    checkLateReturnPrompt,
    handleGlobalBarcodeScan,
    confirmInlineRent,
    confirmRental,
    discardPendingRentals,
    undoReturn,
    undoRental,
    showItemDetails,
    doReportIssue,
    reportIssue,
    markReturnGoodAgain,
    handleMarkReturnGood,
    handleMarkReturnBad,
    maybeBlockCustomerAfterBadReturn,
    handleHeaderSave,
    handleHeaderCancel,
    attemptCloseCard,
    handlePrintPreConfirm,
    getItemStatus,
  } = useRentalReturn({ orderId, onClose, onUpdate, ui: LEGACY_UI });

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
                  skipRegulationsCheck
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
                    {isConfirming ? 'מאשר...' : `אשר את הפריטים שנסרקו (${pendingCount})`}
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
                                  {item.barcode && <> · {getLabel('item_barcode', 'ברקוד')}: {item.barcode}{item.manualBarcodeEntry && ' (הוזן ידנית)'}</>}
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
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
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
                                          <button data-agy-id="rentalreturnmodal_button_16" type="button" className="btn btn-ghost btn-icon-only btn-sm" disabled={isBusy} onClick={() => { setRentingItemId(null); if (manualEntryItemId === item.id) cancelManualEntry(); }}>
                                            <svg className="icon"><use href="#i-x" /></svg>
                                          </button>
                                        </div>

                                        {manualEntryItemId === item.id ? (
                                          <div className="callout callout-warning" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px', padding: '10px 12px', width: '260px' }}>
                                            <strong style={{ fontSize: '12.5px' }}>הברקוד לא נקרא - הקלדה ידנית</strong>
                                            <input data-agy-id="rentalreturnmodal_input_manual_1"
                                              type="text"
                                              className="input"
                                              placeholder="הקלד את מספר הברקוד"
                                              style={{ direction: 'ltr' }}
                                              value={manualBarcode1}
                                              onChange={(e) => setManualBarcode1(e.target.value.replace(/\s+/g, ''))}
                                              disabled={isBusy}
                                            />
                                            <input data-agy-id="rentalreturnmodal_input_manual_2"
                                              type="text"
                                              className="input"
                                              placeholder="הקלד שוב לאימות"
                                              style={{ direction: 'ltr' }}
                                              value={manualBarcode2}
                                              onChange={(e) => setManualBarcode2(e.target.value.replace(/\s+/g, ''))}
                                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); confirmManualEntry(item); } }}
                                              disabled={isBusy}
                                            />
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
                                              <input data-agy-id="rentalreturnmodal_checkbox_manual_signature"
                                                type="checkbox"
                                                checked={manualSigned}
                                                onChange={(e) => setManualSigned(e.target.checked)}
                                                disabled={isBusy}
                                                style={{ marginTop: '2px' }}
                                              />
                                              <span>אני מאשרת שהשמלה אכן בידי עכשיו</span>
                                            </label>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <button data-agy-id="rentalreturnmodal_button_manual_confirm" type="button" className="btn btn-primary btn-sm" disabled={isBusy} onClick={() => confirmManualEntry(item)}>
                                                אשר הקלדה ידנית
                                              </button>
                                              <button data-agy-id="rentalreturnmodal_button_manual_cancel" type="button" className="btn btn-ghost btn-sm" disabled={isBusy} onClick={cancelManualEntry}>
                                                ביטול
                                              </button>
                                            </div>
                                          </div>
                                        ) : (
                                          <button data-agy-id="rentalreturnmodal_button_manual_open"
                                            type="button"
                                            className="btn btn-ghost btn-sm"
                                            style={{ fontSize: '11.5px' }}
                                            disabled={isBusy}
                                            onClick={() => { setManualEntryItemId(item.id); setManualBarcode1(''); setManualBarcode2(''); setManualSigned(false); }}
                                          >
                                            הברקוד לא עובד? הקלדה ידנית
                                          </button>
                                        )}
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
