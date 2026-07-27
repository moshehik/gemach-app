const fs = require('fs');
const lines = fs.readFileSync('ai-log.txt', 'utf8').split('\n');
for (const line of lines) {
  if (line.includes('תמוז') && (line.includes('יב') || line.includes('י"ב'))) {
    console.log(line.trim());
  }
}
