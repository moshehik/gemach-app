const fs = require('fs');

const dataCheckStr = fs.readFileSync('data_check_v2.json', 'utf16le');
let dataCheck;
try {
    dataCheck = JSON.parse(dataCheckStr.trim());
} catch (e) {
    dataCheck = JSON.parse(fs.readFileSync('data_check_v2.json', 'utf8').trim());
}

const accessCountsStr = fs.readFileSync('access_counts.json', 'utf8');
const accessCounts = JSON.parse(accessCountsStr.trim());

const schemaPrisma = fs.readFileSync('prisma/schema.prisma', 'utf-8');

let rawAccess = fs.readFileSync('../access_schema_all.json', 'utf-8');
if (rawAccess.charCodeAt(0) === 0xFEFF) {
    rawAccess = rawAccess.slice(1);
}
const accessSchemaJson = JSON.parse(rawAccess);

// Map Prisma Model to Access Table Name
const modelToAccessTable = {
    'Customer': 'לקוחות',
    'Order': 'הזמנות',
    'Employee': 'עובדים',
    'DressModel': 'שמלות_דגמים',
    'DressItem': 'שמלות_נתונים',
    'Payment': 'הזמנות_תשלום',
    'PaymentObligation': null,
    'OrderItem': 'הזמנות_פרטים',
    'Shift': 'עובדים_נוכחות',
    'PriceList': 'מחירים',
    'SystemSetting': 'הגדרות_ראשי',
    'AuditLog': null,
    'Notification': null,
    'PriceRule': null,
    'PageVisitLog': null,
    'EmailLog': null,
    'QueryLog': null,
    'NotificationTag': null
};

const prismaFields = {}; 
let currentModel = null;

for (let line of schemaPrisma.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('model ')) {
        currentModel = trimmed.split(' ')[1];
        prismaFields[currentModel] = {};
    } else if (trimmed === '}' && currentModel) {
        currentModel = null;
    } else if (currentModel && trimmed && !trimmed.startsWith('@@') && !trimmed.startsWith('//')) {
        const parts = trimmed.split(/\s+/);
        const fieldName = parts[0];
        const fieldType = parts[1];
        
        let accessField = null;
        const commentIndex = line.indexOf('//');
        if (commentIndex !== -1) {
            accessField = line.substring(commentIndex + 2).trim();
        }
        
        if (fieldType && !fieldType.includes('[]') && !Object.keys(prismaFields).includes(fieldType.replace('?', ''))) {
            prismaFields[currentModel][fieldName] = {
                type: fieldType,
                accessField: accessField || 'ללא מקביל',
                hasData: dataCheck[currentModel] && dataCheck[currentModel][fieldName]
            };
        }
    }
}

let md = '# השוואת שדות בין אקסס למערכת החדשה (Prisma) כולל ספירת נתונים השוואתית\n\n';
md += 'מסמך זה מפרט עבור כל טבלה במערכת החדשה אילו שדות קיימים בה, ומציג השוואה מדויקת של ספירת הנתונים במערכת החדשה לעומת מערכת האקסס.\n';
md += '* "סה"כ רשומות" - כמות הרשומות שאינן ריקות.\n';
md += '* "ערכים ייחודיים" - האם יש יותר מערך אחד שונה, והכמות המדויקת של הערכים השונים בסוגריים.\n\n';

