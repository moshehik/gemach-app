const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.next' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      if (f.endsWith('.js') || f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.jsx')) {
        callback(dirPath);
      }
    }
  });
}

async function main() {
  const settings = await prisma.systemSetting.findMany();
  console.log('Total settings in DB:', settings.length);
  
  const files = [];
  walkDir(path.join(__dirname, 'app'), (filePath) => {
    files.push({
      path: filePath,
      content: fs.readFileSync(filePath, 'utf8')
    });
  });
  walkDir(path.join(__dirname, 'lib'), (filePath) => {
    files.push({
      path: filePath,
      content: fs.readFileSync(filePath, 'utf8')
    });
  });
  walkDir(path.join(__dirname, 'components'), (filePath) => {
    files.push({
      path: filePath,
      content: fs.readFileSync(filePath, 'utf8')
    });
  });

  console.log('Total files checked:', files.length);

  for (const setting of settings) {
    if (setting.key === 'BRAND_LOGO') continue;
    let found = false;
    for (const file of files) {
      if (file.content.includes(setting.key) && !file.path.includes('SettingsClient') && !file.path.includes('analyze_settings')) {
        found = true;
        break;
      }
    }
    console.log(`Setting: ${setting.key} - Used: ${found}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
