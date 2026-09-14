/**
 * Defense-in-depth guard for LLM-generated SQL strings before they are handed to
 * prisma.$queryRawUnsafe(). This is NOT a real SQL parser — it's a conservative
 * set of pattern checks meant to catch an AI-generated statement that isn't a
 * single, read-only SELECT (accidental mutation, multi-statement smuggling via
 * ';', comment-based statement smuggling via '--' or '/*', etc). A sufficiently
 * adversarial SQL string could in theory still slip past a regex-based check;
 * this guard exists to catch the AI going off the rails, not to be an airtight
 * security boundary. It intentionally rejects anything it can't confidently
 * classify as a clean single SELECT/WITH statement rather than trying to sanitize it.
 */

// Keywords that indicate a mutating/DDL/session statement, or something that
// could execute arbitrary server-side logic. Matched as whole words (case
// insensitive) so a column/table name like "created_at" doesn't false-positive
// on "CREATE".
const MUTATING_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'GRANT', 'REVOKE',
  'CREATE', 'EXECUTE', 'CALL', 'MERGE', 'COPY', 'VACUUM', 'REINDEX', 'SET',
];

const KEYWORD_REGEX = new RegExp(`\\b(${MUTATING_KEYWORDS.join('|')})\\b`, 'i');

/**
 * Checks whether `sql` is a single, read-only SELECT (optionally a `WITH ...`
 * CTE that resolves to a SELECT). Does not throw.
 *
 * @param {string} sql
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function checkReadOnlySelect(sql) {
  if (typeof sql !== 'string' || !sql.trim()) {
    return { ok: false, reason: 'Empty or invalid SQL string' };
  }

  let trimmed = sql.trim();

  // Strip a single trailing semicolon, if present.
  if (trimmed.endsWith(';')) {
    trimmed = trimmed.slice(0, -1).trim();
  }

  // Reject comment-based statement-smuggling tricks outright rather than
  // trying to strip them (a naive strip can itself be bypassed).
  if (trimmed.includes('--') || trimmed.includes('/*')) {
    return { ok: false, reason: 'SQL comments are not allowed (possible statement smuggling)' };
  }

  // Any semicolon left after removing a single trailing one means there's
  // more than one statement in the string.
  if (trimmed.includes(';')) {
    return { ok: false, reason: 'Multiple SQL statements are not allowed' };
  }

  // Must start with SELECT, or WITH (a CTE, e.g. "WITH x AS (...) SELECT ...").
  if (!/^(SELECT|WITH)\b/i.test(trimmed)) {
    return { ok: false, reason: 'Only SELECT (or WITH ... SELECT) statements are allowed' };
  }

  // Reject mutating/DDL/session keywords anywhere in the statement, including
  // inside a CTE body.
  const match = KEYWORD_REGEX.exec(trimmed);
  if (match) {
    return { ok: false, reason: `Disallowed keyword detected in generated SQL: ${match[1].toUpperCase()}` };
  }

  return { ok: true };
}

/**
 * Same check as `checkReadOnlySelect`, but throws on rejection instead of
 * returning a result object. The thrown Error carries `.rejectedSql` for
 * logging by the caller.
 *
 * @param {string} sql
 * @throws {Error}
 */
function assertReadOnlySelect(sql) {
  const result = checkReadOnlySelect(sql);
  if (!result.ok) {
    const err = new Error(result.reason);
    err.rejectedSql = sql;
    throw err;
  }
}

export { assertReadOnlySelect, checkReadOnlySelect };
