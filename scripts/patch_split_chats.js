const fs = require('fs');
let code = fs.readFileSync('app/customer-interface/page.js', 'utf8');

// 1. Replace state definition
const oldState = "const [aiMessages, setAiMessages] = useState([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }]);";
const newState = `const [aiChats, setAiChats] = useState({
    1: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' }],
    2: [{ role: 'assistant', content: 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים, להציג תפוסה מלאה ולענות על שאלות. במה אפשר לעזור?' }]
  });
  const aiMessages = aiChats[stage] || [];`;
code = code.replace(oldState, newState);

// 2. Remove the reset useEffect
const oldEffect = `useEffect(() => {
    setIsAiChatVisible(false);
    setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }]);
  }, [stage]); // Reset chat on stage change`;
code = code.replace(oldEffect, `useEffect(() => { setIsAiChatVisible(false); }, [stage]); // Close chat on stage change`);

// 3. Update handleAiSubmit
const oldHandle1 = "const newMessages = [...aiMessages, userMsg];";
const oldHandle2 = "setAiMessages(newMessages);";
const oldHandle3 = "setAiMessages(prev => [...prev, assistantMsg]);";
const oldHandle4 = "setAiMessages(prev => [...prev, { role: 'assistant', content: 'שגיאת תקשורת.' }]);";

code = code.replace(oldHandle1, "const newMessages = [...(aiChats[stage] || []), userMsg];");
code = code.replace(oldHandle2, "setAiChats(prev => ({ ...prev, [stage]: newMessages }));");
code = code.replace(oldHandle3, "setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage]||[]), assistantMsg] }));");
code = code.replace(oldHandle4, "setAiChats(prev => ({ ...prev, [stage]: [...(prev[stage]||[]), { role: 'assistant', content: 'שגיאת תקשורת.' }] }));");

// 4. Update the "New Chat" buttons
// There are new chat buttons in the code for stage 1 and stage 2:
// Stage 2 chat has: setAiMessages([{ role: 'assistant', content: 'שלום! אני העוזר החכם של המערכת. איך אוכל לעזור לך?' }])
code = code.replace(
    /setAiMessages\(\[\{\s*role:\s*'assistant',\s*content:\s*'[^']+'\s*\}\]\)/g,
    `setAiChats(prev => ({ ...prev, [stage]: [{ role: 'assistant', content: stage === 1 ? 'שלום! אני העוזר החכם של המסך הראשי. במה אוכל לעזור?' : 'שלום! אני העוזר החכם של הקטלוג. אני יכול לסנן עבורך דגמים ולענות על שאלות. במה אפשר לעזור?' }] }))`
);

fs.writeFileSync('app/customer-interface/page.js', code, 'utf8');
console.log('Chat states separated successfully');
