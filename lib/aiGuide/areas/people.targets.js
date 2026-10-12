// lib/aiGuide/areas/people.targets.js - יעדי ההצבעה של האזור (קובץ שנטען גם בדפדפן: רק נתונים, בלי imports של שרת)
// אזור "אנשים": לקוחות (רשימה + כרטיס לקוח החדש + לקוח חדש), דגמים (רשימה, כרטיס דגם, דגם חדש), מחירון, עובדים (רשימה, כרטיס עובד), נוכחות.
// כל המזהים תואמים ל-data-guide-id בקבצי הקומפוננטות (customer-card/*, dress-card/*, dress-new/*, models-list, employee-card/*, employees-list,
// attendance/*, app/customers/page.js, app/dashboard/pricelist/page.js). המסכים עם גרסה ישנה: מתועדת הגרסה החדשה (A5) בלבד.

const CUST = '/customers';
const CC = '/customers/:id';
const DL = '/dashboard/dresses';
const DC = '/dashboard/dresses/:id';
const DN = '/dashboard/dresses/new';
const PL = '/dashboard/pricelist';
const EL = '/employees';
const EC = '/employees/:id';
const AT = '/employees/attendance';


// ---- בקרי הרשימה המשותפים (a5-list) - המזהים נבנים מ-guide="<קידומת>" (ר' app/components/a5-list): חיפוש, סינון, מיון, חכם (AI), סטטיסטיקה, מתג תצוגה, ייצוא ----
const listCtl = (p, route, where, extra, names) => {
  const all = {
    search: { label: 'חיפוש', aliases: ['שורת חיפוש', 'לחפש', 'תיבת חיפוש'], kind: 'field' },
    filter: { label: 'סינון', aliases: ['לסנן', 'מסנן', 'פילטר'], kind: 'button', hint: 'בחירה מרובה; ליד כל אפשרות מוצג מספר התוצאות' },
    sort: { label: 'מיון', aliases: ['למיין', 'סדר הרשימה'], kind: 'button', hint: 'בוחרים עמודה ובתוך החלון גם כיוון עולה / יורד' },
    ai: { label: 'חיפוש חכם (AI)', aliases: ['חיפוש חכם', 'חיפוש בניסוח חופשי', 'ניצנוץ'], kind: 'toggle', hint: 'מקלידים בקשה בעברית חופשית והרשימה מסתננת' },
    stats: { label: 'שאלות סטטיסטיקה', aliases: ['סטטיסטיקה', 'ספירות'], kind: 'button' },
    view: { label: 'מתג רשימה / טבלה', aliases: ['תצוגת טבלה', 'תצוגת רשימה'], kind: 'toggle' },
    'export-excel': { label: 'ייצוא ל-Excel', aliases: ['אקסל', 'ייצוא לאקסל', 'להוריד לאקסל'], kind: 'button' },
    'export-download': { label: 'הורדה', aliases: ['הורדת PDF', 'PDF'], kind: 'button', hint: 'מוריד את הרשימה כקובץ PDF' },
    'export-print': { label: 'הדפסה', aliases: ['להדפיס את הרשימה', 'מדפסת'], kind: 'button' },
    back: { label: 'חזרה', aliases: ['חץ חזרה'], kind: 'button' },
  };
  return names.map((n) => ({ id: p + '.' + n, ...all[n], route, where, ...extra }));
};

// ---- /customers (רשימת לקוחות - דף אחד לשני הממשקים) ----
const WL = 'בדף "ניהול לקוחות"';
const custList = [
  { id: 'cust.list-new', label: 'לקוח חדש', aliases: ['הוספת לקוחה', 'לקוחה חדשה', 'להוסיף לקוח', 'יצירת לקוחה'], route: CUST, kind: 'button', where: `${WL}, בכותרת העליונה, הכפתור הכחול "לקוח חדש"`, hint: 'פותח טופס ללקוחה חדשה' },
  { id: 'cust.list-search', label: 'חיפוש לקוח', aliases: ['חיפוש לפי שם', 'חיפוש לפי טלפון', 'חיפוש לפי עיר', 'שדה חיפוש לקוחות'], route: CUST, kind: 'field', where: `${WL}, שורת החיפוש מתחת לכותרת (שם, טלפון, עיר)`, hint: 'מקלידים שם, טלפון או עיר ולוחצים "חיפוש"' },
  { id: 'cust.list-ai', label: 'חיפוש חכם (AI)', aliases: ['חיפוש חכם', 'חיפוש בעזרת בינה מלאכותית', 'כוכב'], route: CUST, kind: 'toggle', where: `${WL}, בשורת החיפוש, אייקון הכוכב`, hint: 'מעביר לחיפוש בניסוח חופשי, למשל "לקוחות מירושלים"' },
  { id: 'cust.list-adv', label: 'חיפוש מתקדם', aliases: ['סינון מתקדם', 'סינון לפי שדות'], route: CUST, kind: 'button', where: `${WL}, בכותרת העליונה, אייקון הרשימה לצד כפתור הייצוא`, hint: 'חלון סינון לפי שם פרטי, שם משפחה, טלפון, עיר ומייל' },
  { id: 'cust.list-table', label: 'טבלת הלקוחות', aliases: ['רשימת הלקוחות', 'שורת לקוחה'], route: CUST, kind: 'list', where: `${WL}, הטבלה שמתחת לשורת החיפוש`, hint: 'לחיצה על שורה פותחת את כרטיס הלקוח; לחיצה על כותרת עמודה ממיינת' },
];

