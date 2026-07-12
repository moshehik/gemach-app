import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';
import { checkAuth } from '../../../../lib/auth';
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

const SYSTEM_PROMPT_BASE = `You are an AI database administrator for the 'Gemach' system.
You will be provided with the user's prompt in Hebrew asking to update, delete, or insert data.
You have access to the FULL PostgreSQL database schema provided below.

Your ONLY job is to output a single valid PostgreSQL SQL query (UPDATE, DELETE, INSERT, or SELECT) that accomplishes what the user is asking.
The user is a system admin, so they have permission to modify data.

Rules for SQL query generation:
1. Do NOT include any explanations, markdown formatting, or backticks (\`\`\`) around the SQL query. Output ONLY the raw SQL.
2. The query must be valid PostgreSQL syntax.
3. VERY IMPORTANT FOR DATES: Use PostgreSQL date functions like EXTRACT(YEAR FROM "eventDate") = 2024. If the user searches by Hebrew month (e.g. 'תשרי', 'חשוון'), map them to their Gregorian month numbers using EXTRACT(MONTH FROM ...).
4. IMPORTANT: Always quote table names and column names with double quotes because PostgreSQL is case-sensitive with identifiers created by Prisma (e.g. "Customer", "firstName", "Order", "isDeleted").
5. Be aware of the field names exactly as defined in the schema.
6. Make sure to format strings properly (using single quotes for string values).`;

export async function POST(req) {
  if (!(await checkAuth('מנהל'))) {
    return NextResponse.json({ error: 'Unauthorized. Admin access required.' }, { status: 401 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const schemaText = getSchemaContext();
    const initialPrompt = `${SYSTEM_PROMPT_BASE}\n\n${schemaText}\n\nUser Question: ${prompt}\n\nGenerate ONLY the raw SQL query string now:`;
    
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

    return NextResponse.json({ sql: query });
  } catch (error) {
    console.error('AI SQL Generation Error:', error);
    return NextResponse.json({ error: 'Failed to generate SQL' }, { status: 500 });
  }
}
