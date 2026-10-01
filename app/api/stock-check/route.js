import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { checkStock, StockCheckError } from '@/lib/stockCheck';

// GET /api/stock-check?date=YYYY-MM-DD&model=<שם או קידומת>&sizes=12,36&flex=12
// בדיקת מלאי לתאריך (דף "בדיקת מלאי"). קריאה בלבד; הלוגיקה כולה ב-lib/stockCheck.js.
// GET ולא POST: כמו שאר נתיבי החיפוש (app/api/a5/adv-b, /api/dresses?eventDate=) - קריאה
// טהורה שהלקוח יכול לשמור במטמון המשותף (lib/apiCache.js, שם הנתיב רשום לביטול אחרי
// כל שינוי בהזמנות/השכרות/החזרות/שמלות). סדר הפרמטרים הוא חלק ממפתח המטמון - הלקוח
// בונה תמיד: date, model, sizes, flex.
//
// פרמטרים:
//   date   חובה, 'YYYY-MM-DD' (היום הקלנדרי בישראל; בורר התאריך העברי ממיר בצד הלקוח)
//   model  אופציונלי, ניתן לחזור עליו (?model=549&model=תחרה) - שם דגם או קידומת ברקוד
//   sizes  אופציונלי, מופרד בפסיקים
//   flex   אופציונלי: 'all' או רשימת מידות (מתוך sizes) שנבדקות ±2
//   חובה model או sizes (או שניהם).
//
// הרשאה: מחובר (checkAuth) + page:orders - אותו שער כמו בדיקת "תפוסה" לפי דגם/מידה/תאריך
// בחיפוש המתקדם (app/api/a5/adv-b/route.js, GATE.capacity). כשיוחלט על פריט קטלוג
// ייעודי (page:stock_check) משנים רק את הקבוע כאן.
export const dynamic = 'force-dynamic';
// בדיקה לפי מידה בלבד עוברת על כל הדגמים (מלאי + הזמנות ±14 יום) - בקריאה קרה מול Neon
// זה יכול לעבור את 10 השניות של ברירת המחדל ב-Hobby.
export const maxDuration = 30;

export const STOCK_CHECK_PAGE_KEY = 'page:orders';

const json = (body, status = 200) => NextResponse.json(body, { status });
const splitList = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage(STOCK_CHECK_PAGE_KEY))) return json({ error: 'Forbidden' }, 403);
  try {
    const sp = new URL(request.url).searchParams;
    const models = sp.getAll('model').flatMap(splitList);
    const sizes = splitList(sp.get('sizes'));
    const flexRaw = (sp.get('flex') || '').trim();
    const flexible = flexRaw === 'all' ? true : splitList(flexRaw);

    const result = await checkStock({ date: (sp.get('date') || '').trim(), models, sizes, flexible });
    return json({
      ...result,
      // קישור לכרטיס הדגם (הנתיב הזה דורש את ה-UUID); לתצוגה משתמשים ב-modelCode/modelName
      results: result.results.map((r) => ({ ...r, link: `/dashboard/dresses/${r.modelId}` })),
    });
  } catch (error) {
    if (error instanceof StockCheckError) return json({ error: error.message, code: error.code }, error.status);
    console.error('GET /api/stock-check error:', error);
    return json({ error: 'שגיאה בבדיקת המלאי' }, 500);
  }
}
