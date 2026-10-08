'use client';

// usePaymentActions — פעולות הכסף של כרטיס ההזמנה החדש (W4): פורט של ModernPaymentsManager (MPM) הישן. בלי JSX: הקובץ נטען גם ב-node
// (scripts/order-card-tests/payments.*.test.mjs) כדי להשוות כל endpoint וכל גוף בקשה לקוד המקור החי של הישן.
//
// ===== מפת פורט (פונקציה כאן ← components/orders/modern/ModernPaymentsManager.js) =====
// creditWindowMinutes ← :766-771 ; cancellationCreditInfo ← :773-786 ; obligationIconName ← getObligationIcon :68-77 (#i-* → #gmi-*)
// obligationLabel ← :892 ; additionalPaymentMethodOptions ← :730-736 ; lastPaymentDetails/customerEmailOf/refundPrefill ← handleOpenRefundModal :184-228
// autoRefundBankPrefill ← openAutoRefundBankModal :442-451 ; parseSwipe ← handleSwipeInputChange :362-394 ; cardNumberInput ← handleCardNumberChange :544-577
// tokefInput ← handleTokefChange :579-584 ; parsePaymentNotes ← :1273-1292
// actions.chargeCard ← handleProcessCreditCard :586-689 (POST /api/nedarim → POST /api/payments; כשל שמירה → שורה מקומית isNew + אזהרה)
// actions.bypassCard ← handleBypassCreditPayment :503-542 (verifyPin 'מתכנת' → oc.approve('מתכנת'), שורה מקומית isNew)
// actions.addManualPayment ← submitAdditionalPayment :273-301 (POST /api/payments)
// actions.createRefund ← submitRefund :230-261 (POST /api/refunds → GET /api/orders/{orderId} → applyServerOrder)
// actions.saveRefundBank ← submitAutoRefundBank :453-476 (PUT /api/refunds/{id})
// actions.executeRefund ← approveRefund :303-326 (PUT /api/refunds/{id} {isExecuted:true} → GET → applyServerOrder)
// actions.recalc ← handleRecalculate :330-353 (POST /api/admin/recalculations → GET → applyServerOrder)
// actions.deletePayment ← removePayment :176-182 ; actions.addManualCharge ← addObligation :154-166 ; actions.deleteManualCharge ← removeObligation :168-174
// actions.signRegulations ← confirmSignedThenOpenCredit :416-436 (→ oc.toggleSignature, PUT קטן של W1)
// הודעות window.alert/customConfirm של הישן → ui.* / שגיאה בתוך החלון; אישורים → oc.approve (חלון D12 של W1).
//
// סכומים: תמיד parseFloat + money2 (עיגול לאגורות) — לעולם לא שרשור מחרוזות.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { fetchSharedJson, TTL } from '@/lib/apiCache';
import { fmtMoney, obligationIdentityKey, unsavedCardChargeMessage } from '../orderCardLogic';
import { formatIban } from '@/lib/iban';

