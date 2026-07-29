const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const HEBREW_NAMES = {
  gmach_name: 'שם הגמ"ח / המערכת',
  gmach_subtitle: 'כותרת משנה לגמ"ח',
  require_login: 'חובת התחברות למערכת',
  item_locations: 'מיקומי פריטים במלאי',
  barcodePrefixLength: 'אורך קידומת ברקוד',
  inventory_include_warehouse: 'ספירת מלאי מחסן',
  main_email: 'כתובת אימייל ראשית',

  mandatory_fields: 'שדות חובה במילוי פרטי הזמנה',
  allow_alterations: 'מעקב ואפשרות תיקונים',
  enable_alterations: 'הפעל אפשרות תיקונים במערכת',
  max_items_per_order: 'כמות פריטים מקסימלית להזמנה',
  allow_free_exchange: 'אפשר החלפת דגם ללא עלות',
  cancel_order_permission: 'הרשאת ביטול הזמנה',
  reserve_permission: 'הרשאת אישור שמלות רזרבה',
  allow_date_change: 'אפשר שינוי טווח תאריכי השכרה',
  BUFFER_DAYS: 'ימי מרווח ביטחון בין השכרות',

  has_variations: 'ניהול וריאציות ודגמים משניים',
  has_underskirts: 'ניהול פריטי עזר ותחתיות',
  barcode_length: 'אורך תווים תקין לברקוד',
  useModelNames: 'הצגת שמות דגמים במערכת',
  useFileNamesForImages: 'טעינת תמונות לפי שם קובץ',

  hide_ai_features: 'הפעל בינה מלאכותית (AI)',
  enable_ai_specific_employees: 'תצוגת AI לעובדים מורשים בלבד',
  hide_dress_images: 'הצג תמונות דגמים במערכת',
  hide_gregorian_calendar: 'אפשר תאריך לועזי ביומן',
  hide_internal_messaging: 'הפעל מערכת הודעות פנימית',

  items_name_plural: 'שם פריטים ברבים',
  items_name_singular: 'שם פריט ביחיד',

  refund_per_item: 'חישוב החזר לפי פריט בנפרד',
  registration_fee: 'גביית דמי רישום מראש',
  nedarim_plus_enabled: 'סליקת אשראי בנדרים פלוס',
  nedarim_plus_terminal: 'קוד מוסד נדרים פלוס',
  NEDARIM_MOSAD: 'קוד מוסד נדרים פלוס',
  ENABLE_SET_DISCOUNTS: 'הפעל מבצע סטים וזיכויים',
  REFUND_PERCENTAGE: 'אחוז החזר כספי בביטול',
  REFUND_DAYS: 'ימי זכאות להחזר ממועד האירוע',
  NO_REFUND_DAYS_BEFORE_EVENT: 'ימים ללא החזר לפני אירוע',
  REFUND_DAYS_FROM_ORDER: 'ימי החזר מיום ביצוע ההזמנה',
  REFUND_REPAIRS: 'החזר על עלויות תיקונים',
  ALLOWED_PAYMENT_METHODS: 'אפשרויות תשלום מורשות',

  calendar_filtering: 'סינון ואירועים עבריים ביומן',
  inventory_skip_weekends: 'דלג על סוף שבוע בחישוב מלאי',
  inventory_buffer_days: 'ימי מרווח ביטחון בין השכרות',

  print_rental_box1: 'הערות השכרה - תיבה 1 (עליונה)',
  print_rental_box2: 'הערות השכרה - תיבה 2 (אמצעית)',
  print_rental_footer: 'הערות השכרה - טקסט תחתון ותקנון'
};

