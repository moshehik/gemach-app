// Notification.readBy / Notification.archivedBy are scalar String columns
// (default "[]") holding a JSON-encoded array of employeeIds as text.
// They are NOT native Prisma list fields, so plain application-level
// JSON parse/stringify must be used instead of the `push`/`set` list operators.

/**
 * Parse a Notification.readBy / archivedBy string column into an array of employeeIds.
 * Defensive against null, empty string, or malformed JSON.
 */
export function parseIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
