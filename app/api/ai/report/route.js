import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';

export async function POST(req) {
  try {
    const { data, prompt, columns } = await req.json();

    if (!data || !prompt) {
      return NextResponse.json({ error: 'Data and prompt are required' }, { status: 400 });
    }

    const systemPrompt = `You are a helpful data analyst. You are given a JSON array of records and a user request in Hebrew on how to organize, sort, filter, or summarize this data.
Your task is to process the JSON data according to the user's request and output the resulting data strictly as a valid JSON array of objects.

Rules:
1. Output ONLY a valid JSON array of objects. Do not include any explanations, markdown blocks, or text outside the JSON.
2. The output MUST start with '[' and end with ']'.
3. Try to keep the keys in Hebrew if the user asks for new columns or summaries, or stick to the provided keys if sorting/filtering.
4. Understand the data context based on the columns: ${JSON.stringify(columns)}

User Request: "${prompt}"

Data to process:
${JSON.stringify(data)}
`;

    let aiResponse = await generateContent(systemPrompt);
    
    // Clean up potential markdown formatting
    let jsonString = aiResponse.trim();
    if (jsonString.startsWith('```json')) jsonString = jsonString.replace(/^```json/, '');
    if (jsonString.startsWith('```')) jsonString = jsonString.replace(/^```/, '');
    if (jsonString.endsWith('```')) jsonString = jsonString.replace(/```$/, '');
    jsonString = jsonString.trim();

    let processedData;
    try {
      processedData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', jsonString);
      return NextResponse.json({ error: 'AI returned invalid JSON format' }, { status: 500 });
    }

    if (!Array.isArray(processedData)) {
       // if the AI returned a single object (e.g. summary), wrap it in an array so it can be exported to Excel
       processedData = [processedData];
    }

    return NextResponse.json({ processedData });
  } catch (error) {
    console.error('AI Report Error:', error);
    return NextResponse.json({ error: 'Failed to process AI report' }, { status: 500 });
  }
}
