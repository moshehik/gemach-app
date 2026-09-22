// ספריית המיילים המרכזית של המערכת - מקור האמת היחיד ל"אילו מיילים המערכת שולחת".
//
// כל מייל שהמערכת שולחת מופיע כאן פעם אחת: מה מפעיל אותו, מי מקבל, מה הנושא, באיזו תבנית
// הוא מעוצב, איזה מתג הגדרות שולט בו, ואיפה בקוד הוא נשלח. הנושאים (subject) מוגדרים כאן
// בלבד - אתרי השליחה קוראים ל-emailSubject(id, params) ולא כותבים נושא בעצמם, כך ששינוי
// ניסוח נעשה במקום אחד. התיעוד המלא (טבלה) ב-EMAILS.md.
//
// להוספת מייל חדש: (1) הוסיפו כאן רשומה; (2) עצבו אותו ב-renderGenericEmailHtml (או תבנית
// חדשה ב-lib/emailTemplates.js); (3) שלחו דרך sendSystemEmail מ-lib/mailer.js - אף פעם לא
// fetch ישיר ל-Apps Script; (4) עדכנו את הטבלה ב-EMAILS.md.

export const EMAIL_CATEGORIES = {
  auth: 'אימות וסיסמאות',
  customer: 'הודעות ללקוחות',
  management: 'דוחות והודעות להנהלה',
  system: 'תקלות ופיתוח',
  internal: 'הודעות פנימיות',
  logistics: 'משלוחים',
};

const GMACH = 'גמ"ח שמלות';

