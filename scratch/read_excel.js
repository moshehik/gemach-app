const xlsx = require('xlsx');
const path = require('path');

const filePath = 'c:/Users/moshe/Desktop/גמח שמלות חדש/csv_exports/הזמנות_תשלום_ביצוע.xlsx';
const workbook = xlsx.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });

console.log("Headers:", data[0]);
console.log("Row 1:", data[1]);
