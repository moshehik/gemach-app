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

  console.log("Fetching counts for table: customer");
  const cloudCount = await cloud.customer.count();
  const localCount = await local.customer.count();

  console.log(`Cloud total: ${cloudCount}`);
  console.log(`Local total: ${localCount}`);

  console.log("Fetching 3 random rows from cloud...");
  const cloudSamples = await cloud.customer.findMany({ take: 3 });

  let allMatch = true;
  for (const cloudRow of cloudSamples) {
    const id = cloudRow.id;
    const localRow = await local.customer.findUnique({ where: { id: id } });
    
    if (!localRow) {
      console.log(`Row ID ${id} missing in local!`);
      allMatch = false;
      continue;
    }
    
    const cloudStr = JSON.stringify(cloudRow);
    const localStr = JSON.stringify(localRow);
    
    if (cloudStr !== localStr) {
      console.log(`Mismatch for ID ${id}!`);
      console.log(`Cloud: ${cloudStr}`);
      console.log(`Local: ${localStr}`);
      allMatch = false;
    } else {
      console.log(`Row ID ${id} matches perfectly.`);
    }
  }

  if (cloudCount === localCount && allMatch) {
    console.log("\nRESULT: SUCCESS");
  } else {
    console.log("\nRESULT: FAILED");
    if (cloudCount !== localCount) {
      console.log(`Count mismatch: Cloud=${cloudCount}, Local=${localCount}`);
    }
  }

  await cloud.$disconnect();
  await local.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
