import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { invalidateSettingsCache } from '@/lib/settingsCache';
import { writeSystemSetting } from '@/lib/systemSettingWrite';
import { loadBranchContext } from '@/lib/branchesServer';
import {
  BANNER_SCOPES, BRANCHES_CONFIG_KEY, BRANCH_LIST_KEY, BRANCH_SETTING_KEYS, MULTI_BRANCH_KEY,
  renamedBranches, sanitizeBranchesInput, settingsFromBranches,
} from '@/lib/branches';

export const dynamic = 'force-dynamic';

// ניהול הסניפים (docs/branches-plan.md, שלב א). קריאה: כל מחובר. כתיבה: הנהלה ראשית / מתכנת בלבד (כמו POST /api/settings).
// הכל נשמר ב-SystemSetting (בלי טבלה): multi_branch_enabled, branches_config, branch_list (משתקף) והגדרות ההתראות.

const SETTING_META = {
  [MULTI_BRANCH_KEY]: { name: 'ריבוי סניפים פעיל', type: 'boolean' },
  [BRANCHES_CONFIG_KEY]: { name: 'הגדרת הסניפים (JSON)', type: 'text' },
  [BRANCH_LIST_KEY]: { name: 'רשימת סניפים', type: 'text' },
  [BRANCH_SETTING_KEYS.bannerEnabled]: { name: 'פס התראה בראש הדף: להעביר / להחזיר פריטים לסניף אחר', type: 'boolean' },
  [BRANCH_SETTING_KEYS.bannerScope]: { name: 'פס ההתראה: מה מופיע (להעביר / להחזיר / שניהם)', type: 'text' },
  [BRANCH_SETTING_KEYS.horizonDays]: { name: 'התראת העברה בין סניפים - טווח ימים קדימה', type: 'number' },
  [BRANCH_SETTING_KEYS.returnAlert]: { name: 'התראה בסריקת החזרה על פריט שצריך לעבור לסניף אחר', type: 'boolean' },
  [BRANCH_SETTING_KEYS.reserveAlert]: { name: 'התראה בסריקת החזרה על פריט רזרבה שיצא באישור (להחזיר לרזרבה)', type: 'boolean' },
};

async function writeSetting(key, value) {
  const meta = SETTING_META[key] || { name: key, type: 'text' };
  return writeSystemSetting(key, value, { name: meta.name, category: 'סניפים', type: meta.type });
}

export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const ctx = await loadBranchContext();
    const body = {
      enabled: ctx.enabled,
      derived: ctx.cfg.derived,
      branches: ctx.cfg.branches,
      notice: ctx.notice,
    };
    const wantUsage = new URL(request.url).searchParams.get('usage') === '1';
    if (wantUsage && (await checkAuth('הנהלה ראשית'))) {
      const usage = {};
      for (const b of ctx.cfg.branches) {
        const [orders, units] = await Promise.all([
          prisma.order.count({ where: { isDeleted: false, OR: [{ branch: b.name }, { pickupBranch: b.name }] } }),
          ctx.enabled ? prisma.dressItem.count({ where: { isDeleted: false, branch: b.name } }) : Promise.resolve(0),
        ]);
        usage[b.id] = { orders, units };
      }
      body.usage = usage;
    }
    return NextResponse.json(body);
  } catch (error) {
    console.error('Error loading branches:', error);
    return NextResponse.json({ error: 'שגיאה בטעינת הסניפים' }, { status: 500 });
  }
}

