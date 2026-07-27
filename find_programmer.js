const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const deps = await prisma.department.findMany();
  console.log(deps);
  const emps = await prisma.employee.findMany({where: {roleId: {not: null}}, include: {department: true}});
  console.log(emps.filter(e => e.department && e.department.name.includes('מתכנת')));
}
main().catch(console.error).finally(() => prisma.$disconnect());
