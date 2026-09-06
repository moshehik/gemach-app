import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const newSettings = [
  { key: 'hide_custom_spacing', name: 'הסתר אפשרות ציפוף ימים', value: 'true', category: 'הזמנות', notes: 'כאשר מופעל, אפשרות ציפוף ימים מיוחד מוסתרת בכל התהליך', type: 'boolean' },
  { key: 'nedarim_rinat_lev_url', name: 'קישור נדרים פלוס - רינת לב', value: '', category: 'תשלומים', notes: 'URL ייעודי לנדרים פלוס עבור רינת לב', type: 'text' },
  { key: 'hok_enabled', name: 'הפעל הוראת קבע (הו״ק)', value: 'false', category: 'הוראת קבע', notes: 'בכל הזמנה ניתן להזין פרטי הוראת קבע', type: 'boolean' },
  { key: 'hok_auto_charge_enabled', name: 'גביה אוטומטית למאחרים', value: 'false', category: 'הוראת קבע', notes: 'אם לא החזיר עד שעת היעד - חיוב אוטומטי', type: 'boolean' },
  { key: 'hok_auto_charge_hour', name: 'שעת גביה אוטומטית', value: '19:00', category: 'הוראת קבע', notes: 'שעת היעד ביום ההחזרה', type: 'text' },
  { key: 'hok_charge_amount', name: 'סכום גביה נוספת למאחר (לשמלה)', value: '', category: 'הוראת קבע', notes: 'סכום קבוע, ריק = מחיר מקורי', type: 'number' },
  { key: 'strict_mandatory_fields', name: 'אכיפה קשיחה ללא אישור מנהל', value: 'true', category: 'הזמנות', notes: 'חסימה קשיחה - גם לא באישור מנהל', type: 'boolean' },
  { key: 'require_customer_email', name: 'חייב מייל לקוח', value: 'true', category: 'הזמנות', notes: 'חובה מייל תקין', type: 'boolean' },
  { key: 'require_full_address', name: 'חייב כתובת מלאה', value: 'true', category: 'הזמנות', notes: 'חובה עיר+רחוב+בית', type: 'boolean' },
  { key: 'require_marketing_consent', name: 'חייב אישור דיוור', value: 'true', category: 'הזמנות', notes: 'חובה אישור דיוורים', type: 'boolean' },
  { key: 'auto_email_on_order_create', name: 'מייל אוטומטי בעת יצירת הזמנה', value: 'true', category: 'אוטומציה', notes: 'שולח מייל עם פרטי הזמנה', type: 'boolean' },
  { key: 'pickup_reminder_enabled', name: 'תזכורת מייל יום לפני איסוף', value: 'true', category: 'אוטומציה', notes: 'תזכורת יום לפני', type: 'boolean' },
  { key: 'pickup_reminder_hour', name: 'שעת תזכורת איסוף', value: '18:00', category: 'אוטומציה', notes: 'שעת שליחת תזכורת', type: 'text' },
  { key: 'daily_manager_report_enabled', name: 'דוח יומי למנהל', value: 'true', category: 'אוטומציה', notes: 'דוח יומי עם רשימת הזמנות', type: 'boolean' },
  { key: 'daily_manager_report_email', name: 'מייל מנהל לדוח יומי', value: '', category: 'אוטומציה', notes: 'לאן לשלוח, ריק=main_email', type: 'text' },
  { key: 'daily_manager_report_hour', name: 'שעת דוח יומי', value: '07:30', category: 'אוטומציה', notes: 'שעת דוח', type: 'text' },
  { key: 'late_return_email_enabled', name: 'מייל אוטומטי למאחרים', value: 'true', category: 'אוטומציה', notes: 'מייל למאחרים', type: 'boolean' },
  { key: 'late_return_email_text', name: 'נוסח מייל איחור', value: 'המערכת זיהתה שלא החזרתם את השמלות, במידה ולא יחזרו במיידי המערכת מעבירה לגביה אוטומטית.', category: 'אוטומציה', notes: 'נוסח', type: 'text' },
  { key: 'yemot_enabled', name: 'הפעל סנכרון ימות המשיח', value: 'false', category: 'סנכרון', notes: 'סנכרון ימות', type: 'boolean' },
  { key: 'yemot_api_url', name: 'URL ימות המשיח', value: '', category: 'סנכרון', notes: 'Webhook', type: 'text' },
  { key: 'yemot_api_token', name: 'טוקן ימות המשיח', value: '', category: 'סנכרון', notes: 'טוקן מוצפן', type: 'text' },
  { key: 'yemot_queue_view_enabled', name: 'הצג תור מזמינים (ימות)', value: 'false', category: 'סנכרון', notes: 'צפיה בתור', type: 'boolean' },
  { key: 'yemot_import_customer_enabled', name: 'ייבוא לקוח מימות', value: 'false', category: 'סנכרון', notes: 'ייבוא פרטי לקוח', type: 'boolean' },
  { key: 'mailing_list_auto_sync', name: 'הוסף מיילים לרשימת תפוצה', value: 'false', category: 'אוטומציה', notes: 'הוספה אוטומטית', type: 'boolean' },
  { key: 'mailing_list_provider', name: 'ספק רשימת תפוצה', value: '', category: 'אוטומציה', notes: 'רב מסר וכו', type: 'text' },
  { key: 'phone_order_marker_enabled', name: 'סמן הזמנה טלפונית', value: 'true', category: 'הזמנות', notes: 'סימון הזמנה טלפונית', type: 'boolean' },
  { key: 'track_branch_on_order', name: 'זהה סניף ביצוע', value: 'true', category: 'סניפים', notes: 'שומר סניף', type: 'boolean' },
  { key: 'require_id_for_edit_cancel', name: 'דרוש ת״ז לעריכה/ביטול', value: 'true', category: 'הזמנות', notes: 'אימות תז', type: 'boolean' },
  { key: 'delivery_price_by_city', name: 'מחיר משלוח לפי עיר (JSON)', value: '', category: 'משלוחים', notes: 'JSON מחירים', type: 'text' },
  { key: 'delivery_allow_address_override', name: 'אפשר כתובת משלוח שונה', value: 'true', category: 'משלוחים', notes: 'כתובת שונה', type: 'boolean' },
  { key: 'delivery_show_in_order', name: 'הצג משלוח בהזמנה', value: 'true', category: 'משלוחים', notes: 'תג משלוח', type: 'boolean' },
  { key: 'rentals_sort_recent_first', name: 'השכרות - האחרונים למעלה', value: 'true', category: 'תצוגה', notes: 'מיון מהאחרונים', type: 'boolean' },
  { key: 'enforce_strict_max_items', name: 'אכיפה קשיחה מקסימום ללא חריגה', value: 'true', category: 'הזמנות', notes: 'לא מאפשר חריגה', type: 'boolean' },
  { key: 'delivery_table_range_enabled', name: 'טבלת משלוחים לטווח', value: 'true', category: 'משלוחים', notes: 'שבוע/חודש', type: 'boolean' },
  { key: 'delivery_one_day_before_option', name: 'אפשר משלוח יום לפני', value: 'true', category: 'משלוחים', notes: 'יום לפני', type: 'boolean' },
  { key: 'print_sort_deliveries_first', name: 'הדפסה - מיון משלוחים בנפרד', value: 'true', category: 'הדפסה', notes: 'מיון משלוחים', type: 'boolean' },
  { key: 'print_mark_missing_dresses', name: 'הדפסה - סמן שמלה חסרה', value: 'true', category: 'הדפסה', notes: 'סימון חסרה', type: 'boolean' },
  { key: 'bulk_email_by_event_date', name: 'שליחת מייל לפי תאריך אירוע', value: 'true', category: 'אוטומציה', notes: 'לפי תאריך', type: 'boolean' },
  { key: 'auto_charge_damaged_return', name: 'גביה על החזרה פגומה', value: 'false', category: 'הוראת קבע', notes: 'גביה פגומה', type: 'boolean' },
  { key: 'shift_handover_notes', name: 'הודעות בין משמרות', value: 'true', category: 'הודעות', notes: 'בין משמרות', type: 'boolean' },
  { key: 'management_messages', name: 'הודעות להנהלה', value: 'true', category: 'הודעות', notes: 'להנהלה', type: 'boolean' },
  { key: 'barcode_invalid_list', name: 'רשימת ברקודים לא תקינים', value: 'true', category: 'ברקודים', notes: 'רשימת הנהלה', type: 'boolean' },
  { key: 'allow_edit_partially_rented', name: 'אפשר עריכת מושכר חלקי', value: 'true', category: 'הזמנות', notes: 'עריכת מושכר חלקי', type: 'boolean' },
  { key: 'split_dress_enabled', name: 'דגם מפוצל ל-2 חלקים', value: 'false', category: 'מאגר', notes: 'חולצה+חצאית', type: 'boolean' },
  { key: 'notify_on_new_message_at_login', name: 'התראה על הודעה חדשה בכניסה', value: 'true', category: 'הודעות', notes: 'התראה בכניסה', type: 'boolean' },
  { key: 'laundress_return_check_on_exit', name: 'בדיקת כובסת ביציאה', value: 'true', category: 'הודעות', notes: 'כובסת', type: 'boolean' },
  { key: 'manual_barcode_double_entry', name: 'הקלדה ידנית כפולה + חתימה', value: 'true', category: 'ברקודים', notes: 'כפולה', type: 'boolean' },
  { key: 'manual_barcode_daily_report', name: 'דוח יומי ברקודים ידניים', value: 'true', category: 'אוטומציה', notes: 'דוח יומי', type: 'boolean' },
  { key: 'kiosk_customer_self_service', name: 'עמדת לקוח - רישום עצמי', value: 'false', category: 'תצוגה', notes: 'רישום עצמי', type: 'boolean' },
  { key: 'kiosk_allow_self_order', name: 'אפשר הזמנה עצמית באתר', value: 'false', category: 'תצוגה', notes: 'הזמנה עצמית', type: 'boolean' },
  { key: 'branches_enabled', name: 'הפעל סניפים', value: 'false', category: 'סניפים', notes: 'סניפים', type: 'boolean' },
  { key: 'branch_list', name: 'רשימת סניפים', value: 'נוה יעקב, בית שמש', category: 'סניפים', notes: 'רשימת סניפים', type: 'text' },
  { key: 'premium_pricing_enabled', name: 'הפעל מחירון פרימיום', value: 'false', category: 'מחירון', notes: 'פרימיום', type: 'boolean' },
  { key: 'premium_categories', name: 'קטגוריות פרימיום', value: 'פרימיום,יוקרה', category: 'מחירון', notes: 'פרימיום', type: 'text' },
  { key: 'show_not_taken_orders', name: 'הצג לא-נלקחו (קטגוריה)', value: 'true', category: 'תצוגה', notes: 'לא נלקחו', type: 'boolean' },
  { key: 'cancellation_extra_columns', name: 'עמודות ביטול נוספות', value: 'true', category: 'תצוגה', notes: 'ביטול ילדות/נשים', type: 'boolean' },
];
async function main(){
  console.log('Seeding 38-request settings directly...');
  for(const s of newSettings){
    const ex = await prisma.systemSetting.findUnique({where:{key:s.key}});
    if(ex){
      await prisma.systemSetting.update({where:{key:s.key}, data:{name:s.name, category:s.category, notes:s.notes, type:s.type}});
      console.log(`  ↷ exists ${s.key} - updated meta, kept value=${ex.value}`);
    } else {
      await prisma.systemSetting.create({data:s});
      console.log(`  + new ${s.key}=${s.value}`);
    }
  }
  const max = await prisma.systemSetting.findUnique({where:{key:'max_items_per_order'}});
  if(max && max.value!=='6'){ await prisma.systemSetting.update({where:{key:'max_items_per_order'}, data:{value:'6'}}); console.log(' → max_items_per_order forced to 6');}
  const alt = await prisma.systemSetting.findUnique({where:{key:'enable_alterations'}});
  if(alt && alt.value!=='false'){ await prisma.systemSetting.update({where:{key:'enable_alterations'}, data:{value:'false'}}); console.log(' → enable_alterations forced false');}
  const alt2 = await prisma.systemSetting.findUnique({where:{key:'allow_alterations'}});
  if(alt2 && alt2.value!=='false') await prisma.systemSetting.update({where:{key:'allow_alterations'}, data:{value:'false'}});
  console.log('Done');
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
