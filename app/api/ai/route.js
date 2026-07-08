import { NextResponse } from 'next/server';
import { generateContent } from '../../../lib/ai/gemini';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

let cachedSchema = null;
function getSchemaContext() {
  if (cachedSchema) return cachedSchema;
  try {
    const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
    const fullSchema = fs.readFileSync(schemaPath, 'utf8');
    // Strip comments to save tokens
    const cleanSchema = fullSchema.replace(/\/\/.*/g, '').replace(/\n\s*\n/g, '\n').trim();
    cachedSchema = `Here is the FULL PostgreSQL database schema for the system:\n\n${cleanSchema}`;
    return cachedSchema;
  } catch (e) {
    console.error('Error reading schema', e);
    return 'Error reading schema.';
  }
}

const SYSTEM_PROMPT_BASE = `You are a helpful and smart AI assistant for the 'Gemach' system (a dress rental management system). 
You have access to the FULL PostgreSQL database schema provided below.

When the user asks a question that requires data from the database, you must FIRST output one or more valid PostgreSQL SQL queries. 
Each query MUST start with the exact prefix "SQL: " on a new line. 
For example:
SQL: SELECT COUNT(*) as "כמות לקוחות" FROM "Customer" WHERE "isDeleted" = false;

If you need data from multiple tables that cannot be easily joined, you can output multiple queries.
For example:
SQL: SELECT * FROM "Customer" WHERE city='Jerusalem';
SQL: SELECT * FROM "Order" WHERE "isPaid"=false;

Rules for SQL query generation:
1. Do NOT include markdown formatting or backticks (\`\`\`) around the SQL query.
2. The query must be valid PostgreSQL syntax.
3. VERY IMPORTANT FOR DATES: Use PostgreSQL date functions like EXTRACT(YEAR FROM "eventDate") = 2024. If the user searches by Hebrew month (e.g. 'תשרי', 'חשוון', 'כסלו', 'טבת', 'שבט', 'אדר', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול'), you MUST map them roughly to their Gregorian month numbers using EXTRACT(MONTH FROM ...). (e.g. 9 or 10 for Tishrei, 10 or 11 for Cheshvan, 11 or 12 for Kislev, 12 or 1 for Tevet, 1 or 2 for Shvat, 2 or 3 for Adar, 3 or 4 for Nisan, 4 or 5 for Iyar, 5 or 6 for Sivan, 6 or 7 for Tamuz, 7 or 8 for Av, 8 or 9 for Elul) and query the relevant date fields. For example: EXTRACT(MONTH FROM "eventDate") IN (7, 8) for Av.
4. IMPORTANT: Always quote table names and column names with double quotes because PostgreSQL is case-sensitive with identifiers created by Prisma (e.g. "Customer", "firstName", "Order", "isDeleted").
5. Be aware of the field names exactly as defined in the schema.
6. If it's a general question that doesn't need database access, just answer it naturally in Hebrew without the "SQL: " prefix.
7. IMPORTANT: When selecting columns, ALWAYS use 'AS' to alias the column names into Hebrew using double quotes. For example: SELECT "firstName" AS "שם פרטי", "lastName" AS "שם משפחה". DO NOT return English column names in the output.
8. IMPORTANT: Whenever querying orders or events, ALWAYS select "eventDateHebrew" as the primary date to display to the user, since the system prefers Hebrew dates.
9. IMPORTANT: Feel free to use GROUP BY, JOINs, and aggregation functions (SUM, COUNT) if the user asks for grouped data, summaries, or cross-referenced data.
10. IMPORTANT UI FEATURE: If you want to provide a clickable action button for a row (like viewing a customer, order, or rental), you MUST include two hidden columns in your query: "_actionUrl" and "_actionLabel". For example: SELECT "firstName" AS "שם", '/customers/' || id AS "_actionUrl", 'תיק לקוח' AS "_actionLabel" FROM "Customer". The frontend will automatically convert these into a button at the end of the row.`;

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { prompt, history = [], context = '' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');
    
    // Employee Classification Protections
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token');
    let employeeContext = '';
    if (token && token.value) {
      const employee = await prisma.employee.findUnique({ where: { id: parseInt(token.value) } });
      if (employee) {
        if (employee.roleId !== 1 && employee.roleId !== 2) {
          employeeContext = `\nCRITICAL SECURITY RULE: The current user is a standard employee (Role: ${employee.roleId}). Do NOT provide any sensitive financial data (such as total revenues, employee wages, or overall business statistics). Only answer questions related to daily operations like customers, orders, or dress inventory.`;
        } else {
          employeeContext = `\nUser Role: Manager/Admin. Full access to all data is permitted.`;
        }
      }
    }

    const schemaText = getSchemaContext();
    const initialPrompt = `${SYSTEM_PROMPT_BASE}\n\n${schemaText}\n${employeeContext}\n\nSystem Context/Instructions:\n${context}\n\nChat History Context:\n${historyText}\n\nCurrent User Question: ${prompt}`;
    
    let aiResponse = await generateContent(initialPrompt);
    let tableData = null;
    let sqlQueryToReturn = null;

    // Check if AI returned SQL queries
    const sqlRegex = /SQL:\s*(.+)/gi;
    let match;
    const queries = [];
    while ((match = sqlRegex.exec(aiResponse)) !== null) {
      let q = match[1].trim();
      if (q.startsWith('\`\`\`sql')) q = q.replace(/^\`\`\`sql/, '');
      if (q.startsWith('\`\`\`')) q = q.replace(/^\`\`\`/, '');
      if (q.endsWith('\`\`\`')) q = q.replace(/\`\`\`$/, '');
      queries.push(q.trim());
    }

    if (queries.length > 0) {
      let combinedResults = [];
      let dbErrorStr = null;

      try {
        for (let i = 0; i < queries.length; i++) {
          console.log(`AI generated SQL query ${i + 1}:`, queries[i]);
          const res = await prisma.$queryRawUnsafe(queries[i]);
          combinedResults.push(res);
        }
      } catch (dbError) {
        console.error('AI DB Query Error attempt 1:', dbError.message);
        dbErrorStr = dbError.message;
        
        // SELF HEALING RETRY
        const retryPrompt = `${SYSTEM_PROMPT_BASE}\n\n${schemaText}\n\nUser Question: ${prompt}\n\nYou generated these SQL queries:\n${queries.join('\n')}\nBut it failed with this PostgreSQL error: ${dbErrorStr}\n\nPlease output ONLY corrected PostgreSQL SQL queries starting with "SQL: " to fix this issue.`;
        let retryResponse = await generateContent(retryPrompt);
        
        const retryQueries = [];
        let rMatch;
        while ((rMatch = sqlRegex.exec(retryResponse)) !== null) {
          let rq = rMatch[1].trim();
          if (rq.startsWith('\`\`\`sql')) rq = rq.replace(/^\`\`\`sql/, '');
          if (rq.startsWith('\`\`\`')) rq = rq.replace(/^\`\`\`/, '');
          if (rq.endsWith('\`\`\`')) rq = rq.replace(/\`\`\`$/, '');
          retryQueries.push(rq.trim());
        }

        if (retryQueries.length > 0) {
          try {
            combinedResults = [];
            for (let i = 0; i < retryQueries.length; i++) {
              console.log(`AI generated Retry SQL query ${i + 1}:`, retryQueries[i]);
              const res = await prisma.$queryRawUnsafe(retryQueries[i]);
              combinedResults.push(res);
            }
            queries.splice(0, queries.length, ...retryQueries);
            dbErrorStr = null;
          } catch (retryErr) {
            console.error('AI DB Query Error attempt 2:', retryErr.message);
            dbErrorStr = retryErr.message;
          }
        }
      }

      if (dbErrorStr) {
         aiResponse = "מצטער, נתקלתי בשגיאה בעת שליפת הנתונים מהמסד (שגיאת תחביר שאילתה). אנא נסה לנסח את השאלה אחרת.";
      } else {
        // In the UI, we show the LAST successful query's results as the tableData
        tableData = combinedResults[combinedResults.length - 1];
        sqlQueryToReturn = queries.join('\\n');

        const followupPrompt = `The user asked: "${prompt}".
You executed the following SQL queries:
${queries.join('\n')}

The database returned these JSON results (in order):
${JSON.stringify(combinedResults, (key, value) => typeof value === 'bigint' ? value.toString() : value)}

Please provide a short, clear, and friendly natural language answer to the user in Hebrew based on these database results. 
DO NOT tell the user you are showing a table, and DO NOT output raw JSON or Markdown tables. 
DO NOT use any markdown formatting like asterisks (**) for bolding or bullet points. Use standard text and plain dashes (-) for lists.
IMPORTANT: ALWAYS prefer using and displaying the Hebrew dates (like "ט' באב תשפ"ד") instead of Gregorian dates if they are available in the data.
Summarize the information nicely as a helpful customer service representative. For example, instead of listing all items, say "יש לנו 5 שמלות מדגם זה במידות 38-42".`;
        
        aiResponse = await generateContent(followupPrompt);
      }
    }

    const safeData = tableData ? JSON.parse(JSON.stringify(tableData, (key, value) => typeof value === 'bigint' ? value.toString() : value)) : null;

    return NextResponse.json({ response: aiResponse, data: safeData, sqlQuery: sqlQueryToReturn });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
