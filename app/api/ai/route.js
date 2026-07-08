import { NextResponse } from 'next/server';
import { generateContent } from '../../../lib/ai/gemini';
import prisma from '../../lib/prisma';
import { checkAuth } from '../../../lib/auth';


const SCHEMA_CONTEXT = `
Here is the SQLite database schema for the system:

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
You have access to the SQLite database schema shown below.
${SCHEMA_CONTEXT}

When the user asks a question that requires data from the database, you must FIRST output ONLY a valid SQLite SQL query starting with the exact prefix "SQL: ". 
For example, if asked "How many customers do we have?", output:
SQL: SELECT COUNT(*) as 'כמות לקוחות' FROM Customer WHERE isDeleted = 0;

Rules for SQL query generation:
1. Do NOT include markdown formatting or backticks (\`\`\`) around the SQL query.
2. The query must be valid SQLite syntax.
3. VERY IMPORTANT FOR DATES: In SQLite, avoid functions like YEAR(). Instead use \`strftime('%Y', eventDate) = '2024'\` or \`eventDate LIKE '%2024%'\`.
4. IMPORTANT: Always quote table names that are SQL reserved keywords with double quotes. Specifically, you MUST use "Order" instead of Order, and "Shift" instead of Shift.
5. Be aware of the field names exactly as defined in the schema.
6. If it's a general question that doesn't need database access, just answer it naturally in Hebrew without the "SQL: " prefix.
7. IMPORTANT: When selecting columns, ALWAYS use 'AS' to alias the column names into Hebrew. For example: SELECT firstName AS 'שם פרטי', lastName AS 'שם משפחה'. DO NOT return English column names in the output.`;

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  try {
    const { prompt, history = [], context = '' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Format history into a string
    const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');
    
    // Step 1: Ask the AI for SQL or a direct answer
    const initialPrompt = `${SYSTEM_PROMPT}\n\nSystem Context/Instructions:\n${context}\n\nChat History Context:\n${historyText}\n\nCurrent User Question: ${prompt}`;
    let aiResponse = await generateContent(initialPrompt);
    let tableData = null;

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
      } catch (dbError) {
        console.error('AI DB Query Error attempt 1:', dbError.message);
        dbErrorStr = dbError.message;
        
        // SELF HEALING RETRY
        const retryPrompt = `${SYSTEM_PROMPT}\n\nUser Question: ${prompt}\n\nYou generated this SQL query: ${sqlQuery}\nBut it failed with this SQLite error: ${dbErrorStr}\n\nPlease output ONLY a corrected SQLite SQL query starting with "SQL: " to fix this issue.`;
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
             sqlQuery = retrySql; // Update for the summary prompt
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

    return NextResponse.json({ response: aiResponse, tableData });
  } catch (error) {
    console.error('API Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
