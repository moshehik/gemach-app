import { NextResponse } from 'next/server';
import versionData from '../../../version.json';

// גרסה ותאריך עדכון אחרון לתחתית עמוד A5 (C-1.25) - אותו מקור אמיתי כמו הטולטיפ
// של הלוגו (BrandLogo.js: "גירסא X | תאריך"). קריאה בלבד.
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ version: versionData.version || '', date: versionData.date || '' });
}
