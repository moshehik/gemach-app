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

function normalizeEmail(rawEmail, rawSuffix = '') {
  if (!rawEmail && !rawSuffix) return null;
  let email = (rawEmail || '').trim();
  let suffix = (rawSuffix || '').trim();

  if (!email) {
    if (!suffix) return null;
    if (suffix.toLowerCase().includes('gmail.com') || suffix === '@' || suffix === '.') return null;
    email = suffix;
    suffix = '';
  }

  if (/^@gmail(\.com)?$/i.test(email) || email === '@' || email === '.') {
    return null;
  }

  email = email.replace(/\/COM/gi, '.com');
  email = email.replace(/\/ORG/gi, '.org');
  email = email.replace(/\/CO\.IL/gi, '.co.il');
  email = email.replace(/\/ORG\.IL/gi, '.org.il');
  email = email.replace(/\/NET/gi, '.net');
  email = email.replace(/\//g, '.');

  email = email.trim();

  if (suffix) {
    suffix = suffix.replace(/^@/, '').trim();
    if (suffix.startsWith('./')) suffix = suffix.replace(/^\.\//, '.');
  }

  if (!email.includes('@')) {
    if (suffix && suffix.includes('.')) {
      email = email + '@' + suffix;
    } else {
      email = email + '@gmail.com';
    }
  } else if (email.endsWith('@')) {
    if (suffix && suffix.includes('.')) {
      email = email + suffix;
    } else {
      email = email + 'gmail.com';
    }
  } else {
    const parts = email.split('@');
    const username = parts[0].trim();
    let domain = parts.slice(1).join('@').trim();

    if (!domain) {
      domain = 'gmail.com';
    } else if (!domain.includes('.')) {
      const lowerDom = domain.toLowerCase();
      if (lowerDom === 'gmail') domain = 'gmail.com';
      else if (lowerDom === 'outlook') domain = 'outlook.com';
      else if (lowerDom === 'hotmail') domain = 'hotmail.com';
      else if (lowerDom === 'yahoo') domain = 'yahoo.com';
      else if (lowerDom === 'walla') domain = 'walla.co.il';
      else {
        domain = domain + '.com';
      }
    }
    email = username + '@' + domain;
  }

  email = email.replace(/@+/g, '@');
  return email;
}

async function fixCustomerEmails(name, url) {
  if (!url) return;
  console.log(`\nStarting email fix for ${name}...`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const customers = await prisma.customer.findMany({
      select: { id: true, email: true, emailSuffix: true }
    });

    console.log(`Loaded ${customers.length} customers.`);

    let updatedCount = 0;
    const batchSize = 100;
    let updates = [];

    for (const c of customers) {
      const normalized = normalizeEmail(c.email, c.emailSuffix);
      if (normalized !== c.email) {
        updates.push({ id: c.id, email: normalized });
      }
    }

    console.log(`Total customers needing email update: ${updates.length}`);

    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      await prisma.$transaction(
        batch.map(item =>
          prisma.customer.update({
            where: { id: item.id },
            data: { email: item.email }
          })
        )
      );
      updatedCount += batch.length;
      if (updatedCount % 500 === 0 || updatedCount === updates.length) {
        console.log(`Updated ${updatedCount} / ${updates.length} customer emails...`);
      }
    }

    console.log(`Successfully updated ${updatedCount} customer emails in ${name}.`);
  } catch (err) {
    console.error(`Error updating ${name}:`, err);
  } finally {
    await prisma.$disconnect();
  }
}

async function fixEmployeeEmails(name, url) {
  if (!url) return;
  console.log(`\nStarting employee email fix for ${name}...`);
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    const employees = await prisma.employee.findMany({
      select: { id: true, email: true, emailSuffix: true }
    });

    let updatedCount = 0;
    for (const emp of employees) {
      const normalized = normalizeEmail(emp.email, emp.emailSuffix);
      if (normalized !== emp.email) {
        await prisma.employee.update({
          where: { id: emp.id },
          data: { email: normalized }
        });
        updatedCount++;
      }
    }
    console.log(`Successfully updated ${updatedCount} employee emails in ${name}.`);
  } catch (err) {
    console.error(`Error updating employees in ${name}:`, err);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await fixCustomerEmails('DATABASE_URL (Neon Prod)', process.env.DATABASE_URL);
  await fixEmployeeEmails('DATABASE_URL (Neon Prod)', process.env.DATABASE_URL);
}

main().catch(console.error);
