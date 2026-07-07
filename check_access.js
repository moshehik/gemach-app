const xlsx = require('xlsx');

function checkOrder() {
  const workbook = xlsx.readFile('../csv_exports/הזמנות_פרטים.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
  
  const orderItems = data.filter(row => row['קוד_הזמנה'] == 26109 || row['קוד_הזמנה'] == 26108 || row['קוד_הזמנה'] == 26100);
  console.log('Found items for recent orders in Access export:', orderItems.length);
  if (orderItems.length > 0) {
    console.log(orderItems.slice(0, 2));
  }
}

checkOrder();