// ---------------------------------------------------------------------------------------------
// עזרי כסף ותצוגה (טהורים)
// ---------------------------------------------------------------------------------------------
/** עיגול לאגורות - אותו עיגול כמו round2 של orderCardLogic (totals), על parseFloat. */
export const money2 = (n) => Math.round((parseFloat(n) || 0) * 100) / 100;
export const amountOf = (x) => parseFloat(x) || 0;
/** תשלומים בכרטיס אשראי: 1-36 (ברירת מחדל 1). */
export const clampInstallments = (v) => Math.min(36, Math.max(1, parseInt(v, 10) || 1));
/** שורה שנוצרה במעקף מתכנת (בלי חיוב אשראי בפועל) - היחידה בלי id שמותר למחוק מקומית. */
export const isBypassRow = (p) => !!p && !p.id && String(p.paymentMethod || '').includes('מעקף');
/** הערת IBAN להוספה לשדה הסיבה של זיכוי (פירוק ה-IBAN מוריד אפסים מובילים - המקור נשמר בטקסט). */
export const ibanNote = (iban) => (iban ? `IBAN: ${formatIban(iban)}` : '');
export const withIbanNote = (reason, iban) => {
  const note = ibanNote(iban);
  if (!note) return reason;
  const base = String(reason || '').trim();
  return base && base.includes(note) ? base : (base ? `${base} | ${note}` : note);
};
export const ITEM_SUFFIX_RE = /\s*\(פריט #[a-zA-Z0-9-]+\)/g;

/** :766-771 - הגדרה חסרה = 15 דקות; קיימת אבל 0/ריקה/שלילית/לא מספר = כבוי (null). עד שההגדרות נטענו - null. */
export function creditWindowMinutes(settings, settingsReady = true) {
  if (!settingsReady || !settings) return null;
  const raw = typeof settings.get === 'function' ? settings.get('CANCELLATION_CREDIT_MINUTES', undefined) : settings.CANCELLATION_CREDIT_MINUTES;
  const minutes = raw === undefined || raw === null ? 15 : parseFloat(raw);
  return Number.isFinite(minutes) && minutes > 0 ? minutes : null;
}

/** :773-786 - הסכום שעדיין ניתן לנצל כזיכוי על פריט חלופי ועד מתי (R39), או null. */
export function cancellationCreditInfo(obs, { obligations = [], items = [], minutes = null } = {}) {
  if (!obs || !obs.orderItemId || !(obs.description || '').startsWith('דמי ביטול')) return null;
  const active = obligations.filter(o => !o.isDeleted);
  const consumed = active
    .filter(o => o.orderItemId === obs.orderItemId && (o.description || '').startsWith('זיכוי דמי ביטול'))
    .reduce((sum, o) => sum + Math.abs(amountOf(o.amount)), 0);
  const remaining = money2(amountOf(obs.amount) - consumed);
  if (remaining <= 0) return null;
  const sourceItem = items.find(i => i.id === obs.orderItemId);
  if (!sourceItem || !sourceItem.deletedAt) return null;
  if (minutes === null) return null;
  const deadline = new Date(sourceItem.deletedAt).getTime() + minutes * 60000;
  return { deadline, remaining };
}

/** mm:ss עד ה-deadline, או null כשפג (useCountdown :10-23). urgent = דקה אחרונה. */
export function countdownText(deadline, now = Date.now()) {
  const remainingMs = deadline - now;
  if (!(remainingMs > 0)) return null;
  const totalSec = Math.floor(remainingMs / 1000);
  return { text: `${String(Math.floor(totalSec / 60)).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`, urgent: remainingMs <= 60000 };
}

// getObligationIcon של הישן (#i-*) → שמות ה-sprite של הפלטה (#gmi-*). הסדר זהה לישן; "משלוח" (מהעיצוב) לפני ברירת המחדל.
export const LEGACY_OBLIGATION_ICON_MAP = Object.freeze({ 'i-x-circle': 'x', 'i-coin': 'cash', 'i-refresh': 'refresh', 'i-file': 'file', 'i-scissors': 'scissors', 'i-edit': 'pencil', 'i-bag': 'dress' });
export function obligationIconName(obs) {
  const desc = (obs && obs.description) || '';
  if (desc.startsWith('דמי ביטול')) return 'x';
  if (desc.startsWith('זיכוי דמי ביטול')) return 'cash';
  if (desc.startsWith('זיכוי בגין ביטול')) return 'refresh';
  if (desc.startsWith('חיוב מקורי')) return 'file';
  if (desc.startsWith('תיקון')) return 'scissors';
  if (obs && obs.isManual !== false) return 'pencil';
  if (desc.includes('משלוח')) return 'truck';
  return 'dress';
}

/** :892 - תיאור השורה בלי "(פריט #…)". */
export function obligationLabel(obs) {
  return ((obs.productName || obs.description || '').replace(ITEM_SUFFIX_RE, '').trim()) || (obs.isManual ? 'חיוב ידני' : 'חיוב מחירון');
}

export function paymentIconName(method) {
  const m = String(method || '');
  if (m.includes('אשראי')) return 'card';
  if (m.includes('מזומן')) return 'cash';
  if (m.includes('העברה')) return 'bank';
  if (/צ['׳]ק/.test(m)) return 'cheque';
  if (m.includes('החזר') || m.includes('זיכוי')) return 'undo';
  return 'wallet';
}

/** :730-736 - אופני "תשלום נוסף" מ-ALLOWED_PAYMENT_METHODS, בלי אשראי (לאשראי יש נדרים). */
export function additionalPaymentMethodOptions(settings) {
  const v = settings && (typeof settings.get === 'function' ? settings.get('ALLOWED_PAYMENT_METHODS', '') : settings.ALLOWED_PAYMENT_METHODS);
  const raw = v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : ['מזומן', 'העברה בנקאית', "צ'ק"];
  const withoutCredit = raw.filter(opt => !opt.includes('אשראי'));
  return withoutCredit.length > 0 ? withoutCredit : ['מזומן'];
}

export const CREDIT_METHOD = 'אשראי';
/**
 * אופני התשלום בחלון התשלום (D3): אשראי (נדרים) רק כשהוא פעיל (MPM :408/:947); מזומן/העברה/צ׳ק רק כש-allow_additional_payment_on_order
 * (MPM :958, page.js :1723) - בדיוק מה שהישן אפשר לגבות על הזמנה קיימת. manualOnly = "תשלום נוסף" (בלי אשראי).
 */
export function payMethodsFor(settings, { manualOnly = false } = {}) {
  const out = [];
  if (!manualOnly && settings && settings.nedarimPlusEnabled) out.push(CREDIT_METHOD);
  // D6 (בעלים 2026-10-05): "בגמ"ח הראשי יש רק אפשרות אחת - תוודא שזה מותאם להגדרות": גם "תשלום נוסף" (manualOnly) מציג מזומן/העברה/צ׳ק
  // רק כש-allow_additional_payment_on_order דלוק - בלי ההגדרה אין אף אחד מהם, מכל נקודת כניסה
  if (settings && settings.allowAdditionalPayment) out.push(...additionalPaymentMethodOptions(settings));
  return out;
}

/** W4-MANUAL (החלטת הבעלים 2026-10-04): תשלום ידני ובקשת זיכוי דורשים אישור feature:manual_payment_credit_add בשני הגמ"חים
 * (עד אז: רק בנווה, כשהמתג המאוחד דלוק). מי שכבר מורשה לא מתבקש - זה בחלון האישור של הבקר. הפרמטר נשמר לחתימה היציבה. */
export const manualMoneyNeedsApproval = (settings) => true;
/** AMB-17: הלחצן המאוחד "חיוב / זיכוי ידני" רק כשהמתג consolidate_manual_payment_credit_ui דלוק (נווה יעקב).
 * בגמ"ח הראשי נשארים שני הלחצנים הנפרדים של הישן ("תשלום נוסף" / "בקשת זיכוי ללקוח") - בלי "הוסף חיוב" (F6, בעלים 2026-10-05). */
export const isUnifiedManualButton = (settings) => !!(settings && settings.consolidateManualPaymentCredit);
export const MANUAL_PAYMENT_CREDIT_KEY = 'feature:manual_payment_credit_add';
export const MANUAL_CHARGE_KEY = 'feature:manual_charge_add';
/** AMB-22 + D7 (בעלים 2026-10-05: "בהרשאות הקיימות, בלי הרשאות חדשות"): מחיקת תשלום וסימון זיכוי כבוצע דורשים אישור מנהל בכרטיס החדש. אין הרשאה ייעודית בקטלוג - משתמשים באותה
 * הרשאת "כסף ידני" כדי שהמאשרים יהיו אותם אנשים ולא תיווצר הרשאה סגורה-כברירת-מחדל שתחסום את העבודה; פיצול להרשאות נפרדות = שינוי שני הקבועים. */
export const PAYMENT_DELETE_APPROVAL_KEY = MANUAL_PAYMENT_CREDIT_KEY;
export const REFUND_EXECUTE_APPROVAL_KEY = MANUAL_PAYMENT_CREDIT_KEY;
/** R33: חישוב מחדש - השרת מתיר רק הנהלה ראשית (checkAuth('הנהלה ראשית') = roleId 0 או 2) - הכפתור מוסתר מכל השאר. */
export const canRecalcRole = (roleId) => roleId === 0 || roleId === 2;

// ---------------------------------------------------------------------------------------------
// פרטי תשלום ובקשת זיכוי
// ---------------------------------------------------------------------------------------------
/** :1273-1292 - הערות התשלום: JSON של נדרים → שורות; אחרת טקסט (" | " → שורה חדשה). */
export function parsePaymentNotes(notes) {
  if (!notes) return { kind: 'none' };
  try {
    if (typeof notes === 'string' && notes.trim().startsWith('{')) {
      const parsed = JSON.parse(notes);
      return { kind: 'kv', rows: Object.entries(parsed).map(([k, v]) => [k, String(v)]) };
    }
  } catch { /* טקסט רגיל */ }
  return { kind: 'text', text: typeof notes === 'string' ? notes.split(' | ').join('\n') : String(notes) };
}

/** :186-215 - "אמצעי תשלום לזיכוי": אופן התשלום האחרון + 4 ספרות (מתוך ההערות של נדרים) כשיש. */
export function lastPaymentDetails(payments = []) {
  let paymentDetailsString = '';
  const validPayments = payments.filter(p => !p.isDeleted);
  if (validPayments.length > 0) {
    const sortedPayments = [...validPayments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    const lastPayment = sortedPayments[0];
    let last4 = '';
    try {
      if (typeof lastPayment.notes === 'string') {
        const parsed = JSON.parse(lastPayment.notes);
        if (parsed.LastNum) last4 = parsed.LastNum;
        else if (parsed.CardNumber) last4 = String(parsed.CardNumber).slice(-4);
        else if (parsed.Card) last4 = String(parsed.Card).slice(-4);
        else {
          const match = lastPayment.notes.match(/"(?:LastNum|Card|CardNumber)"\s*:\s*"?\D*(\d{4})"?/i);
          if (match && match[1]) last4 = match[1];
        }
      }
    } catch {
      const match = lastPayment.notes?.match(/(?:כרטיס|אשראי).*?(\d{4})/);
      if (match && match[1]) last4 = match[1];
    }
    paymentDetailsString = lastPayment.paymentMethod || '';
    if (last4) {
      paymentDetailsString += ` (ספרות: ${last4})`;
    } else if (lastPayment.paymentMethod && lastPayment.paymentMethod.includes('אשראי') && !last4) {
      const match4 = lastPayment.notes?.match(/\b(\d{4})\b/);
      if (match4) paymentDetailsString += ` (ספרות: ${match4[1]})`;
    }
  }
  return paymentDetailsString;
}

/** :225 - מייל הלקוח (כולל emailSuffix כשהמייל נשמר בלי @). */
export function customerEmailOf(customer) {
  return customer?.email ? (customer.emailSuffix && !customer.email.includes('@') ? `${customer.email}${customer.emailSuffix.startsWith('@') ? '' : '@'}${customer.emailSuffix}` : customer.email) : '';
}

/** :217-226 - ערכי הפתיחה של בקשת זיכוי (R38). */
export function refundPrefill(customer, payments) {
  return {
    amount: '',
    reason: '',
    bankName: customer?.bankName || '',
    bankBranch: customer?.bankBranch || '',
    bankAccount: customer?.bankAccount || '',
    bankAccountName: customer?.bankAccountName || '',
    paymentDetails: lastPaymentDetails(payments),
    email: customerEmailOf(customer)
  };
}

/** :444-449 - פרטי בנק לזיכוי קיים: מהזיכוי עצמו, אחרת מכרטיס הלקוח. */
export function autoRefundBankPrefill(refund, customer) {
  return {
    bankName: refund?.bankName || customer?.bankName || '',
    bankBranch: refund?.bankBranch || customer?.bankBranch || '',
    bankAccount: refund?.bankAccount || customer?.bankAccount || '',
    bankAccountName: refund?.bankAccountName || customer?.bankAccountName || ''
  };
}

export const refundNeedsBank = (r) => !r?.bankName?.trim() || !r?.bankBranch?.trim();
export const pendingRefundsOf = (refunds = []) => refunds.filter(r => !r.isDeleted && !r.isExecuted);
/** :487-488 - זיכוי אוטומטי שממתין לפרטי בנק (נפתח מיד אחרי שמירה/יציאה). */
export const pendingAutoRefundNeedingBank = (refunds = []) => refunds.find(r => !r.isDeleted && !r.isExecuted && r.isAutoGenerated && refundNeedsBank(r)) || null;

// ---------------------------------------------------------------------------------------------
// טופס האשראי (R36) - פענוח טראק מגנטי, מספר כרטיס, תוקף
// ---------------------------------------------------------------------------------------------
const group4 = (digits) => digits.match(/.{1,4}/g)?.join(' ') || '';

/** :362-394 - "העברה מהירה": טראק 2 (=) או טראק 1 (^). מחזיר {cardNumber, tokef} רק כששניהם פוענחו, אחרת null. */
export function parseSwipe(val) {
  let card = '';
  let tokef = '';
  if (val.includes('=')) {
    const parts = val.split('=');
    if (parts[1] && parts[1].length >= 4) {
      card = parts[0].replace(/[^0-9]/g, '');
      const expYY = parts[1].substring(0, 2);
      const expMM = parts[1].substring(2, 4);
      tokef = `${expMM}/${expYY}`;
      card = group4(card);
    }
  } else if (val.includes('^')) {
    const parts = val.split('^');
    if (parts.length > 2 && parts[2] && parts[2].length >= 4) {
      card = parts[0].replace(/[^0-9]/g, '');
      const expYY = parts[2].substring(0, 2);
      const expMM = parts[2].substring(2, 4);
      tokef = `${expMM}/${expYY}`;
      card = group4(card);
    }
  }
  return card && tokef ? { cardNumber: card, tokef } : null;
}

/** :544-577 - הקלדה/הדבקה בשדה מספר הכרטיס (כולל טראק שהודבק). מחזיר {cardNumber, tokef}. */
export function cardNumberInput(val, prevTokef = '') {
  if (val.includes('=')) {
    const parts = val.split('=');
    const card = parts[0].replace(/[^0-9]/g, '');
    const expYY = parts[1].substring(0, 2);
    const expMM = parts[1].substring(2, 4);
    return { cardNumber: group4(card), tokef: (expMM && expYY) ? `${expMM}/${expYY}` : prevTokef };
  }
  if (val.includes('^')) {
    const parts = val.split('^');
    const card = parts[0].replace(/[^0-9]/g, '');
    if (parts.length > 2) {
      const expYY = parts[2].substring(0, 2);
      const expMM = parts[2].substring(2, 4);
      return { cardNumber: group4(card), tokef: (expMM && expYY) ? `${expMM}/${expYY}` : prevTokef };
    }
  }
  const raw = val.replace(/[^0-9]/g, '');
  return { cardNumber: group4(raw), tokef: prevTokef };
}

/** :579-584 - MM/YY. */
export function tokefInput(val) {
  const raw = String(val).replace(/[^0-9]/g, '');
  return raw.length > 2 ? `${raw.substring(0, 2)}/${raw.substring(2, 4)}` : raw;
}

// ---------------------------------------------------------------------------------------------
// גופי הבקשות (זהים לישן; נבדקים מול קוד המקור של MPM)
// ---------------------------------------------------------------------------------------------
/** :603-629 - גוף POST /api/nedarim. */
export function nedarimBody({ customer = {}, obligations = [], orderId, card }) {
  const c = customer || {};
  const fullAddress = [c.street || '', c.houseNum || '', c.city || ''].filter(Boolean).join(' ');
  const itemsDescription = obligations
    .filter(o => !o.isDeleted && o.isManual === false)
    .map(o => o.productName?.replace(ITEM_SUFFIX_RE, ''))
    .filter(Boolean)
    .join(', ');
  const fullItemsDesc = itemsDescription ? `(${itemsDescription})` : '';
  const orderNote = orderId ? `הזמנה ${orderId} ${fullItemsDesc}` : '';
  const automaticNote = `באמצעות תכנת הגמח; מס הזמנה: ${orderId || 'לא ידוע'}`;
  const finalNotes = [orderNote, card.notes, automaticNote].filter(Boolean).join(' - ');
  return {
    clientName: `${c.firstName || ''} ${c.lastName || ''}`.trim(),
    phone: c.phone1 || '',
    address: fullAddress,
    cardNumber: card.cardNumber.replace(/\s/g, ''),
    tokef: card.tokef.replace(/\//g, ''),
    amount: money2(card.amount),
    installments: clampInstallments(card.installments),
    notes: finalNotes,
    zeout: c.idNumber || c.zeout || '',
    email: c.email || ''
  };
}

/** :635-647 - שורת התשלום שנוצרת אחרי חיוב מוצלח (notes = התשובה הגולמית של נדרים + הערת המשתמש). */
export function creditPaymentRow(data, card, nowIso = new Date().toISOString()) {
  let parsedRaw = { 'אישור': data.confirmation || 'בוצע' };
  try {
    if (data.rawResponse) parsedRaw = JSON.parse(data.rawResponse);
  } catch { /* נשאר האישור */ }
  if (card.notes) parsedRaw['הערות משתמש'] = card.notes;
  return { isNew: true, paymentMethod: 'אשראי', notes: JSON.stringify(parsedRaw), amount: money2(card.amount), paymentDate: nowIso };
}

/** :524-536 - מעקף מתכנת: שורת תשלום מקומית (נשמרת ב-PUT הבא) בלי פנייה לנדרים. */
export function bypassPaymentRow(card, approverId, nowIso = new Date().toISOString()) {
  const notesObj = { 'אישור': 'מעקף מתכנת - לא בוצע חיוב אשראי בפועל', 'מזהה עובד מאשר': approverId };
  if (card.notes) notesObj['הערות משתמש'] = card.notes;
  return { isNew: true, paymentMethod: 'אשראי (מעקף מתכנת)', notes: JSON.stringify(notesObj), amount: money2(card.amount), paymentDate: nowIso };
}

/** :587-597 - בדיקות טופס האשראי (אותן הודעות). balance = היתרה הנדרשת (מעוגלת). */
export function validateCreditCard(card, balance) {
  if (!card.cardNumber || !card.tokef || !card.amount) return 'אנא מלא את כל השדות החובה (מספר כרטיס, תוקף, וסכום).';
  const paymentAmount = money2(card.amount);
  if (!(paymentAmount > 0)) return 'אנא הזן סכום חיובי לחיוב.';
  if (paymentAmount > money2(balance)) return `לא ניתן לשלם יותר מהיתרה הנדרשת (${fmtMoney(balance)}).`;
  return null;
}
/** :504-513 */
export function validateBypass(card, balance) {
  const amount = money2(card.amount);
  if (!amount || amount <= 0) return 'אנא הזן סכום לפני מעקף.';
  if (amount > money2(balance)) return `לא ניתן לשלם יותר מהיתרה הנדרשת (${fmtMoney(balance)}).`;
  return null;
}
/** :274-278 */
export function validateManualPayment(amountStr) {
  const amount = money2(amountStr);
  if (!amount || amount <= 0) return 'יש להזין סכום חיובי לתשלום';
  return null;
}
/** :231-238 */
export function validateRefund(refundData) {
  if (!refundData.amount || money2(refundData.amount) <= 0) return 'יש להזין סכום חיובי לזיכוי';
  if (!refundData.bankName?.trim() || !refundData.bankBranch?.trim()) return 'יש להזין בנק וסניף לזיכוי';
  return null;
}
/** :454-457 */
export function validateBank(bank) {
  if (!bank.bankName?.trim() || !bank.bankBranch?.trim()) return 'יש להזין בנק וסניף לזיכוי';
  return null;
}
/** :155 - חיוב ידני: תיאור + סכום (מספר שונה מאפס). */
export function validateManualCharge({ description, amount }) {
  if (!String(description || '').trim()) return 'יש להזין תיאור לחיוב';
  const n = parseFloat(amount);
  if (!Number.isFinite(n) || n === 0) return 'יש להזין סכום לחיוב';
  return null;
}

/** :244 - גוף POST /api/refunds (אותם מפתחות ובאותו סדר; הסכום כמספר). */
export const refundBody = ({ customerId, orderId, refundData }) => ({ customerId, orderId, ...refundData, amount: money2(refundData.amount) });
/** :285-290 */
export const additionalPaymentBody = ({ orderId, amount, paymentMethod, notes }) => ({ orderId, amount: money2(amount), paymentMethod: paymentMethod || 'מזומן', notes: notes || '' });
/** :463 - רק ארבעת שדות הבנק (IBAN לא נשלח - A15). */
export const refundBankBody = (bank, { iban, reason } = {}) => ({
  bankName: bank.bankName, bankBranch: bank.bankBranch, bankAccount: bank.bankAccount, bankAccountName: bank.bankAccountName,
  // רק כשהוזן IBAN תקין: המקור המעוצב נשמר בסיבה (הפירוק מוריד אפסים מובילים ולא הפיך)
  ...(iban ? { reason: withIbanNote(reason, iban) } : {})
});

// ---------------------------------------------------------------------------------------------
// רשימת החיובים בלשונית (A13 + R39): שורות שמורות + "ממתין לשמירה"
// ---------------------------------------------------------------------------------------------
/**
 * שורות החיובים לתצוגה, החדש למעלה (MPM :756). pend = שורה שעוד לא בשרת: חיוב ידני חדש (isNew) או שורת תצוגה מקדימה (isPreview,
 * preview-pricing) שאין לה שורה זהה (מפתח זהות + סכום) בחיובים השמורים. שורות preview זהות לשמורות מוצגות כרגילות.
 */
export function obligationRows(obligations = [], savedObligations = []) {
  const saved = new Map();
  savedObligations.filter(o => !o.isDeleted).forEach(o => { const k = `${obligationIdentityKey(o)}|${money2(o.amount)}`; saved.set(k, (saved.get(k) || 0) + 1); });
  const active = obligations.filter(o => !o.isDeleted);
  const sorted = [...active].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return sorted.map(o => {
    let pend = !!o.isNew || (!o.id && !o.isPreview);
    if (o.isPreview) {
      const k = `${obligationIdentityKey(o)}|${money2(o.amount)}`;
      const n = saved.get(k) || 0;
      if (n > 0) saved.set(k, n - 1); else pend = true;
    }
    return { o, pend };
  });
}

// ---------------------------------------------------------------------------------------------
// הפעולות (async, עם תלויות מוזרקות - רצות גם ב-node עם fetch מדומה)
// ---------------------------------------------------------------------------------------------
const jsonOf = async (res) => { try { return await res.json(); } catch { return null; } };

/**
 * @param {object} env
 * @param {typeof fetch} env.fetch
 * @param {() => {order:object, items:object[], obligations:object[], payments:object[], refunds:object[], settings:object, totals:object, dirty:boolean}} env.get
 * @param {object} env.edit                 oc.edit
 * @param {(order:object)=>void} env.applyServerOrder
 * @param {(kind:string, reason:string)=>Promise<object|null>} env.approve
 * @param {(kind:string)=>string|null} [env.peekApprovalToken]   אסימון אישור חתום טרי מהאישור האחרון (hardening 2026-10-05) - נשלח עם POST /api/payments / PUT /api/refunds/{id}
 * @param {(o:{confirmed:boolean})=>Promise<boolean>} env.toggleSignature
 * @param {object} env.ui                   useOcUi()
 */
export function createPaymentActions(env) {
  const f = (...a) => env.fetch(...a);
  const peekToken = (kind) => (env.peekApprovalToken ? env.peekApprovalToken(kind) : null);
  const clearToken = (kind) => { if (env.clearApprovalToken) env.clearApprovalToken(kind); };
  const st = () => env.get();
  let chargeInFlight = false;
  let manualInFlight = false;

  // חיוב אשראי שנשמר רק מקומית: סנכרון מהשרת/איפוס היו מעלימים את הרישום היחיד של הכסף - חוסמים עד "שמור"
  const unsavedCardBlock = () => {
    const msg = unsavedCardChargeMessage(st().payments);
    return msg ? { ok: false, error: msg } : null;
  };

  // = handleOrderUpdate של הישן אחרי GET טרי (זיכוי / ביצוע זיכוי / חישוב מחדש)
  async function refetchApply() {
    const orderId = st().order?.orderId;
    const orderRes = await f(`/api/orders/${orderId}`);
    if (!orderRes.ok) return false;
    env.applyServerOrder(await orderRes.json());
    return true;
  }

  // תשלום שכבר נשמר בשרת: כשאין שינויים שלא נשמרו - סנכרון מלא מהשרת (התשלום נכנס גם ל-snapshot ולא מוצג כ"שינוי");
  // כשיש - כמו הישן (onPaymentsChange([...payments, saved])) כדי לא לדרוס את השינויים שבעריכה.
  // POST /api/payments יכול להיות שהתחייב בשרת גם כשהתשובה אבדה/לא נקראה: לפני שמוסיפים שורה מקומית (שהיתה נשמרת שוב ב-PUT הבא =
  // כפל) בודקים מול השרת אם קיים תשלום עם אותן הערות וסכום שעוד לא מוכר למסך.
  async function findPersistedTwin(added) {
    try {
      const orderId = st().order?.orderId;
      const res = await f(`/api/orders/${orderId}`);
      if (!res.ok) return null;
      const data = await res.json();
      const known = new Set((st().payments || []).filter(p => p.id).map(p => String(p.id)));
      return (data.payments || []).find(p => p.id && !p.isDeleted && !known.has(String(p.id))
        && String(p.notes || '') === String(added.notes || '') && money2(p.amount) === money2(added.amount)) || null;
    } catch { return null; }
  }

  async function syncSavedPayment(saved) {
    if (!st().dirty) {
      try { if (await refetchApply()) return 'synced'; } catch { /* נופל לגיבוי */ }
    }
    env.edit.setPayments(prev => [...prev, saved]);
    return 'appended';
  }

  /** R36 - חיוב אשראי בנדרים פלוס ושמירת התשלום מיד. → {ok, error?, amount?, persisted?} */
  async function chargeCard(card) {
    if (chargeInFlight) return { ok: false, error: 'חיוב קודם עדיין בתהליך' };
    const s = st();
    const err = validateCreditCard(card, s.totals.balance);
    if (err) return { ok: false, error: err };
    chargeInFlight = true;
    try {
      const response = await f('/api/nedarim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // orderId: the server signs the charge receipt for THIS order (nedarim ignores the field)
        body: JSON.stringify({ ...nedarimBody({ customer: s.order?.customer, obligations: s.obligations, orderId: s.order?.orderId, card }), orderId: s.order?.orderId })
      });
      const data = await response.json();
      if (!data.success) return { ok: false, error: data.error || 'שגיאה בחיוב הכרטיס' };
      const added = creditPaymentRow(data, card);
      // הכרטיס כבר חויב (כסף אמיתי זז) - שומרים מיד בשרת (MPM :649-653)
      let savedPayment = null;
      try {
        const saveRes = await f('/api/payments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          // chargeReceipt: signed by POST /api/nedarim - what lets a card row through when the server enforces payment permissions
          body: JSON.stringify({ orderId: s.order?.orderId, amount: added.amount, paymentMethod: added.paymentMethod, notes: added.notes, ...(data.chargeReceipt ? { chargeReceipt: data.chargeReceipt } : {}) })
        });
        if (saveRes.ok) savedPayment = await saveRes.json();
      } catch { /* savedPayment נשאר null */ }
      if (!savedPayment) savedPayment = await findPersistedTwin(added);
      if (savedPayment) {
        await syncSavedPayment(savedPayment);
        return { ok: true, amount: added.amount, method: added.paymentMethod, persisted: true };
      }
      // החיוב הצליח אבל השמירה נכשלה: שורה מקומית (תישמר ב-PUT הבא) + אזהרה בקול רם (MPM :674-680)
      env.edit.setPayments(prev => [...prev, added]);
      await env.ui.alert({ kind: 'error', title: 'התשלום לא נשמר בשרת', sub: `שים לב: הכרטיס חויב בהצלחה בסך ${fmtMoney(added.amount)}, אך שמירת התשלום בשרת נכשלה. יש ללחוץ מיד על "שמור" כדי לתעד את התשלום בהזמנה. אם השמירה הידנית נכשלת גם היא - יש לתעד את התשלום באופן חריג ולפנות לתמיכה, כדי שלא יישאר חיוב בלי רישום.` });
      return { ok: true, amount: added.amount, method: added.paymentMethod, persisted: false };
    } catch {
      return { ok: false, error: 'שגיאת תקשורת בחיוב הכרטיס' };
    } finally {
      chargeInFlight = false;
    }
  }

  /** R36 מעקף מתכנת (אישור ברמת 'מתכנת'): שורה מקומית, נשמרת ב-PUT הבא. → {ok, error?, cancelled?} */
  async function bypassCard(card) {
    const err = validateBypass(card, st().totals.balance);
    if (err) return { ok: false, error: err };
    const auth = await env.approve('מתכנת', 'מעקף חיוב אשראי בפועל ורישום ידני כאילו שולם, ללא פנייה לנדרים פלוס - מוגבל למתכנת בלבד.');
    if (!auth) return { ok: false, cancelled: true };
    const added = bypassPaymentRow(card, auth.employeeId);
    env.edit.setPayments(prev => [...prev, added]);
    return { ok: true, amount: added.amount, method: added.paymentMethod, persisted: false };
  }

  /** "תשלום נוסף" / מזומן-העברה-צ׳ק בחלון התשלום: POST /api/payments. → {ok, error?} */
  async function addManualPayment({ amount, paymentMethod, notes, approved = false }) {
    const err = validateManualPayment(amount);
    if (err) return { ok: false, error: err };
    if (manualInFlight) return { ok: false, error: 'תשלום קודם עדיין בתהליך' };
    // בנווה (המתג המאוחד) מזומן/העברה/צ׳ק דורשים אישור feature:manual_payment_credit_add - גם כשהחלון נפתח מחוב/שמירה/רייל.
    // approved=true: הקורא כבר אישר (הלחצן "חיוב / זיכוי ידני").
    if (!approved && manualMoneyNeedsApproval(st().settings)) {
      const auth = await env.approve(MANUAL_PAYMENT_CREDIT_KEY, 'הוספת תשלום/זיכוי ידני דורשת קוד מאשר.');
      if (!auth) return { ok: false, cancelled: true };
    }
    manualInFlight = true;
    try {
      const postManual = (token) => f('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...additionalPaymentBody({ orderId: st().order?.orderId, amount, paymentMethod, notes }), ...(token ? { approvalToken: token } : {}) })
      });
      const sentToken = peekToken(MANUAL_PAYMENT_CREDIT_KEY);
      let res = await postManual(sentToken);
      let data = await res.json();
      // השרת אוכף (approval_permissions_enforced) והאסימון פג / חסר: אישור מחדש ושליחה אחת חוזרת (מי שמורשה בעצמו לא מגיע לכאן)
      if (res.status === 403 && data && data.approvalKind === 'manual_payment_credit' && env.approve) {
        const auth = await env.approve(MANUAL_PAYMENT_CREDIT_KEY, 'הוספת תשלום/זיכוי ידני דורשת קוד מאשר.');
        if (!auth) return { ok: false, cancelled: true };
        res = await postManual(auth.approvalToken || null);
        data = await res.json();
      }
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת התשלום');
      clearToken(MANUAL_PAYMENT_CREDIT_KEY); // חד-פעמי: גם האסימון של האישור החוזר
      await syncSavedPayment(data);
      return { ok: true, amount: money2(amount), method: paymentMethod || 'מזומן', persisted: true };
    } catch (e) {
      return { ok: false, error: e.message || 'שגיאה בשמירת התשלום' };
    } finally {
      manualInFlight = false;
    }
  }

  /** R38 בקשת זיכוי: POST /api/refunds → GET → applyServerOrder. → {ok, error?} */
  async function createRefund(refundData, { iban } = {}) {
    const err = validateRefund(refundData);
    if (err) return { ok: false, error: err };
    const blocked = unsavedCardBlock();
    if (blocked) return blocked;
    const s = st();
    if (iban) refundData = { ...refundData, reason: withIbanNote(refundData.reason, iban) };
    try {
      const res = await f('/api/refunds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(refundBody({ customerId: s.order?.customer?.id, orderId: s.order?.orderId, refundData }))
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create refund');
      await refetchApply();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'שגיאה ביצירת הזיכוי' };
    }
  }

  /** D4b / R38 פרטי בנק לזיכוי קיים: PUT /api/refunds/{id} (ארבעת השדות). → {ok, error?} */
  async function saveRefundBank(refundId, bank, { iban } = {}) {
    const err = validateBank(bank);
    if (err) return { ok: false, error: err };
    const existing = (st().refunds || []).find(r => r.id === refundId);
    const body = refundBankBody(bank, { iban, reason: existing && existing.reason });
    try {
      const res = await f(`/api/refunds/${refundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בשמירת פרטי הבנק');
      env.edit.setRefunds(prev => prev.map(r => (r.id === refundId ? { ...r, ...body } : r)));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'שגיאה בשמירת פרטי הבנק' };
    }
  }

  /** R38 "אשר ביצוע": PUT {isExecuted:true} (השרת יוצר תשלום הפכי ושולח מייל) → GET → applyServerOrder. → {ok, error?} */
  async function executeRefund(refundId) {
    const blocked = unsavedCardBlock();
    if (blocked) return blocked;
    try {
      const putExecuted = (token) => f(`/api/refunds/${refundId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isExecuted: true, ...(token ? { approvalToken: token } : {}) })
      });
      const sentToken = peekToken(REFUND_EXECUTE_APPROVAL_KEY);
      let res = await putExecuted(sentToken);
      if (res.status === 403 && env.approve) {
        const data403 = await jsonOf(res);
        if (data403 && data403.approvalKind === 'manual_payment_credit') {
          const auth = await env.approve(REFUND_EXECUTE_APPROVAL_KEY, 'סימון זיכוי כבוצע יוצר תשלום הפכי בהזמנה ושולח הודעה ללקוח - נדרש אישור מנהל.');
          if (!auth) return { ok: false, cancelled: true };
          res = await putExecuted(auth.approvalToken || null);
        }
      }
      if (!res.ok) {
        const data = await jsonOf(res);
        throw new Error((data && data.error) || 'Failed to approve refund');
      }
      clearToken(REFUND_EXECUTE_APPROVAL_KEY);
      await refetchApply();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'שגיאה באישור הזיכוי' };
    }
  }

  /** AMB-22: "אשר ביצוע" אחרי אישור מנהל (REFUND_EXECUTE_APPROVAL_KEY). חסימת "חיוב אשראי שלא נשמר" קודם - לא מבקשים אישור לפעולה שתיחסם.
   * → {ok, error?, cancelled?}. (השרת עדיין לא אוכף - בקשה ל-PR הקשחה נפרד, ר' W4-NOTES.) */
  async function executeRefundApproved(refundId) {
    const blocked = unsavedCardBlock();
    if (blocked) return blocked;
    const auth = await env.approve(REFUND_EXECUTE_APPROVAL_KEY, 'סימון זיכוי כבוצע יוצר תשלום הפכי בהזמנה ושולח הודעה ללקוח - נדרש אישור מנהל.');
    if (!auth) return { ok: false, cancelled: true };
    return executeRefund(refundId);
  }

  /** R33 חישוב מחדש (הנהלה ראשית). → {ok, error?} */
  async function recalc() {
    const blocked = unsavedCardBlock();
    if (blocked) return blocked;
    try {
      const res = await f('/api/admin/recalculations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIds: [st().order?.orderId] })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'שגיאה בחישוב מחדש');
      if (data.errors?.length) throw new Error(data.errors[0].error || 'שגיאה בחישוב מחדש');
      await refetchApply();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message || 'שגיאה בחישוב מחדש' };
    }
  }

  const sameRow = (a, b) => a === b || (!!a.id && a.id === b.id) || (!a.id && !!a._localId && a._localId === b._localId);

  /** R37 מחיקת תשלום (מקומי, נשמר ב-PUT; בלי PIN כמו היום - AMB-22). */
  function deletePayment(p) {
    // שורה בלי id = עוד לא נשמרה בשרת: כסף שכבר זז (חיוב אשראי) לא נעלם בלחיצה - רק מעקף מתכנת (בלי כסף אמיתי) ניתן למחיקה מקומית
    if (!p.id && !isBypassRow(p)) return { ok: false, error: 'תשלום שעוד לא נשמר בהזמנה לא נמחק מכאן. יש לשמור את ההזמנה קודם (או לבטל את השינוי ברייל).' };
    env.edit.setPayments(prev => (p.id ? prev.map(x => (x.id === p.id ? { ...x, isDeleted: true } : x)) : prev.filter(x => !sameRow(x, p))));
    return { ok: true };
  }

  /** AMB-22: מחיקת תשלום אחרי אישור מנהל (PAYMENT_DELETE_APPROVAL_KEY). שורה שאי אפשר למחוק (בלי id וזה לא מעקף) נדחית לפני בקשת האישור. */
  async function deletePaymentApproved(p) {
    if (!p.id && !isBypassRow(p)) return deletePayment(p);
    const auth = await env.approve(PAYMENT_DELETE_APPROVAL_KEY, 'מחיקת תשלום מההזמנה דורשת אישור מנהל.');
    if (!auth) return { ok: false, cancelled: true };
    return deletePayment(p);
  }

  /** R35 חיוב ידני (מקומי, נשמר ב-PUT; השרת דורש feature:manual_charge_add). */
  function addManualCharge({ description, amount }, nowIso = new Date().toISOString()) {
    const added = { isNew: true, description, amount: parseFloat(amount), isManual: true, createdAt: nowIso };
    env.edit.setObligations(prev => [...prev, added]);
    return added;
  }
  function deleteManualCharge(o) {
    env.edit.setObligations(prev => (o.id ? prev.map(x => (x.id === o.id ? { ...x, isDeleted: true } : x)) : prev.filter(x => !sameRow(x, o))));
  }

  /** R7 לפני אשראי: "כן, חתם" נשמר מיד (PUT קטן של הבקר). */
  async function signRegulations() {
    // חתימה שסומנה ועוד לא נשמרה (שינוי בבאנר) לא מספיקה: הדפים והחיוב נשענים על מצב השרת
    if ((st().snapshot?.order ?? st().order)?.hasSignedRegulations) return true;
    return env.toggleSignature({ confirmed: true });
  }

  return { isBusy: () => chargeInFlight || manualInFlight, refetchApply, syncSavedPayment, chargeCard, bypassCard, addManualPayment, createRefund, saveRefundBank, executeRefund, executeRefundApproved, recalc, deletePayment, deletePaymentApproved, addManualCharge, deleteManualCharge, signRegulations };
}

