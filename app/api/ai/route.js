import { NextResponse } from 'next/server';
import { generateContent } from '../../../lib/ai/gemini';
import { checkAuth } from '../../../lib/auth';
import { getBulkAvailableInventory } from '../../../lib/inventory';
import { cookies } from 'next/headers';
import prisma from '../../lib/prisma';
import fs from 'fs';
import path from 'path';
import { HDate } from '@hebcal/core';
import { getHebrewYearContext, processHebrewDateMacro, getHebrewDateString } from '../../../lib/hebrewDate';

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
3. VERY IMPORTANT FOR DATES: Use PostgreSQL date functions like EXTRACT(YEAR FROM "eventDate") = 2024. For Gregorian dates, use 'YYYY-MM-DD'. If the user searches by a specific Hebrew date, DO NOT GUESS THE GREGORIAN DATE! Instead, use the exact macro HEBREW_DATE(day, 'MONTH', year) in your SQL string, and we will replace it automatically. Example: "eventDate" = HEBREW_DATE(10, 'SIVAN', 5786). Month must be one of: NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II. If year is unknown, use the current Hebrew year from context.
IMPORTANT: If the user searches for a whole Hebrew month (e.g. "מתי בסיוון?"), you cannot use the macro. Instead, query the "eventDateHebrew" column using LIKE. However, you MUST account for Hebrew spelling variations! For example: ("eventDateHebrew" LIKE '%סיון%' OR "eventDateHebrew" LIKE '%סיוון%'). For Iyyar: ('%אייר%' OR '%איר%'). For Cheshvan: ('%חשון%' OR '%חשוון%').
4. IMPORTANT: Always quote table names and column names with double quotes because PostgreSQL is case-sensitive with identifiers created by Prisma (e.g. "Customer", "firstName", "Order", "isDeleted").
5. Be aware of the field names exactly as defined in the schema.
6. If it's a general question that doesn't need database access, just answer it naturally in Hebrew without the "SQL: " prefix.
7. IMPORTANT: When selecting columns, ALWAYS use 'AS' to alias the column names into Hebrew using double quotes. For example: SELECT "firstName" AS "שם פרטי", "lastName" AS "שם משפחה". DO NOT return English column names in the output.
8. CRITICAL RULE FOR TEXT FIELDS: NEVER EVER use '=' to search for text fields like name, model name, customer name, or description! You MUST use 'ILIKE' or 'LIKE' with wildcards. For example, use DM.name LIKE '%אפור טול%' instead of DM.name = 'אפור טול'. This is because the database has full names like "אפור טול שמנת" and exact matches will FAIL.
9. IMPORTANT RULE FOR SIZES: Whenever querying for dress sizes in "DressItem" or "OrderItem", ALWAYS use the "sizeText" column (e.g. "sizeText" = '36'). DO NOT use the "size" column, which is often null for future orders!
10. IMPORTANT: Whenever querying orders or events, ALWAYS select "eventDateHebrew" as the primary date to display to the user, since the system prefers Hebrew dates.
11. IMPORTANT UI FEATURE: If you want to provide a clickable action button for a row, you MUST include two hidden columns in your query: "_actionUrl" and "_actionLabel". 
    - For Customers: Use the UUID 'id' for the URL. Example: SELECT "firstName" AS "שם", "legacyId" AS "מספר לקוח", '/customers/' || "id" AS "_actionUrl", 'תיק לקוח' AS "_actionLabel" FROM "Customer".
    - For Orders: ALWAYS use the short 'orderId' for both display AND URL. NEVER use the UUID 'id' for orders! Example: SELECT "orderId" AS "מספר הזמנה", '/orders/' || "orderId" AS "_actionUrl", 'פרטי הזמנה' AS "_actionLabel" FROM "Order".