// ---- כרטיס לקוח (החדש) ----
const CCW = 'בכרטיס הלקוח';
const ccTab = (id, label, aliases) => ({ id: `cc.tab-${id}`, label, aliases, route: CC, entity: true, kind: 'tab', where: `${CCW}, שורת הלשוניות מתחת לכותרת`, hint: `לשונית "${label}"` });
const ccIn = (tab, extra) => ({ route: CC, entity: true, reveal: [{ click: `cc.tab-${tab}` }], parent: `cc.tab-${tab}`, ...extra });
const ccField = (id, label, aliases, hint) => ccIn('details', { id: `cc.f-${id}`, label, aliases, kind: 'field', where: `${CCW}, בלשונית "פרטים", בכרטיס "פרטי לקוח"`, hint: hint || 'לעריכה לוחצים על העיפרון בכותרת הכרטיס, ואחר כך על "שמור" בצד' });
const ccTool = (id, label, aliases, where, hint, extra) => ({ id, label, aliases, route: CC, entity: true, kind: 'button', where: `${CCW}, בכותרת העליונה, ${where}`, hint, ...extra });
const ccMail = (id, label, aliases, where, kind, extra) => ({ id, label, aliases, route: CC, entity: true, kind: kind || 'field', where: `בחלון "מייל מהיר" (גיליון תחתון): ${where}`, reveal: [{ click: 'cc.tab-details' }, { click: 'cc.mail-quick' }], parent: 'cc.mail-quick', ...extra });
const cardTargets = [
  ccTool('cc.back', 'חזרה לרשימה', ['חזרה', 'חץ חזרה', 'יציאה מהכרטיס'], 'החץ בצד ימין', 'חזרה למסך הקודם; אם יש שינויים שלא נשמרו נשאלים מה לעשות'),
  ccTool('cc.tool-excel', 'ייצוא הלקוחה ל-Excel', ['אקסל', 'ייצוא לאקסל', 'להוריד לאקסל'], 'בקבוצת הכלים בצד שמאל, אייקון Excel', 'קובץ Excel עם פרטי הלקוחה, ההזמנות והתשלומים'),
  ccTool('cc.tool-download', 'הורדת כרטיס הלקוחה כקובץ', ['הורדה', 'הורדת PDF', 'כרטיס כ-PDF'], 'בקבוצת הכלים בצד שמאל, אייקון ההורדה', 'מוריד את כרטיס הלקוחה כקובץ PDF'),
  ccTool('cc.tool-print', 'הדפסה / מייל', ['הדפסה', 'תפריט הדפסה', 'מדפסת'], 'בקבוצת הכלים בצד שמאל, אייקון המדפסת', 'פותח תפריט: הדפסת כרטיס, דף חשבון, דף פרטי קשר ושליחה במייל'),
  ccTool('cc.tool-delete', 'מחיקת לקוחה', ['מחיקה', 'למחוק לקוחה', 'הסרת לקוחה', 'פח'], 'בקבוצת הכלים בצד שמאל, אייקון הפח', 'המחיקה דורשת אישור מנהל, ואי אפשר למחוק לקוחה עם הזמנות פעילות, שמלות שלא הוחזרו או חוב'),
  { id: 'cc.print-card', label: 'הדפסת כרטיס לקוחה', aliases: ['הדפסת כרטיס', 'להדפיס את הכרטיס'], route: CC, entity: true, kind: 'link', where: `${CCW}, בתפריט ההדפסה (אייקון המדפסת בכותרת)`, reveal: [{ click: 'cc.tool-print' }], parent: 'cc.tool-print' },
  { id: 'cc.print-account', label: 'דף חשבון', aliases: ['הדפסת חשבון', 'דף חשבון ללקוחה', 'חיובים ותשלומים להדפסה'], route: CC, entity: true, kind: 'link', where: `${CCW}, בתפריט ההדפסה (אייקון המדפסת בכותרת)`, reveal: [{ click: 'cc.tool-print' }], parent: 'cc.tool-print', hint: 'חיובים לפי הזמנה, תשלומים, זיכויים ויתרה' },
  { id: 'cc.print-contact', label: 'דף פרטי קשר', aliases: ['הדפסת פרטי קשר', 'פרטי קשר להדפסה'], route: CC, entity: true, kind: 'link', where: `${CCW}, בתפריט ההדפסה (אייקון המדפסת בכותרת)`, reveal: [{ click: 'cc.tool-print' }], parent: 'cc.tool-print' },
  { id: 'cc.mail-menu', label: 'שליחה במייל', aliases: ['שליחת מייל מהתפריט', 'מייל מתפריט ההדפסה'], route: CC, entity: true, kind: 'link', where: `${CCW}, בתפריט ההדפסה (אייקון המדפסת בכותרת), השורה האחרונה`, reveal: [{ click: 'cc.tool-print' }], parent: 'cc.tool-print', hint: 'פותח את חלון "מייל מהיר"' },
  ccTab('details', 'פרטים', ['פרטי לקוחה', 'פרטים אישיים']),
  ccTab('orders', 'הזמנות', ['ההזמנות של הלקוחה', 'רשימת הזמנות']),
  ccTab('payments', 'תשלומים', ['חובות', 'יתרה', 'חשבון', 'כסף']),
  ccTab('history', 'היסטוריה', ['יומן שינויים', 'מי שינה', 'פעולות ושינויים']),
  ccIn('details', { id: 'cc.edit-details', label: 'עריכת פרטי לקוח', aliases: ['עיפרון', 'לערוך פרטים', 'עריכה', 'שינוי פרטי לקוחה'], kind: 'button', where: `${CCW}, בלשונית "פרטים", בכותרת הכרטיס "פרטי לקוח", אייקון העיפרון`, hint: 'עיפרון פותח את השדות לעריכה; השמירה נעשית בלחצן "שמור" בסיכום שבצד' }),
  ccField('first', 'שם פרטי', ['שם', 'שם הלקוחה']),
  ccField('last', 'שם משפחה', ['משפחה']),
  ccField('phone', 'טלפון', ['מספר טלפון', 'נייד', 'פלאפון', 'לשנות טלפון']),
  ccField('phone2', 'טלפון נוסף', ['טלפון שני', 'טלפון בית']),
  ccField('email', 'מייל', ['דוא"ל', 'אימייל', 'כתובת מייל', 'לשנות מייל']),
  ccField('street', 'רחוב', ['כתובת', 'כתובת מגורים']),
  ccField('house', 'מספר בית', ['מס׳ בית', 'בית']),
  ccField('city', 'עיר', ['יישוב', 'עיר מגורים']),
  ccField('id', 'תעודת זהות', ['ת"ז', 'תז', 'מספר זהות']),
  ccIn('details', { id: 'cc.mail-quick', label: 'מייל מהיר', aliases: ['שליחת מייל', 'לשלוח מייל ללקוחה', 'מייל ללקוחה'], kind: 'button', where: `${CCW}, בלשונית "פרטים", ליד שדה "מייל" (בכרטיס "פרטי לקוח")`, hint: 'פותח חלון לשליחת מייל ללקוחה, עם אפשרות לצרף את מסמכי הלקוחה' }),
  ccIn('details', { id: 'cc.terms', label: 'חתמה על התקנון', aliases: ['תקנון', 'חתימה על תקנון', 'חתימה'], kind: 'toggle', where: `${CCW}, בלשונית "פרטים", בכרטיס "תקנון ועדכונים"`, hint: 'סימון חתימה על התקנון (נשמר ב"שמור")' }),
  ccIn('details', { id: 'cc.consent', label: 'מאשר/ת קבלת דיוורים', aliases: ['דיוור', 'דיוורים', 'הסכמה לדיוור', 'מבצעים במייל'], kind: 'toggle', where: `${CCW}, בלשונית "פרטים", בכרטיס "תקנון ועדכונים"`, hint: 'מתג הסכמה לתזכורות ועדכוני מבצעים במייל', access: { setting: ['hide_marketing_consent_field', '!true'] } }),
  ccIn('details', { id: 'cc.notes', label: 'הערות ללקוחה', aliases: ['הערות', 'הערה על לקוחה', 'לרשום הערה'], kind: 'field', where: `${CCW}, בלשונית "פרטים", בכרטיס "הערות ללקוחה"`, hint: 'ההערות מוצגות בהזמנה ומיועדות לצוות בלבד; נשמרות ב"שמור"' }),
  ccIn('details', { id: 'cc.bank-card', label: 'פרטי חשבון בנק לזיכויים', aliases: ['חשבון בנק', 'פרטי בנק', 'בנק לזיכוי'], kind: 'section', where: `${CCW}, בלשונית "פרטים", הכרטיס התחתון`, hint: 'לעריכה לוחצים על העיפרון בכרטיס', access: { setting: ['customer_bank_fields_enabled', 'true'] } }),
  ccIn('orders', { id: 'cc.orders-card', label: 'הזמנות', aliases: ['הזמנות הלקוחה', 'רשימת ההזמנות', 'פתיחת הזמנה של לקוחה'], kind: 'section', where: `${CCW}, בלשונית "הזמנות"`, hint: 'לחיצה על הזמנה פותחת את הפירוט, ובו "פתיחת הזמנה", תשלום והדפסת סיכום' }),
  ccIn('orders', { id: 'cc.orders-view', label: 'מתג רשימה / טבלה', aliases: ['תצוגת טבלה', 'תצוגת רשימה'], kind: 'toggle', where: `${CCW}, בלשונית "הזמנות", מעל הרשימה` }),
  ccIn('payments', { id: 'cc.pay-balance', label: 'מצב חשבון', aliases: ['יתרה', 'חוב', 'כמה היא חייבת', 'זיכוי'], kind: 'section', where: `${CCW}, בלשונית "תשלומים", הכרטיס העליון`, hint: 'יתרה = חיובים פחות (תשלומים פחות זיכויים)' }),
  ccIn('payments', { id: 'cc.pay-btn', label: 'תשלום', aliases: ['לשלם', 'קבלת תשלום', 'להוסיף תשלום', 'גביית חוב'], kind: 'button', where: `${CCW}, בלשונית "תשלומים", בכרטיס "מצב חשבון" (מופיע רק כשיש חוב פתוח)`, hint: 'פותח חלון תשלום: בוחרים הזמנה, סכום ואמצעי תשלום' }),
  ccIn('payments', { id: 'cc.pay-charges', label: 'חיובים פתוחים', aliases: ['הזמנות שלא שולמו', 'חובות פתוחים'], kind: 'section', where: `${CCW}, בלשונית "תשלומים"` }),
  ccIn('payments', { id: 'cc.pay-received', label: 'תשלומים שהתקבלו', aliases: ['תשלומים קודמים', 'היסטוריית תשלומים', 'זיכויים'], kind: 'section', where: `${CCW}, בלשונית "תשלומים"` }),
  ccIn('history', { id: 'cc.hist-search', label: 'חיפוש בהיסטוריה', aliases: ['חיפוש בשינויים'], kind: 'field', where: `${CCW}, בלשונית "היסטוריה", מעל הרשימה` }),
  ccIn('history', { id: 'cc.hist-filter', label: 'סינון', aliases: ['סינון היסטוריה', 'לסנן לפי סוג'], kind: 'button', where: `${CCW}, בלשונית "היסטוריה", לצד שורת החיפוש`, hint: 'בחירה מרובה לפי פרטים / הזמנה / תשלום / מסמך' }),
  ccIn('history', { id: 'cc.hist-view', label: 'מתג רשימה / טבלה', aliases: ['תצוגת טבלה בהיסטוריה'], kind: 'toggle', where: `${CCW}, בלשונית "היסטוריה"` }),
  ccIn('history', { id: 'cc.hist-excel', label: 'ייצוא ההיסטוריה ל-Excel', aliases: ['אקסל של ההיסטוריה'], kind: 'button', where: `${CCW}, בלשונית "היסטוריה", מעל הרשימה, אייקון Excel` }),
  ccIn('history', { id: 'cc.hist-download', label: 'הורדת ההיסטוריה כקובץ', aliases: ['PDF של ההיסטוריה'], kind: 'button', where: `${CCW}, בלשונית "היסטוריה", מעל הרשימה, אייקון ההורדה` }),
  ccIn('history', { id: 'cc.hist-print', label: 'הדפסת ההיסטוריה', aliases: ['להדפיס היסטוריה'], kind: 'button', where: `${CCW}, בלשונית "היסטוריה", מעל הרשימה, אייקון המדפסת` }),
  { id: 'cc.rail', label: 'סיכום', aliases: ['הסיכום בצד', 'עמודת הסיכום'], route: CC, entity: true, kind: 'section', where: `${CCW}, העמודה בצד שמאל ("סיכום"); בטלפון נפתחת מהלחצן "שינויים בכרטיס"`, hint: 'מציג חתימה, מספר הזמנות, מצב תשלום, והשינויים שעוד לא נשמרו' },
  { id: 'cc.rail-glance', label: 'מצב הלקוחה במבט', aliases: ['חתום', 'חסרים פרטים', 'שבבי הסיכום'], route: CC, entity: true, kind: 'section', where: `${CCW}, בראש עמודת הסיכום`, hint: 'שבבים: חתימה על תקנון, מספר הזמנות, מצב תשלום, השלמת פרטים', parent: 'cc.rail' },
  { id: 'cc.rail-changes', label: 'שינויים בכרטיס', aliases: ['רשימת שינויים', 'מה שיניתי', 'עגלת שינויים'], route: CC, entity: true, kind: 'section', where: `${CCW}, בעמודת הסיכום`, hint: 'כל שינוי מופיע כאן ואפשר לבטל אותו בנפרד', parent: 'cc.rail' },
  { id: 'cc.rail-save', label: 'שמור', aliases: ['שמירה', 'שמירת שינויים', 'איפה שומרים', 'לשמור את הכרטיס'], route: CC, entity: true, kind: 'button', where: `${CCW}, בעמודת הסיכום, בתחתית (מופיע רק אחרי שינוי)`, hint: 'זו הדרך היחידה לשמור את הכרטיס', parent: 'cc.rail-changes' },
  { id: 'cc.rail-discard', label: 'בטל שינויים', aliases: ['ביטול שינויים', 'לבטל הכול'], route: CC, entity: true, kind: 'button', where: `${CCW}, בעמודת הסיכום, מתחת ל"שמור" (מופיע רק אחרי שינוי)`, parent: 'cc.rail-changes' },
  { id: 'cc.rail-pay', label: 'שלם', aliases: ['תשלום מהסיכום', 'לשלם את החוב'], route: CC, entity: true, kind: 'button', where: `${CCW}, בתחתית עמודת הסיכום (כשיש חוב ואין שינויים שלא נשמרו)`, parent: 'cc.rail' },
  { id: 'cc.unblock', label: 'ביטול חסימה', aliases: ['לקוחה חסומה', 'לשחרר חסימה', 'חסימה'], route: CC, entity: true, kind: 'button', where: `${CCW}, בפס האזהרה "לקוח חסום מהזמנות חדשות" בראש הדף (רק ללקוחה חסומה)`, hint: 'זמין להנהלה ראשית בלבד', access: { gate: 'head' } },
  ccMail('cc.mail-subject', 'נושא', ['נושא המייל'], 'השדה העליון בעמודה הימנית', 'field'),
  ccMail('cc.mail-body', 'תוכן', ['גוף המייל', 'תוכן ההודעה', 'לכתוב מייל'], 'תיבת הטקסט הגדולה'),
  ccMail('cc.mail-docs', 'דפים לצירוף', ['צירוף כרטיס', 'לצרף דף חשבון', 'צירוף מסמכים'], 'רשימת המסמכים לצירוף (כרטיס לקוחה, דף חשבון, דף פרטי קשר, סיכומי הזמנות)', 'list'),
  ccMail('cc.mail-addfile', 'הוספת קובץ', ['צירוף קובץ', 'קבצים נוספים', 'להעלות קובץ'], 'הלחצן "הוספת קובץ" מתחת ל"קבצים נוספים"', 'button'),
  ccMail('cc.mail-dest', 'יעד הקבצים', ['דרייב', 'שיתוף בדרייב', 'צרופה למייל'], 'בורר "צרופה למייל / דרייב + שיתוף / גם וגם"', 'toggle'),
  ccMail('cc.mail-send', 'שלח מייל', ['שליחה', 'לשלוח'], 'הלחצן הראשי בתחתית; לפני השליחה נשאל אישור מנהל', 'button'),
];