export const EMAIL_CATALOG = {
  passwordResetSelf: {
    name: 'איפוס סיסמה - עצמי ("שכחתי סיסמה")',
    category: 'auth',
    trigger: 'עובד לוחץ "שכחתי סיסמה" במסך ההתחברות',
    recipients: 'העובד עצמו (המייל השמור בכרטיסו)',
    subject: () => 'איפוס סיסמה - מערכת הגמ"ח',
    template: 'renderPasswordResetEmailHtml',
    gate: null,
    attachments: 'ללא',
    logged: true,
    source: ['app/api/auth/forgot-password/route.js'],
  },
  passwordResetManager: {
    name: 'איפוס סיסמה - ע"י מנהל',
    category: 'auth',
    trigger: 'מנהל מאפס סיסמה לעובד בכרטיס העובד',
    recipients: 'העובד שהסיסמה שלו אופסה',
    subject: () => 'איפוס סיסמה - מערכת הגמ"ח',
    template: 'renderPasswordResetEmailHtml',
    gate: null,
    attachments: 'ללא',
    logged: true,
    source: ['app/api/employees/[id]/reset-password/route.js'],
  },
  managerFreeText: {
    name: 'מייל חופשי מכרטיס לקוח/עובד ("שלח מייל")',
    category: 'customer',
    trigger: 'מנהל/מתכנת שולח מייל מהחלון "שלח מייל" (עם אימות סיסמה)',
    recipients: 'כתובת שהמנהל הקליד (+ עותק)',
    subject: ({ subject } = {}) => subject || 'הודעה חדשה',
    template: 'renderGenericEmailHtml',
    gate: null,
    attachments: 'קבצים שצירף המנהל (מייל / דרייב / שניהם), אחרת ללא',
    logged: true,
    source: ['app/api/send-email/route.js', 'components/SendEmailModal.js', 'components/customers/modern/ModernSendEmailModal.js'],
  },
  orderCard: {
    name: 'כרטיס הזמנה / השכרה (PDF)',
    category: 'customer',
    trigger: 'כפתור "מייל הזמנה" / "מייל השכרה" בתפריט ההדפסה של ההזמנה',
    recipients: 'מייל הלקוח (ניתן לעריכה לפני השליחה)',
    subject: ({ orderId } = {}) => `הזמנה #${orderId} - ${GMACH}`,
    template: 'renderOrderCardEmailHtml (גוף מלווה) + דוח HTML→PDF מלא',
    gate: null,
    attachments: 'PDF של ההזמנה (+ קבצים נוספים)',
    logged: true,
    source: ['app/api/orders/[id]/email/route.js'],
  },
  orderCreatedAuto: {
    name: 'אישור יצירת הזמנה (אוטומטי)',
    category: 'customer',
    trigger: 'הזמנה חדשה נקלטה/סוכמה',
    recipients: 'מייל הלקוח',
    subject: ({ orderId, gmachName } = {}) => `הזמנה #${orderId} - ${gmachName || GMACH}`,
    template: 'renderOrderConfirmationEmailHtml',
    gate: 'auto_email_on_order_create',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/orders/route.js'],
  },
  pickupReminder: {
    name: 'תזכורת איסוף (יום לפני)',
    category: 'customer',
    trigger: 'Cron יומי - הזמנות שהאירוע שלהן מחר',
    recipients: 'מייל הלקוח',
    subject: ({ orderId, gmachName } = {}) => `תזכורת איסוף - הזמנה #${orderId} - ${gmachName || GMACH}`,
    template: 'renderPickupReminderEmailHtml',
    gate: 'pickup_reminder_enabled',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/cron/daily/route.js'],
  },
  lateReturnReminder: {
    name: 'תזכורת החזרה באיחור',
    category: 'customer',
    trigger: 'Cron יומי - הזמנה שהחזרתה באיחור (פעם אחת בלבד להזמנה)',
    recipients: 'מייל הלקוח',
    subject: ({ orderId } = {}) => `תזכורת החזרה - הזמנה #${orderId}`,
    template: 'renderLateReturnEmailHtml',
    gate: 'late_return_email_enabled (+ late_return_email_text, late_return_threshold_days)',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/cron/daily/route.js'],
  },
  bulkEventDate: {
    name: 'הודעה המונית לפי תאריך אירוע (עם אישור קבלה)',
    category: 'customer',
    trigger: 'מנהל שולח הודעה לכל הלקוחות עם אירוע בטווח תאריכים (/admin/bulk-email)',
    recipients: 'כל הלקוחות עם אירוע בטווח (מייל אחד לכל כתובת)',
    subject: ({ subject, batchId } = {}) => `${subject} [${batchId}]`,
    template: 'renderGenericEmailHtml (+ כפתור אישור קבלה)',
    gate: 'bulk_email_by_event_date',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/bulk-email/route.js', 'app/api/bulk-email/confirm/route.js'],
  },
  refundExecuted: {
    name: 'אישור ביצוע זיכוי',
    category: 'customer',
    trigger: 'זיכוי/החזר מסומן "בוצע" ב-/refunds',
    recipients: 'מייל הלקוח / מייל הבקשה',
    subject: () => 'אישור ביצוע זיכוי - מערכת הגמ"ח',
    template: 'renderRefundExecutedEmailHtml',
    gate: null,
    attachments: 'ללא',
    logged: true,
    source: ['app/api/refunds/[id]/route.js'],
  },
  dailyManagerReport: {
    name: 'דוח יומי למנהל',
    category: 'management',
    trigger: 'Cron יומי',
    recipients: 'daily_manager_report_email (או main_email)',
    subject: ({ hebrewDate, count } = {}) => `דוח יומי ${hebrewDate} - ${count} הזמנות`,
    template: 'renderDailyReportEmailHtml',
    gate: 'daily_manager_report_enabled',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/cron/daily/route.js'],
  },
  manualBarcodesReport: {
    name: 'דוח ברקודים שהוקלדו ידנית',
    category: 'management',
    trigger: 'Cron יומי - כשיש פריטים שהברקוד שלהם הוקלד ידנית היום',
    recipients: 'daily_manager_report_email (או main_email)',
    subject: ({ hebrewDate, count } = {}) => `ברקודים ידניים ${hebrewDate} - ${count}`,
    template: 'renderManualBarcodesEmailHtml',
    gate: 'manual_barcode_daily_report',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/cron/daily/route.js'],
  },
  internalMessageAlert: {
    name: 'הודעה פנימית ("שלח גם במייל")',
    category: 'internal',
    trigger: 'עובד שולח הודעה פנימית במסך ההודעות',
    recipients: 'הנמען (או כל העובדים הפעילים בשידור) שסימנו receiveEmailAlerts',
    subject: ({ title } = {}) => title || 'הודעה חדשה במערכת הגמח',
    template: 'renderInternalMessageEmailHtml',
    gate: 'receiveEmailAlerts (בכרטיס העובד)',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/notifications/route.js'],
  },
  courierDeliveries: {
    name: 'נתוני משלוחים למשלוחן',
    category: 'logistics',
    trigger: '"הדפסת משלוחים" ← שליחה במייל (/deliveries)',
    recipients: 'courier_email (הגדרה)',
    subject: ({ groups } = {}) => (groups && groups.length === 1 ? groups[0].title : `נתוני משלוחים - ${groups?.length || 0} קבוצות`),
    template: 'renderCourierDeliveryEmailHtml',
    gate: 'enable_deliveries + courier_email',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/deliveries/courier-email/route.js'],
  },
  errorReportNew: {
    name: 'דיווח תקלה חדש',
    category: 'system',
    trigger: 'עובד מדווח על תקלה (כפתור הדיווח)',
    recipients: 'כל המתכנתים הפעילים (roleId=2)',
    subject: () => 'דיווח תקלה ממערכת הגמח - לטיפול AI',
    template: 'renderErrorReportEmailHtml (גוף טקסט כולל בלוק AI_DATA)',
    gate: null,
    attachments: 'ללא',
    logged: true,
    routing: 'bugs_b_rest_a',
    source: ['app/api/error-report/route.js'],
  },
  errorReportHumanRequested: {
    name: 'התבקש מענה אנושי בדיווח תקלה',
    category: 'system',
    trigger: 'מדווח מדליק "אוף! אני צריך מענה אנושי!"',
    recipients: 'כל המתכנתים הפעילים (roleId=2)',
    subject: ({ reporterName } = {}) => `${reporterName} מבקש/ת מענה אנושי - דיווח תקלה`,
    template: 'renderHumanRequestedEmailHtml',
    gate: null,
    attachments: 'ללא',
    logged: true,
    routing: 'bugs_b_rest_a',
    source: ['app/api/error-report/route.js'],
  },
  agentDigest: {
    name: 'סיכום שינויי קוד הממתינים לאישור (סוכן אוטומטי)',
    category: 'system',
    trigger: 'Cron פעמיים ביום (~17:00 / ~00:00; לא בשבת/חג)',
    recipients: 'כל המתכנתים הפעילים (roleId=2)',
    subject: ({ count } = {}) => `${count} שינויים ממתינים לאישור מיזוג - מערכת הגמ"ח`,
    template: 'renderAgentDigestEmailHtml',
    gate: 'agent_digest_email_enabled + agent_digest_email_hours (בגמח הראשי בלבד)',
    attachments: 'ללא',
    logged: true,
    source: ['app/api/cron/agent-digest/route.js', 'lib/agentDigest.js'],
  },
};

/** הנושא של מייל לפי מזהה הקטלוג. מזהה לא מוכר = שגיאה מוקדמת ולא נושא ריק. */
export function emailSubject(id, params = {}) {
  const entry = EMAIL_CATALOG[id];
  if (!entry) throw new Error(`emailCatalog: מייל לא מוכר "${id}"`);
  return entry.subject(params);
}

/** רשימת כל המיילים (לתיעוד/מסכי ניהול), כולל המזהה ושם הקטגוריה בעברית. */
export function listEmailCatalog() {
  return Object.entries(EMAIL_CATALOG).map(([id, e]) => ({
    id,
    ...e,
    categoryLabel: EMAIL_CATEGORIES[e.category] || e.category,
    subjectExample: (() => { try { return e.subject({ orderId: 123, subject: 'נושא חופשי', title: 'כותרת', count: 3, batchId: 'bulk-1', hebrewDate: 'כז אלול', reporterName: 'דנה', groups: [] }); } catch { return ''; } })(),
  }));
}
