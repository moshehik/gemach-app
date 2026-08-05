const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const newSettings = [
    {
      key: 'email_link_a',
      value: '',
      name: 'קישור פריסה א (ראשי)',
      category: 'מיילים',
      type: 'text',
      notes: 'הקישור הראשי לשליחת מיילים מהמערכת (Script URL)'
    },
    {
      key: 'email_link_b',
      value: '',
      name: 'קישור פריסה ב (משני)',
      category: 'מיילים',
      type: 'text',
      notes: 'הקישור המשני (למשל עבור דיווחי שגיאות)'
    },
    {
      key: 'email_routing_strategy',
      value: 'all_a',
      name: 'אסטרטגיית ניתוב מיילים',
      category: 'מיילים',
      type: 'select',
      notes: 'קבע מאיזה קישור יישלחו המיילים והדיווחים'
    }
  ];

  for (const s of newSettings) {
    const existing = await prisma.systemSetting.findUnique({ where: { key: s.key } });
    if (!existing) {
      await prisma.systemSetting.create({ data: s });
      console.log(`Created setting: ${s.key}`);
    } else {
      console.log(`Setting ${s.key} already exists`);
    }
  }

  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
