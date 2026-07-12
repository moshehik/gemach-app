const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (isDirectory) {
            walk(dirPath, callback);
        } else if (dirPath.endsWith('.js') || dirPath.endsWith('.jsx')) {
            callback(dirPath);
        }
    });
}

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // Replace hover backgrounds that are light gray
    // target.style.background = '#f9f9f9'
    let regexHover = /(style\.background(?:Color)?\s*=\s*)(['"])(#f9f9f9|#f5f5f5|#e5e7eb|#fafafa)\2/gi;
    let match;
    while ((match = regexHover.exec(content)) !== null) {
        content = content.slice(0, match.index) + 
                  match[1] + 
                  match[2] + "var(--element-bg)" + match[2] + 
                  content.slice(match.index + match[0].length);
        regexHover.lastIndex = 0;
    }

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log("Updated: " + filePath);
    }
}

walk(path.join(__dirname, 'app'), processFile);
walk(path.join(__dirname, 'components'), processFile);
