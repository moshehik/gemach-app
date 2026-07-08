import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';
import prisma from '../../../lib/prisma';
import { checkAuth } from '../../../../lib/auth';

const SCHEMA_MAP = {
  customers: "model Customer { id Int, firstName String, lastName String, phone1 String, phone2 String, city String, street String, houseNum Int, email String, notes String, isDeleted Boolean }",
  orders: "model Order { id Int, orderId Int, customerId Int, totalAmount Float, paymentDate DateTime, paymentMethod String, status String, isPaid Boolean, isDeleted Boolean, eventDate DateTime, returnDate DateTime }",
  dresses: "model DressItem { id Int, dressModelId Int, dressName String, barcodePrefix Int, sizeText String, serialNumber Int, dressBarcode String, location String, locationNum Int, quantity Int, inRepair Boolean, notInUse Boolean }",
  rentals: "model OrderItem { id Int, orderId Int, dressItemId Int, price Float, sizeText String, finalPrice Float, isTaken Boolean, isReturned Boolean, returnedOk Boolean }"
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

Your task is to generate ONLY a valid SQLite WHERE clause (without the WHERE keyword itself) based on the user's natural language request.
Be smart about variations. For example, if the user searches for the name "שיינועטר", use LIKE operators to cover variations like "שיינועטר", "שינוטר", "שיינאטר", etc. If the user searches for a date, handle it properly.

Rules:
1. ONLY output the SQLite condition. No markdown, no \`\`\`, no explanations.
2. Ensure you use the exact column names from the schema.
3. If searching text, use LIKE '%value%' or OR conditions.
4. Remember that the table name is "${tableName}".

Example output for "משפחת כהן או לוי מירושלים":
(lastName LIKE '%כהן%' OR lastName LIKE '%לוי%') AND city LIKE '%ירושלים%'
`;

    const aiResponse = await generateContent(`${systemPrompt}\n\nUser request: ${prompt}`);
    
    let whereClause = aiResponse.trim();
    if (whereClause.startsWith('\`\`\`sql')) whereClause = whereClause.replace(/^\`\`\`sql/, '');
    if (whereClause.startsWith('\`\`\`')) whereClause = whereClause.replace(/^\`\`\`/, '');
    if (whereClause.endsWith('\`\`\`')) whereClause = whereClause.replace(/\`\`\`$/, '');
    whereClause = whereClause.replace(/^WHERE /i, '');
    whereClause = whereClause.trim();

    // Default basic condition
    let finalCondition = `isDeleted = 0 AND (${whereClause})`;
    
    // Some tables don't have isDeleted
    if (pageContext === 'dresses' || pageContext === 'rentals') {
      finalCondition = whereClause;
    }

    const query = `SELECT * FROM "${tableName}" WHERE ${finalCondition} LIMIT 100;`;
    
    let data = [];
    try {
      data = await prisma.$queryRawUnsafe(query);
    } catch (e) {
      console.error('Smart search DB error:', e.message);
      // Fallback or retry
      return NextResponse.json({ error: 'שגיאה בביצוע חיפוש חכם.', details: e.message }, { status: 400 });
    }

    return NextResponse.json({ data, query });
    
  } catch (error) {
    console.error('AI Smart Search Route Error:', error);
    return NextResponse.json({ error: 'Failed to perform smart search' }, { status: 500 });
  }
}