12. CRITICAL DISPLAY RULE: When talking to the user or generating data tables, NEVER show long UUIDs (e.g., 'a372870a...'). Always display the short readable numbers: 'orderId' for Orders, 'legacyId' for Customers, and 'legacyId' or 'barcodePrefix' for Dress Models.
13. CRITICAL RULE FOR INVENTORY AVAILABILITY: You CANNOT calculate real-time dress availability for specific dates via SQL. Availability depends on complex JS business logic, buffer days, and interval packing algorithms that do not exist in the database. If a user asks "Is it available?" or "When is it available?", you MUST NOT generate an SQL query. Instead, you MUST output exactly this command on a new line:
ACTION: CHECK_AVAILABILITY({"dates":["YYYY-MM-DD"], "models":[1, "שם דגם"], "sizes":["36", "38"]})
You MUST provide a valid JSON object. "dates" is required (array of strings OR Hebrew date objects). "models" is optional (array of IDs or model names). "sizes" is optional (array of strings).
CRITICAL DATE RULE: For Gregorian dates, use "YYYY-MM-DD". For Hebrew dates (like "י' סיון"), DO NOT GUESS THE GREGORIAN DATE! Instead, pass an object: {"day": 10, "month": "Sivan", "year": 5786}. If the user asks for a whole month (like "מתי בסיוון?"), omit the day: {"month": "Sivan", "year": 5786}. Month names must be one of: Nisan, Iyyar, Sivan, Tamuz, Av, Elul, Tishrei, Cheshvan, Kislev, Tevet, Shvat, Adar I, Adar II. If year is missing, use the current Hebrew year from the context.
The system will then run the complex algorithm and provide you the exact availability results to summarize. Do NOT output SQL if you output this ACTION.
IMPORTANT: If the user explicitly asks to SEE OR FIND ORDERS (e.g., "When was it ordered?", "Show me the orders for this dress"), you SHOULD use a standard SQL query on the "Order" and "OrderItem" tables to find the exact order dates, rather than checking availability!
14. CRITICAL RULE FOR DELETED/INACTIVE DATA: Whenever you query ANY table (e.g. "Customer", "Order", "DressItem", "DressModel", "OrderItem"), you MUST ALWAYS filter out deleted items by adding '"isDeleted" = false' to your WHERE clause. For "DressItem", also add '"notInUse" = false' and '"inRepair" = false' unless explicitly asked about them. Never include deleted or inactive records in counts or lists unless the user specifically asks for them.
15. CRITICAL RULE FOR CONVERSATION: Never attempt to translate Gregorian dates to Hebrew dates in your head or invent Hebrew dates! If you are referring to a date the user mentioned, use the EXACT Hebrew text the user provided (e.g. if the user said 'כ"ה בסיוון', reply with 'כ"ה בסיוון'). Do not shift the date by a day or invent dates like 'כ"ד' or 'כ"ו'.`;

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
      const employee = await prisma.employee.findUnique({ where: { id: token.value } });
      if (employee) {
        if (employee.roleId !== 1 && employee.roleId !== 2) {
          employeeContext = `\nCRITICAL SECURITY RULE: The current user is a standard employee (Role: ${employee.roleId}). Do NOT provide any sensitive financial data (such as total revenues, employee wages, or overall business statistics). Only answer questions related to daily operations like customers, orders, or dress inventory.`;
        } else {
          employeeContext = `\nUser Role: Manager/Admin. Full access to all data is permitted.`;
        }
      }
    }

    const schemaText = getSchemaContext();
    const todayGregorian = new Date().toISOString().split('T')[0];
    const todayHebrew = new HDate().renderGematriya();
    const dateContext = `\nCRITICAL DATE CONTEXT: Today's date is Gregorian: ${todayGregorian}, Hebrew: ${todayHebrew}. You MUST use this as the anchor to calculate any relative dates or Hebrew dates provided by the user. For example, if the user asks for a date in the current Hebrew year, it is the year ${todayHebrew.split(' ').pop()}.
