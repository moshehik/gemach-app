import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getScheduleRangeSummary } from '@/lib/schedule/range';

export const dynamic = 'force-dynamic';
// עד 30 ימים × שאילתות הלו״ז היומי (4 במקביל) + התעוררות קרה של Neon - 60 שניות כמו נתיב החיפוש לפי קיבולת
// (app/api/a5/adv-b). בפועל: כמה שניות; הלקוח מציג את הלוח מיד ומשלים את המונים כשהתשובה מגיעה.
export const maxDuration = 60;

// GET /api/board/stages?from=YYYY-MM-DD&to=YYYY-MM-DD[&branch=] — מונים לפי שלב לכל יום בטווח, ללוח החודשי (/board):
// { from, to, today, stages:[{key,number,label,plural,enabled,infoOnly}], days:{ [YYYY-MM-DD]: { s:{ [stageKey]:{t,a} },
// alerts, nonWorkingDay } }, truncated, canOpenSchedule }. מספרים בלבד - אף שורה, שם או טלפון לא יוצאים מכאן.
// שער: התחברות + page:board (אותו פריט כמו הדף, app/board/layout.js). canOpenSchedule = האם לחיצה על יום בלוח
// יכולה לפתוח את הלו״ז היומי (page:schedule) - אחרת הלוח פותח את חלון "הזמנות ליום" במקומו.
// הנתונים מחושבים ע"י getScheduleDay לכל יום (lib/schedule/range.js) - אותם מונים בדיוק כמו בציר של /schedule.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenPage('page:board'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from') || '';
    const to = searchParams.get('to') || '';
    const branch = (searchParams.get('branch') || '').slice(0, 100);
    const [result, canOpenSchedule] = await Promise.all([
      getScheduleRangeSummary({ from, to, branch }),
      canOpenPage('page:schedule').catch(() => false),
    ]);
    return NextResponse.json({ ...result, canOpenSchedule: !!canOpenSchedule }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error && error.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('GET /api/board/stages error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת מוני הלוח' }, { status: 500 });
  }
}
