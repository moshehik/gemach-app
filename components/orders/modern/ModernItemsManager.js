'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import OrderModelSelector from '../OrderModelSelector';
import OrderSizeSelector from '../OrderSizeSelector';
import ItemCapacityModal from '../ItemCapacityModal';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { isWithinItemEditWindow } from '../../../lib/orderItemEditWindow';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';

// שדות פנימיים של עגלת הקניות (טיימר ההחזקה) — לא מידע שמעניין את המשתמש ביומן השינויים
const HIDDEN_HISTORY_FIELDS = ['id', 'orderId', 'dressItemId', 'deletedAt', 'barcode', 'barcodePrefix', 'cartStatus', 'cartStatusDate'];

// עד לתיקון בראוטים, הוספת פריט נרשמה פעמיים ביומן (תוסף ה-audit + רישום ידני בראוט),
// ועריכה יצרה שורה גנרית עם צילום כל השדות לצד שורת הפירוט "לפני ← אחרי". בנתונים הישנים
// השורות האלה עדיין קיימות, ולכן מקפלים אותן כאן:
//   1. שורות זהות לחלוטין וצמודות בזמן (ה-CREATE הכפול).
//   2. שורת UPDATE גנרית שהיא צילום מצב, כשצמודה לה שורה עם פירוט לפני/אחרי של אותה פעולה.
const AUDIT_DUP_WINDOW_MS = 5000;
const rawChanges = (l) => (typeof l.changesJson === 'string' ? l.changesJson : JSON.stringify(l.changesJson));
const isDiffShaped = (l) => {
  try {
    const parsed = JSON.parse(rawChanges(l));
    return Object.values(parsed).some(v => v && typeof v === 'object' && ('from' in v || 'to' in v));
  } catch (e) {
    return false;
  }
};
const dedupeAuditLogs = (logs) => {
  const arr = logs || [];
  const near = (a, b) => Math.abs(new Date(a.createdAt) - new Date(b.createdAt)) <= AUDIT_DUP_WINDOW_MS;
  return arr.filter((log, i) => {
    const prev = arr[i - 1];
    const next = arr[i + 1];
    if (prev && prev.action === log.action && rawChanges(prev) === rawChanges(log) && near(prev, log)) return false;
    if (log.action === 'UPDATE' && !isDiffShaped(log)) {
      if ((prev && near(prev, log) && isDiffShaped(prev)) || (next && near(next, log) && isDiffShaped(next))) return false;
    }
    return true;
  });
};

/**
 * טאב "פריטים והשכרות" בעיצוב "אריג" — פורט מלא של OrderItemsManager, כולל ההשכרות:
 * הוספה/עריכה עם בורר דגם ומידה (כולל מטמון מלאי), תיקונים כצ'יפים,
 * השכרה/החזרה עם אישור וברקוד, מחיקה/שחזור, פרטי חיובים והיסטוריה לפריט.
 * חשוף דרך ref: scan(barcode) — סריקת ברקוד מהסיידבר מבצעת השכרה/החזרה
 * (כולל אימות מלאי בשרת וטיפול בפריט שלא הוחזר מהזמנה קודמת).
 */
