// lib/policyQuestionnaire/common-bank.js - מאגר השאלות המשותף לשני הגמחים (נתונים בלבד).
// PLACEHOLDER: יוחלף בתוכן האמיתי (common-bank.json) לפני הסיום.
// today_he: null = אין הבדל בין הגמחים; {main, neve} = "איך זה עובד היום" בכל גמ"ח (מידע בלבד, לא אפשרות בחירה).

export const COMMON_BANK = {
  intro_he: 'השאלון עוסק בכללי ביטול, החלפה, החזר כספי וזיכוי ב{gmach}.',
  sections: [
    {
      title_he: 'ביטול שמלה מתוך הזמנה',
      intro_he: '',
      questions: [
        {
          id: 'c1.1', kind: 'single', text_he: 'כמה מקבלת הלקוחה בחזרה כשהיא מבטלת שמלה בזמן שיש החזר?',
          example_he: 'שמלה במחיר 100 ₪ בוטלה.', today_he: null,
          options_he: ['חצי מהמחיר, 50%', 'מלוא המחיר, 100%'], allowOther: true,
        },
        {
          id: 'c1.2', kind: 'multi', text_he: 'מי רשאית לאשר החזר?',
          example_he: 'ביטול שמלה יצר בקשת החזר.', today_he: { main: 'לא מוגבל להנהלה ראשית.', neve: 'מוגבל להנהלה ראשית.' },
          options_he: ['כל עובדת', 'מנהלת סניף', 'הנהלה ראשית', 'אף אחת'], exclusive: [3], allowOther: true,
        },
        {
          id: 'c1.3', kind: 'single', text_he: 'האם מאפשרים קיזוז זיכוי?',
          example_he: 'ללקוחה יש זיכוי של 50 ₪.', today_he: null,
          options_he: ['אוטומטי', 'שואלים בכל פעם', 'אף פעם'], allowOther: true,
        },
        {
          id: 'c1.4', kind: 'single', text_he: 'מה קורה עם יתרת הזיכוי?',
          example_he: 'זיכוי של 90 ₪ מול חיוב של 40 ₪.', today_he: null,
          options_he: ['נשארת לקיזוז הבא', 'מוחזרת בבנק'], allowOther: true,
          showIf: { questionId: 'c1.3', anyOf: [0, 1] },
        },
        {
          id: 'c1.5', kind: 'single', text_he: 'האם חובה לכתוב סיבה כשמשנים סכום החזר?',
          example_he: 'שינוי ידני של סכום.', today_he: null,
          options_he: ['כן, תמיד', 'לא'], allowOther: true,
          showIf: { questionId: 'c1.2', anyOf: [0, 1, 2] },
        },
      ],
    },
  ],
};