const HEBREW_NOTES = {
  gmach_name: 'שם המערכת שיופיע בראש העמוד, במסמכים ובחשבוניות.',
  gmach_subtitle: 'כותרת משנה המופיעה מתחת לשם הגמ"ח בדף הראשי ובתדפיסים.',
  require_login: 'משתמשים יצטרכו להזין קוד עובד וסיסמה בכניסה למערכת.',
  item_locations: 'רשימת מיקומים פיזיים בגמ"ח (לדוגמה: מדף א, קומה 2, מחסן אחורי) מופרדים בפסיקים.',
  barcodePrefixLength: 'מספר הספרות הראשונות בברקוד המגדירות את קידומת זיהוי סוג הפריט.',
  inventory_include_warehouse: 'הצג וספור במלאי גם פריטים הנמצאים במחסן או ברזרבה.',
  main_email: 'כתובת האימייל הראשית של הגמ"ח ליצירת קשר והודעות.',

  mandatory_fields: 'שדות חובה במילוי פרטי הזמנה (לדוגמה: טלפון_1, שם_משפחה).',
  allow_alterations: 'מעקב ואפשרות ניהול תיקונים והתאמות אישיות לשמלות.',
  enable_alterations: 'הצגת אפשרויות לניהול תיקונים בכרטיסי ההזמנה.',
  max_items_per_order: 'הגבלת הכמות המרבית של פריטים שניתן לשבץ בהזמנה אחת.',
  allow_free_exchange: 'אפשרות להחלפת דגם שמלה ללא גביית דמי טיפול נוספים.',
  cancel_order_permission: 'הגדרת הרשאות הנדרשות לצורך ביטול הזמנה במערכת.',
  reserve_permission: 'הגדרת הרשאות הנדרשות לאישור שמלות רזרבה.',
  allow_date_change: 'מאפשר למשתמש לשנות את טווח תאריכי ההשכרה של ההזמנה.',
  BUFFER_DAYS: 'מספר ימים לפני ואחרי תאריך אירוע שבהם השמלה נחשבת תפוסה במלאי.',

  has_variations: 'אפשרות לנהל פריטי משנה (כגון: ווסט, חליפה) תחת אותו דגם.',
  has_underskirts: 'אפשרות לשילוב פריטי עזר כגון תחתיות יחד עם השמלות.',
  barcode_length: 'מספר התווים התקני לברקוד במאגר השמלות.',
  useModelNames: 'הצגת שם הדגם לצד המזהה הקטלוגי בטפסים ובחיפושים.',
  useFileNamesForImages: 'טעינה אוטומטית של תמונות לפי שם הקובץ מהשרת.',

  hide_ai_features: 'הצגה או הסתרה של תכונות ה-AI, הצאט ושורת החיפוש החכמה.',
  enable_ai_specific_employees: 'אם מופעל, גישה ל-AI תינתן רק לעובדים שצוינו במפורש.',
  hide_dress_images: 'מסתיר תמונות דגמים במסכי הניהול ובכרטיסי הדגמים.',
  hide_gregorian_calendar: 'הסתרת תאריכים לועזיים והתמקדות בלוח העברי.',
  hide_internal_messaging: 'הסתרה או הפעלה של פעמון ההתראות והודעות בין עובדים.',

  items_name_plural: 'הכיתוב שיופיע בכל הטבלאות (למשל: שמלות / חליפות / פריטים).',
  items_name_singular: 'הכיתוב ביחיד (למשל: שמלה / חליפה / פריט).',

  refund_per_item: 'חישוב החזר דמי ביטול בנפרד עבור כל פריט בהזמנה.',
  registration_fee: 'האם לגבות דמי רישום מראש בעת פתיחת הזמנה.',
  nedarim_plus_enabled: 'הפעלת אפשרות סליקת אשראי דרך מערכת נדרים פלוס.',
  nedarim_plus_terminal: 'קוד המוסד המזהה במערכת נדרים פלוס עבור חיוב אשראי.',
  NEDARIM_MOSAD: 'קוד המוסד המזהה במערכת נדרים פלוס עבור חיוב אשראי.',
  ENABLE_SET_DISCOUNTS: 'מתן זיכוי/הנחה אוטומטית על פריטים נלווים בהזמנת סט.',
  REFUND_PERCENTAGE: 'אחוז החזר כספי מסך העסקה בעת ביטול הזמנה.',
  REFUND_DAYS: 'מספר ימים מרבי ממועד האירוע שבהם ניתן לבקש החזר.',
  NO_REFUND_DAYS_BEFORE_EVENT: 'מספר ימים לפני האירוע שמתחתיו לא יינתן החזר כספי.',
  REFUND_DAYS_FROM_ORDER: 'מספר ימים מביצוע ההזמנה שבהם זכאים להחזר מלא.',
  REFUND_REPAIRS: 'כולל עלויות תיקונים בחישוב ההחזר הכספי בביטול.',
  ALLOWED_PAYMENT_METHODS: 'רשימת אמצעי תשלום מורשים (מופרדים בפסיק, למשל: מזומן,אשראי,העברה).',

  calendar_filtering: 'סינון תצוגת יומן לפי חודשים ומועדים עבריים.',
  inventory_skip_weekends: 'האם לדלג על ימי שישי-שבת בחישוב ימי מרווח ביטחון.',
  inventory_buffer_days: 'מספר ימים לפני ואחרי אירוע שבהם השמלה חסומה במלאי.',

  print_rental_box1: 'טקסט הערות שיופיע בתיבה העליונה בכרטיס השכרה מודפס.',
  print_rental_box2: 'טקסט הערות שיופיע בתיבה האמצעית בכרטיס השכרה מודפס.',
  print_rental_footer: 'טקסט תקנון וחתימה בתחתית כרטיס השכרה מודפס.'
};

