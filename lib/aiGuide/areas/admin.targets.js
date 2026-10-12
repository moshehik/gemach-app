// lib/aiGuide/areas/admin.targets.js - יעדי ההצבעה של אזור "ניהול": הגדרות מערכת / אתר / שינוי שמות (set.*), מסך הניהול הראשי (hub.*), הרשאות (perm.*),
// מחלקות (dpt.*), יומן מיילים (eml.*), היסטוריית נתונים (dhs.*), היסטוריית ניהול (mgh.*), סטטיסטיקה (stat.*), עמודי ה-AI (aiadm.*), דשבורד (dash.*),
// מפתחות API (apikey.*), סייר נתונים (dx.*) וגיבוי בסיס נתונים (dbadm.*). קובץ שנטען גם בדפדפן (targetsIndex.js): רק נתונים, ובנוסף resolveDynamic
// לשורות הגדרה בודדות - ייבוא של lib/settingsMetadata.js ו-lib/settingsSimLayout.js בלבד (שניהם טהורים ו-SettingsSimPage כבר מייבא אותם בצד לקוח).
// אסור לייבא לכאן את lib/adminHubCatalog.js (צד שרת בלבד; מבחן test_admin_hub) - יעדי hub.* נכתבים ידנית, הבדיקה מכריחה יעד לכל כלי בקטלוג.
//
// ערכי data-guide-id הדינמיים בקוד:
//   set.cat-<מזהה לשונית>   SettingsSimPage.js (tabGuideId; קו תחתון -> מקף: site_more -> site-more)  |  set.names-<מזהה> לשוניות "שינוי שמות"
//   set.key-<מפתח הגדרה>    SettingRow.js: המפתח באותיות קטנות וקו תחתון -> מקף (hok_enabled -> set.key-hok-enabled, BUFFER_DAYS -> set.key-buffer-days)
//   hub.<מזהה כלי> / hub.cat-<קטגוריה> / hub.view-<rows|table|tiles>   AdminHubPage.js
//   stat.tab-<מזהה>         app/admin/statistics/page.js
//   <guide>.back/search/filter/sort/view/export-*/filter-<קבוצה>  רשימות A5 (guide="dpt|eml|dhs|mgh" ב-A5List / A5ListPage)
import { SETTINGS_HEBREW_NAMES, SETTINGS_ORDER, getSettingDisplayName } from '../../settingsMetadata.js';
import { SECTIONS, SYS_TABS, SITE_TABS, KEY_UI, HIDDEN_KEYS, placeRow } from '../../settingsSimLayout.js';

const SET = '/admin/settings';
const SITE = '/admin/site-settings';
const PROG = { gate: 'prog' };

// ============================================================ הגדרות מערכת / אתר
// פריטים משותפים לשלושת מסכי ההגדרות (הגדרות מערכת, הגדרות אתר, שינוי שמות): אותו רכיב (SettingsSimPage) ולכן route '*' - מדגישים בדף שבו עומדים.
const SHARED = [
  { id: 'set.nav', label: 'רשימת קבוצות ההגדרות', aliases: ['קבוצות הגדרות', 'קטגוריות הגדרות', 'לשוניות ההגדרות', 'נושאי ההגדרות'], route: '*', kind: 'section',
    where: 'במסך ההגדרות, רשימת הנושאים בצד המסך (בטלפון: שורת לשוניות בראש המסך); לחיצה על נושא מציגה את ההגדרות שלו', hint: 'כל נושא הוא קבוצה של הגדרות קרובות: תצורה, תשלומים, הזמנות, משלוחים, הדפסה ועוד' },
  { id: 'set.search', label: 'חיפוש הגדרה', aliases: ['חיפוש בהגדרות', 'למצוא הגדרה', 'לחפש הגדרה', 'חיפוש כיתוב'], route: '*', kind: 'field',
    where: 'במסך ההגדרות (הגדרות מערכת / הגדרות אתר / שינוי שמות), שדה החיפוש מתחת לכותרת', hint: 'מקלידים חלק משם ההגדרה או מההסבר שלה; הרשימה מצטמצמת ועוברת לנושא שיש בו תוצאות' },
  { id: 'set.changes', label: 'שינויים לשמירה', aliases: ['רשימת השינויים', 'מה שיניתי', 'פאנל השינויים'], route: '*', kind: 'section', parent: 'set.nav',
    where: 'במסך ההגדרות, בסרגל שליד רשימת הנושאים; מופיע רק אחרי ששינו ערך אחד לפחות', hint: 'כאן רואים כל שינוי שעוד לא נשמר ("מ-" ← "אל"), ומבטלים שינוי בודד' },
  { id: 'set.save', label: 'שמירת השינויים', aliases: ['שמירה', 'לשמור הגדרות', 'כפתור שמירה', 'שמור'], route: '*', kind: 'button', parent: 'set.changes',
    where: 'במסך ההגדרות, בפאנל "שינויים לשמירה" בצד המסך (בטלפון: סימן ה-V בסרגל התחתון); מופיע רק אחרי ששינו ערך', hint: 'שומר את כל השינויים ביחד. אם אין התחברות תתבקשו לבחור מנהל ולהזין סיסמה' },
  { id: 'set.discard', label: 'ביטול השינויים', aliases: ['ביטול', 'לבטל שינויים', 'חזרה לערכים השמורים'], route: '*', kind: 'button', parent: 'set.changes',
    where: 'במסך ההגדרות, בפאנל "שינויים לשמירה" מתחת לכפתור השמירה; מופיע רק אחרי ששינו ערך', hint: 'מחזיר את כל ההגדרות לערכים השמורים' },
  { id: 'set.back', label: 'חזרה למסך ניהול', aliases: ['חץ חזרה', 'חזרה לניהול'], route: '*', kind: 'button',
    where: 'במסך ההגדרות, חץ החזרה בפינה ליד הכותרת', hint: 'חוזר למסך הניהול הראשי' },
];

// לשוניות "הגדרות מערכת" (SYS_TABS ב-lib/settingsSimLayout.js). settingsCategory = שם הקטגוריה ב-lib/settingsMetadata.js שהלשונית מציגה (settingsCategories = כולן).
const sysTab = (id, label, settingsCategories, aliases, hint) => ({
  id: `set.cat-${id}`, label, aliases, route: SET, query: `tab=${id}`, kind: 'tab', parent: 'set.nav',
  where: `בהגדרות מערכת, ברשימת הנושאים בצד המסך (בטלפון: שורת הלשוניות למעלה), "${label}"`, hint,
  settingsCategory: settingsCategories[0], settingsCategories,
});
const siteTab = (id, label, settingsCategories, aliases, hint) => ({
  id: `set.cat-${id.replace(/_/g, '-')}`, label, aliases, route: SITE, query: `tab=${id}`, kind: 'tab', access: PROG,
  where: `בהגדרות אתר (מתכנת בלבד), ברשימת הנושאים בצד המסך (בטלפון: שורת הלשוניות למעלה), "${label}"`, hint,
  settingsCategory: settingsCategories[0], settingsCategories,
});
const namesTab = (id, label, aliases, hint) => ({
  id: `set.names-${id.replace(/_/g, '-')}`, label, aliases, route: '/admin/labels', query: `tab=${id}`, kind: 'tab', access: PROG,
  where: `בשינוי שמות (מתכנת בלבד), ברשימת הנושאים בצד המסך (בטלפון: שורת הלשוניות למעלה), "${label}"`, hint,
});

