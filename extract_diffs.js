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

const modelToAccessTable = {
    'Customer': 'לקוחות', 'Order': 'הזמנות', 'Employee': 'עובדים', 'DressModel': 'שמלות_דגמים',
    'DressItem': 'שמלות_נתונים', 'Payment': 'הזמנות_תשלום_ביצוע', 'PaymentObligation': 'הזמנות_תשלום', 'OrderItem': 'הזמנות_פרטים',
    'Shift': 'עובדים_נוכחות', 'PriceList': 'מחירים', 'SystemSetting': 'הגדרות_ראשי'
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

let md = '| טבלה | שדה במערכת (Prisma) | שדה מקביל באקסס | רשומות חדש | רשומות אקסס | פער |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :--- |\n';
let count = 0;

for (const [model, fields] of Object.entries(prismaFields)) {
    const accessTableName = modelToAccessTable[model];
    if (!accessTableName) continue;
    
    for (const [fieldName, info] of Object.entries(fields)) {
        let totalCount = 0;
        if (info.hasData && info.hasData.totalCount !== undefined) {
            totalCount = info.hasData.totalCount;
        }
        
        let cleanAccess = info.accessField;
        if (cleanAccess.includes('(')) cleanAccess = cleanAccess.split('(')[0].trim();
        if (cleanAccess.includes('-')) cleanAccess = cleanAccess.split('-')[0].trim();
        
        if (cleanAccess && cleanAccess !== 'ללא מקביל' && cleanAccess !== 'Extracted manually if possible') {
            let exactColMatch = cleanAccess;
            if (accessCounts[accessTableName]) {
                const tableCounts = accessCounts[accessTableName];
                let colInfo = tableCounts[exactColMatch] || tableCounts[exactColMatch.replace(/_/g, ' ')] || tableCounts[exactColMatch.replace(/ /g, '_')];
                
                if (colInfo && colInfo.totalCount !== undefined) {
                    const accessTotalCount = colInfo.totalCount;
                    if (totalCount !== accessTotalCount) {
                        const diff = Math.abs(totalCount - accessTotalCount);
                        const diffSign = totalCount > accessTotalCount ? '+' : '-';
                        md += `| **${model}** | \`${fieldName}\` | ${cleanAccess} | ${totalCount} | ${accessTotalCount} | **${diffSign}${diff}** |\n`;
                        count++;
                    }
                }
            }
        }
    }
}

if (count === 0) {
    console.log('אין פערי נתונים כלל! (כל השדות שמופו זהים בדיוק)');
} else {
    console.log(md);
}
