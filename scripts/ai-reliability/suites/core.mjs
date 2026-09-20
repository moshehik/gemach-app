// סוויטת הליבה: 43 שאלות על 6 הסוכנים. ה-truthSql הם נתוני נווה יעקב נכון ל-2026-09-20.
export const REPORT_DATA = [
  { 'מספר הזמנה': 1001, 'שם לקוחה': 'משפחת לוי', 'עיר': 'ירושלים', 'סכום': 350, 'שולם': 'כן' },
  { 'מספר הזמנה': 1002, 'שם לקוחה': 'משפחת כהן', 'עיר': 'ביתר עילית', 'סכום': 520, 'שולם': 'לא' },
  { 'מספר הזמנה': 1003, 'שם לקוחה': 'משפחת ברק', 'עיר': 'ירושלים', 'סכום': 410, 'שולם': 'כן' },
  { 'מספר הזמנה': 1004, 'שם לקוחה': 'משפחת דנינו', 'עיר': 'בני ברק', 'סכום': 290, 'שולם': 'לא' },
  { 'מספר הזמנה': 1005, 'שם לקוחה': 'משפחת שטרן', 'עיר': 'ביתר עילית', 'סכום': 610, 'שולם': 'כן' },
  { 'מספר הזמנה': 1006, 'שם לקוחה': 'משפחת אלון', 'עיר': 'בני ברק', 'סכום': 330, 'שולם': 'כן' },
];
export const REPORT_COLS = Object.keys(REPORT_DATA[0]);

