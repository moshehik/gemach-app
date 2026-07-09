const fs = require('fs');
const path = require('path');

// 1. Update package.json version
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let pkg;
try {
  pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (e) {
  console.error("Could not read package.json", e);
  process.exit(1);
}

const versionParts = (pkg.version || '1.0.0').split('.');
if (versionParts.length === 3) {
  versionParts[2] = parseInt(versionParts[2], 10) + 1;
} else {
  versionParts.push('1');
}
pkg.version = versionParts.join('.');
fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '\n');

// 2. Format current date DD/MM/YYYY HH:MM
const now = new Date();
const pad = (n) => n.toString().padStart(2, '0');
const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

// 3. Write to app/version.json
const versionDataPath = path.join(__dirname, '..', 'app', 'version.json');
const versionData = {
  version: pkg.version,
  date: dateStr
};
fs.writeFileSync(versionDataPath, JSON.stringify(versionData, null, 2) + '\n');

console.log(`Successfully updated version to ${pkg.version} and build time to ${dateStr}`);
