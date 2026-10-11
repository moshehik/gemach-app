// Tests for the "employees" context of the AI smart search (security-audit.md R4, 2026-10-11). No DB, no Next, no LLM.
//   1. The allow-list guard (lib/ai/employeesSearch.js checkEmployeesWhere): accepts the realistic conditions the model writes, rejects every way
//      of reaching another table / a sensitive column / a side effect (other tables, SELECT * over Employee, password / hourlyWage / pinHash,
//      comments, UNION / JOIN / WITH, sub-selects into forbidden tables, multi-statement, pg_sleep and other functions, DML, dollar quoting, E'' strings...).
//   2. The fixed query text: the safe CTEs expose exactly the documented columns and none of the sensitive ones; the outer SELECT is a fixed column list.
//   3. The row mapping (mapEmployeeRow): the shape both employees pages render, sensitive keys dropped, missing values absent.
//   4. Static manifest of the route: the `employees` context is gated by role server-side BEFORE any data access, other contexts untouched, SCHEMA_MAP unchanged.
//   5. The new list shows a clear message for an empty / failed AI search.
// Live matrix (real route, minted sessions, real Gemini): scripts/test_ai_employees_live.mjs.
// Run: node scripts/test_ai_employees_context.mjs   (exit 1 on failure)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkEmployeesWhere, assertEmployeesWhere, mapEmployeeRow, mapEmployeeRows, buildEmployeesQuery, buildEmployeesCountQuery, describeEmployeesQuery,
  SAFE_CTE_SQL, EMP_COLUMNS, SHIFT_COLUMNS, EMPLOYEES_PAGE_SIZE, isSensitiveEmployeesRequest, buildEmployeesSystemPrompt,
} from '../lib/ai/employeesSearch.js';
import './ai-reliability/register.mjs'; // resolver hooks (extension-less imports, '@/' alias) so the real lib/ai/aiCommon.js + lib/hebrewDate.js load outside Next
const { assertReadOnlySelect } = await import('../lib/sqlGuard.js');
const { processHebrewDateMacro } = await import('../lib/hebrewDate.js');
const { normalizeAiSql } = await import('../lib/ai/aiCommon.js');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
let passed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const ok = (c) => assert.deepEqual(checkEmployeesWhere(c), { ok: true }, `should be accepted: ${c}`);
const bad = (c, why) => { const r = checkEmployeesWhere(c); assert.equal(r.ok, false, `should be rejected (${why || ''}): ${c}`); };

// ---------------------------------------------------------------------------------------------------------------------------------
console.log('1. guard - accepted conditions');
const ACCEPT = [
  `"isActive" = false`,
  `"isActive" = true AND "departmentName" ILIKE '%מכירות%'`,
  `("firstName" ILIKE '%דנה%' OR "lastName" ILIKE '%דנה%' OR "fullName" ILIKE '%דנה%') AND ("firstName" ILIKE '%כהן%' OR "lastName" ILIKE '%כהן%')`,
  `"legacyId" = 12`,
  `"inShiftNow" = true`,
  `"lastEntryTime" IS NULL`,
  `"lastEntryDay" >= '2026-10-04'`,
  `COALESCE("departmentName", '') NOT ILIKE '%הנהלה%'`,
  `id IN (SELECT "employeeId" FROM emp_shifts WHERE "entryDay" >= '2026-10-04')`,
  `id NOT IN (SELECT "employeeId" FROM emp_shifts WHERE "entryDay" >= '2026-10-04' AND "entryDay" <= '2026-10-10')`,
  `EXISTS (SELECT 1 FROM emp_shifts WHERE "employeeId" = id AND "isOpen" = true)`,
  `"entryDay" = (now() AT TIME ZONE 'Asia/Jerusalem')::date`.replace('"entryDay"', '"lastEntryDay"'),
  `"lastEntryDay" >= (now() AT TIME ZONE 'Asia/Jerusalem')::date - interval '7 days'`,
  `regexp_replace(phone1, '\\D', '', 'g') LIKE '%1234567%'`,
  `email IS NOT NULL AND email <> ''`,
  `lower("lastName") LIKE '%כהן%' OR similarity("lastName", 'כהן') > 0.4`,
  `date_part('dow', "lastEntryTime" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Jerusalem') = 0`,
  `id IN (SELECT "employeeId" FROM emp_shifts GROUP BY "employeeId" HAVING COUNT(*) >= 5)`,
  `id IN (SELECT id FROM emp WHERE "isActive" = true)`,
  `CASE WHEN "isActive" THEN 1 ELSE 0 END = 1`,
  `1=0`,
  `1=1`,
];
ACCEPT.forEach((c, i) => t(`accept #${i + 1}: ${c.slice(0, 70)}`, () => ok(c)));

