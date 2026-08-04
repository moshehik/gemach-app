'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, RotateCcw, Edit2, X, Check, Info, CalendarSearch, Scan,
  PackageCheck, PackageOpen, Undo2, XCircle, Shirt, Scissors, Ruler
} from 'lucide-react';
import OrderModelSelector from '../OrderModelSelector';
import OrderSizeSelector from '../OrderSizeSelector';
import ItemCapacityModal from '../ItemCapacityModal';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../../HistoryViewer';

/**
 * טאב "פריטים" בעיצוב המודרני — פורט מלא של OrderItemsManager:
 * הוספה/עריכה עם בורר דגם ומידה (כולל מטמון מלאי), תיקונים כצ'יפים,
 * השכרה/החזרה עם אישור וברקוד, מחיקה/שחזור, פרטי חיובים והיסטוריה לפריט.
 */
export default function ModernItemsManager({ orderId, order, items, onItemsChange, onOrderUpdated, inventoryCache, totalRequired, totalPaid }) {
  const [showDeleted, setShowDeleted] = useState(false);
  const [showAlterations, setShowAlterations] = useState(true);
  const [detailsModalItem, setDetailsModalItem] = useState(null);
  const [capacityModalItem, setCapacityModalItem] = useState(null);
  const [savingItemIndex, setSavingItemIndex] = useState(null);
  const [settings, setSettings] = useState({});
  const [mounted, setMounted] = useState(false);
  const listEndRef = useRef(null);
  const [showManualScanModal, setShowManualScanModal] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [selectedItemForScan, setSelectedItemForScan] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, item: null, actionType: null });
  const isFullyPaid = totalPaid >= totalRequired;

  useEffect(() => {
    setMounted(true);
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSettings(data.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
        } else {
          setSettings(data || {});
        }
      })
      .catch(console.error);
  }, []);

  const enableAlterations = settings.enable_alterations !== 'false';
  const activeItems = (items || []).filter(i => !i.isDeleted);
  const totalPrice = activeItems.reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);

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
      description: model.name,
      sizeText: ''
    };
    onItemsChange(updatedItems);
  };

  const handleConfirmItem = async (index) => {
    const item = items[index];
    if (!item.dressModelId || !item.sizeText) {
      alert('יש לבחור דגם ומידה לפני האישור');
      return;
    }
    const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
    if (enableAlterations && hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
      alert('חובה להזין פירוט תיקון כאשר נבחר תיקון');
      return;
    }

    setSavingItemIndex(index);
    try {
      const isEditing = !!item.id && !item.isNew;
      const url = isEditing ? `/api/orders/${orderId}/items/${item.id}` : `/api/orders/${orderId}/items`;
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת הפריט');
      if (onOrderUpdated) {
        // מוסרים את השורה המקומית שנשמרה, אבל משאירים שורות חדשות שנוספו בזמן השמירה
        onOrderUpdated(data, { savedLocalId: item._localId });
      }
    } catch (error) {
      alert(error.message);
    } finally {
      setSavingItemIndex(null);
    }
  };

  const handleEditItem = (index) => {
    const item = items[index];
    if (item.isTaken && !item.isReturned) {
      alert('לא ניתן לערוך פריט שכבר נלקח (מושכר).');
      return;
    }
    const updatedItems = [...items];
    updatedItems[index] = {
      ...item,
      isEditing: true,
      originalState: { ...item },
      dressModelId: item.dressModelId || item.dressItem?.dressModelId,
      sizeText: item.sizeText || item.dressItem?.sizeText || item.dressItem?.size || '',
      description: item.description || item.dressItem?.dress?.name || ''
    };
    onItemsChange(updatedItems);
  };

  const cancelEditItem = (index) => {
    const updatedItems = [...items];
    const original = updatedItems[index].originalState;
    updatedItems[index] = original ? { ...original } : { ...updatedItems[index], isEditing: false };
    onItemsChange(updatedItems);
  };

  const cancelNewItem = (index) => {
    const updatedItems = [...items];
    updatedItems.splice(index, 1);
    onItemsChange(updatedItems);
  };

  const toggleDeleted = async (index) => {
    const isCurrentlyDeleted = items[index].isDeleted;
    const item = items[index];

    if (!isCurrentlyDeleted && item.isTaken) {
      alert('לא ניתן למחוק פריט שכבר נלקח (מושכר). יש להחזירו קודם לכן או לבטל את הלקיחה.');
      return;
    }
    if (isCurrentlyDeleted) {
      const maxItems = parseInt(settings.max_items_per_order);
      const activeCount = items.filter(i => !i.isDeleted).length;
      if (!isNaN(maxItems) && maxItems > 0 && activeCount >= maxItems) {
        alert(`הגבלת מערכת: לא ניתן לשחזר פריט. המקסימום המותר הוא ${maxItems} פריטים בהזמנה.`);
        return;
      }
    }

    const confirmed = await window.customConfirm(isCurrentlyDeleted
      ? 'האם אתה בטוח שברצונך לשחזר פריט זה להזמנה?'
      : 'האם אתה בטוח שברצונך למחוק פריט זה?');
    if (!confirmed) return;
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
      // מזהה מקומי בלבד (השרת מתעלם ממנו) — מזהה איזו שורה נשמרה כשתשובת השרת חוזרת
      _localId: (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  };

  // ===== השכרה/החזרה (זהה ללוגיקה במנהל ההשכרות) =====
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
    onItemsChange(items.map(i => i.id === item.id ? { ...i, isTaken: false, takenDate: null, barcode: null } : i));
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

  const showItemDetails = async (item) => {
    setDetailsModalItem({ ...item, auditLogs: null, loadingLogs: true });
    try {
      const res = await fetch(`/api/audit/order-item/${item.id}`);
      let logs = [];
      if (res.ok) logs = await res.json();
      setDetailsModalItem({ ...item, auditLogs: logs, loadingLogs: false });
    } catch (err) {
      console.error(err);
      setDetailsModalItem({ ...item, auditLogs: [], loadingLogs: false });
    }
  };

  const itemName = (item) => item.dressItem?.dress?.name
    ? item.dressItem.dress.name
    : (item.description || item.dressItem?.dressName || 'פריט כללי');

  const itemCode = (item) => item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix || null;

  const renderRepairChips = (item, index) => {
    const neck = item.neckAlteration === 1 || item.neckAlteration === true;
    const sleeve = item.sleeveAlteration === 1 || item.sleeveAlteration === true;
    const length = item.lengthAlteration && String(item.lengthAlteration).trim() !== '' ? item.lengthAlteration : null;
    const hasAny = neck || sleeve || length;
    return (
      <div className="moc-repair-chips">
        {neck && <span className="moc-repair-chip" title="תיקון צוואר"><Shirt size={13} /> צוואר</span>}
        {sleeve && <span className="moc-repair-chip" title="תיקון שרוול"><Scissors size={13} /> שרוול</span>}
        {length && <span className="moc-repair-chip" title="קיצור אורך"><Ruler size={13} /> {length} ס"מ</span>}
        {!hasAny && <span className="moc-repair-chip muted">ללא תיקונים</span>}
        {hasAny && (
          <button
            className={`moc-repair-chip ${item.alterationDone ? 'done' : 'not-done'}`}
            title={(item.alterationDetails ? `פירוט: ${item.alterationDetails} · ` : '') + 'לחץ לשינוי סטטוס ביצוע התיקון'}
            onClick={() => handleItemChange(index, 'alterationDone', !item.alterationDone)}
          >
            {item.alterationDone ? <><Check size={12} /> בוצע</> : 'לא בוצע'}
          </button>
        )}
        {hasAny && item.alterationDetails && (
          <span className="moc-hint" style={{ flexBasis: '100%', fontSize: '0.78rem' }}>{item.alterationDetails}</span>
        )}
      </div>
    );
  };

  const renderStatusBadge = (item) => {
    if (item.isReturned) return <span className="moc-badge on-white success"><PackageCheck size={13} /> הוחזר</span>;
    if (item.isTaken) return <span className="moc-badge on-white info"><PackageOpen size={13} /> בהשכרה</span>;
    return <span className="moc-badge on-white neutral">ממתין</span>;
  };

  return (
    <>
      {/* סרגל עליון של הטאב */}
      <div className="moc-section-head">
        <span className="moc-hint" style={{ marginLeft: 'auto' }}>
          {activeItems.length} פריטים פעילים{totalPrice > 0 ? ` · סה"כ ₪${totalPrice.toLocaleString('he-IL')}` : ''}
        </span>
        {enableAlterations && (
          <label className="moc-check-label">
            <input type="checkbox" checked={showAlterations} onChange={(e) => setShowAlterations(e.target.checked)} />
            הצג פרטי תיקונים
          </label>
        )}
        <label className="moc-check-label">
          <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
          הצג פריטים מחוקים
        </label>
        <button className="moc-icon-btn-add" title="הוסף פריט חדש" onClick={handleAddItem}>
          <Plus size={18} />
        </button>
      </div>

      {items && items.filter(i => showDeleted || !i.isDeleted).length > 0 ? (
        <div className="moc-card-panel" style={{ padding: 0, overflowX: 'auto', maxHeight: '60vh', overflowY: 'auto' }}>
          <table className={`moc-data-table ${(!showAlterations || !enableAlterations) ? 'hide-alter' : ''}`}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>מחק</th>
                <th>תיאור דגם</th>
                <th style={{ width: '140px' }}>מידה</th>
                <th className="moc-col-alter">תיקונים</th>
                <th style={{ textAlign: 'center', width: '110px' }}>סטטוס</th>
                <th style={{ textAlign: 'center' }}>פעולות</th>
                <th style={{ textAlign: 'center', width: '90px' }}>פרטים</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, originalIndex) => {
                if (!showDeleted && item.isDeleted) return null;
                const isDeletedRow = item.isDeleted;
                const isRented = item.isTaken && !item.isReturned;
                const isEditingMode = item.isNew || item.isEditing;
                const code = itemCode(item);

                return (
                  <tr key={item.id || item._localId || originalIndex} className={isDeletedRow ? 'deleted' : isEditingMode ? 'editing' : ''}>
                    <td>
                      <button
                        className={`moc-icon-btn-plain ${isDeletedRow ? 'restore' : 'row-delete'}`}
                        title={isDeletedRow ? 'שחזר פריט' : 'מחק פריט'}
                        onClick={(e) => { e.stopPropagation(); toggleDeleted(originalIndex); }}
                      >
                        {isDeletedRow ? <RotateCcw size={15} /> : <Trash2 size={15} />}
                      </button>
                    </td>
                    <td>
                      {item.isNew ? (
                        <div className="moc-inline-edit">
                          <OrderModelSelector
                            value={{ name: item.description, id: item.dressModelId }}
                            onChange={(model) => handleModelChange(originalIndex, model)}
                          />
                        </div>
                      ) : (
                        <>
                          <strong>{itemName(item)}</strong>
                          {code && <div className="moc-mono" style={{ fontSize: '0.78rem', color: 'var(--moc-text-muted)' }}>קוד: {code}{item.barcode ? ` · ברקוד: ${item.barcode}` : ''}</div>}
                        </>
                      )}
                    </td>
                    <td>
                      {item.isNew ? (
                        <OrderSizeSelector
                          modelId={item.dressModelId}
                          order={order}
                          value={item.sizeText}
                          onChange={(val) => handleItemChange(originalIndex, 'sizeText', val)}
                          inventoryCache={inventoryCache}
                          currentCartItems={items}
                        />
                      ) : (
                        <span style={{ fontWeight: 600 }}>{item.sizeText || '-'}</span>
                      )}
                    </td>
                    <td className="moc-col-alter">
                      {isEditingMode && enableAlterations ? (
                        <div className="moc-inline-edit">
                          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <label className="moc-check-label">
                              <input type="checkbox"
                                checked={item.neckAlteration === 1 || item.neckAlteration === true}
                                onChange={(e) => handleItemChange(originalIndex, 'neckAlteration', e.target.checked ? 1 : 0)} />
                              צוואר
                            </label>
                            <label className="moc-check-label">
                              <input type="checkbox"
                                checked={item.sleeveAlteration === 1 || item.sleeveAlteration === true}
                                onChange={(e) => handleItemChange(originalIndex, 'sleeveAlteration', e.target.checked ? 1 : 0)} />
                              שרוול
                            </label>
                            <label className="moc-check-label" style={{ gap: '4px' }}>
                              אורך (ס"מ)
                              <input type="number" value={item.lengthAlteration || ''}
                                onChange={(e) => handleItemChange(originalIndex, 'lengthAlteration', e.target.value)}
                                style={{ width: '64px', padding: '4px 6px' }} placeholder="-" />
                            </label>
                          </div>
                          <input type="text" value={item.alterationDetails || item.repairs || ''}
                            onChange={(e) => handleItemChange(originalIndex, 'alterationDetails', e.target.value)}
                            placeholder="פירוט התיקון הנדרש..." />
                        </div>
                      ) : (
                        renderRepairChips(item, originalIndex)
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {item.isNew ? <span className="moc-badge on-white neutral">חדש</span> : renderStatusBadge(item)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        {isEditingMode ? (
                          <>
                            <button className="moc-btn moc-btn-gold moc-btn-sm"
                              disabled={savingItemIndex === originalIndex}
                              onClick={(e) => { e.stopPropagation(); handleConfirmItem(originalIndex); }}>
                              {savingItemIndex === originalIndex ? '...' : <><Check size={14} /> אישור</>}
                            </button>
                            <button className="moc-btn moc-btn-outline moc-btn-sm"
                              disabled={savingItemIndex === originalIndex}
                              onClick={(e) => { e.stopPropagation(); item.isNew ? cancelNewItem(originalIndex) : cancelEditItem(originalIndex); }}>
                              <X size={14} /> ביטול
                            </button>
                          </>
                        ) : isDeletedRow ? null : (
                          <>
                            {!item.isTaken && (
                              <button className="moc-btn moc-btn-outline moc-btn-sm" title="ערוך פרטי פריט"
                                onClick={(e) => { e.stopPropagation(); handleEditItem(originalIndex); }}>
                                <Edit2 size={13} /> עריכה
                              </button>
                            )}
                            {!item.isTaken && !item.isNew && (
                              <button className="moc-btn moc-btn-gold moc-btn-sm"
                                onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'rent' }); }}>
                                <PackageOpen size={13} /> השכרה
                              </button>
                            )}
                            {isRented && (
                              <>
                                <button className="moc-btn moc-btn-gold moc-btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'return' }); }}>
                                  <PackageCheck size={13} /> החזרה
                                </button>
                                <button className="moc-btn moc-btn-danger-soft moc-btn-sm" title="בטל השכרה"
                                  onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelRent' }); }}>
                                  <XCircle size={13} /> ביטול
                                </button>
                              </>
                            )}
                            {item.isReturned && (
                              <button className="moc-btn moc-btn-danger-soft moc-btn-sm" title="בטל החזרה"
                                onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelReturn' }); }}>
                                <Undo2 size={13} /> ביטול החזרה
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {!item.isNew && (
                          <button className="moc-icon-btn-plain" title="פרטים נוספים והיסטוריה"
                            onClick={(e) => { e.stopPropagation(); showItemDetails(item); }}>
                            <Info size={16} />
                          </button>
                        )}
                        {!item.isNew && (
                          <button className="moc-icon-btn-plain" title="בדוק תפוסה לתאריך אירוע"
                            onClick={(e) => { e.stopPropagation(); setCapacityModalItem(item); }}>
                            <CalendarSearch size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div ref={listEndRef} />
        </div>
      ) : (
        <div className="moc-card-panel">
          <div className="moc-empty-state">
            <div style={{ fontSize: '1.1rem', marginBottom: '6px' }}>אין פריטים להזמנה זו</div>
            <button className="moc-btn moc-btn-gold" onClick={handleAddItem}><Plus size={15} /> הוסף פריט ראשון</button>
          </div>
        </div>
      )}

      {/* ===== מודל אישור השכרה/החזרה ===== */}
      {confirmModal.isOpen && (
        <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal({ isOpen: false, item: null, actionType: null }); }}>
          <div className="moc moc-modal-box" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '28px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)' }}>
                {confirmModal.actionType === 'return' ? <PackageCheck size={26} /> : confirmModal.actionType === 'rent' ? <PackageOpen size={26} /> : <XCircle size={26} />}
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>
                {confirmModal.actionType === 'rent' ? 'אישור השכרה' : confirmModal.actionType === 'return' ? 'אישור החזרה' : confirmModal.actionType === 'cancelRent' ? 'ביטול השכרה' : 'ביטול החזרה'}
              </h3>
              <p style={{ color: 'var(--moc-text-muted)', margin: 0, lineHeight: 1.6 }}>
                האם אתה בטוח שברצונך {confirmModal.actionType === 'rent' ? 'לסמן פריט זה כמושכר' : confirmModal.actionType === 'return' ? 'לסמן פריט זה כמוחזר' : confirmModal.actionType === 'cancelRent' ? 'לבטל את השכרת הפריט' : 'לבטל את החזרת הפריט'}?
              </p>
              {!isFullyPaid && (confirmModal.actionType === 'rent' || confirmModal.actionType === 'return') && (
                <p style={{ color: 'var(--moc-danger-text)', fontWeight: 700, fontSize: '0.9rem', background: 'var(--moc-danger-bg)', padding: '8px', borderRadius: '8px', marginTop: '12px' }}>
                  שים לב: ההזמנה לא שולמה במלואה! נדרש אישור מנהל.
                </p>
              )}
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button className="moc-btn moc-btn-outline" onClick={() => setConfirmModal({ isOpen: false, item: null, actionType: null })}>ביטול</button>
              <button className="moc-btn moc-btn-gold" onClick={async () => {
                const { item, actionType } = confirmModal;
                setConfirmModal({ isOpen: false, item: null, actionType: null });
                if (actionType === 'rent') {
                  if (item.barcodePrefix || item.dressItem?.barcodePrefix) {
                    setSelectedItemForScan(item);
                    setShowManualScanModal(true);
                  } else {
                    await handleRent(item);
                  }
                } else if (actionType === 'return') {
                  await handleReturn(item);
                } else if (actionType === 'cancelRent') {
                  await handleCancelRent(item);
                } else if (actionType === 'cancelReturn') {
                  await handleCancelReturn(item);
                }
              }}>אישור</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודל ברקוד ידני להשכרה ===== */}
      {showManualScanModal && (
        <div className="moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) { setShowManualScanModal(false); setManualBarcode(''); } }}>
          <div className="moc moc-modal-box" style={{ maxWidth: '400px' }}>
            <div className="moc-modal-head"><h3>הזנת ברקוד ידנית</h3>
              <button className="moc-close-x" onClick={() => { setShowManualScanModal(false); setManualBarcode(''); }}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <p style={{ color: 'var(--moc-text-muted)', fontSize: '0.92rem', marginTop: 0 }}>הזן את הברקוד המופיע על הפריט כדי לאשר את הפעולה.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setShowManualScanModal(false);
                const barcode = manualBarcode.trim();
                setManualBarcode('');
                if (selectedItemForScan) await handleRent(selectedItemForScan, barcode);
              }}>
                <div style={{ position: 'relative', marginBottom: '14px' }}>
                  <input type="text" autoFocus placeholder="סרוק או הקלד ברקוד..." value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)} style={{ textAlign: 'center', direction: 'ltr' }} />
                  <Scan size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--moc-text-muted)' }} />
                </div>
                <button type="submit" className="moc-btn moc-btn-gold" style={{ width: '100%', justifyContent: 'center' }}>בצע סריקה</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודל פרטי פריט (חיובים + היסטוריה) ===== */}
      {mounted && detailsModalItem && createPortal(
        <div className="moc moc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setDetailsModalItem(null); }}>
          <div className="moc-modal-box wide">
            <div className="moc-modal-head">
              <h3>פרטי פריט: {itemName(detailsModalItem)}</h3>
              <button className="moc-close-x" onClick={() => setDetailsModalItem(null)}><X size={15} /></button>
            </div>
            <div className="moc-modal-body">
              <span className="moc-field-label">פירוט חיובים לפריט זה</span>
              <div className="moc-card-panel" style={{ padding: '10px 14px', marginBottom: '16px', maxHeight: '170px', overflowY: 'auto' }}>
                {(() => {
                  if (!order || !order.obligations) return <span className="moc-hint">לא נמצאו חיובים מפורטים</span>;
                  const searchStr = `(פריט #${detailsModalItem.id})`;
                  const relatedObligations = order.obligations.filter(obs =>
                    obs.isManual === false && obs.description && obs.description.includes(searchStr) && obs.amount >= 0
                  );
                  if (relatedObligations.length === 0) return <span className="moc-hint">אין חיובים מפורטים לפריט זה</span>;
                  return (
                    <table className="moc-data-table">
                      <tbody>
                        {relatedObligations.map((obs, idx) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{obs.productName?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '') || (obs.description.includes('תיקון') ? 'תיקון' : 'חיוב')}</td>
                            <td className="moc-hint">{obs.description?.replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '')}</td>
                            <td style={{ fontWeight: 700, color: '#16a34a' }}>₪{obs.amount}</td>
                          </tr>
                        ))}
                        <tr style={{ fontWeight: 700, background: 'var(--moc-neutral-bg)' }}>
                          <td colSpan={2}>סה"כ לפריט</td>
                          <td style={{ color: '#16a34a' }}>₪{relatedObligations.reduce((sum, obs) => sum + obs.amount, 0)}</td>
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>

              <span className="moc-field-label">תאריך הוספה</span>
              <div className="moc-field-value" style={{ fontSize: '0.95rem', marginBottom: '16px' }}>
                {new Date(detailsModalItem.orderDate || order?.orderDate || detailsModalItem.createdAt || new Date()).toLocaleDateString('he-IL')}{' '}
                {new Date(detailsModalItem.orderDate || order?.orderDate || detailsModalItem.createdAt || new Date()).toLocaleTimeString('he-IL')}
              </div>

              <span className="moc-field-label">היסטוריית שינויים</span>
              <div className="moc-card-panel" style={{ padding: '6px 14px', maxHeight: '250px', overflowY: 'auto' }}>
                {detailsModalItem.loadingLogs ? (
                  <div className="moc-empty-state" style={{ padding: '14px 0' }}>טוען היסטוריה...</div>
                ) : detailsModalItem.auditLogs && detailsModalItem.auditLogs.length > 0 ? (
                  detailsModalItem.auditLogs.map((log, idx) => {
                    const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
                    let changesNode = null;
                    try {
                      const changes = typeof log.changesJson === 'string' ? JSON.parse(log.changesJson) : log.changesJson;
                      const rows = [];
                      for (const [key, value] of Object.entries(changes)) {
                        if (value === null || value === undefined || value === '') continue;
                        if (['id', 'orderId', 'dressItemId', 'deletedAt', 'barcode', 'barcodePrefix'].includes(key)) continue;
                        if (typeof value === 'boolean' && value === false && log.action === 'CREATE') continue;
                        const label = FIELD_TRANSLATIONS[key] || key;
                        if (value && typeof value === 'object' && ('from' in value || 'to' in value)) {
                          const fromStr = typeof value.from === 'boolean' ? (value.from ? 'כן' : 'לא') : String(value.from || '-');
                          const toStr = typeof value.to === 'boolean' ? (value.to ? 'כן' : 'לא') : String(value.to || '-');
                          if (fromStr === toStr) continue;
                          rows.push(<div key={key}><strong>{label}:</strong> {fromStr} ← {toStr}</div>);
                        } else {
                          const valStr = typeof value === 'boolean' ? (value ? 'כן' : 'לא') : String(value);
                          rows.push(<div key={key}><strong>{label}:</strong> {valStr}</div>);
                        }
                      }
                      changesNode = rows.length > 0
                        ? <div className="moc-diff">{rows}</div>
                        : <div className="moc-hint" style={{ fontStyle: 'italic' }}>אין שינויים רלוונטיים להצגה</div>;
                    } catch (e) {
                      changesNode = <div className="moc-diff moc-mono">{String(log.changesJson)}</div>;
                    }
                    return (
                      <div key={idx} className="moc-history-item">
                        <div className="moc-history-dot" />
                        <div style={{ minWidth: 0 }}>
                          <span className="moc-action-tag">{actionLabel}</span>
                          <span className="moc-meta" style={{ display: 'inline' }}>
                            {new Date(log.createdAt).toLocaleDateString('he-IL')} · {new Date(log.createdAt).toLocaleTimeString('he-IL', { timeStyle: 'short' })}
                          </span>
                          {changesNode}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="moc-hint" style={{ fontStyle: 'italic', padding: '10px 0' }}>אין היסטוריית שינויים להצגה</div>
                )}
              </div>
            </div>
            <div className="moc-modal-foot">
              <button className="moc-btn moc-btn-outline" onClick={() => setDetailsModalItem(null)}>סגור</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {capacityModalItem && (
        <ItemCapacityModal
          item={capacityModalItem}
          order={order}
          isOpen={true}
          onClose={() => setCapacityModalItem(null)}
        />
      )}
    </>
  );
}
