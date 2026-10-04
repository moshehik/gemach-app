import prisma from '@/app/lib/prisma';
import { ALL_ORDER_EVENT_ACTIONS, buildOrderEventRow } from '@/lib/history/orderEvents';

/**
 * THE single place that writes order "event" rows to AuditLog (print / PDF / Excel / history export /
 * manager approval / email) - see the contract at the top of lib/history/orderEvents.js.
 * These events have NO model write behind them, so the Prisma extension in app/lib/prisma.js never
 * logs them; writing them here does not duplicate anything. A model write must NEVER be logged
 * through this helper (use auditAs() on the write itself).
 * - `meta` must already be sanitized by the caller (sanitizeEventMeta / buildApprovalMeta / emailEventMeta).
 * - `actorId` comes from the session cookie (getActingEmployeeId) - never from a request body.
 * - Plain createMany, outside any $transaction (memory: no reads/heavy work inside transactions).
 * @returns {Promise<number>} rows written
 */
export async function writeOrderEvents({ orderIds, action, meta, actorId, clientEventId = null }) {
  if (!ALL_ORDER_EVENT_ACTIONS.includes(action)) throw new Error(`writeOrderEvents: unknown action ${action}`);
  const ids = (orderIds || []).filter((n) => Number.isInteger(n) && n > 0);
  if (ids.length === 0) return 0;
  const data = ids.map((orderId) => buildOrderEventRow({ orderId, action, meta, actorId, clientEventId }));
  // eslint-disable-next-line no-restricted-syntax -- an order event with no model write behind it (print/PDF/export/approval/email); the extension never sees it, so this is not a duplicate
  const res = await prisma.auditLog.createMany({ data });
  return (res && typeof res.count === 'number') ? res.count : data.length;
}

function displayName(employee) {
  if (!employee) return null;
  if (employee.fullName) return employee.fullName;
  const combined = [employee.firstName, employee.lastName].filter(Boolean).join(' ').trim();
  return combined || null;
}

// AuditLog.employeeId is a bare UUID with no relation to Employee — per the ID display
// rule (AGENTS.md) it must never reach the UI raw. Resolves each log's employeeId to the
// actor's display name in one batched query instead of exposing the id.
// Older Employee audit rows (written before app/lib/prisma.js started masking them) still hold
// the password / pinHash values inside changesJson - mask them on the way out so no reader of
// the history screens ever sees a hash or a legacy plaintext password. ApiKey CREATE rows
// written before keyHash was masked at write time get the same treatment.
const SECRET_FIELDS_BY_ENTITY = {
  Employee: ['password', 'pinHash'],
  ApiKey: ['keyHash'],
};
function redactSecrets(log) {
  const secrets = SECRET_FIELDS_BY_ENTITY[log.entityType];
  if (!secrets || !log.changesJson) return log;
  try {
    const parsed = JSON.parse(log.changesJson);
    if (!parsed || typeof parsed !== 'object') return log;
    let changed = false;
    for (const secret of secrets) {
      if (secret in parsed) {
        parsed[secret] = (parsed[secret] && typeof parsed[secret] === 'object') ? { from: '***', to: '***' } : '***';
        changed = true;
      }
    }
    return changed ? { ...log, changesJson: JSON.stringify(parsed) } : log;
  } catch (e) {
    return log;
  }
}

// Order-event rows (MANAGER_APPROVAL / EMAIL_SENT, lib/history/orderEvents.js) carry meta.approverId - a bare
// Employee UUID. Its display name is resolved in the same batched query and added as meta.approverName, so no
// history screen ever needs (or shows) the id itself (components/modern/changesDisplay.js hides *Id UUIDs).
function approverIdOf(log) {
  if (!log.changesJson || !log.changesJson.includes('"approverId"')) return null;
  try {
    const parsed = JSON.parse(log.changesJson);
    return parsed && typeof parsed === 'object' && typeof parsed.approverId === 'string' ? parsed.approverId : null;
  } catch (e) {
    return null;
  }
}

function withApproverName(log, nameById) {
  const approverId = approverIdOf(log);
  if (!approverId) return log;
  try {
    const parsed = JSON.parse(log.changesJson);
    parsed.approverName = nameById.get(approverId) || 'עובד שנמחק';
    return { ...log, changesJson: JSON.stringify(parsed) };
  } catch (e) {
    return log;
  }
}

export async function attachEmployeeNames(rawLogs) {
  const logs = rawLogs.map(redactSecrets);
  const employeeIds = [...new Set([
    ...logs.map(l => l.employeeId),
    ...logs.map(approverIdOf),
  ].filter(Boolean))];
  if (employeeIds.length === 0) return logs;

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, firstName: true, lastName: true, fullName: true }
  });
  const nameById = new Map(employees.map(e => [e.id, displayName(e)]));

  return logs.map(log => ({
    ...withApproverName(log, nameById),
    employeeName: log.employeeId ? (nameById.get(log.employeeId) || null) : null
  }));
}
