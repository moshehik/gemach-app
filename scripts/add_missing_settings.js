const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addMissingSettings() {
  const missingSettings = [
    { key: 'hide_internal_messaging', name: 'הסתר הודעות פנימיות', category: 'תצוגה', notes: 'הסתרת פעמון ההתראות והודעות הפנים לעובדים.', type: 'boolean', value: 'false' },
    { key: 'enable_ai_specific_employees', name: 'AI לעובדים מורשים בלבד', category: 'כללי', notes: 'הצגת תכונות AI רק לעובדים שסומנו לכך.', type: 'boolean', value: 'false' },
    { key: 'print_rental_box1', name: 'הדפסה - תיבה 1', category: 'הדפסות', notes: 'טקסט מותאם לתיבת ההערות הראשונה בהדפסת הזמנה.', type: 'text', value: '' },
    { key: 'print_rental_box2', name: 'הדפסה - תיבה 2', category: 'הדפסות', notes: 'טקסט מותאם לתיבת ההערות השניה בהדפסת הזמנה.', type: 'text', value: '' },
    { key: 'print_rental_footer', name: 'הדפסה - כותרת תחתונה', category: 'הדפסות', notes: 'טקסט מותאם לתחתית טופס הזמנה.', type: 'text', value: '' },
    { key: 'REFUND_DAYS_FROM_ORDER', name: 'ימי החזר מלא ממועד הזמנה', category: 'תשלומים', notes: 'מספר הימים מיום ההזמנה שבהם מגיע ללקוח 100% החזר בביטול.', type: 'number', value: '7' },
    { key: 'NO_REFUND_DAYS_BEFORE_EVENT', name: 'ללא החזר סמוך לאירוע (ימים)', category: 'תשלומים', notes: 'ביטול בסמוך לאירוע (בימים) לא יקבל החזר.', type: 'number', value: '7' },
    { key: 'REFUND_REPAIRS', name: 'החזר דמי תיקונים בביטול', category: 'תשלומים', notes: 'האם להחזיר תשלום שנגבה על תיקונים במקרה של ביטול ההזמנה.', type: 'boolean', value: 'false' },
    { key: 'CANCELLATION_CREDIT_MINUTES', name: 'דקות לניצול זיכוי דמי ביטול על פריט חלופי', category: 'תשלומים', notes: 'מספר הדקות לאחר ביטול פריט שבהן ניתן לנצל את דמי הביטול כזיכוי על פריט אחר שנוסף לאותה הזמנה.', type: 'number', value: '15' },
    { key: 'inventory_include_warehouse', name: 'הכלל מחסן במלאי פנוי', category: 'מאגר', notes: 'האם פריטים בסטטוס מחסן/רזרבה ייחשבו כזמינים להשכרה.', type: 'boolean', value: 'false' },
    { key: 'inventory_buffer_days', name: 'ימי מרווח (Buffer)', category: 'יומן', notes: 'מספר ימים לפני ואחרי אירוע שהפריט חסום.', type: 'number', value: '3' },
    { key: 'inventory_skip_weekends', name: 'דלג על סופ"ש בחישוב מלאי', category: 'יומן', notes: 'האם לדלג על שישי-שבת בספירת ימי המרווח.', type: 'boolean', value: 'true' },
    { key: 'enable_alterations', name: 'אפשר מערכת תיקונים', category: 'הזמנות', notes: 'מפעיל את אפשרויות התיקונים במערכת ההזמנות (מחליף את allow_alterations).', type: 'boolean', value: 'true' }
  ];

  let added = 0;
  for (const s of missingSettings) {
    const exists = await prisma.systemSetting.findUnique({ where: { key: s.key } });
    if (!exists) {
      await prisma.systemSetting.create({
        data: s
      });
      added++;
      console.log(`Added missing setting: ${s.key}`);
    }
  }

  // Handle allow_alterations vs enable_alterations discrepancy
  const allowAlt = await prisma.systemSetting.findUnique({ where: { key: 'allow_alterations' } });
  if (allowAlt) {
    console.log('Migrating allow_alterations to enable_alterations');
    await prisma.systemSetting.update({
      where: { key: 'enable_alterations' },
      data: { value: allowAlt.value }
    });
    await prisma.systemSetting.delete({ where: { key: 'allow_alterations' } });
  }

  console.log(`Successfully added ${added} settings.`);
}

addMissingSettings()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
