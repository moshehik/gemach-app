import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenAnyPage, canOpenPage } from '@/lib/permissions';
import { MODEL_CARD_PAGE_KEY, PANEL_PAGE_KEYS, PERSON_PAGE_KEYS, resolvePanel } from '@/lib/searchPanel';

// GET /api/search-panel?q=<מה שהוקלד>[&model=<קידומת דגם>][&size=<מידה>][&view=where]
// view=where: "איפה אני?" / "איפה המידה שלי?" - שורה לכל ברקוד של הדגם (+מידה) עם המיקום הנוכחי שלו (אצל משפחה / מחסן / רזרבה / תיקון...).
// פאנל התפוסה / הפריט של החיפוש הראשי והמהיר (docs/search-capacity-embed.md): ברקוד מלא של פריט = סטטוס / פעמים שהושכר / הזמנות שחייבות אותו;
// קוד דגם / ברקוד חלקי / דגם+מידה(+תאריך) = מלאי / בתפוסה / רזרבה. פענוח הקלט ב-lib/searchIntent.js (אותו קוד בדפדפן ובשרת).
// קריאה בלבד. הרשאות מוכרעות כאן: בלי page:orders / page:rentals אין פאנל ({ panel: null, reason: 'forbidden' } ולא 403 - הלקוח קורא לנתיב אוטומטית בזמן הקלדה);
// שם משפחה וטלפון של לקוחה נשלחים לכל מי שמקבלת את הפאנל (page:orders / page:rentals; לא נדרשת הרשאת לקוחות); קישור לכרטיס הדגם רק עם page:dresses_catalog.
export const dynamic = 'force-dynamic';

const json = (body, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  try {
    const sp = new URL(request.url).searchParams;
    const q = (sp.get('q') || '').slice(0, 200);
    if (!q.trim()) return json({ panel: null, reason: 'no-intent' });
    if (!(await canOpenAnyPage(PANEL_PAGE_KEYS))) return json({ panel: null, reason: 'forbidden' });
    const modelParam = sp.get('model');
    const model = modelParam && /^\d{1,9}$/.test(modelParam) ? Number(modelParam) : null;
    const sizeParam = (sp.get('size') || '').trim();
    const size = sizeParam && sizeParam.length <= 12 ? sizeParam : null;
    const [person, modelCard] = await Promise.all([canOpenAnyPage(PERSON_PAGE_KEYS), canOpenPage(MODEL_CARD_PAGE_KEY)]);
    const view = sp.get('view') === 'where' ? 'where' : 'panel';
    return json(await resolvePanel(q, { model, size, view, perms: { person, modelCard } }));
  } catch (error) {
    console.error('GET /api/search-panel error:', error);
    return json({ error: 'שגיאה בפאנל החיפוש' }, 500);
  }
}
