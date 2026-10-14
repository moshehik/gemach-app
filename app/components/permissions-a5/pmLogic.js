// לוגיקה טהורה של מסך ההרשאות החדש (/admin/permissions, PermissionsA5.js): קטלוג עם ברירות המחדל של הארגון, חיפוש, סיכום שורה, מטריצת "מה מותר למי".
// אין כאן גישה לרשת / DOM - נבדק ב-scripts/test_permissions_a5.mjs. המקור לערכים: GET /api/admin/permissions (departments[].values[key] = { value, isExplicit };
// groups[] = { id, name, keys, access, employeeAccess }; personalOverrides[]) והקטלוג הסטטי lib/permissionsMetadata.js.

export const STEPS = ['שם', 'עמודים ופיצ\'רים', 'מחלקות', 'עובדים ספציפיים', 'אישור'];

export const employeeName = (emp) => [emp && emp.lastName, emp && emp.firstName].filter(Boolean).join(' ') || (emp && emp.id) || '';

/** הקטלוג כשברירות המחדל מחושבות לפי הגדרות הארגון (עמודים שנפתחים / נסגרים לפי הגדרה) - כמו בדף הישן. */
export function withOrgDefaults(catalog, orgSettings) {
  return catalog.map((item) => ({ ...item, defaultForRoleId: (roleId) => item.defaultForRoleId(roleId, orgSettings) }));
}

const norm = (s) => String(s == null ? '' : s).toLowerCase().trim();
const words = (q) => norm(q).split(/\s+/).filter(Boolean);
const hit = (hay, ws) => ws.every((w) => hay.includes(w));

/** מפתח פריט -> השורות שמכילות אותו. */
export function rowsByKey(groups) {
  const map = new Map();
  for (const g of groups || []) for (const k of g.keys) map.set(k, [...(map.get(k) || []), g]);
  return map;
}

export const itemOf = (catalog, key) => catalog.find((i) => i.key === key) || null;

/** סיכום שורה להצגה: פריטים, כמה לתיעוד בלבד, מי מורשה, מה משותף עם שורות אחרות. */
export function summarizeGroup(group, catalog, groups, departments, employees) {
  const items = group.keys.map((k) => itemOf(catalog, k)).filter(Boolean);
  const byKey = rowsByKey((groups || []).filter((g) => g.id !== group.id));
  const allowedDepts = departments.filter((d) => group.access[d.roleId]);
  const allowedEmployees = (group.employeeAccess || []).map((id) => (employees || []).find((e) => e.id === id)).filter(Boolean);
  return {
    items,
    pages: items.filter((i) => i.group === 'pages').length,
    features: items.filter((i) => i.group === 'features').length,
    docOnly: items.filter((i) => !i.enforced).length,
    shared: items.filter((i) => byKey.has(i.key)),
    allowedDepts,
    allowedEmployees,
    everyone: departments.length > 0 && allowedDepts.length === departments.length,
    nobody: allowedDepts.length === 0 && allowedEmployees.length === 0,
  };
}

/** חיפוש חופשי בשורה: שם, תוויות / תיאורי הפריטים, מחלקות מורשות, עובדים ספציפיים. */
export function groupMatches(group, q, catalog, departments, employees) {
  const ws = words(q);
  if (!ws.length) return true;
  const s = summarizeGroup(group, catalog, [], departments, employees);
  const hay = norm([group.name, ...s.items.flatMap((i) => [i.label, i.description]), ...s.allowedDepts.map((d) => d.name), ...s.allowedEmployees.map(employeeName)].join(' '));
  return hit(hay, ws);
}

export function itemMatches(item, q) {
  const ws = words(q);
  return !ws.length || hit(norm(`${item.label} ${item.description || ''}`), ws);
}

/**
 * תא במטריצה: האם המחלקה רשאית לפריט, ומאיפה הערך. מקור: 'row' (פריט בשורת הרשאה) / 'set' (ערך שנקבע במפורש) / 'default' (ברירת המחדל של המערכת).
 * הערך עצמו מגיע מהשרת (האיחוד של כל השורות שמכילות את הפריט, או ברירת המחדל) - כאן רק מסבירים אותו.
 */
export function matrixCell(item, dept, rowsOfKey) {
  const cell = (dept.values && dept.values[item.key]) || { value: false, isExplicit: false };
  const rows = rowsOfKey || [];
  return {
    allowed: !!cell.value,
    source: rows.length ? 'row' : cell.isExplicit ? 'set' : 'default',
    rowNames: rows.map((r) => r.name),
  };
}

export const SOURCE_TEXT = { row: 'לפי שורת הרשאה', set: 'ערך שנקבע במפורש', default: 'ברירת המחדל של המערכת' };

/** פריטי המטריצה (כן/לא בלבד - ערכים מספריים בלשונית שלהם), מסוננים לפי קבוצה וחיפוש. */
export function matrixItems(catalog, { group = 'all', q = '', onlyRestricted = false, showLocked = false, departments = [], rowMap = new Map() } = {}) {
  return catalog.filter((item) => {
    if (item.type !== 'boolean') return false;
    if (item.notConfigurable && !showLocked) return false; // נעול להנהלה ראשית / בלי התחברות - אין מה להגדיר, ולכן לא מציגים כברירת מחדל
    if (group !== 'all' && item.group !== group) return false;
    if (!itemMatches(item, q)) return false;
    if (onlyRestricted) return departments.some((d) => !matrixCell(item, d, rowMap.get(item.key)).allowed);
    return true;
  });
}

/** טקסט מי מורשה בשורה אחת (טולטיפים / סיכום). */
export function whoText(s) {
  if (s.nobody) return 'ללא הרשאה (חוץ מהנהלה ראשית ומתכנת)';
  const parts = [];
  if (s.everyone) parts.push('כל המחלקות');
  else if (s.allowedDepts.length) parts.push(s.allowedDepts.map((d) => d.name).join(', '));
  if (s.allowedEmployees.length) parts.push(`${s.allowedEmployees.length} עובדים ספציפיים`);
  return parts.join(' + ');
}

/** ברירת המחדל של כל מחלקה לפריטים שנבחרו: מותר רק אם כל הפריטים מותרים לה היום (כך שמירה לא שוללת גישה קיימת). */
export function defaultsFor(items, departments) {
  const next = {};
  for (const dept of departments) next[dept.roleId] = items.length > 0 && items.every((item) => !!(item.defaultForRoleId && item.defaultForRoleId(dept.roleId)));
  return next;
}

export function validateStep(index, { name, keys }) {
  if (index === 0 && !String(name || '').trim()) return 'יש להזין שם לשורה';
  if (index === 1 && (keys || []).length === 0) return 'יש לצרף לפחות עמוד או פיצ\'ר אחד לשורה';
  return null;
}

/** כותרת הדף בכותרת הלשונית: מספר פריטים לתיעוד בלבד בקטלוג כולו (באנר מידע). */
export function docOnlyCount(catalog) {
  return catalog.filter((i) => !i.enforced).length;
}
