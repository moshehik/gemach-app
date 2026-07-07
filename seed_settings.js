const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Seeding SystemSettings...");
    
    const settingsToSeed = [
        { key: 'barcodePrefixLength', value: '3', name: 'אורך קוד דגם' },
        { key: 'useModelNames', value: 'true', name: 'שימוש בשם דגם (אחרת שימוש במספר סידורי בלבד)' },
        { key: 'useFileNamesForImages', value: 'true', name: 'שימוש אוטומטי בשמות קבצים לתמונות' }
    ];

    for (const setting of settingsToSeed) {
        await prisma.systemSetting.upsert({
            where: { key: setting.key },
            update: {},
            create: setting
        });
    }

    console.log("Seeding finished.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
