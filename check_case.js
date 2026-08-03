const fs = require('fs');
const path = require('path');

function checkDir(dir) {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory() && file !== 'node_modules' && file !== '.next') {
            checkDir(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx')) {
            const content = fs.readFileSync(fullPath, 'utf8');
            const importRegex = /import.*?from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                const importPath = match[1];
                if (importPath.startsWith('.') || importPath.startsWith('@/')) {
                    let resolvedPath = importPath;
                    if (importPath.startsWith('@/')) {
                        resolvedPath = path.join(__dirname, importPath.substring(2));
                    } else {
                        resolvedPath = path.join(dir, importPath);
                    }
                    
                    if (!resolvedPath.endsWith('.js') && !resolvedPath.endsWith('.jsx')) {
                        if (fs.existsSync(resolvedPath + '.js')) resolvedPath += '.js';
                        else if (fs.existsSync(resolvedPath + '.jsx')) resolvedPath += '.jsx';
                        else if (fs.existsSync(path.join(resolvedPath, 'index.js'))) resolvedPath = path.join(resolvedPath, 'index.js');
                    }
                    
                    if (fs.existsSync(resolvedPath)) {
                        const dirName = path.dirname(resolvedPath);
                        const baseName = path.basename(resolvedPath);
                        const actualFiles = fs.readdirSync(dirName);
                        if (!actualFiles.includes(baseName)) {
                            console.log('CASE SENSITIVITY ERROR in ' + fullPath);
                            console.log('Imported: ' + importPath);
                            console.log('Expected: ' + baseName);
                            console.log('Found in dir: ' + actualFiles.find(f => f.toLowerCase() === baseName.toLowerCase()));
                        }
                    }
                }
            }
        }
    }
}

checkDir(__dirname + '/app');
checkDir(__dirname + '/components');
checkDir(__dirname + '/lib');
