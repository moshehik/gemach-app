// שאלות אמיתיות מההיסטוריה (כולל הודעות אי-שביעות רצון). ה-truthSql הם נתוני נווה יעקב נכון ל-2026-09-20.
const H_LIST = [
  { role: 'user', content: 'אני רוצה רשימה של כל ההזמנות שבוצעו ב-15/09/2026' },
  { role: 'model', content: 'ב-15/09/2026 בוצעו 27 הזמנות. מספרי ההזמנות: 53313, 53314, 53315.' },
];
const iso = (d) => `("orderDate" at time zone 'UTC' at time zone 'Asia/Jerusalem')::date='${d}'`;
const OK = `"status" is distinct from 'טיוטה' and "status" is distinct from 'שמור לחיוב'`;
const OKo = `o."status" is distinct from 'טיוטה' and o."status" is distinct from 'שמור לחיוב'`;
const evIL = (a, b) => `("eventDate" at time zone 'UTC' at time zone 'Asia/Jerusalem')::date between '${a}' and '${b}'`;
export const T = [
  // ---- שאלות אמיתיות מההיסטוריה (עוזר הסטטיסטיקה / דוח AI)
  { agent: 'stats', src: 'היסטוריה 10.9', q: 'מה החודש עם מספר ההזמנות הגדול ביותר?', truthSql: `select to_char("eventDate",'YYYY-MM') m, count(*)::int n from "Order" where "isDeleted"=false and ${OK} and "eventDate" is not null group by 1 order by n desc limit 2` },
  { agent: 'stats', src: 'היסטוריה 10.9', q: 'כמה הזמנות יש החודש?', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and ${OK} and ${evIL('2026-09-12', '2026-10-11')}` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'הצג לי את ההזמנה של אמיתי נויאל הנמצאת בהשכרות', truthSql: `select c."firstName", c."lastName", count(o."orderId")::int orders from "Customer" c left join "Order" o on o."customerId"=c.id and o."isDeleted"=false where c."isDeleted"=false and c."firstName" ilike '%נויאל%' and c."lastName" ilike '%אמיתי%' group by 1,2` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'חפש הזמנה על שם נויאל' },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'הצג לי את כל ההזמנות שהזמינו משלוח', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and "isDelivery"=true and ${OK}` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'אני רוצה רשימה של כל ההזמנות שבוצעו ב-15/09/2026', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and ${OK} and ${iso('2026-09-15')}` },
  { agent: 'stats', src: 'היסטוריה 16.9', q: 'כמה משפחות הזמינו את דגם 811?', truthSql: `select count(distinct o."customerId")::int fam from "OrderItem" oi join "Order" o on o."orderId"=oi."orderId" where oi."barcodePrefix"=811 and oi."isDeleted"=false and o."isDeleted"=false and ${OKo}` },
  { agent: 'stats', src: 'היסטוריה 16.9', q: 'תחפש בהזמנות העתידיות - כמה משפחות שריינו את דגם 811', truthSql: `select count(distinct o."customerId")::int fam from "OrderItem" oi join "Order" o on o."orderId"=oi."orderId" where oi."barcodePrefix"=811 and oi."isDeleted"=false and o."isDeleted"=false and o."eventDate">=now() and ${OKo}` },
  { agent: 'stats', src: 'היסטוריה 9.9', q: 'כמה הזמנות לחודשית תשרי - חשון - כסלו ?', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and ${OK} and ${evIL('2026-09-12', '2026-12-10')}` },
  { agent: 'stats', src: 'היסטוריה 20.8', q: 'איפה היה ברקוד 5390207 לאחרונה?', truthSql: `select oi."orderId", to_char(oi."takenDate",'YYYY-MM-DD') taken from "OrderItem" oi where oi."barcode"='5390207' order by oi."takenDate" desc nulls last limit 1` },
  { agent: 'stats', src: 'היסטוריה 20.8', q: 'מתי יצאה שמלה דגם 539 לאחרונה?', truthSql: `select oi."orderId", to_char(oi."takenDate",'YYYY-MM-DD') taken from "OrderItem" oi where oi."barcodePrefix"=539 and oi."isDeleted"=false and oi."takenDate" is not null order by oi."takenDate" desc limit 1` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: "הצג לי את ההזמנות שתאריך האירוע בג' תשרי", truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and ${OK} and ${evIL('2026-09-14', '2026-09-14')}` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'תציג לי את כל ההזמנות של כו תשרי', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and ${OK} and ${evIL('2026-10-07', '2026-10-07')}` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'הצג לי הזמנות של דגם 807 מידה 68', truthSql: `select count(distinct oi."orderId")::int n from "OrderItem" oi join "Order" o on o."orderId"=oi."orderId" where oi."barcodePrefix"=807 and oi."sizeText"='68' and oi."isDeleted"=false and o."isDeleted"=false and ${OKo}` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'הצג לי את ההזמנות ע"ש שרית ישראלי', truthSql: `select count(o."orderId")::int orders from "Customer" c join "Order" o on o."customerId"=c.id and o."isDeleted"=false where (c."firstName" ilike '%שרית%' or c."lastName" ilike '%שרית%') and (c."firstName" ilike '%ישראלי%' or c."lastName" ilike '%ישראלי%')` },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'הצג לי את כל ההזמנות שצריכות לחזור היום' },
  { agent: 'stats', src: 'היסטוריה 15.9', q: 'מה התאריך היום?' },
  { agent: 'stats', src: 'היסטוריה 8.9', q: 'איפה אני יכולה להגדיר חופשות?' },
  { agent: 'stats', src: 'היסטוריה 16.9', q: 'אני רוצה לערוך את העובדים, למחוק, ולשנות סיסמה. איך עושים את זה?' },
  // ---- הודעות אי-שביעות רצון (שרשורים עם היסטוריה, כמו בשימוש האמיתי)
  { agent: 'stats', src: 'מחלוקת: "לא נכון"', q: 'לא נכון', history: [{ role: 'user', content: 'מה החודש עם מספר ההזמנות הגדול ביותר?' }, { role: 'model', content: 'החודש עם מספר ההזמנות הגבוה ביותר הוא חודש אלול תשפ"ו (09/2026), שבו בוצעו 11 הזמנות.' }] },
  { agent: 'stats', src: 'מחלוקת: "לא הגיוני"', q: 'לא הגיוני', history: [{ role: 'user', content: 'כמה הזמנות יש בחודש אלול תשפ"ו?' }, { role: 'model', content: 'בחודש אלול תשפ"ו התקבלה הזמנה אחת.' }] },
  { agent: 'stats', src: 'מחלוקת: "בחיפוש אני כן מוצאת"', q: 'בחיפוש אני כן מוצאת', history: [{ role: 'user', content: 'הצג לי את ההזמנה של אמיתי נויאל הנמצאת בהשכרות' }, { role: 'model', content: 'לא נמצאו הזמנות פעילות תחת השם אמיתי נויאל במערכת ההשכרות.' }] },
  { agent: 'stats', src: 'מחלוקת: "לא בהערות אלא הזמינו משלוח"', q: 'אני לא מתכוונת על הזמנות שכתוב בהם משלוח בהערות אלא שהם הזמינו משלוח. הצג את כל ההזמנות שהזמינו משלוח', history: [{ role: 'user', content: 'הצג לי את כל ההזמנות שרשום עליהם משלוח' }, { role: 'model', content: 'נמצאה הזמנה אחת שבה מצוין המילה משלוח בהערות: הזמנה 53315.' }] },
  { agent: 'stats', src: 'מחלוקת: "איפה הרשימה?"', q: 'אני רוצה רשימה מסודרת של כל ההזמנות הנ"ל כולל הפרטים שלהן. עם אופציה להוריד לקובץ אקסל.', history: H_LIST },
  { agent: 'stats', src: 'מחלוקת: "היום לא כד אלול"', q: 'היום לא כד אלול אלא ד תשרי. אבל איפה הרשימה?', history: H_LIST },
  // ---- הצ'אט הראשי (כמו שנשאל בגמח הראשי / בשאלות כלליות)
  { agent: 'chat', role: 'מנהל', src: 'גמח ראשי 27.7', q: 'מה השעה?' },
  { agent: 'chat', role: 'מנהל', src: 'גמח ראשי 8.9', q: 'כמה הזמנות יש למחר?', truthSql: `select count(*)::int n from "Order" where "isDeleted"=false and ${OK} and ${evIL('2026-09-21', '2026-09-21')}` },
  { agent: 'chat', role: 'מנהל', src: 'גמח ראשי 25.7', q: 'כמה לקוחות יש בשם לאה', truthSql: `select count(*) filter (where "firstName" ilike '%לאה%')::int as first_name, count(*) filter (where "lastName" ilike '%לאה%')::int as last_name from "Customer" where "isDeleted"=false` },
  { agent: 'chat', role: 'מנהל', src: 'נווה יעקב 9.9', q: 'הזמנה 31410 מה קוד הפריט ומה המידה', truthSql: `select oi."barcodePrefix", oi."sizeText" from "OrderItem" oi where oi."orderId"=31410 and oi."isDeleted"=false` },
  { agent: 'chat', role: 'מנהל', src: 'גמח ראשי 29.7', q: 'לכמה פריטים מתוך כל הפריטים שהושכרו יש תאריך לקיחה?', truthSql: `select count(*)::int n from "OrderItem" where "isDeleted"=false and "takenDate" is not null` },
  { agent: 'chat', role: 'מנהל', src: 'נווה יעקב 9.9', q: 'איך אני יכולה להקטין את גודל התצוגה?' },
  { agent: 'chat', role: 'מנהל', src: 'נווה יעקב 9.9', q: 'היכן נמצא לוח השנה?' },
  { agent: 'chat', role: 'מנהל', src: 'נווה יעקב 9.9', q: 'היכן נמצאות ההרשאות על לוח השנה?' },
  { agent: 'chat', role: 'מנהל', src: 'נווה יעקב 9.9', q: 'איך אני יכולה להזין מחירים נכונים?' },
  { agent: 'chat', role: 'מנהל', src: 'גמח ראשי 25.7', q: 'תן לי הפניה לכרטיס לקוח של אמיתי נויאל' },
];
