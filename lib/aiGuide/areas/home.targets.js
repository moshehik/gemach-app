// lib/aiGuide/areas/home.targets.js - יעדי ההצבעה של האזור "בית ושאר דפי העובדת" (קובץ שנטען גם בדפדפן: רק נתונים, בלי imports של שרת).
// כולל: דף הבית החדש (חיפוש, חיפוש מתקדם, שיחת AI, קיצורים, תחתית), פאנל החיפוש והפעמון של התפריט העליון, פס ההודעות, ווידג'ט ה-AI הצף,
// הלוז היומי, הלוח החודשי, בדיקת מלאי, ימי אי-פעילות, הפרופיל, עיצוב ותצוגה (+ מתג ישן/חדש), הודעות, שעון נוכחות ועמדת הלקוח.
// המזהים תואמים ל-data-guide-id בקוד של הקומפוננטות (ר' dynamic בסוף הקובץ לתבניות).

const HOME = '/';
const ADV_QUERY = 'adv=1';
// חשיפה של טופס תחום בחיפוש המתקדם: בוחרים קודם תחום "הזמנות" (תחום הברירת מחדל לדוגמה)
const ADV_FORM = [{ click: 'srch.adv-focus-orders' }];
const ADV_PLUS = [{ click: 'srch.adv-plus' }];

const srch = (id, label, extra) => ({ id: `srch.${id}`, label, route: HOME, ...extra });
const focus = (key, label, aliases, extra = {}) => srch(`adv-focus-${key}`, label, {
  aliases, kind: 'button', query: ADV_QUERY, parent: 'srch.adv-focus-list',
  where: `בחיפוש המתקדם, בשלב "במה נתמקד?", כפתור "${label}"`, hint: `${label}: חיפוש מתקדם בתחום הזה`, ...extra,
});

