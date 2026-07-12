import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const cwd = process.cwd();
    
    // Attempt to read data_check_v2.json
    let dataCheckStr = '';
    try {
      dataCheckStr = fs.readFileSync(path.join(cwd, 'data_check_v2.json'), 'utf16le');
    } catch(e) {
      // ignore
    }
    let dataCheck = {};
    if (dataCheckStr) {
      try {
        dataCheck = JSON.parse(dataCheckStr.trim());
      } catch (e) {
        dataCheck = JSON.parse(fs.readFileSync(path.join(cwd, 'data_check_v2.json'), 'utf8').trim());
      }
    } else {
        dataCheck = JSON.parse(fs.readFileSync(path.join(cwd, 'data_check_v2.json'), 'utf8').trim());
    }

    const accessCountsStr = fs.readFileSync(path.join(cwd, 'access_counts.json'), 'utf8');
    const accessCounts = JSON.parse(accessCountsStr.trim());

    const schemaPrisma = fs.readFileSync(path.join(cwd, 'prisma/schema.prisma'), 'utf-8');

    let rawAccess = fs.readFileSync(path.join(cwd, '../access_schema_all.json'), 'utf-8');
    if (rawAccess.charCodeAt(0) === 0xFEFF) {
        rawAccess = rawAccess.slice(1);
    }
    const accessSchemaJson = JSON.parse(rawAccess);

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

    let html = `<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>דוח השוואת נתוני הגירה - אקסס מול המערכת החדשה</title>
    <style>
        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --success: #16a34a;
            --success-light: #dcfce7;
            --danger: #dc2626;
            --danger-light: #fee2e2;
            --warning: #ca8a04;
            --warning-light: #fef9c3;
            --bg-color: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #1e293b;
            --text-muted: #64748b;
            --border-color: #e2e8f0;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-main);
            line-height: 1.6;
            padding: 2rem;
            margin: 0;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        .header {
            text-align: center;
            margin-bottom: 3rem;
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            color: white;
            padding: 2rem;
            border-radius: 1rem;
            box-shadow: 0 10px 25px -5px rgba(37, 99, 235, 0.3);
        }
        .header h1 {
            margin: 0 0 1rem 0;
            font-size: 2.5rem;
        }
        .header p {
            margin: 0;
            font-size: 1.1rem;
            opacity: 0.9;
        }
        .card {
            background-color: var(--card-bg);
            border-radius: 1rem;
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
            margin-bottom: 2.5rem;
            overflow: hidden;
            border: 1px solid var(--border-color);
        }
        .card-header {
            background-color: #f1f5f9;
            padding: 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .card-header h2 {
            margin: 0;
            color: var(--primary-dark);
            font-size: 1.5rem;
        }
        .badge {
            padding: 0.5rem 1rem;
            border-radius: 9999px;
            font-weight: 600;
            font-size: 0.875rem;
            background-color: #e0e7ff;
            color: #3730a3;
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 1rem 1.5rem;
            text-align: right;
            border-bottom: 1px solid var(--border-color);
        }
        th {
            background-color: #f8fafc;
            font-weight: 600;
            color: var(--text-muted);
            font-size: 0.875rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        tr:last-child td {
            border-bottom: none;
        }
        tr:hover td {
            background-color: #f8fafc;
        }
        .code {
            font-family: monospace;
            background-color: #f1f5f9;
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            color: #0f172a;
            font-size: 0.9em;
        }
        .status-yes {
            color: var(--success);
            font-weight: 600;
        }
        .status-no {
            color: var(--danger);
            font-weight: 600;
        }
        .status-warn {
            color: var(--warning);
            font-weight: 600;
        }
        .compare-cell {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        .diff-indicator {
            padding: 0.25rem 0.5rem;
            border-radius: 0.25rem;
            font-size: 0.75rem;
            font-weight: bold;
        }
        .diff-match {
            background-color: var(--success-light);
            color: var(--success);
        }
        .diff-mismatch {
            background-color: var(--danger-light);
            color: var(--danger);
        }
        
        .print-btn {
            background-color: white;
            color: var(--primary);
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            transition: transform 0.2s;
            margin-top: 1rem;
        }
        .print-btn:hover {
            transform: translateY(-2px);
        }
        @media print {
            body { background: white; padding: 0; }
            .header { box-shadow: none; color: black; background: none; border-bottom: 2px solid #000; }
            .card { box-shadow: none; border: 1px solid #ddd; page-break-inside: avoid; }
            .print-btn { display: none; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>דוח השוואת הגירת נתונים</h1>
            <p>השוואה מדויקת של ספירת הנתונים במערכת החדשה (Prisma) לעומת מערכת האקסס הישנה</p>
            <button class="print-btn" onclick="window.print()">הדפס דוח</button>
        </div>
`;

    for (const [model, fields] of Object.entries(prismaFields)) {
        const accessTableName = modelToAccessTable[model];
        html += `
        <div class="card">
            <div class="card-header">
                <h2>טבלת ${model}</h2>
                <div class="badge">טבלת מקור (אקסס): ${accessTableName || 'אין - טבלה חדשה'}</div>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>שדה במערכת (Prisma)</th>
                            <th>שדה מקביל (Access)</th>
                            <th>רשומות חדש</th>
                            <th>רשומות ישן</th>
                            <th>ערכים ייחודיים חדש</th>
                            <th>ערכים ייחודיים ישן</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let accessFieldsFound = [];
        
        for (const [fieldName, info] of Object.entries(fields)) {
            let totalCount = 0;
            let distinctCount = 0;
            
            if (info.hasData && info.hasData.totalCount !== undefined) {
                totalCount = info.hasData.totalCount;
                distinctCount = info.hasData.distinctCount;
            }
            
            let distinctStr = distinctCount > 1 ? `<span class="status-yes">כן (${distinctCount})</span>` : (distinctCount === 1 ? `<span class="status-no">לא (1)</span>` : '-');
            
            let cleanAccess = info.accessField;
            if (cleanAccess.includes('(')) cleanAccess = cleanAccess.split('(')[0].trim();
            if (cleanAccess.includes('-')) cleanAccess = cleanAccess.split('-')[0].trim();
            
            let accessTotalCount = '-';
            let accessDistinctStr = '-';
            let accDistCountRaw = 0;
            
            if (accessTableName && cleanAccess && cleanAccess !== 'ללא מקביל') {
                let exactColMatch = cleanAccess;
                if (accessCounts[accessTableName]) {
                    const tableCounts = accessCounts[accessTableName];
                    let colInfo = tableCounts[exactColMatch] || tableCounts[exactColMatch.replace(/_/g, ' ')] || tableCounts[exactColMatch.replace(/ /g, '_')];
                    
                    if (colInfo && colInfo.totalCount !== undefined) {
                        accessTotalCount = colInfo.totalCount;
                        accDistCountRaw = colInfo.distinctCount;
                        accessDistinctStr = accDistCountRaw > 1 ? `<span class="status-yes">כן (${accDistCountRaw})</span>` : (accDistCountRaw === 1 ? `<span class="status-no">לא (1)</span>` : '0');
                    } else if (colInfo && colInfo.error) {
                        accessTotalCount = '<span class="status-no">שגיאה</span>';
                        accessDistinctStr = '<span class="status-no">שגיאה</span>';
                    } else {
                        accessTotalCount = '<span class="status-warn">לא נמצא</span>';
                    }
                }
            }
            
            // Diff checking for total count
            let totalCountHtml = totalCount;
            let totalCountAccessHtml = accessTotalCount;
            
            if (accessTotalCount !== '-' && typeof accessTotalCount === 'number') {
                if (totalCount === accessTotalCount) {
                    totalCountHtml = `<div class="compare-cell">${totalCount} <span class="diff-indicator diff-match">תואם</span></div>`;
                } else {
                    totalCountHtml = `<div class="compare-cell">${totalCount} <span class="diff-indicator diff-mismatch">הפרש: ${totalCount - accessTotalCount}</span></div>`;
                }
            }

            html += `
                        <tr>
                            <td><span class="code">${fieldName}</span></td>
                            <td>${cleanAccess}</td>
                            <td>${totalCountHtml}</td>
                            <td>${totalCountAccessHtml}</td>
                            <td>${distinctStr}</td>
                            <td>${accessDistinctStr}</td>
                        </tr>
            `;
            
            if (cleanAccess && cleanAccess !== 'ללא מקביל' && cleanAccess !== 'Extracted manually if possible') {
                accessFieldsFound.push(cleanAccess.replace(/_/g, ' '));
                accessFieldsFound.push(cleanAccess);
            }
        }
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
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
                    html += `
            <div class="card-header" style="background-color: #fff1f2; border-top: 1px solid var(--border-color);">
                <h3 style="margin: 0; color: var(--danger); font-size: 1.1rem;">שדות באקסס ללא מקביל במערכת החדשה</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>שדה באקסס</th>
                            <th>רשומות באקסס</th>
                            <th>ערכים ייחודיים</th>
                            <th>סיבה לאי העברה</th>
                        </tr>
                    </thead>
                    <tbody>
                    `;
                    
                    for (const col of missingCols) {
                        let reason = 'סיבה לא ידועה (יתכן שיועבר בעתיד).';
                        if (col === 'הגדרות') reason = 'הגדרות טכניות ישנות ועיצוב טפסים.';
                        if (col.includes('מחוק')) reason = 'מנוהל חכם יותר באמצעות שדות מחיקה רכה (isDeleted).';
                        if (col.includes('ארכיון')) reason = 'סינון לוגי מתבצע בעת שליפה.';
                        if (col.includes('תאריך_מחיקה')) reason = 'מיוצג כיום ב-deletedAt או בשדה מחוק.';
                        if (col.includes('קוד')) reason = 'מזהה פנימי של Access, הומר למזהה UUID או id חדש.';
                        if (col.includes('הפניה')) reason = 'עבר לנתיב חכם של קשרי גומלין (Relations).';
                        
                        let aTotal = '-';
                        let aDist = '-';
                        if (accessCounts[accessTableName]) {
                            const colInfo = accessCounts[accessTableName][col];
                            if (colInfo && colInfo.totalCount !== undefined) {
                                aTotal = colInfo.totalCount;
                                const dC = colInfo.distinctCount;
                                aDist = dC > 1 ? `<span class="status-yes">כן (${dC})</span>` : (dC === 1 ? `<span class="status-no">לא (1)</span>` : '0');
                            }
                        }
                        
                        html += `
                        <tr>
                            <td style="font-weight: 600;">${col}</td>
                            <td>${aTotal}</td>
                            <td>${aDist}</td>
                            <td style="color: var(--text-muted);">${reason}</td>
                        </tr>
                        `;
                    }
                    html += `
                    </tbody>
                </table>
            </div>
                    `;
                }
            }
        }
        
        html += `</div>`;
    }
    
    html += `
    </div>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (error) {
    console.error(error);
    return new Response('Error generating report: ' + error.message, { status: 500 });
  }
}
