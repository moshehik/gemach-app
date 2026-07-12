const ADODB = require('node-adodb');
const fs = require('fs');

const dbPath = 'C:\\Users\\moshe\\Desktop\\גמח שמלות חדש\\AAA.accdb';
const connection = ADODB.open(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${dbPath};`);

async function main() {
    let rawAccess = fs.readFileSync('../access_schema_all.json', 'utf-8');
    if (rawAccess.charCodeAt(0) === 0xFEFF) {
        rawAccess = rawAccess.slice(1);
    }
    const schema = JSON.parse(rawAccess);

    const relevantTables = ["לקוחות", "הזמנות", "עובדים", "שמלות_דגמים", "שמלות_נתונים", "הזמנות_תשלום", "הזמנות_תשלום_ביצוע", "הזמנות_פרטים", "עובדים_נוכחות", "מחירים", "הגדרות_ראשי"];
    
    const results = {};
    
    for (const tableDef of schema) {
        const tableName = tableDef.Table;
        if (!relevantTables.includes(tableName)) continue;
        
        results[tableName] = {};
        const columns = tableDef.Columns.split(',').map(c => c.trim());
        
        for (const col of columns) {
            try {
                const totalQuery = `SELECT COUNT([${col}]) as c FROM [${tableName}]`;
                const totalData = await connection.query(totalQuery);
                const totalCount = totalData[0].c;
                
                const distinctQuery = `SELECT COUNT(*) as c FROM (SELECT DISTINCT [${col}] FROM [${tableName}] WHERE [${col}] IS NOT NULL)`;
                const distinctData = await connection.query(distinctQuery);
                const distinctCount = distinctData[0].c;
                
                results[tableName][col] = {
                    totalCount,
                    distinctCount
                };
            } catch (e) {
                results[tableName][col] = {
                    error: e.message
                };
            }
        }
    }
    
    fs.writeFileSync('access_counts.json', JSON.stringify(results, null, 2), 'utf8');
}

main().catch(console.error);