// ---- לקוח חדש (/customers/new = אותו page.js של כרטיס לקוח) ----
const NF = 'בטופס "לקוח חדש", בכרטיס "פרטי לקוח"';
const nf = (id, label, aliases, hint) => ({ id: `cust.new-${id}`, label, aliases, route: CC, entity: true, kind: 'field', where: NF, hint });
const newCustomer = [
  nf('first', 'שם פרטי', ['שם'], 'שדה חובה כשהוגדר כחובה בהגדרות'),
  nf('last', 'שם משפחה', ['משפחה']),
  nf('phone', 'טלפון', ['נייד', 'מספר טלפון']),
  nf('phone2', 'טלפון נוסף', ['טלפון שני']),
  nf('email', 'מייל', ['דוא"ל', 'אימייל']),
  nf('street', 'רחוב', ['כתובת']),
  nf('house', 'מספר בית', ['בית']),
  nf('city', 'עיר', ['יישוב']),
  nf('id', 'תעודת זהות', ['ת"ז', 'תז']),
  { id: 'cust.new-consent', label: 'מאשר/ת קבלת דיוורים', aliases: ['דיוור', 'הסכמה לדיוור'], route: CC, entity: true, kind: 'toggle', where: NF },
  { id: 'cust.new-notes', label: 'הערות ללקוחה', aliases: ['הערות'], route: CC, entity: true, kind: 'field', where: 'בטופס "לקוח חדש", בכרטיס "הערות ללקוחה"' },
  { id: 'cust.new-save', label: 'שמירת לקוחה', aliases: ['שמירה', 'לשמור לקוחה חדשה', 'סיום'], route: CC, entity: true, kind: 'button', where: 'בטופס "לקוח חדש", הלחצן הכחול בתחתית', hint: 'אחרי השמירה נפתח כרטיס הלקוחה' },
];

// ---- רשימת דגמים (החדשה) ----
const models = [
  { id: 'mod.new', label: 'דגם חדש', aliases: ['הוספת דגם', 'להוסיף שמלה חדשה', 'יצירת דגם', 'דגם חדש לקטלוג'], route: DL, kind: 'button', where: 'בדף "דגמים", בכרטיס "קטלוג דגמים", בכותרת הכרטיס (בצד שמאל)', hint: 'פותח את אשף יצירת הדגם', access: { gate: 'head' } },
];

