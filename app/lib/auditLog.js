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
export async function attachEmployeeNames(logs) {
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