const SET_TABS = [
  sysTab('cfg', 'תצורה', ['כללי', 'סניפים'], ['הגדרות כלליות', 'פרטי הגמ"ח', 'שם הגמ"ח', 'טלפון ומייל ראשי', 'סניפים', 'כללי השכרה', 'חובת התחברות'],
    'פרטי הגמ״ח, כללי השכרה (ימי מרווח, יום השכרה נוסף, תאריכים עבריים בלבד), כללי מערכת (חובת התחברות, מיקומי פריטים) וסניפים'),
  sysTab('brand', 'מיתוג', ['כותרות'], ['לוגו', 'כותרת משנה', 'כותרת דף הבית', 'זהות המערכת'], 'זהות המערכת (כותרת משנה, כותרת דף הבית) והעלאת הלוגו'),
  sysTab('pay', 'תשלומים', ['תשלומים', 'הוראת קבע', 'מחירון'], ['הגדרות תשלום', 'אמצעי תשלום', 'זיכויים וביטולים', 'מדיניות ביטול', 'נדרים פלוס', 'הוראת קבע', 'הו"ק', 'תמחור פרימיום', 'החלפת מידה'],
    'אמצעי תשלום, מדיניות זיכויים וביטולים, תמחור פרימיום, החלפת מידה, סליקת אשראי בנדרים פלוס והוראת קבע'),
  sysTab('bc', 'ברקודים', ['ברקודים'], ['ברקוד', 'סריקה', 'ברקוד ידני', 'ברקוד לא תקין'], 'סריקה (אורך מספר הדגם) וברקוד ידני ולא תקין'),
  sysTab('msg', 'הודעות', ['הודעות', 'אוטומציה'], ['מיילים אוטומטיים', 'תזכורת איסוף', 'מייל למאחרים', 'דוח יומי למנהל', 'רשימת תפוצה', 'הודעות פנימיות'],
    'מיילים אוטומטיים ללקוחות (אישור הזמנה, תזכורת איסוף, מאחרים), דוח יומי למנהל, רשימת תפוצה והודעות פנימיות'),
  sysTab('auto', 'אוטומציה', ['גיבויים'], ['גיבוי אוטומטי', 'גיבוי לדרייב'], 'גיבוי אוטומטי (הפעלה, מרווח שעות, תיקיית דרייב, מייל בעלים)'),
  sysTab('sync', 'סנכרון', ['סנכרון'], ['ימות המשיח', 'סנכרון טלפוני'], 'סנכרון ימות המשיח'),
  sysTab('ord', 'הזמנות', ['הזמנות'], ['הגדרות הזמנה', 'שדות חובה', 'מסך ההזמנה', 'מגבלות הזמנה', 'תיקונים', 'אימות בהזמנה', 'הזמנה חדשה'],
    'שדות חובה בלקוח, אימות והרשאות בהזמנה, מגבלות (מקסימום פריטים), מסך ההזמנה (תיקונים, הדפסה אוטומטית, צורת טופס הזמנה חדשה) וכרטיס ההזמנה'),
  sysTab('dlv', 'משלוחים', ['משלוחים'], ['הגדרות משלוחים', 'מחיר משלוח', 'משלוחן', 'ימי משלוח'], 'הפעלת משלוחים ומחירים, תזמון (ימים לפני ואחרי האירוע) ופרטי המשלוחן'),
  sysTab('inv', 'מלאי ויומן', ['מלאי', 'יומן'], ['הגדרות מלאי', 'ימי מרווח', 'רווח בין השכרות', 'השכרת רזרבה'], 'מלאי (מחסן, רזרבה, החזקת פריט), רווחים בין השכרות ובקרה בהשכרה ובהחזרה'),
  sysTab('prn', 'הדפסה', ['הדפסה'], ['הגדרות הדפסה', 'מסמכי השכרה', 'הערות בהדפסה', 'תקנון בהדפסה', 'הדפסת אצווה'], 'מסמכי השכרה מודפסים (הערות, תקנון, שעות סטנדרטיות) והדפסת אצווה ומיון'),
  sysTab('disp', 'תצוגה וממשק', ['תצוגה', 'בינה מלאכותית'], ['הגדרות תצוגה', 'עמדת לקוח', 'קיוסק', 'דיווחי שגיאות', 'בינה מלאכותית', 'הפעלת AI', 'תמונות דגמים'],
    'תצוגה כללית, עמדת לקוח (קיוסק), דיווחי שגיאות, בינה מלאכותית, והכפתור שפותח את מסך ההרשאות'),
  sysTab('unused', 'לא בשימוש', ['לא בשימוש'], ['הגדרות ישנות', 'מפתחות שאינם בשימוש'], 'מפתחות שהמערכת כבר לא קוראת: נשמרים לתיעוד בלבד, שינוי שלהם לא משנה דבר'),
  sysTab('more', 'הגדרות נוספות', [], ['שאר ההגדרות', 'הגדרות אחרות'], 'הגדרות שלא שויכו לנושא אחר'),
];
const SITE_TABS_T = [
  siteTab('db', 'מסד נתונים', ['מסד נתונים'], ['סביבת עבודה', 'מסד בדיקות', 'מסד ייצור', 'צריכת Neon'], 'סביבה וחיבורים (מעבר בין ייצור לבדיקות) וצריכת מסד הנתונים (Neon)'),
  siteTab('sys', 'מערכת', ['מערכת'], ['סוכן תיקון', 'הגדרות מערכת למתכנת'], 'סוכן תיקון אוטומטי'),
  siteTab('mail', 'מיילים', ['מיילים'], ['ניתוב מיילים', 'קישורי פריסה', 'תיקיית דרייב למיילים'], 'קישורי שליחה וניתוב מיילים'),
  siteTab('site_more', 'הגדרות נוספות', [], ['שאר הגדרות המתכנת'], 'הגדרות מתכנת שלא שויכו לנושא אחר'),
];
const NAMES_TABS_T = [
  namesTab('customers', 'לקוחות', ['כיתובי לקוחות', 'שם פרטי', 'שם משפחה', 'טלפון'], 'כיתובי שדות הלקוח (שם פרטי, משפחה, טלפונים, כתובת, מייל, הערות)'),
  namesTab('orders', 'הזמנות', ['כיתובי הזמנות', 'מספר הזמנה', 'תאריך אירוע'], 'כיתובי עמודות ההזמנה (מספר, שם לקוח, תאריכים, סה"כ, שולם, סטטוס)'),
  namesTab('dresses', 'דגמים ופריטים', ['כיתובי דגמים', 'שם דגם', 'מידה', 'ברקוד'], 'כיתובי הדגם והפריט (שם, קידומת ברקוד, קטגוריה, מחיר, מידה, מיקום, סטטוס)'),
  namesTab('rentals', 'השכרות', ['כיתובי השכרות', 'נלקח', 'הוחזר'], 'כיתובי השכרות (לקוח, ברקוד, נלקח, הוחזר, הוחזר תקין, הערות)'),
  namesTab('customer_availability', 'זמינות לקוח', ['כיתובי זמינות', 'כותרת זמינות'], 'כיתובי מסך זמינות לקוח'),
  namesTab('tabs', 'כותרות טאבים', ['כותרות לשוניות', 'שמות לשוניות'], 'כותרות הלשוניות (לקוחות, הזמנות, השכרות, דגמים, זמינות לקוח)'),
];

const SET_EXTRA = [
  { id: 'set.logo-upload', label: 'העלאת לוגו', aliases: ['להחליף לוגו', 'לוגו הגמ"ח', 'העלאת תמונת לוגו'], route: SET, kind: 'button', reveal: [{ click: 'set.cat-brand' }], parent: 'set.cat-brand',
    where: 'בהגדרות מערכת ← לשונית "מיתוג" ← סעיף "קבצי מיתוג", כפתור הפלוס', hint: 'בוחרים קובץ תמונה (PNG/JPG) והוא יופיע בראש העמודים ובהדפסות' },
  { id: 'set.permissions-link', label: 'ניהול הרשאות (מחלקות ועובדים)', aliases: ['פתיחת ניהול הרשאות', 'קישור להרשאות', 'מי נכנס לאן'], route: SET, kind: 'link', reveal: [{ click: 'set.cat-disp' }], parent: 'set.cat-disp',
    where: 'בהגדרות מערכת ← לשונית "תצוגה וממשק" ← סעיף "הרשאות", הכפתור "פתיחה"', hint: 'פותח את מסך ההרשאות בעמוד נפרד' },
  { id: 'set.db-mode', label: 'סביבת עבודה (ייצור / בדיקות)', aliases: ['מסד בדיקות', 'מסד ייצור', 'מעבר לבדיקות', 'סביבת בדיקות'], route: SITE, kind: 'toggle', access: PROG, reveal: [{ click: 'set.cat-db' }], parent: 'set.cat-db',
    where: 'בהגדרות אתר ← לשונית "מסד נתונים" ← סעיף "סביבה וחיבורים", המתג "ייצור / בדיקות"', hint: 'משנה את מסד הנתונים של האתר החי לכל המשתמשים (דורש אישור)' },
  { id: 'set.db-device-mode', label: 'נתוני גיבוי במחשב הזה בלבד', aliases: ['מסד גיבוי במחשב', 'מצב גיבוי למחשב', 'אמיתי / גיבוי'], route: SITE, kind: 'toggle', access: PROG, reveal: [{ click: 'set.cat-db' }], parent: 'set.cat-db',
    where: 'בהגדרות אתר ← לשונית "מסד נתונים" ← סעיף "סביבה וחיבורים", המתג "אמיתי / גיבוי"', hint: 'רק הדפדפן הזה עובד מול מסד הגיבוי; שאר המחשבים רואים נתונים אמיתיים' },
  { id: 'set.neon-refresh', label: 'רענון צריכת Neon', aliases: ['צריכת מסד הנתונים', 'עלות Neon', 'תקופת חיוב'], route: SITE, kind: 'button', access: PROG, reveal: [{ click: 'set.cat-db' }], parent: 'set.cat-db',
    where: 'בהגדרות אתר ← לשונית "מסד נתונים" ← סעיף "צריכת מסד הנתונים (Neon)", הכפתור "רענון"', hint: 'טוען מחדש את נתוני הצריכה והעלות' },
  { id: 'set.email-logs-link', label: 'יומן מיילים', aliases: ['לוג מיילים', 'מיילים שנשלחו'], route: SITE, kind: 'link', access: PROG,
    where: 'בהגדרות אתר, בכותרת העליונה ליד התווית "מתכנת בלבד"', hint: 'פותח את יומן שליחת המיילים' },
  { id: 'set.names-reset', label: 'שחזר ברירת מחדל', aliases: ['איפוס כיתובים', 'להחזיר כיתובים מקוריים'], route: '/admin/labels', kind: 'button', access: PROG,
    where: 'בשינוי שמות, בכותרת העליונה', hint: 'מחזיר את כל הכיתובים לברירת המחדל (נקלט רק אחרי שמירה)' },
];

