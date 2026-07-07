const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const outDir = path.resolve(__dirname, '../csv_exports');
const files = fs.readdirSync(outDir).filter(f => f.endsWith('.xlsx'));

for (const file of files) {
  try {
    const workbook = xlsx.readFile(path.join(outDir, file));
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    
    if (data.length < 2) continue;
    
    const headers = data[0] || [];
    const orderIdIdx = headers.findIndex(h => h === 'קוד_הזמנה' || h === 'הזמנה');
    const itemIdIdx = headers.findIndex(h => h === 'קוד_פריט');
    
    if (orderIdIdx !== -1 && itemIdIdx !== -1) {
      let maxOrderId = 0;
      let count = 0;
      for (let i = 1; i < data.length; i++) {
        const val = parseInt(data[i][orderIdIdx]);
        if (!isNaN(val)) {
          if (val > maxOrderId) maxOrderId = val;
          count++;
        }
      }
      console.log(`ORDER ITEMS FILE: ${file} | Max orderId = ${maxOrderId} | Count = ${count}`);
    }
  } catch (err) {
    // ignore
  }
}
