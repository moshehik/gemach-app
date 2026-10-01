import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getScheduleDay } from '@/lib/schedule';
import { isValidKey } from '@/lib/schedule/dates';

export const dynamic = 'force-dynamic';
// כמה שאילתות Neon ברצף + התעוררות קרה של ה-DB עלולות לעבור את 10 השניות של ברירת המחדל ב-Hobby;
// 30 שניות מספיקות (הנתיב לא פונה ל-Apps Script/Drive, שם הכלל הוא 60 - CLAUDE.md, Standing rules).
export const maxDuration = 30;

// GET /api/schedule?date=YYYY-MM-DD[&branch=...] — הלו״ז היומי: הפריטים של אותו יום לכל שלב, מונים,
// התראות שורה, מי במשמרת. קריאה בלבד (שלב 1 של הבנייה) - "סימון בוצע" אינו כאן.
// חוזה התשובה: docs/schedule-page-logic-spec.md. שער: התחברות + page:schedule (lib/permissionsMetadata.js),
// אותו דפוס כמו app/api/a5/adv-b/route.js (canOpenPage בתוך ה-API, לא רק ב-layout).
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenPage('page:schedule'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    if (date && !isValidKey(date)) {
      return NextResponse.json({ error: 'תאריך לא תקין - נדרש YYYY-MM-DD' }, { status: 400 });
    }
    const branch = searchParams.get('branch') || '';
    const user = await getSessionEmployee();
    const result = await getScheduleDay({ date: date || undefined, branch, user });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error && error.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('GET /api/schedule error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הלו״ז היומי' }, { status: 500 });
  }
}
