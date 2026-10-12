// בדיקת עשן לממשק מרכז המיילים בלי דפדפן ובלי שרת פיתוח: מקמפל את קבצי ה-JSX עם TypeScript (jsx: react-jsx), ומרנדר כל פאנל לטקסט עם react-dom/server
// על נתוני דוגמה (בצורה שה-API מחזיר). תופס שגיאות רינדור, import חסר, מפתחות חסרים, ומוודא שהטקסטים והפקדים המרכזיים קיימים.
// effects לא רצים ב-SSR, ולכן זו בדיקת "רינדור ראשוני" בלבד - לא תחליף לבדיקה בדפדפן (גרירת צ'יפים, תצוגה מקדימה חיה, העלאות).
// הרצה: node scripts/email-center-tests/ui-smoke.test.mjs
import assert from 'node:assert/strict';
import { register } from 'node:module';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const rootUrl = pathToFileURL(ROOT + path.sep).href;
const require = createRequire(path.join(ROOT, 'package.json'));

register('data:text/javascript,' + encodeURIComponent(String.raw`
import { createRequire } from 'node:module';
const ROOT = ${JSON.stringify(rootUrl)};
const ts = createRequire(${JSON.stringify(path.join(ROOT, 'package.json'))})('typescript');
const hasExt = (x) => /\.[a-z]+$/.test(x);
export async function resolve(spec, ctx, next) {
  if (spec === '@/app/lib/prisma') return { url: 'stub:prisma', shortCircuit: true, format: 'module' };
  if (spec === '@/lib/settingsCache') return { url: 'stub:settings', shortCircuit: true, format: 'module' };
  if (spec === 'next/link') return { url: 'stub:link', shortCircuit: true, format: 'module' };
  if (spec === 'next/navigation') return { url: 'stub:nav', shortCircuit: true, format: 'module' };
  if (spec === 'next/dynamic') return { url: 'stub:dynamic', shortCircuit: true, format: 'module' };
  if (spec.endsWith('.css')) return { url: 'stub:css', shortCircuit: true, format: 'module' };
  if (spec.startsWith('@/')) return next(ROOT + spec.slice(2) + (hasExt(spec) ? '' : '.js'), ctx);
  try { return await next(spec, ctx); } catch (e) {
    if (spec.startsWith('.') && !hasExt(spec)) return next(spec + '.js', ctx);
    throw e;
  }
}
export async function load(url, ctx, nextLoad) {
  if (url === 'stub:prisma') return { format: 'module', shortCircuit: true, source: 'export default {};' };
  if (url === 'stub:settings') return { format: 'module', shortCircuit: true, source: 'export const getAllCachedSettings = async () => []; export const getCachedSetting = async () => null; export const invalidateSettingsCache = () => {};' };
  if (url === 'stub:css') return { format: 'module', shortCircuit: true, source: 'export default {};' };
  if (url === 'stub:link') return { format: 'module', shortCircuit: true, source: 'const React = globalThis.__React; export default function Link({href, children, ...r}) { return React.createElement("a", {href, ...r}, children); }' };
  if (url === 'stub:nav') return { format: 'module', shortCircuit: true, source: 'export const useRouter = () => ({ push() {}, replace() {} }); export const useSearchParams = () => new URLSearchParams();' };
  if (url === 'stub:dynamic') return { format: 'module', shortCircuit: true, source: 'export default function dynamic() { return () => null; }' };
  if (url.startsWith('file:') && url.endsWith('.js') && /\/(app\/components|components)\//.test(url) && !url.includes('node_modules')) {
    const r = await nextLoad(url, { ...ctx, format: 'module' });
    const src = String(r.source);
    const out = ts.transpileModule(src, { fileName: 'x.jsx', compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
    return { format: 'module', shortCircuit: true, source: out.outputText };
  }
  return nextLoad(url, ctx);
}`), import.meta.url);

const React = (await import('react')).default;
globalThis.__React = React;
const { renderToStaticMarkup } = await import('react-dom/server');

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log('  ok   -', name); } catch (e) { console.error('  FAIL -', name, '\n        ', String(e.stack || e.message).slice(0, 900)); process.exitCode = 1; } };

