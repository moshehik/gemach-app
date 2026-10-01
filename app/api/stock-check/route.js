import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { checkStock, StockCheckError, STOCK_CHECK_PAGE_KEY, MODEL_CARD_PAGE_KEY, MODEL_CARD_PATH } from '@/lib/stockCheck';

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
// הרשאה: מחובר (checkAuth) + page:orders (STOCK_CHECK_PAGE_KEY ב-lib/stockCheck.js; החלטת הבעלים GQ-06a) - אותו
// שער כמו בדיקת "תפוסה" לפי דגם/מידה/תאריך בחיפוש המתקדם (app/api/a5/adv-b/route.js, GATE.capacity).
// results[].link (כרטיס הדגם, page:dresses_catalog) נשלח רק למי שרשאית לפתוח את הכרטיס - אחרת השדה חסר והדף מציג שורה בלי קישור.
export const dynamic = 'force-dynamic';
// בדיקה לפי מידה בלבד עוברת על כל הדגמים (מלאי + הזמנות ±14 יום) - בקריאה קרה מול Neon
// זה יכול לעבור את 10 השניות של ברירת המחדל ב-Hobby.
export const maxDuration = 30;

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
    const canOpenCard = result.results.length ? await canOpenPage(MODEL_CARD_PAGE_KEY) : false;
    return json({
      ...result,
      // קישור לכרטיס הדגם (הנתיב הזה דורש את ה-UUID); לתצוגה משתמשים ב-modelCode/modelName
      results: result.results.map((r) => (canOpenCard ? { ...r, link: `${MODEL_CARD_PATH}${r.modelId}` } : r)),
    });
  } catch (error) {
    if (error instanceof StockCheckError) return json({ error: error.message, code: error.code }, error.status);
    console.error('GET /api/stock-check error:', error);
    return json({ error: 'שגיאה בבדיקת המלאי' }, 500);
  }
}
