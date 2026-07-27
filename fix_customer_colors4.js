const fs = require('fs');
let content = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// Replace primary blue with var(--primary-color)
content = content.replace(/#3b82f6/g, "var(--primary-color)");

// Replace light blue hover/bg with var(--primary-light)
content = content.replace(/#eff6ff/g, "var(--primary-light)");
content = content.replace(/#dbeafe/g, "var(--primary-light)");
content = content.replace(/#bfdbfe/g, "var(--primary-light)");

// Fix any var(--primary-color) inside single quotes that should be just a string
content = content.replace(/background:\s*'var\(--primary-color\)'/g, "background: 'var(--primary-color)'");

// For the calendar, if there's a border 2px solid var(--primary-color)
// We also have box-shadows using rgba(59,130,246,0.3) which is the blue color with opacity.
// Let's replace rgba(59, 130, 246, 0.3) with var(--shadow-lg) or just transparent in dark mode.
content = content.replace(/rgba\(59,\s*130,\s*246,\s*0\.3\)/g, "var(--border-color)");
content = content.replace(/rgba\(59,\s*130,\s*246,\s*0\.1\)/g, "var(--border-color)");

// The purple/pink gradient for AI chat:
content = content.replace(/linear-gradient\(135deg,\s*#a855f7,\s*#ec4899\)/g, "var(--gradient-primary)");
content = content.replace(/linear-gradient\(135deg,\s*#2563eb\s*0%,\s*#9333ea\s*100%\)/g, "var(--gradient-primary)");
content = content.replace(/linear-gradient\(135deg,\s*#a855f7,\s*#6366f1\)/g, "var(--gradient-primary)");

fs.writeFileSync('app/customer-interface/page.js', content, 'utf8');
console.log('Fixed blue colors to use primary variable.');
