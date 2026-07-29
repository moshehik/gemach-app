const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, 'app');

// Hebrew prefixes for different element types
const prefixes = {
  button: 'כפתור_',
  input: 'שדה_',
  select: 'בחירה_',
  textarea: 'טקסט_',
  onClick: 'לחיץ_',
  default: 'רכיב_'
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Extract component name from file path
  const componentName = path.basename(filePath, path.extname(filePath));
  
  let elementCounter = 1;

  function generateName(type) {
    return `${prefixes[type] || prefixes.default}${componentName}_${elementCounter++}`;
  }

  // Regex to match JSX tags: <TagName ... > or <TagName ... />
  // We want to avoid modifying elements that already have data-element-name
  const tagRegex = /<([A-Za-z0-9_.]+)(\s+[^>]+?)?(\/?)>/g;

  content = content.replace(tagRegex, (match, tagName, attrs, selfClose) => {
    // Skip if already has data-element-name
    if (attrs && attrs.includes('data-element-name=')) {
      return match;
    }

    let type = 'default';
    const tagLower = tagName.toLowerCase();
    
    if (tagLower === 'button') type = 'button';
    else if (tagLower === 'input') type = 'input';
    else if (tagLower === 'select') type = 'select';
    else if (tagLower === 'textarea') type = 'textarea';
    else if (attrs && attrs.includes('onClick=')) type = 'onClick';
    else {
      // Don't inject into standard non-interactive elements unless it's a structural component we want
      // For now, let's only do interactive elements and components that start with uppercase (React components)
      const isComponent = tagName[0] === tagName[0].toUpperCase();
      if (!isComponent) {
         return match;
      }
      type = 'default';
    }

    const uniqueName = generateName(type);
    
    // Inject the attribute
    if (attrs) {
      // Insert after the tag name
      return `<${tagName} data-element-name="${uniqueName}"${attrs}${selfClose}>`;
    } else {
      return `<${tagName} data-element-name="${uniqueName}"${selfClose}>`;
    }
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      walkDir(fullPath);
    } else if (stat.isFile() && (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.tsx'))) {
      processFile(fullPath);
    }
  }
}

walkDir(appDir);
console.log('Finished injecting unique names.');
