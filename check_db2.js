const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
    const items = await prisma.dressItem.findMany({take: 10});
    console.log("Random Items:", items);

    const withSerial = await prisma.dressItem.findMany({take: 5, where: {serialNumber: {not: null}}});
    console.log("With Serial:", withSerial);
    
    const withBarcode = await prisma.dressItem.findMany({take: 5, where: {dressBarcode: {not: null}}});
    console.log("With Barcode:", withBarcode);
}
main().finally(() => prisma.$disconnect());
