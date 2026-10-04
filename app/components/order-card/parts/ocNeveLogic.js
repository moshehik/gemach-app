// ocNeveLogic.js — לוגיקה טהורה של חלקי W2b בכרטיס ההזמנה החדש (פורט עבודת נווה יעקב, R49): בורר "הצטרפות למשלוח", באנר מיקום שמלה,
// פאנל רצף ברקודים. בלי React ובלי fetch — נבדקת ב-node מול הקוד של ענף נווה (scripts/order-card-tests/neve.*.test.mjs; האורקל
// קורא את הקבצים מ-wt-neve-batch-2026-09-25 כשהם קיימים).
//
// ===== מפת פורט (פונקציה כאן ← מקור בענף feature/neve-batch-2026-09-25) =====
// eventIsoOf            ← components/orders/DeliveryJoinPicker.js eventDateToIso (יום האירוע הישראלי כ-YYYY-MM-DD)
// joinCandidatesQuery   ← DeliveryJoinPicker.js (qs של mode=candidates: eventDate, direction, oneDayBefore, exclude)
// effectiveJoin         ← DeliveryJoinPicker.js joinedTo / effectiveMode / savedPrimary / currentPrimary
// joinPatch             ← DeliveryJoinPicker.js patchJoin / chooseCandidate / setModeAndPatch (ב-Neve: order.deliveryJoin + כתובת/עיר;
//                         בכרטיס החדש: order.deliveryJoinedTo + order.deliveryPrimaryOrderId, ר' orderCardLogic.buildPutPayload)
// candidateLabel        ← DeliveryJoinPicker.js (טקסט האפשרות ב-select)
// dressAlertLine        ← DressLocationBanner.js awayLine
// dressAlertsSeverity   ← DressLocationBanner.js critical
// sequenceEntry         ← BarcodeSequencePanel.js record (סטטוס / הודעה / undo)
// scanResultToSequence  ← ModernItemsManager.handleBarcodeScan (החזרת {status,message,undo} במקום alert חוסם; בכרטיס החדש התוצאה
//                         נגזרת מהטוסט שהשכרה/החזרה מציגות — hooks/useItemActions.js של W3)
import { getHebrewDateString, getIsraelDateKey } from '../../../../lib/hebrewDate';

/** 'YYYY-MM-DD' של יום האירוע (לפי היום הישראלי כשמגיע ISO מלא, אחרת החלק התאריכי). ריק כשאין. */
export function eventIsoOf(value) {
  if (!value) return '';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return getIsraelDateKey(value) || '';
}

export const JOIN_DIRECTIONS = ['הלוך', 'חזור', 'הלוך-חזור'];

/** פרמטרים של GET /api/deliveries/join?mode=candidates (אותו מבנה כמו בנווה). */
export function joinCandidatesQuery(order, orderId) {
  const qs = new URLSearchParams({
    mode: 'candidates',
    eventDate: eventIsoOf(order?.eventDate || order?.fromDate),
    direction: order?.deliveryDirection || 'הלוך-חזור',
    oneDayBefore: String(!!order?.deliveryOneDayBefore),
  });
  if (orderId) qs.set('exclude', String(orderId));
  return qs.toString();
}

/**
 * המצב האפקטיבי של הבורר: מה שנבחר עכשיו (order.deliveryJoinedTo; undefined = לא נגעו) מול מה ששמור בשרת (info).
 * @returns {{joinedTo:number|null, mode:'new'|'join', savedPrimary:('self'|number|null), currentPrimary:('self'|number|null), rootForGroup:number|null}}
 */
export function effectiveJoin({ order, info, group, modeState }) {
  const joinedTo = order?.deliveryJoinedTo !== undefined ? (order.deliveryJoinedTo || null) : (info?.joinedToOrderId || null);
  const mode = modeState || (joinedTo ? 'join' : 'new');
  const savedPrimary = info?.isPrimary ? 'self' : ((group || []).find(g => g.isPrimary)?.orderId ?? null);
  const picked = order?.deliveryPrimaryOrderId;
  const currentPrimary = picked !== undefined && picked !== null ? picked : savedPrimary;
  const rootForGroup = joinedTo || (info?.group?.length ? info.rootOrderId : null);
  return { joinedTo, mode, savedPrimary, currentPrimary, rootForGroup };
}

/**
 * עדכון ה-state של ההזמנה (לשימוש edit.setOrder(prev => ({...prev, ...patch}))).
 * kind: 'candidate' (בחירת משלוח; value = המועמד או null לביטול) | 'primary' (value = orderId | 'self') | 'mode-new' (חזרה ל"משלוח חדש").
 * כל עדכון קובע את שני השדות (joinedTo + primary) כדי שה-PUT לא יבטל בטעות הצטרפות קיימת כשרק ה"ראשי" משתנה.
 */
