
const xlsx = require('xlsx');
const path = require('path');

import prisma from '@/app/lib/prisma';
const outDir = path.resolve(__dirname, '../../csv_exports');

function readExcelTable(tableName) {
  const filePath = path.join(outDir, `${tableName}.xlsx`);
  try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    return data;
  } catch (err) {
    console.error(`Warning: Could not read table ${tableName} at ${filePath}`);
    return [];
  }
}

// Helper to convert excel date to JS Date
function excelDateToJSDate(serial) {
  if (!serial) return null;
  // Excel serial dates: days since Dec 30, 1899
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  
  return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
}

async function migrateEmployees() {
  console.log('Starting data migration for Employees and Shifts...');

  try {
    console.log('1. Migrating Employees (עובדים)...');
    const employees = readExcelTable('עובדים');
    let empCount = 0;
    
    for (const e of employees) {
      if (!e['שם_פרטי'] && !e['שם_משפחה'] && !e['שם_מלא']) continue;
      
      const empId = e['קוד_עובד'] || undefined;
      const isActive = e['לא_פעיל'] !== true && e['לא_פעיל'] !== 1 && String(e['לא_פעיל']) !== 'Yes' && String(e['לא_פעיל']).toLowerCase() !== 'true';
      const isTravelExpenses = e['נסיעות'] === true || e['נסיעות'] === 1 || String(e['נסיעות']) === 'Yes' || String(e['נסיעות']).toLowerCase() === 'true';

      const data = {
        firstName: e['שם_פרטי'] ? String(e['שם_פרטי']) : null,
        lastName: e['שם_משפחה'] ? String(e['שם_משפחה']) : null,
        phone1: e['טלפון_1'] ? String(e['טלפון_1']) : null,
        phone2: e['טלפון_2'] ? String(e['טלפון_2']) : null,
        city: e['עיר'] ? String(e['עיר']) : null,
        street: e['רחוב'] ? String(e['רחוב']) : null,
        houseNum: e['בית'] ? String(e['בית']) : null,
        email: e['מייל'] ? String(e['מייל']) : null,
        joinDate: typeof e['תאריך_כניסה_לארגון'] === 'number' ? excelDateToJSDate(e['תאריך_כניסה_לארגון']) : (e['תאריך_כניסה_לארגון'] ? new Date(e['תאריך_כניסה_לארגון']) : null),
        fullName: e['שם_מלא'] ? String(e['שם_מלא']) : null,
        notes: e['הערות'] ? String(e['הערות']) : null,
        emailSuffix: e['סיומת_מייל'] ? String(e['סיומת_מייל']) : null,
        roleId: e['מס_מחלקה'] ? parseInt(e['מס_מחלקה'], 10) : null,
        password: e['סיסמא'] ? String(e['סיסמא']) : null,
        isActive: isActive,
        hourlyWage: e['שכר_שעה'] ? parseFloat(e['שכר_שעה']) : null,
        paymentMethod: e['אופן_תשלום'] ? String(e['אופן_תשלום']) : null,
        travelExpenses: isTravelExpenses
      };

      await prisma.employee.upsert({
        where: { id: empId || -1 },
        update: data,
        create: {
          id: empId,
          ...data
        }
      });
      empCount++;
    }
    console.log(`Successfully migrated ${empCount} employees.`);

    console.log('2. Migrating Shifts (עובדים_נוכחות)...');
    const shifts = readExcelTable('עובדים_נוכחות');
    let shiftCount = 0;
    
    for (const s of shifts) {
      if (!s['קוד_עובד']) continue;
      
      const shiftId = s['קוד'] || undefined;
      const entryTime = typeof s['שעת_כניסה'] === 'number' ? excelDateToJSDate(s['שעת_כניסה']) : (s['שעת_כניסה'] ? new Date(s['שעת_כניסה']) : null);
      const exitTime = typeof s['שעת_יציאה'] === 'number' ? excelDateToJSDate(s['שעת_יציאה']) : (s['שעת_יציאה'] ? new Date(s['שעת_יציאה']) : null);
      
      let date = entryTime || exitTime || new Date();

      const data = {
        employeeId: parseInt(s['קוד_עובד'], 10),
        entryTime: entryTime,
        exitTime: exitTime,
        hebrewDate: s['תאריך_עברי'] ? String(s['תאריך_עברי']) : null,
        date: date
      };

      try {
        await prisma.shift.upsert({
          where: { id: shiftId || -1 },
          update: data,
          create: {
            id: shiftId,
            ...data
          }
        });
        shiftCount++;
      } catch (err) {
        if (err.code === 'P2003') {
          console.warn(`Skipping shift ${shiftId} because employee ${data.employeeId} does not exist.`);
        } else {
          console.error(`Error migrating shift ${shiftId}:`, err.message);
        }
      }
    }
    console.log(`Successfully migrated ${shiftCount} shifts.`);

    console.log('Migration completed successfully!');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrateEmployees();
