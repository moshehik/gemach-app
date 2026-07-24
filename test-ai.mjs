import { generateContent } from './lib/ai/gemini.js';
import { getHebrewYearContext } from './lib/hebrewDate.js';
import fs from 'fs';
import path from 'path';

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
8. IMPORTANT: Whenever querying orders or events, ALWAYS select "eventDateHebrew" as the primary date to display to the user, since the system prefers Hebrew dates.
9. IMPORTANT: Feel free to use GROUP BY, JOINs, and aggregation functions (SUM, COUNT) if the user asks for grouped data, summaries, or cross-referenced data.
10. IMPORTANT UI FEATURE: If you want to provide a clickable action button for a row (like viewing a customer, order, or rental), you MUST include two hidden columns in your query: "_actionUrl" and "_actionLabel". For example: SELECT "firstName" AS "שם", '/customers/' || id AS "_actionUrl", 'תיק לקוח' AS "_actionLabel" FROM "Customer". The frontend will automatically convert these into a button at the end of the row.
11. CRITICAL RULE FOR INVENTORY AVAILABILITY: You CANNOT calculate real-time dress availability for specific dates via SQL. Availability depends on complex JS business logic, buffer days, and interval packing algorithms that do not exist in the database. If a user asks "Is it available?" or "When is it available?", you MUST NOT generate an SQL query. Instead, you MUST output exactly this command on a new line:
ACTION: CHECK_AVAILABILITY({"dates":["YYYY-MM-DD"], "models":[1, "שם דגם"], "sizes":["36", "38"]})
You MUST provide a valid JSON object. "dates" is required (array of strings OR Hebrew date objects). "models" is optional (array of IDs or model names). "sizes" is optional (array of strings).
CRITICAL DATE RULE: For Gregorian dates, use "YYYY-MM-DD". For Hebrew dates (like "י' סיון"), DO NOT GUESS THE GREGORIAN DATE! Instead, pass an object: {"day": 10, "month": "Sivan", "year": 5786}. If the user asks for a whole month (like "מתי בסיוון?"), omit the day: {"month": "Sivan", "year": 5786}. Month names must be one of: Nisan, Iyyar, Sivan, Tamuz, Av, Elul, Tishrei, Cheshvan, Kislev, Tevet, Shvat, Adar I, Adar II. If year is missing, use the current Hebrew year from the context.
The system will then run the complex algorithm and provide you the exact availability results to summarize. Do NOT output SQL if you output this ACTION.
IMPORTANT: If the user explicitly asks to SEE OR FIND ORDERS (e.g., "When was it ordered?", "Show me the orders for this dress"), you SHOULD use a standard SQL query on the "Order" and "OrderItem" tables to find the exact order dates, rather than checking availability!
12. CRITICAL RULE FOR DELETED/INACTIVE DATA: Whenever you query ANY table (e.g. "Customer", "Order", "DressItem", "DressModel", "OrderItem"), you MUST ALWAYS filter out deleted items by adding '"isDeleted" = false' to your WHERE clause. For "DressItem", also add '"notInUse" = false' and '"inRepair" = false' unless explicitly asked about them. Never include deleted or inactive records in counts or lists unless the user specifically asks for them.
13. CRITICAL RULE FOR CONVERSATION: Never attempt to translate Gregorian dates to Hebrew dates in your head or invent Hebrew dates! If you are referring to a date the user mentioned, use the EXACT Hebrew text the user provided (e.g. if the user said 'כ"ה בסיוון', reply with 'כ"ה בסיוון'). Do not shift the date by a day or invent dates like 'כ"ד' or 'כ"ו'.`;

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const fullSchema = fs.readFileSync(schemaPath, 'utf8');
const cleanSchema = fullSchema.replace(/\/\/.*/g, '').replace(/\n\s*\n/g, '\n').trim();
const schemaText = `Here is the FULL PostgreSQL database schema for the system:\n\n${cleanSchema}`;

const dateContext = `\nCRITICAL DATE CONTEXT: Today's date is Gregorian: 2026-07-24, Hebrew: ט' אב תשפ"ו.
Here is a helpful calendar mapping for the current Hebrew year: ${getHebrewYearContext()}.`;

const prompt = "מתי בסיון יש הזמנה לאפור טול 36?";
const initialPrompt = `${SYSTEM_PROMPT_BASE}\n\n${schemaText}\n${dateContext}\n\nCurrent User Question: ${prompt}`;

console.log("SENDING TO GEMINI...");
generateContent(initialPrompt).then(res => {
  console.log("=== GEMINI RESPONSE ===");
  console.log(res);
}).catch(console.error);