export function joinPatch(kind, value, eff) {
  if (kind === 'candidate') {
    if (!value) return { deliveryJoinedTo: null, deliveryPrimaryOrderId: eff.currentPrimary ?? null };
    return {
      deliveryJoinedTo: value.orderId,
      deliveryPrimaryOrderId: null,
      deliveryAddress: value.street || '',
      deliveryCity: value.city || '',
    };
  }
  if (kind === 'primary') return { deliveryJoinedTo: eff.joinedTo, deliveryPrimaryOrderId: value };
  if (kind === 'mode-new') return eff.joinedTo ? { deliveryJoinedTo: null, deliveryPrimaryOrderId: eff.currentPrimary ?? null } : null;
  return null;
}

export function candidateLabel(c) {
  return `#${c.orderId} · ${c.customerName} · ${c.address || '-'}${c.joinedCount ? ` · (${c.joinedCount} מצטרפים)` : ''}`;
}

// ---------------------------------------------------------------------------------------------
// באנר מיקום שמלה
// ---------------------------------------------------------------------------------------------
export function dressAlertLine(a, hebDate = getHebrewDateString) {
  if (a.kind === 'branch') return `ברקוד ${a.barcode} - נמצאת בסניף "${a.branch}" וצריכה לעבור לסניף ההזמנה`;
  const exp = a.expectedReturn ? hebDate(a.expectedReturn) : 'לא ידוע';
  const status = a.overdue ? 'עבר מועד ההחזרה - טרם הוחזרה!' : (a.backBeforeEvent ? 'צפויה לחזור לפני האירוע' : 'לא צפויה לחזור לפני האירוע');
  return `ברקוד ${a.barcode} - עדיין באירוע של הזמנה #${a.orderId} (החזרה צפויה: ${exp}) - ${status}`;
}

export const dressAlertsSeverity = (alerts) => ((alerts || []).some(a => a.severity === 'critical') ? 'critical' : 'warning');

export function dressAlertTitle(alerts) {
  return `שים לב: שמלות מההזמנה עדיין לא בבית - ${dressAlertsSeverity(alerts) === 'critical' ? 'לא צפויות להגיע בזמן ללא טיפול' : 'צריכות לעבור / להיאסף'}`;
}

/** כותרת משנה לדגם: "<דגם> · מידה N" + (הוקצתה יחידה | נדרשות X, בבית Y, חסרות Z). */
export function dressAlertHead(al) {
  const name = `${al.modelName}${al.size ? ` · מידה ${al.size}` : ''}`;
  const tail = al.assigned
    ? ' - היחידה שנבחרה להזמנה אינה זמינה:'
    : ` - נדרשות ${al.needed}, בבית זמינות ${al.homeCount} (חסרות ${al.shortage}):`;
  return { name, tail };
}

/** מפתח רענון: משתנה כשמספר הפריטים / הנלקחים משתנה או כשנכתב משהו בשרת (historyVersion). */
export function dressRefreshKey(items, historyVersion) {
  const active = (items || []).filter(i => !i.isDeleted);
  return `${active.length}-${active.filter(i => i.isTaken).length}-${historyVersion || 0}`;
}

// ---------------------------------------------------------------------------------------------
// רצף ברקודים
// ---------------------------------------------------------------------------------------------
/** רשומת היומן של הפאנל. status: 'ok' | 'info' | 'error' (כל ערך אחר = error). */
export function sequenceEntry(code, result, id) {
  const status = result?.status === 'ok' || result?.status === 'info' ? result.status : 'error';
  return {
    id,
    code,
    status,
    message: result?.message || (status === 'ok' ? 'נקלט' : 'הסריקה נכשלה'),
    undo: typeof result?.undo === 'function' ? result.undo : null,
    undone: false,
  };
}

/**
 * תוצאת actions.scan של W3 ({ok, kind:'rent'|'return', item, cancelled}) + הודעת השגיאה שנתפסה מהטוסט -> תוצאת הפאנל.
 * undo: ביטול ההשכרה / ההחזרה בלי חלון אישור (confirmed:true) - "בטל סריקה אחרונה".
 */
export function scanResultToSequence(r, { errorMessage = null, itemLabel = (i) => (i && (i.description || '')) || '', cancelRent, cancelReturn } = {}) {
  if (r && r.ok) {
    const label = itemLabel(r.item);
    if (r.kind === 'return') return { status: 'ok', message: `הוחזרה: ${label}`.trim(), undo: () => cancelReturn(r.item) };
    return { status: 'ok', message: `נלקחה: ${label}`.trim(), undo: () => cancelRent(r.item) };
  }
  if (r && r.cancelled) return { status: 'info', message: 'הסריקה בוטלה' };
  return { status: 'error', message: errorMessage || 'הסריקה נכשלה' };
}

/** ניקוי ברקוד מהסורק: בלי רווחים (כמו בנווה). */
export const cleanBarcode = (v) => String(v || '').replace(/\s+/g, '');

export const SEQUENCE_MUTE_KEY = 'barcodeSequenceMuted';
