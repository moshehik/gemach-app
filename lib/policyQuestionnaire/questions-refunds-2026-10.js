// lib/policyQuestionnaire/questions-refunds-2026-10.js - שאלון "זיכויים וביטולים" להנהלות (אוקטובר 2026).
//
// שאלון אחד משותף לשני הגמחים: אותן שאלות, אותם מזהים ואותן אפשרויות (common-bank.js). הגמ"ח משנה רק את הכותרת (שם הגמ"ח)
// ואת שורת המידע "איך זה עובד היום" (today_he) - מידע בלבד שמוצג מעל האפשרויות, לא אפשרות בחירה.
// כל שאלה היא "מבחן אמריקאי": kind 'single' (אפשרות אחת) או 'multi' (אפשר לסמן כמה), ועוד "אחר" עם תיבת טקסט ו"עדיין לא החלטנו" (מתווספות אוטומטית).
// כל גמ"ח שומר את התשובות שלו במסד שלו (שרשור דיווח-תקלה משלו), ולכן לכל גמ"ח התשובות והדף משלו.
//
// כללים:
//  - המזהים (id) יציבים: התשובות השמורות (בשרשור דיווח-התקלה של השאלון, כטקסט "<מזהה> <שאלה> / תשובה: <נוסח האפשרות>") נקראות חזרה לפיהם.
//    שינוי ניסוח השאלה = בסדר; שינוי/מחיקת מזהה = איבוד תשובות.
//  - נוסח האפשרות הוא מה שנכתב בשרשור ונקרא חזרה: אחרי שהתחילו לענות אין לשנות נוסח של אפשרות קיימת ולא את סדר האפשרויות
//    (showIf ו-exclusive מצביעים על אינדקס); אפשר להוסיף בסוף.
//  - showIf: { questionId, anyOf: [אינדקסים] } - השאלה מוצגת רק כשהתשובה לשאלה האחרת היא אחת האפשרויות האלה (בשאלה מרובת-בחירה: כשסומנה אחת מהן).
//  - exclusive: [אינדקסים] בשאלה מרובת-בחירה - אפשרויות שאי אפשר לשלב עם אחרות (למשל "אף אחת").
//  - today_he בקובץ הנתונים: null (אין הבדל בין הגמחים) או { main, neve }; ל-getQuestionnaire מגיע כטקסט אחד לפי הגמ"ח.
//  - אין כאן שמות של עובדות/מנהלות, מספרי הזמנות או מזהי דיווח (הבדיקה האוטומטית תופסת).

import { ORG_MAIN, ORG_NEVE_YAAKOV } from '../orgIdentity.js';
import { COMMON_BANK } from './common-bank.js';

/** מפתח הסבב. סבב חדש = מפתח חדש = שרשור תשובות חדש (ר' threadMarker ב-logic.js). */
export const QUESTIONNAIRE_KEY = 'refunds-2026-10b';

const GMACH_NAMES = { org1: 'מכובד', org2: 'נווה יעקב' };
const TODAY_KEYS = { org1: 'main', org2: 'neve' };

/**
 * נושאים שנבדקו ולא נכנסו לשאלון (בכוונה) - רק נושאים טכניים או כאלה שהוחלטו וממתינים לבנייה.
 * כל שאר נושאי הביטולים, ההחלפות, ההחזרים והזיכויים נכללים בשאלון.
 */
