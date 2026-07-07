const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Starting email migration...');

  // 1. Migrate Customers
  const customers = await prisma.customer.findMany({
    where: {
      emailSuffix: {
        not: null
      }
    }
  });

  let customerUpdates = 0;
  for (const customer of customers) {
    if (customer.emailSuffix && customer.emailSuffix.trim() !== '') {
      let newEmail = customer.email || '';
      // If email doesn't have an @ symbol, append the suffix
      if (!newEmail.includes('@')) {
        let suffix = customer.emailSuffix.startsWith('@') ? customer.emailSuffix : `@${customer.emailSuffix}`;
        newEmail = `${newEmail}${suffix}`;
        
        await prisma.customer.update({
          where: { id: customer.id },
          data: { 
            email: newEmail,
            emailSuffix: null // clear the suffix
          }
        });
        customerUpdates++;
      }
    }
  }
  console.log(`Updated ${customerUpdates} customers.`);

  // 2. Migrate Employees
  const employees = await prisma.employee.findMany({
    where: {
      emailSuffix: {
        not: null
      }
    }
  });

  let employeeUpdates = 0;
  for (const employee of employees) {
    if (employee.emailSuffix && employee.emailSuffix.trim() !== '') {
      let newEmail = employee.email || '';
      if (!newEmail.includes('@')) {
        let suffix = employee.emailSuffix.startsWith('@') ? employee.emailSuffix : `@${employee.emailSuffix}`;
        newEmail = `${newEmail}${suffix}`;
        
        await prisma.employee.update({
          where: { id: employee.id },
          data: { 
            email: newEmail,
            emailSuffix: null // clear the suffix
          }
        });
        employeeUpdates++;
      }
    }
  }
  console.log(`Updated ${employeeUpdates} employees.`);

  console.log('Migration complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