for (const [model, fields] of Object.entries(prismaFields)) {
    md += `## טבלת ${model}\n\n`;
    
    const accessTableName = modelToAccessTable[model];
    md += `**טבלה מקבילה באקסס:** ${accessTableName || 'אין טבלה מקבילה (טבלה חדשה)'}\n\n`;
    
    md += '| שדה במערכת החדשה | שדה באקסס | רשומות חדש | ערכים ייחודיים חדש | רשומות אקסס | ערכים ייחודיים אקסס |\n';
    md += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';
    
    let accessFieldsFound = [];
    
    for (const [fieldName, info] of Object.entries(fields)) {
        let totalCount = 0;
        let distinctCount = 0;
        let distinctStr = 'לא';
        
        if (info.hasData && info.hasData.totalCount !== undefined) {
            totalCount = info.hasData.totalCount;
            distinctCount = info.hasData.distinctCount;
            if (distinctCount > 1) {
                distinctStr = `✅ כן (${distinctCount})`;
            } else if (distinctCount === 1) {
                distinctStr = `❌ לא (1)`;
            } else {
                distinctStr = `-`;
            }
        }
        
        let cleanAccess = info.accessField;
        if (cleanAccess.includes('(')) cleanAccess = cleanAccess.split('(')[0].trim();
        if (cleanAccess.includes('-')) cleanAccess = cleanAccess.split('-')[0].trim();
        
        let accessTotalCount = '-';
        let accessDistinctStr = '-';
        
        if (accessTableName && cleanAccess && cleanAccess !== 'ללא מקביל') {
            // lookup in accessCounts
            let exactColMatch = cleanAccess;
            // Handle possible spaces vs underscores (e.g., in json it might be stored with spaces or underscores)
            if (accessCounts[accessTableName]) {
                const tableCounts = accessCounts[accessTableName];
                let colInfo = tableCounts[exactColMatch];
                if (!colInfo) {
                    colInfo = tableCounts[exactColMatch.replace(/_/g, ' ')];
                }
                if (!colInfo) {
                    colInfo = tableCounts[exactColMatch.replace(/ /g, '_')];
                }
                
                if (colInfo && colInfo.totalCount !== undefined) {
                    accessTotalCount = colInfo.totalCount;
                    const accDistCount = colInfo.distinctCount;
                    if (accDistCount > 1) {
                        accessDistinctStr = `✅ כן (${accDistCount})`;
                    } else if (accDistCount === 1) {
                        accessDistinctStr = `❌ לא (1)`;
                    } else {
                        accessDistinctStr = `0`;
                    }
                } else if (colInfo && colInfo.error) {
                    accessTotalCount = 'שגיאה';
                    accessDistinctStr = 'שגיאה';
                } else {
                    accessTotalCount = 'לא נמצא באקסס';
                    accessDistinctStr = '-';
                }
            }
        }
        
        md += `| \`${fieldName}\` | ${cleanAccess} | ${totalCount} | ${distinctStr} | ${accessTotalCount} | ${accessDistinctStr} |\n`;
        
        if (cleanAccess && cleanAccess !== 'ללא מקביל' && cleanAccess !== 'Extracted manually if possible') {
            accessFieldsFound.push(cleanAccess.replace(/_/g, ' '));
            accessFieldsFound.push(cleanAccess);
        }
    }
    
    md += '\n';
    
    if (accessTableName) {
        const accessTableDef = accessSchemaJson.find(t => t.Table === accessTableName);
        if (accessTableDef) {
            const allAccessCols = accessTableDef.Columns.split(',').map(c => c.trim());
            const missingCols = [];
            
            for (const col of allAccessCols) {
                const isFound = accessFieldsFound.some(af => af === col || af === col.replace(/ /g, '_'));
                if (!isFound) {
                    missingCols.push(col);
                }
            }
            
            if (missingCols.length > 0) {
                md += `### שדות באקסס ללא מקביל במערכת החדשה (אבל עדיין נבדקו באקסס):\n`;
                
                md += '| שדה באקסס | רשומות אקסס | ערכים ייחודיים אקסס | סיבה למה לא הועבר |\n';
                md += '| :--- | :--- | :--- | :--- |\n';
                
                for (const col of missingCols) {
                    let reason = 'סיבה לא ידועה.';
                    if (col === 'הגדרות') reason = 'הגדרות טכניות ישנות.';
                    if (col.includes('מחוק')) reason = 'מנוהל בשדות isDeleted/deletedAt.';
                    if (col.includes('ארכיון')) reason = 'סינון לפי סטטוס.';
                    if (col.includes('תאריך_מחיקה')) reason = 'שדה deletedAt.';
                    if (col.includes('קוד')) reason = 'מזהה שהומר ל-id.';
                    
                    let aTotal = '-';
                    let aDist = '-';
                    if (accessCounts[accessTableName]) {
                        const colInfo = accessCounts[accessTableName][col];
                        if (colInfo && colInfo.totalCount !== undefined) {
                            aTotal = colInfo.totalCount;
                            const dC = colInfo.distinctCount;
                            if (dC > 1) aDist = `✅ כן (${dC})`;
                            else if (dC === 1) aDist = `❌ לא (1)`;
                            else aDist = `0`;
                        }
                    }
                    
                    md += `| ${col} | ${aTotal} | ${aDist} | ${reason} |\n`;
                }
                md += '\n';
            }
        }
    }
}

fs.writeFileSync('C:/Users/moshe/.gemini/antigravity/brain/2ccd7b5d-e4ef-429e-86f4-f730f7b5fcd8/db_migration_report.md', md);
console.log('Report generated.');
