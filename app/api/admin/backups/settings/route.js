import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { invalidateSettingsCache } from '@/lib/settingsCache';
import { validateNumericSetting } from '@/app/lib/settingsValidation';

export const dynamic = 'force-dynamic';

const SETTING_META = {
  backup_enabled: { name: 'גיבוי אוטומטי לדרייב פעיל', category: 'גיבויים', type: 'boolean' },
  backup_interval_hours: { name: 'תדירות גיבוי אוטומטי (שעות)', category: 'גיבויים', type: 'number' },
  backup_drive_folder_id: { name: 'שם תיקיית דרייב לגיבויים', category: 'גיבויים', type: 'text' },
  backup_owner_email: { name: 'כתובת מייל לצפייה בגיבויים', category: 'גיבויים', type: 'text' },
};

export async function PUT(request) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { backup_enabled, backup_interval_hours, backup_drive_folder_id, backup_owner_email } = body || {};

    if (backup_interval_hours !== undefined) {
      const validationError = validateNumericSetting('backup_interval_hours', backup_interval_hours);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }
    }
    if (backup_owner_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(backup_owner_email)) {
      return NextResponse.json({ error: 'כתובת מייל לא תקינה.' }, { status: 400 });
    }

    const updates = { backup_enabled, backup_interval_hours, backup_drive_folder_id, backup_owner_email };
    const upserts = Object.entries(updates)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        prisma.systemSetting.upsert({
          where: { key },
          update: { value: String(value) },
          create: { key, value: String(value), ...SETTING_META[key] },
        })
      );

    await Promise.all(upserts);
    invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving backup settings:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
