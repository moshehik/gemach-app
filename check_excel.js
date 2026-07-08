const xlsx = require('xlsx');
const path = require('path');
const wb = xlsx.readFile(path.join('..', 'csv_exports', 'שמלות_נתונים.xlsx'));
const sheet = wb.Sheets[wb.SheetNames[0]];
const data = xlsx.utils.sheet_to_json(sheet);
console.log("Keys:", Object.keys(data[0]));
console.log("First item:", data[0]);
