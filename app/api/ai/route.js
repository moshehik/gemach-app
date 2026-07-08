import { NextResponse } from 'next/server';
import { generateContent } from '../../../lib/ai/gemini';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { cookies } from 'next/headers';


const SCHEMA_CONTEXT = `
Here is the PostgreSQL database schema for the system:

model Customer { id Int, firstName String, lastName String, phone1 String, phone2 String, city String, street String, houseNum Int, email String, notes String, isDeleted Boolean }
model Order { id Int, orderId Int, customerId Int, totalAmount Float, paymentDate DateTime, paymentMethod String, status String, isPaid Boolean, isDeleted Boolean, eventDate DateTime, returnDate DateTime }
model DressModel { id Int, name String, priceCategory String, inInspection Boolean }
model DressItem { id Int, dressModelId Int, dressName String, barcodePrefix Int, sizeText String, serialNumber Int, dressBarcode String, location String, locationNum Int, quantity Int, inRepair Boolean, notInUse Boolean }
model OrderItem { id Int, orderId Int, dressItemId Int, price Float, sizeText String, finalPrice Float, isTaken Boolean, isReturned Boolean, returnedOk Boolean }
model Employee { id Int, firstName String, lastName String, roleId Int, isActive Boolean }
model Shift { id Int, employeeId Int, entryTime DateTime, exitTime DateTime }
model PriceList { id Int, description String, category String, price Float }
`;

