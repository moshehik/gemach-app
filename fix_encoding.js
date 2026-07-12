const fs = require('fs');
let code = fs.readFileSync('scripts/import_all_data.js', 'utf8');

const regex = /orderItemId:\s*\(p\['[^\]]+'\].+null/;
if (code.match(regex)) {
  const goodLine = "orderItemId: (p['קוד_פריט'] && validOrderItemIds.has(parseInt(p['קוד_פריט']))) ? parseInt(p['קוד_פריט']) : null";
  code = code.replace(regex, goodLine);
  fs.writeFileSync('scripts/import_all_data.js', code);
  console.log('Fixed mangled Hebrew');
} else {
  console.log('Could not find the mangled line');
}
