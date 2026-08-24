import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';
import { HDate } from '@hebcal/core';
import { getHebrewYearContext, processHebrewDateMacro } from '../../../../lib/hebrewDate';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS } from '../../../../lib/orderReservation';

// Types below mirror prisma/schema.prisma: all `id` / foreign-key columns are UUID strings
// (Prisma's `@id @default(uuid())`), never numeric, except Order.orderId/legacyId/DressModel
// fields explicitly typed Int. Getting this wrong makes the AI emit numeric comparisons like
// "id" = 5 against a UUID column, which fail or silently return nothing.
const SCHEMA_MAP = {
  customers: "model Customer { id String (UUID), legacyId Int, firstName String, lastName String, phone1 String, phone2 String, city String, street String, houseNum Int, email String, notes String, isDeleted Boolean }",
  orders: "model Order { id String (UUID), orderId Int, legacyId Int, customerId String (UUID, FK->Customer.id), totalAmount Float, paymentDate DateTime, paymentMethod String, status String, isPaid Boolean, isDeleted Boolean, eventDate DateTime, eventDateHebrew String, orderDate DateTime, returnDate DateTime }",
  dresses: "model DressItem { id String (UUID), legacyId Int, dressModelId String (UUID, FK->DressModel.id), dressName String, barcodePrefix Int, sizeText String, serialNumber Int, dressBarcode String, location String, locationNum Int, quantity Int, inRepair Boolean, notInUse Boolean, isDeleted Boolean }",
  dressModels: "model DressModel { id String (UUID), legacyId Int, name String, barcodePrefix Int, priceCategory String, isDeleted Boolean } -- the dress DESIGN; DressItem.dressModelId joins here for the model's name/category. DressItem.dressName mirrors DressModel.name and can be used directly without a join.",
  rentals: "model OrderItem { id String (UUID), legacyId Int, orderId Int (FK->Order.orderId), dressItemId String (UUID, FK->DressItem.id), price Float, sizeText String, finalPrice Float, isTaken Boolean, isReturned Boolean, returnedOk Boolean, isDeleted Boolean }"
};

