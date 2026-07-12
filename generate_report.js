const fs = require('fs');

const dataCheckStr = fs.readFileSync('data_check_v2.json', 'utf16le');
let dataCheck;
try {
    dataCheck = JSON.parse(dataCheckStr.trim());
} catch (e) {
    // maybe utf8
    dataCheck = JSON.parse(fs.readFileSync('data_check_v2.json', 'utf8').trim());
}

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
    'DressModel': 'שמלות_דגמים', // or שמלות_במלאי
    'DressItem': 'שמלות_נתונים',
    'Payment': 'הזמנות_תשלום', // or הזמנות_תשלום_ביצוע
    'PaymentObligation': null, // new concept
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

// Parse prisma schema for comments (Access field names)
const prismaFields = {}; // model -> { fieldName: { type, accessField } }
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

let md = '# השוואת שדות בין אקסס למערכת החדשה (Prisma)\n\n';
md += 'מסמך זה מפרט עבור כל טבלה במערכת החדשה אילו שדות קיימים בה, האם יש בהם נתונים (על פי בדיקה במסד הנתונים), לאיזה שדה באקסס הם מקבילים, ואילו שדות היו באקסס ולא הועברו ולמה.\n\n';

for (const [model, fields] of Object.entries(prismaFields)) {
    md += `## טבלת ${model}\n\n`;
    
    const accessTableName = modelToAccessTable[model];
    md += `**טבלה מקבילה באקסס:** ${accessTableName || 'אין טבלה מקבילה (טבלה חדשה)'}\n\n`;
    
    md += '| שדה במערכת החדשה | שדה באקסס (אם קיים) | סה"כ רשומות | ערכים ייחודיים (יותר מאחד?) |\n';
    md += '| :--- | :--- | :--- | :--- |\n';
    
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
        
        // Clean access field comment if it contains english descriptions
        let cleanAccess = info.accessField;
        if (cleanAccess.includes('(')) cleanAccess = cleanAccess.split('(')[0].trim();
        if (cleanAccess.includes('-')) cleanAccess = cleanAccess.split('-')[0].trim();
        
        md += `| \`${fieldName}\` | ${cleanAccess} | ${totalCount} | ${distinctStr} |\n`;
        
        if (cleanAccess && cleanAccess !== 'ללא מקביל' && cleanAccess !== 'Extracted manually if possible') {
            accessFieldsFound.push(cleanAccess.replace(/_/g, ' '));
            accessFieldsFound.push(cleanAccess);
        }
    }
    
    md += '\n';
    
    // Check which fields in Access were omitted
    if (accessTableName) {
        const accessTableDef = accessSchemaJson.find(t => t.Table === accessTableName);
        if (accessTableDef) {
            const allAccessCols = accessTableDef.Columns.split(',').map(c => c.trim());
            const missingCols = [];
            
            for (const col of allAccessCols) {
                // simple check
                const isFound = accessFieldsFound.some(af => af === col || af === col.replace(/ /g, '_'));
                if (!isFound) {
                    missingCols.push(col);
                }
            }
            
            if (missingCols.length > 0) {
                md += `### שדות באקסס ללא מקביל במערכת החדשה:\n`;
                for (const col of missingCols) {
                    let reason = 'סיבה לא ידועה.';
                    if (col === 'הגדרות') reason = 'הגדרות טכניות ישנות שכבר לא רלוונטיות או מנוהלות בצורה שונה.';
                    if (col.includes('מחוק')) reason = 'במערכת החדשה משתמשים בשדה isDeleted או deletedAt.';
                    if (col.includes('ארכיון')) reason = 'במערכת החדשה מסונן לפי סטטוס ולא שדה בוליאני ייעודי.';
                    if (col.includes('תאריך_מחיקה')) reason = 'מומר לשדה deletedAt במידה ויש.';
                    if (col.includes('קוד')) reason = 'המזהה באקסס הומר למזהה id או שזהו מזהה ייחודי של אקסס שכבר אינו רלוונטי.';
                    
                    md += `- \`${col}\`: ${reason}\n`;
                }
                md += '\n';
            } else {
                md += `אין שדות חסרים מאקסס.\n\n`;
            }
        }
    }
}

fs.writeFileSync('C:/Users/moshe/.gemini/antigravity/brain/2ccd7b5d-e4ef-429e-86f4-f730f7b5fcd8/db_migration_report.md', md);
console.log('Report generated at C:/Users/moshe/.gemini/antigravity/brain/2ccd7b5d-e4ef-429e-86f4-f730f7b5fcd8/db_migration_report.md');