// ---- דגם חדש (אשף) ----
const MNW = 'באשף "דגם חדש"';
const mn = (id, label, aliases, where, kind, extra) => ({ id: `mn.${id}`, label, aliases, route: DN, kind, where: `${MNW}, ${where}`, ...extra });
const newModel = [
  mn('back', 'חזרה לרשימת הדגמים', ['חזרה', 'יציאה מהאשף'], 'החץ בכותרת, בצד ימין', 'button'),
  mn('progress', 'פס ההתקדמות', ['שלבי האשף', 'מקטעים'], 'פס דק בראש הדף (4 מקטעים: זיהוי הדגם, תמונה והערות, מלאי ראשוני, סיכום)', 'section', { hint: 'לחיצה על מקטע גוללת אליו' }),
  mn('code', 'קוד דגם', ['קוד', 'מספר דגם', 'קידומת ברקוד'], 'מקטע 01 "איזה דגם?"', 'field', { hint: 'קידומת הברקוד של הפריטים; לא ניתן לשנות אחרי היצירה' }),
  mn('code-auto', 'קוד פנוי', ['הקוד הבא', 'קוד אוטומטי'], 'מקטע 01, ליד שדה "קוד דגם"', 'button', { hint: 'ממלא את הקוד הפנוי הבא במאגר' }),
  mn('name', 'שם דגם', ['שם', 'שם השמלה'], 'מקטע 01, ליד שדה הקוד', 'field', { hint: 'שדה חובה כשמשתמשים בשמות דגמים', access: { setting: ['useModelNames', '!false'] } }),
  mn('cat', 'קטגוריית מחיר', ['קטגוריה', 'מחיר', 'כמה עולה הדגם'], 'מקטע 01 "איזה דגם?"', 'field', { hint: 'רשימה נפתחת; המחיר נקבע לפי הקטגוריה והמידה במחירון' }),
  mn('entry-btn', 'שינוי תאריך', ['תאריך כניסה למאגר', 'תאריך כניסה'], 'מקטע 01, ליד "תאריך כניסה למאגר"', 'button'),
  mn('img-up', 'העלאת תמונה', ['תמונה', 'להעלות תמונה', 'הוספת תמונה'], 'מקטע 02 "איך הוא נראה?", בכרטיס "תמונת הדגם"', 'button', { hint: 'אפשר לדלג: ללא תמונה המערכת מחפשת קובץ בשם קוד הדגם', access: { setting: ['hide_dress_images', '!true'] } }),
  mn('img-url', 'תמונה לפי כתובת', ['כתובת תמונה', 'קישור לתמונה'], 'מקטע 02, בכרטיס "תמונת הדגם", הלחצן "כתובת"', 'button', { access: { setting: ['hide_dress_images', '!true'] } }),
  mn('notes', 'הערות לדגם', ['הערות', 'הערה לדגם'], 'מקטע 02, בכרטיס "הערות לדגם"', 'field'),
  mn('inspect', 'הצג בבדיקה', ['דגם בבדיקה', 'בבדיקה'], 'מקטע 02, מתג "הצג בבדיקה"', 'toggle'),
  mn('size', 'מידה', ['מידה לפריט', 'להוסיף מידה'], 'מקטע 03 "כמה יש במלאי?", בכרטיס "הוספת פריט"', 'field'),
  mn('serial', 'מס׳ סידורי', ['סידורי', 'מספר סידורי'], 'מקטע 03, ליד שדה "מידה"', 'field', { hint: 'ריק = מספור אוטומטי' }),
  mn('loc', 'מיקום', ['מיקום הפריט', 'איפה השמלה'], 'מקטע 03, בכרטיס "הוספת פריט"', 'toggle'),
  mn('add-item', 'הוסף פריט', ['הוספת פריט', 'הוספת מידה', 'להוסיף פריט לדגם'], 'מקטע 03, בכרטיס "הוספת פריט"', 'button', { hint: 'כל שורה היא פריט אחד; הברקוד נבנה מקוד הדגם + מידה + סידורי' }),
  mn('cancel', 'ביטול', ['יציאה בלי ליצור'], 'בתחתית מקטע 04, בצד ימין', 'button'),
  mn('create', 'יצירת הדגם', ['שמירת הדגם', 'סיום', 'ליצור את הדגם'], 'בתחתית מקטע 04 "הכול נכון?"', 'button', { hint: 'פעיל רק אחרי שזיהוי הדגם תקין; יצירת דגם שמורה להנהלה ראשית', access: { gate: 'head' } }),
];

