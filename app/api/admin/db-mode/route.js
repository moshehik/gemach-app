import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getWebBackupMode, setWebBackupMode } from '@/app/lib/prisma';

// Production-safe prod/backup DB switch (see app/lib/prisma.js for why this
// can't reuse the dev-only .active-db mechanism). Unlike that dev toggle,
// flipping this affects EVERY visitor of the live site, so POST is
// restricted to the programmer role (the settings UI says "programmer only"; roleId 0
// head management used to pass too) and the current state is always shown via the banner
// in app/layout.js. GET stays public: it only returns 'prod' | 'test', which that banner needs.
export async function GET() {
  const isBackupMode = await getWebBackupMode();
  return NextResponse.json({ mode: isBackupMode ? 'test' : 'prod' });
}

export async function POST(request) {
  // 'מתכנת' = DEVELOPER_ONLY_ROLES ([2]) in lib/auth.js ROLE_LEVELS
  if (!(await checkAuth('מתכנת'))) {
    return NextResponse.json({ error: 'Unauthorized. Developer access required.' }, { status: 401 });
  }

  const { mode } = await request.json();
  if (mode !== 'prod' && mode !== 'test') {
    return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
  }
  if (mode === 'test' && !process.env.TEST_DATABASE_URL) {
    return NextResponse.json({ error: 'TEST_DATABASE_URL אינו מוגדר בסביבה הזו' }, { status: 400 });
  }

  await setWebBackupMode(mode === 'test');
  return NextResponse.json({ success: true, mode });
}
