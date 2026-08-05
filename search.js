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
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.html')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const term of terms) {
        if (content.includes(term)) {
          console.log('Found ' + term + ' in: ' + fullPath);
          break;
        }
      }
    }
  }
}

searchDir('.', ['הודעות', 'שגיא', 'דיווח']);