const ModernItemsManager = forwardRef(function ModernItemsManager({ orderId, order, items, onItemsChange, onOrderUpdated, inventoryCache, totalRequired, totalPaid, locked = false }, ref) {
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
  const [itemChoiceModal, setItemChoiceModal] = useState({ isOpen: false, candidates: [], barcode: null });
  const [savingConditionId, setSavingConditionId] = useState(null);
  const [expandedHistory, setExpandedHistory] = useState({});
  const isFullyPaid = totalPaid >= totalRequired;

  // כל שורת היסטוריה מתחילה מכווצת — לחיצה על השורה מרחיבה את פירוט השינויים שלה בלבד
  const toggleHistoryExpand = (idx) => setExpandedHistory(prev => ({ ...prev, [idx]: !prev[idx] }));

  // עריכה מלאה של פריט (דגם/מידה/תיקונים, כולל השפעה על הסכומים) מותרת רק בתוך 15 דקות
  // מהעדכון האחרון שלו, או כל עוד הכרטיס נשאר פתוח באותו ביקור — לפי המאוחר מביניהם.
  const [sessionEditableIds, setSessionEditableIds] = useState(() => {
    const s = new Set();
    (items || []).forEach(it => { if (it?.id && isWithinItemEditWindow(it)) s.add(it.id); });
    return s;
  });
  useEffect(() => {
    setSessionEditableIds(prev => {
      let changed = false;
      const next = new Set(prev);
      (items || []).forEach(it => {
        if (it?.id && !next.has(it.id) && isWithinItemEditWindow(it)) {
          next.add(it.id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [items]);
  // פריטים ש"נפתחו מחדש" לעריכה מלאה באישור מנהל אחרי שחלון ה-15 הדקות נסגר (ר' handleReopenFullEdit) —
  // נשאר בתוקף לכל שאר הביקור באותו כרטיס, בדיוק כמו sessionEditableIds.
  const [forceEditableIds, setForceEditableIds] = useState(() => new Set());
  const canFullyEditItem = (item) => {
    if (!item) return false;
    if (item.isTaken && !item.isReturned) return false;
    if (item.isNew || !item.id) return true;
    return sessionEditableIds.has(item.id) || forceEditableIds.has(item.id);
  };

  // חלון העריכה המלא (15 דק') נעל את הפריט - נדרש אישור מנהל כדי לפתוח אותו מחדש לעריכה
  // מלאה (דגם/מידה/תיקונים), כמו הפתיחה מחדש של הזמנה נעולה למעלה (handleUnlock בעמוד ההזמנה).
  const handleReopenFullEdit = async (item) => {
    const authResult = await window.customAuthPrompt('חלון העריכה המלא (15 דק׳) לפריט זה נסגר. נדרש אישור מנהל לפתיחתו מחדש לעריכה מלאה. אנא בחר מנהל והזן סיסמה:', 'מנהל');
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מנהל' })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'סיסמה שגויה או הרשאה לא מספקת.');
        return;
      }
      setForceEditableIds(prev => new Set(prev).add(item.id));
    } catch (err) {
      alert('שגיאה באימות קוד מנהל.');
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
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

  useImperativeHandle(ref, () => ({
    scan: (barcode) => handleBarcodeScan(barcode)
  }));

  // סריקת ברקוד (מהסיידבר) — משכירה פריט ממתין או מחזירה פריט מושכר.
  // פורט מלוגיקת ההשכרות הקודמת: אישור עובד כשלא שולם, אימות מלאי בשרת,
  // וטיפול בפריט שטרם הוחזר מהזמנה אחרת.
  const handleBarcodeScan = async (rawBarcode) => {
    const barcode = (rawBarcode || '').trim();
    if (!barcode) return;

    // בהזמנה נעולה מותרת רק החזרה — סריקה של פריט שמושכר בהזמנה זו; כל סריקת השכרה נחסמת
    if (locked) {
      const isReturnScan = activeItems.some(i => {
        const b = i.barcode || i.dressItem?.barcode || i.dressItem?.dressBarcode;
        return b === barcode && i.isTaken && !i.isReturned;
      });
      if (!isReturnScan) {
        alert('ההזמנה נעולה (תאריך האירוע עבר) — ניתן לבצע החזרה בלבד. השכרה דורשת שחרור באישור מנהל.');
        return;
      }
    }

    if (!isFullyPaid) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע פעולה ללא תשלום מלא. נדרש אישור מנהל:", 'מנהל');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מנהל' })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
      } catch (err) {
        alert('שגיאה באימות קוד.');
        return;
      }
    }

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
    // התאמה מדויקת לפי ברקוד שכבר משוייך לפריט — חד-משמעית, אין צורך לבחור
    let matchedItem = activeItems.find(i => {
      const b = i.barcode || i.dressItem?.barcode || i.dressItem?.dressBarcode;
      return b && b === barcode;
    }) || null;

    let candidates = [];
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

    // כמה פריטים זהים (אותו דגם/מידה) תואמים לברקוד — לשאול את המשתמש לאיזה מהם לשייך אותו
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

  const handleItemChange = (index, field, value) => {
    onItemsChange(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return updatedItems;
    });
  };

  const handleModelChange = (index, model) => {
    if (!model || !model.id) {
      onItemsChange(prev => {
        const updatedItems = [...prev];
        updatedItems[index] = {
          ...updatedItems[index],
          dressModelId: '',
          barcodePrefix: '',
          description: '',
          sizeText: ''
        };
        return updatedItems;
      });
      return;
    }
    onItemsChange(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = {
        ...updatedItems[index],
        dressModelId: model.id,
        barcodePrefix: model.barcodePrefix,
        description: model.name,
        sizeText: ''
      };
      return updatedItems;
    });
  };

  const handleConfirmItem = async (index) => {
    const item = items[index];
    // פריטים מיובאים מ-Access בלי DressItem מקושר מזוהים לפי barcodePrefix בלבד ולא dressModelId —
    // מותר לאשר עריכת תיקונים עבורם בלי לדרוש בחירת דגם דרך הבורר (שאין להם ממנו מה לבחור)
    const hasModelIdentity = !!(item.dressModelId || item.barcodePrefix || item.dressItem?.dressModelId || item.dressItem?.barcodePrefix);
    if (!item.sizeText || !hasModelIdentity) {
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
      // forceFullEdit מועבר רק כשחלון ה-15 הדקות כבר נסגר ונפתח מחדש באישור מנהל (ר' handleReopenFullEdit) -
      // השרת בודק את זה מול חלון העריכה בפועל, לא רק מסתמך על ה-state המקומי כאן.
      const body = forceEditableIds.has(item.id) ? { ...item, forceFullEdit: true } : item;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
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
    onItemsChange(prev => {
      const updatedItems = [...prev];
      updatedItems[index] = {
        ...item,
        isEditing: true,
        originalState: { ...item },
        dressModelId: item.dressModelId || item.dressItem?.dressModelId,
        sizeText: item.sizeText || item.dressItem?.sizeText || item.dressItem?.size || '',
        // שם נקי בלי "(קוד: X)" — item.description מהשרת כולל את הקוד בסוגריים,
        // וזה היה מוצג כפי שהוא בתיבת בורר הדגם בעת עריכה
        description: itemName(item)
      };
      return updatedItems;
    });
  };

  const cancelEditItem = (index) => {
    onItemsChange(prev => {
      const updatedItems = [...prev];
      const original = updatedItems[index].originalState;
      updatedItems[index] = original ? { ...original } : { ...updatedItems[index], isEditing: false };
      return updatedItems;
    });
  };

  const cancelNewItem = (index) => {
    onItemsChange(prev => {
      const updatedItems = [...prev];
      updatedItems.splice(index, 1);
      return updatedItems;
    });
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
    if (locked) return;
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
    onItemsChange(prev => [...prev, newItem]);
    setTimeout(() => listEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  };

  // ===== השכרה/החזרה (זהה ללוגיקה במנהל ההשכרות) =====
  // כל הפעולות כאן עוברות דרך await (אישור PIN/תשלום) לפני העדכון בפועל — לכן העדכון האופטימי
  // וגם השחזור בכשלון חייבים להיות פונקציונליים (prev => ...) ולגעת רק בפריט הרלוונטי, אחרת
  // עריכה אחרת שקרתה באותו חלון זמן (למשל שינוי בפריט אחר) עלולה להידרס.
  const handleRent = async (item, barcodeToAssign = null, skipAuth = false) => {
    if (!isFullyPaid && !skipAuth) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע השכרה ללא תשלום מלא. נדרש אישור מנהל:", 'מנהל');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מנהל' })
        });
        const data = await res.json();
        if (!data.success) {
          alert('סיסמה שגויה או שאין מספיק הרשאות');
          return;
        }
      } catch (e) {
        console.error(e);
        return;
      }
    }
    onItemsChange(prev => prev.map(i => {
      if (i.id !== item.id) return i;
      const updateData = { isTaken: true, takenDate: new Date() };
      if (barcodeToAssign) updateData.barcode = barcodeToAssign;
      return { ...i, ...updateData };
    }));

    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'rent', barcode: barcodeToAssign })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בשמירת סטטוס השכרה');
        onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isTaken: item.isTaken, takenDate: item.takenDate, barcode: item.barcode } : i));
      }
    }
  };

  const handleReturn = async (item, skipAuth = false) => {
    if (!isFullyPaid && !skipAuth) {
      const authResult = await window.customAuthPrompt("לא ניתן לבצע החזרה ללא תשלום מלא. נדרש אישור מנהל:", 'מנהל');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'מנהל' })
        });
        const data = await res.json();
        if (!data.success) {
          alert('סיסמה שגויה או שאין מספיק הרשאות');
          return;
        }
      } catch (e) {
        console.error(e);
        return;
      }
    }
    onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isReturned: true, returnDate: new Date() } : i));

    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'return' })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בשמירת סטטוס החזרה');
        onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isReturned: item.isReturned, returnDate: item.returnDate } : i));
      }
    }
  };

  const handleCancelRent = async (item) => {
    onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isTaken: false, takenDate: null, barcode: null } : i));
    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'undoRent' })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בביטול סטטוס השכרה');
        onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isTaken: item.isTaken, takenDate: item.takenDate, barcode: item.barcode } : i));
      }
    }
  };

  const handleCancelReturn = async (item) => {
    onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isReturned: false, returnDate: null } : i));
    if (item.id && !item.isNew) {
      try {
        const res = await fetch('/api/rentals/toggle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId: item.id, action: 'undoReturn' })
        });
        if (!res.ok) throw new Error('API failed');
      } catch (err) {
        alert('שגיאה בביטול סטטוס החזרה');
        onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isReturned: item.isReturned, returnDate: item.returnDate } : i));
      }
    }
  };

  // סימון מצב הפריט אחרי שהוחזר: תקין / לא תקין.
  // "לא תקין" עובר דרך report-issue כדי שתתווסף גם ההערה האוטומטית בכרטיס הלקוח,
  // בדיוק כמו "דווח על בעיה" בחלון "השכרה והחזרה".
  const handleSetReturnCondition = async (item, ok) => {
    if (!item?.id || item.isNew || !item.isReturned) return;
    const current = item.returnedOk !== false;
    if (current === ok) return;

    // ההערה נאספת כאן, ברגע הסימון עצמו - לא רק בשלב נפרד אחרי - כדי שאפשר יהיה
    // לתעד מיד מה בדיוק לא תקין בפריט (למשל "לא ענו לגבי כתם בשרוול").
    let note = null;
    if (!ok) {
      note = window.customPrompt
        ? await window.customPrompt('לסמן את הפריט כ"הוחזר - לא תקין"? ניתן להוסיף הערה על הבעיה (אופציונלי) - תתווסף גם הערה אוטומטית בכרטיס הלקוח:', '', 'text')
        : window.prompt('לסמן את הפריט כ"הוחזר - לא תקין"? ניתן להוסיף הערה על הבעיה (אופציונלי):', '');
      if (note === null) return;
    }

    setSavingConditionId(item.id);
    onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, returnedOk: ok } : i));
    try {
      const res = ok
        ? await fetch('/api/rentals/toggle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: item.id, action: 'setReturnCondition', returnedOk: true })
          })
        : await fetch('/api/returns/report-issue', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderItemId: item.id, issueType: 'returned-bad', note })
          });
      if (!res.ok) throw new Error('API failed');
    } catch (err) {
      alert('שגיאה בעדכון מצב הפריט');
      onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, returnedOk: item.returnedOk } : i));
    } finally {
      setSavingConditionId(null);
    }
  };

  const showItemDetails = async (item) => {
    setExpandedHistory({});
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

  // שם הדגם בלבד — בלי "(קוד: X)" שמוטמע בתיאור, כי הקוד מוצג בכיתוב הקטן מתחת
  const itemName = (item) => {
    const raw = item.dressItem?.dress?.name || item.description || item.dressItem?.dressName || 'פריט כללי';
    return raw.replace(/\s*\(קוד:[^)]*\)/g, '').trim() || 'פריט כללי';
  };

  const itemCode = (item) => item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix || null;

  // מזהה הדגם, כשקיים — מאפשר קפיצה מהפריט בהזמנה אל כרטיס הדגם.
  // פריטים שהוגרו מ-Access בלי DressItem מקושר לא יקבלו קישור.
  const itemModelId = (item) => item.dressModelId || item.dressItem?.dressModelId || null;

  const isChecked = (v) => v === 1 || v === true;

  const renderRepairChips = (item, index) => {
    const neck = isChecked(item.neckAlteration);
    const sleeve = isChecked(item.sleeveAlteration);
    const length = item.lengthAlteration && String(item.lengthAlteration).trim() !== '' ? item.lengthAlteration : null;
    const hasAny = neck || sleeve || length;
    return (
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {neck && <span className="chip" title="תיקון צוואר"><svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-scissors" /></svg>צוואר</span>}
        {sleeve && <span className="chip" title="תיקון שרוול"><svg className="icon" style={{ width: '12px', height: '12px' }}><use href="#i-scissors" /></svg>שרוול</span>}
        {length && <span className="chip">{length} ס"מ</span>}
        {!hasAny && <span className="chip" style={{ opacity: .7 }}>ללא תיקונים</span>}
        {hasAny && (
          <button
            type="button"
            className={`badge ${item.alterationDone ? 'badge-success' : 'badge-warning'}`}
            style={{ border: 'none', font: 'inherit', cursor: locked ? 'default' : 'pointer' }}
            title={(item.alterationDetails ? `פירוט: ${item.alterationDetails} · ` : '') + (locked ? 'הזמנה נעולה' : 'לחץ לשינוי סטטוס ביצוע התיקון')}
            onClick={() => { if (!locked) handleItemChange(index, 'alterationDone', !item.alterationDone); }}
          >
            {item.alterationDone ? <><svg className="icon"><use href="#i-check" /></svg>בוצע</> : 'לא בוצע'}
          </button>
        )}
        {hasAny && item.alterationDetails && (
          <span className="hint" style={{ flexBasis: '100%', fontSize: '11.5px', color: 'var(--text-3)' }}>{item.alterationDetails}</span>
        )}
      </div>
    );
  };

  const renderStatusBadge = (item) => {
    if (item.isReturned) {
      if (item.returnedOk === false) {
        return <span className="badge badge-danger"><svg className="icon"><use href="#i-alert-tri" /></svg>הוחזר - לא תקין</span>;
      }
      return <span className="badge badge-success"><svg className="icon"><use href="#i-check" /></svg>הוחזר - תקין</span>;
    }
    if (item.isTaken) return <span className="badge badge-info"><svg className="icon"><use href="#i-box" /></svg>בהשכרה</span>;
    return <span className="badge badge-neutral">ממתין</span>;
  };

  // בורר מצב לפריט שהוחזר — זמין גם בהזמנה נעולה, כי פריט מוחזר הוא כמעט תמיד של אירוע שעבר
  const renderConditionToggle = (item) => {
    const isGood = item.returnedOk !== false;
    const busy = savingConditionId === item.id;
    return (
      <div className="toggle-btn-group" title="מצב הפריט בהחזרה">
        <button type="button" className={isGood ? 'on' : ''} disabled={busy} title="תקין"
          onClick={(e) => { e.stopPropagation(); handleSetReturnCondition(item, true); }}>
          <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-check-circle" /></svg>
        </button>
        <button type="button" className={!isGood ? 'off' : ''} disabled={busy} title="לא תקין"
          onClick={(e) => { e.stopPropagation(); handleSetReturnCondition(item, false); }}>
          <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-alert-tri" /></svg>
        </button>
      </div>
    );
  };

  const showAlterCol = enableAlterations && showAlterations;
  const visibleItems = (items || []).map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => showDeleted || !item.isDeleted);

  return (
    <>
      {locked && (
        <div className="callout callout-warning" style={{ marginBottom: '16px' }}>
          <svg className="icon"><use href="#i-lock" /></svg>
          <span>ההזמנה נעולה — תאריך האירוע עבר. ניתן לבצע החזרה מהשכרה בלבד; השכרה, עריכה ומחיקה חסומות עד שחרור באישור מנהל דרך אייקון המנעול למעלה.</span>
        </div>
      )}

      {/* סרגל עליון של הטאב — כפתור ההוספה, בוררי תצוגה ומונה פריטים */}
      <div className="toolbar">
        {!locked && (
          <button type="button" className="btn btn-primary btn-sm" title="הוסף פריט חדש" onClick={handleAddItem}>
            <svg className="icon"><use href="#i-plus" /></svg>הוסף פריט
          </button>
        )}
        {enableAlterations && (
          <div className="pill-tabs">
            <button type="button" className={`pill-tab ${showAlterations ? 'active' : ''}`} onClick={() => setShowAlterations(v => !v)} title="הצגת עמודת התיקונים">
              {showAlterations && <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-check" /></svg>}פרטי תיקונים
            </button>
            <button type="button" className={`pill-tab ${showDeleted ? 'active' : ''}`} onClick={() => setShowDeleted(v => !v)} title="הצגת פריטים שנמחקו">
              {showDeleted && <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-check" /></svg>}פריטים מחוקים
            </button>
          </div>
        )}
        {!enableAlterations && (
          <button type="button" className={`pill-tab ${showDeleted ? 'active' : ''}`} onClick={() => setShowDeleted(v => !v)} title="הצגת פריטים שנמחקו">
            {showDeleted && <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-check" /></svg>}פריטים מחוקים
          </button>
        )}
        <span className="spacer" />
        <span className="hint" style={{ color: 'var(--text-3)' }}>
          {activeItems.length} פריטים פעילים{totalPrice > 0 ? ` · סה"כ ₪${totalPrice.toLocaleString('he-IL')}` : ''}
        </span>
      </div>

      {visibleItems.length > 0 ? (
        <div className="table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>תיאור דגם ומידה</th>
                  {showAlterCol && <th>תיקונים</th>}
                  <th style={{ textAlign: 'center', width: '110px' }}>סטטוס</th>
                  <th></th>
                  <th style={{ textAlign: 'center', width: '110px' }}>פרטים</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map(({ item, originalIndex }) => {
                  const isDeletedRow = item.isDeleted;
                  const isRented = item.isTaken && !item.isReturned;
                  const isEditingMode = item.isNew || item.isEditing;
                  // פריטים ישנים שהוגרו מ-Access בלי DressItem מקושר (dressModelId ריק) אין להם
                  // מלאי מזוהה לבחור ממנו — עבורם דגם/מידה נשארים לקריאה בלבד גם במצב עריכה,
                  // ורק פרטי התיקון ניתנים לעריכה.
                  const fullyEditableNow = canFullyEditItem(item);
                  const canEditModelSize = item.isNew || (item.isEditing && !!item.dressModelId && fullyEditableNow);
                  const code = itemCode(item);
  
                  return (
                    <tr key={item.id || item._localId || originalIndex} className={isDeletedRow ? 'row-flag' : ''}>
                      <td>
                        {canEditModelSize ? (
                          <div className="form-grid" style={{ gap: '8px', gridTemplateColumns: '1fr 1fr' }}>
                            <div className="field" style={{ marginBottom: 0 }}>
                              <label>דגם</label>
                              <OrderModelSelector
                                value={{ name: item.description, id: item.dressModelId }}
                                onChange={(model) => handleModelChange(originalIndex, model)}
                              />
                            </div>
                            <div className="field" style={{ marginBottom: 0 }}>
                              <label>מידה</label>
                              <OrderSizeSelector
                                modelId={item.dressModelId}
                                order={order}
                                value={item.sizeText}
                                onChange={(val) => handleItemChange(originalIndex, 'sizeText', val)}
                                inventoryCache={inventoryCache}
                                // הפריט הנערך עצמו לא נספר כ"תפוס" מול עצמו — אחרת המידה הנוכחית שלו
                                // תוצג כלא זמינה רק כי הוא כבר מחזיק אותה
                                currentCartItems={items.filter((_, i) => i !== originalIndex)}
                              />
                            </div>
                          </div>
                        ) : (
                          <>
                            {itemModelId(item) ? (
                              <a
                                href={`/dashboard/dresses/${itemModelId(item)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="פתח כרטיס דגם"
                                className="cell-primary"
                                style={isDeletedRow ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}
                              >
                                {itemName(item)}{item.sizeText ? ` - ${item.sizeText}` : ''}
                              </a>
                            ) : (
                              <strong style={isDeletedRow ? { textDecoration: 'line-through', color: 'var(--text-3)' } : undefined}>
                                {itemName(item)}{item.sizeText ? ` - ${item.sizeText}` : ''}
                              </strong>
                            )}
                            {code && <div className="cell-muted" style={{ fontWeight: 400, fontSize: '11.5px', marginTop: '2px' }}>קוד: {code}{item.barcode ? ` · ברקוד: ${item.barcode}` : ''}</div>}
                          </>
                        )}
                      </td>
                      {showAlterCol && (
                        <td>
                          {isEditingMode ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {!item.isNew && !fullyEditableNow && (
                                <div className="hint" style={{ flexBasis: '100%', fontSize: '11.5px', color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span>חלון העריכה המלא (15 דק׳) נסגר — ניתן לערוך כעת רק את פירוט התיקון</span>
                                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleReopenFullEdit(item)}>
                                    <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-unlock" /></svg>
                                    פתיחת עריכה מלאה (אישור מנהל)
                                  </button>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <button type="button"
                                  className={`pill-tab ${isChecked(item.neckAlteration) ? 'active' : ''}`}
                                  disabled={!fullyEditableNow}
                                  onClick={() => handleItemChange(originalIndex, 'neckAlteration', isChecked(item.neckAlteration) ? 0 : 1)}>
                                  <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-scissors" /></svg>צוואר
                                </button>
                                <button type="button"
                                  className={`pill-tab ${isChecked(item.sleeveAlteration) ? 'active' : ''}`}
                                  disabled={!fullyEditableNow}
                                  onClick={() => handleItemChange(originalIndex, 'sleeveAlteration', isChecked(item.sleeveAlteration) ? 0 : 1)}>
                                  <svg className="icon" style={{ width: '11px', height: '11px' }}><use href="#i-scissors" /></svg>שרוול
                                </button>
                                <input type="text" inputMode="decimal" className="input" style={{ maxWidth: '100px' }} value={item.lengthAlteration || ''}
                                  disabled={!fullyEditableNow}
                                  onChange={(e) => handleItemChange(originalIndex, 'lengthAlteration', e.target.value)}
                                  placeholder="אורך (ס״מ)" />
                              </div>
                              <input type="text" className="input" autoComplete="off" value={item.alterationDetails || item.repairs || ''}
                                onChange={(e) => handleItemChange(originalIndex, 'alterationDetails', e.target.value)}
                                placeholder="פירוט התיקון הנדרש..." />
                            </div>
                          ) : (
                            renderRepairChips(item, originalIndex)
                          )}
                        </td>
                      )}
                      <td style={{ textAlign: 'center' }}>
                        {item.isNew ? <span className="badge badge-neutral">חדש</span> : renderStatusBadge(item)}
                      </td>
                      <td>
                        <div className="row-actions" style={{ flexWrap: 'wrap' }}>
                          {locked ? (
                            // הזמנה נעולה — מותרות החזרה וסימון מצב הפריט בלבד; עריכה, השכרה וביטולים חסומים
                            isRented ? (
                              <button type="button" className="btn btn-secondary btn-sm"
                                onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'return' }); }}>
                                <svg className="icon"><use href="#i-check" /></svg>החזרה
                              </button>
                            ) : item.isReturned && !isDeletedRow ? (
                              renderConditionToggle(item)
                            ) : (
                              <span className="hint" style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>נעול</span>
                            )
                          ) : isEditingMode ? (
                            <>
                              <button type="button" className="btn btn-primary btn-sm"
                                disabled={savingItemIndex === originalIndex}
                                onClick={(e) => { e.stopPropagation(); handleConfirmItem(originalIndex); }}>
                                {savingItemIndex === originalIndex ? <><span className="spinner" style={{ width: '13px', height: '13px', borderWidth: '2px' }} />שומר...</> : <><svg className="icon"><use href="#i-check" /></svg>אישור</>}
                              </button>
                              <button type="button" className="btn btn-secondary btn-sm"
                                disabled={savingItemIndex === originalIndex}
                                onClick={(e) => { e.stopPropagation(); item.isNew ? cancelNewItem(originalIndex) : cancelEditItem(originalIndex); }}>
                                <svg className="icon"><use href="#i-x" /></svg>ביטול
                              </button>
                            </>
                          ) : isDeletedRow ? null : (
                            <>
                              {!item.isTaken && (
                                <button type="button" className="btn btn-secondary btn-sm"
                                  title={canFullyEditItem(item) ? 'ערוך פרטי פריט' : 'חלון העריכה המלא (15 דק׳) נסגר — ניתן לערוך רק את פירוט התיקון'}
                                  onClick={(e) => { e.stopPropagation(); handleEditItem(originalIndex); }}>
                                  <svg className="icon"><use href="#i-edit" /></svg>עריכה
                                </button>
                              )}
                              {!item.isTaken && !item.isNew && (
                                <button type="button" className="btn btn-primary btn-sm"
                                  onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'rent' }); }}>
                                  <svg className="icon"><use href="#i-box" /></svg>השכרה
                                </button>
                              )}
                              {isRented && (
                                <>
                                  <button type="button" className="btn btn-secondary btn-sm"
                                    onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'return' }); }}>
                                    <svg className="icon"><use href="#i-check" /></svg>החזרה
                                  </button>
                                  <button type="button" className="btn btn-danger-ghost btn-sm" title="בטל השכרה"
                                    onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelRent' }); }}>
                                    <svg className="icon"><use href="#i-x-circle" /></svg>ביטול
                                  </button>
                                </>
                              )}
                              {item.isReturned && (
                                <>
                                  {renderConditionToggle(item)}
                                  <button type="button" className="btn btn-danger-ghost btn-sm" title="בטל החזרה"
                                    onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelReturn' }); }}>
                                    <svg className="icon"><use href="#i-refresh" /></svg>ביטול החזרה
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                          {!item.isNew && (
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="פרטים נוספים והיסטוריה"
                              onClick={(e) => { e.stopPropagation(); showItemDetails(item); }}>
                              <svg className="icon"><use href="#i-info" /></svg>
                            </button>
                          )}
                          {!item.isNew && (
                            <button type="button" className="btn btn-ghost btn-icon-only btn-sm" title="בדוק תפוסה לתאריך אירוע"
                              onClick={(e) => { e.stopPropagation(); setCapacityModalItem(item); }}>
                              <svg className="icon"><use href="#i-calendar" /></svg>
                            </button>
                          )}
                          {/* מחיקה — לא זמינה לפריט שנלקח (מושכר או הוחזר) או בהזמנה נעולה; שחזור תמיד מוצג לשורה מחוקה */}
                          {!locked && !item.isNew && (isDeletedRow || !item.isTaken) && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon-only btn-sm"
                              title={isDeletedRow ? 'שחזר פריט' : 'מחק פריט'}
                              onClick={(e) => { e.stopPropagation(); toggleDeleted(originalIndex); }}
                            >
                              <svg className="icon"><use href={isDeletedRow ? '#i-refresh' : '#i-trash'} /></svg>
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
        </div>
      ) : (
        <div className="table-wrap">
          <div className="table-scroll">
            <div className="empty-state">
              <svg className="icon"><use href="#i-bag" /></svg>
              <h4>אין פריטים להזמנה זו</h4>
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: '10px' }} onClick={handleAddItem}>
                <svg className="icon"><use href="#i-plus" /></svg>הוסף פריט ראשון
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודל אישור השכרה/החזרה ===== */}
      {confirmModal.isOpen && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmModal({ isOpen: false, item: null, actionType: null }); }}>
          <div className="modal confirm-modal" style={{ margin: 0 }}>
            <div className="modal-icon-circle" style={{ background: 'var(--primary-tint)', color: 'var(--primary-solid)' }}>
              <svg className="icon"><use href={confirmModal.actionType === 'return' ? '#i-check' : confirmModal.actionType === 'rent' ? '#i-box' : '#i-x-circle'} /></svg>
            </div>
            <h3>
              {confirmModal.actionType === 'rent' ? 'אישור השכרה' : confirmModal.actionType === 'return' ? 'אישור החזרה' : confirmModal.actionType === 'cancelRent' ? 'ביטול השכרה' : 'ביטול החזרה'}
            </h3>
            <p>
              האם אתה בטוח שברצונך {confirmModal.actionType === 'rent' ? 'לסמן פריט זה כמושכר' : confirmModal.actionType === 'return' ? 'לסמן פריט זה כמוחזר' : confirmModal.actionType === 'cancelRent' ? 'לבטל את השכרת הפריט' : 'לבטל את החזרת הפריט'}?
            </p>
            {!isFullyPaid && (confirmModal.actionType === 'rent' || confirmModal.actionType === 'return') && (
              <div className="callout callout-danger" style={{ marginBottom: '20px', textAlign: 'start' }}>
                <svg className="icon"><use href="#i-alert-tri" /></svg>
                <span>שים לב: ההזמנה לא שולמה במלואה! נדרש אישור מנהל.</span>
              </div>
            )}
            {confirmModal.actionType === 'rent' && (confirmModal.item?.barcodePrefix || confirmModal.item?.dressItem?.barcodePrefix) && (
              <div className="callout" style={{ marginBottom: '20px', textAlign: 'start' }}>
                <svg className="icon"><use href="#i-info" /></svg>
                <span>טיפ: אפשר לדלג על החלון הזה — סריקת הברקוד בשדה &quot;סריקה מהירה&quot; למעלה משכירה כמה שמלות ברצף, אחת אחרי השנייה.</span>
              </div>
            )}
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmModal({ isOpen: false, item: null, actionType: null })}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={async () => {
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

      {/* ===== מודל בחירת פריט — כשכמה פריטים זהים בהזמנה תואמים לברקוד שנסרק ===== */}
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
                {itemChoiceModal.candidates.map((item, idx) => {
                  const hasRepair = isChecked(item.neckAlteration) || isChecked(item.sleeveAlteration) ||
                    (item.lengthAlteration && String(item.lengthAlteration).trim() !== '');
                  return (
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
                          <span className={`badge ${hasRepair ? 'badge-warning' : 'badge-neutral'}`}>
                            {hasRepair && <svg className="icon"><use href="#i-scissors" /></svg>}{hasRepair ? 'עם תיקון' : 'ללא תיקון'}
                          </span>
                        </div>
                      </span>
                      <svg className="icon" style={{ color: 'var(--text-3)' }}><use href="#i-chevron-start" /></svg>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setItemChoiceModal({ isOpen: false, candidates: [], barcode: null })}>ביטול</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודל ברקוד ידני להשכרה ===== */}
      {showManualScanModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowManualScanModal(false); setManualBarcode(''); } }}>
          <div className="modal" style={{ margin: 0, maxWidth: '400px' }}>
            <div className="modal-head">
              <strong>הזנת ברקוד ידנית</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => { setShowManualScanModal(false); setManualBarcode(''); }}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body">
              <p className="hint" style={{ color: 'var(--text-2)', marginTop: 0 }}>הזן את הברקוד המופיע על הפריט כדי לאשר את הפעולה.</p>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setShowManualScanModal(false);
                const barcode = manualBarcode.trim();
                setManualBarcode('');
                if (selectedItemForScan) await handleRent(selectedItemForScan, barcode);
              }}>
                <div className="input-icon-wrap" style={{ marginBottom: '14px' }}>
                  <svg className="icon"><use href="#i-tag" /></svg>
                  <input type="text" className="input" autoFocus placeholder="סרוק או הקלד ברקוד..." value={manualBarcode}
                    onChange={(e) => setManualBarcode(e.target.value)} style={{ textAlign: 'center', direction: 'ltr' }} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>בצע סריקה</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ===== מודל פרטי פריט (חיובים + היסטוריה) ===== */}
      {mounted && detailsModalItem && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetailsModalItem(null); }}>
          <div className="modal" style={{ margin: 0, maxWidth: '720px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-head">
              <strong>פרטי פריט: {itemName(detailsModalItem)}</strong>
              <button type="button" className="btn btn-ghost btn-icon-only btn-sm" onClick={() => setDetailsModalItem(null)}>
                <svg className="icon"><use href="#i-x" /></svg>
              </button>
            </div>
            <div className="modal-body" style={{ overflowY: 'auto' }}>
              <span className="hint" style={{ color: 'var(--text-2)', fontWeight: 700 }}>תשלומים וחיובים לפריט זה (חיוב, זיכוי, ביטול, תיקונים)</span>
              <div className="table-wrap" style={{ margin: '8px 0 16px', maxHeight: '190px', overflowY: 'auto' }}>
                <div className="table-scroll">
                  {(() => {
                    if (!order || !order.obligations) return <div className="empty-state" style={{ padding: '16px' }}>לא נמצאו חיובים מפורטים</div>;
                    const searchStr = `(פריט #${detailsModalItem.id})`;
                    const cleanTxt = (t) => (t || '').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '').trim();
                    // כל ההתחייבויות שמשויכות לפריט — כולל זיכויים/ביטולים (סכומים שליליים)
                    const relatedObligations = order.obligations.filter(obs =>
                      !obs.isDeleted && obs.description && obs.description.includes(searchStr)
                    );
                    if (relatedObligations.length === 0) return <div className="empty-state" style={{ padding: '16px' }}>אין חיובים מפורטים לפריט זה</div>;
                    return (
                      <table className="data">
                        <tbody>
                          {relatedObligations.map((obs, idx) => {
                            const isCredit = obs.amount < 0;
                            const label = cleanTxt(obs.productName)
                              || (isCredit ? 'זיכוי / ביטול' : (obs.description.includes('תיקון') ? 'תיקון' : 'חיוב'));
                            const desc = cleanTxt(obs.description);
                            // ברוב החיובים ה-productName וה-description זהים — לא להציג את אותו טקסט פעמיים
                            const showDesc = desc && desc !== label;
                            return (
                              <tr key={idx}>
                                <td className="cell-primary" colSpan={showDesc ? 1 : 2}>
                                  {label}
                                  {isCredit && <span className="badge badge-danger" style={{ marginInlineStart: '6px' }}>זיכוי</span>}
                                </td>
                                {showDesc && <td className="cell-muted">{desc}</td>}
                                <td style={{ fontWeight: 700, color: isCredit ? 'var(--success)' : 'var(--danger)', direction: 'ltr', textAlign: 'left' }}>
                                  {isCredit ? `-₪${Math.abs(obs.amount)}` : `₪${obs.amount}`}
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ fontWeight: 700, background: 'var(--surface-alt)' }}>
                            <td colSpan={2}>סה"כ לפריט</td>
                            <td style={{ color: 'var(--success)', direction: 'ltr', textAlign: 'left' }}>₪{relatedObligations.reduce((sum, obs) => sum + obs.amount, 0)}</td>
                          </tr>
                        </tbody>
                      </table>
                    );
                  })()}
                </div>
              </div>

              {(() => {
                // כל התאריכים עם תאריך עברי: הוספה, לקיחה, החזרה
                const fmtFull = (d0) => {
                  if (!d0) return null;
                  const d = new Date(d0);
                  if (isNaN(d.getTime())) return null;
                  return `${d.toLocaleDateString('he-IL')} (${getHebrewDateString(d)}) · ${d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}`;
                };
                const addedDate = fmtFull(detailsModalItem.orderDate || order?.orderDate || detailsModalItem.createdAt);
                const takenDate = fmtFull(detailsModalItem.takenDate);
                const returnDate = fmtFull(detailsModalItem.returnDate);
                return (
                  <div className="form-grid cols-3" style={{ marginBottom: '16px' }}>
                    <div>
                      <span className="hint" style={{ color: 'var(--text-3)' }}>תאריך הוספה</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px' }}>{addedDate || '-'}</div>
                    </div>
                    <div>
                      <span className="hint" style={{ color: 'var(--text-3)' }}>תאריך השכרה (לקיחה)</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: takenDate ? undefined : 'var(--text-3)' }}>
                        {takenDate || 'טרם הושכר'}
                      </div>
                    </div>
                    <div>
                      <span className="hint" style={{ color: 'var(--text-3)' }}>תאריך החזרה</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, marginTop: '2px', color: returnDate ? undefined : 'var(--text-3)' }}>
                        {returnDate || 'טרם הוחזר'}
                      </div>
                    </div>
                  </div>
                );
              })()}

              <span className="hint" style={{ color: 'var(--text-2)', fontWeight: 700 }}>היסטוריית שינויים</span>
              <div className="card" style={{ marginTop: '8px', maxHeight: '250px', overflowY: 'auto' }}>
                {detailsModalItem.loadingLogs ? (
                  <div className="loading-inline"><span className="spinner" />טוען היסטוריה...</div>
                ) : detailsModalItem.auditLogs && detailsModalItem.auditLogs.length > 0 ? (
                  dedupeAuditLogs(detailsModalItem.auditLogs).map((log, idx) => {
                    const actionLabel = ACTION_TRANSLATIONS[log.action] || log.action;
                    let changesNode = null;
                    try {
                      const changes = typeof log.changesJson === 'string' ? JSON.parse(log.changesJson) : log.changesJson;
                      const rows = [];
                      for (const [key, value] of Object.entries(changes)) {
                        if (value === null || value === undefined || value === '') continue;
                        if (HIDDEN_HISTORY_FIELDS.includes(key)) continue;
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
                        ? <div style={{ fontSize: '12px', lineHeight: 1.7 }}>{rows}</div>
                        : <div className="hint" style={{ fontStyle: 'italic', color: 'var(--text-3)' }}>אין שינויים רלוונטיים להצגה</div>;
                    } catch (e) {
                      changesNode = <div style={{ fontSize: '12px', fontFamily: 'Consolas, monospace' }}>{String(log.changesJson)}</div>;
                    }
                    const isExpanded = !!expandedHistory[idx];
                    return (
                      <div key={idx}>
                        <button type="button" className="select-row" style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', font: 'inherit', textAlign: 'start', color: 'inherit' }}
                          onClick={() => toggleHistoryExpand(idx)}>
                          <svg className="icon" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .15s ease', color: 'var(--text-3)' }}><use href="#i-chevron-down" /></svg>
                          <span className="badge badge-primary">{actionLabel}</span>
                          <span className="hint" style={{ color: 'var(--text-3)' }}>
                            {new Date(log.createdAt).toLocaleDateString('he-IL')} ({getHebrewDateString(log.createdAt)}) · {new Date(log.createdAt).toLocaleTimeString('he-IL', { timeStyle: 'short' })}
                          </span>
                        </button>
                        {isExpanded && <div style={{ padding: '0 16px 12px 44px' }}>{changesNode}</div>}
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state" style={{ padding: '16px' }}>אין היסטוריית שינויים להצגה</div>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => setDetailsModalItem(null)}>סגור</button>
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
});

export default ModernItemsManager;
