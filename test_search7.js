
import prisma from '@/app/lib/prisma';

async function test() {
  try {
    const likeQ = '%דוד%';
    const c1 = await prisma.$queryRawUnsafe(`
      SELECT * FROM "Customer" 
      WHERE isDeleted = 0 
      AND (
        firstName LIKE $1 OR 
        lastName LIKE $1 OR 
        phone1 LIKE $1 OR 
        phone2 LIKE $1 OR 
        city LIKE $1 OR 
        id = $2
      )
      LIMIT 10
    `, likeQ, -1);
    console.log('Customers found with $1 $2:', c1.length);
  } catch (e) {
    console.error(e.message);
  }
}
test().then(() => process.exit(0));
