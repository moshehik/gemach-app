// app/v3/strings/he.js — מילון המחרוזות (CONSTITUTION §ה... §ב.6/§ט.2, LIBRARY-MAP §3).
// מפתח: <אזור>.<רכיב/מסך>.<תפקיד> (אזורים: common, nav, order, customer, dress,
// rental, payment, dialog, notice, error, tip). ערך: עברית, נכתב מחדש (R10) —
// לא מועתק מהאתר הישן. פרמטרים: {name}. ריבוי: _one/_other.
//
// זהו מקור-ברירת-המחדל בלבד. override לפי ארגון מגיע מ-LabelsContext הקיים
// (/api/settings/labels) - t()/useStrings ב-index.js משלבים את שתי השכבות.
// מפתח חסר כאן = שגיאת build/גלריה (§ט.2) - כל מפתח שנקרא חייב שורה כאן.

const he = {
  // common
  'common.action.save': 'שמירה',
  'common.action.cancel': 'ביטול',
  'common.action.confirm': 'אישור',
  'common.action.close': 'סגירה',
  'common.action.back': 'חזרה',
  'common.action.next': 'המשך',
  'common.action.edit': 'עריכה',
  'common.action.delete': 'מחיקה',
  'common.action.undo': 'ביטול השינוי',
  'common.action.redo': 'החזר ביטול',
  'common.action.discardAll': 'ביטול כל השינויים',
  'common.state.missing': 'חסר',
  'common.state.saved': 'נשמר',
  'common.state.unsaved': 'לא נשמר',
  'common.state.loading': 'טוען…',
  'common.state.empty.title': 'לא נמצאו תוצאות',
  'common.state.empty.action': 'נקה סינון',

  // dialog (LayerManager)
  'dialog.confirm.defaultTitle': 'לאשר את הפעולה?',
  'dialog.confirm.confirmLabel': 'אישור',
  'dialog.confirm.cancelLabel': 'ביטול',
  'dialog.code.title': 'נדרש אישור מנהל',
  'dialog.code.approverLabel': 'מאשר/ת',
  'dialog.code.pinLabel': 'קוד אישור',
  'dialog.busy.default': 'רק רגע…',

  // notice / toast
  'notice.saved.default': 'השינויים נשמרו',
  'notice.action.open': 'פתיחה',
  'toast.info.done': 'הפעולה בוצעה',

  // order (רייל/מנוע שינויים - שימוש עתידי, Phase 3+)
  'order.rail.title': 'שינויים בהזמנה',
  'order.rail.empty': 'אין שינויים שלא נשמרו',
  'order.rail.netCharge': 'לתשלום אחרי שמירה',
  'order.rail.netCredit': 'לזיכוי אחרי שמירה',

  // customer (הפיילוט - archetype detail card)
  'customer.card.title': 'כרטיס לקוחה',
  'customer.card.glance': 'במבט אחד',
  'customer.card.tab.details': 'פרטים',
  'customer.card.tab.orders': 'הזמנות',
  'customer.card.tab.payments': 'תשלומים',
  'customer.card.tab.history': 'היסטוריה',
  'customer.field.fullName': 'שם מלא',
  'customer.field.phone1': 'טלפון',
  'customer.field.phone2': 'טלפון נוסף',
  'customer.field.email': 'דוא"ל',
  'customer.field.address': 'כתובת',
  'customer.field.idNumber': 'תעודת זהות',
  'customer.field.notes': 'הערות',
  'customer.status.blocked': 'לקוחה חסומה',
  'customer.status.debt': 'יתרת חוב',
  'customer.status.credit': 'זיכוי ממתין',
  'customer.status.ok': 'אין חוב פתוח',

  // tip (הסברים)
  'tip.customer.idNumber': 'תעודת הזהות מוצגת לעובדי הנהלה בלבד ומשמשת לאימות זהות.',
  'tip.customer.blocked': 'לקוחה חסומה לא יכולה לפתוח הזמנה חדשה עד שההגבלה תוסר.',
};

export default he;
