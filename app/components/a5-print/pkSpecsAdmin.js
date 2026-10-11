// pkSpecsAdmin.js - בוני המסמכים של דפי ההדפסה / ה-PDF של מסכי הניהול הקטנים (יומן שליחת מיילים, מחלקות ועובדים). פונקציות טהורות (נתוני המסך -> מודל מסמך),
// נבדקות ב-scripts/test_a5_email_logs.mjs / test_a5_departments.mjs. אותו מנגנון כמו pkSpecs.js; הרישום ב-pkRegistry.js ומשטח ה-PDF ב-lib/printAccessKeys.js.
//
// כללי התוכן של הבעלים (אין נתון כפול ואין נתון לא רלוונטי):
//   * יומן שליחת מיילים: מקובץ לפי יום (תאריך עברי בכותרת הקבוצה, ולכן בשורה רק שעה); עמודות שעה / נמען / סוג / סטטוס; עמודת "סיבת הכשל" רק כשיש כשלים בכלל;
//     הספירה (ומספר הכשלים, רק כשיש) פעם אחת בכותרת. לא מודפס: נושא, גוף המייל, שולח, קבצים.
//   * מחלקות ועובדים: שורה לכל מחלקה (מספר, שם, העובדים הפעילים); "+N לא פעילים" רק כשיש; מחלקה בלי עובדים = מקף; הספירה פעם אחת בכותרת. לא מודפס: אייקונים / פעולות.
import { escH, filterLine, plural, table } from './pkCore.js';

const num = (n) => `<span class="pk-num">${escH(n)}</span>`;
const ph = (v) => (v ? `<span class="pk-ph">${escH(v)}</span>` : '<span class="pk-dim">—</span>');
const dim = '<span class="pk-dim">—</span>';

/** data = { sheet } מ-buildEmailLogSheet (app/components/email-logs/emailLogsLogic.js). */
export function emailLogDoc(data) {
  const sh = data && data.sheet;
  const groups = (sh && sh.groups) || [];
  if (!groups.some((g) => g.rows.length)) return { empty: { title: 'אין מיילים להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  const withReason = !!sh.hasFail;
  const rest = 186 - 14 - 34 - 18 - (withReason ? 52 : 0);
  const cols = [{ t: 'שעה', w: '14mm', c: 1, nw: 1 }, { t: 'נמען', w: `${rest}mm` }, { t: 'סוג', w: '34mm' }, { t: 'סטטוס', w: '18mm', nw: 1 }];
  if (withReason) cols.push({ t: 'סיבת הכשל', w: '52mm' });
  const T = table('eml', cols);
  const atoms = [];
  groups.forEach((g) => {
    atoms.push(T.group(g.title));
    g.rows.forEach((r) => {
      const cells = [num(r.time), ph(r.to), escH(r.type), r.state === 'failed' ? `<b>${escH(r.status)}</b>` : escH(r.status)];
      if (withReason) cells.push(r.reason ? escH(r.reason) : dim);
      atoms.push(T.row(cells, g.title));
    });
  });
  const failed = sh.totals.failed || 0;
  return {
    kind: 'flow', previewTitle: 'הדפסת יומן שליחת מיילים', file: 'יומן שליחת מיילים',
    head: { title: sh.title || 'יומן שליחת מיילים', sub: sh.subtitle || '', sum: plural(sh.totals.count, 'מייל אחד', 'מיילים') + (failed ? ` · ${failed} נכשלו` : '') }, atoms,
  };
}

/** data = { rows (מחלקות אחרי חיפוש + סינון + מיון), state, filters }; שורה = { roleId, name, employees, names[], inactive }. */
export function departmentsDoc(data) {
  const L = (data && data.rows) || [];
  if (!L.length) return { empty: { title: 'אין מחלקות להדפסה', text: 'הרשימה ריקה לפי החיפוש והסינון הנוכחיים' } };
  const cols = [{ t: 'מס׳', w: '14mm', c: 1, nw: 1 }, { t: 'מחלקה', w: '46mm' }, { t: 'עובדים', w: '126mm' }];
  const T = table('dep', cols);
  const atoms = L.map((d) => {
    const names = (d.names || []).map(escH).join(' · ');
    const off = d.inactive > 0 ? `<span class="pk-dim"> (+${d.inactive} לא פעילים)</span>` : '';
    const who = d.namesKnown === false ? (d.employees ? `${d.employees} עובדים` : dim) : names || off ? `${names}${off}` : dim;
    return T.row([num(d.roleId), escH(d.name), who]);
  });
  const total = L.reduce((a, d) => a + (d.employees || 0), 0);
  const flt = filterLine(data.filters, data.state && data.state.sel, data.state && data.state.q, {}, {});
  return {
    kind: 'flow', previewTitle: 'הדפסת מחלקות ועובדים', file: 'מחלקות ועובדים',
    head: { title: 'מחלקות ועובדים', sub: flt, sum: `${plural(L.length, 'מחלקה אחת', 'מחלקות')} · ${plural(total, 'עובד אחד', 'עובדים', 'אין עובדים')}` }, atoms,
  };
}
