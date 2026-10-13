// נעילת תיקוני סקירת האבטחה 12.10.2026 בעוזר ה-AI: (5) תשובת מדריך האתר עוברת אימות תגיות; (5) route של [OPEN_LINK] בלקוח חייב להיות פנימי.
//   node scripts/test_ai_review_fixes.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const { extractSafeOpenLinks, safeInternalRoute } = await import('../app/components/home/homeLogic.js');
const BS = String.fromCharCode(92); // backslash
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message); process.exitCode = 1; } };

t('route.js: the site-guide answer goes through finalizeTagsAndText (like /statistics), never bare finalizeAiText(guideOut.response)', () => {
  const src = read('app/api/ai/route.js');
  assert.ok(!/finalizeAiText\(\s*guideOut\.response/.test(src), 'bare finalizeAiText on the guide answer is back');
  assert.match(src, /finalizeTagsAndText\(\s*guideOut\.response/);
});
t('statistics route: the guide path still ends in finalizeTagsAndText', () => {
  assert.match(read('app/api/ai/statistics/route.js'), /finalizeTagsAndText\(\s*aiResponse/);
});
t('client: only internal OPEN_LINK routes survive (a leading slash, never two; no protocol, backslash, relative path)', () => {
  const ok = extractSafeOpenLinks('פתחו [OPEN_LINK:/orders/new|הזמנה חדשה] ו[OPEN_LINK:/admin/settings?tab=ord|הגדרות]');
  assert.deepEqual(ok.links, [{ route: '/orders/new', label: 'הזמנה חדשה' }, { route: '/admin/settings?tab=ord', label: 'הגדרות' }]);
  assert.equal(ok.displayText, 'פתחו  ו');
  const bads = ['//evil.com', 'https://evil.com', 'http://evil.com/x', 'javascript:alert(1)', '/' + BS + 'evil.com', BS + BS + 'evil.com', BS + 'evil.com', 'orders/new', ' //evil.com', '/%5Cevil.com', '/%2fevil.com', 'data:text/html,x'];
  for (const bad of bads) {
    const r = extractSafeOpenLinks('[OPEN_LINK:' + bad + '|x]');
    assert.deepEqual(r.links, [], bad + ' must not become a link');
    assert.equal(r.displayText, '', 'the tag is removed from the text');
  }
  assert.equal(safeInternalRoute('//evil.com'), '');
});
t('widget: uses extractSafeOpenLinks, no local unchecked parser left', () => {
  const src = read('app/components/AIFloatingWidget.js');
  assert.match(src, /extractSafeOpenLinks\(afterSettings\)/);
  assert.ok(!/function extractOpenLinks/.test(src));
});
console.log('\n' + passed + ' passed');
