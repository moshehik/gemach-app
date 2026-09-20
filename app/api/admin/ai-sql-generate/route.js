import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';
import { checkAuth } from '../../../../lib/auth';
import fs from 'fs';
import path from 'path';
import { processHebrewDateMacro } from '../../../../lib/hebrewDate';
import { buildDateContext, getFullSchemaContext, normalizeAiSql } from '../../../../lib/ai/aiCommon';
import { DRAFT_ORDER_STATUS, RESERVED_ORDER_STATUS } from '../../../../lib/orderReservation';

const getSchemaContext = getFullSchemaContext;

const SYSTEM_PROMPT_BASE = `You are an AI database administrator for the 'Gemach' system.
You will be provided with the user's prompt in Hebrew asking to update, delete, or insert data.
You have access to the FULL PostgreSQL database schema provided below.

Your ONLY job is to output a single valid PostgreSQL SQL query (UPDATE, DELETE, INSERT, or SELECT) that accomplishes what the user is asking.
The user is a system admin, so they have permission to modify data.

Rules for SQL query generation:
1. Do NOT include any explanations, markdown formatting, or backticks (\`\`\`) around the SQL query. Output ONLY the raw SQL.
2. The query must be valid PostgreSQL syntax.
3. VERY IMPORTANT FOR DATES: Use PostgreSQL date functions like EXTRACT(YEAR FROM "eventDate") = 2024. For Gregorian dates, use 'YYYY-MM-DD'. If the user searches by Hebrew date, DO NOT GUESS THE GREGORIAN DATE! Instead, use the exact macro HEBREW_DATE(day, 'MONTH', year) in your SQL string, and we will replace it automatically. Example: "eventDate" = HEBREW_DATE(10, 'SIVAN', 5786). Month must be one of: NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II. If year is unknown, use the current Hebrew year from context.
4. IMPORTANT: Always quote table names and column names with double quotes because PostgreSQL is case-sensitive with identifiers created by Prisma (e.g. "Customer", "firstName", "Order", "isDeleted").
5. Be aware of the field names exactly as defined in the schema.
6. Make sure to format strings properly (using single quotes for string values).
7. SOFT DELETE CONVENTION: this system never hard-deletes business rows. When the user asks to delete/remove/cancel records in a table that has an "isDeleted" column (Customer, Order, OrderItem, Payment, DressItem, DressModel, ...) generate UPDATE ... SET "isDeleted" = true (and "deletedAt" = NOW() if that column exists) instead of DELETE. Generate a real DELETE only if the user explicitly says permanent/hard delete (מחיקה סופית / לצמיתות / קשיחה).
8. PLACEHOLDER ORDERS: the "Order"."status" column holds the Hebrew values '${DRAFT_ORDER_STATUS}' (unfinished draft order) and '${RESERVED_ORDER_STATUS}' (temporary reservation). "Draft" means status = '${DRAFT_ORDER_STATUS}' - NEVER the English word 'draft'. For "real orders only" filters use COALESCE("status", '') NOT IN ('${DRAFT_ORDER_STATUS}', '${RESERVED_ORDER_STATUS}') (status is NULL for almost every real order, so a bare NOT IN or <> drops them).
9. TEXT MATCHING in the WHERE of UPDATE/DELETE: when the user gives a value written by hand (city names, names) keep the exact literal they typed - but prefer ILIKE for names/free text in SELECTs. For a SELECT that lists customers or orders show readable columns (order number "orderId", customer first+last name, dates) - never a long UUID "customerId".
10. WHOLE HEBREW MONTH: use "eventDate" >= HEBREW_MONTH_START('ELUL', 5786) AND "eventDate" <= HEBREW_MONTH_END('ELUL', 5786); the system replaces the macros with exact dates.`;

export async function POST(req) {
  if (!(await checkAuth('הנהלה ראשית'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const schemaText = getSchemaContext();
    const dateContext = buildDateContext();
    
    const initialPrompt = `${SYSTEM_PROMPT_BASE}\n\n${schemaText}\n${dateContext}\n\nUser Question: ${prompt}\n\nGenerate ONLY the raw SQL query string now:`;
    
    let aiResponse = await generateContent(initialPrompt);
    
    // Clean up the response in case the model added markdown despite instructions
    let query = aiResponse.trim();
    if (query.startsWith('```sql')) {
        query = query.substring(6);
    } else if (query.startsWith('```')) {
        query = query.substring(3);
    }
    if (query.endsWith('```')) {
        query = query.substring(0, query.length - 3);
    }
    query = query.trim();
    
    query = normalizeAiSql(processHebrewDateMacro(query));

    return NextResponse.json({ sql: query });
  } catch (error) {
    console.error('AI SQL Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate SQL' }, { status: 500 });
  }
}
