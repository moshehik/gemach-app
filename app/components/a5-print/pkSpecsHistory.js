// pkSpecsHistory.js - בוני המסמכים של דפי ההדפסה / ה-PDF של שני יומני הניהול: "יומן שינויים" (היסטוריית נתונים, AuditLog) ו"יומן שאילתות ו-API" (PageVisitLog).
// פונקציות טהורות (נתוני המסך -> מודל מסמך), נבדקות ב-scripts/test_a5_history_lists.mjs. אותו מנגנון כמו pkSpecs.js; הרישום ב-pkRegistry.js ומשטח ה-PDF ב-lib/printAccessKeys.js.
//
// כללי התוכן של הבעלים (אין נתון כפול ואין נתון לא רלוונטי):
//   * מקובץ לפי יום (התאריך העברי בכותרת הקבוצה, ולכן בשורה רק שעה); הספירה פעם אחת בכותרת; שורת הסינון רק כשיש סינון / חיפוש פעיל.
//   * יומן שינויים: שעה / מי / מה (הרשומה והפעולה, בלי מזהים פנימיים) / השינוי (עד 3 שדות "לפני ← אחרי" + "ועוד N"). לא מודפס: UUID, שדות פנימיים, סודות.
//   * יומן שאילתות: שעה / עובד / נתיב או מסך / נפח / משך; עמודת "תקלה" רק כשיש תקלות בכלל.
import { escH, plural, table } from './pkCore.js';

const num = (n) => `<span class="pk-num">${escH(n)}</span>`;
const dim = '<span class="pk-dim">—</span>';
const cell = (v) => (v ? escH(v) : dim);

/** data = { sheet } מ-buildAuditSheet (app/components/history-lists/dataHistoryLogic.js). */
export function auditLogDoc(data) {
  const sh = data && data.sheet;
  const groups = (sh && sh.groups) || [];
  if (!groups.some((g) => g.rows.length)) return { empty: { title: 'אין שינויים להדפסה', text: 'היומן ריק לפי החיפוש והסינון הנוכחיים' } };
  const cols = [{ t: 'שעה', w: '14mm', c: 1, nw: 1 }, { t: 'מי', w: '30mm' }, { t: 'מה', w: '56mm' }, { t: 'השינוי', w: '86mm' }];
  const T = table('aud', cols);
  const atoms = [];
  groups.forEach((g) => {
    atoms.push(T.group(g.title));
    g.rows.forEach((r) => atoms.push(T.row([num(r.time), cell(r.who), escH(r.what), cell(r.change)], g.title)));
  });
  return {
    kind: 'flow', previewTitle: 'הדפסת יומן שינויים', file: 'יומן שינויים',
    head: { title: sh.title || 'יומן שינויים', sub: sh.subtitle || '', sum: plural(sh.totals.count, 'שינוי אחד', 'שינויים') }, atoms,
  };
}

/** data = { sheet } מ-buildVisitSheet (app/components/history-lists/visitLogLogic.js). */
export function visitLogDoc(data) {
  const sh = data && data.sheet;
  const groups = (sh && sh.groups) || [];
  if (!groups.some((g) => g.rows.length)) return { empty: { title: 'אין רשומות להדפסה', text: 'היומן ריק לפי החיפוש והסינון הנוכחיים' } };
  const withErr = !!sh.hasErr;
  const cols = [{ t: 'שעה', w: '14mm', c: 1, nw: 1 }, { t: 'עובד', w: '34mm' }, { t: 'נתיב / מסך', w: withErr ? '66mm' : '98mm' }, { t: 'נפח', w: '20mm', nw: 1 }, { t: 'משך', w: '20mm', nw: 1 }];
  if (withErr) cols.push({ t: 'תקלה', w: '32mm' });
  const T = table('vis', cols);
  const atoms = [];
  groups.forEach((g) => {
    atoms.push(T.group(g.title));
    g.rows.forEach((r) => {
      const cells = [num(r.time), cell(r.who), `<span class="pk-ph">${escH(r.what)}</span>`, r.size ? num(r.size) : dim, r.ms ? num(r.ms) : dim];
      if (withErr) cells.push(cell(r.error));
      atoms.push(T.row(cells, g.title));
    });
  });
  return {
    kind: 'flow', previewTitle: 'הדפסת יומן שאילתות ו-API', file: 'יומן שאילתות ו-API',
    head: { title: sh.title || 'יומן שאילתות ו-API', sub: sh.subtitle || '', sum: plural(sh.totals.count, 'רשומה אחת', 'רשומות') }, atoms,
  };
}