// ============================================================ מסך הניהול הראשי (/admin)
const HUB = '/admin';
const hubTool = (id, label, aliases) => ({ id: `hub.${id}`, label, aliases, route: HUB, kind: 'link', hubTool: id });
const hubCat = (id, label, aliases) => ({
  id: `hub.cat-${id}`, label, aliases, route: HUB, kind: 'section',
  where: `במסך הניהול הראשי, הקבוצה "${label}"`, hint: `הכלים של הקבוצה "${label}"`,
});
const HUB_TARGETS = [
  { id: 'hub.search', label: 'חיפוש כלי ניהול', aliases: ['חיפוש בכלי הניהול', 'למצוא כלי ניהול'], route: HUB, kind: 'field', where: 'במסך הניהול הראשי, שדה החיפוש בראש המסך', hint: 'מחפשים לפי שם הכלי, התיאור או שם הקבוצה' },
  { id: 'hub.views', label: 'מצב תצוגה', aliases: ['תצוגת קוביות', 'תצוגת שורות', 'תצוגת טבלה', 'להחליף תצוגה'], route: HUB, kind: 'toggle', where: 'במסך הניהול הראשי, המתג ליד שדה החיפוש', hint: 'עוברים בין שורות, טבלה וקוביות (הבחירה נשמרת לכל משתמשת)' },
  { id: 'hub.view-rows', label: 'תצוגת שורות', aliases: ['שורות'], route: HUB, kind: 'button', parent: 'hub.views', where: 'במסך הניהול הראשי, המתג ליד שדה החיפוש, הלחצן הראשון', hint: 'מציג את הכלים כשורות עם תיאור' },
  { id: 'hub.view-table', label: 'תצוגת טבלה', aliases: ['טבלה'], route: HUB, kind: 'button', parent: 'hub.views', where: 'במסך הניהול הראשי, המתג ליד שדה החיפוש, הלחצן האמצעי', hint: 'מציג את הכלים כטבלה' },
  { id: 'hub.view-tiles', label: 'תצוגת קוביות', aliases: ['קוביות', 'אריחים'], route: HUB, kind: 'button', parent: 'hub.views', where: 'במסך הניהול הראשי, המתג ליד שדה החיפוש, הלחצן האחרון', hint: 'מציג את הכלים כקוביות (ברירת המחדל)' },
  hubCat('settings', 'הגדרות ומיתוג', ['הגדרות', 'מיתוג']),
  hubCat('pricing', 'תמחור וחישובים', ['מחירון וחישובים', 'זיכויים']),
  hubCat('nedarim', 'נדרים פלוס - הוראות קבע', ['הוראות קבע', 'נדרים']),
  hubCat('insights', 'תובנות ודוחות', ['דוחות', 'AI וסטטיסטיקה']),
  hubCat('control', 'בקרה ואבטחה', ['בקרה', 'אבטחה']),
  hubCat('data', 'נתונים והיסטוריה', ['היסטוריה', 'נתונים']),
  hubCat('backup', 'גיבוי ושחזור', ['גיבויים']),
  hubCat('mail', 'מיילים', ['דוא"ל']),
  hubCat('setup', 'ייבוא והתקנה', ['התקנה']),
  hubCat('daily', 'עבודה שוטפת', ['עבודה יומיומית', 'כלים שוטפים']),
  hubTool('permissions', 'הרשאות', ['הרשאות עובדות', 'מי רשאי', 'הרשאות לפי מחלקה']),
  hubTool('settings', 'הגדרות מערכת', ['הגדרות', 'הגדרות האתר', 'הגדרות הגמ"ח']),
  hubTool('non-working-days', 'ימי אי-פעילות', ['ימי סגירה', 'חגים', 'ימים סגורים']),
  hubTool('site', 'ניהול אתר', ['ניהול האתר למתכנת', 'מסך ניהול למתכנת']),
  hubTool('site-settings', 'הגדרות אתר', ['הגדרות מתכנת', 'הגדרות מסד נתונים ומיילים']),
  hubTool('api-keys', 'מפתחות API', ['מפתח גישה', 'מפתחות גישה', 'מפתח לסוכן']),
  hubTool('labels', 'שינוי שמות', ['שינוי כיתובים', 'שינוי טקסטים', 'שמות שדות', 'לשנות שם של עמודה']),
  hubTool('design-system', 'מערכת העיצוב', ['פלטת העיצוב', 'רכיבי עיצוב']),
  hubTool('pricelist', 'ניהול מחירון', ['מחירון', 'מחירים', 'מחירי השכרה']),
  hubTool('recalculations', 'חישובים', ['חישוב מחדש', 'פערי תשלומים', 'בדיקת תשלומים']),
  hubTool('refund-policy', 'מדיניות זיכויים', ['חוקי ביטול', 'מדיניות ביטולים', 'החזרים']),
  hubTool('refunds', 'זיכויים וחובות', ['זיכוי', 'חובות', 'יתרות זכות']),
  hubTool('nedarim-hok-list', 'רשימת הוראות קבע (הו״ק)', ['הוראות קבע', 'רשימת הו"ק', 'הוק']),
  hubTool('nedarim-hok-search', 'חיפוש בהוראות קבע', ['חיפוש הו"ק', 'למצוא הוראת קבע']),
  hubTool('nedarim-hok-edit', 'שינוי הו״ק וגביית תשלום בודד', ['עריכת הו"ק', 'גביית תשלום בודד', 'שינוי הוראת קבע']),
  hubTool('nedarim-payments-recent', 'תשלומים אחרונים בנדרים פלוס', ['תשלומי נדרים', 'עסקאות אשראי אחרונות']),
  hubTool('nedarim-hok-test', 'יצירת הוק (ניסוי)', ['יצירת הוראת קבע', 'הוק חדש']),
  hubTool('ai', 'מערכת AI', ['עוזר AI למנהל', 'בינה מלאכותית', 'צ\'אט AI למנהל']),
  hubTool('ai-history', 'היסטוריית AI', ['שיחות AI', 'היסטוריית שיחות עם העוזר']),
  hubTool('statistics', 'סטטיסטיקה', ['דוחות', 'סטטיסטיקות', 'מרכז נתונים ופילוח']),
  hubTool('dashboard', 'דשבורד', ['כספים', 'סיכום כספי', 'הכנסות', 'גרפים ומגמות']),
  hubTool('ai-restrictions', 'מגבלות AI', ['הגבלות AI', 'מה מותר ל-AI']),
  hubTool('inventory-alerts', 'התראות מלאי', ['התראות', 'Overbooking', 'חריגות מלאי']),
  hubTool('trusted-devices', 'מחשבי מערכת מהימנים', ['מחשב מהימן', 'כניסה ב-4 ספרות']),
  hubTool('departments', 'ניהול מחלקות', ['מחלקות', 'תפקידי עובדים', 'מספרי מחלקה']),
  hubTool('barcode-invalid', 'ברקודים לא תקינים', ['ברקוד לא תקין', 'ברקודים פגומים']),
  hubTool('data-explorer', 'סייר נתונים', ['שאילתות SQL', 'סייר טבלאות']),
  hubTool('data-explorer-full', 'תצוגה מלאה', ['טבלה מלאה', 'כל הטבלאות במסך אחד']),
  hubTool('data-history', 'היסטוריית נתונים', ['מידע והיסטוריה', 'יומן שינויים', 'מי שינה מה']),
  hubTool('browse-history', 'היסטוריית גלישה', ['היסטוריית ניהול', 'יומן ביקורים', 'שאילתות API']),
  hubTool('database', 'גיבוי בסיס נתונים', ['ניהול מסד נתונים', 'גיבוי JSON', 'ייבוא קובץ אקסס']),
  hubTool('backups', 'גיבוי לדרייב', ['גיבוי אוטומטי', 'גיבוי לגוגל דרייב']),
  hubTool('email-logs', 'יומן מיילים', ['מיילים שנשלחו', 'יומן שליחה', 'לוג מיילים']),
  hubTool('email-test', 'בדיקת מיילים', ['בדיקת מייל', 'מייל לדוגמה']),
  hubTool('bulk-email', 'שליחת מייל לפי תאריך אירוע', ['מייל המוני', 'דיוור לפי תאריך אירוע', 'מייל לכל הלקוחות']),
  hubTool('access-import', 'ייבוא מאקסס', ['ייבוא אקסס', 'תיעוד הייבוא']),
  hubTool('setup-new-machine', 'התקנה על מחשב חדש', ['מחשב חדש', 'סקריפט התקנה']),
  hubTool('dresses', 'דגמים', ['קטלוג דגמים', 'דגמים ומידות']),
  hubTool('employees', 'עובדים', ['עובדות', 'נוכחות עובדים']),
  hubTool('orders-list', 'כל ההזמנות', ['רשימת הזמנות לניהול', 'ייצוא הזמנות']),
  hubTool('customers-list', 'כל הלקוחות', ['רשימת לקוחות לניהול', 'ייצוא לקוחות']),
  hubTool('deliveries', 'משלוחים', ['שליחויות', 'משלוח שמלות']),
];

