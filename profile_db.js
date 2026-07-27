const { PrismaClient, Prisma } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
    const models = Prisma.dmmf.datamodel.models;
    const profileData = {};

    for (const model of models) {
        const tableName = model.dbName || model.name;
        profileData[model.name] = {
            tableName: tableName,
            totalRows: 0,
            columns: {}
        };

        try {
            const countResult = await prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tableName}"`);
            profileData[model.name].totalRows = Number(countResult[0].count);
        } catch (e) {
            console.error(`Error counting rows for ${tableName}:`, e.message);
            continue;
        }

        for (const field of model.fields) {
            if (field.kind !== 'scalar') continue;
            const colName = field.dbName || field.name;

            let nullCount = 0;
            let distinctCount = 0;

            try {
                const query = `
                    SELECT 
                        COUNT(DISTINCT "${colName}") as distinct_count,
                        SUM(CASE WHEN "${colName}" IS NULL THEN 1 ELSE 0 END) as null_count
                    FROM "${tableName}"
                `;
                const colResult = await prisma.$queryRawUnsafe(query);
                
                nullCount = Number(colResult[0].null_count || 0);
                distinctCount = Number(colResult[0].distinct_count || 0);

                if (field.type === 'String') {
                    const emptyQuery = `SELECT COUNT(*) as empty_count FROM "${tableName}" WHERE "${colName}" = ''`;
                    const emptyResult = await prisma.$queryRawUnsafe(emptyQuery);
                    nullCount += Number(emptyResult[0].empty_count || 0);
                }

            } catch (e) {
                console.error(`Error querying column ${colName} in ${tableName}:`, e.message);
            }

            profileData[model.name].columns[field.name] = {
                type: field.type,
                dbName: colName,
                nullCount,
                distinctCount
            };
        }
    }

    const outputPath = 'c:\\Users\\moshe\\Desktop\\גמח שמלות חדש\\server_profile.json';
    fs.writeFileSync(outputPath, JSON.stringify(profileData, null, 2));
    console.log(`Saved profile to ${outputPath}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
