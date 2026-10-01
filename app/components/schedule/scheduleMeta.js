// מטא-נתונים וטקסטים של דף הלו״ז (תצוגה בלבד). חוזה הנתונים: docs/schedule-page-logic-spec.md
// (GET /api/schedule). אין כאן לוגיקה עסקית - רק איך שורה מוצגת.

// שמונה השלבים (שלב 3 "העברה בין סניפים" לא קיים - החלטה A1). סדר, אייקון וצבע מהעיצוב המאושר
// (לוז-יומי.html, STAGES בשורה 1691). שם/רבים מהשרת גובר; כאן רק ברירת מחדל לזמן הטעינה.
export const STAGE_ORDER = ['order', 'repair', 'prep', 'dout', 'pick', 'event', 'manret', 'dback'];

export const STAGE_META = {
  order: { label: 'הזמנה', plural: 'הזמנות', icon: 'file', color: '--c-order', info: true },
  repair: { label: 'תיקונים', plural: 'תיקונים', icon: 'scissors', color: '--c-repair' },
  prep: { label: 'הכנה', plural: 'הכנות', icon: 'bag', color: '--c-prep' },
  dout: { label: 'משלוח הלוך', plural: 'משלוחי הלוך', icon: 'truck', color: '--c-dout' },
  pick: { label: 'איסוף מקומי', plural: 'איסופים מקומיים', icon: 'userck', color: '--c-pick' },
  event: { label: 'אירוע', plural: 'אירועים', icon: 'gift', color: '--c-event', info: true },
  manret: { label: 'החזרה ידנית', plural: 'החזרות ידניות', icon: 'undo', color: '--c-manret' },
  dback: { label: 'משלוח חזור', plural: 'משלוחי חזור', icon: 'truck', color: '--c-dback' },
};

export const NOT_MARKED_TIP = 'יסומן בגרסה הבאה';

export function dressCountText(n) {
  const c = Number(n) || 0;
  if (c === 0) return '';
  return c === 1 ? 'שמלה אחת בהזמנה' : c + ' שמלות בהזמנה';
}

// החזרה ידנית: כמות בקצרה בלבד (A3) - "פריט אחד" / "2 פריטים"
export function itemsCountText(n) {
  const c = Number(n) || 0;
  if (c === 0) return '';
  return c === 1 ? 'פריט אחד' : c + ' פריטים';
}

export function formatAddress(address) {
  if (!address) return '';
  const street = String(address.street || '').trim();
  const city = String(address.city || '').trim();
  if (street && city) return city + ', ' + street;
  if (address.full && String(address.full).trim()) return String(address.full).trim();
  return city || street || '';
}

export function formatMoney(n) {
  if (n == null || Number.isNaN(Number(n))) return '';
  return '₪' + Number(n).toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

const ALTERATION_LABELS = { neck: 'צוואר', length: 'אורך', sleeve: 'שרוול' };
// תיאור התיקון לפריט: "אורך, שרוול" (מהשדות neckAlteration / lengthAlteration / sleeveAlteration)
export function alterationSummary(item) {
  const out = [];
  if ((item.neckAlteration || 0) > 0) out.push(ALTERATION_LABELS.neck);
  const len = item.lengthAlteration;
  if (len && String(len).trim() && String(len) !== '0' && String(len) !== 'null') out.push(ALTERATION_LABELS.length);
  if ((item.sleeveAlteration || 0) > 0) out.push(ALTERATION_LABELS.sleeve);
  return out.join(', ');
}

export function itemText(item) {
  const parts = [];
  if (item.model) parts.push('דגם ' + item.model);
  if (item.size) parts.push('מידה ' + item.size);
  return parts.join(' · ');
}

// השורה השנייה של השורה (הטקסט הקטן) כרשימת קטעים (כדי שהשבירה בין שורות תהיה בין קטעים ולא באמצע
// "שמלה אחת בהזמנה"). tbl=true: הטלפון כבר בעמודת הלקוחה.
export function subText(stageKey, row, ctx = {}) {
  return subParts(stageKey, row, ctx).join(' · ');
}

export function subParts(stageKey, row, ctx = {}) {
  const count = dressCountText(row.dressCount);
  const branch = row.branch || '';
  switch (stageKey) {
    case 'order': {
      const parts = ['אירוע ' + (row.eventDateHebrew || '—')];
      const money = formatMoney(row.totalAmount);
      if (money) parts.push('סה״כ ' + money);
      parts.push(row.isPaid ? 'שולם' : 'טרם שולם');
      if (count) parts.push(count);
      if (row.registeredBy) parts.push('נרשמה ע״י ' + row.registeredBy);
      return parts;
    }
    case 'repair': {
      const kinds = (row.items || []).map(alterationSummary).filter(Boolean);
      const uniq = [...new Set(kinds.join(', ').split(', ').filter(Boolean))];
      return ['תיקון' + (uniq.length ? ': ' + uniq.join(', ') : ''), count].filter(Boolean);
    }
    case 'prep':
      return [branch ? 'סניף ' + branch : '', count].filter(Boolean);
    case 'dout': {
      const addr = formatAddress(row.address);
      return ['אל ' + (addr || 'כתובת חסרה'), count].filter(Boolean);
    }
    case 'pick': {
      const pb = row.pickupBranch || branch;
      return [pb ? 'איסוף בסניף ' + pb : 'איסוף מקומי', count].filter(Boolean);
    }
    case 'event':
      return ['אירוע ' + (row.eventDateHebrew || '—'), count].filter(Boolean);
    case 'manret': {
      const addr = formatAddress(row.address);
      return [ctx.tbl ? '' : row.customer?.phone1 || '', addr, itemsCountText(row.dressCount)].filter(Boolean);
    }
    case 'dback': {
      const addr = formatAddress(row.address);
      return ['איסוף מ' + (addr || 'כתובת חסרה'), count].filter(Boolean);
    }
    default:
      return count ? [count] : [];
  }
}

// דגלי הזמנה שמשנים תאריכים (B21): חו״ל, אמצע שבוע, יום נוסף, מרווח מותאם
export function flagLabels(flags) {
  if (!flags) return [];
  const out = [];
  if (flags.isAbroad) out.push('חו״ל');
  if (flags.isWeekdayEvent) out.push('אמצע שבוע');
  if (flags.extraDay === 'before') out.push('יום נוסף לפני');
  else if (flags.extraDay === 'after') out.push('יום נוסף אחרי');
  else if (flags.extraDay) out.push('יום נוסף');
  if (flags.customSpacing != null && flags.customSpacing !== '' && flags.customSpacing !== false) out.push('ריווח מותאם');
  return out;
}

export function alertText(alert) {
  if (!alert) return '';
  if (alert.code === 'late_not_done' && alert.daysLate > 0) {
    return alert.label + ' (' + (alert.daysLate === 1 ? 'יום אחד' : alert.daysLate + ' ימים') + ')';
  }
  return alert.label || '';
}
