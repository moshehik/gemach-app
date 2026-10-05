// רשימת דיווחי התקלות בעמודים (CPU phase 1B, 2026-10-06) - הצד של GET /api/error-report כשהלקוח מבקש ?take=N, ופרטי דיווח בודד ב-?id=.
//
// למה: הרשימה המלאה (בלי ?light) החזירה למתכנת/מנהל את *כל* הדיווחים בארגון, כל אחד עם כל התגובות המקוננות ועם צרופות (לעיתים data: URL
// של צילומי מסך) - 115-350KB בכל פתיחת חלון. עכשיו (opt-in, רק החלון החדש):
//   ?take=50[&cursor=...]  רשימה רזה: בלי תגובות (רק התגובה האחרונה, מצומצמת, + repliesCount), בלי צרופות/lastButtons/queryParams,
//                          userText קצר. מסודרת updatedAt יורד; nextCursor לעמוד הבא.
//   ?id=<reportId>         הדיווח המלא (כל התגובות עם hasSketch במקום sketchHtml, צרופות, lastButtons...) - נטען כשפותחים שרשור.
// בלי הפרמטרים האלה - הצורה הישנה המלאה (LegacyErrorReportButton הקפוא ולקוחות ישנים).
//
// העמוד הראשון (בלי cursor) כולל בנוסף את כל הדיווחים הפתוחים שדורשים תשומת לב, כדי שהמונים על האייקון ("לא נקראו" / "ממתינות לך")
// יישארו מדויקים גם כשרק חלק מהרשימה נטען: למתכנת - כל הפתוחים שלא נקראו; למדווח רגיל - כל הפתוחים שלו (תמיד מעטים).
// הלקוח מסיר כפילויות לפי id.

export const LIST_USER_TEXT_MAX = 240;
export const DEFAULT_TAKE = 50;
export const MAX_TAKE = 100;

/** take תקין (1..MAX_TAKE) או null אם הפרמטר חסר/לא מספר. */
export function parseTake(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_TAKE;
  return Math.min(n, MAX_TAKE);
}

export function encodeCursor(row) {
  return `${new Date(row.updatedAt).toISOString()}|${row.id}`;
}

/** { updatedAt: Date, id } או null אם לא תקין (cursor פגום = כמו עמוד ראשון). */
export function decodeCursor(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const i = raw.indexOf('|');
  if (i < 1) return null;
  const d = new Date(raw.slice(0, i));
  const id = raw.slice(i + 1);
  if (isNaN(d.getTime()) || !id) return null;
  return { updatedAt: d, id };
}

const EMPLOYEE_SELECT = { firstName: true, lastName: true };

// השדות שהרשימה הרזה צריכה: כל מה ש-erModel.js קורא מדיווח ברשימה (כותרת, נקרא/לא נקרא, טופל, בקשת מענה אנושי, זמן, מדווח) + התגובה האחרונה.
export const LIST_SELECT = {
  id: true,
  employeeId: true,
  url: true,
  title: true,
  userText: true,
  status: true,
  isReadByUser: true,
  isReadByProgrammer: true,
  isHandled: true,
  needsHuman: true,
  createdAt: true,
  updatedAt: true,
  employee: { select: EMPLOYEE_SELECT },
  _count: { select: { replies: true } },
  replies: {
    orderBy: { createdAt: 'desc' },
    take: 1,
    select: { id: true, isProgrammer: true, employeeId: true, isQuestion: true, createdAt: true },
  },
};

/** שורת DB מ-LIST_SELECT -> דיווח רזה לשליחה. partial=true אומר ללקוח לטעון את הדיווח המלא (?id=) כשפותחים אותו. */
export function slimListReport(row) {
  const { _count, replies, userText, ...rest } = row;
  const text = String(userText || '');
  return {
    ...rest,
    userText: text.length > LIST_USER_TEXT_MAX ? `${text.slice(0, LIST_USER_TEXT_MAX)}…` : text,
    replies: (replies || []).map((r) => ({ ...r, text: '' })),
    repliesCount: _count ? _count.replies : (replies || []).length,
    partial: true,
  };
}

/** דיווח מלא (include של replies) -> אותה צורה כמו ברשימה הישנה: sketchHtml לא נשלח, רק hasSketch. */
export function fullReportForClient(report) {
  return { ...report, replies: (report.replies || []).map(({ sketchHtml, ...rep }) => ({ ...rep, hasSketch: !!sketchHtml })), partial: false };
}

const cmpDesc = (a, b) => {
  const t = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  if (t !== 0) return t;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
};

/**
 * עמוד רשימה. whereBase = { employeeId } למדווח רגיל / {} למתכנת (בדיוק כמו ב-route הישן).
 * מחזיר { reports, paging: { take, hasMore, nextCursor, total?, archivedTotal? } } (total/archivedTotal רק בעמוד הראשון).
 */
export async function loadErrorReportPage({ prisma, whereBase, isProgrammer, take, cursor }) {
  const cur = decodeCursor(cursor);
  const pageWhere = cur
    ? { AND: [whereBase, { OR: [{ updatedAt: { lt: cur.updatedAt } }, { updatedAt: cur.updatedAt, id: { lt: cur.id } }] }] }
    : whereBase;
  const orderBy = [{ updatedAt: 'desc' }, { id: 'desc' }];

  const firstPage = !cur;
  // עמוד ראשון: + הפתוחים שדורשים תשומת לב (ר' הסבר למעלה) + ספירות לכותרות ("ארכיון (N)")
  const attentionWhere = firstPage
    ? { AND: [whereBase, { status: { not: 'ARCHIVED' } }, ...(isProgrammer ? [{ isReadByProgrammer: false }] : [])] }
    : null;
  const [pageRows, attentionRows, total, archivedTotal] = await Promise.all([
    prisma.errorReport.findMany({ where: pageWhere, orderBy, take: take + 1, select: LIST_SELECT }),
    firstPage ? prisma.errorReport.findMany({ where: attentionWhere, orderBy, select: LIST_SELECT }) : Promise.resolve([]),
    firstPage ? prisma.errorReport.count({ where: whereBase }) : Promise.resolve(undefined),
    firstPage ? prisma.errorReport.count({ where: { AND: [whereBase, { status: 'ARCHIVED' }] } }) : Promise.resolve(undefined),
  ]);

  const hasMore = pageRows.length > take;
  const page = hasMore ? pageRows.slice(0, take) : pageRows;
  const nextCursor = hasMore && page.length ? encodeCursor(page[page.length - 1]) : null;

  const seen = new Set(page.map((r) => r.id));
  const merged = [...page, ...attentionRows.filter((r) => !seen.has(r.id))].sort(cmpDesc);

  return {
    reports: merged.map(slimListReport),
    paging: { take, hasMore, nextCursor, ...(firstPage ? { total, archivedTotal } : {}) },
  };
}
