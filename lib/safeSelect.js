// Column allow-lists for embedding an Employee row inside another API response.
// `include: { employee: true }` ships EVERY column - including `password` (bcrypt hash, or the
// original PLAINTEXT for accounts not yet migrated), `pinHash`, hourlyWage, phone, email - to
// whoever called the route (found 2026-09-20 on GET /api/orders/[id]/employees, which was even
// unauthenticated). Always use this instead of `true` when an employee is joined in.
export const SAFE_EMPLOYEE_SELECT = {
  id: true,
  legacyId: true,
  firstName: true,
  lastName: true,
  fullName: true,
  roleId: true,
  isActive: true,
};
