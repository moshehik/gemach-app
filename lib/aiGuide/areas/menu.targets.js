// lib/aiGuide/areas/menu.targets.js - יעדי ההצבעה של התפריט העליון החדש (MenuA5Shell): לשוניות, תפריטי הריחוף וכל הפריטים שבהם,
// והאייקונים שבצד (חיפוש, דיווח שגיאה, פעמון, משתמש...). המזהים תואמים ל-data-guide-id שמוצמד אוטומטית ב-menuParts.js / MenuTabPanel.js /
// MenuA5Shell.js: שורה בתפריט = `menu.<id מ-ITEM_DEFS>`, לשונית = `menu.tab-<id>`, חץ פתיחת התפריט של לשונית = `menu.tab-<id>-more`.
// הזמינות של כל יעד כאן נקבעת לפי עץ התפריט של המשתמשת (menuItem) - מי שאין לה את השורה לא תקבל אותה כיעד.
// הבדיקה scripts/test_ai_site_guide.mjs נכשלת אם נוסף פריט/לשונית ל-lib/menu/buildMenuTree.js בלי יעד כאן.

const tab = (id, label, aliases, extra = {}) => ({
  id: `menu.tab-${id}`, label, aliases, route: '*', kind: 'tab', menuItem: `tab:${id}`, ...extra,
});
const more = (id, label) => ({
  id: `menu.tab-${id}-more`, label: `תפריט "${label}"`, aliases: [`חץ ליד ${label}`, `תפריט נפתח של ${label}`], route: '*', kind: 'menu', menuItem: `tab:${id}`,
  where: `בסרגל העליון, החץ הקטן לצד הלשונית "${label}"`, hint: `החץ הקטן פותח את תפריט "${label}"`, parent: `menu.tab-${id}`,
});
const item = (itemId, tabId, label, aliases = [], extra = {}) => ({
  id: `menu.${itemId}`, label, aliases, route: '*', kind: 'link', menuItem: itemId,
  reveal: [{ menu: tabId }], parent: `menu.tab-${tabId}`, ...extra,
});