const noop = () => {};
const vars = [{ key: 'gmachName', label: 'שם הגמ"ח', example: 'גמ"ח' }, { key: 'customerName', label: 'שם הלקוח/ה', example: 'רחל' }, { key: 'orderId', label: 'מספר הזמנה', example: '12' }];
const email = {
  id: 'pickupReminder', editable: true, enabled: true, enabledEditable: true, enabledMode: 'setting', enabledNote: 'אותה הגדרה קיימת',
  subject: { default: 'תזכורת {{orderId}}', value: 'תזכורת {{orderId}}', edited: false, note: '' },
  vars,
  lines: [
    { key: 'kicker', label: 'תגית בכותרת', default: 'תזכורת איסוף', value: 'תזכורת איסוף', edited: false, multiline: false, hint: '', vars: [] },
    { key: 'lead', label: 'משפט פתיחה', default: 'שלום {{customerName}}', value: 'שלום {{customerName}}, מחר', edited: true, multiline: true, hint: 'רמז', vars: ['customerName'] },
  ],
  schedule: { modes: ['days_before_event'], note: 'נשלח מה-cron', maxDays: 30, days: [7, 1] },
  edited: true,
};
const catalog = { id: 'pickupReminder', name: 'תזכורת איסוף', trigger: 'cron יומי', recipients: 'הלקוח' };

await t('MergeEditor: רינדור ראשוני עם תפקיד textbox', async () => {
  const { default: MergeEditor, VarPalette, shortLabel } = await import('../../app/components/email-center/MergeEditor.js');
  const html = renderToStaticMarkup(React.createElement(MergeEditor, { value: 'שלום {{customerName}}', vars, ariaLabel: 'שורה', onChange: noop }));
  assert.ok(html.includes('role="textbox"') && /contenteditable/i.test(html), html);
  const pal = renderToStaticMarkup(React.createElement(VarPalette, { vars, onInsert: noop }));
  assert.ok(pal.includes('שם הלקוח/ה') && pal.includes('ec-chip'));
  assert.equal(shortLabel({ label: 'משפט יצירת קשר (מחושב: "או לפנות")', key: 'k' }), 'משפט יצירת קשר');
});

await t('EmailEditor: נושא, שורות, תזמון (ימים 7 ו-1), תצוגה מקדימה, כפתורי שמירה/איפוס', async () => {
  const { default: EmailEditor } = await import('../../app/components/email-center/EmailEditor.js');
  const html = renderToStaticMarkup(React.createElement(EmailEditor, { email, catalog, onBack: noop, onReload: noop, askReset: noop, toast: noop, setError: noop }));
  for (const needle of ['תזכורת איסוף', 'נושא המייל', 'שורות המייל', 'תזמון השליחה', '7 ימים לפני', 'יום אחד לפני', 'יחסית להזמנה', 'לא רלוונטי', 'שמירה', 'איפוס המייל לברירת מחדל', 'sandbox=""', 'הפעלת המייל']) {
    assert.ok(html.includes(needle), `חסר: ${needle}`);
  }
});

await t('EmailEditor: מייל טכני (לא נערך) - תצוגה בלבד, בלי כפתורי שמירה', async () => {
  const { default: EmailEditor } = await import('../../app/components/email-center/EmailEditor.js');
  const tech = { ...email, id: 'errorReportNew', editable: false, enabledEditable: false, enabledMode: 'locked', lines: [], subject: { default: 'x', value: 'x', edited: false }, schedule: { modes: ['immediate'], note: 'n' }, edited: false };
  const html = renderToStaticMarkup(React.createElement(EmailEditor, { email: tech, catalog, onBack: noop, onReload: noop, askReset: noop, toast: noop, setError: noop }));
  assert.ok(html.includes('נעול לעריכה') && !html.includes('איפוס המייל לברירת מחדל') && html.includes('תמיד פעיל'));
});

await t('EmailEditor: orderCreatedAuto מציג בחירה מיד / אחרי X ימים', async () => {
  const { default: EmailEditor } = await import('../../app/components/email-center/EmailEditor.js');
  const e = { ...email, id: 'orderCreatedAuto', schedule: { modes: ['immediate', 'order_after'], note: 'n', maxDays: 30, orderAfterDays: 2 } };
  const html = renderToStaticMarkup(React.createElement(EmailEditor, { email: e, catalog, onBack: noop, onReload: noop, askReset: noop, toast: noop, setError: noop }));
  assert.ok(html.includes('אחרי X ימים') && html.includes('ימים מיצירת ההזמנה') && html.includes('value="2"'));
});