// ---------------------------------------------------------------------------------------------
// בקשת תשלום מבחוץ (R4 צ׳יפ הארנק / "שלם ₪N" / "זכה ₪N" ברייל - W5): אירוע DOM, בלי תלות בקבצי W1/W5
// ---------------------------------------------------------------------------------------------
export const OC_PAY_REQUEST_EVENT = 'oc:pay-request';
export const OC_PAYMENT_DONE_EVENT = 'oc:payment-done';
/** kind: 'auto' (לפי היתרה: חוב → חלון תשלום, זכות → זיכוי) | 'pay' | 'credit'. הקורא מעביר גם ללשונית תשלומים (oc.goPayments). */
export function requestPayment(kind = 'auto') {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(OC_PAY_REQUEST_EVENT, { detail: { kind } }));
}

// ---------------------------------------------------------------------------------------------
// ה-hook: מחבר את הפעולות לבקר, לחלונות ולאירועים
// ---------------------------------------------------------------------------------------------
/**
 * @param {object} oc   useOrderCardController
 * @param {object} ui   useOcUi
 * @param {object} D    החלונות: {Pay, Credit, Bank, RefundRequest, Manual, AddCharge, PaymentDetails}
 */
export default function usePaymentActions(oc, ui, D) {
  const ocRef = useRef(oc);
  // layout effect (לא passive): בקשת תשלום שמגיעה מיד אחרי שמירה (oc.save → הרייל) חייבת לראות את ה-state השמור, לא את זה שלפני השמירה
  useLayoutEffect(() => { ocRef.current = oc; });
  const [busy, setBusy] = useState('');
  const [roleId, setRoleId] = useState(null);
  const syncingRef = useRef(false);
  const [bankAsk, setBankAsk] = useState(null); // {source, href} - ממתין לרינדור עם הזיכויים העדכניים

  useEffect(() => {
    let off = false;
    fetchSharedJson('/api/me', { ttl: TTL.STATIC }).then(me => { if (!off && me && me.success && me.employee) setRoleId(me.employee.roleId); }).catch(() => {});
    return () => { off = true; };
  }, []);

  const actions = useMemo(() => createPaymentActions({
    fetch: (...a) => fetch(...a),
    get: () => { const o = ocRef.current; return { order: o.order, items: o.items, obligations: o.obligations, payments: o.payments, refunds: o.refunds, settings: o.settings, totals: o.totals, dirty: o.dirty }; },
    edit: { setPayments: (v) => ocRef.current.edit.setPayments(v), setObligations: (v) => ocRef.current.edit.setObligations(v), setRefunds: (v) => ocRef.current.edit.setRefunds(v) },
    applyServerOrder: (order) => {
      // אירוע debtCreated שהבקר שולח מתוך הסנכרון של פעולה שלנו (נווה: server-action) לא פותח שוב את חלון התשלום
      syncingRef.current = true;
      try { ocRef.current.applyServerOrder(order); } finally { setTimeout(() => { syncingRef.current = false; }, 0); }
    },
    approve: (kind, reason) => ocRef.current.approve(kind, reason),
    peekApprovalToken: (kind) => (ocRef.current.peekApprovalToken ? ocRef.current.peekApprovalToken(kind) : null),
    clearApprovalToken: (kind) => { if (ocRef.current.clearApprovalToken) ocRef.current.clearApprovalToken(kind); },
    toggleSignature: (o) => ocRef.current.toggleSignature(o),
    ui,
  }), [ui]);

  // "api" - מה שהחלונות מקבלים: מצב עדכני (לא צילום מרגע הפתיחה), הפעולות והאישורים
  const api = useMemo(() => ({
    get oc() { return ocRef.current; },
    actions,
    ui,
  }), [actions, ui]);

  const announcePaid = useCallback((r) => {
    ui.toast('info', `התקבל תשלום ב${r.method}`, fmtMoney(r.amount));
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OC_PAYMENT_DONE_EVENT, { detail: { amount: r.amount, method: r.method, persisted: !!r.persisted } }));
  }, [ui]);

  // ממשיך יציאה שנחסמה (R49 "יציאה טורית"): אם הבקר עוד באמצע פעולה - ניסיון חוזר קצר
  const continueExit = useCallback(async (href) => {
    for (let i = 0; i < 20; i++) {
      const r = await ocRef.current.exit(href);
      if (!r || !r.busy) return r;
      await new Promise(res => setTimeout(res, 150));
    }
    return null;
  }, []);

  /** D3 חלון התשלום. ctx: {source:'save'|'exit'|'server-action'|'pay-now'|'manual', amount, href, intent} */
  const openPay = useCallback(async (ctx = {}) => {
    // "תשלום נוסף" ידני בזמן שיש שינויים שלא נשמרו: התשלום היה נכנס למצב המקומי בלבד, וביטול שינויים/"בטל" ברייל היה מעלים אותו מהמסך
    // (ואז אפשר לגבות פעמיים). עד שהבקר יחשוף עדכון snapshot - דורשים שמירה קודם.
    if (ctx.source === 'manual' && ocRef.current.dirty) {
      await ui.alert({ kind: 'error', title: 'יש שינויים שלא נשמרו', sub: 'יש לשמור את ההזמנה לפני רישום תשלום נוסף.' });
      return null;
    }
    // בזמן שחיוב האשראי/שמירת התשלום רצים - Esc/לחיצה על הרקע לא סוגרים את החלון (התוצאה, ההודעה והמשך היציאה לא יילכדו)
    const r = await ui.openDialog(D.Pay, { api, ...ctx }, { labelledBy: 'oc-pay-t', className: 'oc-pay', dismissable: () => !actions.isBusy() });
    if (!r) return null;
    if (r.paid) announcePaid(r);
    if (r.leftDebt) {
      ui.toast('info', `אושר על ידי ${r.leftDebt.employeeName || 'מנהל'}`, 'ההזמנה נשמרה עם יתרת חוב');
      // D6 "נשמר · חוב ₪N" (R10) ברייל - רק אחרי שהחלון נסגר, ולא ביציאה (שם ממשיכים לצאת). REQUESTS-W5 #1
      if (ctx.source !== 'exit' && ocRef.current.announceDebtLeft) ocRef.current.announceDebtLeft({ amount: money2(ctx.amount), employeeId: r.leftDebt.employeeId, employeeName: r.leftDebt.employeeName });
    }
    if ((r.paid || r.leftDebt) && ctx.source === 'exit') await continueExit(ctx.href);
    return r;
  }, [ui, D, api, actions, announcePaid, continueExit]);

  /** D4b פרטי בנק לזיכוי קיים. ctx: {source, href} */
  const openBank = useCallback(async (refund, ctx = {}) => {
    if (!refund) return null;
    const r = await ui.openDialog(D.Bank, { api, refund, auto: !!ctx.source }, { labelledBy: 'oc-bank-t', className: 'oc-bank' });
    if (r && r.saved) ui.toast('info', 'פרטי הבנק נשמרו', '');
    if (r && ctx.source === 'exit') await continueExit(ctx.href);
    return r;
  }, [ui, D, api, continueExit]);

  /** D4 אישור ביצוע זיכוי (R38 "אשר ביצוע" / "זכה ₪N"). */
  const openCredit = useCallback(async (refund) => {
    if (!refund) return null;
    // C2: "אשר ביצוע" מסנכרן מהשרת ודורס שינויים שלא נשמרו - שומרים קודם (אחרי שמירה ה-refund נטען מחדש לפי ה-id)
    if (ocRef.current.ensureSaved) {
      const g = await ocRef.current.ensureSaved({ sub: 'יש שינויים שלא נשמרו. לשמור לפני אישור הזיכוי?', okText: 'שמור והמשך' });
      if (!g.ok) return null;
      if (g.saved) refund = (ocRef.current.refunds || []).find(x => x.id === refund.id) || refund;
    }
    const r = await ui.openDialog(D.Credit, { api, refund }, { labelledBy: 'oc-credit-t', className: 'oc-credit' });
    if (r === 'bank') return openBank(refund);
    if (r && r.executed) ui.toast('info', 'הזיכוי אושר ובוצע בהצלחה.', fmtMoney(refund.amount));
    return r;
  }, [ui, D, api, openBank]);

  /** R38 בקשת זיכוי. amount = ערך פתיחה אופציונלי. */
  const openRefundRequest = useCallback(async ({ amount } = {}) => {
    const r = await ui.openDialog(D.RefundRequest, { api, amount }, { labelledBy: 'oc-refund-t', className: 'oc-refund' });
    if (r && r.created) ui.toast('info', 'בקשת הזיכוי נוצרה בהצלחה', 'ניתן לנהל אותה במסך הזיכויים הראשי או כאן בלשונית תשלומים.');
    return r;
  }, [ui, D, api]);

  /** R35 חיוב ידני: אישור feature:manual_charge_add לפני החלון (השרת בודק שוב ב-PUT). */
  const openAddCharge = useCallback(async () => {
    const a = await ocRef.current.approve(MANUAL_CHARGE_KEY, 'הוספה או מחיקה של חיוב ידני דורשת אישור מנהל.');
    if (!a) return null;
    const r = await ui.openDialog(D.AddCharge, { api }, { labelledBy: 'oc-charge-t', className: 'oc-charge' });
    if (r && r.add) {
      actions.addManualCharge(r.add);
      ui.toast('charge', `חיוב ממתין ${fmtMoney(r.add.amount)}`, 'החיוב יישמר עם שמירת ההזמנה.');
    } else if (r && r.remove) {
      const ok = await ui.confirm({ title: 'מחיקת חיוב', sub: 'האם אתה בטוח שברצונך למחוק חיוב זה?', okText: 'מחק', icon: 'trash', danger: true });
      if (ok) actions.deleteManualCharge(r.remove);
    }
    return r;
  }, [ui, D, api, actions]);

  /** W4-MANUAL: שער האישור לתשלום/זיכוי ידני (בשני הגמ"חים; מי שכבר מורשה לא מתבקש). true = אושר */
  const manualMoneyGate = useCallback(async () => {
    if (!manualMoneyNeedsApproval(ocRef.current.settings)) return true;
    const a = await ocRef.current.approve(MANUAL_PAYMENT_CREDIT_KEY, 'הוספת תשלום/זיכוי ידני דורשת קוד מאשר.');
    return !!a;
  }, []);

  /** "תשלום נוסף" (הלחצן הנפרד של הגמ"ח הראשי, וגם מתוך הלחצן המאוחד של נווה). */
  const openManualPayment = useCallback(async () => {
    if (!ocRef.current.settings.allowAdditionalPayment) { ui.toast('error', 'תשלום נוסף לא מאופשר', 'ההגדרה "אפשר תשלום נוסף בהזמנה קיימת" כבויה בגמ"ח הזה.'); return null; }
    if (ocRef.current.dirty) return openPay({ source: 'manual' }); // מציג את ההודעה "לשמור קודם" לפני בקשת אישור
    if (!(await manualMoneyGate())) return null;
    return openPay({ source: 'manual', approved: true });
  }, [ui, openPay, manualMoneyGate]);

  /** "בקשת זיכוי ללקוח" (כנ"ל). */
  const openManualRefund = useCallback(async () => {
    // C2: יצירת הזיכוי מסנכרנת מהשרת ודורסת שינויים שלא נשמרו - שומרים קודם
    if (ocRef.current.ensureSaved) { const g = await ocRef.current.ensureSaved({ sub: 'יש שינויים שלא נשמרו. לשמור לפני בקשת הזיכוי?', okText: 'שמור והמשך' }); if (!g.ok) return null; }
    if (!(await manualMoneyGate())) return null;
    return openRefundRequest();
  }, [openRefundRequest, manualMoneyGate]);

  /** R22 הלחצן המאוחד "חיוב / זיכוי ידני" - רק בנווה (AMB-17). */
  const openManual = useCallback(async () => {
    const o = ocRef.current;
    const key = await ui.openDialog(D.Manual, { api, needsApproval: manualMoneyNeedsApproval(o.settings), allowPayment: !!o.settings.allowAdditionalPayment }, { labelledBy: 'oc-manual-t', className: 'oc-manual' });
    if (!key) return null;
    if (key === 'charge') return openAddCharge();
    if (key === 'payment') return openManualPayment();
    if (key === 'refund') return openManualRefund();
    return null;
  }, [ui, D, api, openAddCharge, openManualPayment, openManualRefund]);

  /** AMB-22: מחיקת תשלום = אישור (confirm) → אישור מנהל → מחיקה מקומית (נשמרת עם שמירת ההזמנה). */
  const deletePayment = useCallback(async (p) => {
    const ok = await ui.confirm({ title: 'מחיקת תשלום', sub: `למחוק את התשלום ב${p.paymentMethod || 'תשלום'} בסך ${fmtMoney(amountOf(p.amount))}? הפעולה נשמרת עם שמירת ההזמנה.`, okText: 'מחק', icon: 'trash', danger: true });
    if (!ok) return null;
    const res = await actions.deletePaymentApproved(p);
    if (!res.ok && !res.cancelled) ui.toast('error', res.error, '');
    return res;
  }, [ui, actions]);

  /** R37 פרטי תשלום מלאים + מחיקה. */
  const openPaymentDetails = useCallback(async (p) => {
    const r = await ui.openDialog(D.PaymentDetails, { payment: p, canDelete: !!p.id }, { labelledBy: 'oc-paydet-t', className: 'oc-paydet' });
    if (r !== 'delete') return;
    if (!p.id) { ui.toast('error', 'תשלום שעוד לא נשמר לא נמחק מכאן', 'יש לשמור את ההזמנה קודם.'); return; }
    await deletePayment(p);
  }, [ui, D, deletePayment]);

  /** R33 */
  const runRecalc = useCallback(async () => {
    const ok = await ui.confirm({ title: 'חישוב מחדש', sub: 'לחשב מחדש את כל חיובי ההזמנה הזו לפי הכללים העדכניים? פעולה זו עשויה לשנות סכומים קיימים.', okText: 'חשב מחדש', icon: 'refresh' });
    if (!ok) return;
    // C2: חישוב מחדש מסנכרן מהשרת ודורס שינויים שלא נשמרו - שומרים קודם (באישור)
    if (ocRef.current.ensureSaved) { const g = await ocRef.current.ensureSaved({ sub: 'יש שינויים שלא נשמרו. לשמור לפני החישוב מחדש?', okText: 'שמור והמשך' }); if (!g.ok) return; }
    setBusy('recalc');
    try {
      const r = await actions.recalc();
      if (r.ok) ui.toast('info', 'החישוב עודכן בהצלחה.', '');
      else ui.toast('error', r.error, '');
    } finally { setBusy(''); }
  }, [ui, actions]);

  /** "תשלום ₪N" / "הוסף תשלום" / צ׳יפ הארנק: עם שינויים - שמירה קודם (A18: תשלום = שמירה → PUT → חלון התשלום) */
  // opts.afterSave: הקורא (הרייל) כבר שמר - לא שומרים שוב גם אם ה-state עוד מסומן "מלוכלך" (שורות מקומיות שטרם נשלחו)
  const payNow = useCallback(async (opts = {}) => {
    const o = ocRef.current;
    if (o.dirty && !opts.afterSave) {
      const r = await o.save({ intent: 'pay' });
      // חוב חדש → הבקר שולח debtCreated והחלון נפתח משם; חוב שהיה קודם → פותחים כאן
      if (r && r.ok && !r.noop && !r.debtCreated && money2(r.balance) > 0) return openPay({ source: 'pay-now', amount: money2(r.balance) });
      return null;
    }
    if (money2(o.totals.balance) <= 0) return null;
    return openPay({ source: 'pay-now', amount: money2(o.totals.balance) });
  }, [openPay]);

  /** "זכה ₪N": עם שינויים - שמירה (השרת יוצר זיכוי אוטומטי → פרטי בנק); בלי - הזיכוי הממתין (פרטי בנק / אישור ביצוע) או בקשת זיכוי */
  const creditNow = useCallback(async (opts = {}) => {
    const o = ocRef.current;
    if (o.dirty && !opts.afterSave) { await o.save({ intent: 'credit' }); return null; }
    const pending = pendingRefundsOf(o.refunds);
    const needBank = pendingAutoRefundNeedingBank(o.refunds) || pending.find(refundNeedsBank);
    if (needBank) return openBank(needBank);
    if (pending.length === 1) return openCredit(pending[0]);
    if (pending.length > 1) {
      const el = typeof document !== 'undefined' ? document.getElementById('oc-pending-refunds') : null;
      if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const b = el.querySelector('button'); b && b.focus(); }
      return null;
    }
    if (manualMoneyNeedsApproval(o.settings)) {
      const a = await o.approve(MANUAL_PAYMENT_CREDIT_KEY, 'הוספת תשלום/זיכוי ידני דורשת קוד מאשר.');
      if (!a) return null;
    }
    return openRefundRequest({ amount: money2(Math.abs(o.totals.balance)) });
  }, [openBank, openCredit, openRefundRequest]);

  // ---------- אירועי הבקר (oc.on; כמו useOcEvent של W1 - בלי לייבא את הבקר, כדי שהקובץ ייטען גם ב-node) ----------
  const onDebtRef = useRef(null);
  onDebtRef.current = (e) => {
    if (!e) return;
    if (e.source === 'server-action' && syncingRef.current) return;
    openPay({ source: e.source, amount: money2(e.amount), href: e.href, intent: e.intent });
  };
  const subscribe = oc && oc.on;
  useEffect(() => {
    if (!subscribe) return undefined;
    const offDebt = subscribe('debtCreated', (e) => onDebtRef.current && onDebtRef.current(e));
    const offBank = subscribe('autoRefundNeedsBank', (e) => setBankAsk({ source: (e && e.source) || 'save', href: e && e.href }));
    return () => { offDebt && offDebt(); offBank && offBank(); };
  }, [subscribe]);
  // הזיכויים העדכניים מגיעים ברינדור שאחרי האירוע - פותחים את חלון הבנק כשהם כבר ב-oc.refunds (MPM openPendingAutoRefundBankModal)
  useEffect(() => {
    if (!bankAsk) return;
    const pending = pendingAutoRefundNeedingBank(oc.refunds);
    const ask = bankAsk;
    setBankAsk(null);
    if (pending) openBank(pending, ask);
  }, [bankAsk, oc.refunds, openBank]);

  // R4 / רייל: בקשת תשלום מבחוץ
  // afterSave (מהרייל, מיד אחרי oc.save): ה-state השמור מגיע ברינדור הבא - מחכים לו (אותו דפוס כמו bankAsk) ואז פותחים בלי לשמור שוב
  const [afterSaveAsk, setAfterSaveAsk] = useState(null); // {kind}
  useEffect(() => {
    const h = (ev) => {
      const d = (ev && ev.detail) || {};
      const kind = d.kind || 'auto';
      if (d.afterSave) { setAfterSaveAsk({ kind }); return; }
      const bal = money2(ocRef.current.totals.balance);
      if (kind === 'pay' || (kind === 'auto' && bal > 0)) payNow();
      else if (kind === 'credit' || (kind === 'auto' && bal < 0)) creditNow();
    };
    window.addEventListener(OC_PAY_REQUEST_EVENT, h);
    return () => window.removeEventListener(OC_PAY_REQUEST_EVENT, h);
  }, [payNow, creditNow]);
  useEffect(() => {
    if (!afterSaveAsk) return;
    const { kind } = afterSaveAsk;
    setAfterSaveAsk(null);
    const bal = money2(ocRef.current.totals.balance);
    if (kind === 'pay' || (kind === 'auto' && bal > 0)) payNow({ afterSave: true });
    else if (kind === 'credit' || (kind === 'auto' && bal < 0)) creditNow({ afterSave: true });
  }, [afterSaveAsk, payNow, creditNow]);

  return {
    api, actions, busy,
    canRecalc: canRecalcRole(roleId),
    payNow, creditNow, openPay, openBank, openCredit, openRefundRequest, openManual, openManualPayment, openManualRefund, openAddCharge, deletePayment, openPaymentDetails, runRecalc,
  };
}
