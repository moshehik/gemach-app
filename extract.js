const cp = require('child_process');
const fs = require('fs');

const oldC = cp.execSync('git show HEAD:app/customer-interface/page.js', {encoding: 'utf8'});
const startIdx = oldC.indexOf('  return (\n    <div className="layout-container"');
const endStr = '.print-report { display: none !important; }\n        }\n      `}} />';
const endIdx = oldC.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
  const missingCode = oldC.substring(startIdx, endIdx + endStr.length);
  fs.writeFileSync('missing.txt', missingCode);
  console.log('Saved to missing.txt');
} else {
  console.log('Not found in git show. startIdx=', startIdx, ' endIdx=', endIdx);
}