Here is a helpful calendar mapping for the current Hebrew year: ${getHebrewYearContext()}.`;
    
    const initialPrompt = `${SYSTEM_PROMPT_BASE}\n\n${schemaText}\n${employeeContext}${dateContext}\n\nSystem Context/Instructions:\n${context}\n\nChat History Context:\n${historyText}\n\nCurrent User Question: ${prompt}`;
    
    let aiResponse = await generateContent(initialPrompt);
    
    try {
       fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '==== NEW REQUEST ====\nPROMPT:\n' + prompt + '\nAI RESPONSE:\n' + aiResponse + '\n\n');
    } catch(e) {}
    
    let tableData = null;
    let sqlQueryToReturn = null;

    // Check for Custom Action with JSON payload
    const actionRegex = /ACTION:\s*CHECK_AVAILABILITY\(([\s\S]+?)\)/i;
    const actionMatch = actionRegex.exec(aiResponse);

    if (actionMatch) {
      try {
        let jsonStr = actionMatch[1].trim();
        // Remove markdown backticks if AI added them
        if (jsonStr.startsWith('\`\`\`json')) jsonStr = jsonStr.replace(/^\`\`\`json/, '');
        if (jsonStr.startsWith('\`\`\`')) jsonStr = jsonStr.replace(/^\`\`\`/, '');
        if (jsonStr.endsWith('\`\`\`')) jsonStr = jsonStr.replace(/\`\`\`$/, '');
        jsonStr = jsonStr.trim();
        
        const requestData = JSON.parse(jsonStr);
        let { dates = [], models: requestedModels = [], sizes: requestedSizes = [] } = requestData;
        
        // Ensure they are arrays, in case AI returned a single item instead of an array
        if (!Array.isArray(dates)) dates = [dates];
        if (!Array.isArray(requestedModels)) requestedModels = [requestedModels];
        if (!Array.isArray(requestedSizes)) requestedSizes = [requestedSizes];
        
        if (!dates || dates.length === 0) {
           throw new Error("No dates provided for CHECK_AVAILABILITY");
        }

        console.log('AI requested CHECK_AVAILABILITY for:', requestData);
        
        const allModels = await prisma.dressModel.findMany();
        const modelMap = {};
        allModels.forEach(m => modelMap[m.id] = m.name);
        
        const formattedResults = [];
        const currentHebrewYear = parseInt(todayHebrew.split(' ').pop()) || 5784;
        
        let expandedDates = [];
        for (const dateItem of dates) {
           if (typeof dateItem === 'object' && dateItem.month) {
              try {
                const y = dateItem.year || currentHebrewYear;
                if (dateItem.day) {
                  const hd = new HDate(dateItem.day, dateItem.month, y);
                  const d = hd.greg();
                  d.setHours(12, 0, 0, 0); // avoid timezone issues
                  expandedDates.push(d.toISOString().split('T')[0]);
                } else {
                  // User requested a whole month
                  const startOfMonth = new HDate(1, dateItem.month, y);
                  const daysInMonth = startOfMonth.daysInMonth();
                  for (let day = 1; day <= daysInMonth; day++) {
                    const hd = new HDate(day, dateItem.month, y);
                    const d = hd.greg();
                    d.setHours(12, 0, 0, 0);
                    expandedDates.push(d.toISOString().split('T')[0]);
                  }
                }
              } catch (e) {
                console.error("Hebrew date parse error:", e);
                continue;
              }
           } else if (typeof dateItem === 'string') {
              expandedDates.push(dateItem);
           }
        }
        
        for (const dateStr of expandedDates) {
            const targetDate = new Date(dateStr);
            if (isNaN(targetDate)) continue;
           
           const availabilityData = await getBulkAvailableInventory(targetDate);
           
           for (const modelId in availabilityData) {
              const mIdNum = parseInt(modelId, 10);
              const mName = modelMap[modelId] || "";
              if (requestedModels.length > 0) {
                 const matchesId = requestedModels.includes(mIdNum) || requestedModels.includes(modelId.toString());
                 const matchesName = requestedModels.some(reqM => typeof reqM === 'string' && mName.includes(reqM));
                 if (!matchesId && !matchesName) continue;
              }
              
              for (const size in availabilityData[modelId]) {
                 if (requestedSizes.length > 0 && !requestedSizes.some(reqS => size.toString().includes(reqS.toString().trim()))) continue;
                 
                 const invData = availabilityData[modelId][size];
                 formattedResults.push({
                    "תאריך": dateStr,
                    "תאריך עברי": getHebrewDateString(targetDate),
                    "דגם": modelMap[modelId] || modelId,
                    "מידה": size,
                    "זמינות_פנויה": typeof invData === 'object' ? invData.available : invData,
                    "מלאי_כולל": typeof invData === 'object' ? invData.total : invData,
                    "כמות_מוזמנת": typeof invData === 'object' ? invData.booked : 0
                 });
              }
           }
        }
        
        tableData = formattedResults;
        sqlQueryToReturn = `ACTION: CHECK_AVAILABILITY(${JSON.stringify(requestData)})`;
        
        const followupPrompt = `The user asked: "${prompt}".
