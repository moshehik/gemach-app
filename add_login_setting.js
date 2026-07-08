const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    await prisma.systemSetting.upsert({
        where: { key: 'require_login' },
        update: {
            name: 'דרוש התחברות עם קוד עובד וסיסמה',
            category: 'אבטחה',
            type: 'boolean'
        },
        create: {
            key: 'require_login',
            value: 'false',
            name: 'דרוש התחברות עם קוד עובד וסיסמה',
            category: 'אבטחה',
            type: 'boolean',
            notes: 'אם מופעל, משתמשים יצטרכו להזין קוד עובד וסיסמה בכניסה למערכת'
        }
    });
    console.log("Setting added successfully.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
