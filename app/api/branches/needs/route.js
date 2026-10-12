import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { canOpenAnyPage } from '@/lib/permissions';
import { getBranchNeeds } from '@/lib/branchNeedsServer';
import { groupTransfers } from '@/lib/branchNeeds';

export const dynamic = 'force-dynamic';

// ההעברות שצריך לבצע בין סניפים לפי ההזמנות העתידיות (docs/branches-plan.md, שלב ג) - קריאה בלבד.
//   ?days=14   טווח ימים קדימה (ברירת מחדל: branch_transfer_horizon_days)
//   ?fresh=1   עוקף את המטמון של 30 שניות
// כבוי (multi_branch_enabled) = { enabled:false, transfers:[] } בלי שאילתה. שמות לקוחות -> אותה הרשאת עמוד כמו dress-location-alerts.
export async function GET(request) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!(await canOpenAnyPage(['page:orders', 'page:board', 'page:schedule', 'page:home']))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const sp = new URL(request.url).searchParams;
    const days = parseInt(sp.get('days') || '', 10);
    const needs = await getBranchNeeds({ horizonDays: Number.isFinite(days) ? Math.min(Math.max(days, 1), 60) : undefined, fresh: sp.get('fresh') === '1' });
    return NextResponse.json({ ...needs, groups: groupTransfers(needs.transfers).map((g) => ({ from: g.from, to: g.to, count: g.items.length })) });
  } catch (error) {
    console.error('Error computing branch needs:', error);
    return NextResponse.json({ error: 'שגיאה בחישוב ההעברות בין סניפים' }, { status: 500 });
  }
}