// ============================================================ רשימות A5 (guide="dpt|eml|dhs|mgh"): אותו מנוע רשימות כמו כל הרשימות החדשות (app/components/a5-list)
function listTargets(p, route, what, nouns, filters, extra = {}) {
  const where = (s) => `ב${what}, ${s}`;
  const base = extra.access ? { access: extra.access } : {};
  return [
    { id: `${p}.back`, label: extra.backLabel || 'חץ חזרה למרכז הניהול', aliases: ['חץ חזרה', 'חזרה לניהול', 'חזרה למסך הניהול'], route, kind: 'button', ...base, where: where('חץ החזרה בפינה העליונה ליד הכותרת'), hint: extra.backHint || 'חוזר למסך "כל כלי הניהול"' },
    { id: `${p}.search`, label: `חיפוש ${nouns.one}`, aliases: [`שדה חיפוש ${nouns.many}`, `חיפוש ב${nouns.many}`, 'תיבת חיפוש'], route, kind: 'field', ...base, where: where('שדה החיפוש בחצי הרוחב שמתחת לכותרת'), hint: nouns.searchHint },
    { id: `${p}.filter`, label: 'סינון', aliases: ['לחצן סינון', 'מסננים', 'סנן', 'פילטר'], route, kind: 'button', ...base, where: where('הלחצן "סינון" בתוך שדה החיפוש (בצד שמאל שלו)'), hint: 'פותח את חלון הסינון, עם קבוצות ואפשרויות לבחירה' },
    ...filters.map((f) => ({
      id: `${p}.filter-${f.key}`, label: f.label, aliases: f.aliases, route, kind: 'section', ...base, where: where(`חלון "סינון", קבוצה "${f.label}"`), hint: f.hint,
      reveal: [{ click: `${p}.filter` }], parent: `${p}.filter`,
    })),
    { id: `${p}.sort`, label: 'מיון', aliases: ['לחצן מיון', 'סדר', 'למיין', 'כיוון מיון'], route, kind: 'button', ...base, where: where('הלחצן "מיון" בסרגל התוצאות שמעל הרשימה'), hint: 'פותח בחירת שדה מיון וכיוון (עולה / יורד)' },
    { id: `${p}.view`, label: 'מתג שורות / טבלה', aliases: ['תצוגת טבלה', 'תצוגת שורות', 'מצב תצוגה'], route, kind: 'toggle', ...base, where: where('המתג הקטן בסרגל התוצאות: שורות או טבלה'), hint: 'מחליף בין תצוגת שורות לתצוגת טבלה עם עמודות' },
    { id: `${p}.export-excel`, label: 'ייצוא ל-Excel', aliases: ['אקסל', 'להוריד לאקסל', 'ייצוא לאקסל', 'הורדת אקסל'], route, kind: 'button', ...base, where: where('אייקון Excel הירוק בקצה סרגל התוצאות'), hint: `מייצא את ${nouns.exportWhat} (לפי החיפוש והסינון) לקובץ Excel` },
    { id: `${p}.export-download`, label: 'הורדה (PDF)', aliases: ['הורדת PDF', 'ייצוא ל-PDF', 'PDF'], route, kind: 'button', ...base, where: where('אייקון ההורדה בקצה סרגל התוצאות, ליד Excel'), hint: `מכין ${nouns.exportWhat} כקובץ PDF באותו עיצוב כמו ההדפסה` },
    { id: `${p}.export-print`, label: 'הדפסה', aliases: ['להדפיס את הרשימה', 'הדפסת הרשימה', 'הדפס'], route, kind: 'button', ...base, where: where('אייקון המדפסת בקצה סרגל התוצאות'), hint: `פותח תצוגה מקדימה להדפסת ${nouns.exportWhat}` },
  ];
}

const PERIOD_ALIASES = ['סינון לפי תאריך', 'טווח תאריכים', 'היום', 'טווח מותאם'];
const DPT_FILTERS = [
  { key: 'kind', label: 'סוג מחלקה', aliases: ['תפקיד מערכת', 'מחלקה רגילה'], hint: 'סוג מחלקה: תפקיד מערכת או מחלקה רגילה' },
  { key: 'staff', label: 'עובדים', aliases: ['מחלקות עם עובדים', 'מחלקות בלי עובדים'], hint: 'עובדים: מחלקות שיש בהן עובדים או שאין' },
];
const EML_FILTERS = [
  { key: 'types', label: 'סוג מייל', aliases: ['סוג המייל', 'אישור הזמנה', 'תזכורת איסוף'], hint: 'סוג מייל: אישור הזמנה, תזכורות, מיילים ללקוחות ועוד' },
  { key: 'statuses', label: 'סטטוס שליחה', aliases: ['נכשל', 'נשלח', 'מיילים שנכשלו'], hint: 'סטטוס שליחה: נשלח, נכשל ועוד' },
  { key: 'period', label: 'תאריך שליחה', aliases: PERIOD_ALIASES, hint: 'תאריך שליחה: נשלחו היום, 7 או 30 ימים אחרונים, שנה, או טווח מותאם בלוח עברי' },
  { key: 'senders', label: 'נשלח על ידי', aliases: ['מי שלחה', 'שולח'], hint: 'נשלח על ידי: עובד מסוים, או אוטומטי (בלי עובד); מוצג רק כשיש שולחים ביומן' },
];
const DHS_FILTERS = [
  { key: 'types', label: 'סוג רשומה', aliases: ['הזמנה', 'לקוח', 'דגם', 'סוג השינוי'], hint: 'סוג רשומה: הזמנה, לקוח, דגם, עובד ועוד' },
  { key: 'actions', label: 'פעולה', aliases: ['נוצר', 'עודכן', 'נמחק'], hint: 'פעולה: יצירה, עדכון, מחיקה' },
  { key: 'employees', label: 'עובד', aliases: ['מי ביצעה', 'שינויים של עובדת'], hint: 'עובד: מי ביצעה את השינוי (או "מערכת" לפעולה אוטומטית)' },
  { key: 'period', label: 'תקופה', aliases: PERIOD_ALIASES, hint: 'תקופה: היום, 7 או 30 ימים אחרונים, שנה, או טווח מותאם בלוח עברי' },
];
const MGH_FILTERS = [
  { key: 'types', label: 'סוג', aliases: ['שאילתות API', 'ביקורי מסכים'], hint: 'סוג: שאילתות API או ביקורי מסכים' },
  { key: 'status', label: 'מצב', aliases: ['עם תקלה', 'תקין', 'שגיאות'], hint: 'מצב: עם תקלה או תקין' },
  { key: 'employees', label: 'עובד', aliases: ['מי גלשה', 'אורחים'], hint: 'עובד: מי ביצעה את הביקור או השאילתה (או אורחים שלא מחוברים)' },
  { key: 'period', label: 'תקופה', aliases: PERIOD_ALIASES, hint: 'תקופה: היום, 7 או 30 ימים אחרונים, שנה, או טווח מותאם בלוח עברי' },
];

