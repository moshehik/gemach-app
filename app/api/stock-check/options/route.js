import { NextResponse } from 'next/server';
import prisma from '@/app/lib/prisma';
import { checkAuth } from '@/lib/auth';
import { canOpenPage } from '@/lib/permissions';
import { compareSizeText, normalizeSizeKey, groupSizeRows, pickSizeMenu } from '@/lib/sizeSort';
import { STOCK_CHECK_PAGE_KEY, ACTIVE_MODEL_WHERE } from '@/lib/stockCheck';

// GET /api/stock-check/options?key=model|size&typed=<טקסט>
// רשימות ההצעות (רשימת גלילה) לשדות "דגם" ו"מידה" בדף בדיקת מלאי — החלטת הבעלים Q03 (1.10.2026):
// לא טקסט חופשי בלבד, אלא רשימת הצעות כמו בפלטת האתר, בשני השדות. קריאה בלבד.
//   model → { options: [{ v: שם הדגם, c: קידומת ברקוד }] }  עד 50, לפי מה שהוקלד (שם מכיל / קידומת מתחילה ב-)
//   size  → { options: [{ v: מידה }] }                      כל המידות השלמות שיש להן פריט פעיל, ממוינות לפי ערך (בלי עשרוניות/אותיות, ר' sizeOptions)
// הרשאה: אותו שער כמו הבדיקה עצמה (checkAuth + page:orders, STOCK_CHECK_PAGE_KEY) — ההצעות חושפות
// את קטלוג הדגמים, ולכן לא ניתנות למי שאינו רשאי לפתוח את הדף.
export const dynamic = 'force-dynamic';

const LIMIT = 50;
const POOL = 400;
const INT32_MAX = 2147483647;

const json = (body, status = 200) => NextResponse.json(body, { status });
const clean = (s) => (s == null ? '' : String(s).trim());

// קידומת ברקוד היא Int - "מתחיל ב-549" = טווחים מספריים [549,550) ∪ [5490,5500) ∪ ... (בלי SQL גולמי).
function prefixRanges(typed) {
  const out = [];
  if (!/^\d{1,9}$/.test(typed)) return out;
  const n = parseInt(typed, 10);
  for (let k = 0; typed.length + k <= 10; k++) {
    const m = 10 ** k;
    const lo = n * m;
    if (lo > INT32_MAX) break;
    out.push({ barcodePrefix: { gte: lo, lt: Math.min((n + 1) * m, INT32_MAX + 1) } });
  }
  return out;
}

async function modelOptions(typed) {
  const where = { ...ACTIVE_MODEL_WHERE }; // דגם שיצא מהמאגר לא מוצע (כמו בבדיקה עצמה)
  if (typed) {
    where.OR = [{ name: { contains: typed, mode: 'insensitive' } }, ...prefixRanges(typed)];
  }
  const rows = await prisma.dressModel.findMany({
    where,
    select: { name: true, barcodePrefix: true },
    orderBy: typed ? { name: 'asc' } : { updatedAt: 'desc' },
    take: typed ? POOL : LIMIT,
  });
  const seen = new Set();
  const list = [];
  for (const r of rows) {
    const v = clean(r.name);
    if (!v) continue;
    const key = v + '|' + (r.barcodePrefix ?? '');
    if (seen.has(key)) continue;
    seen.add(key);
    list.push({ v, c: r.barcodePrefix ?? null });
  }
  if (!typed) return list.sort((a, b) => a.v.localeCompare(b.v, 'he')).slice(0, LIMIT);
  const numeric = /^\d+$/.test(typed);
  const rank = (o) => {
    if (numeric && o.c != null && String(o.c) === typed) return 0;
    if (numeric && o.c != null && String(o.c).startsWith(typed)) return 1;
    if (o.v.startsWith(typed)) return 2;
    return 3;
  };
  list.sort((a, b) => (rank(a) - rank(b)) || ((a.c ?? INT32_MAX) - (b.c ?? INT32_MAX)) || a.v.localeCompare(b.v, 'he'));
  return list.slice(0, LIMIT);
}

async function sizeOptions(typed) {
  // כל המידות השלמות שיש להן פריט פעיל (לא מחוק, בשימוש). פריט בתיקון עדיין "קיים" — המידה מוצעת, והפנוי בה יוכרע במנוע.
  // כתיבים שונים של אותה מידה ("08", "8", " 8", "8.0") מאוחדים לפי normalizeSizeKey (כמו בבדיקה עצמה, lib/stockCheck.js);
  // מוצג הכתיב הנפוץ ביותר ב-DB (בגמ"ח הראשי: תמיד בשתי ספרות, "08").
  // מידות עשרוניות/אותיות/טווחים ("06.1", "36א", "38-40" — בנווה יעקב) לא מוצעות ברשימה (נושא 12, 12.10.2026): רק אם הוקלד
  // תו שאינו ספרה (lib/sizeSort.js pickSizeMenu). הנתונים והבדיקה עצמה לא משתנים — הקלדה ידנית של "06.1" עדיין נבדקת.
  const rows = await prisma.dressItem.groupBy({
    by: ['sizeText'],
    where: { isDeleted: false, notInUse: false, dressModelId: { not: null }, dress: { exitDateFromRepo: null } }, // פריטי דגם שיצא לא תורמים מידה (נושא 12)
    _count: { _all: true },
  });
  const groups = groupSizeRows(rows.map((r) => ({ sizeText: r.sizeText, count: (r._count && r._count._all) || 0 })));
  const tk = typed ? normalizeSizeKey(typed) : '';
  const picked = pickSizeMenu(groups, typed, (g, t) => !t || g.v.includes(t) || g.key.startsWith(tk));
  picked.sort((a, b) => compareSizeText(a.key, b.key));
  return picked.slice(0, LIMIT).map((o) => ({ v: o.v }));
}

export async function GET(request) {
  if (!(await checkAuth())) return json({ error: 'Unauthorized' }, 401);
  if (!(await canOpenPage(STOCK_CHECK_PAGE_KEY))) return json({ error: 'Forbidden' }, 403);
  try {
    const sp = new URL(request.url).searchParams;
    const key = sp.get('key') || '';
    const typed = clean(sp.get('typed')).slice(0, 60);
    if (key === 'model') return json({ options: await modelOptions(typed) });
    if (key === 'size') return json({ options: await sizeOptions(typed) });
    return json({ error: 'סוג הצעות לא מוכר', code: 'invalid_key' }, 400);
  } catch (error) {
    console.error('GET /api/stock-check/options error:', error);
    return json({ error: 'שגיאה בטעינת ההצעות' }, 500);
  }
}
