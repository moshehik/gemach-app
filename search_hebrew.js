const fs = require('fs');
const path = require('path');
function searchDir(dir, terms) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next' && file !== '.git') {
        searchDir(fullPath, terms);
      }
    } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      terms.forEach(term => {
        if (content.includes(term)) {
          console.log(`Found '${term}' in ${fullPath}`);
        }
      });
    }
  }
}
searchDir('.', ['זמינות לקוח', 'היסטור', 'זמינות', 'History']);
