import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { createHash } from 'node:crypto';
import { getScheduleRangeSummary } from '@/lib/schedule/range';
import { createRangeCache, rangeCacheKey } from '@/lib/schedule/rangeCache';

// מטמון 45 שניות (ממצא הסקירה 2) - על globalThis כדי לשרוד HMR בפיתוח. זהות ה-DB = גיבוב כתובת ה-DB של הפריסה (כל גמ"ח =
// פריסה ו-DB נפרדים) + מצב PROD/TEST של app/lib/prisma.js (.active-db בפיתוח, web_backup_mode באתר), כך שתשובה של מסד אחד
// לעולם לא מוגשת ממסד אחר.
const cache = (globalThis.__boardStagesCache ||= createRangeCache());
function dbTag() {
  const url = process.env.DATABASE_URL || '';
  const h = createHash('sha256').update(url).digest('hex').slice(0, 16);
  return h + ':' + (globalThis.activeDbMode || 'prod') + ':' + ((globalThis.webDbModeState && globalThis.webDbModeState.mode) || 'prod');
}

export const dynamic = 'force-dynamic';
// עד 30 ימים × שאילתות הלו״ז היומי (4 במקביל) + התעוררות קרה של Neon - 60 שניות כמו נתיב החיפוש לפי קיבולת
// (app/api/a5/adv-b). בפועל: כמה שניות; הלקוח מציג את הלוח מיד ומשלים את המונים כשהתשובה מגיעה.
export const maxDuration = 60;

// GET /api/board/stages?from=YYYY-MM-DD&to=YYYY-MM-DD[&branch=][&fresh=1] — מונים לפי שלב לכל יום בטווח, ללוח החודשי (/board):
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
    const fresh = searchParams.get('fresh') === '1'; // אחרי סגירת חלון ההשכרה - חישוב מחדש (ונשמר)
    const key = rangeCacheKey({ dbTag: dbTag(), host: request.headers.get('host') || '', from, to, branch });
    const cached = fresh ? null : cache.get(key);
    const [result, canOpenSchedule] = await Promise.all([
      cached ? Promise.resolve(cached) : getScheduleRangeSummary({ from, to, branch }).then((r) => { cache.set(key, r); return r; }),
      canOpenPage('page:schedule').catch(() => false),
    ]);
    return NextResponse.json({ ...result, canOpenSchedule: !!canOpenSchedule }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error && error.status === 400) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('GET /api/board/stages error:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת מוני הלוח' }, { status: 500 });
  }
}