// ---- כרטיס דגם (החדש) ----
const DCW = 'בכרטיס הדגם';
const dcTool = (id, label, aliases, where, hint, extra) => ({ id, label, aliases, route: DC, entity: true, kind: 'button', where: `${DCW}, בכותרת העליונה, ${where}`, hint, ...extra });
const dcTab = (id, label, aliases) => ({ id: `dc.tab-${id}`, label, aliases, route: DC, entity: true, kind: 'tab', where: `${DCW}, שורת הלשוניות מתחת לכותרת`, hint: `לשונית "${label}"` });
const dcIn = (tab, extra) => ({ route: DC, entity: true, reveal: [{ click: `dc.tab-${tab}` }], parent: `dc.tab-${tab}`, ...extra });
const dcDet = (id, label, aliases, where, kind, extra) => dcIn('details', { id: `dc.${id}`, label, aliases, kind, where: `${DCW}, בלשונית "פרטים", ${where}`, ...extra });
const pm = (act, label, aliases) => ({ id: `dc.pm-${act}`, label, aliases, route: DC, entity: true, kind: 'link', where: `${DCW}, בתפריט ההדפסה (אייקון המדפסת בכותרת)`, reveal: [{ click: 'dc.tool-print' }], parent: 'dc.tool-print' });
const dressCard = [
  dcTool('dc.back', 'חזרה לרשימת הדגמים', ['חזרה', 'חץ חזרה'], 'החץ בצד ימין', 'אם יש שינויים שלא נשמרו נשאלים מה לעשות'),
  dcTool('dc.scan', 'סריקת ברקוד', ['חיפוש פריט לפי ברקוד', 'להקליד ברקוד', 'איתור פריט'], 'שדה הסריקה באמצע הכותרת', 'סורקים או מקלידים ברקוד של פריט בדגם: עובר ללשונית "פריטים" ומדגיש אותו', { kind: 'field' }),
  dcTool('dc.tool-excel', 'ייצוא פריטי הדגם ל-Excel', ['אקסל', 'ייצוא לאקסל'], 'בקבוצת הכלים בצד שמאל, אייקון Excel', 'קובץ Excel עם כל הפריטים של הדגם'),
  dcTool('dc.tool-pdf', 'הורדת כרטיס הדגם כ-PDF', ['הורדה', 'PDF', 'הורדת כרטיס דגם'], 'בקבוצת הכלים בצד שמאל, אייקון ההורדה', 'מוריד את כרטיס הדגם כקובץ PDF'),
  dcTool('dc.tool-print', 'הדפסה', ['תפריט הדפסה', 'מדפסת', 'להדפיס דגם'], 'בקבוצת הכלים בצד שמאל, אייקון המדפסת', 'תפריט: הדפסת כרטיס דגם, רשימת פריטים ומיקומים, רשימת השכרות, מדבקות ברקוד, והורדה כ-PDF של כל אחד מהם'),
  dcTool('dc.tool-delete', 'מחיקת דגם', ['מחיקה', 'למחוק דגם', 'להסתיר דגם', 'פח'], 'בקבוצת הכלים בצד שמאל, אייקון הפח', 'מחיקה רכה (אפשר לשחזר); אי אפשר למחוק דגם שיש בו פריטים פעילים. שמורה להנהלה ראשית', { access: { gate: 'head' } }),
  dcTool('dc.tool-restore', 'שחזור דגם', ['לשחזר דגם', 'להחזיר דגם מחוק'], 'בקבוצת הכלים בצד שמאל (בדגם מחוק במקום אייקון הפח)', 'מחזיר דגם מחוק לרשימת הדגמים', { access: { gate: 'head' } }),
  pm('print-card', 'הדפסת כרטיס דגם', ['הדפסת הכרטיס']),
  pm('print-items', 'רשימת פריטים ומיקומים', ['הדפסת פריטים', 'מיקומים להדפסה']),
  pm('print-rentals', 'רשימת השכרות', ['הדפסת השכרות']),
  pm('print-labels', 'מדבקות ברקוד לפריטים', ['מדבקות', 'הדפסת ברקודים', 'ברקודים להדפסה']),
  pm('pdf-card', 'הורדה כ-PDF: כרטיס דגם', ['PDF כרטיס דגם']),
  pm('pdf-items', 'הורדה כ-PDF: רשימת פריטים ומיקומים', ['PDF פריטים']),
  pm('pdf-rentals', 'הורדה כ-PDF: רשימת השכרות', ['PDF השכרות']),
  pm('pdf-labels', 'הורדה כ-PDF: מדבקות ברקוד', ['PDF מדבקות']),
  dcTab('details', 'פרטים', ['פרטי דגם', 'זיהוי הדגם']),
  dcTab('items', 'פריטים', ['מידות', 'מלאי', 'ברקודים', 'פריטים ומלאי']),
  dcTab('rentals', 'השכרות', ['הזמנות של הדגם', 'מי שכרה', 'היסטוריית השכרות']),
  dcTab('history', 'היסטוריה', ['יומן הדגם', 'שינויים בדגם']),
  { id: 'dc.rail', label: 'סיכום', aliases: ['הסיכום בצד', 'עמודת הסיכום'], route: DC, entity: true, kind: 'section', where: `${DCW}, העמודה בצד שמאל ("סיכום"); בטלפון נפתחת מהלחצן "שינויים בכרטיס"`, hint: 'צ׳יפים של פעיל / לא פעיל, פריטים, זמינים, בתיקון, לא בשימוש וברזרבה, ורשימת השינויים שעוד לא נשמרו' },
  { id: 'dc.rail-glance', label: 'צ׳יפים בסיכום', aliases: ['בתיקון', 'לא בשימוש', 'ברזרבה', 'זמינים'], route: DC, entity: true, kind: 'section', where: `${DCW}, בראש עמודת הסיכום`, hint: 'לחיצה על צ׳יפ עוברת ללשונית "פריטים" עם הסינון המתאים', parent: 'dc.rail' },
  { id: 'dc.rail-status', label: 'פעיל / לא פעיל', aliases: ['סימון דגם כלא פעיל', 'הוצאה מהמאגר', 'הפעלת דגם'], route: DC, entity: true, kind: 'toggle', where: `${DCW}, הצ׳יפ הראשון בעמודת הסיכום`, hint: 'לחיצה על דגם פעיל פותחת חלון סיבה ותאריך יציאה מהמאגר; על דגם לא פעיל - מחזירה לפעילות', parent: 'dc.rail' },
  { id: 'dc.rail-changes', label: 'שינויים בכרטיס', aliases: ['רשימת שינויים', 'מה שיניתי'], route: DC, entity: true, kind: 'section', where: `${DCW}, בעמודת הסיכום`, hint: 'כל עריכה נכנסת לכאן ונשמרת רק בלחיצה על "שמור"', parent: 'dc.rail' },
  { id: 'dc.rail-save', label: 'שמור', aliases: ['שמירה', 'איפה שומרים', 'לשמור את הדגם'], route: DC, entity: true, kind: 'button', where: `${DCW}, בעמודת הסיכום, בתחתית (מופיע רק אחרי שינוי)`, hint: 'שמירת שינויים בדגם דורשת הנהלה ראשית; החלפת פעיל / לא פעיל פתוחה לכולן', parent: 'dc.rail-changes' },
  { id: 'dc.rail-discard', label: 'בטל שינויים', aliases: ['ביטול שינויים'], route: DC, entity: true, kind: 'button', where: `${DCW}, בעמודת הסיכום, מתחת ל"שמור" (מופיע רק אחרי שינוי)`, parent: 'dc.rail-changes' },
  dcDet('edit-details', 'עריכת פרטי דגם', ['עיפרון', 'לערוך דגם', 'שינוי פרטי דגם'], 'בכרטיס "זיהוי הדגם", אייקון העיפרון בכותרת הכרטיס', 'button', { hint: 'פותח את שם הדגם, הקטגוריה והתאריך לעריכה; השמירה בלחצן "שמור" בסיכום' }),
  dcDet('f-code', 'קוד דגם', ['קוד', 'קידומת ברקוד', 'מספר דגם'], 'בכרטיס "זיהוי הדגם"', 'field', { hint: 'הקוד ננעל אחרי יצירת הדגם כי הוא מרכיב את ברקודי הפריטים' }),
  dcDet('f-name', 'שם דגם', ['שם', 'שם השמלה', 'לשנות שם דגם'], 'בכרטיס "זיהוי הדגם" (מוצג רק כשהגדרת שמות הדגמים פעילה)', 'field', { access: { setting: ['useModelNames', '!false'] } }),
  dcDet('f-cat', 'קטגוריית מחיר', ['קטגוריה', 'לשנות קטגוריה', 'מחיר הדגם'], 'בכרטיס "זיהוי הדגם"', 'field', { hint: 'בעריכה: רשימה נפתחת של הקטגוריות מהמחירון' }),
  dcDet('f-entry', 'תאריך כניסה למאגר', ['תאריך כניסה', 'מתי נכנס הדגם'], 'בכרטיס "זיהוי הדגם"', 'field', { hint: 'בעריכה: הלחצן "שינוי תאריך" פותח בחירה בלוח עברי' }),
  dcDet('price-link', 'מחירון', ['מחירון הקטגוריה', 'כמה עולה', 'מעבר למחירון'], 'בכרטיס "זיהוי הדגם", ליד קטגוריית המחיר', 'link', { hint: 'פותח את דף המחירון בלשונית חדשה' }),
  dcDet('status-pill', 'סטטוס הדגם', ['דגם פעיל', 'דגם לא פעיל', 'הוצאת דגם מהמאגר'], 'בכרטיס "מצב הדגם", הבורר "פעיל / לא פעיל"', 'toggle', { hint: '"לא פעיל" פותח חלון עם סיבה ותאריך יציאה מהמאגר' }),
  dcDet('inspect', 'הצג בבדיקה', ['דגם בבדיקה', 'בבדיקה'], 'בכרטיס "מצב הדגם"', 'toggle', { hint: 'סימון בלבד: הדגם מסומן "בבדיקה" בהדפסת הכרטיס; לא חוסם השכרה' }),
  dcDet('premium', 'שמלת פרימיום', ['פרימיום'], 'בכרטיס "מצב הדגם" (מוצג רק כשתמחור פרימיום מופעל בהגדרות)', 'toggle', { access: { setting: ['premium_pricing_enabled', 'true'] } }),
  dcDet('img-upload', 'העלאה / החלפה של תמונה', ['תמונה', 'להעלות תמונה', 'החלפת תמונה', 'תמונת הדגם'], 'בכרטיס "תמונת הדגם"', 'button', { hint: 'מעלה קובץ תמונה; השמירה בלחצן "שמור" בסיכום', access: { setting: ['hide_dress_images', '!true'] } }),
  dcDet('img-url', 'כתובת תמונה', ['קישור לתמונה', 'תמונה לפי כתובת'], 'בכרטיס "תמונת הדגם", הלחצן "כתובת"', 'button', { access: { setting: ['hide_dress_images', '!true'] } }),
  dcDet('notes', 'הערות לדגם', ['הערות', 'הערה על הדגם'], 'בכרטיס "הערות לדגם"', 'field', { hint: 'מוצג לצוות בלבד' }),
  dcIn('items', { id: 'dc.items-card', label: 'פריטים ומלאי', aliases: ['רשימת הפריטים', 'מידות הדגם', 'פריטים בדגם'], kind: 'section', where: `${DCW}, בלשונית "פריטים"`, hint: 'חיפוש, סינון (סטטוס, מיקום, מידה) ומיון; לחיצה על שורה פותחת עריכת פריט' }),
  dcIn('items', { id: 'dc.item-add', label: 'הוסף פריט', aliases: ['הוספת פריט', 'הוספת מידה', 'להוסיף מידה לדגם', 'פריט חדש'], kind: 'button', where: `${DCW}, בלשונית "פריטים", בכותרת הכרטיס "פריטים ומלאי"`, hint: 'פותח חלון הוספת פריט (מידה, סידורי, מיקום); הברקוד נבנה אוטומטית', access: { pageKey: 'feature:dress_items_manage' } }),
  dcIn('items', { id: 'dc.add-size', label: 'מידה', aliases: ['מידת הפריט'], kind: 'field', where: 'בחלון "הוספת פריט"', reveal: [{ click: 'dc.tab-items' }, { click: 'dc.item-add' }, { wait: 300 }], parent: 'dc.item-add' }),
  dcIn('items', { id: 'dc.add-serial', label: 'מס׳ סידורי', aliases: ['סידורי'], kind: 'field', where: 'בחלון "הוספת פריט"', hint: 'ריק = מספור אוטומטי', reveal: [{ click: 'dc.tab-items' }, { click: 'dc.item-add' }, { wait: 300 }], parent: 'dc.item-add' }),
  dcIn('items', { id: 'dc.add-loc', label: 'מיקום', aliases: ['מיקום הפריט'], kind: 'toggle', where: 'בחלון "הוספת פריט"', reveal: [{ click: 'dc.tab-items' }, { click: 'dc.item-add' }, { wait: 300 }], parent: 'dc.item-add' }),
  dcIn('items', { id: 'dc.add-ok', label: 'הוסף לדגם', aliases: ['אישור הוספת פריט'], kind: 'button', where: 'בחלון "הוספת פריט", הלחצן הראשי', hint: 'הפריט נכנס ל"שינויים בכרטיס" ונשמר ב"שמור"', reveal: [{ click: 'dc.tab-items' }, { click: 'dc.item-add' }, { wait: 300 }], parent: 'dc.item-add' }),
  dcIn('rentals', { id: 'dc.rentals-summary', label: 'סיכום השכרות', aliases: ['כמה פעמים הושכר', 'מושכר כרגע', 'באיחור'], kind: 'section', where: `${DCW}, בלשונית "השכרות", הכרטיס העליון`, hint: 'סה״כ, שנה אחרונה, מושכר כרגע, באיחור' }),
];

