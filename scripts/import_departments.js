const xlsx = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, '../../csv_exports/מחלקות.xlsx');
  console.log('Reading from', filePath);
  
  const workbook = xlsx.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  const data = xlsx.utils.sheet_to_json(sheet);
  console.log('Found', data.length, 'departments');
  
  for (const row of data) {
    const legacyId = parseInt(row['קוד']);
    const roleId = parseInt(row['מס_מחלקה']);
    const name = String(row['שם_מחלקה']);
    
    if (isNaN(roleId)) continue;
    
    await prisma.department.upsert({
      where: { roleId },
      update: { name, legacyId },
      create: { name, roleId, legacyId }
    });
    console.log(`Upserted department: ${name} (roleId: ${roleId})`);
  }
  
  // Now restore the foreign key in schema.prisma and push.
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