const LIST_TARGETS = [
  ...listTargets('dpt', '/admin/departments', 'מסך "מחלקות"', { one: 'מחלקה', many: 'מחלקות', exportWhat: 'רשימת המחלקות', searchHint: 'מחפשים לפי שם המחלקה או מספרה' }, DPT_FILTERS),
  { id: 'dpt.new', label: 'מחלקה חדשה', aliases: ['יצירת מחלקה', 'להוסיף מחלקה', 'מחלקה חדשה בניהול'], route: '/admin/departments', kind: 'button',
    where: 'במסך "מחלקות", בכותרת הכרטיס "ניהול מחלקות", הכפתור "מחלקה חדשה"', hint: 'פותח חלון ליצירת מחלקה: מספר מחלקה ושם' },
  ...listTargets('eml', '/admin/site-settings/email-logs', 'יומן המיילים', { one: 'מייל', many: 'מיילים', exportWhat: 'יומן המיילים', searchHint: 'מחפשים לפי נמען, נושא או תוכן' }, EML_FILTERS,
    { access: PROG, backLabel: 'חץ חזרה להגדרות האתר', backHint: 'חוזר למסך "הגדרות אתר"' }),
  ...listTargets('dhs', '/admin/data-history', 'מסך "היסטוריית נתונים"', { one: 'שינוי', many: 'שינויים', exportWhat: 'יומן השינויים', searchHint: 'מחפשים בפרטי השינוי: טלפון, שם, עיר, מספר הזמנה' }, DHS_FILTERS),
  ...listTargets('mgh', '/management/history', 'מסך "שאילתות ו-API"', { one: 'שאילתה', many: 'שאילתות', exportWhat: 'יומן השאילתות', searchHint: 'מחפשים לפי נתיב, שאילתה, שגיאה או שם עובד' }, MGH_FILTERS),
  { id: 'mgh.manage-records', label: 'ניהול רשומות', aliases: ['מחיקת היסטוריה', 'ניקוי היסטוריית גלישה', 'מחיקת רשומות ישנות'], route: '/management/history', kind: 'button',
    where: 'במסך "שאילתות ו-API", בסרגל התוצאות שמעל הרשימה', hint: 'מחיקת רשומות מהיסטוריה: נבחרות, ישנות מ-90 יום, או הכול (דורש קוד מנהל)' },
];

// ============================================================ הרשאות
const PERM = '/admin/permissions';
const PERM_TARGETS = [
  { id: 'perm.table', label: 'שורות הרשאה', aliases: ['טבלת ההרשאות', 'מי מורשה לאיזה עמוד', 'הרשאות לפי מחלקה', 'רשימת שורות ההרשאה'], route: PERM, kind: 'section',
    where: 'במסך "הרשאות", הכרטיס העליון "שורות הרשאה" (שם, עמודים ופיצ\'רים, מי מורשה)', hint: 'כל שורה מחברת עמודים ופיצ\'רים למחלקות ולעובדים שמורשים להם' },
  { id: 'perm.new-row', label: 'שורת הרשאה חדשה', aliases: ['הוספת הרשאה', 'יצירת הרשאה', 'לתת הרשאה', 'להוסיף שורה'], route: PERM, kind: 'button', parent: 'perm.table',
    where: 'במסך "הרשאות", בכותרת הכרטיס "שורות הרשאה"', hint: 'פותח אשף ליצירת שורת הרשאה' },
  { id: 'perm.row-edit', label: 'עריכת שורה', aliases: ['עריכת הרשאה', 'לשנות הרשאה', 'להסיר הרשאה', 'מחיקת שורת הרשאה'], route: PERM, kind: 'icon', parent: 'perm.table',
    where: 'במסך "הרשאות", בטבלת "שורות הרשאה", בעמודה האחרונה של השורה הראשונה (בכל שורה יש אייקון עריכה)', hint: 'פותח את אשף העריכה של השורה, ושם אפשר גם למחוק אותה' },
  { id: 'perm.numeric', label: 'ערכים מספריים לפי מחלקה', aliases: ['הרשאה מספרית', 'כמות שורות לייצוא', 'ערך לפי מחלקה'], route: PERM, kind: 'section',
    where: 'במסך "הרשאות", הכרטיס "ערכים מספריים לפי מחלקה" (מוצג רק כשיש פריטים מספריים)', hint: 'ערכים שהם מספר ולא כן/לא; קובעים לכל מחלקה בנפרד' },
  { id: 'perm.overrides', label: 'חריגות אישיות מכרטיס העובד', aliases: ['חריגה לעובדת', 'הרשאה אישית', 'הרשאות ספציפיות לעובדת'], route: PERM, kind: 'section',
    where: 'במסך "הרשאות", הכרטיס התחתון "חריגות אישיות מכרטיס העובד" (קריאה בלבד)', hint: 'הרשאות שנקבעו לעובדת מסוימת בכרטיס שלה; את השינוי עושים בכרטיס העובד' },
  { id: 'perm.wizard', label: 'אשף שורת הרשאה', aliases: ['חלון שורת הרשאה', 'אשף הרשאות'], route: PERM, kind: 'section', reveal: [{ click: 'perm.new-row' }], parent: 'perm.new-row',
    where: 'חלון שנפתח מהכפתור "שורת הרשאה חדשה" (או מאייקון העריכה של שורה)', hint: 'חמישה שלבים: שם, עמודים ופיצ\'רים, מחלקות, עובדים ספציפיים, אישור' },
  { id: 'perm.wiz-name', label: 'שם השורה', aliases: ['שם ההרשאה', 'שלב שם'], route: PERM, kind: 'field', reveal: [{ click: 'perm.new-row' }], parent: 'perm.wizard',
    where: 'באשף שורת הרשאה, שלב 1 "שם"', hint: 'נותנים שם לשורה, למשל שם הפעולה או הקבוצה' },
  { id: 'perm.wiz-stepper', label: 'שלבי האשף', aliases: ['שלבים', 'שם / עמודים / מחלקות / עובדים / אישור'], route: PERM, kind: 'section', reveal: [{ click: 'perm.new-row' }], parent: 'perm.wizard',
    where: 'באשף שורת הרשאה, שורת השלבים בראש החלון', hint: 'שם ← עמודים ופיצ\'רים ← מחלקות ← עובדים ספציפיים ← אישור' },
  { id: 'perm.wiz-next', label: 'הבא', aliases: ['לשלב הבא', 'המשך באשף'], route: PERM, kind: 'button', reveal: [{ click: 'perm.new-row' }], parent: 'perm.wizard',
    where: 'באשף שורת הרשאה, בתחתית החלון', hint: 'עוברים לשלב הבא; בשלב האחרון הכפתור הוא "יצירת השורה" / "עדכון השורה"' },
];

