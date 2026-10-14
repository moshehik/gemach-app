// לוגיקה טהורה של מרכז ההודעות החדש (/messages, MessagesA5.js): פיצול התשובה של GET /api/notifications לתיקיות, שורות הרשימה, חיפוש.
// אותה הפרדה בדיוק כמו בדף הישן (LegacyMessagesPage.js applyData): הודעות מסווגות (בין משמרות / להנהלה) הן שידור-לכולם ולכן מגיעות ב"נכנסות"
// של השרת - מסננים אותן מהזרם הכללי ומציגים אותן רק בתיקייה הייעודית שלהן.

export const CAT_SHIFT = 'shift_handover';
export const CAT_MGMT = 'management';
const isCategorized = (n) => n.category === CAT_SHIFT || n.category === CAT_MGMT;

/** הרשאת "מנהל" לסימון הודעות הנהלה כטופל: roleId 1 / 0 / 2 (תואם MANAGEMENT_ROLE_IDS ב-app/api/notifications/handle/route.js). */
export const isManagerRoleId = (roleId) => [0, 1, 2].includes(roleId);

export const fullName = (p) => (p ? `${p.firstName || ''} ${p.lastName || ''}`.trim() : '');
export const authorOf = (n) => fullName(n.sender) || 'מערכת הגמ"ח';
const receiverOf = (n) => (n.receiverId === null ? 'כל העובדים' : fullName(n.receiver) || 'לא ידוע');

/** { incoming, outgoing, archived, shift, management } מתוך נכנסות + יוצאות גולמיות; הארכיון ממוין מהחדש לישן ומסומן ב-direction. */
export function splitNotifications(inc, out) {
  const generalInc = (inc || []).filter((n) => !isCategorized(n));
  const generalOut = (out || []).filter((n) => !isCategorized(n));
  const archived = [];
  const incoming = [];
  const outgoing = [];
  generalInc.forEach((n) => { if (n.isArchived) archived.push({ ...n, direction: 'incoming' }); else incoming.push(n); });
  generalOut.forEach((n) => { if (n.isArchived) archived.push({ ...n, direction: 'outgoing' }); else outgoing.push(n); });
  archived.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    incoming,
    outgoing,
    archived,
    shift: (inc || []).filter((n) => n.category === CAT_SHIFT),
    management: (inc || []).filter((n) => n.category === CAT_MGMT),
  };
}

/** תקציר לשורה: שורה אחת, בלי ירידות שורה כפולות. */
export function snippet(text, max = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/**
 * שורת רשימה. kind = המסלול של ההודעה: 'in' | 'out' | 'shift' | 'mgmt'; בארכיון נגזר מ-direction.
 * who = מי שמוצג בראש השורה (בנכנסות השולח, ביוצאות הנמען); unread = ממתינה לקריאה אצל העובד הנוכחי (בנכנסות ובין משמרות); pending = ממתינה לטיפול (הנהלה / בין משמרות).
 */
export function messageRow(n, folder) {
  const kind = folder === 'archived' ? (n.direction === 'outgoing' ? 'out' : 'in') : { incoming: 'in', outgoing: 'out', shift: 'shift', management: 'mgmt' }[folder];
  const tags = n.personalTags || [];
  const who = kind === 'out' ? receiverOf(n) : authorOf(n);
  const unread = (kind === 'in' || kind === 'shift') && !n.isRead;
  const handled = !!n.handledAt;
  return {
    id: n.id,
    n,
    kind,
    who,
    text: snippet(n.content),
    date: n.createdAt,
    ts: new Date(n.createdAt).getTime() || 0,
    broadcast: n.receiverId === null && kind !== 'shift' && kind !== 'mgmt',
    unread,
    handled,
    pending: (kind === 'shift' || kind === 'mgmt') && !handled,
    tags,
    archived: !!n.isArchived,
    hay: [n.content, who, ...tags].filter(Boolean).join(' '),
  };
}

export const rowsFor = (list, folder) => (list || []).map((n) => messageRow(n, folder));

/** מונים לעמודה הכחולה: נכנסות / בין משמרות = לא נקראו; להנהלה = ממתינות לטיפול. */
export function folderCounts(parts) {
  return {
    incoming: parts.incoming.filter((n) => !n.isRead).length,
    outgoing: 0,
    archived: 0,
    shift: parts.shift.filter((n) => !n.isRead).length,
    management: parts.management.filter((n) => !n.handledAt).length,
  };
}

export function addTag(tags, raw) {
  const t = String(raw || '').trim();
  if (!t || (tags || []).includes(t)) return tags || [];
  return [...(tags || []), t];
}
