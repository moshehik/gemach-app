import { NextResponse } from 'next/server';
import { generateContent } from '../../../../lib/ai/gemini';

export async function POST(req) {
  try {
    const { data, prompt, columns, format } = await req.json();

    if (!data || !prompt) {
      return NextResponse.json({ error: 'Data and prompt are required' }, { status: 400 });
    }

    let systemPrompt = '';
    
    if (format === 'pdf') {
      systemPrompt = `You are an expert data analyst and report designer. You are given a JSON array of records and a user request in Hebrew on how to organize, sort, filter, summarize, and layout this data.
Your task is to process the JSON data according to the user's request and output ONLY beautifully formatted HTML code that visually represents this data.

Rules for HTML Output:
1. Output ONLY valid HTML code. Do NOT output markdown code blocks (like \`\`\`html) or any conversational text.
2. The HTML should be ready to be injected into the <body> tag of a document. Do not include <html>, <head>, or <body> tags yourself, just the inner content.
3. You must use RTL (Right-to-Left) text direction logically in your design.
4. Design the layout using inline styles or generic HTML tags. You can use tables, headers (<h2>, <h3>), lists, or flexbox layouts to create a clean, elegant, and professional report.
5. If the user asks to group data, create visual sections or grouped tables. If they ask for a summary, highlight the summary at the top or bottom.
6. The keys in the data represent: ${JSON.stringify(columns)}. Always display the column names and data in Hebrew.

User Request: "${prompt}"

Data to process:
${JSON.stringify(data)}
`;
    } else {
      systemPrompt = `You are a helpful data analyst. You are given a JSON array of records and a user request in Hebrew on how to organize, sort, filter, or summarize this data.
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
    }

    let aiResponse = await generateContent(systemPrompt);
    
    if (format === 'pdf') {
      // Clean up potential markdown formatting from HTML output
      let htmlString = aiResponse.trim();
      if (htmlString.startsWith('```html')) htmlString = htmlString.replace(/^```html\s*/i, '');
      if (htmlString.startsWith('```')) htmlString = htmlString.replace(/^```\s*/, '');
      if (htmlString.endsWith('```')) htmlString = htmlString.replace(/\s*```$/, '');
      
      return NextResponse.json({ processedData: htmlString.trim() });
    } else {
      // Extract JSON using regex in case AI adds conversational text
      let jsonString = aiResponse;
      const jsonMatch = jsonString.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      } else {
        // Fallback: try to clean markdown if no array brackets found (e.g. if it returned a single object)
        jsonString = jsonString.trim();
        if (jsonString.startsWith('```json')) jsonString = jsonString.replace(/^```json\s*/i, '');
        if (jsonString.startsWith('```')) jsonString = jsonString.replace(/^```\s*/, '');
        if (jsonString.endsWith('```')) jsonString = jsonString.replace(/\s*```$/, '');
        jsonString = jsonString.trim();
      }

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
    }
  } catch (error) {
    console.error('AI Report Error:', error);
    return NextResponse.json({ error: 'Failed to process AI report' }, { status: 500 });
  }
}
