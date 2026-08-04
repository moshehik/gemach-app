'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, PenTool } from 'lucide-react';
import ActiveEmployeesModal from '../../../components/orders/ActiveEmployeesModal';
import ModernOrderCard from '../../../components/orders/modern/ModernOrderCard';
import ModernGeneralDetails from '../../../components/orders/modern/ModernGeneralDetails';
import ModernItemsManager from '../../../components/orders/modern/ModernItemsManager';
import ModernPaymentsManager from '../../../components/orders/modern/ModernPaymentsManager';
import ModernInfoTab from '../../../components/orders/modern/ModernInfoTab';
import modernOrderCss from '../../../components/orders/modern/modernOrderStyles';
import { calculateOrderStatus } from '../../../lib/orderStatus';
import { addHistory } from '../../../lib/historyManager';

// שדות בהזמנה שכפתור "ביטול שינויים" צריך לדווח עליהם אם השתנו מאז השמירה האחרונה
const ORDER_FIELD_LABELS = {
  eventDate: 'תאריך אירוע',
  eventDateHebrew: 'תאריך אירוע (עברי)',
  returnDate: 'תאריך החזרה',
  fromDate: 'מתאריך',
  toDate: 'עד תאריך',
  isAbroad: 'אירוע חו"ל',
  isWeekdayEvent: 'אירוע באמצע שבוע',
  customSpacing: 'ריווח מותאם',
  notes: 'הערות',
  hasSignedRegulations: 'חתימה על תקנון',
  customerId: 'לקוח'
};

const summarizeOrderFieldChanges = (snapOrder, currOrder) => {
  const changed = [];
  Object.entries(ORDER_FIELD_LABELS).forEach(([field, label]) => {
    const before = snapOrder ? (snapOrder[field] ?? null) : null;
    const after = currOrder ? (currOrder[field] ?? null) : null;
    if (JSON.stringify(before) !== JSON.stringify(after)) changed.push(`${label} השתנה`);
  });
  return changed;
};

// משווה רשימה שמורה (מהשרת) מול הרשימה הנוכחית ומחזיר תיאור בעברית של מה נוסף/הוסר/שוחזר/עודכן.
// שורות חדשות שהמשתמש הוסיף (בלי id) נחשבות "נוספו". שורות "טיוטה" בלי id שמנוע התמחור
// מחשב תמיד מחדש מהפריטים (למשל תצוגה מקדימה של חיוב) מזוהות לפי תוכן זהה, כדי שלא יוצגו
// כ"שינוי" רק כי אין להן עדיין מזהה משרת.
const summarizeListDiff = (snapList = [], currList = [], label) => {
  const snapMap = new Map(snapList.filter(x => x.id).map(x => [x.id, x]));
  const snapDraftPool = snapList.filter(x => !x.id).map(x => JSON.stringify(x));
  let added = 0, removed = 0, restored = 0, modified = 0;
  currList.forEach(curr => {
    if (!curr.id) {
      const draftKey = JSON.stringify(curr);
      const idx = snapDraftPool.indexOf(draftKey);
      if (idx === -1) added++; else snapDraftPool.splice(idx, 1);
      return;
    }
    const snap = snapMap.get(curr.id);
    if (!snap) { added++; return; }
    snapMap.delete(curr.id);
    if (!snap.isDeleted && curr.isDeleted) { removed++; return; }
    if (snap.isDeleted && !curr.isDeleted) { restored++; return; }
    if (JSON.stringify(snap) !== JSON.stringify(curr)) modified++;
  });
  removed += snapMap.size; // שורות עם id שנעלמו לגמרי מהמערך

  const parts = [];
  if (added) parts.push(`${added} ${label} נוספו`);
  if (removed) parts.push(`${removed} ${label} הוסרו`);
  if (restored) parts.push(`${restored} ${label} שוחזרו`);
  if (modified) parts.push(`${modified} ${label} עודכנו`);
  return parts;
};