const HEBREW_CATEGORIES = {
  gmach_name: 'כללי',
  gmach_subtitle: 'כללי',
  require_login: 'כללי',
  item_locations: 'כללי',
  barcodePrefixLength: 'כללי',
  inventory_include_warehouse: 'כללי',
  main_email: 'כללי',

  mandatory_fields: 'הזמנות',
  allow_alterations: 'הזמנות',
  enable_alterations: 'הזמנות',
  max_items_per_order: 'הזמנות',
  allow_free_exchange: 'הזמנות',
  cancel_order_permission: 'הזמנות',
  reserve_permission: 'הזמנות',
  allow_date_change: 'הזמנות',
  BUFFER_DAYS: 'הזמנות',

  has_variations: 'מאגר',
  has_underskirts: 'מאגר',
  barcode_length: 'מאגר',
  useModelNames: 'תצוגה',
  useFileNamesForImages: 'תצוגה',

  hide_ai_features: 'בינה מלאכותית',
  enable_ai_specific_employees: 'בינה מלאכותית',
  hide_dress_images: 'תצוגה',
  hide_gregorian_calendar: 'תצוגה',
  hide_internal_messaging: 'תצוגה',

  items_name_plural: 'כותרות',
  items_name_singular: 'כותרות',

  refund_per_item: 'תשלומים',
  registration_fee: 'תשלומים',
  nedarim_plus_enabled: 'תשלומים',
  nedarim_plus_terminal: 'תשלומים',
  NEDARIM_MOSAD: 'תשלומים',
  ENABLE_SET_DISCOUNTS: 'תשלומים',
  REFUND_PERCENTAGE: 'תשלומים',
  REFUND_DAYS: 'תשלומים',
  NO_REFUND_DAYS_BEFORE_EVENT: 'תשלומים',
  REFUND_DAYS_FROM_ORDER: 'תשלומים',
  REFUND_REPAIRS: 'תשלומים',
  ALLOWED_PAYMENT_METHODS: 'תשלומים',

  calendar_filtering: 'יומן',
  inventory_skip_weekends: 'יומן',
  inventory_buffer_days: 'יומן',

  print_rental_box1: 'הדפסה',
  print_rental_box2: 'הדפסה',
  print_rental_footer: 'הדפסה'
};

async function main() {
  const all = await prisma.systemSetting.findMany({});
  console.log(`Found ${all.length} settings in DB`);

  for (const s of all) {
    const hebName = HEBREW_NAMES[s.key];
    const hebNote = HEBREW_NOTES[s.key];
    const hebCat = HEBREW_CATEGORIES[s.key];

    const dataToUpdate = {};
    if (hebName && s.name !== hebName) dataToUpdate.name = hebName;
    if (hebNote && s.notes !== hebNote) dataToUpdate.notes = hebNote;
    if (hebCat && s.category !== hebCat) dataToUpdate.category = hebCat;

    if (Object.keys(dataToUpdate).length > 0) {
      await prisma.systemSetting.update({
        where: { id: s.id },
        data: dataToUpdate
      });
      console.log(`Updated setting key [${s.key}]:`, dataToUpdate);
    }
  }

  // Also ensure all mapped keys exist in database
  for (const [key, name] of Object.entries(HEBREW_NAMES)) {
    const exists = all.find(s => s.key === key);
    if (!exists) {
      await prisma.systemSetting.create({
        data: {
          key,
          name,
          notes: HEBREW_NOTES[key] || null,
          category: HEBREW_CATEGORIES[key] || 'כללי',
          value: key.startsWith('hide_') ? 'false' : (key.startsWith('enable_') || key.startsWith('allow_') ? 'true' : '')
        }
      });
      console.log(`Created missing setting key [${key}]`);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
