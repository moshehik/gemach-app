// בדיקות רישום המיילים (lib/emailRegistry.js) מול הקטלוג והתבניות + בטיחות הטקסט (lib/emailText.js).
// הרצה: node scripts/email-center-tests/registry.test.mjs   (בלי DB, בלי רשת)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EMAIL_CATALOG } from '../../lib/emailCatalog.js';
import {
  EMAIL_REGISTRY, COMMON_VARS, allowedVarKeys, exampleVars, resolveSubject, whenWordForDays, FIXED_FIELDS, EXTRA_EMAILS,
} from '../../lib/emailRegistry.js';
import {
  fillVars, varsInText, findUnknownVars, validateText, hasBrokenBraces, renderRichText, richTextToPlain, safeUrl, cleanTextInput,
} from '../../lib/emailText.js';

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', e.message.slice(0, 500)); process.exitCode = 1; } };

// ------------------------------------------------------------------ קטלוג <-> רישום
t('כל מייל בקטלוג קיים ברישום ולהפך', () => {
  assert.deepEqual(Object.keys(EMAIL_REGISTRY).sort(), Object.keys(EMAIL_CATALOG).sort());
});

t('EXTRA_EMAILS לא מתנגשים עם הקטלוג', () => {
  for (const e of EXTRA_EMAILS) assert.ok(!EMAIL_CATALOG[e.id], e.id);
});

// פרמטרים לדוגמה לכל נושא בקטלוג
const SUBJECT_PARAMS = {
  orderCard: { orderId: 123 },
  orderCreatedAuto: { orderId: 123, gmachName: 'גמ"ח שמלות' },
  pickupReminder: { orderId: 123, gmachName: 'גמ"ח שמלות' },
  lateReturnReminder: { orderId: 123 },
  dailyManagerReport: { hebrewDate: 'כז אלול', openedCount: 4, eventTodayCount: 3 },
  manualBarcodesReport: { hebrewDate: 'כז אלול', count: 2 },
  errorReportHumanRequested: { reporterName: 'דנה' },
  agentDigest: { count: 2 },
  policyQuestionnaireSubmitted: { gmachName: 'גמ"ח שמלות', respondentName: 'דנה' },
  courierDeliveries: { groups: [{ title: 'א' }, { title: 'ב' }] },
};
for (const [id, entry] of Object.entries(EMAIL_CATALOG)) {
  const reg = EMAIL_REGISTRY[id];
  if (!reg.subject) continue;
  t(`${id}: תבנית הנושא ברישום = הנושא בקטלוג`, () => {
    const params = SUBJECT_PARAMS[id] || {};
    const vars = { ...exampleVars(id), ...params };
    if (id === 'courierDeliveries') vars.groupCount = params.groups.length;
    const fromReg = resolveSubject(id, null, vars);
    const fromCatalog = entry.subject(params);
    // הדוגמה של "gmachName" בקטלוג היא ברירת המחדל כשלא נשלח; כאן שולחים אותו במפורש
    assert.equal(fromReg, fromCatalog);
  });
}

t('מיילים עם נושא מוקלד (subject:null) אכן מקבלים נושא מהשולח', () => {
  for (const id of ['managerFreeText', 'bulkEventDate', 'internalMessageAlert']) {
    assert.equal(EMAIL_REGISTRY[id].subject, null);
  }
});

// ------------------------------------------------------------------ משתנים בשורות
for (const [id, reg] of Object.entries(EMAIL_REGISTRY)) {
  t(`${id}: כל {{משתנה}} בברירות המחדל מוגדר, ו-vars של כל שורה תקין`, () => {
    const allowed = allowedVarKeys(id);
    const keys = new Set();
    for (const l of reg.lines) {
      assert.ok(!keys.has(l.key), `שורה כפולה ${l.key}`);
      keys.add(l.key);
      assert.deepEqual(findUnknownVars(l.default, allowed), [], `${l.key}: משתנה לא מוגדר`);
      for (const v of (l.vars || [])) assert.ok(allowed.includes(v), `${l.key}: vars מצביע על ${v}`);
      // המשתנים שמופיעים בטקסט חייבים להיות רשומים ב-vars של השורה (מה שמוצג לעורכת כ"משתנים זמינים") או משתפים (gmach*)
      for (const v of varsInText(l.default)) assert.ok((l.vars || []).includes(v) || COMMON_VARS.some((c) => c.key === v), `${l.key}: ${v} חסר ב-vars`);
      assert.equal(hasBrokenBraces(l.default), false);
    }
    if (reg.subject) {
      assert.deepEqual(findUnknownVars(reg.subject.default, allowed), []);
      for (const v of reg.subject.vars) assert.ok(allowed.includes(v), `subject var ${v}`);
    }
    // מייל שנערך חייב לפחות לאפשר נושא או שורות
    if (reg.editable) assert.ok(reg.lines.length > 0 || reg.subject, 'מייל editable בלי כלום לערוך');
    // מצב הפעלה חוקי
    assert.ok(['setting', 'override', 'always', 'locked'].includes(reg.enabled.type));
    if (reg.enabled.type === 'setting') assert.ok(reg.enabled.key);
    assert.ok(reg.schedule && reg.schedule.modes.length > 0);
  });
}

