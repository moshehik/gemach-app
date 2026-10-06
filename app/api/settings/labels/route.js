import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { getAllCachedSettings, getCachedSetting, invalidateSettingsCache } from '@/lib/settingsCache';
import { checkAuth } from '@/lib/auth';
import { cachedJson } from '@/lib/httpCache';

export const dynamic = 'force-dynamic';

// GET is intentionally left public: app/components/LabelsContext.js fetches
// this on every page mount (including public/pre-login pages such as
// app/customer-interface) to resolve UI label text. Writing labels is
// admin-only (see POST below).
export async function GET(request) {
  try {
    const setting = await getCachedSetting('ui_labels_mapping');

    // CPU phase 1B: private, max-age=60, swr=300 + ETag/304 (lib/httpCache.js). הכתיבה (POST למטה) מבטלת את מטמון השרת; מטמון האפליקציה (apiCache)
    // קורא no-store ולכן רואה את התוויות החדשות מיד.
    if (!setting || !setting.value) {
      return cachedJson(request, {});
    }

    return cachedJson(request, JSON.parse(setting.value));
  } catch (error) {
    console.error('Error fetching UI labels:', error);
    return NextResponse.json({}, { status: 500 });
  }
}

export async function POST(req) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }
  try {
    const labels = await req.json();

    const value = JSON.stringify(labels);

    await prisma.systemSetting.upsert({
      where: { key: 'ui_labels_mapping' },
      update: { value, name: 'כיתובי מערכת (UI)', category: 'ui_label' },
      create: { 
        key: 'ui_labels_mapping', 
        value, 
        name: 'כיתובי מערכת (UI)', 
        category: 'ui_label',
        type: 'json'
      }
    });

    // ui_labels_mapping is part of the GET /api/settings list (30s server cache) - drop it so the next read sees the new labels
    invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error saving UI labels:', error);
    return NextResponse.json({ error: 'Failed to save UI labels' }, { status: 500 });
  }
}