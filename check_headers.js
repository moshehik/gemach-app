const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const workbook = xlsx.readFile(path.join('c:', 'Users', 'moshe', 'Desktop', 'גמח שמלות חדש', 'csv_exports', 'הזמנות_מלא_פעילים_2.xlsx'));
const sheetName = workbook.SheetNames[0];
const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
console.log(data[0]); // headers