const SYSTEM_PROMPT = `You are a helpful and smart AI statistics assistant for a dress rental management system.
You have access to the PostgreSQL database.
When the user asks a statistics question, you must FIRST output ONLY a valid PostgreSQL SQL query starting with the exact prefix "SQL: ".

Rules for SQL query generation:
1. Do NOT include markdown formatting or backticks around the SQL query.
2. The query must be valid PostgreSQL syntax.
3. Use double quotes for table names (e.g. "Order", "Customer") and camelCase column names (e.g. "firstName").
4. Booleans must use true/false, not 1/0.
5. ALWAYS use 'AS' to alias column names into Hebrew. For example: SELECT COUNT(*) AS 'סה"כ לקוחות'.
6. If it's a general question that doesn't need database access, just answer it naturally in Hebrew without the "SQL: " prefix.
7. CRITICAL RULE FOR DELETED/INACTIVE DATA: Whenever you query ANY table (e.g. "Customer", "Order", "DressItem", "DressModel", "OrderItem"), you MUST ALWAYS filter out deleted items by adding '"isDeleted" = false' to your WHERE clause. For "DressItem", also add '"notInUse" = false' and '"inRepair" = false' unless explicitly asked about them. Never include deleted or inactive records in counts or lists unless the user specifically asks for them.
8. VERY IMPORTANT FOR DATES: For Gregorian dates, use 'YYYY-MM-DD'. If the user searches by Hebrew date, DO NOT GUESS THE GREGORIAN DATE! Instead, use the exact macro HEBREW_DATE(day, 'MONTH', year) in your SQL string, and we will replace it automatically. Example: "eventDate" = HEBREW_DATE(10, 'SIVAN', 5786). Month must be one of: NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II. If year is unknown, use the current Hebrew year from context.
9. CRITICAL RULE FOR DRAFT/PLACEHOLDER ORDERS: The "Order" table's "status" column can hold two internal placeholder values that are NOT real orders and must NEVER be counted, summed, or listed as orders/rentals/revenue unless the user explicitly asks about drafts or placeholders: '${DRAFT_ORDER_STATUS}' (an unfinished order the new-order screen autosaved and the employee never completed) and '${RESERVED_ORDER_STATUS}' (a temporary row that only reserves an order number for a card charge). Whenever you query or aggregate "Order" (directly, or by joining through it from "OrderItem"/"Payment"/"PaymentObligation"), you MUST add '"status" NOT IN (''${DRAFT_ORDER_STATUS}'', ''${RESERVED_ORDER_STATUS}'')' to your WHERE clause in addition to the isDeleted filter.
`;

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  
  try {
    const { prompt, history = [], contextQuery = '', pageContext = 'customers' } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const schemaContext = Object.entries(SCHEMA_MAP).map(([k, v]) => `-- ${k} Schema --\n${v}`).join('\n\n');
    const historyText = history.map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`).join('\n');
    
    const todayGregorian = new Date().toISOString().split('T')[0];
    const todayHebrew = new HDate().renderGematriya();
    const dateContext = `\nCRITICAL DATE CONTEXT: Today's date is Gregorian: ${todayGregorian}, Hebrew: ${todayHebrew}. You MUST use this as the anchor to calculate any relative dates or Hebrew dates provided by the user.
Here is a helpful calendar mapping for the current Hebrew year: ${getHebrewYearContext()}.`;
    
    // Step 1: Ask the AI for SQL
    const initialPrompt = `${SYSTEM_PROMPT}\n\nSchema:\n${schemaContext}\n${dateContext}\n\nCurrent Context Query (the user is currently viewing this data, keep this in mind if relevant): ${contextQuery}\n\nChat History:\n${historyText}\n\nCurrent User Question: ${prompt}`;
    let aiResponse = await generateContent(initialPrompt);

    // Step 2: Execute SQL if generated
    if (aiResponse.trim().startsWith('SQL:')) {
      let sqlQuery = aiResponse.trim().replace(/^SQL:\s*/i, '').trim();
      if (sqlQuery.startsWith('\`\`\`sql')) sqlQuery = sqlQuery.replace(/^\`\`\`sql/, '');
      if (sqlQuery.startsWith('\`\`\`')) sqlQuery = sqlQuery.replace(/^\`\`\`/, '');
      if (sqlQuery.endsWith('\`\`\`')) sqlQuery = sqlQuery.replace(/\`\`\`$/, '');
      sqlQuery = sqlQuery.trim();

      let queryResult = null;
      let dbErrorStr = null;

      sqlQuery = processHebrewDateMacro(sqlQuery);

      try {
        queryResult = await prisma.$queryRawUnsafe(sqlQuery);
      } catch (dbError) {
        dbErrorStr = dbError.message;
        
        // Retry
        const retryPrompt = `${SYSTEM_PROMPT}\nSchema:\n${schemaContext}\nUser Question: ${prompt}\n\nYou generated this SQL query: ${sqlQuery}\nBut it failed with this PostgreSQL error: ${dbErrorStr}\n\nPlease output ONLY a corrected PostgreSQL SQL query starting with "SQL: " to fix this issue.`;
        let retryResponse = await generateContent(retryPrompt);
        
        if (retryResponse.trim().startsWith('SQL:')) {
          let retrySql = retryResponse.trim().replace(/^SQL:\s*/i, '').trim();
          if (retrySql.startsWith('\`\`\`sql')) retrySql = retrySql.replace(/^\`\`\`sql/, '');
          if (retrySql.startsWith('\`\`\`')) retrySql = retrySql.replace(/^\`\`\`/, '');
          if (retrySql.endsWith('\`\`\`')) retrySql = retrySql.replace(/\`\`\`$/, '');
          retrySql = retrySql.trim();
          retrySql = processHebrewDateMacro(retrySql);
          
          try {
             queryResult = await prisma.$queryRawUnsafe(retrySql);
             sqlQuery = retrySql;
             dbErrorStr = null;
          } catch (retryErr) {
             dbErrorStr = retryErr.message;
          }
        }
      }

      if (dbErrorStr) {
         aiResponse = "מצטער, נתקלתי בשגיאה בעת חישוב הסטטיסטיקה. אנא נסה לנסח את השאלה אחרת.";
      } else {
        // Step 3: Ask the AI to summarize the result
        const followupPrompt = `The user asked: "${prompt}".
You generated this SQL query: ${sqlQuery}
The database returned this JSON result: ${JSON.stringify(queryResult, (key, value) => typeof value === 'bigint' ? value.toString() : value)}
Please provide a clear and friendly natural language answer to the user in Hebrew based on these statistics. 
CRITICAL RULES FOR YOUR RESPONSE:
1. DO NOT use any markdown formatting like asterisks (**) for bolding or bullet points. Use standard text and plain dashes (-) for lists.
2. Whenever you mention a date, you MUST mention BOTH the Hebrew date and the Gregorian date together, with the Gregorian date in parentheses (e.g., "י' בסיוון תשפ\"ו (26/05/2026)"). Do NOT calculate or guess any dates yourself, ensure accuracy.
3. DO NOT output a long list of consecutive dates! If the results contain many consecutive days, group them into a simple range (e.g., "מ-א' בסיוון (17/05/2026) ועד כ' בסיוון (05/06/2026)"). Keep the response concise and natural.
Summarize the information nicely.
IMPORTANT: You are directly talking to the user. Output ONLY the exact final answer intended for the user, with NO meta-text, NO conversational filler directed at me, and NO prefaces like "Here is a summarizing answer for the user" or "בשמחה".`;
        
        aiResponse = await generateContent(followupPrompt);
      }
    }

    try {
      const { cookies } = await import('next/headers');
      const cookieStore = await cookies();
      const token = cookieStore.get('auth_token');
      const employeeId = token?.value || null;
      if (employeeId) {
        await prisma.aIChatSession.create({
          data: {
            employeeId,
            context: 'סטטיסטיקה',
            messagesJson: JSON.stringify([
              { role: 'user', content: prompt },
              { role: 'model', content: aiResponse }
            ])
          }
        });
      }
    } catch(e) { console.error('Failed to save AI session', e); }

    return NextResponse.json({ response: aiResponse });
  } catch (error) {
    console.error('API Statistics Route Error:', error);
    return NextResponse.json({ error: 'Failed to generate statistics' }, { status: 500 });
  }
}
