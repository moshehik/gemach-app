const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'Users', 'moshe', 'Desktop', 'גמח שמלות חדש', 'access_code', 'Modules', 'הזמנות.txt');
const buf = fs.readFileSync(filePath);
const decoder = new TextDecoder('windows-1255');
const content = decoder.decode(buf);

// Let's also read the forms
const formPath = path.join('c:', 'Users', 'moshe', 'Desktop', 'גמח שמלות חדש', 'access_code', 'Forms', 'כרטיס_הזמנה_תשלום.txt');
const bufForm = fs.readFileSync(formPath);
const contentForm = decoder.decode(bufForm);

fs.writeFileSync('modules_orders_utf8_temp.txt', content, 'utf8');
fs.writeFileSync('form_payment_utf8_temp.txt', contentForm, 'utf8');

console.log("Converted successfully.");