export default function OrderDetailsPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  
  const [order, setOrder] = useState(null);
  const initialLockChecked = useRef(false);
  // מצב ההזמנה כפי שהוא בשרת (בטעינה ואחרי כל שמירה מוצלחת) — הבסיס להשוואה ולשחזור ב"ביטול שינויים".
  const savedSnapshotRef = useRef(null);
  // מחזיק תמיד את הגרסה העדכנית של handleExit (המוגדר בהמשך הקומפוננטה) כדי שניתן יהיה
  // לקרוא לו מ-useEffect שמוגדר לפני ה-early return, בלי לשבור את סדר ה-hooks.
  const handleExitRef = useRef(null);
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [items, setItems] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [showRegulationsModal, setShowRegulationsModal] = useState(false);
  const [inventoryCache, setInventoryCache] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Custom Email Prompt State
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailTypePending, setEmailTypePending] = useState(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState('details'); // details, items, rentals, payments, history
  const [debtApproved, setDebtApproved] = useState(false); // Track manager approval to skip exit warning
  const itemsManagerRef = useRef(null); // מאפשר ל"סריקה מהירה" בסיידבר להפעיל השכרה/החזרה בטאב הפריטים
  const paymentsManagerRef = useRef(null); // מאפשר לאייקון החוב בטופ-בר לפתוח את חלון נדרים פלוס

  // Fetch Order
  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch');
        return res.json();
      })
      .then(data => {
        setOrder(data);
        if (!initialLockChecked.current) {
          if (data.eventDate && new Date(data.eventDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0)) {
             setIsPastEvent(true);
          }
          initialLockChecked.current = true;
        }
        const loadedItems = data.items || [];
        const loadedObligations = data.obligations || [];
        const loadedPayments = data.payments || [];
        const loadedRefunds = data.refunds || [];
        setItems(loadedItems);
        setObligations(loadedObligations);
        setPayments(loadedPayments);
        setRefunds(loadedRefunds);
        savedSnapshotRef.current = { order: data, items: loadedItems, obligations: loadedObligations, payments: loadedPayments, refunds: loadedRefunds };
        setTimeout(() => setHasUnsavedChanges(false), 0);
        setLoading(false);
        
        // Add to history
        addHistory({ 
          type: 'order', 
          id: data.orderId, 
          name: `הזמנה #${data.orderId}`, 
          subtext: data.customer ? `${data.customer.firstName} ${data.customer.lastName}` : '' 
        });
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!order) return;
    const hasDates = (order.isAbroad || order.isWeekdayEvent) ? (order.fromDate && order.toDate) : order.eventDate;
    if (hasDates) {
      const queryParams = new URLSearchParams({
        isAbroad: order.isAbroad || false,
        isWeekdayEvent: order.isWeekdayEvent || false,
        excludeOrderId: order.orderId
      });
      if (order.eventDate) queryParams.append('eventDate', order.eventDate);
      if (order.fromDate) queryParams.append('fromDate', order.fromDate);
      if (order.toDate) queryParams.append('toDate', order.toDate);

      fetch(`/api/inventory/preload?${queryParams.toString()}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load cache');
          return res.json();
        })
        .then(data => {
          setInventoryCache(data);
        })
        .catch(err => console.error('Failed to preload inventory cache', err));
    }
  }, [order?.eventDate, order?.fromDate, order?.toDate, order?.isAbroad, order?.isWeekdayEvent, order?.orderId]);

  const totalRequired = obligations.filter(o => !o.isDeleted).reduce((sum, obs) => sum + obs.amount, 0);
  const totalPaid = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);

  // Prevent closing window if there is a debt
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      let block = false;
      let msg = '';
      if (totalRequired - totalPaid > 0 && !debtApproved) {
        block = true;
        msg = 'קיימת יתרת חוב בהזמנה! אנא דאג לתשלום או אישור מנהל.';
      } else if (hasUnsavedChanges) {
        block = true;
        msg = 'ישנם שינויים שלא נשמרו בהזמנה! האם אתה בטוח שברצונך לעזוב?';
      }
      if (block) {
        e.preventDefault();
        e.returnValue = msg;
        return msg;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [totalRequired, totalPaid, debtApproved, hasUnsavedChanges]);

  // עוצר ניווט לעמוד אחר (תפריט עליון/סיידבר) עד שהשמירה של ההזמנה מסתיימת —
  // לא רק לחיצה על "חזור", כדי שלא ייגרם מרוץ בין שמירה לניווט.
  // handleExitRef מוחזק כדי לא לשבור את סדר ה-hooks (handleExit מוגדר אחרי guard מוקדם יותר בקומפוננטה).
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleDocumentClick = (e) => {
      const anchor = e.target.closest && e.target.closest('a[href]');
      if (!anchor) return;
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('http') || anchor.target === '_blank') return;
      if (href === window.location.pathname) return;
      if (!handleExitRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      handleExitRef.current(href);
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [hasUnsavedChanges]);

  // Save changes
  const handleSave = async (overrideOrder = null) => {
    setSaving(true);
    setSaveMessage('');

    // overrideOrder חייב להיות אובייקט הזמנה אמיתי; onClick עלול להעביר לכאן את אירוע הלחיצה
    const currentOrder = (overrideOrder && overrideOrder.orderId) ? overrideOrder : order;
    if (!currentOrder) {
      setSaving(false);
      alert('שגיאה: נתוני ההזמנה לא טוענו כראוי');
      return;
    }

    // VALIDATE REPAIRS
    for (const item of items) {
      if (!item.isDeleted) {
        const hasRepair = item.neckAlteration || item.sleeveAlteration || (item.lengthAlteration && item.lengthAlteration.trim() !== '');
        if (hasRepair && (!item.alterationDetails || item.alterationDetails.trim() === '')) {
          setSaving(false);
          alert('חובה להזין פירוט תיקון עבור כל פריט שיש לו תיקון מסומן (צוואר, שרוול או אורך).');
          return;
        }
      }
    }
    
    // FULL ORDER INVENTORY VALIDATION
    const activeItems = (items || []).filter(i => !i.isDeleted);
    const hasDates = (currentOrder.isAbroad || currentOrder.isWeekdayEvent) ? (currentOrder.fromDate && currentOrder.toDate) : currentOrder.eventDate;

    if (activeItems.length > 0 && !hasDates) {
      setSaving(false);
      alert(currentOrder.isAbroad || currentOrder.isWeekdayEvent 
        ? 'חובה להזין תאריכי התחלה וסיום (אירוע חו"ל/מיוחד) עבור הזמנה הכוללת פריטים.' 
        : 'חובה לבחור תאריך אירוע עבור הזמנה הכוללת פריטים.');
      return;
    }

    if (activeItems.length > 0 && hasDates) {
      try {
        const validateRes = await fetch('/api/orders/validate-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: activeItems,
            eventDate: currentOrder.eventDate,
            isAbroad: currentOrder.isAbroad,
            isWeekdayEvent: currentOrder.isWeekdayEvent,
            fromDate: currentOrder.fromDate,
            toDate: currentOrder.toDate,
            orderId: currentOrder.orderId,
            customSpacing: currentOrder.customSpacing
          })
        });

        const validateData = await validateRes.json();
        if (validateData.error) {
          setSaving(false);
          alert(`שגיאה: ${validateData.error}`);
          return;
        }
        if (!validateData.valid) {
          setSaving(false);
          const errorLines = validateData.errors.map(e => {
            const msg = `- ${e.dressName} (מידה ${e.sizeText}): חסרים ${e.requested - e.available} במלאי`;
            return e.isCustomSpacingIssue ? `${msg} (בגלל ציפוף)` : msg;
          }).join('\n');
          const customSpacingNote = validateData.errors.some(e => e.isCustomSpacingIssue)
            ? '\n\n💡 הערה: כמה מהבעיות קשורות לציפוף מיוחד. אם אתה בוטל בציפוף, נסה לבחור ציפוף קטן יותר.'
            : '';
          alert(`לא ניתן לשמור את ההזמנה עקב חוסר במלאי לתאריכים המבוקשים:\n\n${errorLines}${customSpacingNote}`);
          return;
        }
      } catch (err) {
        console.error('Validation fetch error', err);
        setSaving(false);
        alert('שגיאה בבדיקת המלאי מול השרת.');
        return;
      }
    }

    let debtApprovedBy = null;
    // CHECK DEBT AND REQUIRE APPROVAL TO SAVE
    if (totalRequired - totalPaid > 0) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. שמירת השינויים דורשת הרשאת עובד או מנהל. אנא בחר משתמש והזן סיסמה:", 'עובד');
      if (!authResult || !authResult.pin) {
        setSaving(false);
        // Returning quietly here made the Save button look broken - nothing happened and
        // nothing explained why.
        setSaveMessage('השמירה בוטלה: נדרש אישור עובד או מנהל בגלל יתרת חוב.');
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
          setSaving(false);
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
        debtApprovedBy = authResult.employeeId;
        setDebtApproved(true);
      } catch (err) {
        setSaving(false);
        alert('שגיאה באימות קוד עובד/מנהל.');
        return;
      }
    }

    // items כאן הוא צילום מצב מרגע לחיצת השמירה — בדיוק מה שנשלח לשרת.
    // שורה חדשה בלי דגם/מידה מדולגת בשרת, ולכן היא נשארת פתוחה גם אחרי השמירה.
    const submittedLocalIds = items
      .filter(it => it._localId && it.dressModelId && it.sizeText)
      .map(it => it._localId);

    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: currentOrder.orderId,
          customerId: currentOrder.customerId,
          orderDate: currentOrder.orderDate,
          eventDate: currentOrder.eventDate,
          eventDateHebrew: currentOrder.eventDateHebrew,
          returnDate: currentOrder.returnDate,
          isAbroad: currentOrder.isAbroad,
          isWeekdayEvent: currentOrder.isWeekdayEvent,
          fromDate: currentOrder.fromDate,
          toDate: currentOrder.toDate,
          customSpacing: currentOrder.customSpacing !== undefined ? currentOrder.customSpacing : null,
          notes: currentOrder.notes,
          status: currentOrder.status,
          hasSignedRegulations: currentOrder.hasSignedRegulations,
          updatedAt: currentOrder.updatedAt,
          items: items,
          obligations: obligations,
          payments: payments,
          debtApprovedBy: debtApprovedBy,
          totalAmount: (() => {
            const itemsSum = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);
            const obligationsSum = obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
            return itemsSum > 0 ? itemsSum : (obligationsSum > 0 ? obligationsSum : (currentOrder.totalAmount || 0));
          })()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error((errorData && errorData.message) ? errorData.message : 'Failed to save');
      }
      
      const updatedOrder = await res.json();
      setOrder(updatedOrder);
      setHasUnsavedChanges(false);
      // הפריטים ששלחנו כבר נוצרו בשרת; שורה שנוספה אחרי השליחה עדיין לא — היא נשמרת.
      const mergedItems = mergePendingItems(updatedOrder.items || [], items, submittedLocalIds);
      setItems(mergedItems);
      setObligations(updatedOrder.obligations || []);
      setPayments(updatedOrder.payments || []);
      setRefunds(updatedOrder.refunds || []);
      savedSnapshotRef.current = { order: updatedOrder, items: mergedItems, obligations: updatedOrder.obligations || [], payments: updatedOrder.payments || [], refunds: updatedOrder.refunds || [] };

      setSaveMessage('השינויים נשמרו בהצלחה!');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setSaveMessage(err.message || 'שגיאה בשמירת הנתונים.');
    } finally {
      setSaving(false);
    }
  };

  // שורות פריט חדשות שטרם נשמרו בשרת. מיזוג במקום החלפה מונע מחיקה של פריט
  // שהמשתמש הוסיף בזמן שבקשת שמירה אחרת עדיין רצה.
  const mergePendingItems = (serverItems, prevItems, consumedLocalIds = []) => [
    ...serverItems,
    ...prevItems.filter(it => !it.id && it._localId && !consumedLocalIds.includes(it._localId))
  ];

  const handleOrderUpdate = (updatedOrder, { savedLocalId } = {}) => {
    setOrder(updatedOrder);
    setHasUnsavedChanges(true);
    setItems(prev => mergePendingItems(updatedOrder.items || [], prev, savedLocalId ? [savedLocalId] : []));
    setObligations(updatedOrder.obligations || []);
    setPayments(updatedOrder.payments || []);
    setRefunds(updatedOrder.refunds || []);
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', cursor: 'default', userSelect: 'none' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite', pointerEvents: 'none' }} />
      <h2 style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>טוען נתוני הזמנה...</h2>
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </div>
  );
  
  if (!order) return <div style={{ padding: '2rem', textAlign: 'center', fontSize: '1.5rem', color: 'var(--text-muted)' }}>הזמנה לא נמצאה.</div>;

  const totalPayable = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);


  const createdDate = order.orderDate || order.createdAt;

  const handleExit = async (destinationHref) => {
    if (hasUnsavedChanges) {
      if (!confirm('ישנם שינויים שלא נשמרו בהזמנה! האם לצאת בכל זאת?')) return;
    }
    if (totalRequired - totalPaid > 0 && !debtApproved) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. יציאה דורשת הרשאת עובד או מנהל. אנא בחר משתמש והזן סיסמה:", 'עובד');
      if (!authResult || !authResult.pin) {
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
          return;
        }
        setDebtApproved(true);
      } catch (err) {
        alert('שגיאה באימות קוד עובד/מנהל.');
        return;
      }
    }

    // Save changes before exiting
    setSaving(true);
    try {
      // Perform the same save operation as the manual save button
      const submittedLocalIds = items
        .filter(it => it._localId && it.dressModelId && it.sizeText)
        .map(it => it._localId);

      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.orderId,
          customerId: order.customerId,
          eventDate: order.eventDate,
          eventDateHebrew: order.eventDateHebrew,
          returnDate: order.returnDate,
          isAbroad: order.isAbroad,
          isWeekdayEvent: order.isWeekdayEvent,
          fromDate: order.fromDate,
          toDate: order.toDate,
          customSpacing: order.customSpacing !== undefined ? order.customSpacing : null,
          notes: order.notes,
          status: order.status,
          hasSignedRegulations: order.hasSignedRegulations,
          updatedAt: order.updatedAt,
          items: items,
          obligations: obligations,
          payments: payments,
          debtApprovedBy: debtApproved ? true : null,
          totalAmount: (() => {
            const itemsSum = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);
            const obligationsSum = obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
            return itemsSum > 0 ? itemsSum : (obligationsSum > 0 ? obligationsSum : (order.totalAmount || 0));
          })()
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        setSaving(false);
        alert((errorData && errorData.message) ? errorData.message : 'שגיאה בשמירה');
        return;
      }

      setSaving(false);
      if (destinationHref) {
        router.push(destinationHref);
      } else {
        router.back();
      }
    } catch (err) {
      setSaving(false);
      alert('שגיאה בשמירה: ' + (err.message || 'נסה שוב'));
    }
  };
  handleExitRef.current = handleExit;

  // מבטל את כל השינויים שלא נשמרו (הוספה/הסרה של פריטים, תשלומים, התחייבויות, שינויי תאריכים/הערות וכו')
  // ומחזיר את הכרטיס למצב האחרון שנשמר בשרת.
  const buildChangeSummary = () => {
    const snap = savedSnapshotRef.current;
    if (!snap) return [];
    return [
      ...summarizeOrderFieldChanges(snap.order, order),
      ...summarizeListDiff(snap.items, items, 'פריטים'),
      ...summarizeListDiff(snap.obligations, obligations, 'התחייבויות תשלום'),
      ...summarizeListDiff(snap.payments, payments, 'תשלומים')
    ];
  };

  const handleCancelChanges = async () => {
    const snap = savedSnapshotRef.current;
    if (!hasUnsavedChanges || !snap) {
      alert('אין שינויים לביטול.');
      return;
    }

    const changes = buildChangeSummary();
    const changesText = changes.length > 0 ? changes.map(c => `- ${c}`).join('\n') : '- שינויים שלא נשמרו';
    const confirmed = await window.customConfirm(
      `פעולה זו תבטל את כל השינויים שלא נשמרו בהזמנה זו, ותחזיר אותה למצב האחרון שנשמר:\n\n${changesText}\n\nלהמשיך?`
    );
    if (!confirmed) return;

    setOrder(snap.order);
    setItems(snap.items);
    setObligations(snap.obligations);
    setPayments(snap.payments);
    setRefunds(snap.refunds);
    setHasUnsavedChanges(false);
    setSaveMessage(changes.length > 0 ? `בוטלו השינויים: ${changes.join(', ')}` : 'השינויים בוטלו.');
    setTimeout(() => setSaveMessage(''), 5000);
  };

  // מחיקת ההזמנה — אותה פעולה בדיוק כמו איקון המחיקה בטבלת ההזמנות (מחיקה רכה + אותם תנאי חסימה).
  const handleDeleteOrder = async () => {
    const status = calculateOrderStatus({ ...order, items });
    if (status === 'הוחזר' || status === 'הוחזר חלקי' || status === 'הושכר' || status === 'הושכר חלקי') {
      alert('לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר');
      return;
    }
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק הזמנה זו?'))) return;

    try {
      const res = await fetch(`/api/orders/${order.orderId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/orders');
      } else {
        const data = await res.json().catch(() => null);
        alert((data && data.error) || 'שגיאה במחיקת הזמנה');
      }
    } catch (err) {
      console.error(err);
      alert('שגיאה במחיקת הזמנה');
    }
  };

  const isLocked = isPastEvent && !isUnlocked;

  const handleUnlock = async () => {
    const authResult = await window.customAuthPrompt("הזמנה זו נעולה כי תאריך האירוע עבר. נדרש אישור מנהל לעריכה. אנא בחר מנהל והזן סיסמה:", 'מנהל');
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
      setIsUnlocked(true);
    } catch (err) {
      alert('שגיאה באימות קוד מנהל.');
    }
  };

  const handlePrintOrder = () => {
    if (order.hasSignedRegulations) {
      setShowPrintMenu(!showPrintMenu);
      return;
    }

    setShowRegulationsModal(true);
  };

  // שינוי סטטוס חתימה על תקנון מכפתור הטופ-בר בעיצוב המודרני (עם אישור)
  const handleToggleSignature = async () => {
    const nowYes = !order.hasSignedRegulations;
    const msg = nowYes ? 'האם הלקוח חתם על תקנון ההשכרה?' : 'האם לסמן שהלקוח לא חתם על התקנון?';
    const confirmed = window.customConfirm ? await window.customConfirm(msg) : window.confirm(msg);
    if (!confirmed) return;
    const updatedOrder = { ...order, hasSignedRegulations: nowYes };
    setOrder(updatedOrder);
    handleSave(updatedOrder);
  };

  // סריקה מהירה מהסיידבר — עוברים לטאב הפריטים ומבצעים שם השכרה/החזרה
  const handleQuickScan = (barcode) => {
    setActiveTab('items');
    if (itemsManagerRef.current) {
      itemsManagerRef.current.scan(barcode);
    }
  };

  // אייקון החוב בטופ-בר: מעבר לתשלומים, ואם יש חוב — פתיחת חלון נדרים פלוס
  const handleWalletClick = () => {
    setActiveTab('payments');
    if (totalRequired - totalPaid > 0) {
      setTimeout(() => paymentsManagerRef.current?.openCreditModal(), 60);
    }
  };

  const handleSendEmail = async (type, forcedEmail = null) => {
    setShowPrintMenu(false);
    
    let targetEmail = forcedEmail || order.customer?.email;
    
    if (!targetEmail || !targetEmail.includes('@')) {
      setEmailTypePending(type);
      setEmailInput('');
      setShowEmailPrompt(true);
      return;
    }
    
    setSaveMessage('מייצר קובץ PDF...');
    try {
      // Step 1: Fetch HTML from server
      const htmlRes = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type: type, returnHtmlOnly: true })
      });
      const htmlData = await htmlRes.json();
      
      if (!htmlData.success || !htmlData.html) {
        throw new Error(htmlData.error || 'שגיאה ביצירת נתוני המייל');
      }

      // Step 2: Convert HTML to PDF. html2canvas (used by html2pdf.js) kept rendering
      // this content as a blank/broken page - it reimplements CSS layout from scratch
      // and chokes on things like flex+float combos. html-to-image instead serializes
      // the DOM into an SVG <foreignObject> and lets the real browser rasterize it, so
      // it renders exactly what's on screen.
      const htmlToImage = await import('html-to-image');
      const { jsPDF } = await import('jspdf');
      const element = document.createElement('div');
      element.innerHTML = htmlData.html;
      element.style.position = 'fixed';
      element.style.top = '0';
      element.style.left = '0';
      element.style.zIndex = '-1';
      element.style.pointerEvents = 'none';
      document.body.appendChild(element);

      const pixelRatio = 2;
      const dataUrl = await htmlToImage.toPng(element, { pixelRatio, backgroundColor: '#ffffff' });
      const cssWidth = element.offsetWidth;
      const cssHeight = element.offsetHeight;
      document.body.removeChild(element);

      // Size the PDF page to the content itself (no A4 pagination) so the whole
      // document fits on one continuous page.
      const pdf = new jsPDF({ unit: 'px', format: [cssWidth, cssHeight], hotfixes: ['px_scaling'] });
      pdf.addImage(dataUrl, 'PNG', 0, 0, cssWidth, cssHeight);
      const pdfBase64DataUri = pdf.output('datauristring');

      // Extract just the base64 part
      const pdfBase64 = pdfBase64DataUri.split(',')[1];

      setSaveMessage('שולח מייל...');
      // Step 3: Send PDF to server
      const res = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type: type, pdfBase64 })
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('המייל נשלח בהצלחה!');
      } else {
        setSaveMessage('שגיאה: ' + (data.error || 'השליחה נכשלה'));
      }
    } catch (err) {
      console.error(err);
      setSaveMessage('שגיאה ביצירת ה-PDF או בשליחת המייל');
    }
    setTimeout(() => setSaveMessage(''), 3000);
  };

  const handleEmailSubmit = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      alert('כתובת המייל שהוזנה אינה תקינה.');
      return;
    }
    
    const validEmail = emailInput.trim();
    setShowEmailPrompt(false);
    
    // Save to customer
    if (order.customer?.id) {
      try {
        const res = await fetch(`/api/customers/${order.customer.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...order.customer, email: validEmail })
        });
        if (res.ok) {
          setOrder(prev => ({
            ...prev,
            customer: { ...prev.customer, email: validEmail }
          }));
        }
      } catch (e) {
        console.error('Failed to update customer email:', e);
      }
    }
    
    // Continue with sending
    handleSendEmail(emailTypePending, validEmail);
  };

  return (
    <main data-agy-id="[id]_page_main_1" style={{ direction: 'rtl', fontFamily: 'var(--font-primary, system-ui)' }}>
      {/* עיצוב הכרטיס המודרני — נטען כאן כדי שגם המודלים המשותפים (תקנון, מייל, עובדים) יעוצבו בו */}
      <style>{modernOrderCss}</style>

      <ModernOrderCard
          order={order}
          items={items}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          totalRequired={totalRequired}
          totalPaid={totalPaid}
          saving={saving}
          saveMessage={saveMessage}
          hasUnsavedChanges={hasUnsavedChanges}
          isLocked={isLocked}
          isPastEvent={isPastEvent}
          onUnlock={handleUnlock}
          onSave={() => handleSave()}
          onCancelChanges={handleCancelChanges}
          onDelete={handleDeleteOrder}
          onExit={() => handleExit()}
          onToggleSignature={handleToggleSignature}
          onPrintButtonClick={handlePrintOrder}
          printMenuOpen={showPrintMenu}
          onClosePrintMenu={() => setShowPrintMenu(false)}
          onPrint={(type) => { setShowPrintMenu(false); window.open(`/print/order?orderId=${order.orderId}&type=${type}`, '_blank'); }}
          onSendEmail={handleSendEmail}
          onShowEmployees={() => setShowEmployeesModal(true)}
          onQuickScan={handleQuickScan}
          onWalletClick={handleWalletClick}
          tabContents={{
            details: (
              <ModernGeneralDetails
                order={order}
                onOrderChange={(val) => { setOrder(val); setHasUnsavedChanges(true); }}
                onSaveRequest={handleSave}
                onQuickEmail={() => handleSendEmail('order')}
              />
            ),
            items: (
              <ModernItemsManager
                ref={itemsManagerRef}
                locked={isLocked}
                orderId={order.orderId}
                order={order}
                items={items}
                onItemsChange={(val) => { setItems(val); setHasUnsavedChanges(true); }}
                onOrderUpdated={handleOrderUpdate}
                inventoryCache={inventoryCache}
                totalRequired={totalRequired}
                totalPaid={totalPaid}
              />
            ),
            payments: (
              <ModernPaymentsManager
                ref={paymentsManagerRef}
                orderId={order.orderId}
                items={items}
                order={order}
                obligations={obligations}
                payments={payments}
                refunds={refunds}
                onObligationsChange={(val) => { setObligations(val); setHasUnsavedChanges(true); }}
                onPaymentsChange={(val) => { setPayments(val); setHasUnsavedChanges(true); }}
                onRefundsChange={(val) => { setRefunds(val); setHasUnsavedChanges(true); }}
                totalRequired={totalRequired}
                totalPaid={totalPaid}
                customer={order.customer}
                onOrderUpdated={handleOrderUpdate}
              />
            ),
            history: (
              <ModernInfoTab
                order={order}
                createdDate={createdDate}
                onShowEmployees={() => setShowEmployeesModal(true)}
                onOrderDateSave={(date) => {
                  const newOrder = { ...order, orderDate: date };
                  setOrder(newOrder);
                  handleSave(newOrder);
                }}
              />
            )
          }}
        />

      <ActiveEmployeesModal data-element-name="רכיב_page_27"
        orderId={order.orderId}
        isOpen={showEmployeesModal}
        onClose={() => setShowEmployeesModal(false)}
      />

      {/* Regulations Modal */}
      {showRegulationsModal && typeof document !== 'undefined' && (
        <div className="moc moc-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="moc-modal-box" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '28px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)' }}>
                <PenTool size={26} />
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>חתימה על תקנון</h3>
              <p style={{ color: 'var(--moc-text-muted)', margin: 0, lineHeight: 1.6 }}>האם הלקוח חתם על התקנון?</p>
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button data-element-name="כפתור_page_29" className="moc-btn moc-btn-outline" onClick={() => setShowRegulationsModal(false)}>
                לא (ביטול)
              </button>
              <button data-element-name="כפתור_page_28" className="moc-btn moc-btn-gold"
                onClick={() => {
                  const updatedOrder = { ...order, hasSignedRegulations: true };
                  setOrder(updatedOrder);
                  handleSave(updatedOrder);
                  setShowRegulationsModal(false);
                  setShowPrintMenu(true);
                }}
              >
                כן, חתם
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Email Prompt Modal */}
      {showEmailPrompt && typeof document !== 'undefined' && (
        <div className="moc moc-modal-overlay" style={{ zIndex: 2000 }}>
          <div className="moc-modal-box" style={{ maxWidth: '420px', textAlign: 'center' }}>
            <div className="moc-modal-body" style={{ paddingTop: '28px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', background: 'var(--moc-primary-light)', color: 'var(--moc-primary-dark)' }}>
                <Mail data-element-name="רכיב_page_30" size={26} />
              </div>
              <h3 style={{ margin: '0 0 10px', fontSize: '1.2rem' }}>כתובת מייל חסרה</h3>
              <p style={{ color: 'var(--moc-text-muted)', margin: '0 0 18px', lineHeight: 1.6 }}>
                ללקוח זה לא מעודכנת כתובת מייל במערכת. אנא הזן כתובת מייל עדכנית לשליחת הדוח (תישמר אוטומטית בכרטיס הלקוח).
              </p>
              <input data-element-name="שדה_page_31"
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="example@gmail.com"
                dir="ltr"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEmailSubmit();
                }}
                style={{ textAlign: 'left' }}
              />
            </div>
            <div className="moc-modal-foot" style={{ justifyContent: 'center' }}>
              <button data-element-name="כפתור_page_33" className="moc-btn moc-btn-outline" onClick={() => setShowEmailPrompt(false)}>
                ביטול
              </button>
              <button data-element-name="כפתור_page_32" className="moc-btn moc-btn-gold" onClick={handleEmailSubmit}>
                שמור ושלח
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
