const fs = require('fs');
let code = fs.readFileSync('app/api/ai/route.js', 'utf8');

const filterInstruction = `\n\nSystem Context/Instructions:\n\${context}`;

// Inject into first followupPrompt (CHECK_AVAILABILITY)
code = code.replace(
  /Summarize the information nicely\.\`;/,
  `Summarize the information nicely.\${context ? \`\\n\\nSystem Instructions:\\n\${context}\` : ''}\`;`
);

// Inject into second followupPrompt (SQL queries)
code = code.replace(
  /Summarize the information nicely as a helpful customer service representative\. For example, instead of listing all items, say "יש 5 שמלות פנויות במידות 38-42"\.\`;/,
  `Summarize the information nicely as a helpful customer service representative. For example, instead of listing all items, say "יש 5 שמלות פנויות במידות 38-42".\${context ? \`\\n\\nSystem Instructions:\\n\${context}\` : ''}\`;`
);

fs.writeFileSync('app/api/ai/route.js', code, 'utf8');
console.log('API route patched to preserve frontend context.');