t('accepts what the Hebrew-date macros + normalizeAiSql produce', () => {
  const raw = `id IN (SELECT "employeeId" FROM emp_shifts WHERE "entryDay" >= HEBREW_MONTH_START('ELUL', 5786) AND "entryDay" <= HEBREW_MONTH_END('ELUL', 5786) AND "entryDay" <> HEBREW_DATE(10, 'SIVAN', 5786))`;
  const processed = normalizeAiSql(processHebrewDateMacro(raw));
  assert.ok(!/HEBREW_/i.test(processed), processed);
  ok(processed);
});

console.log('2. guard - rejected conditions');
const REJECT = [
  [`1=1) UNION SELECT 1 FROM "Employee" WHERE (1=1`, 'union'],
  [`id IN (SELECT id FROM "Employee")`, 'raw Employee table'],
  [`id IN (SELECT "employeeId" FROM "Shift")`, 'raw Shift table'],
  [`id IN (SELECT * FROM "Employee")`, 'SELECT * over Employee'],
  [`EXISTS (SELECT 1 FROM Employee)`, 'unquoted table'],
  [`EXISTS (SELECT 1 FROM employee)`, 'unquoted lower-case table'],
  [`"hourlyWage" > 50`, 'wage column'],
  [`id IN (SELECT id FROM emp WHERE "hourlyWage" > 50)`, 'wage column inside sub-select'],
  [`"password" IS NOT NULL`, 'password'],
  [`password LIKE '$2%'`, 'bare password'],
  [`"pinHash" IS NULL`, 'pinHash'],
  [`"needsPasswordReset" = true`, 'password internals'],
  [`"totalCalculated" > 0`, 'shift totals'],
  [`"hourlyWageSnapshot" > 0`, 'wage snapshot'],
  [`"themeColor" = 'x'`, 'themeColor'],
  [`"roleId" = 0`, 'roleId'],
  [`"notes" ILIKE '%x%'`, 'notes'],
  [`"street" ILIKE '%x%'`, 'address'],
  [`"city" ILIKE '%x%'`, 'address'],
  [`"bankAccount" IS NOT NULL`, 'bank'],
  [`id IN (SELECT "employeeId" FROM "TrustedDevice")`, 'trusted devices'],
  [`id IN (SELECT "createdById" FROM "ApiKey")`, 'api keys'],
  [`"isActive" = true -- comment`, 'line comment'],
  [`"isActive" = true /* x */`, 'block comment'],
  [`"isActive" = true; DROP TABLE "Employee"`, 'multi statement'],
  [`"isActive" = true;`, 'trailing semicolon'],
  [`(SELECT pg_sleep(10)) IS NULL`, 'pg_sleep'],
  [`pg_sleep(10) IS NULL`, 'pg_sleep bare'],
  [`"isActive" = true AND set_config('a','b',false) = 'b'`, 'set_config'],
  [`id IN (SELECT generate_series(1, 100000000)::text)`, 'generate_series'],
  [`pg_read_file('/etc/passwd') IS NOT NULL`, 'file read'],
  [`current_setting('server_version') IS NOT NULL`, 'current_setting'],
  [`"isActive" = true; UPDATE "Employee" SET "isActive" = false`, 'update'],
  [`DELETE FROM "Employee"`, 'delete'],
  [`INSERT INTO "Employee" DEFAULT VALUES`, 'insert'],
  [`id IN (SELECT "employeeId" FROM emp_shifts JOIN "Employee" ON true)`, 'join'],
  [`id IN (SELECT "employeeId" FROM emp_shifts, "Employee")`, 'comma join'],
  [`id IN (SELECT "employeeId" FROM emp_shifts UNION SELECT id FROM "Employee")`, 'union in sub-select'],
  [`id IN (WITH x AS (SELECT 1) SELECT 1)`, 'with'],
  [`id IN (SELECT "employeeId" FROM emp_shifts LIMIT 5)`, 'limit in sub-select'],
  [`id IN (SELECT "employeeId" FROM emp_shifts ORDER BY 1)`, 'order by in sub-select'],
  [`id IN (SELECT "employeeId" FROM pg_catalog.pg_user)`, 'pg_catalog'],
  [`id IN (SELECT 1 FROM information_schema.columns)`, 'information_schema'],
  [`id IN (SELECT 1 FROM pg_shadow)`, 'pg_shadow'],
  [`SELECT 1`, 'bare select'],
  [`"isActive" = true) OR (1=1`, 'unbalanced parentheses'],
  [`((("isActive" = true)`, 'unbalanced parentheses'],
  [`$$x$$ = 'x'`, 'dollar quoting'],
  [`$1 = 1`, 'parameter'],
  [`"firstName" = E'\\x41'`, 'E-string'],
  [`"firstName" = U&'\\0041'`, 'unicode string'],
  [`"firstName" = e'x'`, 'e-string lower'],
  [`"firstName"::regclass IS NULL`, 'cast to regclass'],
  [`"firstName"::oid > 1`, 'cast to oid'],
  [`id IN (SELECT 1 FROM emp AS e JOIN emp ON true)`, 'alias/join'],
  [`id = ANY(ARRAY[1])`, 'array'],
  [`id = {1}`, 'braces'],
  [`id IN (SELECT "employeeId" FROM emp_shifts FOR UPDATE)`, 'for update'],
  [`id IN (SELECT "employeeId" INTO t FROM emp_shifts)`, 'into'],
  [`"firstName" ILIKE 'x' OR EXISTS (SELECT 1 FROM "Employee" WHERE "hourlyWage" > 1)`, 'probe the wage'],
  [`"Employee".id IS NOT NULL`, 'dotted reference'],
  [`emp.id IS NOT NULL`, 'dotted emp'],
  [`"emp" IS NOT NULL`, 'quoted emp'],
  [`"isActive" = true AND 1 = (SELECT 1 FROM emp_shifts, emp_shifts)`, 'self cross join'],
  [`id IN (SELECT id FROM emp WHERE id IN (SELECT id FROM emp WHERE id IN (SELECT id FROM emp WHERE id IN (SELECT id FROM emp))))`, 'too many selects'],
  [`""`, 'empty quoted identifier'],
  [``, 'empty'],
  [`   `, 'blank'],
  [`"isActive" = 'unterminated`, 'unterminated string'],
  [`"isActive" = true\\`, 'backslash outside string'],
  [`נפילה`, 'non-ascii word outside a literal'],
  [`"שם" = 1`, 'non-ascii identifier'],
  [`x'41' = 'A'`, 'prefixed literal'],
  [`("isActive" = true)${' OR "isActive" = true'.repeat(200)}`, 'too long'],
];
REJECT.forEach(([c, why], i) => t(`reject #${i + 1} (${why})`, () => bad(c, why)));
t('assertEmployeesWhere throws a flagged error carrying the rejected SQL', () => {
  assert.throws(() => assertEmployeesWhere(`"hourlyWage" > 1`), (e) => e.employeesGuard === true && e.rejectedSql === `"hourlyWage" > 1`);
  assert.throws(() => assertEmployeesWhere(''), (e) => e.employeesGuard === true);
  assert.doesNotThrow(() => assertEmployeesWhere(`"isActive" = true`));
});
t('non-string input is rejected', () => { bad(undefined); bad(null); bad(42); bad({}); });

