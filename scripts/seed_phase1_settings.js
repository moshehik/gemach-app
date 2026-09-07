import prisma from '../app/lib/prisma.js';

// Phase 1 - 38 בקשות: מוסיף SystemSetting לכל בקשה עם toggle, בלי למחוק פיצ'רים קיימים
// כל הגדרה מקבלת קטגוריה ברורה כדי שה-HTML המפורט (app/admin/settings/help) יוכל להפנות בדיוק
// לכל לשונית בהגדרות הניהול.

const newSettings = [
  // 1 - ציפוף ימים מיוחדים - הסתרה
  { key: 'hide_custom_spacing', name: 'הסתר אפשרות ציפוף ימים', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל (ברירת מחדל ללקוח זה), אפשרות ציפוף ימים מיוחד (customSpacing) מוסתרת בכל התהליך: יצירת הזמנה, עריכת הזמנה, ולוח תפוסה. כבוי = האפשרות חוזרת לתצוגה. אינו מוחק נתוני DB, רק מסתיר UI.', type: 'boolean' },

  // 2 - נדרים פלוס - קישור לרינת לב
  { key: 'nedarim_rinat_lev_url', name: 'קישור נדרים פלוס - רינת לב', value: '', category: 'תשלומים', notes: 'URL ייעודי לנדרים פלוס עבור רינת לב (ימות המשיח/סליקה). אם ריק - משתמש בקוד המוסד הכללי (nedarim_plus_terminal).', type: 'text' },

  // 3 - הוראת קבע וגביה ממאחרים
  { key: 'hok_enabled', name: 'הפעל הוראת קבע (הו״ק)', value: 'false', category: 'הוראת קבע', notes: 'כאשר מופעל, בכל הזמנה ניתן להזין פרטי הוראת קבע. נשמר בשדה ייעודי בהזמנה (לא דורס פרטי בנק לזיכוי).', type: 'boolean' },
  { key: 'hok_auto_charge_enabled', name: 'גביה אוטומטית למאחרים', value: 'false', category: 'הוראת קבע', notes: 'אם הלקוח לא החזיר עד שעת היעד ביום ההחזרה - המערכת תחייב אוטומטית מחיר השכרה נוסף לכל שמלה (כפול כמות הפריטים). דורש hok_enabled.', type: 'boolean' },
  { key: 'hok_auto_charge_hour', name: 'שעת גביה אוטומטית (מאחרים)', value: '19:00', category: 'הוראת קבע', notes: 'שעת היעד ביום ההחזרה (לדוגמה 19:00). מי שלא החזיר עד שעה זו ייחשב מאחר ויחויב אוטומטית אם hok_auto_charge_enabled מופעל.', type: 'text' },
  { key: 'hok_charge_amount', name: 'סכום גביה נוספת למאחר (לשמלה)', value: '', category: 'הוראת קבע', notes: 'סכום לחיוב נוסף לכל שמלה במקרה איחור. ריק = מחיר השכרה המקורי של הפריט (לפי מחירון).', type: 'number' },

  // 4 - אכיפה קשיחה ללא דילוג - מייל, כתובת מלאה, אישור דיוור
  { key: 'strict_mandatory_fields', name: 'אכיפה קשיחה - ללא אישור מנהל', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל, חסימת שדות חובה היא קשיחה - גם לא באישור מנהל. כבוי = מאפשר דילוג באישור מנהל (התנהגות קודמת ללקוח קיים).', type: 'boolean' },
  { key: 'require_customer_email', name: 'חייב מייל לקוח', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל, לא ניתן לרשום לקוח/הזמנה ללא כתובת מייל תקינה. מתווסף ל-mandatory_fields (אימייל).', type: 'boolean' },
  { key: 'require_full_address', name: 'חייב כתובת מלאה', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל, נדרשים עיר + רחוב + מספר בית. ללא זה לא ניתן לסיים הזמנה.', type: 'boolean' },
  { key: 'require_marketing_consent', name: 'חייב אישור קבלת דיוורים', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל, חובה לסמן אישור קבלת דיוורים (שדה חדש בכרטיס לקוח) לפני סגירת הזמנה.', type: 'boolean' },

  // 5,6,8,9 - אוטומציית מיילים
  { key: 'auto_email_on_order_create', name: 'מייל אוטומטי בעת יצירת הזמנה', value: 'true', category: 'אוטומציה', notes: 'שולח מייל אוטומטי לכל מי שביצע הזמנה - עם פרטי הזמנה, תאריכי איסוף והחזרה. דורש main_email + email_link_a תקינים.', type: 'boolean' },
  { key: 'pickup_reminder_enabled', name: 'תזכורת מייל יום לפני איסוף', value: 'true', category: 'אוטומציה', notes: 'שולח מייל יום לפני מועד האיסוף לכל מי שאמור לבוא מחר - כולל שעה, כתובת הגמח (gmach_address/gmach_phone) ופרטי ההזמנה.', type: 'boolean' },
  { key: 'pickup_reminder_hour', name: 'שעת שליחת תזכורת איסוף', value: '18:00', category: 'אוטומציה', notes: 'שעה ביום שלפני האיסוף לשליחת התזכורת (ברירת מחדל 18:00).', type: 'text' },
  { key: 'daily_manager_report_enabled', name: 'דוח יומי למנהל', value: 'true', category: 'אוטומציה', notes: 'שולח כל יום למנהל מייל עם רשימת ההזמנות (חדשות, איסופים והחזרות של היום).', type: 'boolean' },
  { key: 'daily_manager_report_email', name: 'מייל מנהל לדוח יומי', value: '', category: 'אוטומציה', notes: 'כתובת המייל שאליה יישלח הדוח היומי. ריק = main_email.', type: 'text' },
  { key: 'daily_manager_report_hour', name: 'שעת דוח יומי', value: '07:30', category: 'אוטומציה', notes: 'שעת שליחת הדוח היומי למנהל.', type: 'text' },
  { key: 'late_return_email_enabled', name: 'מייל אוטומטי למאחרים', value: 'true', category: 'אוטומציה', notes: 'שולח מייל אוטומטי למאחרים להחזיר: "המערכת זיהתה שלא החזרתם... במידה ולא יחזרו במיידי - גביה אוטומטית".', type: 'boolean' },
  { key: 'late_return_email_text', name: 'נוסח מייל איחור', value: 'המערכת זיהתה שלא החזרתם את השמלות, במידה ולא יחזרו במיידי המערכת מעבירה לגביה אוטומטית.', category: 'אוטומציה', notes: 'נוסח המייל שישלח למאחרים. ניתן לערוך.', type: 'text' },

  // 10,11 - ימות המשיח
  { key: 'yemot_enabled', name: 'הפעל סנכרון ימות המשיח', value: 'false', category: 'סנכרון', notes: 'כאשר מופעל, מאפשר סנכרון לאתר ימות המשיח - צפיה בתור מזמינים וייבוא פרטי לקוח.', type: 'boolean' },
  { key: 'yemot_api_url', name: 'URL API ימות המשיח', value: '', category: 'סנכרון', notes: 'כתובת WebHook/API של ימות המשיח (נדרש מהלקוח).', type: 'text' },
  { key: 'yemot_api_token', name: 'טוקן ימות המשיח', value: '', category: 'סנכרון', notes: 'טוקן/סיסמה לסנכרון ימות המשיח (נשמר מוצפן).', type: 'text' },
  { key: 'yemot_queue_view_enabled', name: 'הצג תור מזמינים (ימות)', value: 'false', category: 'סנכרון', notes: 'אפשרות לראות רשימת ממתינים בתור מימות המשיח.', type: 'boolean' },
  { key: 'yemot_import_customer_enabled', name: 'ייבוא פרטי לקוח מימות', value: 'false', category: 'סנכרון', notes: 'אפשרות להעתיק פרטי לקוח מימות המשיח לכרטיס לקוח במערכת.', type: 'boolean' },

  // 12 - רשימת תפוצה
  { key: 'mailing_list_auto_sync', name: 'הוסף מיילים אוטומטית לרשימת תפוצה', value: 'false', category: 'אוטומציה', notes: 'כל מייל חדש במערכת (לקוח/הזמנה) יתווסף אוטומטית לרשימת התפוצה.', type: 'boolean' },
  { key: 'mailing_list_provider', name: 'ספק רשימת תפוצה', value: '', category: 'אוטומציה', notes: 'שם/URL ספק הדיוור (לדוגמה: רב מסר, Smoove, Mailchimp). ריק = רשימה פנימית בלבד.', type: 'text' },

  // 13 - הזמנה טלפונית וסניף
  { key: 'phone_order_marker_enabled', name: 'סמן הזמנה טלפונית', value: 'true', category: 'הזמנות', notes: 'מאפשר סימון הזמנה שהוזנה טלפונית (צ׳קבוקס בכרטיס ההזמנה + עמודה ברשימה).', type: 'boolean' },
  { key: 'track_branch_on_order', name: 'זהה סניף ביצוע הזמנה', value: 'true', category: 'סניפים', notes: 'מציג ושומר באיזה סניף בוצעה ההזמנה (לפי עובד/מיקום).', type: 'boolean' },

  // 14 - עריכה/ביטול רק עם ת״ז
  { key: 'require_id_for_edit_cancel', name: 'דרוש ת״ז לעריכה/ביטול', value: 'true', category: 'הזמנות', notes: 'חוסם עריכה וביטול הזמנה קיימת - רק לאחר הזנת מספר תעודת זהות ואימות מול כרטיס הלקוח.', type: 'boolean' },

  // 15 - משלוח
  { key: 'delivery_price_by_city', name: 'מחיר משלוח לפי עיר (JSON)', value: '', category: 'משלוחים', notes: 'טבלת מחירי משלוח לפי עיר בפורמט JSON, לדוגמה: {"ירושלים":60,"בית שמש":40,"אופקים":80}. ריק = מחיר אחיד (delivery_price).', type: 'text' },
  { key: 'delivery_allow_address_override', name: 'אפשר כתובת משלוח שונה', value: 'true', category: 'משלוחים', notes: 'מאפשר להזין כתובת משלוח שונה מכתובת המגורים (לדוגמה: סבתא בירושלים).', type: 'boolean' },
  { key: 'delivery_show_in_order', name: 'הצג משלוח בהזמנה (הלוך/חזור)', value: 'true', category: 'משלוחים', notes: 'מציג בהזמנה תג "משלוח הלוך/חזור" כמו תג תיקונים כיום.', type: 'boolean' },

  // 16 - השכרות החזרות מיון
  { key: 'rentals_sort_recent_first', name: 'השכרות - מהאחרונים ביותר למעלה', value: 'true', category: 'תצוגה', notes: 'כאשר מופעל, טבלת השכרות/החזרות ממוינת מהאחרונים ביותר (אתמול למעלה) ולא לפי תאריך עתידי.', type: 'boolean' },

  // 17 - הגבלת 6 שמלות קשיחה
  { key: 'enforce_strict_max_items', name: 'אכיפה קשיחה - מקסימום 6 ללא חריגה', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל, לא ניתן להזמין יותר מ-max_items_per_order (6) גם לא באישור מנהל. כבוי = מאפשר חריגה באישור מנהל.', type: 'boolean' },

  // 18 - טבלת משלוחים לטווח תאריכים
  { key: 'delivery_table_range_enabled', name: 'טבלת משלוחים לטווח (שבוע/חודש)', value: 'true', category: 'משלוחים', notes: 'מציג טבלה מסודרת של משלוחים הלוך וחזור לכל יום בטווח (שבוע, שבועיים, חודש) + תאריכים שעברו.', type: 'boolean' },

  // 19 - משלוח יום לפני
  { key: 'delivery_one_day_before_option', name: 'אפשר משלוח יום לפני האירוע', value: 'true', category: 'משלוחים', notes: 'מאפשר ליצור הזמנה עם משלוח שיוצא יום לפני האירוע במקום יומיים לפני (דחיית משלוח ביום).', type: 'boolean' },

  // 20 - הדפסת דפי הכנות ממוין
  { key: 'print_sort_deliveries_first', name: 'הדפסה - מיון משלוחים בנפרד', value: 'true', category: 'הדפסה', notes: 'בהדפסת דפי הכנות - ממוין אוטומטית: דפי הזמנות למשלוחים בנפרד ודפי הזמנות רגילות בנפרד.', type: 'boolean' },

  // 21 - סימון שמלה חסרה בהדפסה
  { key: 'print_mark_missing_dresses', name: 'הדפסה - סמן שמלה חסרה', value: 'true', category: 'הדפסה', notes: 'אם המערכת מזהה ששמלה חסרה (אמורה לחזור רק מחר ואין עוד ממנה) - תסמן "חסרה" ותכתוב: שמלה זו אמורה לחזור מחר ממשפחת פלוני...', type: 'boolean' },

  // 22 - שליחת מייל לפי תאריך אירוע
  { key: 'bulk_email_by_event_date', name: 'שליחת מייל לפי תאריך אירוע', value: 'false', category: 'אוטומציה', notes: 'מאפשר לשלוח מייל לכל הלקוחות שיש להם אירוע בתאריך/טווח מסוים + מעקב מי אישר/לא אישר.', type: 'boolean' },

  // 23 - גביה על החזרה פגומה
  { key: 'auto_charge_damaged_return', name: 'גביה אוטומטית על החזרה פגומה', value: 'false', category: 'הוראת קבע', notes: 'אם שמלה הוחזרה לא תקינה (מסומן בברקוד חזור) - המשפחה נגבית אוטומטית בהו״ק עם כיתוב "הוחזרה שמלה פגומה".', type: 'boolean' },

  // 24,25 - הודעות
  { key: 'shift_handover_notes', name: 'הודעות בין משמרת למשמרת', value: 'true', category: 'הודעות', notes: 'מקום לכתיבת הודעות בין משמרת למשמרת (נשמר ומוצג בכניסה למשמרת הבאה).', type: 'boolean' },
  { key: 'management_messages', name: 'הודעות להנהלה', value: 'true', category: 'הודעות', notes: 'מקום לכתיבת הודעות להנהלה (נשלח להנהלה ומוצג בדשבורד ניהול).', type: 'boolean' },

  // 26 - ברקוד לא תקין
  { key: 'barcode_invalid_list', name: 'רשימת ברקודים לא תקינים להנהלה', value: 'true', category: 'ברקודים', notes: 'ברקוד לא תקין / שחזר לא תקין - עובר לרשימה לטיפול הנהלה, ההנהלה מקבלת עדכון ומסמנת "טופל".', type: 'boolean' },

  // 27 - עריכת הזמנה שהושכרה חלקית
  { key: 'allow_edit_partially_rented', name: 'אפשר עריכת הזמנה מושכרת חלקית', value: 'true', category: 'הזמנות', notes: 'מאפשר לערוך הזמנה שהושכרה חלקית - לשנות מידה או להוסיף משלוח (עם אימות ת״ז אם require_id_for_edit_cancel מופעל).', type: 'boolean' },

  // 28 - דגם מפוצל 2 חלקים
  { key: 'split_dress_enabled', name: 'דגם מפוצל ל-2 חלקים (חולצה+חצאית)', value: 'false', category: 'מאגר', notes: 'כאשר מופעל, דגם יכול להיות סט של 2 ברקודים נפרדים (חולצה וחצאית) ששניהם חייבים לצאת ולחזור. בהזמנה - נבחר כסט אחד.', type: 'boolean' },

  // 29 - התראה בכניסה
  { key: 'notify_on_new_message_at_login', name: 'התראה על הודעה חדשה בכניסה', value: 'true', category: 'הודעות', notes: 'בכניסה למערכת, אם יש הודעה חדשה/שלא סומנה כטופלה - קופצת התראה.', type: 'boolean' },

  // 30 - כובסות
  { key: 'laundress_return_check_on_exit', name: 'כובסת - בדיקת לא-החזירו ביציאה', value: 'true', category: 'הודעות', notes: 'כשכובסת מסיימת משמרת ויוצאת - המערכת מקפיצה משפחות שלא החזירו ושואלת: האם משפחת פלוני אכן לא החזירה?', type: 'boolean' },

  // 31 - ברקוד ידני כפול + חתימה
  { key: 'manual_barcode_double_entry', name: 'הקלדה ידנית כפולה + חתימה', value: 'true', category: 'ברקודים', notes: 'כשברקוד לא עובר - אפשר להקליד ידנית פעמיים לאימות + חתימה "אני מאשרת שהשמלה בידי עכשיו". כל יום יוצא דוח "ברקודים תקולים שהוקלדו ידנית" למנהלת.', type: 'boolean' },
  { key: 'manual_barcode_daily_report', name: 'דוח יומי ברקודים ידניים', value: 'true', category: 'אוטומציה', notes: 'שולח כל יום דוח למנהלת על ברקודים שהוקלדו ידנית (ראה manual_barcode_double_entry).', type: 'boolean' },

  // 32,33 - קיוסק / הזמנה עצמית
  { key: 'kiosk_customer_self_service', name: 'עמדת לקוח - רישום וחיפוש עצמי', value: 'false', category: 'תצוגה', notes: 'מאפשר ללקוח לבצע חלק מהתהליך לבד (רישום פרטים, חיפוש דגם פנוי/תפוס). נועל מסך למסך לקוחות בלבד (/customer-interface).', type: 'boolean' },
  { key: 'kiosk_allow_self_order', name: 'אפשר הזמנה עצמית באתר', value: 'false', category: 'תצוגה', notes: 'מאפשר ללקוח להזמין הזמנות לבד באתר ללא הגעה פיזית (דרך עמדת הלקוח או קישור ציבורי).', type: 'boolean' },

  // 34 - סניפים
  { key: 'branches_enabled', name: 'הפעל התייחסות לסניפים', value: 'false', category: 'סניפים', notes: 'כאשר מופעל, ניתן להגדיר ולשייך הזמנה לסניף ביצוע וסניף איסוף (לדוגמה: בוצעה בנוה יעקב, איסוף בבית שמש).', type: 'boolean' },
  { key: 'branch_list', name: 'רשימת סניפים', value: 'נוה יעקב, בית שמש', category: 'סניפים', notes: 'רשימת סניפים מופרדת בפסיקים. מוצגת בבחירת סניף בהזמנה.', type: 'text' },

  // 35,36 - מחירון פרימיום
  { key: 'premium_pricing_enabled', name: 'הפעל מחירון פרימיום', value: 'false', category: 'מחירון', notes: 'מאפשר להגדיר שמלות פרימיום במחיר אחר (קטגוריית מחיר נפרדת).', type: 'boolean' },
  { key: 'premium_categories', name: 'קטגוריות פרימיום', value: 'פרימיום,יוקרה', category: 'מחירון', notes: 'רשימת קטגוריות מחיר שנחשבות פרימיום (מופרד בפסיק). שינוי ממחיר פרימיום לרגיל מתבצע בשינוי קטגוריית המחיר של הדגם.', type: 'text' },

  // 37 - הזמנות שלא נלקחו
  { key: 'show_not_taken_orders', name: 'הצג הזמנות שלא נלקחו (קטגוריה)', value: 'true', category: 'תצוגה', notes: 'הזמנות שלא נלקחו או נלקחו חלקית - יוצאות לרשימה/קטגוריה נפרדת.', type: 'boolean' },

  // 38 - תיעוד ביטולים
  { key: 'cancellation_extra_columns', name: 'עמודות ביטול נוספות (ילדות/נשים)', value: 'true', category: 'תצוגה', notes: 'מוסיף לטבלת ביטולים עמודות: ביטול ילדות, ביטול נשים (דוח למנהלת).', type: 'boolean' },

  // תיקון ל-17 (כבר קיים אך נוודא ערך): max_items_per_order = 6 (יעודכן בהמשך אם קיים)
];

async function main() {
  console.log('Seeding phase 1 settings (38 requests)...');
  for (const s of newSettings) {
    const existing = await prisma.systemSetting.findUnique({ where: { key: s.key } });
    if (existing) {
      console.log(`  ↷ exists: ${s.key} (current="${existing.value}") - updating notes/name/category only, keeping value`);
      await prisma.systemSetting.update({
        where: { key: s.key },
        data: { name: s.name, category: s.category, notes: s.notes, type: s.type }
      });
    } else {
      console.log(`  + new: ${s.key} = "${s.value}"`);
      await prisma.systemSetting.create({ data: s });
    }
  }
  // enforce max 6 for this client (request 17) - always set to 6
  const maxSetting = await prisma.systemSetting.findUnique({ where: { key: 'max_items_per_order' } });
  if (maxSetting) {
    await prisma.systemSetting.update({ where: { key: 'max_items_per_order' }, data: { value: '6' } });
    console.log('  → max_items_per_order forced to 6 (request 17)');
  }
  // enable_alterations off for this client (request 7) - hide repairs
  const altSetting = await prisma.systemSetting.findUnique({ where: { key: 'enable_alterations' } });
  if (altSetting) {
    await prisma.systemSetting.update({ where: { key: 'enable_alterations' }, data: { value: 'false' } });
    console.log('  → enable_alterations forced to false (request 7)');
  }
  const alt2 = await prisma.systemSetting.findUnique({ where: { key: 'allow_alterations' } });
  if (alt2) {
    await prisma.systemSetting.update({ where: { key: 'allow_alterations' }, data: { value: 'false' } });
  }
  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
