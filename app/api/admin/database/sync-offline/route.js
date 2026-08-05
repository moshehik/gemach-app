import { NextResponse } from 'next/server';
import { syncOfflineChangesIfAny } from '@/app/lib/prisma';

// Manually kicks off the offline->cloud reconciliation (see lib/offlineSync.js and
// app/lib/prisma.js). This exists because IS_OFFLINE_MODE is a process env var that
// only takes effect on server restart - so the automatic sync-on-startup in
// app/lib/prisma.js covers "staff restarted the app with internet back", but not
// "internet came back while the server process kept running". This lets staff (or the
// admin `/admin/database` page) trigger the same reconciliation on demand instead of
// having to restart the server.
export async function POST() {
  if (process.env.IS_OFFLINE_MODE === 'true') {
    return NextResponse.json(
      { error: 'המערכת עדיין במצב אופליין (IS_OFFLINE_MODE=true) - יש לצאת ממצב אופליין ולהפעיל מחדש לפני הסנכרון.' },
      { status: 400 }
    );
  }

  const logs = [];
  try {
    const summary = await syncOfflineChangesIfAny({ log: (m) => logs.push(m) });
    if (!summary) {
      return NextResponse.json({
        success: true,
        synced: 0,
        failed: 0,
        message: 'אין נתוני אופליין ממתינים לסנכרון (או שמעולם לא נעשה שימוש במצב אופליין במחשב זה).',
        logs,
      });
    }
    return NextResponse.json({
      success: summary.totalFailed === 0,
      synced: summary.totalSynced,
      failed: summary.totalFailed,
      details: summary.results,
      message: summary.totalSynced > 0
        ? `סונכרנו ${summary.totalSynced} רשומות לענן בהצלחה${summary.totalFailed > 0 ? `, ${summary.totalFailed} נכשלו (ראה לוג)` : ''}.`
        : 'אין רשומות חדשות לסנכרון - הכל כבר מסונכרן.',
      logs,
    });
  } catch (error) {
    console.error('[offline-sync] manual trigger failed:', error);
    return NextResponse.json({ error: `שגיאה בסנכרון: ${error.message}`, logs }, { status: 500 });
  }
}
