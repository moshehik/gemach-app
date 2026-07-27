const fs = require('fs');
let content = fs.readFileSync('app/globals.css', 'utf8');

// Check if --gradient-primary is defined in dark mode
if (!content.includes('--gradient-primary: linear-gradient(135deg, #5c3917, #3d230b);')) {
  content = content.replace(/(\[data-theme="dark"\]\s*\{[\s\S]*?)(?=\})/, "  --gradient-primary: linear-gradient(135deg, #5c3917, #3d230b);\n");
  fs.writeFileSync('app/globals.css', content, 'utf8');
  console.log('Added --gradient-primary to dark mode');
} else {
  console.log('Already there');
}
