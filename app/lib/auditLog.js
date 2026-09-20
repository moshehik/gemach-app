import prisma from '@/app/lib/prisma';

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
// the history screens ever sees a hash or a legacy plaintext password.
function redactSecrets(log) {
  if (log.entityType !== 'Employee' || !log.changesJson) return log;
  try {
    const parsed = JSON.parse(log.changesJson);
    if (!parsed || typeof parsed !== 'object') return log;
    let changed = false;
    for (const secret of ['password', 'pinHash']) {
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

export async function attachEmployeeNames(rawLogs) {
  const logs = rawLogs.map(redactSecrets);
  const employeeIds = [...new Set(logs.map(l => l.employeeId).filter(Boolean))];
  if (employeeIds.length === 0) return logs;

  const employees = await prisma.employee.findMany({
    where: { id: { in: employeeIds } },
    select: { id: true, firstName: true, lastName: true, fullName: true }
  });
  const nameById = new Map(employees.map(e => [e.id, displayName(e)]));

  return logs.map(log => ({
    ...log,
    employeeName: log.employeeId ? (nameById.get(log.employeeId) || null) : null
  }));
}