// ============================================================ סטטיסטיקה, AI, דשבורד, מפתחות API, סייר נתונים, גיבוי מסד נתונים
const STAT = '/admin/statistics';
const STAT_TARGETS = [
  { id: 'stat.tabs', label: 'לשוניות הנתונים', aliases: ['סוגי הדוחות', 'לשוניות סטטיסטיקה'], route: STAT, kind: 'section', where: 'במסך הסטטיסטיקה ("מרכז נתונים ופילוח"), שורת הלשוניות מתחת לסינון התאריכים', hint: 'יומי, חריגות וספירת מלאי, לפי דגם, לפי מידה, עומס תופרות, חובות ותשלומים' },
  { id: 'stat.tab-daily', label: 'יומי (הזמנות)', aliases: ['דוח יומי', 'הזמנות לפי יום', 'הכנסות יומיות'], route: STAT, kind: 'tab', parent: 'stat.tabs', where: 'במסך הסטטיסטיקה, שורת הלשוניות', hint: 'לכל תאריך: הזמנות שבוצעו, הכנסות, פריטים שהושכרו והוחזרו' },
  { id: 'stat.tab-inventory', label: 'חריגות וספירת מלאי', aliases: ['חוסר במלאי', 'שיא השכרות חופפות', 'מלאי פיזי'], route: STAT, kind: 'tab', parent: 'stat.tabs', where: 'במסך הסטטיסטיקה, שורת הלשוניות', hint: 'לכל דגם ומידה: המלאי הפיזי מול שיא ההשכרות החופפות, ואם יש חוסר' },
  { id: 'stat.tab-model', label: 'לפי דגם', aliases: ['השכרות לפי דגם', 'דגמים פופולריים'], route: STAT, kind: 'tab', parent: 'stat.tabs', where: 'במסך הסטטיסטיקה, שורת הלשוניות', hint: 'כמה פעמים הושכר כל דגם (ותיקונים אם התיקונים מופעלים)' },
  { id: 'stat.tab-size', label: 'לפי מידה', aliases: ['השכרות לפי מידה', 'מידות פופולריות'], route: STAT, kind: 'tab', parent: 'stat.tabs', where: 'במסך הסטטיסטיקה, שורת הלשוניות', hint: 'כמה פעמים הושכרה כל מידה' },
  { id: 'stat.tab-seamstress', label: 'עומס תופרות', aliases: ['עומס תיקונים', 'תיקונים לפי תאריך אירוע'], route: STAT, kind: 'tab', parent: 'stat.tabs', access: { setting: ['enable_alterations', '!false'] },
    where: 'במסך הסטטיסטיקה, שורת הלשוניות (מוצגת רק כשהתיקונים מופעלים בהגדרות)', hint: 'מספר הפריטים לתיקון לפי תאריך האירוע' },
  { id: 'stat.tab-payments', label: 'חובות ותשלומים', aliases: ['חובות', 'יתרות חוב', 'מי חייבת'], route: STAT, kind: 'tab', parent: 'stat.tabs', where: 'במסך הסטטיסטיקה, שורת הלשוניות', hint: 'לכל הזמנה: כמה חויב, כמה שולם וכמה החוב' },
  { id: 'stat.date-from', label: 'מתאריך אירוע / התחלה', aliases: ['תאריך התחלה', 'מתאריך', 'סינון מתאריך'], route: STAT, kind: 'field', where: 'במסך הסטטיסטיקה, כרטיס הסינון העליון, השדה הראשון', hint: 'תחילת טווח התאריכים; אחרי הבחירה לוחצים "החל סינון"' },
  { id: 'stat.date-to', label: 'עד תאריך אירוע / סיום', aliases: ['תאריך סיום', 'עד תאריך', 'סינון עד תאריך'], route: STAT, kind: 'field', where: 'במסך הסטטיסטיקה, כרטיס הסינון העליון, השדה השני', hint: 'סוף טווח התאריכים; אחרי הבחירה לוחצים "החל סינון"' },
  { id: 'stat.apply', label: 'החל סינון', aliases: ['הפעלת הסינון', 'רענון הדוח'], route: STAT, kind: 'button', where: 'במסך הסטטיסטיקה, כרטיס הסינון העליון, ליד שדות התאריך', hint: 'מציג את הדוח של הלשונית הפעילה לפי טווח התאריכים' },
  { id: 'stat.migration-report', label: 'דוח הגירת נתונים מאקסס', aliases: ['דוח מיגרציה', 'דוח ייבוא אקסס'], route: STAT, kind: 'icon', where: 'במסך הסטטיסטיקה, אייקון ההורדה בפינה העליונה ליד הכותרת', hint: 'פותח בלשונית חדשה את דוח הגירת הנתונים מאקסס' },
  { id: 'stat.peak-employees', label: 'שיא עובדים בו-זמנית בחנות', aliases: ['כמה עובדות היו יחד', 'שיא עובדים'], route: STAT, kind: 'section', where: 'במסך הסטטיסטיקה, בתחתית הדף תחת "מידע כללי נוסף"', hint: 'המספר הגבוה ביותר של עובדים שעבדו יחד, ומתי' },
  // חלון "סטטיסטיקות מתקדמות AI" - נפתח מאייקון הגרף ("שאלות סטטיסטיקה") בשדה החיפוש של הרשימות (הזמנות, לקוחות, עובדים, דגמים), לכן route '*'
  { id: 'stat.ai-modal', label: 'סטטיסטיקות מתקדמות AI', aliases: ['שאלות סטטיסטיקה', 'שאלות על הנתונים', 'עוזר הסטטיסטיקה'], route: '*', kind: 'section',
    where: 'חלון שנפתח מאייקון הגרף ("שאלות סטטיסטיקה") בתוך שדה החיפוש של רשימות ההזמנות, הלקוחות, העובדים והדגמים', hint: 'שואלים בשפה חופשית שאלה על הנתונים, ומקבלים תשובה וטבלה להורדה' },
  { id: 'stat.ai-input', label: 'שאלה על הנתונים', aliases: ['הקלדת שאלה', 'לשאול על הנתונים'], route: '*', kind: 'field', parent: 'stat.ai-modal',
    where: 'בחלון "סטטיסטיקות מתקדמות AI", שדה השאלה בתחתית החלון', hint: 'כותבים שאלה ולוחצים על חץ השליחה' },
  { id: 'stat.ai-new-chat', label: 'שיחה חדשה', aliases: ['התחלת שיחה חדשה בסטטיסטיקה'], route: '*', kind: 'icon', parent: 'stat.ai-modal',
    where: 'בחלון "סטטיסטיקות מתקדמות AI", אייקון הפלוס בשורת הכלים העליונה', hint: 'שומר את השיחה הנוכחית ופותח שיחה ריקה' },
  { id: 'stat.ai-history', label: 'היסטוריה', aliases: ['שיחות קודמות בסטטיסטיקה', 'היסטוריית שיחות'], route: '*', kind: 'icon', parent: 'stat.ai-modal',
    where: 'בחלון "סטטיסטיקות מתקדמות AI", אייקון ההיסטוריה בשורת הכלים העליונה', hint: 'מציג שיחות קודמות שנשמרו (עד 10)' },
  { id: 'stat.ai-xlsx', label: 'הורדה לאקסל (XLSX)', aliases: ['הורדת תוצאות לאקסל', 'ייצוא תוצאת שאלה'], route: '*', kind: 'button', parent: 'stat.ai-modal',
    where: 'בחלון "סטטיסטיקות מתקדמות AI", מתחת לטבלת התוצאות שהעוזר מחזיר', hint: 'מוריד את שורות התוצאה לקובץ אקסל (יש גם CSV)' },
];

