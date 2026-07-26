const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("--- Starting Email Merge ---");
    const customers = await prisma.customer.findMany({
        where: {
            isDeleted: false
        }
    });

    let updatedCount = 0;
    let missingAtCount = 0;
    let validCount = 0;

    for (const c of customers) {
        let newEmail = c.email ? c.email.trim() : null;
        let newSuffix = c.emailSuffix ? c.emailSuffix.trim() : null;
        let needsUpdate = false;

        // If there's a suffix, merge it
        if (newSuffix && newEmail) {
            // Check if suffix already starts with @ or email ends with @
            if (!newEmail.includes('@') && !newSuffix.includes('@')) {
                newEmail = `${newEmail}@${newSuffix}`;
            } else if (newEmail.endsWith('@') && !newSuffix.startsWith('@')) {
                newEmail = `${newEmail}${newSuffix}`;
            } else if (!newEmail.includes('@') && newSuffix.startsWith('@')) {
                newEmail = `${newEmail}${newSuffix}`;
            }
            needsUpdate = true;
        } else if (newSuffix && !newEmail) {
            // Suffix but no email? Strange, let's just make it the email if it has @
            if (newSuffix.includes('@')) {
                newEmail = newSuffix;
                needsUpdate = true;
            }
        }

        // Check if needs update because suffix should be cleared
        if (c.emailSuffix !== null || c.email !== newEmail) {
            await prisma.customer.update({
                where: { id: c.id },
                data: {
                    email: newEmail,
                    emailSuffix: null
                }
            });
            updatedCount++;
        }

        // Tally results
        if (newEmail) {
            if (newEmail.includes('@')) {
                validCount++;
            } else {
                missingAtCount++;
            }
        }
    }

    console.log(`Updated ${updatedCount} customer records.`);
    console.log(`Total valid emails (with @): ${validCount}`);
    console.log(`Total flawed emails (missing @): ${missingAtCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
