const fs = require('fs');
const path = require('path');

function searchFiles(dir, queries) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        searchFiles(fullPath, queries);
      }
    } else if (fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (queries.some(q => content.includes(q))) {
        console.log(`Found in: ${fullPath}`);
        const lines = content.split('\n');
        lines.forEach((line, i) => {
           if (queries.some(q => line.includes(q))) {
             console.log(`${i+1}: ${line.trim()}`);
           }
        });
      }
    }
  }
}

searchFiles(path.join(__dirname, 'app'), ['מחק', 'פרטים', 'תשלומים']);
searchFiles(path.join(__dirname, 'components'), ['מחק', 'פרטים', 'תשלומים']);
