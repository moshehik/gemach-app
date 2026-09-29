import { NextResponse } from 'next/server';
import { checkAuth, getSessionEmployee } from '@/lib/auth';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { buildSettingsGuide } from '@/lib/settingsMetadata';
import { NUMBER_FIELD_LIMITS } from '@/app/lib/settingsValidation';

// הגדרה בודדת לחלון ההגדרה המהירה של /a5. קריאה בלבד.
// GET /api/a5/settings?key=<מפתח> -> { setting: {key,name,category,location,pagePath,description,fieldType,currentValue,options?,limits?} }
// שונה מ-/api/settings/guide בכוונה רק בהרשאה: שם נדרש roleId 1/2, כאן גם הנהלה ראשית (0) - כמו האב-טיפוס
// (הנהלה ראשית ומנהלת סניף מורשות). השמירה עצמה נשארת ב-POST /api/settings (הנהלה ראשית/מתכנת או אישור מנהל).
export const dynamic = 'force-dynamic';

export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const me = await getSessionEmployee();
  if (!me || ![0, 1, 2].includes(me.roleId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const key = new URL(request.url).searchParams.get('key') || '';
    const rows = await getAllCachedSettings();
    const found = buildSettingsGuide(rows).find((s) => s.key === key);
    if (!found) return NextResponse.json({ error: 'not found' }, { status: 404 });
    const limits = NUMBER_FIELD_LIMITS[key] || null;
    return NextResponse.json({ setting: limits ? { ...found, limits } : found });
  } catch (error) {
    console.error('a5 settings error:', error);
    return NextResponse.json({ error: 'Failed to load setting' }, { status: 500 });
  }
}