const SYSTEM_PROMPT = `You are a helpful and smart AI assistant for the 'Gemach' system (a dress rental management system). 
You have access to the PostgreSQL database schema shown below.
${SCHEMA_CONTEXT}

When the user asks a question that requires data from the database, you must FIRST output ONLY a valid PostgreSQL SQL query starting with the exact prefix "SQL: ". 
For example, if asked "How many customers do we have?", output:
SQL: SELECT COUNT(*) as "כמות לקוחות" FROM "Customer" WHERE "isDeleted" = false;

Rules for SQL query generation:
1. Do NOT include markdown formatting or backticks (\`\`\`) around the SQL query.
2. The query must be valid PostgreSQL syntax.
3. VERY IMPORTANT FOR DATES: Use PostgreSQL date functions like EXTRACT(YEAR FROM "eventDate") = 2024. If the user searches by Hebrew month (e.g. 'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'), you MUST map them roughly to their Gregorian month numbers using EXTRACT(MONTH FROM ...). (e.g. 9 or 10 for Tishrei, 10 or 11 for Cheshvan, 11 or 12 for Kislev, 12 or 1 for Tevet, 1 or 2 for Shvat, 2 or 3 for Adar, 3 or 4 for Nisan, 4 or 5 for Iyar, 5 or 6 for Sivan, 6 or 7 for Tamuz, 7 or 8 for Av, 8 or 9 for Elul) and query the relevant date fields. For example: EXTRACT(MONTH FROM "eventDate") IN (7, 8) for Av.
4. IMPORTANT: Always quote table names and column names with double quotes because PostgreSQL is case-sensitive with identifiers created by Prisma (e.g. "Customer", "firstName", "Order", "isDeleted").
5. Be aware of the field names exactly as defined in the schema.
6. If it's a general question that doesn't need database access, just answer it naturally in Hebrew without the "SQL: " prefix.
7. IMPORTANT: When selecting columns, ALWAYS use 'AS' to alias the column names into Hebrew using double quotes. For example: SELECT "firstName" AS "שם פרטי", "lastName" AS "שם משפחה". DO NOT return English column names in the output.
8. IMPORTANT: Feel free to use GROUP BY, JOINs, and aggregation functions (SUM, COUNT) if the user asks for grouped data, summaries, or cross-referenced data.`;

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { prompt, history = [], context = '' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Format history into a string
    const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');
    
    // Employee Classification Protections
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    let employeeContext = '';
    if (token && token.value) {
      const employee = await prisma.employee.findUnique({ where: { id: parseInt(token.value) } });
      if (employee) {
        // Assume roleId 1 is Manager/Admin. If not 1, restrict data.
        if (employee.roleId !== 1 && employee.roleId !== 2) {
          employeeContext = `\nCRITICAL SECURITY RULE: The current user is a standard employee (Role: ${employee.roleId}). Do NOT provide any sensitive financial data (such as total revenues, employee wages, or overall business statistics). Only answer questions related to daily operations like customers, orders, or dress inventory.`;
        } else {
          employeeContext = `\nUser Role: Manager/Admin. Full access to all data is permitted.`;
        }
      }
    }

    // Step 1: Ask the AI for SQL or a direct answer
    const initialPrompt = `${SYSTEM_PROMPT}${employeeContext}\n\nSystem Context/Instructions:\n${context}\n\nChat History Context:\n${historyText}\n\nCurrent User Question: ${prompt}`;
    let aiResponse = await generateContent(initialPrompt);
    let tableData = null;
    let sqlQueryToReturn = null;

    // Step 2: Check if the AI returned a SQL query
    if (aiResponse.trim().startsWith('SQL:')) {
      let sqlQuery = aiResponse.trim().replace(/^SQL:\s*/i, '').trim();
      
      // Clean up markdown
      if (sqlQuery.startsWith('\`\`\`sql')) sqlQuery = sqlQuery.replace(/^\`\`\`sql/, '');
      if (sqlQuery.startsWith('\`\`\`')) sqlQuery = sqlQuery.replace(/^\`\`\`/, '');
      if (sqlQuery.endsWith('\`\`\`')) sqlQuery = sqlQuery.replace(/\`\`\`$/, '');
      sqlQuery = sqlQuery.trim();

      let queryResult = null;
      let dbErrorStr = null;

      try {
        console.log('AI generated SQL query:', sqlQuery);
        queryResult = await prisma.$queryRawUnsafe(sqlQuery);
        tableData = queryResult;
        sqlQueryToReturn = sqlQuery;
      } catch (dbError) {
        console.error('AI DB Query Error attempt 1:', dbError.message);
        dbErrorStr = dbError.message;
        
        // SELF HEALING RETRY
        const retryPrompt = `${SYSTEM_PROMPT}\n\nUser Question: ${prompt}\n\nYou generated this SQL query: ${sqlQuery}\nBut it failed with this PostgreSQL error: ${dbErrorStr}\n\nPlease output ONLY a corrected PostgreSQL SQL query starting with "SQL: " to fix this issue.`;
        let retryResponse = await generateContent(retryPrompt);
        
        if (retryResponse.trim().startsWith('SQL:')) {
          let retrySql = retryResponse.trim().replace(/^SQL:\s*/i, '').trim();
          if (retrySql.startsWith('\`\`\`sql')) retrySql = retrySql.replace(/^\`\`\`sql/, '');
          if (retrySql.startsWith('\`\`\`')) retrySql = retrySql.replace(/^\`\`\`/, '');
          if (retrySql.endsWith('\`\`\`')) retrySql = retrySql.replace(/\`\`\`$/, '');
          retrySql = retrySql.trim();
          
          try {
             console.log('AI generated Retry SQL query:', retrySql);
             queryResult = await prisma.$queryRawUnsafe(retrySql);
             tableData = queryResult;
             sqlQuery = retrySql; // Update for the summary prompt
             sqlQueryToReturn = retrySql;
             dbErrorStr = null; // Success!
          } catch (retryErr) {
             console.error('AI DB Query Error attempt 2:', retryErr.message);
             dbErrorStr = retryErr.message;
          }
        }
      }

      if (dbErrorStr) {
         aiResponse = "מצטער, נתקלתי בשגיאה בעת שליפת הנתונים מהמסד (שגיאת תחביר שאילתה). אנא נסה לנסח את השאלה אחרת.";
      } else {
        // Step 3: Ask the AI to summarize the result
        const followupPrompt = `The user asked: "${prompt}".
You generated this SQL query: ${sqlQuery}
The database returned this JSON result: ${JSON.stringify(queryResult, (key, value) => typeof value === 'bigint' ? value.toString() : value)}
Please provide a short, clear, and friendly natural language answer to the user in Hebrew based on these database results. 
DO NOT tell the user you are showing a table, and DO NOT output raw JSON or Markdown tables. 
Summarize the information nicely as a helpful customer service representative. For example, instead of listing all items, say "יש לנו 5 שמלות מדגם זה במידות 38-42".`;
        
        aiResponse = await generateContent(followupPrompt);
      }
    }

    return NextResponse.json({ response: aiResponse, tableData, sqlQuery: sqlQueryToReturn });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}