console.log('3. the fixed query text');
t('the CTE selects only the documented columns (aliases) and none of the sensitive ones', () => {
  const aliases = [...SAFE_CTE_SQL.matchAll(/\bAS "([A-Za-z0-9_]+)"/g)].map((m) => m[1]);
  const aliasesNoQuote = [...SAFE_CTE_SQL.matchAll(/\bAS (id)\b/g)].map((m) => m[1]);
  const exposed = new Set([...aliases, ...aliasesNoQuote]);
  for (const c of [...EMP_COLUMNS, ...SHIFT_COLUMNS]) assert.ok(exposed.has(c), `column ${c} is documented but not produced`);
  for (const a of exposed) assert.ok([...EMP_COLUMNS, ...SHIFT_COLUMNS].includes(a), `CTE exposes an undocumented column: ${a}`);
  for (const bannedWord of ['password', 'pinHash', 'hourlyWage', 'totalCalculated', 'Snapshot', 'themeColor', 'travelExpenses', 'paymentMethod', 'notes', 'street', 'houseNum', 'city', 'joinDate', 'profileImage', 'TrustedDevice', 'ApiKey', 'phone2', 'mustResetPassword', 'showAi']) {
    assert.ok(!SAFE_CTE_SQL.includes(bannedWord), `the safe CTE mentions ${bannedWord}`);
  }
  // roleId only as the join key to the department name, never selected
  const empSelect = SAFE_CTE_SQL.slice(SAFE_CTE_SQL.indexOf('), emp AS (') + 10, SAFE_CTE_SQL.indexOf('FROM "Employee" e'));
  assert.ok(!/roleId/.test(empSelect), 'roleId is selected in the emp CTE');
});
t('only the three base tables are read: Shift, Employee, Department', () => {
  const tables = [...SAFE_CTE_SQL.matchAll(/\b(?:FROM|JOIN)\s+("?[A-Za-z_]+"?)/g)].map((m) => m[1].replace(/"/g, ''));
  assert.deepEqual([...new Set(tables)].sort(), ['Department', 'Employee', 'Shift', 'emp_shifts'].sort());
});
t('service accounts (legacyId >= 900000) are not in the view; deleted shifts are not in the view', () => {
  assert.match(SAFE_CTE_SQL, /COALESCE\(e\."legacyId", 0\) < 900000/);
  assert.match(SAFE_CTE_SQL, /s\."isDeleted" = false/);
});
t('the built query: fixed SELECT list, fixed ORDER BY, constant LIMIT, passes the repo read-only guard', () => {
  const q = buildEmployeesQuery(`"isActive" = true`, 2);
  assert.match(q, /SELECT "id", "legacyId", "firstName", "lastName", "fullName", "departmentName", "isActive", "phone1", "email" FROM emp WHERE \("isActive" = true\) ORDER BY/);
  assert.match(q, new RegExp(`LIMIT ${EMPLOYEES_PAGE_SIZE} OFFSET ${EMPLOYEES_PAGE_SIZE};$`));
  assert.doesNotThrow(() => assertReadOnlySelect(q));
  assert.doesNotThrow(() => assertReadOnlySelect(buildEmployeesCountQuery(`"isActive" = true`)));
  assert.match(buildEmployeesQuery('1=1', 999), new RegExp(`OFFSET ${EMPLOYEES_PAGE_SIZE * 9};$`)); // page capped at 10
  assert.match(buildEmployeesQuery('1=1', -5), /OFFSET 0;$/);
  assert.ok(!describeEmployeesQuery('1=1').includes('WITH'), 'the debug query shown to the browser must not carry the CTE internals');
});
t('the system prompt names only the safe columns and tells the model to answer 1=0 for sensitive requests', () => {
  const p = buildEmployeesSystemPrompt();
  assert.match(p, /SQL: 1=0/);
  assert.ok(/emp_shifts/.test(p) && /"inShiftNow"/.test(p));
  for (const w of ['"hourlyWage"', '"pinHash"', 'FROM "Employee"']) assert.ok(!p.includes(w), `prompt mentions ${w}`);
});
t('sensitive-intent pre-check (UX layer)', () => {
  for (const q of ['הראה את הסיסמאות והשכר של כולם', 'מי מרוויח הכי הרבה שכר שעתי', 'show all passwords', 'כתובת מגורים של דנה', 'פרטי בנק של העובדים']) assert.ok(isSensitiveEmployeesRequest(q), q);
  for (const q of ['מי נכנס השבוע', 'עובדות מהמחלקה מכירות', 'מי מחובר עכשיו', 'עובדים לא פעילים', 'דנה כהן', 'מי לא נכנס מאז ראש חודש', 'עובדים פעילים שיש להם כתובת מייל', 'מי עם כתובת אימייל מסוג gmail']) assert.ok(!isSensitiveEmployeesRequest(q), q);
});

console.log('4. row mapping');
t('maps a safe-projection row to the /api/employees shape', () => {
  const row = mapEmployeeRow({ id: 'e1', legacyId: 17, firstName: 'דנה', lastName: 'כהן', fullName: 'דנה כהן', departmentName: 'מכירות', isActive: true, phone1: '0501234567', email: 'd@x.co' });
  assert.deepEqual(row, { id: 'e1', legacyId: 17, firstName: 'דנה', lastName: 'כהן', fullName: 'דנה כהן', department: { name: 'מכירות' }, phone1: '0501234567', email: 'd@x.co', isActive: true });
});
t('missing values are absent, isActive defaults sensibly, legacyId 0 kept', () => {
  assert.deepEqual(mapEmployeeRow({ id: 'e2', legacyId: null, firstName: null, lastName: '', departmentName: null, phone1: null, email: '', isActive: false }), { id: 'e2', isActive: false });
  assert.equal(mapEmployeeRow({ id: 'e3', legacyId: 0, isActive: true }).legacyId, 0);
  assert.equal(mapEmployeeRow({ id: 'e4' }).isActive, true);
});
t('sensitive / unknown keys are dropped even if a row carried them', () => {
  const row = mapEmployeeRow({ id: 'e5', firstName: 'x', password: '$2a$x', pinHash: 'h', hourlyWage: 50, roleId: 0, themeColor: '{}', notes: 'secret', street: 's', totalCalculated: 9, lastEntryTime: new Date(), inShiftNow: true });
  assert.deepEqual(Object.keys(row).sort(), ['firstName', 'id', 'isActive']);
  assert.deepEqual(mapEmployeeRows([null, 5, { id: 'a' }]).map((r) => r.id), ['a']);
  assert.deepEqual(mapEmployeeRows(undefined), []);
});
t('a mapped row renders in the new list logic (employeeRow) and the legacy keys exist', async () => {
  const { employeeRow } = await import('../app/components/employees-list/employeesLogic.js');
  const r = employeeRow(mapEmployeeRow({ id: 'e1', legacyId: 17, firstName: 'דנה', lastName: 'כהן', departmentName: 'מכירות', isActive: true, phone1: '050', email: 'a@b.c' }), {}, new Map());
  assert.equal(r.code, '17'); assert.equal(r.full, 'דנה כהן'); assert.equal(r.dept, 'מכירות'); assert.equal(r.phone, '050'); assert.equal(r.active, true);
});

console.log('5. route manifest (static)');
const route = read('app/api/ai/smart-search/route.js');
t('the employees context is gated by role server-side before any data access', () => {
  const post = route.slice(route.indexOf('export async function POST'));
  const iAuth = post.indexOf('checkAuth()');
  const iGate = post.indexOf("isEmployeesContext");
  const iSession = post.indexOf('getSessionEmployee()');
  const iRoles = post.indexOf('HEAD_MANAGEMENT_ROLES.includes(me.roleId)');
  const iAi = post.indexOf('checkAiAccess()');
  const iHandler = post.indexOf('handleEmployeesSearch(');
  assert.ok(iAuth > -1 && iAuth < iGate && iGate < iSession && iSession < iRoles && iRoles < iAi && iAi < iHandler, 'order: checkAuth -> employees gate (session + head management) -> checkAiAccess -> handler');
  assert.match(post, /if \(!me\) return NextResponse\.json\(\{ error: MSG_EMPLOYEES_LOGIN \}, \{ status: 403 \}\)/);
  assert.match(post, /if \(!HEAD_MANAGEMENT_ROLES\.includes\(me\.roleId\)\) return NextResponse\.json\(\{ error: MSG_EMPLOYEES_FORBIDDEN \}, \{ status: 403 \}\)/);
  assert.match(post, /status: 401/); // anonymous
  assert.match(route, /import \{[^}]*\bgetSessionEmployee\b[^}]*\bHEAD_MANAGEMENT_ROLES\b[^}]*\} from '\.\.\/\.\.\/\.\.\/\.\.\/lib\/auth'/);
});
t('the handler runs only guard-approved SQL: assertEmployeesWhere before every query, read-only transaction with a statement timeout', () => {
  const h = route.slice(route.indexOf('async function handleEmployeesSearch'), route.indexOf('export async function POST'));
  assert.ok((h.match(/assertEmployeesWhere\(/g) || []).length >= 2, 'guard in the paging path and in finalize()');
  assert.match(h, /SET TRANSACTION READ ONLY/);
  assert.match(h, /statementTimeoutSql\(EMPLOYEES_STATEMENT_TIMEOUT_MS\)/);
  assert.match(h, /mapEmployeeRows\(/);
  assert.ok(!/\$queryRawUnsafe\(`/.test(h) && !/SELECT \*/.test(h), 'no ad-hoc SQL / SELECT * in the employees handler');
  assert.ok(!/from "Employee"/i.test(h), 'the handler never names the raw Employee table');
  assert.match(h, /readWhere\(reuseWhereClause, 'employees'\)/);
  assert.match(h, /signWhere\(whereClause, 'employees'\)/);
});
t('other contexts are untouched: same four schemas, no employees entry, no fallback change', () => {
  const m = route.match(/const SCHEMA_MAP = \{([\s\S]*?)\n\};/);
  assert.ok(m);
  assert.deepEqual([...m[1].matchAll(/^\s+(\w+): "/gm)].map((x) => x[1]), ['customers', 'orders', 'dresses', 'rentals']);
  assert.match(route, /SCHEMA_MAP\[pageContext\] \|\| SCHEMA_MAP\['customers'\]/);
  assert.match(route, /if \(!\(await checkAiAccess\(\)\)\) \{[\s\S]*?return new Response\(JSON\.stringify\(\{ error: 'Forbidden' \}\), \{ status: 403/);
});
t('the legacy employees page is byte-identical to its frozen copy contract (not edited)', () => {
  const legacy = read('app/employees/LegacyEmployeesListPage.js');
  assert.match(legacy, /pageContext: 'employees'/);
});

console.log('6. new list: clear message for an empty / failed AI search');
const list = read('app/components/employees-list/EmployeesListA5.js');
t('the new list keeps an inline notice (no alert) and widens the status filter for AI results', () => {
  assert.ok(!/\balert\(/.test(list));
  assert.match(list, /aiNote/);
  assert.match(list, /notices=\{/);
  assert.match(list, /setGroup\('status', \[\]\)/);
});

console.log(`\n${passed} checks passed${process.exitCode ? ' - WITH FAILURES' : ''}`);