const AIA = '/admin/ai';
const AIADM_TARGETS = [
  { id: 'aiadm.new-chat', label: 'שיחה חדשה', aliases: ['התחלת שיחה חדשה עם ה-AI'], route: AIA, kind: 'button', where: 'במסך "עוזר AI למנהל", בראש רשימת השיחות בצד', hint: 'פותח שיחה חדשה עם עוזר ה-AI' },
  { id: 'aiadm.threads', label: 'רשימת השיחות', aliases: ['שיחות קודמות עם ה-AI', 'מחיקת שיחה'], route: AIA, kind: 'list', where: 'במסך "עוזר AI למנהל", הרשימה בצד המסך; לכל שיחה אייקון פח למחיקה', hint: 'השיחות נשמרות בדפדפן הזה' },
  { id: 'aiadm.input', label: 'שאלה ל-AI', aliases: ['הקלדת שאלה ל-AI', 'לשאול את ה-AI'], route: AIA, kind: 'field', where: 'במסך "עוזר AI למנהל", שדה ההקלדה בתחתית אזור השיחה', hint: 'שואלים על סטטיסטיקות או מידע מהמערכת בשפה חופשית' },
  { id: 'aiadm.send', label: 'שלח', aliases: ['שליחת שאלה'], route: AIA, kind: 'button', parent: 'aiadm.input', where: 'במסך "עוזר AI למנהל", הכפתור משמאל לשדה ההקלדה', hint: 'שולח את השאלה' },
  { id: 'aiadm.hist-table', label: 'טבלת שיחות AI', aliases: ['רשימת שיחות העוזר', 'מי דיברה עם ה-AI'], route: '/admin/ai-history', kind: 'list',
    where: 'במסך "היסטוריית שיחות AI", הטבלה: תאריך התחלה, הקשר (עמוד), עובד, מספר הודעות; בכל שורה כפתור "צפה בשיחה"', hint: 'כל שיחות העובדות עם עוזר ה-AI' },
  { id: 'aiadm.hist-refresh', label: 'רענן', aliases: ['רענון היסטוריית AI'], route: '/admin/ai-history', kind: 'button', where: 'במסך "היסטוריית שיחות AI", בכותרת הדף', hint: 'טוען מחדש את רשימת השיחות' },
  { id: 'aiadm.restr-base', label: 'מה נשלח לכל שיחת AI בכל מקרה', aliases: ['הנחיות קבועות ל-AI', 'פרומפט בסיס'], route: '/admin/ai-restrictions', kind: 'section', access: PROG,
    where: 'במסך "ניהול מגבלות בינה מלאכותית", הכרטיס העליון (לחיצה פותחת אותו)', hint: 'ההנחיות שנשלחות תמיד, בלי קשר למגבלות' },
  { id: 'aiadm.restr-features', label: 'תכונות ה-AI ומגבלותיהן', aliases: ['הגבלות AI', 'כיבוי מגבלה', 'מה ה-AI רשאי לענות', 'מגבלות לכל תכונת AI'], route: '/admin/ai-restrictions', kind: 'list', access: PROG,
    where: 'במסך "ניהול מגבלות בינה מלאכותית", רשימת התכונות; לחיצה על תכונה פותחת את המגבלות שלה, ובסופן "שמור שינויים לתכונה זו"', hint: 'לכל תכונת AI: הגנות קבועות, מגבלות לעריכה (מחמיר / רגיל / פתוח), חוקים בשפה חופשית' },
];

const DASH_TARGETS = [
  { id: 'dash.kpis', label: 'מדדים מרכזיים', aliases: ['סה"כ הכנסות', 'לקוחות פעילים', 'סה"כ הזמנות', 'עובדים פעילים'], route: '/dashboard', kind: 'section', where: 'בדף "אזור ניהול - סיכומים ופילוחים", בראש הדף', hint: 'סה"כ הכנסות, לקוחות פעילים, סה"כ הזמנות ועובדים פעילים' },
  { id: 'dash.charts', label: 'פילוח נתונים', aliases: ['גרפים', 'גרפי הכנסות'], route: '/dashboard', kind: 'section', where: 'בדף "אזור ניהול - סיכומים ופילוחים", מתחת למדדים המרכזיים', hint: 'ארבעה גרפי הכנסות' },
  { id: 'dash.chart-methods', label: 'התפלגות הכנסות לפי אמצעי תשלום', aliases: ['הכנסות לפי אמצעי תשלום', 'מזומן מול אשראי'], route: '/dashboard', kind: 'section', parent: 'dash.charts', where: 'בדף הדשבורד, הגרף הראשון', hint: 'גרף עוגה של אמצעי התשלום' },
  { id: 'dash.chart-daily', label: 'הכנסות לפי תאריך תשלום (תקופה אחרונה)', aliases: ['הכנסות יומיות', 'גרף הכנסות לפי יום'], route: '/dashboard', kind: 'section', parent: 'dash.charts', where: 'בדף הדשבורד, הגרף השני', hint: 'הכנסות ב-30 ימי הפעילות האחרונים' },
  { id: 'dash.chart-weekly', label: 'הכנסות שבועיות (תקופה אחרונה)', aliases: ['הכנסות לפי שבוע'], route: '/dashboard', kind: 'section', parent: 'dash.charts', where: 'בדף הדשבורד, הגרף השלישי', hint: 'הכנסות ב-12 השבועות האחרונים' },
  { id: 'dash.chart-monthly', label: 'הכנסות חודשיות (תקופה אחרונה)', aliases: ['הכנסות לפי חודש'], route: '/dashboard', kind: 'section', parent: 'dash.charts', where: 'בדף הדשבורד, הגרף הרביעי', hint: 'הכנסות ב-12 החודשים האחרונים' },
];

const KEYS = '/admin/site-settings/api-keys';
const APIKEY_TARGETS = [
  { id: 'apikey.form', label: 'הנפק מפתח חדש', aliases: ['יצירת מפתח API', 'מפתח חדש'], route: KEYS, kind: 'section', access: PROG, where: 'במסך "מפתחות API", הכרטיס העליון', hint: 'שם, הרשאה ותוקף, ואז "הנפק מפתח"' },
  { id: 'apikey.name', label: 'שם למפתח', aliases: ['שם המפתח'], route: KEYS, kind: 'field', access: PROG, parent: 'apikey.form', where: 'במסך "מפתחות API", בכרטיס "הנפק מפתח חדש"', hint: 'שם שמסביר למי המפתח, למשל "בדיקות Claude"' },
  { id: 'apikey.role', label: 'הרשאה (תפקיד המפתח)', aliases: ['תפקיד המפתח', 'הרשאות המפתח'], route: KEYS, kind: 'field', access: PROG, parent: 'apikey.form', where: 'במסך "מפתחות API", בכרטיס "הנפק מפתח חדש"', hint: 'המפתח נכנס בהרשאות של התפקיד שנבחר' },
  { id: 'apikey.expiry', label: 'תוקף', aliases: ['תפוגת המפתח', 'עד מתי המפתח תקף'], route: KEYS, kind: 'field', access: PROG, parent: 'apikey.form', where: 'במסך "מפתחות API", בכרטיס "הנפק מפתח חדש"', hint: 'מספר ימים, או "ללא תפוגה"' },
  { id: 'apikey.create', label: 'הנפק מפתח', aliases: ['יצירת המפתח'], route: KEYS, kind: 'button', access: PROG, parent: 'apikey.form', where: 'במסך "מפתחות API", בכרטיס "הנפק מפתח חדש"', hint: 'המפתח המלא מוצג פעם אחת בלבד, מיד אחרי ההנפקה' },
  { id: 'apikey.list', label: 'מפתחות קיימים', aliases: ['ביטול מפתח', 'רשימת מפתחות'], route: KEYS, kind: 'list', access: PROG, where: 'במסך "מפתחות API", מתחת לטופס; לכל מפתח כפתור "בטל מפתח"', hint: 'מצב המפתח, תוקף ושימוש אחרון' },
];

