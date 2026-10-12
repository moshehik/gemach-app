import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { getAllCachedSettings, invalidateSettingsCache } from '@/lib/settingsCache';
import { writeSystemSetting } from '@/lib/systemSettingWrite';
import { buildStageSettingsView, buildStageWrites, HORIZON_KEY } from '@/lib/schedule/stageSettings';
import { isMultiBranchEnabled } from '@/lib/branches';
import { invalidateBranchNeedsCache } from '@/lib/branchNeedsServer';

export const dynamic = 'force-dynamic';

// "הגדרות תהליכים" של הלו"ז (החלון שנפתח מגלגל השיניים בדף הלו"ז ומשורת "לו״ז" בהגדרות): כמה ימים לפני / אחרי האירוע כל שלב, פעיל או כבוי,
// משמרת, וטווח התראת ההעברה בין סניפים. החלטה B3 (docs/schedule-page-logic-spec.md): רק הנהלה ראשית / מתכנת כותבים (כמו POST /api/settings);
// קריאה - מי שפתוח לו הלו"ז (page:schedule). המפתחות schedule_stage_<key>_* נקראים ב-lib/schedule/settings.js; שורה חסרה = ברירת המחדל.
const CATEGORY = 'יומן';
const META = {
  enabled: { name: (l) => `לו"ז - ${l} פעיל`, type: 'boolean' },
  days: { name: (l) => `לו"ז - ${l}: ימי עסקים מהאירוע`, type: 'number' },
  shift: { name: (l) => `לו"ז - ${l}: משמרת`, type: 'text' },
};

async function loadMap() {
  const rows = (await getAllCachedSettings()) || [];
  const map = {};
  for (const r of rows) if (r && r.key) map[r.key] = r.value;
  return map;
}

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenPage('page:schedule'))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const map = await loadMap();
    const view = buildStageSettingsView(map);
    return NextResponse.json({ ...view, multiBranch: isMultiBranchEnabled(map), canEdit: !!(await checkAuth('הנהלה ראשית')) });
  } catch (error) {
    console.error('Error loading schedule settings:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הגדרות הלו"ז' }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'רק הנהלה ראשית משנה את הגדרות הלו"ז' }, { status: 401 });
  try {
    const body = await request.json();
    const map = await loadMap();
    const res = buildStageWrites(body, map);
    if (!res.ok) return NextResponse.json({ error: res.errors.join('\n'), errors: res.errors }, { status: 400 });
    const labelOf = (key) => (buildStageSettingsView({}).stages.find((s) => s.key === key) || {}).label || key;
    let changed = 0;
    for (const [key, value] of Object.entries(res.writes)) {
      let meta;
      if (key === HORIZON_KEY) meta = { name: 'התראת העברה בין סניפים - טווח ימים קדימה', category: 'סניפים', type: 'number' };
      else {
        const m = /^schedule_stage_([a-z]+)_(enabled|days|shift)$/.exec(key);
        const f = m ? META[m[2]] : null;
        meta = f ? { name: f.name(labelOf(m[1])), category: CATEGORY, type: f.type } : {};
      }
      if (await writeSystemSetting(key, value, meta)) changed++;
    }
    invalidateSettingsCache();
    invalidateBranchNeedsCache();
    const fresh = buildStageSettingsView(await loadMap());
    return NextResponse.json({ success: true, changed, ...fresh });
  } catch (error) {
    console.error('Error saving schedule settings:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הגדרות הלו"ז' }, { status: 500 });
  }
}
