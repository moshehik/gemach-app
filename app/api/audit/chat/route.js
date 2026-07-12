import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';
import { checkAuth } from '../../../../lib/auth';

export async function POST(req) {
  if (!(await checkAuth())) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const todayIso = new Date().toISOString();
    const systemPrompt = `You are a smart audit log filter assistant for a system called "Gemach".
The user is asking a natural language question about system audit logs (e.g., "מי מחק הזמנות אתמול?"). 
Your goal is to extract the filters from their request and return them strictly as a JSON object.

Allowed fields in JSON:
- action: String (can be "CREATE", "UPDATE", "DELETE", "EMAIL_SENT" or null)
- entityType: String (can be "Order", "Customer", "DressItem", "DressModel", "Payment", "Employee" etc., or null)
- startDate: ISO 8601 string (or null)
- endDate: ISO 8601 string (or null)
- search: String (a generic text search term, e.g., name, phone number, or notes. null if none)
- message: String (A short, friendly Hebrew message explaining what you filtered, e.g., "אני מסנן עבורך את כל ההזמנות שנמחקו.")

Rules:
1. ONLY return the JSON object. Do not include markdown formatting like \`\`\`json.
2. If a date is mentioned (like "yesterday", "last week"), calculate the approximate ISO string relative to today: ${todayIso}.
3. If they ask about orders, entityType is "Order". Customers -> "Customer". Dresses -> "DressItem". Users/Employees -> "Employee".
4. If the user searches for a specific value (e.g. size "08", name "כהן"), extract ONLY the value to the 'search' field (e.g. "08" or "כהן").
5. DO NOT include Hebrew field names (like 'מידה' or 'שם') in the 'search' field, because the search runs on raw database JSON values.

Example Output:
{
  "action": "DELETE",
  "entityType": "Order",
  "startDate": "2026-07-10T00:00:00.000Z",
  "endDate": null,
  "search": null,
  "message": "חיפשתי עבורך את כל ההזמנות שנמחקו מהמערכת."
}
`;

    let aiResponse = await generateContent(`${systemPrompt}\n\nUser request: ${prompt}`);
    
    // Clean up potential markdown
    let cleanedResponse = aiResponse.trim();
    if (cleanedResponse.startsWith('\`\`\`')) {
       cleanedResponse = cleanedResponse.replace(/^\`\`\`(json)?/, '').replace(/\`\`\`$/, '').trim();
    }
    
    const filters = JSON.parse(cleanedResponse);
    return NextResponse.json(filters);
  } catch (error) {
    console.error('Audit Chat API Error:', error);
    return NextResponse.json({ error: 'Failed to process chat query' }, { status: 500 });
  }
}
