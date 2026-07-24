
import prisma from '@/app/lib/prisma';

async function main() {
  try {
    const tables = await prisma.$queryRawUnsafe("SELECT tablename as name FROM pg_catalog.pg_tables WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema' AND tablename != '_prisma_migrations' ORDER BY name");
    console.log(tables);
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