// ---- מחירון ----
const PLW = 'בדף "ניהול מחירון"';
const pr = (id, label, aliases, where, kind, extra) => ({ id: `price.${id}`, label, aliases, route: PL, kind, where: `${PLW}, ${where}`, ...extra });
const pricelist = [
  pr('lock', 'מחיקה נעולה / מחיקה פתוחה', ['נעילת מחיקה', 'לפתוח מחיקה', 'מחיקת שורה נעולה'], 'בכותרת העליונה', 'toggle', { hint: 'ברירת המחדל נעולה; פתיחה דורשת אישור הנהלה ראשית / מתכנת' }),
  pr('new', 'מחירון חדש', ['קטגוריה חדשה', 'הוספת קטגוריה', 'הוספת מחיר חדש'], 'בכותרת העליונה', 'button', { hint: 'פותח טופס להוספת קטגוריה / שורת מחיר חדשה' }),
  pr('add-row', 'הוסף שורה לקטגוריה', ['הוספת שורה', 'טווח מידות חדש', 'להוסיף מחיר'], 'מעל כל טבלת קטגוריה, בצד שמאל', 'button', { hint: 'מוסיף שורה בקטגוריה, והמידה "מ-" מוצעת אחרי הטווח האחרון' }),
  pr('row-edit', 'עריכת שורה', ['עריכת מחיר', 'לשנות מחיר', 'עיפרון', 'שינוי מחיר השכרה'], 'בעמודת "פעולות" בכל שורה, אייקון העיפרון', 'button', { hint: 'פותח את השורה לעריכה במקום; שומרים בלחצן הוי הירוק' }),
  pr('row-delete', 'מחיקת שורה', ['מחיקת מחיר', 'למחוק שורה', 'פח'], 'בעמודת "פעולות" בכל שורה, ליד העיפרון', 'button', { hint: 'כבוי כל עוד "מחיקה נעולה"' }),
  pr('nf-category', 'קטגוריה', ['שם קטגוריה'], 'בטופס "הוספת קטגוריה / שורה חדשה" שבראש הדף', 'field', { reveal: [{ click: 'price.new' }], parent: 'price.new', hint: 'בטופס גם: תיאור, ממידה, עד מידה, מחיר ופיקדון' }),
  pr('nf-save', 'שמור', ['שמירת קטגוריה חדשה'], 'בטופס "הוספת קטגוריה / שורה חדשה", בתחתית', 'button', { reveal: [{ click: 'price.new' }], parent: 'price.new' }),
  pr('er-desc', 'תיאור', ['תיאור השורה'], 'בשורה שבעריכה (עמודה ראשונה)', 'field', { reveal: [{ click: 'price.row-edit' }], parent: 'price.row-edit' }),
  pr('er-sizes', 'מידות (מ- עד)', ['טווח מידות', 'ממידה עד מידה'], 'בשורה שבעריכה, שתי תיבות "מ-" ו"עד"', 'field', { reveal: [{ click: 'price.row-edit' }], parent: 'price.row-edit' }),
  pr('er-price', 'מחיר השכרה', ['מחיר', 'כמה עולה להשכיר'], 'בשורה שבעריכה', 'field', { reveal: [{ click: 'price.row-edit' }], parent: 'price.row-edit' }),
  pr('er-deposit', 'החזר פיקדון', ['פיקדון', 'ערבון'], 'בשורה שבעריכה', 'field', { reveal: [{ click: 'price.row-edit' }], parent: 'price.row-edit' }),
  pr('er-save', 'שמור', ['שמירת שורה', 'וי'], 'בשורה שבעריכה, אייקון הוי הירוק בעמודת "פעולות"', 'button', { reveal: [{ click: 'price.row-edit' }], parent: 'price.row-edit' }),
];

// ---- עובדים ----
const employees = [
  { id: 'emp.new', label: 'עובד חדש', aliases: ['הוספת עובדת', 'עובדת חדשה', 'להוסיף עובד', 'יצירת עובדת'], route: EL, kind: 'button', where: 'בדף "עובדים ונוכחות", בכרטיס "רשימת עובדים", בכותרת הכרטיס (בצד שמאל)', hint: 'פותח טופס עובד חדש' },
];