const DX = '/admin/data-explorer';
const DX_TARGETS = [
  { id: 'dx.table-select', label: 'בחר טבלה לבדיקה', aliases: ['בחירת טבלה', 'סייר טבלאות'], route: DX, kind: 'field', access: PROG, where: 'בסייר הנתונים, כרטיס "סייר טבלאות" (בצד אחד של המסך)', hint: 'בוחרים טבלה ורואים עד 500 רשומות אחרונות' },
  { id: 'dx.export-5000', label: 'הורד 5,000 אחרונים', aliases: ['ייצוא טבלה', 'הורדת חלק מהטבלה'], route: DX, kind: 'button', access: PROG, parent: 'dx.table-select', where: 'בסייר הנתונים, כרטיס "סייר טבלאות", שורת הכפתורים מתחת לבחירת הטבלה', hint: 'מוריד את 5,000 הרשומות האחרונות של הטבלה שנבחרה' },
  { id: 'dx.export-csv', label: 'הורד הכל מלא ל-CSV', aliases: ['ייצוא טבלה מלאה', 'הורדת כל הטבלה'], route: DX, kind: 'button', access: PROG, parent: 'dx.table-select', where: 'בסייר הנתונים, כרטיס "סייר טבלאות", שורת הכפתורים (ליד כפתור Excel)', hint: 'מוריד את כל הטבלה (פעולה מוגנת בסיסמה)' },
  { id: 'dx.ai-prompt', label: 'עוזר שאילתות AI', aliases: ['לכתוב שאילתה בעזרת AI', 'תיאור שאילתה'], route: DX, kind: 'field', access: PROG, where: 'בסייר הנתונים, כרטיס "הרצת שאילתת SQL מותאמת", תיבת "עוזר שאילתות AI"', hint: 'מתארים במילים מה לשלוף או לעדכן, וה-AI כותב את השאילתה' },
  { id: 'dx.ai-generate', label: 'צור שאילתה', aliases: ['יצירת שאילתה'], route: DX, kind: 'button', access: PROG, parent: 'dx.ai-prompt', where: 'בסייר הנתונים, בתיבת "עוזר שאילתות AI"', hint: 'ה-AI כותב שאילתה לתיבת ה-SQL; לא מריץ אותה' },
  { id: 'dx.sql', label: 'הזן שאילתה (PostgreSQL)', aliases: ['תיבת SQL', 'כתיבת שאילתה'], route: DX, kind: 'field', access: PROG, where: 'בסייר הנתונים, כרטיס "הרצת שאילתת SQL מותאמת"', hint: 'כותבים שאילתה; Ctrl+Space לרשימת השלמות' },
  { id: 'dx.run', label: 'הרץ שאילתה', aliases: ['הרצת SQL'], route: DX, kind: 'button', access: PROG, parent: 'dx.sql', where: 'בסייר הנתונים, מתחת לתיבת ה-SQL', hint: 'מריץ את השאילתה ומציג את התוצאות; אפשר להוריד CSV / Excel' },
  { id: 'dx.history', label: 'היסטוריית שאילתות', aliases: ['שאילתות קודמות'], route: DX, kind: 'button', access: PROG, where: 'בסייר הנתונים, כרטיס "הרצת שאילתת SQL מותאמת", בכותרת הכרטיס', hint: 'חלון עם יומן השאילתות שהורצו' },
  { id: 'dx.full-export', label: 'ייצוא לאקסל', aliases: ['הורדת תצוגה מלאה', 'ייצוא התוצאות'], route: '/admin/data-explorer/full-view', kind: 'icon', access: PROG, where: 'בתצוגת הטבלה המלאה, אייקון ההורדה בראש הדף', hint: 'מוריד את כל התוצאות לאקסל' },
];

const DBADM = '/admin/database';
const DBADM_TARGETS = [
  { id: 'dbadm.import-card', label: 'העלאת קובץ אקסס חדש', aliases: ['ייבוא קובץ אקסס', 'החלפת הנתונים מאקסס'], route: DBADM, kind: 'section', access: PROG, where: 'במסך "ניהול מסד נתונים", הכרטיס הראשון', hint: 'מעלים קובץ .accdb; המערכת מגבה את הישן ומייבאת את החדש' },
  { id: 'dbadm.import-start', label: 'התחל גיבוי וייבוא', aliases: ['הפעלת הייבוא'], route: DBADM, kind: 'button', access: PROG, parent: 'dbadm.import-card', where: 'במסך "ניהול מסד נתונים", בכרטיס העלאת קובץ אקסס (פעיל אחרי בחירת קובץ)', hint: 'מתחיל גיבוי של הנתונים הקיימים וייבוא אוטומטי' },
  { id: 'dbadm.export', label: 'הורד גיבוי מלא (JSON)', aliases: ['גיבוי נתונים', 'הורדת גיבוי למחשב', 'ייצוא כל הנתונים'], route: DBADM, kind: 'button', access: PROG, where: 'במסך "ניהול מסד נתונים", הכרטיס "גיבוי נתונים (Export)"', hint: 'מוריד גיבוי מלא של כל הנתונים כקובץ JSON' },
  { id: 'dbadm.sync-offline', label: 'סנכרן נתוני אופליין עכשיו', aliases: ['סנכרון אופליין'], route: DBADM, kind: 'button', access: PROG, where: 'במסך "ניהול מסד נתונים", הכרטיס "סנכרון נתוני אופליין"', hint: 'מעביר לענן נתונים שנשמרו במחשב המקומי בזמן שלא היה אינטרנט' },
];

export const targets = [
  ...SHARED, ...SET_TABS, ...SITE_TABS_T, ...NAMES_TABS_T, ...SET_EXTRA,
  ...HUB_TARGETS, ...LIST_TARGETS, ...PERM_TARGETS, ...STAT_TARGETS, ...AIADM_TARGETS, ...DASH_TARGETS, ...APIKEY_TARGETS, ...DX_TARGETS, ...DBADM_TARGETS,
];

// data-guide-id דינמי (תבנית בקוד): הקידומת חייבת להופיע בקובץ. קידומות הרשימות (dpt. / eml. / dhs. / mgh.) נבנות ב-A5List מ-guide="..." שמועבר מקובץ הדף.
export const dynamic = [
  { prefix: 'set.cat-', file: 'app/components/settings-sim/SettingsSimPage.js' },
  { prefix: 'set.names-', file: 'app/components/settings-sim/SettingsSimPage.js' },
  { prefix: 'set.key-', file: 'app/components/settings-sim/SettingRow.js' },
  { prefix: 'hub.', file: 'app/components/admin-hub/AdminHubPage.js' },
  { prefix: 'stat.tab-', file: 'app/admin/statistics/page.js' },
  { prefix: 'perm.row-', file: 'app/admin/permissions/PermissionsClient.js' },
  { prefix: 'dpt.', file: 'app/components/departments/DepartmentsA5.js' },
  { prefix: 'eml.', file: 'app/components/email-logs/EmailLogsA5.js' },
  { prefix: 'dhs.', file: 'app/components/history-lists/DataHistoryA5.js' },
  { prefix: 'mgh.', file: 'app/components/history-lists/ManagementHistoryA5.js' },
];

// ============================================================ set.key-<מפתח>: שורת הגדרה בודדת (יעד "וירטואלי", נגזר מהקוד - לא רשימה ידנית)
const slugOf = (key) => String(key).toLowerCase().replace(/_/g, '-');
let slugMap = null;
let categoryByKey = null;
function ensureMaps() {
  if (slugMap) return;
  slugMap = new Map();
  categoryByKey = new Map();
  for (const [cat, keys] of Object.entries(SETTINGS_ORDER)) for (const k of keys) if (!categoryByKey.has(k)) categoryByKey.set(k, cat);
  const all = new Set([...Object.keys(SETTINGS_HEBREW_NAMES), ...categoryByKey.keys(), ...SECTIONS.flatMap((s) => s.keys)]);
  for (const k of all) slugMap.set(slugOf(k), k);
}
const tabIdOf = (tab) => `set.cat-${String(tab).replace(/_/g, '-')}`;
const cache = new Map();

export function resolveDynamic(id) {
  if (typeof id !== 'string' || !id.startsWith('set.key-')) return null;
  if (cache.has(id)) return cache.get(id);
  ensureMaps();
  const key = slugMap.get(id.slice('set.key-'.length));
  let out = null;
  if (key && !HIDDEN_KEYS.includes(key)) {
    const place = placeRow({ key, category: categoryByKey.get(key) });
    const ui = KEY_UI[key];
    const shown = (ui && ui.label) || getSettingDisplayName(key);
    const label = /[א-ת]/.test(shown) ? shown : `ההגדרה ${key}`;
    const site = place ? place.view === 'site' : false;
    const tabDef = place ? (site ? SITE_TABS : SYS_TABS).find((t) => t.id === place.tab) : null;
    const sec = place ? SECTIONS.find((s) => s.view === place.view && s.tab === place.tab && s.id === place.sectionId) : null;
    const pageName = site ? 'הגדרות אתר' : 'הגדרות מערכת';
    out = {
      id,
      label,
      aliases: [key, ...(SETTINGS_HEBREW_NAMES[key] && SETTINGS_HEBREW_NAMES[key] !== label ? [SETTINGS_HEBREW_NAMES[key]] : [])],
      route: site ? SITE : SET,
      query: `highlight=${key}`,
      kind: 'field',
      where: place && tabDef
        ? `ב${pageName} ← לשונית "${tabDef.label}" ← ${sec ? `סעיף "${sec.title}"` : 'סעיף "הגדרות נוספות"'}, השורה "${label}"`
        : `ב${pageName}: חפשו בשדה החיפוש את "${label}"`,
      hint: label,
      settingKey: key,
      ...(place && tabDef ? { reveal: [{ click: tabIdOf(place.tab) }], parent: tabIdOf(place.tab) } : {}),
      ...(site ? { access: PROG } : {}),
    };
  }
  cache.set(id, out);
  return out;
}
