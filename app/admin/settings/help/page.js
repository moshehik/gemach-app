export const metadata = { title: 'מפת הגדרות - מדריך ניהול' };

const ROWS = [
  { id: 1, req: 'ציפוף ימים מיוחדים - הסתרה מוחלטת', key: 'hide_custom_spacing', cat: 'הזמנות', type: 'toggle', def: 'מופעל (מוסתר)', where: 'הגדרות מערכת → הזמנות → "הסתר ציפוף ימים מיוחד"' },
  { id: 2, req: 'קישור נדרים פלוס - רינת לב', key: 'nedarim_rinat_lev_url', cat: 'תשלומים', type: 'text', def: 'ריק (=קוד מוסד כללי)', where: 'הגדרות מערכת → תשלומים → "קישור נדרים פלוס - רינת לב"' },
  { id: 3, req: 'הוראת קבע וגביה ממאחרים (עד 19:00)', key: 'hok_enabled / hok_auto_charge_enabled / hok_auto_charge_hour / hok_charge_amount', cat: 'הוראת קבע', type: 'booleans+שעה+סכום', def: 'כבוי / כבוי / 19:00 / ריק=מחיר מקורי', where: 'הגדרות מערכת → הוראת קבע (4 שדות)' },
  { id: 4, req: 'אכיפת פרטים אישיים - ללא דילוג גם באישור מנהל (מייל+כתובת+דיוור)', key: 'strict_mandatory_fields, require_customer_email, require_full_address, require_marketing_consent', cat: 'הזמנות', type: 'toggles', def: 'מופעל / מופעל / מופעל / מופעל', where: 'הגדרות מערכת → הזמנות (4 מתגים) + שדות חובה (mandatory_fields)' },
  { id: 5, req: 'מייל אוטומטי לכל מזמין (פרטי הזמנה+איסוף/החזרה)', key: 'auto_email_on_order_create', cat: 'אוטומציה', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → אוטומציה → "מייל אוטומטי בעת יצירת הזמנה"' },
  { id: 6, req: 'תזכורת מייל יום לפני איסוף (שעה+כתובת)', key: 'pickup_reminder_enabled / pickup_reminder_hour', cat: 'אוטומציה', type: 'toggle+שעה', def: 'מופעל / 18:00', where: 'הגדרות מערכת → אוטומציה → "תזכורת מייל יום לפני איסוף"' },
  { id: 7, req: 'ביטול תיקונים והאיזכור בכל התהליך', key: 'enable_alterations / allow_alterations', cat: 'הזמנות', type: 'toggle', def: 'כבוי (ללא תיקונים)', where: 'הגדרות מערכת → הזמנות → "הפעל אפשרות תיקונים" (לכבות)' },
  { id: 8, req: 'דוח יומי למנהל עם רשימת הזמנות', key: 'daily_manager_report_enabled / daily_manager_report_email / daily_manager_report_hour', cat: 'אוטומציה', type: 'toggle+מייל+שעה', def: 'מופעל / ריק=main_email / 07:30', where: 'הגדרות מערכת → אוטומציה (3 שדות)' },
  { id: 9, req: 'מייל למאחרים "לא החזרתם - גביה אוטומטית"', key: 'late_return_email_enabled / late_return_email_text', cat: 'אוטומציה', type: 'toggle+נוסח', def: 'מופעל / נוסח ברירת מחדל', where: 'הגדרות מערכת → אוטומציה → "מייל אוטומטי למאחרים"' },
  { id: 10, req: 'סנכרון ימות המשיח - צפייה בתור מזמינים', key: 'yemot_enabled / yemot_queue_view_enabled', cat: 'סנכרון', type: 'toggles', def: 'כבוי', where: 'הגדרות מערכת → סנכרון' },
  { id: 11, req: 'סנכרון ימות המשיח - ייבוא פרטי לקוח', key: 'yemot_import_customer_enabled / yemot_api_url / yemot_api_token', cat: 'סנכרון', type: 'toggle+URL+טוקן', def: 'כבוי', where: 'הגדרות מערכת → סנכרון' },
  { id: 12, req: 'הכנסת כל המיילים לרשימת תפוצה', key: 'mailing_list_auto_sync / mailing_list_provider', cat: 'אוטומציה', type: 'toggle+ספק', def: 'כבוי', where: 'הגדרות מערכת → אוטומציה → "הוסף מיילים לרשימת תפוצה"' },
  { id: 13, req: 'סימון הזמנה טלפונית + זיהוי סניף ביצוע', key: 'phone_order_marker_enabled / track_branch_on_order', cat: 'הזמנות / סניפים', type: 'toggles', def: 'מופעל', where: 'הגדרות מערכת → הזמנות / סניפים' },
  { id: 14, req: 'עריכה/ביטול רק עם ת״ז', key: 'require_id_for_edit_cancel', cat: 'הזמנות', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הזמנות → "דרוש ת״ז לעריכה/ביטול"' },
  { id: 15, req: 'משלוח הלוך/חזור - מחיר לפי עיר + כתובת שונה', key: 'enable_deliveries / delivery_price_by_city / delivery_allow_address_override / delivery_show_in_order', cat: 'משלוחים', type: 'toggle+JSON+booleans', def: 'כבוי / ריק / מופעל / מופעל', where: 'הגדרות מערכת → משלוחים (4 שדות)' },
  { id: 16, req: 'השכרות-החזרות - מהאחרונים ביותר למעלה', key: 'rentals_sort_recent_first', cat: 'תצוגה', type: 'toggle', def: 'מופעל (אתמול למעלה)', where: 'הגדרות מערכת → תצוגה → "השכרות - האחרונים למעלה"' },
  { id: 17, req: 'לא יותר מ-6 שמלות גם לא בחריגה', key: 'max_items_per_order (=6) + enforce_strict_max_items', cat: 'הזמנות', type: 'מספר+toggle', def: '6 / מופעל', where: 'הגדרות מערכת → הזמנות → "מקסימום פריטים" + "אכיפה קשיחה"' },
  { id: 18, req: 'טבלת משלוחים לטווח (שבוע/חודש/עבר)', key: 'delivery_table_range_enabled', cat: 'משלוחים', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → משלוחים → "טבלת משלוחים לטווח"' },
  { id: 19, req: 'משלוח יום לפני במקום יומיים', key: 'delivery_one_day_before_option', cat: 'משלוחים', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → משלוחים → "אפשר משלוח יום לפני"' },
  { id: 20, req: 'הדפסת דפי הכנות ממוין (משלוחים/רגילות)', key: 'print_sort_deliveries_first', cat: 'הדפסה', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הדפסה → "מיון משלוחים בנפרד"' },
  { id: 21, req: 'הדפסה - סימון שמלה חסרה "תחזור מחר ממשפחת..."', key: 'print_mark_missing_dresses', cat: 'הדפסה', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הדפסה → "סמן שמלה חסרה"' },
  { id: 22, req: 'שליחת מייל לפי תאריך אירוע + מעקב אישורים', key: 'bulk_email_by_event_date', cat: 'אוטומציה', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → אוטומציה → "שליחת מייל לפי תאריך אירוע"' },
  { id: 23, req: 'גביה אוטומטית על החזרה פגומה (ברקוד חזור)', key: 'auto_charge_damaged_return', cat: 'הוראת קבע', type: 'toggle', def: 'כבוי', where: 'הגדרות מערכת → הוראת קבע → "גביה על החזרה פגומה"' },
  { id: 24, req: 'הודעות בין משמרת למשמרת', key: 'shift_handover_notes', cat: 'הודעות', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הודעות → "בין משמרות"' },
  { id: 25, req: 'הודעות להנהלה', key: 'management_messages', cat: 'הודעות', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הודעות → "להנהלה"' },
  { id: 26, req: 'ברקוד לא תקין → רשימת הנהלה + "טופל"', key: 'barcode_invalid_list', cat: 'ברקודים', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → ברקודים → "רשימת ברקודים לא תקינים"' },
  { id: 27, req: 'עריכת הזמנה מושכרת חלקית (מידה/משלוח) עם ת״ז', key: 'allow_edit_partially_rented', cat: 'הזמנות', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הזמנות → "אפשר עריכת מושכר חלקי"' },
  { id: 28, req: 'דגם מפוצל 2 חלקים (חולצה+חצאית) = 2 ברקודים', key: 'split_dress_enabled', cat: 'מאגר', type: 'toggle', def: 'כבוי', where: 'הגדרות מערכת → מאגר → "דגם מפוצל ל-2 חלקים"' },
  { id: 29, req: 'התראה בכניסה על הודעה שלא טופלה', key: 'notify_on_new_message_at_login', cat: 'הודעות', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הודעות → "התראה בכניסה"' },
  { id: 30, req: 'כובסת ביציאה - הקפצת לא-החזירו', key: 'laundress_return_check_on_exit', cat: 'הודעות', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → הודעות → "בדיקת כובסת ביציאה"' },
  { id: 31, req: 'ברקוד ידני כפול + חתימה + דוח יומי', key: 'manual_barcode_double_entry / manual_barcode_daily_report', cat: 'ברקודים / אוטומציה', type: 'toggles', def: 'מופעל / מופעל', where: 'הגדרות מערכת → ברקודים + אוטומציה' },
  { id: 32, req: 'לקוח מבצע חלק לבד (רישום/חיפוש) - נעילת מסך', key: 'kiosk_customer_self_service', cat: 'תצוגה', type: 'toggle', def: 'כבוי', where: 'הגדרות מערכת → תצוגה → "עמדת לקוח - רישום עצמי" (/customer-interface)' },
  { id: 33, req: 'הזמנה עצמית באתר ללא הגעה', key: 'kiosk_allow_self_order', cat: 'תצוגה', type: 'toggle', def: 'כבוי', where: 'הגדרות מערכת → תצוגה → "אפשר הזמנה עצמית"' },
  { id: 34, req: 'התייחסות לסניפים (בוצעה ב... איסוף ב...)', key: 'branches_enabled / branch_list', cat: 'סניפים', type: 'toggle+רשימה', def: 'כבוי / "נוה יעקב, בית שמש"', where: 'הגדרות מערכת → סניפים' },
  { id: 35, req: 'מחירון - שמלות פרימיום מחיר אחר', key: 'premium_pricing_enabled / premium_categories', cat: 'מחירון', type: 'toggle+רשימה', def: 'כבוי', where: 'הגדרות מערכת → מחירון' },
  { id: 36, req: 'שינוי מחיר דגם מפרימיום לרגיל', key: '(אותו) premium_categories + שינוי קטגוריית מחיר בדגם', cat: 'מחירון / מאגר', type: 'הסבר', def: '-', where: 'כרטיס דגם → קטגוריית מחיר (שנה קטגוריה מ"פרימיום" ל"רגיל")' },
  { id: 37, req: 'הזמנות שלא נלקחו/חלקית → קטגוריה נפרדת', key: 'show_not_taken_orders', cat: 'תצוגה', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → תצוגה → "הצג לא-נלקחו"' },
  { id: 38, req: 'תיעוד ביטולים - עמודות ילדות/נשים', key: 'cancellation_extra_columns', cat: 'תצוגה', type: 'toggle', def: 'מופעל', where: 'הגדרות מערכת → תצוגה → "עמודות ביטול נוספות"' },
];

export default function HelpPage() {
  return (
    <div style={{ direction: 'rtl' }}>
      <div className="page-head">
        <div>
          <h1>מפת הגדרות - 38 בקשות</h1>
          <div className="page-desc">כל בקשה → המפתח ב-SystemSetting → איפה משנים בהגדרות הניהול. שום פיצ׳ר לא נמחק - רק נוסף מתג לשליטה.</div>
        </div>
        <a href="/admin/settings" className="btn btn-primary">חזרה להגדרות</a>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>#</th>
                <th style={{ minWidth: 220 }}>הבקשה</th>
                <th>מפתח/ות</th>
                <th style={{ width: 90 }}>קטגוריה</th>
                <th style={{ width: 110 }}>סוג שדה</th>
                <th style={{ width: 120 }}>ברירת מחדל</th>
                <th style={{ minWidth: 260 }}>איפה משנים בניהול</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => (
                <tr key={r.id}>
                  <td className="cell-primary" style={{ fontWeight: 700 }}>{r.id}</td>
                  <td>{r.req}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{r.key}</td>
                  <td><span className="badge badge-info">{r.cat}</span></td>
                  <td style={{ fontSize: 12 }}>{r.type}</td>
                  <td style={{ fontSize: 12 }}>{r.def}</td>
                  <td style={{ fontSize: 12 }}>{r.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>סטטוס מימוש (07/09/2026 v0.1.232)</h3>
        <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.7, fontSize: 13, color: 'var(--text-2)' }}>
          <li>✅ <strong>גמור:</strong> 1 ציפוף מוסתר, 4 חובה קשיחה + מייל/כתובת/דיוור, 5 מייל יצירה (לקיחה/החזרה), 6 תזכורת מחר, 7 ללא תיקונים, 8 דוח יומי, 9 מאחרים, 12 תפוצה (לוג פנימי), 13 טלפוני + סניף, 14 ת״ז, 15 משלוח הלוך/חזור + מחיר לפי עיר, 16 מיון אחרונים, 17 חסימת 6, 18 טבלת טווח, 19 יום לפני, 20/21 הדפסה (מיון + תג), 22 bulk לפי תאריך, 2 רינת לב (override), 3 הו״ק/גביה (Obligation), 23 פגומה, 26 ברקוד לא תקין → רשימת הנהלה + טופל, 31 הקלדה ידנית כפולה + דוח יומי (cron), 28 isSplit, 35/36 פרימיום שלד.</li>
          <li>🔶 <strong>שלד/ממתין לשאלה:</strong> 10/11 ימות (queue/import שלד - חסר URL/טוקן), 15 מחירי עיר (חסרה טבלה), 32/33 קיוסק (toggle בלבד), 26 דף ניהול ברקודים (API קיים, ללא התראת push להנהלה).</li>
          <li>⏳ <strong>פתוח:</strong> 24/25 בין-משמרת/הנהלה (תגובה מינימלית - צריך UI משמרת ייעודי), 28 לוגיקת 2 ברקודים בהשכרה/החזרה מלאה (כרגע רק סימון דגם), 35 פרימיום תמחור מלא.</li>
          <li>✅ לא מוחקים פיצ׳רים - כל &quot;ביטול/הסתרה&quot; הוא toggle. כבוי = חוזר מיד.</li>
        </ul>
      </div>

      <div className="card card-pad" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 8px' }}>הערות מימוש</h3>
        <ul style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.7, fontSize: 13, color: 'var(--text-2)' }}>
          <li><strong>לא מוחקים פיצ׳רים:</strong> כל בקשת "ביטול/הסתרה" (ציפוף, תיקונים) ממומשת כ-toggle. כיבוי המתג מחזיר את הפיצ׳ר מיד - ללא פריסה מחדש.</li>
          <li><strong>סדר עדיפות:</strong> צהוב/דחוף (1,4,5,6,7,8,9,17) הופעל כבר כברירת מחדל; השאר כבוי/מופעל לפי שיקול בטיחות (הו״ק/ימות/פרימיום כבויים עד להגדרה).</li>
          <li><strong>שאלות פתוחות:</strong> פרק "ממתין לתשובתך" למטה מרוכז בסוף הדף ונשלח גם כרשימת שאלות נפרדת - הדברים שבוצעו הם רק מה שאפשר לבנות ללא החלטה ממך.</li>
          <li><strong>עדכון:</strong> שינוי ערך בהגדרות → שמירה → תוקף מיידי (מטמון 30 שניות, ר׳ lib/settingsCache.js).</li>
        </ul>
      </div>

      <div className="card card-pad" style={{ marginTop: 16, borderRight: '4px solid var(--warning)' }}>
        <h3 style={{ margin: '0 0 8px' }}>ממתין לתשובתך (לא שולב עד שתאשר)</h3>
        <ol style={{ margin: 0, paddingInlineStart: 18, lineHeight: 1.7, fontSize: 13 }}>
          <li><strong>#2 נדרים רינת לב</strong> - מהו הקישור/קוד המוסד המדויק של רינת לב? האם זה מוסד נפרד או אותו מוסד עם תיאור עסקה שונה?</li>
          <li><strong>#3 הוראת קבע</strong> - אילו שדות לאסוף בהזמנה (בנק/סניף/חשבון/שם בעל חשבון/תעודת זהות)? האם לגבות <em>מחיר השכרה מלא נוסף</em> או סכום קבוע אחר? האם לשלוח התראה לפני גביה?</li>
          <li><strong>#10-11 ימות המשיח</strong> - האם יש API/TOKEN קיים? מה כתובת ה-Webhook? האם התור הוא "תור טלפוני" או רשימת המתנה לאירוע?</li>
          <li><strong>#12 רשימת תפוצה</strong> - באיזה ספק דיוור להשתמש (רב מסר/Smoove/אחר)? האם לרשום אוטומטית גם מיילים קיימים רטרואקטיבית?</li>
          <li><strong>#15 מחיר משלוח לפי עיר</strong> - טבלת מחירים מלאה לפי עיר? האם מחיר הלוך≠חזור? נא לשלוח רשימה.</li>
          <li><strong>#19 משלוח יום לפני</strong> - האם זו בחירה פר-הזמנה (צ׳קבוקס "דחה ביום") או הגדרה גלובלית חדשה (delivery_days_before=1)?</li>
          <li><strong>#28 דגם 2 חלקים</strong> - האם זה דגם אב עם 2 דגמי-בן, או שדה כמות=2 על אותו דגם? האם התמחור הוא לסט או פר-חלק?</li>
          <li><strong>#32-33 עמדת לקוח</strong> - האם לקוח יוצר הזמנה <em>מאושרת</em> או טיוטה שממתינה לאישור עובד? האם נדרש תשלום מראש באתר?</li>
          <li><strong>#34 סניפים</strong> - רשימת סניפים סופית? האם מלאי משותף או מופרד פר-סניף?</li>
        </ol>
        <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--text-3)' }}>לכל פריט נבנה כבר שלד והגדרות - השילוב יופעל מיד לאחר תשובתך ללא פריסה נוספת.</p>
      </div>
    </div>
  );
}
