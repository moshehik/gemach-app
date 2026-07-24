import { generateContent } from './lib/ai/gemini.js';
const prompt = `You are an AI generating SQL for 'לאיזה תאריך הוא הוזמן במהלך החודש סיוון עבור אפור טול במידה 36?'.
Rules:
1. VERY IMPORTANT FOR DATES: For Gregorian dates, use 'YYYY-MM-DD'. If the user searches by Hebrew date, DO NOT GUESS THE GREGORIAN DATE! Instead, use the exact macro HEBREW_DATE(day, 'MONTH', year) in your SQL string. Example: "eventDate" = HEBREW_DATE(10, 'SIVAN', 5786). Month must be one of: NISAN, IYYAR, SIVAN, TAMUZ, AV, ELUL, TISHREI, CHESHVAN, KISLEV, TEVET, SHVAT, ADAR_I, ADAR_II. If year is unknown, use the current Hebrew year from context.
2. The schema contains Order, OrderItem, DressItem, DressModel.

Output ONLY the SQL string.`;

generateContent(prompt).then(console.log).catch(console.error);