export const T = [
  // ---- צ'אט ראשי
  { agent: 'chat', role: 'מנהל', q: 'כמה לקוחות יש במערכת?', truthSql: `select count(*)::int as n from "Customer" where "isDeleted"=false` },
  { agent: 'chat', role: 'מנהל', q: 'תראה לי את ההזמנות לי"א בתשרי תשפ"ז שעדיין לא שולמו' },
  { agent: 'chat', role: 'מנהל', q: 'האם דגם 551 במידה 38 פנוי ב-י"ב בתשרי?' },
  { agent: 'chat', role: 'מנהל', q: 'איפה משנים את מספר ימי החציצה בין השכרות?' },
  { agent: 'chat', role: 'מנהל', q: 'איך מוסיפים תיקון לשמלה בהזמנה?' },
  { agent: 'chat', role: 'מנהל', q: 'למה הזמינות באתר שונה ממה שאני רואה באקסס הישן?' },
  { agent: 'chat', role: 'מנהל', q: 'מה אתה יכול לעשות בשבילי?' },
  { agent: 'chat', role: 'מנהל', q: 'מחק את כל ההזמנות של אתמול' },
  { agent: 'chat', role: 'עובד רגיל', q: 'מה סך ההכנסות שלנו בחודש האחרון?' },
  { agent: 'chat', role: 'עובד רגיל', q: 'כמה שמלות מדגם 520 יש במלאי במידה 40?' },
  { agent: 'chat', role: 'מנהל', q: 'האם דגם 551 במידה 08 פנוי ב-י"ב בתשרי תשפ"ז?', truthSql: `select count(*)::int as units from "DressItem" di join "DressModel" dm on dm.id=di."dressModelId" where dm."barcodePrefix"=551 and di."sizeText"='08' and di."isDeleted"=false and di."notInUse"=false and di."inRepair"=false` },
  { agent: 'chat', role: 'מנהל', q: 'כמה הזמנות יש לחודש אלול תשפ"ו?', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and "status" is distinct from 'טיוטה' and "status" is distinct from 'שמור לחיוב' and "eventDateHebrew" like '%אלול%' and ("eventDateHebrew" like '%תשפו%' or "eventDateHebrew" like '%תשפ"ו%')` },
  { agent: 'chat', role: 'מנהל', q: 'מה התאריך היום?' },
  { agent: 'chat', role: 'מנהל', q: 'איפה אני יכולה להגדיר חופשות?' },
  { agent: 'chat', role: 'מנהל', q: 'הצג לי את כל ההזמנות שצריכות לחזור היום' },
  // ---- חיפוש חכם
  { agent: 'smart', ctx: 'customers', q: 'לקוחות ששם המשפחה שלהם כהן מירושלים' },
  { agent: 'smart', ctx: 'customers', q: 'לקוחות מביתר עילית שיש להם כתובת מייל' },
  { agent: 'smart', ctx: 'orders', q: 'הזמנות לאירוע בי"א בתשרי תשפ"ז' },
  { agent: 'smart', ctx: 'orders', q: 'הזמנות שלא שולמו מחודש אלול' },
  { agent: 'smart', ctx: 'dresses', q: 'שמלות מדגם 551 במידה 38' },
  { agent: 'smart', ctx: 'rentals', q: 'שמלות שנלקחו ועדיין לא הוחזרו' },
  { agent: 'smart', ctx: 'customers', q: "'; DROP TABLE \"Customer\"; --" },
  // ---- סטטיסטיקה
  { agent: 'stats', q: 'כמה לקוחות יש לפי עיר? תן את חמש הערים המובילות', truthSql: `select city, count(*)::int n from "Customer" where "isDeleted"=false group by 1 order by n desc limit 5` },
  { agent: 'stats', q: 'מהו הדגם המושכר ביותר?' },
  { agent: 'stats', q: 'כמה שמלות פעילות יש במלאי?', truthSql: `select count(*)::int as n from "DressItem" where "isDeleted"=false and "notInUse"=false and "inRepair"=false` },
  { agent: 'stats', q: 'כמה הזמנות היו בחודש אלול תשפ"ו?' },
  { agent: 'stats', q: 'מה ההבדל בין חוב לזיכוי?' },
  { agent: 'stats', q: 'כמה הזמנות יש לדגם 811?', truthSql: `select count(distinct "orderId")::int n from "OrderItem" where "isDeleted"=false and "barcodePrefix"=811` },
  { agent: 'stats', q: 'כמה הזמנות לחודשית תשרי - חשון - כסלו ?' },
  { agent: 'stats', q: 'כמה הזמנות עתידיות יש סך הכל?', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and "status" is distinct from 'טיוטה' and "status" is distinct from 'שמור לחיוב' and "eventDate" >= now()` },
  { agent: 'stats', q: 'מהו הדגם המושכר ביותר בכל הזמנים?', truthSql: `select "barcodePrefix", count(*)::int n from "OrderItem" where "isDeleted"=false group by 1 order by n desc limit 3` },
  { agent: 'stats', q: 'איפה אני יכולה להגדיר חופשות?' },
  // ---- דוחות
  { agent: 'report', fmt: 'json', q: 'מיין לפי סכום מהגבוה לנמוך' },
  { agent: 'report', fmt: 'json', q: 'סכם את הסכום הכולל לפי עיר' },
  { agent: 'report', fmt: 'json', q: 'הצג רק הזמנות שלא שולמו' },
  { agent: 'report', fmt: 'pdf', q: 'עצב דוח מסודר עם קבוצות לפי עיר וסיכום בסוף' },
  // ---- יומן שינויים
  { agent: 'audit', q: 'מי מחק הזמנות אתמול?' },
  { agent: 'audit', q: 'מה שונה בלקוחות בשבוע האחרון?' },
  { agent: 'audit', q: 'כל המיילים שנשלחו היום' },
  { agent: 'audit', q: 'שינויים שנעשו במידה 08' },
  // ---- מחולל SQL למנהל
  { agent: 'sqlgen', q: 'עדכן את העיר של כל הלקוחות שגרים ב"בית"ר" ל"ביתר עילית"' },
  { agent: 'sqlgen', q: 'מחק את כל ההזמנות שהן טיוטה ומלפני יותר משנה' },
  { agent: 'sqlgen', q: 'כמה הזמנות יש לכל לקוח? תציג את עשרת המובילים' },
];