// ------------------------------------------------------------------ מפתחות הטקסט בקוד התבניות
t('כל tx(...) בתבניות מצביע על שורה קיימת ברישום של אותו מייל', () => {
  const src = readFileSync(new URL('../../lib/emailTemplates.js', import.meta.url), 'utf8');
  const fnRe = /export function (render\w+)\(/g;
  const starts = [];
  let m;
  while ((m = fnRe.exec(src))) starts.push({ name: m[1], at: m.index });
  starts.forEach((f, i) => {
    const body = src.slice(f.at, i + 1 < starts.length ? starts[i + 1].at : src.length);
    const ids = [...body.matchAll(/makeTx\(\s*(?:'(\w+)'|triggeredByManager \? '(\w+)' : '(\w+)')/g)].flatMap((x) => [x[1], x[2], x[3]].filter(Boolean));
    if (!ids.length) return;
    const used = [...body.matchAll(/\btx\('(\w+)'/g)].map((x) => x[1]);
    for (const id of ids) {
      for (const k of used) assert.ok(EMAIL_REGISTRY[id].lines.some((l) => l.key === k), `${f.name}: tx('${k}') לא רשום ב-${id}`);
    }
  });
});

// ------------------------------------------------------------------ שדות קבועים
t('שדות קבועים: מפתחות ייחודיים, ברירת מחדל מהגדרות רק לשם/כתובת/טלפון', () => {
  const keys = FIXED_FIELDS.map((f) => f.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(FIXED_FIELDS.filter((f) => f.settingKey).map((f) => f.settingKey).sort(), ['gmach_address', 'gmach_name', 'gmach_phone']);
});

// ------------------------------------------------------------------ whenWord
t('whenWordForDays', () => {
  assert.equal(whenWordForDays(0), 'היום');
  assert.equal(whenWordForDays(1), 'מחר');
  assert.equal(whenWordForDays(2), 'מחרתיים');
  assert.equal(whenWordForDays(7), 'בעוד 7 ימים');
});

// ------------------------------------------------------------------ emailText
t('fillVars: החלפה, ערך חסר ריק, subject בלי ירידות שורה', () => {
  assert.equal(fillVars('שלום {{ name }}!', { name: 'דנה' }), 'שלום דנה!');
  assert.equal(fillVars('x{{missing}}y', {}), 'xy');
  assert.equal(fillVars('{{a}}', { a: 'שורה1\nשורה2' }, { subject: true }), 'שורה1 שורה2');
  assert.equal(fillVars('{{a}}', { a: 0 }), '0');
});

t('validateText: משתנה לא מוכר / סוגריים שבורים / ארוך מדי / ריק', () => {
  assert.match(validateText('שלום {{evil}}', ['name'], { label: 'ש' }), /משתנה לא מוכר \{\{evil\}\}/);
  assert.match(validateText('שלום {{name', ['name']), /סוגריים/);
  assert.match(validateText('שלום {name}}', ['name']), /סוגריים/);
  assert.match(validateText('x'.repeat(50), ['name'], { max: 10 }), /ארוך מדי/);
  assert.match(validateText('  ', ['name'], { required: true }), /ריק/);
  assert.equal(validateText('שלום {{name}}', ['name']), null);
});

t('cleanTextInput: תווי בקרה, CRLF, חיתוך', () => {
  assert.equal(cleanTextInput('a\u0000b\r\nc'), 'ab\nc');
  assert.equal(cleanTextInput('a\nb\tc', { multiline: false }), 'a b c');
  assert.equal(cleanTextInput('x'.repeat(30), { max: 5 }), 'xxxxx');
  assert.equal(cleanTextInput(5), '');
});

const FORBIDDEN = [/<script/i, /<img/i, /<iframe/i, /href="javascript:/i, /href="data:/i, /<svg/i, /<style/i, /<a [^>]*\son\w+=/i];
t('renderRichText: אין דרך להכניס תגית (סניטיזציה)', () => {
  const attacks = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[לחצו](javascript:alert(1))',
    '[לחצו](JaVaScRiPt:alert(1))',
    '[לחצו](data:text/html;base64,PHNjcmlwdD4=)',
    '**<b onclick=1>x</b>**',
    '[x](https://a.test/"onmouseover="alert(1))',
    '[x](https://a.test/><script>alert(1)</script>)',
    '"><svg onload=alert(1)>',
    '<iframe src=//evil></iframe>',
  ];
  for (const a of attacks) {
    const html = renderRichText(a);
    for (const re of FORBIDDEN) assert.ok(!re.test(html), `${a} -> ${html}`);
    // אחרי הסרת תגיות ההיתר (div/strong/a) לא נשארת אף תגית
    const rest = html.replace(/<\/?(div|strong|a)\b[^>]*>/g, '');
    assert.ok(!/<[a-z!\/]/i.test(rest), `${a} -> נשארה תגית: ${rest}`);
  }
});

t('renderRichText: הדגשה וקישורים בטוחים עובדים; משתנים עוברים escape', () => {
  assert.ok(renderRichText('שלום **עולם**').includes('<strong>עולם</strong>'));
  const link = renderRichText('[האתר](https://example.com/a?b=1&c=2)');
  assert.ok(link.includes('<a href="https://example.com/a?b=1&amp;c=2"'));
  assert.ok(renderRichText('[מייל](mailto:a@b.co)').includes('href="mailto:a@b.co"'));
  const withVars = renderRichText('שלום {{firstName}}', { firstName: '<b>x</b>' });
  assert.ok(withVars.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(renderRichText('a\n\nb').includes('height:10px'));
});

t('safeUrl: רק http/https/mailto', () => {
  assert.equal(safeUrl('https://a.test'), 'https://a.test');
  assert.equal(safeUrl('http://a.test/x?y=1'), 'http://a.test/x?y=1');
  assert.equal(safeUrl('mailto:a@b.co'), 'mailto:a@b.co');
  for (const bad of ['javascript:alert(1)', 'data:text/html,x', '//evil.test', 'ftp://x', 'https://a b', '', null, 'https://a.test/"x']) assert.equal(safeUrl(bad), null, String(bad));
});

t('richTextToPlain', () => {
  assert.equal(richTextToPlain('**שלום** [האתר](https://a.test)'), 'שלום האתר (https://a.test)');
});

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
