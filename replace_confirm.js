const fs = require('fs');
const path = require('path');

const appDir = path.join(__dirname, 'app');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.js') || file.endsWith('.jsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(appDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;

  // Replace `window.confirm(` with `await window.customConfirm(`
  newContent = newContent.replace(/window\.confirm\(/g, 'await window.customConfirm(');
  
  // Replace `confirm(` with `await window.customConfirm(`
  // but be careful not to replace `window.customConfirm(` again!
  // use regex: match `confirm(` not preceded by `.`
  newContent = newContent.replace(/(?<!\.)confirm\(/g, 'await window.customConfirm(');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  }
});
console.log('Done!');
