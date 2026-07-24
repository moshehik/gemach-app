const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      value = value.replace(/^['"](.*)['"]$/, '$1'); // remove quotes
      process.env[key] = value;
    }
  });
}

const { PrismaClient: CloudClient } = require('@prisma/client');
const { PrismaClient: LocalClient } = require('@prisma/local-client');

async function main() {
  const cloud = new CloudClient();
  const local = new LocalClient();

  const cloudCustomers = await cloud.customer.findMany({ select: { id: true } });
  const localCustomers = await local.customer.findMany({ select: { id: true } });

  const cloudSet = new Set(cloudCustomers.map(c => c.id));
  const missingInCloud = localCustomers.filter(c => !cloudSet.has(c.id));

  console.log(`Customers in local but not in cloud: ${missingInCloud.length}`);
  console.log(missingInCloud.map(c => c.id).join(', '));

  await cloud.$disconnect();
  await local.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
