const xlsx = require('xlsx');

async function checkAccessExport() {
  try {
    const workbook = xlsx.readFile('c:/Users/moshe/Desktop/גמח שמלות חדש/csv_exports/שמלות_דגמים.xlsx');
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    const res333 = data.find(row => {
      // search for 333 in any column just to be safe
      return Object.values(row).some(v => String(v).includes('333'));
    });
    
    console.log("Found in שמלות_דגמים:", res333 || "Not found");
  } catch(e) {
    console.log("Error reading שמלות_דגמים", e.message);
  }

  try {
    const workbook2 = xlsx.readFile('c:/Users/moshe/Desktop/גמח שמלות חדש/csv_exports/שמלות_נתונים.xlsx');
    const sheetName2 = workbook2.SheetNames[0];
    const sheet2 = workbook2.Sheets[sheetName2];
    const data2 = xlsx.utils.sheet_to_json(sheet2);
    
    const res333_2 = data2.find(row => {
      return Object.values(row).some(v => String(v).includes('333'));
    });
    
    console.log("Found in שמלות_נתונים:", res333_2 || "Not found");
  } catch(e) {
     console.log("Error reading שמלות_נתונים", e.message);
  }
}

checkAccessExport();
