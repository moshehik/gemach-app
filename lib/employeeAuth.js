import prisma from '@/app/lib/prisma';
import { verifySecret } from './passwordAuth';

// Finds Employee row(s) matching a "username" that may be a UUID id, legacyId (numeric),
// or first/last/full name - the identifier pattern used by several admin-reauth prompts
// across the app (SendEmailModal, history delete, ...). Returns candidates to be checked
// against a plaintext password with verifySecret() by the caller: bcrypt hashes can't be
// compared inside a Prisma `where` clause the way the old plaintext `password: x` could.
export async function findEmployeeCandidatesByUsername(username, { activeOnly = true } = {}) {
  if (!username) return [];
  const parsedLegacy = parseInt(username, 10);
  return prisma.employee.findMany({
    where: {
      OR: [
        { id: username },
        { firstName: username },
        { lastName: username },
        { fullName: username },
        ...(isNaN(parsedLegacy) ? [] : [{ legacyId: parsedLegacy }])
      ],
      ...(activeOnly ? { isActive: true } : {})
    }
  });
}

/**
 * Verifies a plaintext password against whichever candidate employee (found via
 * findEmployeeCandidatesByUsername) it actually matches, returning that employee or null.
 * Small gemach employee counts make the linear bcrypt scan cheap, and name collisions
 * across candidates are rare - matches the tolerance of the original plaintext lookup.
 */
export async function verifyEmployeeCredentials(username, plainPassword, opts) {
  if (!plainPassword) return null;
  const candidates = await findEmployeeCandidatesByUsername(username, opts);
  for (const emp of candidates) {
    if (await verifySecret(plainPassword, emp.password)) return emp;
  }
  return null;
}