await t('FixedFieldsPanel: שדות, ברירת מחדל, מתג לוגו, איפוס', async () => {
  const { default: FixedFieldsPanel } = await import('../../app/components/email-center/FixedFieldsPanel.js');
  const fixed = [
    { key: 'gmachName', label: 'שם הגמ"ח', hint: 'h', ltr: false, maxLength: 80, defaultValue: 'נווה יעקב', defaultSource: 'setting', value: 'גמ"ח חדש', overridden: true },
    { key: 'showLogo', label: 'הצגת הלוגו בכותרת המייל', hint: 'h', ltr: false, maxLength: 1, defaultValue: '0', defaultSource: 'builtin', value: '0', overridden: false },
  ];
  const html = renderToStaticMarkup(React.createElement(FixedFieldsPanel, { fixed, onReload: noop, askResetAll: noop, toast: noop, setError: noop }));
  for (const needle of ['נתונים קבועים בכל מייל', 'נערך כאן', 'ברירת מחדל: ', 'נווה יעקב', 'מהגדרות האתר', 'איפוס שם הגמ', 'type="checkbox"', 'איפוס כל הנתונים']) assert.ok(html.includes(needle), `חסר: ${needle}`);
});

await t('CampaignPanel: מצבי בחירה, תוכן, תמונה, צרופות, שליחה מיידית/מתוזמנת, הסרה', async () => {
  const { default: CampaignPanel } = await import('../../app/components/email-center/CampaignPanel.js');
  const html = renderToStaticMarkup(React.createElement(CampaignPanel, { campaignVars: [{ key: 'firstName', label: 'שם פרטי', example: 'רחל' }], dryRun: true, cronNote: 'ריצות', root: null, toast: noop, setError: noop }));
  for (const needle of ['כל מאשרי הדיוור', 'לפי עיר', 'לפי תאריך אירוע', 'בחירה ידנית', 'נושא', 'תוכן', 'בחירת תמונה', 'צירוף קובץ', 'שליחת בדיקה לעצמי', 'שליחה מיידית', 'שליחה מתוזמנת', 'סעיף 30א', 'מצב בדיקה', 'דיוורים אחרונים']) assert.ok(html.includes(needle), `חסר: ${needle}`);
});

await t('כל 17 המיילים: loadAdminOverview (נתונים אמיתיים מהרישום) מתרנדרים בעורך בלי שגיאה', async () => {
  const { loadAdminOverview } = await import('../../lib/emailConfig.js');
  const { listEmailCatalog } = await import('../../lib/emailCatalog.js');
  const { default: EmailEditor } = await import('../../app/components/email-center/EmailEditor.js');
  const { default: FixedFieldsPanel } = await import('../../app/components/email-center/FixedFieldsPanel.js');
  const ov = await loadAdminOverview();
  const cat = Object.fromEntries(listEmailCatalog().map((c) => [c.id, c]));
  assert.equal(Object.keys(ov.emails).length, Object.keys(cat).length);
  for (const [id, e] of Object.entries(ov.emails)) {
    const html = renderToStaticMarkup(React.createElement(EmailEditor, { email: e, catalog: cat[id], onBack: noop, onReload: noop, askReset: noop, toast: noop, setError: noop }));
    assert.ok(html.includes(cat[id].name.replace(/"/g, '&quot;')), `${id}: שם המייל חסר`);
    if (e.editable) for (const l of e.lines) assert.ok(html.includes(l.label.replace(/"/g, '&quot;')), `${id}: שורה ${l.key} לא מוצגת`);
  }
  const fixedHtml = renderToStaticMarkup(React.createElement(FixedFieldsPanel, { fixed: ov.fixed, onReload: noop, askResetAll: noop, toast: noop, setError: noop }));
  for (const f of ov.fixed) assert.ok(fixedHtml.includes(f.label.replace(/"/g, '&quot;')), `שדה קבוע ${f.key} לא מוצג`);
});

await t('EmailCenterPage: רינדור ראשוני (טוען) בלי שגיאות import', async () => {
  const { default: Page } = await import('../../app/components/email-center/EmailCenterPage.js');
  const html = renderToStaticMarkup(React.createElement(Page));
  assert.ok(html.includes('מרכז המיילים') && html.includes('טוען את מרכז המיילים'));
});

console.log(`\n${passed} passed${process.exitCode ? ' (עם כשלונות)' : ''}`);
