// GET /api/admin/station-analytics?from=YYYY-MM-DD&to=YYYY-MM-DD&channel=public|kiosk|all&windowDays=14[&fresh=1]
// מדדי ההמרה של העמדה הציבורית (משפך, סדרה יומית, כרטיסי היום): אגרגטים בלבד, בלי PII. שער: הנהלה ראשית / מתכנת (כמו שאר /api/admin/*), והדף עצמו ב-app/admin/layout.js.
// התאריכים הם ימי לוח בשעון ישראל. מטמון שרת של דקה (fresh=1 עוקף). ההגדרות המלאות: docs/station-analytics.md.
import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { parseParams } from '@/lib/stationAnalytics/service';
import { getStationAnalytics } from '@/lib/stationAnalytics/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    const sp = new URL(request.url).searchParams;
    const parsed = parseParams(Object.fromEntries(sp.entries()));
    if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const data = await getStationAnalytics(parsed.params, { fresh: sp.get('fresh') === '1' });
    return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('admin station-analytics failed:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת המדדים' }, { status: 500 });
  }
}
