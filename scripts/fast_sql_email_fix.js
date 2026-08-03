const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

['.env', '.env.local'].forEach(file => {
  const envPath = path.join(__dirname, file);
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    lines.forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
        if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
        process.env[key] = value;
      }
    });
  }
});

async function runSqlFix(name, url) {
  if (!url) return;
  console.log(`\nStarting ultra-fast SQL email fix for ${name}...`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    // 1. Remove invalid standalone '@gmail.com' or '@' or '.' without username
    const res1 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = NULL
      WHERE "email" = '@gmail.com' OR "email" = '@Gmail.com' OR "email" = '@gmail' OR "email" = '@' OR "email" = '.';
    `);
    console.log(`1. Cleared invalid empty emails: ${res1}`);

    // 2. Fix slashes in domains like AVI@MNIVEN/COM or RK@OHELSARA/ORG
    const res2 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("email", '/COM', '.com'), '/com', '.com'), '/ORG', '.org'), '/CO.IL', '.co.il'), '/ORG.IL', '.org.il')
      WHERE "email" LIKE '%/%';
    `);
    console.log(`2. Fixed slashes in email domains: ${res2}`);

    // 3. Append @gmail.com to emails without @
    const res3 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = TRIM("email") || '@gmail.com'
      WHERE "email" IS NOT NULL AND TRIM("email") != '' AND "email" NOT LIKE '%@%';
    `);
    console.log(`3. Appended @gmail.com to emails lacking '@': ${res3}`);

    // 4. Fix emails ending with @ (e.g. HENELBZZ@ -> HENELBZZ@gmail.com)
    const res4 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = TRIM("email") || 'gmail.com'
      WHERE "email" LIKE '%@';
    `);
    console.log(`4. Appended gmail.com to emails ending with '@': ${res4}`);

    // 5. Fix domains missing .com / .co.il
    const res5 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = TRIM("email") || '.com'
      WHERE "email" LIKE '%@gmail' OR "email" LIKE '%@outlook' OR "email" LIKE '%@hotmail' OR "email" LIKE '%@yahoo';
    `);
    console.log(`5. Fixed missing .com in common domains: ${res5}`);

    const res6 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = TRIM("email") || '.co.il'
      WHERE "email" LIKE '%@walla';
    `);
    console.log(`6. Fixed missing .co.il in walla domain: ${res6}`);

    // 7. Fix remaining domains without dot (e.g. yeudits@ami -> yeudits@ami.com)
    const res7 = await prisma.$executeRawUnsafe(`
      UPDATE "Customer"
      SET "email" = TRIM("email") || '.com'
      WHERE "email" LIKE '%@%' AND "email" NOT LIKE '%.%';
    `);
    console.log(`7. Fixed remaining domains lacking dot extension: ${res7}`);

    // Verification
    const countTotal = await prisma.customer.count();
    const countWithAt = await prisma.customer.count({ where: { email: { contains: '@' } } });
    const countWithoutAt = await prisma.customer.count({
      where: { email: { not: null }, NOT: { email: { contains: '@' } } }
    });
    console.log(`[VERIFICATION] Total: ${countTotal}, With '@': ${countWithAt}, Lacking '@': ${countWithoutAt}`);

  } catch (err) {
    console.error(`Error in SQL fix for ${name}:`, err);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await runSqlFix('DATABASE_URL (Neon Prod)', process.env.DATABASE_URL);
}

main().catch(console.error);
