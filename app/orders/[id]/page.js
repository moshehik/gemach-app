'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, PenTool, Calendar, CalendarRange, Globe, SlidersHorizontal, FileText, User, Package, Receipt, CreditCard } from 'lucide-react';
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

// משווה רשימה שמורה (מהשרת) מול הרשימה הנוכחית ומחזירה כמה שורות נוספו/הוסרו/שוחזרו/עודכנו.
// שורות חדשות שהמשתמש הוסיף (בלי id) נחשבות "נוספו". שורות "טיוטה" בלי id שמנוע התמחור
// מחשב תמיד מחדש מהפריטים (למשל תצוגה מקדימה של חיוב) מזוהות לפי תוכן זהה, כדי שלא יוצגו
// כ"שינוי" רק כי אין להן עדיין מזהה משרת.
const summarizeListDiffCounts = (snapList = [], currList = []) => {
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
  return { added, removed, restored, modified };
};

const summarizeListDiff = (snapList, currList, label) => {
  const { added, removed, restored, modified } = summarizeListDiffCounts(snapList, currList);
  const parts = [];
  if (added) parts.push(`${added} ${label} נוספו`);
  if (removed) parts.push(`${removed} ${label} הוסרו`);
  if (restored) parts.push(`${restored} ${label} שוחזרו`);
  if (modified) parts.push(`${modified} ${label} עודכנו`);
  return parts;
};

const formatListCounts = (label, counts) => {
  const parts = [];
  if (counts.added) parts.push(`${counts.added} נוספו`);
  if (counts.removed) parts.push(`${counts.removed} הוסרו`);
  if (counts.restored) parts.push(`${counts.restored} שוחזרו`);
  if (counts.modified) parts.push(`${counts.modified} עודכנו`);
  return parts.length ? `${label}: ${parts.join(', ')}` : null;
};

