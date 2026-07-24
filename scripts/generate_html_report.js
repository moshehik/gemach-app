const fs = require('fs');

const md = fs.readFileSync('final_diffs_v4.md', 'utf8');

const htmlTemplate = `
<!DOCTYPE html>
<html lang="he" dir="rtl">
<head>
    <meta charset="UTF-8">
    <title>דוח פערי הגירה - השוואת נתונים</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; color: #1f2937; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #2563eb; text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background-color: #3b82f6; color: white; padding: 12px; text-align: right; }
        td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
        tr:hover { background-color: #f9fafb; }
        .gap-zero { color: #10b981; font-weight: bold; }
        .gap-positive { color: #f59e0b; font-weight: bold; }
        .gap-negative { color: #ef4444; font-weight: bold; }
        button { background-color: #3b82f6; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; margin-bottom: 20px; display: inline-flex; align-items: center; gap: 8px; }
        button:hover { background-color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <h1>דוח פערי נתונים - Access מול המערכת החדשה</h1>
        <button onclick="window.print()">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
            הדפס דוח
        </button>
        <table>
            <thead>
                <tr>
                    <th>טבלה</th>
                    <th>שדה במערכת החדשה</th>
                    <th>שדה מקביל באקסס</th>
                    <th>רשומות חדש</th>
                    <th>רשומות אקסס</th>
                    <th>פער</th>
                </tr>
            </thead>
            <tbody>
`;

let rowsHtml = '';
const lines = md.split('\n');
for (const line of lines) {
    if (!line.trim() || line.includes('---') || line.includes('טבלה |')) continue;
    const parts = line.split('|').map(p => p.trim()).filter(Boolean);
    if (parts.length === 6) {
        const gapText = parts[5].replace(/\*/g, '');
        const gapNum = parseInt(gapText);
        let gapClass = 'gap-zero';
        if (gapNum > 0) gapClass = 'gap-positive';
        else if (gapNum < 0) gapClass = 'gap-negative';
        
        rowsHtml += `
                <tr>
                    <td>${parts[0].replace(/\*\*/g, '')}</td>
                    <td><code style="background:#f1f5f9;padding:2px 5px;border-radius:4px">${parts[1].replace(/`/g, '')}</code></td>
                    <td>${parts[2]}</td>
                    <td>${parts[3]}</td>
                    <td>${parts[4]}</td>
                    <td class="${gapClass}" dir="ltr" style="text-align: right">${gapText}</td>
                </tr>
`;
    }
}

const finalHtml = htmlTemplate + rowsHtml + `
            </tbody>
        </table>
    </div>
</body>
</html>`;

fs.writeFileSync('public/migration_report.html', finalHtml);
console.log('HTML report generated at public/migration_report.html');
