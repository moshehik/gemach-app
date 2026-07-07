const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const projectRoot = path.join(process.cwd(), '..');
const appRoot = process.cwd();
const statusFile = path.join(appRoot, 'migration_status.json');

function updateStatus(status, progress, message) {
  fs.writeFileSync(statusFile, JSON.stringify({ status, progress, message }));
  console.log(`[Status] ${message} (${progress}%)`);
}

function runCommand(command, cwd) {
  try {
    console.log(`Running: ${command} in ${cwd}`);
    execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(`Error running command: ${command}`);
    throw error;
  }
}

async function main() {
  try {
    const uploadedFile = path.join(projectRoot, 'uploads', 'AAA_uploaded.accdb');
    const accessFile = path.join(projectRoot, 'AAA.accdb');
    const dbFile = path.join(appRoot, 'prisma', 'dev.db');
    const backupsDir = path.join(projectRoot, 'backups');

    if (!fs.existsSync(uploadedFile)) {
      throw new Error('קובץ ההעלאה לא נמצא.');
    }

    // 1. Backup
    updateStatus('running', 10, 'מגבה קבצים קיימים...');
    if (!fs.existsSync(backupsDir)) {
      fs.mkdirSync(backupsDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupZip = path.join(backupsDir, `backup_${timestamp}.zip`);
    
    // Check if files exist to backup
    const filesToBackup = [];
    if (fs.existsSync(accessFile)) filesToBackup.push(`"${accessFile}"`);
    if (fs.existsSync(dbFile)) filesToBackup.push(`"${dbFile}"`);
    
    if (filesToBackup.length > 0) {
        const filesStr = filesToBackup.join(',');
        const psCommand = `Compress-Archive -Path ${filesStr} -DestinationPath "${backupZip}" -Force`;
        runCommand(`powershell -Command "${psCommand}"`, projectRoot);
    }

    // 2. Replace Access File
    updateStatus('running', 20, 'מעדכן קובץ אקסס...');
    fs.copyFileSync(uploadedFile, accessFile);
    fs.unlinkSync(uploadedFile); // Clean up temp file

    // 3. Export Access to Excel
    updateStatus('running', 30, 'מייצא נתונים מהאקסס (עשוי לקחת דקה)...');
    runCommand('powershell -ExecutionPolicy Bypass -File export_all.ps1', projectRoot);

    // 4. Run Migrations
    updateStatus('running', 50, 'מייבא נתוני בסיס (לקוחות, מלאי)...');
    runCommand('node scripts/migrate.js', appRoot);

    updateStatus('running', 70, 'מייבא הזמנות ותשלומים (עשוי לקחת מספר דקות)...');
    runCommand('node scripts/import_all_data.js', appRoot);

    updateStatus('running', 90, 'מייבא מחירונים והגדרות...');
    runCommand('node scripts/migrate_prices.js', appRoot);
    runCommand('node scripts/seed_settings.js', appRoot);

    // 5. Complete
    updateStatus('completed', 100, 'הייבוא הסתיים בהצלחה!');

  } catch (error) {
    console.error(error);
    updateStatus('error', 100, `שגיאה בתהליך: ${error.message}`);
  }
}

main();