// ---- כרטיס עובד (החדש) ----
const ECW = 'בכרטיס העובד';
const ecTab = (id, label, aliases) => ({ id: `ec.tab-${id}`, label, aliases, route: EC, entity: true, kind: 'tab', where: `${ECW}, שורת הלשוניות (בעובד קיים)`, hint: `לשונית "${label}"` });
const ecIn = (tab, extra) => ({ route: EC, entity: true, reveal: [{ click: `ec.tab-${tab}` }], parent: `ec.tab-${tab}`, ...extra });
const ecDet = (id, label, aliases, where, kind, extra) => ecIn('details', { id: `ec.${id}`, label, aliases, kind, where: `${ECW}, בלשונית "פרטי עובד", ${where}`, ...extra });
const employeeCard = [
  { id: 'ec.back', label: 'חזרה', aliases: ['חץ חזרה', 'יציאה מהכרטיס'], route: EC, entity: true, kind: 'button', where: `${ECW}, בכותרת, החץ בצד ימין` },
  ecTab('details', 'פרטי עובד', ['פרטים', 'פרטים אישיים']),
  ecTab('attendance', 'נוכחות וסיכום', ['נוכחות', 'משמרות', 'שעות', 'דוח שעות של העובדת']),
  ecTab('history', 'היסטוריה', ['היסטוריית שינויים', 'מי שינה']),
  ecDet('avatar', 'תמונת פרופיל', ['תמונה', 'להעלות תמונה לעובדת'], 'בכרטיס "פרטים אישיים"', 'button', { hint: 'לחיצה או גרירת קובץ תמונה (עד 2MB)' }),
  ecDet('f-first', 'שם פרטי', ['שם'], 'בכרטיס "פרטים אישיים"', 'field'),
  ecDet('f-last', 'שם משפחה', ['משפחה'], 'בכרטיס "פרטים אישיים"', 'field'),
  ecDet('f-phone1', 'טלפון נייד', ['טלפון', 'נייד', 'פלאפון'], 'בכרטיס "יצירת קשר"', 'field'),
  ecDet('f-phone2', 'טלפון נוסף', ['טלפון שני'], 'בכרטיס "יצירת קשר"', 'field'),
  ecDet('f-email', 'דוא"ל', ['מייל', 'אימייל', 'כתובת מייל'], 'בכרטיס "יצירת קשר"', 'field'),
  ecDet('mail-open', 'שלח מייל', ['שליחת מייל לעובדת', 'מייל לעובד'], 'בכרטיס "יצירת קשר", אייקון המעטפה ליד שדה הדוא"ל (מופיע בעובד קיים עם מייל)', 'button', { hint: 'פותח חלון שליחת מייל; לפני השליחה נדרש אישור מנהל' }),
  ecDet('f-city', 'עיר', ['כתובת', 'רחוב', 'עיר מגורים'], 'בכרטיס "כתובת" (עיר, רחוב, בית)', 'field'),
  ecDet('f-password-new', 'סיסמא לשעון נוכחות', ['סיסמה לעובד חדש', 'קוד שעון', 'סיסמה'], 'בכרטיס "אבטחה" (בטופס עובד חדש)', 'field'),
  ecDet('pw-change', 'שינוי סיסמא', ['לשנות סיסמה', 'החלפת סיסמה'], 'בכרטיס "אבטחה" (בעובד קיים)', 'button', { hint: 'דורש את הסיסמה הנוכחית, או סיסמת מנהל בכרטיס של עובד אחר' }),
  ecDet('pw-reset', 'אפס ושלח למייל', ['איפוס סיסמה', 'שכחתי סיסמה', 'שליחת סיסמה חדשה'], 'בכרטיס "אבטחה" (בעובד קיים)', 'button', { hint: 'מאפס ושולח סיסמה חדשה למייל העובד, באישור מנהל' }),
  ecDet('pw-set', 'קבע סיסמה ידנית', ['קביעת סיסמה', 'סיסמה ידנית'], 'בכרטיס "אבטחה" (בעובד קיים)', 'button', { hint: 'קובעים סיסמה חדשה לעובד, באישור מנהל' }),
  ecDet('f-dept', 'מחלקה (תפקיד)', ['מחלקה', 'תפקיד', 'הרשאות לפי מחלקה', 'סוג עובד'], 'בכרטיס "מחלקה, סטטוס והערות"', 'field', { hint: 'המחלקה קובעת את ההרשאות כברירת מחדל' }),
  ecDet('f-active', 'עובד פעיל במערכת', ['פעיל', 'השבתת עובדת', 'עובדת שעזבה', 'הסרת עובדת'], 'בכרטיס "מחלקה, סטטוס והערות"', 'toggle', { hint: 'אין מחיקת עובדים; מכבים כאן כדי להשבית' }),
  ecDet('f-alerts', 'קבלת התראות מערכת למייל', ['התראות למייל'], 'בכרטיס "מחלקה, סטטוס והערות"', 'toggle'),
  ecDet('f-notes', 'הערות', ['הערות על עובדת'], 'בכרטיס "מחלקה, סטטוס והערות"', 'field'),
  ecDet('f-wage', 'שכר לשעה', ['שכר', 'משכורת', 'תעריף שעתי'], 'בכרטיס "נתוני שכר"', 'field', { hint: 'מחושב מתוך המשמרות בנוכחות' }),
  ecDet('f-paymethod', 'אופן תשלום', ['תשלום שכר'], 'בכרטיס "נתוני שכר"', 'field'),
  ecDet('f-travel', 'זכאות לנסיעות', ['נסיעות', 'החזר נסיעות'], 'בכרטיס "נתוני שכר"', 'toggle'),
  ecDet('perm', 'הרשאות ספציפיות', ['הרשאות', 'הרשאות לעובדת', 'מה העובדת מורשית', 'חריגה אישית'], 'כרטיס "הרשאות ספציפיות" בתחתית (בעובד קיים)', 'section', { hint: '10 קטגוריות מתקפלות; מתג לכל הרשאה יוצר חריגה אישית, "איפוס" מחזיר לברירת המחדל. נשמר מיד, בלי "שמור פרטים"' }),
  ecDet('save', 'שמור פרטים', ['שמירה', 'לשמור עובד', 'איפה שומרים'], 'הלחצן הכחול בתחתית הלשונית', 'button'),
  ecIn('details', { id: 'ec.mail-to', label: 'אל (To)', aliases: ['נמען'], kind: 'field', where: 'בחלון "שליחת מייל"', reveal: [{ click: 'ec.tab-details' }, { click: 'ec.mail-open' }, { wait: 300 }], parent: 'ec.mail-open' }),
  ecIn('details', { id: 'ec.mail-subject', label: 'נושא', aliases: ['נושא המייל'], kind: 'field', where: 'בחלון "שליחת מייל"', reveal: [{ click: 'ec.tab-details' }, { click: 'ec.mail-open' }, { wait: 300 }], parent: 'ec.mail-open' }),
  ecIn('details', { id: 'ec.mail-body', label: 'תוכן', aliases: ['גוף המייל'], kind: 'field', where: 'בחלון "שליחת מייל"', reveal: [{ click: 'ec.tab-details' }, { click: 'ec.mail-open' }, { wait: 300 }], parent: 'ec.mail-open' }),
  ecIn('details', { id: 'ec.mail-send', label: 'שלח מייל', aliases: ['שליחה'], kind: 'button', where: 'בחלון "שליחת מייל", הלחצן הראשי בתחתית', reveal: [{ click: 'ec.tab-details' }, { click: 'ec.mail-open' }, { wait: 300 }], parent: 'ec.mail-open' }),
  ecIn('attendance', { id: 'ec.att-showdel', label: 'הצג מחוקות', aliases: ['משמרות שנמחקו'], kind: 'toggle', where: `${ECW}, בלשונית "נוכחות וסיכום", בשורת הכלים` }),
  ecIn('attendance', { id: 'ec.att-print', label: 'הדפס / ייצא PDF', aliases: ['הדפסת נוכחות', 'PDF שעות', 'דוח שעות להדפסה'], kind: 'button', where: `${ECW}, בלשונית "נוכחות וסיכום", בשורת הכלים` }),
  ecIn('attendance', { id: 'ec.att-add', label: 'הוסף משמרת', aliases: ['משמרת חדשה', 'הוספת שעות', 'להוסיף כניסה ויציאה'], kind: 'button', where: `${ECW}, בלשונית "נוכחות וסיכום", בשורת הכלים`, hint: 'בוחרים תאריך עברי, שעת כניסה ויציאה, ושומרים' }),
  ecIn('history', { id: 'ec.hist', label: 'היסטוריית שינויים', aliases: ['יומן שינויים בעובדת'], kind: 'section', where: `${ECW}, בלשונית "היסטוריה"` }),
];

