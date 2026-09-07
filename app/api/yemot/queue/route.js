import { NextResponse } from 'next/server';
import { getAllCachedSettings } from '@/lib/settingsCache';
import { checkAuth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// 10 - תור מזמינים מימות המשיח (שלד בטוח, מותנה ב-yemot_enabled + yemot_queue_view_enabled)
// אם חסר URL/טוקן - מחזיר הודעה ולא נכשל. כבוי = 403.
export async function GET(request) {
  const all = await getAllCachedSettings();
  const enabled = all.find(s => s.key === 'yemot_enabled')?.value === 'true';
  const viewOn = all.find(s => s.key === 'yemot_queue_view_enabled')?.value === 'true';
  if (!enabled || !viewOn) {
    return NextResponse.json({ queue: [], disabled: true, message: 'סנכרון ימות/תור כבוי בהגדרות → סנכרון' });
  }
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const apiUrl = all.find(s => s.key === 'yemot_api_url')?.value || '';
  const token = all.find(s => s.key === 'yemot_api_token')?.value || '';
  if (!apiUrl || !token) {
    return NextResponse.json({ queue: [], message: 'נא להגדיר URL וטוקן ימות בהגדרות → סנכרון' });
  }
  try {
    const url = apiUrl.includes('?') ? `${apiUrl}&token=${encodeURIComponent(token)}` : `${apiUrl}?token=${encodeURIComponent(token)}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json().catch(() => null);
    const queue = Array.isArray(data) ? data : data?.queue || data?.data || [];
    return NextResponse.json({ queue });
  } catch (e) {
    return NextResponse.json({ queue: [], error: e.message });
  }
}