// קיבוץ שדות ההזמנה לקבוצות שינוי הגיוניות למודל אישור "ביטול שינויים" —
// כל קבוצה מקבלת איקון אחד וכיתוב קצר אחד, במקום שורה נפרדת לכל שדה טכני
// (eventDate/eventDateHebrew למשל תמיד משתנים יחד, אין טעם בשתי שורות עבורם).
const CHANGE_GROUPS = [
  { Icon: Calendar, label: 'תאריך אירוע', fields: ['eventDate', 'eventDateHebrew'] },
  { Icon: CalendarRange, label: 'טווח תאריכים (לקיחה/החזרה)', fields: ['fromDate', 'toDate', 'returnDate'] },
  { Icon: Globe, label: 'סוג אירוע (רגיל/חו"ל)', fields: ['isAbroad', 'isWeekdayEvent'] },
  { Icon: SlidersHorizontal, label: 'ריווח ימים מותאם', fields: ['customSpacing'] },
  { Icon: FileText, label: 'הערות להזמנה', fields: ['notes'] },
  { Icon: PenTool, label: 'חתימה על תקנון', fields: ['hasSignedRegulations'] },
  { Icon: User, label: 'לקוח', fields: ['customerId'] }
];

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
  const [activeTab, setActiveTab] = useState('items'); // details, items, rentals, payments, history
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

  // תצוגה מקדימה של הסכום הכולל: פריט שסומן למחיקה מקומית אך עדיין לא נשמר (isDeleted=true
  // אבל אין עדיין deletedAt - זה נחתם רק בשמירה, ר' lib/pricingEngine.js) לא נספר בסכום, כמו
  // שפריט חדש כבר מעדכן את הסכום מיד עם האישור. לא מדויק כמו החישוב המלא של השרת (לא כולל
  // למשל דמי ביטול) - זו רק תצוגה מקדימה עד לשמירה בפועל, שאז obligations יתעדכן מהשרת.
  const totalRequired = obligations
    .filter(o => {
      if (o.isDeleted) return false;
      if (o.orderItemId) {
        const relatedItem = items.find(i => i.id === o.orderItemId);
        if (relatedItem?.isDeleted && !relatedItem?.deletedAt) return false;
      }
      return true;
    })
    .reduce((sum, obs) => sum + obs.amount, 0);
  const totalPaid = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);

  // חוסם סגירה/רענון של החלון רק כשבאמת יש שינויים שלא נשמרו.
  // יתרת חוב לא נחסמת כאן: הדפדפן מתעלם מהודעה מותאמת ומציג תמיד טקסט גנרי ("ייתכן שהשינויים
  // שביצעת לא יישמרו"), ולכן הזמנה עם חוב הציגה אזהרת "שינויים שלא נשמרו" גם מיד אחרי שמירה
  // או אחרי "ביטול שינויים" — בלי שום דרך להבין או לאשר. הבקרה על חוב נשארת ביציאה מתוך
  // הכרטיס (handleExit), שם אפשר להסביר את הסיבה ולבקש אישור עובד/מנהל.
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

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

  // טוען מחדש את ההזמנה מהשרת ומאפס את מצב "שינויים שלא נשמרו".
  const reloadOrderFromServer = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) return false;
      const data = await res.json();
      const loadedItems = data.items || [];
      const loadedObligations = data.obligations || [];
      const loadedPayments = data.payments || [];
      const loadedRefunds = data.refunds || [];
      setOrder(data);
      setItems(loadedItems);
      setObligations(loadedObligations);
      setPayments(loadedPayments);
      setRefunds(loadedRefunds);
      savedSnapshotRef.current = { order: data, items: loadedItems, obligations: loadedObligations, payments: loadedPayments, refunds: loadedRefunds };
      setHasUnsavedChanges(false);
      return true;
    } catch (err) {
      console.error('Failed to reload order', err);
      return false;
    }
  };

  // שולח את ההזמנה לשרת ומטפל בהתנגשות נתונים (409). בלי הטיפול הזה המשתמש נתקע:
  // הכרטיס ממשיך להחזיק updatedAt ישן, ולכן כל ניסיון שמירה נוסף נכשל שוב באותה הודעה.
  // מחזיר null כשהמשתמש בחר לטעון מחדש מהשרת במקום לשמור.
  const putOrder = async (payload) => {
    const send = (body) => fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const res = await send(payload);
    if (res.status !== 409) return res;

    const conflict = await res.json().catch(() => null);
    const baseMsg = (conflict && conflict.message) || 'ההזמנה עודכנה בשרת מאז הטעינה האחרונה של הכרטיס.';
    const overwrite = confirm(`${baseMsg}\n\nאישור = לשמור בכל זאת ולדרוס את הגרסה שבשרת.\nביטול = לטעון מחדש את הנתונים מהשרת (השינויים שלא נשמרו יאבדו).`);
    if (!overwrite) {
      await reloadOrderFromServer();
      return null;
    }
    return send({ ...payload, overwriteConflict: true });
  };

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
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. שמירת השינויים דורשת הרשאת מנהל. אנא בחר מנהל והזן סיסמה:", 'מנהל');
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
        setDebtApproved(authResult.employeeId);
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
      const res = await putOrder({
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
      });

      // המשתמש בחר לטעון מחדש מהשרת במקום לדרוס — הנתונים כבר רועננו.
      if (!res) {
        setSaveMessage('הנתונים נטענו מחדש מהשרת. בדוק את הפרטים ושמור שוב.');
        return;
      }

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
      const choice = await window.customThreeWayConfirm(
        'ישנם שינויים שלא נשמרו בהזמנה! האם ברצונך לשמור אותם לפני היציאה?',
        'שינויים לא נשמרו'
      );
      if (choice === 'cancel' || !choice) return;
      if (choice === 'discard') {
        if (destinationHref) {
          router.push(destinationHref);
        } else {
          router.back();
        }
        return;
      }
    }
    let exitDebtApprovedBy = typeof debtApproved === 'string' ? debtApproved : null;
    if (totalRequired - totalPaid > 0 && !exitDebtApprovedBy) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. יציאה דורשת הרשאת מנהל. אנא בחר מנהל והזן סיסמה:", 'מנהל');
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
        setDebtApproved(authResult.employeeId);
        exitDebtApprovedBy = authResult.employeeId;
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

      const res = await putOrder({
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
          debtApprovedBy: exitDebtApprovedBy,
          totalAmount: (() => {
            const itemsSum = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);
            const obligationsSum = obligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
            return itemsSum > 0 ? itemsSum : (obligationsSum > 0 ? obligationsSum : (order.totalAmount || 0));
          })()
      });

      // המשתמש בחר לטעון מחדש מהשרת במקום לדרוס — נשארים בכרטיס כדי שיבדוק ויחליט.
      if (!res) {
        setSaving(false);
        alert('הנתונים נטענו מחדש מהשרת. בדוק את ההזמנה ושמור שוב לפני היציאה.');
        return;
      }

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

  // גרסה מקובצת עם איקון + כיתוב קצר לכל שינוי, לתצוגה במודל אישור "ביטול שינויים".
  const buildChangeRows = () => {
    const snap = savedSnapshotRef.current;
    if (!snap) return [];
    const rows = [];
    CHANGE_GROUPS.forEach(({ Icon, label, fields }) => {
      const changed = fields.some(f => JSON.stringify((snap.order && snap.order[f]) ?? null) !== JSON.stringify((order && order[f]) ?? null));
      if (changed) rows.push({ Icon, text: label });
    });
    const itemsText = formatListCounts('פריטים', summarizeListDiffCounts(snap.items, items));
    if (itemsText) rows.push({ Icon: Package, text: itemsText });
    const obligationsText = formatListCounts('התחייבויות תשלום', summarizeListDiffCounts(snap.obligations, obligations));
    if (obligationsText) rows.push({ Icon: Receipt, text: obligationsText });
    const paymentsText = formatListCounts('תשלומים', summarizeListDiffCounts(snap.payments, payments));
    if (paymentsText) rows.push({ Icon: CreditCard, text: paymentsText });
    return rows;
  };

  const handleCancelChanges = async () => {
    const snap = savedSnapshotRef.current;
    if (!hasUnsavedChanges || !snap) {
      alert('אין שינויים לביטול.');
      return;
    }

    const changes = buildChangeSummary();
    const rows = buildChangeRows();
    const confirmed = await window.customConfirm(
      <div>
        <p style={{ margin: '0 0 14px', color: '#64748b', fontSize: '0.95rem', lineHeight: 1.5 }}>
          פעולה זו תבטל את כל השינויים שלא נשמרו בהזמנה זו, ותחזיר אותה למצב האחרון שנשמר:
        </p>
        {rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '260px', overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                <span style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(212, 175, 55, 0.14)', color: '#b5952f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <r.Icon size={15} />
                </span>
                <span style={{ fontSize: '0.92rem', fontWeight: 600, color: '#334155' }}>{r.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.92rem', color: '#94a3b8', fontStyle: 'italic' }}>שינויים שלא נשמרו</div>
        )}
      </div>
    );
    if (!confirmed) return;

    setOrder(snap.order);
    setItems(snap.items);
    setObligations(snap.obligations);
    setPayments(snap.payments);
    setRefunds(snap.refunds);
    setHasUnsavedChanges(false);

    // הביטול עצמו הוא מקומי בלבד, ולכן בלי הרישום הזה הפעולה לא מופיעה בשום היסטוריה.
    // נשלח אחרי השחזור ובלי await — כישלון ברישום לא אמור לעכב או לבטל את השחזור עצמו.
    fetch(`/api/orders/${id}/cancel-changes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes })
    }).catch(err => console.error('Failed to log cancelled changes', err));
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
      setSaveMessage('שולח מייל (יוצר PDF בענן)...');
      const res = await fetch(`/api/orders/${order.orderId}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail, type: type })
      });
      const data = await res.json();
      if (data.success) {
        setSaveMessage('המייל נשלח בהצלחה!');
      } else {
        setSaveMessage('שגיאה: ' + (data.error || 'השליחה נכשלה'));
      }
    } catch (err) {
      console.error(err);
      setSaveMessage('שגיאה בשליחת המייל');
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
          onLock={() => setIsUnlocked(false)}
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
                onOrderChange={(val) => {
                  // val יכול להיות אובייקט מלא (עדכון סינכרוני) או פונקציה (prev => ...) —
                  // הצורה הפונקציונלית נחוצה לעדכונים שמגיעים אחרי await (למשל אישור PIN לציפוף),
                  // כדי לא לדרוס שינויים שקרו בינתיים על בסיס סנאפשוט ישן של order.
                  setOrder(prev => (typeof val === 'function' ? val(prev) : val));
                  setHasUnsavedChanges(true);
                }}
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
                onItemsChange={(val) => {
                  // תומך גם בעדכון פונקציונלי (prev => ...) — נחוץ לפעולות שעוברות דרך await
                  // (למשל סריקת ברקוד: אישור PIN / בדיקת מלאי / דיאלוג אישור), כדי לא לדרוס
                  // שינויים אחרים בפריטים שקרו בינתיים על בסיס סנאפשוט ישן של items.
                  setItems(prev => (typeof val === 'function' ? val(prev) : val));
                  setHasUnsavedChanges(true);
                }}
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
