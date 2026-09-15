import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// "גיבוי מיידי" - מסמן דגל (backup_requested_at) שסקריפט הגיבוי הענני
// (scripts/cloud_backup.js, רץ ב-GitHub Actions) קורא בכל ריצה ומנקה מיד כשהוא
// מטפל בו - ואז מעיר את ה-workflow מיד עם repository_dispatch במקום לחכות ל-cron
// הבא (עד 15 דק'), אותו דפוס בדיוק כמו app/api/error-report/route.js.
export async function POST() {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
  try {
    await prisma.systemSetting.upsert({
      where: { key: 'backup_requested_at' },
      update: { value: new Date().toISOString() },
      create: {
        key: 'backup_requested_at',
        value: new Date().toISOString(),
        name: 'בקשת גיבוי מיידי (פנימי)',
        category: 'גיבויים',
        type: 'text',
      },
    });

    let dispatched = false;
    try {
      const ghToken = process.env.GH_DISPATCH_TOKEN;
      const ghRepo = process.env.GH_DISPATCH_REPO;
      if (ghToken && ghRepo) {
        const res = await fetch(`https://api.github.com/repos/${ghRepo}/dispatches`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ghToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ event_type: 'run-backup-now' }),
        });
        dispatched = res.ok;
      }
    } catch (e) {
      console.error('Failed to trigger instant backup run', e);
    }

    return NextResponse.json({
      success: true,
      message: dispatched
        ? 'בקשת גיבוי מיידי נשלחה - הגיבוי יתחיל תוך דקה-שתיים.'
        : 'בקשת גיבוי מיידי נשמרה - הגיבוי יתחיל בבדיקה האוטומטית הבאה (עד 15 דקות).',
    });
  } catch (error) {
    console.error('Error triggering backup:', error);
    return NextResponse.json({ error: 'Failed to trigger backup' }, { status: 500 });
  }
}
