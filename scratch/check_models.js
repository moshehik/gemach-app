
import prisma from '@/app/lib/prisma';

async function main() {
  const models = await prisma.dressModel.findMany({
    where: { name: { contains: 'ורוד גוונים' } },
    include: { items: true }
  });
  
  models.forEach(m => {
    console.log(`Model ID: ${m.id}, Name: ${m.name}, Total Items: ${m.items.length}`);
    const sizes = Array.from(new Set(m.items.map(i => i.sizeText)));
    console.log(`Sizes: ${sizes.join(', ')}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
