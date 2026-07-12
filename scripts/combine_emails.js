const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Fetching customers with email and emailSuffix...');
  const customers = await prisma.customer.findMany({
    where: {
      email: { not: null },
      emailSuffix: { not: null, not: '' }
    }
  });

  let count = 0;
  for (const c of customers) {
    let email = c.email.trim();
    let suffix = c.emailSuffix.trim();

    // Fix some weird suffixes
    if (suffix === './org.il') suffix = '.org.il';
    
    // Check if we need to add '@'
    let combined = email;
    if (!combined.includes('@') && !suffix.startsWith('@') && !suffix.startsWith('.')) {
      combined += '@' + suffix;
    } else {
      // If email ends with @ and suffix starts with @, avoid @@
      if (combined.endsWith('@') && suffix.startsWith('@')) {
        combined += suffix.substring(1);
      } else {
        combined += suffix;
      }
    }

    // Clean up any weird spaces
    combined = combined.replace(/\s+/g, '');

    if (combined !== c.email) {
      await prisma.customer.update({
        where: { id: c.id },
        data: {
          email: combined,
          // We can leave emailSuffix as is or null it out. 
          // Assuming user just wants the email field to have the full address.
        }
      });
      count++;
    }
  }

  console.log(`Combined and updated emails for ${count} customers.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