export async function PUT(request) {
  if (!(await checkAuth('הנהלה ראשית'))) return NextResponse.json({ error: 'נדרשת הרשאת הנהלה ראשית' }, { status: 401 });
  try {
    const body = await request.json();
    const ctx = await loadBranchContext();
    const writes = {};

    if (body.branches !== undefined) {
      const res = sanitizeBranchesInput(body.branches, { idGen: () => `b${randomBytes(4).toString('hex')}` });
      if (!res.ok) return NextResponse.json({ error: res.errors.join('\n'), errors: res.errors }, { status: 400 });
      // שם של סניף שכבר בשימוש (הזמנות / פריטים) נעול - ההזמנה והפריט שומרים את השם עצמו
      for (const r of renamedBranches(ctx.cfg.branches, res.branches)) {
        const [orders, units] = await Promise.all([
          prisma.order.count({ where: { OR: [{ branch: r.from }, { pickupBranch: r.from }] } }),
          ctx.enabled ? prisma.dressItem.count({ where: { branch: r.from } }) : Promise.resolve(0),
        ]);
        if (orders + units > 0) {
          return NextResponse.json({
            error: `אי אפשר לשנות את השם "${r.from}": יש עליו ${orders} הזמנות ו-${units} פריטים. השביתו את הסניף והוסיפו סניף חדש בשם הרצוי.`,
          }, { status: 409 });
        }
      }
      Object.assign(writes, settingsFromBranches(res.branches));
    }

    if (body.enabled !== undefined) writes[MULTI_BRANCH_KEY] = body.enabled ? 'true' : 'false';
    const s = body.settings || {};
    if (s.bannerEnabled !== undefined) writes[BRANCH_SETTING_KEYS.bannerEnabled] = s.bannerEnabled ? 'true' : 'false';
    if (s.returnAlert !== undefined) writes[BRANCH_SETTING_KEYS.returnAlert] = s.returnAlert ? 'true' : 'false';
    if (s.reserveAlert !== undefined) writes[BRANCH_SETTING_KEYS.reserveAlert] = s.reserveAlert ? 'true' : 'false';
    if (s.horizonDays !== undefined) {
      const n = parseInt(s.horizonDays, 10);
      if (!Number.isFinite(n) || n < 1 || n > 60) return NextResponse.json({ error: 'טווח החישוב חייב להיות בין 1 ל-60 ימים' }, { status: 400 });
      writes[BRANCH_SETTING_KEYS.horizonDays] = String(n);
    }
    if (s.bannerScope !== undefined) {
      if (!BANNER_SCOPES.includes(s.bannerScope)) return NextResponse.json({ error: 'ערך לא תקין ל"מה מופיע בפס"' }, { status: 400 });
      writes[BRANCH_SETTING_KEYS.bannerScope] = s.bannerScope;
    }

    // הפעלה: דורשת לפחות סניף פעיל אחד ועמודת DressItem.branch במסד (ה-DDL של scripts/branches-ddl.sql)
    const nextEnabled = writes[MULTI_BRANCH_KEY] !== undefined ? writes[MULTI_BRANCH_KEY] === 'true' : ctx.enabled;
    if (writes[MULTI_BRANCH_KEY] === 'true' && !ctx.enabled) {
      const branches = body.branches !== undefined ? JSON.parse(writes[BRANCHES_CONFIG_KEY]).branches : ctx.cfg.branches;
      if (!branches.some((b) => b.active)) return NextResponse.json({ error: 'כדי להפעיל ריבוי סניפים צריך להגדיר לפחות סניף פעיל אחד' }, { status: 400 });
      try {
        await prisma.dressItem.findFirst({ where: { branch: null }, select: { id: true } });
      } catch (e) {
        console.error('branches: DressItem.branch missing?', e);
        return NextResponse.json({ error: 'עמודת "סניף" בטבלת הפריטים עדיין לא קיימת במסד הזה (scripts/branches-ddl.sql). לא ניתן להפעיל.' }, { status: 409 });
      }
    }

    // התראת רזרבה דורשת את העמודה DressItem.locationBeforeRental (אותו DDL)
    if (writes[BRANCH_SETTING_KEYS.reserveAlert] === 'true' && !ctx.notice.reserveAlert) {
      try {
        await prisma.dressItem.findFirst({ where: { locationBeforeRental: null }, select: { id: true } });
      } catch (e) {
        console.error('branches: DressItem.locationBeforeRental missing?', e);
        return NextResponse.json({ error: 'העמודה לסימון פריטי רזרבה עדיין לא קיימת במסד הזה (scripts/branches-ddl.sql). לא ניתן להפעיל.' }, { status: 409 });
      }
    }

    let changed = 0;
    for (const [key, value] of Object.entries(writes)) if (await writeSetting(key, value)) changed++;
    invalidateSettingsCache();
    const fresh = await loadBranchContext();
    return NextResponse.json({ success: true, changed, enabled: nextEnabled, branches: fresh.cfg.branches, notice: fresh.notice });
  } catch (error) {
    console.error('Error saving branches:', error);
    return NextResponse.json({ error: 'שגיאה בשמירת הסניפים' }, { status: 500 });
  }
}
