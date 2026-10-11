// תחליף ל-lib/ai/gemini.js לבדיקות שלא צורכות מכסת Gemini (מופעל ע"י FAKE_GEMINI=1 ב-hooks.mjs).
// הבדיקה מגדירה globalThis.__FAKE_GEMINI = async (prompt, callIndex) => טקסט; כל הפרומפטים נרשמים ב-globalThis.__FAKE_GEMINI_PROMPTS.
export const API_KEYS = ['fake'];
export function getApiKey() { return 'fake'; }
export async function generateContent(prompt) {
  const log = (globalThis.__FAKE_GEMINI_PROMPTS ||= []);
  log.push(String(prompt));
  if (typeof globalThis.__FAKE_GEMINI !== 'function') throw new Error('FAKE_GEMINI is on but globalThis.__FAKE_GEMINI is not set');
  return globalThis.__FAKE_GEMINI(String(prompt), log.length - 1);
}