You requested to check availability for dates: ${dates.join(', ')}.
The sophisticated inventory system returned these availability results (already accounting for all buffer rules and overlap logic):
${JSON.stringify(formattedResults)}

Please provide a short, clear, and friendly natural language answer to the user in Hebrew based on these results.
CRITICAL RULES FOR YOUR RESPONSE:
1. DO NOT use any markdown formatting like asterisks (**) for bolding or bullet points. Use standard text and plain dashes (-) for lists.
2. Whenever you mention a date, you MUST mention BOTH the Hebrew date and the Gregorian date together, with the Gregorian date in parentheses (e.g., "י' בסיוון תשפ\"ו (26/05/2026)"). You MUST extract these dates EXACTLY from the "תאריך עברי" and "תאריך" fields in the availability results JSON provided to you. Do NOT calculate or guess any dates yourself.
3. DO NOT output a long list of consecutive dates! If the results contain many consecutive days, group them into a simple range (e.g., "מ-א' בסיוון (17/05/2026) ועד כ' בסיוון (05/06/2026)"). Keep the response concise and natural.
4. STRICT PRIVACY RULE: You must NEVER expose, mention, or list ANY customer names, phone numbers, or personal details in your text response. Your response is intended to be shown or forwarded to clients, so you must keep all other clients' information completely confidential. Only summarize inventory and availability.
Summarize the information nicely.`;

        try {
           fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== FOLLOWUP PROMPT ====\n' + followupPrompt + '\n');
        } catch(e) {}

        const finalResponse = await generateContent(followupPrompt);
        
        try {
           fs.appendFileSync(path.join(process.cwd(), 'ai-log.txt'), '\n==== FINAL AI RESPONSE ====\n' + finalResponse + '\n\n');
        } catch(e) {}

        return NextResponse.json({ response: finalResponse, data: tableData, sqlQuery: sqlQueryToReturn });
      } catch (err) {
         console.error('Action error:', err);
         aiResponse = "מצטער, נתקלתי בשגיאה בעת פיענוח הבקשה לבדיקת זמינות. אנא נסח את השאלה מחדש.";
      }
    } else {
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
            queries[i] = processHebrewDateMacro(queries[i]);
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
                retryQueries[i] = processHebrewDateMacro(retryQueries[i]);
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
CRITICAL RULES FOR YOUR RESPONSE:
1. DO NOT use any markdown formatting like asterisks (**) for bolding or bullet points. Use standard text and plain dashes (-) for lists.
2. Whenever you mention a date, you MUST mention BOTH the Hebrew date and the Gregorian date together, with the Gregorian date in parentheses (e.g., "י' בסיוון תשפ\"ו (26/05/2026)"). Do NOT calculate or guess any dates yourself, ensure accuracy.
3. DO NOT output a long list of consecutive dates! If the results contain many consecutive days, group them into a simple range (e.g., "מ-א' בסיוון (17/05/2026) ועד כ' בסיוון (05/06/2026)"). Keep the response concise and natural.
4. DO NOT tell the user you are showing a table, and DO NOT output raw JSON or Markdown tables.
5. STRICT PRIVACY RULE: You must NEVER expose, mention, or list ANY customer names, phone numbers, or personal details in your text response, even if you see them in the database results. Your response is intended to be shown or forwarded to clients, so you must keep all other clients' information completely confidential. Only summarize inventory and availability.
Summarize the information nicely as a helpful customer service representative. For example, instead of listing all items, say "יש לנו 5 שמלות מדגם זה במידות 38-42".`;
          
          aiResponse = await generateContent(followupPrompt);
        }
      }
    }

    const safeData = tableData ? JSON.parse(JSON.stringify(tableData, (key, value) => typeof value === 'bigint' ? value.toString() : value)) : null;

    return NextResponse.json({ response: aiResponse, data: safeData, sqlQuery: sqlQueryToReturn });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
