'use client';

import { useState, useEffect, use, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import ActiveEmployeesModal from '../../../components/orders/ActiveEmployeesModal';
import ModernOrderCard from '../../../components/orders/modern/ModernOrderCard';
import ModernGeneralDetails from '../../../components/orders/modern/ModernGeneralDetails';
import ModernItemsManager from '../../../components/orders/modern/ModernItemsManager';
import ModernPaymentsManager from '../../../components/orders/modern/ModernPaymentsManager';
import ModernInfoTab from '../../../components/orders/modern/ModernInfoTab';
import { calculateOrderStatus } from '../../../lib/orderStatus';
import { getHebrewDateString } from '../../../lib/hebrewDate';
import { addHistory } from '../../../lib/historyManager';
import { saveOrderDraft, loadOrderDraft, clearOrderDraft } from '../../lib/orderDrafts';
import { fetchSharedJson, TTL } from '../../../lib/apiCache';
import { resolveOrderRedirectHref } from '../../../lib/orderRedirectScreens';
import { sendWithApproval, stashApprovalToken, DEBT_APPROVAL_LEVEL } from '../../../lib/approvalClient';
import { offerCreditOffset } from '../../../lib/creditOfferClient';

// שדות בהזמנה שכפתור "ביטול שינויים" צריך לדווח עליהם אם השתנו מאז השמירה האחרונה
const ORDER_FIELD_LABELS = {
  eventDate: 'תאריך אירוע',
  eventDateHebrew: 'תאריך אירוע (עברי)',
  returnDate: 'תאריך החזרה',
  fromDate: 'מתאריך',
  toDate: 'עד תאריך',
  isAbroad: 'אירוע חו"ל',
  customSpacing: 'ריווח מותאם',
  notes: 'הערות',
  internalNotes: 'הערות פנימיות',
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

// האם משהו שמשפיע על חישוב המחיר (הפריטים, או שדות ההזמנה שנשלחים ל-preview-pricing)
// השתנה מאז השמירה האחרונה. hasUnsavedChanges לבדו לא מספיק כתנאי לתצוגה המקדימה: הוא
// נדלק גם על הוספת חיוב ידני / תשלום בלבד, ואז ה-preview רץ מיותר ומחליף את החיובים
// האוטומטיים השמורים בתוצאה שחושבה מחדש - שעלולה להיות ריקה (למשל כשלפריטים אין
// dressItem.dress מקושר, ר' הסינון ב-preview-pricing/route.js) ואז "החיובים נעלמים".
// isDelivery/deliveryCity/deliveryDirection נוספו כאן כי בלעדיהם, סימון/שינוי משלוח לא
// היה מפעיל את החישוב המחדש למטה בכלל, גם כשכן עוברים לטאב תשלומים - preview-pricing
// עכשיו כן יודע לחשב משלוח (ר' computeDeliveryObligationPreview), אבל בלי השדות האלה
// כאן pricingInputsChanged היה מחזיר false ומדלג על הקריאה מלכתחילה (דיווח 6124472b).
const PRICING_ORDER_FIELDS = ['eventDate', 'isAbroad', 'fromDate', 'toDate', 'isDelivery', 'deliveryCity', 'deliveryDirection'];
const pricingInputsChanged = (snap, currItems, currOrder) => {
  if (!snap) return false;
  if (JSON.stringify(snap.items || []) !== JSON.stringify(currItems || [])) return true;
  return PRICING_ORDER_FIELDS.some(f => (snap.order?.[f] ?? null) !== (currOrder?.[f] ?? null));
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
// כל קבוצה מחזיקה id של סמל מתוך ה-sprite המשותף (app/components/IconSprite.js) במקום
// קומפוננטת אייקון מ-lucide-react, כדי לתאום עם מערכת העיצוב "אריג".
const CHANGE_GROUPS = [
  { icon: '#i-calendar', label: 'תאריך אירוע', fields: ['eventDate', 'eventDateHebrew'] },
  { icon: '#i-calendar', label: 'טווח תאריכים (לקיחה/החזרה)', fields: ['fromDate', 'toDate', 'returnDate'] },
  { icon: '#i-pin', label: 'סוג אירוע (רגיל/חו"ל)', fields: ['isAbroad'] },
  { icon: '#i-alert-tri', label: 'ריווח ימים מותאם', fields: ['customSpacing'] },
  { icon: '#i-file', label: 'הערות להזמנה', fields: ['notes'] },
  { icon: '#i-file', label: 'הערות פנימיות', fields: ['internalNotes'] },
  { icon: '#i-check-circle', label: 'חתימה על תקנון', fields: ['hasSignedRegulations'] },
  { icon: '#i-user', label: 'לקוח', fields: ['customerId'] }
];

// גרסאות ברמת המודול של סיכום/שורות השינויים — משמשות גם את מודל "ביטול שינויים"
// (דרך העטיפות בקומפוננטה) וגם את כותב הטיוטה המקומית (effect שרץ לפני ה-early return,
// ולכן לא יכול לקרוא לפונקציות שמוגדרות אחריו בגוף הקומפוננטה).
const buildDraftSummary = (snap, curr) => [
  ...summarizeOrderFieldChanges(snap.order, curr.order),
  ...summarizeListDiff(snap.items, curr.items, 'פריטים'),
  ...summarizeListDiff(snap.obligations, curr.obligations, 'התחייבויות תשלום'),
  ...summarizeListDiff(snap.payments, curr.payments, 'תשלומים')
];

const buildDraftRows = (snap, curr) => {
  const rows = [];
  CHANGE_GROUPS.forEach(({ icon, label, fields }) => {
    const changed = fields.some(f => JSON.stringify((snap.order && snap.order[f]) ?? null) !== JSON.stringify((curr.order && curr.order[f]) ?? null));
    if (changed) rows.push({ icon, text: label });
  });
  const itemsText = formatListCounts('פריטים', summarizeListDiffCounts(snap.items, curr.items));
  if (itemsText) rows.push({ icon: '#i-bag', text: itemsText });
  const obligationsText = formatListCounts('התחייבויות תשלום', summarizeListDiffCounts(snap.obligations, curr.obligations));
  if (obligationsText) rows.push({ icon: '#i-receipt', text: obligationsText });
  const paymentsText = formatListCounts('תשלומים', summarizeListDiffCounts(snap.payments, curr.payments));
  if (paymentsText) rows.push({ icon: '#i-card', text: paymentsText });
  return rows;
};

// זיהוי "מה זה" עבור חיוב, יציב יותר מהשוואת description מילולית מלאה - ר' חלון "סיכום
// ההזמנה לפני שמירה" (confirmSaveSummaryIfNeeded) שמנסה להבחין חיוב שכבר היה בהזמנה
// מחיוב שנוסף רק בעריכה הנוכחית. הזמנה ישנה שיובאה מ-Access (scripts/import_from_access.js:
// description מגיע ישירות משדה "תיאור" ב-Access, ללא שום קשר לפורמט "<שם> מידה <X>
// (פריט #<uuid>)" ש-computeOrderObligations מייצר) נושאת טקסט description שלעולם לא
// יתאים לתצוגה המקדימה שמחושבת עכשיו - השוואת מחרוזות מלאה סימנה אז כל שורה כ"נוסף עכשיו",
// גם פריטים ישנים שלא נגעו בהם (דיווח: "רק הוספתי משלוח" אבל כל השורות סומנו). orderItemId
// יציב גם בהזמנה מיובאת (itemLegacyToNewId באותו סקריפט ייבוא) - לכן מזהים חיוב מקושר-פריט
// לפי (orderItemId + סוג השורה, לפי קידומת ידועה), ורק נופלים חזרה לטקסט description מלא
// עבור שורות בלי orderItemId (משלוח/חיוב ידני), ששם הטקסט כן נקבע דטרמיניסטית ויציב.
const OBLIGATION_KIND_PREFIXES = ['תיקון צוואר', 'תיקון שרוול', 'תיקון אורך', 'חיוב מקורי', 'זיכוי בגין ביטול', 'זיכוי דמי ביטול', 'דמי ביטול ותיקונים'];
const obligationIdentityKey = (o) => {
  if (o.orderItemId) {
    const kind = OBLIGATION_KIND_PREFIXES.find(p => (o.description || '').startsWith(p)) || 'רגיל';
    return `item:${o.orderItemId}:${kind}`;
  }
  return `desc:${o.description || ''}`;
};

// חתימה קצרה של מה ששמור בשרת בהזמנה (פריטים, חיובים, תשלומים, זיכויים) - משמשת לבדיקה אם
// ההזמנה השתנתה ממקום אחר (למשל החזרת שמלה בלשונית אחרת) בלי להשוות אובייקטים שלמים.
const orderServerSignature = (snap) => {
  if (!snap) return '';
  const o = snap.order || snap;
  // טיוטות חיוב (isDraft) מחושבות בזיכרון ב-GET בלבד ולא קיימות בתשובת ה-PUT - לא חלק מהמצב השמור; מיון - כדי שסדר שאילתה לא ייראה כשינוי
  const part = (list, pick) => (list || []).filter(x => !x.isDraft).map(pick).sort().join('|');
  return [
    o.updatedAt || '',
    o.status || '',
    part(snap.items, i => [i.id, i.updatedAt || '', i.isTaken ? 1 : 0, i.isReturned ? 1 : 0, i.isDeleted ? 1 : 0, i.returnDate || ''].join('~')),
    part(snap.obligations, x => [x.id, x.amount, x.isDeleted ? 1 : 0].join('~')),
    part(snap.payments, x => [x.id, x.amount, x.isDeleted ? 1 : 0].join('~')),
    part(snap.refunds, x => [x.id, x.amount, x.isExecuted ? 1 : 0, x.isDeleted ? 1 : 0].join('~'))
  ].join('#');
};

export default function OrderDetailsPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const id = unwrappedParams.id;
  
  const [order, setOrder] = useState(null);
  const initialLockChecked = useRef(false);
  // מצב ההזמנה כפי שהוא בשרת (בטעינה ואחרי כל שמירה מוצלחת) — הבסיס להשוואה ולשחזור ב"ביטול שינויים".
  const savedSnapshotRef = useRef(null);
  // יתרת החוב (totalRequired - totalPaid) כפי שהייתה כשההזמנה נטענה/נטענה-מחדש לאחרונה
  // בכרטיס - הבסיס להשוואה ב-handleSave כדי לדעת אם השמירה הזו יצרה/הגדילה חוב, או שהיא
  // רק שומרת שינוי אחר על הזמנה שכבר הייתה בחוב מבעוד מועד (ר' handleSave).
  const [openedDebt, setOpenedDebt] = useState(null);
  // מחזיק תמיד את הגרסה העדכנית של handleExit (המוגדר בהמשך הקומפוננטה) כדי שניתן יהיה
  // לקרוא לו מ-useEffect שמוגדר לפני ה-early return, בלי לשבור את סדר ה-hooks.
  const handleExitRef = useRef(null);
  const handleSaveRef = useRef(null);
  // מסומן ל-true כשיציאה נחסמה כי השמירה שקדמה לה יצרה חוב חדש שהעובד עדיין לא טיפל
  // בו (ר' handleExit) - מבטיח שניסיון יציאה חוזר לא ינצל את קיצור הדרך "אין שינויים
  // שלא נשמרו" כדי לצאת בשקט בלי שעובר דרך בדיקת החוב הרגילה.
  const pendingDebtBlockRef = useRef(false);
  // מוודא שחלון "הזן פרטי בנק לזיכוי" (ר' handleExit) נפתח לכל היותר פעם אחת בניסיון
  // יציאה - בניגוד לחוב, זה לא חוסם לצמיתות: אם העובד סגר את החלון בלי למלא (למשל אין לו
  // כרגע את פרטי הבנק), לא מונעים ממנו לצאת בניסיון הבא.
  const bankDetailsPromptedOnExitRef = useRef(false);
  // חלון "סיכום ההזמנה" שמוצג לפני שמירה בפועל כש-enable_order_edit_summary_confirm
  // מופעל (ר' confirmSaveSummaryIfNeeded והרינדור למטה). null = סגור.
  const [summaryConfirmData, setSummaryConfirmData] = useState(null);
  // חלונית צפה "השלמת תשלום" - מוצגת (רק כש-enableEditSummaryConfirm, נווה יעקב) מיד אחרי
  // ששמירה יצרה/הגדילה חוב, במקום להסתפק בהודעת טוסט + מעבר שקט לטאב תשלומים (דיווח:
  // "פשוט שמר בלי לבקש תשלום" - לא היה מספיק ברור). number = סכום היתרה לתשלום, מציג;
  // null = סגורה. ר' handleSave/handleExit למטה.
  const [paymentContinueAmount, setPaymentContinueAmount] = useState(null);
  // order_card_defer_payment_prompt (דיווחים b45fd22e + 96bcbf45) - כבוי (ברירת מחדל) = אחרי כל פריט שנוסף וגרם לחוב חדש (נווה יעקב, enable_order_edit_summary_confirm) הכרטיס עובר
  // מיד לטאב תשלומים ופותח את חלונית "השלמת תשלום", כמו תמיד. דולק = נשארים בטאב הפריטים (אפשר להוסיף פריט אחרי פריט), מוצגת הודעת חיוב עם כפתורים, וחלון התשלום נפתח
  // אוטומטית כשעוברים ללשונית אחרת או כשיוצאים מההזמנה. deferredDebtPrompt = יש חיוב חדש שחלון התשלום שלו מחכה.
  const [deferPaymentPrompt, setDeferPaymentPrompt] = useState(false);
  const [deferredDebtPrompt, setDeferredDebtPrompt] = useState(false);
  // order_card_save_after_item_delete (דיווח 5cf81871) - כבוי (ברירת מחדל) = מחיקת פריט היא שינוי מקומי שנשמר רק ב"שמור שינויים". דולק = אחרי שמאשרים מחיקת פריט שכבר נשמר
  // מופעלת מיד השמירה הרגילה (handleSave, עם כל האישורים שלה: סיכום, ת"ז, אישור מנהל), ואם נוצר זיכוי בלי פרטי בנק נפתח מיד חלון פרטי הבנק (כמו אחרי שמירה ידנית).
  const [saveAfterItemDelete, setSaveAfterItemDelete] = useState(false);
  const [autoSaveAfterDelete, setAutoSaveAfterDelete] = useState(false);
  // מחזיק את פונקציית ה-resolve של ה-Promise שמחזירה confirmSaveSummaryIfNeeded, כדי
  // שכפתורי החלון (שמעבר לרינדור הזה) יוכלו "לענות" לקריאה שממתינה ב-handleSave/handleExit.
  const summaryConfirmResolverRef = useRef(null);
  // סיסמת מאשר זמנית לשליחת מייל הזמנה (ראה handleSendEmail) - חייב להיות כאן, לפני כל return מוקדם.
  const emailApprovalRef = useRef(null);
  const [isPastEvent, setIsPastEvent] = useState(false);
  const [items, setItems] = useState([]);
  const [obligations, setObligations] = useState([]);
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [showSaveSuccessOverlay, setShowSaveSuccessOverlay] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [showEmployeesModal, setShowEmployeesModal] = useState(false);
  const [inventoryCache, setInventoryCache] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // טיוטה מקומית (localStorage) של שינויים שלא נשמרו מביקור קודם בכרטיס — ממתינה
  // להחלטת המשתמש (שחזור/מחיקה) בבאנר שמעל הכרטיס. ר' app/lib/orderDrafts.js.
  const [pendingDraft, setPendingDraft] = useState(null);
  // מבדיל בין "אין שינויים כי רק נטען" ל"אין שינויים כי הרגע נשמרו/בוטלו" —
  // רק במעבר השני מוחקים את הטיוטה מ-localStorage.
  const hadUnsavedRef = useRef(false);
  
  // Custom Email Prompt State
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [emailTypePending, setEmailTypePending] = useState(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState('items'); // details, items, rentals, payments, history
  const [debtApproved, setDebtApproved] = useState(false); // Track manager approval to skip exit warning
  const itemsManagerRef = useRef(null); // מאפשר ל"סריקה מהירה" בסיידבר להפעיל השכרה/החזרה בטאב הפריטים
  const paymentsManagerRef = useRef(null); // מאפשר לאייקון החוב בטופ-בר לפתוח את חלון נדרים פלוס

  // תצוגה מקדימה חיה של המחיר (ר' app/api/orders/[id]/preview-pricing) - רצה ברקע כשעוברים
  // לטאב תשלומים עם שינויים שטרם נשמרו, כדי שהסכום שרואים לפני "שמור" יהיה מדויק (כולל
  // דמי ביטול/שינויי תאריך שהחישוב המקומי הפשוט למטה לא יודע לחשב). previewSeqRef מבטיח
  // שתשובה איטית ממרוץ קודם לא תדרוס תוצאה חדשה יותר.
  const [isLivePreviewing, setIsLivePreviewing] = useState(false);
  const previewSeqRef = useRef(0);

  // draft_orders_show_as_deleted (SystemSetting, default "true") — see lib/orderStatus.js
  // calculateOrderStatus and app/orders/page.js for the fuller explanation. Same fetch pattern
  // (fetchSharedJson('/api/settings')) as that list page, so both surfaces agree on the toggle.
  const [draftsAsDeleted, setDraftsAsDeleted] = useState(true);
  const [requireIdForEdit, setRequireIdForEdit] = useState(false); // 14 - ת״ז לעריכה/ביטול
  // customer_id_once_per_order_visit - כבוי (ברירת מחדל) = בקשת ת״ז בכל שמירה (ההתנהגות הקודמת).
  // דולק = הת״ז נשאלת פעם אחת בביקור בהזמנה ונשמרת בזיכרון הדף בלבד (verifiedZeoutRef) עד היציאה מההזמנה;
  // השרת ממשיך לאמת אותה מול הלקוח בכל שמירה, ולכן אין כאן הקלה באבטחה - רק אין צורך להקליד שוב.
  const [idOncePerOrderVisit, setIdOncePerOrderVisit] = useState(false);
  // order_card_refresh_on_return - כבוי (ברירת מחדל) = הכרטיס הפתוח לא בודק שינוי ממקום אחר (ההתנהגות הקודמת); דולק = בדיקה כשחוזרים אליו.
  const [refreshOnReturn, setRefreshOnReturn] = useState(false);
  const verifiedZeoutRef = useRef(null); // { customerId, zeout } - לא נכתב ל-localStorage, נמחק ביציאה מההזמנה
  const [allowEditPartially, setAllowEditPartially] = useState(true); // 27 - עריכת מושכר חלקי
  // require_manager_code_for_item_changes - ביטול פריט קיים דורש גם אישור מנהל, בנוסף
  // לת״ז (לא במקומו). ברירת מחדל כבויה = ההתנהגות הקודמת (ת״ז בלבד). הוספת פריט חדש
  // נבדקת בנפרד ב-ModernItemsManager.js (POST מיידי, לא דרך שמירת ההזמנה הכללית כאן).
  const [requireManagerCodeForItems, setRequireManagerCodeForItems] = useState(false);
  // דיווח לקוח (הגמח הראשי): "אנחנו לא רוצים טיוטות של הזמנות לא שמורות" - עד כה שמירת
  // הטיוטה המקומית (ר' האפקט למטה) הייתה גלובלית וללא אפשרות כיבוי. ברירת המחדל true
  // שומרת על ההתנהגות הקודמת אצל כל גמח שלא הגדיר את המפתח הזה ב-DB שלו במפורש.
  const [enableLocalDrafts, setEnableLocalDrafts] = useState(true);
  // enable_order_edit_summary_confirm - מוגדר כרגע רק ב-Neve יעקב (ראה code-fixes-vs-
  // settings-scope: מפתח קיים אצל שני הגמחים, אבל הערך "true" רק אצל מי שביקש את זה).
  // כשמופעל, handleSave/handleExit עוצרים לפני השמירה בפועל ומציגים חלון סיכום+חוב
  // (ר' confirmSaveSummaryIfNeeded ו-OrderEditSummaryModal) - בדומה לשלבי סיכום/תשלום
  // באשף הזמנה חדשה, שם אין תלות ב-tab (זה כרטיס אחד עם טאבים, לא אשף שלבים).
  const [enableEditSummaryConfirm, setEnableEditSummaryConfirm] = useState(false);
  // consolidate_manual_payment_credit_ui - כמו enable_order_edit_summary_confirm למעלה,
  // מוגדר "true" רק אצל נווה יעקב (המפתח קיים אצל שני הגמחים). כשמופעל, כפתורי "תשלום
  // נוסף"/"בקשת זיכוי ללקוח" מוסתרים מטאב תשלומים (ר' ModernPaymentsManager.js), וכפתור
  // מאוחד יחיד מופיע בטאב "פרטים כלליים" (ר' handleOpenManualPaymentCredit למטה) - שם
  // ההוספה עצמה דורשת קוד מאשר (feature:manual_payment_credit_add ב-lib/permissionsMetadata.js).
  const [consolidateManualPaymentCredit, setConsolidateManualPaymentCredit] = useState(false);
  // מציג/מסתיר כפתורי פעולה בחלונית הצפה "המשך תשלום" למטה (paymentContinueAmount) - אותם
  // מתגים בדיוק ששולטים בכפתורים המקבילים בטאב תשלומים עצמו (ModernPaymentsManager.js),
  // נקראים כאן בנפרד כי page.js צריך אותם גם בלי לפתוח את הטאב קודם.
  const [nedarimPlusEnabled, setNedarimPlusEnabled] = useState(true);
  const [allowAdditionalPayment, setAllowAdditionalPayment] = useState(false);
  // order_edit_redirect_screen - מסך היעד כשיוצאים מהכרטיס (handleExit) בלי יעד מפורש
  // משלו. ברירת מחדל "orders_list" = ההתנהגות הקודמת (חזרה לרשימת ההזמנות).
  const [orderEditRedirectScreen, setOrderEditRedirectScreen] = useState('orders_list');
  // order_card_save_in_footer (דיווח 7681043a) - כבוי (ברירת מחדל) = "שמור שינויים" למעלה בראש הדף; דולק = בפס תחתון כמו "סיום ויצירת ההזמנה" (ר' ModernOrderCard).
  const [saveInFooter, setSaveInFooter] = useState(false);
  // order_edit_fewer_confirmations (דיווח c43a2b84) - כבוי (ברירת מחדל) = כל החלונות כמו תמיד. דולק: (1) שאלת ההדפסה אחרי שמירה מתמזגת לתוך חלון "סיכום ההזמנה לפני שמירה"
  // (תיבת סימון במקום חלון אישור נוסף; רק כש-enable_order_edit_summary_confirm דולק), (2) לחיצה על "שמור שינויים" כשאין שום שינוי שלא נשמר לא פותחת שוב סיכום+ת"ז+שמירה -
  // רק שאלת הדפסה אחת. אף אישור אבטחה/כסף (ת"ז, קוד מאשר, חוב, מחיקת פריט, התנגשות) לא נוגעים בו.
  const [fewerConfirmations, setFewerConfirmations] = useState(false);
  // תיבת "להדפיס אחרי השמירה" בחלון הסיכום (רק כש-fewerConfirmations): state להצגה + ref כדי שה-resolver של ה-Promise יקרא את הערך העדכני.
  const [summaryPrintAfter, setSummaryPrintAfter] = useState(false);
  const summaryPrintAfterRef = useRef(false);
  // customer_credit_offset_prompt (דיווח 679a860b, lib/creditOffset.js) - כבוי כברירת מחדל = אין שאלה ואין קיזוז. כשמופעל: אחרי שמירה/יציאה שיצרו חוב
  // חדש ויש ללקוחה זיכוי פתוח מהזמנה אחרת, נשאלת שאלה אחת "לקזז מהחוב?" (ר' askCreditOffset למטה).
  const [creditOffsetPromptEnabled, setCreditOffsetPromptEnabled] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetchSharedJson('/api/settings', { ttl: TTL.STATIC })
      .then(data => {
        if (cancelled || !Array.isArray(data)) return;
        const setting = data.find(s => s.key === 'draft_orders_show_as_deleted');
        if (setting) setDraftsAsDeleted(setting.value === 'true');
        const reqId = data.find(s => s.key === 'require_id_for_edit_cancel');
        if (reqId) setRequireIdForEdit(reqId.value === 'true');
        const idOnce = data.find(s => s.key === 'customer_id_once_per_order_visit');
        if (idOnce) setIdOncePerOrderVisit(idOnce.value === 'true');
        const refreshOnRet = data.find(s => s.key === 'order_card_refresh_on_return');
        if (refreshOnRet) setRefreshOnReturn(refreshOnRet.value === 'true');
        const allowP = data.find(s => s.key === 'allow_edit_partially_rented');
        if (allowP) setAllowEditPartially(allowP.value === 'true');
        const reqManagerCode = data.find(s => s.key === 'require_manager_code_for_item_changes');
        if (reqManagerCode) setRequireManagerCodeForItems(reqManagerCode.value === 'true');
        const localDrafts = data.find(s => s.key === 'enable_local_order_drafts');
        if (localDrafts) setEnableLocalDrafts(localDrafts.value === 'true');
        const editSummaryConfirm = data.find(s => s.key === 'enable_order_edit_summary_confirm');
        if (editSummaryConfirm) setEnableEditSummaryConfirm(editSummaryConfirm.value === 'true');
        const consolidatedPaymentCredit = data.find(s => s.key === 'consolidate_manual_payment_credit_ui');
        if (consolidatedPaymentCredit) setConsolidateManualPaymentCredit(consolidatedPaymentCredit.value === 'true');
        const nedarimSetting = data.find(s => s.key === 'nedarim_plus_enabled');
        if (nedarimSetting) setNedarimPlusEnabled(nedarimSetting.value !== 'false');
        const additionalPaymentSetting = data.find(s => s.key === 'allow_additional_payment_on_order');
        if (additionalPaymentSetting) setAllowAdditionalPayment(additionalPaymentSetting.value === 'true');
        const editRedirect = data.find(s => s.key === 'order_edit_redirect_screen');
        if (editRedirect && editRedirect.value) setOrderEditRedirectScreen(editRedirect.value);
        const deferPaymentSetting = data.find(s => s.key === 'order_card_defer_payment_prompt');
        if (deferPaymentSetting) setDeferPaymentPrompt(deferPaymentSetting.value === 'true');
        const saveAfterDeleteSetting = data.find(s => s.key === 'order_card_save_after_item_delete');
        if (saveAfterDeleteSetting) setSaveAfterItemDelete(saveAfterDeleteSetting.value === 'true');
        const creditOffsetSetting = data.find(s => s.key === 'customer_credit_offset_prompt');
        if (creditOffsetSetting) setCreditOffsetPromptEnabled(creditOffsetSetting.value === 'true');
        const saveInFooterSetting = data.find(s => s.key === 'order_card_save_in_footer');
        if (saveInFooterSetting) setSaveInFooter(saveInFooterSetting.value === 'true');
        const fewerConfirmSetting = data.find(s => s.key === 'order_edit_fewer_confirmations');
        if (fewerConfirmSetting) setFewerConfirmations(fewerConfirmSetting.value === 'true');
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // order_card_save_after_item_delete: ה-flag נדלק באותו אירוע שבו הפריט סומן כמחוק, ולכן הרינדור הזה כבר כולל את הפריט המחוק - handleSaveRef מצביע על handleSave של הרינדור הזה.
  useEffect(() => {
    if (!autoSaveAfterDelete) return;
    setAutoSaveAfterDelete(false);
    if (handleSaveRef.current) handleSaveRef.current(null, { promptPrint: false });
  }, [autoSaveAfterDelete]);

  // 14 - בקשת ת״ז לפני עריכה/ביטול (prompt פשוט, מותנה ב-require_id_for_edit_cancel)
  // 2026-09-14 - רק כשללקוח יש בפועל ת״ז שמורה (השרת ממילא לא דורש כשאין - ר' route.js) -
  // אין טעם לבקש קוד שאין מול מה לאמת אותו, וזה היה חוסם לצמיתות הזמנות ישנות בלי ת״ז
  const zeoutVerificationNeeded = requireIdForEdit && !!String(order?.customer?.zeout || '').trim();
  // fresh=true (ביטול הזמנה שלמה) תמיד שואל מחדש, גם כשהת״ז כבר נזכרה בביקור הזה.
  const requestZeout = async ({ fresh = false } = {}) => {
    if (!zeoutVerificationNeeded) return null;
    const customerKey = order?.customerId ?? order?.customer?.id ?? null;
    const remembered = verifiedZeoutRef.current;
    if (!fresh && idOncePerOrderVisit && remembered && remembered.customerId === customerKey) return remembered.zeout;
    const msg = 'עריכה/ביטול דורשים אימות תעודת זהות של הלקוח. נא להזין ת״ז:';
    let zeout = null;
    if (typeof window !== 'undefined' && window.customPrompt) {
      zeout = await window.customPrompt(msg, '', 'text');
    } else if (typeof window !== 'undefined') {
      zeout = window.prompt(msg);
    }
    const typed = zeout ? String(zeout).trim() : null;
    if (typed && idOncePerOrderVisit) verifiedZeoutRef.current = { customerId: customerKey, zeout: typed };
    return typed;
  };
  // היציאה מההזמנה (הקומפוננטה יורדת) מוחקת את הזיכרון ממילא; מעבר להזמנה אחרת באותו מופע מוחק אותו כאן.
  useEffect(() => { verifiedZeoutRef.current = null; }, [id]);

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
        // צילום יתרת החוב כפי שהייתה בפתיחת הכרטיס - ר' openedDebt לעיל.
        const loadedTotalRequired = loadedObligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
        const loadedTotalPaid = loadedPayments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
        setOpenedDebt(loadedTotalRequired - loadedTotalPaid);
        setTimeout(() => setHasUnsavedChanges(false), 0);
        // טיוטה מקומית שלא נשמרה מביקור קודם (למשל דפדפן שנסגר באמצע עריכה) —
        // מוצגת בבאנר עם אפשרות לשחזר או למחוק, במקום להיעלם בשקט.
        const existingDraft = loadOrderDraft(data.orderId);
        if (existingDraft) setPendingDraft(existingDraft);
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
    const hasDates = order.isAbroad ? (order.fromDate && order.toDate) : order.eventDate;
    if (hasDates) {
      const queryParams = new URLSearchParams({
        isAbroad: order.isAbroad || false,
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
  }, [order?.eventDate, order?.fromDate, order?.toDate, order?.isAbroad, order?.orderId]);

  // תצוגה מקדימה של הסכום הכולל: פריט שסומן למחיקה מקומית אך עדיין לא נשמר (isDeleted=true
  // אבל אין עדיין deletedAt - זה נחתם רק בשמירה, ר' lib/pricingEngine.js) לא נספר בסכום, כמו
  // שפריט חדש כבר מעדכן את הסכום מיד עם האישור. שורה עם isPreview=true היא כבר תוצאה של
  // חישוב מלא ומדויק מהשרת (ר' preview-pricing למטה) שכולל גם דמי ביטול/זיכויים לפריט הזה -
  // ולכן היא לא מוחרגת כמו החישוב המקומי הגולמי.
  const totalRequired = obligations
    .filter(o => {
      if (o.isDeleted) return false;
      if (o.isPreview) return true;
      if (o.orderItemId) {
        const relatedItem = items.find(i => i.id === o.orderItemId);
        if (relatedItem?.isDeleted && !relatedItem?.deletedAt) return false;
      }
      return true;
    })
    .reduce((sum, obs) => sum + obs.amount, 0);
  const totalPaid = payments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);

  // מחשב מחדש ברקע כשעוברים לטאב תשלומים עם שינויים שטרם נשמרו (הוספת/מחיקת פריט, שינוי
  // תאריך אירוע/חו"ל וכו') - כדי שהסכום שרואים בטאב התשלומים לפני "שמור" יהיה כבר מדויק,
  // ולא רק ההערכה הגולמית למעלה. מוחלף רק על חלק החיובים האוטומטיים (isManual===false);
  // חיובים ידניים שהמשתמש הוסיף/ערך נשארים כמות שהם. ר' app/api/orders/[id]/preview-pricing.
  useEffect(() => {
    if (activeTab !== 'payments' || !hasUnsavedChanges || !order?.orderId) return;
    if (!pricingInputsChanged(savedSnapshotRef.current, items, order)) return;
    const mySeq = ++previewSeqRef.current;
    const timer = setTimeout(async () => {
      setIsLivePreviewing(true);
      try {
        const res = await fetch(`/api/orders/${order.orderId}/preview-pricing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            order: {
              eventDate: order.eventDate,
              isAbroad: order.isAbroad,
              fromDate: order.fromDate,
              toDate: order.toDate,
              isDelivery: order.isDelivery,
              deliveryCity: order.deliveryCity,
              deliveryDirection: order.deliveryDirection
            }
          })
        });
        if (mySeq !== previewSeqRef.current || !res.ok) return;
        const data = await res.json();
        if (mySeq !== previewSeqRef.current) return; // תשובה איטית ממרוץ קודם - התעלמות
        setObligations(prev => {
          const manual = prev.filter(o => o.isManual !== false);
          const autoPreview = (data.newObligations || []).map(o => ({ ...o, isPreview: true }));
          return [...manual, ...autoPreview];
        });
      } catch (err) {
        console.error('Pricing preview failed', err);
      } finally {
        if (mySeq === previewSeqRef.current) setIsLivePreviewing(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, items, order?.eventDate, order?.isAbroad, order?.fromDate, order?.toDate, order?.isDelivery, order?.deliveryCity, order?.deliveryDirection, order?.orderId, hasUnsavedChanges]);

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

  // רשת ביטחון לשינויים שלא נשמרו: כל עוד יש כאלה, מצב העריכה המלא נכתב (בהשהיה קצרה)
  // כטיוטה ב-localStorage — סגירת דפדפן/קריסה לא מעלימה כלום. ברגע שהשינויים נשמרו
  // או בוטלו (hasUnsavedChanges חוזר ל-false אחרי שהיה true) הטיוטה נמחקת.
  // כשיש טיוטה קודמת שממתינה להחלטה (pendingDraft) לא כותבים חדשה — עריכה תוך כדי
  // התלבטות לא דורסת בשקט את הטיוטה מהביקור הקודם.
  useEffect(() => {
    if (!order?.orderId) return;
    if (!enableLocalDrafts) return;
    if (hasUnsavedChanges) {
      hadUnsavedRef.current = true;
      if (pendingDraft) return;
      const snap = savedSnapshotRef.current;
      const timer = setTimeout(() => {
        const curr = { order, items, obligations, payments };
        saveOrderDraft(order.orderId, {
          savedAt: Date.now(),
          baseUpdatedAt: (snap && snap.order && snap.order.updatedAt) || null,
          summary: snap ? buildDraftSummary(snap, curr) : [],
          rows: snap ? buildDraftRows(snap, curr) : [],
          state: { order, items, obligations, payments, refunds }
        });
      }, 600);
      return () => clearTimeout(timer);
    }
    if (hadUnsavedRef.current) {
      hadUnsavedRef.current = false;
      clearOrderDraft(order.orderId);
    }
  }, [hasUnsavedChanges, order, items, obligations, payments, refunds, pendingDraft, enableLocalDrafts]);

  // טוען מחדש את ההזמנה מהשרת ומאפס את מצב "שינויים שלא נשמרו".
  const reloadOrderFromServer = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) return false;
      const data = await res.json();
      applyServerData(data);
      return true;
    } catch (err) {
      console.error('Failed to reload order', err);
      return false;
    }
  };

  // מציג את מה שהגיע מהשרת - אותו מצב טעינה כמו ב-reloadOrderFromServer, בלי בקשה נוספת.
  const applyServerData = (data) => {
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
    const reloadedTotalRequired = loadedObligations.filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
    const reloadedTotalPaid = loadedPayments.filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
    setOpenedDebt(reloadedTotalRequired - reloadedTotalPaid);
    setHasUnsavedChanges(false);
  };

  // כרטיס פתוח שההזמנה שלו השתנתה ממקום אחר (החזרת שמלה בלשונית/חלון אחר וכד') - כשחוזרים אליו
  // (פוקוס/לשונית נראית) נבדק מול השרת, לכל היותר פעם ב-15 שניות ובקשה אחת. אין שינויים שלא נשמרו =
  // מתעדכן לבד; יש שינויים שלא נשמרו = לא נדרס, רק מוצגת הודעה עם כפתור רענון. בלי בדיקה מחזורית ברקע.
  const EXTERNAL_CHECK_MIN_GAP_MS = 15000;
  const liveStateRef = useRef({ dirty: false, busy: false });
  const externalCheckAtRef = useRef(0);
  const externalCheckBusyRef = useRef(false);
  const externalNoticeTimerRef = useRef(null);
  const [externalNotice, setExternalNotice] = useState(null); // null | 'dirty' | 'applied'
  useEffect(() => {
    liveStateRef.current = {
      dirty: hasUnsavedChanges || items.some(it => !it.id && it._localId),
      busy: saving || isLivePreviewing || !!summaryConfirmData
    };
  });
  useEffect(() => { if (!hasUnsavedChanges) setExternalNotice(prev => (prev === 'dirty' ? null : prev)); }, [hasUnsavedChanges]);
  useEffect(() => {
    if (!id || loading || !refreshOnReturn) return undefined;
    const check = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const now = Date.now();
      if (externalCheckBusyRef.current || now - externalCheckAtRef.current < EXTERNAL_CHECK_MIN_GAP_MS) return;
      externalCheckBusyRef.current = true;
      externalCheckAtRef.current = now;
      try {
        const res = await fetch(`/api/orders/${id}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const snap = savedSnapshotRef.current;
        if (!snap || orderServerSignature(data) === orderServerSignature(snap)) return;
        const live = liveStateRef.current;
        if (live.dirty || live.busy) { setExternalNotice('dirty'); return; }
        // חלון פתוח (תשלום, אישור וכד') - לא מחליפים את הנתונים מתחתיו; הבדיקה תיעשה שוב בפוקוס הבא.
        if (typeof document !== 'undefined' && document.querySelector('.modal-backdrop')) { externalCheckAtRef.current = 0; return; }
        applyServerData(data);
        setExternalNotice('applied');
        clearTimeout(externalNoticeTimerRef.current);
        externalNoticeTimerRef.current = setTimeout(() => setExternalNotice(prev => (prev === 'applied' ? null : prev)), 5000);
      } catch (err) {
        console.error('External-change check failed', err);
      } finally {
        externalCheckBusyRef.current = false;
      }
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
      clearTimeout(externalNoticeTimerRef.current);
    };
  }, [id, loading, refreshOnReturn]);

  const handleRefreshFromElsewhere = async () => {
    const ok = window.customConfirm
      ? await window.customConfirm('הרענון ימחק את השינויים שלא נשמרו בכרטיס. לרענן?')
      : window.confirm('הרענון ימחק את השינויים שלא נשמרו בכרטיס. לרענן?');
    if (!ok) return;
    if (await reloadOrderFromServer()) setExternalNotice(null);
  };

  // שולח את ההזמנה לשרת ומטפל בהתנגשות נתונים (409). בלי הטיפול הזה המשתמש נתקע:
  // הכרטיס ממשיך להחזיק updatedAt ישן, ולכן כל ניסיון שמירה נוסף נכשל שוב באותה הודעה.
  // מחזיר null כשהמשתמש בחר לטעון מחדש מהשרת במקום לשמור.
  const putOrder = async (payload) => {
    // 27 - חסימת עריכת מושכר חלקי בצד לקוח (גם שרת חוסם, אבל נותן חיווי מידי) - נבדק לפני בקשת ת״ז כדי לא לבקש סתם
    if (!allowEditPartially && items.some(i => !i.isDeleted && i.isTaken)) {
      if (typeof window !== 'undefined') alert('לא ניתן לערוך הזמנה שהושכרה חלקית - חסום בהגדרות (allow_edit_partially_rented).');
      return null;
    }
    // 14 - אם דרוש ת״ז, בקש לפני שליחה וצרף ל-body+header
    // 2026-09-14 - רק כשללקוח יש בפועל ת״ז שמורה, ר' הערה ב-requestZeout
    let zeoutForRequest = null;
    if (zeoutVerificationNeeded) {
      zeoutForRequest = await requestZeout();
      if (!zeoutForRequest) {
        // ביטול ע״י המשתמש - לא שולחים כלום, מחזירים null כמו ב-409 discard
        if (typeof window !== 'undefined') alert('עריכה בוטלה - לא הוזנה תעודת זהות.');
        return null;
      }
      payload = { ...payload, zeout: zeoutForRequest };
    }
    const send = (body) => fetch(`/api/orders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...(zeoutForRequest ? { 'x-zeout': zeoutForRequest } : {}) },
      body: JSON.stringify(body)
    });

    // אסימוני אישור חתומים (lib/approvalClient.js, docs/server-approval-hardening.md): נשלחים עם ה-PUT כשיש; כשהשרת מחייב אישור (approval_tokens_required /
    // approval_permissions_enforced דלוקים בגמ"ח הזה) והאסימון חסר או פג - 403 + approvalKind ← חלון קוד המאשר הקיים פעם נוספת ושליחה חוזרת.
    // כל ההגדרות כבויות (ברירת מחדל) = השרת לא מחזיר את זה והזרימה זהה לקודמת.
    const approvalOrderId = Number(payload.orderId) || Number(order?.orderId) || 0;
    const sendApproved = (base) => (approvalOrderId
      ? sendWithApproval((extra) => send({ ...base, ...extra }), {
        orderId: approvalOrderId,
        kinds: base.debtApprovedBy ? ['debt_approval', 'manual_charge', 'manual_payment_credit'] : ['manual_charge', 'manual_payment_credit'],
        fieldFor: (k) => (k === 'debt_approval' ? 'debtApprovalToken' : k === 'manual_charge' ? 'manualChargeApprovalToken' : 'paymentApprovalToken'),
        messages: { manual_payment_credit: 'מחיקה או שינוי של תשלום דורשים קוד מאשר. אנא בחר מאשר והזן סיסמה:' },
      })
      : send(base));
    const res = await sendApproved(payload);
    if (res.status === 401 || res.status === 403 || res.status === 400) {
      const errData = await res.clone().json().catch(() => null);
      // השרת דחה את הת״ז (חסרה/לא תואמת) - מפסיקים לזכור אותה, ובשמירה הבאה תישאל מחדש.
      if (zeoutForRequest && /תעודת (הזהות|זהות)/.test(errData?.error || '')) verifiedZeoutRef.current = null;
      if (typeof window !== 'undefined') alert(errData?.error || 'שגיאת אימות תעודת זהות.');
      return res;
    }
    if (res.status !== 409) return res;

    const conflict = await res.json().catch(() => null);
    const baseMsg = (conflict && conflict.message) || 'ההזמנה עודכנה בשרת מאז הטעינה האחרונה של הכרטיס.';
    const overwrite = confirm(`${baseMsg}\n\nאישור = לשמור בכל זאת ולדרוס את הגרסה שבשרת.\nביטול = לטעון מחדש את הנתונים מהשרת (השינויים שלא נשמרו יאבדו).`);
    if (!overwrite) {
      await reloadOrderFromServer();
      return null;
    }
    return sendApproved({ ...payload, overwriteConflict: true });
  };

  // מציג את חלון "סיכום ההזמנה" (פריטים/משלוח, סה"כ, שולם, יתרה) לפני שמירה בפועל -
  // בדומה לשלבי סיכום/תשלום באשף הזמנה חדשה - רק כש-enable_order_edit_summary_confirm
  // מופעל (נכון להיום: נווה יעקב בלבד, ר' code-fixes-vs-settings-scope). כשהמתג כבוי
  // מחזיר proceed:true מיד, בלי לפגוע בהתנהגות הקיימת אצל שאר הגמחים. משתמש בתצוגה
  // המקדימה (preview-pricing, עכשיו כוללת גם משלוח - ר' computeDeliveryObligationPreview)
  // כדי שהסכום שמוצג יהיה מדויק - כולל תוספת שנוצרת רק בצד השרת, בדיוק החוב שהיה
  // "נעלם" בדיווח 6124472b. מחזיר גם previewObligations/previewTotal כדי שהקורא
  // (handleSave/handleExit) יוכל להשתמש בהם ישירות בבדיקת החוב שאחריו, במקום ב-state
  // הישן (totalRequired מה-closure הנוכחי לא מתעדכן רק מ-setObligations כאן).
  const confirmSaveSummaryIfNeeded = async (currentOrder, { offerPrint = false } = {}) => {
    if (!enableEditSummaryConfirm || !currentOrder?.orderId) return { proceed: true };

    let previewObligations = obligations;
    let previewTotal = totalRequired;
    try {
      const res = await fetch(`/api/orders/${currentOrder.orderId}/preview-pricing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          order: {
            eventDate: currentOrder.eventDate,
            isAbroad: currentOrder.isAbroad,
            fromDate: currentOrder.fromDate,
            toDate: currentOrder.toDate,
            isDelivery: currentOrder.isDelivery,
            deliveryCity: currentOrder.deliveryCity,
            deliveryDirection: currentOrder.deliveryDirection
          }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const manual = obligations.filter(o => o.isManual !== false && !o.isDeleted);
        const autoPreview = (data.newObligations || []).map(o => ({ ...o, isPreview: true }));
        previewObligations = [...manual, ...autoPreview];
        previewTotal = previewObligations.reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
      }
    } catch (err) {
      console.error('Failed to compute pre-save summary preview', err);
      // ממשיכים עם ה-state הקיים (פחות מדויק, אבל לא חוסמים שמירה בגלל תקלת תצוגה)
    }

    return new Promise(resolve => {
      summaryPrintAfterRef.current = false;
      setSummaryPrintAfter(false);
      summaryConfirmResolverRef.current = (confirmed) => {
        setSummaryConfirmData(null);
        // printAfter מוחזר רק כשהחלון הציע את תיבת ההדפסה (order_edit_fewer_confirmations) - אחרת undefined והשאלה הרגילה אחרי השמירה נשארת.
        resolve(confirmed ? { proceed: true, previewObligations, previewTotal, ...(offerPrint ? { printAfter: summaryPrintAfterRef.current } : {}) } : { proceed: false });
      };
      setSummaryConfirmData({
        offerPrint,
        obligations: previewObligations,
        totalRequired: previewTotal,
        totalPaid,
        // צילום של החיובים כפי שהיו בגרסה האחרונה שנשמרה בשרת - נלקח כאן (בתוך handler, לא
        // ב-render) כדי שרינדור החלון יוכל להבחין "מה היה קודם" מ-"מה נוסף עכשיו" בלי לקרוא
        // ל-savedSnapshotRef.current ישירות תוך כדי render (react-hooks/refs). לפי
        // obligationIdentityKey ולא description מלא - ר' התיעוד שם.
        savedObligationKeys: new Set(
          (savedSnapshotRef.current?.obligations || [])
            .filter(so => !so.isDeleted)
            .map(so => obligationIdentityKey(so))
        )
      });
    });
  };

  const handleSummaryConfirmDecision = (confirmed) => {
    const resolve = summaryConfirmResolverRef.current;
    summaryConfirmResolverRef.current = null;
    if (resolve) resolve(confirmed);
  };

  // קיזוז זיכוי פתוח של הלקוחה מחוב שנוצר בשמירה (דיווח 679a860b). השרת הוא הסמכות: מחשב חוב וזיכויים, שואל קוד מאשר (כמו תשלום ידני),
  // רושם זוג תשלומים אחד בטרנזקציה ומסנכרן את בקשות הזיכוי. כאן רק השאלה ורענון התשלומים והזיכויים בכרטיס (בלי לגעת בשינויים שלא נשמרו).
  // חוזר { status } כמו offerCreditOffset; כבוי/אין מה לקזז = 'none' בלי שום בקשה לשרת.
  const askCreditOffset = async (orderIdNow) => {
    if (!creditOffsetPromptEnabled || !orderIdNow) return { status: 'none' };
    return offerCreditOffset({ orderId: orderIdNow, confirm: (m) => window.customConfirm(m), sendWithApproval });
  };
  const refreshPaymentsAfterOffset = async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      const loadedPayments = data.payments || [];
      const loadedRefunds = data.refunds || [];
      setPayments(loadedPayments);
      setRefunds(loadedRefunds);
      setOrder(prev => (prev ? { ...prev, updatedAt: data.updatedAt } : prev));
      if (savedSnapshotRef.current) {
        savedSnapshotRef.current = { ...savedSnapshotRef.current, order: { ...savedSnapshotRef.current.order, updatedAt: data.updatedAt }, payments: loadedPayments, refunds: loadedRefunds };
      }
      return data;
    } catch (err) {
      console.error('Failed to refresh payments after credit offset', err);
      return null;
    }
  };

  // Save changes
  const handleSave = async (overrideOrder = null, { promptPrint = false, orderDateApproval = null } = {}) => {
    setSaving(true);
    setSaveMessage('');

    // overrideOrder חייב להיות אובייקט הזמנה אמיתי; onClick עלול להעביר לכאן את אירוע הלחיצה
    const currentOrder = (overrideOrder && overrideOrder.orderId) ? overrideOrder : order;
    if (!currentOrder) {
      setSaving(false);
      alert('שגיאה: נתוני ההזמנה לא טוענו כראוי');
      return;
    }

    // order_edit_fewer_confirmations (דיווח c43a2b84): לחיצה מפורשת על "שמור שינויים" כשאין שום שינוי שלא נשמר (למשל אחרי שפריט נוסף ונשמר בלחיצה על "אישור" בשורה שלו) -
    // לא פותחים שוב סיכום + ת"ז + שמירה בשרת. נשארת שאלה אחת: להדפיס. אין כאן שום כתיבה לשרת, ולכן אין אישור שנחלש.
    if (fewerConfirmations && promptPrint && !overrideOrder && !hasUnsavedChanges && !pendingDebtBlockRef.current && !items.some(it => !it.id && it._localId)) {
      setSaving(false);
      const noChangeMsg = 'אין שינויים חדשים לשמירה - הכול כבר נשמר. להדפיס את ההזמנה?';
      const wantsPrintNoChange = window.customConfirm ? await window.customConfirm(noChangeMsg) : window.confirm(noChangeMsg);
      if (wantsPrintNoChange) window.open(`/print/order?orderId=${currentOrder.orderId}&type=order`, '_blank', 'noopener');
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
    const hasDates = currentOrder.isAbroad ? (currentOrder.fromDate && currentOrder.toDate) : currentOrder.eventDate;

    if (activeItems.length > 0 && !hasDates) {
      setSaving(false);
      alert(currentOrder.isAbroad 
        ? 'חובה להזין תאריכי התחלה וסיום (אירוע חו"ל / תפוסה ארוכה) עבור הזמנה הכוללת פריטים.' 
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

    const summaryConfirmResult = await confirmSaveSummaryIfNeeded(currentOrder, { offerPrint: fewerConfirmations && promptPrint });
    if (!summaryConfirmResult.proceed) {
      setSaving(false);
      return;
    }
    if (summaryConfirmResult.previewObligations) {
      setObligations(summaryConfirmResult.previewObligations);
    }

    let debtApprovedBy = null;
    // CHECK DEBT AND REQUIRE APPROVAL TO SAVE - but only when this save actually creates or
    // changes the debt. An order that was already unpaid before the card was opened, with no
    // edit touching the amount owed, shouldn't nag for manager approval just because it's
    // being saved (e.g. saving an unrelated notes/date change). Compare against the balance
    // captured when the card was loaded (openedDebt) rather than always checking "is there
    // any debt at all" - that comparison never distinguished pre-existing debt from new debt.
    // summaryConfirmResult.previewTotal, when present, is the just-fetched accurate preview
    // (includes delivery) - more reliable than the possibly-stale totalRequired from this
    // render's closure, which setObligations above can't update mid-execution.
    const currentDebt = (summaryConfirmResult.previewTotal !== undefined ? summaryConfirmResult.previewTotal : totalRequired) - totalPaid;
    const debtUnchangedSinceOpen = openedDebt !== null
      && Math.round(currentDebt * 100) === Math.round(openedDebt * 100);
    // כש-enableEditSummaryConfirm פעיל (נווה יעקב), העובד כבר ראה את חלונית "סיכום ההזמנה
    // לפני שמירה" עם היתרה המדויקת ואישר אותה מפורשות (confirmSaveSummaryIfNeeded למעלה) -
    // כולל את המשפט "לאחר האישור תישמר ההזמנה ותועבר אוטומטית לטאב תשלומים להשלמת הגבייה".
    // דרישת קוד מנהל כאן שוב, מיד אחרי אותו אישור, הייתה סותרת את ההבטחה הזו: העובד מתכוון
    // לשלם מיד ולא לדלג על התשלום, אבל הפרומפט המוצג לו ("מאשר הזמנה ללא תשלום") אומר בדיוק
    // ההפך - זה מה שדווח כ"אחרי אישור ותשלום עובר לאישור מנהל ליציאה בלי תשלום, במקום לעבור
    // לתשלום". הגנת "לא לעזוב עם חוב לא משולם" עדיין קיימת - היא רק עוברת אחריות ל-handleExit
    // (ולבדיקת newDebtCreatedBySave למטה, שמעבירה לטאב תשלומים אחרי השמירה).
    if (currentDebt > 0 && !debtUnchangedSinceOpen && !enableEditSummaryConfirm) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. שמירת השינויים דורשת הרשאת מנהל. אנא בחר מנהל והזן סיסמה:", 'מאשר הזמנה ללא תשלום');
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
          // רמת "מאשר הזמנה ללא תשלום" (במקום 'עובד', שלא בדק הרשאה): השרת בודק את אותה הרשאה ב-PUT ממילא - ומחזיר approvalToken מקושר להזמנה
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: DEBT_APPROVAL_LEVEL, orderId: currentOrder.orderId })
        });
        const data = await res.json();
        if (!data.success) {
          setSaving(false);
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
        stashApprovalToken(DEBT_APPROVAL_LEVEL, currentOrder.orderId, data.approvalToken);
        debtApprovedBy = authResult.employeeId;
        setDebtApproved(authResult.employeeId);
      } catch (err) {
        setSaving(false);
        alert('שגיאה באימות קוד עובד/מנהל.');
        return;
      }
    }

    // require_manager_code_for_item_changes - ביטול פריט קיים (isDeleted הופך ל-true) דורש
    // גם אישור מנהל אמיתי, בנוסף לת״ז (requestZeout, נשאל בתוך putOrder). ביטול פריט לא
    // נשמר מיד בלחיצת המחיקה בטאב הפריטים - הוא ממתין לשמירת ההזמנה הכללית כאן, בדיוק כמו
    // אישור החוב למעלה. הוספת פריט חדש נבדקת בנפרד ומיידית ב-ModernItemsManager.js.
    let managerAuthForItemChange = null;
    const cancelledItemNow = requireManagerCodeForItems && (savedSnapshotRef.current?.items || []).some(before => {
      if (!before.id || before.isDeleted) return false;
      const after = items.find(i => i.id === before.id);
      return after && after.isDeleted;
    });
    if (cancelledItemNow) {
      const authResult = await window.customAuthPrompt('ביטול פריט מהזמנה קיימת דורש גם אישור מנהל (בנוסף לאימות ת״ז). אנא בחר מנהל והזן סיסמה:', 'feature:item_change_approval');
      if (!authResult || !authResult.pin) {
        setSaving(false);
        setSaveMessage('השמירה בוטלה: ביטול פריט דורש אישור מנהל.');
        return;
      }
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:item_change_approval' })
        });
        const data = await res.json();
        if (!data.success) {
          setSaving(false);
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
        managerAuthForItemChange = { employeeId: authResult.employeeId, pin: authResult.pin };
      } catch (err) {
        setSaving(false);
        alert('שגיאה באימות קוד מנהל.');
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
          fromDate: currentOrder.fromDate,
          toDate: currentOrder.toDate,
          customSpacing: currentOrder.customSpacing !== undefined ? currentOrder.customSpacing : null,
          notes: currentOrder.notes,
          internalNotes: currentOrder.internalNotes,
          // כרטיס משלוח (ModernGeneralDetails, מותנה ב-enable_deliveries) - השדות עצמם כבר
          // נתמכים ב-PUT מזמן ראשון (route.js:585-589 + applyDeliveryCharge), רק לא היו
          // מגיעים לכאן כי הפיילוד הזה מפורש שדה-שדה ולא spread של כל האובייקט.
          isDelivery: currentOrder.isDelivery,
          deliveryDirection: currentOrder.deliveryDirection,
          deliveryAddress: currentOrder.deliveryAddress,
          deliveryCity: currentOrder.deliveryCity,
          deliveryOneDayBefore: currentOrder.deliveryOneDayBefore,
          status: currentOrder.status,
          hasSignedRegulations: currentOrder.hasSignedRegulations,
          updatedAt: currentOrder.updatedAt,
          managerEmployeeId: managerAuthForItemChange?.employeeId,
          managerPin: managerAuthForItemChange?.pin,
          // אישור feature:order_date_edit_approval שכבר עבר ב-requestOrderDateEdit (בטאב
          // "פרטים כלליים" או "מידע") - נבדק שוב בשרת מול orderDate הישן (ר' PUT route).
          orderDateApproverId: orderDateApproval?.employeeId,
          orderDateApproverPin: orderDateApproval?.pin,
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

      // זיכוי אוטומטי (syncPendingCreditRefund בצד השרת, למשל אחרי ביטול פריט שיצר יתרת
      // זכות) בלי פרטי בנק - פותחים מיד את חלון פרטי הבנק במקום להשאיר את זה לגילוי מאוחר
      // יותר בטאב זיכויים (דיווח c22b7de5: "אין לי מקום להזין פרטי בנק במיידי, צריך לפתוח
      // מייד עם ביטול השמלה"). לא רלוונטי ב-handleExit - שם ממילא עוזבים את הכרטיס.
      const newAutoRefundNeedsBank = (updatedOrder.refunds || []).some(r =>
        !r.isDeleted && !r.isExecuted && r.isAutoGenerated && (!r.bankName?.trim() || !r.bankBranch?.trim())
      );
      if (newAutoRefundNeedsBank) {
        setActiveTab('payments');
        setTimeout(() => paymentsManagerRef.current?.openPendingAutoRefundBankModal(), 60);
      }

      // הוספת פריט/משלוח (או כל שינוי אחר) להזמנה קיימת עלולה ליצור חיוב חדש שצריך
      // לגבות - במקום להשאיר את זה לגילוי ידני (דיווח 68912d76: "איפה היא משלמת
      // עליו?", ודיווח 6124472b: הוספת משלוח לא נתנה שום דרך ברורה לשלם עליו),
      // עוברים אוטומטית לטאב תשלומים בכל פעם שהשמירה הזו יצרה/הגדילה בפועל את יתרת
      // החוב מעבר למה שהייתה כשהכרטיס נפתח (openedDebt) - לא רק כשנוסף פריט מהטאב
      // "פריטים". חיוב משלוח, למשל, נוצר רק בצד השרת בתוך ה-PUT (applyDeliveryCharge)
      // ולכן ה-state המקומי (totalRequired/totalPaid) לא ידע עליו לפני זה - מחושב
      // מהתשובה הטרייה מהשרת (לא מה-state הישן) כדי שיהיה מדויק מיד אחרי השמירה.
      const freshRequired = (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
      const freshPaid = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      let freshDebtNow = Math.round((freshRequired - freshPaid) * 100) / 100;
      const openedDebtRounded = openedDebt !== null ? Math.round(openedDebt * 100) / 100 : 0;
      // קיזוז זיכוי פתוח (מאחורי customer_credit_offset_prompt): נשאל רק כשהשמירה הזו יצרה חוב חדש. אחרי קיזוז החוב מחושב מחדש מהשרת.
      let creditOffsetApplied = 0;
      if (creditOffsetPromptEnabled && freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01) {
        const offset = await askCreditOffset(updatedOrder.orderId);
        if (offset.status === 'applied') {
          creditOffsetApplied = offset.amount || 0;
          const refreshed = await refreshPaymentsAfterOffset();
          if (refreshed) {
            const paidAfter = (refreshed.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
            freshDebtNow = Math.round((freshRequired - paidAfter) * 100) / 100;
          }
        }
      }
      const newDebtCreatedBySave = freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01;
      // בנווה יעקב (enableEditSummaryConfirm), כשהשמירה הזו יצרה חוב, חלונית "השלמת תשלום"
      // (paymentContinueAmount, במרכז המסך - ר' הרינדור למטה) היא ההודעה הבאה שהעובד רואה -
      // במקום להסתפק בהודעת "נשמר" גנרית שמתחרה איתה על תשומת הלב, ר' דיווח: "יקפוץ באמצע
      // מיד אחרי חלונית אישור השינויים, עוד לפני ההודעה שההזמנה נשמרה". לכן מדלגים כאן על
      // showSaveSuccessOverlay/saveMessage הרגילים - חלונית התשלום עצמה כבר מתקשרת "נשמר,
      // הנה מה שנשאר לעשות" בלי צורך בהודעת הצלחה נפרדת שרק מסיטה את הפוקוס ממנה.
      const showsPaymentContinuePrompt = newDebtCreatedBySave && enableEditSummaryConfirm;
      if (newDebtCreatedBySave) {
        setDeferredDebtPrompt(false); // החלון כבר נפתח כאן (או שהשמירה מעבירה לתשלומים) - לא לפתוח אותו שוב בהחלפת לשונית
        setActiveTab('payments');
        if (showsPaymentContinuePrompt) setPaymentContinueAmount(freshDebtNow);
      }

      if (!showsPaymentContinuePrompt) {
        const offsetNote = creditOffsetApplied > 0 ? ` קוזזו ₪${creditOffsetApplied.toLocaleString('he-IL')} מזיכוי פתוח של הלקוחה.` : '';
        setSaveMessage(newDebtCreatedBySave
          ? `השינויים נשמרו בהצלחה!${offsetNote} נוצר חיוב חדש של ₪${freshDebtNow.toLocaleString('he-IL')} - עברת אוטומטית לטאב תשלומים להשלמת הגבייה.`
          : `השינויים נשמרו בהצלחה!${offsetNote}`);
        setTimeout(() => setSaveMessage(''), newDebtCreatedBySave ? 7000 : 3000);
        setShowSaveSuccessOverlay(true);
        setTimeout(() => setShowSaveSuccessOverlay(false), 5000);
      }

      // דיווח 13eaff88 (נווה יעקב): לאחר שמירת שינוי בהזמנה קיימת (לחיצה מפורשת על
      // "שמור שינויים", לא שמירות פנימיות כמו עדכון תאריך מתוך ModernInfoTab) לתת
      // אפשרות מפורשת להדפיס את הכרטיס המעודכן - במקום שהמשתמשת תצטרך לזכור
      // ללחוץ בעצמה על תפריט ההדפסה (OrderPrintMenu.js) בכרטיס שנשאר פתוח.
      if (promptPrint) {
        // הבחירה כבר נעשתה בחלון הסיכום (order_edit_fewer_confirmations) - לא שואלים שוב.
        const wantsPrint = summaryConfirmResult.printAfter !== undefined
          ? summaryConfirmResult.printAfter
          : window.customConfirm
            ? await window.customConfirm('השינויים נשמרו בהצלחה! להדפיס את ההזמנה המעודכנת?')
            : window.confirm('השינויים נשמרו בהצלחה! להדפיס את ההזמנה המעודכנת?');
        if (wantsPrint) {
          // noopener - לשונית ההדפסה לא מחוברת ללשונית הכרטיס (בדפדפני Chromium לשונית פתוחה עם opener חולקת תהליך
          // עם הלשונית שפתחה אותה, ו-window.print() בה חוסם גם את הכרטיס - דיווח 2c827b93)
          window.open(`/print/order?orderId=${updatedOrder.orderId}&type=order`, '_blank', 'noopener');
        }
      }
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
    // Every caller of onOrderUpdated (item confirm, refund create/approve, pricing
    // recalc) has already round-tripped the change to the server before calling this -
    // it's a sync of local state to server truth, not a local edit. Unconditionally
    // marking hasUnsavedChanges=true here made the exit-guard nag about "unsaved
    // changes" right after an action that was already saved. Only a still-pending,
    // never-confirmed new item row (no server id yet) is a genuine unsaved change.
    const mergedItems = mergePendingItems(updatedOrder.items || [], items, savedLocalId ? [savedLocalId] : []);
    const stillPending = mergedItems.some(it => !it.id && it._localId);
    setOrder(updatedOrder);
    setItems(mergedItems);
    setObligations(updatedOrder.obligations || []);
    setPayments(updatedOrder.payments || []);
    setRefunds(updatedOrder.refunds || []);
    setHasUnsavedChanges(stillPending);
    if (!stillPending) {
      savedSnapshotRef.current = { order: updatedOrder, items: mergedItems, obligations: updatedOrder.obligations || [], payments: updatedOrder.payments || [], refunds: updatedOrder.refunds || [] };
    }

    // כל קורא ל-onOrderUpdated כבר סבב לשרת בפועל (ר' ההערה למעלה) - כולל הוספת פריט מטאב
    // הפריטים, שיוצרת PaymentObligation חדש שם ישירות בלי לעבור דרך handleSave בכלל. בלי
    // הבדיקה הזו, הוספת פריט כזו (בנווה יעקב) הייתה משאירה חוב חדש בלי שום נוכחות ברורה -
    // בדיוק אותו דיווח שכבר טופל עבור שמירה/יציאה (paymentContinueAmount, ר' handleSave).
    if (enableEditSummaryConfirm) {
      const freshRequired = (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + (parseFloat(o.amount) || 0), 0);
      const freshPaid = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
      const freshDebtNow = Math.round((freshRequired - freshPaid) * 100) / 100;
      const openedDebtRounded = openedDebt !== null ? Math.round(openedDebt * 100) / 100 : 0;
      if (freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01) {
        if (deferPaymentPrompt) {
          // order_card_defer_payment_prompt: לא קופצים לתשלומים באמצע הוספת פריטים - החלון נפתח כשעוברים לשונית/יוצאים (handleTabChange/handleExit), וההודעה בטאב הפריטים מזכירה.
          setDeferredDebtPrompt(true);
        } else {
          setActiveTab('payments');
          setPaymentContinueAmount(freshDebtNow);
        }
      }
    }
  };

  // order_card_defer_payment_prompt: מעבר לשונית. כשיש חיוב חדש שממתין והעובדת עוברת ללשונית אחרת מהפריטים - נפתחת חלונית "השלמת תשלום" (אלא אם עברה בעצמה לתשלומים).
  const handleTabChange = (tab) => {
    if (deferredDebtPrompt && tab !== 'items') {
      setDeferredDebtPrompt(false);
      const debtNow = Math.round((totalRequired - totalPaid) * 100) / 100;
      if (tab !== 'payments' && debtNow > 0) setPaymentContinueAmount(debtNow);
    }
    setActiveTab(tab);
  };
  const openDeferredPayment = () => {
    setDeferredDebtPrompt(false);
    setActiveTab('payments');
    const debtNow = Math.round((totalRequired - totalPaid) * 100) / 100;
    if (debtNow > 0) setPaymentContinueAmount(debtNow);
  };

  // עדכון "טלאי" חלקי של ההזמנה מ-OrderPrintMenu (ר' components/orders/OrderPrintMenu.js) —
  // הקומפוננטה המשותפת קוראת ל-PUT קטן משלה (למשל אישור חתימה על תקנון) ומחזירה רק את השדות
  // שהשתנו, לא הזמנה מלאה כמו handleOrderUpdate.
  const handlePrintMenuOrderUpdate = (patch) => {
    setOrder(prev => (prev ? { ...prev, ...patch } : prev));
  };

  if (loading) {
    return (
      <div className="page-loading">
        <span className="spinner lg" />
        טוען נתוני הזמנה...
      </div>
    );
  }

  if (!order) {
    return (
      <div className="empty-state">
        <svg className="icon"><use href="#i-alert-circle" /></svg>
        <h4>הזמנה לא נמצאה</h4>
      </div>
    );
  }

  const totalPayable = items.filter(i => !i.isDeleted).reduce((sum, item) => sum + (parseFloat(item.finalPrice) || parseFloat(item.price) || 0), 0);


  const createdDate = order.orderDate || order.createdAt;

  const handleExit = async (destinationHref) => {
    // order_card_defer_payment_prompt: חיוב חדש שחלון התשלום שלו עוד לא נפתח - פותחים אותו עכשיו ונשארים בכרטיס (פעם אחת; יציאה נוספת ממשיכה כרגיל).
    if (deferredDebtPrompt) {
      setDeferredDebtPrompt(false);
      const debtOnExit = Math.round((totalRequired - totalPaid) * 100) / 100;
      if (debtOnExit > 0) {
        setActiveTab('payments');
        setPaymentContinueAmount(debtOnExit);
        return;
      }
    }
    // מסך יעד כשלא צוין destinationHref מפורש (כפתור "חזור" הרגיל) - מותנה ב-
    // order_edit_redirect_screen, ברירת מחדל "orders_list" = ההתנהגות הקודמת.
    const fallbackExitHref = resolveOrderRedirectHref(orderEditRedirectScreen, {
      orderId: order.orderId,
      customerId: order.customerId,
    });
    // צפייה בלבד — אין שום שינוי לשמור, ולכן יוצאים מיד בלי PUT לשרת (שמריץ חישוב
    // תמחור מלא, כותב ל-AuditLog ומקפיץ updatedAt על כל יציאה). בקרת החוב ביציאה
    // רלוונטית רק כשנוצר/השתנה חוב בכרטיס הזה, וזה תמיד עובר דרך שמירה (handleSave
    // כבר דורש שם אישור מנהל כשהחוב השתנה מאז הפתיחה) או דרך מסלול השמירה שלמטה.
    if (!hasUnsavedChanges && !pendingDebtBlockRef.current) {
      if (destinationHref) {
        router.push(destinationHref);
      } else {
        // כפתור "חזור" מוצהר כ"חזרה לרשימת ההזמנות" (ר' title ב-ModernOrderCard) - יעד
        // קבוע, לא היסטוריית דפדפן. router.back() היה שקט לגמרי (בלי שום ניווט) כשהכרטיס
        // נפתח בלי היסטוריית ניווט קודמת בטאב (קישור ישיר/רענון) - שני דיווחי משתמש
        // "כפתור חזור לא מגיב" (2026-09-09).
        router.push(fallbackExitHref);
      }
      return;
    }
    // pendingDebtBlockRef=true אומר שהשמירה כבר קרתה בפועל בניסיון היציאה הקודם (רק
    // נחסמה יציאה בגלל חוב חדש שטרם טופל) - אין כאן שום "שינוי לא שמור" אמיתי להציע
    // עליו "בטל" (בחירה כזו הייתה עוקפת את בדיקת אישור המנהל שלמטה בלי שום סיבה טובה),
    // אז מדלגים ישר לבדיקת החוב במקום לשאול שוב אם לשמור.
    if (hasUnsavedChanges && !pendingDebtBlockRef.current) {
      const choice = await window.customThreeWayConfirm(
        'ישנם שינויים שלא נשמרו בהזמנה! האם ברצונך לשמור אותם לפני היציאה?',
        'שינויים לא נשמרו'
      );
      if (choice === 'cancel' || !choice) return;
      if (choice === 'discard') {
        if (destinationHref) {
          router.push(destinationHref);
        } else {
          router.push(fallbackExitHref);
        }
        return;
      }
    }
    const exitSummaryConfirmResult = await confirmSaveSummaryIfNeeded(order);
    if (!exitSummaryConfirmResult.proceed) return;
    if (exitSummaryConfirmResult.previewObligations) {
      setObligations(exitSummaryConfirmResult.previewObligations);
    }

    let exitDebtApprovedBy = typeof debtApproved === 'string' ? debtApproved : null;
    // דיווח לקוח (הגמח הראשי): יציאה מהכרטיס דרשה אישור מנהל גם כשהחוב היה קיים מראש ולא
    // השתנה בעריכה הזו (למשל שינוי הערה בלבד) - בניגוד לכפתור "שמירה" למעלה, שכבר מדלג על
    // האישור במקרה הזה (debtUnchangedSinceOpen). ליישר את שני המסלולים לאותה התנהגות.
    // exitSummaryConfirmResult.previewTotal, כשקיים, הוא התצוגה המקדימה המדויקת שזה עתה
    // התקבלה (כולל משלוח) - ר' אותה הערה ב-handleSave.
    const exitCurrentDebt = (exitSummaryConfirmResult.previewTotal !== undefined ? exitSummaryConfirmResult.previewTotal : totalRequired) - totalPaid;
    const exitDebtUnchangedSinceOpen = openedDebt !== null
      && Math.round(exitCurrentDebt * 100) === Math.round(openedDebt * 100);
    if (exitCurrentDebt > 0 && !exitDebtUnchangedSinceOpen && !exitDebtApprovedBy) {
      const authResult = await window.customAuthPrompt("נותרת יתרת חוב לתשלום. יציאה דורשת הרשאת מנהל. אנא בחר מנהל והזן סיסמה:", 'מאשר הזמנה ללא תשלום');
      if (!authResult || !authResult.pin) {
        return;
      }
      try {
        const res = await fetch('/api/auth/verify-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: DEBT_APPROVAL_LEVEL, orderId: order.orderId })
        });
        const data = await res.json();
        if (!data.success) {
          alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
          return;
        }
        stashApprovalToken(DEBT_APPROVAL_LEVEL, order.orderId, data.approvalToken);
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
          fromDate: order.fromDate,
          toDate: order.toDate,
          customSpacing: order.customSpacing !== undefined ? order.customSpacing : null,
          notes: order.notes,
          internalNotes: order.internalNotes,
          isDelivery: order.isDelivery,
          deliveryDirection: order.deliveryDirection,
          deliveryAddress: order.deliveryAddress,
          deliveryCity: order.deliveryCity,
          deliveryOneDayBefore: order.deliveryOneDayBefore,
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

      try {
        let updatedOrder = await res.clone().json();
        let freshPaid = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
        const freshRequired = (updatedOrder.totalAmount && updatedOrder.totalAmount > 0)
          ? updatedOrder.totalAmount
          : (updatedOrder.obligations || []).filter(o => !o.isDeleted).reduce((sum, o) => sum + o.amount, 0);
        let freshDebtNow = Math.round((freshRequired - freshPaid) * 100) / 100;
        const openedDebtRounded = openedDebt !== null ? Math.round(openedDebt * 100) / 100 : 0;

        // קיזוז זיכוי פתוח (מאחורי customer_credit_offset_prompt) - אותה שאלה כמו ב-handleSave, לפני שבודקים אם נשאר חוב שחוסם יציאה.
        // אחרי קיזוז התשלומים והזיכויים בנתונים הטריים מתעדכנים מהשרת, כך שהבדיקות שמתחת מתייחסות למצב האמיתי.
        if (creditOffsetPromptEnabled && freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01) {
          const offset = await askCreditOffset(updatedOrder.orderId);
          if (offset.status === 'applied') {
            const refreshed = await refreshPaymentsAfterOffset();
            if (refreshed) {
              updatedOrder = { ...updatedOrder, payments: refreshed.payments || [], refunds: refreshed.refunds || [] };
              freshPaid = (updatedOrder.payments || []).filter(p => !p.isDeleted).reduce((sum, p) => sum + p.amount, 0);
              freshDebtNow = Math.round((freshRequired - freshPaid) * 100) / 100;
            }
          }
        }

        // דיווח נווה יעקב (6124472b): הוספת משלוח לא עדכנה את ה-state המקומי (חיוב
        // המשלוח נוצר רק בצד השרת, בתוך ה-PUT שזה עתה הצליח - ר' applyDeliveryCharge),
        // כך שבדיקת החוב שלמעלה (exitCurrentDebt, על בסיס state ישן) לא תפסה את החוב
        // החדש, וזה איפשר לצאת מהכרטיס בלי לשלם ובלי שום התראה. בודקים שוב מול הנתונים
        // העדכניים שחזרו זה עתה מהשרת (המקור היחיד המהימן למשלוח) לפני שבאמת עוזבים -
        // אם נוצר חוב חדש שעדיין לא אושר, לא יוצאים: מסנכרנים את ה-state לנתונים
        // הטריים ונשארים בטאב תשלומים. pendingDebtBlockRef מבטיח שניסיון יציאה נוסף לא
        // ינצל את "אין שינויים שלא נשמרו" כדי לעקוף את בדיקת החוב הרגילה בפעם הבאה.
        if (freshDebtNow > 0 && freshDebtNow > openedDebtRounded + 0.01 && !exitDebtApprovedBy) {
          setOrder(updatedOrder);
          const mergedItems = mergePendingItems(updatedOrder.items || [], items, submittedLocalIds);
          setItems(mergedItems);
          setObligations(updatedOrder.obligations || []);
          setPayments(updatedOrder.payments || []);
          setRefunds(updatedOrder.refunds || []);
          savedSnapshotRef.current = { order: updatedOrder, items: mergedItems, obligations: updatedOrder.obligations || [], payments: updatedOrder.payments || [], refunds: updatedOrder.refunds || [] };
          pendingDebtBlockRef.current = true;
          setActiveTab('payments');
          // בנווה יעקב (enableEditSummaryConfirm) מציגים את חלונית "השלמת תשלום" הצפה
          // במקום alert() רגיל - ר' paymentContinueAmount למעלה. שאר הגמחים ממשיכים לקבל
          // את ה-alert הרגיל, בלי שינוי התנהגות.
          if (enableEditSummaryConfirm) {
            setPaymentContinueAmount(freshDebtNow);
          } else {
            alert(`השינויים נשמרו, אך נוצר חיוב חדש של ₪${freshDebtNow.toLocaleString('he-IL')} (למשל בעבור משלוח או פריט שנוסף). לא ניתן לצאת מהכרטיס לפני שמשלימים את הגבייה, או יוצאים באישור מנהל - נשארת בטאב תשלומים.`);
          }
          return;
        }

        // זיכוי אוטומטי (syncPendingCreditRefund בצד השרת) בלי פרטי בנק - פותחים מיד את
        // חלון פרטי הבנק, בדיוק כמו ב-handleSave למעלה. עד עכשיו זה קרה רק ב-handleSave -
        // יציאה דרך "חזור" בלי שמירה מפורשת קודמת (זרימת עבודה סבירה מאוד: לבטל פריט
        // ומיד לצאת) פספסה את זה לגמרי, והעובד גילה את הזיכוי הממתין רק מאוחר יותר בטאב
        // זיכויים - בדיוק מה שהתכונה הזו נועדה למנוע. נפתח לכל היותר פעם אחת בניסיון
        // יציאה (bankDetailsPromptedOnExitRef): זה לא חוסם כמו בדיקת החוב למעלה - אם
        // העובד סוגר את החלון בלי פרטי בנק (למשל אין לו אותם כרגע), לא לוכדים אותו לצמיתות.
        const newAutoRefundNeedsBank = (updatedOrder.refunds || []).some(r =>
          !r.isDeleted && !r.isExecuted && r.isAutoGenerated && (!r.bankName?.trim() || !r.bankBranch?.trim())
        );
        if (newAutoRefundNeedsBank && !bankDetailsPromptedOnExitRef.current) {
          bankDetailsPromptedOnExitRef.current = true;
          setOrder(updatedOrder);
          const mergedItems = mergePendingItems(updatedOrder.items || [], items, submittedLocalIds);
          setItems(mergedItems);
          setObligations(updatedOrder.obligations || []);
          setPayments(updatedOrder.payments || []);
          setRefunds(updatedOrder.refunds || []);
          savedSnapshotRef.current = { order: updatedOrder, items: mergedItems, obligations: updatedOrder.obligations || [], payments: updatedOrder.payments || [], refunds: updatedOrder.refunds || [] };
          setActiveTab('payments');
          setTimeout(() => paymentsManagerRef.current?.openPendingAutoRefundBankModal(), 60);
          return;
        }

        // התראת מידע בלבד (לא חוסמת) - יתרת זכות סימטרית ל"יתרת חוב", אבל בלי שום דבר
        // לאשר: בקשת הזיכוי האוטומטית כבר נוצרה/עודכנה בצד השרת (syncPendingCreditRefund
        // רץ בתוך ה-PUT שזה עתה הצליח) - כאן רק מוודאים שהעובד רואה שמגיע ללקוח זיכוי.
        // (אם הגענו לכאן עם newAutoRefundNeedsBank===true זה כי כבר פתחנו את חלון הבנק
        // בניסיון יציאה קודם ולא רוצים לפתוח אותו שוב - אבל עדיין שווה להזכיר את הסכום.)
        const creditNow = Math.round((freshPaid - freshRequired) * 100) / 100;
        if (creditNow > 0) {
          alert(`שים לב: ללקוח מגיע זיכוי של ₪${creditNow.toLocaleString('he-IL')} עבור הזמנה זו.\nבקשת זיכוי ממתינה נרשמה אוטומטית בטאב "זיכויים".`);
        }
      } catch (e) {
        console.error('Failed to check debt/credit balance on exit', e);
      }

      pendingDebtBlockRef.current = false;
      if (destinationHref) {
        router.push(destinationHref);
      } else {
        router.push(fallbackExitHref);
      }
    } catch (err) {
      setSaving(false);
      alert('שגיאה בשמירה: ' + (err.message || 'נסה שוב'));
    }
  };
  handleExitRef.current = handleExit;
  handleSaveRef.current = handleSave;

  // מבטל את כל השינויים שלא נשמרו (הוספה/הסרה של פריטים, תשלומים, התחייבויות, שינויי תאריכים/הערות וכו')
  // ומחזיר את הכרטיס למצב האחרון שנשמר בשרת.
  const buildChangeSummary = () => {
    const snap = savedSnapshotRef.current;
    if (!snap) return [];
    return buildDraftSummary(snap, { order, items, obligations, payments });
  };

  // גרסה מקובצת עם איקון + כיתוב קצר לכל שינוי, לתצוגה במודל אישור "ביטול שינויים".
  const buildChangeRows = () => {
    const snap = savedSnapshotRef.current;
    if (!snap) return [];
    return buildDraftRows(snap, { order, items, obligations, payments });
  };

  // שחזור טיוטה מקומית מביקור קודם — מחזיר את כל מצב העריכה שנשמר ב-localStorage
  // ומסמן "שינויים שלא נשמרו", כאילו המשתמש מעולם לא עזב. אם ההזמנה השתנתה בשרת
  // מאז, השמירה תעבור דרך דיאלוג ההתנגשות הרגיל (putOrder / 409).
  const handleRestoreDraft = () => {
    const d = pendingDraft;
    if (!d || !d.state) return;
    setOrder(d.state.order);
    setItems(d.state.items || []);
    setObligations(d.state.obligations || []);
    setPayments(d.state.payments || []);
    setRefunds(d.state.refunds || []);
    setPendingDraft(null);
    setHasUnsavedChanges(true);
    setSaveMessage('השינויים מהביקור הקודם שוחזרו. לחץ "שמור שינויים" לשמירה, או על כפתור הביטול כדי לוותר עליהם.');
    setTimeout(() => setSaveMessage(''), 7000);
  };

  const handleDiscardDraft = async () => {
    const confirmed = window.customConfirm
      ? await window.customConfirm('למחוק את השינויים שלא נשמרו מהביקור הקודם? פעולה זו אינה הפיכה.')
      : window.confirm('למחוק את השינויים שלא נשמרו מהביקור הקודם?');
    if (!confirmed) return;
    clearOrderDraft(order.orderId);
    setPendingDraft(null);
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
        <p style={{ margin: '0 0 14px', color: 'var(--text-2)', fontSize: '0.95rem', lineHeight: 1.5 }}>
          פעולה זו תבטל את כל השינויים שלא נשמרו בהזמנה זו, ותחזיר אותה למצב האחרון שנשמר:
        </p>
        {rows.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto' }}>
            {rows.map((r, i) => (
              <span key={i} className="chip" style={{ alignSelf: 'flex-start' }}>
                <svg className="icon" style={{ width: '12px', height: '12px' }}><use href={r.icon} /></svg>
                {r.text}
              </span>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '0.92rem', color: 'var(--text-3)', fontStyle: 'italic' }}>שינויים שלא נשמרו</div>
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
    const status = calculateOrderStatus({ ...order, items }, { draftsAsDeleted });
    if (status === 'הוחזר' || status === 'הוחזר חלקי' || status === 'הושכר' || status === 'הושכר חלקי') {
      alert('לא ניתן למחוק הזמנה לאחר השכרה חלקית/מלאה או לאחר שנלקח והוחזר');
      return;
    }
    if (!(await window.customConfirm('האם אתה בטוח שברצונך למחוק הזמנה זו?'))) return;
    // 14 - אם דרוש ת״ז, בקש לפני ביטול
    // 2026-09-14 - רק כשללקוח יש בפועל ת״ז שמורה, ר' הערה ב-requestZeout
    let zeoutForDelete = null;
    if (zeoutVerificationNeeded) {
      zeoutForDelete = await requestZeout({ fresh: true });
      if (!zeoutForDelete) { alert('ביטול בוטל - לא הוזנה תעודת זהות.'); return; }
    }
    // 27 - חסימת מחיקת מושכר חלקי בצד לקוח
    if (!allowEditPartially && items.some(i => !i.isDeleted && i.isTaken)) {
      alert('לא ניתן לבטל הזמנה שהושכרה חלקית - חסום בהגדרות (allow_edit_partially_rented).');
      return;
    }

    try {
      const res = await fetch(`/api/orders/${order.orderId}`, {
        method: 'DELETE',
        headers: { ...(zeoutForDelete ? { 'x-zeout': zeoutForDelete, 'Content-Type': 'application/json' } : {}) },
        ...(zeoutForDelete ? { body: JSON.stringify({ zeout: zeoutForDelete }) } : {})
      });
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
    const authResult = await window.customAuthPrompt("הזמנה זו נעולה כי תאריך האירוע עבר. נדרש אישור מנהל לעריכה. אנא בחר מנהל והזן סיסמה:", 'feature:locked_order_edit');
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:locked_order_edit' })
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

  // שינוי סטטוס חתימה על תקנון מכפתור הטופ-בר בעיצוב המודרני (עם אישור) - PUT קטן
  // משלו (בדיוק כמו OrderPrintMenu.js/confirmSigned) ולא דרך handleSave המלא: אישור
  // שהלקוח חתם על נייר הוא לא עריכת תוכן ההזמנה, ואין סיבה שהוא יגרור בדיקות שלא
  // קשורות (בקשת ת״ז, אישור חוב, אישור מנהל לביטול פריט...) שחלות על שמירת ההזמנה הכללית.
  const handleToggleSignature = async () => {
    const nowYes = !order.hasSignedRegulations;
    const msg = nowYes ? 'האם הלקוח חתם על תקנון ההשכרה?' : 'האם לסמן שהלקוח לא חתם על התקנון?';
    const confirmed = window.customConfirm ? await window.customConfirm(msg) : window.confirm(msg);
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hasSignedRegulations: nowYes })
      });
      if (res.ok) {
        handlePrintMenuOrderUpdate({ hasSignedRegulations: nowYes });
      } else {
        alert('שגיאה בשמירת אישור החתימה');
      }
    } catch (e) {
      console.error(e);
      alert('שגיאת תקשורת בשמירת אישור החתימה');
    }
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

  // כפתור מאוחד "הוספת תשלום/זיכוי ידני" בטאב פרטים כלליים (ר' consolidateManualPaymentCredit
  // למעלה) - מחליף את שני הכפתורים הנפרדים שמוסתרים אז בטאב תשלומים. ModernPaymentsManager
  // תמיד מורכב (ר' ModernOrderCard.js - כל הטאבים מרונדרים יחד, רק tab-panel מוסתר ב-CSS),
  // כך שאפשר לקרוא לו דרך ה-ref גם כשטאב תשלומים לא פעיל כרגע - בדיוק כמו handleWalletClick
  // למעלה. ה-PIN עצמו מאומת מול feature:manual_payment_credit_add (lib/permissionsMetadata.js),
  // אותו מנגנון generic כמו כל שאר ה"מאשרים" בכרטיס (ר' cancelledItemNow ב-handleSave).
  const handleOpenManualPaymentCredit = async (type) => {
    const authResult = await window.customAuthPrompt(
      'הוספת תשלום/זיכוי ידני דורשת קוד מאשר. אנא בחר מאשר והזן סיסמה:',
      'feature:manual_payment_credit_add'
    );
    if (!authResult || !authResult.pin) return;
    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: authResult.pin, employeeId: authResult.employeeId, requiredLevel: 'feature:manual_payment_credit_add', orderId: order?.orderId })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'סיסמה שגויה או חסרת הרשאה.');
        return;
      }
      stashApprovalToken('feature:manual_payment_credit_add', order?.orderId, data.approvalToken); // נשלח עם POST /api/payments / PUT של הזיכוי / מחיקת תשלום
    } catch (err) {
      alert('שגיאה באימות קוד מאשר.');
      return;
    }
    setActiveTab('payments');
    setTimeout(() => {
      if (type === 'credit') paymentsManagerRef.current?.openRefundModal();
      else if (type === 'charge') paymentsManagerRef.current?.openAddChargeModal();
      else paymentsManagerRef.current?.openAdditionalPaymentModal();
    }, 60);
  };

  // approval = { employeeId, pin } של מאשר שהקליד סיסמה בחלון "קוד מאשר" (ModernGeneralDetails.handleQuickEmail);
  // השרת מאמת אותו מול feature:customer_email_approval. ה-ref מוגדר בראש הקומפוננט (emailApprovalRef).
  // ביטול חלון "הזנת כתובת מייל" מאפס אותו כדי שהסיסמה לא תישאר בזיכרון.
  const cancelEmailPrompt = () => {
    emailApprovalRef.current = null;
    setShowEmailPrompt(false);
  };

  const handleSendEmail = async (type, forcedEmail = null, approval = null) => {
    if (approval) emailApprovalRef.current = approval;
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
        body: JSON.stringify({
          email: targetEmail,
          type: type,
          emailApproverId: emailApprovalRef.current?.employeeId,
          emailApproverPin: emailApprovalRef.current?.pin
        })
      });
      emailApprovalRef.current = null;
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
    <>
      {/* הודעת אישור מסך-מלא לאחר שמירת הזמנה בהצלחה - נעלמת מעצמה אחרי 5 שניות */}
      {showSaveSuccessOverlay && (
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}
        >
          <div
            className="modal confirm-modal"
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', padding: '32px 48px', pointerEvents: 'none' }}
          >
            <div className="modal-icon-circle" style={{ background: 'var(--success-tint)', color: 'var(--success)', width: '56px', height: '56px' }}>
              <svg className="icon" style={{ width: '32px', height: '32px' }}><use href="#i-check-circle" /></svg>
            </div>
            <strong style={{ fontSize: '20px' }}>ההזמנה נשמרה בהצלחה!</strong>
          </div>
        </div>
      )}

      {/* חלון "סיכום ההזמנה" לפני שמירה בפועל - רק כש-enable_order_edit_summary_confirm
          מופעל (ר' confirmSaveSummaryIfNeeded). בדומה לשלבי סיכום/תשלום באשף הזמנה חדשה. */}
      {summaryConfirmData && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="modal" style={{ margin: 0, maxWidth: '520px', width: '95%' }}>
            <div className="modal-head">
              <strong>סיכום ההזמנה לפני שמירה</strong>
            </div>
            <div className="modal-body">
              {/* מציגים ישירות את רשימת החיובים (obligations) ולא את items - החיובים כבר
                  כוללים שורה לכל פריט (עם שם+מידה, ר' computeOrderObligations) בנוסף
                  לתיקונים/דמי ביטול/משלוח, ומסתכמים בדיוק לסכום למטה - הצגת items בנפרד
                  הייתה משכפלת את שורות הפריטים ומחסירה שורות אחרות (תיקון/ביטול). */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
                {(() => {
                  // savedObligationKeys (חיובים כפי שהיו בגרסה האחרונה שנשמרה בשרת, ר'
                  // confirmSaveSummaryIfNeeded/obligationIdentityKey) מאפשר להבחין "מה היה
                  // קודם" מ-"מה נוסף עכשיו" (למשל חיוב משלוח שנוצר מהתצוגה המקדימה) - בלי זה
                  // כל השורות נראות "אותו דבר" (דיווח: "לא ברור מה היה קודם ומה נוסף עכשיו").
                  const savedKeys = summaryConfirmData.savedObligationKeys || new Set();
                  return summaryConfirmData.obligations.filter(o => !o.isDeleted).map((o, idx) => {
                    // "(פריט #<uuid>)" הוא ה-id הפנימי של OrderItem, מוצמד לתיאור רק כדי
                    // להבחין בין שני פריטים זהים (שם+מידה) באותה הזמנה - לא מיועד לתצוגה
                    // (ר' כלל תצוגת ה-ID ב-AGENTS.md), בדיוק כמו ב-ModernPaymentsManager.js.
                    const cleanDesc = (o.description || 'חיוב').replace(/\s*\(פריט #[a-zA-Z0-9-]+\)/g, '');
                    const isNew = !savedKeys.has(obligationIdentityKey(o));
                    return (
                      <div key={o.id || `${o.description}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13.5px' }}>
                        <span>
                          {cleanDesc}
                          {isNew && (
                            <span style={{ marginRight: '6px', fontSize: '11px', fontWeight: 700, color: 'var(--success)', background: 'var(--success-tint)', borderRadius: '4px', padding: '1px 6px' }}>
                              נוסף עכשיו
                            </span>
                          )}
                        </span>
                        <span style={{ direction: 'ltr' }}>₪{(parseFloat(o.amount) || 0).toLocaleString('he-IL')}</span>
                      </div>
                    );
                  });
                })()}
                {summaryConfirmData.obligations.filter(o => !o.isDeleted).length === 0 && (
                  <div className="hint" style={{ color: 'var(--text-3)' }}>אין חיובים בהזמנה זו.</div>
                )}
              </div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span>סה&quot;כ לתשלום</span>
                  <span style={{ direction: 'ltr', fontWeight: 700 }}>₪{summaryConfirmData.totalRequired.toLocaleString('he-IL')}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px' }}>
                  <span>שולם עד כה</span>
                  <span style={{ direction: 'ltr' }}>₪{summaryConfirmData.totalPaid.toLocaleString('he-IL')}</span>
                </div>
                {(() => {
                  const balance = Math.round((summaryConfirmData.totalRequired - summaryConfirmData.totalPaid) * 100) / 100;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: balance > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      <span>{balance > 0 ? 'יתרה לתשלום' : 'יתרת זכות/מאוזן'}</span>
                      <span style={{ direction: 'ltr' }}>₪{Math.abs(balance).toLocaleString('he-IL')}</span>
                    </div>
                  );
                })()}
                {(summaryConfirmData.totalRequired - summaryConfirmData.totalPaid) > 0.01 && (
                  <div className="hint" style={{ color: 'var(--text-3)', marginTop: '4px' }}>
                    לאחר האישור תישמר ההזמנה ותועבר אוטומטית לטאב תשלומים להשלמת הגבייה.
                  </div>
                )}
                {summaryConfirmData.offerPrint && (
                  <label className="checkbox-row" style={{ cursor: 'pointer', marginTop: '10px' }}>
                    <input
                      type="checkbox"
                      checked={summaryPrintAfter}
                      onChange={(e) => { summaryPrintAfterRef.current = e.target.checked; setSummaryPrintAfter(e.target.checked); }}
                    />
                    <span>להדפיס את ההזמנה אחרי השמירה</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-foot">
              <button type="button" className="btn btn-secondary" onClick={() => handleSummaryConfirmDecision(false)}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={() => handleSummaryConfirmDecision(true)}>אישור ושמירה</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* חלונית "השלמת תשלום" - ר' paymentContinueAmount, מוצגת רק בנווה יעקב אחרי ששמירה/
          ניסיון יציאה יצרו חוב חדש. קופצת במרכז המסך (כמו חלונית "סיכום ההזמנה" עצמה) מיד
          אחרי שזו נסגרת ועוד לפני כל הודעת "נשמר" - ר' showsPaymentContinuePrompt ב-handleSave,
          שמדלג שם על הודעת ההצלחה הרגילה בדיוק כדי שזו תהיה ההודעה הבאה שרואים, לא מתחרה
          איתה. מציעה ישירות את פעולות התשלום הרלוונטיות במקום להשאיר לעובד לחפש אותן בטאב
          תשלומים. חסימת היציאה עצמה (כשרלוונטי) כבר קרתה קודם ב-handleExit
          (pendingDebtBlockRef/return) - זה עוד לפני שהחלונית הזו בכלל נפתחת. */}
      {paymentContinueAmount !== null && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <div className="modal" style={{ margin: 0, maxWidth: '380px', width: '95%' }}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', paddingTop: '28px' }}>
              <div className="modal-icon-circle" style={{ background: 'var(--warning-tint)', color: 'var(--warning)', width: '56px', height: '56px' }}>
                <svg className="icon" style={{ width: '32px', height: '32px' }}><use href="#i-coin" /></svg>
              </div>
              <strong style={{ fontSize: '17px' }}>השינויים נשמרו! נוצר חיוב חדש</strong>
              <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--danger)' }}>
                ₪{paymentContinueAmount.toLocaleString('he-IL')}
              </div>
              <div className="hint" style={{ color: 'var(--text-3)', textAlign: 'center' }}>יש להשלים את הגבייה</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginTop: '10px' }}>
                {nedarimPlusEnabled && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      setPaymentContinueAmount(null);
                      setActiveTab('payments');
                      setTimeout(() => paymentsManagerRef.current?.openCreditModal(), 60);
                    }}
                  >
                    <svg className="icon"><use href="#i-card" /></svg>תשלום בכרטיס אשראי
                  </button>
                )}
                {allowAdditionalPayment && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setPaymentContinueAmount(null);
                      setActiveTab('payments');
                      setTimeout(() => paymentsManagerRef.current?.openAdditionalPaymentModal(), 60);
                    }}
                  >
                    <svg className="icon"><use href="#i-coin" /></svg>תשלום נוסף (מזומן וכו&apos;)
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={() => setPaymentContinueAmount(null)}>
                  אטפל בזה בטאב תשלומים
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ההזמנה השתנתה ממקום אחר (למשל החזרת שמלה בלשונית אחרת): או שהכרטיס התעדכן לבד, או (כשיש שינויים שלא נשמרו)
          הודעה לא חוסמת עם כפתור רענון - ר' בדיקת השינוי החיצוני למעלה. */}
      {externalNotice === 'applied' && (
        <div className="callout callout-info" role="status" style={{ marginBottom: '14px' }}>
          <svg className="icon"><use href="#i-refresh" /></svg>
          <strong>הכרטיס עודכן - ההזמנה השתנתה ממקום אחר.</strong>
        </div>
      )}
      {externalNotice === 'dirty' && (
        <div className="callout callout-warning" role="status" style={{ marginBottom: '14px', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <svg className="icon"><use href="#i-alert-tri" /></svg>
          <strong>ההזמנה עודכנה ממקום אחר — רענן</strong>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleRefreshFromElsewhere}>
            <svg className="icon"><use href="#i-refresh" /></svg>
            רענן
          </button>
        </div>
      )}

      {/* באנר טיוטה מקומית: שינויים שלא נשמרו מביקור קודם בכרטיס (למשל דפדפן שנסגר).
          לא חוסם — אפשר לעיין בכרטיס לפני שמחליטים לשחזר או למחוק. */}
      {pendingDraft && (
        <div className="callout callout-warning" style={{ marginBottom: '18px', flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <svg className="icon"><use href="#i-alert-tri" /></svg>
            <strong>נמצאו שינויים שלא נשמרו מביקור קודם בכרטיס</strong>
            {pendingDraft.savedAt && (
              <span style={{ color: 'var(--text-3)', fontSize: '12px' }}>
                ({getHebrewDateString(pendingDraft.savedAt)} · {new Date(pendingDraft.savedAt).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })})
              </span>
            )}
          </div>
          {(pendingDraft.rows || []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {pendingDraft.rows.map((r, i) => (
                <span key={i} className="chip">
                  <svg className="icon" style={{ width: '12px', height: '12px' }}><use href={r.icon} /></svg>
                  {r.text}
                </span>
              ))}
            </div>
          )}
          {pendingDraft.baseUpdatedAt && order.updatedAt && pendingDraft.baseUpdatedAt !== order.updatedAt && (
            <div style={{ fontSize: '12.5px', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg className="icon" style={{ width: '13px', height: '13px' }}><use href="#i-alert-circle" /></svg>
              שים לב: ההזמנה עודכנה בשרת מאז שהשינויים האלה נערכו — שחזור ושמירה ידרשו אישור דריסה.
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={handleRestoreDraft}>
              <svg className="icon"><use href="#i-refresh" /></svg>
              שחזר את השינויים
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={handleDiscardDraft}>
              <svg className="icon"><use href="#i-trash" /></svg>
              מחק אותם
            </button>
          </div>
        </div>
      )}

      <ModernOrderCard
          order={order}
          items={items}
          draftsAsDeleted={draftsAsDeleted}
          saveInFooter={saveInFooter}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          totalRequired={totalRequired}
          totalPaid={totalPaid}
          openedDebt={openedDebt}
          saving={saving}
          saveMessage={saveMessage}
          hasUnsavedChanges={hasUnsavedChanges}
          isLocked={isLocked}
          isPastEvent={isPastEvent}
          onUnlock={handleUnlock}
          onLock={() => setIsUnlocked(false)}
          onSave={() => handleSave(null, { promptPrint: true })}
          onCancelChanges={handleCancelChanges}
          onDelete={handleDeleteOrder}
          onExit={() => handleExit()}
          onToggleSignature={handleToggleSignature}
          onOrderUpdate={handlePrintMenuOrderUpdate}
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
                onToggleSignature={handleToggleSignature}
                onQuickEmail={(approval) => handleSendEmail('order', null, approval)}
                showManualPaymentCreditButton={consolidateManualPaymentCredit}
                onOpenManualPaymentCredit={handleOpenManualPaymentCredit}
              />
            ),
            items: (
              <>
              {deferredDebtPrompt && (Math.round((totalRequired - totalPaid) * 100) / 100) > 0 && (
                <div className="callout callout-warning" role="status" style={{ marginBottom: '14px', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <svg className="icon"><use href="#i-coin" /></svg>
                  <strong>נוצר חיוב חדש: ₪{(Math.round((totalRequired - totalPaid) * 100) / 100).toLocaleString('he-IL')}</strong>
                  <span>אפשר להמשיך להוסיף פריטים. חלון התשלום ייפתח כשתעברו ללשונית אחרת או כשתצאו מההזמנה.</span>
                  <button type="button" className="btn btn-primary btn-sm" onClick={openDeferredPayment}>לתשלום עכשיו</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => itemsManagerRef.current?.addItem()}>הוספת פריט נוסף</button>
                </div>
              )}
              <ModernItemsManager
                ref={itemsManagerRef}
                locked={isLocked}
                orderId={order.orderId}
                order={order}
                items={items}
                onItemsChange={(val, opts) => {
                  // תומך גם בעדכון פונקציונלי (prev => ...) — נחוץ לפעולות שעוברות דרך await
                  // (למשל סריקת ברקוד: אישור PIN / בדיקת מלאי / דיאלוג אישור), כדי לא לדרוס
                  // שינויים אחרים בפריטים שקרו בינתיים על בסיס סנאפשוט ישן של items.
                  setItems(prev => (typeof val === 'function' ? val(prev) : val));
                  if (opts?.persisted && typeof val === 'function') {
                    // השכרה/החזרה בברקוד נשמרות בשרת מיד (/api/rentals/toggle), לא דרך "שמור
                    // שינויים". לכן זה לא "שינוי שלא נשמר": מעדכנים גם את הסנאפשוט השמור כדי
                    // שההבדל מולו לא יקפיץ אזהרת "שינויים לא נשמרו" / סיכום שינויים / בקשת ת"ז /
                    // אישור מנהל / שאלת הדפסה אחרי כל סריקה (דיווחי נווה יעקב 2026-10-04).
                    const snap = savedSnapshotRef.current;
                    if (snap && Array.isArray(snap.items)) {
                      savedSnapshotRef.current = { ...snap, items: val(snap.items) };
                    }
                    return;
                  }
                  setHasUnsavedChanges(true);
                }}
                onOrderUpdated={handleOrderUpdate}
                onItemDeleted={saveAfterItemDelete ? () => setAutoSaveAfterDelete(true) : undefined}
                inventoryCache={inventoryCache}
                totalRequired={totalRequired}
                totalPaid={totalPaid}
              />
              </>
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
                // כפתורי "הוסף חיוב משלוח" מסמנים גם את ההזמנה כמשלוח (delivery_leg_button_marks_order, כבוי כברירת מחדל) - אותו
                // עדכון כמו onOrderChange של לשונית הפרטים: שדות ההזמנה בלבד, נשמרים בשמירה הרגילה (putOrder).
                onOrderChange={(val) => {
                  setOrder(prev => (typeof val === 'function' ? val(prev) : val));
                  setHasUnsavedChanges(true);
                }}
                totalRequired={totalRequired}
                totalPaid={totalPaid}
                customer={order.customer}
                onOrderUpdated={handleOrderUpdate}
                onSignRegulations={() => handlePrintMenuOrderUpdate({ hasSignedRegulations: true })}
                isLivePreviewing={isLivePreviewing}
              />
            ),
            history: (
              <ModernInfoTab
                order={order}
                createdDate={createdDate}
                onShowEmployees={() => setShowEmployeesModal(true)}
                onOrderDateSave={(date, orderDateApproval) => {
                  const newOrder = { ...order, orderDate: date };
                  setOrder(newOrder);
                  handleSave(newOrder, { orderDateApproval });
                }}
              />
            )
          }}
        />

      <ActiveEmployeesModal
        orderId={order.orderId}
        isOpen={showEmployeesModal}
        onClose={() => setShowEmployeesModal(false)}
      />

      {/* חלון "כתובת מייל חסרה" — נפתח מ"מייל מהיר" בטאב פרטים כלליים כשללקוח אין מייל תקין.
          זהה במבנה/ברוח לחלון המקביל בתוך OrderPrintMenu.js (זרימת "מייל הזמנה/השכרה" מתפריט
          ההדפסה), רק שמופעל כאן ממסלול נפרד (handleSendEmail) שאינו עובר דרך אותו קומפוננט. */}
      {showEmailPrompt && typeof document !== 'undefined' && createPortal(
        <div
          className="modal-backdrop"
          style={{ position: 'fixed', inset: 0, zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={(e) => { if (e.target === e.currentTarget) cancelEmailPrompt(); }}
        >
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon-circle" style={{ background: 'var(--info-tint)', color: 'var(--info)' }}>
              <svg className="icon"><use href="#i-mail" /></svg>
            </div>
            <h3>כתובת מייל חסרה</h3>
            <p>
              ללקוח זה לא מעודכנת כתובת מייל במערכת. אנא הזן כתובת מייל עדכנית לשליחת הדוח (תישמר אוטומטית בכרטיס הלקוח).
            </p>
            <input
              type="email"
              className="input"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="example@gmail.com"
              dir="ltr"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEmailSubmit();
              }}
              style={{ marginBottom: '18px', textAlign: 'start' }}
            />
            <div className="confirm-actions">
              <button type="button" className="btn btn-secondary" onClick={cancelEmailPrompt}>ביטול</button>
              <button type="button" className="btn btn-primary" onClick={handleEmailSubmit}>שמור ושלח</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
