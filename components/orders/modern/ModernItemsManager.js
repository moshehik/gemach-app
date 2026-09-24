'use client';

import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import OrderModelSelector from '../OrderModelSelector';
import OrderSizeSelector, { SizeChips } from '../OrderSizeSelector';
import ItemCapacityModal from '../ItemCapacityModal';
import { FIELD_TRANSLATIONS, ACTION_TRANSLATIONS } from '../../HistoryViewer';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { isWithinItemEditWindow, parseSizeEditDays, evaluateSizeOnlyEdit } from '../../../lib/orderItemEditWindow';
import { normalizeGapRule } from '../../../lib/priceRows';
import { calculateDynamicAvailability } from '../../../lib/clientInventory';
import { sortSizeRows } from '../../../lib/sizeSort';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { postRentalRent, postRentalReturn } from './rentalToggle';
import { V3Page, Dialog, Btn, Chip, Tag, Field, Row, Rows, Seg, Tip, Banner, Empty, Icon } from '@/app/v3/ui/components';
import { cx } from '@/app/v3/ui/cx';
import '../orderItemsV3.css';

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
  // המחירון (נטען רק כשהחלפת מידה בתוך הפריט פעילה) והודעת דחייה לבחירת מידה מקטגוריה אחרת
  const [priceList, setPriceList] = useState([]);
  const [sizeSwapNotice, setSizeSwapNotice] = useState({});
  const [expandedHistory, setExpandedHistory] = useState({});
  // פתיחה/סגירה של כרטיסי הפריטים (תצוגה בלבד) — מפתח = מזהה השורה; שורה בעריכה תמיד פתוחה
  const [openItems, setOpenItems] = useState({});
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
    const authResult = await window.customAuthPrompt('חלון העריכה המלאה (15 דק׳) של הפריט נסגר. לפתיחה מחדש בחרו מנהל והזינו את הסיסמה שלו.', 'feature:item_edit_reopen');
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:item_edit_reopen' }) // הרשאה: feature:item_edit_reopen
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'הסיסמה שגויה או שאין הרשאה.');
        return;
      }
      setForceEditableIds(prev => new Set(prev).add(item.id));
    } catch (err) {
      alert('לא הצלחנו לאמת את קוד המנהל.');
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

  // size_edit_until_days_before_event: ריק/חסר = כבוי. אחרת מותר להחליף מידה בתוך הפריט גם אחרי
  // סגירת חלון ה-15 דקות (אותה קטגוריית מחיר, ועד N ימים לפני האירוע). השרת אוכף את אותו כלל.
  const sizeEditDays = parseSizeEditDays(settings.size_edit_until_days_before_event);
  const gapRule = normalizeGapRule(settings.gap_size_price_rule);
  useEffect(() => {
    if (sizeEditDays === null) return;
    fetchSharedJson('/api/pricelists', { ttl: TTL.STATIC })
      .then(data => { if (Array.isArray(data)) setPriceList(data); })
      .catch(console.error);
  }, [sizeEditDays]);

  // בורר מידה להחלפת מידה בתוך פריט אחרי סגירת חלון העריכה המלא: מציג רק מידות פנויות שמותר
  // לעבור אליהן בלי אישור מנהל (אותה קטגוריית מחיר). isSizeAllowed(מידה) -> { ok, reason }.
  // כשמטמון המלאי עוד לא נטען אין רשימה מקומית לסנן, ולכן חוזרים לבורר הרגיל - ובחירה
  // מקטגוריה אחרת נדחית בעת הבחירה. השרת בודק את אותו כלל בכל מקרה.
  const renderSameBandSizeSelect = ({ modelId, value, onChange, currentCartItems, isSizeAllowed, onRejected }) => {
    const rows = (() => {
      if (!modelId || !inventoryCache) return null;
      try {
        return sortSizeRows(calculateDynamicAvailability(
          modelId,
          order.isAbroad ? order.fromDate : order.eventDate,
          order.isAbroad ? order.toDate : null,
          inventoryCache,
          currentCartItems || [],
          order.customSpacing
        ));
      } catch (err) {
        console.error('Failed to calculate sizes from cache', err);
        return null;
      }
    })();

    if (!rows) {
      return (
        <OrderSizeSelector
          modelId={modelId}
          order={order}
          value={value}
          inventoryCache={inventoryCache}
          currentCartItems={currentCartItems}
          onChange={(val) => {
            const verdict = val ? isSizeAllowed(val) : { ok: true };
            if (!verdict.ok) { onRejected(verdict.reason); return; }
            onChange(val);
          }}
        />
      );
    }

    // רק מידות שמותר לעבור אליהן (אותה קטגוריית מחיר) + המידה הנוכחית; הזמינות מסומנת על כל ריבוע
    const allowedRows = rows.filter(row => {
      const sizeVal = row.sizeText || row.size;
      return sizeVal && (sizeVal === value || isSizeAllowed(sizeVal).ok);
    });
    return <SizeChips rows={allowedRows} value={value} onChange={onChange} order={order} hasModel />;
  };

  // האם ואיך אפשר להחליף מידה בפריט שחלון העריכה המלא שלו נסגר. בלי checkedSize נבדקים רק
  // התנאים הכלליים (הגדרה, קטגוריה, תאריך וימים) מול המידה השמורה עצמה.
  const evaluateSizeSwap = (item, checkedSize) => {
    if (sizeEditDays === null || !item || item.isNew || !item.id) return { ok: false, reason: null };
    if (item.isTaken) return { ok: false, reason: null };
    if (!priceList.length) return { ok: false, reason: null };
    const savedSize = item.originalState ? item.originalState.sizeText : item.sizeText;
    return evaluateSizeOnlyEdit({
      item,
      oldSizeText: savedSize,
      newSizeText: checkedSize || savedSize,
      eventDate: order?.eventDate,
      priceList,
      sizeEditDays,
      gapRule
    });
  };

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
        alert('ההזמנה נעולה כי האירוע כבר עבר. אפשר רק להחזיר פריטים; להשכרה צריך לשחרר את ההזמנה באישור מנהל.');
        return;
      }
    }

    if (!isFullyPaid) {
      const authResult = await window.customAuthPrompt('ההזמנה עוד לא שולמה במלואה. לביצוע הפעולה נדרש אישור מנהל.', 'feature:unpaid_action_items_tab');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:unpaid_action_items_tab' }) // הרשאה: feature:unpaid_action_items_tab
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'הסיסמה שגויה או שאין הרשאה.');
          return;
        }
      } catch (err) {
        alert('לא הצלחנו לאמת את הקוד.');
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
        alert(vData.error || `הברקוד ${barcode} לא מתאים להשכרה.`);
        return;
      }

      if (vData.unreturned) {
        const confirmMsg = `${vData.warning}\nלסמן אותה כמוחזרת מההשכרה הקודמת (הזמנה #${vData.unreturnedOrderId}) ולהמשיך בהשכרה הזו?`;
        const promptFunc = window.customConfirm || window.confirm;
        if (await promptFunc(confirmMsg)) {
          const putRes = await fetch('/api/rentals/scan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ unreturnedItemId: vData.unreturnedItemId })
          });
          if (!putRes.ok) {
            const errData = await putRes.json();
            alert(errData.error || 'לא הצלחנו לסמן את ההחזרה מההשכרה הקודמת');
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
      alert(`הברקוד ${barcode}${detailsStr} לא שייך לאף פריט שממתין להשכרה בהזמנה הזו.`);
      return;
    }

    if (!matchedItem.isTaken) {
      handleRent(matchedItem, barcode, true); // האימות בוצע כבר למעלה
    } else if (!matchedItem.isReturned) {
      handleReturn(matchedItem, true);
    } else {
      alert(`הפריט ${barcode} כבר סומן כמוחזר.`);
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
      alert('בחרו דגם ומידה לפני השמירה.');
      return;
    }
    const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
    if (enableAlterations && hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
      alert('כתבו מה התיקון הנדרש.');
      return;
    }

    const isEditing = !!item.id && !item.isNew;

    // require_manager_code_for_item_changes - הוספת פריט חדש (לא עריכת פריט קיים) דורשת
    // גם אישור מנהל אמיתי, בנוסף לאימות ת״ז שכבר קורה בשמירת ההזמנה (require_id_for_edit_cancel,
    // page.js). הוספת פריט נשמרת מיד כאן (POST) ולא מחכה לשמירת ההזמנה הכללית, ולכן האישור
    // נדרש ומאומת נקודתית ברגע הזה - לא נשמר ב-state כדי שלא ידלוף לטיוטת ההזמנה המקומית
    // (localStorage, ר' app/lib/orderDrafts.js).
    let managerAuth = null;
    if (!isEditing && settings.require_manager_code_for_item_changes === 'true') {
      const authResult = await window.customAuthPrompt('להוספת פריט להזמנה קיימת נדרש אישור מנהל, בנוסף לאימות הזהות בשמירה. בחרו מנהל והזינו את הסיסמה שלו.', 'feature:item_change_approval');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:item_change_approval' })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'הסיסמה שגויה או שאין הרשאה.');
          return;
        }
        managerAuth = { managerEmployeeId: authResult.employeeId, managerPin: authResult.pin };
      } catch (err) {
        alert('שגיאה באימות קוד מנהל.');
        return;
      }
    }

    setSavingItemIndex(index);
    try {
      const url = isEditing ? `/api/orders/${orderId}/items/${item.id}` : `/api/orders/${orderId}/items`;
      const method = isEditing ? 'PUT' : 'POST';
      // forceFullEdit מועבר רק כשחלון ה-15 הדקות כבר נסגר ונפתח מחדש באישור מנהל (ר' handleReopenFullEdit) -
      // השרת בודק את זה מול חלון העריכה בפועל, לא רק מסתמך על ה-state המקומי כאן.
      const body = { ...item, ...(forceEditableIds.has(item.id) ? { forceFullEdit: true } : {}), ...(managerAuth || {}) };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'לא הצלחנו לשמור את הפריט');
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
      alert('פריט מושכר אי אפשר לערוך.');
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
      alert('פריט מושכר אי אפשר למחוק. קודם מסמנים החזרה או מבטלים את ההשכרה.');
      return;
    }
    if (isCurrentlyDeleted) {
      const maxItems = parseInt(settings.max_items_per_order);
      const activeCount = items.filter(i => !i.isDeleted).length;
      if (!isNaN(maxItems) && maxItems > 0 && activeCount >= maxItems) {
        alert(`אי אפשר לשחזר: המקסימום להזמנה הוא ${maxItems} פריטים.`);
        return;
      }
    }

    const confirmed = await window.customConfirm(isCurrentlyDeleted
      ? 'לשחזר את הפריט להזמנה?'
      : 'למחוק את הפריט מההזמנה?');
    if (!confirmed) return;
    handleItemChange(index, 'isDeleted', !isCurrentlyDeleted);
  };

  const handleAddItem = () => {
    if (locked) return;
    const maxItems = parseInt(settings.max_items_per_order);
    const activeCount = items.filter(i => !i.isDeleted).length;
    if (!isNaN(maxItems) && maxItems > 0 && activeCount >= maxItems) {
      alert(`אי אפשר להוסיף: המקסימום להזמנה הוא ${maxItems} פריטים.`);
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
      const authResult = await window.customAuthPrompt('ההזמנה עוד לא שולמה במלואה. להשכרה נדרש אישור מנהל.', 'feature:unpaid_action_items_tab');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:unpaid_action_items_tab' }) // הרשאה: feature:unpaid_action_items_tab
        });
        const data = await res.json();
        if (!data.success) {
          alert('הסיסמה שגויה או שאין הרשאה.');
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
        // postRentalRent מטפל גם בדחיית השרת "הברקוד לא תואם לדגם/מידה שהוזמנו"
        // (enforce_rental_barcode_match) - הצגת הפער ואפשרות עקיפה באישור מנהל.
        const result = await postRentalRent(item.id, barcodeToAssign);
        if (!result.ok) {
          const failure = new Error('API failed');
          failure.userMessage = result.message;
          throw failure;
        }
      } catch (err) {
        alert(err.userMessage || 'לא הצלחנו לשמור את ההשכרה');
        onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isTaken: item.isTaken, takenDate: item.takenDate, barcode: item.barcode } : i));
      }
    }
  };

  const handleReturn = async (item, skipAuth = false) => {
    if (!isFullyPaid && !skipAuth) {
      const authResult = await window.customAuthPrompt('ההזמנה עוד לא שולמה במלואה. להחזרה נדרש אישור מנהל.', 'feature:unpaid_action_items_tab');
      if (!authResult || !authResult.pin) return;
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:unpaid_action_items_tab' }) // הרשאה: feature:unpaid_action_items_tab
        });
        const data = await res.json();
        if (!data.success) {
          alert('הסיסמה שגויה או שאין הרשאה.');
          return;
        }
      } catch (e) {
        console.error(e);
        return;
      }
    }
    onItemsChange(prev => prev.map(i => i.id === item.id ? { ...i, isReturned: true, returnDate: new Date() } : i));

    if (item.id && !item.isNew) {
      // postRentalReturn מטפל גם בדחיית השרת "האירוע עדיין לא הגיע" (require_approval_for_early_return)
      const result = await postRentalReturn(item.id);
      if (!result.ok) {
        alert(result.message || 'לא הצלחנו לשמור את ההחזרה');
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
        alert('לא הצלחנו לבטל את ההשכרה');
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
        alert('לא הצלחנו לבטל את ההחזרה');
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
        ? await window.customPrompt('מה הבעיה בפריט שהוחזר? ההערה לא חובה, והיא תירשם גם בכרטיס הלקוח.', '', 'text')
        : window.prompt('מה הבעיה בפריט שהוחזר? (לא חובה)', '');
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
      alert('לא הצלחנו לעדכן את מצב הפריט');
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
    const cleaned = raw.replace(/\s*\(קוד:[^)]*\)/g, '').trim() || 'פריט כללי';
    // כמה דגמים ישנים נשמרו עם השם הזמני "ללא שם" (לא שם תיאורי אמיתי) - עדיף להציג
    // את מספר הדגם, כמו שכבר קורה בעמדת הלקוחות - ר' דיווח org2 df1cdacf.
    if (cleaned.startsWith('ללא שם')) {
      const code = itemCode(item);
      if (code) return String(code);
    }
    return cleaned;
  };

  const itemCode = (item) => item.dressItem?.dress?.barcodePrefix || item.dressItem?.barcodePrefix || item.barcodePrefix || null;

  // מזהה הדגם, כשקיים — מאפשר קפיצה מהפריט בהזמנה אל כרטיס הדגם.
  // פריטים שהוגרו מ-Access בלי DressItem מקושר לא יקבלו קישור.
  const itemModelId = (item) => item.dressModelId || item.dressItem?.dressModelId || null;

  const isChecked = (v) => v === 1 || v === true;

  // תגית סטטוס אחת לכל פריט
  const renderStatusTag = (item) => {
    if (item.isNew) return <Tag variant="attn" icon="plus">חדש · טרם נשמר</Tag>;
    if (item.isReturned) {
      if (item.returnedOk === false) return <Tag variant="attn" icon="alert-tri">הוחזר עם בעיה</Tag>;
      return <Tag variant="done" icon="check">הוחזר תקין</Tag>;
    }
    if (item.isTaken) return <Tag variant="soft" icon="box">מושכר</Tag>;
    return <Tag icon="clock">טרם הושכר</Tag>;
  };

  // צ'יפים של התיקונים (צוואר / שרוול / אורך) — קריאה בלבד
  const getRepairInfo = (item) => {
    const neck = isChecked(item.neckAlteration);
    const sleeve = isChecked(item.sleeveAlteration);
    const length = item.lengthAlteration && String(item.lengthAlteration).trim() !== '' ? item.lengthAlteration : null;
    return { neck, sleeve, length, hasAny: !!(neck || sleeve || length) };
  };
  const renderRepairChips = (info) => (
    <>
      {info.neck && <Chip variant="info" icon="scissors">צוואר</Chip>}
      {info.sleeve && <Chip variant="info" icon="scissors">שרוול</Chip>}
      {info.length && <Chip variant="info" icon="ruler"><bdi>{info.length}</bdi> ס״מ</Chip>}
    </>
  );

  // בורר מצב לפריט שהוחזר — זמין גם בהזמנה נעולה, כי פריט מוחזר הוא כמעט תמיד של אירוע שעבר
  const renderConditionToggle = (item) => {
    const isGood = item.returnedOk !== false;
    const busy = savingConditionId === item.id;
    return (
      <fieldset className="oi-fs" disabled={busy}>
        <Seg
          label="מצב הפריט בהחזרה"
          value={isGood ? 'ok' : 'bad'}
          onChange={(v) => handleSetReturnCondition(item, v === 'ok')}
          options={[
            { value: 'ok', label: 'תקין', icon: 'check-circle' },
            { value: 'bad', label: 'יש בעיה', icon: 'alert-tri' },
          ]}
        />
      </fieldset>
    );
  };

  const showAlterCol = enableAlterations && showAlterations;
  const visibleItems = (items || []).map((item, originalIndex) => ({ item, originalIndex })).filter(({ item }) => showDeleted || !item.isDeleted);
  const closeConfirm = () => setConfirmModal({ isOpen: false, item: null, actionType: null });
  const closeItemChoice = () => setItemChoiceModal({ isOpen: false, candidates: [], barcode: null });
  const closeManualScan = () => { setShowManualScanModal(false); setManualBarcode(''); };

  // ===== כרטיס פריט =====
  const renderItemCard = ({ item, originalIndex }) => {
    const isDeletedRow = item.isDeleted;
    const isRented = item.isTaken && !item.isReturned;
    const isEditingMode = item.isNew || item.isEditing;
    // פריטים ישנים שהוגרו מ-Access בלי DressItem מקושר (dressModelId ריק) אין להם
    // מלאי מזוהה לבחור ממנו — עבורם דגם/מידה נשארים לקריאה בלבד גם במצב עריכה,
    // ורק פרטי התיקון ניתנים לעריכה.
    const fullyEditableNow = canFullyEditItem(item);
    const canEditModelSize = item.isNew || (item.isEditing && !!item.dressModelId && fullyEditableNow);
    // חלון העריכה המלא סגור, אבל מותר להחליף מידה באותה קטגוריית מחיר בלי אישור מנהל
    const swapEligibility = (!item.isNew && !fullyEditableNow) ? evaluateSizeSwap(item) : { ok: false, reason: null };
    const canEditSizeOnly = !canEditModelSize && !!item.isEditing && !!item.dressModelId && swapEligibility.ok;
    const code = itemCode(item);
    const rowKey = item.id || item._localId || originalIndex;
    const open = !!isEditingMode || !!openItems[rowKey];
    const repair = getRepairInfo(item);
    const price = parseFloat(item.finalPrice) || parseFloat(item.price) || 0;
    const saving = savingItemIndex === originalIndex;
    const detId = `oi-det-${rowKey}`;
    const toggleOpen = () => { if (!isEditingMode) setOpenItems(prev => ({ ...prev, [rowKey]: !prev[rowKey] })); };

    const modelLink = itemModelId(item) ? (
      <a
        href={`/dashboard/dresses/${itemModelId(item)}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`פתיחת כרטיס הדגם ${itemName(item)}`}
        onClick={(e) => e.stopPropagation()}
      >
        {itemName(item)}
      </a>
    ) : <span>{itemName(item)}</span>;

    // --- שורות מידע (מצב תצוגה) ---
    const infoRows = [];
    if (price > 0) infoRows.push(<Row key="price" label="מחיר" icon="coin"><span className="oi-money">₪{price.toLocaleString('he-IL')}</span></Row>);
    if (code && item.barcode) infoRows.push(<Row key="bc" label="ברקוד" icon="tag"><bdi>{item.barcode}</bdi></Row>);
    if (showAlterCol && !isEditingMode) {
      if (repair.hasAny) {
        infoRows.push(<Row key="alt" label="תיקונים" icon="scissors"><span className="oi-cluster">{renderRepairChips(repair)}</span></Row>);
        if (item.alterationDetails) infoRows.push(<Row key="altd" label="פירוט התיקון" icon="edit">{item.alterationDetails}</Row>);
      } else {
        infoRows.push(<Row key="alt" label="תיקונים" icon="scissors">ללא תיקונים</Row>);
      }
    }

    // --- פעולות ראשיות לפי מצב (אותו עץ תנאים כמו קודם) ---
    let mainActs = null;
    if (locked) {
      // הזמנה נעולה — מותרות החזרה וסימון מצב הפריט בלבד; עריכה, השכרה וביטולים חסומים
      if (isRented) {
        mainActs = (
          <Btn size="sm" variant="primary" icon="check"
            onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'return' }); }}>
            סמן כהוחזר
          </Btn>
        );
      } else if (item.isReturned && !isDeletedRow) {
        mainActs = (
          <>
            {renderConditionToggle(item)}
            <Btn size="sm" variant="quiet" icon="refresh"
              onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelReturn' }); }}>
              ביטול ההחזרה
            </Btn>
          </>
        );
      } else {
        mainActs = <span className="oi-locked"><Icon name="lock" size="sm" />נעול</span>;
      }
    } else if (isEditingMode) {
      mainActs = (
        <>
          <Btn size="sm" variant="primary" icon="check" loading={saving}
            onClick={(e) => { e.stopPropagation(); handleConfirmItem(originalIndex); }}>
            {saving ? 'שומר…' : 'שמירת הפריט'}
          </Btn>
          <Btn size="sm" icon="x" disabled={saving}
            onClick={(e) => { e.stopPropagation(); item.isNew ? cancelNewItem(originalIndex) : cancelEditItem(originalIndex); }}>
            ביטול
          </Btn>
        </>
      );
    } else if (!isDeletedRow) {
      mainActs = (
        <>
          {!item.isTaken && !item.isNew && (
            <Btn size="sm" variant="primary" icon="box"
              onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'rent' }); }}>
              סמן כמושכר
            </Btn>
          )}
          {isRented && (
            <>
              <Btn size="sm" variant="primary" icon="check"
                onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'return' }); }}>
                סמן כהוחזר
              </Btn>
              <Btn size="sm" variant="quiet" icon="x-circle"
                onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelRent' }); }}>
                ביטול השכרה
              </Btn>
            </>
          )}
          {item.isReturned && (
            <>
              {renderConditionToggle(item)}
              <Btn size="sm" variant="quiet" icon="refresh"
                onClick={(e) => { e.stopPropagation(); setConfirmModal({ isOpen: true, item, actionType: 'cancelReturn' }); }}>
                ביטול ההחזרה
              </Btn>
            </>
          )}
          {!item.isTaken && (
            <span className="oi-acts">
              <Btn size="sm" icon="edit"
                onClick={(e) => { e.stopPropagation(); handleEditItem(originalIndex); }}>
                עריכת הפריט
              </Btn>
              <Tip>
                {canFullyEditItem(item)
                  ? 'אפשר לשנות דגם, מידה ותיקונים.'
                  : (evaluateSizeSwap(item).ok
                    ? 'חלון העריכה המלאה (15 דק׳) נסגר. אפשר להחליף מידה באותה קטגוריית מחיר ולערוך את פירוט התיקון.'
                    : `חלון העריכה המלאה (15 דק׳) נסגר. ${showAlterCol ? 'אפשר לערוך רק את פירוט התיקון.' : 'לשינוי דגם או מידה צריך לפתוח עריכה מלאה באישור מנהל.'}`)}
              </Tip>
            </span>
          )}
        </>
      );
    }

    // --- פעולות משניות: פרטים · תפוסה · מחיקה/שחזור · סימון תיקון ---
    const secondaryActs = (
      <>
        {!item.isNew && (
          <Btn size="sm" variant="quiet" icon="info"
            onClick={(e) => { e.stopPropagation(); showItemDetails(item); }}>
            פרטים והיסטוריה
          </Btn>
        )}
        {!item.isNew && (
          <Btn size="sm" variant="quiet" icon="calendar"
            onClick={(e) => { e.stopPropagation(); setCapacityModalItem(item); }}>
            בדיקת תפוסה
          </Btn>
        )}
        {/* מחיקה — לא זמינה לפריט שנלקח (מושכר או הוחזר) או בהזמנה נעולה; שחזור תמיד מוצג לשורה מחוקה */}
        {!locked && !item.isNew && (isDeletedRow || !item.isTaken) && (
          <Btn size="sm" variant="quiet" icon={isDeletedRow ? 'refresh' : 'trash'}
            onClick={(e) => { e.stopPropagation(); toggleDeleted(originalIndex); }}>
            {isDeletedRow ? 'שחזור הפריט' : 'מחיקת הפריט'}
          </Btn>
        )}
        {/* סימון "תיקון בוצע" — state מקומי, נשמר בשמירת ההזמנה/הפריט; בהזמנה נעולה לא מגיב */}
        {showAlterCol && !isEditingMode && repair.hasAny && (
          <Btn size="sm" variant="quiet" icon="check" disabled={locked}
            onClick={(e) => { e.stopPropagation(); if (!locked) handleItemChange(originalIndex, 'alterationDone', !item.alterationDone); }}>
            {item.alterationDone ? 'ביטול סימון "תיקון בוצע"' : 'סימון "תיקון בוצע"'}
          </Btn>
        )}
      </>
    );

    // --- טופס עריכה / פריט חדש ---
    const editForm = isEditingMode && (
      <div className="oi-form">
        {canEditModelSize ? (
          <>
            <div className="v3-field">
              <label className="v3-label" htmlFor={`oi-model-${rowKey}`}>דגם</label>
              <OrderModelSelector
                inputId={`oi-model-${rowKey}`}
                value={{ name: item.description, id: item.dressModelId }}
                onChange={(model) => handleModelChange(originalIndex, model)}
                hasActiveItems
              />
            </div>
            <div className="v3-field">
              <span className="v3-label">מידה</span>
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
          </>
        ) : canEditSizeOnly ? (
          <>
            <Row label="דגם" icon="shirt">
              <span className="oi-static">{itemName(item)}</span>
              {code && <div className="oi-note">קוד <bdi>{code}</bdi></div>}
            </Row>
            <div className="v3-field">
              <span className="v3-label">מידה</span>
              {renderSameBandSizeSelect({
                modelId: item.dressModelId,
                value: item.sizeText,
                currentCartItems: items.filter((_, i) => i !== originalIndex),
                isSizeAllowed: (sz) => evaluateSizeSwap(item, sz),
                onRejected: (reason) => setSizeSwapNotice(prev => ({ ...prev, [item.id]: reason })),
                onChange: (val) => {
                  setSizeSwapNotice(prev => ({ ...prev, [item.id]: '' }));
                  handleItemChange(originalIndex, 'sizeText', val);
                }
              })}
              <div className={sizeSwapNotice[item.id] ? 'oi-note oi-note--err' : 'oi-note'} role={sizeSwapNotice[item.id] ? 'alert' : undefined}>
                {sizeSwapNotice[item.id] || 'אפשר להחליף רק למידה באותה קטגוריית מחיר.'}
              </div>
            </div>
          </>
        ) : (
          <Row label="דגם ומידה" icon="shirt">
            <span className="oi-static">{modelLink}{item.sizeText ? <> · מידה <bdi>{item.sizeText}</bdi></> : null}</span>
            {code && <div className="oi-note">קוד <bdi>{code}</bdi>{item.barcode ? <> · ברקוד <bdi>{item.barcode}</bdi></> : null}</div>}
          </Row>
        )}

        {/* חלון העריכה המלא (15 דק׳) נסגר: הכפתור לפתיחה מחדש באישור מנהל יושב כאן, בבלוק
            הדגם/מידה, ולא בבלוק התיקונים — שם הוא נעלם כשתיקונים כבויים */}
        {!item.isNew && !fullyEditableNow && (
          <div className="oi-form__sub">
            <span className="oi-note">
              {evaluateSizeSwap(item).ok
                ? 'חלון העריכה המלאה (15 דק׳) נסגר. אפשר להחליף מידה באותה קטגוריית מחיר.'
                : `חלון העריכה המלאה (15 דק׳) נסגר. ${showAlterCol ? 'אפשר לערוך עכשיו רק את פירוט התיקון.' : 'להחלפת דגם או מידה צריך לפתוח עריכה מלאה.'}`}
              {!evaluateSizeSwap(item).ok && evaluateSizeSwap(item).reason ? ` (${evaluateSizeSwap(item).reason})` : ''}
            </span>
            <div className="oi-acts">
              <Btn size="sm" icon="unlock" onClick={() => handleReopenFullEdit(item)}>פתיחת עריכה מלאה</Btn>
              <Tip>הפתיחה מחדש דורשת אישור מנהל, ובתוקף עד שסוגרים את כרטיס ההזמנה.</Tip>
            </div>
          </div>
        )}

        {showAlterCol && (
          <div className="oi-form__sub">
            <span className="v3-label">תיקונים</span>
            <div className="oi-cluster">
              <Chip className="oi-toggle" icon="scissors" aria-pressed={isChecked(item.neckAlteration)} disabled={!fullyEditableNow}
                onClick={() => handleItemChange(originalIndex, 'neckAlteration', isChecked(item.neckAlteration) ? 0 : 1)}>
                צוואר
              </Chip>
              <Chip className="oi-toggle" icon="scissors" aria-pressed={isChecked(item.sleeveAlteration)} disabled={!fullyEditableNow}
                onClick={() => handleItemChange(originalIndex, 'sleeveAlteration', isChecked(item.sleeveAlteration) ? 0 : 1)}>
                שרוול
              </Chip>
            </div>
            <Field label="אורך לקיצור (ס״מ)" className="oi-len" type="text" inputMode="decimal" value={item.lengthAlteration || ''}
              disabled={!fullyEditableNow}
              onChange={(e) => handleItemChange(originalIndex, 'lengthAlteration', e.target.value)}
              placeholder="למשל 5" />
            <Field label="מה התיקון?" type="text" autoComplete="off" value={item.alterationDetails || item.repairs || ''}
              required={enableAlterations && repair.hasAny}
              tip="חובה לפרט כשנבחר תיקון. את הפירוט אפשר לערוך גם אחרי סגירת חלון העריכה."
              onChange={(e) => handleItemChange(originalIndex, 'alterationDetails', e.target.value)}
              placeholder="למשל: קיצור שרוול ב-2 ס״מ" />
          </div>
        )}
      </div>
    );

    return (
      <article
        key={rowKey}
        className={cx('v3-item', 'oi-item', item.isNew && 'v3-item--pending', open && 'is-open', isDeletedRow && 'oi-deleted')}
      >
        <div className={cx('v3-item__top', isEditingMode && 'is-static')} onClick={toggleOpen}>
          <div className="v3-item__thumb" aria-hidden="true"><Icon name="dress" /></div>
          <div className="v3-item__info">
            {isEditingMode ? (
              <div className="v3-item__model">{item.isNew ? 'פריט חדש' : itemName(item)}</div>
            ) : (
              <div className="v3-item__model">
                {modelLink}
                {item.sizeText && <span className="v3-item__size">מידה <bdi>{item.sizeText}</bdi></span>}
              </div>
            )}
            {!isEditingMode && code && <div className="v3-item__meta">קוד <bdi>{code}</bdi></div>}
            <div className="oi-stat">
              {isEditingMode && !item.isNew ? <Tag variant="attn" icon="edit">בעריכה</Tag> : renderStatusTag(item)}
              {!isEditingMode && showAlterCol && repair.hasAny && (
                <>
                  {renderRepairChips(repair)}
                  <Tag variant={item.alterationDone ? 'done' : 'attn'} icon={item.alterationDone ? 'check' : 'scissors'}>
                    {item.alterationDone ? 'תיקון בוצע' : 'תיקון ממתין'}
                  </Tag>
                </>
              )}
            </div>
          </div>
          {!isEditingMode && (
            <button type="button" className="v3-btn v3-btn--quiet v3-btn--icon v3-item__chev" aria-expanded={open} aria-controls={detId} aria-label="פרטים ופעולות"
              onClick={(e) => { e.stopPropagation(); toggleOpen(); }}>
              <Icon name="chevron-down" />
            </button>
          )}
        </div>
        <div className="v3-item__wrap">
          <div className="v3-item__det" id={detId}>
            <div className="v3-item__det-in">
              {editForm}
              {!isEditingMode && infoRows.length > 0 && <Rows>{infoRows}</Rows>}
              {mainActs && <div className="oi-acts">{mainActs}</div>}
              <div className="oi-acts">{secondaryActs}</div>
            </div>
          </div>
        </div>
      </article>
    );
  };

  const confirmLabel = confirmModal.item
    ? `"${itemName(confirmModal.item)}"${itemCode(confirmModal.item) ? ` (קוד ${itemCode(confirmModal.item)})` : ''}`
    : 'הפריט';
  const confirmCopy = {
    rent: { title: 'השכרת פריט', icon: 'box', text: `לסמן את ${confirmLabel} כמושכר?` },
    return: { title: 'החזרת פריט', icon: 'check', text: `לסמן את ${confirmLabel} כהוחזר?` },
    cancelRent: { title: 'ביטול השכרה', icon: 'x-circle', text: `לבטל את ההשכרה של ${confirmLabel}?` },
    cancelReturn: { title: 'ביטול החזרה', icon: 'x-circle', text: `לבטל את ההחזרה של ${confirmLabel}?` },
  }[confirmModal.actionType] || { title: 'אישור', icon: 'info', text: '' };
  const confirmNeedsPayNote = !isFullyPaid && (confirmModal.actionType === 'rent' || confirmModal.actionType === 'return');
  const confirmHasScanTip = confirmModal.actionType === 'rent' && !!(confirmModal.item?.barcodePrefix || confirmModal.item?.dressItem?.barcodePrefix);

  return (
    <V3Page page={false} className="oi-root">
      {locked && (
        <Banner
          kind="warning"
          icon="lock"
          title="ההזמנה נעולה"
          text={<>אפשר רק לסמן החזרות. <Tip>האירוע כבר עבר, ולכן השכרה, עריכה ומחיקה חסומות. לשחרור לוחצים על המנעול בראש העמוד ומאשרים כמנהל.</Tip></>}
        />
      )}

      {/* סרגל עליון של הטאב — הוספה, מתגי תצוגה ומונים */}
      <div className="oi-bar">
        {!locked && <Btn variant="primary" icon="plus" onClick={handleAddItem}>פריט חדש</Btn>}
        {enableAlterations && (
          <Chip className="oi-toggle" icon="scissors" aria-pressed={showAlterations} onClick={() => setShowAlterations(v => !v)}>
            פרטי תיקון
          </Chip>
        )}
        <Chip className="oi-toggle" icon="trash" aria-pressed={showDeleted} onClick={() => setShowDeleted(v => !v)}>
          הצגת מחוקים
        </Chip>
        <div className="oi-bar__sum">
          <Chip variant="info" icon="shirt"><bdi>{activeItems.length}</bdi> פריטים פעילים</Chip>
          {totalPrice > 0 && <Chip variant="info" icon="coin">סה״כ <bdi>₪{totalPrice.toLocaleString('he-IL')}</bdi></Chip>}
        </div>
      </div>

      {visibleItems.length > 0 ? (
        <div className="oi-list">
          {visibleItems.map(renderItemCard)}
          <div ref={listEndRef} />
        </div>
      ) : (
        <Empty
          icon="bag"
          title="אין פריטים בהזמנה"
          action={<Btn variant="primary" icon="plus" onClick={handleAddItem}>הוספת הפריט הראשון</Btn>}
        />
      )}

      {/* ===== אישור השכרה/החזרה/ביטול ===== */}
      <Dialog
        open={confirmModal.isOpen}
        onClose={closeConfirm}
        variant="confirm"
        icon={confirmCopy.icon}
        title={confirmCopy.title}
        sub={confirmCopy.text}
        actions={(
          <>
            <Btn variant="primary" onClick={async () => {
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
            }}>אישור</Btn>
            <Btn variant="quiet" onClick={closeConfirm}>ביטול</Btn>
          </>
        )}
      >
        {(confirmNeedsPayNote || confirmHasScanTip) && (
          <div className="v3-dlg-rows">
            {confirmNeedsPayNote && (
              <div className="v3-dlg-row">
                <span className="v3-dlg-row__ico"><Icon name="alert-tri" /></span>
                <span className="v3-dlg-row__t">ההזמנה עוד לא שולמה במלואה, ולכן נדרש אישור מנהל.</span>
              </div>
            )}
            {confirmHasScanTip && (
              <div className="v3-dlg-row">
                <span className="v3-dlg-row__ico"><Icon name="tag" /></span>
                <span className="v3-dlg-row__t">אפשר לדלג על החלון הזה <Tip>סריקת ברקוד בשדה הסריקה המהירה בראש העמוד משכירה כמה שמלות ברצף, בלי חלונות באמצע.</Tip></span>
              </div>
            )}
          </div>
        )}
      </Dialog>

      {/* ===== בחירת פריט — כשכמה פריטים זהים בהזמנה תואמים לברקוד שנסרק ===== */}
      <Dialog
        open={itemChoiceModal.isOpen}
        onClose={closeItemChoice}
        variant="confirm"
        icon="tag"
        title="לאיזה פריט לשייך?"
        sub="כמה פריטים בהזמנה מתאימים לברקוד שנסרק. בחרו אחד."
        actions={<Btn variant="quiet" onClick={closeItemChoice}>ביטול</Btn>}
      >
        <div className="oi-center"><span className="oi-barcode">{itemChoiceModal.barcode}</span></div>
        <div className="v3-options">
          {itemChoiceModal.candidates.map((item, idx) => {
            const hasRepair = isChecked(item.neckAlteration) || isChecked(item.sleeveAlteration) ||
              (item.lengthAlteration && String(item.lengthAlteration).trim() !== '');
            return (
              <button key={item.id || idx} type="button" className="v3-option" onClick={() => chooseItemForBarcode(item)}>
                <Icon name="box" />
                <span>
                  <b>{itemName(item)}</b>
                  <small>מידה <bdi>{item.sizeText || '-'}</bdi> · {hasRepair ? 'עם תיקון' : 'בלי תיקון'}</small>
                </span>
                <Icon name="chevron-start" className="oi-push" />
              </button>
            );
          })}
        </div>
      </Dialog>

      {/* ===== ברקוד ידני להשכרה ===== */}
      <Dialog
        open={showManualScanModal}
        onClose={closeManualScan}
        variant="form"
        icon="tag"
        title="הזנת ברקוד"
        sub="סרקו או הקלידו את הברקוד שעל הפריט כדי להשכיר אותו."
      >
        <form
          className="oi-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setShowManualScanModal(false);
            const barcode = manualBarcode.trim();
            setManualBarcode('');
            if (selectedItemForScan) await handleRent(selectedItemForScan, barcode);
          }}
        >
          <Field label="ברקוד" type="text" className="oi-ltr" data-autofocus="" placeholder="סרקו או הקלידו" autoComplete="off"
            value={manualBarcode} onChange={(e) => setManualBarcode(e.target.value)} />
          <div className="v3-mail__actions">
            <Btn type="submit" variant="primary" icon="check">אישור והשכרה</Btn>
            <Btn variant="quiet" onClick={closeManualScan}>ביטול</Btn>
          </div>
        </form>
      </Dialog>

      {/* ===== פרטי פריט (חיובים + היסטוריה) ===== */}
      <Dialog
        open={mounted && !!detailsModalItem}
        onClose={() => setDetailsModalItem(null)}
        variant="sheet"
        icon="info"
        title="פרטי הפריט"
        sub={detailsModalItem ? itemName(detailsModalItem) : undefined}
        actions={<Btn icon="x" onClick={() => setDetailsModalItem(null)}>סגירה</Btn>}
      >
        {detailsModalItem && (
          <div className="oi-sec">
            <section className="oi-sec">
              <h3 className="oi-sec__h">
                <Icon name="receipt" size="sm" />חיובים וזיכויים
                <Tip>חיובים, זיכויים, ביטולים ותיקונים ששויכו לפריט הזה.</Tip>
              </h3>
              {(() => {
                if (!order || !order.obligations) return <div className="oi-hist__msg">לא נמצאו חיובים מפורטים</div>;
                const searchStr = `(פריט #${detailsModalItem.id})`;
                const cleanTxt = (t) => (t || '').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '').trim();
                // כל ההתחייבויות שמשויכות לפריט — כולל זיכויים/ביטולים (סכומים שליליים)
                const relatedObligations = order.obligations.filter(obs =>
                  !obs.isDeleted && obs.description && obs.description.includes(searchStr)
                );
                if (relatedObligations.length === 0) return <div className="oi-hist__msg">אין חיובים לפריט הזה</div>;
                return (
                  <>
                    <div className="v3-list">
                      {relatedObligations.map((obs, idx) => {
                        const isCredit = obs.amount < 0;
                        const label = cleanTxt(obs.productName)
                          || (isCredit ? 'זיכוי / ביטול' : (obs.description.includes('תיקון') ? 'תיקון' : 'חיוב'));
                        const desc = cleanTxt(obs.description);
                        // ברוב החיובים ה-productName וה-description זהים — לא להציג את אותו טקסט פעמיים
                        const showDesc = desc && desc !== label;
                        return (
                          <div className="v3-li" key={idx}>
                            <span className="v3-li__ic" aria-hidden="true"><Icon name={isCredit ? 'refresh' : 'coin'} /></span>
                            <div className="v3-li__body">
                              <span className="v3-li__title">{label} {isCredit && <Tag variant="soft">זיכוי</Tag>}</span>
                              {showDesc && <span className="v3-li__sub">{desc}</span>}
                            </div>
                            <span className={cx('v3-li__amt', 'oi-money', isCredit ? 'oi-money--credit' : 'oi-money--charge')}>
                              {isCredit ? `-₪${Math.abs(obs.amount)}` : `₪${obs.amount}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="oi-total">
                      <span>סה״כ לפריט</span>
                      <span className="oi-money">₪{relatedObligations.reduce((sum, obs) => sum + obs.amount, 0)}</span>
                    </div>
                  </>
                );
              })()}
            </section>

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
                <Rows>
                  <Row label="נוסף להזמנה" icon="calendar"><bdi>{addedDate || '-'}</bdi></Row>
                  <Row label="הושכר ב" icon="box">{takenDate ? <bdi>{takenDate}</bdi> : <span className="v3-faint">טרם הושכר</span>}</Row>
                  <Row label="הוחזר ב" icon="check-circle">{returnDate ? <bdi>{returnDate}</bdi> : <span className="v3-faint">טרם הוחזר</span>}</Row>
                </Rows>
              );
            })()}

            <section className="oi-sec">
              <h3 className="oi-sec__h"><Icon name="history" size="sm" />היסטוריית שינויים</h3>
              <div className="oi-hist">
                {detailsModalItem.loadingLogs ? (
                  <div className="oi-hist__msg" aria-busy="true"><span className="v3-spin" aria-hidden="true" />טוען היסטוריה…</div>
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
                          rows.push(<div key={key}><strong>{label}:</strong> <bdi>{fromStr}</bdi> ← <bdi>{toStr}</bdi></div>);
                        } else {
                          const valStr = typeof value === 'boolean' ? (value ? 'כן' : 'לא') : String(value);
                          rows.push(<div key={key}><strong>{label}:</strong> <bdi>{valStr}</bdi></div>);
                        }
                      }
                      changesNode = rows.length > 0
                        ? rows
                        : <div className="oi-note">אין שינויים להצגה</div>;
                    } catch (e) {
                      changesNode = <div className="oi-note">{String(log.changesJson)}</div>;
                    }
                    const isExpanded = !!expandedHistory[idx];
                    return (
                      <div key={idx}>
                        <button type="button" className="oi-hist__row" aria-expanded={isExpanded} onClick={() => toggleHistoryExpand(idx)}>
                          <Icon name="chevron-down" size="sm" />
                          <Tag variant="soft">{actionLabel}</Tag>
                          <span className="oi-note">
                            <bdi>{new Date(log.createdAt).toLocaleDateString('he-IL')}</bdi> ({getHebrewDateString(log.createdAt)}) · <bdi>{new Date(log.createdAt).toLocaleTimeString('he-IL', { timeStyle: 'short' })}</bdi>
                          </span>
                        </button>
                        {isExpanded && <div className="oi-hist__body">{changesNode}</div>}
                      </div>
                    );
                  })
                ) : (
                  <div className="oi-hist__msg">אין היסטוריית שינויים להצגה</div>
                )}
              </div>
            </section>
          </div>
        )}
      </Dialog>

      {capacityModalItem && (
        <ItemCapacityModal
          item={capacityModalItem}
          order={order}
          isOpen={true}
          onClose={() => setCapacityModalItem(null)}
        />
      )}
    </V3Page>
  );
});

export default ModernItemsManager;
