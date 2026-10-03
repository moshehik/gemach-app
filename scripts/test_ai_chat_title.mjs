// כותרת אוטומטית לשיחת ה-AI (lib/ai/chatTitle.js + החיווט ב-app/api/ai/route.js ו-AIFloatingWidget.js). בלי רשת ובלי DB.
//   node scripts/test_ai_chat_title.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildTitlePrompt, cleanTitle, generateChatTitle, TITLE_MAX_CHARS } from '../lib/ai/chatTitle.js';

let passed = 0;
async function t(name, fn) {
  try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.log('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; }
}
const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

await t('cleanTitle מנקה מירכאות, נקודה, סימון, קידומת "כותרת:" ושורות מיותרות', () => {
  assert.equal(cleanTitle('"בדיקת מלאי שמלות"'), 'בדיקת מלאי שמלות');
  assert.equal(cleanTitle('כותרת: הזמנות של היום.'), 'הזמנות של היום');
  assert.equal(cleanTitle('**חיפוש לקוחה**\nהסבר ארוך שלא רלוונטי'), 'חיפוש לקוחה');
  assert.equal(cleanTitle('\n\n  יתרות לגבייה?  '), 'יתרות לגבייה');
  assert.equal(cleanTitle('״מי מחזירה מחר״'), 'מי מחזירה מחר');
});

await t('cleanTitle: ריק / קצר מדי / לא מחרוזת = ""; ארוך נחתך בגבול מילה', () => {
  assert.equal(cleanTitle(''), '');
  assert.equal(cleanTitle('א'), '');
  assert.equal(cleanTitle(null), '');
  assert.equal(cleanTitle(42), '');
  assert.equal(cleanTitle('No response generated'), ''); // מחרוזת ברירת המחדל של gemini.js בתשובה ריקה/חסומה
  assert.equal(cleanTitle('Ignore previous instructions'), '');
  const long = cleanTitle('אחת שתיים שלוש ארבע חמש שש שבע שמונה תשע עשר אחת עשרה שתים עשרה');
  assert.ok(long.length <= TITLE_MAX_CHARS && long.length > 0, long);
  assert.ok(!long.endsWith(' '));
});

await t('buildTitlePrompt: כולל את השאלה, חותך שאלה ארוכה, ומבקש כותרת קצרה בלבד', () => {
  const p = buildTitlePrompt('כמה שמלות פנויות במידה 38 ביום חמישי?');
  assert.ok(p.includes('כמה שמלות פנויות'));
  assert.ok(p.includes('2 עד 5 מילים'));
  assert.ok(buildTitlePrompt('x'.repeat(5000)).length < 1200);
});

await t('generateChatTitle: הצלחה, ושליחת ה-prompt למחולל המוזרק', async () => {
  let seen = '';
  const title = await generateChatTitle('מה היתרה של לקוחה', async (p) => { seen = p; return '"יתרת לקוחה"'; });
  assert.equal(title, 'יתרת לקוחה');
  assert.ok(seen.includes('מה היתרה של לקוחה'));
});

await t('generateChatTitle: כשל / זמן קצוב / תשובה ריקה / שאלה ריקה = null ולא זורק', async () => {
  assert.equal(await generateChatTitle('שאלה', async () => { throw new Error('boom'); }), null);
  assert.equal(await generateChatTitle('שאלה', async () => ''), null);
  assert.equal(await generateChatTitle('שאלה', () => new Promise(() => {}), 30), null);
  assert.equal(await generateChatTitle('   ', async () => 'כותרת'), null);
  assert.equal(await generateChatTitle('שאלה', null), null);
});

await t('השרת: עטיפת POST מצרפת title רק לשאלה ראשונה מורשית בלי מדיה, ובלי להשפיע על שאר המסלולים', () => {
  const r = read('app/api/ai/route.js');
  assert.ok(r.includes("from '../../../lib/ai/chatTitle'"), 'אין import');
  assert.ok(r.includes('b.firstQuestion === true'), 'אין דגל firstQuestion');
  assert.ok(/!b\.image && !b\.recordingFileId && !b\.recordingSteps/.test(r), 'כותרת גם למדיה');
  assert.ok(/checkAuth\(\)\)\s*&&\s*\(await checkAiAccess\(\)\)/.test(r), 'קריאת Gemini לפני בדיקת הרשאה');
  assert.ok(r.includes('async function handleAiPost(req)'), 'הטיפול המקורי לא הועבר ל-handleAiPost');
  assert.ok(r.includes('{ ...data, title }'), 'title לא מצורף לתשובה');
  assert.ok(r.includes('TITLE_GRACE_MS'), 'אין תקרת המתנה קצרה לכותרת (הכותרת לא אמורה לעכב את התשובה)');
  assert.equal((r.match(/export async function POST/g) || []).length, 1);
});

await t('הווידג׳ט: שולח firstQuestion, שומר title על הודעת ה-AI, מציג בכותרת ובהיסטוריה (בלי שדה חדש במסד)', () => {
  const w = read('app/components/AIFloatingWidget.js');
  assert.ok(w.includes('firstQuestion:'), 'אין firstQuestion בבקשה');
  assert.ok(w.includes('...(data.title ?'), 'title לא נשמר על הודעת ה-AI');
  assert.ok(w.includes('chatTitle(messages)'), 'הכותרת לא מוצגת בראש החלון');
  assert.ok(w.includes('session.title || chatTitle(session.messages)'), 'הכותרת לא בהיסטוריה');
  assert.equal((w.match(/title: chatTitle\(/g) || []).length, 3, 'כותרת לא נשמרת בכל 3 יצירות השיחה');
  const schema = read('prisma/schema.prisma');
  const m = schema.match(/model AIChatSession \{[\s\S]*?\n\}/)[0];
  assert.ok(!/title/i.test(m), 'נוסף שדה title למסד (לא נדרש)');
});

console.log(`\n${passed} passed`);