export const OMITTED_TOPICS = [
  {
    topic_he: 'לפי איזה רגע נקבעת מדרגת הזמן (רגע הביטול או רגע חישוב מחדש)',
    reason_he: 'נושא טכני של התוכנה, אין צורך שההנהלה תענה.',
  },
  {
    topic_he: 'אישור מנהלת או תעודת זהות בעת ביטול או הוספת פריט בהזמנה קיימת',
    reason_he: 'בקרות והרשאות של התוכנה, והחלטה כבר התקבלה. לא שאלה עסקית.',
  },
  {
    topic_he: 'שחזור הזמנה שנמחקה, גם כשכבר בוצע החזר כספי',
    reason_he: 'כבר התקבלה תשובה (אזהרה עם אישור מנהלת), ונשאר רק לבנות.',
  },
  {
    topic_he: 'כפתור משלוח אחד שמסמן גם שההזמנה היא משלוח',
    reason_he: 'בקשת תהליך בתוכנה ולא מדיניות ביטול או החזר.',
  },
  {
    topic_he: 'מידה שבין שני טווחי מחיר ומחיר ההחלפה בה',
    reason_he: 'נושא של מחירון ולא של החזר או ביטול.',
  },
  {
    topic_he: 'ימי זכאות להחזר אחרי תאריך האירוע (הגדרה ישנה שלא בשימוש)',
    reason_he: 'הגדרה ישנה בתוכנה, לא החלטת מדיניות.',
  },
  {
    topic_he: 'שאלות שימוש בתוכנה ("איך מעבירים לזיכוי", "איפה מופיעים הזיכויים", עמודת סיבה בדף זיכויים וחובות)',
    reason_he: 'שאלות שימוש שנענו, לא החלטות מדיניות.',
  },
  {
    topic_he: 'תשלום חוב בהזמנה ואישור מנהלת על יציאה בלי תשלום מלא',
    reason_he: 'נושא תשלומים ובקרה, לא ביטול או החזר.',
  },
];

/** מפתח השאלון ('org1' | 'org2') לפי הגמ"ח שמריץ את הקוד (currentOrg). אחר/לא מזוהה = הגמ"ח הראשי. */
export function orgKeyForOrg(org) {
  return org === ORG_NEVE_YAAKOV ? 'org2' : 'org1';
}

/** ה-org ('main' | 'neve-yaakov') ששייך למפתח שאלון. */
export function orgForOrgKey(orgKey) {
  return orgKey === 'org2' ? ORG_NEVE_YAAKOV : ORG_MAIN;
}

/** מפתח "today_he" בקובץ הנתונים לפי מפתח שאלון: 'main' | 'neve'. */
export function todayKeyForOrgKey(orgKey) {
  return TODAY_KEYS[orgKey] || 'main';
}

function buildFor(orgKey) {
  const gmachName = GMACH_NAMES[orgKey];
  const todayKey = TODAY_KEYS[orgKey];
  return {
    orgKey,
    gmachName,
    intro_he: `שאלון על ביטולים, החלפות, החזרים וזיכויים בגמח ${gmachName}. ${String(COMMON_BANK.intro_he || '').split('{gmach}').join(`גמח ${gmachName}`)}`.trim(),
    sections: COMMON_BANK.sections.map((s) => ({
      title_he: s.title_he,
      intro_he: s.intro_he || '',
      questions: s.questions.map((q) => {
        const { today_he: today, ...rest } = q;
        const out = { ...rest, options_he: [...q.options_he] };
        if (Array.isArray(q.exclusive)) out.exclusive = [...q.exclusive];
        if (q.showIf) out.showIf = { questionId: q.showIf.questionId, anyOf: [...q.showIf.anyOf] };
        const line = today && typeof today === 'object' ? today[todayKey] : '';
        if (line) out.today_he = line;
        return out;
      }),
    })),
  };
}

/** השאלון של גמ"ח לפי מפתח ('org1' | 'org2') - או null אם אין. אותן שאלות לשני הגמחים. */
export function getQuestionnaireByOrgKey(orgKey) {
  return GMACH_NAMES[orgKey] ? buildFor(orgKey) : null;
}

/**
 * השאלון של הגמ"ח הנוכחי. org = ערך של currentOrg() מ-lib/orgIdentity.js ('main' | 'neve-yaakov').
 * @returns {{orgKey:string, gmachName:string, intro_he:string, sections:Array}}
 */
export function getQuestionnaire(org) {
  return buildFor(orgKeyForOrg(org));
}
