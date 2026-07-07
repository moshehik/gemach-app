const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settingsToSeed = [
    { key: "nedarim_plus_terminal", name: "מספר מסוף נדרים פלוס", value: "7008300", category: "תשלומים", notes: "קישור נדרים פלוס למסוף התשלום", type: "text" },
    { key: "nedarim_plus_enabled", name: "אפשר נדרים פלוס", value: "true", category: "תשלומים", notes: "האם להציג אפשרות סליקת אשראי דרך נדרים פלוס", type: "boolean" },
    { key: "registration_fee", name: "דמי רישום", value: "false", category: "תשלומים", notes: "האם לגבות דמי רישום מראש", type: "boolean" },
    { key: "refund_per_item", name: "החזר בביטול לפי פריט", value: "true", category: "תשלומים", notes: "חישוב החזר דמי ביטול לפי כל פריט בנפרד", type: "boolean" },
    { key: "full_refund_days", name: "החזר מלא עד (מספר ימים)", value: "0", category: "תשלומים", notes: "מספר הימים מיום ההזמנה בהם ניתן לבטל ולקבל החזר מלא (0 = ללא)", type: "number" },
    
    { key: "calendar_filtering", name: "שימוש ביומן לסינון תאריכים", value: "true", category: "יומן", notes: "סינון הזמנות ותצוגות לפי חודשים ומועדים עבריים ביומן", type: "boolean" },
    
    { key: "allow_alterations", name: "אפשרות לתיקונים", value: "true", category: "הזמנות", notes: "מעקב אחר תיקונים לשמלות", type: "boolean" },
    { key: "allow_free_exchange", name: "אפשר החלפת דגם חינם", value: "true", category: "הזמנות", notes: "החלפת דגם ללא גביית דמי טיפול", type: "boolean" },
    { key: "allow_date_change", name: "אפשר שינוי טווח ימים", value: "true", category: "הזמנות", notes: "אפשרות למשתמש לשנות את טווח תאריכי ההשכרה", type: "boolean" },
    { key: "max_items_per_order", name: "מקסימום פריטים להזמנה", value: "100", category: "הזמנות", notes: "הגבלת כמות פריטים בכל הזמנה", type: "number" },
    { key: "cancel_order_permission", name: "הרשאה לביטול הזמנה", value: "מנהל", category: "הזמנות", notes: "מי מורשה לבטל הזמנה", type: "text" },
    { key: "reserve_permission", name: "הרשאה לשימוש ברזרבה", value: "מנהל", category: "הזמנות", notes: "מי מורשה לאשר שמלות רזרבה", type: "text" },
    { key: "mandatory_fields", name: "שדות חובה", value: "טלפון_1,שם_משפחה", category: "הזמנות", notes: "שדות חובה במילוי פרטי הזמנה", type: "text" },
    
    { key: "gmach_name", name: "שם הגמ\"ח", value: "מכובד", category: "כללי", notes: "שם המערכת / הגמ\"ח", type: "text" },
    { key: "gmach_subtitle", name: "כותרת משנה", value: "השכרת שמלות", category: "כללי", notes: "כותרת שמופיעה מתחת לשם הגמ\"ח", type: "text" },
    { key: "main_email", name: "מייל ראשי", value: "amechubad@gmail.com", category: "כללי", notes: "מוצג בדפי הלקוח / הדפסה", type: "text" },
    { key: "items_name_plural", name: "שם הפריטים - רבים", value: "שמלות", category: "כותרות", notes: "הכיתוב שיופיע בכל הטבלאות השונות (למשל: שמלות / חליפות / פריטים)", type: "text" },
    { key: "items_name_singular", name: "שם הפריטים - יחיד", value: "פריט", category: "כותרות", notes: "למשל: שמלה / חליפה / פריט", type: "text" },
    
    { key: "barcode_length", name: "אורך ברקוד", value: "7", category: "מאגר", notes: "אורך תווים חוקי לברקוד במאגר השמלות", type: "number" },
    { key: "has_underskirts", name: "יש תחתיות", value: "false", category: "מאגר", notes: "האם יש למלאי גם פריטי עזר כמו תחתיות", type: "boolean" },
    { key: "has_variations", name: "יש סוגים שונים לאותו דגם", value: "false", category: "מאגר", notes: "למשל: חליפה, מכנס, ווסט וכדומה תחת אותו מספר דגם", type: "boolean" }
  ];

  for (const s of settingsToSeed) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {
        name: s.name,
        value: s.value,
        category: s.category,
        notes: s.notes,
        type: s.type
      },
      create: s
    });
  }

  console.log('Seeded System Settings successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
