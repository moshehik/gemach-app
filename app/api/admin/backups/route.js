import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';

// גיבוי ענני לדרייב (ר' BACKUPS.md + scripts/cloud_backup.js) - מסך /admin/backups
// קורא מכאן את ההגדרות הנוכחיות (backup_enabled/backup_interval_hours/
// backup_drive_folder_id/backup_owner_email) ואת רשימת הריצות (BackupRun) לתצוגת
// הרשימה + לוג התקלות. הכתיבה בפועל (הדאמפ עצמו) קורית רק ב-GitHub Actions.
export const dynamic = 'force-dynamic';

const SETTING_KEYS = ['backup_enabled', 'backup_interval_hours', 'backup_drive_folder_id', 'backup_owner_email'];

export async function GET() {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
  try {
    const [settingRows, runs] = await Promise.all([
      prisma.systemSetting.findMany({ where: { key: { in: SETTING_KEYS } } }),
      prisma.backupRun.findMany({ orderBy: { startedAt: 'desc' }, take: 60 }),
    ]);

    const settings = {
      backup_enabled: settingRows.find((s) => s.key === 'backup_enabled')?.value !== 'false',
      backup_interval_hours: Number(settingRows.find((s) => s.key === 'backup_interval_hours')?.value) || 24,
      backup_drive_folder_id: settingRows.find((s) => s.key === 'backup_drive_folder_id')?.value || '',
      backup_owner_email: settingRows.find((s) => s.key === 'backup_owner_email')?.value || '',
    };

    return NextResponse.json({ settings, runs });
  } catch (error) {
    console.error('Error fetching backups:', error);
    return NextResponse.json({ error: 'Failed to fetch backups' }, { status: 500 });
  }
}