const homeTargets = [
  // ----- שורת החיפוש -----
  srch('input', 'חיפוש לקוח, הזמנה או פריט', {
    aliases: ['שורת חיפוש', 'תיבת חיפוש', 'חיפוש כללי', 'חיפוש לפי טלפון', 'חיפוש לפי שם', 'חיפוש לפי מספר הזמנה', 'חיפוש לפי ברקוד', 'חיפוש לקוחה', 'חיפוש הזמנה'],
    kind: 'field', where: 'בדף הבית, שורת החיפוש הגדולה בראש הדף', hint: 'כאן מקלידים שם, טלפון, מספר הזמנה, ברקוד, דגם או מידה',
  }),
  srch('submit', 'חיפוש', {
    aliases: ['כפתור חיפוש', 'זכוכית מגדלת', 'Enter'], kind: 'button', parent: 'srch.input',
    where: 'בקצה שורת החיפוש, כפתור זכוכית המגדלת (אפשר גם ללחוץ Enter)', hint: 'מריץ את החיפוש',
  }),
  srch('clear', 'ניקוי החיפוש', {
    aliases: ['ניקוי הכול', 'למחוק את החיפוש', 'איפוס חיפוש', 'X בחיפוש'], kind: 'button', parent: 'srch.input',
    where: 'בשורת החיפוש, ה-X שמופיע אחרי שמקלידים', hint: 'מנקה את החיפוש וחוזר לדף הבית הריק',
  }),
  srch('save-icon', 'שמירת חיפוש', {
    aliases: ['שמור חיפוש', 'סימנייה', 'חיפוש שמור', 'לשמור חיפוש'], kind: 'icon', parent: 'srch.input',
    where: 'בשורת החיפוש, אייקון סימנייה ליד ה-X (מופיע אחרי שמקלידים טקסט)', hint: 'שומר את החיפוש הזה לשימוש חוזר בקיצור $',
  }),
  srch('mode-ai', 'לחיפוש חכם', {
    aliases: ['חיפוש חכם', 'חיפוש AI', 'לשאול את ה-AI', 'לחיפוש רגיל'], kind: 'toggle',
    access: { setting: ['hide_ai_features', '!true'] },
    where: 'בדף הבית, מתחת לשורת החיפוש, הכפתור "לחיפוש חכם" (למי שמורשית לשימוש ב-AI)', hint: 'עובר לחיפוש חכם: שואלים בשפה חופשית',
  }),
  srch('mode-adv', 'לחיפוש מתקדם', {
    aliases: ['חיפוש מתקדם', 'סינון מתקדם', 'חיפוש לפי תנאים', 'סינון לפי תאריך אירוע'], kind: 'toggle',
    where: 'בדף הבית, מתחת לשורת החיפוש, הכפתור "לחיפוש מתקדם"', hint: 'פותח את החיפוש המתקדם עם תחומים ומסננים',
  }),
  srch('scope-chip', 'הסרת הסינון', {
    aliases: ['רק בהזמנות', 'רק בלקוחות', 'סינון לקטגוריה', 'להסיר סינון'], kind: 'button', query: 'scope=orders', parent: 'srch.input',
    where: 'מתחת לשורת החיפוש, הכפתור "רק בהזמנות" (או לקוחות/השכרות/החזרות/תיקונים) כשנכנסים מקישורי "בית" בתפריט', hint: 'לחיצה מסירה את הסינון לקטגוריה',
  }),
  srch('guide-btn', 'קיצורים', {
    aliases: ['מדריך קיצורים', 'קיצורי חיפוש', 'מה אפשר להקליד'], kind: 'button', parent: 'srch.input',
    where: 'בדף הבית, מתחת לשורת החיפוש הריקה, הכפתור "קיצורים" (לפני שמחפשים)', hint: 'פותח את מדריך הקיצורים @ & # $ %',
  }),
  srch('guide-dialog', 'קיצורי חיפוש', {
    aliases: ['חלון הקיצורים', 'רשימת הקיצורים', '@ & # $ %'], kind: 'section', reveal: [{ click: 'srch.guide-btn' }], parent: 'srch.guide-btn',
    where: 'בחלון "קיצורי חיפוש" שנפתח מהכפתור "קיצורים"', hint: 'כותבים את הסימן כתו ראשון בשורת החיפוש. "נסה" מכניס אותו לשורה',
  }),
  srch('prefix-list', 'רשימת הקיצורים בשורת החיפוש', {
    aliases: ['אחרונים', 'מה פתחתי לאחרונה', 'שינויים שלי', 'פעולות מהירות', 'חיפושים שמורים', 'מילות מפתח'], kind: 'list', query: 'recent=changes', parent: 'srch.input',
    where: 'מתחת לשורת החיפוש, רשימה שנפתחת כשכותבים @ (אחרונים), & (השינויים שלי), # (פעולות מהירות), $ (חיפושים שמורים) או % (מילות מפתח)', hint: 'הרשימה שנפתחת לפי הסימן הראשון בשורה',
  }),
  srch('mine-view', 'השינויים שלי', {
    aliases: ['מה שיניתי', 'הפעולות שלי', 'הזמנות שיצרתי', '&'], kind: 'section', query: 'recent=mine', parent: 'srch.input',
    where: 'בדף הבית, הכרטיס "השינויים שלי" (נפתח מהתפריט "בית" ← "השינויים שלי" או מהקיצור &)', hint: 'ההזמנות החדשות שיצרת והשינויים שעשית, עד 20 בכל חלק',
  }),
  // ----- תוצאות החיפוש -----
  srch('results', 'תוצאות החיפוש', {
    aliases: ['רשימת התוצאות', 'תוצאות', 'עוד תוצאות'], kind: 'section', parent: 'srch.input',
    where: 'בדף הבית, מתחת לשורת החיפוש אחרי שמחפשים: כרטיס "תוצאות" עם הזמנות, לקוחות ופריטים', hint: 'לחיצה על שורה פותחת את הכרטיס שלה',
  }),
  srch('date-chips', 'לו״ז ליום שהוקלד', {
    aliases: ['לוז ליום', 'שבבי הלוז', 'חיפוש לפי תאריך'], kind: 'section', parent: 'srch.results',
    access: { pageKey: 'page:schedule' },
    where: 'בראש התוצאות כשמקלידים תאריך עברי (למשל "כז תשרי"): שבב לכל שלב בלוז של אותו יום', hint: 'לחיצה על שבב פותחת את הלוז של היום הזה',
  }),
  srch('export-excel', 'ייצוא ל-Excel', {
    aliases: ['אקסל', 'ייצוא תוצאות', 'להוריד לאקסל'], kind: 'button', parent: 'srch.results',
    where: 'בכותרת כרטיס התוצאות, שלושה כפתורי ייצוא: אקסל, הדפסה והורדת PDF', hint: 'מייצא את התוצאות לקובץ Excel',
  }),
  srch('export-print', 'הדפסת התוצאות', {
    aliases: ['הדפסה', 'להדפיס תוצאות', 'הדפסת רשימה'], kind: 'button', parent: 'srch.results',
    where: 'בכותרת כרטיס התוצאות, כפתור המדפסת (ליד אקסל והורדת PDF)', hint: 'פותח דף הדפסה של התוצאות',
  }),
  srch('export-pdf', 'הורדת PDF', {
    aliases: ['קובץ PDF', 'להוריד תוצאות', 'שמירה כ-PDF'], kind: 'button', parent: 'srch.results',
    where: 'בכותרת כרטיס התוצאות, כפתור ההורדה (ליד אקסל והדפסה)', hint: 'מוריד את התוצאות כקובץ PDF',
  }),
  srch('ai-card', 'חיפוש חכם', {
    aliases: ['שיחה עם ה-AI בדף הבית', 'תשובת ה-AI', 'הורד הכל', 'הדפס הכל'], kind: 'section', reveal: [{ click: 'srch.mode-ai' }], parent: 'srch.mode-ai',
    access: { setting: ['hide_ai_features', '!true'] },
    where: 'בדף הבית, כרטיס "חיפוש חכם" שנפתח אחרי ששולחים שאלה במצב חיפוש חכם', hint: 'השיחה עם ה-AI, עם כפתורי הורדה והדפסה של השיחה',
  }),
  srch('ai-followup', 'שאלת המשך', {
    aliases: ['להמשיך לשאול', 'שאלה נוספת ל-AI'], kind: 'field', parent: 'srch.ai-card',
    access: { setting: ['hide_ai_features', '!true'] },
    where: 'בתחתית כרטיס "חיפוש חכם", שדה "שאלת המשך…"', hint: 'כאן ממשיכים את השיחה עם ה-AI',
  }),
  // ----- חיפוש מתקדם -----
  srch('adv-focus-list', 'במה נתמקד?', {
    aliases: ['תחומי החיפוש המתקדם', 'סינון מתקדם', 'בחירת תחום'], kind: 'section', query: ADV_QUERY, parent: 'srch.mode-adv',
    where: 'בחיפוש המתקדם, שלב ראשון "במה נתמקד?" עם כפתור לכל תחום', hint: 'בוחרים תחום ואז ממלאים מסננים',
  }),
  focus('customers', 'לקוחות', ['חיפוש מתקדם לקוחות'], { access: { pageKey: 'page:customers' } }),
  focus('orders', 'הזמנות', ['חיפוש מתקדם הזמנות', 'סינון הזמנות לפי תאריך'], { access: { pageKey: 'page:orders' } }),
  focus('rentals', 'השכרות', ['חיפוש מתקדם השכרות'], { access: { pageKey: 'page:rentals' } }),
  focus('returns', 'החזרות', ['חיפוש מתקדם החזרות', 'איחורים בהחזרה'], { access: { pageKey: 'page:rentals' } }),
  focus('alterations', 'תיקונים', ['חיפוש מתקדם תיקונים'], { access: { pageKey: 'page:alterations', setting: ['enable_alterations', '!false'] } }),
  focus('deliveries', 'משלוחים', ['חיפוש מתקדם משלוחים'], { access: { pageKey: 'page:deliveries', setting: ['enable_deliveries', 'true'] } }),
  focus('capacity', 'תפוסה', ['חיפוש מתקדם תפוסה', 'כמה שמלות תפוסות'], { access: { pageKey: 'page:orders' } }),
  srch('adv-plus', 'תחומים נוספים', {
    aliases: ['כפתור פלוס', 'כספים', 'התראות', 'עוד תחומים'], kind: 'button', query: ADV_QUERY, parent: 'srch.adv-focus-list',
    where: 'בחיפוש המתקדם, כפתור ה"+" בסוף שורת התחומים (פותח כספים והתראות, ולמנהלות גם דגמים ועובדים)', hint: 'פותח תחומים נוספים',
  }),
  focus('finance', 'כספים', ['חיפוש מתקדם כספים', 'חובות וזיכויים'], { reveal: ADV_PLUS, access: { pageKey: 'page:refunds' }, where: 'בחיפוש המתקדם, אחרי לחיצה על ה"+": כפתור "כספים"' }),
  focus('alerts', 'התראות', ['חיפוש מתקדם התראות'], { reveal: ADV_PLUS, access: { pageKey: 'page:orders' }, where: 'בחיפוש המתקדם, אחרי לחיצה על ה"+": כפתור "התראות"' }),
  focus('models', 'דגמים', ['חיפוש מתקדם דגמים'], { reveal: ADV_PLUS, access: { pageKey: 'page:dresses_catalog' }, where: 'בחיפוש המתקדם, אחרי לחיצה על ה"+": כפתור "דגמים" (למנהלות)' }),
  focus('employees', 'עובדים', ['חיפוש מתקדם עובדים'], { reveal: ADV_PLUS, access: { gate: 'head' }, where: 'בחיפוש המתקדם, אחרי לחיצה על ה"+": כפתור "עובדים" (הנהלה ראשית)' }),
  srch('adv-close', 'סגירת החיפוש המתקדם', {
    aliases: ['לצאת מהחיפוש המתקדם', 'סגירה'], kind: 'button', query: ADV_QUERY, parent: 'srch.adv-focus-list',
    where: 'בכותרת כרטיס החיפוש המתקדם, ה-X', hint: 'סוגר את החיפוש המתקדם וחוזר לדף הבית',
  }),
  srch('adv-back', 'חזרה לבחירת תחום', {
    aliases: ['לשנות תחום', 'חזרה לתחומים'], kind: 'button', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-list',
    where: 'בטופס של תחום בחיפוש המתקדם, חץ החזרה בכותרת הכרטיס', hint: 'חוזר לבחירת התחום',
  }),
  srch('adv-f-oid', 'קוד הזמנה', {
    aliases: ['מספר הזמנה בחיפוש מתקדם'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פרטי הזמנה", השדה "קוד הזמנה"', hint: 'מסננים לפי מספר הזמנה',
  }),
  srch('adv-f-name', 'שם לקוח', {
    aliases: ['שם לקוחה בחיפוש מתקדם'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פרטי הזמנה", השדה "שם לקוח"', hint: 'שם פרטי ומשפחה; יש הצעות מהאתר',
  }),
  srch('adv-f-phone', 'טלפון', {
    aliases: ['טלפון בחיפוש מתקדם'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פרטי הזמנה", השדה "טלפון"', hint: 'מסננים לפי מספר טלפון',
  }),
  srch('adv-f-emp', 'עובד מבצע', {
    aliases: ['מי עשתה את ההזמנה', 'סינון לפי עובדת'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פרטי הזמנה", השדה "עובד מבצע"', hint: 'בוחרים עובדת מהרשימה',
  }),
  srch('adv-d-from', 'תאריך אירוע', {
    aliases: ['סינון לפי תאריך אירוע', 'טווח תאריכים', 'עד תאריך'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פרטי אירוע", השדה "תאריך אירוע" (ואחריו "עד תאריך" לטווח); התאריכים עבריים', hint: 'בוחרים תאריך עברי מהלוח',
  }),
  srch('adv-f-model', 'דגם', {
    aliases: ['דגם בחיפוש מתקדם', 'סינון לפי דגם'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פריטים", השדה "דגם"', hint: 'בוחרים דגם מההצעות',
  }),
  srch('adv-f-size', 'מידה', {
    aliases: ['מידה בחיפוש מתקדם'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פריטים", השדה "מידה"', hint: 'מסננים לפי מידה',
  }),
  srch('adv-f-item', 'ברקוד', {
    aliases: ['ברקוד בחיפוש מתקדם', 'חיפוש לפי ברקוד מתקדם'], kind: 'field', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בחיפוש מתקדם ← הזמנות, בקבוצה "פריטים", השדה "ברקוד"', hint: 'מסננים לפי ברקוד של פריט',
  }),
  srch('adv-flags', 'כפתורי הסימון בחיפוש המתקדם', {
    aliases: ['חובות', 'זיכויים', 'לא נשמר', 'דרוש בדיקה', 'סטטוס הזמנה', 'מושכר', 'ארכיון', 'בקרוב'], kind: 'section', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בטפסי החיפוש המתקדם, שורות של כפתורים (למשל "סטטוס הזמנה": בקרוב, ארכיון, מושכר... ו"דרוש בדיקה": חובות, זיכויים, לא נשמר)', hint: 'כל כפתור דולק או כבוי; אפשר לשלב כמה',
  }),
  srch('adv-apply', 'חיפוש', {
    aliases: ['להריץ חיפוש מתקדם', 'כפתור חיפוש בטופס'], kind: 'button', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-focus-orders',
    where: 'בטופס החיפוש המתקדם, הכפתור הגדול "חיפוש" בתחתית (מוסיפים לפחות מסנן אחד)', hint: 'מריץ את החיפוש לפי המסננים שמילאת',
  }),
  srch('adv-smart', 'חיפוש חכם', {
    aliases: ['חיפוש מתקדם עם AI', 'שליחה לחיפוש חכם'], kind: 'button', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-apply',
    access: { setting: ['hide_ai_features', '!true'] },
    where: 'בטופס החיפוש המתקדם, ליד "חיפוש" בתחתית, הכפתור "חיפוש חכם" (בתחומים שתומכים, למי שמורשית ל-AI)', hint: 'שולח את המסננים לחיפוש החכם',
  }),
  srch('adv-clear', 'נקה', {
    aliases: ['ניקוי מסננים', 'איפוס מסננים'], kind: 'button', query: ADV_QUERY, reveal: ADV_FORM, parent: 'srch.adv-apply',
    where: 'בטופס החיפוש המתקדם, ליד "חיפוש" בתחתית, הכפתור "נקה"', hint: 'מנקה את כל המסננים בטופס',
  }),
  srch('adv-results', 'תוצאות חיפוש מתקדם', {
    aliases: ['תוצאות סינון מתקדם'], kind: 'section', query: ADV_QUERY, parent: 'srch.mode-adv',
    where: 'בדף הבית אחרי שמריצים חיפוש מתקדם: כרטיס עם סיכום המסננים והתוצאות', hint: 'אפשר לייצא, להדפיס ולעדכן את החיפוש',
  }),
  srch('adv-update', 'עדכן חיפוש', {
    aliases: ['לשנות את המסננים', 'חזרה לעריכת החיפוש'], kind: 'button', query: ADV_QUERY, parent: 'srch.adv-results',
    where: 'בכותרת כרטיס תוצאות החיפוש המתקדם, הכפתור "עדכן חיפוש"', hint: 'חוזר לטופס עם המסננים שמילאת',
  }),
  // ----- תחתית הדף -----
  { id: 'home.footer', label: 'תחתית הדף', aliases: ['פוטר', 'קישורים בתחתית', 'ניווט מהיר'], route: HOME, kind: 'section', where: 'בתחתית דף הבית: עמודות "ניווט מהיר", "עזרה" ו"החשבון שלי" ופרטי הגרסה', hint: 'קישורים מהירים ומדיניות פרטיות' },
  { id: 'home.footer-privacy', label: 'מדיניות פרטיות', aliases: ['פרטיות', 'תקנון פרטיות'], route: HOME, kind: 'button', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "החשבון שלי"', hint: 'פותח חלון עם מדיניות הפרטיות' },
  { id: 'home.footer-profile', label: 'הפרופיל שלי', aliases: ['פרופיל מהתחתית'], route: HOME, kind: 'link', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "החשבון שלי"', hint: 'פותח את הפרופיל שלך' },
  { id: 'home.footer-display', label: 'הגדרות תצוגה', aliases: ['עיצוב ותצוגה', 'שינוי צבעים', 'שינוי גופן'], route: HOME, kind: 'link', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "החשבון שלי"', hint: 'פותח את "עיצוב ותצוגה"' },
  { id: 'home.footer-report', label: 'דיווח על תקלה', aliases: ['דיווח שגיאה מהתחתית'], route: HOME, kind: 'button', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "עזרה"', hint: 'פותח את חלון הדיווח על שגיאה' },
  { id: 'home.footer-landing', label: 'דף הבית החדש', aliases: ['מצגת הסבר', 'דף נחיתה'], route: HOME, kind: 'link', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "ניווט מהיר" (נפתח בלשונית חדשה)', hint: 'מצגת הסבר על האתר' },
  { id: 'home.footer-orders', label: 'הזמנות', aliases: ['רשימת הזמנות מהתחתית'], route: HOME, kind: 'link', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "ניווט מהיר"', hint: 'פותח את רשימת ההזמנות' },
  { id: 'home.footer-customers', label: 'לקוחות', aliases: ['רשימת לקוחות מהתחתית'], route: HOME, kind: 'link', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "ניווט מהיר"', hint: 'פותח את רשימת הלקוחות' },
  { id: 'home.footer-dresses', label: 'שמלות', aliases: ['קטלוג דגמים מהתחתית'], route: HOME, kind: 'link', parent: 'home.footer', where: 'בתחתית דף הבית, בעמודה "ניווט מהיר"', hint: 'פותח את קטלוג הדגמים' },
  { id: 'home.footer-dashboard', label: 'סיכום כספי', aliases: ['דשבורד מהתחתית'], route: HOME, kind: 'link', parent: 'home.footer', access: { gate: 'head' }, where: 'בתחתית דף הבית, בעמודה "ניווט מהיר" (הנהלה ראשית)', hint: 'פותח את הסיכום הכספי' },
  { id: 'home.tour-line', label: 'למצגת הסבר על האתר', aliases: ['מצגת', 'הסבר על האתר'], route: HOME, kind: 'link', where: 'בדף הבית הריק, שורה מתחת לשורת החיפוש: "למצגת הסבר על האתר לחצי כאן"', hint: 'נפתח בלשונית חדשה' },

  // ----- פאנל החיפוש בתפריט העליון (נפתח מאייקון המגדלת) -----
  { id: 'srch.menu-input', label: 'חיפוש עמוד, הזמנה או לקוח', aliases: ['חיפוש בתפריט', 'חיפוש דפים', 'מציאת עמוד', 'חיפוש מהיר'], route: '*', kind: 'field', reveal: [{ menu: 'search' }], parent: 'rail.search',
    where: 'בסרגל העליון, אייקון המגדלת ← שדה "חיפוש עמוד, הזמנה או לקוח…"', hint: 'מקלידים שם עמוד, הזמנה או לקוח; ברקוד של 7 ספרות + Enter מבצע החזרה מהירה' },
  { id: 'srch.menu-results', label: 'תוצאות החיפוש בתפריט', aliases: ['הצג את כל התוצאות', 'עמודים והזמנות'], route: '*', kind: 'list', reveal: [{ menu: 'search' }], parent: 'rail.search',
    where: 'בסרגל העליון, אייקון המגדלת ← הרשימה מתחת לשדה (עמודים, הזמנות ולקוחות)', hint: 'לחיצה על שורה פותחת את העמוד, ההזמנה או הלקוח' },
  { id: 'srch.menu-recent', label: 'נצפו לאחרונה', aliases: ['אחרונים', 'היסטוריית ניווט', 'דפים שפתחתי', 'חזרה לעמוד קודם'], route: '*', kind: 'list', reveal: [{ menu: 'search' }], parent: 'rail.search',
    where: 'בסרגל העליון, אייקון המגדלת ← האזור "נצפו לאחרונה" (כשהשדה ריק)', hint: 'העמודים שפתחת לאחרונה, אפשר לחזור אליהם' },
  { id: 'srch.menu-recent-clear', label: 'נקה', aliases: ['ניקוי היסטוריה', 'ניקוי נצפו לאחרונה'], route: '*', kind: 'link', reveal: [{ menu: 'search' }], parent: 'srch.menu-recent',
    where: 'בסרגל העליון, אייקון המגדלת ← בכותרת "נצפו לאחרונה", הקישור "נקה" (מופיע כשיש יותר מעמוד אחד)', hint: 'מנקה את רשימת העמודים האחרונים' },

  // ----- פאנל התפוסה / הפריט (מופיע בחיפוש הראשי ובחיפוש המהיר שבתפריט כשמקלידים דגם / מידה / ברקוד) -----
  { id: 'srch.panel', label: 'פאנל התפוסה והפריט', aliases: ['תפוסה בחיפוש', 'כמה פנויות מדגם', 'מצב דגם בחיפוש', 'מי שכרה את הדגם', 'חיפוש לפי מספר דגם', 'חיפוש לפי ברקוד שמלה', 'מה פנוי בתאריך'], route: '*', kind: 'section',
    where: 'בחיפוש (בדף הבית מעל התוצאות; בחיפוש המהיר שבתפריט מתחת לשדה), מופיע אחרי שמקלידים מספר דגם (3-4 ספרות), דגם ומידה, ברקוד חלקי או ברקוד מלא של שמלה, אפשר גם עם תאריך (ורק למי שיש לה הרשאת הזמנות או השכרות)',
    hint: 'ריבועי תפוסה ורשימות: מה בחוץ, מה הוחזר ומי מחכה לדגם' },
  { id: 'srch.panel-tiles', label: 'ריבועי התפוסה', aliases: ['במלאי בתפוסה רזרבה', 'כמה פנויות', 'סטטוס הפריט', 'כמה פעמים הושכרה'], route: '*', kind: 'section', parent: 'srch.panel',
    where: 'בפאנל התפוסה, שלושת הריבועים: לדגם - "במלאי", "בתפוסה" (היום או בתאריך) ו"רזרבה"; לברקוד מלא - "סטטוס", "פעמים שהושכר" ו"הזמנות שחייבות אותו"', hint: 'סיכום מהיר במספרים' },
  { id: 'srch.panel-where', label: 'איפה אני?', aliases: ['איפה המידה שלי', 'איפה השמלה', 'מיקום כל הברקודים', 'איפה נמצאת שמלה', 'איפה השמלות של הדגם'], route: '*', kind: 'button', parent: 'srch.panel',
    where: 'בפאנל התפוסה, השורה הראשונה בראש הפאנל ("איפה אני?" בדגם, "איפה המידה שלי?" בברקוד מלא); לחיצה נוספת ("חזרה לתפוסה") מחזירה', hint: 'מציג את המיקום של כל ברקוד בדגם: מושכר אצל מי, בתיקון, לא בשימוש, ברזרבה, במחסן או במקום מסוים' },

  // ----- פעמון התראות ופס ההודעות -----
  { id: 'bell.panel', label: 'התראות', aliases: ['רשימת ההתראות', 'התראות חדשות'], route: '*', kind: 'section', reveal: [{ menu: 'bell' }], parent: 'rail.bell',
    where: 'בסרגל העליון, אייקון הפעמון ← החלונית "התראות"', hint: 'התראות חדשות מסומנות; לחיצה על התראה מסמנת אותה כנקראה' },
  { id: 'bell.list', label: 'רשימת התראות', aliases: ['התראות שלא נקראו'], route: '*', kind: 'list', reveal: [{ menu: 'bell' }], parent: 'bell.panel',
    where: 'בפעמון, הרשימה שמתחת לכותרת "התראות" (X בכל שורה מסיר אותה)', hint: 'מציג עד 5 התראות, ו"הצג עוד" פותח את השאר' },
  { id: 'bell.mark-all', label: 'סמן הכל כנקרא', aliases: ['לסמן הכול כנקרא', 'קראתי הכול'], route: '*', kind: 'button', reveal: [{ menu: 'bell' }], parent: 'bell.panel',
    where: 'בפעמון, בשורת הכלים מעל הרשימה (מופיעה כשיש התראות)', hint: 'מסמן את כל ההתראות כנקראו' },
  { id: 'bell.clear', label: 'ניקוי', aliases: ['נקה הכול', 'למחוק את כל ההתראות', 'ניקוי התראות'], route: '*', kind: 'button', reveal: [{ menu: 'bell' }], parent: 'bell.panel',
    where: 'בפעמון, בשורת הכלים מעל הרשימה, ליד "סמן הכל כנקרא"', hint: 'מסיר את כל ההתראות מהרשימה שלך (לא מוחק אותן אצל אחרים)' },
  { id: 'bell.more', label: 'הצג עוד', aliases: ['עוד התראות'], route: '*', kind: 'button', reveal: [{ menu: 'bell' }], parent: 'bell.list',
    where: 'בפעמון, מתחת לחמש ההתראות הראשונות (כשיש יותר מחמש)', hint: 'מציג את שאר ההתראות' },
  { id: 'bell.notice-bar', label: 'פס ההודעות', aliases: ['הפס הכחול', 'הודעה בראש הדף', 'הזמנות שלא הוחזרו'], route: '*', kind: 'section',
    where: 'מתחת לסרגל העליון, פס צבעוני עם הודעה (למשל "הזמנות שלא הוחזרו"); מופיע רק כשיש הודעה', hint: '"פרטים נוספים" פותח את השורות, X סוגר' },

  // ----- ווידג'ט ה-AI הצף -----
  { id: 'ai.fab', label: 'עוזר AI', aliases: ['הכפתור הצף', 'כפתור הכוכב', 'לשאול את העוזר', 'צ׳אט AI'], route: '*', kind: 'button', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בפינה התחתונה של המסך, עיגול עם כוכב (בצד שמאל במסך בעברית), בכל דף חוץ מעמדת הלקוח', hint: 'לחיצה פותחת את עוזר ה-AI' },
  { id: 'ai.panel', label: 'עוזר AI', aliases: ['חלון העוזר', 'צ׳אט עם העוזר'], route: '*', kind: 'section', reveal: [{ click: 'ai.fab' }], access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בפינה התחתונה של המסך, החלונית "עוזר AI" שנפתחת מהכפתור הצף', hint: 'כאן שואלים את העוזר' },
  { id: 'ai.input', label: 'שאל שאלה...', aliases: ['שדה השאלה', 'להקליד שאלה לעוזר'], route: '*', kind: 'field', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בתחתית חלונית "עוזר AI", שדה הטקסט "שאל שאלה..."', hint: 'מקלידים שאלה ושולחים' },
  { id: 'ai.send', label: 'שליחה', aliases: ['שלח שאלה'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בתחתית חלונית "עוזר AI", הכפתור העגול עם החץ ליד שדה השאלה', hint: 'שולח את השאלה לעוזר' },
  { id: 'ai.attach', label: 'צרף צילום/הסרטת מסך/קובץ', aliases: ['צירוף קובץ', 'צילום מסך', 'הקלטת מסך', 'להעלות קובץ לעוזר'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בתחתית חלונית "עוזר AI", כפתור הריבועים משמאל לשדה השאלה (פותח תפריט צירוף)', hint: 'פותח תפריט: צלם אזור, צלם מסך, הסרטת מסך, העלאת קובץ' },
  { id: 'ai.capture-area', label: 'צלם אזור באתר', aliases: ['צילום אזור', 'לסמן אזור בדף'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }, { click: 'ai.attach' }], parent: 'ai.attach', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בחלונית "עוזר AI" ← כפתור הצירוף ← "צלם אזור באתר"', hint: 'בוחרים אזור בדף והוא מצורף לשאלה' },
  { id: 'ai.capture-screen', label: 'צלם את כל המסך', aliases: ['צילום מסך מלא'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }, { click: 'ai.attach' }], parent: 'ai.attach', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בחלונית "עוזר AI" ← כפתור הצירוף ← "צלם את כל המסך"', hint: 'מצלם את המסך ומצרף לשאלה' },
  { id: 'ai.record-screen', label: 'הסרטת מסך', aliases: ['הקלטת מסך', 'וידאו של המסך'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }, { click: 'ai.attach' }], parent: 'ai.attach', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בחלונית "עוזר AI" ← כפתור הצירוף ← "הסרטת מסך" (אם הוגדר באתר)', hint: 'מקליט את המסך ומצרף לשאלה' },
  { id: 'ai.upload-file', label: 'העלאת קובץ', aliases: ['צירוף תמונה', 'צירוף PDF', 'להעלות קובץ'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }, { click: 'ai.attach' }], parent: 'ai.attach', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בחלונית "עוזר AI" ← כפתור הצירוף ← "העלאת קובץ" (תמונה, PDF, טקסט או CSV, עד 3MB)', hint: 'בוחרים קובץ מהמחשב' },
  { id: 'ai.mic', label: 'הקלט הודעה', aliases: ['הקלטה', 'הכתבה', 'מיקרופון'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בתחתית חלונית "עוזר AI", כפתור המיקרופון ליד שדה השאלה', hint: 'מכתיבים את השאלה בקול' },
  { id: 'ai.history', label: 'היסטוריית שיחות', aliases: ['שיחות קודמות', 'שיחות שמורות'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בכותרת חלונית "עוזר AI", אייקון השעון (בצד שמאל של הכותרת)', hint: 'מציג שיחות קודמות ואפשר לחזור לאחת מהן' },
  { id: 'ai.new-chat', label: 'שיחה חדשה', aliases: ['להתחיל שיחה מחדש', 'איפוס שיחה'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בכותרת חלונית "עוזר AI", אייקון הפלוס', hint: 'מתחיל שיחה חדשה (הקודמת נשמרת בהיסטוריה)' },
  { id: 'ai.expand', label: 'הגדל', aliases: ['הקטן', 'להגדיל את חלון העוזר'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בכותרת חלונית "עוזר AI", אייקון החצים', hint: 'מגדיל או מקטין את החלונית' },
  { id: 'ai.close', label: 'סגור', aliases: ['לסגור את העוזר'], route: '*', kind: 'button', reveal: [{ click: 'ai.fab' }], parent: 'ai.panel', access: { loggedIn: true, setting: ['hide_ai_features', '!true'] },
    where: 'בכותרת חלונית "עוזר AI", ה-X', hint: 'סוגר את החלונית' },

  // ----- מתג ישן / חדש -----
  { id: 'disp.return-new', label: 'חזרה לממשק החדש', aliases: ['לחזור לחדש', 'לחצן זהב חזרה לחדש', 'מעבר לממשק החדש מהישן', 'חזרה לעיצוב החדש'], route: '*', kind: 'button', access: { loggedIn: true },
    where: 'בממשק הישן: בסרגל העליון של האתר הישן, ובדפים ישנים בתוך הממשק החדש - בפינת הדף. לחצן זהב עם הכיתוב "חזרה לממשק החדש" (לא מופיע בממשק החדש עצמו)',
    hint: 'מחזיר אותך לממשק החדש בכל המסכים בבת אחת (שמור בחשבון האישי שלך)' },
  { id: 'disp.variant-toggle', label: 'מעבר בין העיצוב החדש לישן', aliases: ['חזרה לתצוגה הישנה', 'מעבר לתצוגה החדשה', 'עיצוב ישן', 'עיצוב חדש', 'החלפת עיצוב'], route: '*', kind: 'icon', access: { loggedIn: true },
    where: 'בראש הדף (בדף הבית: בפינה העליונה של אזור החיפוש; בלוח החודשי ובפרופיל: בשורת הכותרת), אייקון עגול זהוב עם חיצי החלפה. מופיע רק בדפים שיש להם גם גרסה ישנה וגם חדשה',
    hint: 'מחליף את הדף הזה בין העיצוב החדש לישן (רק לך)' },
];

// ----- לוז יומי -----
const sched = (id, label, extra) => ({ id: `sched.${id}`, label, route: '/schedule', ...extra });
const PICKER = [{ click: 'sched.day-picker' }];
const STAGE_RAIL = [
  ['order', 'הזמנות חדשות', ['הזמנות חדשות היום', 'שלב 1'], null],
  ['repair', 'תיקונים', ['תיקוני שמלות בלוז'], { setting: ['enable_alterations', '!false'] }],
  ['prep', 'הכנה', ['הכנת שמלות', 'הכנות'], null],
  ['dout', 'משלוח הלוך', ['משלוחים הלוך'], { setting: ['enable_deliveries', 'true'] }],
  ['pick', 'איסוף מקומי', ['איסופים', 'לקוחות שבאות לקחת'], null],
  ['event', 'אירוע', ['אירועים היום'], null],
  ['manret', 'החזרה ידנית', ['החזרות', 'שמלות שחוזרות'], null],
  ['dback', 'משלוח חזור', ['משלוחים חזור'], { setting: ['enable_deliveries', 'true'] }],
];

const schedTargets = [
  sched('day-picker', 'בחירת תאריך', {
    aliases: ['בחירת יום', 'לוז של יום אחר', 'תאריך אחר בלוז', 'יומן ליד הכותרת'], kind: 'icon',
    where: 'בלוז, בכותרת "לוח זמנים", אייקון היומן (בריחוף או בלחיצה נפתח לשמאלו שורת בחירת היום)', hint: 'פותח את בורר היום' }),
  sched('day-prev', 'היום הקודם', {
    aliases: ['אתמול', 'יום אחורה'], kind: 'button', reveal: PICKER, parent: 'sched.day-picker',
    where: 'בלוז, בבורר היום (אחרי לחיצה על אייקון היומן), חץ ימני', hint: 'עובר ליום הקודם' }),
  sched('day-next', 'היום הבא', {
    aliases: ['מחרתיים', 'יום קדימה'], kind: 'button', reveal: PICKER, parent: 'sched.day-picker',
    where: 'בלוז, בבורר היום (אחרי לחיצה על אייקון היומן), חץ שמאלי', hint: 'עובר ליום הבא' }),
  sched('day-date', 'התאריך העברי', {
    aliases: ['לוח עברי', 'בחירת תאריך עברי', 'תאריך בלוז'], kind: 'button', reveal: PICKER, parent: 'sched.day-picker',
    where: 'בלוז, בבורר היום, הכפתור עם התאריך העברי באמצע (פותח לוח חודשי לבחירת יום)', hint: 'פותח לוח עברי לבחירת כל יום' }),
  sched('day-calendar', 'בחירת יום בלוח עברי', {
    aliases: ['לוח חודש עברי', 'חודש קודם בלוח'], kind: 'section', reveal: [{ click: 'sched.day-picker' }, { click: 'sched.day-date' }], parent: 'sched.day-date',
    where: 'בלוז, החלונית שנפתחת מכפתור התאריך העברי: לוח חודשי עם חצים לחודש קודם/הבא', hint: 'לוחצים על יום כדי לעבור אליו' }),
  sched('today', 'היום', {
    aliases: ['הלוז של היום', 'חזרה להיום'], kind: 'button', reveal: PICKER, parent: 'sched.day-picker',
    where: 'בלוז, בבורר היום, הכפתור "היום"', hint: 'עובר ללוז של היום' }),
  sched('tomorrow', 'מחר', {
    aliases: ['הלוז של מחר'], kind: 'button', reveal: PICKER, parent: 'sched.day-picker',
    where: 'בלוז, בבורר היום, הכפתור "מחר"', hint: 'עובר ללוז של מחר' }),
  sched('rail', 'שלבי היום', {
    aliases: ['ציר השלבים', 'סינון לפי שלב', 'רשימת השלבים'], kind: 'section',
    where: 'בלוז, העמודה הימנית "שלבי היום"', hint: 'לחיצה על שלב מסננת את הדף אליו' }),
  sched('rail-all', 'הכל', {
    aliases: ['כל השלבים', 'ביטול סינון בלוז'], kind: 'button', parent: 'sched.rail',
    where: 'בלוז, בעמודה "שלבי היום", הכפתור "הכל"', hint: 'מציג את כל השלבים' }),
  ...STAGE_RAIL.map(([key, label, aliases, access]) => sched(`rail-${key}`, label, {
    aliases, kind: 'button', parent: 'sched.rail', ...(access ? { access } : {}),
    where: `בלוז, בעמודה "שלבי היום", השורה "${label}"`, hint: `מסנן את הלוז לשלב "${label}"` })),
  sched('rail-updated', 'הזמנות שעודכנו', {
    aliases: ['הזמנות ששונו', 'עדכונים בהזמנות'], kind: 'button', parent: 'sched.rail',
    where: 'בלוז, בעמודה "שלבי היום", השורה האחרונה "הזמנות שעודכנו"', hint: 'מציג הזמנות קיימות שנערכו או שנוסף בהן תשלום ביום הזה' }),
  sched('stages', 'שלבי הלוז', {
    aliases: ['רשימת הפעולות של היום', 'מה יש היום'], kind: 'section',
    where: 'בלוז, העמודה המרכזית: כרטיס לכל שלב שיש בו פעולות ביום', hint: 'כל שלב עם השורות שלו' }),
  ...STAGE_RAIL.map(([key, label, aliases, access]) => sched(`sec-${key}`, label, {
    aliases, kind: 'section', parent: 'sched.stages', ...(access ? { access } : {}),
    where: `בלוז, הכרטיס "${label}" (מופיע רק כשיש בו פעולות ביום)`, hint: `השורות של השלב "${label}"` })),
  sched('sec-updated', 'הזמנות שעודכנו', {
    aliases: ['הזמנות ששונו היום'], kind: 'section', parent: 'sched.stages',
    where: 'בלוז, הכרטיס האחרון בדף "הזמנות שעודכנו" (נטען כשגוללים אליו)', hint: 'הזמנות שנוסף בהן פריט, נערכו או נוסף תשלום' }),
  sched('view-switch', 'מצב תצוגה', {
    aliases: ['שורות או טבלה', 'תצוגת טבלה בלוז'], kind: 'toggle',
    where: 'בלוז, מעל כרטיסי השלבים, מתג "שורות / טבלה"', hint: 'מחליף בין תצוגת שורות לטבלה' }),
  sched('offday-chip', 'יום לא עובד', {
    aliases: ['שבת', 'חג', 'יום סגור'], kind: 'icon',
    where: 'בלוז, ליד מתג התצוגה, שבב "יום לא עובד" (מופיע ביום שהגמ״ח סגור בו)', hint: 'היום הזה מסומן כיום ללא פעילות' }),
  sched('branches', 'סינון לפי סניף', {
    aliases: ['סניף בלוז', 'כל הסניפים'], kind: 'toggle', access: { setting: ['branches_enabled', 'true'] },
    where: 'בלוז, לצד מתג התצוגה, בורר "כל הסניפים / <סניף>" (רק בגמ״ח עם סניפים)', hint: 'מסנן את הלוז לסניף אחד' }),
  sched('tool-xl', 'ייצוא ל-Excel', {
    aliases: ['אקסל מהלוז', 'ייצוא הלוז'], kind: 'button', access: { gate: 'head' },
    where: 'בלוז, בכותרת הדף בקצה השמאלי, כפתור אקסל (להנהלה בלבד)', hint: 'פותח את אשף ההורדה עם אקסל' }),
  sched('tool-dl', 'הורדה', {
    aliases: ['הורדת דפי הלוז', 'PDF של הלוז'], kind: 'button',
    where: 'בלוז, בכותרת הדף בקצה השמאלי, כפתור ההורדה', hint: 'פותח את אשף ההורדה (PDF) של דפי היום' }),
  sched('tool-print', 'הדפסה', {
    aliases: ['הדפסת הלוז', 'הדפסת דפי היום', 'להדפיס לוז'], kind: 'button',
    where: 'בלוז, בכותרת הדף בקצה השמאלי, כפתור המדפסת', hint: 'פותח את אשף ההדפסה של כל דפי היום' }),
  sched('sec-tool-print', 'הדפסת דפי השלב', {
    aliases: ['הדפסת דף הכנה', 'הדפסת שלב'], kind: 'button', parent: 'sched.stages',
    where: 'בלוז, בכותרת כל כרטיס שלב בקצה השמאלי, כפתור המדפסת', hint: 'פותח חלונית הדפסה לדפים של השלב הזה בלבד' }),
  sched('sec-tool-dl', 'הורדת דפי השלב', {
    aliases: ['PDF של שלב'], kind: 'button', parent: 'sched.stages',
    where: 'בלוז, בכותרת כל כרטיס שלב, כפתור ההורדה', hint: 'מוריד את דפי השלב כ-PDF' }),
  sched('sec-tool-xl', 'ייצוא השלב ל-Excel', {
    aliases: ['אקסל של שלב'], kind: 'button', parent: 'sched.stages', access: { gate: 'head' },
    where: 'בלוז, בכותרת כל כרטיס שלב, כפתור אקסל (להנהלה בלבד)', hint: 'מייצא את השלב לאקסל' }),
  sched('print-wizard', 'אשף ההדפסה', {
    aliases: ['בחירת דפים להדפסה', 'חלון ההדפסה של הלוז'], kind: 'section', reveal: [{ click: 'sched.tool-print' }], parent: 'sched.tool-print',
    where: 'בלוז, החלון שנפתח מכפתור המדפסת: רשימת דפים לפי שלב, תצוגה מקדימה וכפתור הדפסה', hint: 'מסמנים דפים ולוחצים להדפסה' }),
  sched('print-run', 'הדפס נבחרים', {
    aliases: ['לאשר הדפסה', 'הורד PDF', 'הדפס את כל דפי היום'], kind: 'button', reveal: [{ click: 'sched.tool-print' }], parent: 'sched.print-wizard',
    where: 'בתחתית אשף ההדפסה, הכפתור הראשי (אחרי שסימנו דפים)', hint: 'מדפיס את הדפים שנבחרו' }),
  sched('mark-done', 'בוצע', {
    aliases: ['סימון בוצע', 'לסמן שלב כבוצע', 'ביטול סימון בוצע', 'וי בלוז'], kind: 'button', parent: 'sched.stages',
    where: 'בלוז, בכל שורה של שלב שאפשר לסמן, הכפתור "בוצע" בקצה השורה (שלבי המידע "הזמנות חדשות" ו"אירוע" בלי כפתור)', hint: 'לוחצים, ומאשרים בחלון "בטוח?"' }),
  sched('mark-bad', 'הוחזר לא תקין', {
    aliases: ['החזרה לא תקינה', 'שמלה שחזרה פגומה'], kind: 'button', parent: 'sched.stages',
    where: 'בשלבי ההחזרה ("החזרה ידנית", "משלוח חזור"), מופיע ליד "בוצע" בריחוף עליו (במגע: בהקשה ראשונה)', hint: 'מסמן שהשמלה הוחזרה לא תקינה' }),
  sched('mark-all', 'הכל בוצע', {
    aliases: ['סימון כל השלב כבוצע', 'וי כפול'], kind: 'button', parent: 'sched.stages', access: { pageKey: 'feature:schedule_mark_all_done' },
    where: 'בלוז, בכותרת כל כרטיס שלב, אייקון הווי הכפול (למי שיש לה הרשאה)', hint: 'מסמן את כל הפריטים הפתוחים בשלב כבוצעו אחרי אישור' }),
  sched('row-open', 'שם הלקוחה והמספר בשורה', {
    aliases: ['פתיחת שורה בלוז', 'פירוט הזמנה בלוז', 'פרטי שורה'], kind: 'button', parent: 'sched.stages',
    where: 'בלוז, בכל שורה, השם והמספר של ההזמנה (לחיצה פותחת פירוט: שמלות, טלפון, כתובת והערות)', hint: 'פותח את פירוט השורה' }),
  sched('row-card', 'לכרטיס ההזמנה', {
    aliases: ['פתיחת הזמנה מהלוז', 'חץ בסוף השורה'], kind: 'link', parent: 'sched.stages',
    where: 'בלוז, בקצה כל שורה, חץ קטן', hint: 'פותח את כרטיס ההזמנה בלשונית חדשה' }),
  sched('scan', 'שורת הסריקה (ברקוד)', {
    aliases: ['סריקת ברקוד בלוז', 'לסרוק קוד של שלב', 'הקלדת ברקוד בלוז', 'שדה ברקוד בלוז', 'סריקת הדף המודפס', 'סימון בוצע בסריקה'], kind: 'field', parent: 'sched.rail',
    where: 'בלוז, בעמודה "שלבי היום", שדה הסריקה מתחת לכותרת, מעל רשימת השלבים (הקלידו או סרקו קוד ולחצו Enter)',
    hint: 'קוד שמודפס על דף של הלוז (הכנה, איסוף, משלוח...) מסמן את השלב כבוצע כמו הכפתור "בוצע" באותו אישור והרשאות; ברקוד של שמלה נקלט להזמנה הפעילה אם הוגדר ברקוד בלוז' }),
  sched('settings', 'הגדרות תהליכים', {
    aliases: ['גלגל שיניים בלוז', 'הגדרות הלוז', 'ימים לפני האירוע בהכנה', 'שלבים פעילים בלוז', 'משמרות בלוז', 'לכבות שלב בלוז'], kind: 'icon', access: { gate: 'head' },
    where: 'בלוז, בכותרת הדף בקצה השמאלי, אייקון גלגל השיניים אחרי כפתורי הייצוא, ההורדה וההדפסה (להנהלה ראשית ולמתכנת). קישור ישיר: /schedule?settings=1',
    hint: 'פותח את החלון "הגדרות תהליכים": לכל שלב פעיל / כבוי, כמה ימי עסקים לפני או אחרי האירוע, ומשמרת' }),
  sched('settings-dialog', 'חלון הגדרות תהליכים', {
    aliases: ['הגדרות התהליכים בלוז', 'חלון ההגדרות של הלוז'], kind: 'section', query: 'settings=1', access: { gate: 'head' }, reveal: [{ click: 'sched.settings' }], parent: 'sched.settings',
    where: 'בלוז, החלון שנפתח מגלגל השיניים (או מהקישור ?settings=1 שבהגדרות המערכת): קבוצות "לפני האירוע", "יום האירוע" ו"אחרי האירוע"', hint: 'כאן מגדירים את טווחי התהליכים של הלוז' }),
  sched('settings-list', 'שורות התהליכים', {
    aliases: ['תהליכי הלוז', 'כל השלבים בהגדרות', 'ימי עסקים מהאירוע', 'בלי משמרות'], kind: 'list', query: 'settings=1', access: { gate: 'head' }, reveal: [{ click: 'sched.settings' }], parent: 'sched.settings-dialog',
    where: 'בחלון "הגדרות תהליכים", שורה לכל תהליך: מונה "ימי עסקים מהאירוע" (לשלבים שיש להם), מתג משמרת (ובחירת משמרת) ומתג "פעיל" (שלבים קבועים מסומנים "קבוע")', hint: 'לכל תהליך פעיל / כבוי, כמה ימים לפני או אחרי האירוע ואם גם באיזו משמרת' }),
  sched('settings-horizon', 'התראת העברה בין סניפים', {
    aliases: ['טווח התראת העברה', 'ימים קדימה להעברת פריטים', 'התראת העברה בלוז'], kind: 'section', query: 'settings=1', access: { gate: 'head', setting: ['multi_branch_enabled', 'true'] }, reveal: [{ click: 'sched.settings' }], parent: 'sched.settings-dialog',
    where: 'בחלון "הגדרות תהליכים", בתחתית הרשימה, הכרטיס "התראת העברה בין סניפים" (מוצג רק כשריבוי הסניפים פעיל)', hint: 'כמה ימים קדימה לבדוק הזמנות כדי להתריע שצריך להעביר פריטים בין סניפים' }),
  sched('settings-save', 'שמירה', {
    aliases: ['שמירת הגדרות תהליכים'], kind: 'button', query: 'settings=1', access: { gate: 'head' }, reveal: [{ click: 'sched.settings' }], parent: 'sched.settings-dialog',
    where: 'בחלון "הגדרות תהליכים", בתחתית החלון', hint: 'שומר את הגדרות התהליכים וסוגר את החלון' }),
  sched('settings-reset', 'איפוס לברירת מחדל', {
    aliases: ['איפוס הגדרות תהליכים', 'להחזיר ברירות מחדל בלוז'], kind: 'button', query: 'settings=1', access: { gate: 'head' }, reveal: [{ click: 'sched.settings' }], parent: 'sched.settings-dialog',
    where: 'בחלון "הגדרות תהליכים", בתחתית החלון ליד "שמירה"', hint: 'מחזיר את הערכים בחלון לברירות המחדל (נשמר רק אחרי "שמירה")' }),
  sched('bc-dialog', 'חלונית הברקוד', {
    aliases: ['סריקת שמלות בהכנה', 'סריקה באיסוף', 'סריקה במשלוח', 'חלון ברקודים בלוז', 'ברקוד חסר לשמלה'], kind: 'section', parent: 'sched.stages',
    where: 'בלוז, נפתחת בלחיצה על "בוצע" בשורה של הכנה / איסוף מקומי / משלוח כשהוגדר ברקוד בלוז וחסר ברקוד לשמלה (או בסריקת קוד השלב בשורת הסריקה); בהגדרות: לשונית "ברקודים" ← "ברקוד בלו״ז"',
    hint: 'סורקים כל שמלה בהזמנה; Enter עובר לברקוד הבא' }),
  sched('bc-input', 'שדה הברקוד בחלונית', {
    aliases: ['סריקת ברקוד שמלה', 'הקלדה ידנית של ברקוד', 'ברקוד לא קיים במאגר'], kind: 'field', parent: 'sched.bc-dialog',
    where: 'בחלונית הברקוד, השדה העליון (מתמקד אוטומטית; שגיאה בברקוד אחד לא עוצרת את הרצף)', hint: 'סרקו או הקלידו ולחצו Enter; ברקוד שלא קיים במאגר מאפשר הקלדה ידנית פעמיים והצהרה שהשמלה ברשותך (המנהלות מקבלות התראה)' }),
  sched('bc-list', 'פריטי ההזמנה בחלונית', {
    aliases: ['אילו שמלות נסרקו', 'חסר ברקוד', 'ביטול רישום ברקוד'], kind: 'list', parent: 'sched.bc-dialog',
    where: 'בחלונית הברקוד, הרשימה מתחת לשדה: שורה לכל שמלה (נרשם / חסר ברקוד), עם X לביטול רישום של פריט שעוד לא נלקח', hint: 'כל שמלה עם סימון אם נסרקה' }),
  sched('bc-release-all', 'שחרור כל הרישומים (אי-הגעה)', {
    aliases: ['לקוחה לא הגיעה', 'שחרור ברקודים', 'ביטול כל הרישומים'], kind: 'button', parent: 'sched.bc-dialog',
    where: 'בחלונית הברקוד, מעל כפתורי הסיום (מוצג כשיש רישומים שעוד לא נלקחו)', hint: 'משחרר את כל הרישומים של ההזמנה כך שהשמלות פנויות להזמנות אחרות' }),
  sched('bc-done', 'סמן כבוצע', {
    aliases: ['סמן הכנה כבוצעה', 'סיום סריקה', 'לקיחת כל הפריטים'], kind: 'button', parent: 'sched.bc-dialog',
    where: 'בחלונית הברקוד, הכפתור הראשי בתחתית (בהכנה: "סמן הכנה כבוצעה"; באיסוף ובמשלוח: "סמן כבוצע (לקיחת כל הפריטים)"), פעיל כשכל השמלות נסרקו', hint: 'מסמן את השלב כבוצע; באיסוף ובמשלוח הסריקה האחרונה סוגרת את המסירה גם אוטומטית' }),
];

// ----- בדיקת מלאי -----
const stock = (id, label, extra) => ({ id: `stock.${id}`, label, route: '/stock-check', ...extra });
const stockTargets = [
  stock('form', 'בדיקת מלאי', { aliases: ['טופס בדיקת מלאי', 'בדיקת זמינות'], kind: 'section', where: 'בדף "בדיקת מלאי", הכרטיס העליון עם הטופס', hint: 'בוחרים תאריך, דגם ו/או מידה ובודקים' }),
  stock('date', 'תאריך', { aliases: ['תאריך הבדיקה', 'לאיזה תאריך', 'תאריך עברי'], kind: 'field', parent: 'stock.form', where: 'בבדיקת מלאי, קבוצה "מה לבדוק", שדה "תאריך" (תאריך עברי; ברירת מחדל היום)', hint: 'בוחרים תאריך עברי' }),
  stock('field-model', 'דגם', { aliases: ['שם דגם', 'מספר דגם', 'בדיקה לפי דגם'], kind: 'field', parent: 'stock.form', where: 'בבדיקת מלאי, קבוצה "מה לבדוק", שדה "דגם" עם רשימת הצעות', hint: 'שם דגם או מספר; בחירה מההצעות' }),
  stock('field-size', 'מידה', { aliases: ['מידות', 'בדיקה לפי מידה', 'הוספת מידה'], kind: 'field', parent: 'stock.form', where: 'בבדיקת מלאי, שדה "מידה" (אפשר להוסיף כמה מידות, כל אחת בלחיצה על + או Enter)', hint: 'מקלידים מידה ומוסיפים לרשימה' }),
  stock('size-add', 'הוספת מידה', { aliases: ['פלוס ליד מידה'], kind: 'button', parent: 'stock.field-size', where: 'בבדיקת מלאי, בקצה שדה "מידה", כפתור הפלוס', hint: 'מוסיף את המידה שהוקלדה לרשימה' }),
  stock('sizes-chosen', 'מידות שנבחרו', { aliases: ['להסיר מידה'], kind: 'list', parent: 'stock.form', where: 'בבדיקת מלאי, מתחת לשדה המידה: כפתור לכל מידה שנבחרה (לחיצה מסירה)', hint: 'לחיצה על מידה מסירה אותה' }),
  stock('flex', 'בדיקה גמישה', { aliases: ['מצב גמיש', '±2', 'פלוס מינוס שתי מידות', 'מידה קרובה'], kind: 'section', parent: 'stock.form', where: 'בבדיקת מלאי, קבוצה "בדיקה גמישה" מתחת לטופס (כפתור לכל מידה מספרית: "36 ± 2")', hint: 'מדליקים כדי לבדוק גם מידות קרובות (±2)' }),
  stock('go', 'בדיקת מלאי', { aliases: ['להריץ בדיקה', 'כפתור בדיקה'], kind: 'button', parent: 'stock.form', where: 'בבדיקת מלאי, הכפתור הגדול "בדיקת מלאי" בתחתית הטופס (אפשר גם Enter)', hint: 'מריץ את הבדיקה' }),
  stock('clear', 'נקה', { aliases: ['ניקוי הטופס'], kind: 'button', parent: 'stock.form', where: 'בבדיקת מלאי, בתחתית הטופס, ליד הכפתור הראשי', hint: 'מנקה את הטופס והתוצאות' }),
  stock('results', 'תוצאות', { aliases: ['מה פנוי', 'תוצאות הבדיקה', 'דגמים פנויים'], kind: 'section', parent: 'stock.form', where: 'בבדיקת מלאי, הכרטיס שמתחת לטופס: דגמים פנויים בתאריך, עם שבב כמות', hint: 'שורות או טבלה; לחיצה על דגם פותחת את הכרטיס שלו' }),
];

// ----- לוח חודשי -----
const board = (id, label, extra) => ({ id: `board.${id}`, label, route: '/board', ...extra });
const MONTH_JUMP = [{ click: 'board.month-jump' }];
const boardTargets = [
  board('grid', 'לוח החודש', { aliases: ['לוח שנה', 'יומן חודשי', 'ימי החודש'], kind: 'section', where: 'בלוח החודשי, הגריד של ימי החודש (תא לכל יום, עם מוני השלבים)', hint: 'לחיצה על יום פותחת את הלוז שלו' }),
  board('day-link', 'כותרת היום', { aliases: ['מעבר ליום בלוח', 'פתיחת יום'], kind: 'link', parent: 'board.grid', where: 'בלוח החודשי, האות של היום בראש כל תא (לחיצה על התא כולו עושה אותו דבר)', hint: 'פותח את הלוז היומי של היום הזה' }),
  board('month-prev', 'החודש הקודם', { aliases: ['חודש אחורה'], kind: 'button', where: 'בלוח החודשי, כותרת החודש, חץ ימני (או חץ ימינה במקלדת)', hint: 'עובר לחודש הקודם' }),
  board('month-next', 'החודש הבא', { aliases: ['חודש קדימה'], kind: 'button', where: 'בלוח החודשי, כותרת החודש, חץ שמאלי (או חץ שמאלה במקלדת)', hint: 'עובר לחודש הבא' }),
  board('month-jump', 'קפיצה לחודש', { aliases: ['שם החודש', 'בחירת חודש', 'חודש אחר'], kind: 'button', where: 'בלוח החודשי, שם החודש העברי באמצע כותרת החודש', hint: 'פותח בורר של 13 חודשים' }),
  board('month-picker', 'בורר החודשים', { aliases: ['13 חודשים'], kind: 'section', reveal: MONTH_JUMP, parent: 'board.month-jump', where: 'בלוח החודשי, החלונית שנפתחת משם החודש', hint: 'בוחרים חודש; החצים מזיזים את החלון' }),
  board('today', 'החודש הנוכחי', { aliases: ['חזרה להיום בלוח', 'חזרה לחודש הנוכחי'], kind: 'button', where: 'בלוח החודשי, בשורה שמעל הלוח (מופיע רק כשמוצג חודש אחר)', hint: 'חוזר לחודש הנוכחי' }),
  board('view-switch', 'מצב תצוגה', { aliases: ['רשימת ימים', 'תצוגת לוח או רשימה'], kind: 'toggle', where: 'בלוח החודשי, בשורה שמעל הלוח, מתג "לוח / רשימה" (בטלפון עובר אוטומטית לרשימה)', hint: 'מחליף בין לוח לרשימת ימים' }),
  board('list', 'רשימת ימים', { aliases: ['ימי החודש כרשימה'], kind: 'list', where: 'בלוח החודשי במצב רשימה, שורה לכל יום', hint: 'לחיצה על שורה פותחת את הלוז של היום' }),
  board('filter-bar', 'סינון לפי שלב', { aliases: ['סינון הלוח', 'שלבים בלוח'], kind: 'section', where: 'בלוח החודשי, מעל הלוח, שורת הסינון', hint: 'בוחרים אילו שלבים להציג בתאים' }),
  board('filter-btn', 'סינון', { aliases: ['לסנן שלבים', 'כפתור סינון בלוח'], kind: 'button', parent: 'board.filter-bar', where: 'בלוח החודשי, מעל הלוח, הכפתור "סינון" (פותח רשימת 8 השלבים עם סכומים)', hint: 'מסמנים שלבים להצגה' }),
  board('filter-all', 'הצג הכל', { aliases: ['ביטול סינון בלוח'], kind: 'button', reveal: [{ click: 'board.filter-btn' }], parent: 'board.filter-btn', where: 'בלוח החודשי, בתוך רשימת הסינון, בראשה', hint: 'מבטל את הסינון ומציג את כל השלבים' }),
];

// ----- ימי אי-פעילות -----
const nwd = (id, label, extra) => ({ id: `nwd.${id}`, label, route: '/non-working-days', ...extra });
const NWD_EDIT = { pageKey: 'feature:non_working_days_manage' };
const nwdTargets = [
  nwd('calendar', 'לוח ימי האי-פעילות', { aliases: ['איפה רואים ימים סגורים', 'ימים סגורים', 'חגים סגורים', 'לוח חודשי של ימי סגירה'], kind: 'section', where: 'בדף "ימי אי-פעילות", הלוח החודשי הימני (לחיצה על יום בוחרת אותו; Shift + לחיצה לטווח)', hint: 'ימים סגורים מסומנים בצבעים לפי המקרא' }),
  nwd('legend', 'מקרא', { aliases: ['צבעים בלוח'], kind: 'section', where: 'בדף "ימי אי-פעילות", מעל הלוח', hint: 'מסביר מה כל צבע אומר' }),
  nwd('today', 'החודש הנוכחי', { aliases: ['חזרה להיום'], kind: 'button', where: 'בדף "ימי אי-פעילות", מעל הלוח', hint: 'חוזר לחודש הנוכחי' }),
  nwd('board-link', 'ללוח החודשי', { aliases: ['לעבור ללוח חודשי'], kind: 'link', access: { pageKey: 'page:board' }, where: 'בדף "ימי אי-פעילות", בכותרת בקצה השמאלי (למי שיש לה הרשאה ללוח)', hint: 'פותח את הלוח החודשי' }),
  nwd('summary', 'סיכום ושינויים שלא נשמרו', { aliases: ['שינויים שלא נשמרו', 'כמה ימים מסומנים'], kind: 'section', access: NWD_EDIT, where: 'בדף "ימי אי-פעילות", העמודה הכהה השמאלית, הכרטיס העליון "סיכום"', hint: 'כל שינוי הוא טיוטה עד "שמור"' }),
  nwd('save', 'שמור', { aliases: ['שמירת ימי אי-פעילות', 'לאשר שינויים'], kind: 'button', access: NWD_EDIT, parent: 'nwd.summary', where: 'בדף "ימי אי-פעילות", בכרטיס "סיכום" בעמודה השמאלית (מופיע כשיש שינויים)', hint: 'שומר את כל השינויים' }),
  nwd('discard', 'בטל שינויים', { aliases: ['ביטול שינויים'], kind: 'button', access: NWD_EDIT, parent: 'nwd.summary', where: 'בדף "ימי אי-פעילות", בכרטיס "סיכום", מתחת ל"שמור"', hint: 'זורק את הטיוטה' }),
  nwd('from', 'מתאריך', { aliases: ['טווח ימים', 'מתאריך עד תאריך'], kind: 'button', access: NWD_EDIT, parent: 'nwd.calendar', where: 'בדף "ימי אי-פעילות", בעמודה השמאלית בכרטיס "סימון ימים" (אחרי שבוחרים יום בלוח)', hint: 'לחיצה ואז לחיצה על יום בלוח קובעת תחילת טווח' }),
  nwd('to', 'עד תאריך', { aliases: ['סוף טווח'], kind: 'button', access: NWD_EDIT, parent: 'nwd.calendar', where: 'בדף "ימי אי-פעילות", בכרטיס "סימון ימים", ליד "מתאריך"', hint: 'קובע את סוף הטווח' }),
  nwd('note', 'הערה (לא חובה)', { aliases: ['סיבת הסגירה', 'הערה ליום סגור'], kind: 'field', access: NWD_EDIT, parent: 'nwd.calendar', where: 'בדף "ימי אי-פעילות", בכרטיס "סימון ימים" (ההערה גלויה לכל העובדים, בלי שמות או פרטים אישיים)', hint: 'הערה קצרה ליום או לטווח' }),
  nwd('mark', 'סמן: אין פעילות', { aliases: ['להוסיף יום סגור', 'לסגור יום', 'סימון יום ללא פעילות'], kind: 'button', access: NWD_EDIT, parent: 'nwd.calendar', where: 'בדף "ימי אי-פעילות", בכרטיס "סימון ימים" בעמודה השמאלית, אחרי בחירת יום בלוח', hint: 'מוסיף את היום לטיוטה; אחר כך לוחצים "שמור"' }),
  nwd('fixed', 'תאריכים עבריים קבועים', { aliases: ['סגירה בכל שנה', 'תאריך עברי קבוע'], kind: 'section', where: 'בדף "ימי אי-פעילות", בעמודה השמאלית, הכרטיס "תאריכים עבריים קבועים"', hint: 'תאריכים שנסגרים בכל שנה לפי הלוח העברי' }),
  nwd('fixed-add', 'הוסף', { aliases: ['להוסיף תאריך קבוע'], kind: 'button', access: NWD_EDIT, parent: 'nwd.fixed', where: 'בכרטיס "תאריכים עבריים קבועים", בתחתית: בוחרים יום וחודש עבריים ולוחצים "הוסף"', hint: 'מוסיף תאריך קבוע לטיוטה; אחר כך "שמור"' }),
];

// ----- פרופיל -----
const prof = (id, label, extra) => ({ id: `prof.${id}`, label, route: '/profile', ...extra });
const profTargets = [
  prof('personal', 'פרטים אישיים', { aliases: ['שם פרטי', 'שם משפחה', 'עדכון פרטים'], kind: 'section', where: 'בדף "הפרופיל שלי", הכרטיס הראשון "פרטים אישיים"', hint: 'שם פרטי ושם משפחה' }),
  prof('avatar', 'תמונת פרופיל', { aliases: ['להחליף תמונה', 'העלאת תמונה'], kind: 'section', parent: 'prof.personal', where: 'בדף "הפרופיל שלי", בכרטיס "פרטים אישיים": "גרור/י תמונה לכאן או לחצ/י לבחירה"', hint: 'PNG או JPG עד 5MB' }),
  prof('contact', 'יצירת קשר', { aliases: ['טלפון', 'מייל', 'כתובת מייל'], kind: 'section', where: 'בדף "הפרופיל שלי", הכרטיס "יצירת קשר" (טלפון 1, טלפון 2, מייל)', hint: 'מעדכנים ולוחצים "שמירת פרטים"' }),
  prof('address', 'כתובת', { aliases: ['עיר', 'רחוב'], kind: 'section', where: 'בדף "הפרופיל שלי", הכרטיס "כתובת"', hint: 'עיר, רחוב ומספר בית' }),
  prof('security', 'אבטחה', { aliases: ['סיסמה', 'סיסמא', 'סיסמה לשעון נוכחות'], kind: 'section', where: 'בדף "הפרופיל שלי", הכרטיס "אבטחה"', hint: 'כאן משנים את הסיסמה (גם של שעון הנוכחות)' }),
  prof('pw-change', 'שינוי סיסמא', { aliases: ['שינוי סיסמה', 'להחליף סיסמה', 'סיסמה חדשה'], kind: 'button', parent: 'prof.security', where: 'בדף "הפרופיל שלי", בכרטיס "אבטחה", הכפתור "שינוי סיסמא"', hint: 'פותח שדות סיסמא ישנה וחדשה' }),
  prof('pw-box', 'סיסמא ישנה וחדשה', { aliases: ['שדות הסיסמה'], kind: 'section', reveal: [{ click: 'prof.pw-change' }], parent: 'prof.pw-change', where: 'בכרטיס "אבטחה", אחרי לחיצה על "שינוי סיסמא"', hint: 'ממלאים סיסמא ישנה וחדשה ולוחצים "אשר שינוי"' }),
  prof('pw-confirm', 'אשר שינוי', { aliases: ['לאשר סיסמה חדשה'], kind: 'button', reveal: [{ click: 'prof.pw-change' }], parent: 'prof.pw-box', where: 'בכרטיס "אבטחה", בתוך שדות הסיסמא, הכפתור "אשר שינוי"', hint: 'מחליף את הסיסמא' }),
  prof('prefs', 'העדפות', { aliases: ['קבלת התראות למייל', 'התראות במייל'], kind: 'section', where: 'בדף "הפרופיל שלי", הכרטיס "העדפות" (קבלת התראות למייל, ומתג שעון נוכחות אוטומטי)', hint: 'מתגי הפעלה אישיים' }),
  prof('save', 'שמירת פרטים', { aliases: ['לשמור פרופיל'], kind: 'button', where: 'בדף "הפרופיל שלי", בתחתית הדף, הכפתור הגדול "שמירת פרטים"', hint: 'שומר פרטים אישיים, יצירת קשר, כתובת והעדפות (הסיסמא נשמרת בנפרד)' }),
];

// ----- עיצוב ותצוגה -----
const disp = (id, label, extra) => ({ id: `disp.${id}`, label, route: '/display-settings', ...extra });
const dispTargets = [
  disp('design-switch', 'מעבר בין העיצוב הישן לחדש', { aliases: ['עיצוב ישן או חדש', 'מתג ישן חדש', 'לחזור לעיצוב ישן', 'מעבר לעיצוב החדש'], kind: 'section', access: { loggedIn: true }, where: 'בדף "עיצוב ותצוגה", הכרטיס העליון "מעבר בין העיצוב הישן לחדש" (שורה לכל מסך, עם "ישן" / "חדש" / "ברירת מחדל")', hint: 'בוחרים לכל מסך אם להציג אותו חדש או ישן (רק לך)' }),
  disp('mode', 'מצב תצוגה', { aliases: ['מצב כהה', 'מצב בהיר', 'ניגודיות גבוהה', 'מצב אוטומטי'], kind: 'section', where: 'בדף "עיצוב ותצוגה", הכרטיס "מצב תצוגה": בהיר, כהה, ניגודיות גבוהה, אוטומטי', hint: 'בוחרים מצב תצוגה' }),
  disp('palettes', 'פלטות מובנות', { aliases: ['צבעים', 'שינוי צבעי האתר', 'ערכת צבעים'], kind: 'section', where: 'בדף "עיצוב ותצוגה", הכרטיס "פלטות מובנות" (14 צבעים)', hint: 'לחיצה על פלטה מחליפה את צבעי האתר' }),
  disp('my-palettes', 'הפלטות שלי', { aliases: ['פלטה מותאמת אישית', 'עורך פלטה', 'צבע משלי'], kind: 'section', where: 'בדף "עיצוב ותצוגה", הכרטיס "הפלטות שלי" (פלטות שמורות ועורך צבעים)', hint: 'יוצרים פלטה משלך ושומרים בשם' }),
  disp('palette-save', 'שמירה כפלטה חדשה', { aliases: ['לשמור פלטה'], kind: 'button', parent: 'disp.my-palettes', where: 'בכרטיס "הפלטות שלי", בתחתית העורך', hint: 'שומר את הצבעים הנוכחיים בשם שהקלדת' }),
  disp('font', 'גופן', { aliases: ['שינוי גופן', 'סוג כתב', 'פונט'], kind: 'section', where: 'בדף "עיצוב ותצוגה", הכרטיס "אפשרויות נוספות", שורת הגופנים (ו"עוד גופנים" מתחתיה)', hint: 'בוחרים גופן' }),
  disp('density', 'צפיפות', { aliases: ['נוח או קומפקטי', 'ריווח'], kind: 'section', where: 'בדף "עיצוב ותצוגה", הכרטיס "אפשרויות נוספות": נוח / קומפקטי', hint: 'מקטין או מגדיל ריווחים' }),
  disp('text-size', 'גודל טקסט', { aliases: ['להגדיל כתב', 'טקסט גדול', 'להקטין כתב'], kind: 'section', where: 'בדף "עיצוב ותצוגה", הכרטיס "אפשרויות נוספות": קטן / רגיל / גדול / גדול מאוד', hint: 'בוחרים גודל טקסט' }),
];

// ----- הודעות -----
const msg = (id, label, extra) => ({ id: `msg.${id}`, label, route: '/messages', ...extra });
const msgTargets = [
  msg('tab-incoming', 'נכנסות', { aliases: ['דואר נכנס', 'הודעות שקיבלתי'], kind: 'tab', where: 'במרכז ההודעות, שורת הלשוניות', hint: 'ההודעות שהגיעו אלייך' }),
  msg('tab-outgoing', 'יוצאות', { aliases: ['דואר יוצא', 'הודעות ששלחתי'], kind: 'tab', where: 'במרכז ההודעות, שורת הלשוניות', hint: 'הודעות ששלחת' }),
  msg('tab-archived', 'ארכיון', { aliases: ['ארכיון הודעות'], kind: 'tab', where: 'במרכז ההודעות, שורת הלשוניות', hint: 'הודעות שהועברו לארכיון' }),
  msg('tab-shift', 'בין משמרות', { aliases: ['הודעות בין משמרות', 'פתק למשמרת הבאה'], kind: 'tab', access: { setting: ['shift_handover_notes', 'true'] }, where: 'במרכז ההודעות, שורת הלשוניות (מופיעה אם הפעלתם "הודעות בין משמרות")', hint: 'הודעות למשמרת הבאה' }),
  msg('tab-management', 'להנהלה', { aliases: ['הודעות להנהלה', 'פנייה להנהלה'], kind: 'tab', access: { setting: ['management_messages', 'true'] }, where: 'במרכז ההודעות, שורת הלשוניות (מופיעה אם הפעלתם "הודעות להנהלה")', hint: 'הודעות ושאלות להנהלה' }),
  msg('tab-settings', 'הגדרות', { aliases: ['הגדרות התראות', 'התראות במייל'], kind: 'tab', where: 'במרכז ההודעות, שורת הלשוניות', hint: 'הגדרות התראות במייל' }),
  msg('tab-compose', 'הודעה חדשה', { aliases: ['כתיבת הודעה', 'לשלוח הודעה לעובדת', 'הודעה לכולם'], kind: 'tab', where: 'במרכז ההודעות, שורת הלשוניות (האחרונה)', hint: 'פותח טופס כתיבת הודעה' }),
  msg('compose-to', 'שלח אל', { aliases: ['נמען', 'למי לשלוח'], kind: 'field', reveal: [{ click: 'msg.tab-compose' }], parent: 'msg.tab-compose', where: 'במרכז ההודעות ← "הודעה חדשה", שדה "שלח אל" (עובדת מסוימת או "כל העובדים במערכת")', hint: 'בוחרים נמענת' }),
  msg('compose-text', 'תוכן ההודעה', { aliases: ['כתיבת ההודעה'], kind: 'field', reveal: [{ click: 'msg.tab-compose' }], parent: 'msg.tab-compose', where: 'במרכז ההודעות ← "הודעה חדשה", שדה "תוכן ההודעה"', hint: 'מקלידים את ההודעה' }),
  msg('compose-email', 'שלח התראה גם למייל', { aliases: ['הודעה גם במייל'], kind: 'toggle', reveal: [{ click: 'msg.tab-compose' }], parent: 'msg.tab-compose', where: 'במרכז ההודעות ← "הודעה חדשה", תיבת הסימון מתחת לתוכן ההודעה', hint: 'שולח גם למייל של העובדות שיש להן כתובת' }),
  msg('send', 'שלח הודעה', { aliases: ['לשלוח'], kind: 'button', reveal: [{ click: 'msg.tab-compose' }], parent: 'msg.tab-compose', where: 'במרכז ההודעות ← "הודעה חדשה", הכפתור "שלח הודעה" בתחתית הטופס', hint: 'שולח את ההודעה' }),
  msg('shift-text', 'הודעה חדשה למשמרת הבאה', { aliases: ['פתק בין משמרות'], kind: 'field', access: { setting: ['shift_handover_notes', 'true'] }, reveal: [{ click: 'msg.tab-shift' }], parent: 'msg.tab-shift', where: 'במרכז ההודעות ← "בין משמרות", שדה "הודעה חדשה למשמרת הבאה" (ו"הוסף הודעה" מתחתיו)', hint: 'כותבים הודעה וגם לוחצים "הוסף הודעה"' }),
  msg('mgmt-text', 'הודעה/שאלה חדשה להנהלה', { aliases: ['הודעה למנהלת', 'שאלה להנהלה'], kind: 'field', access: { setting: ['management_messages', 'true'] }, reveal: [{ click: 'msg.tab-management' }], parent: 'msg.tab-management', where: 'במרכז ההודעות ← "להנהלה", שדה "הודעה/שאלה חדשה להנהלה" (ו"שלח להנהלה" מתחתיו)', hint: 'כותבים וגם לוחצים "שלח להנהלה"' }),
  msg('email-alerts', 'קבל התראות למייל על הודעות חדשות', { aliases: ['התראות למייל'], kind: 'toggle', reveal: [{ click: 'msg.tab-settings' }], parent: 'msg.tab-settings', where: 'במרכז ההודעות ← "הגדרות", תיבת סימון (נשמרת מיד)', hint: 'מדליק או מכבה קבלת התראות במייל' }),
];

// ----- שעון נוכחות -----
const punch = (id, label, extra) => ({ id: `punch.${id}`, label, route: '/punch-clock', ...extra });
const punchTargets = [
  punch('employee', 'שם עובד', { aliases: ['מי אני', 'בחירת עובדת בשעון'], kind: 'field', where: 'בדף שעון הנוכחות, השדה העליון "שם עובד" (מקלידים ובוחרים מהרשימה)', hint: 'בוחרים את שמך' }),
  punch('password', 'סיסמה', { aliases: ['קוד מקוצר', 'סיסמה לשעון'], kind: 'field', where: 'בדף שעון הנוכחות, שדה "סיסמה" (במחשב מהימן אפשר גם קוד מקוצר של 4 תווים)', hint: 'סיסמת העובדת, או הקוד המקוצר' }),
  punch('in', 'כניסה למשמרת', { aliases: ['להחתים כניסה', 'כניסה לעבודה', 'התחלת משמרת'], kind: 'button', where: 'בדף שעון הנוכחות, הכפתור הימני בתחתית הטופס', hint: 'רושם כניסה למשמרת' }),
  punch('out', 'יציאה ממשמרת', { aliases: ['להחתים יציאה', 'סיום משמרת', 'יציאה מהעבודה'], kind: 'button', where: 'בדף שעון הנוכחות, הכפתור השמאלי בתחתית הטופס', hint: 'רושם יציאה ממשמרת' }),
  punch('back', 'חזרה למערכת', { aliases: ['חזרה לכניסה למערכת'], kind: 'link', where: 'בדף שעון הנוכחות, קישור מתחת לטופס', hint: 'חוזר לאתר' }),
];

// ----- השעות שלי -----
const hoursTargets = [
  { id: 'hours.card', label: 'השעות שלי', aliases: ['המשמרות שלי', 'סה״כ שעות החודש', 'דוח שעות אישי'], route: '/my-hours', kind: 'section', where: 'בדף "השעות שלי", הכרטיס עם השם שלך וטבלת המשמרות של החודש (כניסה, יציאה, סה״כ שעות)', hint: 'המשמרות והשעות שלך לפי חודש' },
  { id: 'hours.edit-mine', label: 'עריכת הנוכחות שלי', aliases: ['לתקן שעות', 'תיקון משמרת', 'שכחתי להחתים'], route: '/my-hours', kind: 'button', parent: 'hours.card', where: 'בדף "השעות שלי", בראש הכרטיס, הכפתור הכחול "עריכת הנוכחות שלי"', hint: 'פותח עריכה של המשמרות שלך בחודש (שורה שנערכה מסומנת "נערך ידנית")' },
];

// ----- עמדת לקוח (קיוסק) -----
// העמדה החדשה (app/components/kiosk/KioskA5.js) בשלושה שלבים: 1 תאריך האירוע, 2 דגם ומידה, 3 תוצאות (קטלוג השמלות הפנויות).
const kiosk = (id, label, extra) => ({ id: `kiosk.${id}`, label, route: '/customer-interface', ...extra });
// מגיעים לשלב התוצאות מהשלבים הקודמים רק אחרי שנבחר תאריך (הלחצן "לשלב הבא" פעיל); כשאין תאריך הלחיצה מדולגת והבועה נופלת ליעד האב
const KIOSK_RESULTS = [{ click: 'kiosk.step-next' }, { wait: 250 }, { click: 'kiosk.to-results' }, { wait: 250 }];
const kioskTargets = [
  kiosk('date-title', 'שלב 1 · סימון תאריך האירוע', { aliases: ['מתי האירוע שלכם', 'בחירת תאריך האירוע', 'לוח עברי בעמדה', 'תאריך האירוע בעמדה'], kind: 'section', where: 'בעמדת הלקוח, במסך הראשון ("שלב 1"): כותרת "סמני בלוח שלפנייך את תאריך האירוע" ומתחתיה לוח עברי', hint: 'לחיצה על יום בלוח בוחרת את תאריך האירוע' }),
  kiosk('step-next', 'לשלב הבא', { aliases: ['המשך לשלב 2', 'אחרי בחירת התאריך'], kind: 'button', parent: 'kiosk.date-title', where: 'בעמדת הלקוח, בשלב 1, מתחת ללוח (פעיל רק אחרי שנבחר תאריך)', hint: 'עובר לשלב 2: דגם ומידה' }),
  kiosk('register', 'למילוי הפרטים', { aliases: ['רישום עצמי של לקוחה', 'מילוי פרטים אישיים בעמדה', 'הרשמה בעמדה'], kind: 'button', access: { setting: ['kiosk_customer_self_service', 'true'] }, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, בשלב 1, בכרטיס "מילוי פרטים אישיים" בתחתית המסך (מוצג רק כשהרישום העצמי מופעל בהגדרות)', hint: 'הלקוחה ממלאת פרטים פעם אחת והעובדת ממשיכה איתה להזמנה' }),
  kiosk('model-size', 'שלב 2 · דגם ומידה', { aliases: ['מספר דגם בעמדה', 'מידה בעמדה', 'לצמצם לפי דגם ומידה'], kind: 'section', reveal: [{ click: 'kiosk.step-next' }, { wait: 250 }], parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך השני ("שלב 2"): שדה "מספר דגם" ושבבי מידה (אפשר לבחור כמה), שניהם רשות', hint: 'אפשר לצמצם לדגם או למידה, או לעבור ישר לתוצאות' }),
  kiosk('to-results', 'הצג תוצאות', { aliases: ['לקטלוג', 'לראות את השמלות הפנויות', 'מעבר לתוצאות'], kind: 'button', reveal: [{ click: 'kiosk.step-next' }, { wait: 250 }], parent: 'kiosk.model-size', where: 'בעמדת הלקוח, בשלב 2, בתחתית המסך', hint: 'מציג את קטלוג השמלות הפנויות בתאריך' }),
  kiosk('step-date', 'שינוי תאריך', { aliases: ['לשנות את תאריך האירוע בעמדה', 'חזרה לבחירת תאריך'], kind: 'button', reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות: הכפתור "שינוי תאריך" (בסרגל התאריך הקבוע, או בשורת הסיכום מעל התוצאות)', hint: 'חוזר לבחירת תאריך האירוע' }),
  kiosk('model-search', 'חיפוש דגם', { aliases: ['חיפוש שמלה בעמדה'], kind: 'field', access: { setting: ['kiosk_model_search', 'true'] }, reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות, בשורת הכלים (מוצג אם הוגדר באתר)', hint: 'מקלידים שם או מספר דגם' }),
  kiosk('filter-btn', 'סינון ותצוגה', { aliases: ['סינון קטלוג', 'פילטרים בעמדה'], kind: 'button', reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות, בשורת הכלים מעל השמלות', hint: 'פותח עמודת חיפוש, קטגוריה, מידה וצורת תצוגה' }),
  kiosk('filters', 'חיפוש וסינון הקטלוג', { aliases: ['קטגוריה', 'מידות', 'צורת תצוגה בעמדה', 'נקה את כל הסינונים'], kind: 'section', reveal: [...KIOSK_RESULTS, { click: 'kiosk.filter-btn' }], parent: 'kiosk.filter-btn', where: 'בעמדת הלקוח, במסך התוצאות, עמודה שנפתחת מהכפתור "סינון ותצוגה"', hint: 'חיפוש, קטגוריה, מידה וצורת תצוגה' }),
  kiosk('print', 'הדפסה', { aliases: ['הדפסת קטלוג', 'להדפיס את הקטלוג'], kind: 'icon', reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות, באשכול האייקונים בצד שמאל של שורת הכלים (כשהמסך נעול ההדפסה דורשת אישור עובד)', hint: 'מדפיס את הקטלוג המסונן' }),
  kiosk('refresh', 'רענון מלאי', { aliases: ['רענון'], kind: 'icon', reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות, באשכול האייקונים בצד שמאל של שורת הכלים', hint: 'טוען את המלאי מחדש' }),
  kiosk('lock', 'נעילת מסך ללקוח', { aliases: ['נעילת עמדה', 'מסך מלא', 'לנעול את העמדה'], kind: 'icon', reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות, באשכול האייקונים בצד שמאל של שורת הכלים (מנעול)', hint: 'עובר למסך מלא; כדי לצאת צריך אישור עובדת' }),
  kiosk('exit', 'חזרה למערכת', { aliases: ['יציאה מעמדת לקוח', 'חזרה לאתר מהעמדה'], kind: 'icon', reveal: KIOSK_RESULTS, parent: 'kiosk.date-title', where: 'בעמדת הלקוח, במסך התוצאות, באשכול האייקונים בצד שמאל של שורת הכלים (חץ יציאה)', hint: 'חוזר לאתר הרגיל (כשהמסך נעול דורש אישור עובדת)' }),
];

export const targets = [...homeTargets, ...schedTargets, ...stockTargets, ...boardTargets, ...nwdTargets, ...profTargets, ...dispTargets, ...msgTargets, ...punchTargets, ...hoursTargets, ...kioskTargets];

// data-guide-id דינמי (תבנית בקוד): הקידומת חייבת להופיע בקובץ
export const dynamic = [
  { prefix: 'srch.adv-focus-', file: 'app/components/home/HomeAdvanced.js' },
  { prefix: 'srch.adv-f-', file: 'app/components/home/HomeAdvanced.js' },
  { prefix: 'srch.adv-d-', file: 'app/components/home/HomeAdvanced.js' },
  { prefix: 'home.footer-', file: 'app/components/home/HomeFooter.js' },
  { prefix: 'sched.rail-', file: 'app/components/schedule/StageRail.js' },
  { prefix: 'sched.sec-', file: 'app/components/schedule/StageSection.js' },
  { prefix: 'sched.tool-', file: 'app/components/schedule/ScheduleToolbarSlots.js' },
  { prefix: 'sched.sec-tool-', file: 'app/components/schedule/ScheduleToolbarSlots.js' },
  { prefix: 'stock.field-', file: 'app/components/stock/StockCheckPage.js' },
];