// ---- סיכום נוכחות (/employees/attendance) ----
const ATW = 'בדף "סיכום נוכחות"';
const at = (id, label, aliases, where, kind, extra) => ({ id: `att.${id}`, label, aliases, route: AT, kind, where: `${ATW}, ${where}`, ...extra });
const REVEAL_EDIT = [{ click: 'att.row-edit' }, { wait: 700 }];
const ate = (id, label, aliases, where, kind, extra) => at(id, label, aliases, where, kind, { reveal: REVEAL_EDIT, parent: 'att.row-edit', ...extra });
const REVEAL_WIZ = [{ click: 'att.tool-print' }, { wait: 500 }];
const atw = (id, label, aliases, where, kind, extra) => at(id, label, aliases, `בחלון ההפקה (נפתח מכלי ההדפסה / ההורדה / ה-Excel שבכותרת): ${where}`, kind, { reveal: REVEAL_WIZ, parent: 'att.tool-print', ...extra });
const attendance = [
  at('view-seg', 'תצוגה', ['לפי חודש / לפי עובד', 'מעבר בין תצוגות'], 'בשורת הסינון, בורר "לפי חודש / לפי עובד"', 'toggle'),
  at('view-month', 'לפי חודש', ['סיכום חודשי לכל העובדים', 'טבלת חודש'], 'בבורר התצוגה בשורת הסינון', 'toggle'),
  at('view-byemp', 'לפי עובד', ['כל החודשים של עובד', 'שעות לפי עובד'], 'בבורר התצוגה בשורת הסינון', 'toggle', { hint: 'שורה לכל חודש של עובד אחד' }),
  at('prev-month', 'חודש קודם', ['חודש אחורה'], 'בשורת הסינון, חץ ליד בחירת החודש', 'button'),
  at('month', 'חודש', ['בחירת חודש', 'לשנות חודש'], 'בשורת הסינון', 'field'),
  at('year', 'שנה', ['בחירת שנה'], 'בשורת הסינון', 'field'),
  at('next-month', 'חודש הבא', ['חודש קדימה'], 'בשורת הסינון, חץ ליד בחירת החודש', 'button'),
  at('now', 'החודש', ['חזרה לחודש הנוכחי', 'היום'], 'בשורת הסינון (מופיע כשלא מוצג החודש הנוכחי)', 'button'),
  at('emp', 'עובד', ['בחירת עובד', 'לבחור עובדת'], 'בשורת הסינון, בתצוגה "לפי עובד"', 'field', { reveal: [{ click: 'att.view-byemp' }], parent: 'att.view-byemp' }),
  at('tool-xl', 'ייצוא ל-Excel', ['אקסל', 'ייצוא שעות לאקסל', 'דוח נוכחות באקסל'], 'בכותרת הדף, בקבוצת הכלים (בצד שמאל), אייקון Excel', 'button', { hint: 'פותח חלון בחירת עובדים וסוג דוח; הייצוא להנהלה בלבד' }),
  at('tool-dl', 'הורדת PDF', ['PDF', 'הורדת דוח נוכחות', 'הורדה'], 'בכותרת הדף, בקבוצת הכלים (בצד שמאל), אייקון ההורדה', 'button'),
  at('tool-print', 'הדפסה', ['הדפסת נוכחות', 'הדפסת דוח שעות', 'מדפסת'], 'בכותרת הדף, בקבוצת הכלים (בצד שמאל), אייקון המדפסת', 'button', { hint: 'פותח חלון בחירת עובדים וסוג דוח, עם תצוגה מקדימה' }),
  at('month-card', 'סיכום חודשי', ['טבלת הנוכחות', 'שעות כל העובדים', 'סיכום כל העובדים'], 'הטבלה שמתחת לשורת הסינון', 'section', { reveal: [{ click: 'att.view-month' }], parent: 'att.view-month', hint: 'שם, ס״ה שעות, כמות ימים, תקלות, ס״ה לתשלום, נסיעות; לחיצה על שורה פותחת את המשמרות' }),
  at('byemp-card', 'סיכום לפי עובד', ['כל החודשים של עובד'], 'הטבלה שמתחת לשורת הסינון, בתצוגה "לפי עובד"', 'section', { reveal: [{ click: 'att.view-byemp' }], parent: 'att.view-byemp' }),
  at('row-edit', 'עריכת נוכחות העובד', ['עיפרון', 'לתקן שעות', 'עריכת משמרות', 'תיקון נוכחות', 'עריכת נוכחות'], 'בטבלה, בעמודת "פעולות" בכל שורת עובד, אייקון העיפרון', 'button', { reveal: [{ click: 'att.view-month' }], parent: 'att.month-card', hint: 'פותח את משמרות העובד לחודש לעריכה' }),
  ate('edit-card', 'דוח נוכחות וסיכום', ['משמרות העובד', 'טבלת משמרות'], 'במסך עריכת נוכחות העובד', 'section'),
  ate('edit-add', 'הוסף משמרת', ['משמרת חדשה', 'להוסיף כניסה ויציאה', 'הוספת שעות ידנית'], 'במסך עריכת נוכחות העובד, בשורת הכלים של הכרטיס', 'button', { hint: 'פותח פאנל: תאריך עברי, שעת כניסה, שעת יציאה, הערות' }),
  ate('edit-history', 'היסטוריית שינויים', ['מי ערך את השעות', 'יומן עריכות נוכחות'], 'במסך עריכת נוכחות העובד, בשורת הכלים של הכרטיס', 'button'),
  ate('edit-showdel', 'הצג מחוקות', ['משמרות שנמחקו', 'שחזור משמרת'], 'במסך עריכת נוכחות העובד, בשורת הכלים', 'toggle'),
  ate('edit-pencil', 'ערוך רק כניסה ויציאה', ['עריכת משמרת', 'לתקן שעת יציאה', 'עיפרון במשמרת'], 'במסך עריכת נוכחות העובד, בעמודת "פעולות" בכל משמרת', 'button', { hint: 'משנים שעת כניסה / יציאה בתוך השורה; הדקות והתשלום מחושבים לבד' }),
  ate('edit-delete', 'מחק', ['מחיקת משמרת', 'להסיר משמרת'], 'במסך עריכת נוכחות העובד, בעמודת "פעולות" בכל משמרת', 'button', { hint: 'מחיקה רכה, אחרי אישור; אפשר לשחזר דרך "הצג מחוקות"' }),
  ate('add-entry', 'שעת כניסה', ['כניסה'], 'בפאנל "הוסף משמרת"', 'field', { reveal: [...REVEAL_EDIT, { click: 'att.edit-add' }], parent: 'att.edit-add' }),
  ate('add-exit', 'שעת יציאה', ['יציאה'], 'בפאנל "הוסף משמרת"', 'field', { reveal: [...REVEAL_EDIT, { click: 'att.edit-add' }], parent: 'att.edit-add' }),
  ate('add-notes', 'הערות', ['הערה למשמרת'], 'בפאנל "הוסף משמרת"', 'field', { reveal: [...REVEAL_EDIT, { click: 'att.edit-add' }], parent: 'att.edit-add' }),
  ate('add-save', 'שמור', ['שמירת משמרת'], 'בפאנל "הוסף משמרת", בתחתית', 'button', { reveal: [...REVEAL_EDIT, { click: 'att.edit-add' }], parent: 'att.edit-add' }),
  atw('wiz-mode', 'סוג הפעולה', ['הדפסה / הורדה / XL'], 'בורר "הדפסה / הורדה (PDF) / XL" בראש החלון', 'toggle'),
  atw('wiz-type', 'סוג הדוח', ['דוח מלא', 'סיכום', 'כל החודשים'], 'בורר "סוג הדוח"', 'toggle'),
  atw('wiz-list', 'רשימת העובדים', ['בחירת עובדים', 'מתגי עובדים'], 'רשימת העובדים עם מתג לכל אחד, ותצוגה מקדימה לצידה', 'list'),
  atw('wiz-go', 'הפקת הדוח', ['הדפס נבחרים', 'הורד PDF', 'ייצוא ל-Excel של הנבחרים'], 'הלחצן הראשי בתחתית (שמו לפי סוג הפעולה)', 'button'),
  atw('wiz-all', 'כל העובדים', ['הדפסת כולם', 'כל העובדים ברצף'], 'לחצן "כל העובדים" בתחתית', 'button'),
];

// ---- רשימות a5-list: דגמים, עובדים, ופריטים / השכרות / יומן בכרטיס הדגם ----
const modelsCtl = listCtl('mod', DL, 'בדף "דגמים", בכרטיס "קטלוג דגמים" (שורת החיפוש מעל הרשימה; הייצוא מעל התוצאות)', {}, ['search', 'filter', 'sort', 'ai', 'stats', 'view', 'export-excel', 'export-download', 'export-print']);
modelsCtl.push(...listCtl('mod', DL, 'בכותרת הדף, החץ בצד ימין', {}, ['back']).map((t) => ({ ...t, label: 'חזרה למרכז הניהול' })));
const employeesCtl = listCtl('emp', EL, 'בדף "עובדים ונוכחות", בכרטיס "רשימת עובדים" (שורת החיפוש מעל הרשימה; הייצוא מעל התוצאות)', {}, ['search', 'filter', 'sort', 'ai', 'stats', 'view', 'export-excel', 'export-download', 'export-print']);
employeesCtl.push(...listCtl('emp', EL, 'בכותרת הדף, החץ בצד ימין', {}, ['back']).map((t) => ({ ...t, label: 'חזרה למרכז הניהול' })));
const dcItemsCtl = listCtl('dci', DC, 'בכרטיס הדגם, בלשונית "פריטים", בכרטיס "פריטים ומלאי"', { entity: true, reveal: [{ click: 'dc.tab-items' }], parent: 'dc.tab-items' }, ['search', 'filter', 'sort', 'ai', 'view', 'export-excel', 'export-print']);
const dcRentalsCtl = listCtl('dcr', DC, 'בכרטיס הדגם, בלשונית "השכרות", בכרטיס "השכרות"', { entity: true, reveal: [{ click: 'dc.tab-rentals' }], parent: 'dc.tab-rentals' }, ['search', 'filter', 'sort', 'export-excel']);
const dcHistoryCtl = listCtl('dch', DC, 'בכרטיס הדגם, בלשונית "היסטוריה", בכרטיס "פעולות ושינויים"', { entity: true, reveal: [{ click: 'dc.tab-history' }], parent: 'dc.tab-history' }, ['search']);

export const targets = [
  ...custList, ...cardTargets, ...newCustomer, ...models, ...newModel, ...dressCard, ...pricelist, ...employees, ...employeeCard, ...attendance,
  ...modelsCtl, ...employeesCtl, ...dcItemsCtl, ...dcRentalsCtl, ...dcHistoryCtl,
];

// data-guide-id דינמי (תבנית בקוד): { prefix, file } - הקידומת חייבת להופיע בקובץ
export const dynamic = [
  { prefix: 'mod.', file: 'app/components/models-list/ModelsListA5.js' },
  { prefix: 'emp.', file: 'app/components/employees-list/EmployeesListA5.js' },
  { prefix: 'dci.', file: 'app/components/dress-card/tabs/DcItemsTab.js' },
  { prefix: 'dcr.', file: 'app/components/dress-card/tabs/DcRentalsTab.js' },
  { prefix: 'dch.', file: 'app/components/dress-card/tabs/DcHistoryTab.js' },
  { prefix: 'cc.tab-', file: 'app/components/customer-card/CustomerCardA5.js' },
  { prefix: 'dc.tab-', file: 'app/components/dress-card/DcTabs.js' },
  { prefix: 'dc.pm-', file: 'app/components/dress-card/DcTopbar.js' },
  { prefix: 'dc.rail-status', file: 'app/components/dress-card/DcRail.js' },
  { prefix: 'ec.tab-', file: 'app/components/employee-card/EmployeeCardA5.js' },
  { prefix: 'att.tool-', file: 'app/components/attendance/parts.js' },
  { prefix: 'att.row-edit', file: 'app/components/attendance/AttendancePage.js' },
  { prefix: 'att.edit-pencil', file: 'app/components/attendance/AttendanceEdit.js' },
  { prefix: 'att.edit-delete', file: 'app/components/attendance/AttendanceEdit.js' },
  { prefix: 'price.add-row', file: 'app/dashboard/pricelist/page.js' },
  { prefix: 'price.row-edit', file: 'app/dashboard/pricelist/page.js' },
  { prefix: 'price.row-delete', file: 'app/dashboard/pricelist/page.js' },
];
