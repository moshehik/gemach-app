import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

import prisma from '@/app/lib/prisma';

// Define correct insertion order to avoid Foreign Key constraint errors
const INSERTION_ORDER = [
  'Customer',
  'Employee',
  'DressModel',
  'PriceList',
  'SystemSetting',
  'PriceRule',
  'AuditLog',
  'EmailLog',
  'DressItem',
  'Order',
  'Payment',
  'PaymentObligation',
  'OrderItem',
  'Shift',
  'PageVisitLog'
];

export async function POST(req) {
  try {
    const data = await req.json();

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ success: false, error: 'פורמט הקובץ אינו נתמך. נדרש JSON תקין.' }, { status: 400 });
    }

    // 1. Validation Phase
    const dmmfModels = Prisma.dmmf.datamodel.models;
    const requiredTables = dmmfModels.map(m => m.name);

    // Validate that all tables exist in the uploaded JSON
    for (const tableName of requiredTables) {
      if (!data[tableName]) {
        return NextResponse.json({ 
          success: false, 
          error: `הקובץ חסר את הטבלה: ${tableName}. אנא ודא שזהו קובץ גיבוי שלם.` 
        }, { status: 400 });
      }
    }

    // Validate fields inside the tables match exactly
    for (const model of dmmfModels) {
      const tableName = model.name;
      const expectedFields = model.fields.map(f => f.name);
      
      const records = data[tableName];
      if (records.length > 0) {
        const sampleRecord = records[0];
        const actualFields = Object.keys(sampleRecord);
        
        for (const field of actualFields) {
          if (!expectedFields.includes(field)) {
            return NextResponse.json({ 
              success: false, 
              error: `שדה לא חוקי נמצא בטבלה ${tableName}: "${field}". השדה לא קיים במבנה המסד (schema).` 
            }, { status: 400 });
          }
        }
      }
    }

    // 2. Execution Phase (Transaction)
    // We use a transaction so if any insert fails, everything is rolled back.
    // First, we need to TRUNCATE all tables using a raw query to bypass constraints during deletion
    const tableNames = requiredTables.map(name => `"${name}"`).join(', ');
    
    await prisma.$transaction(async (tx) => {
      // Clear current DB
      console.log('Truncating tables...');
      await tx.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
      
      // Insert new data in dependency order
      for (const tableName of INSERTION_ORDER) {
        if (data[tableName] && data[tableName].length > 0) {
          console.log(`Inserting ${data[tableName].length} records into ${tableName}...`);
          
          const modelDelegate = tableName.charAt(0).toLowerCase() + tableName.slice(1);
          
          // createMany avoids hitting prepared statement limits for massive arrays
          // but for Neon, large arrays might still hit limits. Chunking to 5000 is safe.
          const chunkSize = 5000;
          for (let i = 0; i < data[tableName].length; i += chunkSize) {
            const chunk = data[tableName].slice(i, i + chunkSize);
            await tx[modelDelegate].createMany({
              data: chunk
            });
          }
        }
      }
    }, {
      timeout: 1000 * 60 * 5 // 5 minutes timeout for massive imports
    });

    return NextResponse.json({ success: true, message: 'הנתונים הוחלפו בהצלחה!' });

  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'אירעה שגיאה חמורה בעת החלפת הנתונים: ' + error.message 
    }, { status: 500 });
  }
}
