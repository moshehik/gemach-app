import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';

const SCHEMA_MAP = {
  customers: "Table: Customer\nColumns: id, firstName, lastName, phone1, phone2, city, street, houseNum, email, notes, isDeleted",
  orders: "Table: Order\nColumns: id, orderId, customerId, totalAmount, paymentDate, paymentMethod, status, isPaid, isDeleted, eventDate, eventDateHebrew, returnDate\nRelated Table: Customer (id, firstName, lastName, phone1, phone2, city)",
  dresses: "Table: DressItem\nColumns: id, dressModelId, dressName, barcodePrefix, sizeText, serialNumber, dressBarcode, location, locationNum, quantity, inRepair, notInUse\nRelated Table: DressModel (id, name, priceCategory)",
  rentals: "Table: OrderItem\nColumns: id, orderId, dressItemId, barcode, barcodePrefix, price, sizeText, finalPrice, isTaken, isReturned, returnedOk\nRelated Tables: Order (orderId, customerId), Customer (id, firstName, lastName), DressItem (id, dressName, dressBarcode)"
};

const TABLE_MAP = {
  customers: "Customer",
  orders: "Order",
  dresses: "DressItem",
  rentals: "OrderItem"
};

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  
  try {
    const { prompt, pageContext } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const schemaContext = SCHEMA_MAP[pageContext] || SCHEMA_MAP['customers'];
    const tableName = TABLE_MAP[pageContext] || "Customer";

    const systemPrompt = `You are a smart database filtering assistant.
The user wants to search for data in the following table schema:
${schemaContext}

Your task is to generate ONLY a valid PostgreSQL WHERE clause (without the WHERE keyword itself) based on the user's natural language request.
Be smart about variations. For example, if the user searches for the name "שיינועטר", use LIKE operators to cover variations like "שיינועטר", "שינוטר", "שיינאטר", etc. If the user searches for a date, handle it properly.

Rules:
1. Your response MUST START with the exact prefix "SQL: ".
2. ONLY output the PostgreSQL condition. Absolutely no markdown, no \`\`\`, no explanations.
3. Ensure you use the exact column names from the schema. Remember to use double quotes for camelCase column names like "firstName" or "lastName". Booleans must be true/false.
4. If searching text, use LIKE '%value%' or OR conditions.
5. Remember that the main table is "${tableName}". If you need to filter by a related table, use a subquery (e.g. \`"customerId" IN (SELECT id FROM "Customer" WHERE ...)\`).

Example output for "משפחת כהן או לוי מירושלים":
SQL: (lastName LIKE '%כהן%' OR lastName LIKE '%לוי%') AND city LIKE '%ירושלים%'
`;

    let aiResponse = await generateContent(`${systemPrompt}\n\nUser request: ${prompt}`);
    
    console.log('AI Smart Search Raw Response:', aiResponse);
    
    const parseWhereClause = (response) => {
       let clause = response.trim();
       
       const sqlMatch = clause.match(/```(?:sql)?([\s\S]*?)```/);
       if (sqlMatch) clause = sqlMatch[1].trim();
       
       if (clause.startsWith('SQL:')) clause = clause.replace(/^SQL:\s*/i, '').trim();
       clause = clause.replace(/^WHERE /i, '');
       return clause.trim() || '1=1'; // Fallback to 1=1 if empty
    };

    let whereClause = parseWhereClause(aiResponse);
    console.log('AI Smart Search Cleaned Where Clause:', whereClause);

    const buildQuery = (clause) => {
       let finalCondition = `"isDeleted" = false AND (${clause})`;
       if (pageContext === 'dresses' || pageContext === 'rentals') {
         finalCondition = clause;
       }
       return `SELECT * FROM "${tableName}" WHERE ${finalCondition} LIMIT 100;`;
    };

    let query = buildQuery(whereClause);
    let data = [];
    let querySuccess = false;

    try {
      data = await prisma.$queryRawUnsafe(query);
      querySuccess = true;
    } catch (dbError) {
      console.error('Smart search DB error attempt 1:', dbError.message);
      
      // SELF HEALING RETRY
      const retryPrompt = `${systemPrompt}\n\nUser request: ${prompt}\n\nYou generated this condition: ${whereClause}\nBut it failed with this PostgreSQL error: ${dbError.message}\n\nPlease output ONLY a corrected PostgreSQL condition starting with "SQL: " to fix this issue.`;
      
      let retryResponse = await generateContent(retryPrompt);
      console.log('AI Smart Search Retry Response:', retryResponse);
      
      whereClause = parseWhereClause(retryResponse);
      query = buildQuery(whereClause);
      
      try {
         data = await prisma.$queryRawUnsafe(query);
         querySuccess = true;
      } catch (retryError) {
         console.error('Smart search DB error attempt 2:', retryError.message);
      }
    }

    if (!querySuccess) {
       return NextResponse.json({ error: 'שגיאה בביצוע חיפוש חכם.', details: 'Query execution failed after retry' }, { status: 400 });
    }

    return NextResponse.json({ data, query });
    
  } catch (error) {
    console.error('AI Smart Search Route Error:', error);
    return NextResponse.json({ error: 'Failed to perform smart search' }, { status: 500 });
  }
}