const MENU_TARGETS = [
  // לשוניות הסרגל
  tab('home', 'בית', ['דף הבית', 'ראשי', 'חיפוש ראשי']),
  tab('sched', 'לוז', ['לו"ז', 'לוח זמנים', 'לוח זמנים יומי', 'לוז יומי']),
  tab('month', 'לוח חודשי', ['יומן', 'לוח שנה', 'לוח חודש']),
  tab('admin', 'ניהול', ['מנהל', 'כלי ניהול', 'ניהול האתר']),
  tab('order', 'הזמנה', ['הזמנות', 'פתיחת הזמנה']),
  more('home', 'בית'), more('sched', 'לוז'), more('admin', 'ניהול'), more('order', 'הזמנה'),
  // לשונית "בית"
  item('home-search', 'home', 'חיפוש כללי', ['חיפוש', 'חיפוש לקוח או הזמנה']),
  item('recent-orders', 'home', 'הזמנות', ['חיפוש הזמנות', 'רשימת הזמנות']),
  item('recent-customers', 'home', 'לקוחות', ['חיפוש לקוחות', 'רשימת לקוחות']),
  item('recent-rentals', 'home', 'השכרות', ['מה נלקח', 'שמלות שנלקחו', 'רשימת השכרות']),
  item('recent-returns', 'home', 'החזרות', ['מה חוזר', 'שמלות שחוזרות', 'רשימת החזרות']),
  item('recent-alterations', 'home', 'תיקונים', ['תיקוני שמלות', 'רשימת תיקונים']),
  item('recent-all', 'home', 'שינויים אחרונים', ['מה פתחתי לאחרונה', 'אחרונים']),
  item('recent-mine', 'home', 'השינויים שלי', ['מה שיניתי', 'הפעולות שלי']),
  item('home-adv', 'home', 'חיפוש מתקדם', ['סינון מתקדם', 'חיפוש לפי תנאים']),
  // לשונית "לוז"
  item('sched-today', 'sched', 'היום', ['לוז של היום', 'לוח של היום']),
  item('sched-tomorrow', 'sched', 'מחר', ['לוז של מחר', 'לוח של מחר']),
  // לשונית "הזמנה"
  item('order-new', 'order', 'הזמנה חדשה', ['פתיחת הזמנה', 'להזמין', 'הזמנה', 'הוספת הזמנה']),
  item('order-kiosk', 'order', 'עמדת לקוח', ['קיוסק', 'מסך ללקוחה', 'קטלוג ללקוחה']),
  item('order-stock', 'order', 'בדיקת מלאי', ['זמינות', 'מה פנוי', 'בדיקת זמינות']),
  // לשונית "ניהול" (הפאנל המקוצר; שאר הכלים במסך "כל כלי הניהול")
  item('ad-settings', 'admin', 'הגדרות מערכת', ['הגדרות', 'הגדרות האתר']),
  item('ad-all', 'admin', 'כל כלי הניהול', ['מסך ניהול', 'לוח ניהול', 'ניהול ראשי']),
  item('ad-models', 'admin', 'דגמים', ['קטלוג דגמים', 'שמלות', 'קטלוג שמלות']),
  item('ad-staff', 'admin', 'עובדים', ['עובדות', 'נוכחות']),
  item('finance', 'admin', 'כספים', ['דשבורד', 'סיכום כספי']),
  item('ad-refunds', 'admin', 'זיכויים וחובות', ['זיכוי', 'חובות', 'יתרות']),
  item('ad-deliveries', 'admin', 'משלוחים', ['שליחויות', 'משלוח']),
  item('ad-nwd', 'admin', 'ימי אי-פעילות', ['ימי סגירה', 'חגים', 'ימים סגורים']),
  item('ad-site', 'admin', 'ניהול אתר', ['ניהול האתר למתכנת']),
  item('ad-perms', 'admin', 'הרשאות', ['הרשאות עובדות', 'מי רשאי']),
  item('ad-pricelist', 'admin', 'ניהול מחירון', ['מחירון', 'מחירים']),
  item('ad-stats', 'admin', 'סטטיסטיקה', ['דוחות', 'סטטיסטיקות']),
  item('ad-info', 'admin', 'מידע / היסטוריה', ['היסטוריית נתונים', 'מידע']),
  // אייקונים בצד הסרגל
  { id: 'rail.brand', label: 'לוגו הגמ"ח', aliases: ['לוגו', 'שם הגמ"ח', 'חזרה לבית'], route: '*', kind: 'link', where: 'בפינה הימנית העליונה של הסרגל העליון', hint: 'הלוגו מחזיר לדף הבית' },
  { id: 'rail.search', label: 'חיפוש', aliases: ['זכוכית מגדלת', 'חיפוש בתפריט', 'חיפוש דפים', 'אחרונים וניווט'], route: '*', kind: 'icon', where: 'בסרגל העליון, אייקון זכוכית המגדלת בצד השמאלי', hint: 'חיפוש בתפריט: מחפש דפים וכלים, ומראה אחרונים והיסטוריית ניווט' },
  { id: 'rail.error-report', label: 'דיווח על שגיאה', aliases: ['דיווח תקלה', 'באג', 'תקלה', 'לדווח על בעיה'], route: '*', kind: 'icon', where: 'בסרגל העליון, אייקון החרק בצד השמאלי', hint: 'דיווח על שגיאה בעמוד' },
  { id: 'rail.old-site', label: 'האתר הישן', aliases: ['לחזור לישן', 'תפריט ישן', 'עיצוב ישן'], route: '*', kind: 'icon', where: 'בסרגל העליון, אייקון "האתר הישן" (זמני) בצד השמאלי', hint: 'מעבר זמני לתצוגה הישנה' },
  { id: 'rail.bell', label: 'התראות', aliases: ['פעמון', 'הודעות מערכת', 'עדכונים'], route: '*', kind: 'icon', where: 'בסרגל העליון, אייקון הפעמון בצד השמאלי', hint: 'ההתראות שלך' },
  { id: 'rail.shift-clock', label: 'מצב עבודה', aliases: ['שעון משמרת', 'משמרת', 'שעות עבודה בזמן אמת'], route: '*', kind: 'icon', where: 'בסרגל העליון, ליד הפעמון (מופיע כשיש משמרת פתוחה)', hint: 'כמה זמן במשמרת' },
  { id: 'rail.user', label: 'תפריט המשתמש', aliases: ['הפרופיל שלי', 'ההתחברות', 'התנתקות', 'האזור האישי'], route: '*', kind: 'icon', where: 'בסרגל העליון, העיגול עם ראשי התיבות שלך בקצה השמאלי', hint: 'פרופיל, שעון נוכחות, השעות שלי והתנתקות' },
  { id: 'rail.burger', label: 'תפריט (נייד)', aliases: ['המבורגר', 'שלושה קווים', 'תפריט בטלפון'], route: '*', kind: 'icon', where: 'בטלפון: שלושת הקווים בסרגל העליון', hint: 'פותח את כל התפריט בטלפון' },
  // שורות הפעמון ותפריט המשתמש
  { id: 'menu.n-center', label: 'פתח מרכז הודעות', aliases: ['הודעות', 'הודעות פנימיות', 'מרכז הודעות'], route: '*', kind: 'link', menuItem: 'n-center', reveal: [{ menu: 'bell' }], parent: 'rail.bell' },
  { id: 'menu.n-manager-message', label: 'הודעה למנהל', aliases: ['לשלוח הודעה למנהלת', 'פנייה להנהלה'], route: '*', kind: 'link', menuItem: 'n-manager-message', reveal: [{ menu: 'bell' }], parent: 'rail.bell' },
  { id: 'menu.u-profile', label: 'הפרופיל שלי', aliases: ['פרטים אישיים', 'סיסמה', 'שינוי סיסמה'], route: '*', kind: 'link', menuItem: 'u-profile', reveal: [{ menu: 'user' }], parent: 'rail.user' },
  { id: 'menu.u-punch', label: 'שעון נוכחות', aliases: ['החתמת שעון', 'כניסה למשמרת', 'יציאה ממשמרת', 'שעון'], route: '*', kind: 'link', menuItem: 'u-punch', reveal: [{ menu: 'user' }], parent: 'rail.user' },
  { id: 'menu.u-hours', label: 'שעות העבודה שלי', aliases: ['השעות שלי', 'דוח שעות אישי'], route: '*', kind: 'link', menuItem: 'u-hours', reveal: [{ menu: 'user' }], parent: 'rail.user' },
  { id: 'menu.u-hist', label: 'היסטוריית הודעות מערכת', aliases: ['הודעות מערכת'], route: '*', kind: 'link', menuItem: 'u-hist', reveal: [{ menu: 'user' }], parent: 'rail.user' },
  { id: 'menu.u-logout', label: 'התנתקות', aliases: ['יציאה', 'לצאת מהמערכת', 'logout'], route: '*', kind: 'link', menuItem: 'u-logout', reveal: [{ menu: 'user' }], parent: 'rail.user' },
  { id: 'menu.u-login', label: 'היכנס למערכת', aliases: ['התחברות', 'כניסה'], route: '*', kind: 'link', menuItem: 'u-login', reveal: [{ menu: 'user' }], parent: 'rail.user' },
];

export const targets = MENU_TARGETS;
// תבניות data-guide-id דינמיות: הקידומת חייבת להופיע בקובץ כתבנית (`menu.${...}`), הבדיקה מאמתת
export const dynamic = [
  { prefix: 'menu.', file: 'app/components/menu/menuParts.js' },
  { prefix: 'menu.tab-', file: 'app/components/menu/MenuTabPanel.js' },
  { prefix: 'menu.tab-', file: 'app/components/menu/MenuA5Shell.js' },
];
